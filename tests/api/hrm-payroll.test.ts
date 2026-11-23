import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '@/shared/api-response';

const verifyAccessTokenMock = vi.fn();
const loadAuthContextMock = vi.fn();

const getPayrollConfigMock = vi.fn();
const updatePayrollConfigMock = vi.fn();
const listPayrollPeriodsMock = vi.fn();
const createPayrollPeriodMock = vi.fn();
const getPayrollPeriodDetailMock = vi.fn();
const deletePayrollPeriodMock = vi.fn();
const calculatePayrollPeriodMock = vi.fn();
const approvePayrollPeriodMock = vi.fn();
const reopenPayrollPeriodMock = vi.fn();
const payPayrollPeriodMock = vi.fn();
const exportPayrollPeriodExcelMock = vi.fn();
const getPayslipDetailMock = vi.fn();
const updatePayslipManualItemsMock = vi.fn();
const listMyPayslipsMock = vi.fn();
const generatePayslipPdfBufferMock = vi.fn();

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

vi.mock('@/modules/hrm/payroll/payroll-config.service', () => ({
  getPayrollConfig: (...args: unknown[]) => getPayrollConfigMock(...args),
  updatePayrollConfig: (...args: unknown[]) => updatePayrollConfigMock(...args),
}));

vi.mock('@/modules/hrm/payroll/payroll.service', () => ({
  listPayrollPeriods: (...args: unknown[]) => listPayrollPeriodsMock(...args),
  createPayrollPeriod: (...args: unknown[]) => createPayrollPeriodMock(...args),
  getPayrollPeriodDetail: (...args: unknown[]) => getPayrollPeriodDetailMock(...args),
  deletePayrollPeriod: (...args: unknown[]) => deletePayrollPeriodMock(...args),
  calculatePayrollPeriod: (...args: unknown[]) => calculatePayrollPeriodMock(...args),
  approvePayrollPeriod: (...args: unknown[]) => approvePayrollPeriodMock(...args),
  reopenPayrollPeriod: (...args: unknown[]) => reopenPayrollPeriodMock(...args),
  payPayrollPeriod: (...args: unknown[]) => payPayrollPeriodMock(...args),
  exportPayrollPeriodExcel: (...args: unknown[]) => exportPayrollPeriodExcelMock(...args),
  getPayslipDetail: (...args: unknown[]) => getPayslipDetailMock(...args),
  updatePayslipManualItems: (...args: unknown[]) => updatePayslipManualItemsMock(...args),
  listMyPayslips: (...args: unknown[]) => listMyPayslipsMock(...args),
}));

vi.mock('@/modules/hrm/payroll/payslip-pdf.service', () => ({
  generatePayslipPdfBuffer: (...args: unknown[]) => generatePayslipPdfBufferMock(...args),
}));

import { GET as configGET, PATCH as configPATCH } from '@/app/api/v1/hrm/payroll/config/route';
import { GET as periodsGET, POST as periodsPOST } from '@/app/api/v1/hrm/payroll/periods/route';
import {
  DELETE as periodDELETE,
  GET as periodDetailGET,
} from '@/app/api/v1/hrm/payroll/periods/[id]/route';
import { POST as calcPOST } from '@/app/api/v1/hrm/payroll/periods/[id]/calculate/route';
import { POST as approvePOST } from '@/app/api/v1/hrm/payroll/periods/[id]/approve/route';
import { POST as reopenPOST } from '@/app/api/v1/hrm/payroll/periods/[id]/reopen/route';
import { POST as payPOST } from '@/app/api/v1/hrm/payroll/periods/[id]/pay/route';
import { GET as exportGET } from '@/app/api/v1/hrm/payroll/periods/[id]/export/route';
import { GET as myPayslipsGET } from '@/app/api/v1/hrm/payroll/payslips/me/route';
import {
  GET as payslipGET,
  PATCH as payslipPATCH,
} from '@/app/api/v1/hrm/payroll/payslips/[id]/route';
import { GET as payslipPdfGET } from '@/app/api/v1/hrm/payroll/payslips/[id]/pdf/route';

const PAYROLL_ACCOUNTANT_AUTH = {
  userId: 2,
  email: 'payroll@operonhub.local',
  fullName: 'Kế toán Lương',
  avatarUrl: null,
  status: 'ACTIVE' as const,
  roles: [{ id: 5, code: 'PAYROLL_ACCOUNTANT', name: 'Kế toán Lương', dataScope: 'ALL' as const, branchId: null }],
  permissions: [
    'hrm.payroll.read',
    'hrm.payroll.manage',
    'hrm.payroll.approve',
    'hrm.payroll.export',
  ],
  dataScope: 'ALL' as const,
  isSuperAdmin: false,
  hasAllBranches: true,
  branchIds: [],
  branches: [],
};

