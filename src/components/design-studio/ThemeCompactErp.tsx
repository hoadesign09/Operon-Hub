'use client';

import { useState } from 'react';
import {
  IconBell,
  IconBuildingSkyscraper,
  IconCalendarTime,
  IconCash,
  IconCheck,
  IconChecklist,
  IconChevronRight,
  IconClockCheck,
  IconDeviceLaptop,
  IconDownload,
  IconFileCertificate,
  IconHierarchy2,
  IconIdBadge2,
  IconLayoutDashboard,
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarLeftExpand,
  IconPlus,
  IconSettings,
} from '@tabler/icons-react';
import {
  SHOWCASE_APPROVALS,
  SHOWCASE_BRANCHES,
  SHOWCASE_CONTRACT_ALERTS,
  SHOWCASE_DEPARTMENTS,
  SHOWCASE_MEETINGS,
} from './showcase-data';

export function ThemeCompactErp() {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [branchId, setBranchId] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>(['APR-1042']);
  const [batchApprovedIds, setBatchApprovedIds] = useState<string[]>([]);
  const [isCreateMenuOpen, setIsCreateMenuOpen] = useState<boolean>(false);

  const branch = SHOWCASE_BRANCHES.find((b) => b.id === branchId) ?? SHOWCASE_BRANCHES[0];
  const visibleApprovals = SHOWCASE_APPROVALS.filter((a) => !batchApprovedIds.includes(a.id));

  function toggleRow(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }

  function handleBatchApprove() {
    if (selectedIds.length === 0) return;
    setBatchApprovedIds((prev) => [...prev, ...selectedIds]);
    setSelectedIds([]);
  }

  return (
    <div className="flex min-h-[820px] bg-[#F3F5F8] text-slate-900">
      {/* Collapsible Precision ERP Sidebar */}
      <aside
        className={`hidden shrink-0 flex-col border-r border-slate-200 bg-white transition-all duration-200 md:flex ${
          isCollapsed ? 'w-[68px]' : 'w-[238px]'
        }`}
      >
        <div className="flex h-14 items-center justify-between border-b border-slate-200 px-3.5">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#1E40AF] text-white">
              <IconBuildingSkyscraper size={17} />
            </div>
            {!isCollapsed && (
              <div className="min-w-0">
                <p className="truncate text-xs font-bold text-slate-900">OPERON ERP</p>
                <p className="truncate text-[10px] text-slate-500">Enterprise HRM Core</p>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setIsCollapsed((c) => !c)}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            title={isCollapsed ? 'Mở rộng menu' : 'Thu gọn menu'}
          >
            {isCollapsed ? (
              <IconLayoutSidebarLeftExpand size={17} />
            ) : (
              <IconLayoutSidebarLeftCollapse size={17} />
            )}
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-2">
          {[
            { id: 'dash', label: 'Bảng điều khiển', icon: IconLayoutDashboard, active: true },
            { id: 'appr', label: 'Phê duyệt (Hàng loạt)', icon: IconChecklist, count: visibleApprovals.length },
            { id: 'org', label: 'Cơ cấu tổ chức', icon: IconHierarchy2 },
            { id: 'emp', label: 'Danh sách Nhân viên', icon: IconIdBadge2 },
            { id: 'ctr', label: 'Quản lý Hợp đồng', icon: IconFileCertificate, count: 3 },
            { id: 'att', label: 'Bảng chấm công tháng', icon: IconClockCheck },
            { id: 'pay', label: 'Tính lương & Bảo hiểm', icon: IconCash },
            { id: 'ast', label: 'Kho tài sản thiết bị', icon: IconDeviceLaptop },
            { id: 'rm', label: 'Phòng họp & Lịch', icon: IconCalendarTime },
            { id: 'cfg', label: 'Phân quyền & Hệ thống', icon: IconSettings },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.id}
                title={item.label}
                className={`flex cursor-pointer items-center justify-between rounded-md px-2.5 py-2 text-xs font-medium ${
                  item.active
                    ? 'bg-blue-50 text-[#1E40AF] ring-1 ring-blue-200/80'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span className="flex items-center gap-2.5 overflow-hidden">
                  <Icon size={16} className="shrink-0" />
                  {!isCollapsed && <span className="truncate">{item.label}</span>}
                </span>
                {!isCollapsed && item.count !== undefined && item.count > 0 && (
                  <span className="rounded bg-[#1E40AF] px-1.5 py-0.5 text-[10px] font-bold text-white">
                    {item.count}
                  </span>
                )}
              </div>
            );
          })}
        </nav>

        <div className="border-t border-slate-200 p-2.5">
          <div className="flex items-center gap-2 rounded-md bg-slate-50 p-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-blue-100 text-[11px] font-bold text-blue-800">
              CB
            </div>
            {!isCollapsed && (
              <div className="min-w-0">
                <p className="truncate text-[11px] font-bold text-slate-800">Nguyễn Tuấn Anh</p>
                <p className="truncate text-[10px] text-slate-500">C&B / Admin • ALL</p>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Precision Workspace */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Compact Action Toolbar Header */}
        <header className="flex h-14 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 sm:px-5">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className="font-medium text-slate-700">Operon Hub</span>
            <IconChevronRight size={13} />
            <span className="font-medium text-slate-700">HRM</span>
            <IconChevronRight size={13} />
            <span className="font-bold text-[#1E40AF]">Tổng hợp Vận hành T11/2026</span>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              aria-label="Chi nhánh"
              className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:border-[#1E40AF] focus:outline-none"
            >
              {SHOWCASE_BRANCHES.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label}
                </option>
              ))}
            </select>

            <div className="relative">
              <button
                type="button"
                onClick={() => setIsCreateMenuOpen((o) => !o)}
                className="inline-flex items-center gap-1 rounded-md bg-[#1E40AF] px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-900"
              >
                <IconPlus size={14} />
                <span>Tạo nhanh</span>
              </button>
              {isCreateMenuOpen && (
                <div className="absolute right-0 z-20 mt-1.5 w-48 rounded-md border border-slate-200 bg-white py-1 text-xs shadow-lg">
                  {['+ Thêm hồ sơ nhân viên', '+ Lập hợp đồng mới', '+ Chốt kỳ lương T11', '+ Đặt phòng họp'].map(
                    (opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setIsCreateMenuOpen(false)}
                        className="block w-full px-3 py-2 text-left text-slate-700 hover:bg-blue-50 hover:text-[#1E40AF]"
                      >
                        {opt}
                      </button>
                    ),
                  )}
                </div>
              )}
            </div>

            <button
              type="button"
              className="rounded-md border border-slate-300 bg-white p-1.5 text-slate-600 hover:bg-slate-50"
              aria-label="Thông báo"
            >
              <IconBell size={15} />
            </button>
          </div>
        </header>

        {/* High-Density Above-The-Fold Dashboard */}
        <main className="flex-1 space-y-4 p-4 sm:p-5">
          {/* Compact 5-KPI Strip */}
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            {[
              { label: 'Tổng nhân sự', value: `${branch.headcount}`, tag: '+6 mới', accent: 'border-l-blue-700' },
              { label: 'Chuyên cần T11', value: branch.activeRate, tag: 'Đạt KPI', accent: 'border-l-teal-600' },
              { label: 'Tổng quỹ lương', value: branch.payrollVnd, tag: '148 phiếu', accent: 'border-l-indigo-600' },
              { label: 'Chờ phê duyệt', value: `${visibleApprovals.length}`, tag: 'Duyệt nhanh', accent: 'border-l-amber-500' },
              { label: 'HĐ sắp hết hạn', value: `${SHOWCASE_CONTRACT_ALERTS.length}`, tag: '≤ 30 ngày', accent: 'border-l-rose-600' },
            ].map((item) => (
              <div
                key={item.label}
                className={`rounded-md border border-slate-200 border-l-4 ${item.accent} bg-white px-3.5 py-3`}
              >
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>{item.label}</span>
                  <span className="font-semibold text-slate-600">{item.tag}</span>
                </div>
                <p className="mt-1 text-xl font-bold text-slate-900 tabular-nums">{item.value}</p>
              </div>
            ))}
          </section>

          {/* Batch Approval Data Grid */}
          <section className="rounded-md border border-slate-200 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-2.5">
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-bold uppercase tracking-wide text-slate-800">
                  Danh sách Đơn từ Chờ duyệt ({visibleApprovals.length})
                </h2>
                {selectedIds.length > 0 && (
                  <span className="rounded bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-[#1E40AF]">
                    Đã chọn {selectedIds.length} dòng
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {batchApprovedIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setBatchApprovedIds([])}
                    className="rounded border border-slate-300 px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
                  >
                    Khôi phục mẫu
                  </button>
                )}
                <button
                  type="button"
                  disabled={selectedIds.length === 0}
                  onClick={handleBatchApprove}
                  className="inline-flex items-center gap-1 rounded bg-teal-700 px-3 py-1 text-[11px] font-semibold text-white hover:bg-teal-800 disabled:opacity-40"
                >
                  <IconCheck size={13} />
                  Duyệt hàng loạt ({selectedIds.length})
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                >
                  <IconDownload size={13} />
                  Xuất Excel
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                  <tr>
                    <th className="w-9 px-3 py-2 text-center">#</th>
                    <th className="px-3 py-2">Mã đơn</th>
                    <th className="px-3 py-2">Loại yêu cầu</th>
                    <th className="px-3 py-2">Nhân viên</th>
                    <th className="px-3 py-2">Phòng ban</th>
                    <th className="px-3 py-2">Nội dung chi tiết</th>
                    <th className="px-3 py-2 text-right">Thời gian gửi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visibleApprovals.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-6 text-center text-xs text-slate-500">
                        Tất cả đơn đã được phê duyệt hàng loạt thành công.
                      </td>
                    </tr>
                  ) : (
                    visibleApprovals.map((item) => {
                      const isChecked = selectedIds.includes(item.id);
                      return (
                        <tr
                          key={item.id}
                          onClick={() => toggleRow(item.id)}
                          className={`cursor-pointer ${
                            isChecked ? 'bg-blue-50/60' : 'hover:bg-slate-50'
                          }`}
                        >
                          <td className="px-3 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleRow(item.id)}
                              onClick={(e) => e.stopPropagation()}
                              className="h-3.5 w-3.5 rounded border-slate-300 text-[#1E40AF]"
                            />
                          </td>
                          <td className="px-3 py-2 font-mono text-[11px] font-semibold text-[#1E40AF]">
                            {item.code}
                          </td>
                          <td className="px-3 py-2">
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">
                              {item.type}
                            </span>
                          </td>
                          <td className="px-3 py-2 font-semibold text-slate-800">{item.requester}</td>
                          <td className="px-3 py-2 text-slate-600">{item.department}</td>
                          <td className="px-3 py-2 text-slate-600">{item.summary}</td>
                          <td className="px-3 py-2 text-right text-[11px] text-slate-500">
                            {item.submittedAt}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Bottom Dense Split: Department Matrix + Contract Alerts + Rooms */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            <div className="rounded-md border border-slate-200 bg-white lg:col-span-5">
              <div className="border-b border-slate-200 px-4 py-2 text-xs font-bold uppercase text-slate-700">
                Tổng hợp Quân số & Công theo Phòng ban
              </div>
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[10px] font-semibold text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Đơn vị</th>
                    <th className="px-3 py-2 text-right">NV</th>
                    <th className="px-3 py-2 text-right">Công (%)</th>
                    <th className="px-3 py-2 text-right">Quỹ (%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {SHOWCASE_DEPARTMENTS.map((d) => (
                    <tr key={d.name}>
                      <td className="px-3 py-2 font-medium text-slate-800">{d.shortName}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{d.headcount}</td>
                      <td className="px-3 py-2 text-right font-semibold text-teal-700 tabular-nums">
                        {d.attendanceRate}%
                      </td>
                      <td className="px-3 py-2 text-right text-slate-500 tabular-nums">
                        {d.budgetShare}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="rounded-md border border-slate-200 bg-white lg:col-span-4">
              <div className="border-b border-slate-200 px-4 py-2 text-xs font-bold uppercase text-slate-700">
                Cảnh báo Hợp đồng hết hạn
              </div>
              <div className="divide-y divide-slate-100">
                {SHOWCASE_CONTRACT_ALERTS.map((c) => (
                  <div key={c.id} className="flex items-center justify-between px-3.5 py-2.5 text-xs">
                    <div>
                      <p className="font-semibold text-slate-800">
                        {c.employeeCode} — {c.employeeName}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {c.contractType} • {c.endDate}
                      </p>
                    </div>
                    <span className="rounded bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-700 tabular-nums">
                      -{c.daysLeft}d
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-md border border-slate-200 bg-white lg:col-span-3">
              <div className="border-b border-slate-200 px-4 py-2 text-xs font-bold uppercase text-slate-700">
                Phòng họp Hôm nay
              </div>
              <div className="divide-y divide-slate-100">
                {SHOWCASE_MEETINGS.map((m) => (
                  <div key={m.id} className="px-3.5 py-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[#1E40AF] tabular-nums">
                        {m.timeRange}
                      </span>
                      <span className="text-[10px] text-slate-400">{m.attendees} người</span>
                    </div>
                    <p className="truncate font-medium text-slate-800">{m.title}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
