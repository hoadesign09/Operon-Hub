import { z } from 'zod';

const isoDateOptionalSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày phải đúng định dạng YYYY-MM-DD')
  .nullable()
  .optional();

export const ASSET_CATEGORIES = [
  'LAPTOP',
  'MONITOR',
  'PHONE',
  'FURNITURE',
  'OTHER',
] as const;

export const ASSET_STATUSES = [
  'AVAILABLE',
  'ASSIGNED',
  'MAINTENANCE',
  'RETIRED',
] as const;

export const createAssetSchema = z.object({
  branchId: z.coerce.number().int().positive('Vui lòng chọn chi nhánh quản lý'),
  assetCode: z
    .string()
    .trim()
    .min(2, 'Mã tài sản tối thiểu 2 ký tự')
    .max(50, 'Mã tài sản tối đa 50 ký tự')
    .regex(/^[A-Za-z0-9_-]+$/, 'Mã tài sản chỉ gồm chữ cái, số, gạch ngang và gạch dưới'),
  name: z
    .string()
    .trim()
    .min(2, 'Tên tài sản tối thiểu 2 ký tự')
    .max(200, 'Tên tài sản tối đa 200 ký tự'),
  category: z.enum(ASSET_CATEGORIES).default('OTHER'),
  brand: z.string().trim().max(100).nullable().optional(),
  model: z.string().trim().max(100).nullable().optional(),
  serialNumber: z.string().trim().max(100).nullable().optional(),
  purchaseDate: isoDateOptionalSchema,
  warrantyExpiryDate: isoDateOptionalSchema,
  purchaseValue: z.coerce
    .number()
    .min(0, 'Nguyên giá không được âm')
    .max(100_000_000_000, 'Nguyên giá vượt giới hạn cho phép')
    .default(0),
  status: z.enum(['AVAILABLE', 'MAINTENANCE', 'RETIRED']).default('AVAILABLE'),
  note: z.string().trim().max(2000).nullable().optional(),
});

export const updateAssetSchema = z.object({
  branchId: z.coerce.number().int().positive().optional(),
  assetCode: z
    .string()
    .trim()
    .min(2)
    .max(50)
    .regex(/^[A-Za-z0-9_-]+$/)
    .optional(),
  name: z.string().trim().min(2).max(200).optional(),
  category: z.enum(ASSET_CATEGORIES).optional(),
  brand: z.string().trim().max(100).nullable().optional(),
  model: z.string().trim().max(100).nullable().optional(),
  serialNumber: z.string().trim().max(100).nullable().optional(),
  purchaseDate: isoDateOptionalSchema,
  warrantyExpiryDate: isoDateOptionalSchema,
  purchaseValue: z.coerce.number().min(0).max(100_000_000_000).optional(),
  status: z.enum(ASSET_STATUSES).optional(),
  note: z.string().trim().max(2000).nullable().optional(),
});

export const assignAssetSchema = z.object({
  employeeId: z.coerce.number().int().positive('Vui lòng chọn nhân viên tiếp nhận'),
  assignedAt: isoDateOptionalSchema,
  expectedReturnAt: isoDateOptionalSchema,
  conditionOnAssign: z
    .string()
    .trim()
    .min(3, 'Vui lòng mô tả tình trạng thiết bị khi bàn giao (tối thiểu 3 ký tự)')
    .max(300, 'Mô tả tình trạng tối đa 300 ký tự'),
  note: z.string().trim().max(2000).nullable().optional(),
});

export const returnAssetSchema = z.object({
  returnedAt: isoDateOptionalSchema,
  conditionOnReturn: z
    .string()
    .trim()
    .min(3, 'Vui lòng mô tả tình trạng thiết bị khi thu hồi (tối thiểu 3 ký tự)')
    .max(300, 'Mô tả tình trạng tối đa 300 ký tự'),
  nextStatus: z.enum(['AVAILABLE', 'MAINTENANCE', 'RETIRED']).default('AVAILABLE'),
  note: z.string().trim().max(2000).nullable().optional(),
});

export type CreateAssetInput = z.infer<typeof createAssetSchema>;
export type UpdateAssetInput = z.infer<typeof updateAssetSchema>;
export type AssignAssetInput = z.infer<typeof assignAssetSchema>;
export type ReturnAssetInput = z.infer<typeof returnAssetSchema>;
