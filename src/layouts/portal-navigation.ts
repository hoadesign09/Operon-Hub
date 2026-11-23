import type { PortalModuleDefinition, PortalNavItem } from '@/modules/registry';

export type PortalRailKey = 'workspace' | 'hrm' | 'admin' | 'crm';

export interface PortalRailGroup {
  key: PortalRailKey;
  shortLabel: string;
  title: string;
  subtitle: string;
  isComingSoon?: boolean;
  items: PortalNavItem[];
}

const WORKSPACE_PREFIXES = ['/dashboard', '/my/', '/approvals'] as const;
const ADMIN_PREFIXES = ['/settings/'] as const;
const HRM_PREFIXES = ['/hrm/'] as const;
const CRM_PREFIXES = ['/crm'] as const;

export function resolveActiveRailKey(pathname: string): PortalRailKey {
  if (HRM_PREFIXES.some((prefix) => pathname === '/hrm' || pathname.startsWith(prefix))) {
    return 'hrm';
  }
  if (ADMIN_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return 'admin';
  }
  if (CRM_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return 'crm';
  }
  if (WORKSPACE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix))) {
    return 'workspace';
  }
  return 'workspace';
}

export function buildDualRailGroups(modules: readonly PortalModuleDefinition[]): PortalRailGroup[] {
  const coreModule = modules.find((m) => m.code === 'core');
  const hrmModule = modules.find((m) => m.code === 'hrm');
  const crmModule = modules.find((m) => m.code === 'crm');

  const coreItems = coreModule?.navItems ?? [];
  const personalAndApprovalItems: PortalNavItem[] = [
    { label: 'Tổng quan Portal', href: '/dashboard' },
    ...coreItems.filter(
      (item) => item.href.startsWith('/my/') || item.href.startsWith('/approvals'),
    ),
  ];

  const adminItems = coreItems.filter((item) => item.href.startsWith('/settings/'));
  const hrmItems = hrmModule?.navItems ?? [];

  const groups: PortalRailGroup[] = [
    {
      key: 'workspace',
      shortLabel: 'Tổng',
      title: 'Điều hành & Cá nhân',
      subtitle: 'Tổng quan, tự phục vụ (ESS) & phê duyệt',
      items: personalAndApprovalItems,
    },
  ];

  if (hrmItems.length > 0) {
    groups.push({
      key: 'hrm',
      shortLabel: 'HRM',
      title: 'Hành chính Nhân sự',
      subtitle: 'Tổ chức, nhân viên, công, lương & văn phòng',
      items: hrmItems,
    });
  }

  if (adminItems.length > 0) {
    groups.push({
      key: 'admin',
      shortLabel: 'Core',
      title: 'Quản trị Hệ thống',
      subtitle: 'Chi nhánh, RBAC, luồng duyệt & kiểm toán',
      items: adminItems,
    });
  }

  if (crmModule) {
    groups.push({
      key: 'crm',
      shortLabel: 'CRM',
      title: crmModule.name,
      subtitle: 'Phân hệ mở rộng Giai đoạn 2',
      isComingSoon: crmModule.status === 'COMING_SOON',
      items: crmModule.navItems,
    });
  }

  return groups;
}

export function getUserInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return 'OH';
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
}

export function resolvePageContextLabel(
  pathname: string,
  groups: readonly PortalRailGroup[],
): { groupTitle: string; itemLabel: string } {
  for (const group of groups) {
    for (const item of group.items) {
      if (pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(`${item.href}/`))) {
        return { groupTitle: group.title, itemLabel: item.label };
      }
    }
  }
  return { groupTitle: 'Operon Hub', itemLabel: 'Cổng Vận hành Doanh nghiệp' };
}
