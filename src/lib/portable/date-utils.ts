/**
 * Tiện ích định dạng ngày giờ chuẩn Việt Nam và đếm số ngày làm việc loại trừ cuối tuần/ngày lễ.
 *
 * Dependencies: `dayjs` (MIT)
 *
 * Input / Output:
 * - formatDateVN(input: DateInput, fallback?: string) => string (`DD/MM/YYYY`)
 * - formatDateTimeVN(input: DateInput, fallback?: string) => string (`DD/MM/YYYY HH:mm`)
 * - countWorkingDays(startDate: DateInput, endDate: DateInput, options?: WorkingDaysOptions) => number
 *
 * Ví dụ:
 * ```ts
 * formatDateVN('2026-11-23'); // '23/11/2026'
 * countWorkingDays('2026-11-23', '2026-11-29', { holidays: ['2026-11-25'] }); // 4
 * ```
 */
import dayjs from 'dayjs';

export type DateInput = Date | string | number | null | undefined;

export interface WorkingDaysOptions {
  /** Các thứ nghỉ trong tuần theo chuẩn JS Date.getDay() (0 = CN, 6 = T7). Mặc định: [0, 6] */
  weekendDays?: number[];
  /** Danh sách ngày lễ định dạng YYYY-MM-DD sẽ bị loại trừ */
  holidays?: string[];
}

const DEFAULT_FALLBACK = '-';
const DEFAULT_WEEKEND_DAYS = [0, 6];
const VN_DATE_FORMAT = 'DD/MM/YYYY';
const VN_DATETIME_FORMAT = 'DD/MM/YYYY HH:mm';
const ISO_DATE_FORMAT = 'YYYY-MM-DD';

function parseValidDate(input: DateInput): dayjs.Dayjs | null {
  if (input === null || input === undefined || input === '') {
    return null;
  }
  const parsed = dayjs(input);
  return parsed.isValid() ? parsed : null;
}

export function formatDateVN(
  input: DateInput,
  fallback: string = DEFAULT_FALLBACK,
): string {
  const parsed = parseValidDate(input);
  if (!parsed) {
    return fallback;
  }
  return parsed.format(VN_DATE_FORMAT);
}

export function formatDateTimeVN(
  input: DateInput,
  fallback: string = DEFAULT_FALLBACK,
): string {
  const parsed = parseValidDate(input);
  if (!parsed) {
    return fallback;
  }
  return parsed.format(VN_DATETIME_FORMAT);
}

export function countWorkingDays(
  startDate: DateInput,
  endDate: DateInput,
  options: WorkingDaysOptions = {},
): number {
  const start = parseValidDate(startDate)?.startOf('day');
  const end = parseValidDate(endDate)?.startOf('day');

  if (!start || !end || end.isBefore(start)) {
    return 0;
  }

  const weekendSet = new Set(options.weekendDays ?? DEFAULT_WEEKEND_DAYS);
  const holidaySet = new Set(
    (options.holidays ?? [])
      .map((item) => parseValidDate(item)?.format(ISO_DATE_FORMAT))
      .filter((item): item is string => Boolean(item)),
  );

  let workingDays = 0;
  let cursor = start;

  while (!cursor.isAfter(end)) {
    const isWeekend = weekendSet.has(cursor.day());
    const isHoliday = holidaySet.has(cursor.format(ISO_DATE_FORMAT));

    if (!isWeekend && !isHoliday) {
      workingDays += 1;
    }
    cursor = cursor.add(1, 'day');
  }

  return workingDays;
}
