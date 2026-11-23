import dayjs from 'dayjs';
import type { AttendanceStatus, LeaveSession, OtRateType } from '@/config/database';
import { calculateLeaveDays } from '@/modules/hrm/requests/leave-calculator';

export interface SummaryLogEntry {
  workDate: string;
  status: AttendanceStatus;
  workedHours: number;
  hasCheckIn: boolean;
  lateMinutes: number;
  earlyLeaveMinutes: number;
}

export interface SummaryLeaveEntry {
  startDate: string;
  endDate: string;
  startSession: LeaveSession;
  endSession: LeaveSession;
  isPaid: boolean;
}

export interface SummaryOtEntry {
  workDate: string;
  totalHours: number;
  otRateType: OtRateType;
}

export interface SummaryBusinessTripEntry {
  startDate: string;
  endDate: string;
}

export interface SummaryHolidayEntry {
  holidayDate: string;
  isPaid: boolean;
}

export interface MonthlySummaryInput {
  year: number;
  month: number;
  workDays: readonly number[];
  shiftWorkingHours: number;
  logs: readonly SummaryLogEntry[];
  approvedLeaves: readonly SummaryLeaveEntry[];
  approvedOvertimes: readonly SummaryOtEntry[];
  approvedBusinessTrips: readonly SummaryBusinessTripEntry[];
  holidays: readonly SummaryHolidayEntry[];
}

export interface MonthlySummaryResult {
  standardWorkDays: number;
  actualWorkDays: number;
  businessTripDays: number;
  paidLeaveDays: number;
  unpaidLeaveDays: number;
  holidayDays: number;
  payableDays: number;
  otHours150: number;
  otHours200: number;
  otHours300: number;
  lateCount: number;
  totalLateMinutes: number;
  earlyLeaveCount: number;
  totalEarlyLeaveMinutes: number;
}

const DEFAULT_WORK_DAYS = [1, 2, 3, 4, 5];
const FULL_DAY_RATIO = 0.75;
const HALF_DAY_RATIO = 0.375;

export function roundDecimal2(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }
  const rounded = Math.round((value + Number.EPSILON) * 100) / 100;
  return Object.is(rounded, -0) ? 0 : rounded;
}

export function getMonthBoundaries(year: number, month: number): {
  monthStart: string;
  monthEnd: string;
  daysInMonth: number;
} {
  const start = dayjs(`${year}-${String(month).padStart(2, '0')}-01`);
  const end = start.endOf('month');
  return {
    monthStart: start.format('YYYY-MM-DD'),
    monthEnd: end.format('YYYY-MM-DD'),
    daysInMonth: end.date(),
  };
}

export function computeWeekendDaysFromWorkDays(workDays: readonly number[]): number[] {
  const workSet = new Set(workDays.length > 0 ? workDays : DEFAULT_WORK_DAYS);
  const weekends: number[] = [];
  for (let d = 0; d <= 6; d += 1) {
    if (!workSet.has(d)) {
      weekends.push(d);
    }
  }
  return weekends;
}

export function sliceLeaveDaysInMonth(
  leave: SummaryLeaveEntry,
  year: number,
  month: number,
  weekendDays: number[],
  holidayDates: string[],
): number {
  const { monthStart, monthEnd } = getMonthBoundaries(year, month);
  if (leave.endDate < monthStart || leave.startDate > monthEnd) {
    return 0;
  }

  const clippedStart = leave.startDate < monthStart ? monthStart : leave.startDate;
  const clippedEnd = leave.endDate > monthEnd ? monthEnd : leave.endDate;
  const clippedStartSession: LeaveSession =
    leave.startDate < monthStart ? 'FULL' : leave.startSession;
  const clippedEndSession: LeaveSession =
    leave.endDate > monthEnd ? 'FULL' : leave.endSession;

  return calculateLeaveDays(
    {
      startDate: clippedStart,
      endDate: clippedEnd,
      startSession: clippedStartSession,
      endSession: clippedEndSession,
    },
    { weekendDays, holidays: holidayDates },
  );
}

