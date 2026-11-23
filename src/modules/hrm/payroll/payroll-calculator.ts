import type { ContractType, PayslipItemSource, PayslipItemType } from '@/config/database';
import { roundCurrency } from '@/lib/portable/currency-utils';

export interface PitBracketConfig {
  upTo: number | null;
  rate: number;
}

export interface PayrollConfig {
  bhxhEmpRate: number;
  bhytEmpRate: number;
  bhtnEmpRate: number;
  bhxhBhytSalaryCap: number;
  bhtnSalaryCap: number;
  personalDeduction: number;
  dependentDeduction: number;
  workingHoursPerDay: number;
  otRate150: number;
  otRate200: number;
  otRate300: number;
  requireLockedAttendance: boolean;
  pitBrackets: PitBracketConfig[];
}

export const DEFAULT_VN_PIT_BRACKETS: PitBracketConfig[] = [
  { upTo: 5_000_000, rate: 0.05 },
  { upTo: 10_000_000, rate: 0.1 },
  { upTo: 18_000_000, rate: 0.15 },
  { upTo: 32_000_000, rate: 0.2 },
  { upTo: 52_000_000, rate: 0.25 },
  { upTo: 80_000_000, rate: 0.3 },
  { upTo: null, rate: 0.35 },
];

export const DEFAULT_PAYROLL_CONFIG: PayrollConfig = {
  bhxhEmpRate: 0.08,
  bhytEmpRate: 0.015,
  bhtnEmpRate: 0.01,
  bhxhBhytSalaryCap: 46_800_000,
  bhtnSalaryCap: 99_200_000,
  personalDeduction: 11_000_000,
  dependentDeduction: 4_400_000,
  workingHoursPerDay: 8,
  otRate150: 1.5,
  otRate200: 2.0,
  otRate300: 3.0,
  requireLockedAttendance: true,
  pitBrackets: DEFAULT_VN_PIT_BRACKETS,
};

export interface ContractAllowanceEntry {
  code: string;
  label: string;
  amount: number;
}

export interface ManualAdjustmentEntry {
  itemType: PayslipItemType;
  code: string;
  label: string;
  amount: number;
  isTaxable: boolean;
  note?: string | null;
}

export interface PayslipCalculationInput {
  contractType: ContractType;
  baseSalary: number;
  insuranceSalary: number;
  allowances: ContractAllowanceEntry[];
  standardWorkDays: number;
  payableDays: number;
  otHours150: number;
  otHours200: number;
  otHours300: number;
  dependentsCount: number;
  manualItems: ManualAdjustmentEntry[];
  config: PayrollConfig;
}

export interface ComputedPayslipItem {
  itemType: PayslipItemType;
  source: PayslipItemSource;
  code: string;
  label: string;
  amount: number;
  isTaxable: boolean;
  note: string | null;
}

export interface PayslipCalculationResult {
  baseSalary: number;
  insuranceSalary: number;
  proratedSalary: number;
  totalAllowances: number;
  totalOtPay: number;
  exemptOtPremium: number;
  totalBonus: number;
  grossSalary: number;
  socialInsuranceEmp: number;
  healthInsuranceEmp: number;
  unemploymentInsuranceEmp: number;
  totalInsuranceEmp: number;
  personalDeduction: number;
  dependentDeduction: number;
  taxableIncome: number;
  personalIncomeTax: number;
  otherDeductions: number;
  netSalary: number;
  items: ComputedPayslipItem[];
}

const INSURANCE_ELIGIBLE_CONTRACT_TYPES = new Set<ContractType>([
  'FIXED_TERM',
  'INDEFINITE',
]);

/**
 * Tính thuế TNCN lũy tiến từng phần theo biểu thuế VN (7 bậc mặc định).
 */
export function calculateProgressivePit(
  taxableIncome: number,
  brackets: readonly PitBracketConfig[] = DEFAULT_VN_PIT_BRACKETS,
): number {
  if (!Number.isFinite(taxableIncome) || taxableIncome <= 0) {
    return 0;
  }

  let totalTax = 0;
  let lowerBound = 0;

  for (const bracket of brackets) {
    if (taxableIncome <= lowerBound) {
      break;
    }

    const upperBound = bracket.upTo ?? Number.POSITIVE_INFINITY;
    const taxablePortion = Math.min(taxableIncome, upperBound) - lowerBound;
    if (taxablePortion > 0) {
      totalTax += taxablePortion * bracket.rate;
    }

    if (bracket.upTo === null) {
      break;
    }
    lowerBound = bracket.upTo;
  }

  return roundCurrency(totalTax, 0);
}

/**
 * Tính toàn bộ chỉ số Phiếu lương 1 nhân viên trong tháng (Pure function — Zero DB coupling).
 */
