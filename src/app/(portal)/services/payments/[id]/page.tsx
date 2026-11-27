'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  IconAlertCircle,
  IconArrowLeft,
  IconBuildingBank,
  IconCash,
  IconCheck,
  IconChecklist,
  IconCopy,
  IconDownload,
  IconEdit,
  IconFileDownload,
  IconFolder,
  IconHistory,
  IconLock,
  IconMessageCircle,
  IconPaperclip,
  IconReceiptRefund,
  IconRefresh,
  IconSend,
  IconTrash,
  IconUpload,
  IconWallet,
  IconX,
} from '@tabler/icons-react';
import type { PaymentAttachmentKind } from '@/config/database';
import { PaymentDisbursementModal } from '@/components/payments/PaymentDisbursementModal';
import { PaymentFormModal } from '@/components/payments/PaymentFormModal';
import {
  ATTACHMENT_KIND_META,
  formatBytesCompact,
  PAYMENT_PRIORITY_META,
  PAYMENT_STATUS_META,
  PAYMENT_TYPE_META,
  type PaymentCategoryDto,
  type PaymentDetailDto,
  type PaymentFormOptionsDto,
} from '@/components/payments/payment-ui.helpers';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { formatVND } from '@/lib/portable/currency-utils';
import { formatDateTimeVN, formatDateVN } from '@/lib/portable/date-utils';
import { useI18n } from '@/shared/i18n/I18nContext';

const APPROVAL_ACTION_LABELS: Record<
  'SUBMIT' | 'APPROVE' | 'REJECT' | 'CANCEL',
  { vi: string; en: string; cls: string }
> = {
  SUBMIT: { vi: 'Gửi duyệt', en: 'Submitted', cls: 'bg-blue-50 text-blue-700' },
  APPROVE: { vi: 'Phê duyệt', en: 'Approved', cls: 'bg-emerald-50 text-emerald-700' },
  REJECT: { vi: 'Từ chối', en: 'Rejected', cls: 'bg-rose-50 text-rose-700' },
  CANCEL: { vi: 'Thu hồi / Hủy', en: 'Cancelled', cls: 'bg-slate-100 text-slate-600' },
};

function computeStepperStage(status: PaymentDetailDto['status']): number {
  switch (status) {
    case 'DRAFT':
    case 'NEEDS_REVISION':
      return 1;
    case 'PENDING_APPROVAL':
      return 2;
    case 'APPROVED':
    case 'PARTIALLY_PAID':
      return 3;
    case 'PAID':
      return 4;
    default:
      return 0;
  }
}

