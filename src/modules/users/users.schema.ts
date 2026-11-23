import { z } from 'zod';

const roleAssignmentSchema = z.object({
  roleId: z.coerce.number().int().positive('Role ID không hợp lệ'),
  branchId: z.coerce.number().int().positive().nullable().optional(),
});

export const createUserSchema = z.object({
  email: z.string().trim().toLowerCase().email('Email không hợp lệ').max(190),
  fullName: z.string().trim().min(2, 'Họ tên phải có tối thiểu 2 ký tự').max(150),
  password: z.string().min(8, 'Mật khẩu phải có tối thiểu 8 ký tự').max(128),
  status: z.enum(['ACTIVE', 'LOCKED']).optional().default('ACTIVE'),
  assignments: z
    .array(roleAssignmentSchema)
    .min(1, 'Cần gán tối thiểu 1 vai trò cho người dùng'),
});

export const updateUserSchema = z.object({
  fullName: z.string().trim().min(2, 'Họ tên phải có tối thiểu 2 ký tự').max(150).optional(),
  status: z.enum(['ACTIVE', 'LOCKED']).optional(),
  assignments: z.array(roleAssignmentSchema).min(1, 'Cần gán tối thiểu 1 vai trò').optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
