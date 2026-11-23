import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseMigrationSql } from '../../database/migrator';

describe('database/hrm-contracts-migration', () => {
  it('chứa đủ khối UP/DOWN, bảng employee_contracts/employee_work_histories, DECIMAL(18, 2) & utf8mb4', async () => {
    const sqlPath = path.resolve(
      process.cwd(),
      'database/migrations/20261123_000006_init_hrm_contracts_histories.sql',
    );
    const content = await fs.readFile(sqlPath, 'utf8');
    const { upSql, downSql } = parseMigrationSql(
      content,
      '20261123_000006_init_hrm_contracts_histories.sql',
    );

    expect(upSql).toContain('CREATE TABLE IF NOT EXISTS employee_contracts');
    expect(upSql).toContain('CREATE TABLE IF NOT EXISTS employee_work_histories');
    expect(upSql).toContain('DECIMAL(18, 2)');
    expect(upSql).toContain('ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');
    expect(upSql).toContain('uq_employee_contracts_contract_no');
    expect(upSql).toContain('fk_employee_contracts_employee_id');
    expect(upSql).toContain('fk_employee_work_histories_employee_id');

    const dropHistIdx = downSql.indexOf('DROP TABLE IF EXISTS employee_work_histories');
    const dropContractsIdx = downSql.indexOf('DROP TABLE IF EXISTS employee_contracts');
    expect(dropHistIdx).toBeGreaterThan(-1);
    expect(dropContractsIdx).toBeGreaterThan(dropHistIdx);
  });
});
