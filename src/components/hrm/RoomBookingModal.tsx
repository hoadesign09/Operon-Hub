'use client';

import { useState, type FormEvent } from 'react';
import { IconAlertTriangle, IconBan, IconLoader2, IconUsers, IconX } from '@tabler/icons-react';
import type { MeetingRoomItem, RoomBookingItem } from '@/modules/hrm/office/meeting-rooms.service';

interface RoomBookingModalProps {
  rooms: MeetingRoomItem[];
  initialBooking?: RoomBookingItem | null;
  defaultRoomId?: number | null;
  defaultDate?: string; // YYYY-MM-DD
  defaultStartHour?: string; // HH:mm
  onClose: () => void;
  onSaved: () => void;
}

function toLocalDateTimeInput(isoOrLocal: string): string {
  const d = new Date(isoOrLocal);
  if (Number.isNaN(d.getTime())) {
    return '';
  }
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function buildDefaultStartEnd(dateStr?: string, startHour?: string): { start: string; end: string } {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const baseDate =
    dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)
      ? dateStr
      : `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

  if (startHour && /^\d{2}:\d{2}$/.test(startHour)) {
    const [h, m] = startHour.split(':').map(Number);
    const endH = Math.min(23, h + 1);
    return {
      start: `${baseDate}T${pad(h)}:${pad(m)}`,
      end: `${baseDate}T${pad(endH)}:${pad(m)}`,
    };
  }

  const nextHour = Math.min(18, Math.max(9, now.getHours() + 1));
  return {
    start: `${baseDate}T${pad(nextHour)}:00`,
    end: `${baseDate}T${pad(Math.min(20, nextHour + 1))}:00`,
  };
}

export function RoomBookingModal({
  rooms,
  initialBooking,
  defaultRoomId,
  defaultDate,
  defaultStartHour,
  onClose,
  onSaved,
}: RoomBookingModalProps) {
  const isEdit = Boolean(initialBooking);
  const canModify = !isEdit || Boolean(initialBooking?.canEditOrCancel);
  const activeRooms = rooms.filter((r) => r.isActive || r.id === initialBooking?.roomId);

  const defaults = buildDefaultStartEnd(defaultDate, defaultStartHour);

  const [roomId, setRoomId] = useState<string>(
    String(initialBooking?.roomId ?? defaultRoomId ?? activeRooms[0]?.id ?? ''),
  );
  const [title, setTitle] = useState(initialBooking?.title ?? '');
  const [startTime, setStartTime] = useState(
    initialBooking ? toLocalDateTimeInput(initialBooking.startTime) : defaults.start,
  );
  const [endTime, setEndTime] = useState(
    initialBooking ? toLocalDateTimeInput(initialBooking.endTime) : defaults.end,
  );
  const [attendeesCount, setAttendeesCount] = useState(
    String(initialBooking?.attendeesCount ?? 4),
  );
  const [note, setNote] = useState(initialBooking?.note ?? '');

  const [isCancelPanelOpen, setIsCancelPanelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [conflictDetails, setConflictDetails] = useState<string[]>([]);

  const selectedRoom = activeRooms.find((r) => r.id === Number(roomId)) ?? null;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canModify) {
      return;
    }

    setErrorMessage(null);
    setConflictDetails([]);

    const parsedRoomId = Number(roomId);
    const parsedAttendees = Number(attendeesCount);
    if (!Number.isInteger(parsedRoomId) || parsedRoomId <= 0) {
      setErrorMessage('Vui lòng chọn phòng họp.');
      return;
    }
    if (!startTime || !endTime || new Date(endTime).getTime() <= new Date(startTime).getTime()) {
      setErrorMessage('Thời gian kết thúc phải lớn hơn thời gian bắt đầu.');
      return;
    }
    if (selectedRoom && parsedAttendees > selectedRoom.capacity) {
      setErrorMessage(
        `Số người tham dự (${parsedAttendees}) vượt quá sức chứa tối đa của phòng (${selectedRoom.capacity} người).`,
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const url = isEdit
        ? `/api/v1/hrm/admin-ops/room-bookings/${initialBooking?.id}`
        : '/api/v1/hrm/admin-ops/room-bookings';
      const method = isEdit ? 'PATCH' : 'POST';

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
        setErrorMessage(json?.error?.message ?? 'Không thể lưu lịch đặt phòng họp.');
        const details = (json?.error?.details ?? [])
          .map((d) => d.message)
          .filter((m): m is string => Boolean(m));
        setConflictDetails(details);
        return;
      }

      onSaved();
    } catch {
      setErrorMessage('Lỗi kết nối máy chủ. Vui lòng thử lại.');
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
      setErrorMessage('Vui lòng nhập lý do hủy lịch tối thiểu 3 ký tự.');
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
        setErrorMessage(json?.error?.message ?? 'Không thể hủy lịch phòng họp.');
        return;
      }

      onSaved();
    } catch {
      setErrorMessage('Lỗi kết nối máy chủ. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {isEdit ? 'Chi tiết lịch đặt phòng họp' : 'Đặt lịch phòng họp'}
            </h2>
            {initialBooking && (
              <p className="text-xs text-slate-500">
                Người đặt: {initialBooking.bookedByEmployeeName} ({initialBooking.bookedByDepartmentName})
              </p>
            )}
          </div>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
            aria-label="Đóng"
          >
            <IconX size={18} />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4 p-6">
          {initialBooking?.status === 'CANCELLED' && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <div className="font-semibold text-rose-700">Lịch họp đã bị hủy</div>
              {initialBooking.cancelReason && (
                <div className="mt-1 text-xs">Lý do: {initialBooking.cancelReason}</div>
              )}
              {initialBooking.cancelledByName && (
                <div className="mt-0.5 text-xs text-slate-500">
                  Người hủy: {initialBooking.cancelledByName}
                </div>
              )}
            </div>
          )}

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

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              Phòng họp <span className="text-rose-500">*</span>
            </label>
            <select
              value={roomId}
              disabled={!canModify || isSubmitting}
              onChange={(e) => setRoomId(e.target.value)}
              required
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 disabled:bg-slate-50"
            >
              {activeRooms.map((r) => (
                <option key={r.id} value={r.id}>
                  [{r.code}] {r.name} — {r.capacity} chỗ {r.floor ? `(${r.floor})` : ''}
                </option>
              ))}
            </select>
            {selectedRoom && (
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
                  <IconUsers size={13} />
                  Tối đa {selectedRoom.capacity} người
                </span>
                {selectedRoom.equipment.slice(0, 4).map((eq) => (
                  <span key={eq} className="rounded-md bg-blue-50 px-2 py-0.5 text-blue-700">
                    {eq}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              Tiêu đề cuộc họp <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              disabled={!canModify || isSubmitting}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="VD: Giao ban tuần Phòng Công nghệ"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 disabled:bg-slate-50"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Bắt đầu <span className="text-rose-500">*</span>
              </label>
              <input
                type="datetime-local"
                value={startTime}
                disabled={!canModify || isSubmitting}
                onChange={(e) => setStartTime(e.target.value)}
                required
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 disabled:bg-slate-50"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Kết thúc <span className="text-rose-500">*</span>
              </label>
              <input
                type="datetime-local"
                value={endTime}
                disabled={!canModify || isSubmitting}
                onChange={(e) => setEndTime(e.target.value)}
                required
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 disabled:bg-slate-50"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              Số người tham dự <span className="text-rose-500">*</span>
            </label>
            <input
              type="number"
              min={1}
              max={selectedRoom?.capacity ?? 500}
              value={attendeesCount}
              disabled={!canModify || isSubmitting}
              onChange={(e) => setAttendeesCount(e.target.value)}
              required
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 disabled:bg-slate-50"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              Ghi chú / Yêu cầu chuẩn bị
            </label>
            <textarea
              rows={3}
              value={note}
              disabled={!canModify || isSubmitting}
              onChange={(e) => setNote(e.target.value)}
              placeholder="VD: Chuẩn bị trà nước, cáp HDMI, kết nối họp trực tuyến..."
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 disabled:bg-slate-50"
            />
          </div>

          {isEdit && canModify && isCancelPanelOpen && (
            <div className="space-y-3 rounded-xl border border-rose-200 bg-rose-50 p-4">
              <label className="block text-xs font-semibold text-rose-800">
                Lý do hủy lịch phòng họp <span className="text-rose-600">*</span>
              </label>
              <textarea
                rows={2}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="VD: Dời lịch họp sang tuần sau do đối tác thay đổi kế hoạch"
                className="w-full rounded-xl border border-rose-300 bg-white px-3 py-2 text-sm outline-none focus:border-rose-500"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setIsCancelPanelOpen(false)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => void handleConfirmCancel()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-700 disabled:opacity-60"
                >
                  {isSubmitting && <IconLoader2 size={14} className="animate-spin" />}
                  <span>Xác nhận hủy lịch</span>
                </button>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-4">
            <div>
              {isEdit && canModify && !isCancelPanelOpen && (
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setIsCancelPanelOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 px-3.5 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50"
                >
                  <IconBan size={16} />
                  <span>Hủy lịch họp</span>
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
                {canModify ? 'Đóng' : 'Đóng cửa sổ'}
              </button>
              {canModify && (
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {isSubmitting && <IconLoader2 size={16} className="animate-spin" />}
                  <span>{isEdit ? 'Cập nhật lịch' : 'Xác nhận đặt phòng'}</span>
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
