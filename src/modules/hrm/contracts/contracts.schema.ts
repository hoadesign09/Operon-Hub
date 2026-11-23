import { z } from 'zod';
import { roundCurrency } from '@/lib/portable/currency-utils';

const CONTRACT_NO_REGEX = /^[A-Z0-9/_-]{3,50}$/;
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const optionalIsoDate = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((val) => (val && val.length > 0 ? val : null))
  .refine((val) => val === null || ISO_DATE_REGEX.test(val), {
    message: 'Định dạng ngày phải là YYYY-MM-DD.',
  });

const optionalTrimmedString = (maxLength: number) =>
  z
    .string()
    .trim()
    .max(maxLength, `Tối đa ${maxLength} ký tự.`)
    .optional()
    .nullable()
    .transform((val) => (val && val.length > 0 ? val : null));

export const CONTRACT_TYPE_VALUES = [
  'PROBATION',
  'FIXED_TERM',
  'INDEFINITE',
  'PART_TIME',
] as const;

export const CONTRACT_STATUS_VALUES = [
  'DRAFT',
  'ACTIVE',
  'EXPIRED',
  'TERMINATED',
] as const;

export const WORK_HISTORY_CHANGE_TYPES = [
  'HIRE',
  'PROMOTION',
  'TRANSFER',
  'SALARY_ADJUST',
  'TERMINATION',
] as const;

export const allowanceItemSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(1, 'Mã phụ cấp không được trống.')
    .max(30, 'Mã phụ cấp tối đa 30 ký tự.'),
  label: z
    .string()
    .trim()
    .min(1, 'Tên phụ cấp không được trống.')
    .max(120, 'Tên phụ cấp tối đa 120 ký tự.'),
  amount: z.coerce
    .number()
    .min(0, 'Số tiền phụ cấp không được âm.')
    .transform((v) => roundCurrency(v)),
});

export type ContractAllowanceItem = z.infer<typeof allowanceItemSchema>;

export const createContractSchema = z.object({
  employeeId: z.coerce.number().int().positive('Vui lòng chọn nhân viên.'),
  contractNo: z
    .string()
    .trim()
    .toUpperCase()
    .regex(
      CONTRACT_NO_REGEX,
      'Số hợp đồng gồm 3–50 ký tự (chữ hoa, số, dấu gạch ngang/dưới/chéo).',
    ),
  contractType: z.enum(CONTRACT_TYPE_VALUES),
  startDate: z
    .string()
    .trim()
    .regex(ISO_DATE_REGEX, 'Ngày bắt đầu phải theo định dạng YYYY-MM-DD.'),
  endDate: optionalIsoDate,
  baseSalary: z.coerce
    .number()
    .min(0, 'Lương cơ bản không được âm.')
    .transform((v) => roundCurrency(v)),
  insuranceSalary: z.coerce
    .number()
    .min(0, 'Lương đóng BHXH không được âm.')
    .default(0)
    .transform((v) => roundCurrency(v)),
  allowances: z.array(allowanceItemSchema).max(20).default([]),
  status: z.enum(CONTRACT_STATUS_VALUES).default('ACTIVE'),
  signedDate: optionalIsoDate,
  note: optionalTrimmedString(500),
  autoClosePreviousActive: z.boolean().default(true),
});

export const updateContractSchema = z.object({
  contractNo: z
    .string()
    .trim()
    .toUpperCase()
    .regex(CONTRACT_NO_REGEX, 'Số hợp đồng không hợp lệ.')
    .optional(),
  contractType: z.enum(CONTRACT_TYPE_VALUES).optional(),
  startDate: z
    .string()
    .trim()
    .regex(ISO_DATE_REGEX, 'Ngày bắt đầu sai định dạng YYYY-MM-DD.')
    .optional(),
  endDate: optionalIsoDate,
  baseSalary: z.coerce
    .number()
    .min(0, 'Lương cơ bản không được âm.')
    .transform((v) => roundCurrency(v))
    .optional(),
  insuranceSalary: z.coerce
    .number()
    .min(0, 'Lương đóng BHXH không được âm.')
    .transform((v) => roundCurrency(v))
    .optional(),
  allowances: z.array(allowanceItemSchema).max(20).optional(),
  status: z.enum(CONTRACT_STATUS_VALUES).optional(),
  signedDate: optionalIsoDate,
  note: optionalTrimmedString(500),
  autoClosePreviousActive: z.boolean().optional(),
});

export const createWorkHistorySchema = z.object({
  changeType: z.enum(WORK_HISTORY_CHANGE_TYPES),
  effectiveDate: z
    .string()
    .trim()
    .regex(ISO_DATE_REGEX, 'Ngày hiệu lực phải theo định dạng YYYY-MM-DD.'),
  decisionNo: optionalTrimmedString(50),
  toBranchId: z.coerce.number().int().positive().nullable().optional(),
  toDepartmentId: z.coerce.number().int().positive().nullable().optional(),
  toPositionId: z.coerce.number().int().positive().nullable().optional(),
  fromSalary: z.coerce
    .number()
    .min(0)
    .transform((v) => roundCurrency(v))
    .nullable()
    .optional(),
  toSalary: z.coerce
    .number()
    .min(0)
    .transform((v) => roundCurrency(v))
    .nullable()
    .optional(),
  note: optionalTrimmedString(500),
  syncToEmployeeProfile: z.boolean().default(true),
});

export type CreateContractInput = z.infer<typeof createContractSchema>;
export type UpdateContractInput = z.infer<typeof updateContractSchema>;
export type CreateWorkHistoryInput = z.infer<typeof createWorkHistorySchema>;
