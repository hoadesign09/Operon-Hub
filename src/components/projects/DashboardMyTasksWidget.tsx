'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { IconArrowRight, IconListCheck } from '@tabler/icons-react';
import { usePortalAuth } from '@/components/portal/PortalAuthContext';
import { SkeletonListRows } from '@/components/ui/Skeleton';
import { formatDateVN } from '@/lib/portable/date-utils';
import type { MyTasksGroupedView } from '@/modules/projects/tasks.service';
import { useI18n } from '@/shared/i18n/I18nContext';

export function DashboardMyTasksWidget() {
  const { hasPermission } = usePortalAuth();
  const { tr } = useI18n();
  const canReadTasks = hasPermission('pm.tasks.read');

  const [data, setData] = useState<MyTasksGroupedView | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!canReadTasks) return;
    const controller = new AbortController();
    void (async () => {
      try {
        const res = await fetch('/api/v1/tasks/my', { signal: controller.signal });
        const json = (await res.json().catch(() => null)) as {
          success?: boolean;
          data?: MyTasksGroupedView;
        } | null;
        if (res.ok && json?.success && json.data) {
          setData(json.data);
        }
      } catch {
        // Non-blocking widget
      } finally {
        setIsLoading(false);
      }
    })();
    return () => controller.abort();
  }, [canReadTasks]);

  if (!canReadTasks) return null;

  const urgentItems = data
    ? [...data.overdue, ...data.today, ...data.thisWeek].slice(0, 5)
    : [];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <IconListCheck size={18} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              {tr('Công việc dự án của tôi', 'My Project Tasks')}
            </h3>
            <p className="text-xs text-slate-500">
              {data
                ? `${data.summary.totalAssignedOpen} ${tr('đang mở', 'open')} • ${data.summary.overdueCount} ${tr('quá hạn', 'overdue')}`
                : tr('Theo dõi việc đến hạn trong tuần', 'Track upcoming deadlines this week')}
            </p>
          </div>
        </div>
        <Link
          href="/my/tasks"
          className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
        >
          {tr('Xem tất cả', 'View all')}
          <IconArrowRight size={14} />
        </Link>
      </div>

      {isLoading ? (
        <SkeletonListRows rows={3} compact className="mt-3" />
      ) : urgentItems.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-slate-200 px-4 py-5 text-center text-xs text-slate-500">
          {tr('Hiện không có công việc dự án nào sắp đến hạn.', 'No upcoming project tasks due soon.')}
        </div>
      ) : (
        <div className="mt-4 divide-y divide-slate-100">
          {urgentItems.map((t) => (
            <Link
              key={t.id}
              href={`/projects/${t.projectCode}?taskId=${t.id}`}
              className="flex items-center justify-between gap-3 py-2.5 text-xs hover:text-blue-700"
            >
              <div className="min-w-0">
                <span className="mr-1.5 font-mono font-bold text-slate-500">{t.taskKey}</span>
                <span className="truncate font-medium text-slate-800">{t.title}</span>
              </div>
              <span className="shrink-0 text-[11px] font-medium text-slate-500">
                {t.dueDate ? formatDateVN(t.dueDate) : '—'}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
