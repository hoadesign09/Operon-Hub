import { describe, expect, it } from 'vitest';
import {
  computeAttendanceMetrics,
  computeShiftWorkingHours,
  parseFlexibleTime,
  parseFlexibleWorkDate,
  parseTimeToMinutes,
} from '@/modules/hrm/attendance/attendance-calculator';

const STANDARD_SHIFT = {
  startTime: '08:00',
  endTime: '17:30',
  breakStartTime: '12:00',
  breakEndTime: '13:30',
  lateGraceMinutes: 10,
  earlyLeaveGraceMinutes: 10,
};

describe('hrm/attendance-calculator', () => {
  it('tính giờ công chuẩn của ca hành chính và chặn cấu hình giờ sai', () => {
    expect(computeShiftWorkingHours('08:00', '17:30', '12:00', '13:30')).toBe(8);
    expect(computeShiftWorkingHours('08:00', '12:00', null, null)).toBe(4);
    expect(() => computeShiftWorkingHours('17:30', '08:00')).toThrow('lớn hơn');
    expect(() => computeShiftWorkingHours('08:00', '17:30', '12:00', null)).toThrow('nghỉ trưa');
    expect(() => computeShiftWorkingHours('08:00', '17:30', '18:00', '19:00')).toThrow('nằm trong');
  });

  it('tính đúng đi muộn theo dung sai, về sớm và giờ làm trừ nghỉ trưa', () => {
    // Trong dung sai 10 phút (08:09 -> không tính muộn), về đúng 17:30
    const onTime = computeAttendanceMetrics({
      checkInMinutes: parseTimeToMinutes('08:09'),
      checkOutMinutes: parseTimeToMinutes('17:30'),
      shift: STANDARD_SHIFT,
      isHoliday: false,
    });
    expect(onTime.lateMinutes).toBe(0);
    expect(onTime.earlyLeaveMinutes).toBe(0);
    expect(onTime.workedHours).toBe(7.85);
    expect(onTime.status).toBe('PRESENT');

    // Quá dung sai 10 phút (08:25 -> đi muộn 25 phút), về sớm 16:45 (45 phút)
    const lateAndEarly = computeAttendanceMetrics({
      checkInMinutes: parseTimeToMinutes('08:25'),
      checkOutMinutes: parseTimeToMinutes('16:45'),
      shift: STANDARD_SHIFT,
      isHoliday: false,
    });
    expect(lateAndEarly.lateMinutes).toBe(25);
    expect(lateAndEarly.earlyLeaveMinutes).toBe(45);
    expect(lateAndEarly.workedHours).toBe(6.83);
    expect(lateAndEarly.status).toBe('LATE');
  });

  it('xử lý các trạng thái vắng mặt, ngày lễ, override và chặn check-out < check-in', () => {
    const holiday = computeAttendanceMetrics({
      checkInMinutes: null,
      checkOutMinutes: null,
      shift: STANDARD_SHIFT,
      isHoliday: true,
    });
    expect(holiday.status).toBe('HOLIDAY');
    expect(holiday.workedHours).toBe(0);

    const absent = computeAttendanceMetrics({
      checkInMinutes: null,
      checkOutMinutes: null,
      shift: STANDARD_SHIFT,
      isHoliday: false,
    });
    expect(absent.status).toBe('ABSENT');

    const leaveOverride = computeAttendanceMetrics({
      checkInMinutes: null,
      checkOutMinutes: null,
      shift: STANDARD_SHIFT,
      isHoliday: false,
      overrideStatus: 'LEAVE',
    });
    expect(leaveOverride.status).toBe('LEAVE');

    expect(() =>
      computeAttendanceMetrics({
        checkInMinutes: parseTimeToMinutes('17:00'),
        checkOutMinutes: parseTimeToMinutes('08:00'),
        shift: STANDARD_SHIFT,
        isHoliday: false,
      }),
    ).toThrow('không được nhỏ hơn');
  });

  it('parse linh hoạt ngày (ISO, DD/MM/YYYY, Excel Date) và giờ (HH:mm, HH:mm:ss, serial fraction)', () => {
    expect(parseFlexibleWorkDate('2026-11-23')).toBe('2026-11-23');
    expect(parseFlexibleWorkDate('23/11/2026')).toBe('2026-11-23');
    expect(parseFlexibleWorkDate(new Date(Date.UTC(2026, 10, 23, 0, 0, 0)))).toBe('2026-11-23');
    expect(parseFlexibleWorkDate('31/02/2026')).toBeNull();

    expect(parseFlexibleTime('8:05')).toBe('08:05');
    expect(parseFlexibleTime('17:30:45')).toBe('17:30');
    expect(parseFlexibleTime(0.375)).toBe('09:00');
    expect(parseFlexibleTime('25:00')).toBeNull();
  });
});
