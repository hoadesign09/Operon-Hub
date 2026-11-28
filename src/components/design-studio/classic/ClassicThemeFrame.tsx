'use client';

import { useState } from 'react';
import {
  IconApps,
  IconBell,
  IconBuildingSkyscraper,
  IconCheck,
  IconChecklist,
  IconChevronRight,
  IconCreditCard,
  IconFileDescription,
  IconHeadset,
  IconHierarchy2,
  IconLayoutDashboard,
  IconLayoutKanban,
  IconLogout,
  IconSettings,
  IconUsers,
  IconX,
} from '@tabler/icons-react';
import { ClassicElementsShowcase } from './ClassicElementsShowcase';
import { ClassicCollabBox, renderClassicStatusBadge } from './ClassicFilterParts';
import type { ClassicThemeTokens } from './classic-themes';
import {
  CLASSIC_BUDGET_OPTIONS,
  CLASSIC_DEPARTMENT_OPTIONS,
  formatVndCompact,
  useClassicWorkspaceState,
  type ClassicModuleType,
} from './classic-workspace-state';
import { LayoutGraphiteExecutive } from './layouts/LayoutGraphiteExecutive';
import { LayoutOxfordTopbar } from './layouts/LayoutOxfordTopbar';
import { LayoutPaperInk } from './layouts/LayoutPaperInk';
import { LayoutPrecisionGrid } from './layouts/LayoutPrecisionGrid';
import { LayoutSwissSlate } from './layouts/LayoutSwissSlate';

export type ClassicPreviewMode = 'all' | 'workspace' | 'elements';

interface ClassicThemeFrameProps {
  theme: ClassicThemeTokens;
  previewMode: ClassicPreviewMode;
}

const SIDEBAR_GROUPS = [
  {
    group: 'Không gian chung',
    items: [
      { id: 'dashboard', label: 'Bảng điều khiển', icon: IconLayoutDashboard },
      { id: 'approvals', label: 'Trung tâm Phê duyệt', icon: IconChecklist, badge: '4' },
    ],
  },
  {
    group: 'Dịch vụ Nội bộ',
    items: [
      { id: 'payments', label: 'Thanh toán & Ngân sách', icon: IconCreditCard },
      { id: 'proposals', label: 'Đề xuất Nội bộ', icon: IconFileDescription },
      { id: 'it', label: 'IT Helpdesk', icon: IconHeadset },
    ],
  },
  {
    group: 'Nhân sự & Dự án',
    items: [
      { id: 'org', label: 'Sơ đồ Tổ chức', icon: IconHierarchy2 },
      { id: 'employees', label: 'Hồ sơ Nhân sự', icon: IconUsers },
      { id: 'projects', label: 'Quản trị Dự án', icon: IconLayoutKanban },
    ],
  },
  {
    group: 'Quản trị Hệ thống',
    items: [{ id: 'settings', label: 'Phân quyền & Cấu hình', icon: IconSettings }],
  },
] as const;

const TOPBAR_PRIMARY_MODULES = [
  { id: 'workspace', label: 'Tổng quan', icon: IconLayoutDashboard },
  { id: 'services', label: 'Dịch vụ Nội bộ', icon: IconApps },
  { id: 'hrm', label: 'Nhân sự (HRM)', icon: IconUsers },
  { id: 'projects', label: 'Dự án', icon: IconLayoutKanban },
  { id: 'admin', label: 'Quản trị', icon: IconSettings },
] as const;

const TOPBAR_SUB_ITEMS = [
  { id: 'payments', label: 'Thanh toán & Ngân sách' },
  { id: 'proposals', label: 'Đề xuất Nội bộ' },
  { id: 'it', label: 'IT Helpdesk' },
  { id: 'approvals', label: 'Trung tâm Phê duyệt (4)' },
] as const;

