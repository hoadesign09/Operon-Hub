import { formatVND } from '@/lib/portable/currency-utils';
import {
  buildStructuredPdfDocument,
  generatePdfBuffer,
  type PdfSectionRow,
} from '@/lib/portable/pdf-generator';
import type { AuthContext } from '@/modules/auth/auth.service';
import {
  getPayslipDetail,
  type PayslipDetail,
} from '@/modules/hrm/payroll/payroll.service';

export function buildPayslipPdfRows(payslip: PayslipDetail): {
  earningRows: PdfSectionRow[];
  deductionRows: PdfSectionRow[];
} {
  const earnings = payslip.items.filter((it) => it.itemType === 'EARNING');
  const deductions = payslip.items.filter((it) => it.itemType === 'DEDUCTION');

  const earningRows: PdfSectionRow[] =
    earnings.length > 0
      ? earnings.map((it) => ({
          label: it.label,
          note: it.note ?? (it.source === 'MANUAL' ? 'Điều chỉnh bổ sung' : ''),
          value: formatVND(it.amount),
        }))
      : [
          {
            label: `Lương theo công (${payslip.payableDays}/${payslip.standardWorkDays} ngày)`,
            value: formatVND(payslip.proratedSalary),
          },
        ];

  const deductionRows: PdfSectionRow[] =
    deductions.length > 0
      ? deductions.map((it) => ({
          label: it.label,
          note: it.note ?? (it.source === 'MANUAL' ? 'Khấu trừ thủ công' : ''),
          value: formatVND(it.amount),
        }))
      : [{ label: 'Không có khoản khấu trừ', value: formatVND(0) }];

  return { earningRows, deductionRows };
}

export async function generatePayslipPdfBuffer(
  payslipId: number,
  auth: AuthContext,
): Promise<{ buffer: Buffer; fileName: string; payslip: PayslipDetail }> {
  const payslip = await getPayslipDetail(payslipId, auth);
  const monthPadded = String(payslip.month).padStart(2, '0');
  const { earningRows, deductionRows } = buildPayslipPdfRows(payslip);

  const totalDeductions =
    payslip.totalInsuranceEmp + payslip.personalIncomeTax + payslip.otherDeductions;

  const docDef = buildStructuredPdfDocument({
    companyName: 'OPERON HUB — HỆ THỐNG QUẢN TRỊ VẬN HÀNH DOANH NGHIỆP',
    companyMeta: `Chi nhánh: ${payslip.branchName} | Mã kỳ lương: ${payslip.periodCode}`,
    title: `PHIẾU LƯƠNG THÁNG ${monthPadded}/${payslip.year}`,
    subtitle: payslip.periodName,
    pageSize: 'A4',
    pageOrientation: 'portrait',
    metadata: [
      { label: 'Mã nhân viên', value: payslip.employeeCode },
      { label: 'Họ và tên', value: payslip.employeeName },
      { label: 'Phòng ban', value: payslip.departmentName },
      { label: 'Chức danh', value: payslip.positionName },
      {
        label: 'Ngày công tính lương',
        value: `${payslip.payableDays} / ${payslip.standardWorkDays} ngày`,
      },
      {
        label: 'Giờ OT (150/200/300%)',
        value: `${payslip.otHours150}h / ${payslip.otHours200}h / ${payslip.otHours300}h`,
      },
      { label: 'Lương cơ bản HĐ', value: formatVND(payslip.baseSalary) },
      { label: 'Số người phụ thuộc', value: `${payslip.dependentsCount} người` },
      { label: 'Mã số thuế', value: payslip.taxCode ?? 'Chưa cập nhật' },
      {
        label: 'Tài khoản nhận lương',
        value: payslip.bankAccountNo
          ? `${payslip.bankAccountNo}${payslip.bankName ? ` (${payslip.bankName})` : ''}`
          : 'Chưa cập nhật',
      },
    ],
    sections: [
      {
        title: 'I. CÁC KHOẢN THU NHẬP (GROSS)',
        rows: earningRows,
        totalLabel: 'TỔNG THU NHẬP (GROSS)',
        totalValue: formatVND(payslip.grossSalary),
      },
      {
        title: 'II. CÁC KHOẢN KHẤU TRỪ (BẢO HIỂM, THUẾ TNCN & KHÁC)',
        rows: deductionRows,
        totalLabel: 'TỔNG KHẤU TRỪ',
        totalValue: formatVND(totalDeductions),
      },
    ],
    highlight: {
      label: 'LƯƠNG THỰC LĨNH (NET SALARY)',
      value: formatVND(payslip.netSalary),
      subtext: `Thu nhập tính thuế TNCN: ${formatVND(payslip.taxableIncome)} • Bảo hiểm NLĐ: ${formatVND(payslip.totalInsuranceEmp)}`,
    },
    footnote: payslip.note
      ? `Ghi chú kế toán: ${payslip.note}. Phiếu lương được xuất tự động từ hệ thống Operon Hub — vui lòng bảo mật thông tin thu nhập cá nhân.`
      : 'Phiếu lương được xuất tự động từ hệ thống Operon Hub — vui lòng bảo mật thông tin thu nhập cá nhân.',
    signatureSectionTitle: 'XÁC NHẬN PHIẾU LƯƠNG',
    signatures: [
      {
        stepLabel: 'BỘ PHẬN C&B',
        title: 'NGƯỜI LẬP BIỂU',
        roleTitle: `Chi nhánh ${payslip.branchName}`,
        subtitle: '(Ký, ghi rõ họ tên)',
      },
      {
        stepLabel: 'NGƯỜI LAO ĐỘNG',
        title: 'XÁC NHẬN CỦA NHÂN VIÊN',
        roleTitle: `${payslip.positionName} • ${payslip.departmentName}`,
        subtitle: '(Ký, ghi rõ họ tên)',
        name: payslip.employeeName,
        code: `Mã NV: ${payslip.employeeCode}`,
      },
    ],
  });

  const buffer = await generatePdfBuffer(docDef);
  const safeEmpCode = payslip.employeeCode.replace(/[^A-Za-z0-9_-]/g, '_');
  const fileName = `phieu-luong-${safeEmpCode}-${payslip.year}-${monthPadded}.pdf`;

  return { buffer, fileName, payslip };
}
