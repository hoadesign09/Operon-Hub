'use client';

import { useState, type FormEvent } from 'react';
import { IconCoins, IconX } from '@tabler/icons-react';
import type { BudgetEnforcementMode, BudgetPeriodType } from '@/config/database';
import { useI18n } from '@/shared/i18n/I18nContext';
import type { PaymentCategoryDto } from './payment-ui.helpers';
import type { BudgetListItemDto } from './budget-ui.helpers';

interface SimpleRefOption {
  id: number;
  code: string;
  name: string;
  nameEn?: string | null;
  branchId?: number;
}

interface BudgetFormModalProps {
  isOpen: boolean;
  editingBudget: BudgetListItemDto | null;
  branches: SimpleRefOption[];
  departments: SimpleRefOption[];
  categories: PaymentCategoryDto[];
  projects: Array<{ id: number; code: string; name: string }>;
  onClose: () => void;
  onSaved: () => void;
}

export function BudgetFormModal({
  isOpen,
  editingBudget,
  branches,
  departments,
  categories,
  projects,
  onClose,
  onSaved,
}: BudgetFormModalProps) {
  const { tr, ln } = useI18n();
  const currentYear = new Date().getFullYear();

  const [code, setCode] = useState(editingBudget?.code ?? '');
  const [name, setName] = useState(editingBudget?.name ?? '');
  const [nameEn, setNameEn] = useState(editingBudget?.nameEn ?? '');
  const [description, setDescription] = useState(editingBudget?.description ?? '');
  const [fiscalYear, setFiscalYear] = useState(String(editingBudget?.fiscalYear ?? currentYear));
  const [periodType, setPeriodType] = useState<BudgetPeriodType>(
    editingBudget?.periodType ?? 'ANNUAL',
  );
  const [periodLabel, setPeriodLabel] = useState(
    editingBudget?.periodLabel ?? `FY${currentYear}`,
  );
  const [startDate, setStartDate] = useState(
    editingBudget?.startDate ?? `${currentYear}-01-01`,
  );
  const [endDate, setEndDate] = useState(editingBudget?.endDate ?? `${currentYear}-12-31`);
  const [branchId, setBranchId] = useState(
    editingBudget?.branchId ? String(editingBudget.branchId) : '',
  );
  const [departmentId, setDepartmentId] = useState(
    editingBudget?.departmentId ? String(editingBudget.departmentId) : '',
  );
  const [categoryId, setCategoryId] = useState(
    editingBudget?.categoryId ? String(editingBudget.categoryId) : '',
  );
  const [projectId, setProjectId] = useState(
    editingBudget?.projectId ? String(editingBudget.projectId) : '',
  );
  const [allocatedAmount, setAllocatedAmount] = useState(
    editingBudget ? String(editingBudget.allocatedAmount) : '100000000',
  );
  const [warningThresholdPercent, setWarningThresholdPercent] = useState(
    String(editingBudget?.warningThresholdPercent ?? 80),
  );
  const [enforcementMode, setEnforcementMode] = useState<BudgetEnforcementMode>(
    editingBudget?.enforcementMode ?? 'HARD_BLOCK',
  );
  const [initialStatus, setInitialStatus] = useState<'ACTIVE' | 'DRAFT'>('ACTIVE');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const filteredDepts = branchId
    ? departments.filter((d) => !d.branchId || String(d.branchId) === branchId)
    : departments;

  function applyPeriodPreset(nextType: BudgetPeriodType) {
    setPeriodType(nextType);
    const yr = Number(fiscalYear) || currentYear;
    if (nextType === 'ANNUAL') {
      setPeriodLabel(`FY${yr}`);
      setStartDate(`${yr}-01-01`);
      setEndDate(`${yr}-12-31`);
    } else if (nextType === 'QUARTERLY') {
      setPeriodLabel(`Q4/${yr}`);
      setStartDate(`${yr}-10-01`);
      setEndDate(`${yr}-12-31`);
    } else if (nextType === 'MONTHLY') {
      const m = String(new Date().getMonth() + 1).padStart(2, '0');
      setPeriodLabel(`T${m}/${yr}`);
      setStartDate(`${yr}-${m}-01`);
      setEndDate(`${yr}-${m}-28`);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (isSubmitting) return;
    setErrorMessage('');
    setIsSubmitting(true);

    try {
      const payload = editingBudget
        ? {
            name: name.trim(),
            nameEn: nameEn.trim() || null,
            description: description.trim() || null,
            fiscalYear: Number(fiscalYear),
            periodType,
            periodLabel: periodLabel.trim(),
            startDate,
            endDate,
            branchId: branchId ? Number(branchId) : null,
            departmentId: departmentId ? Number(departmentId) : null,
            categoryId: categoryId ? Number(categoryId) : null,
            projectId: projectId ? Number(projectId) : null,
            warningThresholdPercent: Number(warningThresholdPercent) || 80,
            enforcementMode,
          }
        : {
            ...(code.trim() ? { code: code.trim().toUpperCase() } : {}),
            name: name.trim(),
            nameEn: nameEn.trim() || null,
            description: description.trim() || null,
            fiscalYear: Number(fiscalYear),
            periodType,
            periodLabel: periodLabel.trim(),
            startDate,
            endDate,
            branchId: branchId ? Number(branchId) : null,
            departmentId: departmentId ? Number(departmentId) : null,
            categoryId: categoryId ? Number(categoryId) : null,
            projectId: projectId ? Number(projectId) : null,
            allocatedAmount: Number(allocatedAmount) || 0,
            warningThresholdPercent: Number(warningThresholdPercent) || 80,
            enforcementMode,
            status: initialStatus,
          };

      const url = editingBudget
        ? `/api/v1/payments/budgets/${editingBudget.id}`
        : '/api/v1/payments/budgets';
      const res = await fetch(url, {
        method: editingBudget ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => null)) as {
        success?: boolean;
        error?: { message?: string };
      } | null;

      if (!res.ok || !json?.success) {
        setErrorMessage(
          json?.error?.message ??
            tr('Không thể lưu quỹ ngân sách.', 'Unable to save budget fund.'),
        );
        return;
      }

      onSaved();
    } catch {
      setErrorMessage(
        tr('Lỗi kết nối máy chủ. Vui lòng thử lại.', 'Network error. Please try again.'),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-[2px]">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 bg-[#0F172A] px-6 py-4 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-400/30">
              <IconCoins size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold">
                {editingBudget
                  ? tr(`Chỉnh sửa Quỹ Ngân sách ${editingBudget.code}`, `Edit Budget Fund ${editingBudget.code}`)
                  : tr('Tạo Quỹ Ngân sách mới', 'Create New Budget Fund')}
              </h2>
              <p className="text-xs text-slate-300">
                {tr(
                  'Quỹ ngân sách dùng chung cho cả Đề xuất Nội bộ và Đề nghị Thanh toán.',
                  'Shared budget source for both Internal Proposals and Payment Requests.',
                )}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
          >
            <IconX size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 space-y-4 overflow-y-auto p-6">
          {errorMessage && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-medium text-rose-700">
              {errorMessage}
            </div>
          )}

          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
            {!editingBudget && (
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  {tr('Mã quỹ (để trống tự sinh)', 'Budget Code (auto if blank)')}
                </label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="BUD-2026-TECH-002"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-xs uppercase outline-none focus:border-blue-500"
                />
              </div>
            )}
            <div className={editingBudget ? 'sm:col-span-3' : 'sm:col-span-2'}>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                {tr('Tên quỹ ngân sách (Tiếng Việt) *', 'Budget Fund Name (Vietnamese) *')}
              </label>
              <input
                type="text"
                required
                minLength={3}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={tr('VD: Ngân sách Marketing & Sự kiện Q4/2026', 'e.g. Q4/2026 Marketing & Events Budget')}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-blue-500"
              />
            </div>
            <div className="sm:col-span-3">
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                {tr('Tên quỹ tiếng Anh (tùy chọn)', 'Budget Fund Name (English)')}
              </label>
              <input
                type="text"
                value={nameEn}
                onChange={(e) => setNameEn(e.target.value)}
                placeholder="e.g. Q4/2026 Marketing & Events Budget"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                {tr('Năm tài chính *', 'Fiscal Year *')}
              </label>
              <input
                type="number"
                required
                min={2020}
                max={2100}
                value={fiscalYear}
                onChange={(e) => setFiscalYear(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                {tr('Loại kỳ *', 'Period Type *')}
              </label>
              <select
                value={periodType}
                onChange={(e) => applyPeriodPreset(e.target.value as BudgetPeriodType)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-blue-500"
              >
                <option value="ANNUAL">{tr('Theo năm', 'Annual')}</option>
                <option value="QUARTERLY">{tr('Theo quý', 'Quarterly')}</option>
                <option value="MONTHLY">{tr('Theo tháng', 'Monthly')}</option>
                <option value="CUSTOM">{tr('Tùy chỉnh', 'Custom')}</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                {tr('Nhãn kỳ *', 'Period Label *')}
              </label>
              <input
                type="text"
                required
                value={periodLabel}
                onChange={(e) => setPeriodLabel(e.target.value)}
                placeholder="FY2026 / Q4/2026"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                {tr('Ngưỡng cảnh báo (%)', 'Warning Threshold (%)')}
              </label>
              <input
                type="number"
                min={1}
                max={100}
                value={warningThresholdPercent}
                onChange={(e) => setWarningThresholdPercent(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-blue-500"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                {tr('Hiệu lực từ ngày *', 'Effective From *')}
              </label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-blue-500"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                {tr('Đến ngày *', 'Effective To *')}
              </label>
              <input
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3.5 rounded-xl border border-slate-200 bg-slate-50/70 p-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                {tr('Phạm vi Chi nhánh', 'Branch Scope')}
              </label>
              <select
                value={branchId}
                onChange={(e) => {
                  setBranchId(e.target.value);
                  setDepartmentId('');
                }}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-blue-500"
              >
                <option value="">{tr('Toàn công ty (Mọi chi nhánh)', 'Company-wide (All branches)')}</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {ln(b.name, b.nameEn)} ({b.code})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                {tr('Phòng ban áp dụng', 'Department')}
              </label>
              <select
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-blue-500"
              >
                <option value="">{tr('Dùng chung mọi phòng ban', 'Shared across departments')}</option>
                {filteredDepts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {ln(d.name, d.nameEn)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                {tr('Danh mục khoản chi', 'Expense Category')}
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-blue-500"
              >
                <option value="">{tr('Mọi danh mục khoản chi', 'All expense categories')}</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {ln(c.name, c.nameEn)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                {tr('Gắn Dự án (tùy chọn)', 'Linked Project (optional)')}
              </label>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-blue-500"
              >
                <option value="">{tr('Không gắn dự án cụ thể', 'No specific project')}</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    [{p.code}] {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
            {!editingBudget && (
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  {tr('Hạn mức cấp ban đầu (VNĐ) *', 'Initial Allocation (VND) *')}
                </label>
                <input
                  type="number"
                  required
                  min={1000}
                  step={100000}
                  value={allocatedAmount}
                  onChange={(e) => setAllocatedAmount(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-right font-bold text-xs outline-none focus:border-blue-500"
                />
              </div>
            )}
            <div className={editingBudget ? 'sm:col-span-3' : ''}>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                {tr('Chính sách vượt hạn mức *', 'Overrun Enforcement *')}
              </label>
              <select
                value={enforcementMode}
                onChange={(e) => setEnforcementMode(e.target.value as BudgetEnforcementMode)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-blue-500"
              >
                <option value="HARD_BLOCK">
                  {tr('Chặn cứng (Không cho gửi duyệt khi vượt)', 'Hard Block (Block submission on overrun)')}
                </option>
                <option value="SOFT_WARN">
                  {tr('Cảnh báo mềm (Cho phép kèm cảnh báo)', 'Soft Warn (Allow with overrun alert)')}
                </option>
              </select>
            </div>
            {!editingBudget && (
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  {tr('Trạng thái khởi tạo', 'Initial Status')}
                </label>
                <select
                  value={initialStatus}
                  onChange={(e) => setInitialStatus(e.target.value as 'ACTIVE' | 'DRAFT')}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-blue-500"
                >
                  <option value="ACTIVE">{tr('Kích hoạt ngay (ACTIVE)', 'Activate Immediately')}</option>
                  <option value="DRAFT">{tr('Lưu nháp (DRAFT)', 'Save as Draft')}</option>
                </select>
              </div>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              {tr('Mô tả & Quy định chi tiêu', 'Description & Spending Guidelines')}
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex justify-end gap-2.5 border-t border-slate-100 pt-4">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              {tr('Hủy', 'Cancel')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmitting
                ? tr('Đang lưu...', 'Saving...')
                : editingBudget
                  ? tr('Cập nhật Quỹ Ngân sách', 'Update Budget Fund')
                  : tr('Tạo Quỹ Ngân sách', 'Create Budget Fund')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
