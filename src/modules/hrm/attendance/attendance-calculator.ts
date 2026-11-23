import dayjs from 'dayjs';
import type { AttendanceStatus } from '@/config/database';

const TIME_HHMM_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const VN_DATE_REGEX = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
const VN_TIMEZONE = 'Asia/Ho_Chi_Minh';

export interface ShiftMetricConfig {
  startTime: string;
  endTime: string;
  breakStartTime: string | null;
  breakEndTime: string | null;
  lateGraceMinutes: number;
  earlyLeaveGraceMinutes: number;
}

export interface AttendanceMetricInput {
  checkInMinutes: number | null;
  checkOutMinutes: number | null;
  shift: ShiftMetricConfig | null;
  isHoliday: boolean;
  overrideStatus?: AttendanceStatus | null;
}

export interface AttendanceMetricResult {
  lateMinutes: number;
  earlyLeaveMinutes: number;
  workedHours: number;
  status: AttendanceStatus;
}

export interface VietnamNowParts {
  date: string;
  time: string;
  minutes: number;
  sqlDateTime: string;
}

export function roundHours(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function parseTimeToMinutes(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  const match = TIME_HHMM_REGEX.exec(trimmed);
  if (!match) {
    return null;
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours * 60 + minutes;
}

export function formatMinutesToTime(totalMinutes: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, Math.floor(totalMinutes)));
  const hh = String(Math.floor(clamped / 60)).padStart(2, '0');
  const mm = String(clamped % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function computeShiftWorkingHours(
  startTime: string,
  endTime: string,
  breakStartTime?: string | null,
  breakEndTime?: string | null,
): number {
  const startMin = parseTimeToMinutes(startTime);
  const endMin = parseTimeToMinutes(endTime);
  if (startMin === null || endMin === null) {
    throw new Error('Định dạng giờ ca làm việc phải là HH:mm (00:00–23:59).');
  }
  if (endMin <= startMin) {
    throw new Error('Giờ kết thúc ca phải lớn hơn giờ bắt đầu ca.');
  }

  let breakDuration = 0;
  const hasBreakStart = Boolean(breakStartTime && breakStartTime.trim().length > 0);
  const hasBreakEnd = Boolean(breakEndTime && breakEndTime.trim().length > 0);
  if (hasBreakStart !== hasBreakEnd) {
    throw new Error('Cần nhập đầy đủ cả giờ bắt đầu và kết thúc nghỉ trưa (hoặc để trống cả hai).');
  }

  if (hasBreakStart && hasBreakEnd) {
    const bStart = parseTimeToMinutes(breakStartTime);
    const bEnd = parseTimeToMinutes(breakEndTime);
    if (bStart === null || bEnd === null) {
      throw new Error('Định dạng giờ nghỉ trưa phải là HH:mm.');
    }
    if (bEnd <= bStart || bStart < startMin || bEnd > endMin) {
      throw new Error('Khoảng giờ nghỉ trưa phải nằm trong khung giờ ca làm việc và hợp lệ.');
    }
    breakDuration = bEnd - bStart;
  }

  const netMinutes = endMin - startMin - breakDuration;
  if (netMinutes <= 0) {
    throw new Error('Tổng số giờ làm việc của ca phải lớn hơn 0.');
  }

  return roundHours(netMinutes / 60);
}

export function computeAttendanceMetrics(
  input: AttendanceMetricInput,
): AttendanceMetricResult {
  const { checkInMinutes, checkOutMinutes, shift, isHoliday, overrideStatus } = input;

  if (
    checkInMinutes !== null &&
    checkOutMinutes !== null &&
    checkOutMinutes < checkInMinutes
  ) {
    throw new Error('Giờ check-out không được nhỏ hơn giờ check-in.');
  }

  let lateMinutes = 0;
  let earlyLeaveMinutes = 0;
  let workedHours = 0;

  if (shift) {
    const shiftStart = parseTimeToMinutes(shift.startTime);
    const shiftEnd = parseTimeToMinutes(shift.endTime);

    if (
      shiftStart !== null &&
      checkInMinutes !== null &&
      checkInMinutes > shiftStart + Math.max(0, shift.lateGraceMinutes)
    ) {
      lateMinutes = checkInMinutes - shiftStart;
    }

    if (
      shiftEnd !== null &&
      checkOutMinutes !== null &&
      checkOutMinutes < shiftEnd - Math.max(0, shift.earlyLeaveGraceMinutes)
    ) {
      earlyLeaveMinutes = shiftEnd - checkOutMinutes;
    }
  }

  if (checkInMinutes !== null && checkOutMinutes !== null && checkOutMinutes > checkInMinutes) {
    let rawMinutes = checkOutMinutes - checkInMinutes;
    if (shift?.breakStartTime && shift?.breakEndTime) {
      const bStart = parseTimeToMinutes(shift.breakStartTime);
      const bEnd = parseTimeToMinutes(shift.breakEndTime);
      if (bStart !== null && bEnd !== null && bEnd > bStart) {
        const overlapStart = Math.max(checkInMinutes, bStart);
        const overlapEnd = Math.min(checkOutMinutes, bEnd);
        if (overlapEnd > overlapStart) {
          rawMinutes -= overlapEnd - overlapStart;
        }
      }
    }
    workedHours = roundHours(Math.max(0, rawMinutes) / 60);
  }

  let status: AttendanceStatus;
  if (overrideStatus) {
    status = overrideStatus;
  } else if (checkInMinutes === null && checkOutMinutes === null) {
    status = isHoliday ? 'HOLIDAY' : 'ABSENT';
  } else if (lateMinutes > 0) {
    status = 'LATE';
  } else {
    status = 'PRESENT';
  }

  return {
    lateMinutes,
    earlyLeaveMinutes,
    workedHours,
    status,
  };
}

export function getVietnamNowParts(now: Date = new Date()): VietnamNowParts {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: VN_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(now);
  const pick = (type: string): string =>
    parts.find((p) => p.type === type)?.value ?? '00';

  const year = pick('year');
  const month = pick('month');
  const day = pick('day');
  const rawHour = pick('hour');
  const hour = rawHour === '24' ? '00' : rawHour;
  const minute = pick('minute');
  const second = pick('second');

  const date = `${year}-${month}-${day}`;
  const time = `${hour}:${minute}`;
  return {
    date,
    time,
    minutes: Number(hour) * 60 + Number(minute),
    sqlDateTime: `${date} ${hour}:${minute}:${second}`,
  };
}

export function buildSqlDateTime(workDate: string, timeHHmm: string | null | undefined): string | null {
  if (!timeHHmm || timeHHmm.trim().length === 0) {
    return null;
  }
  const minutes = parseTimeToMinutes(timeHHmm);
  if (minutes === null) {
    throw new Error(`Giờ không hợp lệ: ${timeHHmm}`);
  }
  return `${workDate} ${formatMinutesToTime(minutes)}:00`;
}

export function extractIsoDate(value: Date | string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return null;
    }
    return dayjs(value).format('YYYY-MM-DD');
  }
  const str = String(value).trim();
  if (ISO_DATE_REGEX.test(str.slice(0, 10))) {
    return str.slice(0, 10);
  }
  const parsed = dayjs(str);
  return parsed.isValid() ? parsed.format('YYYY-MM-DD') : null;
}

