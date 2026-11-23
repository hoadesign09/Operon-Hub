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

const STATUS_BADGES: Record<ApprovalStatus, { label: string; cls: string }> = {
  PENDING: { label: 'Chờ duyệt', cls: 'bg-amber-50 text-amber-700' },
  APPROVED: { label: 'Đã duyệt', cls: 'bg-emerald-50 text-emerald-700' },
  REJECTED: { label: 'Từ chối', cls: 'bg-rose-50 text-rose-700' },
  CANCELLED: { label: 'Đã hủy', cls: 'bg-slate-100 text-slate-600' },
};

const ACTION_LABELS: Record<ApprovalHistoryRow['action'], string> = {
  SUBMIT: 'Gửi đơn',
  APPROVE: 'Phê duyệt',
  REJECT: 'Từ chối',
  CANCEL: 'Hủy đơn',
};

export default function ApprovalsInboxPage() {
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
          setErrorMessage(json?.error?.message ?? 'Không thể tải hộp thư phê duyệt.');
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
        setErrorMessage('Lỗi kết nối khi tải hộp thư phê duyệt.');
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
        setErrorMessage(json?.error?.message ?? 'Không thể tải chi tiết đơn duyệt.');
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
      setActionError('Vui lòng nhập lý do từ chối trước khi gửi.');
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
        setActionError(json?.error?.message ?? 'Không thể xử lý yêu cầu.');
        return;
      }

      setDetail(null);
      triggerReload();
    } catch {
      setActionError('Lỗi kết nối khi xử lý phê duyệt.');
    } finally {
      setIsActing(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Hộp thư Phê duyệt</h1>
          <p className="text-sm text-slate-500">
            Xử lý tập trung mọi đơn từ cần duyệt và theo dõi tiến độ các đơn bạn đã gửi.
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
              <option value="">Tất cả trạng thái</option>
              <option value="PENDING">Chờ duyệt</option>
              <option value="APPROVED">Đã duyệt</option>
              <option value="REJECTED">Từ chối</option>
              <option value="CANCELLED">Đã hủy</option>
            </select>
          )}
          <button
            type="button"
            disabled={viewState === 'loading'}
            onClick={triggerReload}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            <IconRefresh size={16} />
            <span>Làm mới</span>
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
          <span>Chờ tôi duyệt</span>
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
          <span>Đơn tôi đã gửi</span>
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
          <span className="text-sm font-medium text-rose-700">{errorMessage}</span>
          <button
            type="button"
            onClick={triggerReload}
            className="rounded-xl border border-rose-300 bg-white px-3.5 py-1.5 text-xs font-medium text-rose-700"
          >
            Thử lại
          </button>
        </div>
      )}

      {viewState === 'success' && items.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white py-14 text-center">
          <IconInbox size={34} className="text-slate-400" />
          <p className="mt-2 text-sm font-semibold text-slate-800">
            {scope === 'pending_my_action'
              ? 'Hiện không có yêu cầu nào chờ bạn phê duyệt'
              : 'Bạn chưa gửi yêu cầu phê duyệt nào'}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Các đơn nghỉ phép, tăng ca, công tác (HRM) hoặc báo giá (CRM) sẽ tự động xuất hiện tại đây.
          </p>
        </div>
      )}

      {viewState === 'success' && items.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Yêu cầu</th>
                  <th className="px-4 py-3">Người gửi</th>
                  <th className="px-4 py-3">Tiến độ</th>
                  <th className="px-4 py-3">Ngày gửi</th>
                  <th className="px-4 py-3">Trạng thái</th>
                  <th className="px-4 py-3 text-right">Thao tác</th>
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
                        Bước {item.currentStep}/{item.totalSteps}
                        {item.currentApproverRoleName ? ` (${item.currentApproverRoleName})` : ''}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600">
                        {formatDateTimeVN(item.submittedAt)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.cls}`}>
                          {badge.label}
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
                          <span>Xem &amp; Xử lý</span>
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
                Trang {meta.page}/{meta.totalPages} (Tổng {meta.total} đơn)
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
                  Trước
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
                  Sau
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
                  Người gửi: {detail.request.requesterName ?? '-'} • Bước{' '}
                  {detail.request.currentStep}/{detail.request.totalSteps}
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
                Lịch sử xử lý (Timeline)
              </h3>
              <ol className="mt-2.5 space-y-2.5 border-l-2 border-slate-200 pl-4">
                {detail.histories.map((h) => (
                  <li key={h.id} className="text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-800">
                        {h.actorName ?? 'Hệ thống'} — {ACTION_LABELS[h.action]} (Bước {h.stepOrder})
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
                    Ghi chú / Lý do (bắt buộc nếu Từ chối)
                  </label>
                  <textarea
                    rows={2}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Nhập nhận xét hoặc lý do..."
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
                      Hủy đơn
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
                        Từ chối
                      </button>
                      <button
                        type="button"
                        disabled={isActing}
                        onClick={() => void handleAction('APPROVE')}
                        className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                      >
                        <IconCheck size={15} />
                        <span>{isActing ? 'Đang xử lý...' : 'Phê duyệt'}</span>
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
