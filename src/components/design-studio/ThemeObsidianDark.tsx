'use client';

import { useState } from 'react';
import {
  IconActivity,
  IconAlertTriangle,
  IconBell,
  IconBuildingSkyscraper,
  IconCalendarTime,
  IconCash,
  IconCheck,
  IconChecklist,
  IconClockCheck,
  IconCommand,
  IconDeviceLaptop,
  IconFileCertificate,
  IconHierarchy2,
  IconIdBadge2,
  IconLayoutDashboard,
  IconSearch,
  IconSparkles,
  IconUsers,
  IconX,
} from '@tabler/icons-react';
import {
  SHOWCASE_APPROVALS,
  SHOWCASE_BRANCHES,
  SHOWCASE_CONTRACT_ALERTS,
  SHOWCASE_DEPARTMENTS,
  SHOWCASE_MEETINGS,
  SHOWCASE_PAYROLL_TREND,
} from './showcase-data';

export function ThemeObsidianDark() {
  const [branchId, setBranchId] = useState<string>('all');
  const [activeNav, setActiveNav] = useState<string>('dashboard');
  const [resolvedIds, setResolvedIds] = useState<string[]>([]);

  const branch = SHOWCASE_BRANCHES.find((b) => b.id === branchId) ?? SHOWCASE_BRANCHES[0];
  const pending = SHOWCASE_APPROVALS.filter((a) => !resolvedIds.includes(a.id));
  const maxGross = Math.max(...SHOWCASE_PAYROLL_TREND.map((item) => item.grossMillion));

  return (
    <div className="flex min-h-[820px] gap-3 bg-[#090A0F] p-3 text-slate-100">
      {/* Floating Inset Obsidian Sidebar */}
      <aside className="hidden w-[248px] shrink-0 flex-col rounded-2xl border border-white/8 bg-[#11131B] lg:flex">
        <div className="flex h-16 items-center justify-between border-b border-white/8 px-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-tr from-violet-600 to-teal-400 text-white shadow-md shadow-violet-500/20">
              <IconBuildingSkyscraper size={17} />
            </div>
            <div>
              <p className="text-xs font-bold tracking-tight text-white">Operon Hub</p>
              <p className="text-[10px] text-slate-400">Ops Cockpit • Dark Pro</p>
            </div>
          </div>
          <span className="rounded-md bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-violet-300 ring-1 ring-violet-500/30">
            v2
          </span>
        </div>

        <div className="p-3">
          <div className="flex items-center justify-between rounded-xl border border-white/8 bg-[#0B0D13] px-3 py-2 text-xs text-slate-400">
            <span className="flex items-center gap-2">
              <IconSearch size={14} />
              Tìm nhanh...
            </span>
            <span className="inline-flex items-center gap-0.5 rounded bg-white/8 px-1.5 py-0.5 text-[10px] text-slate-300">
              <IconCommand size={10} />K
            </span>
          </div>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-2">
          <div className="space-y-1">
            <p className="px-2.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              Điều hành
            </p>
            {[
              { id: 'dashboard', label: 'Trung tâm Tổng quan', icon: IconLayoutDashboard },
              { id: 'approvals', label: 'Phê duyệt nhanh', icon: IconChecklist, badge: pending.length },
              { id: 'org', label: 'Cơ cấu & Nhân sự', icon: IconHierarchy2 },
              { id: 'employees', label: 'Hồ sơ 360°', icon: IconIdBadge2 },
              { id: 'contracts', label: 'Hợp đồng & Cảnh báo', icon: IconFileCertificate, badge: 3 },
              { id: 'attendance', label: 'Chấm công', icon: IconClockCheck },
              { id: 'payroll', label: 'Kỳ lương & Phiếu lương', icon: IconCash },
              { id: 'assets', label: 'Tài sản & Phòng họp', icon: IconDeviceLaptop },
            ].map((item) => {
              const Icon = item.icon;
              const isActive = activeNav === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveNav(item.id)}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-medium transition ${
                    isActive
                      ? 'bg-violet-500/15 text-white ring-1 ring-violet-400/30'
                      : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <Icon size={16} className={isActive ? 'text-violet-400' : 'text-slate-500'} />
                    {item.label}
                  </span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="rounded-md bg-violet-500/20 px-1.5 py-0.5 text-[10px] font-bold text-violet-300">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="rounded-xl border border-teal-500/20 bg-teal-500/8 p-3">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-teal-300">
              <IconSparkles size={14} />
              CRM Module Ready
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
              Kiến trúc Plug-in sẵn sàng kích hoạt CRM & Kế toán không chạm Core.
            </p>
          </div>
        </nav>

        <div className="border-t border-white/8 p-3">
          <div className="flex items-center gap-2.5 rounded-xl bg-white/4 p-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600/30 text-xs font-bold text-violet-200">
              TA
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-white">Nguyễn Tuấn Anh</p>
              <p className="truncate text-[10px] text-slate-400">SUPER_ADMIN • ALL</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Elevated Dark Workspace */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/8 bg-[#11131B]">
        <header className="flex h-16 items-center justify-between gap-4 border-b border-white/8 px-6">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-2 w-2 rounded-full bg-teal-400 shadow-[0_0_8px_#2dd4bf]" />
            <h1 className="text-sm font-semibold text-white">
              Operon Ops Cockpit • Tháng 11/2026
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              aria-label="Chọn chi nhánh"
              className="rounded-lg border border-white/10 bg-[#1A1D29] px-3 py-1.5 text-xs font-medium text-slate-200 focus:border-violet-400 focus:outline-none"
            >
              {SHOWCASE_BRANCHES.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="relative rounded-lg border border-white/10 bg-[#1A1D29] p-2 text-slate-300 hover:bg-white/10"
              aria-label="Thông báo"
            >
              <IconBell size={16} />
              <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-violet-400" />
            </button>
          </div>
        </header>

        <main className="flex-1 space-y-5 p-6">
          {/* Dark Glowing Metric Cards */}
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: 'Nhân sự Active', val: `${branch.headcount}`, note: '+6 mới gia nhập', icon: IconUsers, glow: 'text-violet-400' },
              { label: 'Chuyên cần T11', val: branch.activeRate, note: 'Ổn định toàn hệ thống', icon: IconActivity, glow: 'text-teal-400' },
              { label: 'Quỹ lương dự chi', val: branch.payrollVnd, note: 'Đã tính xong 148 phiếu', icon: IconCash, glow: 'text-sky-400' },
              { label: 'Cảnh báo cần xử lý', val: `${pending.length + SHOWCASE_CONTRACT_ALERTS.length}`, note: `${pending.length} đơn + 3 HĐ`, icon: IconAlertTriangle, glow: 'text-amber-400' },
            ].map((kpi) => {
              const Icon = kpi.icon;
              return (
                <div
                  key={kpi.label}
                  className="rounded-2xl border border-white/8 bg-[#171A24] p-5 transition hover:border-violet-500/40"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-400">{kpi.label}</span>
                    <Icon size={17} className={kpi.glow} />
                  </div>
                  <p className="mt-3 text-2xl font-bold tracking-tight text-white tabular-nums">
                    {kpi.val}
                  </p>
                  <p className="mt-1.5 text-[11px] text-slate-400">{kpi.note}</p>
                </div>
              );
            })}
          </section>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
            {/* Dark Trend Chart + Dept Bars */}
            <div className="space-y-5 xl:col-span-7">
              <div className="rounded-2xl border border-white/8 bg-[#171A24] p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-white">
                      Biểu đồ Quỹ lương 6 Kỳ (Triệu VNĐ)
                    </h2>
                    <p className="text-[11px] text-slate-400">
                      Gross (Tím Violet) vs Thực lĩnh Net (Ngọc Teal)
                    </p>
                  </div>
                  <span className="rounded-md bg-teal-500/15 px-2 py-0.5 text-[11px] font-semibold text-teal-300">
                    +13,1% / 6 tháng
                  </span>
                </div>

                <div className="mt-6 grid grid-cols-6 items-end gap-3">
                  {SHOWCASE_PAYROLL_TREND.map((p) => {
                    const gH = Math.round((p.grossMillion / maxGross) * 130);
                    const nH = Math.round((p.netMillion / maxGross) * 130);
                    return (
                      <div key={p.period} className="flex flex-col items-center gap-2">
                        <span className="text-[10px] text-slate-400 tabular-nums">
                          {p.grossMillion}
                        </span>
                        <div className="flex h-[138px] items-end gap-1.5">
                          <div
                            style={{ height: `${gH}px` }}
                            className="w-4 rounded-t-md bg-gradient-to-t from-violet-600 to-violet-400 shadow-[0_0_12px_rgba(139,92,246,0.35)]"
                          />
                          <div
                            style={{ height: `${nH}px` }}
                            className="w-4 rounded-t-md bg-gradient-to-t from-teal-600 to-teal-300 shadow-[0_0_12px_rgba(20,184,166,0.3)]"
                          />
                        </div>
                        <span className="text-xs font-medium text-slate-300">{p.period}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-2xl border border-white/8 bg-[#171A24] p-5">
                <h2 className="text-sm font-semibold text-white">Hiệu suất Chuyên cần Phòng ban</h2>
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {SHOWCASE_DEPARTMENTS.slice(0, 4).map((d) => (
                    <div
                      key={d.name}
                      className="rounded-xl border border-white/6 bg-[#11131B] p-3.5"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-slate-200">{d.shortName}</span>
                        <span className="font-bold text-teal-400 tabular-nums">
                          {d.attendanceRate}%
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-500">{d.headcount} nhân sự</p>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/8">
                        <div
                          style={{ width: `${d.attendanceRate}%` }}
                          className="h-full rounded-full bg-gradient-to-r from-violet-500 to-teal-400"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right: Action Queue & Room Radar */}
            <div className="space-y-5 xl:col-span-5">
              <div className="rounded-2xl border border-white/8 bg-[#171A24] p-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-white">
                    Hàng đợi Phê duyệt ({pending.length})
                  </h2>
                  {resolvedIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setResolvedIds([])}
                      className="text-[11px] text-violet-400 hover:underline"
                    >
                      Đặt lại
                    </button>
                  )}
                </div>
                <div className="mt-3 space-y-2.5">
                  {pending.length === 0 ? (
                    <p className="rounded-xl bg-teal-500/10 p-4 text-center text-xs text-teal-300">
                      Hộp thư phê duyệt đã sạch.
                    </p>
                  ) : (
                    pending.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-xl border border-white/8 bg-[#11131B] p-3.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-white">{item.requester}</span>
                          <span className="rounded bg-violet-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-violet-300">
                            {item.type}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] text-slate-400">{item.summary}</p>
                        <div className="mt-3 flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setResolvedIds((p) => [...p, item.id])}
                            className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-slate-300 hover:border-rose-400/50 hover:text-rose-300"
                          >
                            <IconX size={12} />
                            Từ chối
                          </button>
                          <button
                            type="button"
                            onClick={() => setResolvedIds((p) => [...p, item.id])}
                            className="inline-flex items-center gap-1 rounded-lg bg-violet-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-violet-500"
                          >
                            <IconCheck size={12} />
                            Duyệt
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-white/8 bg-[#171A24] p-5">
                <div className="flex items-center gap-2 text-xs font-semibold text-white">
                  <IconCalendarTime size={16} className="text-teal-400" />
                  Phòng họp hôm nay
                </div>
                <div className="mt-3 space-y-2.5">
                  {SHOWCASE_MEETINGS.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between gap-3 rounded-xl bg-[#11131B] px-3 py-2.5 text-xs"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-200">{m.title}</p>
                        <p className="text-[10px] text-slate-500">{m.room}</p>
                      </div>
                      <span className="shrink-0 rounded-md bg-white/6 px-2 py-1 text-[10px] font-semibold text-teal-300 tabular-nums">
                        {m.timeRange}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
