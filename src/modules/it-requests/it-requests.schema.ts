import { z } from 'zod';
import {
  IT_REQUEST_COMMENT_VISIBILITIES,
  IT_REQUEST_KINDS,
  IT_REQUEST_PRIORITIES,
} from '@/modules/it-requests/it-requests.constants';

const CATEGORY_CODE_REGEX = /^[A-Z0-9_]{2,50}$/;
const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;

export const createItCategorySchema = z
  .object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(CATEGORY_CODE_REGEX, 'Mã danh mục chỉ gồm 2–50 ký tự chữ hoa, số hoặc gạch dưới.'),
    name: z.string().trim().min(2, 'Tên danh mục tối thiểu 2 ký tự.').max(150),
    nameEn: z.string().trim().max(180).nullable().optional(),
    description: z.string().trim().max(500).nullable().optional(),
    requestKind: z.enum(IT_REQUEST_KINDS).default('INCIDENT'),
    requiresApproval: z.boolean().default(false),
    defaultPriority: z.enum(IT_REQUEST_PRIORITIES).default('MEDIUM'),
    slaResponseHours: z.coerce.number().int().min(1, 'SLA phản hồi tối thiểu 1 giờ.').max(720),
    slaResolutionHours: z.coerce.number().int().min(1, 'SLA xử lý tối thiểu 1 giờ.').max(2160),
    color: z.string().trim().regex(HEX_COLOR_REGEX, 'Mã màu không hợp lệ.').default('#2563EB'),
    sortOrder: z.coerce.number().int().min(0).max(999).default(0),
    isActive: z.boolean().default(true),
  })
  .superRefine((data, ctx) => {
    if (data.slaResolutionHours < data.slaResponseHours) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['slaResolutionHours'],
        message: 'Thời gian SLA xử lý phải lớn hơn hoặc bằng SLA phản hồi.',
      });
    }
  });

export const updateItCategorySchema = z
  .object({
    name: z.string().trim().min(2).max(150).optional(),
    nameEn: z.string().trim().max(180).nullable().optional(),
    description: z.string().trim().max(500).nullable().optional(),
    requestKind: z.enum(IT_REQUEST_KINDS).optional(),
    requiresApproval: z.boolean().optional(),
    defaultPriority: z.enum(IT_REQUEST_PRIORITIES).optional(),
    slaResponseHours: z.coerce.number().int().min(1).max(720).optional(),
    slaResolutionHours: z.coerce.number().int().min(1).max(2160).optional(),
    color: z.string().trim().regex(HEX_COLOR_REGEX, 'Mã màu không hợp lệ.').optional(),
    sortOrder: z.coerce.number().int().min(0).max(999).optional(),
    isActive: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (
      data.slaResponseHours !== undefined &&
      data.slaResolutionHours !== undefined &&
      data.slaResolutionHours < data.slaResponseHours
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['slaResolutionHours'],
        message: 'Thời gian SLA xử lý phải lớn hơn hoặc bằng SLA phản hồi.',
      });
    }
  });

export const createItRequestSchema = z.object({
  categoryId: z.coerce.number().int().positive('Vui lòng chọn danh mục hỗ trợ IT.'),
  title: z.string().trim().min(4, 'Tiêu đề tối thiểu 4 ký tự.').max(250),
  description: z.string().trim().min(8, 'Mô tả chi tiết tối thiểu 8 ký tự.').max(5000),
  priority: z.enum(IT_REQUEST_PRIORITIES).optional(),
  branchId: z.coerce.number().int().positive().nullable().optional(),
  departmentId: z.coerce.number().int().positive().nullable().optional(),
  assetId: z.coerce.number().int().positive().nullable().optional(),
  estimatedCost: z.coerce.number().min(0, 'Chi phí dự kiến không âm.').max(999_999_999_999).default(0),
  locationDetail: z.string().trim().max(200).nullable().optional(),
  contactPhone: z.string().trim().max(30).nullable().optional(),
  checklistTitles: z.array(z.string().trim().min(2).max(250)).max(20).optional(),
  submitImmediately: z.boolean().default(true),
});

