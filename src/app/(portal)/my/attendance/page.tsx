'use client';

import { useEffect, useRef, useState } from 'react';
import {
  IconAlertCircle,
  IconCalendarTime,
  IconClockCheck,
  IconClockPlay,
  IconClockStop,
  IconLoader2,
  IconLock,
  IconRefresh,
} from '@tabler/icons-react';
import type { AttendanceSummaryRecord } from '@/components/hrm/AttendanceSummaryEditModal';
import type { AttendanceLogRecord } from '@/components/hrm/ManualAttendanceModal';
import { formatDateVN } from '@/lib/portable/date-utils';
import { useI18n } from '@/shared/i18n/I18nContext';

interface MyAttendanceData {
  employee: {
    id: number;
    employeeCode: string;
    fullName: string;
    branchName: string;
    branchNameEn?: string | null;
    departmentName: string;
    departmentNameEn?: string | null;
  };
  year: number;
  month: number;
  todayDate: string;
  todayShift: {
    id: number;
    code: string;
    name: string;
    nameEn?: string | null;
    startTime: string;
    endTime: string;
    breakStartTime: string | null;
    breakEndTime: string | null;
    workingHours: number;
  } | null;
  isTodayHoliday: boolean;
  todayLog: AttendanceLogRecord | null;
  stats: {
    presentDays: number;
    lateDays: number;
    totalLateMinutes: number;
    totalEarlyLeaveMinutes: number;
    totalWorkedHours: number;
  };
  logs: AttendanceLogRecord[];
}