export function calculateEmployeePayslip(
  input: PayslipCalculationInput,
): PayslipCalculationResult {
  const { config } = input;
  const safeBaseSalary = Math.max(0, roundCurrency(input.baseSalary, 0));
  const safeInsuranceSalary = Math.max(0, roundCurrency(input.insuranceSalary, 0));
  const safeStdDays = Math.max(0, input.standardWorkDays);
  const safePayableDays = Math.max(0, input.payableDays);
  const safeOt150 = Math.max(0, input.otHours150);
  const safeOt200 = Math.max(0, input.otHours200);
  const safeOt300 = Math.max(0, input.otHours300);
  const safeDependents = Math.max(0, Math.trunc(input.dependentsCount));

  // 1. Lương theo công chuẩn
  const proratedSalary =
    safeStdDays > 0
      ? roundCurrency((safeBaseSalary * safePayableDays) / safeStdDays, 0)
      : 0;

  // 2. Phụ cấp hợp đồng
  const autoItems: ComputedPayslipItem[] = [];
  autoItems.push({
    itemType: 'EARNING',
    source: 'AUTO',
    code: 'BASE_PRORATED',
    label: `Lương theo công (${safePayableDays}/${safeStdDays} ngày)`,
    amount: proratedSalary,
    isTaxable: true,
    note: null,
  });

  let totalAllowances = 0;
  for (const allowance of input.allowances) {
    const amount = Math.max(0, roundCurrency(allowance.amount, 0));
    if (amount <= 0) {
      continue;
    }
    totalAllowances += amount;
    autoItems.push({
      itemType: 'EARNING',
      source: 'AUTO',
      code: `ALLOW_${allowance.code.toUpperCase().slice(0, 40)}`,
      label: allowance.label,
      amount,
      isTaxable: true,
      note: 'Phụ cấp theo hợp đồng',
    });
  }

  // 3. Tiền làm thêm giờ (OT) + phần miễn thuế vượt 100%
  const hourlyRate =
    safeStdDays > 0 && config.workingHoursPerDay > 0
      ? safeBaseSalary / (safeStdDays * config.workingHoursPerDay)
      : 0;

  const otPay150 = roundCurrency(hourlyRate * safeOt150 * config.otRate150, 0);
  const otPay200 = roundCurrency(hourlyRate * safeOt200 * config.otRate200, 0);
  const otPay300 = roundCurrency(hourlyRate * safeOt300 * config.otRate300, 0);
  const totalOtPay = otPay150 + otPay200 + otPay300;

  const exemptOtPremium = roundCurrency(
    hourlyRate *
      (safeOt150 * Math.max(0, config.otRate150 - 1) +
        safeOt200 * Math.max(0, config.otRate200 - 1) +
        safeOt300 * Math.max(0, config.otRate300 - 1)),
    0,
  );

  if (otPay150 > 0) {
    autoItems.push({
      itemType: 'EARNING',
      source: 'AUTO',
      code: 'OT_150',
      label: `Tăng ca ngày thường (${safeOt150}h × ${Math.round(config.otRate150 * 100)}%)`,
      amount: otPay150,
      isTaxable: true,
      note: 'Phần vượt 100% miễn thuế TNCN',
    });
  }
  if (otPay200 > 0) {
    autoItems.push({
      itemType: 'EARNING',
      source: 'AUTO',
      code: 'OT_200',
      label: `Tăng ca cuối tuần (${safeOt200}h × ${Math.round(config.otRate200 * 100)}%)`,
      amount: otPay200,
      isTaxable: true,
      note: 'Phần vượt 100% miễn thuế TNCN',
    });
  }
  if (otPay300 > 0) {
    autoItems.push({
      itemType: 'EARNING',
      source: 'AUTO',
      code: 'OT_300',
      label: `Tăng ca ngày lễ (${safeOt300}h × ${Math.round(config.otRate300 * 100)}%)`,
      amount: otPay300,
      isTaxable: true,
      note: 'Phần vượt 100% miễn thuế TNCN',
    });
  }

  // 4. Khoản thưởng & khấu trừ thủ công
  let totalBonus = 0;
  let nonTaxableManualEarnings = 0;
  let otherDeductions = 0;
  const manualComputedItems: ComputedPayslipItem[] = [];

  for (const item of input.manualItems) {
    const amount = Math.max(0, roundCurrency(item.amount, 0));
    if (amount <= 0) {
      continue;
    }
    if (item.itemType === 'EARNING') {
      totalBonus += amount;
      if (!item.isTaxable) {
        nonTaxableManualEarnings += amount;
      }
    } else {
      otherDeductions += amount;
    }
    manualComputedItems.push({
      itemType: item.itemType,
      source: 'MANUAL',
      code: item.code.trim().toUpperCase(),
      label: item.label.trim(),
      amount,
      isTaxable: item.isTaxable,
      note: item.note ?? null,
    });
  }

  // 5. Tổng thu nhập Gross
  const grossSalary = proratedSalary + totalAllowances + totalOtPay + totalBonus;

  // 6. Khấu trừ BHXH / BHYT / BHTN phần người lao động
  const isInsuranceEligible =
    safeInsuranceSalary > 0 && INSURANCE_ELIGIBLE_CONTRACT_TYPES.has(input.contractType);

  const bhxhBhytBase = isInsuranceEligible
    ? Math.min(safeInsuranceSalary, config.bhxhBhytSalaryCap)
    : 0;
  const bhtnBase = isInsuranceEligible
    ? Math.min(safeInsuranceSalary, config.bhtnSalaryCap)
    : 0;

  const socialInsuranceEmp = isInsuranceEligible
    ? roundCurrency(bhxhBhytBase * config.bhxhEmpRate, 0)
    : 0;
  const healthInsuranceEmp = isInsuranceEligible
    ? roundCurrency(bhxhBhytBase * config.bhytEmpRate, 0)
    : 0;
  const unemploymentInsuranceEmp = isInsuranceEligible
    ? roundCurrency(bhtnBase * config.bhtnEmpRate, 0)
    : 0;
  const totalInsuranceEmp =
    socialInsuranceEmp + healthInsuranceEmp + unemploymentInsuranceEmp;

  if (socialInsuranceEmp > 0) {
    autoItems.push({
      itemType: 'DEDUCTION',
      source: 'AUTO',
      code: 'BHXH_EMP',
      label: `BHXH người lao động (${roundCurrency(config.bhxhEmpRate * 100, 2)}%)`,
      amount: socialInsuranceEmp,
      isTaxable: false,
      note: `Mức lương đóng BH: ${bhxhBhytBase.toLocaleString('vi-VN')} ₫`,
    });
  }
  if (healthInsuranceEmp > 0) {
    autoItems.push({
      itemType: 'DEDUCTION',
      source: 'AUTO',
      code: 'BHYT_EMP',
      label: `BHYT người lao động (${roundCurrency(config.bhytEmpRate * 100, 2)}%)`,
      amount: healthInsuranceEmp,
      isTaxable: false,
      note: null,
    });
  }
  if (unemploymentInsuranceEmp > 0) {
    autoItems.push({
      itemType: 'DEDUCTION',
      source: 'AUTO',
      code: 'BHTN_EMP',
      label: `BHTN người lao động (${roundCurrency(config.bhtnEmpRate * 100, 2)}%)`,
      amount: unemploymentInsuranceEmp,
      isTaxable: false,
      note: null,
    });
  }

  // 7. Thu nhập tính thuế & Thuế TNCN
  const assessableIncome = Math.max(
    0,
    grossSalary - exemptOtPremium - nonTaxableManualEarnings,
  );
  const personalDeduction = roundCurrency(config.personalDeduction, 0);
  const dependentDeduction = roundCurrency(safeDependents * config.dependentDeduction, 0);
  const totalTaxDeductions = totalInsuranceEmp + personalDeduction + dependentDeduction;
  const taxableIncome = Math.max(0, roundCurrency(assessableIncome - totalTaxDeductions, 0));
  const personalIncomeTax = calculateProgressivePit(taxableIncome, config.pitBrackets);

  if (personalIncomeTax > 0) {
    autoItems.push({
      itemType: 'DEDUCTION',
      source: 'AUTO',
      code: 'PIT',
      label: 'Thuế Thu nhập Cá nhân (TNCN)',
      amount: personalIncomeTax,
      isTaxable: false,
      note: `Thu nhập tính thuế: ${taxableIncome.toLocaleString('vi-VN')} ₫`,
    });
  }

  // 8. Thực lĩnh Net
  const netSalary = Math.max(
    0,
    roundCurrency(
      grossSalary - totalInsuranceEmp - personalIncomeTax - otherDeductions,
      0,
    ),
  );

  return {
    baseSalary: safeBaseSalary,
    insuranceSalary: safeInsuranceSalary,
    proratedSalary,
    totalAllowances,
    totalOtPay,
    exemptOtPremium,
    totalBonus,
    grossSalary,
    socialInsuranceEmp,
    healthInsuranceEmp,
    unemploymentInsuranceEmp,
    totalInsuranceEmp,
    personalDeduction,
    dependentDeduction,
    taxableIncome,
    personalIncomeTax,
    otherDeductions,
    netSalary,
    items: [...autoItems, ...manualComputedItems],
  };
}
