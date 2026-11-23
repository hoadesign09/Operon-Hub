import { z } from 'zod';

const EMPLOYEE_CODE_REGEX = /^[A-Z0-9_-]{3,30}$/;
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const optionalTrimmedString = (maxLength: number) =>
  z
    .string()
    .trim()
    .max(maxLength, `Tối đa ${maxLength} ký tự.`)
    .optional()
    .nullable()
    .transform((val) => (val && val.length > 0 ? val : null));

const optionalIsoDate = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((val) => (val && val.length > 0 ? val : null))
  .refine((val) => val === null || ISO_DATE_REGEX.test(val), {
    message: 'Định dạng ngày phải là YYYY-MM-DD.',
  });

const optionalEmail = z
  .string()
  .trim()
  .toLowerCase()
  .optional()
  .nullable()
  .transform((val) => (val && val.length > 0 ? val : null))
  .refine((val) => val === null || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val), {
    message: 'Địa chỉ email không hợp lệ.',
  });

export const EMPLOYEE_GENDER_VALUES = ['MALE', 'FEMALE', 'OTHER'] as const;
export const EMPLOYMENT_STATUS_VALUES = [
  'PROBATION',
  'ACTIVE',
  'ON_LEAVE',
  'RESIGNED',
  'TERMINATED',
] as const;
export const EMPLOYEE_DOC_TYPE_VALUES = [
  'ID_CARD',
  'DEGREE',
  'CONTRACT',
  'HEALTH_CERT',
  'OTHER',
] as const;

export const createEmployeeSchema = z.object({
  employeeCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(EMPLOYEE_CODE_REGEX, 'Mã nhân viên gồm 3–30 ký tự (chữ hoa, số, dấu gạch dưới/ngang).'),
  fullName: z
    .string()
    .trim()
    .min(2, 'Họ và tên tối thiểu 2 ký tự.')
    .max(150, 'Họ và tên tối đa 150 ký tự.'),
  branchId: z.coerce.number().int().positive('Vui lòng chọn chi nhánh.'),
  departmentId: z.coerce.number().int().positive('Vui lòng chọn phòng ban.'),
  positionId: z.coerce.number().int().positive('Vui lòng chọn chức danh.'),
  managerId: z.coerce.number().int().positive().nullable().optional(),
  gender: z.enum(EMPLOYEE_GENDER_VALUES).nullable().optional(),
  dateOfBirth: optionalIsoDate,
  nationalId: optionalTrimmedString(30),
  taxCode: optionalTrimmedString(30),
  socialInsuranceNo: optionalTrimmedString(30),
  phone: optionalTrimmedString(30),
  workEmail: z.string().trim().toLowerCase().email('Email công việc không hợp lệ.').max(191),
  personalEmail: optionalEmail,
  address: optionalTrimmedString(255),
  bankName: optionalTrimmedString(120),
  bankAccountNo: optionalTrimmedString(50),
  hireDate: z
    .string()
    .trim()
    .regex(ISO_DATE_REGEX, 'Ngày vào làm bắt buộc theo định dạng YYYY-MM-DD.'),
  probationEndDate: optionalIsoDate,
  terminationDate: optionalIsoDate,
  employmentStatus: z.enum(EMPLOYMENT_STATUS_VALUES).default('PROBATION'),
  dependentsCount: z.coerce.number().int().min(0).max(20).default(0),
  note: optionalTrimmedString(500),
  autoCreateAccount: z.boolean().default(true),
  initialPassword: z
    .string()
    .min(8, 'Mật khẩu khởi tạo tối thiểu 8 ký tự.')
    .max(100, 'Mật khẩu tối đa 100 ký tự.')
    .optional(),
  userId: z.coerce.number().int().positive().nullable().optional(),
});

export const updateEmployeeSchema = z.object({
  employeeCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(EMPLOYEE_CODE_REGEX, 'Mã nhân viên gồm 3–30 ký tự (chữ hoa, số, dấu gạch dưới/ngang).')
    .optional(),
  fullName: z.string().trim().min(2).max(150).optional(),
  branchId: z.coerce.number().int().positive().optional(),
  departmentId: z.coerce.number().int().positive().optional(),
  positionId: z.coerce.number().int().positive().optional(),
  managerId: z.coerce.number().int().positive().nullable().optional(),
  gender: z.enum(EMPLOYEE_GENDER_VALUES).nullable().optional(),
  dateOfBirth: optionalIsoDate,
  nationalId: optionalTrimmedString(30),
  taxCode: optionalTrimmedString(30),
  socialInsuranceNo: optionalTrimmedString(30),
  phone: optionalTrimmedString(30),
  workEmail: z.string().trim().toLowerCase().email('Email công việc không hợp lệ.').max(191).optional(),
  personalEmail: optionalEmail,
  address: optionalTrimmedString(255),
  bankName: optionalTrimmedString(120),
  bankAccountNo: optionalTrimmedString(50),
  hireDate: z.string().trim().regex(ISO_DATE_REGEX, 'Ngày vào làm sai định dạng YYYY-MM-DD.').optional(),
  probationEndDate: optionalIsoDate,
  terminationDate: optionalIsoDate,
  employmentStatus: z.enum(EMPLOYMENT_STATUS_VALUES).optional(),
  dependentsCount: z.coerce.number().int().min(0).max(20).optional(),
  note: optionalTrimmedString(500),
  lockAccountOnTermination: z.boolean().optional(),
  forceOffboardWithUnreturnedAssets: z.boolean().optional(),
});

export const selfUpdateEmployeeSchema = z.object({
  phone: optionalTrimmedString(30),
  personalEmail: optionalEmail,
  address: optionalTrimmedString(255),
  bankName: optionalTrimmedString(120),
  bankAccountNo: optionalTrimmedString(50),
});

export const employeeDocumentMetaSchema = z.object({
  docType: z.enum(EMPLOYEE_DOC_TYPE_VALUES).default('OTHER'),
  title: z
    .string()
    .trim()
    .min(2, 'Tên tài liệu tối thiểu 2 ký tự.')
    .max(200, 'Tên tài liệu tối đa 200 ký tự.'),
  expiredAt: optionalIsoDate,
});

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
export type SelfUpdateEmployeeInput = z.infer<typeof selfUpdateEmployeeSchema>;
export type EmployeeDocumentMetaInput = z.infer<typeof employeeDocumentMetaSchema>;
