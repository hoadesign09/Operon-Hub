'use client';

import { useState } from 'react';
import {
  IconCalendarPlus,
  IconChevronRight,
  IconClock,
  IconDoor,
  IconUser,
  IconUsers,
  IconX,
} from '@tabler/icons-react';
import type { RoomBookingStatus } from '@/config/database';
import { formatDateVN } from '@/lib/portable/date-utils';
import type { RoomBookingItem } from '@/modules/hrm/office/meeting-rooms.service';
import { useI18n } from '@/shared/i18n/I18nContext';

interface DayBookingsModalProps {
  dateIso: string; // YYYY-MM-DD
  weekdayLabel: string;
  bookings: RoomBookingItem[];
  canBook: boolean;
  isPastDay: boolean;
  onSelectBooking: (booking: RoomBookingItem) => void;
  onBookOnDay: () => void;
  onOpenDayTimeline: () => void;
  onClose: () => void;
}

type FilterValue = 'ALL' | RoomBookingStatus;

const STATUS_META: Record<
  RoomBookingStatus,
  {
    vi: string;
    en: string;
    badgeCls: string;
    dotCls: string;
    cardCls: string;
    accentCls: string;
    titleCls: string;
  }
> = {
  PENDING: {
    vi: 'Chờ diễn ra',
    en: 'Pending',
    badgeCls: 'border-amber-200 bg-amber-50 text-amber-700',
    dotCls: 'bg-amber-500',
    cardCls: 'border-amber-200/80 bg-white hover:border-amber-400 hover:bg-amber-50/40',
    accentCls: 'border-l-amber-500',
    titleCls: 'text-slate-900',
  },
  IN_PROGRESS: {
    vi: 'Đang diễn ra',
    en: 'In-progress',
    badgeCls: 'border-blue-200 bg-blue-50 text-blue-700',
    dotCls: 'bg-blue-500 animate-pulse',
    cardCls: 'border-blue-200 bg-blue-50/35 hover:border-blue-400 hover:bg-blue-50/70',
    accentCls: 'border-l-blue-600',
    titleCls: 'text-slate-900',
  },
  DONE: {
    vi: 'Hoàn thành',
    en: 'Done',
    badgeCls: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    dotCls: 'bg-emerald-500',
    cardCls: 'border-emerald-200/80 bg-white hover:border-emerald-400 hover:bg-emerald-50/40',
    accentCls: 'border-l-emerald-500',
    titleCls: 'text-slate-800',
  },
  CANCELLED: {
    vi: 'Đã hủy',
    en: 'Cancelled',
    badgeCls: 'border-rose-200 bg-rose-50 text-rose-600',
    dotCls: 'bg-rose-500',
    cardCls: 'border-slate-200 bg-slate-50/70 hover:border-slate-300 hover:bg-slate-100/80',
    accentCls: 'border-l-rose-400',
    titleCls: 'text-slate-500 line-through',
  },
};

