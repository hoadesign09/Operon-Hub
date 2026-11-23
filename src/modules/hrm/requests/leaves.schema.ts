import { z } from 'zod';

const LEAVE_TYPE_CODE_REGEX = /^[A-Z0-9_]{2,32}$/;
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export const leaveSessionEnum = z.enum(['FULL', 'AM', 'PM']);

export const createLeaveTypeSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(LEAVE_TYPE_CODE_REGEX, 'Mã loại phép gồm 2–32 ký tự chữ HOA, số hoặc gạch dưới'),
  name: z.string().trim().min(2, 'Tên loại phép tối thiểu 2 ký tự').max(120),
  isPaid: z.boolean().default(true),
  defaultDaysPerYear: z.coerce.number().min(0, 'Số ngày/năm không được âm').max(365),
  allowCarryOver: z.boolean().default(false),
  maxCarryOverDays: z.coerce.number().min(0, 'Số ngày kết chuyển không được âm').max(365).default(0),
  requiresAttachment: z.boolean().default(false),
  description: z.string().trim().max(255).nullable().optional(),
  isActive: z.boolean().default(true),
});

export const updateLeaveTypeSchema = z.object({
  name: z.string().trim().min(2, 'Tên loại phép tối thiểu 2 ký tự').max(120).optional(),
  isPaid: z.boolean().optional(),
  defaultDaysPerYear: z.coerce.number().min(0).max(365).optional(),
  allowCarryOver: z.boolean().optional(),
  maxCarryOverDays: z.coerce.number().min(0).max(365).optional(),
  requiresAttachment: z.boolean().optional(),
  description: z.string().trim().max(255).nullable().optional(),
  isActive: z.boolean().optional(),
});

export const initializeLeaveBalancesSchema = z.object({
  year: z.coerce.number().int().min(2020, 'Năm tối thiểu 2020').max(2100, 'Năm tối đa 2100'),
  branchId: z.coerce.number().int().positive().nullable().optional(),
  includeCarryOver: z.boolean().default(true),
  includeSeniorityBonus: z.boolean().default(true),
});

export const updateLeaveBalanceSchema = z.object({
  entitledDays: z.coerce.number().min(0, 'Số ngày tiêu chuẩn không được âm').max(365),
  carriedOverDays: z.coerce.number().min(0, 'Số ngày kết chuyển không được âm').max(365),
  note: z.string().trim().max(255).nullable().optional(),
});

export const createLeaveRequestSchema = z.object({
  leaveTypeId: z.coerce.number().int().positive('Vui lòng chọn loại nghỉ phép'),
  startDate: z.string().trim().regex(ISO_DATE_REGEX, 'Ngày bắt đầu phải đúng định dạng YYYY-MM-DD'),
  endDate: z.string().trim().regex(ISO_DATE_REGEX, 'Ngày kết thúc phải đúng định dạng YYYY-MM-DD'),
  startSession: leaveSessionEnum.default('FULL'),
  endSession: leaveSessionEnum.default('FULL'),
  reason: z.string().trim().min(3, 'Vui lòng nhập lý do nghỉ tối thiểu 3 ký tự').max(1000),
  attachmentUrl: z.string().trim().max(500).nullable().optional(),
  submitNow: z.boolean().default(false),
});

export const updateLeaveRequestSchema = z.object({
  leaveTypeId: z.coerce.number().int().positive().optional(),
  startDate: z.string().trim().regex(ISO_DATE_REGEX, 'Ngày bắt đầu phải đúng định dạng YYYY-MM-DD').optional(),
  endDate: z.string().trim().regex(ISO_DATE_REGEX, 'Ngày kết thúc phải đúng định dạng YYYY-MM-DD').optional(),
  startSession: leaveSessionEnum.optional(),
  endSession: leaveSessionEnum.optional(),
  reason: z.string().trim().min(3, 'Lý do tối thiểu 3 ký tự').max(1000).optional(),
  attachmentUrl: z.string().trim().max(500).nullable().optional(),
});

export const cancelLeaveRequestSchema = z.object({
  comment: z.string().trim().max(500).nullable().optional(),
});

export type CreateLeaveTypeInput = z.infer<typeof createLeaveTypeSchema>;
export type UpdateLeaveTypeInput = z.infer<typeof updateLeaveTypeSchema>;
export type InitializeLeaveBalancesInput = z.infer<typeof initializeLeaveBalancesSchema>;
export type UpdateLeaveBalanceInput = z.infer<typeof updateLeaveBalanceSchema>;
export type CreateLeaveRequestInput = z.infer<typeof createLeaveRequestSchema>;
export type UpdateLeaveRequestInput = z.infer<typeof updateLeaveRequestSchema>;
