'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  IconCalendar,
  IconCalendarPlus,
  IconChevronLeft,
  IconChevronRight,
  IconClock,
  IconDoor,
  IconEdit,
  IconPlus,
  IconRefresh,
  IconTrash,
  IconUsers,
} from '@tabler/icons-react';
import {
  MeetingRoomFormModal,
  type MeetingRoomFormData,
} from '@/components/hrm/MeetingRoomFormModal';
import { RoomBookingModal } from '@/components/hrm/RoomBookingModal';
import { usePortalAuth } from '@/components/portal/PortalAuthContext';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { formatDateTimeVN, formatDateVN } from '@/lib/portable/date-utils';
import type {
  MeetingRoomItem,
  MeetingRoomStats,
  RoomBookingItem,
} from '@/modules/hrm/office/meeting-rooms.service';

type MainTab = 'calendar' | 'rooms' | 'mine';
type CalendarMode = 'day' | 'week';

const DAY_HOURS = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'];
const WEEKDAY_SHORT = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

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

function bookingTouchesHourSlot(booking: RoomBookingItem, targetDateIso: string, hourStr: string): boolean {
  const start = new Date(booking.startTime);
  const end = new Date(booking.endTime);
  const slotStart = new Date(`${targetDateIso}T${hourStr}:00`);
  const slotEnd = new Date(slotStart.getTime() + 60 * 60 * 1000);
  return start.getTime() < slotEnd.getTime() && end.getTime() > slotStart.getTime();
}

