import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseMigrationSql } from '../../database/migrator';

describe('database/hrm-leaves-migration', () => {
  it('chứa đủ khối UP/DOWN, 3 bảng leave_types/leave_balances/leave_requests, DECIMAL(5, 2) & utf8mb4', async () => {
    const sqlPath = path.resolve(
      process.cwd(),
      'database/migrations/20261123_000007_init_hrm_leaves.sql',
    );
    const content = await fs.readFile(sqlPath, 'utf8');
    const { upSql, downSql } = parseMigrationSql(
      content,
      '20261123_000007_init_hrm_leaves.sql',
    );

    expect(upSql).toContain('CREATE TABLE IF NOT EXISTS leave_types');
    expect(upSql).toContain('CREATE TABLE IF NOT EXISTS leave_balances');
    expect(upSql).toContain('CREATE TABLE IF NOT EXISTS leave_requests');
    expect(upSql).toContain('DECIMAL(5, 2)');
    expect(upSql).toContain('ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');
    expect(upSql).toContain('uq_leave_types_code');
    expect(upSql).toContain('uq_leave_balances_emp_type_year');
    expect(upSql).toContain('uq_leave_requests_code');
    expect(upSql).toContain('fk_leave_requests_approval_request_id');

    const dropReqIdx = downSql.indexOf('DROP TABLE IF EXISTS leave_requests');
    const dropBalIdx = downSql.indexOf('DROP TABLE IF EXISTS leave_balances');
    const dropTypeIdx = downSql.indexOf('DROP TABLE IF EXISTS leave_types');
    expect(dropReqIdx).toBeGreaterThan(-1);
    expect(dropBalIdx).toBeGreaterThan(dropReqIdx);
    expect(dropTypeIdx).toBeGreaterThan(dropBalIdx);
  });
});
