import { AppError } from '@/shared/api-response';

export const MIN_BOOKING_DURATION_MINUTES = 15;
export const MAX_BOOKING_DURATION_MINUTES = 720; // 12 hours
export const PAST_GRACE_MINUTES = 5;

export interface ValidatedBookingRange {
  start: Date;
  end: Date;
  durationMinutes: number;
}

export function parseBookingDateTime(value: string | Date): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : new Date(value.getTime());
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  // Handle local datetime formats: YYYY-MM-DDTHH:mm(:ss)? or YYYY-MM-DD HH:mm(:ss)?
  const localMatch = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(trimmed);
  if (localMatch) {
    const year = Number(localMatch[1]);
    const month = Number(localMatch[2]);
    const day = Number(localMatch[3]);
    const hour = Number(localMatch[4]);
    const minute = Number(localMatch[5]);
    const second = localMatch[6] ? Number(localMatch[6]) : 0;

    const parsed = new Date(year, month - 1, day, hour, minute, second, 0);
    if (
      parsed.getFullYear() !== year ||
      parsed.getMonth() !== month - 1 ||
      parsed.getDate() !== day ||
      parsed.getHours() !== hour ||
      parsed.getMinutes() !== minute
    ) {
      return null;
    }
    return parsed;
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatMysqlDateTime(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function validateBookingTimeRange(
  startInput: string | Date,
  endInput: string | Date,
  options?: { now?: Date; allowPast?: boolean },
): ValidatedBookingRange {
  const start = parseBookingDateTime(startInput);
  const end = parseBookingDateTime(endInput);

  if (!start || !end) {
    throw new AppError(
      'INVALID_BOOKING_TIME',
      'Định dạng thời gian bắt đầu hoặc kết thúc không hợp lệ.',
      400,
    );
  }

  const diffMs = end.getTime() - start.getTime();
  if (diffMs <= 0) {
    throw new AppError(
      'INVALID_BOOKING_TIME',
      'Thời gian kết thúc phải lớn hơn thời gian bắt đầu.',
      400,
    );
  }

  const durationMinutes = Math.round(diffMs / 60000);
  if (durationMinutes < MIN_BOOKING_DURATION_MINUTES) {
    throw new AppError(
      'INVALID_BOOKING_TIME',
      `Thời lượng đặt phòng tối thiểu là ${MIN_BOOKING_DURATION_MINUTES} phút.`,
      400,
    );
  }

  if (durationMinutes > MAX_BOOKING_DURATION_MINUTES) {
    throw new AppError(
      'INVALID_BOOKING_TIME',
      `Thời lượng đặt phòng tối đa là ${MAX_BOOKING_DURATION_MINUTES / 60} giờ cho mỗi lượt đặt.`,
      400,
    );
  }

  if (!options?.allowPast) {
    const now = options?.now ?? new Date();
    const minAllowedEndMs = now.getTime() - PAST_GRACE_MINUTES * 60000;
    if (end.getTime() <= minAllowedEndMs) {
      throw new AppError(
        'INVALID_BOOKING_TIME',
        'Không thể đặt phòng cho khung giờ đã kết thúc trong quá khứ.',
        400,
      );
    }
  }

  return { start, end, durationMinutes };
}

/**
 * Kiểm tra 2 khoảng thời gian [startA, endA) và [startB, endB) có giao nhau không.
 * Lịch đặt nối tiếp sát biên (endA === startB hoặc endB === startA) KHÔNG bị coi là trùng.
 */
export function doBookingIntervalsOverlap(
  startA: Date,
  endA: Date,
  startB: Date,
  endB: Date,
): boolean {
  return startA.getTime() < endB.getTime() && endA.getTime() > startB.getTime();
}

export function validateRoomCapacity(attendeesCount: number, capacity: number): void {
  if (!Number.isInteger(attendeesCount) || attendeesCount < 1) {
    throw new AppError('INVALID_ATTENDEES_COUNT', 'Số người tham dự phải lớn hơn hoặc bằng 1.', 400);
  }
  if (attendeesCount > capacity) {
    throw new AppError(
      'ROOM_CAPACITY_EXCEEDED',
      `Số người tham dự (${attendeesCount}) vượt quá sức chứa tối đa của phòng (${capacity} người).`,
      400,
    );
  }
}

export function normalizeEquipmentList(items: readonly string[] | null | undefined): string[] {
  if (!items || items.length === 0) {
    return [];
  }
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const raw of items) {
    const cleaned = raw.trim();
    if (!cleaned) {
      continue;
    }
    const key = cleaned.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    normalized.push(cleaned);
    if (normalized.length >= 30) {
      break;
    }
  }
  return normalized;
}

export function parseEquipmentJson(raw: unknown): string[] {
  if (!raw) {
    return [];
  }
  if (Array.isArray(raw)) {
    return raw.filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
  }
  if (typeof raw === 'string') {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
      }
    } catch {
      return [];
    }
  }
  return [];
}
