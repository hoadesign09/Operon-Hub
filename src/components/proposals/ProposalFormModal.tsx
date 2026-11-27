'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { IconPlus, IconSend, IconTrash, IconX } from '@tabler/icons-react';
import { formatVND } from '@/lib/portable/currency-utils';
import { calculateProposalLineTotals } from '@/lib/portable/proposal-calculator';
import { BudgetImpactPreview } from '@/components/payments/BudgetImpactPreview';
import type { BudgetOptionDto } from '@/components/payments/budget-ui.helpers';
import {
  PROPOSAL_PRIORITY_META,
  type ProposalCategoryOption,
  type ProposalLineDraft,
  type ProposalPriorityKey,
} from '@/components/proposals/proposal-ui.constants';
import { useI18n } from '@/shared/i18n/I18nContext';

interface BranchOption {
  id: number;
  code: string;
  name: string;
  nameEn?: string | null;
}

interface DepartmentOption {
  id: number;
  code: string;
  name: string;
  nameEn?: string | null;
  branchId: number;
}

export interface EditableProposalData {
  id: number;
  categoryId: number;
  branchId: number;
  departmentId: number | null;
  budgetId?: number | null;
  title: string;
  summary: string | null;
  content: string;
  expectedOutcome: string | null;
  priority: ProposalPriorityKey;
  estimatedBudget: number;
  neededByDate: string | null;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  vendorName: string | null;
  items: Array<{
    itemName: string;
    specification: string | null;
    unit: string;
    quantity: number;
    unitPrice: number;
    vendorNote: string | null;
  }>;
}

interface ProposalFormModalProps {
  isOpen: boolean;
  editingProposal: EditableProposalData | null;
  categories: ProposalCategoryOption[];
  branches: BranchOption[];
  departments: DepartmentOption[];
  budgets?: BudgetOptionDto[];
  onClose: () => void;
  onSaved: (proposalId?: number) => void;
}

function makeEmptyLine(defaultUnit: string): ProposalLineDraft {
  return {
    itemName: '',
    specification: '',
    unit: defaultUnit,
    quantity: '1',
    unitPrice: '0',
    vendorNote: '',
  };
}

