import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '@/shared/api-response';

const verifyAccessTokenMock = vi.fn();
const loadAuthContextMock = vi.fn();

const listAssetsMock = vi.fn();
const createAssetMock = vi.fn();
const getAssetDetailMock = vi.fn();
const updateAssetMock = vi.fn();
const deleteAssetMock = vi.fn();
const assignAssetMock = vi.fn();
const returnAssetMock = vi.fn();
const listOffboardingAlertsMock = vi.fn();
const exportAssetsExcelMock = vi.fn();
const listMyAssetsMock = vi.fn();
const generateAssetHandoverPdfMock = vi.fn();

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

vi.mock('@/modules/hrm/office/assets.service', () => ({
  listAssets: (...args: unknown[]) => listAssetsMock(...args),
  createAsset: (...args: unknown[]) => createAssetMock(...args),
  getAssetDetail: (...args: unknown[]) => getAssetDetailMock(...args),
  updateAsset: (...args: unknown[]) => updateAssetMock(...args),
  deleteAsset: (...args: unknown[]) => deleteAssetMock(...args),
  assignAsset: (...args: unknown[]) => assignAssetMock(...args),
  returnAsset: (...args: unknown[]) => returnAssetMock(...args),
  listOffboardingAssetAlerts: (...args: unknown[]) => listOffboardingAlertsMock(...args),
  exportAssetsExcel: (...args: unknown[]) => exportAssetsExcelMock(...args),
  listMyAssets: (...args: unknown[]) => listMyAssetsMock(...args),
}));

vi.mock('@/modules/hrm/office/asset-handover-pdf.service', () => ({
  generateAssetHandoverPdf: (...args: unknown[]) => generateAssetHandoverPdfMock(...args),
}));

import { GET as assetsGET, POST as assetsPOST } from '@/app/api/v1/hrm/admin-ops/assets/route';
import {
  DELETE as assetDELETE,
  GET as assetDetailGET,
  PATCH as assetPATCH,
} from '@/app/api/v1/hrm/admin-ops/assets/[id]/route';
import { POST as assignPOST } from '@/app/api/v1/hrm/admin-ops/assets/[id]/assign/route';
import { POST as returnPOST } from '@/app/api/v1/hrm/admin-ops/assets/[id]/return/route';
import { GET as alertsGET } from '@/app/api/v1/hrm/admin-ops/assets/offboarding-alerts/route';
import { GET as exportGET } from '@/app/api/v1/hrm/admin-ops/assets/export/route';
import { GET as meGET } from '@/app/api/v1/hrm/admin-ops/assets/me/route';
import { GET as pdfGET } from '@/app/api/v1/hrm/admin-ops/assets/assignments/[id]/pdf/route';

const ADMIN_OPS_AUTH = {
  userId: 6,
  email: 'adminops@operonhub.local',
  fullName: 'Hành chính Văn phòng',
  avatarUrl: null,
  status: 'ACTIVE' as const,
  roles: [{ id: 6, code: 'ADMIN_OPS', name: 'Hành chính Văn phòng', dataScope: 'BRANCH' as const, branchId: 1 }],
  permissions: ['hrm.assets.read', 'hrm.assets.manage', 'hrm.assets.export'],
  dataScope: 'BRANCH' as const,
  isSuperAdmin: false,
  hasAllBranches: false,
  branchIds: [1],
  branches: [],
};

const EMPLOYEE_AUTH = {
  userId: 9,
  email: 'emp@operonhub.local',
  fullName: 'Nhân viên',
  avatarUrl: null,
  status: 'ACTIVE' as const,
  roles: [{ id: 8, code: 'EMPLOYEE', name: 'Nhân viên', dataScope: 'OWN' as const, branchId: 1 }],
  permissions: ['hrm.assets.read'],
  dataScope: 'OWN' as const,
  isSuperAdmin: false,
  hasAllBranches: false,
  branchIds: [1],
  branches: [],
};

