'use client';

import { useState, type FormEvent } from 'react';
import {
  IconCheck,
  IconDownload,
  IconFileSpreadsheet,
  IconLoader2,
  IconUpload,
  IconX,
} from '@tabler/icons-react';

interface ImportErrorItem {
  rowNumber: number;
  employeeCode: string;
  workDate: string;
  message: string;
}

interface ImportSummaryData {
  totalRows: number;
  createdCount: number;
  updatedCount: number;
  errorCount: number;
  errors: ImportErrorItem[];
}

interface AttendanceImportModalProps {
  onClose: () => void;
  onImported: () => void;
}

export function AttendanceImportModal({
  onClose,
  onImported,
}: AttendanceImportModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [summary, setSummary] = useState<ImportSummaryData | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setSummary(null);

    if (!selectedFile) {
      setErrorMsg('Vui lòng chọn file Excel (.xlsx) để import.');
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const res = await fetch('/api/v1/hrm/attendance/import', {
        method: 'POST',
        body: formData,
      });
      const json = (await res.json()) as {
        success: boolean;
        data?: ImportSummaryData;
        error?: { message?: string };
      };

      if (!res.ok || !json.success || !json.data) {
        setErrorMsg(json.error?.message ?? 'Import file chấm công thất bại.');
        setIsUploading(false);
        return;
      }

      setSummary(json.data);
      setIsUploading(false);
      if (json.data.createdCount > 0 || json.data.updatedCount > 0) {
        onImported();
      }
    } catch {
      setErrorMsg('Lỗi kết nối máy chủ khi tải file Excel.');
      setIsUploading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-2">
            <IconFileSpreadsheet size={20} className="text-emerald-600" />
            <h3 className="text-base font-semibold text-slate-900">
              Import Dữ liệu Chấm công từ Excel (.xlsx)
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isUploading}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Đóng"
          >
            <IconX size={18} />
          </button>
        </div>

        <div className="space-y-4 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-100 bg-blue-50/70 p-3.5 text-xs text-slate-700">
            <div>
              <p className="font-semibold text-blue-900">Cấu trúc file chuẩn (.xlsx, tối đa 5MB)</p>
              <p className="mt-0.5 text-slate-600">
                Các cột: <span className="font-medium">Mã NV</span>,{' '}
                <span className="font-medium">Ngày công</span> (YYYY-MM-DD hoặc DD/MM/YYYY),{' '}
                <span className="font-medium">Giờ vào</span> (HH:mm),{' '}
                <span className="font-medium">Giờ ra</span> (HH:mm),{' '}
                <span className="font-medium">Ghi chú</span>.
              </p>
            </div>
            <a
              href="/api/v1/hrm/attendance/import/template"
              download
              className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50"
            >
              <IconDownload size={15} />
              <span>Tải file mẫu .xlsx</span>
            </a>
          </div>

          {errorMsg && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700">
              {errorMsg}
            </div>
          )}

          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-700">
                Chọn file Excel từ máy tính *
              </label>
              <input
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                disabled={isUploading}
                onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                className="block w-full rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-xs text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-600 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-blue-700"
              />
            </div>

            {summary && (
              <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <IconCheck size={18} className="text-emerald-600" />
                  <span>Kết quả xử lý ({summary.totalRows} dòng)</span>
                </div>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-lg bg-white p-2.5 border border-slate-200">
                    <div className="text-lg font-bold text-emerald-600">{summary.createdCount}</div>
                    <div className="text-[11px] text-slate-500">Tạo mới</div>
                  </div>
                  <div className="rounded-lg bg-white p-2.5 border border-slate-200">
                    <div className="text-lg font-bold text-blue-600">{summary.updatedCount}</div>
                    <div className="text-[11px] text-slate-500">Cập nhật</div>
                  </div>
                  <div className="rounded-lg bg-white p-2.5 border border-slate-200">
                    <div className="text-lg font-bold text-rose-600">{summary.errorCount}</div>
                    <div className="text-[11px] text-slate-500">Dòng lỗi</div>
                  </div>
                </div>

                {summary.errors.length > 0 && (
                  <div className="max-h-44 overflow-y-auto rounded-lg border border-rose-200 bg-white">
                    <table className="w-full text-left text-xs">
                      <thead className="sticky top-0 bg-rose-50 text-rose-800">
                        <tr>
                          <th className="px-3 py-1.5 font-semibold">Dòng</th>
                          <th className="px-3 py-1.5 font-semibold">Mã NV</th>
                          <th className="px-3 py-1.5 font-semibold">Ngày</th>
                          <th className="px-3 py-1.5 font-semibold">Chi tiết lỗi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-rose-100">
                        {summary.errors.map((err, idx) => (
                          <tr key={`${err.rowNumber}-${idx}`}>
                            <td className="px-3 py-1.5 font-mono text-slate-600">#{err.rowNumber}</td>
                            <td className="px-3 py-1.5 font-medium text-slate-800">
                              {err.employeeCode || '-'}
                            </td>
                            <td className="px-3 py-1.5 text-slate-600">{err.workDate || '-'}</td>
                            <td className="px-3 py-1.5 text-rose-700">{err.message}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={onClose}
                disabled={isUploading}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Đóng
              </button>
              <button
                type="submit"
                disabled={isUploading || !selectedFile}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {isUploading ? (
                  <IconLoader2 size={16} className="animate-spin" />
                ) : (
                  <IconUpload size={16} />
                )}
                <span>{isUploading ? 'Đang xử lý...' : 'Bắt đầu Import'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
