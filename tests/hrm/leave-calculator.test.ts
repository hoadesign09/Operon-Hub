import { describe, expect, it } from 'vitest';
import {
  calculateLeaveDays,
  computeRemainingDays,
  computeSeniorityBonusDays,
  doLeaveRangesOverlap,
} from '@/modules/hrm/requests/leave-calculator';

describe('hrm/leave-calculator', () => {
  it('tính chính xác số ngày nghỉ bao gồm nửa ngày (FULL/AM/PM) và loại trừ T7/CN/ngày lễ', () => {
    // 2026-11-23 là Thứ 2
    expect(
      calculateLeaveDays({
        startDate: '2026-11-23',
        endDate: '2026-11-23',
        startSession: 'FULL',
        endSession: 'FULL',
      }),
    ).toBe(1);

    expect(
      calculateLeaveDays({
        startDate: '2026-11-23',
        endDate: '2026-11-23',
        startSession: 'AM',
        endSession: 'AM',
      }),
    ).toBe(0.5);

    expect(
      calculateLeaveDays({
        startDate: '2026-11-23',
        endDate: '2026-11-23',
        startSession: 'PM',
        endSession: 'PM',
      }),
    ).toBe(0.5);

    // Chiều T2 -> Sáng T4 = 0.5 + 1 + 0.5 = 2 ngày
    expect(
      calculateLeaveDays({
        startDate: '2026-11-23',
        endDate: '2026-11-25',
        startSession: 'PM',
        endSession: 'AM',
      }),
    ).toBe(2);

    // Chiều T6 (27/11) -> Cả ngày T2 (30/11), bỏ qua T7 & CN = 1.5 ngày
    expect(
      calculateLeaveDays({
        startDate: '2026-11-27',
        endDate: '2026-11-30',
        startSession: 'PM',
        endSession: 'FULL',
      }),
    ).toBe(1.5);

    // Loại trừ ngày lễ truyền qua options
    expect(
      calculateLeaveDays(
        {
          startDate: '2026-11-23',
          endDate: '2026-11-25',
          startSession: 'FULL',
          endSession: 'FULL',
        },
        { holidays: ['2026-11-24'] },
      ),
    ).toBe(2);

    // Rơi hoàn toàn vào cuối tuần -> 0 ngày
    expect(
      calculateLeaveDays({
        startDate: '2026-11-28',
        endDate: '2026-11-29',
        startSession: 'FULL',
        endSession: 'FULL',
      }),
    ).toBe(0);
  });

  it('chặn ngày ngược, nghỉ vắt năm và buổi PM -> AM trong cùng ngày', () => {
    expect(() =>
      calculateLeaveDays({
        startDate: '2026-11-25',
        endDate: '2026-11-23',
        startSession: 'FULL',
        endSession: 'FULL',
      }),
    ).toThrow(/Ngày kết thúc/);

    expect(() =>
      calculateLeaveDays({
        startDate: '2026-12-30',
        endDate: '2027-01-02',
        startSession: 'FULL',
        endSession: 'FULL',
      }),
    ).toThrow(/cùng một năm dương lịch/);

    expect(() =>
      calculateLeaveDays({
        startDate: '2026-11-23',
        endDate: '2026-11-23',
        startSession: 'PM',
        endSession: 'AM',
      }),
    ).toThrow(/buổi kết thúc/);
  });

  it('phát hiện trùng lịch chính xác kể cả biên nửa ngày AM/PM trong cùng ngày', () => {
    // Cùng ngày: Sáng (AM) và Chiều (PM) KHÔNG trùng
    expect(
      doLeaveRangesOverlap(
        { startDate: '2026-11-23', endDate: '2026-11-23', startSession: 'AM', endSession: 'AM' },
        { startDate: '2026-11-23', endDate: '2026-11-23', startSession: 'PM', endSession: 'PM' },
      ),
    ).toBe(false);

    // Cùng ngày: Cả ngày và Chiều -> TRÙNG
    expect(
      doLeaveRangesOverlap(
        { startDate: '2026-11-23', endDate: '2026-11-23', startSession: 'FULL', endSession: 'FULL' },
        { startDate: '2026-11-23', endDate: '2026-11-23', startSession: 'PM', endSession: 'PM' },
      ),
    ).toBe(true);

    // Hai khoảng tách biệt -> KHÔNG trùng
    expect(
      doLeaveRangesOverlap(
        { startDate: '2026-11-23', endDate: '2026-11-24', startSession: 'FULL', endSession: 'FULL' },
        { startDate: '2026-11-25', endDate: '2026-11-26', startSession: 'FULL', endSession: 'FULL' },
      ),
    ).toBe(false);
  });

  it('tính đúng số dư phép còn lại và ngày thưởng thâm niên (+1 ngày / 5 năm)', () => {
    expect(
      computeRemainingDays({
        entitledDays: 12,
        carriedOverDays: 2,
        usedDays: 3.5,
        pendingDays: 1.5,
      }),
    ).toBe(9);

    expect(computeSeniorityBonusDays('2025-01-01', 2026)).toBe(0);
    expect(computeSeniorityBonusDays('2021-01-01', 2026)).toBe(1);
    expect(computeSeniorityBonusDays('2015-06-01', 2026)).toBe(2);
  });
});