export const updateItRequestSchema = z.object({
  categoryId: z.coerce.number().int().positive().optional(),
  title: z.string().trim().min(4).max(250).optional(),
  description: z.string().trim().min(8).max(5000).optional(),
  priority: z.enum(IT_REQUEST_PRIORITIES).optional(),
  branchId: z.coerce.number().int().positive().nullable().optional(),
  departmentId: z.coerce.number().int().positive().nullable().optional(),
  assetId: z.coerce.number().int().positive().nullable().optional(),
  estimatedCost: z.coerce.number().min(0).max(999_999_999_999).optional(),
  locationDetail: z.string().trim().max(200).nullable().optional(),
  contactPhone: z.string().trim().max(30).nullable().optional(),
});

export const assignItRequestSchema = z.object({
  assignedToUserId: z.coerce.number().int().positive().nullable(),
  startImmediately: z.boolean().optional().default(false),
  note: z.string().trim().max(500).nullable().optional(),
});

export const transitionItRequestStatusSchema = z
  .object({
    action: z.enum([
      'START_WORK',
      'WAIT_USER',
      'RESUME_WORK',
      'RESOLVE',
      'REOPEN',
      'CLOSE',
      'CANCEL',
    ]),
    note: z.string().trim().max(1000).nullable().optional(),
    resolutionSummary: z.string().trim().max(2000).nullable().optional(),
    satisfactionRating: z.coerce.number().int().min(1).max(5).nullable().optional(),
    satisfactionFeedback: z.string().trim().max(500).nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.action === 'WAIT_USER' && (!data.note || data.note.trim().length < 3)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['note'],
        message: 'Vui lòng nhập nội dung cần người gửi bổ sung thông tin.',
      });
    }
    if (
      data.action === 'RESOLVE' &&
      (!data.resolutionSummary || data.resolutionSummary.trim().length < 5)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['resolutionSummary'],
        message: 'Vui lòng nhập tóm tắt kết quả xử lý (tối thiểu 5 ký tự).',
      });
    }
    if (data.action === 'REOPEN' && (!data.note || data.note.trim().length < 3)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['note'],
        message: 'Vui lòng nhập lý do mở lại yêu cầu.',
      });
    }
  });

export const createItChecklistItemSchema = z.object({
  title: z.string().trim().min(2, 'Nội dung bước xử lý tối thiểu 2 ký tự.').max(250),
  note: z.string().trim().max(500).nullable().optional(),
});

export const updateItChecklistItemSchema = z.object({
  title: z.string().trim().min(2).max(250).optional(),
  note: z.string().trim().max(500).nullable().optional(),
  isDone: z.boolean().optional(),
});

export const createItCommentSchema = z.object({
  content: z.string().trim().min(1, 'Nội dung bình luận không được rỗng.').max(3000),
  visibility: z.enum(IT_REQUEST_COMMENT_VISIBILITIES).default('PUBLIC'),
});

export type CreateItCategoryInput = z.infer<typeof createItCategorySchema>;
export type UpdateItCategoryInput = z.infer<typeof updateItCategorySchema>;
export type CreateItRequestInput = z.infer<typeof createItRequestSchema>;
export type UpdateItRequestInput = z.infer<typeof updateItRequestSchema>;
export type AssignItRequestInput = z.infer<typeof assignItRequestSchema>;
export type TransitionItRequestStatusInput = z.infer<typeof transitionItRequestStatusSchema>;
export type CreateItChecklistItemInput = z.infer<typeof createItChecklistItemSchema>;
export type UpdateItChecklistItemInput = z.infer<typeof updateItChecklistItemSchema>;
export type CreateItCommentInput = z.infer<typeof createItCommentSchema>;
