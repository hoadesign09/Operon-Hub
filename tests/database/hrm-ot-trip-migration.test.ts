import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseMigrationSql } from '../../database/migrator';

describe('database/hrm-ot-trip-migration', () => {
  it('chứa đủ khối UP/DOWN, bảng overtime_requests & business_trip_requests, DECIMAL(5, 2), DECIMAL(18, 2) & utf8mb4', async () => {
    const sqlPath = path.resolve(
      process.cwd(),
      'database/migrations/20261123_000008_init_hrm_ot_business_trips.sql',
    );
    const content = await fs.readFile(sqlPath, 'utf8');
    const { upSql, downSql } = parseMigrationSql(
      content,
      '20261123_000008_init_hrm_ot_business_trips.sql',
    );

    expect(upSql).toContain('CREATE TABLE IF NOT EXISTS overtime_requests');
    expect(upSql).toContain('CREATE TABLE IF NOT EXISTS business_trip_requests');
    expect(upSql).toContain('DECIMAL(5, 2)');
    expect(upSql).toContain('DECIMAL(18, 2)');
    expect(upSql).toContain("ENUM('WEEKDAY_150', 'WEEKEND_200', 'HOLIDAY_300')");
    expect(upSql).toContain('ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');
    expect(upSql).toContain('fk_overtime_requests_approval_request_id');
    expect(upSql).toContain('fk_business_trip_requests_approval_request_id');

    const dropTripIdx = downSql.indexOf('DROP TABLE IF EXISTS business_trip_requests');
    const dropOtIdx = downSql.indexOf('DROP TABLE IF EXISTS overtime_requests');
    expect(dropTripIdx).toBeGreaterThan(-1);
    expect(dropOtIdx).toBeGreaterThan(dropTripIdx);
  });
});
