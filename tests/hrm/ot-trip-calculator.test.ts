import { describe, expect, it } from 'vitest';
import {
  calculateOtHours,
  calculateTripDays,
  classifyOtRateType,
  doDateRangesOverlap,
  doTimeRangesOverlap,
} from '@/modules/hrm/requests/ot-trip-calculator';

describe('hrm/ot-trip-calculator', () => {
  it('tự động phân loại chính xác hệ số OT 150% / 200% / 300%', () => {
    // 2026-11-23 là Thứ 2 -> 150%
    expect(classifyOtRateType('2026-11-23')).toBe('WEEKDAY_150');
    // 2026-11-28 là Thứ 7 -> 200%
    expect(classifyOtRateType('2026-11-28')).toBe('WEEKEND_200');
    // 2026-11-29 là Chủ nhật -> 200%
    expect(classifyOtRateType('2026-11-29')).toBe('WEEKEND_200');
    // Cờ ngày lễ -> 300% (ưu tiên cao nhất kể cả cuối tuần)
    expect(classifyOtRateType('2026-11-28', { isHoliday: true })).toBe('HOLIDAY_300');
    // Danh sách holidays -> 300%
    expect(classifyOtRateType('2026-09-02', { holidays: ['2026-09-02'] })).toBe('HOLIDAY_300');
  });

  it('tính giờ OT chính xác và chặn giờ ngược, quá ngắn (<0.5h) hoặc quá dài (>12h)', () => {
    expect(calculateOtHours('18:00', '20:30')).toBe(2.5);
    expect(calculateOtHours('20:00', '24:00')).toBe(4);

    expect(() => calculateOtHours('20:00', '18:00')).toThrow(/lớn hơn giờ bắt đầu/);
    expect(() => calculateOtHours('18:00', '18:15')).toThrow(/0.5 giờ/);
    expect(() => calculateOtHours('08:00', '21:00')).toThrow(/12 giờ/);
  });

  it('kiểm tra trùng khung giờ OT và cho phép nối tiếp sát giờ', () => {
    expect(doTimeRangesOverlap('18:00', '20:00', '19:30', '21:00')).toBe(true);
    expect(doTimeRangesOverlap('18:00', '20:00', '20:00', '22:00')).toBe(false);
  });

  it('tính ngày công tác chuẩn và kiểm tra trùng lịch công tác', () => {
    expect(calculateTripDays('2026-12-01', '2026-12-01')).toBe(1);
    expect(calculateTripDays('2026-12-01', '2026-12-03')).toBe(3);
    expect(() => calculateTripDays('2026-12-05', '2026-12-01')).toThrow(/không được nhỏ hơn/);

    expect(doDateRangesOverlap('2026-12-01', '2026-12-03', '2026-12-03', '2026-12-05')).toBe(true);
    expect(doDateRangesOverlap('2026-12-01', '2026-12-03', '2026-12-04', '2026-12-05')).toBe(false);
  });
});
