'use client';

import { useState, type FormEvent } from 'react';
import { IconAlertCircle, IconLoader2, IconPin, IconX } from '@tabler/icons-react';
import type { AnnouncementCategory, AnnouncementStatus } from '@/config/database';
import type { AnnouncementItem } from '@/modules/hrm/office/announcements.service';
import { useI18n } from '@/shared/i18n/I18nContext';

interface BranchOption {
  id: number;
  code: string;
  name: string;
  nameEn?: string | null;
}

interface AnnouncementFormModalProps {
  branches: BranchOption[];
  canSelectCompanyWide: boolean;
  defaultBranchId: number | null;
  initialData?: AnnouncementItem | null;
  onClose: () => void;
  onSaved: () => void;
}

const CATEGORY_OPTIONS: Array<{
  value: AnnouncementCategory;
  label: { vi: string; en: string };
}> = [
  { value: 'GENERAL', label: { vi: 'Thông báo chung', en: 'General Announcement' } },
  { value: 'HR_POLICY', label: { vi: 'Chính sách Nhân sự', en: 'HR Policy' } },
  { value: 'EVENT', label: { vi: 'Sự kiện nội bộ', en: 'Internal Event' } },
  {
    value: 'URGENT',
    label: {
      vi: 'Khẩn cấp (gửi thông báo tới toàn bộ NV)',
      en: 'Urgent (notifies all employees)',
    },
  },
];

export function AnnouncementFormModal({
  branches,
  canSelectCompanyWide,
  defaultBranchId,
  initialData,
  onClose,
  onSaved,
}: AnnouncementFormModalProps) {
  const { locale, tr, ln } = useI18n();
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
      setErrorMessage(
        tr('Tiêu đề thông báo tối thiểu 4 ký tự.', 'Announcement title must be at least 4 characters.'),
      );
      return;
    }
    if (content.trim().length < 10) {
      setErrorMessage(
        tr(
          'Nội dung thông báo tối thiểu 10 ký tự.',
          'Announcement content must be at least 10 characters.',
        ),
      );
      return;
    }

    const parsedBranchId = branchId ? Number(branchId) : null;
    if (!canSelectCompanyWide && !parsedBranchId) {
      setErrorMessage(
        tr(
          'Vui lòng chọn chi nhánh nhận thông báo.',
          'Please select a target branch for the announcement.',
        ),
      );
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
        setErrorMessage(
          json?.error?.message ??
            tr('Không thể lưu thông báo nội bộ.', 'Unable to save internal announcement.'),
        );
        return;
      }

      onSaved();
    } catch {
      setErrorMessage(
        tr('Lỗi kết nối máy chủ. Vui lòng thử lại.', 'Server connection error. Please try again.'),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">
            {isEdit
              ? tr('Chỉnh sửa thông báo nội bộ', 'Edit Internal Announcement')
              : tr('Soạn thông báo nội bộ mới', 'Create Internal Announcement')}
          </h2>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
            aria-label={tr('Đóng', 'Close')}
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
                {tr('Phạm vi phát hành', 'Publish Scope')}
              </label>
              <select
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              >
                {canSelectCompanyWide && (
                  <option value="">
                    {tr('Toàn công ty (Tất cả chi nhánh)', 'Company-wide (All branches)')}
                  </option>
                )}
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {ln(b.name, b.nameEn)} ({b.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                {tr('Phân loại', 'Category')} <span className="text-rose-500">*</span>
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as AnnouncementCategory)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              >
                {CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label[locale]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              {tr('Tiêu đề thông báo', 'Announcement Title')}{' '}
              <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder={tr(
                'VD: Thông báo lịch nghỉ lễ & trực vận hành hệ thống',
                'e.g. Holiday schedule & system on-call notice',
              )}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              {tr('Nội dung chi tiết', 'Detailed Content')}{' '}
              <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={8}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
              placeholder={tr(
                'Nhập đầy đủ nội dung thông báo gửi tới CBNV...',
                'Enter full announcement details for employees...',
              )}
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
              <span>{tr('Ghim lên đầu bản tin', 'Pin to top of feed')}</span>
            </label>

            {!isEdit ? (
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={publishNow}
                  onChange={(e) => setPublishNow(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600"
                />
                <span>{tr('Xuất bản ngay lập tức', 'Publish immediately')}</span>
              </label>
            ) : (
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium text-slate-700">{tr('Trạng thái:', 'Status:')}</span>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as AnnouncementStatus)}
                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium outline-none focus:border-blue-500"
                >
                  <option value="DRAFT">{tr('Bản nháp (DRAFT)', 'Draft (DRAFT)')}</option>
                  <option value="PUBLISHED">
                    {tr('Đã xuất bản (PUBLISHED)', 'Published (PUBLISHED)')}
                  </option>
                  <option value="ARCHIVED">{tr('Lưu trữ (ARCHIVED)', 'Archived (ARCHIVED)')}</option>
                </select>
              </div>
            )}
          </div>

          {category === 'URGENT' && (publishNow || status === 'PUBLISHED') && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
              <IconAlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>
                {locale === 'en' ? (
                  <>
                    Publishing an <strong>Urgent</strong> announcement automatically sends an in-app
                    notification bell alert to all employees within the target scope.
                  </>
                ) : (
                  <>
                    Thông báo phân loại <strong>Khẩn cấp</strong> khi xuất bản sẽ tự động gửi thông
                    báo in-app tới Chuông thông báo của toàn bộ nhân viên thuộc phạm vi nhận tin.
                  </>
                )}
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
              {tr('Hủy', 'Cancel')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {isSubmitting && <IconLoader2 size={16} className="animate-spin" />}
              <span>
                {isEdit
                  ? tr('Lưu thay đổi', 'Save Changes')
                  : publishNow
                    ? tr('Xuất bản thông báo', 'Publish Announcement')
                    : tr('Lưu bản nháp', 'Save Draft')}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
