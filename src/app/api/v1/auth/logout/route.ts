import type { NextRequest } from 'next/server';
import { logoutSession } from '@/modules/auth/auth.service';
import { clearAuthCookies, REFRESH_TOKEN_COOKIE } from '@/modules/auth/jwt';
import { ok, withErrorHandler } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

export const POST = withErrorHandler(async (request: NextRequest) => {
  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;
  await logoutSession(refreshToken);

  const response = ok({ loggedOut: true });
  clearAuthCookies(response);
  return response;
});
