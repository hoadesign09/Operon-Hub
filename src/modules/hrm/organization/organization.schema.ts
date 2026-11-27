import { z } from 'zod';

const ORG_CODE_REGEX = /^[A-Z0-9_-]{2,30}$/;

export const createDepartmentSchema = z.object({
  branchId: z.coerce.number().int().positive('Vui lòng chọn chi nhánh hợp lệ'),
  parentId: z.coerce.number().int().positive().nullable().optional(),
  managerEmployeeId: z.coerce.number().int().positive().nullable().optional(),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(ORG_CODE_REGEX, 'Mã phòng ban gồm 2–30 ký tự chữ hoa, số, gạch ngang hoặc gạch dưới'),
  name: z.string().trim().min(2, 'Tên phòng ban tối thiểu 2 ký tự').max(150),
  nameEn: z.string().trim().max(160).nullable().optional(),
  description: z.string().trim().max(255).nullable().optional(),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional().default(0),
  isActive: z.boolean().optional().default(true),
});

export const updateDepartmentSchema = z.object({
  branchId: z.coerce.number().int().positive().optional(),
  parentId: z.coerce.number().int().positive().nullable().optional(),
  managerEmployeeId: z.coerce.number().int().positive().nullable().optional(),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(ORG_CODE_REGEX, 'Mã phòng ban gồm 2–30 ký tự chữ hoa, số, gạch ngang hoặc gạch dưới')
    .optional(),
  name: z.string().trim().min(2, 'Tên phòng ban tối thiểu 2 ký tự').max(150).optional(),
  nameEn: z.string().trim().max(160).nullable().optional(),
  description: z.string().trim().max(255).nullable().optional(),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional(),
  isActive: z.boolean().optional(),
});

export const createPositionSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(ORG_CODE_REGEX, 'Mã chức danh gồm 2–30 ký tự chữ hoa, số, gạch ngang hoặc gạch dưới'),
  name: z.string().trim().min(2, 'Tên chức danh tối thiểu 2 ký tự').max(150),
  nameEn: z.string().trim().max(160).nullable().optional(),
  level: z.coerce.number().int().min(1, 'Cấp bậc tối thiểu là 1').max(10, 'Cấp bậc tối đa là 10').default(1),
  description: z.string().trim().max(255).nullable().optional(),
  isActive: z.boolean().optional().default(true),
});

export const updatePositionSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(ORG_CODE_REGEX, 'Mã chức danh gồm 2–30 ký tự chữ hoa, số, gạch ngang hoặc gạch dưới')
    .optional(),
  name: z.string().trim().min(2, 'Tên chức danh tối thiểu 2 ký tự').max(150).optional(),
  nameEn: z.string().trim().max(160).nullable().optional(),
  level: z.coerce.number().int().min(1).max(10).optional(),
  description: z.string().trim().max(255).nullable().optional(),
  isActive: z.boolean().optional(),
});

export type CreateDepartmentInput = z.infer<typeof createDepartmentSchema>;
export type UpdateDepartmentInput = z.infer<typeof updateDepartmentSchema>;
export type CreatePositionInput = z.infer<typeof createPositionSchema>;
export type UpdatePositionInput = z.infer<typeof updatePositionSchema>;
