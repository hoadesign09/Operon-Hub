'use client';

import { useEffect, useState } from 'react';
import {
  IconCheck,
  IconChecklist,
  IconEye,
  IconInbox,
  IconRefresh,
  IconSend,
  IconX,
} from '@tabler/icons-react';
import { formatDateTimeVN } from '@/lib/portable/date-utils';
import type { PaginationMeta } from '@/lib/portable/pagination';
import { useI18n } from '@/shared/i18n/I18nContext';

type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

interface ApprovalRow {
  id: number;
  moduleCode: string;
  requestType: string;
  title: string;
  summary: string | null;
  requesterName: string | null;
  currentStep: number;
  totalSteps: number;
  currentApproverRoleName: string | null;
  status: ApprovalStatus;
  submittedAt: string;
}

interface ApprovalHistoryRow {
  id: number;
  stepOrder: number;
  actorName: string | null;
  action: 'SUBMIT' | 'APPROVE' | 'REJECT' | 'CANCEL';
  comment: string | null;
  actedAt: string;
}

interface ApprovalDetailPayload {
  request: ApprovalRow;
  histories: ApprovalHistoryRow[];
  canApproveOrReject: boolean;
  canCancel: boolean;
}

const ERR_LOAD_INBOX = '__ERR_LOAD_INBOX__';
const ERR_NETWORK_INBOX = '__ERR_NETWORK_INBOX__';

const STATUS_BADGES: Record<ApprovalStatus, { vi: string; en: string; cls: string }> = {
  PENDING: { vi: 'Chờ duyệt', en: 'Pending', cls: 'bg-amber-50 text-amber-700' },
  APPROVED: { vi: 'Đã duyệt', en: 'Approved', cls: 'bg-emerald-50 text-emerald-700' },
  REJECTED: { vi: 'Từ chối', en: 'Rejected', cls: 'bg-rose-50 text-rose-700' },
  CANCELLED: { vi: 'Đã hủy', en: 'Cancelled', cls: 'bg-slate-100 text-slate-600' },
};

const ACTION_LABELS: Record<ApprovalHistoryRow['action'], { vi: string; en: string }> = {
  SUBMIT: { vi: 'Gửi đơn', en: 'Submitted' },
  APPROVE: { vi: 'Phê duyệt', en: 'Approved' },
  REJECT: { vi: 'Từ chối', en: 'Rejected' },
  CANCEL: { vi: 'Hủy đơn', en: 'Cancelled' },
};

