'use client';

import { useEffect, useState } from 'react';
import {
  IconDownload,
  IconEye,
  IconReceipt2,
  IconRefresh,
} from '@tabler/icons-react';
import { PayslipDetailModal } from '@/components/hrm/PayslipDetailModal';
import { formatVND } from '@/lib/portable/currency-utils';
import type { PayslipRowItem } from '@/modules/hrm/payroll/payroll.service';

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
          throw new Error(json.error?.message ?? 'Không thể tải danh sách phiếu lương của bạn.');
        }
        setData(json.data);
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
  }, [selectedYear, reloadTick]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Phiếu lương của tôi</h1>
          <p className="mt-1 text-sm text-slate-500">
            Tra cứu chi tiết thu nhập, bảo hiểm, thuế TNCN và tải Phiếu lương PDF các kỳ đã phát hành.
          </p>
        </div>

        <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-600 shadow-sm">
          <span>Năm:</span>
          <select
            value={selectedYear}
            onChange={(e) => {
              setSelectedYear(e.target.value);
              setIsLoading(true);
            }}
            className="bg-transparent text-sm font-semibold text-slate-900 outline-none"
          >
            <option value="">Tất cả các năm</option>
            {[currentYear + 1, currentYear, currentYear - 1].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Annual KPI Summary */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs text-slate-500">Số kỳ lương đã nhận</div>
          <div className="mt-1 text-xl font-bold text-slate-900">
            {isLoading ? '...' : (data?.summary.count ?? 0)} kỳ
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs text-slate-500">Tổng Thu nhập (Gross)</div>
          <div className="mt-1 text-xl font-bold text-slate-900">
            {isLoading ? '...' : formatVND(data?.summary.totalGross ?? 0)}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs text-slate-500">Tổng Thuế TNCN đã khấu trừ</div>
          <div className="mt-1 text-xl font-bold text-amber-700">
            {isLoading ? '...' : formatVND(data?.summary.totalTax ?? 0)}
          </div>
        </div>
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 shadow-sm">
          <div className="text-xs font-medium text-blue-700">Tổng Thực lĩnh (Net)</div>
          <div className="mt-1 text-xl font-bold text-blue-800">
            {isLoading ? '...' : formatVND(data?.summary.totalNet ?? 0)}
          </div>
        </div>
      </div>

      {/* List */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {isLoading ? (
          <div className="space-y-3 p-6">
            <div className="h-14 animate-pulse rounded-xl bg-slate-100" />
            <div className="h-14 animate-pulse rounded-xl bg-slate-100" />
          </div>
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
              <span>Thử lại</span>
            </button>
          </div>
        ) : !data || data.items.length === 0 ? (
          <div className="p-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
              <IconReceipt2 size={24} />
            </div>
            <p className="mt-3 text-sm font-semibold text-slate-800">
              Chưa có phiếu lương nào được phát hành
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Khi Bộ phận Kế toán hoàn tất chi trả kỳ lương, phiếu lương của bạn sẽ tự động hiển thị tại đây.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">Kỳ lương</th>
                  <th className="px-4 py-3 text-right">Ngày công</th>
                  <th className="px-4 py-3 text-right">Tổng Gross</th>
                  <th className="px-4 py-3 text-right">BH NLĐ</th>
                  <th className="px-4 py-3 text-right">Thuế TNCN</th>
                  <th className="px-4 py-3 text-right">Thực lĩnh (Net)</th>
                  <th className="px-4 py-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.items.map((ps) => (
                  <tr key={ps.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">
                        Tháng {String(ps.month).padStart(2, '0')}/{ps.year}
                      </div>
                      <div className="text-xs text-slate-500">
                        {ps.periodName}
                        {ps.publishedAt ? ` • Phát hành: ${ps.publishedAt}` : ''}
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
                          <span>Xem chi tiết</span>
                        </button>
                        <a
                          href={`/api/v1/hrm/payroll/payslips/${ps.id}/pdf`}
                          className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                        >
                          <IconDownload size={14} />
                          <span>Tải PDF</span>
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
