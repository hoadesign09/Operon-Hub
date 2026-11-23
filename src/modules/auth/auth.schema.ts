import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().trim().email('Địa chỉ email không hợp lệ').max(190),
  password: z.string().min(1, 'Vui lòng nhập mật khẩu').max(128),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Vui lòng nhập mật khẩu hiện tại').max(128),
    newPassword: z
      .string()
      .min(8, 'Mật khẩu mới phải có tối thiểu 8 ký tự')
      .max(128, 'Mật khẩu mới tối đa 128 ký tự'),
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    path: ['newPassword'],
    message: 'Mật khẩu mới phải khác mật khẩu hiện tại',
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
