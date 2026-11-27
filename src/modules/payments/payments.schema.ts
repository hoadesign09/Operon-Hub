import { z } from 'zod';
import {
  PAYMENT_ATTACHMENT_KINDS,
  PAYMENT_BENEFICIARY_TYPES,
  PAYMENT_COMMENT_TYPES,
  PAYMENT_DISBURSEMENT_DIRECTIONS,
  PAYMENT_METHODS,
  PAYMENT_PRIORITIES,
  PAYMENT_TYPES,
} from '@/modules/payments/payments.constants';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const CODE_REGEX = /^[A-Z0-9_]{2,50}$/;
const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;

const optionalDateField = z
  .string()
  .trim()
  .regex(DATE_REGEX, 'Ngày phải theo định dạng YYYY-MM-DD')
  .nullable()
  .optional()
  .or(z.literal('').transform(() => null));

export const paymentLineItemSchema = z.object({
  description: z.string().trim().min(2, 'Mô tả hạng mục tối thiểu 2 ký tự').max(300),
  invoiceNo: z.string().trim().max(80).nullable().optional(),
  invoiceDate: optionalDateField,
  quantity: z.coerce.number().positive('Số lượng phải lớn hơn 0').max(1_000_000),
  unitPrice: z.coerce.number().nonnegative('Đơn giá không được âm').max(1_000_000_000_000),
  taxRate: z.coerce.number().min(0, 'Thuế suất từ 0% đến 100%').max(100).default(0),
  note: z.string().trim().max(300).nullable().optional(),
});

const basePaymentSchema = z.object({
  paymentType: z.enum(PAYMENT_TYPES),
  categoryId: z.coerce.number().int().positive('Vui lòng chọn danh mục khoản chi'),
  title: z.string().trim().min(4, 'Tiêu đề phiếu tối thiểu 4 ký tự').max(250),
  description: z.string().trim().min(5, 'Diễn giải chi tiết tối thiểu 5 ký tự').max(4000),
  priority: z.enum(PAYMENT_PRIORITIES).optional().default('MEDIUM'),
  branchId: z.coerce.number().int().positive().nullable().optional(),
  departmentId: z.coerce.number().int().positive().nullable().optional(),
  budgetId: z.coerce.number().int().positive().nullable().optional(),
  proposalId: z.coerce.number().int().positive().nullable().optional(),
  projectId: z.coerce.number().int().positive().nullable().optional(),
  linkedAdvanceId: z.coerce.number().int().positive().nullable().optional(),
  paymentMethod: z.enum(PAYMENT_METHODS).default('BANK_TRANSFER'),
  beneficiaryType: z.enum(PAYMENT_BENEFICIARY_TYPES).default('EMPLOYEE'),
  beneficiaryName: z.string().trim().min(2, 'Vui lòng nhập tên người/đơn vị thụ hưởng').max(200),
  beneficiaryTaxCode: z.string().trim().max(40).nullable().optional(),
  bankName: z.string().trim().max(150).nullable().optional(),
  bankAccountNo: z.string().trim().max(80).nullable().optional(),
  bankBranch: z.string().trim().max(150).nullable().optional(),
  dueDate: optionalDateField,
  advanceDueDate: optionalDateField,
  items: z
    .array(paymentLineItemSchema)
    .min(1, 'Phiếu thanh toán phải có ít nhất 1 hạng mục chi tiết')
    .max(50, 'Tối đa 50 hạng mục trên một phiếu thanh toán'),
  submitImmediately: z.boolean().optional().default(false),
});

export const createPaymentSchema = basePaymentSchema.superRefine((data, ctx) => {
  if (data.paymentType === 'ADVANCE_SETTLEMENT' && !data.linkedAdvanceId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['linkedAdvanceId'],
      message: 'Phiếu Quyết toán Tạm ứng bắt buộc chọn phiếu Tạm ứng gốc cần quyết toán.',
    });
  }
  if (data.paymentType === 'VENDOR_PAYMENT' && data.beneficiaryType !== 'VENDOR') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['beneficiaryType'],
      message: 'Thanh toán Nhà cung cấp phải chọn đối tượng thụ hưởng là Nhà cung cấp.',
    });
  }
});

