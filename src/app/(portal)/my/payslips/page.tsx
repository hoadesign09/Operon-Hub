'use client';

import { useEffect, useRef, useState } from 'react';
import {
  IconDownload,
  IconEye,
  IconReceipt2,
  IconRefresh,
} from '@tabler/icons-react';
import { PayslipDetailModal } from '@/components/hrm/PayslipDetailModal';
import { SkeletonKpiGrid, SkeletonTable } from '@/components/ui/Skeleton';
import { formatVND } from '@/lib/portable/currency-utils';
import type { PayslipRowItem } from '@/modules/hrm/payroll/payroll.service';
import { useI18n } from '@/shared/i18n/I18nContext';

interface MyPayslipsResponse {
  items: PayslipRowItem[];
  summary: {
    year: number | null;
    count: number;
    totalGross: number;
    totalInsuranceEmp: number;
    totalTax: number;
    totalNet: number;
  };
}

export default function MyPayslipsPage() {
  const { locale, tr } = useI18n();
  const trRef = useRef(tr);
  useEffect(() => {
    trRef.current = tr;
  }, [tr]);

  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<string>(String(currentYear));
  const [data, setData] = useState<MyPayslipsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const [activePayslipId, setActivePayslipId] = useState<number | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (selectedYear) {
      params.set('year', selectedYear);
    }

    fetch(`/api/v1/hrm/payroll/payslips/me?${params.toString()}`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        const json = (await res.json()) as {
          success: boolean;
          data?: MyPayslipsResponse;
          error?: { message?: string };
        };
        if (!res.ok || !json.success || !json.data) {
          throw new Error(
            json.error?.message ??
              trRef.current(
                'Không thể tải danh sách phiếu lương của bạn.',
                'Failed to load your payslips.',
              ),
          );
        }
        setData(json.data);
        setErrorMessage(null);
      })
      .catch((err: unknown) => {
        if ((err as { name?: string })?.name === 'AbortError') return;
        setErrorMessage(
          err instanceof Error
            ? err.message
            : trRef.current('Lỗi kết nối máy chủ.', 'Server connection error.'),
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => controller.abort();
  }, [selectedYear, reloadTick]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {tr('Phiếu lương của tôi', 'My Payslips')}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {tr(
              'Tra cứu chi tiết thu nhập, bảo hiểm, thuế TNCN và tải Phiếu lương PDF các kỳ đã phát hành.',
              'View your earnings, social insurance, personal income tax, and download PDF payslips for published periods.',
            )}
          </p>
        </div>

        <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-600 shadow-sm">
          <span>{tr('Năm:', 'Year:')}</span>
          <select
            value={selectedYear}
            onChange={(e) => {
              setSelectedYear(e.target.value);
              setIsLoading(true);
            }}
            className="bg-transparent text-sm font-semibold text-slate-900 outline-none"
          >
            <option value="">{tr('Tất cả các năm', 'All years')}</option>
            {[currentYear + 1, currentYear, currentYear - 1].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Annual KPI Summary */}
      {isLoading ? (
        <SkeletonKpiGrid count={4} compact columnsClass="grid-cols-2 gap-3 lg:grid-cols-4" />
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-xs text-slate-500">
              {tr('Số kỳ lương đã nhận', 'Payslips Received')}
            </div>
            <div className="mt-1 text-xl font-bold text-slate-900">
              {data?.summary.count ?? 0}{' '}
              {tr('kỳ', (data?.summary.count ?? 0) === 1 ? 'period' : 'periods')}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-xs text-slate-500">
              {tr('Tổng Thu nhập (Gross)', 'Total Gross Income')}
            </div>
            <div className="mt-1 text-xl font-bold text-slate-900">
              {formatVND(data?.summary.totalGross ?? 0)}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-xs text-slate-500">
              {tr('Tổng Thuế TNCN đã khấu trừ', 'Total PIT Withheld')}
            </div>
            <div className="mt-1 text-xl font-bold text-amber-700">
              {formatVND(data?.summary.totalTax ?? 0)}
            </div>
          </div>
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 shadow-sm">
            <div className="text-xs font-medium text-blue-700">
              {tr('Tổng Thực lĩnh (Net)', 'Total Net Pay')}
            </div>
            <div className="mt-1 text-xl font-bold text-blue-800">
              {formatVND(data?.summary.totalNet ?? 0)}
            </div>
          </div>
        </div>
      )}

      {/* List */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {isLoading ? (
          <SkeletonTable
            rows={5}
            columns={7}
            showToolbar={false}
            showPagination={false}
            className="rounded-none border-0"
          />
        ) : errorMessage ? (
          <div className="p-8 text-center">
            <p className="text-sm text-rose-700">{errorMessage}</p>
            <button
              type="button"
              onClick={() => {
                setIsLoading(true);
                setReloadTick((t) => t + 1);
              }}
              className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700"
            >
              <IconRefresh size={15} />
              <span>{tr('Thử lại', 'Retry')}</span>
            </button>
          </div>
        ) : !data || data.items.length === 0 ? (
          <div className="p-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
              <IconReceipt2 size={24} />
            </div>
            <p className="mt-3 text-sm font-semibold text-slate-800">
              {tr('Chưa có phiếu lương nào được phát hành', 'No payslips published yet')}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {tr(
                'Khi Bộ phận Kế toán hoàn tất chi trả kỳ lương, phiếu lương của bạn sẽ tự động hiển thị tại đây.',
                'Once Finance finalizes payroll disbursement, your payslips will automatically appear here.',
              )}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">{tr('Kỳ lương', 'Pay Period')}</th>
                  <th className="px-4 py-3 text-right">{tr('Ngày công', 'Work Days')}</th>
                  <th className="px-4 py-3 text-right">{tr('Tổng Gross', 'Gross Pay')}</th>
                  <th className="px-4 py-3 text-right">{tr('BH NLĐ', 'Employee Ins.')}</th>
                  <th className="px-4 py-3 text-right">{tr('Thuế TNCN', 'PIT')}</th>
                  <th className="px-4 py-3 text-right">{tr('Thực lĩnh (Net)', 'Net Pay')}</th>
                  <th className="px-4 py-3 text-right">{tr('Thao tác', 'Actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.items.map((ps) => (
                  <tr key={ps.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">
                        {locale === 'en'
                          ? `${String(ps.month).padStart(2, '0')}/${ps.year}`
                          : `Tháng ${String(ps.month).padStart(2, '0')}/${ps.year}`}
                      </div>
                      <div className="text-xs text-slate-500">
                        {ps.periodName}
                        {ps.publishedAt
                          ? ` • ${tr('Phát hành', 'Published')}: ${ps.publishedAt}`
                          : ''}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-700">
                      {ps.payableDays}/{ps.standardWorkDays}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-slate-800">
                      {formatVND(ps.grossSalary)}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600">
                      {formatVND(ps.totalInsuranceEmp)}
                    </td>
                    <td className="px-4 py-3 text-right text-amber-700">
                      {formatVND(ps.personalIncomeTax)}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-blue-700">
                      {formatVND(ps.netSalary)}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setActivePayslipId(ps.id)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                        >
                          <IconEye size={14} />
                          <span>{tr('Xem chi tiết', 'View Details')}</span>
                        </button>
                        <a
                          href={`/api/v1/hrm/payroll/payslips/${ps.id}/pdf`}
                          className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                        >
                          <IconDownload size={14} />
                          <span>{tr('Tải PDF', 'Download PDF')}</span>
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {activePayslipId !== null && (
        <PayslipDetailModal
          key={`ess-payslip-${activePayslipId}`}
          payslipId={activePayslipId}
          canEdit={false}
          onClose={() => setActivePayslipId(null)}
        />
      )}
    </div>
  );
}
