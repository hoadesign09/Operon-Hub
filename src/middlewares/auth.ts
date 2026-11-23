import type { NextRequest, NextResponse } from 'next/server';
import {
  hasRequiredPermission,
  loadAuthContext,
  type AuthContext,
} from '@/modules/auth/auth.service';
import { ACCESS_TOKEN_COOKIE, verifyAccessToken } from '@/modules/auth/jwt';
import { AppError, withErrorHandler } from '@/shared/api-response';

export interface WithAuthOptions {
  permission?: string;
}

export interface RouteHandlerContext<TParams = Record<string, string>> {
  params: Promise<TParams>;
}

export function getRequestIp(request: NextRequest): string | null {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0]?.trim() || null;
  }
  return request.headers.get('x-real-ip')?.trim() || null;
}

function extractAccessToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    const bearer = authHeader.slice(7).trim();
    if (bearer.length > 0) {
      return bearer;
    }
  }
  return request.cookies.get(ACCESS_TOKEN_COOKIE)?.value ?? null;
}

export function withAuth<TParams = Record<string, string>>(
  handler: (
    request: NextRequest,
    context: RouteHandlerContext<TParams>,
    auth: AuthContext,
  ) => Promise<NextResponse>,
  options: WithAuthOptions = {},
): (request: NextRequest, context: RouteHandlerContext<TParams>) => Promise<NextResponse> {
  return withErrorHandler(async (request: NextRequest, context: RouteHandlerContext<TParams>) => {
    const token = extractAccessToken(request);
    if (!token) {
      throw new AppError('UNAUTHORIZED', 'Vui lòng đăng nhập để tiếp tục.', 401);
    }

    const tokenPayload = await verifyAccessToken(token);
    if (!tokenPayload) {
      throw new AppError('UNAUTHORIZED', 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.', 401);
    }

    const auth = await loadAuthContext(tokenPayload.userId);
    if (!auth) {
      throw new AppError('UNAUTHORIZED', 'Tài khoản không tồn tại hoặc đã bị vô hiệu hóa.', 401);
    }

    if (auth.status === 'LOCKED') {
      throw new AppError('ACCOUNT_LOCKED', 'Tài khoản của bạn đang bị khóa.', 403);
    }

    if (!hasRequiredPermission(auth, options.permission)) {
      throw new AppError('FORBIDDEN', 'Bạn không có quyền thực hiện thao tác này.', 403);
    }

    return handler(request, context, auth);
  });
}
