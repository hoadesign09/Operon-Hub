import { z } from 'zod';

export const pitBracketSchema = z.object({
  upTo: z.number().positive('Mốc thu nhập bậc thuế phải lớn hơn 0').nullable(),
  rate: z.number().min(0, 'Thuế suất không được âm').max(1, 'Thuế suất tối đa 100%'),
});

export const payrollConfigSchema = z
  .object({
    bhxhEmpRate: z.number().min(0).max(0.5),
    bhytEmpRate: z.number().min(0).max(0.5),
    bhtnEmpRate: z.number().min(0).max(0.5),
    bhxhBhytSalaryCap: z.number().min(0).max(1_000_000_000),
    bhtnSalaryCap: z.number().min(0).max(1_000_000_000),
    personalDeduction: z.number().min(0).max(500_000_000),
    dependentDeduction: z.number().min(0).max(500_000_000),
    workingHoursPerDay: z.number().min(1).max(24),
    otRate150: z.number().min(1).max(5),
    otRate200: z.number().min(1).max(5),
    otRate300: z.number().min(1).max(5),
    requireLockedAttendance: z.boolean(),
    pitBrackets: z.array(pitBracketSchema).min(1).max(15).optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.pitBrackets) {
      return;
    }
    let prevUpTo = 0;
    for (let i = 0; i < data.pitBrackets.length; i += 1) {
      const bracket = data.pitBrackets[i];
      const isLast = i === data.pitBrackets.length - 1;
      if (bracket.upTo === null) {
        if (!isLast) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['pitBrackets', i, 'upTo'],
            message: 'Chỉ bậc thuế cuối cùng mới được đặt không giới hạn (null).',
          });
        }
      } else {
        if (bracket.upTo <= prevUpTo) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['pitBrackets', i, 'upTo'],
            message: 'Các mốc thu nhập của bậc thuế TNCN phải tăng dần.',
          });
        }
        prevUpTo = bracket.upTo;
      }
    }
  });

export const createPayrollPeriodSchema = z.object({
  year: z.coerce.number().int().min(2020).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  branchId: z.coerce.number().int().positive().nullable().optional(),
  code: z
    .string()
    .trim()
    .min(3, 'Mã kỳ lương tối thiểu 3 ký tự')
    .max(50, 'Mã kỳ lương tối đa 50 ký tự')
    .regex(/^[A-Za-z0-9_-]+$/, 'Mã kỳ lương chỉ gồm chữ cái, số, gạch ngang và gạch dưới')
    .optional(),
  name: z
    .string()
    .trim()
    .min(3, 'Tên kỳ lương tối thiểu 3 ký tự')
    .max(200, 'Tên kỳ lương tối đa 200 ký tự')
    .optional(),
  note: z.string().trim().max(2000).nullable().optional(),
});

export const calculatePayrollPeriodSchema = z.object({
  includeDraftAttendance: z.boolean().optional().default(false),
});

export const reopenPayrollPeriodSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(5, 'Vui lòng nhập lý do mở lại kỳ lương (tối thiểu 5 ký tự)')
    .max(500, 'Lý do tối đa 500 ký tự'),
});

export const manualPayslipItemSchema = z.object({
  itemType: z.enum(['EARNING', 'DEDUCTION']),
  code: z
    .string()
    .trim()
    .min(2, 'Mã khoản tối thiểu 2 ký tự')
    .max(50, 'Mã khoản tối đa 50 ký tự')
    .regex(/^[A-Za-z0-9_-]+$/, 'Mã khoản chỉ gồm chữ, số, gạch ngang, gạch dưới'),
  label: z
    .string()
    .trim()
    .min(2, 'Tên khoản tối thiểu 2 ký tự')
    .max(200, 'Tên khoản tối đa 200 ký tự'),
  amount: z.coerce
    .number()
    .min(0, 'Số tiền không được âm')
    .max(10_000_000_000, 'Số tiền vượt giới hạn cho phép'),
  isTaxable: z.boolean().optional().default(true),
  note: z.string().trim().max(300).nullable().optional(),
});

export const updatePayslipManualSchema = z.object({
  note: z.string().trim().max(500).nullable().optional(),
  manualItems: z.array(manualPayslipItemSchema).max(50, 'Tối đa 50 khoản điều chỉnh thủ công'),
});

export type PitBracket = z.infer<typeof pitBracketSchema>;
export type PayrollConfigInput = z.infer<typeof payrollConfigSchema>;
export type CreatePayrollPeriodInput = z.infer<typeof createPayrollPeriodSchema>;
export type CalculatePayrollPeriodInput = z.infer<typeof calculatePayrollPeriodSchema>;
export type ReopenPayrollPeriodInput = z.infer<typeof reopenPayrollPeriodSchema>;
export type ManualPayslipItemInput = z.infer<typeof manualPayslipItemSchema>;
export type UpdatePayslipManualInput = z.infer<typeof updatePayslipManualSchema>;
