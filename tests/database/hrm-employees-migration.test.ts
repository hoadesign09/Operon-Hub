import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseMigrationSql } from '../../database/migrator';

describe('database/hrm-employees-migration', () => {
  it('chứa đủ khối UP/DOWN, bảng employees/employee_documents, FK departments & chuẩn utf8mb4', async () => {
    const sqlPath = path.resolve(
      process.cwd(),
      'database/migrations/20261123_000005_init_hrm_employees.sql',
    );
    const content = await fs.readFile(sqlPath, 'utf8');
    const { upSql, downSql } = parseMigrationSql(
      content,
      '20261123_000005_init_hrm_employees.sql',
    );

    expect(upSql).toContain('CREATE TABLE IF NOT EXISTS employees');
    expect(upSql).toContain('CREATE TABLE IF NOT EXISTS employee_documents');
    expect(upSql).toContain('ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');
    expect(upSql).toContain('uq_employees_employee_code');
    expect(upSql).toContain('uq_employees_work_email');
    expect(upSql).toContain('uq_employees_user_id');
    expect(upSql).toContain('fk_departments_manager_employee_id');

    const dropFkIdx = downSql.indexOf('DROP FOREIGN KEY fk_departments_manager_employee_id');
    const dropDocsIdx = downSql.indexOf('DROP TABLE IF EXISTS employee_documents');
    const dropEmpsIdx = downSql.indexOf('DROP TABLE IF EXISTS employees');

    expect(dropFkIdx).toBeGreaterThan(-1);
    expect(dropDocsIdx).toBeGreaterThan(dropFkIdx);
    expect(dropEmpsIdx).toBeGreaterThan(dropDocsIdx);
  });
});
