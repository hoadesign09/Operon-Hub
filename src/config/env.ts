import { z } from 'zod';

export const LOCAL_DB_HOSTS = ['localhost', '127.0.0.1'] as const;

const DEV_FALLBACK_ACCESS_SECRET = 'dev_only_operon_access_secret_key_change_me_32';
const DEV_FALLBACK_REFRESH_SECRET = 'dev_only_operon_refresh_secret_key_change_me_32';

const serverEnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
    APP_NAME: z.string().trim().min(1).default('Operon Hub'),
    APP_VERSION: z.string().trim().min(1).default('1.0.0'),
    APP_URL: z.string().trim().url().default('http://localhost:3000'),
    APP_TIMEZONE: z.string().trim().min(1).default('Asia/Ho_Chi_Minh'),
    DB_HOST: z.string().trim().min(1, 'Thiếu biến môi trường DB_HOST'),
    DB_PORT: z.coerce.number().int().min(1).max(65535).default(3306),
    DB_USER: z.string().trim().min(1, 'Thiếu biến môi trường DB_USER'),
    DB_PASSWORD: z.string().default(''),
    DB_NAME: z.string().trim().min(1, 'Thiếu biến môi trường DB_NAME'),
    DB_POOL_LIMIT: z.coerce.number().int().min(1).max(100).default(10),
    JWT_ACCESS_SECRET: z
      .string()
      .trim()
      .min(16, 'JWT_ACCESS_SECRET phải có tối thiểu 16 ký tự')
      .default(DEV_FALLBACK_ACCESS_SECRET),
    JWT_REFRESH_SECRET: z
      .string()
      .trim()
      .min(16, 'JWT_REFRESH_SECRET phải có tối thiểu 16 ký tự')
      .default(DEV_FALLBACK_REFRESH_SECRET),
    JWT_ACCESS_EXPIRES_IN: z.string().trim().min(2).default('15m'),
    JWT_REFRESH_EXPIRES_DAYS: z.coerce.number().int().min(1).max(90).default(7),
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV === 'production') {
      if (data.JWT_ACCESS_SECRET === DEV_FALLBACK_ACCESS_SECRET) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['JWT_ACCESS_SECRET'],
          message: 'Bắt buộc cấu hình JWT_ACCESS_SECRET riêng ở môi trường production',
        });
      }
      if (data.JWT_REFRESH_SECRET === DEV_FALLBACK_REFRESH_SECRET) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['JWT_REFRESH_SECRET'],
          message: 'Bắt buộc cấu hình JWT_REFRESH_SECRET riêng ở môi trường production',
        });
      }
    }
  });

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cachedEnv: ServerEnv | null = null;

export function parseServerEnv(rawEnv: Record<string, string | undefined>): ServerEnv {
  const result = serverEnvSchema.safeParse(rawEnv);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join('.') || 'ENV'}: ${issue.message}`)
      .join('; ');
    throw new Error(`Cấu hình biến môi trường không hợp lệ: ${details}`);
  }
  return result.data;
}

export function getServerEnv(): ServerEnv {
  if (!cachedEnv) {
    cachedEnv = parseServerEnv(process.env);
  }
  return cachedEnv;
}

export function resetServerEnvCache(): void {
  cachedEnv = null;
}

export function isLocalDevDatabase(
  host: string | undefined,
  nodeEnv: string | undefined,
): boolean {
  if (nodeEnv !== 'development' || !host) {
    return false;
  }
  const normalizedHost = host.trim().toLowerCase();
  return (LOCAL_DB_HOSTS as readonly string[]).includes(normalizedHost);
}
