import dayjs from 'dayjs';
import type { OtRateType } from '@/config/database';
import { AppError } from '@/shared/api-response';

const DEFAULT_WEEKEND_DAYS = [0, 6];
const MIN_OT_HOURS = 0.5;
const MAX_OT_HOURS = 12;

export function parseTimeToMinutes(timeStr: string): number {
  const match = /^(\d{2}):(\d{2})$/.exec(timeStr.trim());
  if (!match) {
    throw new AppError('INVALID_TIME_FORMAT', 'Giờ không đúng định dạng HH:mm.', 400);
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours === 24 && minutes === 0) {
    return 1440;
  }
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    throw new AppError('INVALID_TIME_FORMAT', 'Giờ nằm ngoài khoảng 00:00 – 24:00.', 400);
  }
  return hours * 60 + minutes;
}

export function calculateOtHours(startTime: string, endTime: string): number {
  const startMinutes = parseTimeToMinutes(startTime);
  const endMinutes = parseTimeToMinutes(endTime);

  if (endMinutes <= startMinutes) {
    throw new AppError(
      'INVALID_OT_TIME_RANGE',
      'Giờ kết thúc tăng ca phải lớn hơn giờ bắt đầu trong cùng ngày.',
      400,
    );
  }

  const hours = Math.round(((endMinutes - startMinutes) / 60 + Number.EPSILON) * 100) / 100;
  if (hours < MIN_OT_HOURS || hours > MAX_OT_HOURS) {
    throw new AppError(
      'INVALID_OT_DURATION',
      `Thời lượng tăng ca mỗi đơn phải từ ${MIN_OT_HOURS} giờ đến tối đa ${MAX_OT_HOURS} giờ.`,
      400,
    );
  }

  return hours;
}

export function classifyOtRateType(
  workDate: string,
  options: {
    isHoliday?: boolean;
    holidays?: string[];
    weekendDays?: number[];
  } = {},
): OtRateType {
  const parsed = dayjs(workDate);
  if (!parsed.isValid()) {
    throw new AppError('INVALID_WORK_DATE', 'Ngày làm thêm giờ không hợp lệ.', 400);
  }

  const iso = parsed.format('YYYY-MM-DD');
  const holidaySet = new Set(options.holidays ?? []);
  if (options.isHoliday || holidaySet.has(iso)) {
    return 'HOLIDAY_300';
  }

  const weekendSet = new Set(options.weekendDays ?? DEFAULT_WEEKEND_DAYS);
  if (weekendSet.has(parsed.day())) {
    return 'WEEKEND_200';
  }

  return 'WEEKDAY_150';
}

export function doTimeRangesOverlap(
  aStartTime: string,
  aEndTime: string,
  bStartTime: string,
  bEndTime: string,
): boolean {
  const aStart = parseTimeToMinutes(aStartTime);
  const aEnd = parseTimeToMinutes(aEndTime);
  const bStart = parseTimeToMinutes(bStartTime);
  const bEnd = parseTimeToMinutes(bEndTime);
  return aStart < bEnd && bStart < aEnd;
}

export function calculateTripDays(startDate: string, endDate: string): number {
  const start = dayjs(startDate).startOf('day');
  const end = dayjs(endDate).startOf('day');

  if (!start.isValid() || !end.isValid()) {
    throw new AppError('INVALID_TRIP_DATES', 'Ngày công tác không hợp lệ.', 400);
  }

  if (end.isBefore(start, 'day')) {
    throw new AppError(
      'INVALID_TRIP_DATES',
      'Ngày kết thúc công tác không được nhỏ hơn ngày bắt đầu.',
      400,
    );
  }

  return end.diff(start, 'day') + 1;
}

export function doDateRangesOverlap(
  aStartDate: string,
  aEndDate: string,
  bStartDate: string,
  bEndDate: string,
): boolean {
  return aStartDate <= bEndDate && bStartDate <= aEndDate;
}
