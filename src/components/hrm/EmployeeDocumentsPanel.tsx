'use client';

import { useRef, useState, type FormEvent } from 'react';
import {
  IconDownload,
  IconFileText,
  IconLoader2,
  IconTrash,
  IconUpload,
} from '@tabler/icons-react';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { formatDateVN } from '@/lib/portable/date-utils';

export interface EmployeeDocumentView {
  id: number;
  employeeId: number;
  docType: 'ID_CARD' | 'DEGREE' | 'CONTRACT' | 'HEALTH_CERT' | 'OTHER';
  title: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  expiredAt: string | null;
  createdAt: string;
}

const DOC_TYPE_LABELS: Record<EmployeeDocumentView['docType'], string> = {
  ID_CARD: 'CCCD / Hộ chiếu',
  DEGREE: 'Bằng cấp / Chứng chỉ',
  CONTRACT: 'Hợp đồng lao động',
  HEALTH_CERT: 'Giấy khám sức khỏe',
  OTHER: 'Tài liệu khác',
};

const MAX_SIZE_BYTES = 5 * 1024 * 1024;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function isExpiredDate(isoDate: string | null): boolean {
  if (!isoDate) return false;
  const todayIso = new Date().toISOString().slice(0, 10);
  return isoDate < todayIso;
}

interface EmployeeDocumentsPanelProps {
  employeeId: number;
  documents: EmployeeDocumentView[];
  canManage: boolean;
  onChanged: () => void;
}

export function EmployeeDocumentsPanel({
  employeeId,
  documents,
  canManage,
  onChanged,
}: EmployeeDocumentsPanelProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [docType, setDocType] = useState<EmployeeDocumentView['docType']>('ID_CARD');
  const [title, setTitle] = useState('');
  const [expiredAt, setExpiredAt] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [deletingDoc, setDeletingDoc] = useState<EmployeeDocumentView | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleUpload(e: FormEvent) {
    e.preventDefault();
    if (!selectedFile || isUploading) {
      return;
    }

    if (selectedFile.size > MAX_SIZE_BYTES) {
      setUploadError('Dung lượng tệp vượt quá giới hạn tối đa 5 MB.');
      return;
    }

    setUploadError(null);
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('docType', docType);
      formData.append('title', title.trim() || selectedFile.name);
      if (expiredAt) {
        formData.append('expiredAt', expiredAt);
      }

      const res = await fetch(`/api/v1/hrm/employees/${employeeId}/documents`, {
        method: 'POST',
        body: formData,
      });

      const json = (await res.json()) as {
        success: boolean;
        error?: { message?: string };
      };

      if (!res.ok || !json.success) {
        setUploadError(json.error?.message ?? 'Không thể tải tệp lên hệ thống.');
        return;
      }

      setTitle('');
      setExpiredAt('');
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      onChanged();
    } catch {
      setUploadError('Lỗi kết nối khi tải tệp tài liệu.');
    } finally {
      setIsUploading(false);
    }
  }

  async function handleConfirmDelete() {
    if (!deletingDoc || isDeleting) {
      return;
    }
    setIsDeleting(true);
    try {
      const res = await fetch(
        `/api/v1/hrm/employees/${employeeId}/documents/${deletingDoc.id}`,
        { method: 'DELETE' },
      );
      if (res.ok) {
        setDeletingDoc(null);
        onChanged();
      }
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="space-y-5">
      {canManage && (
        <form
          onSubmit={(e) => void handleUpload(e)}
          className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4"
        >
          <div className="mb-3 text-sm font-semibold text-slate-900">
            Tải lên Tài liệu Hồ sơ mới (PDF, Ảnh, DOCX, XLSX — tối đa 5 MB)
          </div>

          {uploadError && (
            <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {uploadError}
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Loại tài liệu</label>
              <select
                value={docType}
                onChange={(e) =>
                  setDocType(e.target.value as EmployeeDocumentView['docType'])
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs outline-none focus:border-blue-500"
              >
                {Object.entries(DOC_TYPE_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Tên hiển thị <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="VD: CCCD mặt trước & sau"
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Ngày hết hạn (nếu có)
              </label>
              <input
                type="date"
                value={expiredAt}
                onChange={(e) => setExpiredAt(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Chọn tệp <span className="text-rose-500">*</span>
              </label>
              <input
                ref={fileInputRef}
                type="file"
                required
                accept=".pdf,.jpg,.jpeg,.png,.webp,.docx,.xlsx"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  setSelectedFile(f);
                  if (f && !title.trim()) {
                    setTitle(f.name);
                  }
                }}
                className="block w-full rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700"
              />
            </div>
          </div>

          <div className="mt-3 flex justify-end">
            <button
              type="submit"
              disabled={isUploading || !selectedFile}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {isUploading ? (
                <IconLoader2 size={15} className="animate-spin" />
              ) : (
                <IconUpload size={15} />
              )}
              <span>{isUploading ? 'Đang tải lên...' : 'Tải lên tài liệu'}</span>
            </button>
          </div>
        </form>
      )}

      {documents.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <IconFileText size={32} className="mx-auto text-slate-300" />
          <p className="mt-2 text-sm font-medium text-slate-700">Chưa có tài liệu hồ sơ nào</p>
          <p className="mt-1 text-xs text-slate-500">
            {canManage
              ? 'Sử dụng khung tải lên phía trên để lưu CCCD, bằng cấp hoặc hợp đồng scan.'
              : 'Phòng Nhân sự chưa đính kèm tài liệu vào hồ sơ này.'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Tài liệu</th>
                <th className="px-4 py-3">Phân loại</th>
                <th className="px-4 py-3">Dung lượng</th>
                <th className="px-4 py-3">Hạn hiệu lực</th>
                <th className="px-4 py-3">Ngày tải lên</th>
                <th className="px-4 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {documents.map((doc) => {
                const expired = isExpiredDate(doc.expiredAt);
                return (
                  <tr key={doc.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{doc.title}</div>
                      <div className="max-w-xs truncate text-xs text-slate-500" title={doc.fileName}>
                        {doc.fileName}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                        {DOC_TYPE_LABELS[doc.docType]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {formatFileSize(doc.fileSize)}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {doc.expiredAt ? (
                        <span
                          className={`rounded-lg px-2 py-0.5 font-medium ${
                            expired
                              ? 'bg-rose-50 text-rose-700'
                              : 'bg-emerald-50 text-emerald-700'
                          }`}
                        >
                          {formatDateVN(doc.expiredAt)} {expired ? '(Hết hạn)' : ''}
                        </span>
                      ) : (
                        <span className="text-slate-400">Không giới hạn</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {formatDateVN(doc.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <a
                          href={`/api/v1/hrm/employees/${employeeId}/documents/${doc.id}/download`}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          <IconDownload size={14} />
                          <span>Tải về</span>
                        </a>
                        {canManage && (
                          <button
                            type="button"
                            onClick={() => setDeletingDoc(doc)}
                            className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-white px-2.5 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50"
                          >
                            <IconTrash size={14} />
                            <span>Xóa</span>
                          </button>
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

      <ConfirmModal
        isOpen={deletingDoc !== null}
        title="Xác nhận xóa tài liệu hồ sơ"
        description={
          deletingDoc
            ? `Bạn có chắc muốn xóa tài liệu "${deletingDoc.title}" khỏi hồ sơ nhân viên này?`
            : ''
        }
        confirmLabel="Xóa tài liệu"
        isProcessing={isDeleting}
        onCancel={() => setDeletingDoc(null)}
        onConfirm={() => void handleConfirmDelete()}
      />
    </div>
  );
}
