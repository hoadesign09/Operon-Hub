import { z } from 'zod';
import {
  PROPOSAL_COMMENT_TYPES,
  PROPOSAL_PRIORITIES,
} from '@/modules/proposals/proposals.constants';

const CODE_REGEX = /^[A-Z0-9_]{2,40}$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const COLOR_HEX_REGEX = /^#[0-9A-Fa-f]{6}$/;

const optionalDateSchema = z
  .string()
  .trim()
  .regex(DATE_REGEX, 'Ngày phải có định dạng YYYY-MM-DD')
  .nullable()
  .optional()
  .or(z.literal('').transform(() => null));

export const proposalItemInputSchema = z.object({
  itemName: z.string().trim().min(1, 'Tên hạng mục không được để trống').max(255),
  specification: z.string().trim().max(500).nullable().optional(),
  unit: z.string().trim().min(1, 'Đơn vị tính không được để trống').max(40).default('Cái'),
  quantity: z.coerce.number().positive('Số lượng phải lớn hơn 0').max(1_000_000),
  unitPrice: z.coerce.number().min(0, 'Đơn giá không được âm').max(1_000_000_000_000),
  vendorNote: z.string().trim().max(255).nullable().optional(),
});

export const createProposalSchema = z.object({
  categoryId: z.coerce.number().int().positive('Vui lòng chọn danh mục đề xuất'),
  branchId: z.coerce.number().int().positive().nullable().optional(),
  departmentId: z.coerce.number().int().positive().nullable().optional(),
  title: z.string().trim().min(5, 'Tiêu đề đề xuất tối thiểu 5 ký tự').max(255),
  summary: z.string().trim().max(500).nullable().optional(),
  content: z.string().trim().min(10, 'Nội dung chi tiết tối thiểu 10 ký tự').max(20000),
  expectedOutcome: z.string().trim().max(5000).nullable().optional(),
  priority: z.enum(PROPOSAL_PRIORITIES).default('MEDIUM'),
  estimatedBudget: z.coerce.number().min(0, 'Ngân sách dự kiến không được âm').max(1_000_000_000_000).optional(),
  neededByDate: optionalDateSchema,
  effectiveFrom: optionalDateSchema,
  effectiveTo: optionalDateSchema,
  vendorName: z.string().trim().max(200).nullable().optional(),
  items: z.array(proposalItemInputSchema).max(100).optional().default([]),
  submitImmediately: z.boolean().optional().default(false),
});

export const updateProposalSchema = z.object({
  categoryId: z.coerce.number().int().positive().optional(),
  branchId: z.coerce.number().int().positive().optional(),
  departmentId: z.coerce.number().int().positive().nullable().optional(),
  title: z.string().trim().min(5, 'Tiêu đề đề xuất tối thiểu 5 ký tự').max(255).optional(),
  summary: z.string().trim().max(500).nullable().optional(),
  content: z.string().trim().min(10, 'Nội dung chi tiết tối thiểu 10 ký tự').max(20000).optional(),
  expectedOutcome: z.string().trim().max(5000).nullable().optional(),
  priority: z.enum(PROPOSAL_PRIORITIES).optional(),
  estimatedBudget: z.coerce.number().min(0).max(1_000_000_000_000).optional(),
  neededByDate: optionalDateSchema,
  effectiveFrom: optionalDateSchema,
  effectiveTo: optionalDateSchema,
  vendorName: z.string().trim().max(200).nullable().optional(),
  items: z.array(proposalItemInputSchema).max(100).optional(),
});

export const proposalStatusActionSchema = z
  .object({
    action: z.enum(['REQUEST_REVISION', 'CANCEL', 'START_EXECUTION', 'COMPLETE']),
    comment: z.string().trim().max(1000).nullable().optional(),
    approvedBudget: z.coerce.number().min(0).max(1_000_000_000_000).nullable().optional(),
    executionNotes: z.string().trim().max(5000).nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.action === 'REQUEST_REVISION' && (!data.comment || data.comment.trim().length < 3)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['comment'],
        message: 'Vui lòng nhập nội dung yêu cầu chỉnh sửa (tối thiểu 3 ký tự).',
      });
    }
  });

export const createProposalCommentSchema = z.object({
  content: z.string().trim().min(1, 'Nội dung bình luận không được để trống').max(3000),
  commentType: z.enum(PROPOSAL_COMMENT_TYPES).optional().default('GENERAL'),
});

export const createProposalCategorySchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(CODE_REGEX, 'Mã danh mục gồm 2–40 ký tự chữ hoa, số hoặc gạch dưới'),
  name: z.string().trim().min(2, 'Tên danh mục tối thiểu 2 ký tự').max(150),
  nameEn: z.string().trim().max(200).nullable().optional(),
  description: z.string().trim().max(500).nullable().optional(),
  defaultRequestType: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9_]{2,60}$/, 'Mã loại duyệt không hợp lệ')
    .optional()
    .default('PROPOSAL_STANDARD'),
  requiresBudget: z.boolean().optional().default(false),
  budgetThresholdHigh: z.coerce.number().min(0).max(1_000_000_000_000).optional().default(20_000_000),
  iconName: z.string().trim().max(50).nullable().optional(),
  colorHex: z
    .string()
    .trim()
    .regex(COLOR_HEX_REGEX, 'Mã màu phải đúng định dạng HEX (#RRGGBB)')
    .optional()
    .default('#2563EB'),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional().default(0),
  isActive: z.boolean().optional().default(true),
});

export const updateProposalCategorySchema = createProposalCategorySchema.partial();

export type ProposalItemInput = z.infer<typeof proposalItemInputSchema>;
export type CreateProposalInput = z.infer<typeof createProposalSchema>;
export type UpdateProposalInput = z.infer<typeof updateProposalSchema>;
export type ProposalStatusActionInput = z.infer<typeof proposalStatusActionSchema>;
export type CreateProposalCommentInput = z.infer<typeof createProposalCommentSchema>;
export type CreateProposalCategoryInput = z.infer<typeof createProposalCategorySchema>;
export type UpdateProposalCategoryInput = z.infer<typeof updateProposalCategorySchema>;