export default function MeetingRoomsPage() {
  const { user, selectedBranchId, hasPermission } = usePortalAuth();
  const canManageRooms = hasPermission('hrm.rooms.manage');
  const canBookRooms = hasPermission('hrm.rooms.book');

  const [activeTab, setActiveTab] = useState<MainTab>('calendar');
  const [calendarMode, setCalendarMode] = useState<CalendarMode>('week');
  const [anchorDate, setAnchorDate] = useState<Date>(() => new Date());
  const [selectedRoomFilter, setSelectedRoomFilter] = useState<string>('');
  const [mineStatusFilter, setMineStatusFilter] = useState<'ALL' | 'CONFIRMED' | 'CANCELLED'>('ALL');

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

  const weekDays = useMemo(() => {
    const monday = getMondayOfWeek(anchorDate);
    return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  }, [anchorDate]);

  const dateRange = useMemo(() => {
    if (calendarMode === 'day') {
      const iso = formatIsoDateLocal(anchorDate);
      return { dateFrom: iso, dateTo: iso };
    }
    return {
      dateFrom: formatIsoDateLocal(weekDays[0]),
      dateTo: formatIsoDateLocal(weekDays[6]),
    };
  }, [anchorDate, calendarMode, weekDays]);

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
          limit: '300',
          status: 'CONFIRMED',
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
          throw new Error(roomsJson?.error?.message ?? 'Không thể tải danh sách phòng họp.');
        }
        if (!calRes.ok || !calJson?.success || !calJson.data) {
          throw new Error(calJson?.error?.message ?? 'Không thể tải lịch đặt phòng họp.');
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
          err instanceof Error ? err.message : 'Lỗi kết nối khi tải dữ liệu phòng họp.',
        );
      } finally {
        setIsLoading(false);
      }
    })();

    return () => controller.abort();
  }, [dateRange.dateFrom, dateRange.dateTo, mineStatusFilter, reloadTick, selectedBranchId, selectedRoomFilter]);

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
      floor: room.floor,
      capacity: room.capacity,
      equipment: room.equipment,
      description: room.description,
      isActive: room.isActive,
    });
    setIsRoomModalOpen(true);
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
        setErrorMessage(json?.error?.message ?? 'Không thể xóa phòng họp.');
        return;
      }
      setDeletingRoom(null);
      showToast(`Đã xóa phòng họp "${deletingRoom.name}".`);
      setReloadTick((v) => v + 1);
    } catch {
      setErrorMessage('Lỗi kết nối khi xóa phòng họp.');
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
  const upcomingMineCount = myBookings.filter(
    (b) => b.status === 'CONFIRMED' && new Date(b.endTime).getTime() > loadedAtMs,
  ).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Quản lý & Đặt Phòng họp</h1>
          <p className="mt-1 text-sm text-slate-500">
            Tra cứu lịch trống theo ngày/tuần và đặt phòng họp chống trùng lịch tự động
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
              <span>Thêm phòng họp</span>
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
              <span>Đặt phòng họp</span>
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
            <span>Phòng họp đang hoạt động</span>
            <IconDoor size={18} className="text-blue-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            {stats.active}{' '}
            <span className="text-sm font-normal text-slate-400">/ {stats.total} phòng</span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Cuộc họp hôm nay</span>
            <IconCalendar size={18} className="text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{stats.todayBookings}</div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Lịch họp sắp tới của tôi</span>
            <IconClock size={18} className="text-amber-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{upcomingMineCount}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200">
        <div className="flex gap-1">
          {[
            { id: 'calendar' as const, label: 'Lịch phòng họp' },
            { id: 'rooms' as const, label: `Danh mục phòng (${rooms.length})` },
            { id: 'mine' as const, label: `Lịch họp của tôi (${myBookings.length})` },
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
              value={selectedRoomFilter}
              onChange={(e) => setSelectedRoomFilter(e.target.value)}
              className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-blue-500"
            >
              <option value="">Tất cả phòng họp</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  [{r.code}] {r.name} ({r.capacity} chỗ)
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
                Theo ngày
              </button>
              <button
                type="button"
                onClick={() => setCalendarMode('week')}
                className={`rounded-lg px-3 py-1 ${
                  calendarMode === 'week' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Theo tuần
              </button>
            </div>

            <div className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-1.5 py-1">
              <button
                type="button"
                onClick={() => setAnchorDate((d) => addDays(d, calendarMode === 'day' ? -1 : -7))}
                className="rounded-lg p-1 text-slate-600 hover:bg-slate-100"
                aria-label="Khoảng trước"
              >
                <IconChevronLeft size={16} />
              </button>
              <button
                type="button"
                onClick={() => setAnchorDate(new Date())}
                className="rounded-lg px-2 py-0.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
              >
                Hôm nay
              </button>
              <button
                type="button"
                onClick={() => setAnchorDate((d) => addDays(d, calendarMode === 'day' ? 1 : 7))}
                className="rounded-lg p-1 text-slate-600 hover:bg-slate-100"
                aria-label="Khoảng sau"
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
            <span>Thử lại</span>
          </button>
        </div>
      ) : activeTab === 'calendar' ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-800">
              {calendarMode === 'day'
                ? `Lịch ngày ${formatDateVN(anchorDateIso)}`
                : `Tuần từ ${formatDateVN(dateRange.dateFrom)} đến ${formatDateVN(dateRange.dateTo)}`}
            </h2>
            <span className="text-xs text-slate-500">
              Hiển thị {bookings.length} lịch họp đã xác nhận • Nhấn vào ô trống để đặt nhanh
            </span>
          </div>

          {calendarMode === 'week' ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-7">
              {weekDays.map((dayDate) => {
                const iso = formatIsoDateLocal(dayDate);
                const isToday = iso === formatIsoDateLocal(new Date());
                const dayBookings = bookings.filter((b) => bookingTouchesDate(b, iso));

                return (
                  <div
                    key={iso}
                    className={`flex min-h-[260px] flex-col rounded-xl border p-2.5 ${
                      isToday ? 'border-blue-300 bg-blue-50/40' : 'border-slate-200 bg-slate-50/40'
                    }`}
                  >
                    <div className="mb-2 flex items-center justify-between border-b border-slate-200 pb-2">
                      <div>
                        <div className="text-[11px] font-semibold uppercase text-slate-500">
                          {WEEKDAY_SHORT[dayDate.getDay()]}
                        </div>
                        <div
                          className={`text-sm font-bold ${
                            isToday ? 'text-blue-700' : 'text-slate-900'
                          }`}
                        >
                          {formatDateVN(iso).slice(0, 5)}
                        </div>
                      </div>
                      {canBookRooms && (
                        <button
                          type="button"
                          title="Đặt phòng vào ngày này"
                          onClick={() => openNewBookingModal({ date: iso, startHour: '09:00' })}
                          className="rounded-lg p-1 text-slate-500 hover:bg-blue-100 hover:text-blue-700"
                        >
                          <IconPlus size={15} />
                        </button>
                      )}
                    </div>

                    <div className="flex-1 space-y-2">
                      {dayBookings.length === 0 ? (
                        <div className="py-6 text-center text-xs text-slate-400">Trống lịch</div>
                      ) : (
                        dayBookings.map((bk) => (
                          <button
                            key={bk.id}
                            type="button"
                            onClick={() => openBookingDetailModal(bk)}
                            className="w-full rounded-xl border border-blue-200 bg-white p-2 text-left shadow-xs transition hover:border-blue-400 hover:bg-blue-50/40"
                          >
                            <div className="text-[11px] font-semibold text-blue-700">
                              {formatTimeHHMM(bk.startTime)} – {formatTimeHHMM(bk.endTime)}
                            </div>
                            <div className="mt-0.5 line-clamp-2 text-xs font-semibold text-slate-900" title={bk.title}>
                              {bk.title}
                            </div>
                            <div className="mt-1 truncate text-[11px] text-slate-500" title={bk.roomName}>
                              {bk.roomCode} • {bk.bookedByEmployeeName}
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : activeRoomsForDayGrid.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">
              Chưa có phòng họp nào đang hoạt động trong chi nhánh này.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-left text-slate-600">
                    <th className="w-20 border border-slate-200 px-3 py-2 font-semibold">Khung giờ</th>
                    {activeRoomsForDayGrid.map((room) => (
                      <th key={room.id} className="min-w-[200px] border border-slate-200 px-3 py-2">
                        <div className="font-bold text-slate-900">
                          [{room.code}] {room.name}
                        </div>
                        <div className="font-normal text-slate-500">
                          {room.floor ? `${room.floor} • ` : ''}
                          {room.capacity} chỗ
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {DAY_HOURS.map((hour) => (
                    <tr key={hour}>
                      <td className="border border-slate-200 bg-slate-50/70 px-3 py-2.5 font-semibold text-slate-600">
                        {hour}
                      </td>
                      {activeRoomsForDayGrid.map((room) => {
                        const slotBookings = bookings.filter(
                          (b) =>
                            b.roomId === room.id &&
                            bookingTouchesHourSlot(b, anchorDateIso, hour),
                        );

                        return (
                          <td
                            key={`${room.id}-${hour}`}
                            className="border border-slate-200 p-1.5 align-top"
                          >
                            {slotBookings.length > 0 ? (
                              <div className="space-y-1">
                                {slotBookings.map((bk) => (
                                  <button
                                    key={bk.id}
                                    type="button"
                                    onClick={() => openBookingDetailModal(bk)}
                                    className="w-full rounded-lg border border-blue-200 bg-blue-50 px-2 py-1.5 text-left hover:bg-blue-100"
                                  >
                                    <div className="font-semibold text-blue-800">
                                      {formatTimeHHMM(bk.startTime)}–{formatTimeHHMM(bk.endTime)} • {bk.title}
                                    </div>
                                    <div className="truncate text-[11px] text-blue-700/80">
                                      {bk.bookedByEmployeeName} ({bk.attendeesCount} người)
                                    </div>
                                  </button>
                                ))}
                              </div>
                            ) : canBookRooms ? (
                              <button
                                type="button"
                                onClick={() =>
                                  openNewBookingModal({
                                    roomId: room.id,
                                    date: anchorDateIso,
                                    startHour: hour,
                                  })
                                }
                                className="flex h-10 w-full items-center justify-center rounded-lg border border-dashed border-transparent text-[11px] text-slate-400 transition hover:border-blue-300 hover:bg-blue-50/40 hover:text-blue-600"
                              >
                                + Đặt giờ này
                              </button>
                            ) : (
                              <div className="h-10" />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : activeTab === 'rooms' ? (
        rooms.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <p className="text-sm text-slate-500">Chưa có phòng họp nào được khai báo.</p>
            {canManageRooms && (
              <button
                type="button"
                onClick={openCreateRoomModal}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                <IconPlus size={16} />
                <span>Thêm phòng họp đầu tiên</span>
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
                      <h3 className="mt-1.5 text-base font-bold text-slate-900">{room.name}</h3>
                      <p className="text-xs text-slate-500">
                        {room.branchName} {room.floor ? `• ${room.floor}` : ''}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        room.isActive
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {room.isActive ? 'Hoạt động' : 'Tạm ngưng'}
                    </span>
                  </div>

                  <div className="mt-3 flex items-center gap-4 text-xs text-slate-600">
                    <span className="inline-flex items-center gap-1 font-medium">
                      <IconUsers size={15} className="text-blue-600" />
                      {room.capacity} chỗ ngồi
                    </span>
                    <span>Sắp tới: {room.upcomingBookingsCount} lịch</span>
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
                      <span>Đặt phòng này</span>
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
                        title="Chỉnh sửa phòng"
                      >
                        <IconEdit size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingRoom(room)}
                        className="rounded-lg p-1.5 text-rose-600 hover:bg-rose-50"
                        title="Xóa mềm phòng"
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
            <h2 className="text-sm font-semibold text-slate-800">Danh sách lịch phòng họp tôi đã đặt</h2>
            <select
              value={mineStatusFilter}
              onChange={(e) =>
                setMineStatusFilter(e.target.value as 'ALL' | 'CONFIRMED' | 'CANCELLED')
              }
              className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-blue-500"
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="CONFIRMED">Đã xác nhận</option>
              <option value="CANCELLED">Đã hủy</option>
            </select>
          </div>

          {myBookings.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center">
              <p className="text-sm text-slate-500">Bạn chưa có lịch đặt phòng họp nào.</p>
              {canBookRooms && (
                <button
                  type="button"
                  onClick={() => openNewBookingModal()}
                  className="mt-3 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  <IconCalendarPlus size={16} />
                  <span>Đặt phòng họp ngay</span>
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Cuộc họp</th>
                    <th className="px-4 py-3">Phòng họp</th>
                    <th className="px-4 py-3">Thời gian</th>
                    <th className="px-4 py-3">Tham dự</th>
                    <th className="px-4 py-3">Trạng thái</th>
                    <th className="px-4 py-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {myBookings.map((bk) => (
                    <tr key={bk.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">
                        <div>{bk.title}</div>
                        {bk.cancelReason && (
                          <div className="text-xs font-normal text-rose-600">
                            Lý do hủy: {bk.cancelReason}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        <span className="font-semibold">{bk.roomCode}</span> — {bk.roomName}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {formatDateTimeVN(bk.startTime)} → {formatTimeHHMM(bk.endTime)}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{bk.attendeesCount} người</td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            bk.status === 'CONFIRMED'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {bk.status === 'CONFIRMED' ? 'Đã xác nhận' : 'Đã hủy'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => openBookingDetailModal(bk)}
                          className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                        >
                          {bk.canEditOrCancel ? 'Xem / Sửa / Hủy' : 'Xem chi tiết'}
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
            showToast(editingRoom ? 'Đã cập nhật thông tin phòng họp.' : 'Đã thêm phòng họp mới.');
            setReloadTick((v) => v + 1);
          }}
        />
      )}

      {isBookingModalOpen && (
        <RoomBookingModal
          key={activeBooking ? `bk-${activeBooking.id}` : `new-${bookingPreset.roomId ?? 'x'}-${bookingPreset.date ?? ''}-${bookingPreset.startHour ?? ''}`}
          rooms={rooms}
          initialBooking={activeBooking}
          defaultRoomId={bookingPreset.roomId}
          defaultDate={bookingPreset.date}
          defaultStartHour={bookingPreset.startHour}
          onClose={() => setIsBookingModalOpen(false)}
          onSaved={() => {
            setIsBookingModalOpen(false);
            showToast('Đã cập nhật lịch đặt phòng họp thành công.');
            setReloadTick((v) => v + 1);
          }}
        />
      )}

      <ConfirmModal
        isOpen={Boolean(deletingRoom)}
        title="Xóa phòng họp?"
        description={
          deletingRoom
            ? `Bạn có chắc chắn muốn xóa mềm phòng họp "${deletingRoom.name}" (${deletingRoom.code})? Thao tác sẽ bị chặn nếu phòng đang có lịch đặt sắp tới.`
            : ''
        }
        confirmLabel="Xác nhận xóa"
        cancelLabel="Hủy"
        variant="danger"
        isProcessing={isDeletingRoom}
        onConfirm={() => void handleConfirmDeleteRoom()}
        onCancel={() => setDeletingRoom(null)}
      />
    </div>
  );
}