export const updatePaymentSchema = basePaymentSchema
  .omit({ submitImmediately: true })
  .partial()
  .superRefine((data, ctx) => {
    if (data.paymentType === 'ADVANCE_SETTLEMENT' && data.linkedAdvanceId === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['linkedAdvanceId'],
        message: 'Phiếu Quyết toán Tạm ứng bắt buộc liên kết với 1 phiếu Tạm ứng gốc.',
      });
    }
  });

export const paymentStatusActionSchema = z
  .object({
    action: z.enum(['REQUEST_REVISION', 'CANCEL']),
    note: z.string().trim().max(500).nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.action === 'REQUEST_REVISION' && (!data.note || data.note.trim().length < 3)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['note'],
        message: 'Vui lòng nhập rõ lý do / chứng từ cần bổ sung (tối thiểu 3 ký tự).',
      });
    }
  });

export const createPaymentDisbursementSchema = z
  .object({
    direction: z.enum(PAYMENT_DISBURSEMENT_DIRECTIONS).optional().default('OUTGOING'),
    disbursementDate: z
      .string()
      .trim()
      .regex(DATE_REGEX, 'Ngày giải ngân phải theo định dạng YYYY-MM-DD'),
    amount: z.coerce.number().positive('Số tiền giải ngân phải lớn hơn 0').max(1_000_000_000_000),
    paymentMethod: z.enum(PAYMENT_METHODS).default('BANK_TRANSFER'),
    bankTransactionRef: z.string().trim().max(120).nullable().optional(),
    sourceAccount: z.string().trim().max(150).nullable().optional(),
    note: z.string().trim().max(500).nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (
      data.paymentMethod === 'BANK_TRANSFER' &&
      (!data.bankTransactionRef || data.bankTransactionRef.trim().length < 2)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['bankTransactionRef'],
        message: 'Giải ngân chuyển khoản bắt buộc nhập Mã giao dịch / Số bút toán ngân hàng.',
      });
    }
  });

export const createPaymentCommentSchema = z.object({
  commentType: z.enum(PAYMENT_COMMENT_TYPES).optional().default('GENERAL'),
  content: z.string().trim().min(1, 'Nội dung bình luận không được trống').max(2000),
});

export const paymentAttachmentKindSchema = z.enum(PAYMENT_ATTACHMENT_KINDS).default('RECEIPT');

export const createPaymentCategorySchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(CODE_REGEX, 'Mã danh mục gồm 2–50 ký tự chữ hoa, số hoặc gạch dưới'),
  name: z.string().trim().min(2, 'Tên danh mục tối thiểu 2 ký tự').max(150),
  nameEn: z.string().trim().max(180).nullable().optional(),
  description: z.string().trim().max(500).nullable().optional(),
  defaultPaymentType: z.enum(PAYMENT_TYPES).default('REIMBURSEMENT'),
  requiresReceipt: z.boolean().default(true),
  color: z.string().trim().regex(HEX_COLOR_REGEX, 'Mã màu dạng #RRGGBB').default('#D97706'),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
  isActive: z.boolean().default(true),
});

export const updatePaymentCategorySchema = createPaymentCategorySchema.partial();

export type PaymentLineItemSchemaInput = z.infer<typeof paymentLineItemSchema>;
export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
export type UpdatePaymentInput = z.infer<typeof updatePaymentSchema>;
export type PaymentStatusActionInput = z.infer<typeof paymentStatusActionSchema>;
export type CreatePaymentDisbursementInput = z.infer<typeof createPaymentDisbursementSchema>;
export type CreatePaymentCommentInput = z.infer<typeof createPaymentCommentSchema>;
export type CreatePaymentCategoryInput = z.infer<typeof createPaymentCategorySchema>;
export type UpdatePaymentCategoryInput = z.infer<typeof updatePaymentCategorySchema>;
