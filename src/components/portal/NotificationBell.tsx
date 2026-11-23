'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  IconBell,
  IconCheck,
  IconInbox,
  IconRefresh,
} from '@tabler/icons-react';
import { formatDateTimeVN } from '@/lib/portable/date-utils';

interface NotificationRow {
  id: number;
  title: string;
  message: string;
  linkUrl: string | null;
  isRead: boolean;
  createdAt: string;
}

interface NotificationsResponse {
  success?: boolean;
  data?: {
    items?: NotificationRow[];
    unreadCount?: number;
  };
  error?: { message?: string };
}

export function NotificationBell() {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [viewState, setViewState] = useState<'loading' | 'success' | 'error'>('loading');
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    fetch('/api/v1/core/notifications?limit=10', {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (res) => {
        const json = (await res.json().catch(() => null)) as NotificationsResponse | null;
        if (controller.signal.aborted) {
          return;
        }
        if (!res.ok || !json?.success || !json?.data) {
          setErrorMessage(json?.error?.message ?? 'Không thể tải thông báo.');
          setViewState('error');
          return;
        }
        setItems(json.data.items ?? []);
        setUnreadCount(json.data.unreadCount ?? 0);
        setErrorMessage('');
        setViewState('success');
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }
        setErrorMessage('Lỗi kết nối khi tải thông báo.');
        setViewState('error');
      });

    return () => controller.abort();
  }, [reloadTick]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    function handleOutsideClick(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  function handleToggle() {
    const nextOpen = !isOpen;
    setIsOpen(nextOpen);
    if (nextOpen) {
      setReloadTick((t) => t + 1);
    }
  }

  async function handleClickItem(item: NotificationRow) {
    if (!item.isRead) {
      await fetch(`/api/v1/core/notifications/${item.id}/read`, { method: 'PATCH' }).catch(
        () => null,
      );
      setItems((prev) =>
        prev.map((row) => (row.id === item.id ? { ...row, isRead: true } : row)),
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    }
    setIsOpen(false);
    if (item.linkUrl) {
      router.push(item.linkUrl);
    }
  }

  async function handleMarkAllRead() {
    setIsMarkingAll(true);
    try {
      const res = await fetch('/api/v1/core/notifications/read-all', { method: 'PATCH' });
      if (res.ok) {
        setItems((prev) => prev.map((row) => ({ ...row, isRead: true })));
        setUnreadCount(0);
      }
    } finally {
      setIsMarkingAll(false);
    }
  }

  const badgeText = unreadCount > 99 ? '99+' : String(unreadCount);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={handleToggle}
        aria-label="Thông báo"
        className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
      >
        <IconBell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex min-w-[18px] items-center justify-center rounded-full bg-rose-600 px-1 py-0.5 text-[10px] font-bold leading-none text-white">
            {badgeText}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl sm:w-96">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h3 className="text-sm font-semibold text-slate-900">
              Thông báo ({unreadCount} chưa đọc)
            </h3>
            {unreadCount > 0 && (
              <button
                type="button"
                disabled={isMarkingAll}
                onClick={() => void handleMarkAllRead()}
                className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline disabled:opacity-50"
              >
                <IconCheck size={14} />
                <span>Đọc tất cả</span>
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {viewState === 'loading' && (
              <div className="space-y-2 p-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 animate-pulse rounded-xl bg-slate-100" />
                ))}
              </div>
            )}

            {viewState === 'error' && (
              <div className="p-5 text-center">
                <p className="text-xs text-rose-600">{errorMessage}</p>
                <button
                  type="button"
                  onClick={() => {
                    setViewState('loading');
                    setReloadTick((t) => t + 1);
                  }}
                  className="mt-2 inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1 text-xs text-slate-700"
                >
                  <IconRefresh size={13} />
                  <span>Thử lại</span>
                </button>
              </div>
            )}

            {viewState === 'success' && items.length === 0 && (
              <div className="flex flex-col items-center justify-center px-4 py-8 text-center">
                <IconInbox size={26} className="text-slate-300" />
                <p className="mt-2 text-xs font-medium text-slate-500">
                  Bạn chưa có thông báo nào
                </p>
              </div>
            )}

            {viewState === 'success' && items.length > 0 && (
              <ul className="divide-y divide-slate-100">
                {items.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => void handleClickItem(item)}
                      className={`w-full px-4 py-3 text-left transition hover:bg-slate-50 ${
                        item.isRead ? 'bg-white' : 'bg-blue-50/40'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs font-semibold text-slate-900">{item.title}</span>
                        {!item.isRead && (
                          <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-blue-600" />
                        )}
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-xs text-slate-600">{item.message}</p>
                      <span className="mt-1 block text-[11px] text-slate-400">
                        {formatDateTimeVN(item.createdAt)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
