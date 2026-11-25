import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { Transaction } from 'kysely';
import { describe, expect, it, vi } from 'vitest';
import type { DatabaseSchema } from '@/config/database';
import {
  dispatchApprovalCompletionHook,
  registerApprovalCompletionHook,
} from '@/modules/approvals/approval-hooks';
import { getAuthorizedModules, getModuleByCode, PORTAL_MODULES } from '@/modules/registry';

const PORTABLE_DIR = path.resolve(process.cwd(), 'src/lib/portable');
const SEED_PATH = path.resolve(process.cwd(), 'database/seed-core.ts');

describe('Phase 1 System Regression & CRM Plug-in Readiness', () => {
  it('enforces Zero Business Coupling across all portable modules in src/lib/portable/', () => {
    const files = readdirSync(PORTABLE_DIR).filter((f) => f.endsWith('.ts'));
    expect(files.length).toBeGreaterThanOrEqual(11);

    const forbiddenPatterns = [
      /@\/config\//,
      /@\/modules\//,
      /@\/app\//,
      /@\/layouts\//,
      /@\/components\//,
      /process\.env/,
    ];

    for (const file of files) {
      const content = readFileSync(path.join(PORTABLE_DIR, file), 'utf8');
      for (const pattern of forbiddenPatterns) {
        expect(
          pattern.test(content),
          `Portable file "${file}" must NOT couple to business/config pattern ${pattern}`,
        ).toBe(false);
      }
    }
  });

  it('keeps Portal Module Registry ready for CRM plug-in and filters nav items strictly by RBAC', () => {
    expect(PORTAL_MODULES.map((m) => m.code)).toEqual(['core', 'hrm', 'projects', 'crm']);

    const projectsModule = getModuleByCode('projects');
    expect(projectsModule).toBeDefined();
    expect(projectsModule?.status).toBe('ACTIVE');
    expect(projectsModule?.basePath).toBe('/projects');

    const crmModule = getModuleByCode('crm');
    expect(crmModule).toBeDefined();
    expect(crmModule?.status).toBe('COMING_SOON');
    expect(crmModule?.basePath).toBe('/crm');

    const employeeModules = getAuthorizedModules(
      ['core.approvals.read', 'hrm.org.read', 'hrm.rooms.read', 'hrm.announcements.read'],
      false,
    );
    const hrmForEmp = employeeModules.find((m) => m.code === 'hrm');
    expect(hrmForEmp?.navItems.map((i) => i.href)).toEqual([
      '/hrm/organization',
      '/hrm/office/meeting-rooms',
      '/hrm/office/announcements',
    ]);
    // Payroll & Admin settings must be hidden from EMPLOYEE
    expect(hrmForEmp?.navItems.some((i) => i.href === '/hrm/payroll')).toBe(false);

    const superAdminModules = getAuthorizedModules([], true);
    const hrmForAdmin = superAdminModules.find((m) => m.code === 'hrm');
    expect(hrmForAdmin?.navItems.length).toBeGreaterThanOrEqual(9);
  });

  it('allows future CRM module to plug into Core Universal Approval Engine without editing Core', async () => {
    const crmQuoteHandler = vi.fn().mockResolvedValue(undefined);
    registerApprovalCompletionHook('CRM_QUOTE', crmQuoteHandler);

    const fakeTrx = {} as unknown as Transaction<DatabaseSchema>;
    await dispatchApprovalCompletionHook(fakeTrx, {
      approvalRequestId: 999,
      moduleCode: 'crm',
      entityType: 'CRM_QUOTE',
      entityId: 42,
      nextStatus: 'APPROVED',
      actorUserId: 1,
      comment: 'Ban Giám đốc phê duyệt báo giá CRM',
    });

    expect(crmQuoteHandler).toHaveBeenCalledTimes(1);
    expect(crmQuoteHandler).toHaveBeenCalledWith(
      fakeTrx,
      expect.objectContaining({
        moduleCode: 'crm',
        entityType: 'CRM_QUOTE',
        entityId: 42,
        nextStatus: 'APPROVED',
      }),
    );
  });

  it('preserves all 8 system roles and sensitive permission boundaries in seed-core.ts', () => {
    const seedSql = readFileSync(SEED_PATH, 'utf8');
    const expectedRoles = [
      'SUPER_ADMIN',
      'EXECUTIVE',
      'HR_MANAGER',
      'HR_STAFF',
      'PAYROLL_ACCOUNTANT',
      'ADMIN_OPS',
      'DEPT_MANAGER',
      'EMPLOYEE',
    ];
    for (const role of expectedRoles) {
      expect(seedSql).toContain(`code: '${role}'`);
    }

    const employeeBlock = seedSql.split('EMPLOYEE: [')[1]?.split('],')[0] ?? '';
    expect(employeeBlock).toContain("'hrm.dashboard.read'");
    expect(employeeBlock).toContain("'hrm.rooms.book'");
    expect(employeeBlock).toContain("'hrm.announcements.read'");
    expect(employeeBlock).not.toContain("'hrm.payroll.read'");
    expect(employeeBlock).not.toContain("'hrm.payroll.manage'");
    expect(employeeBlock).not.toContain("'hrm.assets.manage'");
    expect(employeeBlock).not.toContain("'hrm.rooms.manage'");
    expect(employeeBlock).not.toContain("'hrm.announcements.manage'");
    expect(employeeBlock).not.toContain("'pm.projects.manage'");
    expect(employeeBlock).not.toContain("'pm.budget.manage'");
  });
});