export function ProposalFormModal({
  isOpen,
  editingProposal,
  categories,
  branches,
  departments,
  budgets = [],
  onClose,
  onSaved,
}: ProposalFormModalProps) {
  const { locale, tr, ln } = useI18n();
  const activeCategories = categories.filter((c) => c.isActive);

  const [categoryId, setCategoryId] = useState<string>(() =>
    editingProposal
      ? String(editingProposal.categoryId)
      : String(activeCategories[0]?.id ?? categories[0]?.id ?? ''),
  );
  const [branchId, setBranchId] = useState<string>(() =>
    editingProposal ? String(editingProposal.branchId) : String(branches[0]?.id ?? ''),
  );
  const [departmentId, setDepartmentId] = useState<string>(() =>
    editingProposal?.departmentId ? String(editingProposal.departmentId) : '',
  );
  const [budgetId, setBudgetId] = useState<string>(() =>
    editingProposal?.budgetId ? String(editingProposal.budgetId) : '',
  );
  const [title, setTitle] = useState(editingProposal?.title ?? '');
  const [summary, setSummary] = useState(editingProposal?.summary ?? '');
  const [content, setContent] = useState(editingProposal?.content ?? '');
  const [expectedOutcome, setExpectedOutcome] = useState(editingProposal?.expectedOutcome ?? '');
  const [priority, setPriority] = useState<ProposalPriorityKey>(
    editingProposal?.priority ?? 'MEDIUM',
  );
  const [manualBudget, setManualBudget] = useState<string>(
    editingProposal ? String(editingProposal.estimatedBudget) : '0',
  );
  const [neededByDate, setNeededByDate] = useState(editingProposal?.neededByDate ?? '');
  const [effectiveFrom, setEffectiveFrom] = useState(editingProposal?.effectiveFrom ?? '');
  const [effectiveTo, setEffectiveTo] = useState(editingProposal?.effectiveTo ?? '');
  const [vendorName, setVendorName] = useState(editingProposal?.vendorName ?? '');
  const [lines, setLines] = useState<ProposalLineDraft[]>(() =>
    editingProposal && editingProposal.items.length > 0
      ? editingProposal.items.map((it) => ({
          itemName: it.itemName,
          specification: it.specification ?? '',
          unit: it.unit,
          quantity: String(it.quantity),
          unitPrice: String(it.unitPrice),
          vendorNote: it.vendorNote ?? '',
        }))
      : [],
  );
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const selectedCategory = useMemo(
    () => categories.find((c) => String(c.id) === categoryId) ?? null,
    [categories, categoryId],
  );

  const filteredDepartments = useMemo(() => {
    if (!branchId) {
      return departments;
    }
    return departments.filter((d) => String(d.branchId) === branchId);
  }, [departments, branchId]);

  const selectedBudget = useMemo(() => {
    const idNum = Number(budgetId);
    if (!idNum) return null;
    return budgets.find((b) => b.id === idNum) ?? null;
  }, [budgetId, budgets]);

  const parsedLinesSummary = useMemo(() => {
    const valid = lines
      .filter((l) => l.itemName.trim().length > 0)
      .map((l) => ({
        quantity: Number(l.quantity) || 0,
        unitPrice: Number(l.unitPrice) || 0,
      }));
    return calculateProposalLineTotals(valid);
  }, [lines]);

  const effectiveBudget =
    lines.some((l) => l.itemName.trim().length > 0)
      ? parsedLinesSummary.grandTotal
      : Number(manualBudget) || 0;

  if (!isOpen) {
    return null;
  }

  function addLine() {
    setLines((prev) => [...prev, makeEmptyLine(tr('Cái', 'Unit'))]);
  }

  function removeLine(idx: number) {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateLine(idx: number, patch: Partial<ProposalLineDraft>) {
    setLines((prev) => prev.map((line, i) => (i === idx ? { ...line, ...patch } : line)));
  }

  async function submitForm(submitImmediately: boolean) {
    setFormError('');
    if (!categoryId) {
      setFormError(tr('Vui lòng chọn danh mục đề xuất.', 'Please select a proposal category.'));
      return;
    }
    if (title.trim().length < 5) {
      setFormError(
        tr('Tiêu đề đề xuất phải có tối thiểu 5 ký tự.', 'Proposal title must be at least 5 characters.'),
      );
      return;
    }
    if (content.trim().length < 10) {
      setFormError(
        tr(
          'Nội dung chi tiết phải có tối thiểu 10 ký tự.',
          'Detailed description must be at least 10 characters.',
        ),
      );
      return;
    }

    const cleanedItems = lines
      .filter((l) => l.itemName.trim().length > 0)
      .map((l) => ({
        itemName: l.itemName.trim(),
        specification: l.specification.trim() || null,
        unit: l.unit.trim() || tr('Cái', 'Unit'),
        quantity: Number(l.quantity) || 1,
        unitPrice: Number(l.unitPrice) || 0,
        vendorNote: l.vendorNote.trim() || null,
      }));

    setIsSaving(true);
    try {
      const payload = {
        categoryId: Number(categoryId),
        branchId: branchId ? Number(branchId) : null,
        departmentId: departmentId ? Number(departmentId) : null,
        budgetId: budgetId ? Number(budgetId) : null,
        title: title.trim(),
        summary: summary.trim() || null,
        content: content.trim(),
        expectedOutcome: expectedOutcome.trim() || null,
        priority,
        estimatedBudget: effectiveBudget,
        neededByDate: neededByDate || null,
        effectiveFrom: effectiveFrom || null,
        effectiveTo: effectiveTo || null,
        vendorName: vendorName.trim() || null,
        items: cleanedItems,
        ...(editingProposal ? {} : { submitImmediately }),
      };

      const url = editingProposal
        ? `/api/v1/proposals/${editingProposal.id}`
        : '/api/v1/proposals';
      const method = editingProposal ? 'PATCH' : 'POST';

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

      if (!res.ok || !json?.success) {
        setFormError(
          json?.error?.message ??
            tr('Không thể lưu đề xuất nội bộ.', 'Unable to save internal proposal.'),
        );
        return;
      }

      if (editingProposal && submitImmediately) {
        const submitRes = await fetch(`/api/v1/proposals/${editingProposal.id}/submit`, {
          method: 'POST',
        });
        const submitJson = (await submitRes.json().catch(() => null)) as {
          success?: boolean;
          error?: { message?: string };
        } | null;
        if (!submitRes.ok || !submitJson?.success) {
          setFormError(
            submitJson?.error?.message ??
              tr(
                'Đã lưu nội dung nhưng chưa thể gửi phê duyệt.',
                'Saved changes, but failed to submit for approval.',
              ),
          );
          return;
        }
      }

      onSaved(json.data?.id ?? editingProposal?.id);
    } catch {
      setFormError(
        tr('Lỗi kết nối khi lưu đề xuất.', 'Connection error while saving proposal.'),
      );
    } finally {
      setIsSaving(false);
    }
  }

  function handleFormSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitForm(false);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {editingProposal
                ? tr('Chỉnh sửa Đề xuất Nội bộ', 'Edit Internal Proposal')
                : tr('Tạo Tờ trình Đề xuất Mới', 'Create Internal Proposal')}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {tr(
                'Điền đầy đủ lý do, kết quả kỳ vọng và bảng dự toán (nếu có) để hệ thống định tuyến phê duyệt tự động.',
                'Provide rationale, expected outcomes, and budget line items (optional) for automatic approval routing.',
              )}
            </p>
          </div>
          <button
            type="button"
            disabled={isSaving}
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <IconX size={18} />
          </button>
        </div>

        <form onSubmit={handleFormSubmit} className="mt-5 space-y-5">
          {formError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
            <div className="lg:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                {tr('Danh mục đề xuất *', 'Proposal Category *')}
              </label>
              <select
                required
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500"
              >
                <option value="">{tr('-- Chọn danh mục --', '-- Select category --')}</option>
                {activeCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {ln(c.name, c.nameEn)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                {tr('Mức ưu tiên', 'Priority')}
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as ProposalPriorityKey)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500"
              >
                {(Object.keys(PROPOSAL_PRIORITY_META) as ProposalPriorityKey[]).map((key) => (
                  <option key={key} value={key}>
                    {locale === 'en'
                      ? PROPOSAL_PRIORITY_META[key].en
                      : PROPOSAL_PRIORITY_META[key].vi}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                {tr('Hạn cần hoàn tất', 'Needed By Date')}
              </label>
              <input
                type="date"
                value={neededByDate}
                onChange={(e) => setNeededByDate(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                {tr('Chi nhánh áp dụng', 'Branch')}
              </label>
              <select
                value={branchId}
                onChange={(e) => {
                  setBranchId(e.target.value);
                  setDepartmentId('');
                }}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {ln(b.name, b.nameEn)} ({b.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                {tr('Phòng ban đề xuất', 'Department')}
              </label>
              <select
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500"
              >
                <option value="">{tr('Theo hồ sơ nhân viên', 'Default from employee profile')}</option>
                {filteredDepartments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {ln(d.name, d.nameEn)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                {tr('Nhà cung cấp / Đối tác (nếu có)', 'Vendor / Partner (optional)')}
              </label>
              <input
                type="text"
                value={vendorName}
                onChange={(e) => setVendorName(e.target.value)}
                placeholder={tr('VD: Công ty TNHH Thiết bị ABC', 'e.g. Acme Supplies Ltd.')}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              {tr('Tiêu đề đề xuất *', 'Proposal Title *')}
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={tr(
                'VD: Đề xuất nâng cấp màn hình làm việc cho nhóm Kỹ thuật quý IV',
                'e.g. Proposal to upgrade 4K monitors for Engineering team in Q4',
              )}
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-800 outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              {tr('Tóm tắt ngắn gọn', 'Executive Summary')}
            </label>
            <input
              type="text"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder={tr(
                'Tóm tắt 1-2 dòng hiển thị nhanh trên bảng danh sách và hộp thư duyệt',
                '1-2 sentence overview displayed in list and approval inbox',
              )}
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-800 outline-none focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                {tr('Nội dung & Lý do chi tiết *', 'Detailed Content & Rationale *')}
              </label>
              <textarea
                rows={4}
                required
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={tr(
                  'Mô tả thực trạng, lý do cần thiết, phương án triển khai đề xuất...',
                  'Describe current situation, business rationale, and implementation plan...',
                )}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-800 outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                {tr('Kết quả & Hiệu quả kỳ vọng', 'Expected Outcome / ROI')}
              </label>
              <textarea
                rows={4}
                value={expectedOutcome}
                onChange={(e) => setExpectedOutcome(e.target.value)}
                placeholder={tr(
                  'Lợi ích đo lường được sau khi đề xuất được phê duyệt và triển khai...',
                  'Measurable outcomes and expected benefits once approved...',
                )}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-800 outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                {tr('Thời gian áp dụng từ ngày', 'Effective From')}
              </label>
              <input
                type="date"
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                {tr('Đến ngày', 'Effective To')}
              </label>
              <input
                type="date"
                value={effectiveTo}
                onChange={(e) => setEffectiveTo(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Budget & Line Items Builder */}
          <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
            <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3.5">
              <label className="block text-xs font-bold text-slate-700">
                {tr('Nguồn Quỹ Ngân sách Sử dụng (từ Module Thanh toán)', 'Budget Fund Source (from Payments Module)')}
              </label>
              <select
                value={budgetId}
                onChange={(e) => setBudgetId(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:border-blue-500"
              >
                <option value="">
                  {tr('-- Không gắn quỹ ngân sách (hoặc đề xuất không phát sinh chi phí) --', '-- No budget fund assigned --')}
                </option>
                {budgets.map((b) => (
                  <option key={b.id} value={b.id}>
                    [{b.code}] {ln(b.name, b.nameEn)} — {tr('Khả dụng', 'Avail')}: {formatVND(b.availableAmount)}
                  </option>
                ))}
              </select>
              {selectedBudget && (
                <BudgetImpactPreview
                  budget={selectedBudget}
                  requestedAmount={effectiveBudget}
                />
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wide text-slate-700">
                  {tr('Bảng Dự toán Chi tiết Hạng mục (VNĐ)', 'Budget & Cost Breakdown (VND)')}
                </h3>
                <p className="text-[11px] text-slate-500">
                  {selectedCategory
                    ? tr(
                        `Ngưỡng duyệt cấp cao của danh mục này: ≥ ${formatVND(selectedCategory.budgetThresholdHigh)}`,
                        `Executive approval threshold for this category: ≥ ${formatVND(selectedCategory.budgetThresholdHigh)}`,
                      )
                    : tr(
                        'Thêm từng dòng chi phí để tự động cộng tổng hoặc nhập trực tiếp tổng ngân sách dự kiến.',
                        'Add line items for automatic calculation or enter an estimated lump-sum budget.',
                      )}
                </p>
              </div>
              <button
                type="button"
                onClick={addLine}
                className="inline-flex items-center gap-1 rounded-xl border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-50"
              >
                <IconPlus size={14} />
                <span>{tr('Thêm hạng mục', 'Add Line Item')}</span>
              </button>
            </div>

            {lines.length === 0 ? (
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <label className="text-xs font-medium text-slate-600">
                  {tr(
                    'Ngân sách dự kiến tổng (nhập 0 nếu không phát sinh chi phí):',
                    'Estimated Lump-Sum Budget (enter 0 if no cost involved):',
                  )}
                </label>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={manualBudget}
                  onChange={(e) => setManualBudget(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-right text-sm font-semibold text-slate-800 sm:w-56"
                />
              </div>
            ) : (
              <div className="mt-3 space-y-2.5">
                {lines.map((line, idx) => {
                  const qty = Number(line.quantity) || 0;
                  const price = Number(line.unitPrice) || 0;
                  const rowTotal = Math.max(0, qty * price);
                  return (
                    <div
                      key={idx}
                      className="grid grid-cols-1 gap-2 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-12"
                    >
                      <div className="sm:col-span-4">
                        <input
                          type="text"
                          value={line.itemName}
                          onChange={(e) => updateLine(idx, { itemName: e.target.value })}
                          placeholder={tr('Tên hạng mục *', 'Item name *')}
                          className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs outline-none focus:border-blue-500"
                        />
                        <input
                          type="text"
                          value={line.specification}
                          onChange={(e) => updateLine(idx, { specification: e.target.value })}
                          placeholder={tr('Quy cách / Ghi chú kỹ thuật', 'Specification / Note')}
                          className="mt-1.5 w-full rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] text-slate-600 outline-none focus:border-blue-500"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <input
                          type="text"
                          value={line.unit}
                          onChange={(e) => updateLine(idx, { unit: e.target.value })}
                          placeholder={tr('ĐVT', 'Unit')}
                          className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs outline-none focus:border-blue-500"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <input
                          type="number"
                          min="0.01"
                          step="any"
                          value={line.quantity}
                          onChange={(e) => updateLine(idx, { quantity: e.target.value })}
                          placeholder={tr('SL', 'Qty')}
                          className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-right text-xs outline-none focus:border-blue-500"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <input
                          type="number"
                          min="0"
                          step="1000"
                          value={line.unitPrice}
                          onChange={(e) => updateLine(idx, { unitPrice: e.target.value })}
                          placeholder={tr('Đơn giá', 'Unit price')}
                          className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-right text-xs outline-none focus:border-blue-500"
                        />
                      </div>
                      <div className="flex items-center justify-between gap-1 sm:col-span-2 sm:justify-end">
                        <span className="text-xs font-semibold text-slate-800">
                          {formatVND(rowTotal)}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeLine(idx)}
                          className="rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                          title={tr('Xóa dòng', 'Remove row')}
                        >
                          <IconTrash size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3">
              <span className="text-xs font-semibold text-slate-700">
                {tr('Tổng ngân sách dự kiến:', 'Total Estimated Budget:')}
              </span>
              <span className="text-base font-bold text-blue-700">
                {formatVND(effectiveBudget)}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-2.5 border-t border-slate-100 pt-4">
            <button
              type="button"
              disabled={isSaving}
              onClick={onClose}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              {tr('Hủy', 'Cancel')}
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-xl border border-blue-300 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-60"
            >
              {isSaving
                ? tr('Đang lưu...', 'Saving...')
                : tr('Lưu nháp', 'Save Draft')}
            </button>
            <button
              type="button"
              disabled={isSaving}
              onClick={() => void submitForm(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              <IconSend size={15} />
              <span>
                {isSaving
                  ? tr('Đang gửi...', 'Submitting...')
                  : tr('Lưu & Gửi phê duyệt ngay', 'Save & Submit Now')}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
