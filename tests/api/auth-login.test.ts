import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '@/shared/api-response';

const loginWithPasswordMock = vi.fn();

vi.mock('@/modules/auth/auth.service', () => ({
  loginWithPassword: (...args: unknown[]) => loginWithPasswordMock(...args),
}));

import { POST } from '@/app/api/v1/auth/login/route';

function makeJsonRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('API POST /api/v1/auth/login', () => {
  beforeEach(() => {
    loginWithPasswordMock.mockReset();
  });

  it('returns 200 and sets HttpOnly auth cookies without exposing password_hash', async () => {
    loginWithPasswordMock.mockResolvedValue({
      accessToken: 'jwt-access-sample',
      refreshToken: 'raw-refresh-sample',
      refreshExpiresDays: 7,
      user: {
        userId: 1,
        email: 'admin@operonhub.local',
        fullName: 'Quản trị Hệ thống',
        status: 'ACTIVE',
        roles: [{ id: 1, code: 'SUPER_ADMIN', name: 'Quản trị Hệ thống', dataScope: 'ALL', branchId: null }],
        permissions: ['core.branches.read'],
        dataScope: 'ALL',
        isSuperAdmin: true,
        hasAllBranches: true,
        branchIds: [1],
        branches: [{ id: 1, code: 'HQ', name: 'Trụ sở chính', isHeadquarters: true }],
      },
    });

    const response = await POST(
      makeJsonRequest({ email: 'admin@operonhub.local', password: 'Admin@123456' }),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.user.email).toBe('admin@operonhub.local');
    expect(JSON.stringify(json)).not.toContain('password_hash');
    expect(response.cookies.get('operon_access_token')?.value).toBe('jwt-access-sample');
    expect(response.cookies.get('operon_refresh_token')?.value).toBe('raw-refresh-sample');
  });

  it('returns 400 for invalid email format', async () => {
    const response = await POST(makeJsonRequest({ email: 'not-an-email', password: '123' }));
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('VALIDATION_ERROR');
  });

  it('propagates 401 for wrong credentials and 403 for locked account', async () => {
    loginWithPasswordMock.mockRejectedValueOnce(
      new AppError('INVALID_CREDENTIALS', 'Email hoặc mật khẩu không chính xác.', 401),
    );
    const res401 = await POST(makeJsonRequest({ email: 'a@b.com', password: 'wrong' }));
    expect(res401.status).toBe(401);

    loginWithPasswordMock.mockRejectedValueOnce(
      new AppError('ACCOUNT_LOCKED', 'Tài khoản bị khóa.', 403),
    );
    const res403 = await POST(makeJsonRequest({ email: 'locked@b.com', password: 'secret' }));
    expect(res403.status).toBe(403);
  });
});
