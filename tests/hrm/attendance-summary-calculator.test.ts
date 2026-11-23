import { describe, expect, it } from 'vitest';
import {
  computeMonthlyAttendanceSummary,
  sliceLeaveDaysInMonth,
} from '@/modules/hrm/attendance/attendance-summary-calculator';

describe('hrm/attendance-summary-calculator', () => {
  it('tổng hợp đầy đủ công chuẩn, chấm công ngày (đủ/nửa/thiếu check-out), công tác, phép, lễ và OT 150/200/300', () => {
    // Tháng 11/2026 có 21 ngày T2-T6
    const result = computeMonthlyAttendanceSummary({
      year: 2026,
      month: 11,
      workDays: [1, 2, 3, 4, 5],
      shiftWorkingHours: 8,
      logs: [
        // 2 ngày đủ công (>= 6h)
        { workDate: '2026-11-02', status: 'PRESENT', workedHours: 8, hasCheckIn: true, lateMinutes: 0, earlyLeaveMinutes: 0 },
        { workDate: '2026-11-03', status: 'LATE', workedHours: 7.5, hasCheckIn: true, lateMinutes: 20, earlyLeaveMinutes: 0 },
        // 1 ngày làm nửa công (4h)
        { workDate: '2026-11-04', status: 'PRESENT', workedHours: 4, hasCheckIn: true, lateMinutes: 0, earlyLeaveMinutes: 240 },
        // 1 ngày quên check-out (tính tạm 0.5 công)
        { workDate: '2026-11-05', status: 'PRESENT', workedHours: 0, hasCheckIn: true, lateMinutes: 0, earlyLeaveMinutes: 0 },
      ],
      approvedLeaves: [
        // 1 ngày nghỉ phép hưởng lương
        { startDate: '2026-11-06', endDate: '2026-11-06', startSession: 'FULL', endSession: 'FULL', isPaid: true },
        // 0.5 ngày nghỉ không lương
        { startDate: '2026-11-09', endDate: '2026-11-09', startSession: 'AM', endSession: 'AM', isPaid: false },
      ],
      approvedBusinessTrips: [
        // Công tác 03/11 (trùng ngày đã chấm công -> không cộng kép) và 10/11 (cộng +1 ngày công tác)
        { startDate: '2026-11-03', endDate: '2026-11-03' },
        { startDate: '2026-11-10', endDate: '2026-11-10' },
      ],
      holidays: [
        // 1 ngày lễ rơi vào T4 (11/11) -> +1 holidayDays
        { holidayDate: '2026-11-11', isPaid: true },
      ],
      approvedOvertimes: [
        { workDate: '2026-11-02', totalHours: 2, otRateType: 'WEEKDAY_150' },
        { workDate: '2026-11-07', totalHours: 4, otRateType: 'WEEKEND_200' },
        { workDate: '2026-11-11', totalHours: 3.5, otRateType: 'HOLIDAY_300' },
      ],
    });

    expect(result.standardWorkDays).toBe(21);
    expect(result.businessTripDays).toBe(1);
    // logged = 1 + 1 + 0.5 + 0.5 = 3.0; actual = 3.0 + 1.0 (businessTrip) = 4.0
    expect(result.actualWorkDays).toBe(4);
    expect(result.paidLeaveDays).toBe(1);
    expect(result.unpaidLeaveDays).toBe(0.5);
    expect(result.holidayDays).toBe(1);
    // payable = 4.0 + 1.0 + 1.0 = 6.0
    expect(result.payableDays).toBe(6);
    expect(result.otHours150).toBe(2);
    expect(result.otHours200).toBe(4);
    expect(result.otHours300).toBe(3.5);
    expect(result.lateCount).toBe(1);
    expect(result.totalLateMinutes).toBe(20);
    expect(result.earlyLeaveCount).toBe(1);
    expect(result.totalEarlyLeaveMinutes).toBe(240);
  });

  it('cắt chính xác đơn nghỉ phép vắt qua ranh giới 2 tháng (30/10 -> 03/11)', () => {
    // 30/10 (T6, PM=0.5 ngày ở T10), 31/10 (T7), 01/11 (CN), 02/11 (T2), 03/11 (T3, AM=0.5 ngày ở T11)
    const crossMonthLeave = {
      startDate: '2026-10-30',
      endDate: '2026-11-03',
      startSession: 'PM' as const,
      endSession: 'AM' as const,
      isPaid: true,
    };

    const octDays = sliceLeaveDaysInMonth(crossMonthLeave, 2026, 10, [0, 6], []);
    const novDays = sliceLeaveDaysInMonth(crossMonthLeave, 2026, 11, [0, 6], []);

    expect(octDays).toBe(0.5);
    expect(novDays).toBe(1.5);
  });

  it('không cộng công kép ngày lễ nếu nhân viên có chấm công đi làm ngày lễ đó', () => {
    const result = computeMonthlyAttendanceSummary({
      year: 2026,
      month: 9,
      workDays: [1, 2, 3, 4, 5],
      shiftWorkingHours: 8,
      logs: [
        { workDate: '2026-09-02', status: 'PRESENT', workedHours: 8, hasCheckIn: true, lateMinutes: 0, earlyLeaveMinutes: 0 },
      ],
      approvedLeaves: [],
      approvedOvertimes: [],
      approvedBusinessTrips: [],
      holidays: [{ holidayDate: '2026-09-02', isPaid: true }],
    });

    expect(result.actualWorkDays).toBe(1);
    expect(result.holidayDays).toBe(0);
    expect(result.payableDays).toBe(1);
  });
});
