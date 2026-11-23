import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseMigrationSql, splitSqlStatements } from '../../database/migrator';

describe('database/000004 HRM Organization migration', () => {
  it('defines departments and positions tables with utf8mb4, FKs, indexes and DOWN drops', async () => {
    const filePath = path.resolve(
      process.cwd(),
      'database',
      'migrations',
      '20261123_000004_init_hrm_organization.sql',
    );
    const content = await fs.readFile(filePath, 'utf8');
    const parsed = parseMigrationSql(content, '20261123_000004_init_hrm_organization.sql');

    expect(splitSqlStatements(parsed.upSql)).toHaveLength(2);
    expect(splitSqlStatements(parsed.downSql)).toHaveLength(2);
    expect(parsed.upSql).toContain('CREATE TABLE IF NOT EXISTS departments');
    expect(parsed.upSql).toContain('CREATE TABLE IF NOT EXISTS positions');
    expect(parsed.upSql).toContain('fk_departments_branch_id');
    expect(parsed.upSql).toContain('fk_departments_parent_id');
    expect(parsed.upSql).toContain('uq_departments_code');
    expect(parsed.upSql).toContain('uq_positions_code');
    expect(parsed.upSql).toContain('utf8mb4_unicode_ci');
    expect(parsed.downSql).toContain('DROP TABLE IF EXISTS positions');
    expect(parsed.downSql).toContain('DROP TABLE IF EXISTS departments');
  });
});
