'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  IconAlertTriangle,
  IconArrowLeft,
  IconBan,
  IconBuilding,
  IconCalendarEvent,
  IconCheck,
  IconClock,
  IconDoor,
  IconEdit,
  IconLoader2,
  IconNotes,
  IconUser,
  IconUsers,
  IconX,
} from '@tabler/icons-react';
import type { RoomBookingStatus } from '@/config/database';
import { formatDateTimeVN } from '@/lib/portable/date-utils';
import type { MeetingRoomItem, RoomBookingItem } from '@/modules/hrm/office/meeting-rooms.service';
import { useI18n } from '@/shared/i18n/I18nContext';

interface RoomBookingModalProps {
  rooms: MeetingRoomItem[];
  branchId?: number | null;
  initialBooking?: RoomBookingItem | null;
  defaultRoomId?: number | null;
  defaultDate?: string; // YYYY-MM-DD
  defaultStartHour?: string; // HH:mm
  onClose: () => void;
  onSaved: () => void;
}

type ModalMode = 'create' | 'view' | 'edit';

interface AvailabilityState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  availableRooms: MeetingRoomItem[];
  totalActiveRooms: number;
  busyRoomsCount: number;
  errorText: string | null;
  checkedKey: string;
}

const STATUS_META: Record<
  RoomBookingStatus,
  { vi: string; en: string; badgeCls: string; dotCls: string }
> = {
  PENDING: {
    vi: 'Chờ diễn ra',
    en: 'Pending',
    badgeCls: 'border-amber-200 bg-amber-50 text-amber-700',
    dotCls: 'bg-amber-500',
  },
  IN_PROGRESS: {
    vi: 'Đang diễn ra',
    en: 'In-progress',
    badgeCls: 'border-blue-200 bg-blue-50 text-blue-700',
    dotCls: 'bg-blue-500 animate-pulse',
  },
  DONE: {
    vi: 'Hoàn thành',
    en: 'Done',
    badgeCls: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    dotCls: 'bg-emerald-500',
  },
  CANCELLED: {
    vi: 'Đã hủy',
    en: 'Cancelled',
    badgeCls: 'border-rose-200 bg-rose-50 text-rose-700',
    dotCls: 'bg-rose-500',
  },
};

function toLocalDateTimeInput(isoOrDate: string | Date): string {
  const d = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
  if (Number.isNaN(d.getTime())) {
    return '';
  }
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function buildDefaultStartEnd(
  now: Date,
  dateStr?: string,
  startHour?: string,
): { start: string; end: string } {
  const pad = (n: number) => String(n).padStart(2, '0');
  const todayIso = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

  const requestedDate = dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? dateStr : todayIso;
  const baseDate = requestedDate < todayIso ? todayIso : requestedDate;

  let startDate: Date;
  if (startHour && /^\d{2}:\d{2}$/.test(startHour)) {
    const [h, m] = startHour.split(':').map(Number);
    const [y, mo, d] = baseDate.split('-').map(Number);
    startDate = new Date(y, mo - 1, d, h, m, 0, 0);
  } else {
    const [y, mo, d] = baseDate.split('-').map(Number);
    const defaultHour = baseDate === todayIso ? Math.min(22, now.getHours() + 1) : 9;
    startDate = new Date(y, mo - 1, d, defaultHour, 0, 0, 0);
  }

  // Ensure default start time is never in the past
  if (startDate.getTime() <= now.getTime()) {
    const nextQuarter = new Date(now.getTime() + 15 * 60 * 1000);
    nextQuarter.setSeconds(0, 0);
    startDate = nextQuarter;
  }

  const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
  return {
    start: toLocalDateTimeInput(startDate),
    end: toLocalDateTimeInput(endDate),
  };
}

function formatDurationLabel(
  startIso: string,
  endIso: string,
  tr: (vi: string, en: string) => string,
): string {
  const startMs = new Date(startIso).getTime();
  const endMs = new Date(endIso).getTime();
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) {
    return '';
  }
  const totalMinutes = Math.round((endMs - startMs) / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (hours > 0 && mins > 0) {
    return tr(`${hours} giờ ${mins} phút`, `${hours}h ${mins}m`);
  }
  if (hours > 0) {
    return tr(`${hours} giờ`, `${hours}h`);
  }
  return tr(`${mins} phút`, `${mins}m`);
}

function getClientTimeRangeError(
  startTime: string,
  endTime: string,
  minDateTime: string,
  tr: (vi: string, en: string) => string,
): string | null {
  if (!startTime || !endTime) {
    return tr(
      'Vui lòng chọn đầy đủ thời gian bắt đầu và kết thúc để kiểm tra phòng trống.',
      'Please select both start and end time to check available rooms.',
    );
  }
  const startMs = new Date(startTime).getTime();
  const endMs = new Date(endTime).getTime();
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
    return tr('Thời gian bắt đầu hoặc kết thúc không hợp lệ.', 'Invalid start or end time.');
  }
  if (startTime < minDateTime) {
    return tr(
      'Không thể đặt phòng họp trong quá khứ. Vui lòng chọn thời gian bắt đầu từ hiện tại trở đi.',
      'Cannot book a meeting room in the past. Start time must be now or in the future.',
    );
  }
  if (endMs <= startMs) {
    return tr(
      'Thời gian kết thúc phải lớn hơn thời gian bắt đầu.',
      'End time must be later than start time.',
    );
  }
  const durationMinutes = Math.round((endMs - startMs) / 60000);
  if (durationMinutes < 15) {
    return tr(
      'Thời lượng đặt phòng tối thiểu là 15 phút.',
      'Minimum booking duration is 15 minutes.',
    );
  }
  if (durationMinutes > 720) {
    return tr(
      'Thời lượng đặt phòng tối đa là 12 giờ cho mỗi lượt đặt.',
      'Maximum booking duration is 12 hours per booking.',
    );
  }
  return null;
}

