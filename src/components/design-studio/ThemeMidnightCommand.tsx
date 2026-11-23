'use client';

import { useState } from 'react';
import {
  IconBell,
  IconBriefcase,
  IconBuildingSkyscraper,
  IconCalendarTime,
  IconCash,
  IconChartBar,
  IconCheck,
  IconChecklist,
  IconClockCheck,
  IconCoin,
  IconDeviceLaptop,
  IconFileCertificate,
  IconHierarchy2,
  IconIdBadge2,
  IconLayoutDashboard,
  IconSettings,
  IconSpeakerphone,
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

type AppModuleKey = 'hrm' | 'core' | 'crm' | 'finance';

const MODULE_RAIL: readonly {
  key: AppModuleKey;
  short: string;
  label: string;
  icon: typeof IconUsers;
  soon?: boolean;
}[] = [
  { key: 'hrm', short: 'HRM', label: 'Hành chính Nhân sự', icon: IconUsers },
  { key: 'core', short: 'Core', label: 'Nền tảng & Duyệt', icon: IconLayoutDashboard },
  { key: 'crm', short: 'CRM', label: 'Kinh doanh (P2)', icon: IconBriefcase, soon: true },
  { key: 'finance', short: 'FIN', label: 'Tài chính (P3)', icon: IconCoin, soon: true },
];

export function ThemeMidnightCommand() {
  const [activeModule, setActiveModule] = useState<AppModuleKey>('hrm');
  const [activeSub, setActiveSub] = useState<string>('dashboard');
  const [branchId, setBranchId] = useState<string>('all');
  const [handledIds, setHandledIds] = useState<Record<string, string>>({});

  const branch = SHOWCASE_BRANCHES.find((b) => b.id === branchId) ?? SHOWCASE_BRANCHES[0];
  const pending = SHOWCASE_APPROVALS.filter((a) => !handledIds[a.id]);

  return (
    <div className="flex min-h-[820px] bg-[#EEF2F6] text-slate-900">
      {/* Rail 1: Deep Midnight App Switcher */}
      <div className="hidden w-[68px] shrink-0 flex-col items-center justify-between bg-[#080E1A] py-4 text-slate-400 sm:flex">
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 text-white shadow-lg shadow-blue-500/20">
            <IconBuildingSkyscraper size={20} />
          </div>
          <div className="h-px w-8 bg-slate-800" />
          <div className="flex flex-col gap-2">
            {MODULE_RAIL.map((mod) => {
              const Icon = mod.icon;
              const isSelected = activeModule === mod.key;
              return (
                <button
                  key={mod.key}
                  type="button"
                  onClick={() => setActiveModule(mod.key)}
                  title={mod.label}
                  className={`group relative flex h-11 w-11 flex-col items-center justify-center rounded-xl transition ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                      : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
                  }`}
                >
                  <Icon size={18} />
                  <span className="mt-0.5 text-[9px] font-semibold tracking-wider">
                    {mod.short}
                  </span>
                  {mod.soon && (
                    <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-amber-400 ring-2 ring-[#080E1A]" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-800 hover:text-white"
          title="Cấu hình hệ thống"
        >
          <IconSettings size={18} />
        </button>
      </div>

      {/* Rail 2: Dark Slate Module Sub-Menu */}
      <aside className="hidden w-[224px] shrink-0 flex-col bg-[#0F172A] text-slate-200 lg:flex">
        <div className="flex h-16 flex-col justify-center border-b border-slate-800/90 px-4">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-cyan-400">
            Operon Command
          </span>
          <span className="truncate text-sm font-bold text-white">
            {MODULE_RAIL.find((m) => m.key === activeModule)?.label}
          </span>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {[
            { id: 'dashboard', label: 'Trung tâm Điều hành', icon: IconChartBar },
            { id: 'approvals', label: 'Phê duyệt tập trung', icon: IconChecklist, count: pending.length },
            { id: 'org', label: 'Sơ đồ tổ chức', icon: IconHierarchy2 },
            { id: 'employees', label: 'Hồ sơ nhân sự 360°', icon: IconIdBadge2 },
            { id: 'contracts', label: 'Hợp đồng & Gia hạn', icon: IconFileCertificate, count: 3 },
            { id: 'attendance', label: 'Chấm công tháng', icon: IconClockCheck },
            { id: 'payroll', label: 'Bảng lương & Thuế', icon: IconCash },
            { id: 'assets', label: 'Tài sản & Thiết bị', icon: IconDeviceLaptop },
            { id: 'rooms', label: 'Phòng họp & Thông báo', icon: IconCalendarTime },
          ].map((item) => {
            const Icon = item.icon;
            const active = activeSub === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveSub(item.id)}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-medium transition ${
                  active
                    ? 'bg-white/10 text-white ring-1 ring-white/15'
                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-100'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Icon size={16} className={active ? 'text-cyan-400' : 'text-slate-500'} />
                  {item.label}
                </span>
                {item.count !== undefined && item.count > 0 && (
                  <span className="rounded-md bg-cyan-500/20 px-1.5 py-0.5 text-[10px] font-bold text-cyan-300">
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-slate-800 p-3">
          <div className="rounded-xl bg-slate-800/70 p-3">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Phạm vi quyền</span>
              <span className="rounded bg-blue-500/20 px-1.5 py-0.5 font-semibold text-blue-300">
                ALL
              </span>
            </div>
            <p className="mt-1.5 truncate text-xs font-semibold text-white">Nguyễn Tuấn Anh</p>
            <p className="truncate text-[11px] text-slate-400">admin@operonhub.local</p>
          </div>
        </div>
      </aside>

      {/* Main High-Contrast Light Canvas with Bento Grid */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6">
          <div>
            <h1 className="text-base font-bold text-slate-900">
              Bảng Điều hành Nhân sự & Vận hành
            </h1>
            <p className="text-[11px] text-slate-500">
              Dữ liệu thời gian thực • Đồng bộ 3 chi nhánh
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden items-center rounded-lg bg-slate-100 p-1 sm:flex">
              {SHOWCASE_BRANCHES.slice(0, 3).map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setBranchId(b.id)}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${
                    branchId === b.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {b.id === 'all' ? 'Toàn công ty' : b.id === 'hq-hn' ? 'Hà Nội' : 'TP.HCM'}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="relative rounded-lg bg-slate-100 p-2 text-slate-700 hover:bg-slate-200"
              aria-label="Thông báo"
            >
              <IconBell size={17} />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-rose-500" />
            </button>
          </div>
        </header>

        <main className="flex-1 space-y-5 p-6">
          {/* Hero Command Banner + Quick KPI Strip */}
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#0C4A6E] p-6 text-white shadow-sm xl:col-span-5">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-cyan-300">
                Chỉ số Trọng tâm • Tháng 11
              </p>
              <div className="mt-3 flex items-baseline gap-3">
                <span className="text-4xl font-bold tracking-tight tabular-nums">
                  {branch.headcount}
                </span>
                <span className="text-sm text-slate-300">nhân sự đang làm việc</span>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-white/10 p-3 backdrop-blur-xs">
                  <p className="text-[11px] text-slate-300">Chuyên cần thực tế</p>
                  <p className="mt-1 text-lg font-bold text-cyan-300 tabular-nums">
                    {branch.activeRate}
                  </p>
                </div>
                <div className="rounded-xl bg-white/10 p-3 backdrop-blur-xs">
                  <p className="text-[11px] text-slate-300">Quỹ lương kỳ T11</p>
                  <p className="mt-1 text-lg font-bold text-white tabular-nums">
                    {branch.payrollVnd}
                  </p>
                </div>
              </div>
            </div>

            {/* Bento Metric Cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 xl:col-span-7">
              <div className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-5">
                <div className="flex items-center justify-between">
                  <span className="rounded-lg bg-blue-50 p-2 text-blue-600">
                    <IconChecklist size={18} />
                  </span>
                  <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-600">
                    Cần duyệt
                  </span>
                </div>
                <div className="mt-4">
                  <p className="text-3xl font-bold text-slate-900 tabular-nums">{pending.length}</p>
                  <p className="mt-1 text-xs font-medium text-slate-500">Hồ sơ đang chờ ký duyệt</p>
                </div>
              </div>

              <div className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-5">
                <div className="flex items-center justify-between">
                  <span className="rounded-lg bg-amber-50 p-2 text-amber-600">
                    <IconFileCertificate size={18} />
                  </span>
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                    ≤ 30 ngày
                  </span>
                </div>
                <div className="mt-4">
                  <p className="text-3xl font-bold text-slate-900 tabular-nums">
                    {SHOWCASE_CONTRACT_ALERTS.length}
                  </p>
                  <p className="mt-1 text-xs font-medium text-slate-500">
                    Hợp đồng cần tái ký sớm
                  </p>
                </div>
              </div>

              <div className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-5">
                <div className="flex items-center justify-between">
                  <span className="rounded-lg bg-emerald-50 p-2 text-emerald-600">
                    <IconDeviceLaptop size={18} />
                  </span>
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                    94% cấp phát
                  </span>
                </div>
                <div className="mt-4">
                  <p className="text-3xl font-bold text-slate-900 tabular-nums">218</p>
                  <p className="mt-1 text-xs font-medium text-slate-500">
                    Tài sản & thiết bị văn phòng
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Bento Row 2: 3 Balanced Operational Panels */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
            {/* Panel 1: Approvals */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 lg:col-span-5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-900">Hàng đợi Phê duyệt 1-Click</h2>
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                  {pending.length} đang mở
                </span>
              </div>
              <div className="mt-4 space-y-2.5">
                {pending.length === 0 ? (
                  <div className="rounded-xl bg-slate-50 p-5 text-center text-xs text-slate-600">
                    Không còn hồ sơ tồn đọng.{' '}
                    <button
                      type="button"
                      onClick={() => setHandledIds({})}
                      className="font-semibold text-blue-600 underline"
                    >
                      Tải lại mẫu
                    </button>
                  </div>
                ) : (
                  pending.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/70 p-3 hover:border-blue-300"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-xs font-bold text-slate-900">
                            {item.requester}
                          </span>
                          <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
                            {item.type}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-[11px] text-slate-500">{item.summary}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setHandledIds((p) => ({ ...p, [item.id]: 'APPROVED' }))}
                          className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                          title="Duyệt"
                        >
                          <IconCheck size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setHandledIds((p) => ({ ...p, [item.id]: 'REJECTED' }))}
                          className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600 hover:bg-rose-100 hover:text-rose-600"
                          title="Từ chối"
                        >
                          <IconX size={14} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Panel 2: Department & Payroll Analytics */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 lg:col-span-4">
              <h2 className="text-sm font-bold text-slate-900">Phân bổ Khối phòng ban</h2>
              <div className="mt-4 space-y-3">
                {SHOWCASE_DEPARTMENTS.map((dept) => (
                  <div key={dept.name} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-700">{dept.shortName}</span>
                      <span className="font-semibold text-slate-900 tabular-nums">
                        {dept.headcount} NV
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        style={{ width: `${Math.min(100, dept.headcount * 2)}%` }}
                        className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-400"
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-5 rounded-xl bg-slate-50 p-3">
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>Tăng trưởng quỹ lương T06 → T11</span>
                  <span className="font-bold text-blue-700">
                    +{SHOWCASE_PAYROLL_TREND[5].grossMillion - SHOWCASE_PAYROLL_TREND[0].grossMillion} tr
                  </span>
                </div>
              </div>
            </div>

            {/* Panel 3: Live Schedule & Announcements */}
            <div className="space-y-4 lg:col-span-3">
              <div className="rounded-2xl border border-slate-200/80 bg-white p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Lịch phòng họp
                  </h3>
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                </div>
                <div className="mt-3 space-y-2.5">
                  {SHOWCASE_MEETINGS.map((m) => (
                    <div
                      key={m.id}
                      className="rounded-xl border-l-2 border-blue-600 bg-slate-50 px-3 py-2"
                    >
                      <p className="text-[11px] font-bold text-blue-700">{m.timeRange}</p>
                      <p className="truncate text-xs font-semibold text-slate-800">{m.title}</p>
                      <p className="text-[10px] text-slate-500">{m.room}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200/80 bg-white p-4">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                  <IconSpeakerphone size={15} className="text-amber-500" />
                  Thông báo mới
                </div>
                <div className="mt-2.5 space-y-2">
                  {SHOWCASE_ANNOUNCEMENTS.map((a) => (
                    <p key={a.id} className="text-[11px] leading-snug text-slate-600">
                      • {a.title}
                    </p>
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