export default function PaymentDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { locale, tr, ln } = useI18n();
  const paymentId = Number(params?.id);

  const [viewState, setViewState] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [detail, setDetail] = useState<PaymentDetailDto | null>(null);
  const [categories, setCategories] = useState<PaymentCategoryDto[]>([]);
  const [options, setOptions] = useState<PaymentFormOptionsDto | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  const [actionBannerError, setActionBannerError] = useState('');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  // Quick approval inline box
  const [approvalComment, setApprovalComment] = useState('');

  // Revision / Cancel modal state
  const [statusModalMode, setStatusModalMode] = useState<'REQUEST_REVISION' | 'CANCEL' | null>(null);
  const [statusNote, setStatusNote] = useState('');

  // Edit / Settlement / Disbursement / Delete modals
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isSettleModalOpen, setIsSettleModalOpen] = useState(false);
  const [isDisburseOpen, setIsDisburseOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  // Comments & Attachments
  const [commentText, setCommentText] = useState('');
  const [isPostingComment, setIsPostingComment] = useState(false);
  const [attachmentKind, setAttachmentKind] = useState<PaymentAttachmentKind>('INVOICE');
  const [isUploadingFile, setIsUploadingFile] = useState(false);

  useEffect(() => {
    if (!Number.isInteger(paymentId) || paymentId <= 0) {
      return;
    }
    const controller = new AbortController();

    Promise.all([
      fetch(`/api/v1/payments/${paymentId}`, { cache: 'no-store', signal: controller.signal }),
      fetch('/api/v1/payments/categories?includeInactive=true', {
        cache: 'no-store',
        signal: controller.signal,
      }),
      fetch('/api/v1/payments/options', { cache: 'no-store', signal: controller.signal }),
    ])
      .then(async ([dRes, cRes, oRes]) => {
        if (controller.signal.aborted) return;
        const [dJson, cJson, oJson] = await Promise.all([
          dRes.json().catch(() => null),
          cRes.json().catch(() => null),
          oRes.json().catch(() => null),
        ]);
        if (!dRes.ok || !dJson?.success || !dJson.data) {
          setErrorMessage(
            dJson?.error?.message ??
              tr('Không thể tải chi tiết đề nghị thanh toán.', 'Unable to load payment details.'),
          );
          setViewState('error');
          return;
        }
        setDetail(dJson.data as PaymentDetailDto);
        if (cRes.ok && cJson?.success) {
          setCategories((cJson.data ?? []) as PaymentCategoryDto[]);
        }
        if (oRes.ok && oJson?.success) {
          setOptions((oJson.data ?? null) as PaymentFormOptionsDto | null);
        }
        setErrorMessage('');
        setViewState('success');
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setErrorMessage(
          tr('Lỗi kết nối máy chủ. Vui lòng thử lại.', 'Network error. Please try again.'),
        );
        setViewState('error');
      });

    return () => controller.abort();
  }, [paymentId, reloadTick, tr]);

  function reloadDetail() {
    setReloadTick((t) => t + 1);
  }

  function copyToClipboard(key: string, value: string) {
    if (!value) return;
    void navigator.clipboard?.writeText(value).then(() => {
      setCopiedField(key);
      window.setTimeout(() => setCopiedField(null), 1800);
    });
  }

  async function handleSubmitForApproval() {
    if (!detail || isProcessingAction) return;
    setActionBannerError('');
    setIsProcessingAction(true);
    try {
      const res = await fetch(`/api/v1/payments/${detail.id}/submit`, { method: 'POST' });
      const json = (await res.json().catch(() => null)) as {
        success?: boolean;
        data?: PaymentDetailDto;
        error?: { message?: string };
      } | null;
      if (!res.ok || !json?.success || !json.data) {
        setActionBannerError(
          json?.error?.message ??
            tr('Không thể gửi phê duyệt phiếu thanh toán.', 'Unable to submit payment request.'),
        );
        return;
      }
      setDetail(json.data);
    } finally {
      setIsProcessingAction(false);
    }
  }

  async function handleInlineApproval(action: 'APPROVE' | 'REJECT') {
    if (!detail?.approval || isProcessingAction) return;
    if (action === 'REJECT' && approvalComment.trim().length < 2) {
      setActionBannerError(
        tr('Vui lòng nhập lý do từ chối trước khi xác nhận.', 'Please enter a rejection reason.'),
      );
      return;
    }
    setActionBannerError('');
    setIsProcessingAction(true);
    try {
      const res = await fetch(`/api/v1/approvals/${detail.approval.request.id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          comment: approvalComment.trim() || null,
        }),
      });
      const json = (await res.json().catch(() => null)) as {
        success?: boolean;
        error?: { message?: string };
      } | null;
      if (!res.ok || !json?.success) {
        setActionBannerError(
          json?.error?.message ??
            tr('Không thể xử lý phê duyệt.', 'Unable to process approval action.'),
        );
        return;
      }
      setApprovalComment('');
      reloadDetail();
    } finally {
      setIsProcessingAction(false);
    }
  }

  async function handleStatusTransition(e: FormEvent) {
    e.preventDefault();
    if (!detail || !statusModalMode || isProcessingAction) return;
    setActionBannerError('');
    setIsProcessingAction(true);
    try {
      const res = await fetch(`/api/v1/payments/${detail.id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: statusModalMode,
          note: statusNote.trim() || null,
        }),
      });
      const json = (await res.json().catch(() => null)) as {
        success?: boolean;
        data?: PaymentDetailDto;
        error?: { message?: string };
      } | null;
      if (!res.ok || !json?.success || !json.data) {
        setActionBannerError(
          json?.error?.message ??
            tr('Không thể cập nhật trạng thái phiếu.', 'Unable to transition payment status.'),
        );
        return;
      }
      setStatusModalMode(null);
      setStatusNote('');
      setDetail(json.data);
    } finally {
      setIsProcessingAction(false);
    }
  }

  async function handleDelete() {
    if (!detail || isProcessingAction) return;
    setIsProcessingAction(true);
    try {
      const res = await fetch(`/api/v1/payments/${detail.id}`, { method: 'DELETE' });
      if (res.ok) {
        router.push('/services/payments');
      } else {
        const json = (await res.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        setActionBannerError(
          json?.error?.message ?? tr('Không thể xóa phiếu.', 'Unable to delete payment.'),
        );
        setIsDeleteConfirmOpen(false);
      }
    } finally {
      setIsProcessingAction(false);
    }
  }

  async function handlePostComment(e: FormEvent) {
    e.preventDefault();
    if (!detail || !commentText.trim() || isPostingComment) return;
    setIsPostingComment(true);
    setActionBannerError('');
    try {
      const res = await fetch(`/api/v1/payments/${detail.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: commentText.trim(), commentType: 'GENERAL' }),
      });
      const json = (await res.json().catch(() => null)) as {
        success?: boolean;
        error?: { message?: string };
      } | null;
      if (!res.ok || !json?.success) {
        setActionBannerError(
          json?.error?.message ?? tr('Không thể gửi bình luận.', 'Unable to post comment.'),
        );
        return;
      }
      setCommentText('');
      reloadDetail();
    } finally {
      setIsPostingComment(false);
    }
  }

  async function handleFileUpload(file: File | undefined, kindOverride?: PaymentAttachmentKind) {
    if (!detail || !file || isUploadingFile) return;
    setIsUploadingFile(true);
    setActionBannerError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('attachmentKind', kindOverride ?? attachmentKind);
      const res = await fetch(`/api/v1/payments/${detail.id}/attachments`, {
        method: 'POST',
        body: fd,
      });
      const json = (await res.json().catch(() => null)) as {
        success?: boolean;
        error?: { message?: string };
      } | null;
      if (!res.ok || !json?.success) {
        setActionBannerError(
          json?.error?.message ?? tr('Không thể tải lên chứng từ.', 'Unable to upload document.'),
        );
        return;
      }
      reloadDetail();
    } finally {
      setIsUploadingFile(false);
    }
  }

  async function handleDeleteAttachment(attId: number) {
    if (!detail) return;
    const res = await fetch(`/api/v1/payments/${detail.id}/attachments/${attId}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      reloadDetail();
    }
  }

  if (viewState === 'loading') {
    return (
      <div className="w-full space-y-4">
        <div className="h-32 animate-pulse rounded-2xl bg-slate-200" />
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
          <div className="h-96 animate-pulse rounded-2xl bg-slate-200 xl:col-span-8" />
          <div className="h-96 animate-pulse rounded-2xl bg-slate-200 xl:col-span-4" />
        </div>
      </div>
    );
  }

  if (viewState === 'error' || !detail) {
    return (
      <div className="w-full rounded-2xl border border-rose-200 bg-white p-10 text-center">
        <p className="text-sm font-semibold text-rose-700">
          {errorMessage || tr('Không tìm thấy đề nghị thanh toán.', 'Payment request not found.')}
        </p>
        <div className="mt-4 flex justify-center gap-2">
          <Link
            href="/services/payments"
            className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            {tr('Quay lại danh sách', 'Back to List')}
          </Link>
          <button
            type="button"
            onClick={reloadDetail}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
          >
            <IconRefresh size={15} />
            <span>{tr('Thử lại', 'Retry')}</span>
          </button>
        </div>
      </div>
    );
  }

  const typeMeta = PAYMENT_TYPE_META[detail.paymentType];
  const statusMeta = PAYMENT_STATUS_META[detail.status];
  const priorityMeta = PAYMENT_PRIORITY_META[detail.priority];
  const stepperStage = computeStepperStage(detail.status);
  const transferMemo = `TT ${detail.code} - ${detail.beneficiaryName}`;
  const primaryAttachments = detail.attachments.filter((a) => a.attachmentKind !== 'UNC_RECEIPT');
  const uncAttachments = detail.attachments.filter((a) => a.attachmentKind === 'UNC_RECEIPT');
  const targetPayoutAmount =
    detail.paymentType === 'ADVANCE_SETTLEMENT' && detail.netSettlementAmount < 0
      ? Math.abs(detail.netSettlementAmount)
      : detail.payableAmount;

  return (
    <div className="w-full space-y-5">
      {/* Top Breadcrumb */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href="/services/payments"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-blue-600"
        >
          <IconArrowLeft size={15} />
          <span>{tr('Quay lại Danh sách Thanh toán', 'Back to Payment Requests')}</span>
        </Link>
        <span className="font-mono text-xs text-slate-500">
          {detail.code} • {tr('Tạo lúc', 'Created')}: {formatDateTimeVN(detail.createdAt)}
        </span>
      </div>

      {/* Inline Quick Approval Banner (only when user is active approver) */}
      {detail.approval?.canApproveOrReject && detail.status === 'PENDING_APPROVAL' && (
        <section className="rounded-2xl border-2 border-amber-400 bg-gradient-to-r from-amber-50 to-orange-50 p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white shadow-xs">
                <IconChecklist size={20} />
              </div>
              <div>
                <div className="text-xs font-extrabold tracking-wide text-amber-900 uppercase">
                  {tr(
                    `Đến lượt bạn phê duyệt (Bước ${detail.approval.request.currentStep}/${detail.approval.request.totalSteps})`,
                    `Your Approval Required (Step ${detail.approval.request.currentStep}/${detail.approval.request.totalSteps})`,
                  )}
                </div>
                <p className="mt-0.5 text-xs text-amber-800">
                  {tr(
                    'Kiểm tra hóa đơn/chứng từ bên dưới và phê duyệt, yêu cầu bổ sung chứng từ hoặc từ chối ngay tại đây.',
                    'Review supporting invoices below and approve, request document revisions, or reject immediately.',
                  )}
                </p>
              </div>
            </div>

            <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center lg:max-w-xl">
              <input
                type="text"
                value={approvalComment}
                onChange={(e) => setApprovalComment(e.target.value)}
                placeholder={tr(
                  'Ghi chú duyệt / lý do từ chối...',
                  'Approval note / rejection reason...',
                )}
                className="flex-1 rounded-xl border border-amber-300 bg-white px-3 py-2 text-xs outline-none focus:border-amber-600"
              />
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  disabled={isProcessingAction}
                  onClick={() => void handleInlineApproval('APPROVE')}
                  className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  <IconCheck size={15} />
                  <span>{tr('Phê duyệt', 'Approve')}</span>
                </button>
                <button
                  type="button"
                  disabled={isProcessingAction}
                  onClick={() => {
                    setStatusNote(approvalComment);
                    setStatusModalMode('REQUEST_REVISION');
                  }}
                  className="rounded-xl border border-orange-300 bg-white px-3 py-2 text-xs font-bold text-orange-700 hover:bg-orange-100 disabled:opacity-50"
                >
                  {tr('Yêu cầu bổ sung', 'Revise')}
                </button>
                <button
                  type="button"
                  disabled={isProcessingAction}
                  onClick={() => void handleInlineApproval('REJECT')}
                  className="inline-flex items-center gap-1 rounded-xl bg-rose-600 px-3 py-2 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-50"
                >
                  <IconX size={15} />
                  <span>{tr('Từ chối', 'Reject')}</span>
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {actionBannerError && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700">
          <IconAlertCircle size={16} className="shrink-0" />
          <span>{actionBannerError}</span>
        </div>
      )}

      {/* Executive Detail Hero + Horizontal Lifecycle Stepper */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs">
        <div className="bg-gradient-to-br from-[#080E1A] via-[#0F172A] to-[#1E3A5F] p-6 text-white">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-lg bg-white/15 px-2.5 py-0.5 font-mono text-xs font-bold text-cyan-200">
                  {detail.code}
                </span>
                <span className={`rounded-lg px-2.5 py-0.5 text-[11px] font-bold ring-1 ${typeMeta.cls}`}>
                  {locale === 'en' ? typeMeta.en : typeMeta.vi}
                </span>
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${statusMeta.cls}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${statusMeta.dotCls}`} />
                  {locale === 'en' ? statusMeta.en : statusMeta.vi}
                </span>
                <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${priorityMeta.cls}`}>
                  {locale === 'en' ? priorityMeta.en : priorityMeta.vi}
                </span>
              </div>

              <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
                {detail.title}
              </h1>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-300">
                <span>
                  {tr('Người đề nghị', 'Requester')}:{' '}
                  <strong className="text-white">{detail.requesterName}</strong>
                </span>
                <span>•</span>
                <span>
                  {tr('Danh mục', 'Category')}:{' '}
                  <strong className="text-white">
                    {ln(detail.categoryName, detail.categoryNameEn)}
                  </strong>
                </span>
                {detail.departmentName && (
                  <>
                    <span>•</span>
                    <span>{ln(detail.departmentName, detail.departmentNameEn)}</span>
                  </>
                )}
              </div>
              {detail.budgetId && detail.budgetCode && (
                <div className="mt-2 inline-flex flex-wrap items-center gap-2 rounded-xl border border-emerald-400/35 bg-emerald-500/15 px-3 py-1.5 text-xs text-emerald-100">
                  <Link
                    href={`/services/payments/budgets/${detail.budgetId}`}
                    className="font-mono font-bold text-emerald-200 hover:underline"
                  >
                    {detail.budgetCode}
                  </Link>
                  <span className="text-emerald-100/90">
                    {ln(detail.budgetName ?? '', detail.budgetNameEn)}
                  </span>
                  {detail.budgetReservedAmount > 0 && (
                    <span className="rounded bg-amber-400/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-200">
                      {tr('Giữ chỗ', 'Reserved')}: {formatVND(detail.budgetReservedAmount)}
                    </span>
                  )}
                  {detail.budgetSpentAmount > 0 && (
                    <span className="rounded bg-emerald-400/25 px-1.5 py-0.5 text-[10px] font-bold text-emerald-100">
                      {tr('Thực chi', 'Spent')}: {formatVND(detail.budgetSpentAmount)}
                    </span>
                  )}
                  {detail.proposalReserveUsed > 0 && (
                    <span className="rounded bg-sky-400/25 px-1.5 py-0.5 text-[10px] font-bold text-sky-100">
                      {tr('Kế thừa từ Đề xuất', 'From Proposal')}: {formatVND(detail.proposalReserveUsed)}
                    </span>
                  )}
                  {detail.isOverBudget && (
                    <span className="rounded bg-rose-500/35 px-1.5 py-0.5 text-[10px] font-bold text-rose-100">
                      {tr('Vượt ngân sách (Cảnh báo mềm)', 'Over Budget (Soft Warn)')}
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-col items-start gap-2 lg:items-end">
              <div className="text-right">
                <div className="text-[11px] font-semibold tracking-wide text-slate-300 uppercase">
                  {tr('Tổng giá trị phiếu', 'Total Request Amount')}
                </div>
                <div className="text-2xl font-extrabold tabular-nums text-amber-300">
                  {formatVND(detail.totalAmount)}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {detail.actions.canEdit && (
                  <button
                    type="button"
                    onClick={() => setIsEditOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20"
                  >
                    <IconEdit size={15} />
                    <span>{tr('Chỉnh sửa', 'Edit')}</span>
                  </button>
                )}
                {detail.actions.canSubmit && (
                  <button
                    type="button"
                    disabled={isProcessingAction}
                    onClick={() => void handleSubmitForApproval()}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-blue-500 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-blue-400 disabled:opacity-50"
                  >
                    <IconSend size={15} />
                    <span>{tr('Gửi phê duyệt', 'Submit')}</span>
                  </button>
                )}
                {(detail.actions.canDisburse || detail.actions.canConfirmRefund) && (
                  <button
                    type="button"
                    onClick={() => setIsDisburseOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3.5 py-1.5 text-xs font-bold text-slate-950 hover:bg-emerald-400"
                  >
                    <IconWallet size={15} />
                    <span>
                      {detail.actions.canConfirmRefund
                        ? tr('Xác nhận Thu hồi Hoàn quỹ', 'Confirm Refund')
                        : tr('Ghi nhận Giải ngân', 'Record Disbursement')}
                    </span>
                  </button>
                )}
                {detail.actions.canCreateSettlement && (
                  <button
                    type="button"
                    onClick={() => setIsSettleModalOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-teal-400 px-3.5 py-1.5 text-xs font-bold text-slate-950 hover:bg-teal-300"
                  >
                    <IconReceiptRefund size={15} />
                    <span>{tr('Tạo Quyết toán Tạm ứng', 'Create Settlement')}</span>
                  </button>
                )}
                {detail.actions.canExportPdf && (
                  <a
                    href={`/api/v1/payments/${detail.id}/pdf`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20"
                  >
                    <IconFileDownload size={15} />
                    <span>{tr('Xuất PDF', 'Export PDF')}</span>
                  </a>
                )}
                {detail.actions.canCancel && (
                  <button
                    type="button"
                    onClick={() => {
                      setStatusNote('');
                      setStatusModalMode('CANCEL');
                    }}
                    className="inline-flex items-center gap-1 rounded-xl border border-rose-400/40 bg-rose-500/20 px-3 py-1.5 text-xs font-semibold text-rose-100 hover:bg-rose-500/30"
                  >
                    <IconX size={15} />
                    <span>{tr('Hủy phiếu', 'Cancel')}</span>
                  </button>
                )}
                {detail.actions.canDelete && (
                  <button
                    type="button"
                    onClick={() => setIsDeleteConfirmOpen(true)}
                    className="rounded-xl border border-white/15 bg-white/5 p-1.5 text-slate-300 hover:bg-rose-600 hover:text-white"
                    title={tr('Xóa mềm', 'Delete')}
                  >
                    <IconTrash size={15} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 4-Step Lifecycle Stepper */}
        <div className="grid grid-cols-2 gap-3 border-t border-slate-100 bg-slate-50/70 px-6 py-4 sm:grid-cols-4">
          {[
            {
              step: 1,
              vi: '1. Lập chứng từ',
              en: '1. Draft Created',
              sub: formatDateVN(detail.createdAt),
            },
            {
              step: 2,
              vi: '2. Phê duyệt đa cấp',
              en: '2. Multi-Level Approval',
              sub: detail.submittedAt ? formatDateVN(detail.submittedAt) : '—',
            },
            {
              step: 3,
              vi: '3. Chờ Kế toán giải ngân',
              en: '3. Ready to Disburse',
              sub: detail.approvedAt ? formatDateVN(detail.approvedAt) : '—',
            },
            {
              step: 4,
              vi: '4. Hoàn tất chi trả',
              en: '4. Paid & Closed',
              sub: detail.paidAt ? formatDateVN(detail.paidAt) : '—',
            },
          ].map((item) => {
            const isDone = stepperStage > item.step || (item.step === 4 && stepperStage === 4);
            const isCurrent = stepperStage === item.step && item.step !== 4;
            return (
              <div key={item.step} className="flex items-center gap-2.5">
                <div
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    isDone
                      ? 'bg-emerald-600 text-white'
                      : isCurrent
                        ? 'bg-blue-600 text-white ring-4 ring-blue-100'
                        : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  {isDone ? <IconCheck size={14} /> : item.step}
                </div>
                <div className="min-w-0">
                  <div
                    className={`truncate text-xs font-bold ${
                      isDone || isCurrent ? 'text-slate-900' : 'text-slate-400'
                    }`}
                  >
                    {locale === 'en' ? item.en : item.vi}
                  </div>
                  <div className="text-[11px] text-slate-500">{item.sub}</div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Revision / Rejection Callout */}
      {(detail.revisionNote || detail.rejectionReason) && (
        <div className="rounded-2xl border border-orange-200 bg-orange-50/80 p-4 text-xs text-orange-900">
          <div className="font-bold">
            {detail.status === 'NEEDS_REVISION'
              ? tr('Yêu cầu bổ sung chứng từ từ Kế toán / Người duyệt:', 'Revision Request Note:')
              : tr('Lý do từ chối / hủy phiếu:', 'Rejection / Cancellation Reason:')}
          </div>
          <p className="mt-1">{detail.revisionNote ?? detail.rejectionReason}</p>
        </div>
      )}

      {/* Main 12-Column Grid */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        {/* LEFT 8 COLS */}
        <div className="space-y-5 xl:col-span-8">
          {/* 1. Purpose & Cross-Links */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
            <h2 className="text-sm font-bold text-slate-900">
              {tr('Diễn giải & Hồ sơ Liên kết', 'Justification & Linked Records')}
            </h2>
            <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-slate-700">
              {detail.description}
            </p>

            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 text-xs sm:grid-cols-4">
              <div>
                <div className="text-[11px] text-slate-400">{tr('Chi nhánh', 'Branch')}</div>
                <div className="mt-0.5 font-semibold text-slate-800">
                  {ln(detail.branchName, detail.branchNameEn) || '—'}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-400">{tr('Hạn thanh toán', 'Due Date')}</div>
                <div
                  className={`mt-0.5 font-semibold ${
                    detail.isOverdue ? 'text-rose-600' : 'text-slate-800'
                  }`}
                >
                  {detail.dueDate ? formatDateVN(detail.dueDate) : '—'}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-400">{tr('Phương thức', 'Method')}</div>
                <div className="mt-0.5 font-semibold text-slate-800">
                  {detail.paymentMethod === 'BANK_TRANSFER'
                    ? tr('Chuyển khoản', 'Bank Transfer')
                    : tr('Tiền mặt', 'Cash')}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-400">
                  {detail.paymentType === 'CASH_ADVANCE'
                    ? tr('Hạn hoàn ứng', 'Advance Due')
                    : tr('Yêu cầu chứng từ', 'Receipt Policy')}
                </div>
                <div className="mt-0.5 font-semibold text-slate-800">
                  {detail.paymentType === 'CASH_ADVANCE'
                    ? detail.advanceDueDate
                      ? formatDateVN(detail.advanceDueDate)
                      : '—'
                    : detail.categoryRequiresReceipt
                      ? tr('Bắt buộc đính kèm', 'Required')
                      : tr('Tùy chọn', 'Optional')}
                </div>
              </div>
            </div>

            {(detail.proposalCode ||
              detail.projectCode ||
              detail.linkedAdvanceCode ||
              detail.settledByPaymentCode) && (
              <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                {detail.proposalId && detail.proposalCode && (
                  <Link
                    href={`/services/proposals/${detail.proposalId}`}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-800 hover:bg-violet-100"
                  >
                    <IconFolder size={14} />
                    <span>
                      {tr('Đề xuất', 'Proposal')}: {detail.proposalCode}
                    </span>
                  </Link>
                )}
                {detail.projectId && detail.projectCode && (
                  <Link
                    href={`/projects/${detail.projectId}`}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-xs font-semibold text-cyan-800 hover:bg-cyan-100"
                  >
                    <IconFolder size={14} />
                    <span>
                      {tr('Dự án', 'Project')}: {detail.projectCode}
                    </span>
                  </Link>
                )}
                {detail.linkedAdvanceId && detail.linkedAdvanceCode && (
                  <Link
                    href={`/services/payments/${detail.linkedAdvanceId}`}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-800 hover:bg-teal-100"
                  >
                    <IconReceiptRefund size={14} />
                    <span>
                      {tr('Tạm ứng gốc', 'Original Advance')}: {detail.linkedAdvanceCode}
                    </span>
                  </Link>
                )}
                {detail.settledByPaymentId && detail.settledByPaymentCode && (
                  <Link
                    href={`/services/payments/${detail.settledByPaymentId}`}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
                  >
                    <IconCheck size={14} />
                    <span>
                      {tr('Đã quyết toán bởi', 'Settled by')}: {detail.settledByPaymentCode}
                    </span>
                  </Link>
                )}
              </div>
            )}
          </section>

          {/* 2. VAT Line Items & Settlement Summary */}
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
              <h2 className="text-sm font-bold text-slate-900">
                {tr(
                  `Bảng kê Hạng mục & Hóa đơn VAT (${detail.items.length})`,
                  `Itemized Breakdown & VAT Invoices (${detail.items.length})`,
                )}
              </h2>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] border-collapse text-left text-xs">
                <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase">
                  <tr>
                    <th className="px-4 py-2.5">#</th>
                    <th className="px-4 py-2.5">{tr('Hạng mục chi', 'Description')}</th>
                    <th className="px-4 py-2.5">{tr('Số HĐ VAT', 'Invoice')}</th>
                    <th className="px-3 py-2.5 text-right">{tr('SL', 'Qty')}</th>
                    <th className="px-3 py-2.5 text-right">{tr('Đơn giá', 'Unit Price')}</th>
                    <th className="px-3 py-2.5 text-right">VAT</th>
                    <th className="px-4 py-2.5 text-right">{tr('Thành tiền', 'Line Total')}</th>
                    <th className="px-4 py-2.5">{tr('Ghi chú', 'Note')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {detail.items.map((item, idx) => (
                    <tr key={item.id}>
                      <td className="px-4 py-2.5 text-slate-400">{idx + 1}</td>
                      <td className="px-4 py-2.5 font-semibold text-slate-900">
                        {item.description}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        {item.invoiceNo ? (
                          <div>
                            <span className="font-mono font-semibold text-slate-800">
                              {item.invoiceNo}
                            </span>
                            {item.invoiceDate && (
                              <div className="text-[10px] text-slate-400">
                                {formatDateVN(item.invoiceDate)}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{item.quantity}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {formatVND(item.unitPrice)}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">
                        {item.taxRate}%
                      </td>
                      <td className="px-4 py-2.5 text-right font-bold tabular-nums text-slate-900">
                        {formatVND(item.lineTotal)}
                      </td>
                      <td className="px-4 py-2.5 text-slate-500">{item.note ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="border-t border-slate-200 bg-slate-50/80 px-5 py-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-xs text-slate-600 italic">
                  <strong>{tr('Bằng chữ', 'In words')}:</strong>{' '}
                  {locale === 'en' ? detail.amountInWordsEn : detail.amountInWordsVi}
                </div>
                <div className="space-y-1 text-right text-xs">
                  <div className="text-slate-600">
                    {tr('Tạm tính trước thuế', 'Subtotal')}:{' '}
                    <strong className="tabular-nums text-slate-900">
                      {formatVND(detail.subtotalAmount)}
                    </strong>
                  </div>
                  <div className="text-slate-600">
                    {tr('Tổng thuế VAT', 'Total VAT')}:{' '}
                    <strong className="tabular-nums text-slate-900">
                      {formatVND(detail.taxAmount)}
                    </strong>
                  </div>
                  <div className="text-sm font-extrabold tabular-nums text-blue-700">
                    {tr('TỔNG CỘNG', 'GRAND TOTAL')}: {formatVND(detail.totalAmount)}
                  </div>
                </div>
              </div>

              {detail.paymentType === 'ADVANCE_SETTLEMENT' && (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-teal-200 bg-teal-50/70 px-4 py-2.5 text-xs">
                  <div>
                    {tr('Đã tạm ứng trước đó', 'Prior Advance')}:{' '}
                    <strong className="tabular-nums text-slate-900">
                      {formatVND(detail.advanceAmount)}
                    </strong>
                  </div>
                  <div className="font-extrabold">
                    {detail.settlementDirection === 'PAY_MORE' ? (
                      <span className="text-blue-700">
                        {tr('Công ty chi bổ sung: ', 'Company Pays Additional: ')}
                        {formatVND(detail.payableAmount)}
                      </span>
                    ) : detail.settlementDirection === 'REFUND_COMPANY' ? (
                      <span className="text-orange-700">
                        {tr('Nhân viên hoàn trả quỹ: ', 'Employee Refunds Company: ')}
                        {formatVND(Math.abs(detail.netSettlementAmount))}
                      </span>
                    ) : (
                      <span className="text-emerald-700">
                        {tr('Khớp hoàn toàn 0 ₫', 'Fully Balanced (0 VND)')}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* 3. Disbursement Progress & Ledger */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <IconWallet size={17} className="text-emerald-600" />
                <span>{tr('Tiến độ & Lịch sử Giải ngân Kế toán', 'Disbursement Ledger')}</span>
              </h2>
              <div className="text-xs font-bold tabular-nums text-emerald-700">
                {formatVND(detail.disbursedAmount)} / {formatVND(targetPayoutAmount)} (
                {detail.disbursementProgressPercent}%)
              </div>
            </div>

            <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all"
                style={{ width: `${detail.disbursementProgressPercent}%` }}
              />
            </div>

            {detail.disbursements.length === 0 ? (
              <p className="mt-3 text-xs text-slate-500">
                {tr(
                  'Chưa có giao dịch giải ngân nào được ghi nhận cho phiếu này.',
                  'No disbursements recorded yet for this request.',
                )}
              </p>
            ) : (
              <div className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-100">
                {detail.disbursements.map((d) => (
                  <div
                    key={d.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                            d.direction === 'INCOMING_REFUND'
                              ? 'bg-orange-50 text-orange-700'
                              : 'bg-emerald-50 text-emerald-700'
                          }`}
                        >
                          {d.direction === 'INCOMING_REFUND'
                            ? tr('Thu hoàn quỹ', 'Refund In')
                            : tr('Chi trả', 'Payout')}
                        </span>
                        <span className="font-bold text-slate-900">{formatVND(d.amount)}</span>
                        <span className="text-slate-400">•</span>
                        <span className="text-slate-600">{formatDateVN(d.disbursementDate)}</span>
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-500">
                        {d.disbursedByName}
                        {d.bankTransactionRef && (
                          <>
                            {' '}
                            • {tr('Mã GD', 'Ref')}:{' '}
                            <span className="font-mono font-semibold text-slate-800">
                              {d.bankTransactionRef}
                            </span>
                          </>
                        )}
                        {d.note && <> • {d.note}</>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* 4. Attachments & Comments (With Collaboration Lock) */}
          <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
            {/* Attachments */}
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                  <IconPaperclip size={17} className="text-blue-600" />
                  <span>
                    {tr(
                      `Chứng từ & Hóa đơn Đính kèm (${detail.attachments.length})`,
                      `Receipts & Supporting Documents (${detail.attachments.length})`,
                    )}
                  </span>
                </h2>

                {detail.actions.canUploadAttachment && (
                  <div className="flex items-center gap-2">
                    <select
                      value={attachmentKind}
                      onChange={(e) =>
                        setAttachmentKind(e.target.value as PaymentAttachmentKind)
                      }
                      className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs outline-none focus:border-blue-500"
                    >
                      <option value="INVOICE">{tr('Hóa đơn VAT', 'VAT Invoice')}</option>
                      <option value="RECEIPT">{tr('Biên lai / Chứng từ', 'Receipt')}</option>
                      <option value="CONTRACT">{tr('Hợp đồng / Báo giá', 'Contract')}</option>
                      <option value="OTHER">{tr('Tài liệu khác', 'Other')}</option>
                    </select>
                    <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700">
                      <IconUpload size={14} />
                      <span>
                        {isUploadingFile
                          ? tr('Đang tải...', 'Uploading...')
                          : tr('Tải chứng từ', 'Upload')}
                      </span>
                      <input
                        type="file"
                        disabled={isUploadingFile}
                        accept=".pdf,.png,.jpg,.jpeg,.webp,.docx,.xlsx,.csv"
                        className="hidden"
                        onChange={(e) => {
                          void handleFileUpload(e.target.files?.[0]);
                          e.target.value = '';
                        }}
                      />
                    </label>
                  </div>
                )}
              </div>

              {!detail.actions.canUploadAttachment && (
                <div className="mt-2.5 inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-1.5 text-[11px] font-medium text-slate-600">
                  <IconLock size={13} />
                  <span>
                    {tr(
                      'Chỉ cho phép bình luận và tải lên/xóa tệp đính kèm khi phiếu đang ở trạng thái Chờ phê duyệt (vẫn cho tải xuống xem lại).',
                      'Comments and file uploads/deletes are only permitted while Pending Approval (read-only downloads remain enabled).',
                    )}
                  </span>
                </div>
              )}

              {detail.attachments.length === 0 ? (
                <p className="mt-3 text-xs text-slate-500">
                  {tr('Chưa có chứng từ nào được đính kèm.', 'No supporting documents uploaded yet.')}
                </p>
              ) : (
                <div className="mt-3 space-y-2">
                  {[...primaryAttachments, ...uncAttachments].map((att) => {
                    const kindMeta = ATTACHMENT_KIND_META[att.attachmentKind];
                    return (
                      <div
                        key={att.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/70 px-3.5 py-2.5 text-xs"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${kindMeta.cls}`}
                            >
                              {locale === 'en' ? kindMeta.en : kindMeta.vi}
                            </span>
                            <span className="truncate font-semibold text-slate-900">
                              {att.fileName}
                            </span>
                          </div>
                          <div className="mt-0.5 text-[11px] text-slate-500">
                            {formatBytesCompact(att.fileSize)} • {att.uploadedByName} •{' '}
                            {formatDateTimeVN(att.createdAt)}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <a
                            href={`/api/v1/payments/${detail.id}/attachments/${att.id}`}
                            className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 hover:border-blue-300 hover:text-blue-700"
                            title={tr('Tải xuống', 'Download')}
                          >
                            <IconDownload size={15} />
                          </a>
                          {att.canDelete && (
                            <button
                              type="button"
                              onClick={() => void handleDeleteAttachment(att.id)}
                              className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 hover:border-rose-300 hover:text-rose-600"
                              title={tr('Xóa tệp', 'Delete file')}
                            >
                              <IconTrash size={15} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Comments */}
            <div className="border-t border-slate-100 pt-5">
              <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <IconMessageCircle size={17} className="text-slate-600" />
                <span>
                  {tr(
                    `Trao đổi & Kiểm soát Chứng từ (${detail.comments.length})`,
                    `Discussion & Verification Notes (${detail.comments.length})`,
                  )}
                </span>
              </h3>

              <div className="mt-3 space-y-2.5">
                {detail.comments.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    {tr('Chưa có bình luận trao đổi nào.', 'No comments yet.')}
                  </p>
                ) : (
                  detail.comments.map((cm) => (
                    <div
                      key={cm.id}
                      className={`rounded-xl border p-3 text-xs ${
                        cm.commentType === 'REVISION_REQUEST'
                          ? 'border-orange-200 bg-orange-50/70'
                          : 'border-slate-100 bg-slate-50/70'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-slate-900">{cm.authorName}</span>
                        <span className="text-[11px] text-slate-400">
                          {formatDateTimeVN(cm.createdAt)}
                        </span>
                      </div>
                      <p className="mt-1 whitespace-pre-line text-slate-700">{cm.content}</p>
                    </div>
                  ))
                )}
              </div>

              {detail.actions.canComment && (
                <form onSubmit={(e) => void handlePostComment(e)} className="mt-3 flex gap-2">
                  <input
                    type="text"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder={tr(
                      'Nhập ghi chú trao đổi với Kế toán / Người duyệt...',
                      'Write a comment for Finance or Approvers...',
                    )}
                    className="flex-1 rounded-xl border border-slate-200 px-3.5 py-2 text-xs outline-none focus:border-blue-500"
                  />
                  <button
                    type="submit"
                    disabled={isPostingComment || !commentText.trim()}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-600 disabled:opacity-40"
                  >
                    <IconSend size={14} />
                    <span>{tr('Gửi', 'Send')}</span>
                  </button>
                </form>
              )}
            </div>
          </section>
        </div>

        {/* RIGHT 4 COLS */}
        <div className="space-y-5 xl:col-span-4">
          {/* Beneficiary & Fast-Copy Banking Card */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
              {detail.paymentMethod === 'BANK_TRANSFER' ? (
                <IconBuildingBank size={18} className="text-blue-600" />
              ) : (
                <IconCash size={18} className="text-emerald-600" />
              )}
              <span>{tr('Thông tin Thụ hưởng & Chuyển khoản', 'Beneficiary & Bank Transfer')}</span>
            </div>

            <div className="mt-3 space-y-2.5 text-xs">
              <div className="rounded-xl bg-slate-50 p-3">
                <div className="text-[10px] font-bold text-slate-400 uppercase">
                  {detail.beneficiaryType === 'VENDOR'
                    ? tr('Nhà cung cấp', 'Vendor')
                    : tr('Nhân viên thụ hưởng', 'Employee Beneficiary')}
                </div>
                <div className="mt-0.5 text-sm font-bold text-slate-900">
                  {detail.beneficiaryName}
                </div>
                {detail.beneficiaryTaxCode && (
                  <div className="mt-0.5 font-mono text-[11px] text-slate-500">
                    MST: {detail.beneficiaryTaxCode}
                  </div>
                )}
              </div>

              {detail.paymentMethod === 'BANK_TRANSFER' && (
                <>
                  <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 px-3 py-2.5">
                    <div className="min-w-0">
                      <div className="text-[10px] text-slate-400 uppercase">
                        {detail.bankName ?? tr('Ngân hàng', 'Bank')}
                        {detail.bankBranch ? ` • ${detail.bankBranch}` : ''}
                      </div>
                      <div className="truncate font-mono text-sm font-extrabold text-slate-900">
                        {detail.bankAccountNo ?? '—'}
                      </div>
                    </div>
                    {detail.bankAccountNo && (
                      <button
                        type="button"
                        onClick={() => copyToClipboard('acc', detail.bankAccountNo!)}
                        className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-700"
                      >
                        {copiedField === 'acc' ? <IconCheck size={13} /> : <IconCopy size={13} />}
                        <span>
                          {copiedField === 'acc' ? tr('Đã chép', 'Copied') : tr('Chép STK', 'Copy')}
                        </span>
                      </button>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 px-3 py-2.5">
                    <div className="min-w-0">
                      <div className="text-[10px] text-slate-400 uppercase">
                        {tr('Nội dung chuyển khoản gợi ý', 'Suggested Transfer Memo')}
                      </div>
                      <div className="truncate font-mono text-xs font-semibold text-slate-800">
                        {transferMemo}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyToClipboard('memo', transferMemo)}
                      className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-700"
                    >
                      {copiedField === 'memo' ? <IconCheck size={13} /> : <IconCopy size={13} />}
                      <span>
                        {copiedField === 'memo' ? tr('Đã chép', 'Copied') : tr('Chép', 'Copy')}
                      </span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </section>

          {/* Activity Timeline */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
            <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <IconHistory size={17} className="text-slate-600" />
              <span>{tr('Nhật ký Hoạt động', 'Activity Timeline')}</span>
            </h2>
            <div className="mt-3 space-y-3">
              {detail.activities.map((act) => (
                <div
                  key={act.id}
                  className="relative border-l-2 border-slate-200 pl-3.5 text-xs"
                >
                  <span className="absolute top-1 -left-[5px] h-2 w-2 rounded-full bg-blue-500" />
                  <div className="font-semibold text-slate-800">{act.summary}</div>
                  <div className="mt-0.5 text-[11px] text-slate-400">
                    {act.actorName ?? tr('Hệ thống', 'System')} • {formatDateTimeVN(act.createdAt)}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      {/* MANDATORY: FULL-WIDTH BOTTOM APPROVAL WORKFLOW SECTION */}
      <section className="w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3.5">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <IconChecklist size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                {tr('Luồng Phê duyệt Đa cấp (Core Approval Engine)', 'Multi-Level Approval Workflow')}
              </h2>
              <p className="text-xs text-slate-500">
                {detail.approval
                  ? tr(
                      `Đang ở bước ${detail.approval.request.currentStep}/${detail.approval.request.totalSteps}${
                        detail.approval.request.currentApproverRoleName
                          ? ` • Vai trò xử lý: ${ln(
                              detail.approval.request.currentApproverRoleName,
                              detail.approval.request.currentApproverRoleNameEn,
                            )}`
                          : ''
                      }`,
                      `Step ${detail.approval.request.currentStep}/${detail.approval.request.totalSteps}${
                        detail.approval.request.currentApproverRoleName
                          ? ` • Current Role: ${ln(
                              detail.approval.request.currentApproverRoleName,
                              detail.approval.request.currentApproverRoleNameEn,
                            )}`
                          : ''
                      }`,
                    )
                  : tr(
                      'Phiếu chưa được gửi vào quy trình phê duyệt.',
                      'This payment request has not entered the approval workflow yet.',
                    )}
              </p>
            </div>
          </div>

          {detail.approval && (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
              {detail.approval.request.status}
            </span>
          )}
        </div>

        {detail.approval && detail.approval.histories.length > 0 ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left text-xs">
              <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase">
                <tr>
                  <th className="px-4 py-2.5">{tr('Bước', 'Step')}</th>
                  <th className="px-4 py-2.5">{tr('Người thực hiện', 'Actor')}</th>
                  <th className="px-4 py-2.5">{tr('Hành động', 'Action')}</th>
                  <th className="px-4 py-2.5">{tr('Thời gian', 'Timestamp')}</th>
                  <th className="px-4 py-2.5">{tr('Ghi chú', 'Comment')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {detail.approval.histories.map((h) => {
                  const meta = APPROVAL_ACTION_LABELS[h.action];
                  return (
                    <tr key={h.id}>
                      <td className="px-4 py-2.5 font-bold text-slate-700">#{h.stepOrder}</td>
                      <td className="px-4 py-2.5 font-semibold text-slate-900">
                        {h.actorName ?? tr('Hệ thống', 'System')}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${meta.cls}`}>
                          {locale === 'en' ? meta.en : meta.vi}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-slate-500">
                        {formatDateTimeVN(h.actedAt)}
                      </td>
                      <td className="px-4 py-2.5 text-slate-700">{h.comment ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-4 text-center text-xs text-slate-500">
            {tr(
              'Chưa có lịch sử phê duyệt. Nhấn "Gửi phê duyệt" để kích hoạt luồng duyệt tự động theo hạn mức.',
              'No approval history yet. Click "Submit" to start automatic multi-level routing.',
            )}
          </div>
        )}
      </section>

      {/* Modals */}
      {isEditOpen && (
        <PaymentFormModal
          isOpen={isEditOpen}
          editingPayment={detail}
          categories={categories}
          options={options}
          onClose={() => setIsEditOpen(false)}
          onSaved={(saved) => {
            setIsEditOpen(false);
            setDetail(saved);
          }}
        />
      )}

      {isSettleModalOpen && (
        <PaymentFormModal
          isOpen={isSettleModalOpen}
          editingPayment={null}
          presetAdvanceId={detail.id}
          categories={categories}
          options={options}
          onClose={() => setIsSettleModalOpen(false)}
          onSaved={(saved) => {
            setIsSettleModalOpen(false);
            router.push(`/services/payments/${saved.id}`);
          }}
        />
      )}

      {isDisburseOpen && (
        <PaymentDisbursementModal
          isOpen={isDisburseOpen}
          payment={detail}
          isRefundMode={detail.actions.canConfirmRefund}
          onClose={() => setIsDisburseOpen(false)}
          onCompleted={(updated) => {
            setIsDisburseOpen(false);
            setDetail(updated);
          }}
        />
      )}

      {statusModalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <form
            onSubmit={(e) => void handleStatusTransition(e)}
            className="w-full max-w-md space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl"
          >
            <h3 className="text-sm font-bold text-slate-900">
              {statusModalMode === 'REQUEST_REVISION'
                ? tr('Yêu cầu bổ sung chứng từ / chỉnh sửa', 'Request Document Revision')
                : tr('Xác nhận hủy đề nghị thanh toán', 'Confirm Cancel Payment Request')}
            </h3>
            <textarea
              required={statusModalMode === 'REQUEST_REVISION'}
              rows={3}
              value={statusNote}
              onChange={(e) => setStatusNote(e.target.value)}
              placeholder={
                statusModalMode === 'REQUEST_REVISION'
                  ? tr('Nêu rõ chứng từ/hóa đơn cần bổ sung...', 'Specify missing receipts or edits...')
                  : tr('Nhập lý do hủy phiếu (tùy chọn)...', 'Reason for cancellation (optional)...')
              }
              className="w-full rounded-xl border border-slate-200 p-3 text-xs outline-none focus:border-blue-500"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setStatusModalMode(null)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                {tr('Đóng', 'Close')}
              </button>
              <button
                type="submit"
                disabled={isProcessingAction}
                className="rounded-xl bg-orange-600 px-4 py-2 text-xs font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
              >
                {tr('Xác nhận', 'Confirm')}
              </button>
            </div>
          </form>
        </div>
      )}

      <ConfirmModal
        isOpen={isDeleteConfirmOpen}
        title={tr('Xóa đề nghị thanh toán?', 'Delete payment request?')}
        description={tr(
          `Bạn có chắc muốn xóa mềm phiếu ${detail.code}? Hành động này sẽ ẩn phiếu khỏi danh sách vận hành.`,
          `Are you sure you want to archive ${detail.code}? This hides the request from active views.`,
        )}
        confirmLabel={tr('Xóa phiếu', 'Delete')}
        cancelLabel={tr('Hủy', 'Cancel')}
        variant="danger"
        isProcessing={isProcessingAction}
        onCancel={() => setIsDeleteConfirmOpen(false)}
        onConfirm={() => void handleDelete()}
      />
    </div>
  );
}
