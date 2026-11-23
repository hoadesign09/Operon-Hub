import { describe, expect, it } from 'vitest';
import {
  buildDualRailGroups,
  getUserInitials,
  resolveActiveRailKey,
  resolvePageContextLabel,
} from '@/layouts/portal-navigation';
import { getAuthorizedModules } from '@/modules/registry';

describe('Midnight Command Dual-Rail Portal Navigation', () => {
  it('maps portal paths accurately to the corresponding Dual-Rail group', () => {
    expect(resolveActiveRailKey('/dashboard')).toBe('workspace');
    expect(resolveActiveRailKey('/my/profile')).toBe('workspace');
    expect(resolveActiveRailKey('/approvals')).toBe('workspace');
    expect(resolveActiveRailKey('/hrm/employees')).toBe('hrm');
    expect(resolveActiveRailKey('/hrm/employees/12')).toBe('hrm');
    expect(resolveActiveRailKey('/hrm/office/meeting-rooms')).toBe('hrm');
    expect(resolveActiveRailKey('/settings/branches')).toBe('admin');
    expect(resolveActiveRailKey('/settings/users-roles')).toBe('admin');
    expect(resolveActiveRailKey('/crm')).toBe('crm');
  });

  it('builds 4 rail groups for SUPER_ADMIN and preserves all RBAC nav items', () => {
    const modules = getAuthorizedModules([], true);
    const groups = buildDualRailGroups(modules);

    expect(groups.map((g) => g.key)).toEqual(['workspace', 'hrm', 'admin', 'crm']);
    const workspace = groups.find((g) => g.key === 'workspace');
    const hrm = groups.find((g) => g.key === 'hrm');
    const admin = groups.find((g) => g.key === 'admin');
    const crm = groups.find((g) => g.key === 'crm');

    expect(workspace?.items.some((item) => item.href === '/dashboard')).toBe(true);
    expect(workspace?.items.some((item) => item.href === '/approvals')).toBe(true);
    expect(hrm?.items.length).toBeGreaterThanOrEqual(9);
    expect(admin?.items.length).toBeGreaterThanOrEqual(4);
    expect(crm?.isComingSoon).toBe(true);
  });

  it('hides admin rail group for basic EMPLOYEE without settings permissions', () => {
    const modules = getAuthorizedModules(['hrm.rooms.read', 'hrm.announcements.read'], false);
    const groups = buildDualRailGroups(modules);

    expect(groups.some((g) => g.key === 'workspace')).toBe(true);
    expect(groups.some((g) => g.key === 'hrm')).toBe(true);
    expect(groups.some((g) => g.key === 'admin')).toBe(false);
  });

  it('resolves contextual breadcrumb labels for active portal routes', () => {
    const modules = getAuthorizedModules([], true);
    const groups = buildDualRailGroups(modules);

    expect(resolvePageContextLabel('/hrm/employees/42', groups)).toEqual({
      groupTitle: 'Hành chính Nhân sự',
      itemLabel: 'Hồ sơ Nhân viên',
    });
    expect(resolvePageContextLabel('/settings/workflows', groups)).toEqual({
      groupTitle: 'Quản trị Hệ thống',
      itemLabel: 'Luồng phê duyệt',
    });
  });

  it('computes clean two-letter user initials for compact Rail 1 avatar', () => {
    expect(getUserInitials('Quản trị Hệ thống')).toBe('QT');
    expect(getUserInitials('Nguyễn Minh Anh')).toBe('NA');
    expect(getUserInitials('Admin')).toBe('AD');
    expect(getUserInitials('   ')).toBe('OH');
  });
});
