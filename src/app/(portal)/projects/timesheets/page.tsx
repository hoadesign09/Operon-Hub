'use client';

import { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import {
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconDownload,
  IconPlus,
  IconSend,
  IconX,
} from '@tabler/icons-react';
import { usePortalAuth } from '@/components/portal/PortalAuthContext';
import { SkeletonTableRows } from '@/components/ui/Skeleton';
import { formatVND } from '@/lib/portable/currency-utils';
import type { TaskListItem } from '@/modules/projects/tasks.service';
import type { TimeLogItemView } from '@/modules/projects/timelogs.service';
import { useI18n } from '@/shared/i18n/I18nContext';

function getMondayIso(offsetWeeks: number): string {
  const today = dayjs();
  const dow = today.day();
  const diffToMon = dow === 0 ? -6 : 1 - dow;
  return today.add(diffToMon + offsetWeeks * 7, 'day').format('YYYY-MM-DD');
}

export default function ProjectTimesheetsPage() {
  const { user } = usePortalAuth();
  const { tr } = useI18n();
  const canApprove =
    user?.isSuperAdmin || user?.permissions.includes('pm.timelogs.approve');

  const [weekOffset, setWeekOffset] = useState(0);
  const weekStart = getMondayIso(weekOffset);
  const weekEnd = dayjs(weekStart).add(6, 'day').format('YYYY-MM-DD');
  const weekDays = Array.from({ length: 7 }).map((_, i) =>
    dayjs(weekStart).add(i, 'day').format('YYYY-MM-DD'),
  );

  const [logs, setLogs] = useState<TimeLogItemView[]>([]);
  const [myTasks, setMyTasks] = useState<TaskListItem[]>([]);
  const [mineOnly, setMineOnly] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Manual log form
  const [taskId, setTaskId] = useState('');
  const [loggedDate, setLoggedDate] = useState(() => dayjs().format('YYYY-MM-DD'));
  const [hours, setHours] = useState('2');
  const [desc, setDesc] = useState('');
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const qs = new URLSearchParams({
          startDate: weekStart,
          endDate: weekEnd,
          mineOnly: String(mineOnly),
        });
        const [logsRes, tasksRes] = await Promise.all([
          fetch(`/api/v1/pm/timelogs?${qs.toString()}`, { signal: controller.signal }),
          fetch('/api/v1/tasks/my', { signal: controller.signal }),
        ]);
        const logsJson = (await logsRes.json().catch(() => null)) as {
          data?: TimeLogItemView[];
        } | null;
        const tasksJson = (await tasksRes.json().catch(() => null)) as {
          data?: {
            overdue?: TaskListItem[];
            today?: TaskListItem[];
            thisWeek?: TaskListItem[];
            upcoming?: TaskListItem[];
            noDueDate?: TaskListItem[];
          };
        } | null;
        setLogs(logsJson?.data ?? []);
        const combined = [
          ...(tasksJson?.data?.overdue ?? []),
          ...(tasksJson?.data?.today ?? []),
          ...(tasksJson?.data?.thisWeek ?? []),
          ...(tasksJson?.data?.upcoming ?? []),
          ...(tasksJson?.data?.noDueDate ?? []),
        ];
        setMyTasks(combined);
      } catch {
        // Ignore abort
      } finally {
        setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [weekStart, weekEnd, mineOnly, reloadTick]);

  function reloadLogs() {
    setReloadTick((n) => n + 1);
  }

  async function handleAddManual(e: React.FormEvent) {
    e.preventDefault();
    if (!taskId || busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const mins = Math.max(1, Math.round((Number(hours) || 1) * 60));
      const res = await fetch('/api/v1/pm/timelogs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: Number(taskId),
          loggedDate,
          durationMinutes: mins,
          isBillable: true,
          description: desc.trim() || null,
        }),
      });
      if (res.ok) {
        setDesc('');
        setMsg(tr('Đã ghi nhận giờ công thành công.', 'Time log recorded successfully.'));
        reloadLogs();
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmitWeek() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch('/api/v1/pm/timelogs/submit-week', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekStart, weekEnd }),
      });
      const json = (await res.json().catch(() => null)) as {
        data?: { submittedCount: number };
      } | null;
      if (res.ok) {
        setMsg(
          tr(
            `Đã gửi duyệt ${json?.data?.submittedCount ?? 0} bản ghi Timesheet tuần này.`,
            `Submitted ${json?.data?.submittedCount ?? 0} timesheet entries for approval.`,
          ),
        );
        reloadLogs();
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleReview(logIds: number[], decision: 'APPROVED' | 'REJECTED') {
    if (logIds.length === 0 || busy) return;
    setBusy(true);
    try {
      const res = await fetch('/api/v1/pm/timelogs/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logIds, decision }),
      });
      if (res.ok) {
        setMsg(
          decision === 'APPROVED'
            ? tr('Đã phê duyệt Timesheet và đồng bộ chi phí nhân công.', 'Timesheet approved and labor cost synced.')
            : tr('Đã từ chối bản ghi Timesheet.', 'Timesheet rejected.'),
        );
        reloadLogs();
      }
    } finally {
      setBusy(false);
    }
  }

  const totalMinutes = logs.reduce((s, l) => s + l.durationMinutes, 0);
  const totalHours = Math.round((totalMinutes / 60) * 100) / 100;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            {tr('Bảng Chấm giờ Tuần & Phê duyệt Timesheet', 'Weekly Timesheets & Approval')}
          </h1>
          <p className="text-xs text-slate-500">
            {tr(
              'Ghi nhận thời gian thực thi công việc theo tuần (T2–CN), gửi duyệt và tự động cộng vào chi phí dự án.',
              'Track weekly task hours (Mon–Sun), submit for approval, and auto-sync project labor costs.',
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center rounded-xl border border-slate-200 bg-white">
            <button
              type="button"
              onClick={() => setWeekOffset((n) => n - 1)}
              className="p-2 text-slate-600 hover:bg-slate-50"
            >
              <IconChevronLeft size={16} />
            </button>
            <span className="px-3 text-xs font-semibold text-slate-800">
              {dayjs(weekStart).format('DD/MM')} – {dayjs(weekEnd).format('DD/MM/YYYY')}
            </span>
            <button
              type="button"
              onClick={() => setWeekOffset((n) => n + 1)}
              className="p-2 text-slate-600 hover:bg-slate-50"
            >
              <IconChevronRight size={16} />
            </button>
          </div>
          {canApprove && (
            <button
              type="button"
              onClick={() => setMineOnly((v) => !v)}
              className={`rounded-xl border px-3 py-2 text-xs font-semibold ${
                !mineOnly
                  ? 'border-blue-600 bg-blue-600 text-white'
                  : 'border-slate-200 bg-white text-slate-700'
              }`}
            >
              {mineOnly ? tr('Của tôi', 'My Logs') : tr('Tất cả nhóm (Duyệt)', 'Team Review')}
            </button>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleSubmitWeek()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
          >
            <IconSend size={14} />
            {tr('Gửi duyệt tuần', 'Submit Week')}
          </button>
          <a
            href={`/api/v1/pm/reports/timesheets/export?startDate=${weekStart}&endDate=${weekEnd}`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <IconDownload size={14} />
            Excel
          </a>
        </div>
      </div>

      {msg && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-medium text-blue-800">
          {msg}
        </div>
      )}

      {/* Manual Time Log Entry */}
      <form
        onSubmit={(e) => void handleAddManual(e)}
        className="grid grid-cols-1 gap-2 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-12"
      >
        <select
          required
          value={taskId}
          onChange={(e) => setTaskId(e.target.value)}
          className="rounded-xl border border-slate-200 px-3 py-2 text-xs md:col-span-4"
        >
          <option value="">{tr('-- Chọn công việc của bạn --', '-- Select your task --')}</option>
          {myTasks.map((t) => (
            <option key={t.id} value={t.id}>
              [{t.taskKey}] {t.title}
            </option>
          ))}
        </select>
        <input
          type="date"
          required
          value={loggedDate}
          onChange={(e) => setLoggedDate(e.target.value)}
          className="rounded-xl border border-slate-200 px-3 py-2 text-xs md:col-span-2"
        />
        <input
          type="number"
          step="0.25"
          min="0.25"
          max="24"
          required
          value={hours}
          onChange={(e) => setHours(e.target.value)}
          placeholder={tr('Số giờ', 'Hours')}
          className="rounded-xl border border-slate-200 px-3 py-2 text-xs md:col-span-1"
        />
        <input
          type="text"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder={tr('Mô tả công việc đã thực hiện...', 'Work description...')}
          className="rounded-xl border border-slate-200 px-3 py-2 text-xs md:col-span-3"
        />
        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center justify-center gap-1 rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 md:col-span-2"
        >
          <IconPlus size={14} />
          {tr('Ghi giờ công', 'Log Time')}
        </button>
      </form>

      {/* Weekly Totals Strip */}
      <div className="grid grid-cols-7 gap-2">
        {weekDays.map((d) => {
          const dayMins = logs
            .filter((l) => l.loggedDate === d)
            .reduce((s, l) => s + l.durationMinutes, 0);
          return (
            <div key={d} className="rounded-xl border border-slate-200 bg-white p-2.5 text-center">
              <div className="text-[10px] font-semibold text-slate-500">
                {dayjs(d).format('ddd DD/MM')}
              </div>
              <div className="mt-1 text-sm font-bold text-slate-900">
                {Math.round((dayMins / 60) * 10) / 10}h
              </div>
            </div>
          );
        })}
      </div>

      {/* Detailed Logs Table */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 text-xs">
          <span className="font-bold text-slate-800">
            {tr('Chi tiết bản ghi giờ công', 'Time Log Entries')} ({logs.length})
          </span>
          <span className="font-semibold text-blue-700">
            {tr('Tổng tuần', 'Week Total')}: {totalHours}h
          </span>
        </div>
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-600">
            <tr>
              <th className="px-4 py-2.5">{tr('Ngày', 'Date')}</th>
              <th className="px-4 py-2.5">{tr('Nhân viên', 'Employee')}</th>
              <th className="px-4 py-2.5">{tr('Công việc', 'Task')}</th>
              <th className="px-4 py-2.5 text-right">{tr('Thời lượng', 'Duration')}</th>
              <th className="px-4 py-2.5 text-right">{tr('Chi phí', 'Est. Cost')}</th>
              <th className="px-4 py-2.5">{tr('Trạng thái', 'Status')}</th>
              <th className="px-4 py-2.5 text-right">{tr('Duyệt', 'Action')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <SkeletonTableRows rows={6} columns={7} />
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                  {tr('Chưa có bản ghi giờ công nào trong tuần này.', 'No time logs recorded this week.')}
                </td>
              </tr>
            ) : (
              logs.map((l) => (
                <tr key={l.id}>
                  <td className="px-4 py-2.5 font-mono text-slate-600">
                    {dayjs(l.loggedDate).format('DD/MM/YYYY')}
                  </td>
                  <td className="px-4 py-2.5 font-medium text-slate-800">{l.employeeName}</td>
                  <td className="px-4 py-2.5">
                    <span className="mr-1.5 font-mono font-bold text-slate-500">{l.taskKey}</span>
                    <span className="text-slate-900">{l.taskTitle}</span>
                    {l.description && (
                      <p className="text-[11px] text-slate-500">{l.description}</p>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right font-bold text-slate-900">
                    {Math.round((l.durationMinutes / 60) * 100) / 100}h
                  </td>
                  <td className="px-4 py-2.5 text-right text-slate-600">
                    {formatVND(l.estimatedCost)}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        l.approvalStatus === 'APPROVED'
                          ? 'bg-emerald-100 text-emerald-700'
                          : l.approvalStatus === 'REJECTED'
                            ? 'bg-rose-100 text-rose-700'
                            : l.approvalStatus === 'SUBMITTED'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {l.approvalStatus}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {canApprove && l.approvalStatus === 'SUBMITTED' && (
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => void handleReview([l.id], 'APPROVED')}
                          className="rounded-lg bg-emerald-600 p-1 text-white hover:bg-emerald-700"
                          title={tr('Phê duyệt', 'Approve')}
                        >
                          <IconCheck size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleReview([l.id], 'REJECTED')}
                          className="rounded-lg bg-rose-600 p-1 text-white hover:bg-rose-700"
                          title={tr('Từ chối', 'Reject')}
                        >
                          <IconX size={13} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
