import { z } from 'zod';

const equipmentListSchema = z
  .array(z.string().trim().min(1, 'Tên thiết bị không được trống').max(100, 'Tên thiết bị tối đa 100 ký tự'))
  .max(30, 'Danh sách thiết bị tối đa 30 mục')
  .optional();

export const ROOM_BOOKING_STATUSES = ['CONFIRMED', 'CANCELLED'] as const;

export const createMeetingRoomSchema = z.object({
  branchId: z.coerce.number().int().positive('Vui lòng chọn chi nhánh'),
  code: z
    .string()
    .trim()
    .min(2, 'Mã phòng họp tối thiểu 2 ký tự')
    .max(50, 'Mã phòng họp tối đa 50 ký tự')
    .regex(/^[A-Za-z0-9_-]+$/, 'Mã phòng chỉ gồm chữ cái, số, gạch ngang và gạch dưới'),
  name: z
    .string()
    .trim()
    .min(2, 'Tên phòng họp tối thiểu 2 ký tự')
    .max(150, 'Tên phòng họp tối đa 150 ký tự'),
  floor: z.string().trim().max(50, 'Vị trí tầng tối đa 50 ký tự').nullable().optional(),
  capacity: z.coerce
    .number()
    .int('Sức chứa phải là số nguyên')
    .min(1, 'Sức chứa tối thiểu 1 người')
    .max(500, 'Sức chứa tối đa 500 người'),
  equipment: equipmentListSchema,
  description: z.string().trim().max(2000).nullable().optional(),
  isActive: z.boolean().optional().default(true),
});

export const updateMeetingRoomSchema = z.object({
  branchId: z.coerce.number().int().positive().optional(),
  code: z
    .string()
    .trim()
    .min(2)
    .max(50)
    .regex(/^[A-Za-z0-9_-]+$/)
    .optional(),
  name: z.string().trim().min(2).max(150).optional(),
  floor: z.string().trim().max(50).nullable().optional(),
  capacity: z.coerce.number().int().min(1).max(500).optional(),
  equipment: equipmentListSchema,
  description: z.string().trim().max(2000).nullable().optional(),
  isActive: z.boolean().optional(),
});

export const createRoomBookingSchema = z.object({
  roomId: z.coerce.number().int().positive('Vui lòng chọn phòng họp'),
  title: z
    .string()
    .trim()
    .min(3, 'Tiêu đề cuộc họp tối thiểu 3 ký tự')
    .max(200, 'Tiêu đề cuộc họp tối đa 200 ký tự'),
  startTime: z.string().trim().min(10, 'Vui lòng chọn thời gian bắt đầu'),
  endTime: z.string().trim().min(10, 'Vui lòng chọn thời gian kết thúc'),
  attendeesCount: z.coerce
    .number()
    .int('Số người tham dự phải là số nguyên')
    .min(1, 'Số người tham dự tối thiểu 1 người')
    .max(500, 'Số người tham dự không hợp lệ')
    .default(2),
  note: z.string().trim().max(2000).nullable().optional(),
  bookedByEmployeeId: z.coerce.number().int().positive().optional(),
});

export const updateRoomBookingSchema = z.object({
  roomId: z.coerce.number().int().positive().optional(),
  title: z.string().trim().min(3).max(200).optional(),
  startTime: z.string().trim().min(10).optional(),
  endTime: z.string().trim().min(10).optional(),
  attendeesCount: z.coerce.number().int().min(1).max(500).optional(),
  note: z.string().trim().max(2000).nullable().optional(),
});

export const cancelRoomBookingSchema = z.object({
  cancelReason: z
    .string()
    .trim()
    .min(3, 'Vui lòng nhập lý do hủy lịch tối thiểu 3 ký tự')
    .max(500, 'Lý do hủy lịch tối đa 500 ký tự'),
});

export type CreateMeetingRoomInput = z.infer<typeof createMeetingRoomSchema>;
export type UpdateMeetingRoomInput = z.infer<typeof updateMeetingRoomSchema>;
export type CreateRoomBookingInput = z.infer<typeof createRoomBookingSchema>;
export type UpdateRoomBookingInput = z.infer<typeof updateRoomBookingSchema>;
export type CancelRoomBookingInput = z.infer<typeof cancelRoomBookingSchema>;
