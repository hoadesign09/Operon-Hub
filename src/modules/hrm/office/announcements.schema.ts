import { z } from 'zod';

export const ANNOUNCEMENT_CATEGORIES = ['GENERAL', 'HR_POLICY', 'EVENT', 'URGENT'] as const;
export const ANNOUNCEMENT_STATUSES = ['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const;

export const createAnnouncementSchema = z.object({
  branchId: z.coerce.number().int().positive().nullable().optional(),
  title: z
    .string()
    .trim()
    .min(4, 'Tiêu đề thông báo tối thiểu 4 ký tự')
    .max(255, 'Tiêu đề thông báo tối đa 255 ký tự'),
  content: z
    .string()
    .trim()
    .min(10, 'Nội dung thông báo tối thiểu 10 ký tự')
    .max(15000, 'Nội dung thông báo tối đa 15.000 ký tự'),
  category: z.enum(ANNOUNCEMENT_CATEGORIES).default('GENERAL'),
  isPinned: z.boolean().optional().default(false),
  publishNow: z.boolean().optional().default(false),
});

export const updateAnnouncementSchema = z.object({
  branchId: z.coerce.number().int().positive().nullable().optional(),
  title: z.string().trim().min(4).max(255).optional(),
  content: z.string().trim().min(10).max(15000).optional(),
  category: z.enum(ANNOUNCEMENT_CATEGORIES).optional(),
  isPinned: z.boolean().optional(),
  status: z.enum(ANNOUNCEMENT_STATUSES).optional(),
});

export type CreateAnnouncementInput = z.infer<typeof createAnnouncementSchema>;
export type UpdateAnnouncementInput = z.infer<typeof updateAnnouncementSchema>;
