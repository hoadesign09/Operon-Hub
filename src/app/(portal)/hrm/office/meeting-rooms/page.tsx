'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  IconCalendar,
  IconCalendarPlus,
  IconChevronLeft,
  IconChevronRight,
  IconClock,
  IconDoor,
  IconEdit,
  IconEye,
  IconPlus,
  IconRefresh,
  IconTrash,
  IconUsers,
} from '@tabler/icons-react';
import { DayBookingsModal } from '@/components/hrm/DayBookingsModal';
import {
  MeetingRoomFormModal,
  type MeetingRoomFormData,
} from '@/components/hrm/MeetingRoomFormModal';
import { RoomBookingModal } from '@/components/hrm/RoomBookingModal';
import { usePortalAuth } from '@/components/portal/PortalAuthContext';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import type { RoomBookingStatus } from '@/config/database';
import { formatDateTimeVN, formatDateVN } from '@/lib/portable/date-utils';
import type {
  MeetingRoomItem,
  MeetingRoomStats,
  RoomBookingItem,
} from '@/modules/hrm/office/meeting-rooms.service';
import { useI18n } from '@/shared/i18n/I18nContext';
import { formatPeriodLabel } from '@/shared/i18n/translator';

type MainTab = 'calendar' | 'rooms' | 'mine';
type CalendarMode = 'day' | 'week' | 'month';
type BookingStatusFilter = 'ALL' | RoomBookingStatus;

const MONTH_CELL_MAX_VISIBLE = 2;
const WEEK_CELL_MAX_VISIBLE = 3;

const TIMELINE_START_HOUR = 8;
const TIMELINE_END_HOUR = 19; // 08:00 -> 19:00 (11 hour rows)
const TIMELINE_HOUR_HEIGHT = 64; // px per hour
const TIMELINE_HOURS = Array.from(
  { length: TIMELINE_END_HOUR - TIMELINE_START_HOUR },
  (_, idx) => TIMELINE_START_HOUR + idx,
);

const WEEKDAY_SHORT: Array<{ vi: string; en: string }> = [
  { vi: 'CN', en: 'Sun' },
  { vi: 'T2', en: 'Mon' },
  { vi: 'T3', en: 'Tue' },
  { vi: 'T4', en: 'Wed' },
  { vi: 'T5', en: 'Thu' },
  { vi: 'T6', en: 'Fri' },
  { vi: 'T7', en: 'Sat' },
];
const MONTH_WEEKDAY_HEADERS: Array<{ vi: string; en: string }> = [
  { vi: 'T2', en: 'Mon' },
  { vi: 'T3', en: 'Tue' },
  { vi: 'T4', en: 'Wed' },
  { vi: 'T5', en: 'Thu' },
  { vi: 'T6', en: 'Fri' },
  { vi: 'T7', en: 'Sat' },
  { vi: 'CN', en: 'Sun' },
];

const BOOKING_STATUS_ORDER: readonly RoomBookingStatus[] = [
  'PENDING',
  'IN_PROGRESS',
  'DONE',
  'CANCELLED',
];

const BOOKING_STATUS_META: Record<
  RoomBookingStatus,
  {
    vi: string;
    en: string;
    badgeCls: string;
    dotCls: string;
    cardCls: string;
    accentBorderCls: string;
    timeCls: string;
    titleCls: string;
  }
> = {
  PENDING: {
    vi: 'Chờ diễn ra',
    en: 'Pending',
    badgeCls: 'border-amber-200 bg-amber-50 text-amber-700',
    dotCls: 'bg-amber-500',
    cardCls: 'border-amber-200/90 bg-amber-50/35 hover:border-amber-400 hover:bg-amber-50/80',
    accentBorderCls: 'border-l-amber-500',
    timeCls: 'text-amber-700',
    titleCls: 'text-slate-900',
  },
  IN_PROGRESS: {
    vi: 'Đang diễn ra',
    en: 'In-progress',
    badgeCls: 'border-blue-200 bg-blue-50 text-blue-700',
    dotCls: 'bg-blue-500 animate-pulse',
    cardCls: 'border-blue-200 bg-blue-50/65 hover:border-blue-400 hover:bg-blue-100/70',
    accentBorderCls: 'border-l-blue-600',
    timeCls: 'text-blue-700',
    titleCls: 'text-slate-900',
  },
  DONE: {
    vi: 'Hoàn thành',
    en: 'Done',
    badgeCls: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    dotCls: 'bg-emerald-500',
    cardCls: 'border-emerald-200/90 bg-emerald-50/35 hover:border-emerald-400 hover:bg-emerald-50/75',
    accentBorderCls: 'border-l-emerald-500',
    timeCls: 'text-emerald-700',
    titleCls: 'text-slate-800',
  },
  CANCELLED: {
    vi: 'Đã hủy',
    en: 'Cancelled',
    badgeCls: 'border-rose-200 bg-rose-50 text-rose-600',
    dotCls: 'bg-rose-500',
    cardCls: 'border-slate-200 bg-slate-50/90 hover:border-slate-300 hover:bg-slate-100/80',
    accentBorderCls: 'border-l-rose-400',
    timeCls: 'text-slate-400',
    titleCls: 'text-slate-500 line-through',
  },
};

function formatIsoDateLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function getMondayOfWeek(baseDate: Date): Date {
  const copy = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  return copy;
}

function addDays(baseDate: Date, delta: number): Date {
  const copy = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
  copy.setDate(copy.getDate() + delta);
  return copy;
}

function addMonths(baseDate: Date, delta: number): Date {
  return new Date(baseDate.getFullYear(), baseDate.getMonth() + delta, 1);
}

function buildMonthGridDays(baseDate: Date): Date[] {
  const firstOfMonth = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
  const lastOfMonth = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0);
  const gridStart = getMondayOfWeek(firstOfMonth);
  const lastDayOfWeek = lastOfMonth.getDay();
  const trailingDays = lastDayOfWeek === 0 ? 0 : 7 - lastDayOfWeek;
  const gridEnd = addDays(lastOfMonth, trailingDays);

  const days: Date[] = [];
  let cursor = gridStart;
  while (cursor.getTime() <= gridEnd.getTime()) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return days;
}

function formatTimeHHMM(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return '';
  }
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function bookingTouchesDate(booking: RoomBookingItem, targetDateIso: string): boolean {
  const start = new Date(booking.startTime);
  const end = new Date(booking.endTime);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return false;
  }
  const dayStart = new Date(`${targetDateIso}T00:00:00`);
  const dayEnd = new Date(`${targetDateIso}T23:59:59`);
  return start.getTime() <= dayEnd.getTime() && end.getTime() >= dayStart.getTime();
}

