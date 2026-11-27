'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { IconClock, IconDeviceLaptop, IconSend, IconShieldCheck, IconX } from '@tabler/icons-react';
import type { ItRequestKind, ItRequestPriority } from '@/config/database';
import { useI18n } from '@/shared/i18n/I18nContext';

export interface ItCategoryOption {
  id: number;
  code: string;
  name: string;
  nameEn: string | null;
  description: string | null;
  requestKind: ItRequestKind;
  requiresApproval: boolean;
  defaultPriority: ItRequestPriority;
  slaResponseHours: number;
  slaResolutionHours: number;
  color: string;
  sortOrder: number;
  isActive: boolean;
}

export interface ItRequestFormInitial {
  id: number;
  categoryId: number;
  title: string;
  description: string;
  priority: ItRequestPriority;
  assetId: number | null;
  estimatedCost: number;
  locationDetail: string | null;
  contactPhone: string | null;
}

interface AssetOption {
  id: number;
  assetCode: string;
  name: string;
  category: string;
  status: string;
}

interface ItRequestFormModalProps {
  open: boolean;
  categories: ItCategoryOption[];
  initial?: ItRequestFormInitial | null;
  onClose: () => void;
  onSaved: (ticketId: number) => void;
}

const PRIORITY_OPTIONS: Array<{ value: ItRequestPriority; vi: string; en: string }> = [
  { value: 'LOW', vi: 'Thấp (SLA 1.5x)', en: 'Low (1.5x SLA)' },
  { value: 'MEDIUM', vi: 'Trung bình (SLA tiêu chuẩn)', en: 'Medium (Standard SLA)' },
  { value: 'HIGH', vi: 'Cao (SLA 0.75x)', en: 'High (0.75x SLA)' },
  { value: 'URGENT', vi: 'Khẩn cấp (SLA 0.5x)', en: 'Urgent (0.5x SLA)' },
];

export function ItRequestFormModal(props: ItRequestFormModalProps) {
  if (!props.open) {
    return null;
  }
  const activeKey = `${props.initial?.id ?? 'new'}-${props.categories.length}`;
  return <ItRequestFormModalBody key={activeKey} {...props} />;
}

