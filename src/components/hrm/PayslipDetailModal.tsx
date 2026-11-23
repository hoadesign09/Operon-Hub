'use client';

import { useEffect, useState } from 'react';
import {
  IconDownload,
  IconPlus,
  IconRefresh,
  IconTrash,
  IconX,
} from '@tabler/icons-react';
import { formatVND } from '@/lib/portable/currency-utils';
import type { PayslipDetail } from '@/modules/hrm/payroll/payroll.service';

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
          throw new Error(json.error?.message ?? 'Không thể tải chi tiết phiếu lương.');
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
          err instanceof Error ? err.message : 'Lỗi kết nối khi tải phiếu lương.',
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
        label: itemType === 'EARNING' ? 'Thưởng hiệu suất' : 'Tạm ứng / Khấu trừ khác',
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
        setErrorMessage(json.error?.message ?? 'Không thể cập nhật khoản điều chỉnh.');
        setIsSaving(false);
        return;
      }

      setPayslip(json.data.payslip);
      setSaveMessage('Đã lưu điều chỉnh và tính lại Thuế TNCN / Thực lĩnh thành công.');
      onSaved?.();
    } catch {
      setErrorMessage('Lỗi kết nối máy chủ khi lưu điều chỉnh phiếu lương.');
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
                ? `Phiếu lương T${String(payslip.month).padStart(2, '0')}/${payslip.year} — ${payslip.employeeCode} ${payslip.employeeName}`
                : 'Chi tiết Phiếu lương'}
            </h2>
            {payslip && (
              <p className="text-xs text-slate-500">
                {payslip.branchName} • {payslip.departmentName} • {payslip.positionName}
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
                <span>Tải PDF</span>
              </a>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              aria-label="Đóng"
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
                <span>Thử lại</span>
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
                  <div className="text-xs text-slate-500">Ngày công / OT</div>
                  <div className="mt-1 text-sm font-bold text-slate-900">
                    {payslip.payableDays}/{payslip.standardWorkDays} ngày
                  </div>
                  <div className="text-[11px] text-slate-500">
                    OT: {payslip.otHours150 + payslip.otHours200 + payslip.otHours300}h
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="text-xs text-slate-500">Tổng Thu nhập (Gross)</div>
                  <div className="mt-1 text-sm font-bold text-slate-900">
                    {formatVND(payslip.grossSalary)}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Lương HĐ: {formatVND(payslip.baseSalary)}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="text-xs text-slate-500">BHXH/YT/TN + Thuế TNCN</div>
                  <div className="mt-1 text-sm font-bold text-rose-700">
                    -{formatVND(payslip.totalInsuranceEmp + payslip.personalIncomeTax)}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    BH: {formatVND(payslip.totalInsuranceEmp)} • Thuế:{' '}
                    {formatVND(payslip.personalIncomeTax)}
                  </div>
                </div>
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
                  <div className="text-xs font-medium text-blue-700">Thực lĩnh (Net)</div>
                  <div className="mt-1 text-base font-bold text-blue-800">
                    {formatVND(payslip.netSalary)}
                  </div>
                  <div className="text-[11px] text-blue-700">
                    NPT: {payslip.dependentsCount} • TNTT: {formatVND(payslip.taxableIncome)}
                  </div>
                </div>
              </div>

              {/* Auto calculated Earnings & Deductions */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-slate-200 p-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Thu nhập tự động (Công, Phụ cấp, OT)
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
                    Khấu trừ bắt buộc (BH & Thuế TNCN)
                  </h3>
                  <div className="mt-3 space-y-2">
                    {autoDeductions.length === 0 ? (
                      <p className="text-sm text-slate-500">Không phát sinh khấu trừ bắt buộc.</p>
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
                      Khoản Thưởng / Khấu trừ thủ công
                    </h3>
                    <p className="text-xs text-slate-500">
                      Các khoản thủ công sẽ được bảo toàn khi chạy tính lại kỳ lương và tự động cập nhật Thuế TNCN.
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
                        <span>Thêm Thưởng</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => addManualItem('DEDUCTION')}
                        className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-100"
                      >
                        <IconPlus size={14} />
                        <span>Thêm Khấu trừ</span>
                      </button>
                    </div>
                  )}
                </div>

                {isPeriodEditable ? (
                  <div className="mt-4 space-y-3">
                    {manualItems.length === 0 ? (
                      <p className="text-sm text-slate-500">
                        Chưa có khoản thưởng hoặc khấu trừ thủ công nào.
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
                            <option value="EARNING">+ Thưởng</option>
                            <option value="DEDUCTION">- Khấu trừ</option>
                          </select>
                          <input
                            type="text"
                            value={item.code}
                            onChange={(e) => updateManualRow(idx, { code: e.target.value })}
                            placeholder="Mã khoản"
                            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs sm:col-span-2"
                          />
                          <input
                            type="text"
                            value={item.label}
                            onChange={(e) => updateManualRow(idx, { label: e.target.value })}
                            placeholder="Tên khoản mục"
                            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs sm:col-span-3"
                          />
                          <input
                            type="number"
                            min={0}
                            value={item.amount}
                            onChange={(e) => updateManualRow(idx, { amount: e.target.value })}
                            placeholder="Số tiền VNĐ"
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
                            <span>Chịu thuế</span>
                          </label>
                          <div className="flex justify-end sm:col-span-1">
                            <button
                              type="button"
                              onClick={() => removeManualRow(idx)}
                              className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50"
                              aria-label="Xóa khoản"
                            >
                              <IconTrash size={15} />
                            </button>
                          </div>
                        </div>
                      ))
                    )}

                    <label className="block space-y-1 pt-2">
                      <span className="text-xs font-semibold text-slate-700">
                        Ghi chú trên Phiếu lương
                      </span>
                      <input
                        type="text"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="Ví dụ: Thưởng hoàn thành dự án quý IV"
                        maxLength={500}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
                      />
                    </label>
                  </div>
                ) : (
                  <div className="mt-3 space-y-2">
                    {readonlyManualItems.length === 0 ? (
                      <p className="text-sm text-slate-500">Không có khoản điều chỉnh thủ công.</p>
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
                        <span className="font-semibold">Ghi chú:</span> {payslip.note}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Bank info */}
              <div className="rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-600">
                <span className="font-semibold text-slate-800">Thông tin nhận lương:</span>{' '}
                {payslip.bankAccountNo
                  ? `${payslip.bankAccountNo}${payslip.bankName ? ` — ${payslip.bankName}` : ''}`
                  : 'Chưa cập nhật tài khoản ngân hàng'}
                {payslip.publishedAt ? ` • Phát hành lúc: ${payslip.publishedAt}` : ''}
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
            Đóng
          </button>
          {isPeriodEditable && (
            <button
              type="button"
              disabled={isSaving}
              onClick={() => void handleSaveManual()}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {isSaving ? 'Đang lưu & tính lại...' : 'Lưu điều chỉnh'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
