import { z } from 'zod';

const ISO_DATE_SCHEMA = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày phải đúng định dạng YYYY-MM-DD.');

const TIME_HHMM_SCHEMA = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Giờ phải đúng định dạng HH:mm (00:00–23:59).');

const OPTIONAL_TIME_SCHEMA = z
  .union([TIME_HHMM_SCHEMA, z.literal(''), z.null()])
  .optional()
  .transform((val) => (!val ? null : val));

export const ATTENDANCE_STATUS_VALUES = [
  'PRESENT',
  'LATE',
  'ABSENT',
  'LEAVE',
  'HOLIDAY',
] as const;

export const ATTENDANCE_SOURCE_VALUES = ['WEB', 'IMPORT', 'MANUAL'] as const;

export const createWorkShiftSchema = z.object({
  branchId: z.coerce.number().int().positive().nullable().optional(),
  code: z
    .string()
    .trim()
    .min(2, 'Mã ca làm việc phải từ 2 ký tự.')
    .max(32, 'Mã ca làm việc tối đa 32 ký tự.')
    .regex(/^[A-Za-z0-9_-]+$/, 'Mã ca chỉ gồm chữ cái, số, dấu gạch ngang hoặc gạch dưới.')
    .transform((v) => v.toUpperCase()),
  name: z
    .string()
    .trim()
    .min(2, 'Tên ca làm việc phải từ 2 ký tự.')
    .max(120, 'Tên ca làm việc tối đa 120 ký tự.'),
  startTime: TIME_HHMM_SCHEMA,
  endTime: TIME_HHMM_SCHEMA,
  breakStartTime: OPTIONAL_TIME_SCHEMA,
  breakEndTime: OPTIONAL_TIME_SCHEMA,
  lateGraceMinutes: z.coerce.number().int().min(0).max(180).default(10),
  earlyLeaveGraceMinutes: z.coerce.number().int().min(0).max(180).default(10),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
  description: z.string().trim().max(500).nullable().optional(),
});

export const updateWorkShiftSchema = z.object({
  branchId: z.coerce.number().int().positive().nullable().optional(),
  name: z
    .string()
    .trim()
    .min(2, 'Tên ca làm việc phải từ 2 ký tự.')
    .max(120, 'Tên ca làm việc tối đa 120 ký tự.')
    .optional(),
  startTime: TIME_HHMM_SCHEMA.optional(),
  endTime: TIME_HHMM_SCHEMA.optional(),
  breakStartTime: OPTIONAL_TIME_SCHEMA,
  breakEndTime: OPTIONAL_TIME_SCHEMA,
  lateGraceMinutes: z.coerce.number().int().min(0).max(180).optional(),
  earlyLeaveGraceMinutes: z.coerce.number().int().min(0).max(180).optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
  description: z.string().trim().max(500).nullable().optional(),
});

export const createShiftAssignmentSchema = z
  .object({
    employeeIds: z
      .array(z.coerce.number().int().positive())
      .min(1, 'Vui lòng chọn ít nhất 1 nhân viên.')
      .max(200, 'Tối đa phân ca 200 nhân viên trong 1 lần thao tác.'),
    shiftId: z.coerce.number().int().positive('Vui lòng chọn ca làm việc.'),
    effectiveFrom: ISO_DATE_SCHEMA,
    effectiveTo: z
      .union([ISO_DATE_SCHEMA, z.literal(''), z.null()])
      .optional()
      .transform((val) => (!val ? null : val)),
    workDays: z
      .array(z.coerce.number().int().min(0).max(6))
      .min(1, 'Vui lòng chọn ít nhất 1 ngày làm việc trong tuần.')
      .max(7)
      .default([1, 2, 3, 4, 5]),
    note: z.string().trim().max(500).nullable().optional(),
  })
  .refine(
    (data) => !data.effectiveTo || data.effectiveTo >= data.effectiveFrom,
    {
      message: 'Ngày kết thúc hiệu lực phải lớn hơn hoặc bằng ngày bắt đầu.',
      path: ['effectiveTo'],
    },
  );

export const createHolidaySchema = z.object({
  branchId: z.coerce.number().int().positive().nullable().optional(),
  holidayDate: ISO_DATE_SCHEMA,
  name: z
    .string()
    .trim()
    .min(2, 'Tên ngày lễ phải từ 2 ký tự.')
    .max(160, 'Tên ngày lễ tối đa 160 ký tự.'),
  isPaid: z.boolean().default(true),
  note: z.string().trim().max(500).nullable().optional(),
});

export const updateHolidaySchema = z.object({
  branchId: z.coerce.number().int().positive().nullable().optional(),
  holidayDate: ISO_DATE_SCHEMA.optional(),
  name: z
    .string()
    .trim()
    .min(2, 'Tên ngày lễ phải từ 2 ký tự.')
    .max(160, 'Tên ngày lễ tối đa 160 ký tự.')
    .optional(),
  isPaid: z.boolean().optional(),
  note: z.string().trim().max(500).nullable().optional(),
});

export const checkInOutSchema = z.object({
  note: z.string().trim().max(500).nullable().optional(),
});

export const upsertManualAttendanceSchema = z.object({
  employeeId: z.coerce.number().int().positive('Vui lòng chọn nhân viên.'),
  workDate: ISO_DATE_SCHEMA,
  shiftId: z.coerce.number().int().positive().nullable().optional(),
  checkInTime: OPTIONAL_TIME_SCHEMA,
  checkOutTime: OPTIONAL_TIME_SCHEMA,
  status: z.enum(ATTENDANCE_STATUS_VALUES).nullable().optional(),
  note: z
    .string()
    .trim()
    .min(3, 'Vui lòng nhập lý do điều chỉnh chấm công (tối thiểu 3 ký tự).')
    .max(500, 'Ghi chú tối đa 500 ký tự.'),
});

export const updateManualAttendanceSchema = z.object({
  shiftId: z.coerce.number().int().positive().nullable().optional(),
  checkInTime: OPTIONAL_TIME_SCHEMA,
  checkOutTime: OPTIONAL_TIME_SCHEMA,
  status: z.enum(ATTENDANCE_STATUS_VALUES).nullable().optional(),
  note: z
    .string()
    .trim()
    .min(3, 'Vui lòng nhập lý do điều chỉnh chấm công (tối thiểu 3 ký tự).')
    .max(500, 'Ghi chú tối đa 500 ký tự.'),
});

export type CreateWorkShiftInput = z.infer<typeof createWorkShiftSchema>;
export type UpdateWorkShiftInput = z.infer<typeof updateWorkShiftSchema>;
export type CreateShiftAssignmentInput = z.infer<typeof createShiftAssignmentSchema>;
export type CreateHolidayInput = z.infer<typeof createHolidaySchema>;
export type UpdateHolidayInput = z.infer<typeof updateHolidaySchema>;
export type CheckInOutInput = z.infer<typeof checkInOutSchema>;
export type UpsertManualAttendanceInput = z.infer<typeof upsertManualAttendanceSchema>;
export type UpdateManualAttendanceInput = z.infer<typeof updateManualAttendanceSchema>;
