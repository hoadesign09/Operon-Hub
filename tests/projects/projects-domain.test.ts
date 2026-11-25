import { describe, expect, it } from 'vitest';
import { validateTaskAttachmentFile } from '@/modules/projects/collaboration.service';
import {
  evaluateProjectCapabilities,
  isAllowedProjectStatusTransition,
} from '@/modules/projects/projects.access';
import {
  computeTaskDepth,
  wouldCreateDependencyCycle,
} from '@/modules/projects/tasks.service';

describe('Projects Domain Logic (2-Tier RBAC, Lifecycle, Hierarchy & DAG)', () => {
  it('enforces 2-tier visibility & permissions for PRIVATE_INVITE and BRANCH projects', () => {
    const outsiderOnPrivate = evaluateProjectCapabilities({
      isSuperAdmin: false,
      isExecutive: false,
      hasManagePerm: false,
      hasBudgetReadPerm: false,
      hasTaskCreatePerm: true,
      hasTaskUpdatePerm: true,
      dataScope: 'OWN',
      userBranchIds: [1],
      employeeBranchId: 1,
      employeeDepartmentId: 2,
      project: { branchId: 1, departmentId: 2, visibility: 'PRIVATE_INVITE', status: 'ACTIVE' },
      projectRole: null,
    });
    expect(outsiderOnPrivate.canView).toBe(false);
    expect(outsiderOnPrivate.canEditTasks).toBe(false);

    const memberOnPrivate = evaluateProjectCapabilities({
      isSuperAdmin: false,
      isExecutive: false,
      hasManagePerm: false,
      hasBudgetReadPerm: false,
      hasTaskCreatePerm: true,
      hasTaskUpdatePerm: true,
      dataScope: 'OWN',
      userBranchIds: [1],
      employeeBranchId: 1,
      employeeDepartmentId: 2,
      project: { branchId: 1, departmentId: 2, visibility: 'PRIVATE_INVITE', status: 'ACTIVE' },
      projectRole: 'MEMBER',
    });
    expect(memberOnPrivate.canView).toBe(true);
    expect(memberOnPrivate.canEditTasks).toBe(true);
    expect(memberOnPrivate.canEditProject).toBe(false);
    expect(memberOnPrivate.canViewBudget).toBe(false);

    const pmOnArchived = evaluateProjectCapabilities({
      isSuperAdmin: false,
      isExecutive: false,
      hasManagePerm: false,
      hasBudgetReadPerm: false,
      hasTaskCreatePerm: true,
      hasTaskUpdatePerm: true,
      dataScope: 'BRANCH',
      userBranchIds: [1],
      employeeBranchId: 1,
      employeeDepartmentId: 2,
      project: { branchId: 1, departmentId: 2, visibility: 'BRANCH', status: 'ARCHIVED' },
      projectRole: 'PROJECT_OWNER',
    });
    expect(pmOnArchived.canView).toBe(true);
    expect(pmOnArchived.canEditProject).toBe(false);
    expect(pmOnArchived.canArchive).toBe(true);
  });

  it('validates project lifecycle state machine transitions', () => {
    expect(isAllowedProjectStatusTransition('DRAFT', 'PENDING_APPROVAL')).toBe(true);
    expect(isAllowedProjectStatusTransition('DRAFT', 'ACTIVE')).toBe(true);
    expect(isAllowedProjectStatusTransition('PENDING_APPROVAL', 'PLANNING')).toBe(true);
    expect(isAllowedProjectStatusTransition('ACTIVE', 'COMPLETED')).toBe(true);
    expect(isAllowedProjectStatusTransition('DRAFT', 'ARCHIVED')).toBe(false);
    expect(isAllowedProjectStatusTransition('PENDING_APPROVAL', 'COMPLETED')).toBe(false);
  });

  it('detects dependency cycles (DAG) and computes task hierarchy depth accurately', () => {
    const edges = [
      { predecessorTaskId: 1, successorTaskId: 2 },
      { predecessorTaskId: 2, successorTaskId: 3 },
    ];
    expect(wouldCreateDependencyCycle(edges, 3, 1)).toBe(true);
    expect(wouldCreateDependencyCycle(edges, 1, 1)).toBe(true);
    expect(wouldCreateDependencyCycle(edges, 1, 3)).toBe(false);
    expect(wouldCreateDependencyCycle(edges, 3, 4)).toBe(false);

    const nodes = [
      { id: 10, parentId: null },
      { id: 20, parentId: 10 },
      { id: 30, parentId: 20 },
    ];
    expect(computeTaskDepth(nodes, null)).toBe(1);
    expect(computeTaskDepth(nodes, 10)).toBe(2);
    expect(computeTaskDepth(nodes, 20)).toBe(3);
    expect(computeTaskDepth(nodes, 30)).toBe(4); // exceeds max 3
  });

  it('validates task attachment MIME whitelist and 10 MB size cap', () => {
    const okFile = validateTaskAttachmentFile({
      name: 'spec-tai-lieu.pdf',
      type: 'application/pdf',
      size: 1024 * 500,
    });
    expect(okFile.safeExt).toBe('.pdf');

    expect(() =>
      validateTaskAttachmentFile({
        name: 'malware.exe',
        type: 'application/x-msdownload',
        size: 1000,
      }),
    ).toThrow();

    expect(() =>
      validateTaskAttachmentFile({
        name: 'huge.pdf',
        type: 'application/pdf',
        size: 12 * 1024 * 1024,
      }),
    ).toThrow();
  });
});
