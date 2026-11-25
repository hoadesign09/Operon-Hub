'use client';

import dayjs from 'dayjs';
import type {
  WorkloadDayCell,
  WorkloadMatrixResult,
} from '@/lib/portable/workload-calculator';
import { useI18n } from '@/shared/i18n/I18nContext';

interface WorkloadHeatmapProps {
  matrix: WorkloadMatrixResult;
}

function getCellClass(cell: WorkloadDayCell): string {
  if (cell.isWeekend || cell.isHoliday) {
    return 'bg-slate-100 text-slate-400';
  }
  if (cell.leaveHours > 0 && cell.capacityHours <= 0) {
    return 'bg-purple-100 text-purple-700';
  }
  switch (cell.heatLevel) {
    case 'OVERLOADED':
      return 'bg-rose-500 text-white font-bold';
    case 'OPTIMAL':
      return 'bg-emerald-500 text-white font-semibold';
    case 'UNDER':
      return 'bg-sky-100 text-sky-800 font-medium';
    case 'IDLE':
      return 'bg-white text-slate-400';
    default:
      return 'bg-slate-100 text-slate-400';
  }
}

export function WorkloadHeatmap({ matrix }: WorkloadHeatmapProps) {
  const { tr, ln } = useI18n();

  if (matrix.rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-xs text-slate-500">
        {tr(
          'Không có nhân sự nào trong phạm vi lọc hiện tại.',
          'No employees found for the selected workload scope.',
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-600">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-sky-100 ring-1 ring-sky-300" />
          {tr('< 60% (Còn tải)', '< 60% (Underutilized)')}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-emerald-500" />
          {tr('60–100% (Tối ưu)', '60–100% (Optimal)')}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-rose-500" />
          {tr('> 100% (Quá tải)', '> 100% (Overloaded)')}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-purple-100 ring-1 ring-purple-300" />
          {tr('Nghỉ phép HRM (Đã duyệt)', 'HRM Approved Leave')}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-slate-100 ring-1 ring-slate-300" />
          {tr('Cuối tuần / Lễ HRM', 'Weekend / HRM Holiday')}
        </span>
      </div>

      {/* Heatmap Matrix */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-600">
              <th className="sticky left-0 z-10 min-w-[200px] border-r border-slate-200 bg-slate-50 px-3 py-2.5">
                {tr('Nhân sự / Phòng ban', 'Employee / Department')}
              </th>
              <th className="min-w-[90px] border-r border-slate-200 px-2 py-2.5 text-center">
                {tr('Tổng tải', 'Utilization')}
              </th>
              {matrix.dates.map((d) => {
                const dt = dayjs(d);
                const isWknd = dt.day() === 0 || dt.day() === 6;
                return (
                  <th
                    key={d}
                    className={`min-w-[54px] border-r border-slate-100 px-1 py-2 text-center ${
                      isWknd ? 'bg-slate-100 text-slate-400' : ''
                    }`}
                  >
                    <div>{dt.format('DD/MM')}</div>
                    <div className="text-[9px] font-normal">{dt.format('dd')}</div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {matrix.rows.map((row) => (
              <tr key={row.employeeId} className="hover:bg-slate-50/50">
                <td className="sticky left-0 z-10 border-r border-slate-200 bg-white px-3 py-2">
                  <div className="font-semibold text-slate-900">{row.fullName}</div>
                  <div className="text-[10px] text-slate-500">
                    {row.employeeCode}
                    {row.departmentName
                      ? ` • ${ln(row.departmentName, row.departmentNameEn)}`
                      : ''}
                  </div>
                </td>
                <td className="border-r border-slate-200 px-2 py-2 text-center">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                      row.utilizationPercent > 100
                        ? 'bg-rose-100 text-rose-700'
                        : row.utilizationPercent >= 60
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-sky-50 text-sky-700'
                    }`}
                  >
                    {Math.round(row.utilizationPercent)}%
                  </span>
                  <div className="mt-0.5 text-[9px] text-slate-400">
                    {row.totalAllocatedHours}h / {row.totalCapacityHours}h
                  </div>
                </td>
                {row.days.map((cell) => {
                  const tooltip = [
                    `${cell.date}: ${cell.allocatedHours}h / ${cell.capacityHours}h (${Math.round(cell.utilizationPercent)}%)`,
                    cell.isHoliday ? tr('Ngày lễ HRM', 'HRM Holiday') : '',
                    cell.leaveHours > 0
                      ? `${tr('Nghỉ phép HRM', 'HRM Leave')}: ${cell.leaveHours}h`
                      : '',
                    ...cell.taskRefs.map((t) => `• ${t.taskKey} (${t.hours}h): ${t.title}`),
                  ]
                    .filter(Boolean)
                    .join('\n');

                  return (
                    <td
                      key={cell.date}
                      title={tooltip}
                      className={`border-r border-slate-100 px-1 py-2 text-center text-[11px] ${getCellClass(cell)}`}
                    >
                      {cell.isHoliday
                        ? tr('Lễ', 'Hol')
                        : cell.isWeekend
                          ? '—'
                          : cell.leaveHours > 0 && cell.capacityHours <= 0
                            ? tr('Phép', 'Off')
                            : cell.allocatedHours > 0
                              ? `${cell.allocatedHours}h`
                              : '0'}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
