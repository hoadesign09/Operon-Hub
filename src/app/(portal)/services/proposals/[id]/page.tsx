'use client';

import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  IconArrowLeft,
  IconCheck,
  IconCircleCheck,
  IconDownload,
  IconEdit,
  IconFileTypePdf,
  IconMessageCircle,
  IconPaperclip,
  IconPlayerPlay,
  IconRefresh,
  IconRotate2,
  IconSend,
  IconTrash,
  IconUpload,
  IconX,
} from '@tabler/icons-react';
import { usePortalAuth } from '@/components/portal/PortalAuthContext';
import {
  ProposalFormModal,
  type EditableProposalData,
} from '@/components/proposals/ProposalFormModal';
import {
  PROPOSAL_ACTIVITY_LABELS,
  PROPOSAL_PRIORITY_META,
  PROPOSAL_STATUS_META,
  type ProposalCategoryOption,
  type ProposalPriorityKey,
  type ProposalStatusKey,
} from '@/components/proposals/proposal-ui.constants';
import { formatVND } from '@/lib/portable/currency-utils';
import { formatDateTimeVN, formatDateVN } from '@/lib/portable/date-utils';
import { useI18n } from '@/shared/i18n/I18nContext';

interface ProposalDetailResponse extends EditableProposalData {
  proposalCode: string;
  categoryCode: string;
  categoryName: string;
  categoryNameEn: string | null;
  categoryColorHex: string;
  branchName: string;
  branchNameEn: string | null;
  departmentName: string | null;
  departmentNameEn: string | null;
  requesterUserId: number;
  requesterName: string;
  status: ProposalStatusKey;
  approvedBudget: number | null;
  currency: string;
  approvalRequestId: number | null;
  submittedAt: string | null;
  approvedAt: string | null;
  completedAt: string | null;
  rejectionReason: string | null;
  executionNotes: string | null;
  createdAt: string;
  updatedAt: string;
  items: Array<{
    id: number;
    lineNo: number;
    itemName: string;
    specification: string | null;
    unit: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    vendorNote: string | null;
  }>;
  activities: Array<{
    id: number;
    actorName: string | null;
    actionType: string;
    createdAt: string;
  }>;
  approval: {
    request: {
      id: number;
      currentStep: number;
      totalSteps: number;
      currentApproverRoleName: string | null;
      currentApproverRoleNameEn?: string | null;
      status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
    };
    histories: Array<{
      id: number;
      stepOrder: number;
      actorName: string | null;
      action: 'SUBMIT' | 'APPROVE' | 'REJECT' | 'CANCEL';
      comment: string | null;
      actedAt: string;
    }>;
    canApproveOrReject: boolean;
    canCancel: boolean;
  } | null;
  actions: {
    canEdit: boolean;
    canDelete: boolean;
    canSubmit: boolean;
    canRequestRevision: boolean;
    canCancel: boolean;
    canStartExecution: boolean;
    canComplete: boolean;
  };
}

interface ProposalCommentRow {
  id: number;
  authorName: string;
  commentType: 'GENERAL' | 'REVISION_REQUEST' | 'EXECUTION_UPDATE';
  content: string;
  createdAt: string;
}

interface ProposalAttachmentRow {
  id: number;
  uploadedByName: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  createdAt: string;
  canDelete: boolean;
}

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

const APPROVAL_ACTION_LABELS: Record<
  'SUBMIT' | 'APPROVE' | 'REJECT' | 'CANCEL',
  { vi: string; en: string }