function bookingBlocksHourSlot(
  booking: RoomBookingItem,
  targetDateIso: string,
  hourNum: number,
): boolean {
  if (booking.status === 'CANCELLED') {
    return false;
  }
  const start = new Date(booking.startTime);
  const end = new Date(booking.endTime);
  const pad = (n: number) => String(n).padStart(2, '0');
  const slotStart = new Date(`${targetDateIso}T${pad(hourNum)}:00:00`);
  const slotEnd = new Date(slotStart.getTime() + 60 * 60 * 1000);
  return start.getTime() < slotEnd.getTime() && end.getTime() > slotStart.getTime();
}

interface PositionedTimelineBooking {
  booking: RoomBookingItem;
  topPx: number;
  heightPx: number;
  colIndex: number;
  colCount: number;
}

/**
 * Computes proportional vertical placement & side-by-side lanes for bookings inside a single room's day timeline.
 */
function layoutRoomTimelineBookings(
  roomBookings: readonly RoomBookingItem[],
  targetDateIso: string,
): { positioned: PositionedTimelineBooking[]; outsideHours: RoomBookingItem[] } {
  const timelineStartMs = new Date(
    `${targetDateIso}T${String(TIMELINE_START_HOUR).padStart(2, '0')}:00:00`,
  ).getTime();
  const timelineEndMs = new Date(
    `${targetDateIso}T${String(TIMELINE_END_HOUR).padStart(2, '0')}:00:00`,
  ).getTime();
  const pxPerMinute = TIMELINE_HOUR_HEIGHT / 60;

  const inside: Array<{
    booking: RoomBookingItem;
    clampedStart: number;
    clampedEnd: number;
  }> = [];
  const outsideHours: RoomBookingItem[] = [];

  for (const bk of roomBookings) {
    const startMs = new Date(bk.startTime).getTime();
    const endMs = new Date(bk.endTime).getTime();
    if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
      continue;
    }
    if (endMs <= timelineStartMs || startMs >= timelineEndMs) {
      outsideHours.push(bk);
      continue;
    }
    inside.push({
      booking: bk,
      clampedStart: Math.max(startMs, timelineStartMs),
      clampedEnd: Math.min(endMs, timelineEndMs),
    });
  }

  inside.sort((a, b) => a.clampedStart - b.clampedStart || a.clampedEnd - b.clampedEnd);

  // Cluster overlapping events (e.g. cancelled + rebooked) into side-by-side columns
  const positioned: PositionedTimelineBooking[] = [];
  let cluster: typeof inside = [];
  let clusterMaxEnd = -1;

  const flushCluster = () => {
    if (cluster.length === 0) return;
    const laneEnds: number[] = [];
    const laneAssignments: Array<{ item: (typeof inside)[number]; colIndex: number }> = [];

    for (const item of cluster) {
      let lane = laneEnds.findIndex((endMs) => endMs <= item.clampedStart);
      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(item.clampedEnd);
      } else {
        laneEnds[lane] = item.clampedEnd;
      }
      laneAssignments.push({ item, colIndex: lane });
    }

    const colCount = Math.max(1, laneEnds.length);
    for (const { item, colIndex } of laneAssignments) {
      const startMinutes = (item.clampedStart - timelineStartMs) / 60000;
      const durationMinutes = (item.clampedEnd - item.clampedStart) / 60000;
      positioned.push({
        booking: item.booking,
        topPx: Math.max(0, Math.round(startMinutes * pxPerMinute) + 2),
        heightPx: Math.max(30, Math.round(durationMinutes * pxPerMinute) - 4),
        colIndex,
        colCount,
      });
    }
    cluster = [];
    clusterMaxEnd = -1;
  };

  for (const item of inside) {
    if (cluster.length > 0 && item.clampedStart >= clusterMaxEnd) {
      flushCluster();
    }
    cluster.push(item);
    clusterMaxEnd = Math.max(clusterMaxEnd, item.clampedEnd);
  }
  flushCluster();

  return { positioned, outsideHours };
}

