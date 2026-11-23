import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseMigrationSql, splitSqlStatements } from '../../database/migrator';

describe('database/migrations/20261123_000010_init_hrm_attendance_summaries.sql', () => {
  it('tạo bảng attendance_summaries chuẩn InnoDB/utf8mb4/DECIMAL(5,2)/UQ và có DOWN rollback', async () => {
    const filePath = path.resolve(
      process.cwd(),
      'database/migrations/20261123_000010_init_hrm_attendance_summaries.sql',
    );
    const content = await fs.readFile(filePath, 'utf8');
    const parsed = parseMigrationSql(content, '20261123_000010_init_hrm_attendance_summaries.sql');

    const upStatements = splitSqlStatements(parsed.upSql);
    const downStatements = splitSqlStatements(parsed.downSql);

    expect(upStatements).toHaveLength(1);
    expect(downStatements).toHaveLength(1);

    expect(parsed.upSql).toContain('CREATE TABLE IF NOT EXISTS attendance_summaries');
    expect(parsed.upSql).toContain('ENGINE=InnoDB');
    expect(parsed.upSql).toContain('utf8mb4_unicode_ci');
    expect(parsed.upSql).toContain('payable_days DECIMAL(5,2)');
    expect(parsed.upSql).toContain('ot_hours_150 DECIMAL(5,2)');
    expect(parsed.upSql).toContain('ot_hours_200 DECIMAL(5,2)');
    expect(parsed.upSql).toContain('ot_hours_300 DECIMAL(5,2)');
    expect(parsed.upSql).toContain("ENUM('DRAFT', 'LOCKED')");
    expect(parsed.upSql).toContain('UNIQUE KEY uq_attendance_summaries_emp_ym (employee_id, year, month)');
    expect(downStatements[0]).toContain('DROP TABLE IF EXISTS attendance_summaries');
  });
});
