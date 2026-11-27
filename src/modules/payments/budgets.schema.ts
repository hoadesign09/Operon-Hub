import { z } from 'zod';
import {
  BUDGET_ENFORCEMENT_MODES,
  BUDGET_PERIOD_TYPES,
  BUDGET_STATUSES,
} from '@/modules/payments/budgets.constants';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const BUDGET_CODE_REGEX = /^[A-Z0-9_-]{3,50}$/;

export const createBudgetSchema = z
  .object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(BUDGET_CODE_REGEX, 'Mã quỹ ngân sách gồm 3–50 ký tự chữ hoa, số, gạch ngang hoặc gạch dưới')
      .optional(),
    name: z.string().trim().min(3, 'Tên quỹ ngân sách tối thiểu 3 ký tự').max(200),
    nameEn: z.string().trim().max(220).nullable().optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    fiscalYear: z.coerce.number().int().min(2020).max(2100),
    periodType: z.enum(BUDGET_PERIOD_TYPES).default('ANNUAL'),
    periodLabel: z.string().trim().min(2, 'Nhãn kỳ ngân sách tối thiểu 2 ký tự').max(60),
    startDate: z.string().trim().regex(DATE_REGEX, 'Ngày bắt đầu phải theo định dạng YYYY-MM-DD'),
    endDate: z.string().trim().regex(DATE_REGEX, 'Ngày kết thúc phải theo định dạng YYYY-MM-DD'),
    branchId: z.coerce.number().int().positive().nullable().optional(),
    departmentId: z.coerce.number().int().positive().nullable().optional(),
    categoryId: z.coerce.number().int().positive().nullable().optional(),
    projectId: z.coerce.number().int().positive().nullable().optional(),
    ownerUserId: z.coerce.number().int().positive().nullable().optional(),
    allocatedAmount: z.coerce
      .number()
      .positive('Hạn mức ngân sách ban đầu phải lớn hơn 0')
      .max(10_000_000_000_000),
    warningThresholdPercent: z.coerce
      .number()
      .min(1, 'Ngưỡng cảnh báo từ 1% đến 100%')
      .max(100, 'Ngưỡng cảnh báo từ 1% đến 100%')
      .default(80),
    enforcementMode: z.enum(BUDGET_ENFORCEMENT_MODES).default('HARD_BLOCK'),
    status: z.enum(['DRAFT', 'ACTIVE']).default('ACTIVE'),
  })
  .superRefine((data, ctx) => {
    if (data.endDate < data.startDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endDate'],
        message: 'Ngày kết thúc kỳ ngân sách phải lớn hơn hoặc bằng ngày bắt đầu.',
      });
    }
  });

export const updateBudgetSchema = z
  .object({
    name: z.string().trim().min(3, 'Tên quỹ ngân sách tối thiểu 3 ký tự').max(200).optional(),
    nameEn: z.string().trim().max(220).nullable().optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    fiscalYear: z.coerce.number().int().min(2020).max(2100).optional(),
    periodType: z.enum(BUDGET_PERIOD_TYPES).optional(),
    periodLabel: z.string().trim().min(2).max(60).optional(),
    startDate: z.string().trim().regex(DATE_REGEX, 'Ngày bắt đầu phải theo định dạng YYYY-MM-DD').optional(),
    endDate: z.string().trim().regex(DATE_REGEX, 'Ngày kết thúc phải theo định dạng YYYY-MM-DD').optional(),
    branchId: z.coerce.number().int().positive().nullable().optional(),
    departmentId: z.coerce.number().int().positive().nullable().optional(),
    categoryId: z.coerce.number().int().positive().nullable().optional(),
    projectId: z.coerce.number().int().positive().nullable().optional(),
    ownerUserId: z.coerce.number().int().positive().nullable().optional(),
    warningThresholdPercent: z.coerce.number().min(1).max(100).optional(),
    enforcementMode: z.enum(BUDGET_ENFORCEMENT_MODES).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.startDate && data.endDate && data.endDate < data.startDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endDate'],
        message: 'Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu.',
      });
    }
  });

export const adjustBudgetSchema = z.object({
  action: z.enum(['TOP_UP', 'REDUCE']),
  amount: z.coerce
    .number()
    .positive('Số tiền điều chỉnh phải lớn hơn 0')
    .max(10_000_000_000_000),
  reason: z.string().trim().min(3, 'Vui lòng nhập lý do điều chỉnh (tối thiểu 3 ký tự)').max(500),
});

export const transferBudgetSchema = z
  .object({
    fromBudgetId: z.coerce.number().int().positive('Vui lòng chọn quỹ ngân sách nguồn'),
    toBudgetId: z.coerce.number().int().positive('Vui lòng chọn quỹ ngân sách đích'),
    amount: z.coerce
      .number()
      .positive('Số tiền điều chuyển phải lớn hơn 0')
      .max(10_000_000_000_000),
    reason: z.string().trim().min(3, 'Vui lòng nhập lý do điều chuyển (tối thiểu 3 ký tự)').max(500),
  })
  .superRefine((data, ctx) => {
    if (data.fromBudgetId === data.toBudgetId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['toBudgetId'],
        message: 'Quỹ đích phải khác Quỹ nguồn.',
      });
    }
  });

export const changeBudgetStatusSchema = z.object({
  status: z.enum(BUDGET_STATUSES),
  reason: z.string().trim().max(500).nullable().optional(),
});

export type CreateBudgetInput = z.infer<typeof createBudgetSchema>;
export type UpdateBudgetInput = z.infer<typeof updateBudgetSchema>;
export type AdjustBudgetInput = z.infer<typeof adjustBudgetSchema>;
export type TransferBudgetInput = z.infer<typeof transferBudgetSchema>;
export type ChangeBudgetStatusInput = z.infer<typeof changeBudgetStatusSchema>;
