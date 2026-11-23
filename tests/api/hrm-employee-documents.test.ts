import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthContext } from '@/modules/auth/auth.service';
import {
  MAX_DOCUMENT_FILE_SIZE_BYTES,
  resolveSafeStoragePath,
  validateDocumentUploadFile,
} from '@/modules/hrm/employees/employee-documents.service';

const {
  mockVerifyAccessToken,
  mockLoadAuthContext,
  mockSoftDeleteDoc,
} = vi.hoisted(() => ({
  mockVerifyAccessToken: vi.fn(),
  mockLoadAuthContext: vi.fn(),
  mockSoftDeleteDoc: vi.fn(),
}));

vi.mock('@/modules/auth/jwt', () => ({
  ACCESS_TOKEN_COOKIE: 'operon_access_token',
  verifyAccessToken: mockVerifyAccessToken,
}));

vi.mock('@/modules/auth/auth.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/modules/auth/auth.service')>();
  return {
    ...actual,
    loadAuthContext: mockLoadAuthContext,
  };
});

vi.mock('@/modules/hrm/employees/employee-documents.service', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/modules/hrm/employees/employee-documents.service')>();
  return {
    ...actual,
    softDeleteEmployeeDocument: mockSoftDeleteDoc,
  };
});

import { DELETE } from '@/app/api/v1/hrm/employees/[id]/documents/[docId]/route';

function makeAuth(permissions: string[]): AuthContext {
  return {
    userId: 10,
    email: 'hr@operonhub.local',
    fullName: 'HR Staff',
    avatarUrl: null,
    status: 'ACTIVE',
    roles: [{ id: 4, code: 'HR_STAFF', name: 'Chuyên viên NS', dataScope: 'BRANCH', branchId: 1 }],
    permissions,
    dataScope: 'BRANCH',
    isSuperAdmin: false,
    hasAllBranches: false,
    branchIds: [1],
    branches: [{ id: 1, code: 'HQ', name: 'Trụ sở chính', isHeadquarters: true }],
  };
}

describe('HRM Employee Documents Security & API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyAccessToken.mockResolvedValue({ userId: 10, email: 'hr@operonhub.local' });
  });

  it('kiểm duyệt chặt định dạng MIME, dung lượng <= 5MB và chống Path Traversal', () => {
    expect(
      validateDocumentUploadFile({
        name: 'CCCD_NguyenVanA.pdf',
        type: 'application/pdf',
        size: 1024 * 200,
      }).safeExt,
    ).toBe('.pdf');

    expect(() =>
      validateDocumentUploadFile({
        name: 'malware.exe',
        type: 'application/x-msdownload',
        size: 1024,
      }),
    ).toThrow('Chỉ chấp nhận');

    expect(() =>
      validateDocumentUploadFile({
        name: 'huge.pdf',
        type: 'application/pdf',
        size: MAX_DOCUMENT_FILE_SIZE_BYTES + 1,
      }),
    ).toThrow('5 MB');

    expect(resolveSafeStoragePath('12/17323456-abc.pdf')).toContain('17323456-abc.pdf');
    expect(() => resolveSafeStoragePath('../../.env')).toThrow('không hợp lệ');
  });

  it('DELETE document chặn 403 thiếu quyền, 400 sai ID và trả 200 khi hợp lệ', async () => {
    mockLoadAuthContext.mockResolvedValueOnce(makeAuth(['hrm.employees.read']));
    const req403 = new NextRequest('http://localhost/api/v1/hrm/employees/1/documents/2', {
      method: 'DELETE',
      headers: { authorization: 'Bearer valid' },
    });
    const res403 = await DELETE(req403, { params: Promise.resolve({ id: '1', docId: '2' }) });
    expect(res403.status).toBe(403);

    mockLoadAuthContext.mockResolvedValueOnce(makeAuth(['hrm.employees.update']));
    const req400 = new NextRequest('http://localhost/api/v1/hrm/employees/abc/documents/2', {
      method: 'DELETE',
      headers: { authorization: 'Bearer valid' },
    });
    const res400 = await DELETE(req400, { params: Promise.resolve({ id: 'abc', docId: '2' }) });
    expect(res400.status).toBe(400);

    mockLoadAuthContext.mockResolvedValueOnce(makeAuth(['hrm.employees.update']));
    mockSoftDeleteDoc.mockResolvedValueOnce(undefined);
    const req200 = new NextRequest('http://localhost/api/v1/hrm/employees/1/documents/2', {
      method: 'DELETE',
      headers: { authorization: 'Bearer valid' },
    });
    const res200 = await DELETE(req200, { params: Promise.resolve({ id: '1', docId: '2' }) });
    expect(res200.status).toBe(200);
  });
});
