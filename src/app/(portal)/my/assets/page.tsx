'use client';

import { useEffect, useState } from 'react';
import { IconDevices, IconDownload, IconRefresh } from '@tabler/icons-react';
import type { AssetAssignmentItem } from '@/modules/hrm/office/assets.service';

interface MyAssetsResponse {
  activeItems: AssetAssignmentItem[];
  historyItems: AssetAssignmentItem[];
}

const CATEGORY_TEXT: Record<AssetAssignmentItem['assetCategory'], string> = {
  LAPTOP: 'Laptop / Máy tính',
  MONITOR: 'Màn hình',
  PHONE: 'Điện thoại / Di động',
  FURNITURE: 'Nội thất văn phòng',
  OTHER: 'Thiết bị khác',
};

export default function MyAssetsPage() {
  const [data, setData] = useState<MyAssetsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    fetch('/api/v1/hrm/admin-ops/assets/me', { signal: controller.signal })
      .then(async (res) => {
        const json = (await res.json()) as {
          success: boolean;
          data?: MyAssetsResponse;
          error?: { message?: string };
        };
        if (!res.ok || !json.success || !json.data) {
          throw new Error(json.error?.message ?? 'Không thể tải danh sách tài sản của bạn.');
        }
        setData(json.data);
        setErrorMessage(null);
      })
      .catch((err: unknown) => {
        if ((err as { name?: string })?.name === 'AbortError') return;
        setErrorMessage(err instanceof Error ? err.message : 'Lỗi kết nối máy chủ.');
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => controller.abort();
  }, [reloadTick]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Tài sản của tôi</h1>
        <p className="mt-1 text-sm text-slate-500">
          Theo dõi danh sách thiết bị công ty đang cấp phát cho bạn và tải Biên bản bàn giao / thu hồi PDF.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:max-w-md">
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 shadow-sm">
          <div className="text-xs font-medium text-blue-700">Đang sử dụng</div>
          <div className="mt-1 text-2xl font-bold text-blue-800">
            {isLoading ? '...' : (data?.activeItems.length ?? 0)}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs text-slate-500">Đã bàn giao trả</div>
          <div className="mt-1 text-2xl font-bold text-slate-800">
            {isLoading ? '...' : (data?.historyItems.length ?? 0)}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-6">
          <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
          <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
        </div>
      ) : errorMessage ? (
        <div className="rounded-2xl border border-rose-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm text-rose-700">{errorMessage}</p>
          <button
            type="button"
            onClick={() => {
              setIsLoading(true);
              setReloadTick((t) => t + 1);
            }}
            className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-medium text-white"
          >
            <IconRefresh size={14} />
            <span>Thử lại</span>
          </button>
        </div>
      ) : !data || (data.activeItems.length === 0 && data.historyItems.length === 0) ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
            <IconDevices size={24} />
          </div>
          <p className="mt-3 text-sm font-semibold text-slate-800">
            Bạn chưa được cấp phát tài sản nào
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Khi Bộ phận Hành chính cấp phát thiết bị làm việc, thông tin và biên bản bàn giao sẽ hiển thị tại đây.
          </p>
        </div>
      ) : (
        <>
          {/* Active Assigned Assets */}
          <div className="space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">
              Thiết bị đang quản lý & sử dụng ({data.activeItems.length})
            </h2>
            {data.activeItems.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
                Hiện không có thiết bị nào đang cấp phát.
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {data.activeItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-sm font-bold text-slate-900">
                            {item.assetCode} — {item.assetName}
                          </div>
                          <div className="text-xs text-slate-500">
                            {CATEGORY_TEXT[item.assetCategory]} • S/N:{' '}
                            {item.serialNumber ?? 'Không có'}
                          </div>
                        </div>
                        <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-semibold text-blue-800">
                          Đang sử dụng
                        </span>
                      </div>

                      <div className="mt-3 space-y-1 text-xs text-slate-600">
                        <div>
                          <span className="font-semibold text-slate-800">Ngày nhận:</span>{' '}
                          {item.assignedAt}
                        </div>
                        <div>
                          <span className="font-semibold text-slate-800">Tình trạng lúc nhận:</span>{' '}
                          {item.conditionOnAssign}
                        </div>
                        {item.note && (
                          <div>
                            <span className="font-semibold text-slate-800">Ghi chú:</span>{' '}
                            {item.note}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 flex justify-end border-t border-slate-100 pt-3">
                      <a
                        href={`/api/v1/hrm/admin-ops/assets/assignments/${item.id}/pdf`}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                      >
                        <IconDownload size={14} />
                        <span>Tải Biên bản bàn giao PDF</span>
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Returned History */}
          {data.historyItems.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">
                Lịch sử thiết bị đã bàn giao trả ({data.historyItems.length})
              </h2>
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Thiết bị</th>
                        <th className="px-4 py-3">Ngày nhận</th>
                        <th className="px-4 py-3">Ngày trả</th>
                        <th className="px-4 py-3">Tình trạng lúc trả</th>
                        <th className="px-4 py-3 text-right">Biên bản</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.historyItems.map((item) => (
                        <tr key={item.id}>
                          <td className="px-4 py-3">
                            <div className="font-semibold text-slate-900">
                              {item.assetCode} — {item.assetName}
                            </div>
                            <div className="text-xs text-slate-500">
                              S/N: {item.serialNumber ?? '—'}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-600">
                            {item.assignedAt}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-600">
                            {item.returnedAt ?? '—'}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-700">
                            {item.conditionOnReturn ?? '—'}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <a
                              href={`/api/v1/hrm/admin-ops/assets/assignments/${item.id}/pdf`}
                              className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
                            >
                              <IconDownload size={14} />
                              <span>PDF</span>
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
