'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  IconAlertCircle,
  IconArrowRight,
  IconCalendarEvent,
  IconCheck,
  IconClock,
  IconEye,
  IconListCheck,
  IconRefresh,
} from '@tabler/icons-react';
import { pickLabel, TASK_PRIORITY_META } from '@/components/projects/project-ui-helpers';
import { formatDateVN } from '@/lib/portable/date-utils';
import type { MyTasksGroupedView, TaskListItem } from '@/modules/projects/tasks.service';
import { useI18n } from '@/shared/i18n/I18nContext';

function TaskGroupSection({
  title,
  accentCls,
  items,
}: {
  title: string;
  accentCls: string;
  items: TaskListItem[];
}) {
  const { locale, tr, ln } = useI18n();
  if (items.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${accentCls}`} />
          <h2 className="text-xs font-bold uppercase tracking-wide text-slate-800">{title}</h2>
          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-bold text-slate-700">
            {items.length}
          </span>
        </div>
      </div>

      <div className="divide-y divide-slate-100">
        {items.map((t) => (
          <Link
            key={t.id}
            href={`/projects/${t.projectCode}?taskId=${t.id}`}
            className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-xs transition hover:bg-blue-50/40"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-mono text-[11px] font-bold text-white"
                  style={{ backgroundColor: t.projectColorHex }}
                >
                  {t.taskKey}
                </span>
                <span className="font-semibold text-slate-900">{t.title}</span>
              </div>
              <p className="mt-1 text-[11px] text-slate-500">
                {t.projectName} • {ln(t.columnName, t.columnNameEn)}
                {t.subtaskCount > 0
                  ? ` • ${tr('Subtasks:', 'Subtasks:')} ${t.completedSubtaskCount}/${t.subtaskCount}`
                  : ''}
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${TASK_PRIORITY_META[t.priority].cls}`}
              >
                {pickLabel(TASK_PRIORITY_META[t.priority], locale)}
              </span>
              {t.dueDate && (
                <span className="font-medium text-slate-600">{formatDateVN(t.dueDate)}</span>
              )}
              <IconArrowRight size={15} className="text-slate-400" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function MyTasksHubPage() {
  const { tr } = useI18n();
  const trRef = useRef(tr);
  useEffect(() => {
    trRef.current = tr;
  }, [tr]);

  const [data, setData] = useState<MyTasksGroupedView | null>(null);
  const [includeDone, setIncludeDone] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      setIsLoading(true);
      setErrorMsg(null);
      try {
        const res = await fetch(`/api/v1/tasks/my?includeDone=${includeDone ? 'true' : 'false'}`, {
          signal: controller.signal,
        });
        const json = (await res.json().catch(() => null)) as {
          success?: boolean;
          data?: MyTasksGroupedView;
          error?: { message?: string };
        } | null;
        if (!res.ok || !json?.success || !json.data) {
          throw new Error(
            json?.error?.message ??
              trRef.current('Không thể tải danh sách công việc của bạn.', 'Unable to load your tasks.'),
          );
        }
        setData(json.data);
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setErrorMsg(
          err instanceof Error
            ? err.message
            : trRef.current('Lỗi kết nối máy chủ.', 'Network error.'),
        );
      } finally {
        setIsLoading(false);
      }
    })();
    return () => controller.abort();
  }, [includeDone, reloadTick]);

  const totalVisible = data
    ? data.overdue.length +
      data.today.length +
      data.thisWeek.length +
      data.upcoming.length +
      data.noDueDate.length +
      data.watching.length
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {tr('Công việc của tôi (My Work Hub)', 'My Tasks (My Work Hub)')}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {tr(
              'Tổng hợp toàn bộ công việc được giao và đang theo dõi trên tất cả dự án.',
              'All assigned and watched tasks aggregated across every active project.',
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700">
            <input
              type="checkbox"
              checked={includeDone}
              onChange={(e) => setIncludeDone(e.target.checked)}
              className="rounded border-slate-300 text-blue-600"
            />
            {tr('Hiện việc đã hoàn thành', 'Show Completed')}
          </label>
          <button
            type="button"
            onClick={() => setReloadTick((n) => n + 1)}
            className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50"
          >
            <IconRefresh size={17} />
          </button>
          <Link
            href="/projects"
            className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
          >
            {tr('Mở Danh mục Dự án', 'Open Projects')}
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>{tr('Đang mở', 'Open Assigned')}</span>
            <IconListCheck size={17} className="text-blue-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {data?.summary.totalAssignedOpen ?? 0}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>{tr('Quá hạn', 'Overdue')}</span>
            <IconAlertCircle size={17} className="text-rose-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-rose-600">{data?.summary.overdueCount ?? 0}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>{tr('Đang thực hiện', 'In Progress')}</span>
            <IconClock size={17} className="text-amber-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-amber-700">
            {data?.summary.inProgressCount ?? 0}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>{tr('Xong 7 ngày qua', 'Done (7d)')}</span>
            <IconCheck size={17} className="text-emerald-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-emerald-700">
            {data?.summary.completedLast7Days ?? 0}
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, idx) => (
            <div key={idx} className="h-28 animate-pulse rounded-2xl bg-white" />
          ))}
        </div>
      ) : errorMsg ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center">
          <p className="text-sm font-medium text-rose-700">{errorMsg}</p>
          <button
            type="button"
            onClick={() => setReloadTick((n) => n + 1)}
            className="mt-3 rounded-xl bg-rose-600 px-4 py-1.5 text-xs font-semibold text-white"
          >
            {tr('Thử lại', 'Retry')}
          </button>
        </div>
      ) : totalVisible === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
          <IconCalendarEvent size={34} className="mx-auto mb-2 text-slate-300" />
          <p className="text-sm font-semibold text-slate-800">
            {tr('Bạn không còn công việc tồn đọng nào!', 'You are all caught up!')}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {tr(
              'Truy cập Danh mục Dự án để nhận thêm công việc hoặc khởi tạo kế hoạch mới.',
              'Visit the Projects Portfolio to pick up tasks or start a new plan.',
            )}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <TaskGroupSection
            title={tr('Quá hạn — Cần xử lý ngay', 'Overdue — Needs Immediate Attention')}
            accentCls="bg-rose-500"
            items={data?.overdue ?? []}
          />
          <TaskGroupSection
            title={tr('Đến hạn hôm nay', 'Due Today')}
            accentCls="bg-amber-500"
            items={data?.today ?? []}
          />
          <TaskGroupSection
            title={tr('Trong 7 ngày tới', 'Due This Week')}
            accentCls="bg-blue-500"
            items={data?.thisWeek ?? []}
          />
          <TaskGroupSection
            title={tr('Sắp tới', 'Upcoming')}
            accentCls="bg-indigo-500"
            items={data?.upcoming ?? []}
          />
          <TaskGroupSection
            title={tr('Chưa đặt hạn chót', 'No Due Date')}
            accentCls="bg-slate-400"
            items={data?.noDueDate ?? []}
          />
          {(data?.watching.length ?? 0) > 0 && (
            <div className="pt-2">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                <IconEye size={15} />
                {tr('Công việc đang theo dõi', 'Watching')}
              </div>
              <TaskGroupSection
                title={tr('Đang theo dõi (Watcher)', 'Watched Tasks')}
                accentCls="bg-cyan-500"
                items={data?.watching ?? []}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
