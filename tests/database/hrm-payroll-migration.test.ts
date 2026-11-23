import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('database/migrations/20261123_000011_init_hrm_payroll.sql', () => {
  const migrationPath = path.resolve(
    process.cwd(),
    'database/migrations/20261123_000011_init_hrm_payroll.sql',
  );
  const sqlContent = fs.readFileSync(migrationPath, 'utf8');

  it('có đầy đủ khối UP/DOWN, InnoDB, utf8mb4_unicode_ci và 3 bảng lương chuẩn', () => {
    expect(sqlContent).toContain('-- UP');
    expect(sqlContent).toContain('-- DOWN');
    expect(sqlContent).toContain('CREATE TABLE IF NOT EXISTS payroll_periods');
    expect(sqlContent).toContain('CREATE TABLE IF NOT EXISTS payslips');
    expect(sqlContent).toContain('CREATE TABLE IF NOT EXISTS payslip_items');

    const utf8Matches = sqlContent.match(
      /ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci/g,
    );
    expect(utf8Matches?.length).toBe(3);

    expect(sqlContent).toContain('DROP TABLE IF EXISTS payslip_items;');
    expect(sqlContent).toContain('DROP TABLE IF EXISTS payslips;');
    expect(sqlContent).toContain('DROP TABLE IF EXISTS payroll_periods;');
  });

  it('sử dụng DECIMAL(18,2) cho tiền tệ, DECIMAL(5,2) cho công/OT và không dùng FLOAT/DOUBLE', () => {
    expect(sqlContent).not.toMatch(/\bFLOAT\b|\bDOUBLE\b/i);
    expect(sqlContent).toContain('total_gross DECIMAL(18,2)');
    expect(sqlContent).toContain('net_salary DECIMAL(18,2)');
    expect(sqlContent).toContain('payable_days DECIMAL(5,2)');
    expect(sqlContent).toContain('UNIQUE KEY uq_payroll_periods_code (code)');
    expect(sqlContent).toContain(
      'UNIQUE KEY uq_payslips_period_employee (payroll_period_id, employee_id)',
    );
    expect(sqlContent).toContain('fk_payslip_items_payslip_id');
  });

  it('seed-core.ts khai báo đầy đủ 4 quyền hrm.payroll.* và cấu hình hrm.payroll.config', () => {
    const seedContent = fs.readFileSync(
      path.resolve(process.cwd(), 'database/seed-core.ts'),
      'utf8',
    );
    expect(seedContent).toContain('hrm.payroll.read');
    expect(seedContent).toContain('hrm.payroll.manage');
    expect(seedContent).toContain('hrm.payroll.approve');
    expect(seedContent).toContain('hrm.payroll.export');
    expect(seedContent).toContain('hrm.payroll.config');
  });
});
