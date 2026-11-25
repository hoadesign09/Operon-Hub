'use client';

import { useEffect, useRef, useState } from 'react';
import {
  IconDownload,
  IconPlus,
  IconRefresh,
  IconTrash,
  IconX,
} from '@tabler/icons-react';
import { formatVND } from '@/lib/portable/currency-utils';
import type { PayslipDetail } from '@/modules/hrm/payroll/payroll.service';
import { useI18n } from '@/shared/i18n/I18nContext';

interface EditableManualItem {
  itemType: 'EARNING' | 'DEDUCTION';
  code: string;
  label: string;
  amount: string;
  isTaxable: boolean;
  note: string;
}

interface PayslipDetailModalProps {
  payslipId: number;
  canEdit: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export function PayslipDetailModal({
  payslipId,
  canEdit,
  onClose,
  onSaved,
}: PayslipDetailModalProps) {
  const { tr, ln } = useI18n();
  const trRef = useRef(tr);
  useEffect(() => {
    trRef.current = tr;
  }, [tr]);

  const [payslip, setPayslip] = useState<PayslipDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  const [manualItems, setManualItems] = useState<EditableManualItem[]>([]);
  const [note, setNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    fetch(`/api/v1/hrm/payroll/payslips/${payslipId}`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        const json = (await res.json()) as {
          success: boolean;
          data?: { payslip: PayslipDetail };
          error?: { message?: string };
        };
        if (!res.ok || !json.success || !json.data?.payslip) {
          throw new Error(
            json.error?.message ??
              trRef.current('Không thể tải chi tiết phiếu lương.', 'Unable to load payslip details.'),
          );
        }
        const detail = json.data.payslip;
        setPayslip(detail);
        setNote(detail.note ?? '');
        setManualItems(
          detail.items
            .filter((it) => it.source === 'MANUAL')
            .map((it) => ({
              itemType: it.itemType,
              code: it.code,
              label: it.label,
              amount: String(it.amount),
              isTaxable: it.isTaxable,
              note: it.note ?? '',
            })),
        );
        setErrorMessage(null);
      })
      .catch((err: unknown) => {
        if ((err as { name?: string })?.name === 'AbortError') {
          return;
        }
        setErrorMessage(
          err instanceof Error
            ? err.message
            : trRef.current('Lỗi kết nối khi tải phiếu lương.', 'Connection error while loading payslip.'),
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => controller.abort();
  }, [payslipId, reloadTick]);

  const isPeriodEditable =
    canEdit &&
    payslip !== null &&
    (payslip.periodStatus === 'DRAFT' || payslip.periodStatus === 'CALCULATED');

  function addManualItem(itemType: 'EARNING' | 'DEDUCTION') {
    setManualItems((prev) => [
      ...prev,
      {
        itemType,
        code: itemType === 'EARNING' ? `BONUS_${prev.length + 1}` : `DEDUCT_${prev.length + 1}`,
        label:
          itemType === 'EARNING'
            ? tr('Thưởng hiệu suất', 'Performance Bonus')
            : tr('Tạm ứng / Khấu trừ khác', 'Advance / Other Deduction'),
        amount: '0',
        isTaxable: true,
        note: '',
      },
    ]);
  }

  function updateManualRow(
    index: number,
    patch: Partial<EditableManualItem>,
  ) {
    setManualItems((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, ...patch } : item)),
    );
  }

  function removeManualRow(index: number) {
    setManualItems((prev) => prev.filter((_, idx) => idx !== index));
  }

