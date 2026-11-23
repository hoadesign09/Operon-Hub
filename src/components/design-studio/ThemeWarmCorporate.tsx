'use client';

import { useState } from 'react';
import {
  IconBell,
  IconBuildingSkyscraper,
  IconCalendarEvent,
  IconCalendarStats,
  IconCash,
  IconCheck,
  IconClockCheck,
  IconDeviceLaptop,
  IconFileCertificate,
  IconHeartHandshake,
  IconReceipt2,
  IconSpeakerphone,
  IconSparkles,
  IconUsers,
} from '@tabler/icons-react';
import {
  SHOWCASE_ANNOUNCEMENTS,
  SHOWCASE_APPROVALS,
  SHOWCASE_BRANCHES,
  SHOWCASE_CONTRACT_ALERTS,
  SHOWCASE_DEPARTMENTS,
  SHOWCASE_MEETINGS,
} from './showcase-data';

const TOP_MODULES = [
  { id: 'overview', label: 'Trang chủ' },
  { id: 'people', label: 'Nhân sự & Hợp đồng' },
  { id: 'time', label: 'Chấm công & Nghỉ phép' },
  { id: 'payroll', label: 'Lương & Phúc lợi' },
  { id: 'office', label: 'Văn phòng & Tài sản' },
  { id: 'crm', label: 'CRM (Sắp mở)' },
] as const;