function formatTimeHHMM(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return '';
  }
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function DayBookingsModal({
  dateIso,
  weekdayLabel,
  bookings,
  canBook,
  isPastDay,
  onSelectBooking,
  onBookOnDay,
  onOpenDayTimeline,
  onClose,
}: DayBookingsModalProps) {
  const { locale, tr, ln } = useI18n();
  const [statusFilter, setStatusFilter] = useState<FilterValue>('ALL');

  const filteredBookings =
    statusFilter === 'ALL'
      ? bookings
      : bookings.filter((b) => b.status === statusFilter);

  const filterChips: Array<{ value: FilterValue; label: string; count: number }> = [
    { value: 'ALL', label: tr('Tất cả', 'All'), count: bookings.length },
    {
      value: 'PENDING',
      label: tr('Chờ diễn ra', 'Pending'),
      count: bookings.filter((b) => b.status === 'PENDING').length,
    },
    {
      value: 'IN_PROGRESS',
      label: tr('Đang diễn ra', 'In-progress'),
      count: bookings.filter((b) => b.status === 'IN_PROGRESS').length,
    },
    {
      value: 'DONE',
      label: tr('Hoàn thành', 'Done'),
      count: bookings.filter((b) => b.status === 'DONE').length,
    },
    {
      value: 'CANCELLED',
      label: tr('Đã hủy', 'Cancelled'),
      count: bookings.filter((b) => b.status === 'CANCELLED').length,
    },
  ];

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[1px]"
      onClick={onClose}
    >
      <div
        className="flex max-h-[86vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-6 py-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900">
                {tr(
                  `Lịch phòng họp ngày ${weekdayLabel}, ${formatDateVN(dateIso)}`,
                  `Room Bookings — ${weekdayLabel}, ${formatDateVN(dateIso)}`,
                )}
              </h2>
              <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                {tr(`${bookings.length} lịch họp`, `${bookings.length} bookings`)}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              {tr(
                'Nhấn vào bất kỳ lịch họp nào để xem chi tiết (Chỉnh sửa / Hủy lịch)',
                'Click any booking below to view details (Edit / Cancel)',
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={tr('Đóng', 'Close')}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
          >
            <IconX size={18} />
          </button>
        </div>

        {/* Status Filter Strip */}
        <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 bg-slate-50/70 px-6 py-2.5">
          {filterChips.map((chip) => {
            const isSelected = statusFilter === chip.value;
            return (
              <button
                key={chip.value}
                type="button"
                onClick={() => setStatusFilter(chip.value)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                  isSelected
                    ? 'bg-[#0F172A] text-white shadow-xs'
                    : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span>{chip.label}</span>
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold tabular-nums ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {chip.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Scrollable Bookings List */}
        <div className="flex-1 space-y-2.5 overflow-y-auto p-6">
          {filteredBookings.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 py-10 text-center text-sm text-slate-500">
              {tr(
                'Không có lịch đặt phòng nào phù hợp với bộ lọc trạng thái này.',
                'No bookings match the selected status filter.',
              )}
            </div>
          ) : (
            filteredBookings.map((bk) => {
              const meta = STATUS_META[bk.status];
              return (
                <button
                  key={bk.id}
                  type="button"
                  onClick={() => onSelectBooking(bk)}
                  className={`group flex w-full items-center justify-between gap-3 rounded-xl border border-l-4 p-3.5 text-left transition ${meta.cardCls} ${meta.accentCls}`}
                >
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-800 tabular-nums">
                        <IconClock size={14} className="text-slate-400" />
                        {formatTimeHHMM(bk.startTime)} – {formatTimeHHMM(bk.endTime)}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${meta.badgeCls}`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${meta.dotCls}`} />
                        {locale === 'en' ? meta.en : meta.vi}
                      </span>
                    </div>

                    <div className={`truncate text-sm font-bold ${meta.titleCls}`}>{bk.title}</div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1 font-medium text-slate-700">
                        <IconDoor size={14} className="text-blue-600" />
                        [{bk.roomCode}] {ln(bk.roomName, bk.roomNameEn)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <IconUser size={14} className="text-slate-400" />
                        {bk.bookedByEmployeeName}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <IconUsers size={14} className="text-slate-400" />
                        {bk.attendeesCount} {tr('người', 'people')}
                      </span>
                    </div>
                  </div>

                  <span className="inline-flex shrink-0 items-center gap-0.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition group-hover:border-blue-300 group-hover:text-blue-600">
                    <span>{tr('Xem', 'View')}</span>
                    <IconChevronRight size={14} />
                  </span>
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-slate-50/70 px-6 py-3.5">
          <div className="flex flex-wrap items-center gap-2">
            {canBook && !isPastDay && (
              <button
                type="button"
                onClick={onBookOnDay}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700"
              >
                <IconCalendarPlus size={15} />
                <span>{tr('Đặt phòng ngày này', 'Book on this day')}</span>
              </button>
            )}
            <button
              type="button"
              onClick={onOpenDayTimeline}
              className="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              {tr('Mở lịch theo giờ', 'Open Day Timeline')}
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            {tr('Đóng', 'Close')}
          </button>
        </div>
      </div>
    </div>
  );
}