export function RoomBookingModal({
  rooms,
  branchId,
  initialBooking,
  defaultRoomId,
  defaultDate,
  defaultStartHour,
  onClose,
  onSaved,
}: RoomBookingModalProps) {
  const { locale, tr, ln } = useI18n();
  const trRef = useRef(tr);
  useEffect(() => {
    trRef.current = tr;
  }, [tr]);

  const [initialClock] = useState(() => {
    const now = new Date();
    return {
      minDateTime: toLocalDateTimeInput(now),
      defaults: buildDefaultStartEnd(now, defaultDate, defaultStartHour),
    };
  });

  const [mode, setMode] = useState<ModalMode>(initialBooking ? 'view' : 'create');

  const [title, setTitle] = useState(initialBooking?.title ?? '');
  const [startTime, setStartTime] = useState(
    initialBooking ? toLocalDateTimeInput(initialBooking.startTime) : initialClock.defaults.start,
  );
  const [endTime, setEndTime] = useState(
    initialBooking ? toLocalDateTimeInput(initialBooking.endTime) : initialClock.defaults.end,
  );
  const [roomId, setRoomId] = useState<string>(
    String(initialBooking?.roomId ?? defaultRoomId ?? ''),
  );
  const [attendeesCount, setAttendeesCount] = useState(
    String(initialBooking?.attendeesCount ?? 4),
  );
  const [note, setNote] = useState(initialBooking?.note ?? '');

  const [availability, setAvailability] = useState<AvailabilityState>({
    status: 'idle',
    availableRooms: [],
    totalActiveRooms: rooms.filter((r) => r.isActive).length,
    busyRoomsCount: 0,
    errorText: null,
    checkedKey: '',
  });

  const [isCancelPanelOpen, setIsCancelPanelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [conflictDetails, setConflictDetails] = useState<string[]>([]);

  const isFormMode = mode === 'create' || mode === 'edit';
  const clientTimeError = isFormMode
    ? getClientTimeRangeError(startTime, endTime, initialClock.minDateTime, tr)
    : null;

  const targetAvailabilityKey = isFormMode && !clientTimeError
    ? `${startTime}|${endTime}|${branchId ?? ''}|${mode === 'edit' ? (initialBooking?.id ?? '') : ''}`
    : '';

  // Live validate room availability whenever user selects/changes date & time
  useEffect(() => {
    if (!targetAvailabilityKey) {
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => {
      void (async () => {
        setAvailability((prev) => ({
          ...prev,
          status: 'loading',
          errorText: null,
        }));

        try {
          const params = new URLSearchParams({
            startTime,
            endTime,
          });
          if (branchId) {
            params.set('branchId', String(branchId));
          }
          if (mode === 'edit' && initialBooking?.id) {
            params.set('excludeBookingId', String(initialBooking.id));
          }

          const res = await fetch(`/api/v1/hrm/admin-ops/meeting-rooms/available?${params.toString()}`, {
            signal: controller.signal,
          });
          const json = (await res.json().catch(() => null)) as {
            success?: boolean;
            data?: {
              availableRooms: MeetingRoomItem[];
              totalActiveRooms: number;
              busyRoomsCount: number;
            };
            error?: { message?: string };
          } | null;

          if (controller.signal.aborted) {
            return;
          }

          if (!res.ok || !json?.success || !json.data) {
            setAvailability({
              status: 'error',
              availableRooms: [],
              totalActiveRooms: 0,
              busyRoomsCount: 0,
              errorText:
                json?.error?.message ??
                trRef.current(
                  'Không thể kiểm tra phòng họp trống.',
                  'Unable to check available meeting rooms.',
                ),
              checkedKey: targetAvailabilityKey,
            });
            return;
          }

          const nextRooms = json.data.availableRooms;
          setAvailability({
            status: 'ready',
            availableRooms: nextRooms,
            totalActiveRooms: json.data.totalActiveRooms,
            busyRoomsCount: json.data.busyRoomsCount,
            errorText: null,
            checkedKey: targetAvailabilityKey,
          });

          setRoomId((prevRoomId) => {
            if (prevRoomId && nextRooms.some((r) => String(r.id) === prevRoomId)) {
              return prevRoomId;
            }
            return nextRooms[0] ? String(nextRooms[0].id) : '';
          });
        } catch (err: unknown) {
          if (err instanceof DOMException && err.name === 'AbortError') {
            return;
          }
          setAvailability({
            status: 'error',
            availableRooms: [],
            totalActiveRooms: 0,
            busyRoomsCount: 0,
            errorText: trRef.current(
              'Lỗi kết nối khi kiểm tra phòng trống.',
              'Connection error while checking room availability.',
            ),
            checkedKey: targetAvailabilityKey,
          });
        }
      })();
    }, 180);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [branchId, endTime, initialBooking?.id, mode, startTime, targetAvailabilityKey]);

  const isCheckingAvailability =
    isFormMode &&
    !clientTimeError &&
    (availability.status === 'loading' || availability.checkedKey !== targetAvailabilityKey);

  const availableRooms =
    availability.status === 'ready' && availability.checkedKey === targetAvailabilityKey
      ? availability.availableRooms
      : [];

  const effectiveRoomId = availableRooms.some((r) => String(r.id) === roomId)
    ? roomId
    : availableRooms[0]
      ? String(availableRooms[0].id)
      : '';

  const selectedRoom = availableRooms.find((r) => String(r.id) === effectiveRoomId) ?? null;
  const bookingRoom = initialBooking
    ? (rooms.find((r) => r.id === initialBooking.roomId) ?? null)
    : null;
  const statusMeta = initialBooking ? STATUS_META[initialBooking.status] : null;

  function resetFormToInitial() {
    if (!initialBooking) {
      return;
    }
    setRoomId(String(initialBooking.roomId));
    setTitle(initialBooking.title);
    setStartTime(toLocalDateTimeInput(initialBooking.startTime));
    setEndTime(toLocalDateTimeInput(initialBooking.endTime));
    setAttendeesCount(String(initialBooking.attendeesCount));
    setNote(initialBooking.note ?? '');
    setErrorMessage(null);
    setConflictDetails([]);
  }

  function handleEnterEditMode() {
    resetFormToInitial();
    setIsCancelPanelOpen(false);
    setMode('edit');
  }

  function handleBackToView() {
    resetFormToInitial();
    setMode('view');
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (mode === 'view') {
      return;
    }

    setErrorMessage(null);
    setConflictDetails([]);

    const parsedRoomId = Number(effectiveRoomId);
    const parsedAttendees = Number(attendeesCount);
    const startMs = new Date(startTime).getTime();
    const endMs = new Date(endTime).getTime();

    if (!title.trim() || title.trim().length < 3) {
      setErrorMessage(
        tr(
          'Vui lòng nhập tên cuộc họp tối thiểu 3 ký tự.',
          'Please enter a meeting title of at least 3 characters.',
        ),
      );
      return;
    }
    if (!startTime || Number.isNaN(startMs) || !endTime || Number.isNaN(endMs)) {
      setErrorMessage(
        tr('Thời gian bắt đầu hoặc kết thúc không hợp lệ.', 'Invalid start or end time.'),
      );
      return;
    }
    if (startMs < Date.now()) {
      setErrorMessage(
        tr(
          'Không thể đặt phòng họp trong quá khứ. Vui lòng chọn thời gian bắt đầu từ hiện tại trở đi.',
          'Cannot book a meeting room in the past. Start time must be now or in the future.',
        ),
      );
      return;
    }
    if (endMs <= startMs) {
      setErrorMessage(
        tr(
          'Thời gian kết thúc phải lớn hơn thời gian bắt đầu.',
          'End time must be later than start time.',
        ),
      );
      return;
    }
    if (!Number.isInteger(parsedRoomId) || parsedRoomId <= 0) {
      setErrorMessage(
        tr(
          'Không có phòng họp trống trong khung giờ này. Vui lòng chọn khung giờ khác.',
          'No available meeting room for this time slot. Please choose another time.',
        ),
      );
      return;
    }
    if (selectedRoom && parsedAttendees > selectedRoom.capacity) {
      setErrorMessage(
        tr(
          `Số người tham dự (${parsedAttendees}) vượt quá sức chứa tối đa của phòng (${selectedRoom.capacity} người).`,
          `Number of attendees (${parsedAttendees}) exceeds the room's maximum capacity (${selectedRoom.capacity} people).`,
        ),
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const isUpdating = mode === 'edit' && Boolean(initialBooking);
      const url = isUpdating
        ? `/api/v1/hrm/admin-ops/room-bookings/${initialBooking?.id}`
        : '/api/v1/hrm/admin-ops/room-bookings';
      const method = isUpdating ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: parsedRoomId,
          title: title.trim(),
          startTime,
          endTime,
          attendeesCount: parsedAttendees,
          note: note.trim() || null,
        }),
      });

      const json = (await res.json().catch(() => null)) as {
        success?: boolean;
        error?: { message?: string; details?: Array<{ message?: string }> };
      } | null;

      if (!res.ok || !json?.success) {
        setErrorMessage(
          json?.error?.message ??
            tr('Không thể lưu lịch đặt phòng họp.', 'Unable to save meeting room booking.'),
        );
        const details = (json?.error?.details ?? [])
          .map((d) => d.message)
          .filter((m): m is string => Boolean(m));
        setConflictDetails(details);
        return;
      }

      onSaved();
    } catch {
      setErrorMessage(
        tr('Lỗi kết nối máy chủ. Vui lòng thử lại.', 'Server connection error. Please try again.'),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleConfirmCancel() {
    if (!initialBooking) {
      return;
    }
    setErrorMessage(null);
    if (cancelReason.trim().length < 3) {
      setErrorMessage(
        tr(
          'Vui lòng nhập lý do hủy lịch tối thiểu 3 ký tự.',
          'Please enter a cancellation reason of at least 3 characters.',
        ),
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/v1/hrm/admin-ops/room-bookings/${initialBooking.id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cancelReason: cancelReason.trim() }),
      });
      const json = (await res.json().catch(() => null)) as {
        success?: boolean;
        error?: { message?: string };
      } | null;

      if (!res.ok || !json?.success) {
        setErrorMessage(
          json?.error?.message ??
            tr('Không thể hủy lịch phòng họp.', 'Unable to cancel meeting room booking.'),
        );
        return;
      }

      onSaved();
    } catch {
      setErrorMessage(
        tr('Lỗi kết nối máy chủ. Vui lòng thử lại.', 'Server connection error. Please try again.'),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const canSubmitForm =
    !isSubmitting &&
    !clientTimeError &&
    !isCheckingAvailability &&
    availability.status === 'ready' &&
    availableRooms.length > 0 &&
    Boolean(effectiveRoomId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-xl">
        {/* Modal Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-6 py-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-slate-900">
                {mode === 'create'
                  ? tr('Đặt lịch phòng họp', 'Book a Meeting Room')
                  : mode === 'edit'
                    ? tr('Chỉnh sửa lịch đặt phòng họp', 'Edit Room Booking')
                    : tr('Chi tiết lịch đặt phòng họp', 'Room Booking Details')}
              </h2>
              {initialBooking && statusMeta && (
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusMeta.badgeCls}`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${statusMeta.dotCls}`} />
                  {locale === 'en' ? statusMeta.en : statusMeta.vi}
                </span>
              )}
            </div>
            {initialBooking && (
              <p className="mt-0.5 text-xs text-slate-500">
                {tr('Người đặt:', 'Booked by:')} {initialBooking.bookedByEmployeeName} (
                {ln(
                  initialBooking.bookedByDepartmentName,
                  initialBooking.bookedByDepartmentNameEn,
                )}
                )
              </p>
            )}
          </div>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
            aria-label={tr('Đóng', 'Close')}
          >
            <IconX size={18} />
          </button>
        </div>

        {/* VIEW MODE — Default read-only inspection when clicking any booking */}
        {mode === 'view' && initialBooking ? (
          <div className="space-y-5 p-6">
            {errorMessage && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                <div className="flex items-start gap-2 font-medium">
                  <IconAlertTriangle size={18} className="mt-0.5 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              </div>
            )}

            {/* Meeting Title */}
            <div>
              <div className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
                {tr('Cuộc họp', 'Meeting')}
              </div>
              <h3 className="mt-1 text-base font-bold text-slate-900">{initialBooking.title}</h3>
            </div>

            {/* Structured Detail Grid */}
            <div className="grid grid-cols-1 gap-3.5 rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-sm sm:grid-cols-2">
              <div className="flex items-start gap-2.5">
                <IconDoor size={17} className="mt-0.5 shrink-0 text-blue-600" />
                <div className="min-w-0">
                  <div className="text-[11px] font-medium text-slate-500">
                    {tr('Phòng họp', 'Meeting Room')}
                  </div>
                  <div className="font-semibold text-slate-900">
                    [{initialBooking.roomCode}] {ln(initialBooking.roomName, initialBooking.roomNameEn)}
                  </div>
                  <div className="text-xs text-slate-500">
                    {initialBooking.roomFloor ? `${initialBooking.roomFloor} • ` : ''}
                    {tr(
                      `Sức chứa ${initialBooking.roomCapacity} chỗ`,
                      `Capacity ${initialBooking.roomCapacity} seats`,
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <IconBuilding size={17} className="mt-0.5 shrink-0 text-slate-500" />
                <div className="min-w-0">
                  <div className="text-[11px] font-medium text-slate-500">
                    {tr('Chi nhánh', 'Branch')}
                  </div>
                  <div className="font-semibold text-slate-900">
                    {ln(initialBooking.branchName, initialBooking.branchNameEn)} (
                    {initialBooking.branchCode})
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2.5 sm:col-span-2">
                <IconClock size={17} className="mt-0.5 shrink-0 text-emerald-600" />
                <div className="min-w-0">
                  <div className="text-[11px] font-medium text-slate-500">
                    {tr('Khung giờ', 'Time Slot')}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 font-semibold text-slate-900 tabular-nums">
                    <span>
                      {formatDateTimeVN(initialBooking.startTime)} →{' '}
                      {formatDateTimeVN(initialBooking.endTime)}
                    </span>
                    <span className="rounded-md bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
                      {formatDurationLabel(initialBooking.startTime, initialBooking.endTime, tr)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <IconUsers size={17} className="mt-0.5 shrink-0 text-indigo-600" />
                <div>
                  <div className="text-[11px] font-medium text-slate-500">
                    {tr('Số người tham dự', 'Attendees')}
                  </div>
                  <div className="font-semibold text-slate-900">
                    {initialBooking.attendeesCount} {tr('người', 'people')}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <IconUser size={17} className="mt-0.5 shrink-0 text-slate-500" />
                <div className="min-w-0">
                  <div className="text-[11px] font-medium text-slate-500">
                    {tr('Người đặt lịch', 'Booked By')}
                  </div>
                  <div className="font-semibold text-slate-900">
                    {initialBooking.bookedByEmployeeName} ({initialBooking.bookedByEmployeeCode})
                  </div>
                  <div className="text-xs text-slate-500">
                    {ln(
                      initialBooking.bookedByDepartmentName,
                      initialBooking.bookedByDepartmentNameEn,
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2.5 sm:col-span-2">
                <IconCalendarEvent size={17} className="mt-0.5 shrink-0 text-slate-400" />
                <div>
                  <div className="text-[11px] font-medium text-slate-500">
                    {tr('Thời điểm tạo', 'Created At')}
                  </div>
                  <div className="text-xs font-medium text-slate-700">
                    {formatDateTimeVN(initialBooking.createdAt)}
                  </div>
                </div>
              </div>
            </div>

            {/* Room Equipment */}
            {bookingRoom && bookingRoom.equipment.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-medium text-slate-500">
                  {tr('Thiết bị phòng:', 'Room equipment:')}
                </span>
                {bookingRoom.equipment.map((eq) => (
                  <span
                    key={eq}
                    className="rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700"
                  >
                    {eq}
                  </span>
                ))}
              </div>
            )}

            {/* Notes */}
            <div className="rounded-xl border border-slate-200 bg-white p-3.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                <IconNotes size={15} className="text-slate-400" />
                <span>{tr('Ghi chú / Yêu cầu chuẩn bị', 'Notes / Setup Requirements')}</span>
              </div>
              <p className="mt-1.5 whitespace-pre-line text-sm text-slate-600">
                {initialBooking.note
                  ? initialBooking.note
                  : tr('Không có ghi chú thêm.', 'No additional notes.')}
              </p>
            </div>

            {/* Status-specific info callouts */}
            {initialBooking.status === 'CANCELLED' && (
              <div className="rounded-xl border border-rose-200 bg-rose-50/70 px-4 py-3 text-sm text-rose-800">
                <div className="font-semibold">
                  {tr(
                    'Lịch họp đã bị hủy (Dữ liệu được lưu trữ vĩnh viễn)',
                    'Booking Cancelled (Archived Record)',
                  )}
                </div>
                {initialBooking.cancelReason && (
                  <div className="mt-1 text-xs">
                    {tr('Lý do hủy:', 'Reason:')} {initialBooking.cancelReason}
                  </div>
                )}
                {initialBooking.cancelledByName && (
                  <div className="mt-0.5 text-xs text-rose-700/80">
                    {tr('Người hủy:', 'Cancelled by:')} {initialBooking.cancelledByName}
                    {initialBooking.cancelledAt
                      ? ` • ${formatDateTimeVN(initialBooking.cancelledAt)}`
                      : ''}
                  </div>
                )}
              </div>
            )}

            {initialBooking.status === 'IN_PROGRESS' && (
              <div className="rounded-xl border border-blue-200 bg-blue-50/70 px-4 py-2.5 text-xs text-blue-800">
                {tr(
                  'Cuộc họp đang diễn ra nên không thể thay đổi khung giờ. Người có quyền vẫn có thể Hủy lịch nếu cần.',
                  'This meeting is currently in-progress and cannot be rescheduled. Authorized users may still cancel it if needed.',
                )}
              </div>
            )}

            {initialBooking.status === 'DONE' && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-2.5 text-xs text-emerald-800">
                {tr(
                  'Cuộc họp đã hoàn thành. Lịch sử đặt phòng được lưu trữ cố định (chỉ xem).',
                  'This meeting has completed. Booking records are permanently retained in read-only mode.',
                )}
              </div>
            )}

            {/* Inline Cancel Panel (opens only when user clicks Cancel Booking) */}
            {initialBooking.canCancel && isCancelPanelOpen && (
              <div className="space-y-3 rounded-xl border border-rose-200 bg-rose-50 p-4">
                <label className="block text-xs font-semibold text-rose-800">
                  {tr('Lý do hủy lịch phòng họp', 'Reason for cancelling booking')}{' '}
                  <span className="text-rose-600">*</span>
                </label>
                <textarea
                  rows={2}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder={tr(
                    'VD: Dời lịch họp sang tuần sau do đối tác thay đổi kế hoạch',
                    'e.g. Rescheduled to next week due to partner availability',
                  )}
                  className="w-full rounded-xl border border-rose-300 bg-white px-3 py-2 text-sm outline-none focus:border-rose-500"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => {
                      setIsCancelPanelOpen(false);
                      setErrorMessage(null);
                    }}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    {tr('Quay lại', 'Back')}
                  </button>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => void handleConfirmCancel()}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-700 disabled:opacity-60"
                  >
                    {isSubmitting && <IconLoader2 size={14} className="animate-spin" />}
                    <span>{tr('Xác nhận hủy lịch', 'Confirm Cancellation')}</span>
                  </button>
                </div>
              </div>
            )}

            {/* View Mode Footer: Explicit Edit / Cancel Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-4">
              <div>
                {initialBooking.canCancel && !isCancelPanelOpen && (
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => {
                      setErrorMessage(null);
                      setIsCancelPanelOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 px-3.5 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50"
                  >
                    <IconBan size={16} />
                    <span>{tr('Hủy lịch', 'Cancel Booking')}</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={onClose}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  {tr('Đóng', 'Close')}
                </button>
                {initialBooking.canEdit && !isCancelPanelOpen && (
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={handleEnterEditMode}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                  >
                    <IconEdit size={16} />
                    <span>{tr('Chỉnh sửa', 'Edit')}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* CREATE / EDIT FORM MODE: Strictly ordered Title -> Time -> Available Meeting Room -> Attendees -> Notes */
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4 p-6">
            {errorMessage && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                <div className="flex items-start gap-2 font-medium">
                  <IconAlertTriangle size={18} className="mt-0.5 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
                {conflictDetails.length > 0 && (
                  <ul className="mt-2 list-disc space-y-1 pl-7 text-xs text-rose-700">
                    {conflictDetails.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* 1. Tên cuộc họp (Title) */}
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                {tr('1. Tên cuộc họp', '1. Meeting title')} <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                disabled={isSubmitting}
                onChange={(e) => setTitle(e.target.value)}
                required
                placeholder={tr(
                  'VD: Giao ban tuần Phòng Công nghệ',
                  'e.g. Engineering Weekly Sync',
                )}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 disabled:bg-slate-50"
              />
            </div>

            {/* 2. Thời gian (Date & Time) */}
            <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
              <div className="text-xs font-semibold text-slate-700">
                {tr('2. Thời gian cuộc họp', '2. Date & Time')}{' '}
                <span className="text-rose-500">*</span>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-slate-600">
                    {tr('Bắt đầu', 'Start')}
                  </label>
                  <input
                    type="datetime-local"
                    min={initialClock.minDateTime}
                    value={startTime}
                    disabled={isSubmitting}
                    onChange={(e) => setStartTime(e.target.value)}
                    required
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 disabled:bg-slate-100"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-medium text-slate-600">
                    {tr('Kết thúc', 'End')}
                  </label>
                  <input
                    type="datetime-local"
                    min={startTime || initialClock.minDateTime}
                    value={endTime}
                    disabled={isSubmitting}
                    onChange={(e) => setEndTime(e.target.value)}
                    required
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 disabled:bg-slate-100"
                  />
                </div>
              </div>

              {clientTimeError ? (
                <p className="flex items-center gap-1.5 text-xs font-medium text-rose-600">
                  <IconAlertTriangle size={14} className="shrink-0" />
                  <span>{clientTimeError}</span>
                </p>
              ) : (
                <p className="text-[11px] text-slate-500">
                  {tr(
                    'Hệ thống tự động lọc các phòng họp còn trống theo khung giờ bạn chọn (15 phút – 12 giờ).',
                    'Available meeting rooms are automatically filtered for your selected time slot (15 min – 12 hours).',
                  )}
                </p>
              )}
            </div>

            {/* 3. Phòng họp khả dụng (ONLY available rooms shown!) */}
            <div>
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <label className="text-xs font-semibold text-slate-700">
                  {tr('3. Phòng họp còn trống', '3. Available meeting room')}{' '}
                  <span className="text-rose-500">*</span>
                </label>

                {!clientTimeError && isCheckingAvailability && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600">
                    <IconLoader2 size={13} className="animate-spin" />
                    <span>{tr('Đang kiểm tra phòng trống...', 'Checking availability...')}</span>
                  </span>
                )}

                {!clientTimeError &&
                  !isCheckingAvailability &&
                  availability.status === 'ready' && (
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        availableRooms.length > 0
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {availableRooms.length > 0 && <IconCheck size={12} />}
                      <span>
                        {tr(
                          `Còn trống ${availableRooms.length}/${availability.totalActiveRooms} phòng`,
                          `${availableRooms.length}/${availability.totalActiveRooms} rooms available`,
                        )}
                      </span>
                    </span>
                  )}
              </div>

              {clientTimeError ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-500">
                  {tr(
                    'Vui lòng chọn ngày và giờ hợp lệ trước để hiển thị danh sách phòng họp còn trống.',
                    'Please select a valid date and time first to view available meeting rooms.',
                  )}
                </div>
              ) : isCheckingAvailability ? (
                <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-500">
                  <IconLoader2 size={15} className="animate-spin text-blue-600" />
                  <span>
                    {tr(
                      'Đang xác thực danh sách phòng họp khả dụng...',
                      'Validating available meeting rooms...',
                    )}
                  </span>
                </div>
              ) : availability.status === 'error' ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-700">
                  {availability.errorText}
                </div>
              ) : availableRooms.length === 0 ? (
                <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs font-medium text-amber-800">
                  <IconAlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600" />
                  <span>
                    {availability.totalActiveRooms === 0
                      ? tr(
                          'Chưa có phòng họp nào đang hoạt động trong phạm vi chi nhánh này.',
                          'No active meeting rooms exist in this branch scope.',
                        )
                      : tr(
                          'Tất cả phòng họp đều đã có lịch trong khung giờ này. Vui lòng chọn ngày hoặc khung giờ khác.',
                          'All meeting rooms are already booked for this time slot. Please pick another date or time.',
                        )}
                  </span>
                </div>
              ) : (
                <>
                  <select
                    value={effectiveRoomId}
                    disabled={isSubmitting}
                    onChange={(e) => setRoomId(e.target.value)}
                    required
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 disabled:bg-slate-50"
                  >
                    {availableRooms.map((r) => (
                      <option key={r.id} value={r.id}>
                        [{r.code}] {ln(r.name, r.nameEn)} — {r.capacity} {tr('chỗ', 'seats')}{' '}
                        {r.floor ? `(${r.floor})` : ''}
                      </option>
                    ))}
                  </select>
                  {selectedRoom && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
                        <IconUsers size={13} />
                        {tr(
                          `Tối đa ${selectedRoom.capacity} người`,
                          `Max ${selectedRoom.capacity} people`,
                        )}
                      </span>
                      {selectedRoom.equipment.slice(0, 4).map((eq) => (
                        <span key={eq} className="rounded-md bg-blue-50 px-2 py-0.5 text-blue-700">
                          {eq}
                        </span>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* 4. Số người tham dự */}
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                {tr('4. Số người tham dự', '4. Attendees')} <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min={1}
                max={selectedRoom?.capacity ?? 500}
                value={attendeesCount}
                disabled={isSubmitting}
                onChange={(e) => setAttendeesCount(e.target.value)}
                required
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 disabled:bg-slate-50"
              />
            </div>

            {/* 5. Ghi chú */}
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                {tr('5. Ghi chú / Yêu cầu chuẩn bị', '5. Notes / Setup requirements')}
              </label>
              <textarea
                rows={3}
                value={note}
                disabled={isSubmitting}
                onChange={(e) => setNote(e.target.value)}
                placeholder={tr(
                  'VD: Chuẩn bị trà nước, cáp HDMI, kết nối họp trực tuyến...',
                  'e.g. Prepare refreshments, HDMI cable, video conference setup...',
                )}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 disabled:bg-slate-50"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-4">
              <div>
                {mode === 'edit' && initialBooking && (
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={handleBackToView}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <IconArrowLeft size={16} />
                    <span>{tr('Quay lại xem', 'Back to View')}</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={onClose}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  {tr('Đóng', 'Close')}
                </button>
                <button
                  type="submit"
                  disabled={!canSubmitForm}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {isSubmitting && <IconLoader2 size={16} className="animate-spin" />}
                  <span>
                    {mode === 'edit'
                      ? tr('Lưu thay đổi', 'Save Changes')
                      : tr('Xác nhận đặt phòng', 'Confirm Booking')}
                  </span>
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
