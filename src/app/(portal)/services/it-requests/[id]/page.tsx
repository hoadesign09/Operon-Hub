'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  IconArrowLeft,
  IconCheck,
  IconChecklist,
  IconClock,
  IconDeviceLaptop,
  IconDownload,
  IconEdit,
  IconFileTypePdf,
  IconLock,
  IconMessageCircle,
  IconPaperclip,
  IconPlayerPause,
  IconPlayerPlay,
  IconPlus,
  IconRefresh,
  IconRotate,
  IconSend,
  IconShieldCheck,
  IconStar,
  IconStarFilled,
  IconTrash,
  IconUpload,
  IconUserCheck,
  IconX,
} from '@tabler/icons-react';
import type {
  ItRequestCommentType,
  ItRequestCommentVisibility,
  ItRequestKind,
  ItRequestPriority,
  ItRequestStatus,
} from '@/config/database';
import {
  ItRequestFormModal,
  type ItCategoryOption,
} from '@/components/it-requests/ItRequestFormModal';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { formatVND } from '@/lib/portable/currency-utils';
import { formatDateTimeVN } from '@/lib/portable/date-utils';
import type { SlaHealthStatus } from '@/lib/portable/sla-calculator';
import { useI18n } from '@/shared/i18n/I18nContext';

interface ChecklistRow {
  id: number;
  title: string;
  note: string | null;
  isDone: boolean;
  doneByName: string | null;
  doneAt: string | null;
}

interface CommentRow {
  id: number;
  authorUserId: number;
  authorName: string;
  visibility: ItRequestCommentVisibility;
  commentType: ItRequestCommentType;
  content: string;
  createdAt: string;
}

interface AttachmentRow {
  id: number;
  uploadedByName: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  createdAt: string;
  canDelete: boolean;
}

interface ActivityRow {
  id: number;
  actorName: string | null;
  action: string;
  summary: string;
  createdAt: string;
}

