import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthContext } from '@/modules/auth/auth.service';

const mockAuth: AuthContext = {
  userId: 1,
  email: 'pm@operonhub.local',
  fullName: 'Quản lý Dự án',
  avatarUrl: null,
  status: 'ACTIVE',
  isSuperAdmin: true,
  hasAllBranches: true,
  dataScope: 'ALL',
  roles: [{ id: 1, code: 'SUPER_ADMIN', name: 'Quản trị Hệ thống', dataScope: 'ALL', branchId: null }],
  permissions: ['pm.projects.read', 'pm.projects.create', 'pm.tasks.read', 'pm.tasks.create', 'pm.tasks.update'],
  branchIds: [1],
  branches: [{ id: 1, code: 'HQ', name: 'Trụ sở chính', isHeadquarters: true }],
};

vi.mock('@/middlewares/auth', () => ({
  getRequestIp: () => '127.0.0.1',
  withAuth: (handler: (req: NextRequest, ctx: { params: Promise<Record<string, string>> }, auth: AuthContext) => unknown) => {
    return (req: NextRequest, ctx: { params: Promise<Record<string, string>> }) =>
      handler(req, ctx ?? { params: Promise.resolve({}) }, mockAuth);
  },
}));

const mockCreateProject = vi.fn();
const mockListProjects = vi.fn();
vi.mock('@/modules/projects/projects.service', () => ({
  createProject: (...args: unknown[]) => mockCreateProject(...args),
  listProjects: (...args: unknown[]) => mockListProjects(...args),
  getProjectDetail: vi.fn(),
  updateProject: vi.fn(),
}));

const mockCreateTask = vi.fn();
const mockMoveTask = vi.fn();
vi.mock('@/modules/projects/tasks.service', () => ({
  createTask: (...args: unknown[]) => mockCreateTask(...args),
  moveTask: (...args: unknown[]) => mockMoveTask(...args),
  listProjectTasks: vi.fn(),
  getTaskDetail: vi.fn(),
  updateTask: vi.fn(),
}));

import { DELETE as deleteProject } from '@/app/api/v1/projects/[id]/route';
import { POST as postProject } from '@/app/api/v1/projects/route';
import { PATCH as patchMoveTask } from '@/app/api/v1/tasks/[id]/move/route';
import { DELETE as deleteTask } from '@/app/api/v1/tasks/[id]/route';
import { POST as postTask } from '@/app/api/v1/tasks/route';

describe('Projects & Tasks REST API Contracts (No Hard-Delete + CRUD/Move)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('blocks hard-delete on DELETE /api/v1/projects/[id] with HTTP 405', async () => {
    const req = new NextRequest('http://localhost/api/v1/projects/1', { method: 'DELETE' });
    const res = await deleteProject(req, { params: Promise.resolve({ id: '1' }) });
    const json = (await res.json()) as { success: boolean; error: { code: string } };

    expect(res.status).toBe(405);
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('PROJECT_HARD_DELETE_FORBIDDEN');
  });

  it('blocks hard-delete on DELETE /api/v1/tasks/[id] with HTTP 405', async () => {
    const req = new NextRequest('http://localhost/api/v1/tasks/10', { method: 'DELETE' });
    const res = await deleteTask(req, { params: Promise.resolve({ id: '10' }) });
    const json = (await res.json()) as { success: boolean; error: { code: string } };

    expect(res.status).toBe(405);
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('TASK_HARD_DELETE_FORBIDDEN');
  });

  it('creates a project via POST /api/v1/projects and returns 201', async () => {
    mockCreateProject.mockResolvedValueOnce({ id: 5, code: 'ERP-2026', name: 'Phase 2 PM' });
    const req = new NextRequest('http://localhost/api/v1/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: 'ERP-2026',
        name: 'Phase 2 PM',
        branchId: 1,
        ownerEmployeeId: 1,
        managerEmployeeId: 1,
      }),
    });

    const res = await postProject(req, { params: Promise.resolve({}) });
    const json = (await res.json()) as { success: boolean; data: { code: string } };

    expect(res.status).toBe(201);
    expect(json.success).toBe(true);
    expect(json.data.code).toBe('ERP-2026');
  });

  it('creates a task and moves it across Kanban columns via LexoRank', async () => {
    mockCreateTask.mockResolvedValueOnce({ id: 101, taskKey: 'ERP-2026-1', title: 'Setup Board' });
    const createReq = new NextRequest('http://localhost/api/v1/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: 5,
        title: 'Setup Board',
        priority: 'HIGH',
      }),
    });
    const createRes = await postTask(createReq, { params: Promise.resolve({}) });
    expect(createRes.status).toBe(201);

    mockMoveTask.mockResolvedValueOnce({
      task: { id: 101, columnId: 3, sortRank: 'n' },
      wipLimitExceeded: false,
      wipLimit: 5,
    });
    const moveReq = new NextRequest('http://localhost/api/v1/tasks/101/move', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetColumnId: 3, prevRank: 'a', nextRank: 'z', expectedVersion: 1 }),
    });
    const moveRes = await patchMoveTask(moveReq, { params: Promise.resolve({ id: '101' }) });
    const moveJson = (await moveRes.json()) as { success: boolean; data: { wipLimitExceeded: boolean } };

    expect(moveRes.status).toBe(200);
    expect(moveJson.success).toBe(true);
    expect(moveJson.data.wipLimitExceeded).toBe(false);
  });
});
