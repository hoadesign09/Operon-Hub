import { z } from 'zod';

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIME_HHMM_REGEX = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const END_TIME_HHMM_REGEX = /^(?:(?:[01]\d|2[0-3]):[0-5]\d|24:00)$/;

export const createOvertimeRequestSchema = z.object({
  workDate: z.string().trim().regex(ISO_DATE_REGEX, 'Ngày tăng ca phải đúng định dạng YYYY-MM-DD'),
  startTime: z.string().trim().regex(TIME_HHMM_REGEX, 'Giờ bắt đầu phải đúng định dạng HH:mm'),
  endTime: z
    .string()
    .trim()
    .regex(END_TIME_HHMM_REGEX, 'Giờ kết thúc phải đúng định dạng HH:mm (tối đa 24:00)'),
  isHoliday: z.boolean().default(false),
  reason: z.string().trim().min(3, 'Vui lòng nhập lý do tăng ca tối thiểu 3 ký tự').max(1000),
  submitNow: z.boolean().default(false),
});

export const updateOvertimeRequestSchema = z.object({
  workDate: z
    .string()
    .trim()
    .regex(ISO_DATE_REGEX, 'Ngày tăng ca phải đúng định dạng YYYY-MM-DD')
    .optional(),
  startTime: z
    .string()
    .trim()
    .regex(TIME_HHMM_REGEX, 'Giờ bắt đầu phải đúng định dạng HH:mm')
    .optional(),
  endTime: z
    .string()
    .trim()
    .regex(END_TIME_HHMM_REGEX, 'Giờ kết thúc phải đúng định dạng HH:mm (tối đa 24:00)')
    .optional(),
  isHoliday: z.boolean().optional(),
  reason: z.string().trim().min(3, 'Lý do tối thiểu 3 ký tự').max(1000).optional(),
});

export const createBusinessTripRequestSchema = z.object({
  destination: z.string().trim().min(2, 'Vui lòng nhập địa điểm công tác').max(200),
  startDate: z.string().trim().regex(ISO_DATE_REGEX, 'Ngày bắt đầu phải đúng định dạng YYYY-MM-DD'),
  endDate: z.string().trim().regex(ISO_DATE_REGEX, 'Ngày kết thúc phải đúng định dạng YYYY-MM-DD'),
  estimatedCost: z.coerce
    .number()
    .min(0, 'Chi phí dự kiến không được âm')
    .max(999_999_999_999, 'Chi phí dự kiến vượt giới hạn cho phép')
    .default(0),
  purpose: z.string().trim().min(3, 'Vui lòng nhập mục đích công tác tối thiểu 3 ký tự').max(1000),
  submitNow: z.boolean().default(false),
});

export const updateBusinessTripRequestSchema = z.object({
  destination: z.string().trim().min(2, 'Địa điểm công tác tối thiểu 2 ký tự').max(200).optional(),
  startDate: z
    .string()
    .trim()
    .regex(ISO_DATE_REGEX, 'Ngày bắt đầu phải đúng định dạng YYYY-MM-DD')
    .optional(),
  endDate: z
    .string()
    .trim()
    .regex(ISO_DATE_REGEX, 'Ngày kết thúc phải đúng định dạng YYYY-MM-DD')
    .optional(),
  estimatedCost: z.coerce.number().min(0, 'Chi phí dự kiến không được âm').max(999_999_999_999).optional(),
  purpose: z.string().trim().min(3, 'Mục đích tối thiểu 3 ký tự').max(1000).optional(),
});

export const cancelRequestCommentSchema = z.object({
  comment: z.string().trim().max(500).nullable().optional(),
});

export type CreateOvertimeRequestInput = z.infer<typeof createOvertimeRequestSchema>;
export type UpdateOvertimeRequestInput = z.infer<typeof updateOvertimeRequestSchema>;
export type CreateBusinessTripRequestInput = z.infer<typeof createBusinessTripRequestSchema>;
export type UpdateBusinessTripRequestInput = z.infer<typeof updateBusinessTripRequestSchema>;
