import dayjs from 'dayjs';
import type { LeaveSession } from '@/config/database';
import { countWorkingDays, type WorkingDaysOptions } from '@/lib/portable/date-utils';
import { AppError } from '@/shared/api-response';

export interface LeaveRangeInput {
  startDate: string;
  endDate: string;
  startSession: LeaveSession;
  endSession: LeaveSession;
}

export function roundLeaveDays(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  const rounded = Math.round((value + Number.EPSILON) * 100) / 100;
  return Object.is(rounded, -0) ? 0 : rounded;
}

export function computeRemainingDays(balance: {
  entitledDays: number;
  carriedOverDays: number;
  usedDays: number;
  pendingDays: number;
}): number {
  return roundLeaveDays(
    balance.entitledDays + balance.carriedOverDays - balance.usedDays - balance.pendingDays,
  );
}

/**
 * Cộng +1 ngày phép cho mỗi đủ 5 năm thâm niên làm việc tính đến 31/12 của năm targetYear
 * (theo Điều 114 Bộ luật Lao động Việt Nam).
 */
export function computeSeniorityBonusDays(hireDate: string, targetYear: number): number {
  const hire = dayjs(hireDate);
  if (!hire.isValid()) {
    return 0;
  }
  const yearEnd = dayjs(`${targetYear}-12-31`);
  if (yearEnd.isBefore(hire)) {
    return 0;
  }
  const fullYears = yearEnd.diff(hire, 'year');
  return fullYears >= 5 ? Math.floor(fullYears / 5) : 0;
}

/**
 * Tính số ngày nghỉ làm việc thực tế (hỗ trợ nửa ngày AM/PM, loại trừ T7/CN & ngày lễ).
 * Yêu cầu startDate <= endDate, cùng năm dương lịch, không cho phép PM -> AM trong cùng ngày.
 */
export function calculateLeaveDays(
  range: LeaveRangeInput,
  options: WorkingDaysOptions = {},
): number {
  const start = dayjs(range.startDate);
  const end = dayjs(range.endDate);

  if (!start.isValid() || !end.isValid()) {
    throw new AppError('INVALID_LEAVE_DATES', 'Ngày nghỉ phép không hợp lệ.', 400);
  }

  if (end.isBefore(start, 'day')) {
    throw new AppError(
      'INVALID_LEAVE_DATES',
      'Ngày kết thúc không được nhỏ hơn ngày bắt đầu.',
      400,
    );
  }

  if (start.year() !== end.year()) {
    throw new AppError(
      'CROSS_YEAR_LEAVE',
      'Đơn nghỉ phép phải nằm trong cùng một năm dương lịch. Vui lòng tách thành 2 đơn riêng cho từng năm.',
      400,
    );
  }

  const isSameDay = start.isSame(end, 'day');
  if (isSameDay && range.startSession === 'PM' && range.endSession === 'AM') {
    throw new AppError(
      'INVALID_LEAVE_SESSION',
      'Trong cùng một ngày, buổi kết thúc (Sáng) không thể trước buổi bắt đầu (Chiều).',
      400,
    );
  }

  const baseWorkingDays = countWorkingDays(range.startDate, range.endDate, options);
  if (baseWorkingDays === 0) {
    return 0;
  }

  const isStartWorking = countWorkingDays(range.startDate, range.startDate, options) === 1;
  const isEndWorking = countWorkingDays(range.endDate, range.endDate, options) === 1;

  let total = baseWorkingDays;
  if (isStartWorking && range.startSession === 'PM') {
    total -= 0.5;
  }
  if (isEndWorking && range.endSession === 'AM') {
    total -= 0.5;
  }

  return roundLeaveDays(Math.max(0, total));
}

/**
 * Kiểm tra 2 khoảng nghỉ có chồng lấn nhau hay không.
 * Hỗ trợ trường hợp không trùng trong cùng 1 ngày (đơn A nghỉ Sáng AM, đơn B nghỉ Chiều PM).
 */
export function doLeaveRangesOverlap(a: LeaveRangeInput, b: LeaveRangeInput): boolean {
  if (a.endDate < b.startDate || b.endDate < a.startDate) {
    return false;
  }

  if (a.endDate === b.startDate && a.endSession === 'AM' && b.startSession === 'PM') {
    return false;
  }

  if (b.endDate === a.startDate && b.endSession === 'AM' && a.startSession === 'PM') {
    return false;
  }

  return true;
}
