'use client';

import { useMemo, useState, type FormEvent } from 'react';
import {
  IconBuildingBank,
  IconCash,
  IconCheck,
  IconCopy,
  IconFileInvoice,
  IconPlus,
  IconReceiptRefund,
  IconSend,
  IconShieldCheck,
  IconTrash,
  IconUserCheck,
  IconX,
} from '@tabler/icons-react';
import type {
  PaymentBeneficiaryType,
  PaymentMethod,
  PaymentPriority,
  PaymentType,
} from '@/config/database';
import { formatVND } from '@/lib/portable/currency-utils';
import {
  amountToEnglishWords,
  amountToVietnameseWords,
  calculatePaymentLineItems,
  computeAdvanceSettlement,
} from '@/lib/portable/payment-calculator';
import { PAYMENT_HIGH_VALUE_THRESHOLD_VND } from '@/modules/payments/payments.constants';
import { useI18n } from '@/shared/i18n/I18nContext';
import { BudgetImpactPreview } from './BudgetImpactPreview';
import {
  PAYMENT_TYPE_META,
  type PaymentCategoryDto,
  type PaymentDetailDto,
  type PaymentFormOptionsDto,
} from './payment-ui.helpers';

interface LineItemDraft {
  key: string;
  description: string;
  invoiceNo: string;
  invoiceDate: string;
  quantity: string;
  unitPrice: string;
  taxRate: string;
  note: string;
}

interface PaymentFormModalProps {
  isOpen: boolean;
  editingPayment: PaymentDetailDto | null;
  presetAdvanceId?: number | null;
  presetProposalId?: number | null;
  categories: PaymentCategoryDto[];
  options: PaymentFormOptionsDto | null;
  onClose: () => void;
  onSaved: (saved: PaymentDetailDto) => void;
}

function makeEmptyItem(index: number): LineItemDraft {
  return {
    key: `row-${Date.now()}-${index}`,
    description: '',
    invoiceNo: '',
    invoiceDate: '',
    quantity: '1',
    unitPrice: '',
    taxRate: '0',
    note: '',
  };
}

const PAYMENT_TYPE_ORDER: readonly PaymentType[] = [
  'CASH_ADVANCE',
  'REIMBURSEMENT',
  'VENDOR_PAYMENT',
  'ADVANCE_SETTLEMENT',
];

