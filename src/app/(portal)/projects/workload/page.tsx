'use client';

import { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import { IconRefresh } from '@tabler/icons-react';
import { usePortalAuth } from '@/components/portal/PortalAuthContext';
import { WorkloadHeatmap } from '@/components/projects/WorkloadHeatmap';
import { SkeletonGanttChart, SkeletonKpiGrid } from '@/components/ui/Skeleton';
import type { WorkloadMatrixResult } from '@/lib/portable/workload-calculator';
import { useI18n } from '@/shared/i18n/I18nContext';

export default function ProjectWorkloadPage() {
  const { selectedBranchId } = usePortalAuth();
  const { tr } = useI18n();
  const [startDate, setStartDate] = useState(() => dayjs().format('YYYY-MM-DD'));
  const [endDate, setEndDate] = useState(() => dayjs().add(13, 'day').format('YYYY-MM-DD'));
  const [matrix, setMatrix] = useState<WorkloadMatrixResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      setLoading(true);
      try {
        const qs = new URLSearchParams({ startDate, endDate });
        if (selectedBranchId) qs.set('branchId', String(selectedBranchId));
        const res = await fetch(`/api/v1/pm/workload?${qs.toString()}`, {
          signal: controller.signal,
        });
        const json = (await res.json().catch(() => null)) as {
          success?: boolean;
          data?: WorkloadMatrixResult;
        } | null;
        if (json?.success && json.data) {
          setMatrix(json.data);
        }
      } catch {
        // Ignore abort
      } finally {
        setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [startDate, endDate, selectedBranchId, reloadTick]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            {tr('Bản đồ Phân bổ Nguồn lực (Workload Heatmap)', 'Resource Workload Heatmap')}
          </h1>
          <p className="text-xs text-slate-500">
            {tr(
              'Tích hợp trực tiếp ngày lễ và đơn nghỉ phép đã duyệt từ HRM để cảnh báo quá tải nguồn lực chính xác.',
              'Integrated directly with HRM holidays and approved leaves for accurate team capacity planning.',
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs"
          />
          <span className="text-xs text-slate-400">→</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs"
          />
          <button
            type="button"
            onClick={() => setReloadTick((n) => n + 1)}
            className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50"
            title={tr('Làm mới', 'Refresh')}
          >
            <IconRefresh size={15} />
          </button>
        </div>
      </div>

      {matrix ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">{tr('Nhân sự theo dõi', 'Tracked Staff')}</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{matrix.summary.employeeCount}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">{tr('Hiệu suất trung bình', 'Avg Utilization')}</p>
            <p className="mt-1 text-2xl font-bold text-blue-700">
              {matrix.summary.averageUtilizationPercent}%
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">{tr('Nhân sự quá tải (>100%)', 'Overloaded Staff')}</p>
            <p className="mt-1 text-2xl font-bold text-rose-600">
              {matrix.summary.overloadedEmployeeCount}
            </p>
          </div>
        </div>
      ) : loading ? (
        <SkeletonKpiGrid
          count={3}
          compact
          columnsClass="grid-cols-1 gap-3 sm:grid-cols-3"
        />
      ) : null}

      {loading || !matrix ? (
        <SkeletonGanttChart rows={6} />
      ) : (
        <WorkloadHeatmap matrix={matrix} />
      )}
    </div>
  );
}
