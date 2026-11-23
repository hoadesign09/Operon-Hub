import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const MIGRATION_PATH = path.resolve(
  process.cwd(),
  'database/migrations/20261123_000013_init_hrm_rooms_announcements.sql',
);

describe('Migration 000013 — Meeting Rooms & Internal Announcements', () => {
  const sql = readFileSync(MIGRATION_PATH, 'utf8');
  const [upPart, downPart] = sql.split('-- DOWN');

  it('defines UP and DOWN sections with InnoDB and utf8mb4_unicode_ci', () => {
    expect(upPart).toContain('-- UP');
    expect(downPart).toBeTruthy();

    const tables = ['meeting_rooms', 'room_bookings', 'announcements', 'announcement_reads'];
    for (const table of tables) {
      expect(upPart).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    }

    const engineMatches = upPart.match(/ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci/g);
    expect(engineMatches?.length).toBe(4);
  });

  it('includes composite schedule index, composite PK and foreign keys following naming standard', () => {
    expect(upPart).toContain('uq_meeting_rooms_code');
    expect(upPart).toContain('fk_meeting_rooms_branch_id');
    expect(upPart).toContain('idx_room_bookings_room_schedule (room_id, status, start_time, end_time)');
    expect(upPart).toContain('fk_room_bookings_room_id');
    expect(upPart).toContain('fk_room_bookings_booked_by_employee_id');
    expect(upPart).toContain('fk_room_bookings_cancelled_by');
    expect(upPart).toContain('fk_announcements_branch_id');
    expect(upPart).toContain('fk_announcements_author_id');
    expect(upPart).toContain('PRIMARY KEY (announcement_id, employee_id)');
    expect(upPart).toContain('fk_announcement_reads_announcement_id');
    expect(upPart).toContain('fk_announcement_reads_employee_id');
  });

  it('drops tables in reverse dependency order in DOWN section', () => {
    const idxReads = downPart.indexOf('DROP TABLE IF EXISTS announcement_reads');
    const idxAnn = downPart.indexOf('DROP TABLE IF EXISTS announcements');
    const idxBookings = downPart.indexOf('DROP TABLE IF EXISTS room_bookings');
    const idxRooms = downPart.indexOf('DROP TABLE IF EXISTS meeting_rooms');

    expect(idxReads).toBeGreaterThan(-1);
    expect(idxAnn).toBeGreaterThan(idxReads);
    expect(idxBookings).toBeGreaterThan(idxAnn);
    expect(idxRooms).toBeGreaterThan(idxBookings);
  });
});
