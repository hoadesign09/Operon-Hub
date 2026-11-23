'use client';

import { useState, type FormEvent } from 'react';
import { IconAlertCircle, IconLoader2, IconPin, IconX } from '@tabler/icons-react';
import type { AnnouncementCategory, AnnouncementStatus } from '@/config/database';
import type { AnnouncementItem } from '@/modules/hrm/office/announcements.service';

interface BranchOption {
  id: number;
  code: string;
  name: string;
}

interface AnnouncementFormModalProps {
  branches: BranchOption[];
  canSelectCompanyWide: boolean;
  defaultBranchId: number | null;
  initialData?: AnnouncementItem | null;
  onClose: () => void;
  onSaved: () => void;
}

const CATEGORY_OPTIONS: Array<{ value: AnnouncementCategory; label: string }> = [
  { value: 'GENERAL', label: 'Thông báo chung' },
  { value: 'HR_POLICY', label: 'Chính sách Nhân sự' },
  { value: 'EVENT', label: 'Sự kiện nội bộ' },
  { value: 'URGENT', label: 'Khẩn cấp (gửi thông báo tới toàn bộ NV)' },
];

export function AnnouncementFormModal({
  branches,
  canSelectCompanyWide,
  defaultBranchId,
  initialData,
  onClose,
  onSaved,
}: AnnouncementFormModalProps) {
  const isEdit = Boolean(initialData?.id);
  const [branchId, setBranchId] = useState<string>(
    initialData
      ? initialData.branchId === null
        ? ''
        : String(initialData.branchId)
      : canSelectCompanyWide
        ? ''
        : String(defaultBranchId ?? branches[0]?.id ?? ''),
  );
  const [title, setTitle] = useState(initialData?.title ?? '');
  const [category, setCategory] = useState<AnnouncementCategory>(initialData?.category ?? 'GENERAL');
  const [content, setContent] = useState(initialData?.content ?? '');
  const [isPinned, setIsPinned] = useState<boolean>(initialData?.isPinned ?? false);
  const [status, setStatus] = useState<AnnouncementStatus>(initialData?.status ?? 'DRAFT');
  const [publishNow, setPublishNow] = useState<boolean>(!isEdit);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMessage(null);

    if (title.trim().length < 4) {
      setErrorMessage('Tiêu đề thông báo tối thiểu 4 ký tự.');
      return;
    }
    if (content.trim().length < 10) {
      setErrorMessage('Nội dung thông báo tối thiểu 10 ký tự.');
      return;
    }

    const parsedBranchId = branchId ? Number(branchId) : null;
    if (!canSelectCompanyWide && !parsedBranchId) {
      setErrorMessage('Vui lòng chọn chi nhánh nhận thông báo.');
      return;
    }

    setIsSubmitting(true);
    try {
      const url = isEdit
        ? `/api/v1/hrm/admin-ops/announcements/${initialData?.id}`
        : '/api/v1/hrm/admin-ops/announcements';
      const method = isEdit ? 'PATCH' : 'POST';

      const payload = isEdit
        ? {
            branchId: parsedBranchId,
            title: title.trim(),
            content: content.trim(),
            category,
            isPinned,
            status,
          }
        : {
            branchId: parsedBranchId,
            title: title.trim(),
            content: content.trim(),
            category,
            isPinned,
            publishNow,
          };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = (await res.json().catch(() => null)) as {
        success?: boolean;
        error?: { message?: string };
      } | null;

      if (!res.ok || !json?.success) {
        setErrorMessage(json?.error?.message ?? 'Không thể lưu thông báo nội bộ.');
        return;
      }

      onSaved();
    } catch {
      setErrorMessage('Lỗi kết nối máy chủ. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">
            {isEdit ? 'Chỉnh sửa thông báo nội bộ' : 'Soạn thông báo nội bộ mới'}
          </h2>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
            aria-label="Đóng"
          >
            <IconX size={18} />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4 p-6">
          {errorMessage && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {errorMessage}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Phạm vi phát hành
              </label>
              <select
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              >
                {canSelectCompanyWide && <option value="">Toàn công ty (Tất cả chi nhánh)</option>}
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Phân loại <span className="text-rose-500">*</span>
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as AnnouncementCategory)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              >
                {CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              Tiêu đề thông báo <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="VD: Thông báo lịch nghỉ lễ & trực vận hành hệ thống"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              Nội dung chi tiết <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={8}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
              placeholder="Nhập đầy đủ nội dung thông báo gửi tới CBNV..."
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm leading-relaxed outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-6 rounded-xl bg-slate-50 px-4 py-3">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={isPinned}
                onChange={(e) => setIsPinned(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600"
              />
              <IconPin size={16} className="text-amber-600" />
              <span>Ghim lên đầu bản tin</span>
            </label>

            {!isEdit ? (
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={publishNow}
                  onChange={(e) => setPublishNow(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600"
                />
                <span>Xuất bản ngay lập tức</span>
              </label>
            ) : (
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium text-slate-700">Trạng thái:</span>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as AnnouncementStatus)}
                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium outline-none focus:border-blue-500"
                >
                  <option value="DRAFT">Bản nháp (DRAFT)</option>
                  <option value="PUBLISHED">Đã xuất bản (PUBLISHED)</option>
                  <option value="ARCHIVED">Lưu trữ (ARCHIVED)</option>
                </select>
              </div>
            )}
          </div>

          {category === 'URGENT' && (publishNow || status === 'PUBLISHED') && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
              <IconAlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>
                Thông báo phân loại <strong>Khẩn cấp</strong> khi xuất bản sẽ tự động gửi thông báo
                in-app tới Chuông thông báo của toàn bộ nhân viên thuộc phạm vi nhận tin.
              </span>
            </div>
          )}

          <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {isSubmitting && <IconLoader2 size={16} className="animate-spin" />}
              <span>
                {isEdit ? 'Lưu thay đổi' : publishNow ? 'Xuất bản thông báo' : 'Lưu bản nháp'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
