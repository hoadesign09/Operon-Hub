import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseMigrationSql, splitSqlStatements } from '../../database/migrator';

describe('database/migrations/20261123_000009_init_hrm_attendance.sql', () => {
  it('chứa đủ 4 bảng chuẩn InnoDB/utf8mb4/DECIMAL và thứ tự DOWN ngược khóa ngoại', async () => {
    const filePath = path.resolve(
      process.cwd(),
      'database/migrations/20261123_000009_init_hrm_attendance.sql',
    );
    const content = await fs.readFile(filePath, 'utf8');
    const parsed = parseMigrationSql(content, '20261123_000009_init_hrm_attendance.sql');

    const upStatements = splitSqlStatements(parsed.upSql);
    const downStatements = splitSqlStatements(parsed.downSql);

    expect(upStatements).toHaveLength(4);
    expect(downStatements).toHaveLength(4);

    for (const stmt of upStatements) {
      expect(stmt).toContain('ENGINE=InnoDB');
      expect(stmt).toContain('utf8mb4_unicode_ci');
      expect(stmt).toContain('deleted_at');
    }

    expect(parsed.upSql).toContain('CREATE TABLE IF NOT EXISTS work_shifts');
    expect(parsed.upSql).toContain('working_hours DECIMAL(4,2)');
    expect(parsed.upSql).toContain('CREATE TABLE IF NOT EXISTS employee_shift_assignments');
    expect(parsed.upSql).toContain('CREATE TABLE IF NOT EXISTS holidays');
    expect(parsed.upSql).toContain('CREATE TABLE IF NOT EXISTS attendance_logs');
    expect(parsed.upSql).toContain('worked_hours DECIMAL(5,2)');
    expect(parsed.upSql).toContain('UNIQUE KEY uq_attendance_logs_emp_date (employee_id, work_date)');

    expect(downStatements[0]).toContain('attendance_logs');
    expect(downStatements[1]).toContain('holidays');
    expect(downStatements[2]).toContain('employee_shift_assignments');
    expect(downStatements[3]).toContain('work_shifts');
  });
});