const EMPLOYEE_AUTH = {
  userId: 9,
  email: 'employee@operonhub.local',
  fullName: 'Nhân viên ESS',
  avatarUrl: null,
  status: 'ACTIVE' as const,
  roles: [{ id: 8, code: 'EMPLOYEE', name: 'Nhân viên', dataScope: 'OWN' as const, branchId: 1 }],
  permissions: ['hrm.org.read', 'hrm.employees.read'],
  dataScope: 'OWN' as const,
  isSuperAdmin: false,
  hasAllBranches: false,
  branchIds: [1],
  branches: [],
};

describe('API /api/v1/hrm/payroll/*', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    verifyAccessTokenMock.mockResolvedValue({ userId: 2, email: 'payroll@operonhub.local' });
    loadAuthContextMock.mockResolvedValue(PAYROLL_ACCOUNTANT_AUTH);
  });

  it('kiểm tra RBAC chặt: EMPLOYEE bị chặn 403 trên quản trị lương nhưng được truy cập ESS /payslips/me và tải PDF chính chủ', async () => {
    loadAuthContextMock.mockResolvedValue(EMPLOYEE_AUTH);

    const resAdminList = await periodsGET(
      new NextRequest('http://localhost:3000/api/v1/hrm/payroll/periods', {
        headers: { Authorization: 'Bearer token' },
      }),
      { params: Promise.resolve({}) },
    );
    expect(resAdminList.status).toBe(403);

    const resApprove = await approvePOST(
      new NextRequest('http://localhost:3000/api/v1/hrm/payroll/periods/1/approve', {
        method: 'POST',
        headers: { Authorization: 'Bearer token' },
      }),
      { params: Promise.resolve({ id: '1' }) },
    );
    expect(resApprove.status).toBe(403);

    listMyPayslipsMock.mockResolvedValueOnce({
      items: [{ id: 10, month: 11, year: 2026, netSalary: 20_000_000 }],
      summary: { year: 2026, count: 1, totalGross: 23_000_000, totalInsuranceEmp: 2_100_000, totalTax: 300_000, totalNet: 20_600_000 },
    });
    const resEss = await myPayslipsGET(
      new NextRequest('http://localhost:3000/api/v1/hrm/payroll/payslips/me?year=2026', {
        headers: { Authorization: 'Bearer token' },
      }),
      { params: Promise.resolve({}) },
    );
    expect(resEss.status).toBe(200);
    const essJson = await resEss.json();
    expect(essJson.data.summary.count).toBe(1);

    generatePayslipPdfBufferMock.mockResolvedValueOnce({
      buffer: Buffer.from('%PDF-1.3 mock'),
      fileName: 'phieu-luong-NV0002-2026-11.pdf',
    });
    const resPdf = await payslipPdfGET(
      new NextRequest('http://localhost:3000/api/v1/hrm/payroll/payslips/10/pdf', {
        headers: { Authorization: 'Bearer token' },
      }),
      { params: Promise.resolve({ id: '10' }) },
    );
    expect(resPdf.status).toBe(200);
    expect(resPdf.headers.get('Content-Type')).toBe('application/pdf');
    expect(resPdf.headers.get('Content-Disposition')).toContain('phieu-luong-NV0002-2026-11.pdf');
  });

  it('hỗ trợ vòng đời kỳ lương đầy đủ: config, tạo, tính lương, chỉnh thưởng thủ công, duyệt, mở lại (validate lý do), chi trả & xuất Excel', async () => {
    getPayrollConfigMock.mockResolvedValueOnce({ bhxhEmpRate: 0.08 });
    const resCfgGet = await configGET(
      new NextRequest('http://localhost:3000/api/v1/hrm/payroll/config', {
        headers: { Authorization: 'Bearer token' },
      }),
      { params: Promise.resolve({}) },
    );
    expect(resCfgGet.status).toBe(200);

    updatePayrollConfigMock.mockResolvedValueOnce({ bhxhEmpRate: 0.08 });
    const resCfgPatch = await configPATCH(
      new NextRequest('http://localhost:3000/api/v1/hrm/payroll/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token' },
        body: JSON.stringify({
          bhxhEmpRate: 0.08,
          bhytEmpRate: 0.015,
          bhtnEmpRate: 0.01,
          bhxhBhytSalaryCap: 46800000,
          bhtnSalaryCap: 99200000,
          personalDeduction: 11000000,
          dependentDeduction: 4400000,
          workingHoursPerDay: 8,
          otRate150: 1.5,
          otRate200: 2.0,
          otRate300: 3.0,
          requireLockedAttendance: true,
        }),
      }),
      { params: Promise.resolve({}) },
    );
    expect(resCfgPatch.status).toBe(200);

    createPayrollPeriodMock.mockResolvedValueOnce({ id: 5, code: 'BL-2026-11-HQ', status: 'DRAFT' });
    const resCreate = await periodsPOST(
      new NextRequest('http://localhost:3000/api/v1/hrm/payroll/periods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token' },
        body: JSON.stringify({ year: 2026, month: 11, branchId: 1 }),
      }),
      { params: Promise.resolve({}) },
    );
    expect(resCreate.status).toBe(201);

    calculatePayrollPeriodMock.mockResolvedValueOnce({
      period: { id: 5, status: 'CALCULATED', totalEmployees: 3 },
      processedCount: 3,
      skippedNoContractCount: 0,
      skippedUnlockedAttendanceCount: 0,
      warnings: [],
    });
    const resCalc = await calcPOST(
      new NextRequest('http://localhost:3000/api/v1/hrm/payroll/periods/5/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token' },
        body: JSON.stringify({ includeDraftAttendance: true }),
      }),
      { params: Promise.resolve({ id: '5' }) },
    );
    expect(resCalc.status).toBe(200);

    getPayrollPeriodDetailMock.mockResolvedValueOnce({
      period: { id: 5, status: 'CALCULATED' },
      payslips: [],
      meta: { page: 1, limit: 50, total: 0, totalPages: 1 },
    });
    const resDetail = await periodDetailGET(
      new NextRequest('http://localhost:3000/api/v1/hrm/payroll/periods/5', {
        headers: { Authorization: 'Bearer token' },
      }),
      { params: Promise.resolve({ id: '5' }) },
    );
    expect(resDetail.status).toBe(200);

    updatePayslipManualItemsMock.mockResolvedValueOnce({ id: 10, totalBonus: 2_000_000 });
    const resPatchSlip = await payslipPATCH(
      new NextRequest('http://localhost:3000/api/v1/hrm/payroll/payslips/10', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token' },
        body: JSON.stringify({
          note: 'Thưởng KPI',
          manualItems: [
            { itemType: 'EARNING', code: 'KPI', label: 'Thưởng KPI', amount: 2_000_000, isTaxable: true },
          ],
        }),
      }),
      { params: Promise.resolve({ id: '10' }) },
    );
    expect(resPatchSlip.status).toBe(200);

    getPayslipDetailMock.mockResolvedValueOnce({ id: 10, items: [] });
    const resGetSlip = await payslipGET(
      new NextRequest('http://localhost:3000/api/v1/hrm/payroll/payslips/10', {
        headers: { Authorization: 'Bearer token' },
      }),
      { params: Promise.resolve({ id: '10' }) },
    );
    expect(resGetSlip.status).toBe(200);

    // Mở lại kỳ lương thiếu lý do (<5 ký tự) phải trả 400
    const resReopenBad = await reopenPOST(
      new NextRequest('http://localhost:3000/api/v1/hrm/payroll/periods/5/reopen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token' },
        body: JSON.stringify({ reason: 'abc' }),
      }),
      { params: Promise.resolve({ id: '5' }) },
    );
    expect(resReopenBad.status).toBe(400);

    reopenPayrollPeriodMock.mockResolvedValueOnce({ id: 5, status: 'CALCULATED' });
    const resReopenOk = await reopenPOST(
      new NextRequest('http://localhost:3000/api/v1/hrm/payroll/periods/5/reopen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token' },
        body: JSON.stringify({ reason: 'Cập nhật thưởng dự án tháng 11' }),
      }),
      { params: Promise.resolve({ id: '5' }) },
    );
    expect(resReopenOk.status).toBe(200);

    payPayrollPeriodMock.mockResolvedValueOnce({
      period: { id: 5, status: 'PAID' },
      publishedCount: 3,
      notifiedCount: 1,
    });
    const resPay = await payPOST(
      new NextRequest('http://localhost:3000/api/v1/hrm/payroll/periods/5/pay', {
        method: 'POST',
        headers: { Authorization: 'Bearer token' },
      }),
      { params: Promise.resolve({ id: '5' }) },
    );
    expect(resPay.status).toBe(200);

    exportPayrollPeriodExcelMock.mockResolvedValueOnce({
      buffer: Buffer.from('PK\x03\x04mockxlsx'),
      fileName: 'bang-luong-BL-2026-11-HQ.xlsx',
    });
    const resExport = await exportGET(
      new NextRequest('http://localhost:3000/api/v1/hrm/payroll/periods/5/export', {
        headers: { Authorization: 'Bearer token' },
      }),
      { params: Promise.resolve({ id: '5' }) },
    );
    expect(resExport.status).toBe(200);
    expect(resExport.headers.get('Content-Disposition')).toContain('bang-luong-BL-2026-11-HQ.xlsx');

    deletePayrollPeriodMock.mockRejectedValueOnce(
      new AppError('PAYROLL_PERIOD_LOCKED', 'Đã chi trả', 409),
    );
    const resDelLocked = await periodDELETE(
      new NextRequest('http://localhost:3000/api/v1/hrm/payroll/periods/5', {
        method: 'DELETE',
        headers: { Authorization: 'Bearer token' },
      }),
      { params: Promise.resolve({ id: '5' }) },
    );
    expect(resDelLocked.status).toBe(409);
  });
});