export function PaymentFormModal({
  isOpen,
  editingPayment,
  presetAdvanceId,
  presetProposalId,
  categories,
  options,
  onClose,
  onSaved,
}: PaymentFormModalProps) {
  const { locale, tr, ln } = useI18n();
  const activeCategories = useMemo(
    () => categories.filter((c) => c.isActive),
    [categories],
  );
  const presetProposal = useMemo(
    () =>
      presetProposalId && options
        ? options.approvedProposals.find((p) => p.id === presetProposalId) ?? null
        : null,
    [presetProposalId, options],
  );

  const initialType: PaymentType =
    editingPayment?.paymentType ??
    (presetAdvanceId
      ? 'ADVANCE_SETTLEMENT'
      : presetProposal?.vendorName
        ? 'VENDOR_PAYMENT'
        : 'REIMBURSEMENT');
  const defaultCategoryForType =
    activeCategories.find((c) => c.defaultPaymentType === initialType) ?? activeCategories[0];

  const [paymentType, setPaymentType] = useState<PaymentType>(initialType);
  const [categoryId, setCategoryId] = useState<string>(
    String(editingPayment?.categoryId ?? defaultCategoryForType?.id ?? ''),
  );
  const [priority, setPriority] = useState<PaymentPriority>(
    editingPayment?.priority ?? 'MEDIUM',
  );
  const [title, setTitle] = useState(
    editingPayment?.title ??
      (presetProposal
        ? tr(
            `Thanh toán theo ${presetProposal.code}: ${presetProposal.title}`,
            `Payment for ${presetProposal.code}: ${presetProposal.title}`,
          )
        : ''),
  );
  const [description, setDescription] = useState(
    editingPayment?.description ??
      (presetProposal
        ? tr(
            `Thanh toán triển khai theo Đề xuất đã phê duyệt ${presetProposal.code}.`,
            `Payment executing approved proposal ${presetProposal.code}.`,
          )
        : ''),
  );
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    editingPayment?.paymentMethod ?? 'BANK_TRANSFER',
  );
  const [beneficiaryType, setBeneficiaryType] = useState<PaymentBeneficiaryType>(
    editingPayment?.beneficiaryType ??
      (initialType === 'VENDOR_PAYMENT' ? 'VENDOR' : 'EMPLOYEE'),
  );
  const [beneficiaryName, setBeneficiaryName] = useState(
    editingPayment?.beneficiaryName ??
      (initialType === 'VENDOR_PAYMENT' ? '' : options?.myBankProfile.fullName ?? ''),
  );
  const [beneficiaryTaxCode, setBeneficiaryTaxCode] = useState(
    editingPayment?.beneficiaryTaxCode ?? '',
  );
  const [bankName, setBankName] = useState(
    editingPayment?.bankName ??
      (initialType === 'VENDOR_PAYMENT' ? '' : options?.myBankProfile.bankName ?? ''),
  );
  const [bankAccountNo, setBankAccountNo] = useState(
    editingPayment?.bankAccountNo ??
      (initialType === 'VENDOR_PAYMENT' ? '' : options?.myBankProfile.bankAccountNo ?? ''),
  );
  const [bankBranch, setBankBranch] = useState(editingPayment?.bankBranch ?? '');
  const [dueDate, setDueDate] = useState(editingPayment?.dueDate ?? '');
  const [advanceDueDate, setAdvanceDueDate] = useState(editingPayment?.advanceDueDate ?? '');
  const [linkedAdvanceId, setLinkedAdvanceId] = useState<string>(
    String(editingPayment?.linkedAdvanceId ?? presetAdvanceId ?? ''),
  );
  const [proposalId, setProposalId] = useState<string>(
    editingPayment?.proposalId
      ? String(editingPayment.proposalId)
      : presetProposalId
        ? String(presetProposalId)
        : '',
  );
  const [budgetId, setBudgetId] = useState<string>(
    editingPayment?.budgetId
      ? String(editingPayment.budgetId)
      : presetProposal?.budgetId
        ? String(presetProposal.budgetId)
        : '',
  );
  const [projectId, setProjectId] = useState<string>(
    editingPayment?.projectId ? String(editingPayment.projectId) : '',
  );
  const [items, setItems] = useState<LineItemDraft[]>(
    editingPayment && editingPayment.items.length > 0
      ? editingPayment.items.map((it, idx) => ({
          key: `edit-${it.id}-${idx}`,
          description: it.description,
          invoiceNo: it.invoiceNo ?? '',
          invoiceDate: it.invoiceDate ?? '',
          quantity: String(it.quantity),
          unitPrice: String(it.unitPrice),
          taxRate: String(it.taxRate),
          note: it.note ?? '',
        }))
      : [makeEmptyItem(0)],
  );

  const [errorMessage, setErrorMessage] = useState('');
  const [submittingMode, setSubmittingMode] = useState<'draft' | 'submit' | null>(null);

  const selectedAdvance = useMemo(() => {
    const idNum = Number(linkedAdvanceId);
    if (!idNum || !options) return null;
    return options.openAdvances.find((a) => a.id === idNum) ?? null;
  }, [linkedAdvanceId, options]);

  const selectedProposal = useMemo(() => {
    const idNum = Number(proposalId);
    if (!idNum || !options) return null;
    return options.approvedProposals.find((p) => p.id === idNum) ?? null;
  }, [proposalId, options]);

  const inheritedBudgetId =
    paymentType === 'ADVANCE_SETTLEMENT' && selectedAdvance?.budgetId
      ? selectedAdvance.budgetId
      : selectedProposal?.budgetId ?? null;

  const effectiveBudgetIdStr = inheritedBudgetId ? String(inheritedBudgetId) : budgetId;
  const selectedBudget = useMemo(() => {
    const idNum = Number(effectiveBudgetIdStr);
    if (!idNum || !options?.activeBudgets) return null;
    return options.activeBudgets.find((b) => b.id === idNum) ?? null;
  }, [effectiveBudgetIdStr, options]);

  const liveCalc = useMemo(
    () =>
      calculatePaymentLineItems(
        items.map((it) => ({
          quantity: Number(it.quantity) || 0,
          unitPrice: Number(it.unitPrice) || 0,
          taxRate: Number(it.taxRate) || 0,
        })),
      ),
    [items],
  );

  const liveSettlement = useMemo(() => {
    if (paymentType !== 'ADVANCE_SETTLEMENT') return null;
    const advAmt =
      selectedAdvance?.disbursedAmount ?? editingPayment?.advanceAmount ?? 0;
    return computeAdvanceSettlement(liveCalc.totalAmount, advAmt);
  }, [paymentType, selectedAdvance, editingPayment, liveCalc.totalAmount]);

  const isHighValue = liveCalc.totalAmount >= PAYMENT_HIGH_VALUE_THRESHOLD_VND;
  const amountWordsDisplay = useMemo(() => {
    const target =
      liveSettlement && Math.abs(liveSettlement.netSettlementAmount) > 0
        ? Math.abs(liveSettlement.netSettlementAmount)
        : liveCalc.totalAmount;
    return locale === 'en'
      ? amountToEnglishWords(target)
      : amountToVietnameseWords(target);
  }, [liveSettlement, liveCalc.totalAmount, locale]);

  if (!isOpen) {
    return null;
  }

  function handleSelectPaymentType(nextType: PaymentType) {
    setPaymentType(nextType);
    const matchedCat = activeCategories.find((c) => c.defaultPaymentType === nextType);
    if (matchedCat) {
      setCategoryId(String(matchedCat.id));
    }
    if (nextType === 'VENDOR_PAYMENT') {
      setBeneficiaryType('VENDOR');
      if (beneficiaryName === options?.myBankProfile.fullName) {
        setBeneficiaryName('');
        setBankName('');
        setBankAccountNo('');
      }
    } else {
      setBeneficiaryType('EMPLOYEE');
      if (options?.myBankProfile && !beneficiaryName) {
        setBeneficiaryName(options.myBankProfile.fullName);
        setBankName(options.myBankProfile.bankName ?? '');
        setBankAccountNo(options.myBankProfile.bankAccountNo ?? '');
      }
    }
  }

  function fillMyBankProfile() {
    if (!options?.myBankProfile) return;
    setBeneficiaryType('EMPLOYEE');
    setBeneficiaryName(options.myBankProfile.fullName);
    setBankName(options.myBankProfile.bankName ?? '');
    setBankAccountNo(options.myBankProfile.bankAccountNo ?? '');
  }

  function updateItem(index: number, patch: Partial<LineItemDraft>) {
    setItems((prev) => prev.map((row, idx) => (idx === index ? { ...row, ...patch } : row)));
  }

  function addItemRow() {
    setItems((prev) => [...prev, makeEmptyItem(prev.length)]);
  }

  function duplicateItemRow(index: number) {
    setItems((prev) => {
      const target = prev[index];
      if (!target) return prev;
      const clone: LineItemDraft = {
        ...target,
        key: `dup-${Date.now()}-${prev.length}`,
        invoiceNo: '',
      };
      const next = [...prev];
      next.splice(index + 1, 0, clone);
      return next;
    });
  }

  function removeItemRow(index: number) {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  }

  async function savePayment(submitImmediately: boolean, e?: FormEvent) {
    e?.preventDefault();
    if (submittingMode) return;
    setErrorMessage('');

    const parsedItems = items.map((it) => ({
      description: it.description.trim(),
      invoiceNo: it.invoiceNo.trim() || null,
      invoiceDate: it.invoiceDate || null,
      quantity: Number(it.quantity) || 0,
      unitPrice: Number(it.unitPrice) || 0,
      taxRate: Number(it.taxRate) || 0,
      note: it.note.trim() || null,
    }));

    if (parsedItems.some((it) => it.description.length < 2 || it.quantity <= 0)) {
      setErrorMessage(
        tr(
          'Vui lòng nhập đầy đủ mô tả (≥ 2 ký tự) và số lượng (> 0) cho tất cả hạng mục.',
          'Please enter a valid description (≥ 2 chars) and quantity (> 0) for all line items.',
        ),
      );
      return;
    }

    setSubmittingMode(submitImmediately ? 'submit' : 'draft');
    try {
      const payload = {
        paymentType,
        categoryId: Number(categoryId),
        title: title.trim(),
        description: description.trim(),
        priority,
        budgetId: effectiveBudgetIdStr ? Number(effectiveBudgetIdStr) : null,
        proposalId: proposalId ? Number(proposalId) : null,
        projectId: projectId ? Number(projectId) : null,
        linkedAdvanceId:
          paymentType === 'ADVANCE_SETTLEMENT' && linkedAdvanceId
            ? Number(linkedAdvanceId)
            : null,
        paymentMethod,
        beneficiaryType,
        beneficiaryName: beneficiaryName.trim(),
        beneficiaryTaxCode: beneficiaryTaxCode.trim() || null,
        bankName: bankName.trim() || null,
        bankAccountNo: bankAccountNo.trim() || null,
        bankBranch: bankBranch.trim() || null,
        dueDate: dueDate || null,
        advanceDueDate: paymentType === 'CASH_ADVANCE' ? advanceDueDate || null : null,
        items: parsedItems,
        ...(editingPayment ? {} : { submitImmediately }),
      };

      const url = editingPayment ? `/api/v1/payments/${editingPayment.id}` : '/api/v1/payments';
      const method = editingPayment ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => null)) as {
        success?: boolean;
        data?: PaymentDetailDto;
        error?: { message?: string };
      } | null;

      if (!res.ok || !json?.success || !json.data) {
        setErrorMessage(
          json?.error?.message ??
            tr('Không thể lưu đề nghị thanh toán.', 'Unable to save payment request.'),
        );
        return;
      }

      if (editingPayment && submitImmediately) {
        const subRes = await fetch(`/api/v1/payments/${editingPayment.id}/submit`, {
          method: 'POST',
        });
        const subJson = (await subRes.json().catch(() => null)) as {
          success?: boolean;
          data?: PaymentDetailDto;
          error?: { message?: string };
        } | null;
        if (!subRes.ok || !subJson?.success || !subJson.data) {
          setErrorMessage(
            subJson?.error?.message ??
              tr(
                'Đã lưu bản cập nhật nhưng chưa thể gửi phê duyệt. Vui lòng kiểm tra chứng từ đính kèm.',
                'Saved changes, but submission failed. Please verify required receipts.',
              ),
          );
          onSaved(json.data);
          return;
        }
        onSaved(subJson.data);
        return;
      }

      onSaved(json.data);
    } catch {
      setErrorMessage(
        tr('Lỗi kết nối máy chủ. Vui lòng thử lại.', 'Network error. Please try again.'),
      );
    } finally {
      setSubmittingMode(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-[2px] sm:p-5">
      <div className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-[#0F172A] px-6 py-4 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20 text-amber-300 ring-1 ring-amber-400/30">
              <IconFileInvoice size={21} />
            </div>
            <div>
              <h2 className="text-base font-bold">
                {editingPayment
                  ? tr(
                      `Chỉnh sửa Đề nghị Thanh toán ${editingPayment.code}`,
                      `Edit Payment Request ${editingPayment.code}`,
                    )
                  : tr('Tạo Đề nghị Thanh toán & Tạm ứng mới', 'New Payment & Advance Request')}
              </h2>
              <p className="text-xs text-slate-300">
                {tr(
                  'Tự động tính VAT, kiểm tra chống trùng số hóa đơn và định tuyến phê duyệt theo hạn mức.',
                  'Auto-calculates VAT, prevents duplicate invoices, and routes multi-level approvals by amount.',
                )}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white"
            aria-label={tr('Đóng', 'Close')}
          >
            <IconX size={19} />
          </button>
        </div>

        {/* Scrollable Body */}
        <form
          onSubmit={(e) => void savePayment(false, e)}
          className="flex-1 space-y-6 overflow-y-auto p-6"
        >
          {errorMessage && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-700">
              {errorMessage}
            </div>
          )}

          {/* Step 1: 4 Visual Cards for Payment Type */}
          <div className="space-y-2.5">
            <label className="text-xs font-bold tracking-wide text-slate-700 uppercase">
              {tr('1. Chọn Loại Chứng từ Thanh toán', '1. Select Payment Voucher Type')}
            </label>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
              {PAYMENT_TYPE_ORDER.map((typeKey) => {
                const meta = PAYMENT_TYPE_META[typeKey];
                const isSelected = paymentType === typeKey;
                return (
                  <button
                    key={typeKey}
                    type="button"
                    onClick={() => handleSelectPaymentType(typeKey)}
                    className={`group flex flex-col items-start rounded-xl border p-3.5 text-left transition ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/60 ring-2 ring-blue-600/20'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70'
                    }`}
                  >
                    <div className="flex w-full items-center justify-between">
                      <span
                        className={`rounded-lg px-2 py-0.5 text-[11px] font-bold ring-1 ${meta.cls}`}
                      >
                        {locale === 'en' ? meta.short.en : meta.short.vi}
                      </span>
                      {isSelected && (
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white">
                          <IconCheck size={12} />
                        </span>
                      )}
                    </div>
                    <div className="mt-2 text-xs font-bold text-slate-900">
                      {locale === 'en' ? meta.en : meta.vi}
                    </div>
                    <p className="mt-1 text-[11px] leading-snug text-slate-500">
                      {locale === 'en' ? meta.desc.en : meta.desc.vi}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Conditional Advance Settlement Selector */}
          {paymentType === 'ADVANCE_SETTLEMENT' && (
            <div className="rounded-xl border border-teal-200 bg-teal-50/60 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex-1 space-y-1.5">
                  <label className="flex items-center gap-1.5 text-xs font-bold text-teal-900">
                    <IconReceiptRefund size={16} />
                    <span>
                      {tr(
                        'Chọn Phiếu Tạm ứng gốc cần quyết toán *',
                        'Select Original Cash Advance to Settle *',
                      )}
                    </span>
                  </label>
                  <select
                    required
                    value={linkedAdvanceId}
                    onChange={(e) => setLinkedAdvanceId(e.target.value)}
                    className="w-full rounded-xl border border-teal-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-teal-600"
                  >
                    <option value="">
                      {tr('-- Chọn phiếu tạm ứng đã giải ngân --', '-- Select disbursed advance --')}
                    </option>
                    {(options?.openAdvances ?? []).map((adv) => (
                      <option key={adv.id} value={adv.id}>
                        {adv.code} — {adv.title} ({formatVND(adv.disbursedAmount)})
                      </option>
                    ))}
                  </select>
                </div>

                {liveSettlement && (
                  <div className="rounded-xl border border-teal-200 bg-white px-4 py-2.5 text-xs shadow-2xs">
                    <div className="text-[11px] text-slate-500">
                      {tr('Đối chiếu tạm ứng', 'Reconciliation')}:{' '}
                      <strong className="text-slate-900">
                        {formatVND(liveSettlement.advanceAmount)}
                      </strong>
                    </div>
                    <div className="mt-1 font-bold">
                      {liveSettlement.settlementDirection === 'PAY_MORE' ? (
                        <span className="text-blue-700">
                          {tr('Công ty chi bổ sung: ', 'Company pays extra: ')}
                          {formatVND(liveSettlement.payableAmount)}
                        </span>
                      ) : liveSettlement.settlementDirection === 'REFUND_COMPANY' ? (
                        <span className="text-orange-700">
                          {tr('Nhân viên hoàn quỹ: ', 'Employee refunds: ')}
                          {formatVND(liveSettlement.refundAmount)}
                        </span>
                      ) : (
                        <span className="text-emerald-700">
                          {tr('Khớp hoàn toàn 0 ₫', 'Balanced (0 VND)')}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 2: General Info & Cross-Module Links */}
          <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
            <div className="text-xs font-bold tracking-wide text-slate-700 uppercase">
              {tr('2. Thông tin Chung & Liên kết Hồ sơ', '2. General Information & Links')}
            </div>

            <div className="grid grid-cols-1 gap-3.5 md:grid-cols-3">
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  {tr('Tiêu đề đề nghị thanh toán *', 'Payment Request Title *')}
                </label>
                <input
                  type="text"
                  required
                  minLength={4}
                  maxLength={250}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={tr(
                    'VD: Thanh toán hóa đơn dịch vụ Cloud Q4/2026 hoặc Hoàn ứng công tác phí Hà Nội...',
                    'e.g. Q4/2026 Cloud Infrastructure Invoice or Hanoi Trip Reimbursement...',
                  )}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-900 outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  {tr('Danh mục khoản chi *', 'Expense Category *')}
                </label>
                <select
                  required
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-blue-500"
                >
                  <option value="">{tr('-- Chọn danh mục --', '-- Select category --')}</option>
                  {activeCategories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {ln(cat.name, cat.nameEn)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-3">
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  {tr('Diễn giải chi tiết mục đích chi *', 'Detailed Purpose & Justification *')}
                </label>
                <textarea
                  required
                  minLength={5}
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={tr(
                    'Mô tả rõ lý do chi tiêu, căn cứ hợp đồng/tờ trình hoặc đợt công tác...',
                    'Describe business justification, contract reference, or trip details...',
                  )}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-900 outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  {tr('Mức ưu tiên', 'Priority')}
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as PaymentPriority)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-blue-500"
                >
                  <option value="LOW">{tr('Thấp', 'Low')}</option>
                  <option value="MEDIUM">{tr('Trung bình', 'Medium')}</option>
                  <option value="HIGH">{tr('Cao', 'High')}</option>
                  <option value="URGENT">{tr('Khẩn cấp', 'Urgent')}</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  {tr('Hạn cần thanh toán', 'Payment Due Date')}
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-blue-500"
                />
              </div>

              {paymentType === 'CASH_ADVANCE' ? (
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    {tr('Hạn dự kiến hoàn ứng', 'Expected Settlement Date')}
                  </label>
                  <input
                    type="date"
                    value={advanceDueDate}
                    onChange={(e) => setAdvanceDueDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-blue-500"
                  />
                </div>
              ) : (
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    {tr('Liên kết Đề xuất đã duyệt', 'Link Approved Proposal')}
                  </label>
                  <select
                    value={proposalId}
                    onChange={(e) => setProposalId(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-blue-500"
                  >
                    <option value="">{tr('-- Không liên kết --', '-- None --')}</option>
                    {(options?.approvedProposals ?? []).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.code} — {p.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className={paymentType === 'CASH_ADVANCE' ? 'md:col-span-3 lg:col-span-1' : ''}>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  {tr('Liên kết Dự án (Cost Center)', 'Link Project (Cost Center)')}
                </label>
                <select
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-blue-500"
                >
                  <option value="">{tr('-- Không gắn dự án --', '-- No project --')}</option>
                  {(options?.activeProjects ?? []).map((proj) => (
                    <option key={proj.id} value={proj.id}>
                      [{proj.code}] {proj.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-3">
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  {tr('Nguồn Quỹ Ngân sách Chi tiêu', 'Budget Fund Source')}
                  {inheritedBudgetId && (
                    <span className="ml-2 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-700">
                      {tr('Tự động kế thừa', 'Auto-Inherited')}
                    </span>
                  )}
                </label>
                <select
                  value={effectiveBudgetIdStr}
                  disabled={Boolean(inheritedBudgetId)}
                  onChange={(e) => setBudgetId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-600"
                >
                  <option value="">
                    {tr('-- Không gắn quỹ ngân sách (chi ngoài kế hoạch) --', '-- No budget fund assigned --')}
                  </option>
                  {(options?.activeBudgets ?? []).map((b) => (
                    <option key={b.id} value={b.id}>
                      [{b.code}] {ln(b.name, b.nameEn)} — {tr('Khả dụng', 'Avail')}: {formatVND(b.availableAmount)}
                    </option>
                  ))}
                </select>
                {selectedBudget && (
                  <div className="mt-2.5">
                    <BudgetImpactPreview
                      budget={selectedBudget}
                      requestedAmount={
                        liveSettlement
                          ? Math.max(0, liveSettlement.netSettlementAmount)
                          : liveCalc.totalAmount
                      }
                      proposalHeldReserve={
                        selectedProposal && selectedProposal.budgetId === selectedBudget.id
                          ? selectedProposal.budgetReservedAmount
                          : 0
                      }
                      refundAmount={
                        liveSettlement && liveSettlement.netSettlementAmount < 0
                          ? Math.abs(liveSettlement.netSettlementAmount)
                          : 0
                      }
                      inheritedLabel={
                        paymentType === 'ADVANCE_SETTLEMENT' && selectedAdvance?.budgetId
                          ? tr(
                              `Tự động kế thừa quỹ ngân sách từ Tạm ứng gốc ${selectedAdvance.code}.`,
                              `Automatically inherited from original Advance ${selectedAdvance.code}.`,
                            )
                          : selectedProposal?.budgetId
                            ? tr(
                                `Tự động kế thừa quỹ ngân sách từ Đề xuất ${selectedProposal.code} (phần giữ chỗ sẽ chuyển sang phiếu này mà không trừ trùng).`,
                                `Automatically inherited from Proposal ${selectedProposal.code} (reserve transfers without double-counting).`,
                              )
                            : null
                      }
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Step 3: Beneficiary & Banking Info */}
          <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-bold tracking-wide text-slate-700 uppercase">
                <IconBuildingBank size={16} className="text-blue-600" />
                <span>
                  {tr('3. Thông tin Thụ hưởng & Tài khoản Nhận tiền', '3. Beneficiary & Banking Details')}
                </span>
              </div>
              {paymentType !== 'VENDOR_PAYMENT' && options?.myBankProfile && (
                <button
                  type="button"
                  onClick={fillMyBankProfile}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-100"
                >
                  <IconUserCheck size={14} />
                  <span>{tr('Điền TK ngân hàng từ hồ sơ của tôi', 'Auto-fill My Bank Profile')}</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3.5 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  {tr('Hình thức chi trả *', 'Payment Method *')}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('BANK_TRANSFER')}
                    className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                      paymentMethod === 'BANK_TRANSFER'
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <IconBuildingBank size={15} />
                    <span>{tr('Chuyển khoản', 'Bank Transfer')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('CASH')}
                    className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                      paymentMethod === 'CASH'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <IconCash size={15} />
                    <span>{tr('Tiền mặt', 'Cash')}</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  {paymentType === 'VENDOR_PAYMENT'
                    ? tr('Tên Công ty / Nhà cung cấp *', 'Vendor / Company Name *')
                    : tr('Tên Người thụ hưởng *', 'Beneficiary Name *')}
                </label>
                <input
                  type="text"
                  required
                  value={beneficiaryName}
                  onChange={(e) => setBeneficiaryName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  {tr('Mã số thuế (NCC)', 'Tax ID (Vendor)')}
                </label>
                <input
                  type="text"
                  value={beneficiaryTaxCode}
                  onChange={(e) => setBeneficiaryTaxCode(e.target.value)}
                  placeholder="031xxxxxxx"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 outline-none focus:border-blue-500"
                />
              </div>

              {paymentMethod === 'BANK_TRANSFER' && (
                <>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">
                      {tr('Ngân hàng *', 'Bank Name *')}
                    </label>
                    <input
                      type="text"
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      placeholder="Vietcombank, Techcombank, ACB..."
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">
                      {tr('Số tài khoản *', 'Bank Account Number *')}
                    </label>
                    <input
                      type="text"
                      value={bankAccountNo}
                      onChange={(e) => setBankAccountNo(e.target.value)}
                      placeholder="001100xxxxxxx"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-xs text-slate-900 outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">
                      {tr('Chi nhánh ngân hàng', 'Bank Branch')}
                    </label>
                    <input
                      type="text"
                      value={bankBranch}
                      onChange={(e) => setBankBranch(e.target.value)}
                      placeholder={tr('VD: Chi nhánh TP.HCM', 'e.g. HCMC Branch')}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 outline-none focus:border-blue-500"
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Step 4: Spreadsheet-Style VAT Line Items */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold tracking-wide text-slate-700 uppercase">
                {tr('4. Bảng kê Chi tiết Hạng mục & Hóa đơn VAT', '4. Itemized Breakdown & VAT Invoices')}
              </div>
              <button
                type="button"
                onClick={addItemRow}
                className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
              >
                <IconPlus size={14} />
                <span>{tr('Thêm dòng', 'Add Line')}</span>
              </button>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[780px] border-collapse text-left text-xs">
                <thead className="bg-slate-50 text-[11px] font-bold text-slate-600 uppercase">
                  <tr>
                    <th className="px-3 py-2.5">{tr('Mô tả hạng mục *', 'Description *')}</th>
                    <th className="w-32 px-2 py-2.5">{tr('Số HĐ VAT', 'Invoice No')}</th>
                    <th className="w-32 px-2 py-2.5">{tr('Ngày HĐ', 'Inv. Date')}</th>
                    <th className="w-20 px-2 py-2.5 text-right">{tr('SL', 'Qty')}</th>
                    <th className="w-32 px-2 py-2.5 text-right">{tr('Đơn giá (₫)', 'Unit Price')}</th>
                    <th className="w-20 px-2 py-2.5 text-right">VAT</th>
                    <th className="w-32 px-3 py-2.5 text-right">{tr('Thành tiền', 'Line Total')}</th>
                    <th className="w-16 px-2 py-2.5 text-center">{tr('Thao tác', 'Act')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {items.map((row, idx) => {
                    const lineTotal = liveCalc.items[idx]?.lineTotal ?? 0;
                    return (
                      <tr key={row.key} className="align-top">
                        <td className="px-2 py-2">
                          <input
                            type="text"
                            required
                            value={row.description}
                            onChange={(e) => updateItem(idx, { description: e.target.value })}
                            placeholder={tr('Nội dung khoản chi...', 'Expense item description...')}
                            className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs outline-none focus:border-blue-500"
                          />
                          <input
                            type="text"
                            value={row.note}
                            onChange={(e) => updateItem(idx, { note: e.target.value })}
                            placeholder={tr('Ghi chú dòng (tùy chọn)', 'Line note (optional)')}
                            className="mt-1 w-full rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1 text-[11px] text-slate-600 outline-none focus:border-blue-400 focus:bg-white"
                          />
                        </td>
                        <td className="px-1.5 py-2">
                          <input
                            type="text"
                            value={row.invoiceNo}
                            onChange={(e) => updateItem(idx, { invoiceNo: e.target.value })}
                            placeholder="VAT-001"
                            className="w-full rounded-lg border border-slate-200 px-2 py-1.5 font-mono text-[11px] outline-none focus:border-blue-500"
                          />
                        </td>
                        <td className="px-1.5 py-2">
                          <input
                            type="date"
                            value={row.invoiceDate}
                            onChange={(e) => updateItem(idx, { invoiceDate: e.target.value })}
                            className="w-full rounded-lg border border-slate-200 px-1.5 py-1.5 text-[11px] outline-none focus:border-blue-500"
                          />
                        </td>
                        <td className="px-1.5 py-2">
                          <input
                            type="number"
                            min="0.01"
                            step="any"
                            value={row.quantity}
                            onChange={(e) => updateItem(idx, { quantity: e.target.value })}
                            className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-right tabular-nums outline-none focus:border-blue-500"
                          />
                        </td>
                        <td className="px-1.5 py-2">
                          <input
                            type="number"
                            min="0"
                            step="1000"
                            value={row.unitPrice}
                            onChange={(e) => updateItem(idx, { unitPrice: e.target.value })}
                            placeholder="0"
                            className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-right tabular-nums outline-none focus:border-blue-500"
                          />
                        </td>
                        <td className="px-1.5 py-2">
                          <select
                            value={row.taxRate}
                            onChange={(e) => updateItem(idx, { taxRate: e.target.value })}
                            className="w-full rounded-lg border border-slate-200 px-1.5 py-1.5 text-right outline-none focus:border-blue-500"
                          >
                            <option value="0">0%</option>
                            <option value="5">5%</option>
                            <option value="8">8%</option>
                            <option value="10">10%</option>
                          </select>
                        </td>
                        <td className="px-3 py-3 text-right font-bold whitespace-nowrap tabular-nums text-slate-900">
                          {formatVND(lineTotal)}
                        </td>
                        <td className="px-1.5 py-2 text-center">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => duplicateItemRow(idx)}
                              title={tr('Nhân bản dòng', 'Duplicate row')}
                              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                            >
                              <IconCopy size={14} />
                            </button>
                            <button
                              type="button"
                              disabled={items.length <= 1}
                              onClick={() => removeItemRow(idx)}
                              title={tr('Xóa dòng', 'Delete row')}
                              className="rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30"
                            >
                              <IconTrash size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </form>

        {/* Sticky Executive Financial Summary & Submit Bar */}
        <div className="border-t border-slate-200 bg-slate-50 px-6 py-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                <span>
                  {tr('Trước thuế', 'Subtotal')}:{' '}
                  <strong className="tabular-nums text-slate-900">
                    {formatVND(liveCalc.subtotalAmount)}
                  </strong>
                </span>
                <span>•</span>
                <span>
                  VAT:{' '}
                  <strong className="tabular-nums text-slate-900">
                    {formatVND(liveCalc.taxAmount)}
                  </strong>
                </span>
                <span>•</span>
                <span className="text-sm font-extrabold tabular-nums text-blue-700">
                  {tr('Tổng cộng', 'Grand Total')}: {formatVND(liveCalc.totalAmount)}
                </span>
              </div>
              <div className="text-[11px] text-slate-500 italic">
                {tr('Bằng chữ', 'In words')}: {amountWordsDisplay}
              </div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-0.5 text-[11px] font-semibold text-slate-700 ring-1 ring-slate-200">
                <IconShieldCheck
                  size={13}
                  className={isHighValue ? 'text-amber-600' : 'text-emerald-600'}
                />
                <span>
                  {isHighValue
                    ? tr(
                        'Luồng duyệt dự kiến: 3 cấp (>= 20 triệu: QLTT → Kế toán → Ban Giám đốc)',
                        'Approval route: 3 levels (>= 20M VND: Manager → Finance → Executive)',
                      )
                    : tr(
                        'Luồng duyệt dự kiến: 2 cấp (< 20 triệu: QLTT → Kế toán Thanh toán)',
                        'Approval route: 2 levels (< 20M VND: Manager → Finance Accountant)',
                      )}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={submittingMode !== null}
                onClick={onClose}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                {tr('Hủy', 'Cancel')}
              </button>
              <button
                type="button"
                disabled={submittingMode !== null}
                onClick={() => void savePayment(false)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50"
              >
                <span>
                  {submittingMode === 'draft'
                    ? tr('Đang lưu...', 'Saving...')
                    : tr('Lưu Nháp', 'Save Draft')}
                </span>
              </button>
              <button
                type="button"
                disabled={submittingMode !== null}
                onClick={() => void savePayment(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
              >
                <IconSend size={15} />
                <span>
                  {submittingMode === 'submit'
                    ? tr('Đang gửi duyệt...', 'Submitting...')
                    : tr('Lưu & Gửi phê duyệt', 'Save & Submit')}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
