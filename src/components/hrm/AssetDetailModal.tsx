'use client';

import { useEffect, useState } from 'react';
import { IconDownload, IconRefresh, IconX } from '@tabler/icons-react';
import { formatVND } from '@/lib/portable/currency-utils';
import { formatDateVN } from '@/lib/portable/date-utils';
import type {
  AssetAssignmentItem,
  AssetListItem,
} from '@/modules/hrm/office/assets.service';

interface AssetDetailModalProps {
  assetId: number;
  onClose: () => void;
}

const CATEGORY_TEXT: Record<AssetListItem['category'], string> = {
  LAPTOP: 'Laptop / Máy tính',
  MONITOR: 'Màn hình',
  PHONE: 'Điện thoại / Di động',
  FURNITURE: 'Nội thất văn phòng',
  OTHER: 'Thiết bị khác',
};

export function AssetDetailModal({ assetId, onClose }: AssetDetailModalProps) {
  const [asset, setAsset] = useState<AssetListItem | null>(null);
  const [assignments, setAssignments] = useState<AssetAssignmentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    fetch(`/api/v1/hrm/admin-ops/assets/${assetId}`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        const json = (await res.json()) as {
          success: boolean;
          data?: { asset: AssetListItem; assignments: AssetAssignmentItem[] };
          error?: { message?: string };
        };
        if (!res.ok || !json.success || !json.data) {
          throw new Error(json.error?.message ?? 'Không thể tải thông tin chi tiết tài sản.');
        }
        setAsset(json.data.asset);
        setAssignments(json.data.assignments);
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
  }, [assetId, reloadTick]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              {asset ? `${asset.assetCode} — ${asset.name}` : 'Chi tiết Tài sản & Lịch sử cấp phát'}
            </h2>
            {asset && (
              <p className="text-xs text-slate-500">
                {CATEGORY_TEXT[asset.category]} • {asset.branchName}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Đóng"
          >
            <IconX size={18} />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-6">
          {isLoading ? (
            <div className="space-y-3">
              <div className="h-20 animate-pulse rounded-xl bg-slate-100" />
              <div className="h-32 animate-pulse rounded-xl bg-slate-100" />
            </div>
          ) : errorMessage ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-center">
              <p className="text-sm text-rose-700">{errorMessage}</p>
              <button
                type="button"
                onClick={() => {
                  setIsLoading(true);
                  setReloadTick((t) => t + 1);
                }}
                className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-medium text-white"
              >
                <IconRefresh size={14} />
                <span>Thử lại</span>
              </button>
            </div>
          ) : asset ? (
            <>
              <div className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs sm:grid-cols-3">
                <div>
                  <span className="text-slate-500">Hãng / Model</span>
                  <div className="mt-0.5 font-semibold text-slate-900">
                    {[asset.brand, asset.model].filter(Boolean).join(' — ') || '—'}
                  </div>
                </div>
                <div>
                  <span className="text-slate-500">Số Serial</span>
                  <div className="mt-0.5 font-semibold text-slate-900">
                    {asset.serialNumber ?? '—'}
                  </div>
                </div>
                <div>
                  <span className="text-slate-500">Nguyên giá</span>
                  <div className="mt-0.5 font-semibold text-blue-700">
                    {formatVND(asset.purchaseValue)}
                  </div>
                </div>
                <div>
                  <span className="text-slate-500">Ngày mua</span>
                  <div className="mt-0.5 font-semibold text-slate-900">
                    {asset.purchaseDate ? formatDateVN(asset.purchaseDate) : '—'}
                  </div>
                </div>
                <div>
                  <span className="text-slate-500">Hạn bảo hành</span>
                  <div className="mt-0.5 font-semibold text-slate-900">
                    {asset.warrantyExpiryDate ? formatDateVN(asset.warrantyExpiryDate) : '—'}
                  </div>
                </div>
                <div>
                  <span className="text-slate-500">Ghi chú</span>
                  <div className="mt-0.5 font-medium text-slate-700">
                    {asset.note ?? '—'}
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Lịch sử Cấp phát & Thu hồi ({assignments.length} lượt)
                </h3>

                {assignments.length === 0 ? (
                  <p className="mt-3 rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                    Thiết bị này chưa từng được cấp phát cho nhân viên nào.
                  </p>
                ) : (
                  <div className="mt-3 space-y-3">
                    {assignments.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-xl border border-slate-200 p-4 text-xs"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900">
                              {item.employeeCode} — {item.employeeName}
                            </span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                item.status === 'ACTIVE'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {item.status === 'ACTIVE' ? 'Đang sử dụng' : 'Đã thu hồi'}
                            </span>
                          </div>

                          <a
                            href={`/api/v1/hrm/admin-ops/assets/assignments/${item.id}/pdf`}
                            className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
                          >
                            <IconDownload size={14} />
                            <span>Biên bản PDF</span>
                          </a>
                        </div>

                        <div className="mt-2 grid gap-1.5 text-slate-600 sm:grid-cols-2">
                          <div>
                            <span className="font-medium text-slate-800">Giao lúc:</span>{' '}
                            {item.assignedAt}
                            {item.assignedByName ? ` (${item.assignedByName})` : ''}
                          </div>
                          <div>
                            <span className="font-medium text-slate-800">Tình trạng giao:</span>{' '}
                            {item.conditionOnAssign}
                          </div>
                          {item.returnedAt && (
                            <>
                              <div>
                                <span className="font-medium text-slate-800">Thu hồi lúc:</span>{' '}
                                {item.returnedAt}
                                {item.returnedByName ? ` (${item.returnedByName})` : ''}
                              </div>
                              <div>
                                <span className="font-medium text-slate-800">Tình trạng nhận:</span>{' '}
                                {item.conditionOnReturn ?? '—'}
                              </div>
                            </>
                          )}
                        </div>
                        {item.note && (
                          <div className="mt-1.5 text-slate-500">Ghi chú: {item.note}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>

        <div className="flex justify-end border-t border-slate-200 px-6 py-4">
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