interface ApprovalDetail {
  request: {
    id: number;
    currentStep: number;
    totalSteps: number;
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
    currentApproverRoleName: string | null;
    currentApproverRoleNameEn?: string | null;
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
}

interface AssignableStaff {
  id: number;
  fullName: string;
  email: string;
  departmentName: string | null;
  openTicketCount: number;
}

interface ItRequestDetailPayload {
  id: number;
  code: string;
  categoryId: number;
  categoryName: string;
  categoryNameEn: string | null;
  categoryColor: string;
  requiresApproval: boolean;
  requestKind: ItRequestKind;
  title: string;
  description: string;
  priority: ItRequestPriority;
  status: ItRequestStatus;
  requesterName: string;
  branchName: string | null;
  branchNameEn: string | null;
  departmentName: string | null;
  departmentNameEn: string | null;
  assetId: number | null;
  assetCode: string | null;
  assetName: string | null;
  assetSerialNumber: string | null;
  assetCategory: string | null;
  assignedToUserId: number | null;
  assignedToName: string | null;
  estimatedCost: number;
  locationDetail: string | null;
  contactPhone: string | null;
  sla: {
    responseDueAt: string | null;
    resolutionDueAt: string | null;
    firstRespondedAt: string | null;
    pausedAt: string | null;
    pausedMinutes: number;
    responseStatus: SlaHealthStatus;
    resolutionStatus: SlaHealthStatus;
    remainingMinutes: number | null;
    overdueMinutes: number;
  };
  resolutionSummary: string | null;
  rejectionReason: string | null;
  satisfactionRating: number | null;
  satisfactionFeedback: string | null;
  submittedAt: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  checklist: ChecklistRow[];
  activities: ActivityRow[];
  approval: ApprovalDetail | null;
  actions: {
    canEdit: boolean;
    canDelete: boolean;
    canSubmit: boolean;
    canAssign: boolean;
    canStartWork: boolean;
    canWaitUser: boolean;
    canResumeWork: boolean;
    canResolve: boolean;
    canReopen: boolean;
    canClose: boolean;
    canCancel: boolean;
    canComment: boolean;
    canPostInternalNote: boolean;
    canUploadAttachment: boolean;
    canManageChecklist: boolean;
    canExportPdf: boolean;
  };
}

const ERR_LOAD_DETAIL = '__ERR_LOAD_DETAIL__';
const ERR_NETWORK = '__ERR_NETWORK__';

const STATUS_BADGES: Record<ItRequestStatus, { vi: string; en: string; cls: string }> = {
  DRAFT: { vi: 'Nháp', en: 'Draft', cls: 'bg-slate-100 text-slate-600' },
  PENDING_APPROVAL: { vi: 'Chờ phê duyệt', en: 'Pending Approval', cls: 'bg-amber-50 text-amber-700' },
  OPEN: { vi: 'Chờ IT tiếp nhận', en: 'Open', cls: 'bg-sky-50 text-sky-700' },
  IN_PROGRESS: { vi: 'Đang xử lý', en: 'In Progress', cls: 'bg-indigo-50 text-indigo-700' },
  WAITING_USER: { vi: 'Chờ người gửi bổ sung', en: 'Waiting for Requester', cls: 'bg-purple-50 text-purple-700' },
  RESOLVED: { vi: 'Đã xử lý — Chờ nghiệm thu', en: 'Resolved', cls: 'bg-teal-50 text-teal-700' },
  CLOSED: { vi: 'Đã nghiệm thu & Đóng', en: 'Closed', cls: 'bg-emerald-50 text-emerald-700' },
  REJECTED: { vi: 'Từ chối duyệt', en: 'Rejected', cls: 'bg-rose-50 text-rose-700' },
  CANCELLED: { vi: 'Đã hủy', en: 'Cancelled', cls: 'bg-slate-100 text-slate-500' },
};

const PRIORITY_BADGES: Record<ItRequestPriority, { vi: string; en: string; cls: string }> = {
  LOW: { vi: 'Thấp', en: 'Low', cls: 'bg-slate-100 text-slate-600' },
  MEDIUM: { vi: 'Trung bình', en: 'Medium', cls: 'bg-blue-50 text-blue-700' },
  HIGH: { vi: 'Cao', en: 'High', cls: 'bg-orange-50 text-orange-700' },
  URGENT: { vi: 'Khẩn cấp', en: 'Urgent', cls: 'bg-rose-100 text-rose-700' },
};

const SLA_BADGES: Record<SlaHealthStatus, { vi: string; en: string; cls: string }> = {
  ON_TRACK: { vi: 'Đúng hạn SLA', en: 'SLA On Track', cls: 'bg-emerald-50 text-emerald-700' },
  AT_RISK: { vi: 'Sắp quá hạn SLA', en: 'SLA At Risk', cls: 'bg-amber-50 text-amber-700' },
  BREACHED: { vi: 'Quá hạn SLA', en: 'SLA Breached', cls: 'bg-rose-100 text-rose-700' },
  MET: { vi: 'Đạt cam kết SLA', en: 'SLA Met', cls: 'bg-teal-50 text-teal-700' },
  PAUSED: { vi: 'Tạm dừng SLA', en: 'SLA Paused', cls: 'bg-purple-50 text-purple-700' },
  NONE: { vi: 'Chưa kích hoạt', en: 'Not Active', cls: 'bg-slate-100 text-slate-500' },
};

const APPROVAL_ACTION_LABELS: Record<string, { vi: string; en: string }> = {
  SUBMIT: { vi: 'Gửi duyệt', en: 'Submitted' },
  APPROVE: { vi: 'Phê duyệt', en: 'Approved' },
  REJECT: { vi: 'Từ chối', en: 'Rejected' },
  CANCEL: { vi: 'Hủy bỏ', en: 'Cancelled' },
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function ItRequestDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { locale, tr, ln } = useI18n();
  const isEn = locale === 'en';
  const ticketId = Number(params?.id);
  const isValidTicketId = Number.isInteger(ticketId) && ticketId > 0;

  const [viewState, setViewState] = useState<'loading' | 'success' | 'error'>(
    isValidTicketId ? 'loading' : 'error',
  );
  const [errorCode, setErrorCode] = useState(isValidTicketId ? '' : ERR_LOAD_DETAIL);
  const [actionError, setActionError] = useState('');
  const [detail, setDetail] = useState<ItRequestDetailPayload | null>(null);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [attachments, setAttachments] = useState<AttachmentRow[]>([]);
  const [categories, setCategories] = useState<ItCategoryOption[]>([]);
  const [staff, setStaff] = useState<AssignableStaff[]>([]);
  const [reloadTick, setReloadTick] = useState(0);

  const [isActing, setIsActing] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  // Checklist input
  const [newChecklistTitle, setNewChecklistTitle] = useState('');
  const [isSavingChecklist, setIsSavingChecklist] = useState(false);

  // Comment composer
  const [commentText, setCommentText] = useState('');
  const [commentVisibility, setCommentVisibility] =
    useState<ItRequestCommentVisibility>('PUBLIC');
  const [isPostingComment, setIsPostingComment] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Status modal state (WAIT_USER / RESOLVE / REOPEN / CLOSE / CANCEL)
  const [statusModal, setStatusModal] = useState<
    null | 'WAIT_USER' | 'RESOLVE' | 'REOPEN' | 'CLOSE' | 'CANCEL'
  >(null);
  const [statusNote, setStatusNote] = useState('');
  const [csatRating, setCsatRating] = useState<number>(5);

  // Inline Core Approval action
  const [approvalComment, setApprovalComment] = useState('');

  useEffect(() => {
    if (!isValidTicketId) {
      return;
    }

    const controller = new AbortController();
    Promise.all([
      fetch(`/api/v1/it-requests/${ticketId}`, { cache: 'no-store', signal: controller.signal }),
      fetch(`/api/v1/it-requests/${ticketId}/comments`, {
        cache: 'no-store',
        signal: controller.signal,
      }),
      fetch(`/api/v1/it-requests/${ticketId}/attachments`, {
        cache: 'no-store',
        signal: controller.signal,
      }),
      fetch('/api/v1/it-requests/categories?includeInactive=true', {
        cache: 'no-store',
        signal: controller.signal,
      }),
      fetch('/api/v1/it-requests/assignable-staff', {
        cache: 'no-store',
        signal: controller.signal,
      }),
    ])
      .then(async ([dRes, cRes, aRes, catRes, stRes]) => {
        if (controller.signal.aborted) return;
        const [dJson, cJson, aJson, catJson, stJson] = await Promise.all([
          dRes.json().catch(() => null),
          cRes.json().catch(() => null),
          aRes.json().catch(() => null),
          catRes.json().catch(() => null),
          stRes.json().catch(() => null),
        ]);
        if (!dRes.ok || !dJson?.success || !dJson.data) {
          setErrorCode(dJson?.error?.message ?? ERR_LOAD_DETAIL);
          setViewState('error');
          return;
        }
        setDetail(dJson.data as ItRequestDetailPayload);
        if (cRes.ok && cJson?.success) setComments((cJson.data ?? []) as CommentRow[]);
        if (aRes.ok && aJson?.success) setAttachments((aJson.data ?? []) as AttachmentRow[]);
        if (catRes.ok && catJson?.success) setCategories((catJson.data ?? []) as ItCategoryOption[]);
        if (stRes.ok && stJson?.success) setStaff((stJson.data ?? []) as AssignableStaff[]);
        setErrorCode('');
        setViewState('success');
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setErrorCode(ERR_NETWORK);
        setViewState('error');
      });

    return () => controller.abort();
  }, [ticketId, isValidTicketId, reloadTick]);

  function reload() {
    setActionError('');
    setReloadTick((t) => t + 1);
  }

  async function runSimplePost(url: string, body?: Record<string, unknown>) {
    if (isActing) return;
    setIsActing(true);
    setActionError('');
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = (await res.json().catch(() => null)) as {
        success?: boolean;
        error?: { message?: string };
      } | null;
      if (!res.ok || !json?.success) {
        setActionError(
          json?.error?.message ??
            tr('Không thể thực hiện thao tác.', 'Unable to complete action.'),
        );
        return;
      }
      setStatusModal(null);
      setStatusNote('');
      setApprovalComment('');
      reload();
    } finally {
      setIsActing(false);
    }
  }

