import type { NextRequest } from 'next/server';
import { getRequestIp } from '@/middlewares/auth';
import { rotateRefreshToken } from '@/modules/auth/auth.service';
import { REFRESH_TOKEN_COOKIE, setAuthCookies } from '@/modules/auth/jwt';
import { AppError, ok, withErrorHandler } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

export const POST = withErrorHandler(async (request: NextRequest) => {
  const cookieToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;
  if (!cookieToken) {
    throw new AppError('INVALID_REFRESH_TOKEN', 'Không tìm thấy phiên làm mới đăng nhập.', 401);
  }

  const rotated = await rotateRefreshToken(cookieToken, {
    userAgent: request.headers.get('user-agent'),
    ipAddress: getRequestIp(request),
  });

  const response = ok({ refreshed: true });
  setAuthCookies(response, rotated.accessToken, rotated.refreshToken, rotated.refreshExpiresDays);
  return response;
});