function ItRequestFormModalBody({
  categories,
  initial,
  onClose,
  onSaved,
}: ItRequestFormModalProps) {
  const { locale, tr, ln } = useI18n();
  const activeCategories = categories.filter((c) => c.isActive);
  const firstCat = activeCategories[0];

  const [categoryId, setCategoryId] = useState<string>(
    initial ? String(initial.categoryId) : firstCat ? String(firstCat.id) : '',
  );
  const [priority, setPriority] = useState<ItRequestPriority>(
    initial?.priority ?? firstCat?.defaultPriority ?? 'MEDIUM',
  );
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [assetId, setAssetId] = useState<string>(initial?.assetId ? String(initial.assetId) : '');
  const [estimatedCost, setEstimatedCost] = useState<string>(String(initial?.estimatedCost ?? 0));
  const [locationDetail, setLocationDetail] = useState(initial?.locationDetail ?? '');
  const [contactPhone, setContactPhone] = useState(initial?.contactPhone ?? '');
  const [assets, setAssets] = useState<AssetOption[]>([]);
  const [error, setError] = useState('');
  const [submittingMode, setSubmittingMode] = useState<'draft' | 'submit' | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/v1/hrm/office/assets?limit=100', { cache: 'no-store', signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((json: { success?: boolean; data?: AssetOption[] } | null) => {
        if (!controller.signal.aborted && json?.success && Array.isArray(json.data)) {
          setAssets(json.data);
        }
      })
      .catch(() => {
        // Optional dropdown: user without hrm.assets.read still creates tickets smoothly
      });
    return () => controller.abort();
  }, []);

  const selectedCategory = categories.find((c) => String(c.id) === categoryId) ?? null;
  const isBusy = submittingMode !== null;

  function handleCategoryChange(nextId: string) {
    setCategoryId(nextId);
    const cat = categories.find((c) => String(c.id) === nextId);
    if (cat && !initial) {
      setPriority(cat.defaultPriority);
    }
  }

  async function submitForm(submitImmediately: boolean, e?: FormEvent) {
    if (e) e.preventDefault();
    if (isBusy) return;

    if (!categoryId) {
      setError(tr('Vui lòng chọn danh mục hỗ trợ IT.', 'Please select an IT support category.'));
      return;
    }
    if (title.trim().length < 4) {
      setError(tr('Tiêu đề tối thiểu 4 ký tự.', 'Title must be at least 4 characters.'));
      return;
    }
    if (description.trim().length < 8) {
      setError(
        tr(
          'Vui lòng mô tả chi tiết sự cố hoặc yêu cầu (tối thiểu 8 ký tự).',
          'Please describe the issue or request in detail (at least 8 characters).',
        ),
      );
      return;
    }

    setError('');
    setSubmittingMode(submitImmediately ? 'submit' : 'draft');

    try {
      const payload = {
        categoryId: Number(categoryId),
        title: title.trim(),
        description: description.trim(),
        priority,
        assetId: assetId ? Number(assetId) : null,
        estimatedCost: Math.max(0, Number(estimatedCost) || 0),
        locationDetail: locationDetail.trim() || null,
        contactPhone: contactPhone.trim() || null,
        ...(initial ? {} : { submitImmediately }),
      };

      const url = initial ? `/api/v1/it-requests/${initial.id}` : '/api/v1/it-requests';
      const method = initial ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => null)) as {
        success?: boolean;
        data?: { id: number };
        error?: { message?: string };
      } | null;

      if (!res.ok || !json?.success || !json.data) {
        setError(
          json?.error?.message ??
            tr('Không thể lưu yêu cầu hỗ trợ IT.', 'Unable to save IT support request.'),
        );
        return;
      }

      onSaved(json.data.id);
    } catch {
      setError(tr('Lỗi kết nối máy chủ.', 'Network connection error.'));
    } finally {
      setSubmittingMode(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {initial
                ? tr('Chỉnh sửa Yêu cầu IT', 'Edit IT Request')
                : tr('Tạo Yêu cầu Hỗ trợ IT mới', 'Create New IT Helpdesk Ticket')}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {tr(
                'Hệ thống tự động áp dụng SLA và định tuyến phê duyệt hoặc hàng đợi IT theo danh mục.',
                'Automatically applies SLA targets and routes to Approval Engine or IT queue by category.',
              )}
            </p>
          </div>
          <button
            type="button"
            disabled={isBusy}
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <IconX size={18} />
          </button>
        </div>

        <form onSubmit={(e) => void submitForm(true, e)} className="mt-4 space-y-4">
          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                {tr('Danh mục Hỗ trợ IT *', 'IT Support Category *')}
              </label>
              <select
                required
                value={categoryId}
                onChange={(e) => handleCategoryChange(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-indigo-500"
              >
                <option value="">{tr('-- Chọn danh mục --', '-- Select category --')}</option>
                {activeCategories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {ln(cat.name, cat.nameEn)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                {tr('Mức độ ưu tiên *', 'Priority Level *')}
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as ItRequestPriority)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-indigo-500"
              >
                {PRIORITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {locale === 'en' ? opt.en : opt.vi}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {selectedCategory && (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-indigo-100 bg-indigo-50/70 px-3.5 py-2.5 text-xs text-indigo-900">
              <span className="inline-flex items-center gap-1.5 font-semibold">
                <IconClock size={14} className="text-indigo-600" />
                {tr(
                  `SLA chuẩn: Phản hồi ${selectedCategory.slaResponseHours}h • Xử lý ${selectedCategory.slaResolutionHours}h`,
                  `Baseline SLA: Response ${selectedCategory.slaResponseHours}h • Resolution ${selectedCategory.slaResolutionHours}h`,
                )}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-0.5 text-[11px] font-semibold text-slate-700 ring-1 ring-indigo-200">
                <IconShieldCheck size={13} className="text-indigo-600" />
                {selectedCategory.requiresApproval
                  ? tr('Cần phê duyệt qua Core Approval', 'Requires Core Approval')
                  : tr('Chuyển thẳng hàng đợi IT', 'Direct to IT Queue')}
              </span>
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              {tr('Tiêu đề yêu cầu / sự cố *', 'Ticket Subject *')}
            </label>
            <input
              type="text"
              required
              maxLength={250}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={tr(
                'VD: Không kết nối được VPN FortiClient / Cấp license Figma...',
                'e.g. Cannot connect FortiClient VPN / Request Figma license...',
              )}
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              {tr('Mô tả chi tiết hiện trạng / lý do *', 'Detailed Description / Business Reason *')}
            </label>
            <textarea
              rows={4}
              required
              maxLength={5000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={tr(
                'Mô tả mã lỗi, thời điểm xảy ra, các bước đã thử hoặc thông tin tài khoản/phần mềm cần cấp...',
                'Include error code, timestamp, steps tried, or required software/access scope...',
              )}
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-500"
            />
          </div>

          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <div>
              <label className="mb-1 flex items-center gap-1 text-xs font-semibold text-slate-700">
                <IconDeviceLaptop size={14} className="text-slate-500" />
                <span>{tr('Thiết bị / Tài sản liên quan (tùy chọn)', 'Related Asset (optional)')}</span>
              </label>
              <select
                value={assetId}
                onChange={(e) => setAssetId(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-indigo-500"
              >
                <option value="">{tr('-- Không gắn tài sản --', '-- No linked asset --')}</option>
                {assets.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.assetCode} — {asset.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                {tr('Chi phí dự kiến VNĐ (nếu mua bản quyền/thiết bị)', 'Estimated Cost VND (if any)')}
              </label>
              <input
                type="number"
                min="0"
                step="100000"
                value={estimatedCost}
                onChange={(e) => setEstimatedCost(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                {tr('Vị trí chỗ ngồi / Tầng', 'Desk Location / Floor')}
              </label>
              <input
                type="text"
                maxLength={200}
                value={locationDetail}
                onChange={(e) => setLocationDetail(e.target.value)}
                placeholder={tr('VD: Tầng 5 - Khu Kỹ thuật', 'e.g. Floor 5 - Engineering Area')}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                {tr('Số điện thoại liên hệ nhanh', 'Contact Phone')}
              </label>
              <input
                type="text"
                maxLength={30}
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="090xxxxxxx"
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2.5 border-t border-slate-100 pt-4">
            <button
              type="button"
              disabled={isBusy}
              onClick={onClose}
              className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {tr('Hủy', 'Cancel')}
            </button>

            {!initial && (
              <button
                type="button"
                disabled={isBusy}
                onClick={() => void submitForm(false)}
                className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
              >
                {submittingMode === 'draft'
                  ? tr('Đang lưu nháp...', 'Saving draft...')
                  : tr('Lưu nháp', 'Save Draft')}
              </button>
            )}

            <button
              type="submit"
              disabled={isBusy}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
            >
              <IconSend size={15} />
              <span>
                {submittingMode === 'submit'
                  ? tr('Đang xử lý...', 'Submitting...')
                  : initial
                    ? tr('Lưu thay đổi', 'Save Changes')
                    : selectedCategory?.requiresApproval
                      ? tr('Gửi Phê duyệt', 'Submit for Approval')
                      : tr('Gửi Yêu cầu IT', 'Submit IT Ticket')}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