  async function handleAssignChange(nextUserIdStr: string) {
    const nextUserId = nextUserIdStr ? Number(nextUserIdStr) : null;
    await runSimplePost(`/api/v1/it-requests/${ticketId}/assign`, {
      assignedToUserId: nextUserId,
      startImmediately: Boolean(nextUserId && detail?.status === 'OPEN'),
    });
  }

  async function handleStatusModalSubmit(e: FormEvent) {
    e.preventDefault();
    if (!statusModal) return;
    const payload: Record<string, unknown> = { action: statusModal };
    if (statusModal === 'RESOLVE') {
      payload.resolutionSummary = statusNote.trim();
    } else if (statusModal === 'CLOSE') {
      payload.satisfactionRating = csatRating;
      payload.satisfactionFeedback = statusNote.trim() || null;
    } else {
      payload.note = statusNote.trim() || null;
    }
    await runSimplePost(`/api/v1/it-requests/${ticketId}/status`, payload);
  }

  async function handleApprovalDecision(action: 'APPROVE' | 'REJECT') {
    if (!detail?.approval) return;
    if (action === 'REJECT' && approvalComment.trim().length === 0) {
      setActionError(tr('Vui lòng nhập lý do từ chối phê duyệt.', 'Please provide a rejection reason.'));
      return;
    }
    await runSimplePost(`/api/v1/approvals/${detail.approval.request.id}/action`, {
      action,
      comment: approvalComment.trim() || null,
    });
  }