  async function handleSaveManual() {
    setErrorMessage(null);
    setSaveMessage(null);
    setIsSaving(true);

    try {
      const response = await fetch(`/api/v1/hrm/payroll/payslips/${payslipId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          note: note.trim() || null,
          manualItems: manualItems.map((item) => ({
            itemType: item.itemType,
            code: item.code.trim(),
            label: item.label.trim(),
            amount: Number(item.amount) || 0,
            isTaxable: item.isTaxable,
            note: item.note.trim() || null,
          })),
        }),
      });

      const json = (await response.json()) as {
        success: boolean;
        data?: { payslip: PayslipDetail };
        error?: { message?: string };
      };

      if (!response.ok || !json.success || !json.data?.payslip) {
        setErrorMessage(
          json.error?.message ??
            tr('Không thể cập nhật khoản điều chỉnh.', 'Unable to update manual adjustments.'),
        );
        setIsSaving(false);
        return;
      }

      setPayslip(json.data.payslip);
      setSaveMessage(
        tr(
          'Đã lưu điều chỉnh và tính lại Thuế TNCN / Thực lĩnh thành công.',
          'Adjustments saved and PIT / Net salary recalculated successfully.',
        ),
      );
      onSaved?.();
    } catch {
      setErrorMessage(
        tr(
          'Lỗi kết nối máy chủ khi lưu điều chỉnh phiếu lương.',
          'Server connection error while saving payslip adjustments.',
        ),
      );
    } finally {
      setIsSaving(false);
    }
  }

  const autoEarnings =
    payslip?.items.filter((i) => i.source === 'AUTO' && i.itemType === 'EARNING') ?? [];
  const autoDeductions =
    payslip?.items.filter((i) => i.source === 'AUTO' && i.itemType === 'DEDUCTION') ?? [];
  const readonlyManualItems =
    payslip?.items.filter((i) => i.source === 'MANUAL') ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              {payslip
                ? tr(
                    `Phiếu lương T${String(payslip.month).padStart(2, '0')}/${payslip.year} — ${payslip.employeeCode} ${payslip.employeeName}`,
                    `Payslip ${String(payslip.month).padStart(2, '0')}/${payslip.year} — ${payslip.employeeCode} ${payslip.employeeName}`,
                  )
                : tr('Chi tiết Phiếu lương', 'Payslip Details')}
            </h2>
            {payslip && (
              <p className="text-xs text-slate-500">
                {ln(payslip.branchName, payslip.branchNameEn)} •{' '}
                {ln(payslip.departmentName, payslip.departmentNameEn)} •{' '}
                {ln(payslip.positionName, payslip.positionNameEn)}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {payslip && (
              <a
                href={`/api/v1/hrm/payroll/payslips/${payslip.id}/pdf`}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
              >
                <IconDownload size={15} />
                <span>{tr('Tải PDF', 'Download PDF')}</span>
              </a>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              aria-label={tr('Đóng', 'Close')}
            >
              <IconX size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-6">
          {isLoading ? (
            <div className="space-y-3">
              <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
              <div className="h-40 animate-pulse rounded-xl bg-slate-100" />
            </div>
          ) : errorMessage && !payslip ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-center">
              <p className="text-sm text-rose-700">{errorMessage}</p>
              <button
                type="button"
                onClick={() => {
                  setIsLoading(true);
                  setReloadTick((t) => t + 1);
                }}
                className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-700"
              >
                <IconRefresh size={14} />
                <span>{tr('Thử lại', 'Retry')}</span>
              </button>
            </div>
          ) : payslip ? (
            <>
              {errorMessage && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">
                  {errorMessage}
                </div>
              )}
              {saveMessage && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700">
                  {saveMessage}
                </div>
              )}

              {/* Summary highlight cards */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="text-xs text-slate-500">{tr('Ngày công / OT', 'Work Days / OT')}</div>
                  <div className="mt-1 text-sm font-bold text-slate-900">
                    {payslip.payableDays}/{payslip.standardWorkDays} {tr('ngày', 'days')}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    OT: {payslip.otHours150 + payslip.otHours200 + payslip.otHours300}h
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="text-xs text-slate-500">
                    {tr('Tổng Thu nhập (Gross)', 'Gross Earnings')}
                  </div>
                  <div className="mt-1 text-sm font-bold text-slate-900">
                    {formatVND(payslip.grossSalary)}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {tr('Lương HĐ:', 'Contract Salary:')} {formatVND(payslip.baseSalary)}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="text-xs text-slate-500">
                    {tr('BHXH/YT/TN + Thuế TNCN', 'Social Ins. + PIT')}
                  </div>
                  <div className="mt-1 text-sm font-bold text-rose-700">
                    -{formatVND(payslip.totalInsuranceEmp + payslip.personalIncomeTax)}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {tr('BH:', 'Ins:')} {formatVND(payslip.totalInsuranceEmp)} •{' '}
                    {tr('Thuế:', 'Tax:')} {formatVND(payslip.personalIncomeTax)}
                  </div>
                </div>
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
                  <div className="text-xs font-medium text-blue-700">
                    {tr('Thực lĩnh (Net)', 'Net Pay')}
                  </div>
                  <div className="mt-1 text-base font-bold text-blue-800">
                    {formatVND(payslip.netSalary)}
                  </div>
                  <div className="text-[11px] text-blue-700">
                    {tr('NPT:', 'Deps:')} {payslip.dependentsCount} • {tr('TNTT:', 'Taxable:')}{' '}
                    {formatVND(payslip.taxableIncome)}
                  </div>
                </div>
              </div>

              {/* Auto calculated Earnings & Deductions */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-slate-200 p-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    {tr(
                      'Thu nhập tự động (Công, Phụ cấp, OT)',
                      'Auto Earnings (Workdays, Allowances, OT)',
                    )}
                  </h3>
                  <div className="mt-3 space-y-2">
                    {autoEarnings.map((it) => (
                      <div
                        key={it.id}
                        className="flex items-start justify-between gap-3 border-b border-slate-100 pb-2 text-sm last:border-0 last:pb-0"
                      >
                        <div>
                          <div className="font-medium text-slate-800">{it.label}</div>
                          {it.note && <div className="text-xs text-slate-500">{it.note}</div>}
                        </div>
                        <div className="whitespace-nowrap font-semibold text-emerald-700">
                          +{formatVND(it.amount)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 p-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    {tr(
                      'Khấu trừ bắt buộc (BH & Thuế TNCN)',
                      'Mandatory Deductions (Ins. & PIT)',
                    )}
                  </h3>
                  <div className="mt-3 space-y-2">
                    {autoDeductions.length === 0 ? (
                      <p className="text-sm text-slate-500">
                        {tr('Không phát sinh khấu trừ bắt buộc.', 'No mandatory deductions.')}
                      </p>
                    ) : (
                      autoDeductions.map((it) => (
                        <div
                          key={it.id}
                          className="flex items-start justify-between gap-3 border-b border-slate-100 pb-2 text-sm last:border-0 last:pb-0"
                        >
                          <div>
                            <div className="font-medium text-slate-800">{it.label}</div>
                            {it.note && <div className="text-xs text-slate-500">{it.note}</div>}
                          </div>
                          <div className="whitespace-nowrap font-semibold text-rose-700">
                            -{formatVND(it.amount)}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Manual Bonus / Deduction Editor or Readonly List */}
              <div className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      {tr('Khoản Thưởng / Khấu trừ thủ công', 'Manual Bonuses / Deductions')}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {tr(
                        'Các khoản thủ công sẽ được bảo toàn khi chạy tính lại kỳ lương và tự động cập nhật Thuế TNCN.',
                        'Manual items are preserved when recalculating the payroll period and automatically update PIT.',
                      )}
                    </p>
                  </div>
                  {isPeriodEditable && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => addManualItem('EARNING')}
                        className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
                      >
                        <IconPlus size={14} />
                        <span>{tr('Thêm Thưởng', 'Add Bonus')}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => addManualItem('DEDUCTION')}
                        className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-100"
                      >
                        <IconPlus size={14} />
                        <span>{tr('Thêm Khấu trừ', 'Add Deduction')}</span>
                      </button>
                    </div>
                  )}
                </div>

                {isPeriodEditable ? (
                  <div className="mt-4 space-y-3">
                    {manualItems.length === 0 ? (
                      <p className="text-sm text-slate-500">
                        {tr(
                          'Chưa có khoản thưởng hoặc khấu trừ thủ công nào.',
                          'No manual bonuses or deductions yet.',
                        )}
                      </p>
                    ) : (
                      manualItems.map((item, idx) => (
                        <div
                          key={idx}
                          className="grid grid-cols-1 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-12"
                        >
                          <select
                            value={item.itemType}
                            onChange={(e) =>
                              updateManualRow(idx, {
                                itemType: e.target.value as 'EARNING' | 'DEDUCTION',
                              })
                            }
                            className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs sm:col-span-2"
                          >
                            <option value="EARNING">{tr('+ Thưởng', '+ Bonus')}</option>
                            <option value="DEDUCTION">{tr('- Khấu trừ', '- Deduction')}</option>
                          </select>
                          <input
                            type="text"
                            value={item.code}
                            onChange={(e) => updateManualRow(idx, { code: e.target.value })}
                            placeholder={tr('Mã khoản', 'Item code')}
                            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs sm:col-span-2"
                          />
                          <input
                            type="text"
                            value={item.label}
                            onChange={(e) => updateManualRow(idx, { label: e.target.value })}
                            placeholder={tr('Tên khoản mục', 'Item name')}
                            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs sm:col-span-3"
                          />
                          <input
                            type="number"
                            min={0}
                            value={item.amount}
                            onChange={(e) => updateManualRow(idx, { amount: e.target.value })}
                            placeholder={tr('Số tiền VNĐ', 'Amount (VND)')}
                            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs sm:col-span-2"
                          />
                          <label className="flex items-center gap-1.5 text-xs text-slate-600 sm:col-span-2">
                            <input
                              type="checkbox"
                              checked={item.isTaxable}
                              disabled={item.itemType === 'DEDUCTION'}
                              onChange={(e) =>
                                updateManualRow(idx, { isTaxable: e.target.checked })
                              }
                            />
                            <span>{tr('Chịu thuế', 'Taxable')}</span>
                          </label>
                          <div className="flex justify-end sm:col-span-1">
                            <button
                              type="button"
                              onClick={() => removeManualRow(idx)}
                              className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50"
                              aria-label={tr('Xóa khoản', 'Remove item')}
                            >
                              <IconTrash size={15} />
                            </button>
                          </div>
                        </div>
                      ))
                    )}

                    <label className="block space-y-1 pt-2">
                      <span className="text-xs font-semibold text-slate-700">
                        {tr('Ghi chú trên Phiếu lương', 'Payslip Note')}
                      </span>
                      <input
                        type="text"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder={tr(
                          'Ví dụ: Thưởng hoàn thành dự án quý IV',
                          'e.g. Q4 project completion bonus',
                        )}
                        maxLength={500}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
                      />
                    </label>
                  </div>
                ) : (
                  <div className="mt-3 space-y-2">
                    {readonlyManualItems.length === 0 ? (
                      <p className="text-sm text-slate-500">
                        {tr('Không có khoản điều chỉnh thủ công.', 'No manual adjustments.')}
                      </p>
                    ) : (
                      readonlyManualItems.map((it) => (
                        <div
                          key={it.id}
                          className="flex items-center justify-between border-b border-slate-100 pb-2 text-sm last:border-0"
                        >
                          <div>
                            <div className="font-medium text-slate-800">{it.label}</div>
                            {it.note && <div className="text-xs text-slate-500">{it.note}</div>}
                          </div>
                          <div
                            className={`font-semibold ${
                              it.itemType === 'EARNING' ? 'text-emerald-700' : 'text-rose-700'
                            }`}
                          >
                            {it.itemType === 'EARNING' ? '+' : '-'}
                            {formatVND(it.amount)}
                          </div>
                        </div>
                      ))
                    )}
                    {payslip.note && (
                      <p className="pt-2 text-xs text-slate-600">
                        <span className="font-semibold">{tr('Ghi chú:', 'Note:')}</span>{' '}
                        {payslip.note}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Bank info */}
              <div className="rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-600">
                <span className="font-semibold text-slate-800">
                  {tr('Thông tin nhận lương:', 'Bank account:')}
                </span>{' '}
                {payslip.bankAccountNo
                  ? `${payslip.bankAccountNo}${payslip.bankName ? ` — ${payslip.bankName}` : ''}`
                  : tr('Chưa cập nhật tài khoản ngân hàng', 'Bank account not provided')}
                {payslip.publishedAt
                  ? tr(
                      ` • Phát hành lúc: ${payslip.publishedAt}`,
                      ` • Published at: ${payslip.publishedAt}`,
                    )
                  : ''}
              </div>
            </>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            {tr('Đóng', 'Close')}
          </button>
          {isPeriodEditable && (
            <button
              type="button"
              disabled={isSaving}
              onClick={() => void handleSaveManual()}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {isSaving
                ? tr('Đang lưu & tính lại...', 'Saving & recalculating...')
                : tr('Lưu điều chỉnh', 'Save Adjustments')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
