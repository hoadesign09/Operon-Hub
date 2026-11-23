import { describe, expect, it } from 'vitest';
import {
  calculateEmployeePayslip,
  calculateProgressivePit,
  DEFAULT_PAYROLL_CONFIG,
} from '@/modules/hrm/payroll/payroll-calculator';

describe('hrm/payroll-calculator', () => {
  it('tính chính xác biểu thuế TNCN lũy tiến 7 bậc theo quy định Việt Nam', () => {
    expect(calculateProgressivePit(0)).toBe(0);
    expect(calculateProgressivePit(-5_000_000)).toBe(0);
    // Bậc 1: 5tr * 5% = 250,000
    expect(calculateProgressivePit(5_000_000)).toBe(250_000);
    // Bậc 2: 250k + 5tr * 10% = 750,000
    expect(calculateProgressivePit(10_000_000)).toBe(750_000);
    // Bậc 3: 750k + 8tr * 15% = 1,950,000
    expect(calculateProgressivePit(18_000_000)).toBe(1_950_000);
    // Bậc 4: 1,950k + 14tr * 20% = 4,750,000
    expect(calculateProgressivePit(32_000_000)).toBe(4_750_000);
    // Bậc 5: 4,750k + 20tr * 25% = 9,750,000
    expect(calculateProgressivePit(52_000_000)).toBe(9_750_000);
    // Bậc 6: 9,750k + 28tr * 30% = 18,150,000
    expect(calculateProgressivePit(80_000_000)).toBe(18_150_000);
    // Bậc 7: 18,150k + 20tr * 35% = 25,150,000
    expect(calculateProgressivePit(100_000_000)).toBe(25_150_000);
  });

  it('tính chính xác lương theo công, phụ cấp, BHXH/BHYT/BHTN (10.5%), giảm trừ NPT và thuế TNCN', () => {
    const res = calculateEmployeePayslip({
      contractType: 'FIXED_TERM',
      baseSalary: 22_000_000,
      insuranceSalary: 20_000_000,
      allowances: [{ code: 'MEAL', label: 'Phụ cấp ăn trưa', amount: 1_000_000 }],
      standardWorkDays: 22,
      payableDays: 22,
      otHours150: 0,
      otHours200: 0,
      otHours300: 0,
      dependentsCount: 1,
      manualItems: [],
      config: DEFAULT_PAYROLL_CONFIG,
    });

    expect(res.proratedSalary).toBe(22_000_000);
    expect(res.totalAllowances).toBe(1_000_000);
    expect(res.grossSalary).toBe(23_000_000);
    // BH: 20tr * 8% = 1.6tr, 1.5% = 300k, 1% = 200k => 2.1tr
    expect(res.socialInsuranceEmp).toBe(1_600_000);
    expect(res.healthInsuranceEmp).toBe(300_000);
    expect(res.unemploymentInsuranceEmp).toBe(200_000);
    expect(res.totalInsuranceEmp).toBe(2_100_000);
    // Giảm trừ: 2.1tr + 11tr + 4.4tr = 17.5tr => TNTT = 23tr - 17.5tr = 5.5tr
    // Thuế TNCN: 5tr*5% (250k) + 0.5tr*10% (50k) = 300,000
    expect(res.taxableIncome).toBe(5_500_000);
    expect(res.personalIncomeTax).toBe(300_000);
    expect(res.netSalary).toBe(23_000_000 - 2_100_000 - 300_000);
  });

  it('tính OT 150%/200%/300%, miễn thuế TNCN phần chênh lệch vượt 100% và áp trần đóng BH', () => {
    // baseSalary = 60,000,000, insuranceSalary = 60,000,000 (> cap BHXH/BHYT 46.8tr, < cap BHTN 99.2tr)
    const res = calculateEmployeePayslip({
      contractType: 'INDEFINITE',
      baseSalary: 35_200_000, // 35.2tr / (22 * 8) = 200,000/h
      insuranceSalary: 60_000_000,
      allowances: [],
      standardWorkDays: 22,
      payableDays: 20, // prorated = 32,000,000
      otHours150: 4, // 4 * 200k * 1.5 = 1,200,000 (exempt = 400k)
      otHours200: 2, // 2 * 200k * 2.0 = 800,000 (exempt = 400k)
      otHours300: 1, // 1 * 200k * 3.0 = 600,000 (exempt = 400k)
      dependentsCount: 0,
      manualItems: [
        {
          itemType: 'EARNING',
          code: 'BONUS',
          label: 'Thưởng dự án',
          amount: 2_000_000,
          isTaxable: true,
        },
        {
          itemType: 'EARNING',
          code: 'SUPPORT_NONTAX',
          label: 'Trợ cấp miễn thuế',
          amount: 1_000_000,
          isTaxable: false,
        },
        {
          itemType: 'DEDUCTION',
          code: 'ADVANCE',
          label: 'Tạm ứng',
          amount: 1_500_000,
          isTaxable: false,
        },
      ],
      config: DEFAULT_PAYROLL_CONFIG,
    });

    expect(res.proratedSalary).toBe(32_000_000);
    expect(res.totalOtPay).toBe(2_600_000);
    expect(res.exemptOtPremium).toBe(1_200_000);
    expect(res.totalBonus).toBe(3_000_000);
    expect(res.grossSalary).toBe(37_600_000);

    // BHXH & BHYT bị khống chế trần 46,800,000; BHTN tính trên 60,000,000
    expect(res.socialInsuranceEmp).toBe(Math.round(46_800_000 * 0.08));
    expect(res.healthInsuranceEmp).toBe(Math.round(46_800_000 * 0.015));
    expect(res.unemploymentInsuranceEmp).toBe(Math.round(60_000_000 * 0.01));

    // Assessable = 37.6tr - 1.2tr (OT exempt) - 1.0tr (non-taxable manual) = 35.4tr
    const expectedTaxable = 35_400_000 - res.totalInsuranceEmp - 11_000_000;
    expect(res.taxableIncome).toBe(expectedTaxable);
    expect(res.otherDeductions).toBe(1_500_000);
    expect(res.netSalary).toBe(
      res.grossSalary - res.totalInsuranceEmp - res.personalIncomeTax - 1_500_000,
    );
  });

  it('hợp đồng thử việc (PROBATION) không trích BHXH/BHYT/BHTN bắt buộc', () => {
    const res = calculateEmployeePayslip({
      contractType: 'PROBATION',
      baseSalary: 10_000_000,
      insuranceSalary: 10_000_000,
      allowances: [],
      standardWorkDays: 22,
      payableDays: 22,
      otHours150: 0,
      otHours200: 0,
      otHours300: 0,
      dependentsCount: 0,
      manualItems: [],
      config: DEFAULT_PAYROLL_CONFIG,
    });

    expect(res.totalInsuranceEmp).toBe(0);
    expect(res.personalIncomeTax).toBe(0);
    expect(res.netSalary).toBe(10_000_000);
  });
});
