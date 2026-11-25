'use client';

import { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import {
  IconCamera,
  IconCheck,
  IconDiamond,
  IconFlag,
  IconPlus,
  IconRoute,
} from '@tabler/icons-react';
import { formatDateVN } from '@/lib/portable/date-utils';
import type { ProjectGanttPayload } from '@/modules/projects/milestones.service';
import { useI18n } from '@/shared/i18n/I18nContext';

interface ProjectGanttChartProps {
  projectId: number;
  canManage: boolean;
  canEditTasks: boolean;
  onSelectTask: (taskId: number) => void;
}

type ZoomMode = 'day' | 'week' | 'month';

export function ProjectGanttChart({
  projectId,
  canManage,
  canEditTasks,
  onSelectTask,
}: ProjectGanttChartProps) {
  const { tr } = useI18n();
  const [gantt, setGantt] = useState<ProjectGanttPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState<ZoomMode>('week');
  const [showCriticalPath, setShowCriticalPath] = useState(true);
  const [showBaseline, setShowBaseline] = useState(true);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  // Add Milestone form
  const [msName, setMsName] = useState('');
  const [msDueDate, setMsDueDate] = useState('');
  const [msRequiresSignoff, setMsRequiresSignoff] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const res = await fetch(`/api/v1/projects/${projectId}/gantt`, {
          signal: controller.signal,
        });
        const json = (await res.json().catch(() => null)) as {
          success?: boolean;
          data?: ProjectGanttPayload;
        } | null;
        if (json?.success && json.data) {
          setGantt(json.data);
        }
      } catch {
        // Ignore abort
      } finally {
        setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [projectId, reloadTick]);

  function loadGantt() {
    setReloadTick((n) => n + 1);
  }

  const timeline = useMemo(() => {
    if (!gantt) return { start: dayjs(), totalDays: 30 };
    const dates: string[] = [];
    if (gantt.projectStartDate) dates.push(gantt.projectStartDate);
    if (gantt.projectTargetEndDate) dates.push(gantt.projectTargetEndDate);
    for (const t of gantt.tasks) {
      if (t.startDate) dates.push(t.startDate);
      if (t.dueDate) dates.push(t.dueDate);
      if (t.baselineStartDate) dates.push(t.baselineStartDate);
      if (t.baselineDueDate) dates.push(t.baselineDueDate);
    }
    for (const m of gantt.milestones) {
      if (m.dueDate) dates.push(m.dueDate);
    }
    dates.sort();
    const minDate = dates.length > 0 ? dayjs(dates[0]).subtract(2, 'day') : dayjs().subtract(3, 'day');
    const maxDate =
      dates.length > 0 ? dayjs(dates[dates.length - 1]).add(5, 'day') : minDate.add(30, 'day');
    const totalDays = Math.max(14, Math.min(365, maxDate.diff(minDate, 'day') + 1));
    return { start: minDate, totalDays };
  }, [gantt]);

  const dayWidthPx = zoom === 'day' ? 32 : zoom === 'week' ? 18 : 8;
  const chartWidthPx = timeline.totalDays * dayWidthPx;

  async function handleCaptureBaseline() {
    if (busy) return;
    setBusy(true);
    setBanner(null);
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/baseline/capture`, { method: 'POST' });
      const json = (await res.json().catch(() => null)) as {
        success?: boolean;
        data?: { capturedTasksCount: number };
      } | null;
      if (res.ok && json?.success) {
        setBanner(
          tr(
            `Đã chụp mốc Baseline cho ${json.data?.capturedTasksCount ?? 0} công việc.`,
            `Captured baseline for ${json.data?.capturedTasksCount ?? 0} tasks.`,
          ),
        );
        await loadGantt();
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateMilestone(e: React.FormEvent) {
    e.preventDefault();
    if (!msName.trim() || !msDueDate || busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/milestones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: msName.trim(),
          dueDate: msDueDate,
          requiresSignoff: msRequiresSignoff,
        }),
      });
      if (res.ok) {
        setMsName('');
        setMsDueDate('');
        setMsRequiresSignoff(false);
        await loadGantt();
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleSignoffMilestone(milestoneId: number) {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/v1/projects/${projectId}/milestones/${milestoneId}/request-signoff`,
        { method: 'POST' },
      );
      if (res.ok) {
        setBanner(
          tr(
            'Đã gửi yêu cầu nghiệm thu cột mốc sang Core Approval Engine.',
            'Milestone sign-off submitted to Core Approval Engine.',
          ),
        );
        await loadGantt();
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleShiftTask(taskId: number, currentStart: string | null, currentDue: string | null, deltaDays: number) {
    if (!canEditTasks || busy) return;
    const baseStart = dayjs(currentStart ?? currentDue ?? dayjs().format('YYYY-MM-DD'));
    const baseDue = dayjs(currentDue ?? currentStart ?? baseStart.format('YYYY-MM-DD'));
    const nextStart = baseStart.add(deltaDays, 'day').format('YYYY-MM-DD');
    const nextDue = baseDue.add(deltaDays, 'day').format('YYYY-MM-DD');
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/gantt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, startDate: nextStart, dueDate: nextDue, autoShift: true }),
      });
      const json = (await res.json().catch(() => null)) as {
        success?: boolean;
        data?: { shiftedCount: number; gantt: ProjectGanttPayload };
      } | null;
      if (res.ok && json?.success && json.data) {
        setGantt(json.data.gantt);
        if (json.data.shiftedCount > 0) {
          setBanner(
            tr(
              `Auto-Shift đã tự động đẩy lịch ${json.data.shiftedCount} công việc phụ thuộc.`,
              `Auto-Shift updated ${json.data.shiftedCount} dependent tasks.`,
            ),
          );
        }
      }
    } finally {
      setBusy(false);
    }
  }

  if (loading || !gantt) {
    return <div className="h-80 animate-pulse rounded-2xl bg-white" />;
  }

  return (
    <div className="space-y-4">
      {banner && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-medium text-blue-800">
          {banner}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          {(['day', 'week', 'month'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setZoom(m)}
              className={`rounded-lg px-3 py-1 text-xs font-semibold ${
                zoom === m ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {m === 'day'
                ? tr('Ngày', 'Day')
                : m === 'week'
                  ? tr('Tuần', 'Week')
                  : tr('Tháng', 'Month')}
            </button>
          ))}
          <label className="ml-2 inline-flex items-center gap-1.5 text-xs font-medium text-slate-700">
            <input
              type="checkbox"
              checked={showCriticalPath}
              onChange={(e) => setShowCriticalPath(e.target.checked)}
            />
            <IconRoute size={14} className="text-rose-500" />
            {tr('Đường găng (CPM)', 'Critical Path')} ({gantt.criticalPath.criticalTaskIds.length})
          </label>
          <label className="ml-2 inline-flex items-center gap-1.5 text-xs font-medium text-slate-700">
            <input
              type="checkbox"
              checked={showBaseline}
              onChange={(e) => setShowBaseline(e.target.checked)}
            />
            {tr('So sánh Baseline', 'Show Baseline')}
          </label>
        </div>
        {canManage && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleCaptureBaseline()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <IconCamera size={14} />
            {tr('Chụp mốc Baseline', 'Capture Baseline')}
          </button>
        )}
      </div>

      {/* Gantt Grid */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <div className="min-w-[820px]">
            {/* Header Row */}
            <div className="flex border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-600">
              <div className="w-72 shrink-0 border-r border-slate-200 px-3 py-2">
                {tr('Công việc / Cột mốc', 'Task / Milestone')}
              </div>
              <div className="relative flex-1 py-2" style={{ width: `${chartWidthPx}px` }}>
                {Array.from({ length: Math.ceil(timeline.totalDays / 7) }).map((_, wIdx) => {
                  const weekDate = timeline.start.add(wIdx * 7, 'day');
                  return (
                    <span
                      key={wIdx}
                      className="absolute top-1.5 border-l border-slate-200 pl-1 text-[10px] text-slate-500"
                      style={{ left: `${wIdx * 7 * dayWidthPx}px` }}
                    >
                      {weekDate.format('DD/MM')}
                    </span>
                  );
                })}
              </div>
            </div>

            {/* Milestones Rows */}
            {gantt.milestones.map((ms) => {
              const offsetDays = Math.max(0, dayjs(ms.dueDate).diff(timeline.start, 'day'));
              return (
                <div
                  key={`ms-${ms.id}`}
                  className="flex items-center border-b border-slate-100 bg-amber-50/40 text-xs"
                >
                  <div className="flex w-72 shrink-0 items-center justify-between gap-2 border-r border-slate-200 px-3 py-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 font-semibold text-amber-900">
                        <IconFlag size={13} className="shrink-0 text-amber-600" />
                        <span className="truncate">{ms.name}</span>
                      </div>
                      <p className="text-[10px] text-slate-500">
                        {formatDateVN(ms.dueDate)} • {ms.status} ({ms.progressPercent}%)
                      </p>
                    </div>
                    {canEditTasks && ms.status !== 'COMPLETED' && ms.status !== 'PENDING_SIGNOFF' && (
                      <button
                        type="button"
                        onClick={() => void handleSignoffMilestone(ms.id)}
                        className="shrink-0 rounded-lg border border-amber-300 bg-white px-2 py-0.5 text-[10px] font-semibold text-amber-800 hover:bg-amber-100"
                      >
                        {tr('Nghiệm thu', 'Sign-off')}
                      </button>
                    )}
                    {ms.status === 'COMPLETED' && <IconCheck size={14} className="text-emerald-600" />}
                  </div>
                  <div className="relative h-9 flex-1" style={{ width: `${chartWidthPx}px` }}>
                    <div
                      className="absolute top-2 text-amber-600"
                      style={{ left: `${offsetDays * dayWidthPx}px` }}
                      title={`${ms.name} (${formatDateVN(ms.dueDate)})`}
                    >
                      <IconDiamond size={18} className="fill-amber-400 text-amber-700" />
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Task Bars */}
            {gantt.tasks.map((t) => {
              const sIso = t.startDate ?? t.dueDate;
              const eIso = t.dueDate ?? t.startDate;
              const leftDays = sIso ? Math.max(0, dayjs(sIso).diff(timeline.start, 'day')) : 0;
              const spanDays =
                sIso && eIso ? Math.max(1, dayjs(eIso).diff(dayjs(sIso), 'day') + 1) : 2;
              const isCriticalBar = showCriticalPath && t.isCritical;

              const baseLeft =
                showBaseline && t.baselineStartDate
                  ? Math.max(0, dayjs(t.baselineStartDate).diff(timeline.start, 'day'))
                  : null;
              const baseSpan =
                showBaseline && t.baselineStartDate && t.baselineDueDate
                  ? Math.max(1, dayjs(t.baselineDueDate).diff(dayjs(t.baselineStartDate), 'day') + 1)
                  : null;

              return (
                <div
                  key={t.id}
                  className="flex items-center border-b border-slate-100 text-xs hover:bg-slate-50/70"
                >
                  <div className="flex w-72 shrink-0 items-center justify-between gap-2 border-r border-slate-200 px-3 py-2">
                    <button
                      type="button"
                      onClick={() => onSelectTask(t.id)}
                      className="min-w-0 truncate text-left hover:text-blue-600"
                    >
                      <span className="mr-1.5 font-mono text-[11px] font-semibold text-slate-400">
                        {t.taskKey}
                      </span>
                      <span className="font-medium text-slate-800">{t.title}</span>
                    </button>
                    {canEditTasks && (
                      <div className="flex shrink-0 items-center gap-0.5">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void handleShiftTask(t.id, t.startDate, t.dueDate, -1)}
                          className="rounded border border-slate-200 px-1 text-[10px] hover:bg-slate-100"
                          title={tr('Lùi 1 ngày', 'Shift -1 day')}
                        >
                          -1d
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void handleShiftTask(t.id, t.startDate, t.dueDate, 1)}
                          className="rounded border border-slate-200 px-1 text-[10px] hover:bg-slate-100"
                          title={tr('Đẩy +1 ngày (Auto-Shift)', 'Shift +1 day (Auto-Shift)')}
                        >
                          +1d
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="relative h-10 flex-1" style={{ width: `${chartWidthPx}px` }}>
                    {baseLeft !== null && baseSpan !== null && (
                      <div
                        className="absolute bottom-1 h-1.5 rounded-full bg-slate-300"
                        style={{
                          left: `${baseLeft * dayWidthPx}px`,
                          width: `${Math.max(10, baseSpan * dayWidthPx)}px`,
                        }}
                        title={tr('Mốc Baseline', 'Baseline range')}
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => onSelectTask(t.id)}
                      className={`absolute top-2 h-5 truncate rounded-md px-2 text-left text-[10px] font-semibold text-white shadow-xs ${
                        isCriticalBar
                          ? 'bg-rose-600 ring-2 ring-rose-300'
                          : t.statusCategory === 'DONE'
                            ? 'bg-emerald-600'
                            : 'bg-blue-600'
                      }`}
                      style={{
                        left: `${leftDays * dayWidthPx}px`,
                        width: `${Math.max(24, spanDays * dayWidthPx)}px`,
                      }}
                      title={`${t.taskKey}: ${t.title} (${t.progressPercent}%) • Slack: ${t.slackDays}d`}
                    >
                      {t.taskKey} ({t.progressPercent}%)
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Quick Create Milestone */}
      {canEditTasks && (
        <form
          onSubmit={(e) => void handleCreateMilestone(e)}
          className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3"
        >
          <input
            type="text"
            required
            value={msName}
            onChange={(e) => setMsName(e.target.value)}
            placeholder={tr('Tên Cột mốc mới (vd: Nghiệm thu UAT)...', 'New Milestone name...')}
            className="min-w-[200px] flex-1 rounded-xl border border-slate-200 px-3 py-1.5 text-xs"
          />
          <input
            type="date"
            required
            value={msDueDate}
            onChange={(e) => setMsDueDate(e.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs"
          />
          <label className="inline-flex items-center gap-1.5 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={msRequiresSignoff}
              onChange={(e) => setMsRequiresSignoff(e.target.checked)}
            />
            {tr('Cần trình duyệt nghiệm thu', 'Requires Sign-off')}
          </label>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center gap-1 rounded-xl bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
          >
            <IconPlus size={14} />
            {tr('Thêm Milestone', 'Add Milestone')}
          </button>
        </form>
      )}
    </div>
  );
}
