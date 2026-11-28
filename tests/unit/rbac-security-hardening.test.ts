import { describe, expect, it } from 'vitest';
import { canUserActOnApproval } from '@/modules/approvals/approvals.service';
import { buildDualRailGroups } from '@/layouts/portal-navigation';
import { getAuthorizedModules } from '@/modules/registry';

describe('RBAC Security Hardening (TASK-20261128-04)', () => {
  describe('canUserActOnApproval — anti-hijack, anti-self-approval, branch & dept scope', () => {
    const techManager = {
      userId: 11,
      isSuperAdmin: false,
      permissions: ['core.approvals.read', 'core.approvals.act'],
      hasAllBranches: false,
      branchIds: [1],
      departmentIds: [4],
      roles: [
        {
          id: 7,
          code: 'DEPT_MANAGER',
          name: 'Trưởng Bộ phận',
          dataScope: 'DEPARTMENT' as const,
          branchId: 1,
        },
      ],
    };

    const hcmManager = {
      userId: 12,
      isSuperAdmin: false,
      permissions: ['core.approvals.read', 'core.approvals.act'],
      hasAllBranches: false,
      branchIds: [29],
      departmentIds: [6],
      roles: [
        {
          id: 7,
          code: 'DEPT_MANAGER',
          name: 'Trưởng Bộ phận',
          dataScope: 'DEPARTMENT' as const,
          branchId: 29,
        },
      ],
    };

    it('blocks other DEPT_MANAGER when direct approver user is explicitly assigned', () => {
      const request = {
        requesterId: 14, // FIN employee
        branchId: 1,
        requesterDepartmentId: 3, // FIN dept
        currentApproverUserId: 7, // Finance Manager
        currentApproverRoleId: 7, // Legacy fallback role
      };

      expect(canUserActOnApproval(request, techManager, 'APPROVE')).toBe(false);
      expect(canUserActOnApproval(request, hcmManager, 'APPROVE')).toBe(false);
      expect(
        canUserActOnApproval(
          request,
          {
            userId: 7,
            isSuperAdmin: false,
            permissions: ['core.approvals.act'],
            roles: [],
          },
          'APPROVE',
        ),
      ).toBe(true);
    });

    it('blocks cross-branch & cross-department role-based approval for DEPT_MANAGER', () => {
      const finRequestRoleOnly = {
        requesterId: 14,
        branchId: 1,
        requesterDepartmentId: 3, // FIN dept
        currentApproverUserId: null,
        currentApproverRoleId: 7, // DEPT_MANAGER
      };
      const techRequestRoleOnly = {
        requesterId: 13,
        branchId: 1,
        requesterDepartmentId: 4, // TECH dept
        currentApproverUserId: null,
        currentApproverRoleId: 7,
      };

      // Cross-dept in same branch -> BLOCKED
      expect(canUserActOnApproval(finRequestRoleOnly, techManager, 'APPROVE')).toBe(false);
      // Cross-branch -> BLOCKED
      expect(canUserActOnApproval(finRequestRoleOnly, hcmManager, 'APPROVE')).toBe(false);
      // Same branch & same department -> ALLOWED
      expect(canUserActOnApproval(techRequestRoleOnly, techManager, 'APPROVE')).toBe(true);
    });

    it('blocks self-approval even when requester holds matching approver role', () => {
      const ownRequest = {
        requesterId: 11,
        branchId: 1,
        requesterDepartmentId: 4,
        currentApproverUserId: null,
        currentApproverRoleId: 7,
      };

      expect(canUserActOnApproval(ownRequest, techManager, 'APPROVE')).toBe(false);
      expect(canUserActOnApproval(ownRequest, techManager, 'REJECT')).toBe(false);
      expect(canUserActOnApproval(ownRequest, techManager, 'CANCEL')).toBe(true);
    });

    it('requires core.approvals.act permission when permissions array is provided', () => {
      const request = {
        requesterId: 13,
        branchId: 1,
        requesterDepartmentId: 4,
        currentApproverUserId: 11,
        currentApproverRoleId: null,
      };

      expect(
        canUserActOnApproval(
          request,
          { ...techManager, permissions: ['core.approvals.read'] },
          'APPROVE',
        ),
      ).toBe(false);
    });
  });

  describe('buildDualRailGroups — filters Services Hub sidebar by user permissions', () => {
    it('hides restricted service routes when user lacks their read permissions', () => {
      const perms = ['hrm.rooms.read']; // no it_requests.read, proposals.read, payments.read
      const modules = getAuthorizedModules(perms, false);
      const groups = buildDualRailGroups(modules, 'vi', perms, false);
      const services = groups.find((g) => g.key === 'services');

      const hrefs = (services?.items ?? []).map((i) => i.href);
      expect(hrefs).toContain('/services');
      expect(hrefs).toContain('/hrm/office/meeting-rooms');
      expect(hrefs).not.toContain('/services/it-requests');
      expect(hrefs).not.toContain('/services/proposals');
      expect(hrefs).not.toContain('/services/payments');
    });

    it('shows all service routes for SUPER_ADMIN', () => {
      const modules = getAuthorizedModules([], true);
      const groups = buildDualRailGroups(modules, 'vi', [], true);
      const services = groups.find((g) => g.key === 'services');
      const hrefs = (services?.items ?? []).map((i) => i.href);

      expect(hrefs).toContain('/services/it-requests');
      expect(hrefs).toContain('/services/proposals');
      expect(hrefs).toContain('/services/payments');
    });
  });
});
