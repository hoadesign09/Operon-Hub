import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql, { type Connection } from 'mysql2/promise';
import { isLocalDevDatabase, parseServerEnv } from '@/config/env';

export interface ParsedMigration {
  filename: string;
  upSql: string;
  downSql: string;
}

export type MigrationCommand = 'up' | 'down' | 'status';

const MIGRATIONS_DIR = path.resolve(process.cwd(), 'database', 'migrations');
const UP_MARKER_REGEX = /^--\s*UP\s*$/im;
const DOWN_MARKER_REGEX = /^--\s*DOWN\s*$/im;

export function assertLocalDevEnvironment(rawEnv: Record<string, string | undefined>): void {
  const nodeEnv = rawEnv.NODE_ENV;
  const dbHost = rawEnv.DB_HOST;

  if (!isLocalDevDatabase(dbHost, nodeEnv)) {
    throw new Error(
      `[BLOCKED] Migration tự động chỉ được phép khi NODE_ENV=development và DB_HOST là localhost hoặc 127.0.0.1. Hiện tại: NODE_ENV="${nodeEnv ?? ''}", DB_HOST="${dbHost ?? ''}".`,
    );
  }
}

export function parseMigrationSql(content: string, filename: string): ParsedMigration {
  const upMatch = UP_MARKER_REGEX.exec(content);
  const downMatch = DOWN_MARKER_REGEX.exec(content);

  if (!upMatch || !downMatch) {
    throw new Error(
      `File migration "${filename}" thiếu khối bắt buộc "-- UP" hoặc "-- DOWN".`,
    );
  }

  if (downMatch.index <= upMatch.index) {
    throw new Error(
      `File migration "${filename}" sai thứ tự: "-- UP" phải đứng trước "-- DOWN".`,
    );
  }

  const upStart = upMatch.index + upMatch[0].length;
  const upSql = content.slice(upStart, downMatch.index).trim();
  const downStart = downMatch.index + downMatch[0].length;
  const downSql = content.slice(downStart).trim();

  if (upSql.length === 0 || downSql.length === 0) {
    throw new Error(
      `File migration "${filename}" không được để trống câu lệnh trong khối UP hoặc DOWN.`,
    );
  }

  return { filename, upSql, downSql };
}

export function splitSqlStatements(sqlBlock: string): string[] {
  const withoutLineComments = sqlBlock
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n');

  return withoutLineComments
    .split(';')
    .map((stmt) => stmt.trim())
    .filter((stmt) => stmt.length > 0);
}

async function ensureMigrationsTable(conn: Connection): Promise<void> {
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      filename VARCHAR(255) NOT NULL,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT uq_schema_migrations_filename UNIQUE (filename)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

async function loadMigrationFiles(): Promise<ParsedMigration[]> {
  const entries = await fs.readdir(MIGRATIONS_DIR);
  const sqlFiles = entries.filter((name) => name.endsWith('.sql')).sort();
  const parsedList: ParsedMigration[] = [];

  for (const filename of sqlFiles) {
    const fullPath = path.join(MIGRATIONS_DIR, filename);
    const content = await fs.readFile(fullPath, 'utf8');
    parsedList.push(parseMigrationSql(content, filename));
  }

  return parsedList;
}

async function getAppliedFilenames(conn: Connection): Promise<string[]> {
  const [rows] = await conn.execute<mysql.RowDataPacket[]>(
    'SELECT filename FROM schema_migrations ORDER BY id ASC',
  );
  return rows.map((row) => String(row.filename));
}

async function runStatements(conn: Connection, sqlBlock: string): Promise<void> {
  const statements = splitSqlStatements(sqlBlock);
  for (const stmt of statements) {
    await conn.query(stmt);
  }
}

export async function runMigrationCommand(command: MigrationCommand): Promise<void> {
  assertLocalDevEnvironment(process.env);
  const env = parseServerEnv(process.env);
  const migrations = await loadMigrationFiles();

  const conn = await mysql.createConnection({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    charset: 'utf8mb4',
  });

  try {
    await ensureMigrationsTable(conn);
    const applied = await getAppliedFilenames(conn);
    const appliedSet = new Set(applied);

    if (command === 'status') {
      for (const mig of migrations) {
        const state = appliedSet.has(mig.filename) ? 'APPLIED' : 'PENDING';
        console.log(`[${state}] ${mig.filename}`);
      }
      return;
    }

    if (command === 'up') {
      const pending = migrations.filter((mig) => !appliedSet.has(mig.filename));
      if (pending.length === 0) {
        console.log('Không có migration mới nào cần chạy.');
        return;
      }

      for (const mig of pending) {
        await runStatements(conn, mig.upSql);
        await conn.execute('INSERT INTO schema_migrations (filename) VALUES (?)', [mig.filename]);
        console.log(`[UP OK] ${mig.filename}`);
      }
      return;
    }

    const lastApplied = applied[applied.length - 1];
    if (!lastApplied) {
      console.log('Chưa có migration nào để rollback.');
      return;
    }

    const target = migrations.find((mig) => mig.filename === lastApplied);
    if (!target) {
      throw new Error(`Không tìm thấy file migration "${lastApplied}" để rollback.`);
    }

    await runStatements(conn, target.downSql);
    await conn.execute('DELETE FROM schema_migrations WHERE filename = ?', [target.filename]);
    console.log(`[DOWN OK] ${target.filename}`);
  } finally {
    await conn.end();
  }
}

const currentFilePath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(currentFilePath)) {
  const rawCommand = process.argv[2] as MigrationCommand | undefined;
  if (!rawCommand || !['up', 'down', 'status'].includes(rawCommand)) {
    console.error('Cách dùng: tsx --env-file-if-exists=.env database/migrator.ts <up|down|status>');
    process.exit(1);
  }

  runMigrationCommand(rawCommand).catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[MIGRATION ERROR] ${message}`);
    process.exit(1);
  });
}
