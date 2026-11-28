'use client';

import { useState } from 'react';
import {
  IconAlertCircle,
  IconAlertTriangle,
  IconCheck,
  IconChevronRight,
  IconCircleCheck,
  IconDownload,
  IconFolderOff,
  IconInfoCircle,
  IconLayoutSidebarRightExpand,
  IconLoader2,
  IconPencil,
  IconPlus,
  IconSearch,
  IconTrash,
  IconUpload,
  IconWindowMaximize,
} from '@tabler/icons-react';
import type { ClassicThemeTokens } from './classic-themes';

interface ClassicElementsShowcaseProps {
  theme: ClassicThemeTokens;
  onOpenModal: () => void;
  onOpenDrawer: () => void;
}

export function ClassicElementsShowcase({
  theme,
  onOpenModal,
  onOpenDrawer,
}: ClassicElementsShowcaseProps) {
  const c = theme.classes;
  const [toggleEmail, setToggleEmail] = useState(true);
  const [toggleStrictBudget, setToggleStrictBudget] = useState(true);
  const [toggleCompact, setToggleCompact] = useState(false);
  const [selectedRadio, setSelectedRadio] = useState<'HARD_BLOCK' | 'SOFT_WARN'>('HARD_BLOCK');
  const [activeTab, setActiveTab] = useState<'overview' | 'ledger' | 'audit'>('overview');
  const [segmentValue, setSegmentValue] = useState<'day' | 'week' | 'month'>('month');

  return (
    <div className="w-full space-y-5">
      {/* Section Title */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className={c.heading3}>Toàn bộ Hệ thống Element (Full UI Kit)</span>
          <h2 className={`mt-1 ${c.heading1}`}>
            Kiểm tra đầy đủ mọi thành phần giao diện của &ldquo;{theme.name}&rdquo;
          </h2>
          <p className={`mt-1 ${c.mutedText}`}>
            Tất cả nút bấm, ô nhập liệu, chọn lọc, bảng, badge, cảnh báo, tab, modal, drawer, trạng thái rỗng và loading.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={onOpenModal} className={c.btnPrimary}>
            <IconWindowMaximize size={14} />
            <span>Xem thử Modal</span>
          </button>
          <button type="button" onClick={onOpenDrawer} className={c.btnOutline}>
            <IconLayoutSidebarRightExpand size={14} />
            <span>Xem thử Slide-over Drawer</span>
          </button>
        </div>
      </div>

      {/* 1. Typography & Token Swatches */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className={`${c.card} xl:col-span-7`}>
          <div className={c.cardHeader}>
            <h3 className={c.heading2}>1. Hệ chữ (Typography) & Phân cấp thông tin</h3>
          </div>
          <div className="space-y-3 p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b pb-2.5 border-dashed border-current/10">
              <span className={c.heading1}>Tiêu đề trang chính (Heading 1 — 20px)</span>
              <span className={c.codeTag}>H1 / Page Title</span>
            </div>
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b pb-2.5 border-dashed border-current/10">
              <span className={c.heading2}>Tiêu đề khối dữ liệu & Bảng biểu (Heading 2 — 14px)</span>
              <span className={c.codeTag}>H2 / Section</span>
            </div>
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b pb-2.5 border-dashed border-current/10">
              <span className={c.heading3}>NHÃN PHÂN NHÓM & CỘT BẢNG (OVERLINE)</span>
              <span className={c.codeTag}>H3 / Overline</span>
            </div>
            <p className={c.bodyText}>
              Văn bản nội dung chuẩn: Hệ thống tự động giữ chỗ ngân sách khi gửi đề xuất và chuyển giao nguyên vẹn sang phiếu thanh toán để không bao giờ bị trừ trùng số dư.
            </p>
            <div className="flex flex-wrap items-center gap-4 pt-1">
              <span className={c.mutedText}>Chú thích phụ • Cập nhật 27/11/2026 22:45</span>
              <span className={c.codeTag}>PAY-2026-0042</span>
              <span className="text-sm font-semibold tabular-nums">125.450.000 ₫</span>
            </div>
          </div>
        </div>

        <div className={`${c.card} xl:col-span-5`}>
          <div className={c.cardHeader}>
            <h3 className={c.heading2}>2. Bảng màu Tiết chế (Classic Palette)</h3>
          </div>
          <div className="space-y-3 p-5">
            <div className="grid grid-cols-5 gap-2">
              {Object.entries(theme.palette).map(([token, hex]) => (
                <div key={token} className="space-y-1.5">
                  <div
                    className={`h-12 w-full border ${c.divider} ${c.radius}`}
                    style={{ backgroundColor: hex }}
                  />
                  <div className="text-[10px] font-semibold uppercase">{token}</div>
                  <div className="font-mono text-[10px] opacity-70">{hex}</div>
                </div>
              ))}
            </div>
            <div className={`${c.cardMuted} p-3 text-xs`}>
              <div className="font-semibold">Đặc trưng bố cục:</div>
              <div className={`mt-1 ${c.mutedText}`}>{theme.navigationSummary}</div>
              <div className={`mt-1 ${c.mutedText}`}>Mật độ hiển thị: {theme.densityLabel}</div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Buttons & Interactive Controls */}
      <div className={c.card}>
        <div className={c.cardHeader}>
          <h3 className={c.heading2}>3. Hệ thống Nút bấm & Bộ điều khiển (Buttons & Controls)</h3>
        </div>
        <div className="space-y-4 p-5">
          <div className="flex flex-wrap items-center gap-2.5">
            <button type="button" className={c.btnPrimary}>
              <IconPlus size={14} />
              <span>Primary Action</span>
            </button>
            <button type="button" className={c.btnSecondary}>
              <span>Secondary</span>
            </button>
            <button type="button" className={c.btnOutline}>
              <IconDownload size={14} />
              <span>Outline / Export</span>
            </button>
            <button type="button" className={c.btnGhost}>
              <span>Ghost Link</span>
            </button>
            <button type="button" className={c.btnSuccess}>
              <IconCheck size={14} />
              <span>Phê duyệt</span>
            </button>
            <button type="button" className={c.btnDanger}>
              <IconTrash size={14} />
              <span>Từ chối / Xóa</span>
            </button>
            <button type="button" disabled className={c.btnDisabled}>
              <span>Disabled</span>
            </button>
            <button type="button" className={c.btnPrimary}>
              <IconLoader2 size={14} className="animate-spin" />
              <span>Đang lưu...</span>
            </button>
          </div>

          <div className={`flex flex-wrap items-center justify-between gap-4 border-t pt-4 ${c.divider}`}>
            <div className="flex items-center gap-2">
              <span className={c.mutedText}>Icon Actions:</span>
              <button type="button" className={c.btnIcon} title="Chỉnh sửa">
                <IconPencil size={14} />
              </button>
              <button type="button" className={c.btnIcon} title="Tải xuống">
                <IconDownload size={14} />
              </button>
              <button type="button" className={c.btnIcon} title="Xóa">
                <IconTrash size={14} />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className={c.mutedText}>Segmented Control:</span>
              <div className={c.segmentedWrap}>
                {(
                  [
                    ['day', 'Ngày'],
                    ['week', 'Tuần'],
                    ['month', 'Tháng'],
                  ] as const
                ).map(([val, label]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setSegmentValue(val)}
                    className={segmentValue === val ? c.segmentedActive : c.segmentedIdle}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Complete Form Controls */}
      <div className={c.card}>
        <div className={c.cardHeader}>
          <h3 className={c.heading2}>4. Toàn bộ Thành phần Biểu mẫu (Form Inputs, Select, Switch, Upload)</h3>
        </div>
        <div className="grid grid-cols-1 gap-5 p-5 lg:grid-cols-12">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:col-span-8">
            <div>
              <label className={c.label}>Tiêu đề hồ sơ (Default Input)</label>
              <input
                type="text"
                defaultValue="Thanh toán dịch vụ máy chủ tháng 11/2026"
                className={c.input}
              />
            </div>

            <div>
              <label className={c.label}>Tìm kiếm nhanh (Search Input)</label>
              <div className="relative">
                <IconSearch
                  size={14}
                  className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 opacity-50"
                />
                <input type="text" placeholder="Nhập mã hoặc tên nhân sự..." className={`${c.input} pl-8`} />
              </div>
            </div>

            <div>
              <label className={c.label}>Chọn Quỹ ngân sách (Select Dropdown)</label>
              <select className={c.select} defaultValue="TECH">
                <option value="TECH">BUD-2026-TECH-001 — Công nghệ (Khả dụng 65 tr)</option>
                <option value="OPS">BUD-2026-OPS-001 — Vận hành (Khả dụng 63 tr)</option>
                <option value="HR">BUD-2026-HR-001 — Nhân sự (Khả dụng 104 tr)</option>
              </select>
            </div>

            <div>
              <label className={c.label}>Số tiền đề nghị (Validation Error State)</label>
              <input type="text" defaultValue="280.000.000" className={c.inputError} />
              <p className="mt-1 text-[11px] font-medium text-red-600">
                Vượt số dư khả dụng của quỹ (tối đa 65.000.000 ₫ theo chế độ HARD_BLOCK).
              </p>
            </div>

            <div>
              <label className={c.label}>Ngày hiệu lực (Date Picker)</label>
              <input type="date" defaultValue="2026-11-27" className={c.input} />
            </div>

            <div>
              <label className={c.label}>Mã chứng từ tự sinh (Disabled / Read-only)</label>
              <input type="text" value="PAY-2026-0043" disabled className={c.inputDisabled} />
            </div>

            <div className="sm:col-span-2">
              <label className={c.label}>Diễn giải chi tiết (Textarea)</label>
              <textarea
                rows={2}
                defaultValue="Đính kèm hợp đồng gia hạn và biên bản nghiệm thu đợt 2 của nhà cung cấp."
                className={c.input}
              />
            </div>
          </div>

          {/* Right Form Column: Checkboxes, Radios, Switches, Upload */}
          <div className="space-y-4 lg:col-span-4">
            <div className={`${c.cardMuted} space-y-2.5 p-3.5`}>
              <div className={c.heading3}>Chế độ kiểm soát (Radio)</div>
              {(
                [
                  ['HARD_BLOCK', 'Chặn cứng khi vượt ngân sách'],
                  ['SOFT_WARN', 'Cảnh báo mềm & gắn cờ vượt quỹ'],
                ] as const
              ).map(([val, text]) => (
                <label key={val} className="flex cursor-pointer items-center gap-2 text-xs">
                  <input
                    type="radio"
                    name={`budget-mode-${theme.id}`}
                    checked={selectedRadio === val}
                    onChange={() => setSelectedRadio(val)}
                    className={c.checkbox}
                  />
                  <span>{text}</span>
                </label>
              ))}
            </div>

            <div className={`${c.cardMuted} space-y-2.5 p-3.5`}>
              <div className={c.heading3}>Tùy chọn bật/tắt (Switches & Checkbox)</div>
              {[
                { label: 'Gửi thông báo Email cho người duyệt', checked: toggleEmail, toggle: () => setToggleEmail((v) => !v) },
                { label: 'Khóa tải tệp ngoài bước Chờ duyệt', checked: toggleStrictBudget, toggle: () => setToggleStrictBudget((v) => !v) },
                { label: 'Hiển thị mã tài khoản kế toán', checked: toggleCompact, toggle: () => setToggleCompact((v) => !v) },
              ].map((sw) => (
                <div key={sw.label} className="flex items-center justify-between gap-2 text-xs">
                  <span>{sw.label}</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={sw.checked}
                    onClick={sw.toggle}
                    className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition ${
                      sw.checked ? c.switchTrackOn : c.switchTrackOff
                    }`}
                  >
                    <span
                      className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-xs transition ${
                        sw.checked ? 'translate-x-4.5' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              ))}
            </div>

            <div className={c.dropzone}>
              <IconUpload size={18} className="mx-auto opacity-60" />
              <div className="mt-1.5 text-xs font-medium">Kéo thả chứng từ hoặc bấm để chọn tệp</div>
              <div className={`mt-0.5 ${c.mutedText}`}>PDF, XLSX, PNG, JPG • Tối đa 10MB</div>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Badges, Alerts, Navigation Tabs & Empty/Skeleton States */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className={`${c.card} xl:col-span-6`}>
          <div className={c.cardHeader}>
            <h3 className={c.heading2}>5. Nhãn Trạng thái (Badges) & Thông báo Hệ thống (Alerts)</h3>
          </div>
          <div className="space-y-4 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className={c.badgeNeutral}>Nháp / Lưu trữ</span>
              <span className={c.badgeInfo}>Đang xử lý</span>
              <span className={c.badgeSuccess}>Đã phê duyệt</span>
              <span className={c.badgeWarning}>Chờ duyệt / Cảnh báo</span>
              <span className={c.badgeDanger}>Từ chối / Quá hạn SLA</span>
            </div>

            <div className="space-y-2.5">
              <div className={`${c.alertInfo} flex items-start gap-2.5`}>
                <IconInfoCircle size={16} className="mt-0.5 shrink-0" />
                <div>
                  <strong>Thông tin:</strong> Khoản giữ chỗ từ Đề xuất sẽ tự động chuyển giao sang Thanh toán.
                </div>
              </div>
              <div className={`${c.alertSuccess} flex items-start gap-2.5`}>
                <IconCircleCheck size={16} className="mt-0.5 shrink-0" />
                <div>
                  <strong>Thành công:</strong> Đã ghi nhận giải ngân và cập nhật sổ cái ngân sách thành công.
                </div>
              </div>
              <div className={`${c.alertWarning} flex items-start gap-2.5`}>
                <IconAlertTriangle size={16} className="mt-0.5 shrink-0" />
                <div>
                  <strong>Cảnh báo:</strong> Quỹ Tiếp thị đã sử dụng 89% hạn mức được cấp trong năm 2026.
                </div>
              </div>
              <div className={`${c.alertDanger} flex items-start gap-2.5`}>
                <IconAlertCircle size={16} className="mt-0.5 shrink-0" />
                <div>
                  <strong>Lỗi nghiệp vụ:</strong> Không thể giảm hạn mức quỹ xuống thấp hơn tổng đã giữ chỗ + đã chi.
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className={`${c.card} xl:col-span-6`}>
          <div className={c.cardHeader}>
            <h3 className={c.heading2}>6. Breadcrumbs, Tabs, Trạng thái Rỗng & Loading Skeleton</h3>
          </div>
          <div className="space-y-4 p-5">
            {/* Breadcrumb */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className={c.mutedText}>Dịch vụ nội bộ</span>
              <IconChevronRight size={12} className="opacity-40" />
              <span className={c.mutedText}>Thanh toán</span>
              <IconChevronRight size={12} className="opacity-40" />
              <span className="font-semibold">Chi tiết PAY-2026-0042</span>
            </div>

            {/* Tabs */}
            <div>
              <div className={c.tabsWrap}>
                {(
                  [
                    ['overview', 'Tổng quan chứng từ'],
                    ['ledger', 'Sổ cái ngân sách (16)'],
                    ['audit', 'Nhật ký kiểm toán'],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setActiveTab(key)}
                    className={activeTab === key ? c.tabActive : c.tabIdle}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className={`mt-3 ${c.cardMuted} p-3 text-xs`}>
                {activeTab === 'overview' && 'Hiển thị thông tin chung, bảng kê VAT, số tiền bằng chữ VI/EN và luồng duyệt.'}
                {activeTab === 'ledger' && 'Hiển thị 16 giao dịch bất biến (ALLOCATE, RESERVE, TRANSFER, CONSUME, REFUND).'}
                {activeTab === 'audit' && 'Hiển thị đầy đủ lịch sử thay đổi theo người thao tác, thời gian và địa chỉ IP.'}
              </div>
            </div>

            {/* Empty State & Skeleton Loading Side-by-Side */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className={`${c.cardMuted} flex flex-col items-center justify-center p-4 text-center`}>
                <IconFolderOff size={22} className="opacity-45" />
                <div className="mt-2 text-xs font-semibold">Chưa có chứng từ nào</div>
                <div className={`mt-0.5 ${c.mutedText}`}>Trạng thái Empty chuẩn của toàn hệ thống</div>
                <button type="button" onClick={onOpenModal} className={`mt-2.5 ${c.btnOutline}`}>
                  <IconPlus size={12} /> Tạo mới ngay
                </button>
              </div>

              <div className={`${c.cardMuted} space-y-2.5 p-4`}>
                <div className="text-[11px] font-semibold opacity-60">Loading Skeleton State</div>
                <div className="h-3 w-2/3 animate-pulse rounded bg-current/15" />
                <div className="h-3 w-full animate-pulse rounded bg-current/10" />
                <div className="h-3 w-5/6 animate-pulse rounded bg-current/10" />
                <div className="flex gap-2 pt-1">
                  <div className="h-6 w-20 animate-pulse rounded bg-current/15" />
                  <div className="h-6 w-16 animate-pulse rounded bg-current/10" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
