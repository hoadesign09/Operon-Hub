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
    expect(resolveActiveRailKey('/my/tasks')).toBe('workspace');
    expect(resolveActiveRailKey('/approvals')).toBe('workspace');
    expect(resolveActiveRailKey('/services')).toBe('services');
    expect(resolveActiveRailKey('/services/it-requests')).toBe('services');
    expect(resolveActiveRailKey('/services/car-booking')).toBe('services');
    expect(resolveActiveRailKey('/hrm/office/meeting-rooms')).toBe('services');
    expect(resolveActiveRailKey('/projects')).toBe('projects');
    expect(resolveActiveRailKey('/projects/ERP-2026')).toBe('projects');
    expect(resolveActiveRailKey('/hrm/employees')).toBe('hrm');
    expect(resolveActiveRailKey('/hrm/employees/12')).toBe('hrm');
    expect(resolveActiveRailKey('/settings/branches')).toBe('admin');
    expect(resolveActiveRailKey('/settings/users-roles')).toBe('admin');
    expect(resolveActiveRailKey('/crm')).toBe('crm');
  });

  it('builds 6 rail groups including unified Workplace Services & Projects groups for SUPER_ADMIN', () => {
    const modules = getAuthorizedModules([], true);
    const groups = buildDualRailGroups(modules);

    expect(groups.map((g) => g.key)).toEqual(['workspace', 'services', 'projects', 'hrm', 'admin', 'crm']);
    const workspace = groups.find((g) => g.key === 'workspace');
    const services = groups.find((g) => g.key === 'services');
    const projects = groups.find((g) => g.key === 'projects');
    const hrm = groups.find((g) => g.key === 'hrm');
    const admin = groups.find((g) => g.key === 'admin');
    const crm = groups.find((g) => g.key === 'crm');

    expect(workspace?.items.some((item) => item.href === '/dashboard')).toBe(true);
    expect(workspace?.items.some((item) => item.href === '/my/tasks')).toBe(true);
    expect(workspace?.items.some((item) => item.href === '/approvals')).toBe(true);
    expect(projects?.items.some((item) => item.href === '/projects')).toBe(true);
    expect(projects?.items.some((item) => item.href === '/projects/dashboard')).toBe(true);
    expect(projects?.items.some((item) => item.href === '/projects/workload')).toBe(true);
    expect(projects?.items.some((item) => item.href === '/projects/timesheets')).toBe(true);
    expect(projects?.items.some((item) => item.href === '/projects/templates')).toBe(true);
    expect(services?.items.map((item) => item.href)).toEqual([
      '/services',
      '/hrm/office/meeting-rooms',
      '/services/it-requests',
      '/services/proposals',
      '/services/payments',
      '/services/car-booking',
    ]);
    // Meeting rooms moved into unified services rail (not duplicated in HRM rail)
    expect(hrm?.items.some((item) => item.href === '/hrm/office/meeting-rooms')).toBe(false);
    expect(hrm?.items.length).toBeGreaterThanOrEqual(8);
    expect(admin?.items.length).toBeGreaterThanOrEqual(4);
    expect(crm?.isComingSoon).toBe(true);
  });

  it('hides admin rail group for basic EMPLOYEE while exposing unified services group', () => {
    const modules = getAuthorizedModules(['hrm.rooms.read', 'hrm.announcements.read'], false);
    const groups = buildDualRailGroups(modules);

    expect(groups.some((g) => g.key === 'workspace')).toBe(true);
    expect(groups.some((g) => g.key === 'services')).toBe(true);
    expect(
      groups
        .find((g) => g.key === 'services')
        ?.items.some((item) => item.href === '/hrm/office/meeting-rooms'),
    ).toBe(true);
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
    expect(resolvePageContextLabel('/hrm/office/meeting-rooms', groups)).toEqual({
      groupTitle: 'Dịch vụ & Đề xuất',
      itemLabel: 'Đặt phòng họp',
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

  it('localizes Dual-Rail groups, nav items, and breadcrumbs when locale is set to English', () => {
    const modules = getAuthorizedModules([], true);
    const groupsEn = buildDualRailGroups(modules, 'en');

    expect(groupsEn.find((g) => g.key === 'workspace')?.shortLabel).toBe('Home');
    expect(groupsEn.find((g) => g.key === 'services')?.title).toBe('Workplace Services');
    expect(groupsEn.find((g) => g.key === 'projects')?.title).toBe('Project Management');
    expect(groupsEn.find((g) => g.key === 'hrm')?.title).toBe('Human Resources (HRM)');
    expect(groupsEn.find((g) => g.key === 'admin')?.title).toBe('System Administration');
    expect(resolvePageContextLabel('/projects/ERP-2026', groupsEn, 'en')).toEqual({
      groupTitle: 'Project Management',
      itemLabel: 'Projects Portfolio',
    });
    expect(resolvePageContextLabel('/my/tasks', groupsEn, 'en')).toEqual({
      groupTitle: 'Workspace & Personal',
      itemLabel: 'My Tasks',
    });
    expect(resolvePageContextLabel('/hrm/office/meeting-rooms', groupsEn, 'en')).toEqual({
      groupTitle: 'Workplace Services',
      itemLabel: 'Meeting Rooms',
    });
    expect(resolvePageContextLabel('/services/it-requests', groupsEn, 'en')).toEqual({
      groupTitle: 'Workplace Services',
      itemLabel: 'IT Requests',
    });
    expect(resolvePageContextLabel('/hrm/employees/42', groupsEn, 'en')).toEqual({
      groupTitle: 'Human Resources (HRM)',
      itemLabel: 'Employees 360°',
    });
    expect(resolvePageContextLabel('/settings/workflows', groupsEn, 'en')).toEqual({
      groupTitle: 'System Administration',
      itemLabel: 'Approval Workflows',
    });
  });
});
