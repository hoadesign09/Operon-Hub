'use client';

import { useState, type FormEvent } from 'react';
import { IconX } from '@tabler/icons-react';
import type { AssetCategory, AssetStatus } from '@/config/database';
import type { AssetListItem } from '@/modules/hrm/office/assets.service';

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
        setErrorMessage(json.error?.message ?? 'Không thể lưu thông tin tài sản.');
        setIsSubmitting(false);
        return;
      }

      onSuccess();
    } catch {
      setErrorMessage('Lỗi kết nối máy chủ khi lưu tài sản.');
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              {mode === 'create' ? 'Thêm Tài sản / Thiết bị mới' : `Cập nhật tài sản ${asset?.assetCode}`}
            </h2>
            <p className="text-xs text-slate-500">
              Quản lý danh mục tài sản, số serial, bảo hành và nguyên giá theo chi nhánh.
            </p>
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
              <span className="text-xs font-semibold text-slate-700">Chi nhánh quản lý *</span>
              <select
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                required
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              >
                <option value="">-- Chọn chi nhánh --</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.code})
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-xs font-semibold text-slate-700">Mã tài sản *</span>
              <input
                type="text"
                required
                value={assetCode}
                onChange={(e) => setAssetCode(e.target.value)}
                placeholder="VD: TS-LT-010"
                maxLength={50}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm uppercase outline-none focus:border-blue-500"
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <label className="space-y-1 sm:col-span-2">
              <span className="text-xs font-semibold text-slate-700">Tên tài sản / Thiết bị *</span>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="VD: MacBook Pro 14 M3 Pro"
                maxLength={200}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs font-semibold text-slate-700">Phân loại *</span>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as AssetCategory)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              >
                <option value="LAPTOP">Laptop / Máy tính</option>
                <option value="MONITOR">Màn hình</option>
                <option value="PHONE">Điện thoại / Di động</option>
                <option value="FURNITURE">Nội thất văn phòng</option>
                <option value="OTHER">Thiết bị khác</option>
              </select>
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <label className="space-y-1">
              <span className="text-xs font-semibold text-slate-700">Hãng sản xuất</span>
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
              <span className="text-xs font-semibold text-slate-700">Số Serial / IMEI</span>
              <input
                type="text"
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value)}
                placeholder="S/N thiết bị"
                maxLength={100}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <label className="space-y-1">
              <span className="text-xs font-semibold text-slate-700">Ngày mua</span>
              <input
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold text-slate-700">Hạn bảo hành</span>
              <input
                type="date"
                value={warrantyExpiryDate}
                onChange={(e) => setWarrantyExpiryDate(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold text-slate-700">Nguyên giá (VNĐ)</span>
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
              <span className="text-xs font-semibold text-slate-700">Trạng thái</span>
              {isAssignedLocked ? (
                <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700">
                  Đang cấp phát (Thu hồi thiết bị để đổi trạng thái)
                </div>
              ) : (
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as AssetStatus)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                >
                  <option value="AVAILABLE">Sẵn sàng cấp phát</option>
                  <option value="MAINTENANCE">Đang bảo trì / Sửa chữa</option>
                  <option value="RETIRED">Đã thanh lý / Hỏng</option>
                </select>
              )}
            </label>

            <label className="space-y-1">
              <span className="text-xs font-semibold text-slate-700">Ghi chú</span>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Phụ kiện đi kèm, vị trí lưu kho..."
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
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {isSubmitting
                ? 'Đang lưu...'
                : mode === 'create'
                  ? 'Thêm tài sản'
                  : 'Lưu thay đổi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
