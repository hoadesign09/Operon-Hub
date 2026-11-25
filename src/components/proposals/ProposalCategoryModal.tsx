'use client';

import { useState, type FormEvent } from 'react';
import { IconX } from '@tabler/icons-react';
import type { ProposalCategoryOption } from '@/components/proposals/proposal-ui.constants';
import { useI18n } from '@/shared/i18n/I18nContext';

interface ProposalCategoryModalProps {
  isOpen: boolean;
  editingCategory: ProposalCategoryOption | null;
  onClose: () => void;
  onSaved: () => void;
}

export function ProposalCategoryModal({
  isOpen,
  editingCategory,
  onClose,
  onSaved,
}: ProposalCategoryModalProps) {
  const { tr } = useI18n();
  const [code, setCode] = useState(editingCategory?.code ?? '');
  const [name, setName] = useState(editingCategory?.name ?? '');
  const [nameEn, setNameEn] = useState(editingCategory?.nameEn ?? '');
  const [description, setDescription] = useState(editingCategory?.description ?? '');
  const [defaultRequestType, setDefaultRequestType] = useState(
    editingCategory?.defaultRequestType ?? 'PROPOSAL_STANDARD',
  );
  const [requiresBudget, setRequiresBudget] = useState(editingCategory?.requiresBudget ?? true);
  const [budgetThresholdHigh, setBudgetThresholdHigh] = useState(
    String(editingCategory?.budgetThresholdHigh ?? 20000000),
  );
  const [colorHex, setColorHex] = useState(editingCategory?.colorHex ?? '#2563EB');
  const [sortOrder, setSortOrder] = useState(String(editingCategory?.sortOrder ?? 10));
  const [isActive, setIsActive] = useState(editingCategory?.isActive ?? true);
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) {
    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError('');
    setIsSaving(true);
    try {
      const payload = {
        code: code.trim().toUpperCase(),
        name: name.trim(),
        nameEn: nameEn.trim() || null,
        description: description.trim() || null,
        defaultRequestType: defaultRequestType.trim().toUpperCase() || 'PROPOSAL_STANDARD',
        requiresBudget,
        budgetThresholdHigh: Number(budgetThresholdHigh) || 20000000,
        colorHex,
        sortOrder: Number(sortOrder) || 0,
        isActive,
      };
      const url = editingCategory
        ? `/api/v1/proposals/categories/${editingCategory.id}`
        : '/api/v1/proposals/categories';
      const method = editingCategory ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => null)) as {
        success?: boolean;
        error?: { message?: string };
      } | null;

      if (!res.ok || !json?.success) {
        setFormError(
          json?.error?.message ??
            tr('Không thể lưu danh mục đề xuất.', 'Unable to save proposal category.'),
        );
        return;
      }

      onSaved();
    } catch {
      setFormError(
        tr('Lỗi kết nối khi lưu danh mục.', 'Connection error while saving category.'),
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 className="text-base font-bold text-slate-900">
            {editingCategory
              ? tr('Cập nhật Danh mục Đề xuất', 'Edit Proposal Category')
              : tr('Thêm Danh mục Đề xuất Mới', 'Add Proposal Category')}
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
          {formError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {formError}
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
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="PROCUREMENT"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-sm uppercase outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                {tr('Loại luồng duyệt', 'Approval Request Type')}
              </label>
              <input
                type="text"
                required
                value={defaultRequestType}
                onChange={(e) => setDefaultRequestType(e.target.value.toUpperCase())}
                placeholder="PROPOSAL_STANDARD"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-sm uppercase outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                {tr('Tên danh mục (Tiếng Việt) *', 'Category Name (Vietnamese) *')}
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                {tr('Tên tiếng Anh (tùy chọn)', 'English Name (optional)')}
              </label>
              <input
                type="text"
                value={nameEn}
                onChange={(e) => setNameEn(e.target.value)}
                placeholder="e.g. Marketing Campaigns"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
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
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                {tr('Ngưỡng duyệt cấp cao (VNĐ)', 'High-Value Threshold (VND)')}
              </label>
              <input
                type="number"
                min="0"
                step="1000000"
                value={budgetThresholdHigh}
                onChange={(e) => setBudgetThresholdHigh(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                {tr('Màu nhận diện', 'Badge Color')}
              </label>
              <input
                type="color"
                value={colorHex}
                onChange={(e) => setColorHex(e.target.value)}
                className="h-10 w-full cursor-pointer rounded-xl border border-slate-300 px-1 py-1"
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
          </div>

          <div className="flex flex-wrap gap-5 pt-1">
            <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700">
              <input
                type="checkbox"
                checked={requiresBudget}
                onChange={(e) => setRequiresBudget(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              <span>{tr('Thường phát sinh ngân sách', 'Typically involves budget')}</span>
            </label>
            <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              <span>{tr('Đang kích hoạt', 'Active')}</span>
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-3">
            <button
              type="button"
              disabled={isSaving}
              onClick={onClose}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
            >
              {tr('Hủy', 'Cancel')}
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {isSaving ? tr('Đang lưu...', 'Saving...') : tr('Lưu danh mục', 'Save Category')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
