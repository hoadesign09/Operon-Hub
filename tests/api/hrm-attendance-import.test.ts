import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { parseExcelBuffer } from '@/lib/portable/excel-importer';
import {
  buildAttendanceImportTemplateExcel,
  validateImportExcelFile,
} from '@/modules/hrm/attendance/attendance-import.service';

const verifyAccessTokenMock = vi.fn();
const loadAuthContextMock = vi.fn();
const importAttendanceExcelMock = vi.fn();

vi.mock('@/modules/auth/jwt', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/modules/auth/jwt')>();
  return {
    ...actual,
    verifyAccessToken: (...args: unknown[]) => verifyAccessTokenMock(...args),
  };
});

vi.mock('@/modules/auth/auth.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/modules/auth/auth.service')>();
  return {
    ...actual,
    loadAuthContext: (...args: unknown[]) => loadAuthContextMock(...args),
  };
});

vi.mock('@/modules/hrm/attendance/attendance-import.service', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('@/modules/hrm/attendance/attendance-import.service')
  >();
  return {
    ...actual,
    importAttendanceExcel: (...args: unknown[]) => importAttendanceExcelMock(...args),
  };
});

import { GET as templateGET } from '@/app/api/v1/hrm/attendance/import/template/route';
import { POST as importPOST } from '@/app/api/v1/hrm/attendance/import/route';

describe('API /api/v1/hrm/attendance/import/*', () => {
  beforeEach(() => {
    verifyAccessTokenMock.mockReset();
    loadAuthContextMock.mockReset();
    importAttendanceExcelMock.mockReset();

    verifyAccessTokenMock.mockResolvedValue({ userId: 1, email: 'admin@operonhub.local' });
    loadAuthContextMock.mockResolvedValue({
      userId: 1,
      email: 'admin@operonhub.local',
      fullName: 'Admin',
      avatarUrl: null,
      status: 'ACTIVE',
      roles: [{ id: 1, code: 'SUPER_ADMIN', name: 'Admin', dataScope: 'ALL', branchId: null }],
      permissions: ['hrm.attendance.import'],
      dataScope: 'ALL',
      isSuperAdmin: true,
      hasAllBranches: true,
      branchIds: [1],
      branches: [],
    });
  });

  it('validateImportExcelFile chặn file sai định dạng, rỗng hoặc vượt 5MB', () => {
    expect(() =>
      validateImportExcelFile({ name: 'chamcong.csv', type: 'text/csv', size: 1024 }),
    ).toThrow('.xlsx');
    expect(() =>
      validateImportExcelFile({
        name: 'chamcong.xlsx',
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        size: 0,
      }),
    ).toThrow('không có dữ liệu');
    expect(() =>
      validateImportExcelFile({
        name: 'chamcong.xlsx',
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        size: 6 * 1024 * 1024,
      }),
    ).toThrow('5MB');
  });

  it('sinh file mẫu Import .xlsx chuẩn và đọc ngược lại thành công qua parseExcelBuffer', async () => {
    const { buffer, fileName } = await buildAttendanceImportTemplateExcel();
    expect(fileName).toBe('mau-import-cham-cong.xlsx');

    const parsed = await parseExcelBuffer(buffer, {
      expectedHeaders: ['Mã NV', 'Ngày công'],
    });
    expect(parsed.headers).toContain('Mã NV');
    expect(parsed.headers).toContain('Ngày công');
    expect(parsed.rows.length).toBeGreaterThanOrEqual(2);

    const resTpl = await templateGET(
      new NextRequest('http://localhost:3000/api/v1/hrm/attendance/import/template', {
        headers: { Authorization: 'Bearer token' },
      }),
      { params: Promise.resolve({}) },
    );
    expect(resTpl.status).toBe(200);
    expect(resTpl.headers.get('content-type')).toContain('spreadsheetml.sheet');
  });

  it('POST /import chặn request thiếu file (400) và trả kết quả tổng hợp khi upload hợp lệ (200)', async () => {
    const emptyForm = new FormData();
    const resMissing = await importPOST(
      new NextRequest('http://localhost:3000/api/v1/hrm/attendance/import', {
        method: 'POST',
        headers: { Authorization: 'Bearer token' },
        body: emptyForm,
      }),
      { params: Promise.resolve({}) },
    );
    expect(resMissing.status).toBe(400);

    importAttendanceExcelMock.mockResolvedValueOnce({
      totalRows: 3,
      createdCount: 2,
      updatedCount: 0,
      errorCount: 1,
      errors: [{ rowNumber: 5, employeeCode: 'NV9999', workDate: '2026-11-23', message: 'Không tìm thấy NV' }],
    });

    const form = new FormData();
    const file = new File([new Uint8Array([80, 75, 3, 4])], 'chamcong.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    form.append('file', file);

    const resOk = await importPOST(
      new NextRequest('http://localhost:3000/api/v1/hrm/attendance/import', {
        method: 'POST',
        headers: { Authorization: 'Bearer token' },
        body: form,
      }),
      { params: Promise.resolve({}) },
    );
    expect(resOk.status).toBe(200);
    const body = (await resOk.json()) as { success: boolean; data: { createdCount: number; errorCount: number } };
    expect(body.success).toBe(true);
    expect(body.data.createdCount).toBe(2);
    expect(body.data.errorCount).toBe(1);
  });
});
