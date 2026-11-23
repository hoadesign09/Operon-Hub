'use client';

import { useEffect, useState } from 'react';
import {
  IconCheck,
  IconEye,
  IconLoader2,
  IconPin,
  IconRefresh,
  IconSearch,
  IconUsers,
  IconX,
} from '@tabler/icons-react';
import { formatDateTimeVN } from '@/lib/portable/date-utils';
import type {
  AnnouncementItem,
  AnnouncementReadersResult,
} from '@/modules/hrm/office/announcements.service';

interface AnnouncementDetailModalProps {
  announcement: AnnouncementItem;
  canManage: boolean;
  onClose: () => void;
  onMarkedRead: (announcementId: number) => void;
}

const CATEGORY_BADGES: Record<AnnouncementItem['category'], { label: string; cls: string }> = {
  GENERAL: { label: 'Thông báo chung', cls: 'bg-slate-100 text-slate-700' },
  HR_POLICY: { label: 'Chính sách HR', cls: 'bg-blue-50 text-blue-700' },
  EVENT: { label: 'Sự kiện nội bộ', cls: 'bg-emerald-50 text-emerald-700' },
  URGENT: { label: 'Khẩn cấp', cls: 'bg-rose-100 text-rose-700' },
};

export function AnnouncementDetailModal({
  announcement,
  canManage,
  onClose,
  onMarkedRead,
}: AnnouncementDetailModalProps) {
  const [activeTab, setActiveTab] = useState<'content' | 'readers'>('content');
  const [isRead, setIsRead] = useState(announcement.isReadByMe);
  const [readCount, setReadCount] = useState(announcement.readCount);
  const [targetCount, setTargetCount] = useState(announcement.targetEmployeeCount);
  const [readRate, setReadRate] = useState(announcement.readRatePercent);
  const [isMarking, setIsMarking] = useState(false);
  const [markError, setMarkError] = useState<string | null>(null);

  const [readerFilter, setReaderFilter] = useState<'all' | 'read' | 'unread'>('all');
  const [readerSearch, setReaderSearch] = useState('');
  const [readersData, setReadersData] = useState<AnnouncementReadersResult | null>(null);
  const [isLoadingReaders, setIsLoadingReaders] = useState(false);
  const [readersError, setReadersError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  // Auto mark-read once when opening an unread published announcement
  useEffect(() => {
    if (announcement.status !== 'PUBLISHED' || announcement.isReadByMe) {
      return;
    }

    const controller = new AbortController();
    void (async () => {
      try {
        const res = await fetch(`/api/v1/hrm/admin-ops/announcements/${announcement.id}/read`, {
          method: 'POST',
          signal: controller.signal,
        });
        const json = (await res.json().catch(() => null)) as {
          success?: boolean;
          data?: {
            readCount: number;
            targetEmployeeCount: number;
            readRatePercent: number;
          };
        } | null;

        if (res.ok && json?.success && json.data) {
          setIsRead(true);
          setReadCount(json.data.readCount);
          setTargetCount(json.data.targetEmployeeCount);
          setReadRate(json.data.readRatePercent);
          onMarkedRead(announcement.id);
        }
      } catch {
        // Ignore abort or missing employee profile silently on auto-mark
      }
    })();

    return () => controller.abort();
  }, [announcement.id, announcement.isReadByMe, announcement.status, onMarkedRead]);

  // Load reader statistics when manager opens the readers tab
  useEffect(() => {
    if (!canManage || activeTab !== 'readers') {
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => {
      void (async () => {
        setIsLoadingReaders(true);
        setReadersError(null);
        try {
          const sp = new URLSearchParams();
          sp.set('filter', readerFilter);
          if (readerSearch.trim()) {
            sp.set('search', readerSearch.trim());
          }
          const res = await fetch(
            `/api/v1/hrm/admin-ops/announcements/${announcement.id}/readers?${sp.toString()}`,
            { signal: controller.signal },
          );
          const json = (await res.json().catch(() => null)) as {
            success?: boolean;
            data?: AnnouncementReadersResult;
            error?: { message?: string };
          } | null;

          if (!res.ok || !json?.success || !json.data) {
            setReadersError(json?.error?.message ?? 'Không thể tải danh sách thống kê người đọc.');
            return;
          }
          setReadersData(json.data);
        } catch (err: unknown) {
          if (err instanceof DOMException && err.name === 'AbortError') {
            return;
          }
          setReadersError('Lỗi kết nối khi tải danh sách người đọc.');
        } finally {
          setIsLoadingReaders(false);
        }
      })();
    }, 200);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [activeTab, announcement.id, canManage, readerFilter, readerSearch, reloadTick]);

  async function handleManualMarkRead() {
    setMarkError(null);
    setIsMarking(true);
    try {
      const res = await fetch(`/api/v1/hrm/admin-ops/announcements/${announcement.id}/read`, {
        method: 'POST',
      });
      const json = (await res.json().catch(() => null)) as {
        success?: boolean;
        data?: { readCount: number; targetEmployeeCount: number; readRatePercent: number };
        error?: { message?: string };
      } | null;

      if (!res.ok || !json?.success || !json.data) {
        setMarkError(json?.error?.message ?? 'Không thể đánh dấu đã đọc.');
        return;
      }

      setIsRead(true);
      setReadCount(json.data.readCount);
      setTargetCount(json.data.targetEmployeeCount);
      setReadRate(json.data.readRatePercent);
      onMarkedRead(announcement.id);
    } catch {
      setMarkError('Lỗi kết nối máy chủ.');
    } finally {
      setIsMarking(false);
    }
  }

  const badge = CATEGORY_BADGES[announcement.category];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4">
          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              {announcement.isPinned && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                  <IconPin size={12} />
                  Ghim
                </span>
              )}
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${badge.cls}`}>
                {badge.label}
              </span>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                {announcement.branchName ?? 'Toàn công ty'}
              </span>
            </div>
            <h2 className="text-lg font-bold text-slate-900">{announcement.title}</h2>
            <p className="text-xs text-slate-500">
              Người đăng: <span className="font-medium text-slate-700">{announcement.authorName}</span> •{' '}
              {announcement.publishedAt
                ? `Xuất bản: ${formatDateTimeVN(announcement.publishedAt)}`
                : `Bản nháp tạo lúc ${formatDateTimeVN(announcement.createdAt)}`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
            aria-label="Đóng"
          >
            <IconX size={18} />
          </button>
        </div>

        {canManage && (
          <div className="flex border-b border-slate-200 px-6">
            <button
              type="button"
              onClick={() => setActiveTab('content')}
              className={`inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium ${
                activeTab === 'content'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <IconEye size={16} />
              <span>Nội dung thông báo</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('readers')}
              className={`inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium ${
                activeTab === 'readers'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <IconUsers size={16} />
              <span>
                Thống kê đọc ({readCount}/{targetCount} • {readRate}%)
              </span>
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'content' ? (
            <div className="space-y-4">
              {markError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">
                  {markError}
                </div>
              )}

              <div className="whitespace-pre-line rounded-xl border border-slate-200 bg-slate-50/70 p-5 text-sm leading-relaxed text-slate-800">
                {announcement.content}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
                <div className="text-xs text-slate-600">
                  Tỷ lệ tiếp nhận toàn phạm vi:{' '}
                  <span className="font-semibold text-slate-900">
                    {readCount}/{targetCount} nhân viên ({readRate}%)
                  </span>
                </div>

                {announcement.status === 'PUBLISHED' && (
                  <div>
                    {isRead ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                        <IconCheck size={14} />
                        Bạn đã xác nhận đọc
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={isMarking}
                        onClick={() => void handleManualMarkRead()}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                      >
                        {isMarking ? (
                          <IconLoader2 size={14} className="animate-spin" />
                        ) : (
                          <IconCheck size={14} />
                        )}
                        <span>Đánh dấu đã đọc</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {readersData && (
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
                    <div className="text-xs text-slate-500">Tổng nhân sự mục tiêu</div>
                    <div className="mt-1 text-xl font-bold text-slate-900">
                      {readersData.summary.targetEmployeeCount}
                    </div>
                  </div>
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-center">
                    <div className="text-xs text-emerald-700">Đã đọc</div>
                    <div className="mt-1 text-xl font-bold text-emerald-800">
                      {readersData.summary.readCount} ({readersData.summary.readRatePercent}%)
                    </div>
                  </div>
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-center">
                    <div className="text-xs text-amber-700">Chưa đọc</div>
                    <div className="mt-1 text-xl font-bold text-amber-800">
                      {readersData.summary.unreadCount}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1">
                  <IconSearch
                    size={16}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="text"
                    value={readerSearch}
                    onChange={(e) => setReaderSearch(e.target.value)}
                    placeholder="Tìm tên, mã NV, phòng ban..."
                    className="w-full rounded-xl border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-500"
                  />
                </div>
                <select
                  value={readerFilter}
                  onChange={(e) => setReaderFilter(e.target.value as 'all' | 'read' | 'unread')}
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                >
                  <option value="all">Tất cả</option>
                  <option value="read">Đã đọc</option>
                  <option value="unread">Chưa đọc</option>
                </select>
              </div>

              {isLoadingReaders ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-12 animate-pulse rounded-xl bg-slate-100" />
                  ))}
                </div>
              ) : readersError ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-center text-sm text-rose-700">
                  <p>{readersError}</p>
                  <button
                    type="button"
                    onClick={() => setReloadTick((v) => v + 1)}
                    className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-700"
                  >
                    <IconRefresh size={14} />
                    <span>Thử lại</span>
                  </button>
                </div>
              ) : !readersData || readersData.items.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
                  Không có nhân viên nào khớp bộ lọc hiện tại.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                      <tr>
                        <th className="px-4 py-2.5">Nhân viên</th>
                        <th className="px-4 py-2.5">Phòng ban</th>
                        <th className="px-4 py-2.5">Trạng thái</th>
                        <th className="px-4 py-2.5">Thời điểm đọc</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {readersData.items.map((item) => (
                        <tr key={item.employeeId} className="hover:bg-slate-50">
                          <td className="px-4 py-2.5">
                            <div className="font-medium text-slate-900">{item.fullName}</div>
                            <div className="text-xs text-slate-500">
                              {item.employeeCode} • {item.positionName}
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-slate-600">{item.departmentName}</td>
                          <td className="px-4 py-2.5">
                            {item.isRead ? (
                              <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                                Đã đọc
                              </span>
                            ) : (
                              <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                                Chưa đọc
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-xs text-slate-500">
                            {item.readAt ? formatDateTimeVN(item.readAt) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end border-t border-slate-200 px-6 py-3.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