export function computeMonthlyAttendanceSummary(
  input: MonthlySummaryInput,
): MonthlySummaryResult {
  const { year, month } = input;
  const { monthStart, monthEnd, daysInMonth } = getMonthBoundaries(year, month);
  const workDaySet = new Set(input.workDays.length > 0 ? input.workDays : DEFAULT_WORK_DAYS);
  const weekendDays = computeWeekendDaysFromWorkDays(Array.from(workDaySet));
  const shiftHours = input.shiftWorkingHours > 0 ? input.shiftWorkingHours : 8;

  // 1. Standard work days in month (every calendar date matching workDaySet)
  let standardWorkDays = 0;
  for (let day = 1; day <= daysInMonth; day += 1) {
    const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (workDaySet.has(dayjs(iso).day())) {
      standardWorkDays += 1;
    }
  }

  // 2. Daily attendance logs -> loggedWorkDays + late/early stats
  let loggedWorkDays = 0;
  let lateCount = 0;
  let totalLateMinutes = 0;
  let earlyLeaveCount = 0;
  let totalEarlyLeaveMinutes = 0;
  const presentDates = new Set<string>();

  for (const log of input.logs) {
    if (log.workDate < monthStart || log.workDate > monthEnd) {
      continue;
    }
    if (log.lateMinutes > 0 || log.status === 'LATE') {
      lateCount += 1;
      totalLateMinutes += Math.max(0, log.lateMinutes);
    }
    if (log.earlyLeaveMinutes > 0) {
      earlyLeaveCount += 1;
      totalEarlyLeaveMinutes += Math.max(0, log.earlyLeaveMinutes);
    }

    if (log.status === 'PRESENT' || log.status === 'LATE') {
      presentDates.add(log.workDate);
      if (log.workedHours >= shiftHours * FULL_DAY_RATIO) {
        loggedWorkDays += 1;
      } else if (log.workedHours >= shiftHours * HALF_DAY_RATIO) {
        loggedWorkDays += 0.5;
      } else if (log.workedHours === 0 && log.hasCheckIn) {
        loggedWorkDays += 0.5;
      }
    }
  }

  // 3. Paid holidays in month (falling on workDaySet and not already worked)
  const paidHolidaySet = new Set<string>();
  const allHolidayDates: string[] = [];
  for (const h of input.holidays) {
    if (h.holidayDate >= monthStart && h.holidayDate <= monthEnd) {
      allHolidayDates.push(h.holidayDate);
      if (h.isPaid) {
        paidHolidaySet.add(h.holidayDate);
      }
    }
  }

  let holidayDays = 0;
  for (const hDate of paidHolidaySet) {
    if (workDaySet.has(dayjs(hDate).day()) && !presentDates.has(hDate)) {
      holidayDays += 1;
    }
  }

  // 4. Approved business trips (workdays in month not already logged as PRESENT/LATE and not holiday)
  const tripDates = new Set<string>();
  for (const trip of input.approvedBusinessTrips) {
    if (trip.endDate < monthStart || trip.startDate > monthEnd) {
      continue;
    }
    let cursor = dayjs(trip.startDate < monthStart ? monthStart : trip.startDate);
    const limit = dayjs(trip.endDate > monthEnd ? monthEnd : trip.endDate);
    while (!cursor.isAfter(limit, 'day')) {
      const iso = cursor.format('YYYY-MM-DD');
      if (
        workDaySet.has(cursor.day()) &&
        !presentDates.has(iso) &&
        !paidHolidaySet.has(iso)
      ) {
        tripDates.add(iso);
      }
      cursor = cursor.add(1, 'day');
    }
  }
  const businessTripDays = roundDecimal2(tripDates.size);
  const actualWorkDays = roundDecimal2(loggedWorkDays + businessTripDays);

  // 5. Approved leaves clipped to this month
  let paidLeaveDays = 0;
  let unpaidLeaveDays = 0;
  for (const leave of input.approvedLeaves) {
    const daysInMonthForLeave = sliceLeaveDaysInMonth(
      leave,
      year,
      month,
      weekendDays,
      allHolidayDates,
    );
    if (leave.isPaid) {
      paidLeaveDays += daysInMonthForLeave;
    } else {
      unpaidLeaveDays += daysInMonthForLeave;
    }
  }
  paidLeaveDays = roundDecimal2(paidLeaveDays);
  unpaidLeaveDays = roundDecimal2(unpaidLeaveDays);

  // 6. Payable days = actualWorkDays + paidLeaveDays + holidayDays
  const payableDays = roundDecimal2(actualWorkDays + paidLeaveDays + holidayDays);

  // 7. Approved Overtimes grouped by rate type
  let otHours150 = 0;
  let otHours200 = 0;
  let otHours300 = 0;
  for (const ot of input.approvedOvertimes) {
    if (ot.workDate < monthStart || ot.workDate > monthEnd) {
      continue;
    }
    const hrs = Math.max(0, ot.totalHours);
    if (ot.otRateType === 'WEEKDAY_150') {
      otHours150 += hrs;
    } else if (ot.otRateType === 'WEEKEND_200') {
      otHours200 += hrs;
    } else if (ot.otRateType === 'HOLIDAY_300') {
      otHours300 += hrs;
    }
  }

  return {
    standardWorkDays: roundDecimal2(standardWorkDays),
    actualWorkDays,
    businessTripDays,
    paidLeaveDays,
    unpaidLeaveDays,
    holidayDays: roundDecimal2(holidayDays),
    payableDays,
    otHours150: roundDecimal2(otHours150),
    otHours200: roundDecimal2(otHours200),
    otHours300: roundDecimal2(otHours300),
    lateCount,
    totalLateMinutes,
    earlyLeaveCount,
    totalEarlyLeaveMinutes,
  };
}
