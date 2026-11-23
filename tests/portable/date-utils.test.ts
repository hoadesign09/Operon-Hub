import { describe, expect, it } from 'vitest';
import { countWorkingDays, formatDateTimeVN, formatDateVN } from '@/lib/portable/date-utils';

describe('portable/date-utils', () => {
  it('formats dates and datetimes into Vietnamese format', () => {
    expect(formatDateVN('2026-11-23')).toBe('23/11/2026');
    expect(formatDateTimeVN('2026-11-23T09:05:00')).toBe('23/11/2026 09:05');
  });

  it('returns fallback for null, undefined, or invalid dates', () => {
    expect(formatDateVN(null)).toBe('-');
    expect(formatDateVN(undefined, 'N/A')).toBe('N/A');
    expect(formatDateVN('not-a-date')).toBe('-');
    expect(formatDateTimeVN('')).toBe('-');
  });

  it('counts working days excluding weekends and holidays', () => {
    // 2026-11-23 (Mon) to 2026-11-29 (Sun) -> 5 weekdays
    expect(countWorkingDays('2026-11-23', '2026-11-29')).toBe(5);
    expect(
      countWorkingDays('2026-11-23', '2026-11-29', {
        holidays: ['2026-11-25'],
      }),
    ).toBe(4);
    expect(countWorkingDays('2026-11-29', '2026-11-23')).toBe(0);
    expect(countWorkingDays('invalid', '2026-11-29')).toBe(0);
  });
});