const STATUS_BADGE_MAP: Record<string, { vi: string; en: string; className: string }> = {
  PRESENT: {
    vi: 'Đúng giờ',
    en: 'On Time',
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  LATE: {
    vi: 'Đi muộn',
    en: 'Late',
    className: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  ABSENT: {
    vi: 'Vắng mặt',
    en: 'Absent',
    className: 'bg-rose-50 text-rose-700 border-rose-200',
  },
  LEAVE: {
    vi: 'Nghỉ phép',
    en: 'On Leave',
    className: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  HOLIDAY: {
    vi: 'Ngày lễ',
    en: 'Holiday',
    className: 'bg-purple-50 text-purple-700 border-purple-200',
  },
};

const SOURCE_LABEL_MAP: Record<string, { vi: string; en: string }> = {
  WEB: { vi: 'Web ESS', en: 'Web ESS' },
  IMPORT: { vi: 'Import Excel', en: 'Excel Import' },
  MANUAL: { vi: 'HR chỉnh tay', en: 'HR Manual' },
};

function getCurrentVnTimeString(): string {
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date());
}

export default function MyAttendancePage() {
  const { locale, tr, ln } = useI18n();
  const trRef = useRef(tr);
  useEffect(() => {
    trRef.current = tr;
  }, [tr]);

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [reloadTick, setReloadTick] = useState(0);

  const [data, setData] = useState<MyAttendanceData | null>(null);
  const [monthlySummary, setMonthlySummary] = useState<AttendanceSummaryRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [clockText, setClockText] = useState('--:--:--');
  const [actionNote, setActionNote] = useState('');
  const [isActing, setIsActing] = useState(false);
  const [actionBanner, setActionBanner] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setClockText(getCurrentVnTimeString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetch(`/api/v1/hrm/attendance/me?year=${year}&month=${month}`, {
        signal: controller.signal,
      }).then(async (res) => {
        const json = (await res.json()) as {
          success: boolean;
          data?: MyAttendanceData;
          error?: { message?: string };
        };
        if (!res.ok || !json.success || !json.data) {
          throw new Error(
            json.error?.message ??
              trRef.current(
                'Không thể tải dữ liệu chấm công cá nhân.',
                'Failed to load your attendance data.',
              ),
          );
        }
        return json.data;
      }),
      fetch(`/api/v1/hrm/attendance/summaries/me?year=${year}&month=${month}`, {
        signal: controller.signal,
      })
        .then(async (res) => {
          if (!res.ok) return null;
          const json = (await res.json()) as {
            success: boolean;
            data?: { summary: AttendanceSummaryRecord | null };
          };
          return json.success ? (json.data?.summary ?? null) : null;
        })
        .catch(() => null),
    ])
      .then(([meData, summaryData]) => {
        setData(meData);
        setMonthlySummary(summaryData);
        setErrorMsg(null);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }
        setErrorMsg(
          err instanceof Error
            ? err.message
            : trRef.current('Lỗi tải dữ liệu chấm công.', 'Error loading attendance data.'),
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => controller.abort();
  }, [year, month, reloadTick]);

  function triggerReload(nextYear = year, nextMonth = month) {
    setIsLoading(true);
    setErrorMsg(null);
    setYear(nextYear);
    setMonth(nextMonth);
    setReloadTick((t) => t + 1);
  }

  async function handleCheckAction(type: 'check-in' | 'check-out') {
    setIsActing(true);
    setActionBanner(null);

    try {
      const res = await fetch(`/api/v1/hrm/attendance/${type}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: actionNote.trim() || null }),
      });
      const json = (await res.json()) as {
        success: boolean;
        data?: { log?: AttendanceLogRecord };
        error?: { message?: string };
      };

      if (!res.ok || !json.success) {
        setActionBanner({
          type: 'error',
          message:
            json.error?.message ??
            (type === 'check-in'
              ? tr('Check-in thất bại.', 'Check-in failed.')
              : tr('Check-out thất bại.', 'Check-out failed.')),
        });
        setIsActing(false);
        return;
      }

      setActionNote('');
      setActionBanner({
        type: 'success',
        message:
          type === 'check-in'
            ? tr(
                `Đã Check-in thành công lúc ${json.data?.log?.checkInTime ?? ''}.`,
                `Checked in successfully at ${json.data?.log?.checkInTime ?? ''}.`,
              )
            : tr(
                `Đã Check-out thành công lúc ${json.data?.log?.checkOutTime ?? ''} (${json.data?.log?.workedHours ?? 0} giờ).`,
                `Checked out successfully at ${json.data?.log?.checkOutTime ?? ''} (${json.data?.log?.workedHours ?? 0} hrs).`,
              ),
      });
      setIsActing(false);
      triggerReload();
    } catch {
      setActionBanner({
        type: 'error',
        message: tr(
          'Lỗi kết nối máy chủ khi chấm công.',
          'Server connection error while recording attendance.',
        ),
      });
      setIsActing(false);
    }
  }

  const hasCheckedInToday = Boolean(data?.todayLog?.checkInTime);
  const hasCheckedOutToday = Boolean(data?.todayLog?.checkOutTime);

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            {tr('Chấm công của tôi (ESS)', 'My Attendance (ESS)')}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {tr(
              'Check-in / Check-out trực tuyến và theo dõi bảng nhật ký chấm công cá nhân theo tháng.',
              'Online Check-in / Check-out and monthly personal attendance log tracking.',
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={month}
            onChange={(e) => triggerReload(year, Number(e.target.value))}
            aria-label={tr('Chọn tháng', 'Select month')}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 outline-none focus:border-blue-500"
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {tr(`Tháng ${m}`, `Month ${m}`)}
              </option>
            ))}
          </select>
          <select
            value={year}
            onChange={(e) => triggerReload(Number(e.target.value), month)}
            aria-label={tr('Chọn năm', 'Select year')}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 outline-none focus:border-blue-500"
          >
            {[2025, 2026, 2027].map((y) => (
              <option key={y} value={y}>
                {tr(`Năm ${y}`, `Year ${y}`)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isLoading && !data ? (
        <div className="space-y-4">
          <div className="h-44 animate-pulse rounded-2xl border border-slate-200 bg-white p-6" />
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div key={idx} className="h-24 animate-pulse rounded-2xl border border-slate-200 bg-white" />
            ))}
          </div>
          <div className="h-64 animate-pulse rounded-2xl border border-slate-200 bg-white" />
        </div>
      ) : errorMsg ? (
        <div className="rounded-2xl border border-rose-200 bg-white p-8 text-center shadow-sm">
          <IconAlertCircle size={32} className="mx-auto text-rose-500" />
          <p className="mt-3 text-sm font-medium text-rose-700">{errorMsg}</p>
          <button
            type="button"
            onClick={() => triggerReload()}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <IconRefresh size={16} />
            <span>{tr('Thử lại', 'Retry')}</span>
          </button>
        </div>
      ) : data ? (
        <>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                  <IconCalendarTime size={15} />
                  <span>
                    {tr('Hôm nay:', 'Today:')} {formatDateVN(data.todayDate)}
                  </span>
                  {data.isTodayHoliday && (
                    <span className="rounded bg-purple-100 px-1.5 py-0.5 text-[11px] text-purple-700">
                      {tr('Ngày lễ', 'Holiday')}
                    </span>
                  )}
                </div>

                <div className="font-mono text-4xl font-bold tracking-tight text-slate-900">
                  {clockText}
                </div>

                <div className="text-sm text-slate-600">
                  <span className="font-semibold text-slate-800">
                    {data.employee.employeeCode} — {data.employee.fullName}
                  </span>{' '}
                  • {ln(data.employee.departmentName, data.employee.departmentNameEn)} (
                  {ln(data.employee.branchName, data.employee.branchNameEn)})
                </div>

                <div className="text-xs text-slate-500">
                  {tr('Ca áp dụng:', 'Assigned shift:')}{' '}
                  {data.todayShift ? (
                    <span className="font-semibold text-slate-700">
                      {data.todayShift.code} — {ln(data.todayShift.name, data.todayShift.nameEn)} (
                      {data.todayShift.startTime}–
                      {data.todayShift.endTime}
                      {data.todayShift.breakStartTime && data.todayShift.breakEndTime
                        ? tr(
                            `, nghỉ trưa ${data.todayShift.breakStartTime}–${data.todayShift.breakEndTime}`,
                            `, break ${data.todayShift.breakStartTime}–${data.todayShift.breakEndTime}`,
                          )
                        : ''}
                      )
                    </span>
                  ) : (
                    <span>{tr('Chưa thiết lập ca mặc định', 'No default shift configured')}</span>
                  )}
                </div>
              </div>

              <div className="w-full max-w-md space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="rounded-xl bg-white p-3 border border-slate-200">
                    <div className="text-[11px] font-medium uppercase text-slate-400">
                      {tr('Giờ vào', 'Check-in')}
                    </div>
                    <div className="mt-1 font-mono text-xl font-bold text-emerald-700">
                      {data.todayLog?.checkInTime ?? '--:--'}
                    </div>
                  </div>
                  <div className="rounded-xl bg-white p-3 border border-slate-200">
                    <div className="text-[11px] font-medium uppercase text-slate-400">
                      {tr('Giờ ra', 'Check-out')}
                    </div>
                    <div className="mt-1 font-mono text-xl font-bold text-blue-700">
                      {data.todayLog?.checkOutTime ?? '--:--'}
                    </div>
                  </div>
                </div>

                <input
                  type="text"
                  value={actionNote}
                  disabled={isActing}
                  onChange={(e) => setActionNote(e.target.value)}
                  placeholder={tr(
                    'Ghi chú chấm công (tùy chọn, VD: Làm việc tại văn phòng)...',
                    'Attendance note (optional, e.g. Working from office)...',
                  )}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs outline-none focus:border-blue-500"
                />

                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    disabled={isActing || hasCheckedInToday}
                    onClick={() => void handleCheckAction('check-in')}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isActing ? (
                      <IconLoader2 size={16} className="animate-spin" />
                    ) : (
                      <IconClockPlay size={17} />
                    )}
                    <span>{hasCheckedInToday ? tr('Đã Check-in', 'Checked In') : 'Check-in'}</span>
                  </button>

                  <button
                    type="button"
                    disabled={isActing || !hasCheckedInToday}
                    onClick={() => void handleCheckAction('check-out')}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isActing ? (
                      <IconLoader2 size={16} className="animate-spin" />
                    ) : (
                      <IconClockStop size={17} />
                    )}
                    <span>
                      {hasCheckedOutToday
                        ? tr('Cập nhật Check-out', 'Update Check-out')
                        : 'Check-out'}
                    </span>
                  </button>
                </div>

                {actionBanner && (
                  <div
                    className={`rounded-xl px-3 py-2 text-xs font-medium ${
                      actionBanner.type === 'success'
                        ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border border-rose-200 bg-rose-50 text-rose-700'
                    }`}
                  >
                    {actionBanner.message}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-xs font-medium text-slate-500">
                {tr('Ngày có chấm công', 'Days Present')}
              </div>
              <div className="mt-1.5 text-2xl font-bold text-slate-900">
                {data.stats.presentDays}{' '}
                <span className="text-sm font-normal text-slate-500">
                  {tr('ngày', data.stats.presentDays === 1 ? 'day' : 'days')}
                </span>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-xs font-medium text-slate-500">
                {tr('Tổng giờ làm việc', 'Total Worked Hours')}
              </div>
              <div className="mt-1.5 text-2xl font-bold text-blue-700">
                {data.stats.totalWorkedHours.toFixed(2)}{' '}
                <span className="text-sm font-normal text-slate-500">
                  {tr('giờ', 'hrs')}
                </span>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-xs font-medium text-slate-500">
                {tr('Số lần đi muộn', 'Late Arrivals')}
              </div>
              <div className="mt-1.5 text-2xl font-bold text-amber-600">
                {data.stats.lateDays}{' '}
                <span className="text-sm font-normal text-slate-500">
                  {tr('lần', data.stats.lateDays === 1 ? 'time' : 'times')}
                </span>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-xs font-medium text-slate-500">
                {tr('Tổng phút đi muộn', 'Total Late Minutes')}
              </div>
              <div className="mt-1.5 text-2xl font-bold text-rose-600">
                {data.stats.totalLateMinutes}{' '}
                <span className="text-sm font-normal text-slate-500">
                  {tr('phút', 'mins')}
                </span>
              </div>
            </div>
          </div>

          {monthlySummary && (
            <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">
                    {tr(
                      `Bảng công tổng hợp Tháng ${monthlySummary.month}/${monthlySummary.year}`,
                      `Monthly Timesheet Summary — ${monthlySummary.month}/${monthlySummary.year}`,
                    )}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {tr(
                      'Số liệu tổng hợp phục vụ tính lương (bao gồm chấm công, phép hưởng lương, ngày lễ và OT đã duyệt).',
                      'Consolidated payroll figures (including attendance, paid leave, holidays, and approved OT).',
                    )}
                  </p>
                </div>
                {monthlySummary.status === 'LOCKED' ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                    <IconLock size={13} />
                    <span>{tr('Đã chốt công', 'Locked')}</span>
                  </span>
                ) : (
                  <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                    {tr('Đang rà soát (Nháp)', 'In Review (Draft)')}
                  </span>
                )}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="text-[11px] text-slate-500">
                    {tr('Công chuẩn', 'Standard Days')}
                  </div>
                  <div className="mt-0.5 font-mono text-base font-bold text-slate-800">
                    {monthlySummary.standardWorkDays.toFixed(1)}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="text-[11px] text-slate-500">
                    {tr('Công thực tế', 'Actual Days')}
                  </div>
                  <div className="mt-0.5 font-mono text-base font-bold text-slate-900">
                    {monthlySummary.actualWorkDays.toFixed(2)}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="text-[11px] text-slate-500">
                    {tr('Phép hưởng lương', 'Paid Leave')}
                  </div>
                  <div className="mt-0.5 font-mono text-base font-bold text-emerald-700">
                    {monthlySummary.paidLeaveDays.toFixed(1)}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="text-[11px] text-slate-500">
                    {tr('Ngày lễ', 'Holidays')}
                  </div>
                  <div className="mt-0.5 font-mono text-base font-bold text-purple-700">
                    {monthlySummary.holidayDays.toFixed(1)}
                  </div>
                </div>
                <div className="rounded-xl border border-blue-200 bg-white p-3">
                  <div className="text-[11px] font-medium text-blue-700">
                    {tr('Công hưởng lương', 'Payable Days')}
                  </div>
                  <div className="mt-0.5 font-mono text-base font-bold text-blue-700">
                    {monthlySummary.payableDays.toFixed(2)}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="text-[11px] text-slate-500">OT (150/200/300)</div>
                  <div className="mt-0.5 font-mono text-xs font-bold text-slate-800">
                    {monthlySummary.otHours150}/{monthlySummary.otHours200}/{monthlySummary.otHours300}h
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div className="flex items-center gap-2">
                <IconClockCheck size={18} className="text-blue-600" />
                <h2 className="text-sm font-semibold text-slate-900">
                  {tr(
                    `Nhật ký chấm công tháng ${data.month}/${data.year}`,
                    `Attendance Log — ${data.month}/${data.year}`,
                  )}
                </h2>
              </div>
              <span className="text-xs text-slate-500">
                {data.logs.length}{' '}
                {tr('bản ghi', data.logs.length === 1 ? 'record' : 'records')}
              </span>
            </div>

            {data.logs.length === 0 ? (
              <div className="p-10 text-center">
                <p className="text-sm font-medium text-slate-700">
                  {tr(
                    `Chưa có bản ghi chấm công nào trong tháng ${data.month}/${data.year}.`,
                    `No attendance records for ${data.month}/${data.year}.`,
                  )}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {tr(
                    'Bấm nút Check-in phía trên để bắt đầu ghi nhận ngày làm việc hôm nay.',
                    'Click the Check-in button above to start recording today’s workday.',
                  )}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[780px] text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-semibold">{tr('Ngày công', 'Work Date')}</th>
                      <th className="px-4 py-3 font-semibold">{tr('Ca làm việc', 'Shift')}</th>
                      <th className="px-4 py-3 text-center font-semibold">
                        {tr('Giờ vào', 'Check-in')}
                      </th>
                      <th className="px-4 py-3 text-center font-semibold">
                        {tr('Giờ ra', 'Check-out')}
                      </th>
                      <th className="px-4 py-3 text-right font-semibold">
                        {tr('Đi muộn', 'Late')}
                      </th>
                      <th className="px-4 py-3 text-right font-semibold">
                        {tr('Về sớm', 'Early Leave')}
                      </th>
                      <th className="px-4 py-3 text-right font-semibold">
                        {tr('Giờ công', 'Worked Hrs')}
                      </th>
                      <th className="px-4 py-3 text-center font-semibold">
                        {tr('Nguồn', 'Source')}
                      </th>
                      <th className="px-4 py-3 text-center font-semibold">
                        {tr('Trạng thái', 'Status')}
                      </th>
                      <th className="px-4 py-3 font-semibold">{tr('Ghi chú', 'Note')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.logs.map((log) => {
                      const badge = STATUS_BADGE_MAP[log.status] ?? {
                        vi: log.status,
                        en: log.status,
                        className: 'bg-slate-100 text-slate-700 border-slate-200',
                      };
                      const sourceLabel = SOURCE_LABEL_MAP[log.source];
                      return (
                        <tr key={log.id} className="hover:bg-slate-50/70">
                          <td className="px-4 py-3 font-medium text-slate-900">
                            {formatDateVN(log.workDate)}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-600">
                            {log.shiftCode
                              ? `${log.shiftCode} - ${ln(log.shiftName ?? '', log.shiftNameEn)}`
                              : '-'}
                          </td>
                          <td className="px-4 py-3 text-center font-mono text-xs font-semibold text-emerald-700">
                            {log.checkInTime ?? '--:--'}
                          </td>
                          <td className="px-4 py-3 text-center font-mono text-xs font-semibold text-blue-700">
                            {log.checkOutTime ?? '--:--'}
                          </td>
                          <td className="px-4 py-3 text-right text-xs">
                            {log.lateMinutes > 0 ? (
                              <span className="font-semibold text-amber-600">
                                {log.lateMinutes} {tr('phút', 'min')}
                              </span>
                            ) : (
                              <span className="text-slate-400">0</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right text-xs">
                            {log.earlyLeaveMinutes > 0 ? (
                              <span className="font-semibold text-rose-600">
                                {log.earlyLeaveMinutes} {tr('phút', 'min')}
                              </span>
                            ) : (
                              <span className="text-slate-400">0</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-xs font-semibold text-slate-800">
                            {log.workedHours.toFixed(2)}h
                          </td>
                          <td className="px-4 py-3 text-center text-xs text-slate-500">
                            {sourceLabel
                              ? locale === 'en'
                                ? sourceLabel.en
                                : sourceLabel.vi
                              : log.source}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${badge.className}`}
                            >
                              {locale === 'en' ? badge.en : badge.vi}
                            </span>
                          </td>
                          <td className="max-w-[200px] truncate px-4 py-3 text-xs text-slate-500" title={log.note ?? ''}>
                            {log.note ?? '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
