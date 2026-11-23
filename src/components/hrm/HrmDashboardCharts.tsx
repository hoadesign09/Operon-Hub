'use client';

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatVND } from '@/lib/portable/currency-utils';
import type { DashboardSummaryData } from '@/modules/hrm/dashboard/dashboard.service';
import { useI18n } from '@/shared/i18n/I18nContext';
import type { TranslationKey } from '@/shared/i18n/translator';

interface HrmDashboardChartsProps {
  visibility: DashboardSummaryData['visibility'];
  charts: DashboardSummaryData['charts'];
  periodLabel: string;
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: '#2563eb',
  PROBATION: '#0ea5e9',
  ON_LEAVE: '#6366f1',
  RESIGNED: '#94a3b8',
  TERMINATED: '#e11d48',
};

const ATTENDANCE_COLORS: Record<string, string> = {
  PRESENT: '#0ea5e9',
  LATE: '#f59e0b',
  LEAVE: '#2563eb',
  HOLIDAY: '#6366f1',
  ABSENT: '#e11d48',
};

const EMP_STATUS_KEYS: Record<string, TranslationKey> = {
  ACTIVE: 'charts.empStatus.ACTIVE',
  PROBATION: 'charts.empStatus.PROBATION',
  ON_LEAVE: 'charts.empStatus.ON_LEAVE',
  RESIGNED: 'charts.empStatus.RESIGNED',
  TERMINATED: 'charts.empStatus.TERMINATED',
};

const ATT_STATUS_KEYS: Record<string, TranslationKey> = {
  PRESENT: 'charts.attStatus.PRESENT',
  LATE: 'charts.attStatus.LATE',
  LEAVE: 'charts.attStatus.LEAVE',
  HOLIDAY: 'charts.attStatus.HOLIDAY',
  ABSENT: 'charts.attStatus.ABSENT',
};

