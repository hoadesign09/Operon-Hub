import type { PortalModuleDefinition, PortalNavItem } from '@/modules/registry';
import { DEFAULT_LOCALE, type AppLocale } from '@/shared/i18n/config';
import { translateApp, type TranslationKey } from '@/shared/i18n/translator';

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

const NAV_HREF_TRANSLATION_KEYS: Record<string, TranslationKey> = {
  '/dashboard': 'nav.item.dashboard',
  '/my/profile': 'nav.item.myProfile',
  '/my/requests': 'nav.item.myRequests',
  '/my/attendance': 'nav.item.myAttendance',
  '/my/payslips': 'nav.item.myPayslips',
  '/my/assets': 'nav.item.myAssets',
  '/approvals': 'nav.item.approvals',
  '/settings/branches': 'nav.item.settingsBranches',
  '/settings/users-roles': 'nav.item.settingsUsersRoles',
  '/settings/workflows': 'nav.item.settingsWorkflows',
  '/settings/audit-logs': 'nav.item.settingsAuditLogs',
  '/hrm/organization': 'nav.item.hrmOrganization',
  '/hrm/employees': 'nav.item.hrmEmployees',
  '/hrm/contracts': 'nav.item.hrmContracts',
  '/hrm/requests': 'nav.item.hrmRequests',
  '/hrm/attendance': 'nav.item.hrmAttendance',
  '/hrm/payroll': 'nav.item.hrmPayroll',
  '/hrm/office/assets': 'nav.item.hrmOfficeAssets',
  '/hrm/office/meeting-rooms': 'nav.item.hrmOfficeMeetingRooms',
  '/hrm/office/announcements': 'nav.item.hrmOfficeAnnouncements',
};

function localizeNavItems(
  items: readonly PortalNavItem[],
  locale: AppLocale,
): PortalNavItem[] {
  return items.map((item) => {
    const key = NAV_HREF_TRANSLATION_KEYS[item.href];
    return {
      ...item,
      label: key ? translateApp(locale, key) : item.label,
    };
  });
}

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

export function buildDualRailGroups(
  modules: readonly PortalModuleDefinition[],
  locale: AppLocale = DEFAULT_LOCALE,
): PortalRailGroup[] {
  const coreModule = modules.find((m) => m.code === 'core');
  const hrmModule = modules.find((m) => m.code === 'hrm');
  const crmModule = modules.find((m) => m.code === 'crm');

  const coreItems = coreModule?.navItems ?? [];
  const personalAndApprovalItems: PortalNavItem[] = localizeNavItems(
    [
      { label: translateApp(locale, 'nav.item.dashboard'), href: '/dashboard' },
      ...coreItems.filter(
        (item) => item.href.startsWith('/my/') || item.href.startsWith('/approvals'),
      ),
    ],
    locale,
  );

  const adminItems = localizeNavItems(
    coreItems.filter((item) => item.href.startsWith('/settings/')),
    locale,
  );
  const hrmItems = localizeNavItems(hrmModule?.navItems ?? [], locale);

  const groups: PortalRailGroup[] = [
    {
      key: 'workspace',
      shortLabel: translateApp(locale, 'nav.rail.workspace.short'),
      title: translateApp(locale, 'nav.rail.workspace.title'),
      subtitle: translateApp(locale, 'nav.rail.workspace.subtitle'),
      items: personalAndApprovalItems,
    },
  ];

  if (hrmItems.length > 0) {
    groups.push({
      key: 'hrm',
      shortLabel: translateApp(locale, 'nav.rail.hrm.short'),
      title: translateApp(locale, 'nav.rail.hrm.title'),
      subtitle: translateApp(locale, 'nav.rail.hrm.subtitle'),
      items: hrmItems,
    });
  }

  if (adminItems.length > 0) {
    groups.push({
      key: 'admin',
      shortLabel: translateApp(locale, 'nav.rail.admin.short'),
      title: translateApp(locale, 'nav.rail.admin.title'),
      subtitle: translateApp(locale, 'nav.rail.admin.subtitle'),
      items: adminItems,
    });
  }

  if (crmModule) {
    groups.push({
      key: 'crm',
      shortLabel: translateApp(locale, 'nav.rail.crm.short'),
      title: translateApp(locale, 'nav.rail.crm.title'),
      subtitle: translateApp(locale, 'nav.rail.crm.subtitle'),
      isComingSoon: crmModule.status === 'COMING_SOON',
      items: localizeNavItems(crmModule.navItems, locale),
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
  locale: AppLocale = DEFAULT_LOCALE,
): { groupTitle: string; itemLabel: string } {
  for (const group of groups) {
    for (const item of group.items) {
      if (
        pathname === item.href ||
        (item.href !== '/dashboard' && pathname.startsWith(`${item.href}/`))
      ) {
        return { groupTitle: group.title, itemLabel: item.label };
      }
    }
  }
  return {
    groupTitle: 'Operon Hub',
    itemLabel: translateApp(locale, 'app.portalTagline'),
  };
}
