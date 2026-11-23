import { describe, expect, it } from 'vitest';
import {
  doBookingIntervalsOverlap,
  formatMysqlDateTime,
  normalizeEquipmentList,
  parseBookingDateTime,
  validateBookingTimeRange,
  validateRoomCapacity,
} from '@/modules/hrm/office/room-booking-validator';
import { computeReadRatePercent } from '@/modules/hrm/office/announcements.service';
import { AppError } from '@/shared/api-response';

describe('Room booking validator & announcement read rate helpers', () => {
  const fixedNow = new Date(2026, 10, 23, 8, 0, 0);

  it('validates booking time range and rejects reversed, too-short, too-long, or past slots', () => {
    const valid = validateBookingTimeRange('2026-11-23T09:00', '2026-11-23T10:30', {
      now: fixedNow,
    });
    expect(valid.durationMinutes).toBe(90);
    expect(formatMysqlDateTime(valid.start)).toBe('2026-11-23 09:00:00');
    expect(formatMysqlDateTime(valid.end)).toBe('2026-11-23 10:30:00');

    // Reversed
    expect(() =>
      validateBookingTimeRange('2026-11-23T11:00', '2026-11-23T10:00', { now: fixedNow }),
    ).toThrow(AppError);

    // Too short (< 15 min)
    expect(() =>
      validateBookingTimeRange('2026-11-23T09:00', '2026-11-23T09:10', { now: fixedNow }),
    ).toThrow(AppError);

    // Too long (> 12h)
    expect(() =>
      validateBookingTimeRange('2026-11-23T08:30', '2026-11-23T21:30', { now: fixedNow }),
    ).toThrow(AppError);

    // Ended in past
    expect(() =>
      validateBookingTimeRange('2026-11-22T09:00', '2026-11-22T10:00', { now: fixedNow }),
    ).toThrow(AppError);

    // Invalid calendar date
    expect(parseBookingDateTime('2026-02-31T09:00')).toBeNull();
  });

  it('detects overlapping intervals accurately while allowing back-to-back boundaries', () => {
    const s1 = parseBookingDateTime('2026-11-23T09:00')!;
    const e1 = parseBookingDateTime('2026-11-23T10:00')!;
    const s2 = parseBookingDateTime('2026-11-23T10:00')!;
    const e2 = parseBookingDateTime('2026-11-23T11:00')!;
    const sOverlap = parseBookingDateTime('2026-11-23T09:30')!;
    const eOverlap = parseBookingDateTime('2026-11-23T10:30')!;

    // Back-to-back boundary (10:00 == 10:00) MUST NOT conflict
    expect(doBookingIntervalsOverlap(s1, e1, s2, e2)).toBe(false);
    expect(doBookingIntervalsOverlap(s2, e2, s1, e1)).toBe(false);

    // Partial & full overlap MUST conflict
    expect(doBookingIntervalsOverlap(s1, e1, sOverlap, eOverlap)).toBe(true);
    expect(doBookingIntervalsOverlap(sOverlap, eOverlap, s2, e2)).toBe(true);
  });

  it('validates room capacity, normalizes equipment list, and computes read rate percentage', () => {
    expect(() => validateRoomCapacity(6, 6)).not.toThrow();
    expect(() => validateRoomCapacity(7, 6)).toThrow(AppError);
    expect(() => validateRoomCapacity(0, 6)).toThrow(AppError);

    expect(normalizeEquipmentList([' TV 65" ', 'tv 65"', '', 'Bảng trắng'])).toEqual([
      'TV 65"',
      'Bảng trắng',
    ]);

    expect(computeReadRatePercent(0, 10)).toBe(0);
    expect(computeReadRatePercent(5, 0)).toBe(0);
    expect(computeReadRatePercent(2, 3)).toBe(66.7);
    expect(computeReadRatePercent(12, 10)).toBe(100);
  });
});