  async function handleAddChecklist(e: FormEvent) {
    e.preventDefault();
    if (!newChecklistTitle.trim() || isSavingChecklist) return;
    setIsSavingChecklist(true);
    setActionError('');
    try {
      const res = await fetch(`/api/v1/it-requests/${ticketId}/checklist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newChecklistTitle.trim() }),
      });
      const json = (await res.json().catch(() => null)) as {
        success?: boolean;
        data?: ChecklistRow[];
        error?: { message?: string };
      } | null;
      if (!res.ok || !json?.success) {
        setActionError(
          json?.error?.message ??
            tr('Không thể thêm bước xử lý.', 'Unable to add checklist step.'),
        );
        return;
      }
      setNewChecklistTitle('');
      if (detail && json.data) {
        setDetail({ ...detail, checklist: json.data });
      }
    } finally {
      setIsSavingChecklist(false);
    }
  }

  async function handleToggleChecklist(item: ChecklistRow) {
    const res = await fetch(`/api/v1/it-requests/${ticketId}/checklist/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isDone: !item.isDone }),
    });
    const json = (await res.json().catch(() => null)) as {
      success?: boolean;
      data?: ChecklistRow[];
    } | null;
    if (res.ok && json?.success && detail && json.data) {
      setDetail({ ...detail, checklist: json.data });
    }
  }

  async function handleDeleteChecklist(itemId: number) {
    const res = await fetch(`/api/v1/it-requests/${ticketId}/checklist/${itemId}`, {
      method: 'DELETE',
    });
    const json = (await res.json().catch(() => null)) as {
      success?: boolean;
      data?: ChecklistRow[];
    } | null;
    if (res.ok && json?.success && detail && json.data) {
      setDetail({ ...detail, checklist: json.data });
    }
  }

  async function handlePostComment(e: FormEvent) {
    e.preventDefault();
    if (!commentText.trim() || isPostingComment) return;
    setIsPostingComment(true);
    setActionError('');
    try {
      const res = await fetch(`/api/v1/it-requests/${ticketId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: commentText.trim(),
          visibility: detail?.actions.canPostInternalNote ? commentVisibility : 'PUBLIC',
        }),
      });
      const json = (await res.json().catch(() => null)) as {
        success?: boolean;
        data?: CommentRow[];
        error?: { message?: string };
      } | null;
      if (!res.ok || !json?.success) {
        setActionError(
          json?.error?.message ?? tr('Không thể gửi bình luận.', 'Unable to post comment.'),
        );
        return;
      }
      setCommentText('');
      setComments(json.data ?? []);
      reload();
    } finally {
      setIsPostingComment(false);
    }
  }

  async function handleUploadAttachment(file: File | null) {
    if (!file || isUploading) return;
    setIsUploading(true);
    setActionError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`/api/v1/it-requests/${ticketId}/attachments`, {
        method: 'POST',
        body: fd,
      });
      const json = (await res.json().catch(() => null)) as {
        success?: boolean;
        data?: AttachmentRow[];
        error?: { message?: string };
      } | null;
      if (!res.ok || !json?.success) {
        setActionError(
          json?.error?.message ?? tr('Không thể tải tệp đính kèm.', 'Unable to upload attachment.'),
        );
        return;
      }
      setAttachments(json.data ?? []);
      reload();
    } finally {
      setIsUploading(false);
    }
  }

  async function handleDeleteAttachment(attachmentId: number) {
    const res = await fetch(`/api/v1/it-requests/${ticketId}/attachments/${attachmentId}`, {
      method: 'DELETE',
    });
    const json = (await res.json().catch(() => null)) as {
      success?: boolean;
      data?: AttachmentRow[];
    } | null;
    if (res.ok && json?.success) {
      setAttachments(json.data ?? []);
    }
  }

  async function handleExportPdf() {
    if (!detail || isExportingPdf) return;
    setIsExportingPdf(true);
    try {
      const res = await fetch(`/api/v1/it-requests/${detail.id}/pdf`);
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${detail.code}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsExportingPdf(false);
    }
  }

  async function handleDeleteTicket() {
    if (!detail || isActing) return;
    setIsActing(true);
    try {
      const res = await fetch(`/api/v1/it-requests/${detail.id}`, { method: 'DELETE' });
      if (res.ok) {
        router.push('/services/it-requests');
      }
    } finally {
      setIsActing(false);
      setConfirmDeleteOpen(false);
    }
  }

  if (viewState === 'loading') {
    return (
      <div className="w-full space-y-4">
        <div className="h-28 animate-pulse rounded-2xl bg-slate-200" />
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <div className="h-96 animate-pulse rounded-2xl bg-slate-100 lg:col-span-8" />
          <div className="h-96 animate-pulse rounded-2xl bg-slate-100 lg:col-span-4" />
        </div>
      </div>
    );
  }

  if (viewState === 'error' || !detail) {
    const msg =
      errorCode === ERR_LOAD_DETAIL
        ? tr('Không tìm thấy hoặc không thể tải hồ sơ yêu cầu IT.', 'Unable to load IT ticket dossier.')
        : errorCode === ERR_NETWORK
          ? tr('Lỗi kết nối máy chủ.', 'Server connection error.')
          : errorCode;

    return (
      <div className="w-full rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center">
        <p className="text-sm font-semibold text-rose-700">{msg}</p>
        <div className="mt-4 flex justify-center gap-2">
          <Link
            href="/services/it-requests"
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700"
          >
            {tr('Quay lại danh sách', 'Back to List')}
          </Link>
          <button
            type="button"
            onClick={reload}
            className="inline-flex items-center gap-1 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white"
          >
            <IconRefresh size={14} />
            <span>{tr('Thử lại', 'Retry')}</span>
          </button>
        </div>
      </div>
    );
  }

  const stBadge = STATUS_BADGES[detail.status];
  const prBadge = PRIORITY_BADGES[detail.priority];
  const slaBadge = SLA_BADGES[detail.sla.resolutionStatus];
  const isCollabLocked = !detail.actions.canComment;
  const doneChecklistCount = detail.checklist.filter((c) => c.isDone).length;

  return (
    <div className="w-full space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href="/services/it-requests"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-indigo-600"
        >
          <IconArrowLeft size={15} />
          <span>{tr('Quay lại danh sách Yêu cầu IT', 'Back to IT Requests')}</span>
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          {detail.actions.canExportPdf && (
            <button
              type="button"
              disabled={isExportingPdf}
              onClick={() => void handleExportPdf()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <IconFileTypePdf size={15} className="text-rose-600" />
              <span>
                {isExportingPdf ? tr('Đang tạo PDF...', 'Generating PDF...') : tr('Xuất PDF', 'Export PDF')}
              </span>
            </button>
          )}
          {detail.actions.canEdit && (
            <button
              type="button"
              onClick={() => setIsEditOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <IconEdit size={15} />
              <span>{tr('Chỉnh sửa', 'Edit')}</span>
            </button>
          )}
          {detail.actions.canDelete && (
            <button
              type="button"
              onClick={() => setConfirmDeleteOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
            >
              <IconTrash size={15} />
              <span>{tr('Xóa', 'Delete')}</span>
            </button>
          )}
        </div>
      </div>

      {actionError && (
        <div className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-medium text-rose-700">
          <span>{actionError}</span>
          <button type="button" onClick={() => setActionError('')} className="text-rose-500">
            <IconX size={15} />
          </button>
        </div>
      )}

      {/* Ticket Header Card */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-lg bg-indigo-50 px-2.5 py-1 font-mono text-xs font-bold text-indigo-700">
                {detail.code}
              </span>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${stBadge.cls}`}>
                {isEn ? stBadge.en : stBadge.vi}
              </span>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${prBadge.cls}`}>
                {isEn ? prBadge.en : prBadge.vi}
              </span>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${slaBadge.cls}`}
              >
                <IconClock size={13} />
                <span>{isEn ? slaBadge.en : slaBadge.vi}</span>
              </span>
            </div>
            <h1 className="text-xl font-bold text-slate-900">{detail.title}</h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: detail.categoryColor }}
                />
                {ln(detail.categoryName, detail.categoryNameEn)}
              </span>
              <span>
                {tr('Người gửi', 'Requester')}: <strong className="text-slate-700">{detail.requesterName}</strong>
              </span>
              {detail.branchName && <span>{ln(detail.branchName, detail.branchNameEn)}</span>}
              <span>
                {tr('Tạo lúc', 'Created')}: {formatDateTimeVN(detail.createdAt)}
              </span>
            </div>
          </div>

          {/* Primary Lifecycle Actions */}
          <div className="flex flex-wrap items-center gap-2">
            {detail.actions.canSubmit && (
              <button
                type="button"
                disabled={isActing}
                onClick={() => void runSimplePost(`/api/v1/it-requests/${detail.id}/submit`)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                <IconSend size={15} />
                <span>
                  {detail.requiresApproval
                    ? tr('Gửi Phê duyệt', 'Submit for Approval')
                    : tr('Gửi vào hàng đợi IT', 'Submit to IT Queue')}
                </span>
              </button>
            )}
            {detail.actions.canStartWork && (
              <button
                type="button"
                disabled={isActing}
                onClick={() =>
                  void runSimplePost(`/api/v1/it-requests/${detail.id}/status`, {
                    action: 'START_WORK',
                  })
                }
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                <IconPlayerPlay size={15} />
                <span>{tr('Bắt đầu xử lý', 'Start Working')}</span>
              </button>
            )}
            {detail.actions.canWaitUser && (
              <button
                type="button"
                disabled={isActing}
                onClick={() => {
                  setStatusNote('');
                  setStatusModal('WAIT_USER');
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-purple-200 bg-purple-50 px-3.5 py-2 text-xs font-semibold text-purple-700 hover:bg-purple-100 disabled:opacity-50"
              >
                <IconPlayerPause size={15} />
                <span>{tr('Chờ người gửi (Tạm dừng SLA)', 'Wait Requester (Pause SLA)')}</span>
              </button>
            )}
            {detail.actions.canResumeWork && (
              <button
                type="button"
                disabled={isActing}
                onClick={() =>
                  void runSimplePost(`/api/v1/it-requests/${detail.id}/status`, {
                    action: 'RESUME_WORK',
                  })
                }
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                <IconPlayerPlay size={15} />
                <span>{tr('Tiếp tục xử lý', 'Resume Work')}</span>
              </button>
            )}
            {detail.actions.canResolve && (
              <button
                type="button"
                disabled={isActing}
                onClick={() => {
                  setStatusNote(detail.resolutionSummary ?? '');
                  setStatusModal('RESOLVE');
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
              >
                <IconCheck size={15} />
                <span>{tr('Đánh dấu Đã xử lý', 'Mark Resolved')}</span>
              </button>
            )}
            {detail.actions.canClose && (
              <button
                type="button"
                disabled={isActing}
                onClick={() => {
                  setStatusNote('');
                  setCsatRating(5);
                  setStatusModal('CLOSE');
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                <IconCheck size={15} />
                <span>{tr('Nghiệm thu & Đóng', 'Accept & Close')}</span>
              </button>
            )}
            {detail.actions.canReopen && (
              <button
                type="button"
                disabled={isActing}
                onClick={() => {
                  setStatusNote('');
                  setStatusModal('REOPEN');
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50"
              >
                <IconRotate size={15} />
                <span>{tr('Mở lại', 'Reopen')}</span>
              </button>
            )}
            {detail.actions.canCancel && (
              <button
                type="button"
                disabled={isActing}
                onClick={() => {
                  setStatusNote('');
                  setStatusModal('CANCEL');
                }}
                className="rounded-xl border border-rose-200 px-3.5 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
              >
                {tr('Hủy yêu cầu', 'Cancel Ticket')}
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Main 2-Column Content */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Left Main Column */}
        <div className="space-y-5 lg:col-span-8">
          {/* Description & Resolution */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
            <h2 className="text-sm font-bold text-slate-900">
              {tr('Nội dung Yêu cầu / Mô tả Sự cố', 'Request Description & Incident Details')}
            </h2>
            <p className="mt-2.5 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
              {detail.description}
            </p>

            {detail.assetCode && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
                    <IconDeviceLaptop size={18} />
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900">
                      {detail.assetCode} — {detail.assetName}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {detail.assetSerialNumber
                        ? `Serial: ${detail.assetSerialNumber}`
                        : (detail.assetCategory ?? tr('Tài sản công ty', 'Company Asset'))}
                    </div>
                  </div>
                </div>
                <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200">
                  {tr('Liên kết Kho Tài sản', 'Linked Company Asset')}
                </span>
              </div>
            )}

            {detail.resolutionSummary && (
              <div className="mt-4 rounded-xl border border-teal-200 bg-teal-50/70 p-4">
                <div className="text-xs font-bold text-teal-800">
                  {tr('Kết quả xử lý từ bộ phận IT', 'IT Resolution Summary')}
                </div>
                <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-teal-900">
                  {detail.resolutionSummary}
                </p>
              </div>
            )}

            {detail.rejectionReason && (
              <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4">
                <div className="text-xs font-bold text-rose-800">
                  {tr('Lý do từ chối phê duyệt', 'Approval Rejection Reason')}
                </div>
                <p className="mt-1 text-xs text-rose-900">{detail.rejectionReason}</p>
              </div>
            )}
          </section>

          {/* Technical Checklist */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
            <div className="flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <IconChecklist size={17} className="text-indigo-600" />
                <span>{tr('Checklist Xử lý Kỹ thuật', 'Technical Resolution Checklist')}</span>
              </h2>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700">
                {doneChecklistCount}/{detail.checklist.length} {tr('hoàn thành', 'done')}
              </span>
            </div>

            {detail.checklist.length === 0 ? (
              <p className="mt-3 text-xs text-slate-500">
                {tr('Chưa có bước xử lý kỹ thuật nào.', 'No technical checklist steps yet.')}
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {detail.checklist.map((ck) => (
                  <li
                    key={ck.id}
                    className="flex items-start justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/70 px-3.5 py-2.5 text-xs"
                  >
                    <label className="flex flex-1 cursor-pointer items-start gap-2.5">
                      <input
                        type="checkbox"
                        checked={ck.isDone}
                        disabled={!detail.actions.canManageChecklist}
                        onChange={() => void handleToggleChecklist(ck)}
                        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 disabled:cursor-not-allowed"
                      />
                      <div>
                        <div
                          className={`font-medium ${
                            ck.isDone ? 'text-slate-400 line-through' : 'text-slate-800'
                          }`}
                        >
                          {ck.title}
                        </div>
                        {ck.isDone && ck.doneByName && (
                          <div className="mt-0.5 text-[11px] text-slate-400">
                            {ck.doneByName} {ck.doneAt ? `• ${formatDateTimeVN(ck.doneAt)}` : ''}
                          </div>
                        )}
                      </div>
                    </label>
                    {detail.actions.canManageChecklist && (
                      <button
                        type="button"
                        onClick={() => void handleDeleteChecklist(ck.id)}
                        className="rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                      >
                        <IconTrash size={14} />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {detail.actions.canManageChecklist && (
              <form onSubmit={(e) => void handleAddChecklist(e)} className="mt-3 flex gap-2">
                <input
                  type="text"
                  value={newChecklistTitle}
                  onChange={(e) => setNewChecklistTitle(e.target.value)}
                  placeholder={tr(
                    'Thêm bước kiểm tra / cấu hình kỹ thuật...',
                    'Add a technical step...',
                  )}
                  className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-xs outline-none focus:border-indigo-500"
                />
                <button
                  type="submit"
                  disabled={isSavingChecklist || !newChecklistTitle.trim()}
                  className="inline-flex items-center gap-1 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  <IconPlus size={14} />
                  <span>{tr('Thêm', 'Add')}</span>
                </button>
              </form>
            )}
          </section>

          {/* Attachments */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <IconPaperclip size={17} className="text-indigo-600" />
                <span>
                  {tr('Ảnh chụp lỗi & Tệp đính kèm', 'Screenshots & Attachments')} ({attachments.length})
                </span>
              </h2>

              {detail.actions.canUploadAttachment ? (
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100">
                  <IconUpload size={14} />
                  <span>
                    {isUploading ? tr('Đang tải lên...', 'Uploading...') : tr('Tải tệp lên', 'Upload File')}
                  </span>
                  <input
                    type="file"
                    disabled={isUploading}
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null;
                      e.target.value = '';
                      void handleUploadAttachment(file);
                    }}
                  />
                </label>
              ) : (
                isCollabLocked && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-500">
                    <IconLock size={12} />
                    <span>{tr('Đã khóa tải tệp (Ticket đã kết thúc)', 'Uploads locked (Ticket ended)')}</span>
                  </span>
                )
              )}
            </div>

            {attachments.length === 0 ? (
              <p className="mt-3 text-xs text-slate-500">
                {tr('Chưa có tệp đính kèm nào.', 'No attachments uploaded yet.')}
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-100">
                {attachments.map((att) => (
                  <li key={att.id} className="flex items-center justify-between gap-2 px-3.5 py-2.5 text-xs">
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-slate-800">{att.fileName}</div>
                      <div className="text-[11px] text-slate-400">
                        {formatFileSize(att.fileSizeBytes)} • {att.uploadedByName} •{' '}
                        {formatDateTimeVN(att.createdAt)}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <a
                        href={`/api/v1/it-requests/${detail.id}/attachments/${att.id}`}
                        className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50 hover:text-indigo-600"
                        title={tr('Tải xuống', 'Download')}
                      >
                        <IconDownload size={14} />
                      </a>
                      {att.canDelete && (
                        <button
                          type="button"
                          onClick={() => void handleDeleteAttachment(att.id)}
                          className="rounded-lg border border-rose-200 p-1.5 text-rose-600 hover:bg-rose-50"
                          title={tr('Xóa mềm', 'Delete')}
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

          {/* Comments (Public + Internal Notes) */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <IconMessageCircle size={17} className="text-indigo-600" />
                <span>
                  {tr('Trao đổi & Ghi chú Xử lý', 'Discussion & Technical Notes')} ({comments.length})
                </span>
              </h2>
              {isCollabLocked && (
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-500">
                  <IconLock size={12} />
                  <span>{tr('Đã khóa bình luận', 'Comments locked')}</span>
                </span>
              )}
            </div>

            {comments.length === 0 ? (
              <p className="mt-3 text-xs text-slate-500">
                {tr('Chưa có trao đổi nào trên yêu cầu này.', 'No comments yet.')}
              </p>
            ) : (
              <div className="mt-3 space-y-2.5">
                {comments.map((cm) => {
                  const isInternal = cm.visibility === 'INTERNAL_NOTE';
                  return (
                    <div
                      key={cm.id}
                      className={`rounded-xl border p-3.5 text-xs ${
                        isInternal
                          ? 'border-amber-200 bg-amber-50/70'
                          : cm.commentType === 'RESOLUTION'
                            ? 'border-teal-200 bg-teal-50/60'
                            : 'border-slate-100 bg-slate-50/70'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">{cm.authorName}</span>
                          {isInternal && (
                            <span className="rounded-full bg-amber-200/80 px-2 py-0.5 text-[10px] font-bold text-amber-900">
                              {tr('Ghi chú nội bộ IT', 'IT Internal Note')}
                            </span>
                          )}
                          {cm.commentType === 'RESOLUTION' && (
                            <span className="rounded-full bg-teal-200/80 px-2 py-0.5 text-[10px] font-bold text-teal-900">
                              {tr('Kết quả xử lý', 'Resolution')}
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-400">
                          {formatDateTimeVN(cm.createdAt)}
                        </span>
                      </div>
                      <p className="mt-1.5 whitespace-pre-wrap leading-relaxed text-slate-700">
                        {cm.content}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}

            {detail.actions.canComment ? (
              <form onSubmit={(e) => void handlePostComment(e)} className="mt-4 space-y-2.5 border-t border-slate-100 pt-4">
                {detail.actions.canPostInternalNote && (
                  <div className="flex items-center gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setCommentVisibility('PUBLIC')}
                      className={`rounded-lg px-2.5 py-1 font-semibold ${
                        commentVisibility === 'PUBLIC'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {tr('Phản hồi công khai', 'Public Reply')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setCommentVisibility('INTERNAL_NOTE')}
                      className={`rounded-lg px-2.5 py-1 font-semibold ${
                        commentVisibility === 'INTERNAL_NOTE'
                          ? 'bg-amber-600 text-white'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {tr('Ghi chú nội bộ IT', 'Internal IT Note')}
                    </button>
                  </div>
                )}

                <textarea
                  rows={3}
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder={
                    commentVisibility === 'INTERNAL_NOTE'
                      ? tr('Ghi chú kỹ thuật chỉ hiển thị với đội ngũ IT...', 'Technical note visible to IT staff only...')
                      : tr('Nhập nội dung trao đổi hoặc phản hồi...', 'Write a reply or update...')
                  }
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs outline-none focus:border-indigo-500"
                />
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isPostingComment || !commentText.trim()}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    <IconSend size={14} />
                    <span>
                      {isPostingComment ? tr('Đang gửi...', 'Posting...') : tr('Gửi bình luận', 'Post Comment')}
                    </span>
                  </button>
                </div>
              </form>
            ) : (
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-500">
                <IconLock size={14} />
                <span>
                  {tr(
                    'Ticket đã kết thúc nên hệ thống tự động khóa tính năng bình luận và đính kèm tệp mới.',
                    'This ticket has ended; commenting and new file uploads are locked.',
                  )}
                </span>
              </div>
            )}
          </section>
        </div>

        {/* Right Sidebar Column */}
        <div className="space-y-5 lg:col-span-4">
          {/* Assignment & Metadata */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
            <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <IconUserCheck size={17} className="text-indigo-600" />
              <span>{tr('Điều phối & Thông tin chung', 'Assignment & Metadata')}</span>
            </h2>

            <div className="mt-3.5 space-y-3 text-xs">
              <div>
                <label className="mb-1 block font-semibold text-slate-600">
                  {tr('Kỹ thuật viên IT phụ trách', 'Assigned IT Technician')}
                </label>
                {detail.actions.canAssign ? (
                  <select
                    disabled={isActing}
                    value={detail.assignedToUserId ?? ''}
                    onChange={(e) => void handleAssignChange(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-indigo-500"
                  >
                    <option value="">{tr('-- Chưa phân công --', '-- Unassigned --')}</option>
                    {staff.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.fullName} ({st.openTicketCount} {tr('đang mở', 'open')})
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="rounded-xl bg-slate-50 px-3 py-2 font-semibold text-slate-800">
                    {detail.assignedToName ?? tr('Chưa phân công', 'Unassigned')}
                  </div>
                )}
              </div>

              <dl className="divide-y divide-slate-100">
                <div className="flex justify-between gap-2 py-2">
                  <dt className="text-slate-500">{tr('Phòng ban', 'Department')}</dt>
                  <dd className="text-right font-medium text-slate-800">
                    {detail.departmentName ? ln(detail.departmentName, detail.departmentNameEn) : '—'}
                  </dd>
                </div>
                <div className="flex justify-between gap-2 py-2">
                  <dt className="text-slate-500">{tr('Vị trí chỗ ngồi', 'Location')}</dt>
                  <dd className="text-right font-medium text-slate-800">
                    {detail.locationDetail ?? '—'}
                  </dd>
                </div>
                <div className="flex justify-between gap-2 py-2">
                  <dt className="text-slate-500">{tr('Điện thoại', 'Phone')}</dt>
                  <dd className="text-right font-medium text-slate-800">
                    {detail.contactPhone ?? '—'}
                  </dd>
                </div>
                {detail.estimatedCost > 0 && (
                  <div className="flex justify-between gap-2 py-2">
                    <dt className="text-slate-500">{tr('Chi phí dự kiến', 'Estimated Cost')}</dt>
                    <dd className="text-right font-bold text-indigo-700">
                      {formatVND(detail.estimatedCost)}
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          </section>

          {/* SLA Tracker Card */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
            <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <IconClock size={17} className="text-indigo-600" />
              <span>{tr('Theo dõi Cam kết SLA', 'SLA Compliance Tracker')}</span>
            </h2>
            <dl className="mt-3 divide-y divide-slate-100 text-xs">
              <div className="flex justify-between gap-2 py-2">
                <dt className="text-slate-500">{tr('Hạn phản hồi đầu tiên', 'Response Due')}</dt>
                <dd className="text-right font-medium text-slate-800">
                  {detail.sla.responseDueAt ? formatDateTimeVN(detail.sla.responseDueAt) : '—'}
                </dd>
              </div>
              <div className="flex justify-between gap-2 py-2">
                <dt className="text-slate-500">{tr('Phản hồi thực tế', 'First Response')}</dt>
                <dd className="text-right font-medium text-slate-800">
                  {detail.sla.firstRespondedAt ? formatDateTimeVN(detail.sla.firstRespondedAt) : '—'}
                </dd>
              </div>
              <div className="flex justify-between gap-2 py-2">
                <dt className="text-slate-500">{tr('Hạn xử lý hoàn tất', 'Resolution Due')}</dt>
                <dd className="text-right font-semibold text-slate-900">
                  {detail.sla.resolutionDueAt ? formatDateTimeVN(detail.sla.resolutionDueAt) : '—'}
                </dd>
              </div>
              <div className="flex justify-between gap-2 py-2">
                <dt className="text-slate-500">{tr('Thời gian tạm dừng SLA', 'SLA Paused Time')}</dt>
                <dd className="text-right font-medium text-purple-700">
                  {detail.sla.pausedMinutes} {tr('phút', 'mins')}
                </dd>
              </div>
              {detail.resolvedAt && (
                <div className="flex justify-between gap-2 py-2">
                  <dt className="text-slate-500">{tr('Hoàn tất xử lý', 'Resolved At')}</dt>
                  <dd className="text-right font-medium text-teal-700">
                    {formatDateTimeVN(detail.resolvedAt)}
                  </dd>
                </div>
              )}
            </dl>
          </section>

          {/* CSAT Card */}
          {detail.satisfactionRating !== null && (
            <section className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5">
              <h2 className="text-sm font-bold text-emerald-900">
                {tr('Đánh giá Nghiệm thu (CSAT)', 'Requester Satisfaction (CSAT)')}
              </h2>
              <div className="mt-2 flex items-center gap-1 text-amber-500">
                {[1, 2, 3, 4, 5].map((star) =>
                  star <= (detail.satisfactionRating ?? 0) ? (
                    <IconStarFilled key={star} size={18} />
                  ) : (
                    <IconStar key={star} size={18} className="text-slate-300" />
                  ),
                )}
                <span className="ml-1.5 text-sm font-bold text-emerald-900">
                  {detail.satisfactionRating}/5
                </span>
              </div>
              {detail.satisfactionFeedback && (
                <p className="mt-2 text-xs text-emerald-800">{detail.satisfactionFeedback}</p>
              )}
            </section>
          )}

          {/* Activity Timeline */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
            <h2 className="text-sm font-bold text-slate-900">
              {tr('Nhật ký Hoạt động', 'Activity Audit Trail')}
            </h2>
            <ol className="mt-3 space-y-2.5 border-l-2 border-slate-200 pl-3.5 text-xs">
              {detail.activities.map((act) => (
                <li key={act.id}>
                  <div className="font-semibold text-slate-800">{act.summary}</div>
                  <div className="text-[11px] text-slate-400">
                    {act.actorName ?? tr('Hệ thống', 'System')} • {formatDateTimeVN(act.createdAt)}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>

      {/* FULL-WIDTH BOTTOM APPROVAL WORKFLOW SECTION (Core Approval Engine) */}
      {(detail.approval || detail.requiresApproval) && (
        <section className="w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
            <div className="flex items-center gap-2">
              <IconShieldCheck size={19} className="text-indigo-600" />
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  {tr('Luồng Phê duyệt (Core Approval Engine)', 'Approval Workflow (Core Approval Engine)')}
                </h2>
                <p className="text-xs text-slate-500">
                  {detail.approval
                    ? tr(
                        `Tiến độ: Bước ${detail.approval.request.currentStep}/${detail.approval.request.totalSteps}`,
                        `Progress: Step ${detail.approval.request.currentStep}/${detail.approval.request.totalSteps}`,
                      )
                    : tr(
                        'Danh mục này yêu cầu phê duyệt trước khi chuyển vào hàng đợi xử lý của IT.',
                        'This category requires approval before entering the IT queue.',
                      )}
                </p>
              </div>
            </div>

            {detail.approval && (
              <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                {detail.approval.request.status}
                {detail.approval.request.currentApproverRoleName
                  ? ` • ${ln(
                      detail.approval.request.currentApproverRoleName,
                      detail.approval.request.currentApproverRoleNameEn,
                    )}`
                  : ''}
              </span>
            )}
          </div>

          {detail.approval?.canApproveOrReject && (
            <div className="mt-4 flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50/70 p-4 lg:flex-row lg:items-center">
              <input
                type="text"
                value={approvalComment}
                onChange={(e) => setApprovalComment(e.target.value)}
                placeholder={tr(
                  'Nhập nhận xét phê duyệt (bắt buộc nếu Từ chối)...',
                  'Enter approval note (required for rejection)...',
                )}
                className="flex-1 rounded-xl border border-amber-300 bg-white px-3.5 py-2 text-xs outline-none focus:border-indigo-500"
              />
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  disabled={isActing}
                  onClick={() => void handleApprovalDecision('REJECT')}
                  className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
                >
                  {tr('Từ chối', 'Reject')}
                </button>
                <button
                  type="button"
                  disabled={isActing}
                  onClick={() => void handleApprovalDecision('APPROVE')}
                  className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  <IconCheck size={15} />
                  <span>{tr('Phê duyệt', 'Approve')}</span>
                </button>
              </div>
            </div>
          )}

          {detail.approval && detail.approval.histories.length > 0 && (
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {detail.approval.histories.map((h) => {
                const actLbl = APPROVAL_ACTION_LABELS[h.action] ?? { vi: h.action, en: h.action };
                return (
                  <div
                    key={h.id}
                    className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-slate-900">
                        {tr('Bước', 'Step')} {h.stepOrder} — {isEn ? actLbl.en : actLbl.vi}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {formatDateTimeVN(h.actedAt)}
                      </span>
                    </div>
                    <div className="mt-1 font-medium text-indigo-700">
                      {h.actorName ?? tr('Hệ thống', 'System')}
                    </div>
                    {h.comment && <p className="mt-1 text-slate-600">{h.comment}</p>}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Status Action Modal */}
      {statusModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                {statusModal === 'WAIT_USER'
                  ? tr('Chờ người gửi bổ sung thông tin', 'Wait for Requester Info')
                  : statusModal === 'RESOLVE'
                    ? tr('Xác nhận Đã xử lý Ticket', 'Mark Ticket as Resolved')
                    : statusModal === 'REOPEN'
                      ? tr('Mở lại Yêu cầu IT', 'Reopen IT Ticket')
                      : statusModal === 'CLOSE'
                        ? tr('Nghiệm thu & Đánh giá CSAT', 'Accept Resolution & Rate CSAT')
                        : tr('Xác nhận Hủy Yêu cầu IT', 'Cancel IT Ticket')}
              </h3>
              <button
                type="button"
                disabled={isActing}
                onClick={() => setStatusModal(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <IconX size={18} />
              </button>
            </div>

            <form onSubmit={(e) => void handleStatusModalSubmit(e)} className="mt-4 space-y-4">
              {statusModal === 'CLOSE' && (
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                    {tr('Mức độ hài lòng với hỗ trợ IT (1–5 sao)', 'Support Satisfaction Rating (1–5)')}
                  </label>
                  <div className="flex items-center gap-1.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setCsatRating(star)}
                        className="rounded-lg p-1 hover:bg-amber-50"
                      >
                        {star <= csatRating ? (
                          <IconStarFilled size={24} className="text-amber-400" />
                        ) : (
                          <IconStar size={24} className="text-slate-300" />
                        )}
                      </button>
                    ))}
                    <span className="ml-2 text-xs font-bold text-slate-700">{csatRating}/5</span>
                  </div>
                </div>
              )}

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  {statusModal === 'RESOLVE'
                    ? tr('Tóm tắt kết quả xử lý *', 'Resolution Summary *')
                    : statusModal === 'CLOSE'
                      ? tr('Góp ý thêm (tùy chọn)', 'Additional Feedback (optional)')
                      : tr('Ghi chú / Lý do *', 'Note / Reason *')}
                </label>
                <textarea
                  rows={3}
                  required={statusModal !== 'CLOSE' && statusModal !== 'CANCEL'}
                  value={statusNote}
                  onChange={(e) => setStatusNote(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  disabled={isActing}
                  onClick={() => setStatusModal(null)}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700"
                >
                  {tr('Hủy', 'Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isActing}
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {isActing ? tr('Đang xử lý...', 'Processing...') : tr('Xác nhận', 'Confirm')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ItRequestFormModal
        open={isEditOpen}
        categories={categories}
        initial={{
          id: detail.id,
          categoryId: detail.categoryId,
          title: detail.title,
          description: detail.description,
          priority: detail.priority,
          assetId: detail.assetId,
          estimatedCost: detail.estimatedCost,
          locationDetail: detail.locationDetail,
          contactPhone: detail.contactPhone,
        }}
        onClose={() => setIsEditOpen(false)}
        onSaved={() => {
          setIsEditOpen(false);
          reload();
        }}
      />

      <ConfirmModal
        isOpen={confirmDeleteOpen}
        title={tr('Xóa mềm Yêu cầu IT?', 'Archive IT Ticket?')}
        description={tr(
          `Bạn có chắc muốn xóa mềm ticket ${detail.code}?`,
          `Are you sure you want to soft-delete ticket ${detail.code}?`,
        )}
        confirmLabel={tr('Xác nhận xóa', 'Confirm Delete')}
        cancelLabel={tr('Hủy', 'Cancel')}
        variant="danger"
        isProcessing={isActing}
        onCancel={() => setConfirmDeleteOpen(false)}
        onConfirm={() => void handleDeleteTicket()}
      />
    </div>
  );
}
