'use client';

import { useEffect, useState } from 'react';
import { IconInbox, IconRefresh, IconShieldLock } from '@tabler/icons-react';
import { formatDateTimeVN } from '@/lib/portable/date-utils';
import type { PaginationMeta } from '@/lib/portable/pagination';

interface AuditLogRow {
  id: number;
  actorName: string | null;
  actorEmail: string | null;
  moduleCode: string;
  action: string;
  entityType: string;
  entityId: string | null;
  ipAddress: string | null;
  createdAt: string;
}

export default function AuditLogsSettingsPage() {
  const [items, setItems] = useState<AuditLogRow[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [viewState, setViewState] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [moduleCode, setModuleCode] = useState('');
  const [page, setPage] = useState(1);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (moduleCode) {
      params.set('moduleCode', moduleCode);
    }

    fetch(`/api/v1/core/audit-logs?${params.toString()}`, {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (res) => {
        const json = (await res.json().catch(() => null)) as {
          success?: boolean;
          data?: AuditLogRow[];
          meta?: PaginationMeta;
          error?: { message?: string };
        } | null;
        if (controller.signal.aborted) {
          return;
        }
        if (!res.ok || !json?.success) {
          setErrorMessage(json?.error?.message ?? 'Không thể tải nhật ký kiểm toán.');
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
        setErrorMessage('Lỗi kết nối khi tải nhật ký kiểm toán.');
        setViewState('error');
      });

    return () => controller.abort();
  }, [page, moduleCode, reloadTick]);

  function triggerReload() {
    setViewState('loading');
    setReloadTick((t) => t + 1);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Nhật ký Kiểm toán Hệ thống</h1>
          <p className="text-sm text-slate-500">
            Theo dõi lịch sử đăng nhập và mọi thao tác thay đổi dữ liệu quan trọng.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={moduleCode}
            onChange={(e) => {
              setModuleCode(e.target.value);
              setPage(1);
              setViewState('loading');
            }}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-500"
          >
            <option value="">Tất cả phân hệ</option>
            <option value="core">Core</option>
            <option value="hrm">HRM</option>
          </select>
          <button
            type="button"
            disabled={viewState === 'loading'}
            onClick={triggerReload}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            <IconRefresh size={16} />
            <span>Tải lại</span>
          </button>
        </div>
      </div>

      {viewState === 'loading' && (
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-6">
          {[1, 2, 3, 4].map((row) => (
            <div key={row} className="h-10 animate-pulse rounded-xl bg-slate-100" />
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
          <IconInbox size={32} className="text-slate-400" />
          <p className="mt-2 text-sm font-medium text-slate-700">Chưa có bản ghi nhật ký nào</p>
        </div>
      )}

      {viewState === 'success' && items.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Thời gian</th>
                  <th className="px-4 py-3">Người thực hiện</th>
                  <th className="px-4 py-3">Phân hệ / Hành động</th>
                  <th className="px-4 py-3">Đối tượng</th>
                  <th className="px-4 py-3">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/70">
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600">
                      {formatDateTimeVN(log.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs font-medium text-slate-900">
                        {log.actorName ?? 'Hệ thống'}
                      </div>
                      <div className="text-[11px] text-slate-500">{log.actorEmail ?? '-'}</div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-700">
                        <IconShieldLock size={13} />
                        {log.moduleCode}:{log.action}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600">
                      {log.entityType}
                      {log.entityId ? ` #${log.entityId}` : ''}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-500">
                      {log.ipAddress ?? '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {meta && meta.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-xs text-slate-600">
              <span>
                Trang {meta.page}/{meta.totalPages} (Tổng {meta.total} bản ghi)
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
    </div>
  );
}
