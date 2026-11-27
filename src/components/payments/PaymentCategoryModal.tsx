'use client';

import { useState, type FormEvent } from 'react';
import { IconEdit, IconPlus, IconTrash, IconX } from '@tabler/icons-react';
import type { PaymentType } from '@/config/database';
import { useI18n } from '@/shared/i18n/I18nContext';
import { PAYMENT_TYPE_META, type PaymentCategoryDto } from './payment-ui.helpers';

interface PaymentCategoryModalProps {
  isOpen: boolean;
  categories: PaymentCategoryDto[];
  onClose: () => void;
  onChanged: () => void;
}

export function PaymentCategoryModal({
  isOpen,
  categories,
  onClose,
  onChanged,
}: PaymentCategoryModalProps) {
  const { locale, tr, ln } = useI18n();
  const [editing, setEditing] = useState<PaymentCategoryDto | null>(null);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [description, setDescription] = useState('');
  const [defaultPaymentType, setDefaultPaymentType] = useState<PaymentType>('REIMBURSEMENT');
  const [requiresReceipt, setRequiresReceipt] = useState(true);
  const [color, setColor] = useState('#D97706');
  const [isActive, setIsActive] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) {
    return null;
  }

  function resetForm() {
    setEditing(null);
    setCode('');
    setName('');
    setNameEn('');
    setDescription('');
    setDefaultPaymentType('REIMBURSEMENT');
    setRequiresReceipt(true);
    setColor('#D97706');
    setIsActive(true);
    setErrorMessage('');
  }

  function startEdit(cat: PaymentCategoryDto) {
    setEditing(cat);
    setCode(cat.code);
    setName(cat.name);
    setNameEn(cat.nameEn ?? '');
    setDescription(cat.description ?? '');
    setDefaultPaymentType(cat.defaultPaymentType);
    setRequiresReceipt(cat.requiresReceipt);
    setColor(cat.color);
    setIsActive(cat.isActive);
    setErrorMessage('');
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (isSaving) return;
    setErrorMessage('');
    setIsSaving(true);

    try {
      const url = editing
        ? `/api/v1/payments/categories/${editing.id}`
        : '/api/v1/payments/categories';
      const method = editing ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: code.trim().toUpperCase(),
          name: name.trim(),
          nameEn: nameEn.trim() || null,
          description: description.trim() || null,
          defaultPaymentType,
          requiresReceipt,
          color,
          isActive,
        }),
      });
      const json = (await res.json().catch(() => null)) as {
        success?: boolean;
        error?: { message?: string };
      } | null;
      if (!res.ok || !json?.success) {
        setErrorMessage(
          json?.error?.message ??
            tr('Không thể lưu danh mục khoản chi.', 'Unable to save expense category.'),
        );
        return;
      }
      resetForm();
      onChanged();
    } catch {
      setErrorMessage(tr('Lỗi kết nối máy chủ.', 'Network error.'));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(cat: PaymentCategoryDto) {
    setErrorMessage('');
    const res = await fetch(`/api/v1/payments/categories/${cat.id}`, { method: 'DELETE' });
    const json = (await res.json().catch(() => null)) as {
      success?: boolean;
      error?: { message?: string };
    } | null;
    if (!res.ok || !json?.success) {
      setErrorMessage(
        json?.error?.message ??
          tr('Không thể xóa danh mục đang sử dụng.', 'Unable to delete category in use.'),
      );
      return;
    }
    if (editing?.id === cat.id) {
      resetForm();
    }
    onChanged();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-[2px]">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 bg-[#0F172A] px-5 py-4 text-white">
          <div>
            <h3 className="text-sm font-bold">
              {tr('Quản trị Danh mục Khoản chi (Song ngữ VI/EN)', 'Manage Expense Categories (VI/EN)')}
            </h3>
            <p className="text-xs text-slate-300">
              {tr(
                'Cấu hình loại phiếu mặc định và yêu cầu đính kèm hóa đơn/chứng từ theo từng danh mục.',
                'Configure default voucher types and mandatory receipt policies per category.',
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white"
          >
            <IconX size={18} />
          </button>
        </div>

        <div className="grid flex-1 grid-cols-1 gap-5 overflow-y-auto p-5 lg:grid-cols-12">
          {/* Form Left */}
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3 lg:col-span-5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold tracking-wide text-slate-700 uppercase">
                {editing
                  ? tr('Sửa danh mục', 'Edit Category')
                  : tr('Thêm danh mục mới', 'Add Category')}
              </h4>
              {editing && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-xs font-semibold text-blue-600 hover:underline"
                >
                  {tr('Tạo mới', 'Create New')}
                </button>
              )}
            </div>

            {errorMessage && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {errorMessage}
              </div>
            )}

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                {tr('Mã danh mục *', 'Category Code *')}
              </label>
              <input
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="TRAVEL_TRIP"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-xs uppercase outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                {tr('Tên tiếng Việt *', 'Vietnamese Name *')}
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                {tr('Tên tiếng Anh (EN)', 'English Name (EN)')}
              </label>
              <input
                type="text"
                value={nameEn}
                onChange={(e) => setNameEn(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  {tr('Loại mặc định', 'Default Type')}
                </label>
                <select
                  value={defaultPaymentType}
                  onChange={(e) => setDefaultPaymentType(e.target.value as PaymentType)}
                  className="w-full rounded-xl border border-slate-200 px-2.5 py-2 text-xs outline-none focus:border-blue-500"
                >
                  <option value="CASH_ADVANCE">{tr('Tạm ứng', 'Advance')}</option>
                  <option value="REIMBURSEMENT">{tr('Hoàn ứng', 'Reimburse')}</option>
                  <option value="VENDOR_PAYMENT">{tr('Nhà cung cấp', 'Vendor')}</option>
                  <option value="ADVANCE_SETTLEMENT">{tr('Quyết toán', 'Settlement')}</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  {tr('Màu nhận diện', 'Badge Color')}
                </label>
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="h-9 w-full cursor-pointer rounded-xl border border-slate-200 p-1"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                {tr('Mô tả', 'Description')}
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex flex-col gap-2 pt-1 text-xs">
              <label className="inline-flex items-center gap-2 text-slate-700">
                <input
                  type="checkbox"
                  checked={requiresReceipt}
                  onChange={(e) => setRequiresReceipt(e.target.checked)}
                  className="rounded border-slate-300"
                />
                <span>
                  {tr(
                    'Bắt buộc đính kèm hóa đơn/chứng từ khi gửi duyệt',
                    'Require receipt attachment before submission',
                  )}
                </span>
              </label>
              <label className="inline-flex items-center gap-2 text-slate-700">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="rounded border-slate-300"
                />
                <span>{tr('Đang hoạt động', 'Active')}</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <IconPlus size={15} />
              <span>
                {isSaving
                  ? tr('Đang lưu...', 'Saving...')
                  : editing
                    ? tr('Cập nhật danh mục', 'Update Category')
                    : tr('Thêm danh mục', 'Add Category')}
              </span>
            </button>
          </form>

          {/* List Right */}
          <div className="space-y-2.5 lg:col-span-7">
            <h4 className="text-xs font-bold tracking-wide text-slate-700 uppercase">
              {tr(`Danh sách danh mục (${categories.length})`, `Categories (${categories.length})`)}
            </h4>
            <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
              {categories.map((cat) => {
                const typeMeta = PAYMENT_TYPE_META[cat.defaultPaymentType];
                return (
                  <div
                    key={cat.id}
                    className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: cat.color }}
                        />
                        <span className="font-bold text-slate-900">
                          {ln(cat.name, cat.nameEn)}
                        </span>
                        <span className="font-mono text-[10px] text-slate-400">{cat.code}</span>
                        <span
                          className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ring-1 ${typeMeta.cls}`}
                        >
                          {locale === 'en' ? typeMeta.short.en : typeMeta.short.vi}
                        </span>
                        {cat.requiresReceipt && (
                          <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                            {tr('Cần chứng từ', 'Receipt Req.')}
                          </span>
                        )}
                      </div>
                      {cat.description && (
                        <p className="mt-0.5 truncate text-[11px] text-slate-500">
                          {cat.description}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => startEdit(cat)}
                        className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-blue-600"
                        title={tr('Chỉnh sửa', 'Edit')}
                      >
                        <IconEdit size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(cat)}
                        className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600"
                        title={tr('Xóa mềm', 'Archive')}
                      >
                        <IconTrash size={15} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