export function ThemeWarmCorporate() {
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [branchId, setBranchId] = useState<string>('all');
  const [checkedIn, setCheckedIn] = useState<boolean>(true);
  const [approvedIds, setApprovedIds] = useState<string[]>([]);

  const branch = SHOWCASE_BRANCHES.find((b) => b.id === branchId) ?? SHOWCASE_BRANCHES[0];
  const openApprovals = SHOWCASE_APPROVALS.filter((a) => !approvedIds.includes(a.id));

  return (
    <div className="flex min-h-[820px] flex-col bg-[#FAF9F6] text-stone-900">
      {/* Top Suite Navigation — Full Width Freedom */}
      <header className="sticky top-0 z-10 border-b border-stone-200/80 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1380px] items-center justify-between gap-4 px-5 sm:px-8">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-teal-700 text-white shadow-xs">
                <IconBuildingSkyscraper size={19} />
              </div>
              <div>
                <p className="text-sm font-bold tracking-tight text-stone-900">Operon Hub</p>
                <p className="text-[10px] font-medium text-teal-700">People & Operations Suite</p>
              </div>
            </div>

            <nav className="hidden items-center gap-1 lg:flex">
              {TOP_MODULES.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                      isActive
                        ? 'bg-teal-700 text-white shadow-xs'
                        : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              aria-label="Chọn chi nhánh"
              className="rounded-full border border-stone-200 bg-stone-50 px-3.5 py-1.5 text-xs font-medium text-stone-700 focus:border-teal-600 focus:outline-none"
            >
              {SHOWCASE_BRANCHES.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="relative rounded-full border border-stone-200 bg-white p-2 text-stone-600 hover:bg-stone-50"
              aria-label="Thông báo"
            >
              <IconBell size={16} />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-amber-500" />
            </button>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-800">
              TA
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="mx-auto w-full max-w-[1380px] flex-1 space-y-6 px-5 py-6 sm:px-8">
        {/* Human-Centric Welcome + Instant ESS Bar */}
        <section className="rounded-3xl border border-stone-200/80 bg-gradient-to-r from-[#0F766E] via-[#115E59] to-[#134E4A] p-6 text-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-medium text-teal-50">
                <IconHeartHandshake size={14} />
                Chào buổi tối, Nguyễn Tuấn Anh • Thứ Hai, 23/11/2026
              </div>
              <h1 className="mt-3 text-2xl font-bold tracking-tight">
                Mọi hoạt động nhân sự & vận hành đang diễn ra ổn định
              </h1>
              <p className="mt-1 text-xs text-teal-100/90">
                Không gian toàn chiều ngang giúp quản lý bảng công, bảng lương và hồ sơ nhân viên dễ dàng.
              </p>
            </div>

            {/* Interactive Self-Service Widget */}
            <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-white/12 p-3.5 backdrop-blur-sm">
              <div className="pr-3">
                <p className="text-[11px] text-teal-100">Chấm công hôm nay</p>
                <p className="mt-0.5 text-sm font-bold">
                  {checkedIn ? 'Đã vào ca 08:24 • Đúng giờ' : 'Chưa chấm công vào ca'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCheckedIn((v) => !v)}
                className="rounded-xl bg-amber-400 px-4 py-2 text-xs font-bold text-stone-950 transition hover:bg-amber-300"
              >
                {checkedIn ? 'Chấm công ra về' : 'Chấm công vào ca'}
              </button>
            </div>
          </div>

          {/* Personal Quick Pills */}
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Quỹ phép năm còn lại', val: '11,5 ngày', icon: IconCalendarStats },
              { label: 'Phiếu lương T10 đã nhận', val: 'Đã xác nhận', icon: IconReceipt2 },
              { label: 'Tài sản đang giữ', val: '02 thiết bị', icon: IconDeviceLaptop },
              { label: 'Đơn cần bạn duyệt', val: `${openApprovals.length} hồ sơ`, icon: IconSparkles },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className="flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-3"
                >
                  <Icon size={18} className="shrink-0 text-amber-300" />
                  <div>
                    <p className="text-[11px] text-teal-100/80">{item.label}</p>
                    <p className="text-sm font-bold text-white">{item.val}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Full-Width KPI Row */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Nhân sự đang làm việc', value: `${branch.headcount} người`, badge: '+4,2%', icon: IconUsers },
            { label: 'Tỷ lệ đi làm đúng giờ', value: branch.activeRate, badge: 'Tốt', icon: IconClockCheck },
            { label: 'Tổng quỹ lương dự chi T11', value: branch.payrollVnd, badge: 'Kỳ mở', icon: IconCash },
            { label: 'Hợp đồng sắp hết hạn', value: `${SHOWCASE_CONTRACT_ALERTS.length} hồ sơ`, badge: 'Cần xử lý', icon: IconFileCertificate },
          ].map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.label}
                className="rounded-2xl border border-stone-200/80 bg-white p-5 shadow-2xs"
              >
                <div className="flex items-center justify-between">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
                    <Icon size={18} />
                  </div>
                  <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-[11px] font-semibold text-stone-600">
                    {card.badge}
                  </span>
                </div>
                <p className="mt-4 text-2xl font-bold text-stone-900 tabular-nums">{card.value}</p>
                <p className="mt-1 text-xs text-stone-500">{card.label}</p>
              </div>
            );
          })}
        </section>

        {/* Wide Workspace Grid (Advantage of Full-Width Top Nav) */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Wide Table: Department & Attendance Matrix */}
          <div className="rounded-3xl border border-stone-200/80 bg-white p-6 shadow-2xs lg:col-span-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-stone-900">
                  Bảng Tổng hợp Nhân sự & Chuyên cần Toàn công ty
                </h2>
                <p className="text-xs text-stone-500">
                  Hiển thị thoáng trên toàn chiều ngang — không cần cuộn ngang với bảng nhiều cột
                </p>
              </div>
              <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700">
                Xuất Excel (MIT)
              </span>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-stone-200 text-[11px] font-semibold text-stone-500">
                    <th className="py-3 pr-4">Phòng ban</th>
                    <th className="px-4 py-3 text-right">Quân số</th>
                    <th className="px-4 py-3 text-right">Chuyên cần</th>
                    <th className="px-4 py-3">Tỷ trọng quỹ lương</th>
                    <th className="py-3 pl-4 text-right">Trạng thái công</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {SHOWCASE_DEPARTMENTS.map((dept) => (
                    <tr key={dept.name} className="hover:bg-stone-50/80">
                      <td className="py-3.5 pr-4 font-semibold text-stone-800">{dept.name}</td>
                      <td className="px-4 py-3.5 text-right font-semibold tabular-nums">
                        {dept.headcount}
                      </td>
                      <td className="px-4 py-3.5 text-right font-semibold text-teal-700 tabular-nums">
                        {dept.attendanceRate}%
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-28 overflow-hidden rounded-full bg-stone-100">
                            <div
                              style={{ width: `${dept.budgetShare * 2.4}%` }}
                              className="h-full rounded-full bg-teal-600"
                            />
                          </div>
                          <span className="text-[11px] text-stone-500 tabular-nums">
                            {dept.budgetShare}%
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 pl-4 text-right">
                        <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                          Đã đối soát
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Bottom Strip: Announcements + Rooms */}
            <div className="mt-6 grid grid-cols-1 gap-4 border-t border-stone-100 pt-5 sm:grid-cols-2">
              <div className="rounded-2xl bg-[#FAF9F6] p-4">
                <div className="flex items-center gap-2 text-xs font-bold text-stone-800">
                  <IconSpeakerphone size={15} className="text-amber-600" />
                  Bản tin Nội bộ mới nhất
                </div>
                <div className="mt-2.5 space-y-2">
                  {SHOWCASE_ANNOUNCEMENTS.map((a) => (
                    <div key={a.id} className="text-xs">
                      <p className="font-medium text-stone-800">{a.title}</p>
                      <p className="text-[11px] text-stone-500">
                        {a.publishedAt} • Đã đọc {a.readRate}%
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl bg-[#FAF9F6] p-4">
                <div className="flex items-center gap-2 text-xs font-bold text-stone-800">
                  <IconCalendarEvent size={15} className="text-teal-700" />
                  Phòng họp đang sử dụng
                </div>
                <div className="mt-2.5 space-y-2">
                  {SHOWCASE_MEETINGS.slice(0, 2).map((m) => (
                    <div key={m.id} className="text-xs">
                      <p className="font-medium text-stone-800">{m.title}</p>
                      <p className="text-[11px] text-stone-500">
                        {m.timeRange} • {m.room}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Right: Warm Approval Feed */}
          <div className="rounded-3xl border border-stone-200/80 bg-white p-6 shadow-2xs lg:col-span-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-stone-900">Cần bạn phê duyệt</h2>
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800">
                {openApprovals.length}
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {openApprovals.length === 0 ? (
                <div className="rounded-2xl bg-teal-50 p-5 text-center text-xs font-medium text-teal-800">
                  Tuyệt vời! Bạn đã duyệt hết các yêu cầu hôm nay.
                  <button
                    type="button"
                    onClick={() => setApprovedIds([])}
                    className="mt-2 block w-full text-teal-700 underline"
                  >
                    Xem lại danh sách demo
                  </button>
                </div>
              ) : (
                openApprovals.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-stone-200/80 bg-[#FAF9F6] p-4"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-stone-900">{item.requester}</span>
                      <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-teal-700 ring-1 ring-stone-200">
                        {item.type}
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs leading-relaxed text-stone-600">{item.summary}</p>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-[10px] text-stone-400">{item.submittedAt}</span>
                      <button
                        type="button"
                        onClick={() => setApprovedIds((p) => [...p, item.id])}
                        className="inline-flex items-center gap-1 rounded-full bg-teal-700 px-3 py-1 text-[11px] font-semibold text-white hover:bg-teal-800"
                      >
                        <IconCheck size={12} />
                        Phê duyệt
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
