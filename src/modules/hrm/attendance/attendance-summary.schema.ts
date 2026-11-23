import { z } from 'zod';

const YEAR_SCHEMA = z.coerce.number().int().min(2020, 'Năm không hợp lệ.').max(2100, 'Năm không hợp lệ.');
const MONTH_SCHEMA = z.coerce.number().int().min(1, 'Tháng phải từ 1 đến 12.').max(12, 'Tháng phải từ 1 đến 12.');

export const calculateSummariesSchema = z.object({
  year: YEAR_SCHEMA,
  month: MONTH_SCHEMA,
  branchId: z.coerce.number().int().positive().nullable().optional(),
  departmentId: z.coerce.number().int().positive().nullable().optional(),
  employeeIds: z.array(z.coerce.number().int().positive()).max(500).optional(),
});

export const updateAttendanceSummarySchema = z.object({
  standardWorkDays: z.coerce.number().min(0).max(31).optional(),
  actualWorkDays: z.coerce.number().min(0).max(31).optional(),
  businessTripDays: z.coerce.number().min(0).max(31).optional(),
  paidLeaveDays: z.coerce.number().min(0).max(31).optional(),
  unpaidLeaveDays: z.coerce.number().min(0).max(31).optional(),
  holidayDays: z.coerce.number().min(0).max(31).optional(),
  otHours150: z.coerce.number().min(0).max(200).optional(),
  otHours200: z.coerce.number().min(0).max(200).optional(),
  otHours300: z.coerce.number().min(0).max(200).optional(),
  lateCount: z.coerce.number().int().min(0).max(31).optional(),
  adjustmentNote: z
    .string()
    .trim()
    .min(3, 'Vui lòng nhập lý do điều chỉnh bảng công (tối thiểu 3 ký tự).')
    .max(500, 'Ghi chú điều chỉnh tối đa 500 ký tự.'),
});

export const lockAttendanceSummariesSchema = z.object({
  year: YEAR_SCHEMA,
  month: MONTH_SCHEMA,
  branchId: z.coerce.number().int().positive().nullable().optional(),
  summaryIds: z.array(z.coerce.number().int().positive()).max(500).optional(),
  note: z.string().trim().max(500).nullable().optional(),
});

export const unlockAttendanceSummariesSchema = z.object({
  year: YEAR_SCHEMA,
  month: MONTH_SCHEMA,
  branchId: z.coerce.number().int().positive().nullable().optional(),
  summaryIds: z.array(z.coerce.number().int().positive()).max(500).optional(),
  reason: z
    .string()
    .trim()
    .min(3, 'Vui lòng nhập lý do mở khóa bảng công (tối thiểu 3 ký tự).')
    .max(500, 'Lý do mở khóa tối đa 500 ký tự.'),
});

export type CalculateSummariesInput = z.infer<typeof calculateSummariesSchema>;
export type UpdateAttendanceSummaryInput = z.infer<typeof updateAttendanceSummarySchema>;
export type LockAttendanceSummariesInput = z.infer<typeof lockAttendanceSummariesSchema>;
export type UnlockAttendanceSummariesInput = z.infer<typeof unlockAttendanceSummariesSchema>;
