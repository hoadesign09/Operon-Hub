import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  assertLocalDevEnvironment,
  parseMigrationSql,
  splitSqlStatements,
} from '../../database/migrator';

describe('database/migrator guards and SQL parser', () => {
  it('allows only NODE_ENV=development with localhost or 127.0.0.1', () => {
    expect(() =>
      assertLocalDevEnvironment({ NODE_ENV: 'development', DB_HOST: 'localhost' }),
    ).not.toThrow();
    expect(() =>
      assertLocalDevEnvironment({ NODE_ENV: 'development', DB_HOST: '127.0.0.1' }),
    ).not.toThrow();
  });

  it('blocks staging, production, or non-local DB hosts', () => {
    expect(() =>
      assertLocalDevEnvironment({ NODE_ENV: 'production', DB_HOST: '127.0.0.1' }),
    ).toThrow('[BLOCKED]');
    expect(() =>
      assertLocalDevEnvironment({ NODE_ENV: 'staging', DB_HOST: 'localhost' }),
    ).toThrow('[BLOCKED]');
    expect(() =>
      assertLocalDevEnvironment({ NODE_ENV: 'development', DB_HOST: '10.0.0.50' }),
    ).toThrow('[BLOCKED]');
    expect(() =>
      assertLocalDevEnvironment({ NODE_ENV: 'development', DB_HOST: 'db.prod.company.vn' }),
    ).toThrow('[BLOCKED]');
  });

  it('validates that migrations contain both non-empty UP and DOWN blocks', () => {
    const validSql = `
-- UP
CREATE TABLE demo (id BIGINT PRIMARY KEY);
-- DOWN
DROP TABLE IF EXISTS demo;
`;
    const parsed = parseMigrationSql(validSql, '001_demo.sql');
    expect(splitSqlStatements(parsed.upSql)).toHaveLength(1);
    expect(splitSqlStatements(parsed.downSql)).toHaveLength(1);

    expect(() => parseMigrationSql('-- UP\nCREATE TABLE demo (id INT);', 'missing_down.sql')).toThrow(
      'thiếu khối bắt buộc',
    );
    expect(() => parseMigrationSql('-- UP\n   \n-- DOWN\nDROP TABLE demo;', 'empty_up.sql')).toThrow(
      'không được để trống',
    );
  });

  it('validates actual initial settings migration file complies with standards', async () => {
    const migrationPath = path.resolve(
      process.cwd(),
      'database',
      'migrations',
      '20261123_000001_init_settings.sql',
    );
    const content = await fs.readFile(migrationPath, 'utf8');
    const parsed = parseMigrationSql(content, '20261123_000001_init_settings.sql');

    expect(parsed.upSql).toContain('CREATE TABLE IF NOT EXISTS settings');
    expect(parsed.upSql).toContain('utf8mb4_unicode_ci');
    expect(parsed.upSql).toContain('uq_settings_setting_key');
    expect(parsed.upSql).toContain('deleted_at');
    expect(parsed.downSql).toContain('DROP TABLE IF EXISTS settings');
  });
});