export function HrmDashboardCharts({ visibility, charts, periodLabel }: HrmDashboardChartsProps) {
  const { t } = useI18n();
  const hasAnyChart =
    visibility.canViewWorkforce || visibility.canViewAttendance || visibility.canViewPayroll;

  if (!hasAnyChart) {
    return null;
  }

  function formatCompactMillions(value: number): string {
    if (Math.abs(value) >= 1_000_000_000) {
      return t('charts.compact.billion', { value: (value / 1_000_000_000).toFixed(1) });
    }
    if (Math.abs(value) >= 1_000_000) {
      return t('charts.compact.million', { value: (value / 1_000_000).toFixed(0) });
    }
    return String(value);
  }

  const localizedHeadcountStatus = charts.headcountByStatus.map((entry) => {
    const key = EMP_STATUS_KEYS[entry.status];
    return {
      ...entry,
      label: key ? t(key) : entry.label,
    };
  });

  const localizedAttendanceBreakdown = charts.attendanceBreakdown.map((entry) => {
    const key = ATT_STATUS_KEYS[entry.status];
    return {
      ...entry,
      label: key ? t(key) : entry.label,
    };
  });

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      {/* 1. Headcount by Department */}
      {visibility.canViewWorkforce && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="text-sm font-bold text-slate-900">{t('charts.headcountDept.title')}</h2>
            <p className="text-xs text-slate-500">{t('charts.headcountDept.subtitle')}</p>
          </div>
          {charts.headcountByDepartment.length === 0 ? (
            <div className="flex h-60 items-center justify-center rounded-xl border border-dashed border-slate-200 text-xs text-slate-400">
              {t('charts.headcountDept.empty')}
            </div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={charts.headcountByDepartment}
                  margin={{ top: 8, right: 16, left: -12, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="departmentCode"
                    tick={{ fontSize: 12, fill: '#475569' }}
                    axisLine={{ stroke: '#cbd5e1' }}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 12, fill: '#475569' }}
                    axisLine={{ stroke: '#cbd5e1' }}
                  />
                  <Tooltip
                    formatter={(value) => [
                      t('charts.headcountDept.unit', { count: Number(value ?? 0) }),
                      t('charts.headcountDept.label'),
                    ]}
                    labelFormatter={(_label, payload) => {
                      const item = payload?.[0]?.payload as { departmentName?: string } | undefined;
                      return item?.departmentName ?? String(_label ?? '');
                    }}
                  />
                  <Bar
                    dataKey="count"
                    name={t('charts.headcountDept.barName')}
                    fill="#2563eb"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={44}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* 2. Headcount by Employment Status */}
      {visibility.canViewWorkforce && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="text-sm font-bold text-slate-900">
              {t('charts.headcountStatus.title')}
            </h2>
            <p className="text-xs text-slate-500">{t('charts.headcountStatus.subtitle')}</p>
          </div>
          {localizedHeadcountStatus.length === 0 ? (
            <div className="flex h-60 items-center justify-center rounded-xl border border-dashed border-slate-200 text-xs text-slate-400">
              {t('charts.headcountStatus.empty')}
            </div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={localizedHeadcountStatus}
                    dataKey="count"
                    nameKey="label"
                    cx="50%"
                    cy="48%"
                    innerRadius={52}
                    outerRadius={86}
                    paddingAngle={3}
                  >
                    {localizedHeadcountStatus.map((entry) => (
                      <Cell
                        key={entry.status}
                        fill={STATUS_COLORS[entry.status] ?? '#64748b'}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => [
                      t('charts.headcountDept.unit', { count: Number(value ?? 0) }),
                      t('charts.headcountDept.label'),
                    ]}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* 3. Attendance Breakdown in Selected Month */}
      {visibility.canViewAttendance && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="text-sm font-bold text-slate-900">
              {t('charts.attendance.title', { period: periodLabel })}
            </h2>
            <p className="text-xs text-slate-500">{t('charts.attendance.subtitle')}</p>
          </div>
          {localizedAttendanceBreakdown.every((item) => item.count === 0) ? (
            <div className="flex h-60 items-center justify-center rounded-xl border border-dashed border-slate-200 text-xs text-slate-400">
              {t('charts.attendance.empty', { period: periodLabel })}
            </div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={localizedAttendanceBreakdown}
                  margin={{ top: 8, right: 16, left: -12, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 12, fill: '#475569' }}
                    axisLine={{ stroke: '#cbd5e1' }}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 12, fill: '#475569' }}
                    axisLine={{ stroke: '#cbd5e1' }}
                  />
                  <Tooltip
                    formatter={(value) => [
                      t('charts.attendance.unit', { count: Number(value ?? 0) }),
                      t('charts.attendance.label'),
                    ]}
                  />
                  <Bar
                    dataKey="count"
                    name={t('charts.attendance.barName')}
                    radius={[6, 6, 0, 0]}
                    maxBarSize={44}
                  >
                    {localizedAttendanceBreakdown.map((entry) => (
                      <Cell
                        key={entry.status}
                        fill={ATTENDANCE_COLORS[entry.status] ?? '#64748b'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* 4. Payroll Fund Trend (STRICTLY guarded by canViewPayroll) */}
      {visibility.canViewPayroll && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="text-sm font-bold text-slate-900">{t('charts.payroll.title')}</h2>
            <p className="text-xs text-slate-500">{t('charts.payroll.subtitle')}</p>
          </div>
          {charts.payrollTrend.length === 0 ? (
            <div className="flex h-60 items-center justify-center rounded-xl border border-dashed border-slate-200 text-xs text-slate-400">
              {t('charts.payroll.empty')}
            </div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={charts.payrollTrend}
                  margin={{ top: 8, right: 16, left: 6, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="periodLabel"
                    tick={{ fontSize: 12, fill: '#475569' }}
                    axisLine={{ stroke: '#cbd5e1' }}
                  />
                  <YAxis
                    tickFormatter={(v) => formatCompactMillions(Number(v ?? 0))}
                    tick={{ fontSize: 12, fill: '#475569' }}
                    axisLine={{ stroke: '#cbd5e1' }}
                  />
                  <Tooltip
                    formatter={(value, name) => [
                      formatVND(Number(value ?? 0)),
                      name === 'totalGross'
                        ? t('charts.payroll.totalGross')
                        : t('charts.payroll.totalNet'),
                    ]}
                  />
                  <Legend
                    formatter={(value) =>
                      value === 'totalGross'
                        ? t('charts.payroll.totalGross')
                        : t('charts.payroll.totalNet')
                    }
                    wrapperStyle={{ fontSize: '12px' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="totalGross"
                    stroke="#2563eb"
                    fill="#dbeafe"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="totalNet"
                    stroke="#10b981"
                    fill="#d1fae5"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