export function extractTimeHHmm(value: Date | string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return null;
    }
    return dayjs(value).format('HH:mm');
  }
  const str = String(value).trim();
  const timeMatch = /(\d{2}:\d{2})/.exec(str);
  if (timeMatch && parseTimeToMinutes(timeMatch[1]) !== null) {
    return timeMatch[1];
  }
  const parsed = dayjs(str);
  return parsed.isValid() ? parsed.format('HH:mm') : null;
}

export function parseFlexibleWorkDate(raw: unknown): string | null {
  if (raw === null || raw === undefined || raw === '') {
    return null;
  }
  if (raw instanceof Date) {
    if (Number.isNaN(raw.getTime())) {
      return null;
    }
    // ExcelJS dates are often stored in UTC midnight; prefer UTC components when exact midnight UTC
    if (raw.getUTCHours() === 0 && raw.getUTCMinutes() === 0 && raw.getUTCSeconds() === 0) {
      const y = raw.getUTCFullYear();
      const m = String(raw.getUTCMonth() + 1).padStart(2, '0');
      const d = String(raw.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    return dayjs(raw).format('YYYY-MM-DD');
  }
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 20000 && raw < 80000) {
    // Excel serial date (days since 1899-12-30)
    const utcMs = Date.UTC(1899, 11, 30) + Math.floor(raw) * 86_400_000;
    const d = new Date(utcMs);
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  const text = String(raw).trim();
  if (ISO_DATE_REGEX.test(text)) {
    const parsed = dayjs(text);
    return parsed.isValid() && parsed.format('YYYY-MM-DD') === text ? text : null;
  }
  const vnMatch = VN_DATE_REGEX.exec(text);
  if (vnMatch) {
    const dd = vnMatch[1].padStart(2, '0');
    const mm = vnMatch[2].padStart(2, '0');
    const yyyy = vnMatch[3];
    const iso = `${yyyy}-${mm}-${dd}`;
    const parsed = dayjs(iso);
    return parsed.isValid() && parsed.format('YYYY-MM-DD') === iso ? iso : null;
  }
  return null;
}

export function parseFlexibleTime(raw: unknown): string | null {
  if (raw === null || raw === undefined || raw === '') {
    return null;
  }
  if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0 && raw < 1) {
    const totalMinutes = Math.round(raw * 24 * 60);
    if (totalMinutes >= 0 && totalMinutes < 24 * 60) {
      return formatMinutesToTime(totalMinutes);
    }
    return null;
  }
  if (raw instanceof Date) {
    if (Number.isNaN(raw.getTime())) {
      return null;
    }
    const hh = String(raw.getUTCHours()).padStart(2, '0');
    const mm = String(raw.getUTCMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  }
  const text = String(raw).trim();
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(text);
  if (!match) {
    return null;
  }
  const hh = Number(match[1]);
  const mm = Number(match[2]);
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) {
    return null;
  }
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}
