import { z } from 'zod';

const REQUEST_TYPE_REGEX = /^[A-Z0-9_]{2,60}$/;

const workflowStepSchema = z
  .object({
    stepOrder: z.coerce.number().int().min(1).max(5).optional(),
    approverType: z.enum(['DIRECT_MANAGER', 'ROLE', 'SPECIFIC_USER']),
    approverRoleId: z.coerce.number().int().positive().nullable().optional(),
    approverUserId: z.coerce.number().int().positive().nullable().optional(),
  })
  .superRefine((step, ctx) => {
    if (step.approverType === 'ROLE' && !step.approverRoleId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['approverRoleId'],
        message: 'Bước duyệt theo Vai trò bắt buộc chọn Vai trò (approverRoleId).',
      });
    }
    if (step.approverType === 'SPECIFIC_USER' && !step.approverUserId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['approverUserId'],
        message: 'Bước duyệt theo Người dùng cụ thể bắt buộc chọn Người dùng (approverUserId).',
      });
    }
  });

const workflowConditionsSchema = z
  .object({
    minDays: z.coerce.number().min(0).nullable().optional(),
    maxDays: z.coerce.number().min(0).nullable().optional(),
    minAmount: z.coerce.number().min(0).nullable().optional(),
    maxAmount: z.coerce.number().min(0).nullable().optional(),
  })
  .nullable()
  .optional();

export const createWorkflowSchema = z.object({
  moduleCode: z.enum(['core', 'hrm', 'crm']),
  requestType: z
    .string()
    .trim()
    .toUpperCase()
    .regex(REQUEST_TYPE_REGEX, 'Loại yêu cầu gồm 2–60 ký tự chữ hoa, số hoặc gạch dưới'),
  branchId: z.coerce.number().int().positive().nullable().optional(),
  name: z.string().trim().min(3, 'Tên quy trình tối thiểu 3 ký tự').max(150),
  description: z.string().trim().max(255).nullable().optional(),
  conditions: workflowConditionsSchema,
  isActive: z.boolean().optional().default(true),
  steps: z
    .array(workflowStepSchema)
    .min(1, 'Quy trình phải có ít nhất 1 bước duyệt')
    .max(5, 'Quy trình tối đa 5 bước duyệt'),
});

export const updateWorkflowSchema = z.object({
  moduleCode: z.enum(['core', 'hrm', 'crm']).optional(),
  requestType: z
    .string()
    .trim()
    .toUpperCase()
    .regex(REQUEST_TYPE_REGEX, 'Loại yêu cầu gồm 2–60 ký tự chữ hoa, số hoặc gạch dưới')
    .optional(),
  branchId: z.coerce.number().int().positive().nullable().optional(),
  name: z.string().trim().min(3, 'Tên quy trình tối thiểu 3 ký tự').max(150).optional(),
  description: z.string().trim().max(255).nullable().optional(),
  conditions: workflowConditionsSchema,
  isActive: z.boolean().optional(),
  steps: z.array(workflowStepSchema).min(1).max(5).optional(),
});

export const approvalActionSchema = z
  .object({
    action: z.enum(['APPROVE', 'REJECT', 'CANCEL']),
    comment: z.string().trim().max(500).optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.action === 'REJECT' && (!data.comment || data.comment.trim().length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['comment'],
        message: 'Vui lòng nhập lý do từ chối.',
      });
    }
  });

export type CreateWorkflowInput = z.infer<typeof createWorkflowSchema>;
export type UpdateWorkflowInput = z.infer<typeof updateWorkflowSchema>;
export type ApprovalActionInput = z.infer<typeof approvalActionSchema>;
