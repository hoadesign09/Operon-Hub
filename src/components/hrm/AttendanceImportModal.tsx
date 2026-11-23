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
import { useI18n } from '@/shared/i18n/I18nContext';

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
  const { tr } = useI18n();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [summary, setSummary] = useState<ImportSummaryData | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setSummary(null);

    if (!selectedFile) {
      setErrorMsg(
        tr(
          'Vui lòng chọn file Excel (.xlsx) để import.',
          'Please select an Excel (.xlsx) file to import.',
        ),
      );
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
        setErrorMsg(
          json.error?.message ??
            tr('Import file chấm công thất bại.', 'Failed to import attendance file.'),
        );
        setIsUploading(false);
        return;
      }

      setSummary(json.data);
      setIsUploading(false);
      if (json.data.createdCount > 0 || json.data.updatedCount > 0) {
        onImported();
      }
    } catch {
      setErrorMsg(
        tr(
          'Lỗi kết nối máy chủ khi tải file Excel.',
          'Server connection error while uploading Excel file.',
        ),
      );
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
              {tr(
                'Import Dữ liệu Chấm công từ Excel (.xlsx)',
                'Import Attendance Data from Excel (.xlsx)',
              )}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isUploading}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label={tr('Đóng', 'Close')}
          >
            <IconX size={18} />
          </button>
        </div>

        <div className="space-y-4 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-100 bg-blue-50/70 p-3.5 text-xs text-slate-700">
            <div>
              <p className="font-semibold text-blue-900">
                {tr(
                  'Cấu trúc file chuẩn (.xlsx, tối đa 5MB)',
                  'Standard file structure (.xlsx, max 5MB)',
                )}
              </p>
              <p className="mt-0.5 text-slate-600">
                {tr('Các cột:', 'Columns:')}{' '}
                <span className="font-medium">{tr('Mã NV', 'Employee Code')}</span>,{' '}
                <span className="font-medium">{tr('Ngày công', 'Work Date')}</span>{' '}
                {tr('(YYYY-MM-DD hoặc DD/MM/YYYY)', '(YYYY-MM-DD or DD/MM/YYYY)')},{' '}
                <span className="font-medium">{tr('Giờ vào', 'Check-in')}</span> (HH:mm),{' '}
                <span className="font-medium">{tr('Giờ ra', 'Check-out')}</span> (HH:mm),{' '}
                <span className="font-medium">{tr('Ghi chú', 'Note')}</span>.
              </p>
            </div>
            <a
              href="/api/v1/hrm/attendance/import/template"
              download
              className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50"
            >
              <IconDownload size={15} />
              <span>{tr('Tải file mẫu .xlsx', 'Download .xlsx Template')}</span>
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
                {tr('Chọn file Excel từ máy tính *', 'Select Excel file from computer *')}
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
                  <span>
                    {tr(
                      `Kết quả xử lý (${summary.totalRows} dòng)`,
                      `Import Results (${summary.totalRows} rows)`,
                    )}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-lg bg-white p-2.5 border border-slate-200">
                    <div className="text-lg font-bold text-emerald-600">{summary.createdCount}</div>
                    <div className="text-[11px] text-slate-500">{tr('Tạo mới', 'Created')}</div>
                  </div>
                  <div className="rounded-lg bg-white p-2.5 border border-slate-200">
                    <div className="text-lg font-bold text-blue-600">{summary.updatedCount}</div>
                    <div className="text-[11px] text-slate-500">{tr('Cập nhật', 'Updated')}</div>
                  </div>
                  <div className="rounded-lg bg-white p-2.5 border border-slate-200">
                    <div className="text-lg font-bold text-rose-600">{summary.errorCount}</div>
                    <div className="text-[11px] text-slate-500">
                      {tr('Dòng lỗi', 'Failed Rows')}
                    </div>
                  </div>
                </div>

                {summary.errors.length > 0 && (
                  <div className="max-h-44 overflow-y-auto rounded-lg border border-rose-200 bg-white">
                    <table className="w-full text-left text-xs">
                      <thead className="sticky top-0 bg-rose-50 text-rose-800">
                        <tr>
                          <th className="px-3 py-1.5 font-semibold">{tr('Dòng', 'Row')}</th>
                          <th className="px-3 py-1.5 font-semibold">{tr('Mã NV', 'Emp. Code')}</th>
                          <th className="px-3 py-1.5 font-semibold">{tr('Ngày', 'Date')}</th>
                          <th className="px-3 py-1.5 font-semibold">
                            {tr('Chi tiết lỗi', 'Error Details')}
                          </th>
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
                {tr('Đóng', 'Close')}
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
                <span>
                  {isUploading ? tr('Đang xử lý...', 'Processing...') : tr('Bắt đầu Import', 'Start Import')}
                </span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