> = {
  SUBMIT: { vi: 'Gửi duyệt', en: 'Submitted' },
  APPROVE: { vi: 'Phê duyệt', en: 'Approved' },
  REJECT: { vi: 'Từ chối', en: 'Rejected' },
  CANCEL: { vi: 'Hủy / Trả lại', en: 'Cancelled / Returned' },
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function ProposalDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { locale, tr, ln } = useI18n();
  const { hasPermission } = usePortalAuth();
  const canExport = hasPermission('proposals.export');
  const proposalId = Number(params?.id);
  const isValidProposalId = Number.isInteger(proposalId) && proposalId > 0;

  const [viewState, setViewState] = useState<'loading' | 'success' | 'error'>(
    isValidProposalId ? 'loading' : 'error',
  );
  const [errorMessage, setErrorMessage] = useState(
    isValidProposalId ? '' : 'INVALID_PROPOSAL_ID',
  );
  const [detail, setDetail] = useState<ProposalDetailResponse | null>(null);
  const [comments, setComments] = useState<ProposalCommentRow[]>([]);
  const [attachments, setAttachments] = useState<ProposalAttachmentRow[]>([]);
  const [categories, setCategories] = useState<ProposalCategoryOption[]>([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [reloadTick, setReloadTick] = useState(0);

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [approvalComment, setApprovalComment] = useState('');
  const [actionError, setActionError] = useState('');
  const [isActing, setIsActing] = useState(false);

  const [newComment, setNewComment] = useState('');
  const [isPostingComment, setIsPostingComment] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  const [executionModal, setExecutionModal] = useState<'START_EXECUTION' | 'COMPLETE' | null>(null);
  const [executionNotesInput, setExecutionNotesInput] = useState('');
  const [approvedBudgetInput, setApprovedBudgetInput] = useState('');

  useEffect(() => {
    if (!isValidProposalId) {
      return;
    }

    const controller = new AbortController();
    Promise.all([
      fetch(`/api/v1/proposals/${proposalId}`, { cache: 'no-store', signal: controller.signal }),
      fetch(`/api/v1/proposals/${proposalId}/comments`, {
        cache: 'no-store',
        signal: controller.signal,
      }),
      fetch(`/api/v1/proposals/${proposalId}/attachments`, {
        cache: 'no-store',
        signal: controller.signal,
      }),
      fetch('/api/v1/proposals/categories?includeInactive=true', {
        cache: 'no-store',
        signal: controller.signal,
      }),
      fetch('/api/v1/core/branches?limit=100&isActive=true', {
        cache: 'no-store',
        signal: controller.signal,
      }),
      fetch('/api/v1/hrm/departments?limit=200', {
        cache: 'no-store',
        signal: controller.signal,
      }),
    ])
      .then(async ([dRes, cRes, aRes, catRes, brRes, deptRes]) => {
        if (controller.signal.aborted) return;
        const [dJson, cJson, aJson, catJson, brJson, deptJson] = await Promise.all([
          dRes.json().catch(() => null),
          cRes.json().catch(() => null),
          aRes.json().catch(() => null),
          catRes.json().catch(() => null),
          brRes.json().catch(() => null),
          deptRes.json().catch(() => null),
        ]);

        if (!dRes.ok || !dJson?.success || !dJson.data) {
          setErrorMessage(dJson?.error?.message ?? 'LOAD_FAILED');
          setViewState('error');
          return;
        }
        setDetail(dJson.data as ProposalDetailResponse);
        if (cRes.ok && cJson?.success) setComments((cJson.data ?? []) as ProposalCommentRow[]);
        if (aRes.ok && aJson?.success) {
          setAttachments((aJson.data ?? []) as ProposalAttachmentRow[]);
        }
        if (catRes.ok && catJson?.success) {
          setCategories((catJson.data ?? []) as ProposalCategoryOption[]);
        }
        if (brRes.ok && brJson?.success) setBranches((brJson.data ?? []) as BranchOption[]);
        if (deptRes.ok && deptJson?.success) {
          setDepartments((deptJson.data ?? []) as DepartmentOption[]);
        }
        setErrorMessage('');
        setViewState('success');
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setErrorMessage('NETWORK_ERROR');
        setViewState('error');
      });

    return () => controller.abort();
  }, [proposalId, isValidProposalId, reloadTick]);

  function triggerReload() {
    setViewState('loading');
    setReloadTick((t) => t + 1);
  }

  async function handleSubmitForApproval() {
    if (!detail) return;
    setActionError('');
    setIsActing(true);
    try {
      const res = await fetch(`/api/v1/proposals/${detail.id}/submit`, { method: 'POST' });
      const json = (await res.json().catch(() => null)) as {
        success?: boolean;
        error?: { message?: string };
      } | null;
      if (!res.ok || !json?.success) {
        setActionError(
          json?.error?.message ??
            tr('Không thể gửi đề xuất phê duyệt.', 'Unable to submit proposal for approval.'),
        );
        return;
      }
      triggerReload();
    } finally {
      setIsActing(false);
    }
  }

  async function handleApprovalDecision(action: 'APPROVE' | 'REJECT') {
    if (!detail?.approval) return;
    if (action === 'REJECT' && approvalComment.trim().length === 0) {
      setActionError(
        tr('Vui lòng nhập lý do từ chối.', 'Please provide a rejection reason.'),
      );
      return;
    }
    setActionError('');
    setIsActing(true);
    try {
      const res = await fetch(`/api/v1/approvals/${detail.approval.request.id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, comment: approvalComment.trim() || undefined }),
      });
      const json = (await res.json().catch(() => null)) as {
        success?: boolean;
        error?: { message?: string };
      } | null;
      if (!res.ok || !json?.success) {
        setActionError(
          json?.error?.message ??
            tr('Không thể xử lý phê duyệt.', 'Unable to process approval action.'),
        );
        return;
      }
      setApprovalComment('');
      triggerReload();
    } finally {
      setIsActing(false);
    }
  }

  async function handleStatusAction(
    action: 'REQUEST_REVISION' | 'CANCEL' | 'START_EXECUTION' | 'COMPLETE',
    extra?: { comment?: string; executionNotes?: string; approvedBudget?: number | null },
  ) {
    if (!detail) return;
    if (action === 'REQUEST_REVISION' && (!extra?.comment || extra.comment.trim().length < 3)) {
      setActionError(
        tr(
          'Vui lòng nhập nội dung yêu cầu chỉnh sửa (tối thiểu 3 ký tự).',
          'Please enter revision feedback (at least 3 characters).',
        ),
      );
      return;
    }

    setActionError('');
    setIsActing(true);
    try {
      const res = await fetch(`/api/v1/proposals/${detail.id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          comment: extra?.comment?.trim() || undefined,
          executionNotes: extra?.executionNotes?.trim() || undefined,
          approvedBudget: extra?.approvedBudget ?? undefined,
        }),
      });
      const json = (await res.json().catch(() => null)) as {
        success?: boolean;
        error?: { message?: string };
      } | null;
      if (!res.ok || !json?.success) {
        setActionError(
          json?.error?.message ??
            tr('Không thể cập nhật trạng thái đề xuất.', 'Unable to update proposal status.'),
        );
        return;
      }
      setApprovalComment('');
      setExecutionModal(null);
      triggerReload();
    } finally {
      setIsActing(false);
    }
  }

  async function handlePostComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detail || newComment.trim().length === 0) return;
    setIsPostingComment(true);
    try {
      const res = await fetch(`/api/v1/proposals/${detail.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newComment.trim(), commentType: 'GENERAL' }),
      });
      const json = (await res.json().catch(() => null)) as {
        success?: boolean;
        data?: ProposalCommentRow[];
      } | null;
      if (res.ok && json?.success && json.data) {
        setComments(json.data);
        setNewComment('');
      }
    } finally {
      setIsPostingComment(false);
    }
  }

  async function handleUploadFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !detail) return;
    setActionError('');
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`/api/v1/proposals/${detail.id}/attachments`, {
        method: 'POST',
        body: formData,
      });
      const json = (await res.json().catch(() => null)) as {
        success?: boolean;
        data?: ProposalAttachmentRow[];
        error?: { message?: string };
      } | null;
      if (!res.ok || !json?.success) {
        setActionError(
          json?.error?.message ??
            tr('Không thể tải tệp đính kèm lên.', 'Unable to upload attachment.'),
        );
      } else if (json.data) {
        setAttachments(json.data);
      }
    } finally {
      setIsUploading(false);
      event.target.value = '';
    }
  }

  async function handleDeleteAttachment(attachmentId: number) {
    if (!detail) return;
    const res = await fetch(`/api/v1/proposals/${detail.id}/attachments/${attachmentId}`, {
      method: 'DELETE',
    });
    const json = (await res.json().catch(() => null)) as {
      success?: boolean;
      data?: ProposalAttachmentRow[];
    } | null;
    if (res.ok && json?.success && json.data) {
      setAttachments(json.data);
    }
  }

  async function handleDownloadPdf() {
    if (!detail) return;
    setIsDownloadingPdf(true);
    try {
      const res = await fetch(`/api/v1/proposals/${detail.id}/pdf`);
      if (!res.ok) {
        setActionError(tr('Không thể xuất file PDF.', 'Unable to generate PDF form.'));
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${detail.proposalCode}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } finally {
      setIsDownloadingPdf(false);
    }
  }

  if (viewState === 'loading') {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="h-24 animate-pulse rounded-2xl bg-slate-100" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="h-80 animate-pulse rounded-2xl bg-slate-100 lg:col-span-2" />
          <div className="h-80 animate-pulse rounded-2xl bg-slate-100" />
        </div>
      </div>
    );
  }

  if (viewState === 'error' || !detail) {
    return (
      <div className="mx-auto max-w-3xl rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center">
        <p className="text-sm font-semibold text-rose-700">
          {errorMessage === 'INVALID_PROPOSAL_ID'
            ? tr('Mã đề xuất không hợp lệ.', 'Invalid proposal ID.')
            : errorMessage === 'LOAD_FAILED'
              ? tr('Không thể tải chi tiết đề xuất.', 'Unable to load proposal details.')
              : errorMessage === 'NETWORK_ERROR'
                ? tr('Lỗi kết nối máy chủ.', 'Server connection error.')
                : errorMessage}
        </p>
        <div className="mt-4 flex justify-center gap-2">
          <button
            type="button"
            onClick={triggerReload}
            className="inline-flex items-center gap-1 rounded-xl border border-rose-300 bg-white px-4 py-2 text-xs font-semibold text-rose-700"
          >
            <IconRefresh size={14} />
            <span>{tr('Thử lại', 'Retry')}</span>
          </button>
          <button
            type="button"
            onClick={() => router.push('/services/proposals')}
            className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white"
          >
            {tr('Quay lại danh sách', 'Back to Proposals')}
          </button>
        </div>
      </div>
    );
  }

  const statusMeta = PROPOSAL_STATUS_META[detail.status];
  const priorityMeta = PROPOSAL_PRIORITY_META[detail.priority as ProposalPriorityKey];

  return (
    <div className="mx-auto max-w-[1360px] space-y-5">
      {/* Breadcrumb & Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/services/proposals"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-blue-600"
        >
          <IconArrowLeft size={15} />
          <span>{tr('Quay lại danh sách Đề xuất', 'Back to Proposals')}</span>
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          {canExport && (
            <button
              type="button"
              disabled={isDownloadingPdf}
              onClick={() => void handleDownloadPdf()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              <IconFileTypePdf size={15} className="text-rose-600" />
              <span>
                {isDownloadingPdf
                  ? tr('Đang xuất PDF...', 'Exporting PDF...')
                  : tr('Xuất Tờ trình PDF', 'Export PDF Form')}
              </span>
            </button>
          )}
          {detail.actions.canEdit && (
            <button
              type="button"
              onClick={() => setIsEditOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <IconEdit size={15} />
              <span>{tr('Chỉnh sửa', 'Edit')}</span>
            </button>
          )}
          {detail.actions.canSubmit && (
            <button
              type="button"
              disabled={isActing}
              onClick={() => void handleSubmitForApproval()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              <IconSend size={15} />
              <span>
                {detail.status === 'NEEDS_REVISION'
                  ? tr('Gửi duyệt lại', 'Resubmit for Approval')
                  : tr('Gửi phê duyệt', 'Submit for Approval')}
              </span>
            </button>
          )}
          {detail.actions.canStartExecution && (
            <button
              type="button"
              disabled={isActing}
              onClick={() => {
                setApprovedBudgetInput(String(detail.approvedBudget ?? detail.estimatedBudget));
                setExecutionNotesInput(detail.executionNotes ?? '');
                setExecutionModal('START_EXECUTION');
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
            >
              <IconPlayerPlay size={15} />
              <span>{tr('Bắt đầu thực thi', 'Start Execution')}</span>
            </button>
          )}
          {detail.actions.canComplete && (
            <button
              type="button"
              disabled={isActing}
              onClick={() => {
                setApprovedBudgetInput(String(detail.approvedBudget ?? detail.estimatedBudget));
                setExecutionNotesInput(detail.executionNotes ?? '');
                setExecutionModal('COMPLETE');
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
            >
              <IconCircleCheck size={15} />
              <span>{tr('Đánh dấu hoàn tất', 'Mark Completed')}</span>
            </button>
          )}
          {detail.actions.canCancel && (
            <button
              type="button"
              disabled={isActing}
              onClick={() => void handleStatusAction('CANCEL')}
              className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
            >
              <IconX size={14} />
              <span>{tr('Hủy đề xuất', 'Cancel')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Header Card */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-lg bg-blue-50 px-2.5 py-1 font-mono text-xs font-bold text-blue-700">
            {detail.proposalCode}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: detail.categoryColorHex }}
            />
            <span>{ln(detail.categoryName, detail.categoryNameEn)}</span>
          </span>
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusMeta.cls}`}>
            {locale === 'en' ? statusMeta.en : statusMeta.vi}
          </span>
          <span className={`rounded-full px-2.5 py-1 text-xs ${priorityMeta.cls}`}>
            {tr('Ưu tiên', 'Priority')}: {locale === 'en' ? priorityMeta.en : priorityMeta.vi}
          </span>
        </div>

        <h1 className="mt-3 text-xl font-bold text-slate-900">{detail.title}</h1>
        {detail.summary && <p className="mt-1.5 text-sm text-slate-600">{detail.summary}</p>}

        {detail.rejectionReason && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
            <span className="font-bold">
              {detail.status === 'NEEDS_REVISION'
                ? tr('Yêu cầu chỉnh sửa: ', 'Revision Requested: ')
                : tr('Lý do từ chối / hủy: ', 'Rejection / Cancellation Note: ')}
            </span>
            <span>{detail.rejectionReason}</span>
          </div>
        )}

        {actionError && (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-medium text-rose-700">
            {actionError}
          </div>
        )}
      </section>

      {/* Main 2-Column Layout */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Left Column */}
        <div className="space-y-5 lg:col-span-2">
          {/* Rationale & Expected Outcome */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs">
            <h2 className="text-sm font-bold text-slate-900">
              {tr('Nội dung & Lý do Đề xuất', 'Proposal Content & Rationale')}
            </h2>
            <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
              {detail.content}
            </div>

            {detail.expectedOutcome && (
              <div className="mt-5 border-t border-slate-100 pt-4">
                <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  {tr('Kết quả & Hiệu quả Kỳ vọng', 'Expected Outcome / Benefits')}
                </h3>
                <p className="mt-1.5 whitespace-pre-wrap text-sm text-slate-700">
                  {detail.expectedOutcome}
                </p>
              </div>
            )}

            {detail.executionNotes && (
              <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
                <h3 className="text-xs font-bold uppercase tracking-wide text-emerald-800">
                  {tr('Ghi chú Thực thi / Nghiệm thu', 'Execution & Completion Notes')}
                </h3>
                <p className="mt-1 whitespace-pre-wrap text-sm text-emerald-900">
                  {detail.executionNotes}
                </p>
              </div>
            )}
          </section>

          {/* Budget Breakdown Table */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900">
                {tr('Bảng Dự toán Chi tiết', 'Itemized Budget Breakdown')}
              </h2>
              <span className="text-base font-bold text-blue-700">
                {formatVND(detail.estimatedBudget)}
              </span>
            </div>

            {detail.items.length === 0 ? (
              <p className="mt-3 text-xs text-slate-500">
                {detail.estimatedBudget > 0
                  ? tr(
                      'Đề xuất sử dụng ngân sách tổng trọn gói (không tách từng hạng mục).',
                      'This proposal uses a lump-sum budget with no individual line items.',
                    )
                  : tr(
                      'Đề xuất không phát sinh chi phí ngân sách.',
                      'This proposal involves no budget expenditure.',
                    )}
              </p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                  <thead className="bg-slate-50 font-semibold uppercase text-slate-500">
                    <tr>
                      <th className="px-3 py-2">#</th>
                      <th className="px-3 py-2">{tr('Hạng mục', 'Item')}</th>
                      <th className="px-3 py-2">{tr('ĐVT', 'Unit')}</th>
                      <th className="px-3 py-2 text-right">{tr('SL', 'Qty')}</th>
                      <th className="px-3 py-2 text-right">{tr('Đơn giá', 'Unit Price')}</th>
                      <th className="px-3 py-2 text-right">{tr('Thành tiền', 'Line Total')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {detail.items.map((it) => (
                      <tr key={it.id}>
                        <td className="px-3 py-2.5 text-slate-500">{it.lineNo}</td>
                        <td className="px-3 py-2.5">
                          <div className="font-semibold text-slate-800">{it.itemName}</div>
                          {it.specification && (
                            <div className="text-[11px] text-slate-500">{it.specification}</div>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-slate-600">{it.unit}</td>
                        <td className="px-3 py-2.5 text-right text-slate-700">{it.quantity}</td>
                        <td className="px-3 py-2.5 text-right text-slate-700">
                          {formatVND(it.unitPrice)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-semibold text-slate-900">
                          {formatVND(it.lineTotal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 font-bold text-slate-900">
                      <td colSpan={5} className="px-3 py-2.5 text-right">
                        {tr('Tổng cộng dự toán', 'Total Estimated Budget')}
                      </td>
                      <td className="px-3 py-2.5 text-right text-blue-700">
                        {formatVND(detail.estimatedBudget)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </section>

          {/* Attachments */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
                <IconPaperclip size={16} className="text-slate-500" />
                <span>
                  {tr('Tài liệu & Báo giá Đính kèm', 'Attachments & Quotes')} ({attachments.length})
                </span>
              </h2>
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100">
                <IconUpload size={14} />
                <span>
                  {isUploading ? tr('Đang tải lên...', 'Uploading...') : tr('Tải tệp lên', 'Upload File')}
                </span>
                <input
                  type="file"
                  disabled={isUploading}
                  onChange={(e) => void handleUploadFile(e)}
                  accept=".pdf,.png,.jpg,.jpeg,.webp,.docx,.xlsx,.csv,.txt"
                  className="hidden"
                />
              </label>
            </div>

            {attachments.length === 0 ? (
              <p className="mt-3 text-xs text-slate-500">
                {tr(
                  'Chưa có tệp đính kèm nào (hỗ trợ PDF, ảnh, DOCX, XLSX tối đa 10MB).',
                  'No attachments uploaded yet (supports PDF, images, DOCX, XLSX up to 10MB).',
                )}
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-slate-100">
                {attachments.map((att) => (
                  <li key={att.id} className="flex items-center justify-between gap-3 py-2.5 text-xs">
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-slate-800">{att.fileName}</div>
                      <div className="text-[11px] text-slate-500">
                        {formatFileSize(att.fileSizeBytes)} • {att.uploadedByName} •{' '}
                        {formatDateTimeVN(att.createdAt)}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <a
                        href={`/api/v1/proposals/${detail.id}/attachments/${att.id}`}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 font-medium text-slate-700 hover:bg-slate-50"
                      >
                        <IconDownload size={13} />
                        <span>{tr('Tải xuống', 'Download')}</span>
                      </a>
                      {att.canDelete && (
                        <button
                          type="button"
                          onClick={() => void handleDeleteAttachment(att.id)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                          title={tr('Gỡ tệp', 'Remove file')}
                        >
                          <IconTrash size={14} />
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Comments */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs">
            <h2 className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
              <IconMessageCircle size={16} className="text-slate-500" />
              <span>
                {tr('Thảo luận & Trao đổi', 'Discussion & Comments')} ({comments.length})
              </span>
            </h2>

            <div className="mt-4 space-y-3">
              {comments.length === 0 ? (
                <p className="text-xs text-slate-500">
                  {tr('Chưa có bình luận nào trên đề xuất này.', 'No comments yet on this proposal.')}
                </p>
              ) : (
                comments.map((c) => (
                  <div
                    key={c.id}
                    className={`rounded-xl border p-3.5 text-xs ${
                      c.commentType === 'REVISION_REQUEST'
                        ? 'border-amber-200 bg-amber-50/70'
                        : 'border-slate-100 bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-slate-800">{c.authorName}</span>
                      <span className="text-[11px] text-slate-400">
                        {formatDateTimeVN(c.createdAt)}
                      </span>
                    </div>
                    <p className="mt-1.5 whitespace-pre-wrap text-slate-700">{c.content}</p>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={(e) => void handlePostComment(e)} className="mt-4 flex gap-2">
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder={tr('Nhập bình luận trao đổi...', 'Write a comment...')}
                className="flex-1 rounded-xl border border-slate-300 px-3.5 py-2 text-xs outline-none focus:border-blue-500"
              />
              <button
                type="submit"
                disabled={isPostingComment || newComment.trim().length === 0}
                className="inline-flex items-center gap-1 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                <IconSend size={14} />
                <span>{tr('Gửi', 'Post')}</span>
              </button>
            </form>
          </section>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-5">
          {/* Metadata Card */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">
              {tr('Thông tin Hồ sơ', 'Proposal Metadata')}
            </h2>
            <dl className="mt-3 space-y-2.5 text-xs">
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">{tr('Người đề xuất', 'Requester')}</dt>
                <dd className="font-semibold text-slate-900">{detail.requesterName}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">{tr('Chi nhánh', 'Branch')}</dt>
                <dd className="font-medium text-slate-800">
                  {ln(detail.branchName, detail.branchNameEn)}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">{tr('Phòng ban', 'Department')}</dt>
                <dd className="font-medium text-slate-800">
                  {detail.departmentName
                    ? ln(detail.departmentName, detail.departmentNameEn)
                    : '-'}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">{tr('Ngân sách dự kiến', 'Estimated Budget')}</dt>
                <dd className="font-bold text-blue-700">{formatVND(detail.estimatedBudget)}</dd>
              </div>
              {detail.approvedBudget !== null && (
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">{tr('Ngân sách duyệt', 'Approved Budget')}</dt>
                  <dd className="font-bold text-emerald-700">
                    {formatVND(detail.approvedBudget)}
                  </dd>
                </div>
              )}
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">{tr('Nhà cung cấp', 'Vendor')}</dt>
                <dd className="text-right font-medium text-slate-800">
                  {detail.vendorName ?? '-'}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">{tr('Hạn cần hoàn tất', 'Needed By')}</dt>
                <dd className="font-medium text-slate-800">
                  {detail.neededByDate ? formatDateVN(detail.neededByDate) : '-'}
                </dd>
              </div>
              {(detail.effectiveFrom || detail.effectiveTo) && (
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">{tr('Thời gian áp dụng', 'Effective Period')}</dt>
                  <dd className="font-medium text-slate-800">
                    {detail.effectiveFrom ? formatDateVN(detail.effectiveFrom) : '?'} –{' '}
                    {detail.effectiveTo ? formatDateVN(detail.effectiveTo) : '?'}
                  </dd>
                </div>
              )}
              <div className="flex justify-between gap-2 border-t border-slate-100 pt-2">
                <dt className="text-slate-500">{tr('Ngày tạo', 'Created At')}</dt>
                <dd className="text-slate-700">{formatDateTimeVN(detail.createdAt)}</dd>
              </div>
            </dl>
          </section>

          {/* Approval Box */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">
              {tr('Luồng Phê duyệt (Core Approval Engine)', 'Approval Workflow')}
            </h2>

            {detail.approval ? (
              <div className="mt-3 space-y-4">
                <div className="rounded-xl bg-slate-50 p-3 text-xs">
                  <div className="font-semibold text-slate-800">
                    {tr('Tiến độ hiện tại', 'Current Progress')}: {tr('Bước', 'Step')}{' '}
                    {detail.approval.request.currentStep}/{detail.approval.request.totalSteps}
                  </div>
                  {detail.approval.request.currentApproverRoleName &&
                    detail.approval.request.status === 'PENDING' && (
                      <div className="mt-0.5 text-slate-600">
                        {tr('Cấp đang duyệt', 'Current Approver')}:{' '}
                        <span className="font-semibold text-blue-700">
                          {ln(
                            detail.approval.request.currentApproverRoleName,
                            detail.approval.request.currentApproverRoleNameEn,
                          )}
                        </span>
                      </div>
                    )}
                </div>

                {(detail.approval.canApproveOrReject || detail.actions.canRequestRevision) && (
                  <div className="space-y-2.5 rounded-xl border border-blue-200 bg-blue-50/40 p-3.5">
                    <label className="block text-xs font-semibold text-slate-700">
                      {tr(
                        'Nhận xét / Lý do (bắt buộc khi Từ chối hoặc Yêu cầu sửa)',
                        'Comment / Reason (required for Reject or Revision)',
                      )}
                    </label>
                    <textarea
                      rows={2}
                      value={approvalComment}
                      onChange={(e) => setApprovalComment(e.target.value)}
                      placeholder={tr('Nhập nhận xét phê duyệt...', 'Enter approval note...')}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs outline-none focus:border-blue-500"
                    />
                    <div className="flex flex-wrap gap-2">
                      {detail.approval.canApproveOrReject && (
                        <>
                          <button
                            type="button"
                            disabled={isActing}
                            onClick={() => void handleApprovalDecision('APPROVE')}
                            className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                          >
                            <IconCheck size={14} />
                            <span>{tr('Phê duyệt', 'Approve')}</span>
                          </button>
                          <button
                            type="button"
                            disabled={isActing}
                            onClick={() => void handleApprovalDecision('REJECT')}
                            className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
                          >
                            <IconX size={14} />
                            <span>{tr('Từ chối', 'Reject')}</span>
                          </button>
                        </>
                      )}
                      {detail.actions.canRequestRevision && (
                        <button
                          type="button"
                          disabled={isActing}
                          onClick={() =>
                            void handleStatusAction('REQUEST_REVISION', {
                              comment: approvalComment,
                            })
                          }
                          className="inline-flex w-full items-center justify-center gap-1 rounded-xl border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-60"
                        >
                          <IconRotate2 size={14} />
                          <span>{tr('Trả về yêu cầu chỉnh sửa', 'Request Revision')}</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}

                <ol className="space-y-2.5 border-l-2 border-slate-200 pl-3.5 text-xs">
                  {detail.approval.histories.map((h) => (
                    <li key={h.id}>
                      <div className="font-semibold text-slate-800">
                        {h.actorName ?? tr('Hệ thống', 'System')} —{' '}
                        {locale === 'en'
                          ? APPROVAL_ACTION_LABELS[h.action].en
                          : APPROVAL_ACTION_LABELS[h.action].vi}{' '}
                        ({tr('Bước', 'Step')} {h.stepOrder})
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {formatDateTimeVN(h.actedAt)}
                      </div>
                      {h.comment && <p className="mt-0.5 text-slate-600">{h.comment}</p>}
                    </li>
                  ))}
                </ol>
              </div>
            ) : (
              <p className="mt-3 text-xs text-slate-500">
                {tr(
                  'Đề xuất chưa gửi sang luồng phê duyệt hoặc đã hoàn tất ngoài hộp thư.',
                  'This proposal has not been routed through approval yet.',
                )}
              </p>
            )}
          </section>

          {/* Activity Log */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">
              {tr('Nhật ký Vòng đời', 'Lifecycle Activity')}
            </h2>
            <ol className="mt-3 space-y-2.5 text-xs">
              {detail.activities.map((act) => {
                const label = PROPOSAL_ACTIVITY_LABELS[act.actionType];
                return (
                  <li key={act.id} className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-semibold text-slate-800">
                        {act.actorName ?? tr('Hệ thống', 'System')}
                      </span>{' '}
                      <span className="text-slate-600">
                        {label ? (locale === 'en' ? label.en : label.vi) : act.actionType}
                      </span>
                    </div>
                    <span className="shrink-0 text-[11px] text-slate-400">
                      {formatDateTimeVN(act.createdAt)}
                    </span>
                  </li>
                );
              })}
            </ol>
          </section>
        </div>
      </div>

      {/* Edit Modal */}
      {isEditOpen && (
        <ProposalFormModal
          isOpen={isEditOpen}
          editingProposal={detail}
          categories={categories}
          branches={branches}
          departments={departments}
          onClose={() => setIsEditOpen(false)}
          onSaved={() => {
            setIsEditOpen(false);
            triggerReload();
          }}
        />
      )}

      {/* Execution / Completion Modal */}
      {executionModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3 className="text-base font-bold text-slate-900">
              {executionModal === 'START_EXECUTION'
                ? tr('Bắt đầu Thực thi Đề xuất', 'Start Proposal Execution')
                : tr('Nghiệm thu & Hoàn tất Đề xuất', 'Complete Proposal')}
            </h3>
            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  {tr('Ngân sách thực tế / đã duyệt (VNĐ)', 'Approved / Actual Budget (VND)')}
                </label>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={approvedBudgetInput}
                  onChange={(e) => setApprovedBudgetInput(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  {tr('Ghi chú triển khai / kết quả nghiệm thu', 'Execution / Completion Notes')}
                </label>
                <textarea
                  rows={3}
                  value={executionNotesInput}
                  onChange={(e) => setExecutionNotesInput(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={isActing}
                  onClick={() => setExecutionModal(null)}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700"
                >
                  {tr('Hủy', 'Cancel')}
                </button>
                <button
                  type="button"
                  disabled={isActing}
                  onClick={() =>
                    void handleStatusAction(executionModal, {
                      approvedBudget:
                        approvedBudgetInput.trim() !== '' ? Number(approvedBudgetInput) : null,
                      executionNotes: executionNotesInput,
                    })
                  }
                  className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {isActing ? tr('Đang lưu...', 'Saving...') : tr('Xác nhận', 'Confirm')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