export function ClassicThemeFrame({ theme, previewMode }: ClassicThemeFrameProps) {
  const c = theme.classes;
  const store = useClassicWorkspaceState();
  const [activeNav, setActiveNav] = useState('payments');
  const [activeTopModule, setActiveTopModule] = useState('services');
  const [branch, setBranch] = useState('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Create Modal live form state
  const [formTitle, setFormTitle] = useState('Thanh toán gia hạn tên miền & SSL doanh nghiệp 2027');
  const [formModule, setFormModule] = useState<ClassicModuleType>('Thanh toán');
  const [formBudget, setFormBudget] = useState('BUD-2026-TECH-001');
  const [formDepartment, setFormDepartment] = useState<string>(CLASSIC_DEPARTMENT_OPTIONS[0]);
  const [formAmount, setFormAmount] = useState('18500000');
  const [formUrgent, setFormUrgent] = useState(false);

  const isTopbarLayout = theme.navLayout === 'topbar-dual';
  const isCompact = theme.navLayout === 'sidebar-compact';
  const mainPadding = isCompact ? 'p-4 sm:p-5' : 'p-5 sm:p-6 lg:p-7';

  function handleOpenDrawer(code?: string) {
    if (code) store.setActiveItemCode(code);
    setIsDrawerOpen(true);
  }

  function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault();
    const numericAmount = Number(formAmount.replace(/[^\d]/g, '')) || 0;
    store.createItem({
      title: formTitle,
      module: formModule,
      budgetCode: formModule === 'IT Helpdesk' ? '—' : formBudget,
      department: formDepartment,
      amount: numericAmount,
      isUrgent: formUrgent,
    });
    setIsModalOpen(false);
  }

  function renderDistinctWorkspaceLayout() {
    const props = {
      theme,
      store,
      onOpenModal: () => setIsModalOpen(true),
      onOpenDrawer: handleOpenDrawer,
    };

    switch (theme.id) {
      case 'swiss-slate':
        return <LayoutSwissSlate {...props} />;
      case 'graphite-executive':
        return <LayoutGraphiteExecutive {...props} />;
      case 'paper-ink':
        return <LayoutPaperInk {...props} />;
      case 'oxford-topbar':
        return <LayoutOxfordTopbar {...props} />;
      case 'precision-grid':
        return <LayoutPrecisionGrid {...props} />;
    }
  }

  const parsedAmount = Number(formAmount.replace(/[^\d]/g, '')) || 0;
  const remainingAfter = 65000000 - parsedAmount;

  return (
    <div className={`min-h-[calc(100vh-110px)] w-full ${c.canvas}`}>
      {isTopbarLayout ? (
        /* Layout #4: Two-Tier Classic Horizontal Topbar (0px Sidebar, 100% Full-Bleed Content) */
        <div className="flex min-h-[calc(100vh-110px)] w-full flex-col">
          <header className={`flex w-full items-center justify-between gap-4 px-4 sm:px-6 ${c.topbar}`}>
            <div className="flex items-center gap-6 overflow-x-auto">
              <div className="flex shrink-0 items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded bg-white/15 text-white">
                  <IconBuildingSkyscraper size={16} />
                </span>
                <span className={c.sidebarBrand}>Operon Hub</span>
              </div>

              <nav className="flex items-center gap-1">
                {TOPBAR_PRIMARY_MODULES.map((mod) => {
                  const Icon = mod.icon;
                  const active = activeTopModule === mod.id;
                  return (
                    <button
                      key={mod.id}
                      type="button"
                      onClick={() => setActiveTopModule(mod.id)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs whitespace-nowrap transition ${
                        active ? c.sidebarItemActive : c.sidebarItemIdle
                      }`}
                    >
                      <Icon size={14} />
                      <span>{mod.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <select
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                className={c.topbarControl}
                aria-label="Chọn chi nhánh"
              >
                <option value="ALL">Tất cả chi nhánh</option>
                <option value="HCM">Trụ sở TP.HCM (HQ)</option>
                <option value="HN">Chi nhánh Hà Nội (HN)</option>
              </select>
              <button type="button" className={c.topbarControl}>
                VI / EN
              </button>
              <button type="button" className={c.topbarControl} aria-label="Thông báo">
                <IconBell size={14} />
              </button>
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15 text-[11px] font-semibold text-white">
                AD
              </span>
            </div>
          </header>

          <div className={`flex w-full items-center justify-between gap-4 px-4 sm:px-6 ${c.topbarSubnav}`}>
            <nav className="flex h-full items-center gap-5 overflow-x-auto">
              {TOPBAR_SUB_ITEMS.map((sub) => {
                const active = activeNav === sub.id;
                return (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => setActiveNav(sub.id)}
                    className={`flex h-full items-center text-xs whitespace-nowrap transition ${
                      active ? c.topbarSubnavActive : c.topbarSubnavIdle
                    }`}
                  >
                    {sub.label}
                  </button>
                );
              })}
            </nav>
            <span className="hidden text-[11px] text-slate-400 md:inline">
              Toàn bộ 100% bề rộng màn hình (0px Sidebar)
            </span>
          </div>

          <main className={`w-full flex-1 space-y-8 ${mainPadding}`}>
            {(previewMode === 'all' || previewMode === 'workspace') && renderDistinctWorkspaceLayout()}
            {previewMode === 'all' && <hr className={`border-t ${c.divider}`} />}
            {(previewMode === 'all' || previewMode === 'elements') && (
              <ClassicElementsShowcase
                theme={theme}
                onOpenModal={() => setIsModalOpen(true)}
                onOpenDrawer={() => handleOpenDrawer()}
              />
            )}
          </main>
        </div>
      ) : (
        /* Layouts #1, #2, #3, #5: Distinct Single Left Sidebar + Topbar + Distinct Main Architecture */
        <div className="flex min-h-[calc(100vh-110px)] w-full">
          <aside className={`hidden shrink-0 flex-col lg:flex ${c.sidebar}`}>
            <div className={`flex items-center gap-2.5 ${c.sidebarHeader}`}>
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-white"
                style={{ backgroundColor: theme.palette.primary }}
              >
                <IconBuildingSkyscraper size={16} />
              </div>
              <div className="min-w-0">
                <div className={`truncate ${c.sidebarBrand}`}>Operon Hub</div>
                <div className={`truncate ${c.sidebarSubBrand}`}>Enterprise Operations</div>
              </div>
            </div>

            <nav className="flex-1 overflow-y-auto px-2.5 pb-4">
              {SIDEBAR_GROUPS.map((grp) => (
                <div key={grp.group}>
                  <div className={c.sidebarGroupLabel}>{grp.group}</div>
                  <div className="space-y-0.5">
                    {grp.items.map((item) => {
                      const Icon = item.icon;
                      const isActive = activeNav === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setActiveNav(item.id)}
                          className={`flex w-full items-center justify-between gap-2 px-2.5 ${
                            isCompact ? 'py-1.5 text-xs' : 'py-2 text-[13px]'
                          } transition ${isActive ? c.sidebarItemActive : c.sidebarItemIdle}`}
                        >
                          <span className="flex min-w-0 items-center gap-2.5">
                            <Icon
                              size={16}
                              className={isActive ? c.sidebarIconActive : c.sidebarIconIdle}
                            />
                            <span className="truncate">{item.label}</span>
                          </span>
                          {'badge' in item && item.badge && (
                            <span className="rounded bg-current/10 px-1.5 py-0.5 text-[10px] font-semibold">
                              {store.statusCounts.PENDING_APPROVAL}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>

            <div className={c.sidebarFooter}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2.5">
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white"
                    style={{ backgroundColor: theme.palette.primary }}
                  >
                    AD
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-xs font-semibold">Nguyễn Quản Trị</div>
                    <div className="truncate text-[10px] opacity-65">Super Admin • ALL</div>
                  </div>
                </div>
                <button type="button" className="rounded p-1 opacity-60 hover:opacity-100" title="Đăng xuất">
                  <IconLogout size={15} />
                </button>
              </div>
            </div>
          </aside>

          {/* Main Content Shell */}
          <div className="flex min-w-0 flex-1 flex-col">
            <header className={`flex items-center justify-between gap-4 px-4 sm:px-6 ${c.topbar}`}>
              <div className="min-w-0">
                <div className={`flex items-center gap-1 ${c.topbarBreadcrumb}`}>
                  <span>Dịch vụ Nội bộ</span>
                  <IconChevronRight size={12} />
                  <span>Thanh toán & Ngân sách</span>
                </div>
                <div className={`truncate ${c.topbarTitle}`}>Thanh toán & Quản lý Ngân sách</div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <select
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  className={c.topbarControl}
                  aria-label="Chọn chi nhánh"
                >
                  <option value="ALL">Tất cả chi nhánh</option>
                  <option value="HCM">Trụ sở TP.HCM (HQ)</option>
                  <option value="HN">Chi nhánh Hà Nội (HN)</option>
                </select>
                <button type="button" className={c.topbarControl}>
                  VI / EN
                </button>
                <button type="button" className={c.btnIcon} aria-label="Thông báo">
                  <IconBell size={15} />
                </button>
              </div>
            </header>

            <main className={`w-full flex-1 space-y-8 ${mainPadding}`}>
              {(previewMode === 'all' || previewMode === 'workspace') && renderDistinctWorkspaceLayout()}
              {previewMode === 'all' && <hr className={`border-t ${c.divider}`} />}
              {(previewMode === 'all' || previewMode === 'elements') && (
                <ClassicElementsShowcase
                  theme={theme}
                  onOpenModal={() => setIsModalOpen(true)}
                  onOpenDrawer={() => handleOpenDrawer()}
                />
              )}
            </main>
          </div>
        </div>
      )}

      {/* Live Working Create Modal (Appends real item into the list!) */}
      {isModalOpen && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${c.modalBackdrop}`}>
          <form onSubmit={handleCreateSubmit} className={`w-full max-w-lg overflow-hidden ${c.modalSurface}`}>
            <div className={`flex items-center justify-between ${c.modalHeader}`}>
              <div>
                <h3 className={c.heading2}>Tạo Hồ sơ mới ({theme.name})</h3>
                <p className={c.mutedText}>Tạo thật trực tiếp vào danh sách để kiểm thử bộ lọc & phê duyệt</p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className={c.btnIcon}
                aria-label="Đóng"
              >
                <IconX size={15} />
              </button>
            </div>

            <div className="space-y-3.5 p-5">
              <div>
                <label className={c.label}>Tiêu đề hồ sơ</label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className={c.input}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={c.label}>Phân hệ</label>
                  <select
                    value={formModule}
                    onChange={(e) => setFormModule(e.target.value as ClassicModuleType)}
                    className={c.select}
                  >
                    <option value="Thanh toán">Thanh toán</option>
                    <option value="Tạm ứng">Tạm ứng</option>
                    <option value="Đề xuất Nội bộ">Đề xuất Nội bộ</option>
                    <option value="IT Helpdesk">IT Helpdesk</option>
                  </select>
                </div>

                <div>
                  <label className={c.label}>Phòng ban</label>
                  <select
                    value={formDepartment}
                    onChange={(e) => setFormDepartment(e.target.value)}
                    className={c.select}
                  >
                    {CLASSIC_DEPARTMENT_OPTIONS.map((dep) => (
                      <option key={dep} value={dep}>
                        {dep}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={c.label}>Quỹ ngân sách</label>
                  <select
                    value={formBudget}
                    onChange={(e) => setFormBudget(e.target.value)}
                    disabled={formModule === 'IT Helpdesk'}
                    className={formModule === 'IT Helpdesk' ? c.inputDisabled : c.select}
                  >
                    {CLASSIC_BUDGET_OPTIONS.map((b) => (
                      <option key={b.code} value={b.code}>
                        {b.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={c.label}>Số tiền đề nghị (VNĐ)</label>
                  <input
                    type="number"
                    min={0}
                    step={500000}
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    className={`${c.input} text-right tabular-nums`}
                  />
                </div>
              </div>

              <label className="flex cursor-pointer items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={formUrgent}
                  onChange={(e) => setFormUrgent(e.target.checked)}
                  className={c.checkbox}
                />
                <span>Đánh dấu hồ sơ Khẩn cấp (Urgent)</span>
              </label>

              <div className={remainingAfter >= 0 ? c.alertSuccess : c.alertWarning}>
                {remainingAfter >= 0 ? (
                  <>
                    Số dư khả dụng dự kiến sau giữ chỗ: <strong>{formatVndCompact(remainingAfter)}</strong> (Đạt chuẩn ngân sách).
                  </>
                ) : (
                  <>
                    Cảnh báo vượt hạn mức khả dụng quỹ <strong>{formatVndCompact(Math.abs(remainingAfter))}</strong> (sẽ gắn cờ Vượt quỹ).
                  </>
                )}
              </div>
            </div>

            <div className={`flex items-center justify-end gap-2 ${c.modalFooter}`}>
              <button type="button" onClick={() => setIsModalOpen(false)} className={c.btnOutline}>
                Hủy bỏ
              </button>
              <button type="submit" className={c.btnPrimary}>
                Tạo & lưu hồ sơ
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Live Working Slide-Over Drawer (Displays real clicked item with live Approve/Reject & Collab!) */}
      {isDrawerOpen && (
        <div className={`fixed inset-0 z-50 flex justify-end ${c.modalBackdrop}`}>
          <div className={`flex h-full w-full max-w-lg flex-col border-l ${c.divider} bg-white shadow-2xl`}>
            <div className={`flex items-center justify-between gap-2 ${c.modalHeader}`}>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className={c.codeTag}>{store.activeItem.code}</span>
                  {renderClassicStatusBadge(theme, store.activeItem.status)}
                </div>
                <h3 className={`mt-1 truncate ${c.heading2}`}>{store.activeItem.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsDrawerOpen(false)}
                className={c.btnIcon}
                aria-label="Đóng"
              >
                <IconX size={15} />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              <div className={`${c.cardMuted} space-y-2 p-3.5 text-xs`}>
                <div className="flex justify-between">
                  <span className={c.mutedText}>Phân hệ</span>
                  <span className="font-semibold">{store.activeItem.module}</span>
                </div>
                <div className="flex justify-between">
                  <span className={c.mutedText}>Người đề nghị</span>
                  <span className="font-semibold">{store.activeItem.requester}</span>
                </div>
                <div className="flex justify-between">
                  <span className={c.mutedText}>Phòng ban</span>
                  <span className="font-medium">{store.activeItem.department}</span>
                </div>
                <div className="flex justify-between">
                  <span className={c.mutedText}>Quỹ liên kết</span>
                  <span className={c.codeTag}>{store.activeItem.budgetCode}</span>
                </div>
                <div className="flex justify-between border-t border-current/10 pt-2">
                  <span className={c.mutedText}>Tổng tiền đề nghị</span>
                  <span className="font-bold tabular-nums">
                    {formatVndCompact(store.activeItem.amount)}
                  </span>
                </div>
              </div>

              <p className={c.bodyText}>{store.activeItem.description}</p>

              <div className={`border-t pt-4 ${c.divider}`}>
                <div className={`mb-2 ${c.heading3}`}>Trao đổi & Tệp chứng từ</div>
                <ClassicCollabBox
                  theme={theme}
                  item={store.activeItem}
                  onAddComment={store.addComment}
                />
              </div>
            </div>

            <div className={`flex items-center justify-between gap-2 ${c.modalFooter}`}>
              <button type="button" onClick={() => setIsDrawerOpen(false)} className={c.btnOutline}>
                Đóng lại
              </button>
              {store.activeItem.status === 'PENDING_APPROVAL' && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => store.updateItemStatus(store.activeItem.code, 'REJECTED')}
                    className={c.btnDanger}
                  >
                    <IconX size={14} /> Từ chối
                  </button>
                  <button
                    type="button"
                    onClick={() => store.updateItemStatus(store.activeItem.code, 'APPROVED')}
                    className={c.btnSuccess}
                  >
                    <IconCheck size={14} /> Phê duyệt ngay
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Live Toast Feedback */}
      {store.toastMessage && (
        <div className="fixed right-5 bottom-5 z-50 rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-xs font-medium text-white shadow-xl">
          {store.toastMessage}
        </div>
      )}
    </div>
  );
}
