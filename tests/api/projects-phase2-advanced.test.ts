import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import type { AuthContext } from '@/modules/auth/auth.service';

const mockAuth: AuthContext = {
  userId: 1,
  email: 'pmo@operon.vn',
  fullName: 'PMO Admin',
  avatarUrl: null,
  status: 'ACTIVE',
  isSuperAdmin: true,
  dataScope: 'ALL',
  branchIds: [1],
  branches: [{ id: 1, code: 'HQ', name: 'Trụ sở chính', isHeadquarters: true }],
  hasAllBranches: true,
  roles: [{ id: 1, code: 'SUPER_ADMIN', name: 'Super Admin', dataScope: 'ALL', branchId: null }],
  permissions: ['pm.dashboard.read', 'pm.projects.read', 'pm.sprints.manage', 'pm.timelogs.log', 'pm.workload.read'],
};

vi.mock('@/middlewares/auth', () => ({
  withAuth:
    (handler: (req: NextRequest, ctx: { params: Promise<Record<string, string>> }, auth: AuthContext) => Promise<Response>) =>
    (req: NextRequest, ctx: { params: Promise<Record<string, string>> }) =>
      handler(req, ctx ?? { params: Promise.resolve({}) }, mockAuth),
}));

vi.mock('@/modules/projects/sprints.service', () => ({
  listProjectSprints: vi.fn().mockResolvedValue([
    {
      id: 10,
      projectId: 1,
      name: 'Sprint 01',
      goal: 'MVP',
      startDate: '2026-11-24',
      endDate: '2026-12-07',
      status: 'ACTIVE',
      committedPoints: 20,
      completedPoints: 10,
      completedAt: null,
      taskCount: 5,
      completedTaskCount: 2,
      totalPoints: 20,
      donePoints: 10,
    },
  ]),
  createProjectSprint: vi.fn().mockResolvedValue({ id: 11, name: 'Sprint 02', status: 'PLANNED' }),
}));

vi.mock('@/modules/projects/workload.service', () => ({
  getWorkloadHeatmap: vi.fn().mockResolvedValue({
    dates: ['2026-11-24'],
    rows: [],
    summary: { employeeCount: 0, overloadedEmployeeCount: 0, averageUtilizationPercent: 0 },
  }),
}));

vi.mock('@/modules/projects/reports.service', () => ({
  getPortfolioDashboardSummary: vi.fn().mockResolvedValue({
    totals: {
      totalProjects: 3,
      activeProjects: 2,
      completedProjects: 1,
      totalTasks: 40,
      completedTasks: 28,
      overdueTasks: 2,
      onTimeRatePercent: 92,
      totalPlannedBudget: 500000000,
      totalActualCost: 220000000,
      budgetBurnPercent: 44,
      totalLoggedHours: 185.5,
      highRiskCount: 1,
    },
    byStatus: [],
    byHealth: [],
    topRiskProjects: [],
    recentSprints: [],
  }),
}));

import { GET as getSprints, POST as createSprint } from '@/app/api/v1/projects/[id]/sprints/route';
import { GET as getWorkload } from '@/app/api/v1/pm/workload/route';
import { GET as getDashboardSummary } from '@/app/api/v1/pm/dashboard/summary/route';

describe('API v1 Phase 2 Advanced PM Routes (P2-TASK-06..12)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists and creates project sprints', async () => {
    const reqList = new NextRequest('http://localhost:3000/api/v1/projects/1/sprints');
    const resList = await getSprints(reqList, { params: Promise.resolve({ id: '1' }) });
    const bodyList = await resList.json();
    expect(resList.status).toBe(200);
    expect(bodyList.success).toBe(true);
    expect(bodyList.data[0].name).toBe('Sprint 01');

    const reqCreate = new NextRequest('http://localhost:3000/api/v1/projects/1/sprints', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Sprint 02', goal: 'Release' }),
    });
    const resCreate = await createSprint(reqCreate, { params: Promise.resolve({ id: '1' }) });
    expect(resCreate.status).toBe(201);
  });

  it('returns HRM-integrated workload matrix', async () => {
    const req = new NextRequest(
      'http://localhost:3000/api/v1/pm/workload?startDate=2026-11-24&endDate=2026-12-07',
    );
    const res = await getWorkload(req, { params: Promise.resolve({}) });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.dates).toEqual(['2026-11-24']);
  });

  it('returns executive portfolio dashboard summary KPIs', async () => {
    const req = new NextRequest('http://localhost:3000/api/v1/pm/dashboard/summary');
    const res = await getDashboardSummary(req, { params: Promise.resolve({}) });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.totals.totalProjects).toBe(3);
    expect(body.data.totals.onTimeRatePercent).toBe(92);
  });
});