export default function MeetingRoomsPage() {
  const { locale, tr, ln } = useI18n();
  const trRef = useRef(tr);
  useEffect(() => {
    trRef.current = tr;
  }, [tr]);

  const { user, selectedBranchId, hasPermission } = usePortalAuth();
  const canManageRooms = hasPermission('hrm.rooms.manage');
  const canBookRooms = hasPermission('hrm.rooms.book');

  const [activeTab, setActiveTab] = useState<MainTab>('calendar');
  const [calendarMode, setCalendarMode] = useState<CalendarMode>('month');
  const [anchorDate, setAnchorDate] = useState<Date>(() => new Date());
  const [selectedRoomFilter, setSelectedRoomFilter] = useState<string>('');
  const [calendarStatusFilter, setCalendarStatusFilter] = useState<BookingStatusFilter>('ALL');
  const [mineStatusFilter, setMineStatusFilter] = useState<BookingStatusFilter>('ALL');

  const [rooms, setRooms] = useState<MeetingRoomItem[]>([]);
  const [stats, setStats] = useState<MeetingRoomStats>({
    total: 0,
    active: 0,
    inactive: 0,
    todayBookings: 0,
  });
  const [bookings, setBookings] = useState<RoomBookingItem[]>([]);
  const [myBookings, setMyBookings] = useState<RoomBookingItem[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const [loadedAtMs, setLoadedAtMs] = useState<number>(() => Date.now());

  // Modals
  const [isRoomModalOpen, setIsRoomModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<MeetingRoomFormData | null>(null);
  const [deletingRoom, setDeletingRoom] = useState<MeetingRoomItem | null>(null);
  const [isDeletingRoom, setIsDeletingRoom] = useState(false);

  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [activeBooking, setActiveBooking] = useState<RoomBookingItem | null>(null);
  const [bookingPreset, setBookingPreset] = useState<{
    roomId?: number | null;
    date?: string;
    startHour?: string;
  }>({});
  const [dayModalDateIso, setDayModalDateIso] = useState<string | null>(null);

  const weekDays = useMemo(() => {
    const monday = getMondayOfWeek(anchorDate);
    return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  }, [anchorDate]);

  const monthDays = useMemo(() => buildMonthGridDays(anchorDate), [anchorDate]);

  const dateRange = useMemo(() => {
    if (calendarMode === 'day') {
      const iso = formatIsoDateLocal(anchorDate);
      return { dateFrom: iso, dateTo: iso };
    }
    if (calendarMode === 'month') {
      return {
        dateFrom: formatIsoDateLocal(monthDays[0]),
        dateTo: formatIsoDateLocal(monthDays[monthDays.length - 1]),
      };
    }
    return {
      dateFrom: formatIsoDateLocal(weekDays[0]),
      dateTo: formatIsoDateLocal(weekDays[6]),
    };
  }, [anchorDate, calendarMode, monthDays, weekDays]);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage((prev) => (prev === msg ? null : prev)), 4000);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const roomParams = new URLSearchParams({ limit: '100' });
        const calParams = new URLSearchParams({
          limit: calendarMode === 'month' ? '500' : '300',
          dateFrom: dateRange.dateFrom,
          dateTo: dateRange.dateTo,
        });
        const mineParams = new URLSearchParams({
          limit: '100',
          mineOnly: 'true',
        });

        if (selectedBranchId) {
          roomParams.set('branchId', String(selectedBranchId));
          calParams.set('branchId', String(selectedBranchId));
          mineParams.set('branchId', String(selectedBranchId));
        }
        if (selectedRoomFilter) {
          calParams.set('roomId', selectedRoomFilter);
        }
        if (calendarStatusFilter !== 'ALL') {
          calParams.set('status', calendarStatusFilter);
        }
        if (mineStatusFilter !== 'ALL') {
          mineParams.set('status', mineStatusFilter);
        }

        const [roomsRes, calRes, mineRes] = await Promise.all([
          fetch(`/api/v1/hrm/admin-ops/meeting-rooms?${roomParams.toString()}`, {
            signal: controller.signal,
          }),
          fetch(`/api/v1/hrm/admin-ops/room-bookings?${calParams.toString()}`, {
            signal: controller.signal,
          }),
          fetch(`/api/v1/hrm/admin-ops/room-bookings?${mineParams.toString()}`, {
            signal: controller.signal,
          }),
        ]);

        const [roomsJson, calJson, mineJson] = (await Promise.all([
          roomsRes.json().catch(() => null),
          calRes.json().catch(() => null),
          mineRes.json().catch(() => null),
        ])) as [
          { success?: boolean; data?: { items: MeetingRoomItem[]; stats: MeetingRoomStats }; error?: { message?: string } } | null,
          { success?: boolean; data?: { items: RoomBookingItem[] }; error?: { message?: string } } | null,
          { success?: boolean; data?: { items: RoomBookingItem[] }; error?: { message?: string } } | null,
        ];

        if (!roomsRes.ok || !roomsJson?.success || !roomsJson.data) {
          throw new Error(
            roomsJson?.error?.message ??
              trRef.current('Không thể tải danh sách phòng họp.', 'Failed to load meeting rooms.'),
          );
        }
        if (!calRes.ok || !calJson?.success || !calJson.data) {
          throw new Error(
            calJson?.error?.message ??
              trRef.current('Không thể tải lịch đặt phòng họp.', 'Failed to load room bookings.'),
          );
        }

        setRooms(roomsJson.data.items);
        setStats(roomsJson.data.stats);
        setBookings(calJson.data.items);
        setMyBookings(mineRes.ok && mineJson?.success && mineJson.data ? mineJson.data.items : []);
        setLoadedAtMs(Date.now());
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }
        setErrorMessage(
          err instanceof Error
            ? err.message
            : trRef.current(
                'Lỗi kết nối khi tải dữ liệu phòng họp.',
                'Connection error while loading meeting room data.',
              ),
        );
      } finally {
        setIsLoading(false);
      }
    })();

    return () => controller.abort();
  }, [
    calendarMode,
    calendarStatusFilter,
    dateRange.dateFrom,
    dateRange.dateTo,
    mineStatusFilter,
    reloadTick,
    selectedBranchId,
    selectedRoomFilter,
  ]);

  function openNewBookingModal(preset?: { roomId?: number | null; date?: string; startHour?: string }) {
    setActiveBooking(null);
    setBookingPreset(preset ?? { date: formatIsoDateLocal(anchorDate) });
    setIsBookingModalOpen(true);
  }

  function openBookingDetailModal(booking: RoomBookingItem) {
    setActiveBooking(booking);
    setBookingPreset({});
    setIsBookingModalOpen(true);
  }

  function openCreateRoomModal() {
    setEditingRoom(null);
    setIsRoomModalOpen(true);
  }

  function openEditRoomModal(room: MeetingRoomItem) {
    setEditingRoom({
      id: room.id,
      branchId: room.branchId,
      code: room.code,
      name: room.name,
      nameEn: room.nameEn,
      floor: room.floor,
      capacity: room.capacity,
      equipment: room.equipment,
      description: room.description,
      isActive: room.isActive,
    });
    setIsRoomModalOpen(true);
  }

  function handleNavigatePeriod(direction: -1 | 1) {
    setAnchorDate((d) => {
      if (calendarMode === 'day') {
        return addDays(d, direction);
      }
      if (calendarMode === 'month') {
        return addMonths(d, direction);
      }
      return addDays(d, direction * 7);
    });
  }

  async function handleConfirmDeleteRoom() {
    if (!deletingRoom) {
      return;
    }
    setIsDeletingRoom(true);
    try {
      const res = await fetch(`/api/v1/hrm/admin-ops/meeting-rooms/${deletingRoom.id}`, {
        method: 'DELETE',
      });
      const json = (await res.json().catch(() => null)) as {
        success?: boolean;
        error?: { message?: string };
      } | null;

      if (!res.ok || !json?.success) {
        setErrorMessage(
          json?.error?.message ??
            tr('Không thể lưu trữ phòng họp.', 'Failed to archive meeting room.'),
        );
        return;
      }
      setDeletingRoom(null);
      showToast(
        tr(
          `Đã lưu trữ (ẩn) phòng họp "${ln(deletingRoom.name, deletingRoom.nameEn)}".`,
          `Archived meeting room "${ln(deletingRoom.name, deletingRoom.nameEn)}".`,
        ),
      );
      setReloadTick((v) => v + 1);
    } catch {
      setErrorMessage(
        tr(
          'Lỗi kết nối khi lưu trữ phòng họp.',
          'Connection error while archiving meeting room.',
        ),
      );
    } finally {
      setIsDeletingRoom(false);
    }
  }

  const activeRoomsForDayGrid = useMemo(() => {
    const active = rooms.filter((r) => r.isActive);
    if (selectedRoomFilter) {
      return active.filter((r) => r.id === Number(selectedRoomFilter));
    }
    return active;
  }, [rooms, selectedRoomFilter]);

  const anchorDateIso = formatIsoDateLocal(anchorDate);
  const nowDate = useMemo(() => new Date(loadedAtMs), [loadedAtMs]);
  const todayIso = formatIsoDateLocal(nowDate);
  const anchorMonth = anchorDate.getMonth();
  const anchorYear = anchorDate.getFullYear();
  const upcomingMineCount = myBookings.filter(
    (b) => b.status === 'PENDING' || b.status === 'IN_PROGRESS',
  ).length;

  // Compute current-time indicator line position for Day timeline when viewing Today
  const nowIndicatorTopPx = useMemo(() => {
    if (anchorDateIso !== todayIso) {
      return null;
    }
    const nowMinutesFromStart =
      (nowDate.getHours() - TIMELINE_START_HOUR) * 60 + nowDate.getMinutes();
    const totalMinutes = (TIMELINE_END_HOUR - TIMELINE_START_HOUR) * 60;
    if (nowMinutesFromStart < 0 || nowMinutesFromStart > totalMinutes) {
      return null;
    }
    return Math.round((nowMinutesFromStart / 60) * TIMELINE_HOUR_HEIGHT);
  }, [anchorDateIso, nowDate, todayIso]);

  // Day view timeline layout per room
  const dayTimelineByRoom = useMemo(() => {
    const map = new Map<
      number,
      { positioned: PositionedTimelineBooking[]; outsideHours: RoomBookingItem[] }
    >();
    const allOutside: RoomBookingItem[] = [];

    for (const room of activeRoomsForDayGrid) {
      const roomBookings = bookings.filter(
        (b) => b.roomId === room.id && bookingTouchesDate(b, anchorDateIso),
      );
      const layout = layoutRoomTimelineBookings(roomBookings, anchorDateIso);
      map.set(room.id, layout);
      allOutside.push(...layout.outsideHours);
    }
    return { map, allOutside };
  }, [activeRoomsForDayGrid, anchorDateIso, bookings]);

  function renderStatusBadge(status: RoomBookingStatus, compact: boolean = false) {
    const meta = BOOKING_STATUS_META[status];
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full border font-semibold ${meta.badgeCls} ${
          compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2.5 py-0.5 text-xs'
        }`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${meta.dotCls}`} />
        <span>{locale === 'en' ? meta.en : meta.vi}</span>
      </span>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {tr('Quản lý & Đặt Phòng họp', 'Meeting Rooms')}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {tr(
              'Tra cứu lịch trống theo ngày/tuần/tháng, theo dõi trạng thái cuộc họp và đặt phòng chống trùng lịch tự động',
              'Check daily/weekly/monthly availability, track booking statuses, and book rooms with automatic conflict prevention',
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canManageRooms && (
            <button
              type="button"
              onClick={openCreateRoomModal}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <IconPlus size={17} />
              <span>{tr('Thêm phòng họp', 'Add Room')}</span>
            </button>
          )}
          {canBookRooms && (
            <button
              type="button"
              disabled={rooms.filter((r) => r.isActive).length === 0}
              onClick={() => openNewBookingModal()}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
            >
              <IconCalendarPlus size={17} />
              <span>{tr('Đặt phòng họp', 'Book Room')}</span>
            </button>
          )}
        </div>
      </div>

      {toastMessage && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          {toastMessage}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>{tr('Phòng họp đang hoạt động', 'Active Meeting Rooms')}</span>
            <IconDoor size={18} className="text-blue-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            {stats.active}{' '}
            <span className="text-sm font-normal text-slate-400">
              / {stats.total} {tr('phòng', 'rooms')}
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>{tr('Cuộc họp hôm nay', 'Meetings Today')}</span>
            <IconCalendar size={18} className="text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{stats.todayBookings}</div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>{tr('Lịch họp sắp tới / đang diễn ra của tôi', 'My Pending & In-progress')}</span>
            <IconClock size={18} className="text-amber-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{upcomingMineCount}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200">
        <div className="flex gap-1">
          {[
            { id: 'calendar' as const, label: tr('Lịch phòng họp', 'Room Calendar') },
            {
              id: 'rooms' as const,
              label: tr(`Danh mục phòng (${rooms.length})`, `Rooms (${rooms.length})`),
            },
            {
              id: 'mine' as const,
              label: tr(`Lịch họp của tôi (${myBookings.length})`, `My Bookings (${myBookings.length})`),
            },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`border-b-2 px-4 py-2.5 text-sm font-medium transition ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'calendar' && (
          <div className="flex flex-wrap items-center gap-2 pb-2">
            <select
              value={calendarStatusFilter}
              onChange={(e) => setCalendarStatusFilter(e.target.value as BookingStatusFilter)}
              aria-label={tr('Lọc theo trạng thái lịch họp', 'Filter by booking status')}
              className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-blue-500"
            >
              <option value="ALL">{tr('Tất cả trạng thái', 'All Statuses')}</option>
              <option value="PENDING">{tr('Chờ diễn ra (Pending)', 'Pending')}</option>
              <option value="IN_PROGRESS">{tr('Đang diễn ra (In-progress)', 'In-progress')}</option>
              <option value="DONE">{tr('Hoàn thành (Done)', 'Done')}</option>
              <option value="CANCELLED">{tr('Đã hủy (Cancelled)', 'Cancelled')}</option>
            </select>

            <select
              value={selectedRoomFilter}
              onChange={(e) => setSelectedRoomFilter(e.target.value)}
              className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-blue-500"
            >
              <option value="">{tr('Tất cả phòng họp', 'All Meeting Rooms')}</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  [{r.code}] {ln(r.name, r.nameEn)} ({r.capacity} {tr('chỗ', 'seats')})
                </option>
              ))}
            </select>

            <div className="inline-flex rounded-xl border border-slate-300 bg-white p-0.5 text-xs font-medium">
              <button
                type="button"
                onClick={() => setCalendarMode('day')}
                className={`rounded-lg px-3 py-1 ${
                  calendarMode === 'day' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {tr('Theo ngày', 'Day')}
              </button>
              <button
                type="button"
                onClick={() => setCalendarMode('week')}
                className={`rounded-lg px-3 py-1 ${
                  calendarMode === 'week' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {tr('Theo tuần', 'Week')}
              </button>
              <button
                type="button"
                onClick={() => setCalendarMode('month')}
                className={`rounded-lg px-3 py-1 ${
                  calendarMode === 'month' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {tr('Theo tháng', 'Month')}
              </button>
            </div>

            <div className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-1.5 py-1">
              <button
                type="button"
                onClick={() => handleNavigatePeriod(-1)}
                className="rounded-lg p-1 text-slate-600 hover:bg-slate-100"
                aria-label={tr('Khoảng trước', 'Previous period')}
              >
                <IconChevronLeft size={16} />
              </button>
              <button
                type="button"
                onClick={() => setAnchorDate(new Date())}
                className="rounded-lg px-2 py-0.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
              >
                {tr('Hôm nay', 'Today')}
              </button>
              <button
                type="button"
                onClick={() => handleNavigatePeriod(1)}
                className="rounded-lg p-1 text-slate-600 hover:bg-slate-100"
                aria-label={tr('Khoảng sau', 'Next period')}
              >
                <IconChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-44 animate-pulse rounded-2xl bg-slate-200/70" />
          ))}
        </div>
      ) : errorMessage ? (
        <div className="rounded-2xl border border-rose-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm font-medium text-rose-700">{errorMessage}</p>
          <button
            type="button"
            onClick={() => setReloadTick((v) => v + 1)}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <IconRefresh size={16} />
            <span>{tr('Thử lại', 'Retry')}</span>
          </button>
        </div>
      ) : activeTab === 'calendar' ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          {/* Calendar Toolbar & Compact Status Legend */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-sm font-bold text-slate-800">
                {calendarMode === 'day'
                  ? tr(
                      `Lịch ngày ${formatDateVN(anchorDateIso)}`,
                      `Schedule for ${formatDateVN(anchorDateIso)}`,
                    )
                  : calendarMode === 'month'
                    ? tr(
                        `Lịch ${formatPeriodLabel('vi', anchorMonth + 1, anchorYear)}`,
                        `Schedule for ${formatPeriodLabel('en', anchorMonth + 1, anchorYear)}`,
                      )
                    : tr(
                        `Tuần từ ${formatDateVN(dateRange.dateFrom)} đến ${formatDateVN(dateRange.dateTo)}`,
                        `Week of ${formatDateVN(dateRange.dateFrom)} – ${formatDateVN(dateRange.dateTo)}`,
                      )}
              </h2>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
                {tr(`${bookings.length} lịch họp`, `${bookings.length} bookings`)}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-[11px] font-medium text-slate-600">
              {BOOKING_STATUS_ORDER.map((st) => {
                const meta = BOOKING_STATUS_META[st];
                return (
                  <span key={st} className="inline-flex items-center gap-1.5">
                    <span className={`h-2 w-2 rounded-full ${meta.dotCls}`} />
                    <span>{locale === 'en' ? meta.en : meta.vi}</span>
                  </span>
                );
              })}
            </div>
          </div>

          {calendarMode === 'month' ? (
            <div className="overflow-x-auto">
              <div className="min-w-[780px]">
                <div className="mb-1.5 grid grid-cols-7 gap-2">
                  {MONTH_WEEKDAY_HEADERS.map((wd) => (
                    <div
                      key={wd.en}
                      className="rounded-lg bg-slate-50 py-1.5 text-center text-[11px] font-bold tracking-wide text-slate-600 uppercase"
                    >
                      {locale === 'en' ? wd.en : wd.vi}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-2">
                  {monthDays.map((dayDate) => {
                    const iso = formatIsoDateLocal(dayDate);
                    const isCurrentMonth = dayDate.getMonth() === anchorMonth;
                    const isToday = iso === todayIso;
                    const isPastDay = iso < todayIso;
                    const dayBookings = bookings.filter((b) => bookingTouchesDate(b, iso));
                    const hasOverflow = dayBookings.length > MONTH_CELL_MAX_VISIBLE;
                    const visibleBookings = hasOverflow
                      ? dayBookings.slice(0, MONTH_CELL_MAX_VISIBLE - 1)
                      : dayBookings;
                    const overflowCount = dayBookings.length - visibleBookings.length;

                    return (
                      <div
                        key={iso}
                        className={`flex h-[116px] flex-col rounded-xl border p-2 transition ${
                          isToday
                            ? 'border-blue-400 bg-blue-50/40'
                            : !isCurrentMonth
                              ? 'border-slate-100 bg-slate-50/60 opacity-65'
                              : isPastDay
                                ? 'border-slate-200/70 bg-slate-50/50'
                                : 'border-slate-200 bg-white'
                        }`}
                      >
                        <div className="mb-1.5 flex shrink-0 items-center justify-between">
                          <button
                            type="button"
                            onClick={() => setDayModalDateIso(iso)}
                            title={tr('Xem tất cả lịch họp ngày này', 'View all bookings for this day')}
                            className={`flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-xs font-bold transition ${
                              isToday
                                ? 'bg-blue-600 text-white'
                                : isPastDay
                                  ? 'text-slate-400 hover:bg-slate-200/70 hover:text-slate-700'
                                  : 'text-slate-800 hover:bg-slate-100'
                            }`}
                          >
                            {dayDate.getDate()}
                          </button>

                          {canBookRooms && !isPastDay && (
                            <button
                              type="button"
                              title={tr('Đặt phòng vào ngày này', 'Book a room on this day')}
                              onClick={() =>
                                openNewBookingModal({
                                  date: iso,
                                  startHour: isToday ? undefined : '09:00',
                                })
                              }
                              className="rounded-md p-0.5 text-slate-400 hover:bg-blue-100 hover:text-blue-700"
                            >
                              <IconPlus size={14} />
                            </button>
                          )}
                        </div>

                        <div className="flex flex-1 flex-col justify-between gap-1 overflow-hidden">
                          <div className="space-y-1">
                            {visibleBookings.map((bk) => {
                              const meta = BOOKING_STATUS_META[bk.status];
                              return (
                                <button
                                  key={bk.id}
                                  type="button"
                                  onClick={() => openBookingDetailModal(bk)}
                                  title={`${formatTimeHHMM(bk.startTime)}–${formatTimeHHMM(bk.endTime)} • ${bk.title} (${bk.roomCode})`}
                                  className={`flex w-full items-center gap-1.5 rounded-lg border border-l-[3px] px-1.5 py-0.5 text-left text-[11px] transition ${meta.cardCls} ${meta.accentBorderCls}`}
                                >
                                  <span className={`shrink-0 font-semibold tabular-nums ${meta.timeCls}`}>
                                    {formatTimeHHMM(bk.startTime)}
                                  </span>
                                  <span className={`truncate font-medium ${meta.titleCls}`}>
                                    {bk.title}
                                  </span>
                                </button>
                              );
                            })}
                          </div>

                          {overflowCount > 0 && (
                            <button
                              type="button"
                              onClick={() => setDayModalDateIso(iso)}
                              className="w-full rounded-md bg-blue-50/70 py-0.5 text-center text-[11px] font-semibold text-blue-600 transition hover:bg-blue-100"
                            >
                              {tr(`+${overflowCount} thêm`, `+${overflowCount} more`)}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : calendarMode === 'week' ? (
            /* Uniform Fixed-Height Week View: Show Representative Bookings + "+N more" Modal */
            <div className="grid grid-cols-1 gap-2.5 md:grid-cols-7">
              {weekDays.map((dayDate) => {
                const iso = formatIsoDateLocal(dayDate);
                const isToday = iso === todayIso;
                const isPastDay = iso < todayIso;
                const dayBookings = bookings.filter((b) => bookingTouchesDate(b, iso));
                const weekdayLabel = WEEKDAY_SHORT[dayDate.getDay()];
                const hasOverflow = dayBookings.length > WEEK_CELL_MAX_VISIBLE;
                const visibleBookings = hasOverflow
                  ? dayBookings.slice(0, WEEK_CELL_MAX_VISIBLE - 1)
                  : dayBookings;
                const overflowCount = dayBookings.length - visibleBookings.length;

                return (
                  <div
                    key={iso}
                    className={`flex h-[252px] flex-col rounded-xl border p-2.5 ${
                      isToday
                        ? 'border-blue-300 bg-blue-50/35'
                        : isPastDay
                          ? 'border-slate-200/80 bg-slate-50/70'
                          : 'border-slate-200 bg-slate-50/35'
                    }`}
                  >
                    {/* Column Header */}
                    <div className="mb-2 flex shrink-0 items-center justify-between border-b border-slate-200/90 pb-1.5">
                      <button
                        type="button"
                        onClick={() => setDayModalDateIso(iso)}
                        title={tr('Xem tất cả lịch họp ngày này', 'View all bookings for this day')}
                        className="flex items-center gap-1.5 rounded-lg px-1 py-0.5 text-left transition hover:bg-slate-200/60"
                      >
                        <div>
                          <div className="text-[10px] font-semibold uppercase text-slate-500">
                            {locale === 'en' ? weekdayLabel.en : weekdayLabel.vi}
                          </div>
                          <div
                            className={`text-xs font-bold tabular-nums ${
                              isToday
                                ? 'text-blue-700'
                                : isPastDay
                                  ? 'text-slate-400'
                                  : 'text-slate-900'
                            }`}
                          >
                            {formatDateVN(iso).slice(0, 5)}
                          </div>
                        </div>
                        {dayBookings.length > 0 && (
                          <span className="rounded-full bg-slate-200/80 px-1.5 py-0.5 text-[10px] font-bold text-slate-700 tabular-nums">
                            {dayBookings.length}
                          </span>
                        )}
                      </button>

                      {canBookRooms && !isPastDay && (
                        <button
                          type="button"
                          title={tr('Đặt phòng vào ngày này', 'Book a room on this day')}
                          onClick={() =>
                            openNewBookingModal({
                              date: iso,
                              startHour: isToday ? undefined : '09:00',
                            })
                          }
                          className="rounded-lg p-1 text-slate-500 hover:bg-blue-100 hover:text-blue-700"
                        >
                          <IconPlus size={14} />
                        </button>
                      )}
                    </div>

                    {/* Representative Bookings (Fixed Height — No Scroll Stretching) */}
                    <div className="flex flex-1 flex-col justify-between gap-1.5 overflow-hidden">
                      {dayBookings.length === 0 ? (
                        <div className="flex flex-1 items-center justify-center text-xs text-slate-400">
                          {tr('Trống lịch', 'No bookings')}
                        </div>
                      ) : (
                        <>
                          <div className="space-y-1.5">
                            {visibleBookings.map((bk) => {
                              const meta = BOOKING_STATUS_META[bk.status];
                              const statusLabel = locale === 'en' ? meta.en : meta.vi;
                              return (
                                <button
                                  key={bk.id}
                                  type="button"
                                  onClick={() => openBookingDetailModal(bk)}
                                  title={`${formatTimeHHMM(bk.startTime)}–${formatTimeHHMM(bk.endTime)} • ${bk.title} (${bk.roomCode} • ${bk.bookedByEmployeeName}) — ${statusLabel}`}
                                  className={`w-full rounded-lg border border-l-[3px] px-2 py-1.5 text-left transition ${meta.cardCls} ${meta.accentBorderCls}`}
                                >
                                  <div className="flex items-center justify-between gap-1">
                                    <span
                                      className={`inline-flex items-center gap-1 text-[10px] font-semibold tabular-nums ${meta.timeCls}`}
                                    >
                                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${meta.dotCls}`} />
                                      {formatTimeHHMM(bk.startTime)}–{formatTimeHHMM(bk.endTime)}
                                    </span>
                                    <span className="shrink-0 rounded bg-white/80 px-1 py-0.2 text-[9px] font-bold text-slate-600 ring-1 ring-slate-200/80">
                                      {bk.roomCode}
                                    </span>
                                  </div>
                                  <div className={`mt-0.5 truncate text-[11px] font-semibold ${meta.titleCls}`}>
                                    {bk.title}
                                  </div>
                                </button>
                              );
                            })}
                          </div>

                          {overflowCount > 0 && (
                            <button
                              type="button"
                              onClick={() => setDayModalDateIso(iso)}
                              className="w-full shrink-0 rounded-lg border border-blue-200 bg-blue-50/70 py-1 text-center text-[11px] font-semibold text-blue-700 transition hover:border-blue-300 hover:bg-blue-100"
                            >
                              {tr(`+${overflowCount} thêm`, `+${overflowCount} more`)}
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : activeRoomsForDayGrid.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">
              {tr(
                'Chưa có phòng họp nào đang hoạt động trong chi nhánh này.',
                'No active meeting rooms in this branch.',
              )}
            </div>
          ) : (
            /* Proportional Room Timeline Day View — Single Event Block per Booking (No Hour Duplication!) */
            <div className="space-y-3">
              {dayTimelineByRoom.allOutside.length > 0 && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="mb-2 text-[11px] font-semibold text-slate-600">
                    {tr(
                      'Lịch họp ngoài khung 08:00 – 19:00',
                      'Bookings outside 08:00 – 19:00',
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {dayTimelineByRoom.allOutside.map((bk) => {
                      const meta = BOOKING_STATUS_META[bk.status];
                      return (
                        <button
                          key={bk.id}
                          type="button"
                          onClick={() => openBookingDetailModal(bk)}
                          className={`inline-flex items-center gap-2 rounded-lg border border-l-[3px] px-2.5 py-1.5 text-xs transition ${meta.cardCls} ${meta.accentBorderCls}`}
                        >
                          <span className={`font-semibold tabular-nums ${meta.timeCls}`}>
                            {formatTimeHHMM(bk.startTime)}–{formatTimeHHMM(bk.endTime)}
                          </span>
                          <span className={`font-semibold ${meta.titleCls}`}>{bk.title}</span>
                          <span className="text-[11px] text-slate-500">[{bk.roomCode}]</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="max-h-[580px] overflow-auto rounded-xl border border-slate-200">
                <div
                  className="grid min-w-full"
                  style={{
                    gridTemplateColumns: `68px repeat(${activeRoomsForDayGrid.length}, minmax(220px, 1fr))`,
                  }}
                >
                  {/* Sticky Header Row */}
                  <div className="sticky top-0 z-20 border-r border-b border-slate-200 bg-slate-50 px-2 py-2.5 text-center text-[11px] font-semibold text-slate-500">
                    {tr('Giờ', 'Time')}
                  </div>
                  {activeRoomsForDayGrid.map((room) => (
                    <div
                      key={room.id}
                      className="sticky top-0 z-20 border-r border-b border-slate-200 bg-slate-50 px-3 py-2 last:border-r-0"
                    >
                      <div className="truncate text-xs font-bold text-slate-900">
                        [{room.code}] {ln(room.name, room.nameEn)}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {room.floor ? `${room.floor} • ` : ''}
                        {room.capacity} {tr('chỗ', 'seats')}
                      </div>
                    </div>
                  ))}

                  {/* Time Axis Column */}
                  <div
                    className="relative border-r border-slate-200 bg-slate-50/70"
                    style={{ height: `${TIMELINE_HOURS.length * TIMELINE_HOUR_HEIGHT}px` }}
                  >
                    {TIMELINE_HOURS.map((hourNum, idx) => (
                      <div
                        key={hourNum}
                        className="flex items-start justify-center border-b border-slate-200/80 pt-1 text-[11px] font-semibold text-slate-500 tabular-nums last:border-b-0"
                        style={{ height: `${TIMELINE_HOUR_HEIGHT}px` }}
                      >
                        {String(hourNum).padStart(2, '0')}:00
                        {idx === TIMELINE_HOURS.length - 1 ? '' : ''}
                      </div>
                    ))}
                  </div>

                  {/* Room Columns with Proportional Event Overlay */}
                  {activeRoomsForDayGrid.map((room) => {
                    const roomBookings = bookings.filter(
                      (b) => b.roomId === room.id && bookingTouchesDate(b, anchorDateIso),
                    );
                    const positioned = dayTimelineByRoom.map.get(room.id)?.positioned ?? [];

                    return (
                      <div
                        key={room.id}
                        className="relative border-r border-slate-200 bg-white last:border-r-0"
                        style={{ height: `${TIMELINE_HOURS.length * TIMELINE_HOUR_HEIGHT}px` }}
                      >
                        {/* Background Hourly Slots (clickable to quick-book future free slots) */}
                        {TIMELINE_HOURS.map((hourNum) => {
                          const hourStr = `${String(hourNum).padStart(2, '0')}:00`;
                          const slotStartMs = new Date(`${anchorDateIso}T${hourStr}:00`).getTime();
                          const isSlotInPast = slotStartMs < loadedAtMs;
                          const isBlocked = roomBookings.some((b) =>
                            bookingBlocksHourSlot(b, anchorDateIso, hourNum),
                          );

                          return (
                            <div
                              key={hourNum}
                              className={`group border-b border-slate-100 last:border-b-0 ${
                                isSlotInPast ? 'bg-slate-50/55' : ''
                              }`}
                              style={{ height: `${TIMELINE_HOUR_HEIGHT}px` }}
                            >
                              {!isBlocked && !isSlotInPast && canBookRooms && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    openNewBookingModal({
                                      roomId: room.id,
                                      date: anchorDateIso,
                                      startHour: hourStr,
                                    })
                                  }
                                  className="flex h-full w-full items-center justify-center text-[11px] font-medium text-transparent transition group-hover:bg-blue-50/45 group-hover:text-blue-600"
                                >
                                  {tr(`+ Đặt lúc ${hourStr}`, `+ Book ${hourStr}`)}
                                </button>
                              )}
                            </div>
                          );
                        })}

                        {/* Current-time indicator line */}
                        {nowIndicatorTopPx !== null && (
                          <div
                            className="pointer-events-none absolute right-0 left-0 z-10 border-t-2 border-rose-500/80"
                            style={{ top: `${nowIndicatorTopPx}px` }}
                          >
                            <span className="absolute -top-1.5 -left-1 h-2.5 w-2.5 rounded-full bg-rose-500" />
                          </div>
                        )}

                        {/* Positioned Booking Cards (each rendered ONCE with exact proportional height) */}
                        {positioned.map(({ booking: bk, topPx, heightPx, colIndex, colCount }) => {
                          const meta = BOOKING_STATUS_META[bk.status];
                          const isShort = heightPx < 54;
                          const widthPct = 100 / colCount;
                          const leftPct = colIndex * widthPct;

                          return (
                            <button
                              key={bk.id}
                              type="button"
                              onClick={() => openBookingDetailModal(bk)}
                              title={`${formatTimeHHMM(bk.startTime)}–${formatTimeHHMM(bk.endTime)} • ${bk.title} (${bk.bookedByEmployeeName})`}
                              className={`absolute z-10 overflow-hidden rounded-lg border border-l-[3px] px-2 py-1 text-left shadow-xs transition hover:z-20 hover:shadow-md ${meta.cardCls} ${meta.accentBorderCls}`}
                              style={{
                                top: `${topPx}px`,
                                height: `${heightPx}px`,
                                left: `calc(${leftPct}% + 4px)`,
                                width: `calc(${widthPct}% - 8px)`,
                              }}
                            >
                              <div className="flex items-center justify-between gap-1">
                                <span
                                  className={`truncate text-[11px] font-semibold tabular-nums ${meta.timeCls}`}
                                >
                                  {formatTimeHHMM(bk.startTime)}–{formatTimeHHMM(bk.endTime)}
                                </span>
                                {!isShort && renderStatusBadge(bk.status, true)}
                              </div>
                              <div className={`truncate text-xs font-bold ${meta.titleCls}`}>
                                {bk.title}
                              </div>
                              {!isShort && (
                                <div className="truncate text-[11px] text-slate-500">
                                  {bk.bookedByEmployeeName} ({bk.attendeesCount}{' '}
                                  {tr('người', 'attendees')})
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      ) : activeTab === 'rooms' ? (
        rooms.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <p className="text-sm text-slate-500">
              {tr('Chưa có phòng họp nào được khai báo.', 'No meeting rooms configured yet.')}
            </p>
            {canManageRooms && (
              <button
                type="button"
                onClick={openCreateRoomModal}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                <IconPlus size={16} />
                <span>{tr('Thêm phòng họp đầu tiên', 'Add First Room')}</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {rooms.map((room) => (
              <div
                key={room.id}
                className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700">
                        {room.code}
                      </span>
                      <h3 className="mt-1.5 text-base font-bold text-slate-900">
                        {ln(room.name, room.nameEn)}
                      </h3>
                      <p className="text-xs text-slate-500">
                        {ln(room.branchName, room.branchNameEn)}{' '}
                        {room.floor ? `• ${room.floor}` : ''}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        room.isActive
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {room.isActive ? tr('Hoạt động', 'Active') : tr('Tạm ngưng', 'Inactive')}
                    </span>
                  </div>

                  <div className="mt-3 flex items-center gap-4 text-xs text-slate-600">
                    <span className="inline-flex items-center gap-1 font-medium">
                      <IconUsers size={15} className="text-blue-600" />
                      {room.capacity} {tr('chỗ ngồi', 'seats')}
                    </span>
                    <span>
                      {tr('Sắp tới:', 'Upcoming:')} {room.upcomingBookingsCount}{' '}
                      {tr('lịch', 'bookings')}
                    </span>
                  </div>

                  {room.equipment.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {room.equipment.map((eq) => (
                        <span
                          key={eq}
                          className="rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700"
                        >
                          {eq}
                        </span>
                      ))}
                    </div>
                  )}

                  {room.description && (
                    <p className="mt-3 line-clamp-2 text-xs text-slate-500" title={room.description}>
                      {room.description}
                    </p>
                  )}
                </div>

                <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
                  {canBookRooms && room.isActive ? (
                    <button
                      type="button"
                      onClick={() => openNewBookingModal({ roomId: room.id })}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                    >
                      <IconCalendarPlus size={14} />
                      <span>{tr('Đặt phòng này', 'Book This Room')}</span>
                    </button>
                  ) : (
                    <span />
                  )}

                  {canManageRooms && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEditRoomModal(room)}
                        className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100"
                        title={tr('Chỉnh sửa phòng', 'Edit Room')}
                      >
                        <IconEdit size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingRoom(room)}
                        className="rounded-lg p-1.5 text-rose-600 hover:bg-rose-50"
                        title={tr('Lưu trữ (ẩn) phòng', 'Archive Room')}
                      >
                        <IconTrash size={16} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-800">
              {tr('Danh sách lịch phòng họp tôi đã đặt', 'My Room Bookings')}
            </h2>
            <select
              value={mineStatusFilter}
              onChange={(e) => setMineStatusFilter(e.target.value as BookingStatusFilter)}
              className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-blue-500"
            >
              <option value="ALL">{tr('Tất cả trạng thái', 'All Statuses')}</option>
              <option value="PENDING">{tr('Chờ diễn ra (Pending)', 'Pending')}</option>
              <option value="IN_PROGRESS">{tr('Đang diễn ra (In-progress)', 'In-progress')}</option>
              <option value="DONE">{tr('Hoàn thành (Done)', 'Done')}</option>
              <option value="CANCELLED">{tr('Đã hủy (Cancelled)', 'Cancelled')}</option>
            </select>
          </div>

          {myBookings.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center">
              <p className="text-sm text-slate-500">
                {tr('Bạn chưa có lịch đặt phòng họp nào.', 'You have no room bookings yet.')}
              </p>
              {canBookRooms && (
                <button
                  type="button"
                  onClick={() => openNewBookingModal()}
                  className="mt-3 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  <IconCalendarPlus size={16} />
                  <span>{tr('Đặt phòng họp ngay', 'Book a Room Now')}</span>
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">{tr('Cuộc họp', 'Meeting')}</th>
                    <th className="px-4 py-3">{tr('Phòng họp', 'Room')}</th>
                    <th className="px-4 py-3">{tr('Thời gian', 'Time')}</th>
                    <th className="px-4 py-3">{tr('Tham dự', 'Attendees')}</th>
                    <th className="px-4 py-3">{tr('Trạng thái', 'Status')}</th>
                    <th className="px-4 py-3 text-right">{tr('Thao tác', 'Actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {myBookings.map((bk) => (
                    <tr key={bk.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">
                        <div className={bk.status === 'CANCELLED' ? 'text-slate-500 line-through' : ''}>
                          {bk.title}
                        </div>
                        {bk.cancelReason && (
                          <div className="text-xs font-normal text-rose-600">
                            {tr('Lý do hủy:', 'Cancel reason:')} {bk.cancelReason}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        <span className="font-semibold">{bk.roomCode}</span> —{' '}
                        {ln(bk.roomName, bk.roomNameEn)}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600 tabular-nums">
                        {formatDateTimeVN(bk.startTime)} → {formatTimeHHMM(bk.endTime)}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {bk.attendeesCount} {tr('người', 'people')}
                      </td>
                      <td className="px-4 py-3">{renderStatusBadge(bk.status)}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => openBookingDetailModal(bk)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                        >
                          <IconEye size={14} />
                          <span>{tr('Xem', 'View')}</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {isRoomModalOpen && (
        <MeetingRoomFormModal
          key={editingRoom?.id ?? 'new-room'}
          branches={user?.branches ?? []}
          defaultBranchId={selectedBranchId}
          initialData={editingRoom}
          onClose={() => setIsRoomModalOpen(false)}
          onSaved={() => {
            setIsRoomModalOpen(false);
            showToast(
              editingRoom
                ? tr('Đã cập nhật thông tin phòng họp.', 'Meeting room updated.')
                : tr('Đã thêm phòng họp mới.', 'Meeting room created.'),
            );
            setReloadTick((v) => v + 1);
          }}
        />
      )}

      {dayModalDateIso && (() => {
        const modalDateObj = new Date(`${dayModalDateIso}T00:00:00`);
        const modalWeekday = WEEKDAY_SHORT[modalDateObj.getDay()] ?? WEEKDAY_SHORT[1];
        const modalBookings = bookings.filter((b) => bookingTouchesDate(b, dayModalDateIso));
        const modalIsToday = dayModalDateIso === todayIso;
        return (
          <DayBookingsModal
            dateIso={dayModalDateIso}
            weekdayLabel={locale === 'en' ? modalWeekday.en : modalWeekday.vi}
            bookings={modalBookings}
            canBook={canBookRooms}
            isPastDay={dayModalDateIso < todayIso}
            onSelectBooking={(bk) => openBookingDetailModal(bk)}
            onBookOnDay={() =>
              openNewBookingModal({
                date: dayModalDateIso,
                startHour: modalIsToday ? undefined : '09:00',
              })
            }
            onOpenDayTimeline={() => {
              setAnchorDate(modalDateObj);
              setCalendarMode('day');
              setDayModalDateIso(null);
            }}
            onClose={() => setDayModalDateIso(null)}
          />
        );
      })()}

      {isBookingModalOpen && (
        <RoomBookingModal
          key={activeBooking ? `bk-${activeBooking.id}-${activeBooking.status}` : `new-${bookingPreset.roomId ?? 'x'}-${bookingPreset.date ?? ''}-${bookingPreset.startHour ?? ''}`}
          rooms={rooms}
          branchId={selectedBranchId}
          initialBooking={activeBooking}
          defaultRoomId={bookingPreset.roomId}
          defaultDate={bookingPreset.date}
          defaultStartHour={bookingPreset.startHour}
          onClose={() => setIsBookingModalOpen(false)}
          onSaved={() => {
            setIsBookingModalOpen(false);
            showToast(
              tr('Đã cập nhật lịch đặt phòng họp thành công.', 'Room booking saved successfully.'),
            );
            setReloadTick((v) => v + 1);
          }}
        />
      )}

      <ConfirmModal
        isOpen={Boolean(deletingRoom)}
        title={tr('Lưu trữ phòng họp?', 'Archive Meeting Room?')}
        description={
          deletingRoom
            ? tr(
                `Phòng họp "${ln(deletingRoom.name, deletingRoom.nameEn)}" (${deletingRoom.code}) sẽ được lưu trữ (xóa mềm, không xóa dữ liệu khỏi DB). Thao tác sẽ bị chặn nếu phòng đang có lịch đặt sắp tới.`,
                `Meeting room "${ln(deletingRoom.name, deletingRoom.nameEn)}" (${deletingRoom.code}) will be archived (soft-hidden, never deleted from DB). Blocked if upcoming bookings exist.`,
              )
            : ''
        }
        confirmLabel={tr('Xác nhận lưu trữ', 'Confirm Archive')}
        cancelLabel={tr('Hủy', 'Cancel')}
        variant="danger"
        isProcessing={isDeletingRoom}
        onConfirm={() => void handleConfirmDeleteRoom()}
        onCancel={() => setDeletingRoom(null)}
      />
    </div>
  );
}
