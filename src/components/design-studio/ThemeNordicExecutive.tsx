'use client';

import { useState } from 'react';
import {
  IconArrowUpRight,
  IconBell,
  IconBuildingSkyscraper,
  IconCalendarEvent,
  IconCash,
  IconCheck,
  IconChecklist,
  IconChevronRight,
  IconClockCheck,
  IconCommand,
  IconDeviceLaptop,
  IconFileCertificate,
  IconHierarchy2,
  IconIdBadge2,
  IconLayoutDashboard,
  IconSearch,
  IconSettings,
  IconSpeakerphone,
  IconSparkles,
  IconUserCircle,
  IconUsers,
  IconX,
} from '@tabler/icons-react';
import {
  SHOWCASE_ANNOUNCEMENTS,
  SHOWCASE_APPROVALS,
  SHOWCASE_BRANCHES,
  SHOWCASE_CONTRACT_ALERTS,
  SHOWCASE_DEPARTMENTS,
  SHOWCASE_MEETINGS,
  SHOWCASE_PAYROLL_TREND,
} from './showcase-data';

export function ThemeNordicExecutive() {
  const [branchId, setBranchId] = useState<string>('all');
  const [activeNav, setActiveNav] = useState<string>('dashboard');
  const [handledIds, setHandledIds] = useState<Record<string, 'APPROVED' | 'REJECTED'>>({});
  const [searchQuery, setSearchQuery] = useState<string>('');

  const branch = SHOWCASE_BRANCHES.find((b) => b.id === branchId) ?? SHOWCASE_BRANCHES[0];
  const pendingApprovals = SHOWCASE_APPROVALS.filter((item) => !handledIds[item.id]);
  const maxGross = Math.max(...SHOWCASE_PAYROLL_TREND.map((p) => p.grossMillion));

  function handleDecision(id: string, status: 'APPROVED' | 'REJECTED') {
    setHandledIds((prev) => ({ ...prev, [id]: status }));
  }

  return (
    <div className="flex min-h-[820px] bg-[#F8FAFC] text-slate-900">
      {/* Slim Nordic Sidebar */}
      <aside className="hidden w-[252px] shrink-0 flex-col border-r border-slate-200/80 bg-[#FCFCFD] lg:flex">
        <div className="flex h-16 items-center gap-3 border-b border-slate-200/70 px-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-xs">
            <IconBuildingSkyscraper size={17} />
          </div>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold tracking-tight text-slate-900">
              Operon Hub
            </p>
            <p className="truncate text-[11px] text-slate-500">Workspace • SME Portal</p>
          </div>
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
          <div className="space-y-0.5">
            <p className="px-2.5 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
              Không gian làm việc
            </p>
            {[
              { id: 'dashboard', label: 'Tổng quan Portal', icon: IconLayoutDashboard },
              {
                id: 'approvals',
                label: 'Hộp thư Phê duyệt',
                icon: IconChecklist,
                badge: pendingApprovals.length,
              },
              { id: 'ess', label: 'Cá nhân (ESS)', icon: IconUserCircle },
            ].map((item) => {
              const Icon = item.icon;
              const isActive = activeNav === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveNav(item.id)}
                  className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-[13px] font-medium transition ${
                    isActive
                      ? 'bg-indigo-50/90 text-indigo-700'
                      : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <Icon size={16} className={isActive ? 'text-indigo-600' : 'text-slate-400'} />
                    {item.label}
                  </span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="rounded-full bg-indigo-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="space-y-0.5">
            <p className="px-2.5 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
              Hành chính Nhân sự
            </p>
            {[
              { id: 'org', label: 'Cơ cấu tổ chức', icon: IconHierarchy2 },
              { id: 'employees', label: 'Hồ sơ Nhân viên', icon: IconIdBadge2 },
              { id: 'contracts', label: 'Hợp đồng lao động', icon: IconFileCertificate, badge: 3 },
              { id: 'attendance', label: 'Chấm công & Ca làm', icon: IconClockCheck },
              { id: 'payroll', label: 'Tính lương & Phiếu lương', icon: IconCash },
              { id: 'office', label: 'Tài sản & Phòng họp', icon: IconDeviceLaptop },
            ].map((item) => {
              const Icon = item.icon;
              const isActive = activeNav === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveNav(item.id)}
                  className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-[13px] font-medium transition ${
                    isActive
                      ? 'bg-indigo-50/90 text-indigo-700'
                      : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <Icon size={16} className={isActive ? 'text-indigo-600' : 'text-slate-400'} />
                    {item.label}
                  </span>
                  {item.badge !== undefined && (
                    <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-amber-200/70">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="space-y-0.5">
            <p className="px-2.5 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
              Hệ sinh thái mở rộng
            </p>
            <div className="flex items-center justify-between rounded-lg px-2.5 py-2 text-[13px] text-slate-400">
              <span className="flex items-center gap-2.5">
                <IconSparkles size={16} />
                CRM Kinh doanh
              </span>
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                P2
              </span>
            </div>
            <button
              type="button"
              onClick={() => setActiveNav('settings')}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium text-slate-600 hover:bg-slate-100/80"
            >
              <IconSettings size={16} className="text-slate-400" />
              Cấu hình & Phân quyền
            </button>
          </div>
        </nav>

        <div className="border-t border-slate-200/70 p-3.5">
          <div className="flex items-center gap-3 rounded-xl bg-white p-2.5 ring-1 ring-slate-200/70">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">
              NT
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-slate-900">Nguyễn Tuấn Anh</p>
              <p className="truncate text-[11px] text-slate-500">Giám đốc Vận hành</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Glass Topbar */}
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-4 border-b border-slate-200/70 bg-white/85 px-6 backdrop-blur-md">
          <div className="relative max-w-md flex-1">
            <IconSearch
              size={15}
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm nhân viên, hợp đồng, phòng họp..."
              className="w-full rounded-lg border border-slate-200/90 bg-slate-50/70 py-1.5 pr-14 pl-9 text-xs text-slate-800 placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:outline-none"
            />
            <span className="pointer-events-none absolute top-1/2 right-2.5 inline-flex -translate-y-1/2 items-center gap-0.5 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-400">
              <IconCommand size={10} />K
            </span>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              aria-label="Chọn chi nhánh"
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 focus:border-indigo-500 focus:outline-none"
            >
              {SHOWCASE_BRANCHES.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="relative rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50"
              aria-label="Thông báo"
            >
              <IconBell size={16} />
              <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-indigo-600" />
            </button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1240px] flex-1 space-y-6 p-6 lg:p-8">
          {/* Clean Header */}
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-indigo-600">Kỳ vận hành Tháng 11 / 2026</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
                Tổng quan Điều hành Doanh nghiệp
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200/70">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Bảng công T11 đang mở
              </span>
            </div>
          </div>

          {/* 4 Minimalist KPI Cards */}
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              {
                label: 'Tổng nhân sự hoạt động',
                value: `${branch.headcount}`,
                delta: '+6 tháng này',
                sub: '3 phòng ban đang tuyển mới',
                icon: IconUsers,
              },
              {
                label: 'Tỷ lệ chuyên cần',
                value: branch.activeRate,
                delta: '+1.2% vs T10',
                sub: 'Đi muộn giảm 14% toàn khối',
                icon: IconClockCheck,
              },
              {
                label: 'Quỹ lương dự kiến T11',
                value: branch.payrollVnd,
                delta: 'Đã duyệt cấp 1',
                sub: 'Phát phiếu lương ngày 05/12',
                icon: IconCash,
              },
              {
                label: 'Đơn chờ tôi duyệt',
                value: `${pendingApprovals.length}`,
                delta: '1 đơn khẩn',
                sub: 'SLA trung bình 2,4 giờ',
                icon: IconChecklist,
              },
            ].map((kpi) => {
              const Icon = kpi.icon;
              return (
                <div
                  key={kpi.label}
                  className="rounded-xl border border-slate-200/80 bg-white p-5 transition hover:border-indigo-200 hover:shadow-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-500">{kpi.label}</span>
                    <Icon size={16} className="text-slate-400" />
                  </div>
                  <div className="mt-3 flex items-baseline gap-2.5">
                    <span className="text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">
                      {kpi.value}
                    </span>
                    <span className="text-[11px] font-medium text-emerald-600">{kpi.delta}</span>
                  </div>
                  <p className="mt-2 text-[11px] text-slate-400">{kpi.sub}</p>
                </div>
              );
            })}
          </section>

          {/* Main 2-column Grid */}
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
            {/* Left: Payroll Trend + Department Breakdown */}
            <div className="space-y-6 xl:col-span-7">
              <div className="rounded-xl border border-slate-200/80 bg-white p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">
                      Xu hướng Quỹ lương 6 kỳ gần nhất
                    </h2>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Đơn vị: Triệu VNĐ (Tổng Gross so với Thực lĩnh Net)
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-[11px] text-slate-500">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-indigo-500" />
                      Gross
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      Net
                    </span>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-6 items-end gap-3 pt-4">
                  {SHOWCASE_PAYROLL_TREND.map((item) => {
                    const grossHeight = Math.round((item.grossMillion / maxGross) * 140);
                    const netHeight = Math.round((item.netMillion / maxGross) * 140);
                    return (
                      <div key={item.period} className="flex flex-col items-center gap-2">
                        <span className="text-[10px] font-medium text-slate-400 tabular-nums">
                          {(item.grossMillion / 1000).toFixed(2)}t
                        </span>
                        <div className="flex h-[148px] items-end gap-1.5">
                          <div
                            style={{ height: `${grossHeight}px` }}
                            className="w-4 rounded-t-md bg-indigo-500/85 transition-all hover:bg-indigo-600"
                            title={`Gross ${item.period}: ${item.grossMillion} tr`}
                          />
                          <div
                            style={{ height: `${netHeight}px` }}
                            className="w-4 rounded-t-md bg-emerald-400/90 transition-all hover:bg-emerald-500"
                            title={`Net ${item.period}: ${item.netMillion} tr`}
                          />
                        </div>
                        <span className="text-xs font-medium text-slate-600">{item.period}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200/80 bg-white p-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-slate-900">
                    Cơ cấu Nhân sự & Chuyên cần theo Phòng ban
                  </h2>
                  <span className="text-xs font-medium text-indigo-600">Chi tiết →</span>
                </div>
                <div className="mt-4 divide-y divide-slate-100">
                  {SHOWCASE_DEPARTMENTS.map((dept) => (
                    <div key={dept.name} className="flex items-center justify-between gap-4 py-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-slate-800">{dept.name}</span>
                          <span className="text-slate-500 tabular-nums">
                            {dept.headcount} NV • {dept.attendanceRate}%
                          </span>
                        </div>
                        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                          <div
                            style={{ width: `${dept.budgetShare * 2.2}%` }}
                            className="h-full rounded-full bg-indigo-500"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right: Approval Queue + Expiring Contracts + Meetings */}
            <div className="space-y-6 xl:col-span-5">
              <div className="rounded-xl border border-slate-200/80 bg-white p-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-slate-900">
                    Phê duyệt nhanh ({pendingApprovals.length})
                  </h2>
                  {Object.keys(handledIds).length > 0 && (
                    <button
                      type="button"
                      onClick={() => setHandledIds({})}
                      className="text-[11px] font-medium text-indigo-600 hover:underline"
                    >
                      Khôi phục demo
                    </button>
                  )}
                </div>

                {pendingApprovals.length === 0 ? (
                  <div className="mt-4 rounded-lg bg-emerald-50/70 p-4 text-center text-xs text-emerald-700">
                    Bạn đã xử lý xong toàn bộ đơn chờ duyệt trong hộp thư.
                  </div>
                ) : (
                  <div className="mt-3 space-y-2.5">
                    {pendingApprovals.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-lg border border-slate-200/70 bg-slate-50/50 p-3 transition hover:bg-white"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-slate-900">
                                {item.requester}
                              </span>
                              <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700">
                                {item.type}
                              </span>
                            </div>
                            <p className="mt-1 text-[11px] text-slate-600">{item.summary}</p>
                          </div>
                          <span className="shrink-0 text-[10px] text-slate-400">
                            {item.submittedAt}
                          </span>
                        </div>
                        <div className="mt-2.5 flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleDecision(item.id, 'REJECTED')}
                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:border-rose-200 hover:text-rose-600"
                          >
                            <IconX size={12} />
                            Từ chối
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDecision(item.id, 'APPROVED')}
                            className="inline-flex items-center gap-1 rounded-md bg-indigo-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-indigo-700"
                          >
                            <IconCheck size={12} />
                            Duyệt ngay
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-slate-200/80 bg-white p-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-slate-900">
                    Hợp đồng sắp hết hạn (≤30 ngày)
                  </h2>
                  <IconArrowUpRight size={15} className="text-slate-400" />
                </div>
                <div className="mt-3 space-y-2">
                  {SHOWCASE_CONTRACT_ALERTS.map((contract) => (
                    <div
                      key={contract.id}
                      className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-xs"
                    >
                      <div>
                        <p className="font-medium text-slate-800">{contract.employeeName}</p>
                        <p className="text-[11px] text-slate-400">
                          {contract.contractType} • Hết hạn {contract.endDate}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${
                          contract.daysLeft <= 7
                            ? 'bg-rose-50 text-rose-700'
                            : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        Còn {contract.daysLeft} ngày
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200/80 bg-white p-4">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-900">
                    <IconCalendarEvent size={15} className="text-indigo-600" />
                    Phòng họp hôm nay
                  </div>
                  <div className="mt-3 space-y-2">
                    {SHOWCASE_MEETINGS.slice(0, 2).map((m) => (
                      <div key={m.id} className="text-[11px]">
                        <p className="font-medium text-slate-800">{m.timeRange}</p>
                        <p className="truncate text-slate-500">{m.title}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200/80 bg-white p-4">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-900">
                    <IconSpeakerphone size={15} className="text-amber-600" />
                    Thông báo nội bộ
                  </div>
                  <div className="mt-3 space-y-2">
                    {SHOWCASE_ANNOUNCEMENTS.map((a) => (
                      <div key={a.id} className="flex items-start justify-between gap-2 text-[11px]">
                        <p className="line-clamp-2 text-slate-700">{a.title}</p>
                        <IconChevronRight size={13} className="mt-0.5 shrink-0 text-slate-400" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
