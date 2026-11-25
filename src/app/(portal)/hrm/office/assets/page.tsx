'use client';

import { useEffect, useRef, useState } from 'react';
import {
  IconAlertTriangle,
  IconArrowBackUp,
  IconEdit,
  IconEye,
  IconFileSpreadsheet,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconTrash,
  IconUserPlus,
} from '@tabler/icons-react';
import { AssetAssignReturnModal } from '@/components/hrm/AssetAssignReturnModal';
import { AssetDetailModal } from '@/components/hrm/AssetDetailModal';
import { AssetFormModal } from '@/components/hrm/AssetFormModal';
import { usePortalAuth } from '@/components/portal/PortalAuthContext';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { formatVND } from '@/lib/portable/currency-utils';
import type {
  AssetInventoryStats,
  AssetListItem,
  OffboardingAssetAlertItem,
} from '@/modules/hrm/office/assets.service';
import { useI18n } from '@/shared/i18n/I18nContext';

const CATEGORY_LABELS: Record<AssetListItem['category'], { vi: string; en: string }> = {
  LAPTOP: { vi: 'Laptop', en: 'Laptop' },
  MONITOR: { vi: 'Màn hình', en: 'Monitor' },
  PHONE: { vi: 'Điện thoại', en: 'Phone' },
  FURNITURE: { vi: 'Nội thất', en: 'Furniture' },
  OTHER: { vi: 'Khác', en: 'Other' },
};

const STATUS_BADGES: Record<
  AssetListItem['status'],
  { vi: string; en: string; className: string }
> = {
  AVAILABLE: { vi: 'Sẵn sàng', en: 'Available', className: 'bg-emerald-100 text-emerald-800' },
  ASSIGNED: { vi: 'Đang cấp phát', en: 'Assigned', className: 'bg-blue-100 text-blue-800' },
  MAINTENANCE: { vi: 'Bảo trì', en: 'Maintenance', className: 'bg-amber-100 text-amber-800' },
  RETIRED: { vi: 'Thanh lý', en: 'Retired', className: 'bg-slate-100 text-slate-600' },
};

