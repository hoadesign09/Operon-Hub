'use client';

import { useState, type FormEvent } from 'react';
import { IconX } from '@tabler/icons-react';
import type { AssetCategory, AssetStatus } from '@/config/database';
import type { AssetListItem } from '@/modules/hrm/office/assets.service';
import { useI18n } from '@/shared/i18n/I18nContext';

interface BranchOption {
  id: number;
  code: string;
  name: string;
}

interface AssetFormModalProps {
  mode: 'create' | 'edit';
  asset?: AssetListItem | null;
  defaultBranchId: number | null;
  branches: BranchOption[];
  onClose: () => void;
  onSuccess: () => void;
}

export function AssetFormModal({
  mode,
  asset,
  defaultBranchId,
  branches,
  onClose,
  onSuccess,
}: AssetFormModalProps) {
  const { tr } = useI18n();
  const initialBranch =
    asset?.branchId ?? defaultBranchId ?? branches[0]?.id ?? 0;

  const [branchId, setBranchId] = useState(String(initialBranch || ''));
  const [assetCode, setAssetCode] = useState(asset?.assetCode ?? '');
  const [name, setName] = useState(asset?.name ?? '');
  const [category, setCategory] = useState<AssetCategory>(asset?.category ?? 'LAPTOP');
  const [brand, setBrand] = useState(asset?.brand ?? '');
  const [model, setModel] = useState(asset?.model ?? '');
  const [serialNumber, setSerialNumber] = useState(asset?.serialNumber ?? '');
  const [purchaseDate, setPurchaseDate] = useState(asset?.purchaseDate ?? '');
  const [warrantyExpiryDate, setWarrantyExpiryDate] = useState(
    asset?.warrantyExpiryDate ?? '',
  );
  const [purchaseValue, setPurchaseValue] = useState(
    asset ? String(asset.purchaseValue) : '0',
  );
  const [status, setStatus] = useState<AssetStatus>(asset?.status ?? 'AVAILABLE');
  const [note, setNote] = useState(asset?.note ?? '');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isAssignedLocked = mode === 'edit' && asset?.status === 'ASSIGNED';

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const url =
        mode === 'create'
          ? '/api/v1/hrm/admin-ops/assets'
          : `/api/v1/hrm/admin-ops/assets/${asset?.id}`;
      const method = mode === 'create' ? 'POST' : 'PATCH';

      const payloadBody: Record<string, unknown> = {
        branchId: Number(branchId),
        assetCode: assetCode.trim(),
        name: name.trim(),
        category,
        brand: brand.trim() || null,
        model: model.trim() || null,
        serialNumber: serialNumber.trim() || null,
        purchaseDate: purchaseDate || null,
        warrantyExpiryDate: warrantyExpiryDate || null,
        purchaseValue: Number(purchaseValue) || 0,
        note: note.trim() || null,
      };

      if (!isAssignedLocked) {
        payloadBody.status = status;
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadBody),
      });

      const json = (await res.json()) as {
        success: boolean;
        error?: { message?: string };
      };

      if (!res.ok || !json.success) {
        setErrorMessage(
          json.error?.message ??
            tr('Không thể lưu thông tin tài sản.', 'Unable to save asset information.'),
        );
        setIsSubmitting(false);
        return;
      }

      onSuccess();
    } catch {
      setErrorMessage(
        tr('Lỗi kết nối máy chủ khi lưu tài sản.', 'Server connection error while saving asset.'),
      );
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              {mode === 'create'
                ? tr('Thêm Tài sản / Thiết bị mới', 'Add New Asset / Equipment')
                : tr(`Cập nhật tài sản ${asset?.assetCode}`, `Edit Asset ${asset?.assetCode}`)}
            </h2>
            <p className="text-xs text-slate-500">
              {tr(
                'Quản lý danh mục tài sản, số serial, bảo hành và nguyên giá theo chi nhánh.',
                'Manage asset catalog, serial numbers, warranty, and purchase value by branch.',
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label={tr('Đóng', 'Close')}
          >
            <IconX size={18} />
          </button>
        </div>

        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="flex-1 space-y-4 overflow-y-auto p-6"
        >
          {errorMessage && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">
              {errorMessage}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="text-xs font-semibold text-slate-700">
                {tr('Chi nhánh quản lý *', 'Managing Branch *')}
              </span>
              <select
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                required
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              >
                <option value="">{tr('-- Chọn chi nhánh --', '-- Select branch --')}</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.code})
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-xs font-semibold text-slate-700">
                {tr('Mã tài sản *', 'Asset Code *')}
              </span>
              <input
                type="text"
                required
                value={assetCode}
                onChange={(e) => setAssetCode(e.target.value)}
                placeholder={tr('VD: TS-LT-010', 'e.g. TS-LT-010')}
                maxLength={50}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm uppercase outline-none focus:border-blue-500"
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <label className="space-y-1 sm:col-span-2">
              <span className="text-xs font-semibold text-slate-700">
                {tr('Tên tài sản / Thiết bị *', 'Asset / Equipment Name *')}
              </span>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={tr('VD: MacBook Pro 14 M3 Pro', 'e.g. MacBook Pro 14 M3 Pro')}
                maxLength={200}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs font-semibold text-slate-700">
                {tr('Phân loại *', 'Category *')}
              </span>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as AssetCategory)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              >
                <option value="LAPTOP">{tr('Laptop / Máy tính', 'Laptop / Computer')}</option>
                <option value="MONITOR">{tr('Màn hình', 'Monitor')}</option>
                <option value="PHONE">{tr('Điện thoại / Di động', 'Phone / Mobile')}</option>
                <option value="FURNITURE">{tr('Nội thất văn phòng', 'Office Furniture')}</option>
                <option value="OTHER">{tr('Thiết bị khác', 'Other Equipment')}</option>
              </select>
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <label className="space-y-1">
              <span className="text-xs font-semibold text-slate-700">
                {tr('Hãng sản xuất', 'Manufacturer')}
              </span>
              <input
                type="text"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="Apple, Dell..."
                maxLength={100}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold text-slate-700">Model</span>
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="A2992, XPS-9340..."
                maxLength={100}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold text-slate-700">
                {tr('Số Serial / IMEI', 'Serial Number / IMEI')}
              </span>
              <input
                type="text"
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value)}
                placeholder={tr('S/N thiết bị', 'Device S/N')}
                maxLength={100}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <label className="space-y-1">
              <span className="text-xs font-semibold text-slate-700">
                {tr('Ngày mua', 'Purchase Date')}
              </span>
              <input
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold text-slate-700">
                {tr('Hạn bảo hành', 'Warranty Expiry')}
              </span>
              <input
                type="date"
                value={warrantyExpiryDate}
                onChange={(e) => setWarrantyExpiryDate(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold text-slate-700">
                {tr('Nguyên giá (VNĐ)', 'Purchase Value (VND)')}
              </span>
              <input
                type="number"
                min={0}
                value={purchaseValue}
                onChange={(e) => setPurchaseValue(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="text-xs font-semibold text-slate-700">
                {tr('Trạng thái', 'Status')}
              </span>
              {isAssignedLocked ? (
                <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700">
                  {tr(
                    'Đang cấp phát (Thu hồi thiết bị để đổi trạng thái)',
                    'Assigned (Return asset to change status)',
                  )}
                </div>
              ) : (
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as AssetStatus)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                >
                  <option value="AVAILABLE">{tr('Sẵn sàng cấp phát', 'Available')}</option>
                  <option value="MAINTENANCE">
                    {tr('Đang bảo trì / Sửa chữa', 'Under Maintenance / Repair')}
                  </option>
                  <option value="RETIRED">{tr('Đã thanh lý / Hỏng', 'Retired / Damaged')}</option>
                </select>
              )}
            </label>

            <label className="space-y-1">
              <span className="text-xs font-semibold text-slate-700">
                {tr('Ghi chú', 'Notes')}
              </span>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={tr(
                  'Phụ kiện đi kèm, vị trí lưu kho...',
                  'Included accessories, storage location...',
                )}
                maxLength={2000}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </label>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              {tr('Hủy', 'Cancel')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {isSubmitting
                ? tr('Đang lưu...', 'Saving...')
                : mode === 'create'
                  ? tr('Thêm tài sản', 'Add Asset')
                  : tr('Lưu thay đổi', 'Save Changes')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
