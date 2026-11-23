import { SignJWT, jwtVerify } from 'jose';
import type { NextResponse } from 'next/server';
import { getServerEnv } from '@/config/env';

export const ACCESS_TOKEN_COOKIE = 'operon_access_token';
export const REFRESH_TOKEN_COOKIE = 'operon_refresh_token';

const ACCESS_COOKIE_MAX_AGE_SECONDS = 15 * 60;
const SECONDS_PER_DAY = 24 * 60 * 60;

export interface AccessTokenPayload {
  userId: number;
  email: string;
}

function getSecretBytes(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export async function signAccessToken(
  payload: AccessTokenPayload,
  secretOverride?: string,
  expiresInOverride?: string,
): Promise<string> {
  const secret = secretOverride ?? getServerEnv().JWT_ACCESS_SECRET;
  const expiresIn = expiresInOverride ?? getServerEnv().JWT_ACCESS_EXPIRES_IN;

  return new SignJWT({ email: payload.email })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(payload.userId))
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(getSecretBytes(secret));
}

export async function verifyAccessToken(
  token: string,
  secretOverride?: string,
): Promise<AccessTokenPayload | null> {
  if (!token || token.trim().length === 0) {
    return null;
  }

  try {
    const secret = secretOverride ?? getServerEnv().JWT_ACCESS_SECRET;
    const { payload } = await jwtVerify(token, getSecretBytes(secret), {
      algorithms: ['HS256'],
    });

    const userId = Number(payload.sub);
    const email = typeof payload.email === 'string' ? payload.email : '';
    if (!Number.isInteger(userId) || userId <= 0 || email.length === 0) {
      return null;
    }

    return { userId, email };
  } catch {
    return null;
  }
}

export function setAuthCookies(
  response: NextResponse,
  accessToken: string,
  refreshToken: string,
  refreshExpiresDays: number,
): void {
  const isProd = process.env.NODE_ENV === 'production';

  response.cookies.set(ACCESS_TOKEN_COOKIE, accessToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    path: '/',
    maxAge: ACCESS_COOKIE_MAX_AGE_SECONDS,
  });

  response.cookies.set(REFRESH_TOKEN_COOKIE, refreshToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    path: '/',
    maxAge: refreshExpiresDays * SECONDS_PER_DAY,
  });
}

export function clearAuthCookies(response: NextResponse): void {
  const isProd = process.env.NODE_ENV === 'production';
  const expiredOpts = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: isProd,
    path: '/',
    maxAge: 0,
  };

  response.cookies.set(ACCESS_TOKEN_COOKIE, '', expiredOpts);
  response.cookies.set(REFRESH_TOKEN_COOKIE, '', expiredOpts);
}