export default function HrmAssetsPage() {
  const { locale, tr, ln } = useI18n();
  const trRef = useRef(tr);
  useEffect(() => {
    trRef.current = tr;
  }, [tr]);

  const { user, selectedBranchId } = usePortalAuth();
  const canManage = Boolean(
    user?.isSuperAdmin || user?.permissions.includes('hrm.assets.manage'),
  );
  const canExport = Boolean(
    user?.isSuperAdmin || user?.permissions.includes('hrm.assets.export'),
  );

  const [items, setItems] = useState<AssetListItem[]>([]);
  const [stats, setStats] = useState<AssetInventoryStats>({
    total: 0,
    available: 0,
    assigned: 0,
    maintenance: 0,
    retired: 0,
    totalValue: 0,
  });
  const [offboardingAlerts, setOffboardingAlerts] = useState<
    OffboardingAssetAlertItem[]
  >([]);

  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  const [formModalState, setFormModalState] = useState<{
    mode: 'create' | 'edit';
    asset: AssetListItem | null;
  } | null>(null);
  const [assignReturnState, setAssignReturnState] = useState<{
    mode: 'assign' | 'return';
    asset: AssetListItem;
  } | null>(null);
  const [detailAssetId, setDetailAssetId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AssetListItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [feedbackErr, setFeedbackErr] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ limit: '100' });
    if (selectedBranchId) params.set('branchId', String(selectedBranchId));
    if (categoryFilter) params.set('category', categoryFilter);
    if (statusFilter) params.set('status', statusFilter);
    if (search.trim()) params.set('search', search.trim());

    Promise.all([
      fetch(`/api/v1/hrm/admin-ops/assets?${params.toString()}`, {
        signal: controller.signal,
      }),
      fetch('/api/v1/hrm/admin-ops/assets/offboarding-alerts', {
        signal: controller.signal,
      }),
    ])
      .then(async ([assetsRes, alertsRes]) => {
        const assetsJson = (await assetsRes.json()) as {
          success: boolean;
          data?: { items: AssetListItem[]; stats: AssetInventoryStats };
          error?: { message?: string };
        };
        if (!assetsRes.ok || !assetsJson.success || !assetsJson.data) {
          throw new Error(
            assetsJson.error?.message ??
              trRef.current('Không thể tải danh sách tài sản.', 'Failed to load asset inventory.'),
          );
        }
        setItems(assetsJson.data.items);
        setStats(assetsJson.data.stats);
        setErrorMessage(null);

        if (alertsRes.ok) {
          const alertsJson = (await alertsRes.json()) as {
            success: boolean;
            data?: { items: OffboardingAssetAlertItem[] };
          };
          if (alertsJson.success && alertsJson.data?.items) {
            setOffboardingAlerts(alertsJson.data.items);
          }
        }
      })
      .catch((err: unknown) => {
        if ((err as { name?: string })?.name === 'AbortError') return;
        setErrorMessage(
          err instanceof Error
            ? err.message
            : trRef.current('Lỗi tải kho tài sản.', 'Error loading asset inventory.'),
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => controller.abort();
  }, [selectedBranchId, categoryFilter, statusFilter, search, reloadTick]);

  function triggerReload() {
    setIsLoading(true);
    setReloadTick((t) => t + 1);
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setFeedbackErr(null);

    try {
      const res = await fetch(`/api/v1/hrm/admin-ops/assets/${deleteTarget.id}`, {
        method: 'DELETE',
      });
      const json = (await res.json()) as {
        success: boolean;
        error?: { message?: string };
      };
      if (!res.ok || !json.success) {
        setFeedbackErr(json.error?.message ?? tr('Không thể xóa tài sản.', 'Failed to delete asset.'));
      } else {
        setFeedbackMsg(
          tr(`Đã xóa tài sản ${deleteTarget.assetCode}.`, `Asset ${deleteTarget.assetCode} deleted.`),
        );
        triggerReload();
      }
    } catch {
      setFeedbackErr(tr('Lỗi kết nối khi xóa tài sản.', 'Connection error while deleting asset.'));
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  }

  const exportParams = new URLSearchParams();
  if (selectedBranchId) exportParams.set('branchId', String(selectedBranchId));
  if (categoryFilter) exportParams.set('category', categoryFilter);
  if (statusFilter) exportParams.set('status', statusFilter);
  if (search.trim()) exportParams.set('search', search.trim());

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {tr('Kho Tài sản & Cấp phát Thiết bị', 'Assets & Equipment')}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {tr(
              'Quản lý danh mục thiết bị công ty, cấp phát/thu hồi kèm biên bản PDF và cảnh báo thu hồi khi nhân sự nghỉ việc.',
              'Manage company equipment inventory, assign/return assets with PDF handover receipts, and track offboarding recovery alerts.',
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canExport && (
            <a
              href={`/api/v1/hrm/admin-ops/assets/export?${exportParams.toString()}`}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <IconFileSpreadsheet size={16} />
              <span>{tr('Xuất Excel', 'Export Excel')}</span>
            </a>
          )}
          {canManage && (
            <button
              type="button"
              onClick={() => setFormModalState({ mode: 'create', asset: null })}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <IconPlus size={16} />
              <span>{tr('Thêm tài sản', 'Add Asset')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Offboarding Unreturned Assets Alert Banner */}
      {offboardingAlerts.length > 0 && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-bold text-amber-900">
            <IconAlertTriangle size={18} />
            <span>
              {tr(
                `Cảnh báo Offboarding: Có ${offboardingAlerts.length} thiết bị chưa thu hồi từ nhân sự đã nghỉ việc!`,
                `Offboarding Alerts: ${offboardingAlerts.length} unreturned asset(s) held by offboarded employees!`,
              )}
            </span>
          </div>
          <div className="mt-2 space-y-1.5">
            {offboardingAlerts.map((alert) => {
              const matchedAsset = items.find((i) => i.id === alert.assetId);
              return (
                <div
                  key={alert.assignmentId}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/80 px-3 py-2 text-xs text-amber-950"
                >
                  <div>
                    <span className="font-bold">{alert.assetCode}</span> ({alert.assetName}) —{' '}
                    {tr('đang do', 'currently held by')}{' '}
                    <span className="font-semibold">
                      {alert.employeeCode} {alert.employeeName}
                    </span>{' '}
                    ({alert.departmentName}) {tr('giữ từ', 'since')} {alert.assignedAt}.
                  </div>
                  {canManage && matchedAsset && (
                    <button
                      type="button"
                      onClick={() =>
                        setAssignReturnState({ mode: 'return', asset: matchedAsset })
                      }
                      className="rounded-lg bg-amber-600 px-2.5 py-1 font-semibold text-white hover:bg-amber-700"
                    >
                      {tr('Thu hồi ngay', 'Return Now')}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 5 KPI Cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs text-slate-500">{tr('Tổng tài sản', 'Total Assets')}</div>
          <div className="mt-1 text-xl font-bold text-slate-900">{stats.total}</div>
          <div className="mt-0.5 text-[11px] text-slate-500">
            {tr('Giá trị:', 'Value:')} {formatVND(stats.totalValue)}
          </div>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-sm">
          <div className="text-xs text-emerald-700">{tr('Sẵn sàng cấp phát', 'Available')}</div>
          <div className="mt-1 text-xl font-bold text-emerald-800">{stats.available}</div>
        </div>
        <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-4 shadow-sm">
          <div className="text-xs text-blue-700">{tr('Đang cấp phát', 'Assigned')}</div>
          <div className="mt-1 text-xl font-bold text-blue-800">{stats.assigned}</div>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 shadow-sm">
          <div className="text-xs text-amber-700">{tr('Đang bảo trì', 'In Maintenance')}</div>
          <div className="mt-1 text-xl font-bold text-amber-800">{stats.maintenance}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
          <div className="text-xs text-slate-500">{tr('Đã thanh lý', 'Retired')}</div>
          <div className="mt-1 text-xl font-bold text-slate-700">{stats.retired}</div>
        </div>
      </div>

      {feedbackMsg && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {feedbackMsg}
        </div>
      )}
      {feedbackErr && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {feedbackErr}
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="relative min-w-[220px] flex-1">
          <IconSearch
            size={16}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setIsLoading(true);
            }}
            placeholder={tr(
              'Tìm theo mã TS, tên thiết bị, số serial, tên NV...',
              'Search by asset code, name, serial, employee...',
            )}
            className="w-full rounded-xl border border-slate-300 py-2 pr-3 pl-9 text-sm outline-none focus:border-blue-500"
          />
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => {
            setCategoryFilter(e.target.value);
            setIsLoading(true);
          }}
          className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500"
        >
          <option value="">{tr('Tất cả loại', 'All Categories')}</option>
          <option value="LAPTOP">{tr('Laptop / Máy tính', 'Laptop / Computer')}</option>
          <option value="MONITOR">{tr('Màn hình', 'Monitor')}</option>
          <option value="PHONE">{tr('Điện thoại', 'Phone')}</option>
          <option value="FURNITURE">{tr('Nội thất', 'Furniture')}</option>
          <option value="OTHER">{tr('Khác', 'Other')}</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setIsLoading(true);
          }}
          className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500"
        >
          <option value="">{tr('Tất cả trạng thái', 'All Statuses')}</option>
          <option value="AVAILABLE">{tr('Sẵn sàng', 'Available')}</option>
          <option value="ASSIGNED">{tr('Đang cấp phát', 'Assigned')}</option>
          <option value="MAINTENANCE">{tr('Đang bảo trì', 'Maintenance')}</option>
          <option value="RETIRED">{tr('Đã thanh lý', 'Retired')}</option>
        </select>
      </div>

      {/* Assets Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {isLoading ? (
          <div className="space-y-3 p-6">
            <div className="h-12 animate-pulse rounded-xl bg-slate-100" />
            <div className="h-12 animate-pulse rounded-xl bg-slate-100" />
            <div className="h-12 animate-pulse rounded-xl bg-slate-100" />
          </div>
        ) : errorMessage ? (
          <div className="p-8 text-center">
            <p className="text-sm text-rose-700">{errorMessage}</p>
            <button
              type="button"
              onClick={triggerReload}
              className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-medium text-white"
            >
              <IconRefresh size={14} />
              <span>{tr('Thử lại', 'Retry')}</span>
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm font-semibold text-slate-700">
              {tr('Không tìm thấy tài sản nào phù hợp bộ lọc.', 'No assets match the current filters.')}
            </p>
            {canManage && (
              <button
                type="button"
                onClick={() => setFormModalState({ mode: 'create', asset: null })}
                className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                <IconPlus size={16} />
                <span>{tr('Thêm tài sản mới', 'Add New Asset')}</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">{tr('Tài sản', 'Asset')}</th>
                  <th className="px-4 py-3">{tr('Loại / Serial', 'Category / Serial')}</th>
                  <th className="px-4 py-3">{tr('Chi nhánh', 'Branch')}</th>
                  <th className="px-4 py-3 text-right">{tr('Nguyên giá', 'Purchase Value')}</th>
                  <th className="px-4 py-3">{tr('Trạng thái', 'Status')}</th>
                  <th className="px-4 py-3">{tr('Người đang giữ', 'Assigned To')}</th>
                  <th className="px-4 py-3 text-right">{tr('Thao tác', 'Actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((asset) => {
                  const badge = STATUS_BADGES[asset.status];
                  const categoryLabel = CATEGORY_LABELS[asset.category];
                  return (
                    <tr key={asset.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">
                          {asset.assetCode} — {asset.name}
                        </div>
                        <div className="text-xs text-slate-500">
                          {[asset.brand, asset.model].filter(Boolean).join(' • ') || '—'}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs font-medium text-slate-800">
                          {locale === 'en' ? categoryLabel.en : categoryLabel.vi}
                        </div>
                        <div className="text-xs text-slate-500">
                          S/N: {asset.serialNumber ?? '—'}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {ln(asset.branchName, asset.branchNameEn)}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-slate-800 whitespace-nowrap">
                        {formatVND(asset.purchaseValue)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${badge.className}`}
                        >
                          {locale === 'en' ? badge.en : badge.vi}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {asset.holderEmployeeName ? (
                          <div>
                            <div className="text-xs font-semibold text-slate-900">
                              {asset.holderEmployeeCode} — {asset.holderEmployeeName}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {tr('Từ', 'Since')} {asset.assignedAt ?? '—'}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          {canManage && asset.status === 'AVAILABLE' && (
                            <button
                              type="button"
                              onClick={() =>
                                setAssignReturnState({ mode: 'assign', asset })
                              }
                              className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
                            >
                              <IconUserPlus size={14} />
                              <span>{tr('Cấp phát', 'Assign')}</span>
                            </button>
                          )}
                          {canManage && asset.status === 'ASSIGNED' && (
                            <button
                              type="button"
                              onClick={() =>
                                setAssignReturnState({ mode: 'return', asset })
                              }
                              className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
                            >
                              <IconArrowBackUp size={14} />
                              <span>{tr('Thu hồi', 'Return')}</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setDetailAssetId(asset.id)}
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                            title={tr('Chi tiết & Lịch sử', 'Details & History')}
                          >
                            <IconEye size={16} />
                          </button>
                          {canManage && (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  setFormModalState({ mode: 'edit', asset })
                                }
                                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-blue-600"
                                title={tr('Sửa tài sản', 'Edit Asset')}
                              >
                                <IconEdit size={16} />
                              </button>
                              {asset.status !== 'ASSIGNED' && (
                                <button
                                  type="button"
                                  onClick={() => setDeleteTarget(asset)}
                                  className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                                  title={tr('Xóa tài sản', 'Delete Asset')}
                                >
                                  <IconTrash size={16} />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {formModalState && user && (
        <AssetFormModal
          key={`${formModalState.mode}-${formModalState.asset?.id ?? 'new'}`}
          mode={formModalState.mode}
          asset={formModalState.asset}
          defaultBranchId={selectedBranchId}
          branches={user.branches}
          onClose={() => setFormModalState(null)}
          onSuccess={() => {
            setFormModalState(null);
            setFeedbackMsg(
              tr('Đã lưu thông tin tài sản thành công.', 'Asset information saved successfully.'),
            );
            triggerReload();
          }}
        />
      )}

      {assignReturnState && (
        <AssetAssignReturnModal
          key={`${assignReturnState.mode}-${assignReturnState.asset.id}`}
          mode={assignReturnState.mode}
          asset={assignReturnState.asset}
          onClose={() => setAssignReturnState(null)}
          onSuccess={() => {
            const label =
              assignReturnState.mode === 'assign'
                ? tr(
                    `Đã cấp phát tài sản ${assignReturnState.asset.assetCode} thành công.`,
                    `Asset ${assignReturnState.asset.assetCode} assigned successfully.`,
                  )
                : tr(
                    `Đã thu hồi tài sản ${assignReturnState.asset.assetCode} thành công.`,
                    `Asset ${assignReturnState.asset.assetCode} returned successfully.`,
                  );
            setAssignReturnState(null);
            setFeedbackMsg(label);
            triggerReload();
          }}
        />
      )}

      {detailAssetId !== null && (
        <AssetDetailModal
          key={`detail-${detailAssetId}`}
          assetId={detailAssetId}
          onClose={() => setDetailAssetId(null)}
        />
      )}

      <ConfirmModal
        isOpen={deleteTarget !== null}
        title={tr('Xác nhận xóa tài sản?', 'Delete Asset?')}
        description={tr(
          `Xóa mềm tài sản "${deleteTarget?.assetCode ?? ''} — ${deleteTarget?.name ?? ''}" khỏi kho quản lý.`,
          `Soft delete asset "${deleteTarget?.assetCode ?? ''} — ${deleteTarget?.name ?? ''}" from inventory.`,
        )}
        confirmLabel={tr('Xóa tài sản', 'Delete Asset')}
        cancelLabel={tr('Hủy', 'Cancel')}
        variant="danger"
        isProcessing={isDeleting}
        onConfirm={() => void handleDeleteConfirm()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