export default function ApprovalsInboxPage() {
  const { locale, tr } = useI18n();
  const [scope, setScope] = useState<'pending_my_action' | 'sent_by_me'>('pending_my_action');
  const [statusFilter, setStatusFilter] = useState('');
  const [viewState, setViewState] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [items, setItems] = useState<ApprovalRow[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [page, setPage] = useState(1);
  const [reloadTick, setReloadTick] = useState(0);

  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState<ApprovalDetailPayload | null>(null);
  const [comment, setComment] = useState('');
  const [actionError, setActionError] = useState('');
  const [isActing, setIsActing] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ scope, page: String(page), limit: '20' });
    if (statusFilter) {
      params.set('status', statusFilter);
    }

    fetch(`/api/v1/approvals/inbox?${params.toString()}`, {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (res) => {
        const json = (await res.json().catch(() => null)) as {
          success?: boolean;
          data?: ApprovalRow[];
          meta?: PaginationMeta;
          error?: { message?: string };
        } | null;
        if (controller.signal.aborted) {
          return;
        }
        if (!res.ok || !json?.success) {
          setErrorMessage(json?.error?.message ?? ERR_LOAD_INBOX);
          setViewState('error');
          return;
        }
        setItems(json.data ?? []);
        setMeta(json.meta ?? null);
        setErrorMessage('');
        setViewState('success');
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }
        setErrorMessage(ERR_NETWORK_INBOX);
        setViewState('error');
      });

    return () => controller.abort();
  }, [scope, statusFilter, page, reloadTick]);

  function triggerReload() {
    setViewState('loading');
    setReloadTick((t) => t + 1);
  }

  async function openDetail(requestId: number) {
    setDetailLoading(true);
    setActionError('');
    setComment('');
    try {
      const res = await fetch(`/api/v1/approvals/${requestId}/history`, { cache: 'no-store' });
      const json = (await res.json().catch(() => null)) as {
        success?: boolean;
        data?: ApprovalDetailPayload;
        error?: { message?: string };
      } | null;
      if (res.ok && json?.success && json.data) {
        setDetail(json.data);
      } else {
        setErrorMessage(
          json?.error?.message ??
            tr('Không thể tải chi tiết đơn duyệt.', 'Unable to load approval request details.'),
        );
        setViewState('error');
      }
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleAction(action: 'APPROVE' | 'REJECT' | 'CANCEL') {
    if (!detail) {
      return;
    }
    if (action === 'REJECT' && comment.trim().length === 0) {
      setActionError(
        tr(
          'Vui lòng nhập lý do từ chối trước khi gửi.',
          'Please enter a rejection reason before submitting.',
        ),
      );
      return;
    }

    setActionError('');
    setIsActing(true);
    try {
      const res = await fetch(`/api/v1/approvals/${detail.request.id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, comment: comment.trim() || undefined }),
      });
      const json = (await res.json().catch(() => null)) as {
        success?: boolean;
        error?: { message?: string };
      } | null;

      if (!res.ok || !json?.success) {
        setActionError(
          json?.error?.message ?? tr('Không thể xử lý yêu cầu.', 'Unable to process the request.'),
        );
        return;
      }

      setDetail(null);
      triggerReload();
    } catch {
      setActionError(
        tr('Lỗi kết nối khi xử lý phê duyệt.', 'Connection error while processing approval.'),
      );
    } finally {
      setIsActing(false);
    }
  }

  const resolvedErrorMessage =
    errorMessage === ERR_LOAD_INBOX
      ? tr('Không thể tải hộp thư phê duyệt.', 'Unable to load approval inbox.')
      : errorMessage === ERR_NETWORK_INBOX
        ? tr(
            'Lỗi kết nối khi tải hộp thư phê duyệt.',
            'Connection error while loading approval inbox.',
          )
        : errorMessage;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            {tr('Hộp thư Phê duyệt', 'Approval Inbox')}
          </h1>
          <p className="text-sm text-slate-500">
            {tr(
              'Xử lý tập trung mọi đơn từ cần duyệt và theo dõi tiến độ các đơn bạn đã gửi.',
              'Review all pending approval requests and track the progress of your submitted requests.',
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {scope === 'sent_by_me' && (
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
                setViewState('loading');
              }}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
            >
              <option value="">{tr('Tất cả trạng thái', 'All statuses')}</option>
              <option value="PENDING">{tr('Chờ duyệt', 'Pending')}</option>
              <option value="APPROVED">{tr('Đã duyệt', 'Approved')}</option>
              <option value="REJECTED">{tr('Từ chối', 'Rejected')}</option>
              <option value="CANCELLED">{tr('Đã hủy', 'Cancelled')}</option>
            </select>
          )}
          <button
            type="button"
            disabled={viewState === 'loading'}
            onClick={triggerReload}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            <IconRefresh size={16} />
            <span>{tr('Làm mới', 'Refresh')}</span>
          </button>
        </div>
      </div>

      <div className="flex gap-2 border-b border-slate-200">
        <button
          type="button"
          onClick={() => {
            setScope('pending_my_action');
            setStatusFilter('');
            setPage(1);
            setViewState('loading');
          }}
          className={`inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium ${
            scope === 'pending_my_action'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <IconChecklist size={17} />
          <span>{tr('Chờ tôi duyệt', 'Pending My Action')}</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setScope('sent_by_me');
            setPage(1);
            setViewState('loading');
          }}
          className={`inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium ${
            scope === 'sent_by_me'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <IconSend size={17} />
          <span>{tr('Đơn tôi đã gửi', 'Sent by Me')}</span>
        </button>
      </div>

      {viewState === 'loading' && (
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      )}

      {viewState === 'error' && (
        <div className="flex items-center justify-between rounded-2xl border border-rose-200 bg-rose-50 p-5">
          <span className="text-sm font-medium text-rose-700">{resolvedErrorMessage}</span>
          <button
            type="button"
            onClick={triggerReload}
            className="rounded-xl border border-rose-300 bg-white px-3.5 py-1.5 text-xs font-medium text-rose-700"
          >
            {tr('Thử lại', 'Retry')}
          </button>
        </div>
      )}

      {viewState === 'success' && items.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white py-14 text-center">
          <IconInbox size={34} className="text-slate-400" />
          <p className="mt-2 text-sm font-semibold text-slate-800">
            {scope === 'pending_my_action'
              ? tr('Hiện không có yêu cầu nào chờ bạn phê duyệt', 'No requests pending your approval')
              : tr('Bạn chưa gửi yêu cầu phê duyệt nào', 'You have not submitted any approval requests')}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {tr(
              'Các đơn nghỉ phép, tăng ca, công tác (HRM) hoặc báo giá (CRM) sẽ tự động xuất hiện tại đây.',
              'Leave, overtime, business trip (HRM) or quotation (CRM) requests will automatically appear here.',
            )}
          </p>
        </div>
      )}

      {viewState === 'success' && items.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">{tr('Yêu cầu', 'Request')}</th>
                  <th className="px-4 py-3">{tr('Người gửi', 'Requester')}</th>
                  <th className="px-4 py-3">{tr('Tiến độ', 'Progress')}</th>
                  <th className="px-4 py-3">{tr('Ngày gửi', 'Submitted At')}</th>
                  <th className="px-4 py-3">{tr('Trạng thái', 'Status')}</th>
                  <th className="px-4 py-3 text-right">{tr('Thao tác', 'Actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item) => {
                  const badge = STATUS_BADGES[item.status];
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{item.title}</div>
                        <div className="font-mono text-[11px] text-slate-500">
                          {item.moduleCode}/{item.requestType}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-700">
                        {item.requesterName ?? '-'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600">
                        {tr('Bước', 'Step')} {item.currentStep}/{item.totalSteps}
                        {item.currentApproverRoleName ? ` (${item.currentApproverRoleName})` : ''}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600">
                        {formatDateTimeVN(item.submittedAt)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.cls}`}>
                          {locale === 'en' ? badge.en : badge.vi}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <button
                          type="button"
                          disabled={detailLoading}
                          onClick={() => void openDetail(item.id)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                        >
                          <IconEye size={14} />
                          <span>{tr('Xem & Xử lý', 'View & Act')}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {meta && meta.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-xs text-slate-600">
              <span>
                {tr(
                  `Trang ${meta.page}/${meta.totalPages} (Tổng ${meta.total} đơn)`,
                  `Page ${meta.page}/${meta.totalPages} (${meta.total} total)`,
                )}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={!meta.hasPrev}
                  onClick={() => {
                    setPage((p) => Math.max(1, p - 1));
                    setViewState('loading');
                  }}
                  className="rounded-lg border border-slate-300 px-3 py-1 disabled:opacity-50"
                >
                  {tr('Trước', 'Previous')}
                </button>
                <button
                  type="button"
                  disabled={!meta.hasNext}
                  onClick={() => {
                    setPage((p) => p + 1);
                    setViewState('loading');
                  }}
                  className="rounded-lg border border-slate-300 px-3 py-1 disabled:opacity-50"
                >
                  {tr('Sau', 'Next')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {detail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900">{detail.request.title}</h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  {tr('Người gửi', 'Requester')}: {detail.request.requesterName ?? '-'} •{' '}
                  {tr('Bước', 'Step')} {detail.request.currentStep}/{detail.request.totalSteps}
                </p>
              </div>
              <button
                type="button"
                disabled={isActing}
                onClick={() => setDetail(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <IconX size={18} />
              </button>
            </div>

            {detail.request.summary && (
              <div className="mt-4 rounded-xl bg-slate-50 p-3.5 text-xs leading-relaxed text-slate-700">
                {detail.request.summary}
              </div>
            )}

            <div className="mt-5">
              <h3 className="text-xs font-semibold uppercase text-slate-500">
                {tr('Lịch sử xử lý (Timeline)', 'Approval Timeline')}
              </h3>
              <ol className="mt-2.5 space-y-2.5 border-l-2 border-slate-200 pl-4">
                {detail.histories.map((h) => (
                  <li key={h.id} className="text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-800">
                        {h.actorName ?? tr('Hệ thống', 'System')} —{' '}
                        {locale === 'en' ? ACTION_LABELS[h.action].en : ACTION_LABELS[h.action].vi}{' '}
                        ({tr('Bước', 'Step')} {h.stepOrder})
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {formatDateTimeVN(h.actedAt)}
                      </span>
                    </div>
                    {h.comment && <p className="mt-0.5 text-slate-600">{h.comment}</p>}
                  </li>
                ))}
              </ol>
            </div>

            {(detail.canApproveOrReject || detail.canCancel) && (
              <div className="mt-5 space-y-3 border-t border-slate-100 pt-4">
                {actionError && (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                    {actionError}
                  </div>
                )}

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    {tr(
                      'Ghi chú / Lý do (bắt buộc nếu Từ chối)',
                      'Comment / Reason (required for rejection)',
                    )}
                  </label>
                  <textarea
                    rows={2}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder={tr('Nhập nhận xét hoặc lý do...', 'Enter comment or reason...')}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                  />
                </div>

                <div className="flex flex-wrap justify-end gap-2">
                  {detail.canCancel && (
                    <button
                      type="button"
                      disabled={isActing}
                      onClick={() => void handleAction('CANCEL')}
                      className="rounded-xl border border-slate-300 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                    >
                      {tr('Hủy đơn', 'Cancel Request')}
                    </button>
                  )}
                  {detail.canApproveOrReject && (
                    <>
                      <button
                        type="button"
                        disabled={isActing}
                        onClick={() => void handleAction('REJECT')}
                        className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-medium text-white hover:bg-rose-700 disabled:opacity-60"
                      >
                        {tr('Từ chối', 'Reject')}
                      </button>
                      <button
                        type="button"
                        disabled={isActing}
                        onClick={() => void handleAction('APPROVE')}
                        className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                      >
                        <IconCheck size={15} />
                        <span>
                          {isActing ? tr('Đang xử lý...', 'Processing...') : tr('Phê duyệt', 'Approve')}
                        </span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
