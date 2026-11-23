import type { NextRequest } from 'next/server';
import { getRequestIp } from '@/middlewares/auth';
import { loginSchema } from '@/modules/auth/auth.schema';
import { loginWithPassword } from '@/modules/auth/auth.service';
import { setAuthCookies } from '@/modules/auth/jwt';
import { AppError, ok, withErrorHandler } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

export const POST = withErrorHandler(async (request: NextRequest) => {
  const rawBody = await request.json().catch(() => null);
  if (!rawBody || typeof rawBody !== 'object') {
    throw new AppError('INVALID_JSON', 'Dữ liệu yêu cầu không đúng định dạng JSON.', 400);
  }

  const input = loginSchema.parse(rawBody);
  const result = await loginWithPassword(input.email, input.password, {
    userAgent: request.headers.get('user-agent'),
    ipAddress: getRequestIp(request),
  });

  const response = ok({ user: result.user });
  setAuthCookies(response, result.accessToken, result.refreshToken, result.refreshExpiresDays);
  return response;
});
