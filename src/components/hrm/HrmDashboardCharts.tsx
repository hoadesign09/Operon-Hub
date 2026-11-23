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

function formatCompactMillions(value: number): string {
  if (Math.abs(value) >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(1)} tỷ`;
  }
  if (Math.abs(value) >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(0)} tr`;
  }
  return String(value);
}

export function HrmDashboardCharts({ visibility, charts, periodLabel }: HrmDashboardChartsProps) {
  const hasAnyChart =
    visibility.canViewWorkforce || visibility.canViewAttendance || visibility.canViewPayroll;

  if (!hasAnyChart) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      {/* 1. Headcount by Department */}
      {visibility.canViewWorkforce && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="text-sm font-bold text-slate-900">Phân bổ Nhân sự theo Phòng ban</h2>
            <p className="text-xs text-slate-500">Top 8 phòng ban có nhân sự đang làm việc</p>
          </div>
          {charts.headcountByDepartment.length === 0 ? (
            <div className="flex h-60 items-center justify-center rounded-xl border border-dashed border-slate-200 text-xs text-slate-400">
              Chưa có dữ liệu phân bổ phòng ban trong phạm vi này.
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
                    formatter={(value) => [`${Number(value ?? 0)} nhân sự`, 'Số lượng']}
                    labelFormatter={(_label, payload) => {
                      const item = payload?.[0]?.payload as { departmentName?: string } | undefined;
                      return item?.departmentName ?? String(_label ?? '');
                    }}
                  />
                  <Bar dataKey="count" name="Nhân sự" fill="#2563eb" radius={[6, 6, 0, 0]} maxBarSize={44} />
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
            <h2 className="text-sm font-bold text-slate-900">Cơ cấu Trạng thái Lao động</h2>
            <p className="text-xs text-slate-500">
              Tỷ trọng nhân sự chính thức, thử việc, nghỉ dài hạn & thôi việc
            </p>
          </div>
          {charts.headcountByStatus.length === 0 ? (
            <div className="flex h-60 items-center justify-center rounded-xl border border-dashed border-slate-200 text-xs text-slate-400">
              Chưa có dữ liệu trạng thái nhân sự.
            </div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={charts.headcountByStatus}
                    dataKey="count"
                    nameKey="label"
                    cx="50%"
                    cy="48%"
                    innerRadius={52}
                    outerRadius={86}
                    paddingAngle={3}
                  >
                    {charts.headcountByStatus.map((entry) => (
                      <Cell
                        key={entry.status}
                        fill={STATUS_COLORS[entry.status] ?? '#64748b'}
                      />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`${Number(value ?? 0)} nhân sự`, 'Số lượng']} />
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
              Phân bổ Chấm công ({periodLabel})
            </h2>
            <p className="text-xs text-slate-500">
              Số lượt ghi nhận theo trạng thái đúng giờ, đi muộn, phép, lễ & vắng
            </p>
          </div>
          {charts.attendanceBreakdown.every((item) => item.count === 0) ? (
            <div className="flex h-60 items-center justify-center rounded-xl border border-dashed border-slate-200 text-xs text-slate-400">
              Chưa có lượt chấm công nào phát sinh trong {periodLabel}.
            </div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={charts.attendanceBreakdown}
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
                  <Tooltip formatter={(value) => [`${Number(value ?? 0)} lượt`, 'Ghi nhận']} />
                  <Bar dataKey="count" name="Lượt công" radius={[6, 6, 0, 0]} maxBarSize={44}>
                    {charts.attendanceBreakdown.map((entry) => (
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
            <h2 className="text-sm font-bold text-slate-900">Xu hướng Quỹ lương (6 kỳ gần nhất)</h2>
            <p className="text-xs text-slate-500">So sánh tổng Gross & tổng Thực lĩnh (Net)</p>
          </div>
          {charts.payrollTrend.length === 0 ? (
            <div className="flex h-60 items-center justify-center rounded-xl border border-dashed border-slate-200 text-xs text-slate-400">
              Chưa có kỳ lương nào được tạo trong phạm vi chi nhánh hiện tại.
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
                      name === 'totalGross' ? 'Tổng Gross' : 'Tổng Thực lĩnh (Net)',
                    ]}
                  />
                  <Legend
                    formatter={(value) =>
                      value === 'totalGross' ? 'Tổng Gross' : 'Tổng Thực lĩnh (Net)'
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
