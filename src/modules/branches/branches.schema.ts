import { z } from 'zod';

const BRANCH_CODE_REGEX = /^[A-Z0-9_-]{2,30}$/;

export const createBranchSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(BRANCH_CODE_REGEX, 'Mã chi nhánh gồm 2–30 ký tự chữ hoa, số, gạch ngang hoặc gạch dưới'),
  name: z.string().trim().min(2, 'Tên chi nhánh phải có tối thiểu 2 ký tự').max(150),
  taxCode: z.string().trim().max(30).optional().nullable(),
  address: z.string().trim().max(255).optional().nullable(),
  phone: z.string().trim().max(30).optional().nullable(),
  isHeadquarters: z.boolean().optional().default(false),
  isActive: z.boolean().optional().default(true),
});

export const updateBranchSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(BRANCH_CODE_REGEX, 'Mã chi nhánh gồm 2–30 ký tự chữ hoa, số, gạch ngang hoặc gạch dưới')
    .optional(),
  name: z.string().trim().min(2, 'Tên chi nhánh phải có tối thiểu 2 ký tự').max(150).optional(),
  taxCode: z.string().trim().max(30).optional().nullable(),
  address: z.string().trim().max(255).optional().nullable(),
  phone: z.string().trim().max(30).optional().nullable(),
  isHeadquarters: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export type CreateBranchInput = z.infer<typeof createBranchSchema>;
export type UpdateBranchInput = z.infer<typeof updateBranchSchema>;
