'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  IconAlertTriangle,
  IconBriefcase,
  IconCash,
  IconCheck,
  IconClockHour8,
  IconDownload,
} from '@tabler/icons-react';
import { usePortalAuth } from '@/components/portal/PortalAuthContext';
import { SkeletonDashboard } from '@/components/ui/Skeleton';
import { PROJECT_HEALTH_META, pickLabel } from '@/components/projects/project-ui-helpers';
import { formatVND } from '@/lib/portable/currency-utils';
import type { PortfolioDashboardSummary } from '@/modules/projects/reports.service';
import { useI18n } from '@/shared/i18n/I18nContext';

export default function PortfolioDashboardPage() {
  const { selectedBranchId } = usePortalAuth();
  const { locale, tr } = useI18n();
  const [summary, setSummary] = useState<PortfolioDashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const qs = selectedBranchId ? `?branchId=${selectedBranchId}` : '';
        const res = await fetch(`/api/v1/pm/dashboard/summary${qs}`, {
          signal: controller.signal,
        });
        const json = (await res.json().catch(() => null)) as {
          success?: boolean;
          data?: PortfolioDashboardSummary;
          error?: { message?: string };
        } | null;
        if (!res.ok || !json?.success || !json.data) {
          throw new Error(
            json?.error?.message ??
              tr('Không thể tải Dashboard Danh mục Dự án.', 'Unable to load Portfolio Dashboard.'),
          );
        }
        setSummary(json.data);
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : tr('Lỗi kết nối.', 'Network error.'));
      } finally {
        setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [selectedBranchId, tr]);

  if (loading) {
    return <SkeletonDashboard />;
  }

  if (error || !summary) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center text-sm font-medium text-rose-700">
        {error ?? tr('Không có dữ liệu Dashboard.', 'No dashboard data available.')}
      </div>
    );
  }

  const exportQs = selectedBranchId ? `?branchId=${selectedBranchId}` : '';

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            {tr('Dashboard Tổng quan Danh mục Dự án', 'Executive Portfolio Dashboard')}
          </h1>
          <p className="text-xs text-slate-500">
            {tr(
              'Theo dõi sức khỏe RAG, tiến độ giao hàng đúng hạn, tỉ lệ giải ngân và điểm nóng rủi ro toàn doanh nghiệp.',
              'Monitor RAG health, on-time delivery, budget burn rate, and risk hotspots across projects.',
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`/api/v1/pm/reports/portfolio/export${exportQs}`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <IconDownload size={15} />
            {tr('Xuất Excel Portfolio', 'Export Portfolio Excel')}
          </a>
          <Link
            href="/projects"
            className="rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700"
          >
            {tr('Mở Danh mục Dự án', 'Open Portfolio')}
          </Link>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>{tr('Dự án đang chạy', 'Active Projects')}</span>
            <IconBriefcase size={16} className="text-blue-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {summary.totals.activeProjects}{' '}
            <span className="text-xs font-normal text-slate-400">/ {summary.totals.totalProjects}</span>
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>{tr('Hoàn thành đúng hạn', 'On-Time Delivery')}</span>
            <IconCheck size={16} className="text-emerald-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-emerald-700">{summary.totals.onTimeRatePercent}%</p>
          <p className="text-[11px] text-slate-400">
            {summary.totals.completedTasks}/{summary.totals.totalTasks} {tr('việc', 'tasks')} •{' '}
            {summary.totals.overdueTasks} {tr('quá hạn', 'overdue')}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>{tr('Giải ngân Ngân sách', 'Budget Burn')}</span>
            <IconCash size={16} className="text-indigo-600" />
          </div>
          <p className="mt-2 text-xl font-bold text-slate-900">{summary.totals.budgetBurnPercent}%</p>
          <p className="truncate text-[11px] text-slate-400" title={formatVND(summary.totals.totalActualCost)}>
            {formatVND(summary.totals.totalActualCost)} / {formatVND(summary.totals.totalPlannedBudget)}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>{tr('Tổng giờ đã chấm', 'Total Logged Hours')}</span>
            <IconClockHour8 size={16} className="text-sky-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">{summary.totals.totalLoggedHours}h</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>{tr('Rủi ro nghiêm trọng', 'High Severity Risks')}</span>
            <IconAlertTriangle size={16} className="text-rose-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-rose-600">{summary.totals.highRiskCount}</p>
        </div>
      </div>

      {/* Charts & Risk Hotspots */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-6">
          <h3 className="mb-3 text-sm font-bold text-slate-900">
            {tr('Phân bổ Trạng thái Dự án & Velocity gần đây', 'Sprint Velocity Across Portfolio')}
          </h3>
          {summary.recentSprints.length === 0 ? (
            <div className="flex h-60 items-center justify-center text-xs text-slate-400">
              {tr('Chưa có dữ liệu Sprint hoàn thành.', 'No completed sprint metrics yet.')}
            </div>
          ) : (
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={summary.recentSprints}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="sprintName" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="committedPoints" name={tr('Cam kết', 'Committed')} fill="#93c5fd" />
                  <Bar dataKey="completedPoints" name={tr('Hoàn thành', 'Completed')} fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-6">
          <h3 className="mb-3 text-sm font-bold text-slate-900">
            {tr('Điểm nóng Rủi ro & Quá hạn theo Dự án', 'Project Risk & Overdue Hotspots')}
          </h3>
          {summary.topRiskProjects.length === 0 ? (
            <p className="py-10 text-center text-xs text-slate-400">
              {tr('Chưa có dự án nào.', 'No projects available.')}
            </p>
          ) : (
            <div className="divide-y divide-slate-100 text-xs">
              {summary.topRiskProjects.map((p) => (
                <div key={p.projectId} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <Link
                      href={`/projects/${p.projectCode}`}
                      className="font-semibold text-slate-900 hover:text-blue-600"
                    >
                      <span className="mr-1.5 font-mono text-slate-500">{p.projectCode}</span>
                      {p.projectName}
                    </Link>
                    <div className="mt-1 flex items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${PROJECT_HEALTH_META[p.healthStatus].cls}`}
                      >
                        {pickLabel(PROJECT_HEALTH_META[p.healthStatus], locale)}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {Math.round(p.progressPercent)}%
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="rounded-lg bg-rose-50 px-2 py-1 text-[11px] font-bold text-rose-700">
                      {p.openHighRisks} {tr('rủi ro cao', 'high risks')}
                    </span>
                    <span className="rounded-lg bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-800">
                      {p.overdueTasks} {tr('quá hạn', 'overdue')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
