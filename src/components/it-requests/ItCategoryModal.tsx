'use client';

import { useState, type FormEvent } from 'react';
import { IconX } from '@tabler/icons-react';
import type { ItRequestKind, ItRequestPriority } from '@/config/database';
import type { ItCategoryOption } from '@/components/it-requests/ItRequestFormModal';
import { useI18n } from '@/shared/i18n/I18nContext';

interface ItCategoryModalProps {
  open: boolean;
  editing: ItCategoryOption | null;
  onClose: () => void;
  onSaved: () => void;
}

const KIND_OPTIONS: Array<{ value: ItRequestKind; vi: string; en: string }> = [
  { value: 'INCIDENT', vi: 'Sự cố kỹ thuật (Incident)', en: 'Technical Incident' },
  { value: 'SERVICE_REQUEST', vi: 'Yêu cầu dịch vụ / Phần mềm', en: 'Service / Software Request' },
  { value: 'ACCESS_REQUEST', vi: 'Cấp tài khoản & Phân quyền', en: 'Account & Access Request' },
  { value: 'HARDWARE_PROVISION', vi: 'Cấp phát thiết bị mới', en: 'Hardware Provisioning' },
];

const PRIORITY_OPTIONS: Array<{ value: ItRequestPriority; vi: string; en: string }> = [
  { value: 'LOW', vi: 'Thấp', en: 'Low' },
  { value: 'MEDIUM', vi: 'Trung bình', en: 'Medium' },
  { value: 'HIGH', vi: 'Cao', en: 'High' },
  { value: 'URGENT', vi: 'Khẩn cấp', en: 'Urgent' },
];

export function ItCategoryModal(props: ItCategoryModalProps) {
  if (!props.open) return null;
  return <ItCategoryModalBody key={props.editing?.id ?? 'new'} {...props} />;
}

function ItCategoryModalBody({ editing, onClose, onSaved }: ItCategoryModalProps) {
  const { locale, tr } = useI18n();
  const [code, setCode] = useState(editing?.code ?? '');
  const [name, setName] = useState(editing?.name ?? '');
  const [nameEn, setNameEn] = useState(editing?.nameEn ?? '');
  const [description, setDescription] = useState(editing?.description ?? '');
  const [requestKind, setRequestKind] = useState<ItRequestKind>(editing?.requestKind ?? 'INCIDENT');
  const [requiresApproval, setRequiresApproval] = useState(editing?.requiresApproval ?? false);
  const [defaultPriority, setDefaultPriority] = useState<ItRequestPriority>(
    editing?.defaultPriority ?? 'MEDIUM',
  );
  const [slaResponseHours, setSlaResponseHours] = useState(
    String(editing?.slaResponseHours ?? 2),
  );
  const [slaResolutionHours, setSlaResolutionHours] = useState(
    String(editing?.slaResolutionHours ?? 8),
  );
  const [color, setColor] = useState(editing?.color ?? '#2563EB');
  const [sortOrder, setSortOrder] = useState(String(editing?.sortOrder ?? 10));
  const [isActive, setIsActive] = useState(editing?.isActive ?? true);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (isSaving) return;
    setError('');
    setIsSaving(true);

    try {
      const payload = {
        ...(editing ? {} : { code: code.trim().toUpperCase() }),
        name: name.trim(),
        nameEn: nameEn.trim() || null,
        description: description.trim() || null,
        requestKind,
        requiresApproval,
        defaultPriority,
        slaResponseHours: Number(slaResponseHours),
        slaResolutionHours: Number(slaResolutionHours),
        color,
        sortOrder: Number(sortOrder) || 0,
        isActive,
      };

      const url = editing
        ? `/api/v1/it-requests/categories/${editing.id}`
        : '/api/v1/it-requests/categories';
      const res = await fetch(url, {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => null)) as {
        success?: boolean;
        error?: { message?: string };
      } | null;

      if (!res.ok || !json?.success) {
        setError(
          json?.error?.message ??
            tr('Không thể lưu danh mục IT.', 'Unable to save IT category.'),
        );
        return;
      }
      onSaved();
    } catch {
      setError(tr('Lỗi kết nối máy chủ.', 'Network connection error.'));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
          <h2 className="text-base font-bold text-slate-900">
            {editing
              ? tr('Cập nhật Danh mục IT & SLA', 'Edit IT Category & SLA')
              : tr('Thêm Danh mục IT & SLA mới', 'Create IT Category & SLA')}
          </h2>
          <button
            type="button"
            disabled={isSaving}
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
          >
            <IconX size={18} />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="mt-4 space-y-3.5">
          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                {tr('Mã danh mục *', 'Category Code *')}
              </label>
              <input
                type="text"
                required
                disabled={Boolean(editing)}
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="IT_PRINTER_SUPPORT"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-sm uppercase disabled:bg-slate-100"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                {tr('Loại yêu cầu *', 'Request Kind *')}
              </label>
              <select
                value={requestKind}
                onChange={(e) => setRequestKind(e.target.value as ItRequestKind)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                {KIND_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {locale === 'en' ? opt.en : opt.vi}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                {tr('Tên Tiếng Việt *', 'Vietnamese Name *')}
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                {tr('Tên Tiếng Anh (EN)', 'English Name (EN)')}
              </label>
              <input
                type="text"
                value={nameEn}
                onChange={(e) => setNameEn(e.target.value)}
                placeholder="Printer & Peripheral Support"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              {tr('Mô tả ngắn', 'Short Description')}
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                {tr('Ưu tiên mặc định', 'Default Priority')}
              </label>
              <select
                value={defaultPriority}
                onChange={(e) => setDefaultPriority(e.target.value as ItRequestPriority)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                {PRIORITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {locale === 'en' ? opt.en : opt.vi}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                {tr('SLA Phản hồi (giờ) *', 'Response SLA (hrs) *')}
              </label>
              <input
                type="number"
                min="1"
                max="720"
                required
                value={slaResponseHours}
                onChange={(e) => setSlaResponseHours(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                {tr('SLA Xử lý (giờ) *', 'Resolution SLA (hrs) *')}
              </label>
              <input
                type="number"
                min="1"
                max="2160"
                required
                value={slaResolutionHours}
                onChange={(e) => setSlaResolutionHours(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                {tr('Màu nhận diện', 'Accent Color')}
              </label>
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-9 w-full cursor-pointer rounded-xl border border-slate-300 bg-white p-1"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                {tr('Thứ tự hiển thị', 'Sort Order')}
              </label>
              <input
                type="number"
                min="0"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="col-span-2 flex flex-col justify-center gap-2 sm:col-span-1">
              <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={requiresApproval}
                  onChange={(e) => setRequiresApproval(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                />
                <span>{tr('Cần phê duyệt', 'Requires approval')}</span>
              </label>
              <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                />
                <span>{tr('Đang áp dụng', 'Active')}</span>
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              disabled={isSaving}
              onClick={onClose}
              className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              {tr('Hủy', 'Cancel')}
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {isSaving ? tr('Đang lưu...', 'Saving...') : tr('Lưu danh mục', 'Save Category')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