describe('API /api/v1/hrm/admin-ops/assets/*', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    verifyAccessTokenMock.mockResolvedValue({ userId: 6, email: 'adminops@operonhub.local' });
    loadAuthContextMock.mockResolvedValue(ADMIN_OPS_AUTH);
  });

  it('kiểm tra RBAC: EMPLOYEE bị chặn 403 khi tạo/cấp phát tài sản nhưng xem được /me và tải biên bản PDF chính chủ', async () => {
    loadAuthContextMock.mockResolvedValue(EMPLOYEE_AUTH);

    const resCreate = await assetsPOST(
      new NextRequest('http://localhost:3000/api/v1/hrm/admin-ops/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token' },
        body: JSON.stringify({ branchId: 1, assetCode: 'TS-01', name: 'Laptop' }),
      }),
      { params: Promise.resolve({}) },
    );
    expect(resCreate.status).toBe(403);

    listMyAssetsMock.mockResolvedValueOnce({
      activeItems: [{ id: 1, assetCode: 'TS-LT-001' }],
      historyItems: [],
    });
    const resMe = await meGET(
      new NextRequest('http://localhost:3000/api/v1/hrm/admin-ops/assets/me', {
        headers: { Authorization: 'Bearer token' },
      }),
      { params: Promise.resolve({}) },
    );
    expect(resMe.status).toBe(200);
    const meJson = await resMe.json();
    expect(meJson.data.activeItems).toHaveLength(1);

    generateAssetHandoverPdfMock.mockResolvedValueOnce({
      buffer: Buffer.from('%PDF-1.3 handover'),
      fileName: 'bien-ban-tai-san-TS-LT-001-1.pdf',
    });
    const resPdf = await pdfGET(
      new NextRequest('http://localhost:3000/api/v1/hrm/admin-ops/assets/assignments/1/pdf', {
        headers: { Authorization: 'Bearer token' },
      }),
      { params: Promise.resolve({ id: '1' }) },
    );
    expect(resPdf.status).toBe(200);
    expect(resPdf.headers.get('Content-Type')).toBe('application/pdf');
    expect(resPdf.headers.get('Content-Disposition')).toContain('bien-ban-tai-san-TS-LT-001-1.pdf');
  });

  it('hỗ trợ đầy đủ CRUD tài sản, cấp phát, thu hồi, cảnh báo offboarding, xuất Excel & chặn 409 khi xóa tài sản đang cấp phát', async () => {
    listAssetsMock.mockResolvedValueOnce({
      items: [{ id: 1, assetCode: 'TS-LT-001', status: 'AVAILABLE' }],
      stats: { total: 1, available: 1, assigned: 0, maintenance: 0, retired: 0, totalValue: 48500000 },
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    const resList = await assetsGET(
      new NextRequest('http://localhost:3000/api/v1/hrm/admin-ops/assets', {
        headers: { Authorization: 'Bearer token' },
      }),
      { params: Promise.resolve({}) },
    );
    expect(resList.status).toBe(200);

    createAssetMock.mockResolvedValueOnce({ id: 2, assetCode: 'TS-MN-002', status: 'AVAILABLE' });
    const resCreate = await assetsPOST(
      new NextRequest('http://localhost:3000/api/v1/hrm/admin-ops/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token' },
        body: JSON.stringify({
          branchId: 1,
          assetCode: 'TS-MN-002',
          name: 'Màn hình LG 27"',
          category: 'MONITOR',
          purchaseValue: 8500000,
        }),
      }),
      { params: Promise.resolve({}) },
    );
    expect(resCreate.status).toBe(201);

    // Assign validation: thiếu tình trạng (<3 ký tự) -> 400
    const resAssignBad = await assignPOST(
      new NextRequest('http://localhost:3000/api/v1/hrm/admin-ops/assets/2/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token' },
        body: JSON.stringify({ employeeId: 3, conditionOnAssign: 'ok' }),
      }),
      { params: Promise.resolve({ id: '2' }) },
    );
    expect(resAssignBad.status).toBe(400);

    assignAssetMock.mockResolvedValueOnce({ asset: { id: 2, status: 'ASSIGNED' }, assignmentId: 9 });
    const resAssignOk = await assignPOST(
      new NextRequest('http://localhost:3000/api/v1/hrm/admin-ops/assets/2/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token' },
        body: JSON.stringify({
          employeeId: 3,
          conditionOnAssign: 'Mới 100%, nguyên hộp cáp HDMI',
        }),
      }),
      { params: Promise.resolve({ id: '2' }) },
    );
    expect(resAssignOk.status).toBe(201);

    getAssetDetailMock.mockResolvedValueOnce({ asset: { id: 2 }, assignments: [{ id: 9 }] });
    const resDetail = await assetDetailGET(
      new NextRequest('http://localhost:3000/api/v1/hrm/admin-ops/assets/2', {
        headers: { Authorization: 'Bearer token' },
      }),
      { params: Promise.resolve({ id: '2' }) },
    );
    expect(resDetail.status).toBe(200);

    deleteAssetMock.mockRejectedValueOnce(
      new AppError('ASSET_CURRENTLY_ASSIGNED', 'Đang cấp phát', 409),
    );
    const resDelAssigned = await assetDELETE(
      new NextRequest('http://localhost:3000/api/v1/hrm/admin-ops/assets/2', {
        method: 'DELETE',
        headers: { Authorization: 'Bearer token' },
      }),
      { params: Promise.resolve({ id: '2' }) },
    );
    expect(resDelAssigned.status).toBe(409);

    returnAssetMock.mockResolvedValueOnce({ asset: { id: 2, status: 'AVAILABLE' }, assignmentId: 9 });
    const resReturn = await returnPOST(
      new NextRequest('http://localhost:3000/api/v1/hrm/admin-ops/assets/2/return', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token' },
        body: JSON.stringify({
          conditionOnReturn: 'Nguyên vẹn, không trầy xước',
          nextStatus: 'AVAILABLE',
        }),
      }),
      { params: Promise.resolve({ id: '2' }) },
    );
    expect(resReturn.status).toBe(200);

    updateAssetMock.mockResolvedValueOnce({ id: 2, status: 'MAINTENANCE' });
    const resPatch = await assetPATCH(
      new NextRequest('http://localhost:3000/api/v1/hrm/admin-ops/assets/2', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token' },
        body: JSON.stringify({ status: 'MAINTENANCE' }),
      }),
      { params: Promise.resolve({ id: '2' }) },
    );
    expect(resPatch.status).toBe(200);

    listOffboardingAlertsMock.mockResolvedValueOnce([{ assignmentId: 5, assetCode: 'TS-LT-001' }]);
    const resAlerts = await alertsGET(
      new NextRequest('http://localhost:3000/api/v1/hrm/admin-ops/assets/offboarding-alerts', {
        headers: { Authorization: 'Bearer token' },
      }),
      { params: Promise.resolve({}) },
    );
    expect(resAlerts.status).toBe(200);

    exportAssetsExcelMock.mockResolvedValueOnce({
      buffer: Buffer.from('PK\x03\x04xlsx'),
      fileName: 'danh-sach-tai-san-20261123.xlsx',
    });
    const resExport = await exportGET(
      new NextRequest('http://localhost:3000/api/v1/hrm/admin-ops/assets/export', {
        headers: { Authorization: 'Bearer token' },
      }),
      { params: Promise.resolve({}) },
    );
    expect(resExport.status).toBe(200);
    expect(resExport.headers.get('Content-Disposition')).toContain('danh-sach-tai-san-20261123.xlsx');
  });
});
