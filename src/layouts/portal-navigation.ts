import type { PortalModuleDefinition, PortalNavItem } from '@/modules/registry';
import { DEFAULT_LOCALE, type AppLocale } from '@/shared/i18n/config';
import { translateApp, type TranslationKey } from '@/shared/i18n/translator';

export type PortalRailKey = 'workspace' | 'services' | 'projects' | 'hrm' | 'admin' | 'crm';

export interface PortalRailNavItem extends PortalNavItem {
  isComingSoon?: boolean;
}

export interface PortalRailGroup {
  key: PortalRailKey;
  shortLabel: string;
  title: string;
  subtitle: string;
  isComingSoon?: boolean;
  items: PortalRailNavItem[];
}

const WORKSPACE_PREFIXES = ['/dashboard', '/my/', '/approvals'] as const;
const SERVICES_PREFIXES = ['/services', '/hrm/office/meeting-rooms'] as const;
const PROJECTS_PREFIXES = ['/projects'] as const;
const ADMIN_PREFIXES = ['/settings/'] as const;
const HRM_PREFIXES = ['/hrm/'] as const;
const CRM_PREFIXES = ['/crm'] as const;

const SERVICE_MOVED_HRM_HREFS = new Set<string>(['/hrm/office/meeting-rooms']);

const NAV_HREF_TRANSLATION_KEYS: Record<string, TranslationKey> = {
  '/dashboard': 'nav.item.dashboard',
  '/services': 'nav.item.servicesHub',
  '/services/it-requests': 'nav.item.servicesItRequests',
  '/services/proposals': 'nav.item.servicesProposals',
  '/services/payments': 'nav.item.servicesPayments',
  '/services/car-booking': 'nav.item.servicesCarBooking',
  '/projects/dashboard': 'nav.item.projectsDashboard',
  '/projects': 'nav.item.projectsList',
  '/projects/workload': 'nav.item.projectsWorkload',
  '/projects/timesheets': 'nav.item.projectsTimesheets',
  '/projects/templates': 'nav.item.projectsTemplates',
  '/my/profile': 'nav.item.myProfile',
  '/my/tasks': 'nav.item.myTasks',
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
  items: readonly PortalRailNavItem[],
  locale: AppLocale,
): PortalRailNavItem[] {
  return items.map((item) => {
    const key = NAV_HREF_TRANSLATION_KEYS[item.href];
    return {
      ...item,
      label: key ? translateApp(locale, key) : item.label,
    };
  });
}

export function resolveActiveRailKey(pathname: string): PortalRailKey {
  if (
    SERVICES_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    )
  ) {
    return 'services';
  }
  if (
    PROJECTS_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    )
  ) {
    return 'projects';
  }
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
  permissions?: readonly string[],
  isSuperAdmin: boolean = false,
): PortalRailGroup[] {
  const permSet = permissions ? new Set(permissions) : null;
  const canAccessNavItem = (item: PortalRailNavItem): boolean => {
    if (!permSet || isSuperAdmin || !item.requiredPermission) {
      return true;
    }
    return permSet.has(item.requiredPermission);
  };
  const coreModule = modules.find((m) => m.code === 'core');
  const projectsModule = modules.find((m) => m.code === 'projects');
  const hrmModule = modules.find((m) => m.code === 'hrm');
  const crmModule = modules.find((m) => m.code === 'crm');

  const coreItems = coreModule?.navItems ?? [];
  const personalAndApprovalItems: PortalRailNavItem[] = localizeNavItems(
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

  const allHrmItems = hrmModule?.navItems ?? [];
  const meetingRoomsItem = allHrmItems.find((item) => SERVICE_MOVED_HRM_HREFS.has(item.href));
  const hrmItems = localizeNavItems(
    allHrmItems.filter((item) => !SERVICE_MOVED_HRM_HREFS.has(item.href)),
    locale,
  );

  const serviceItems: PortalRailNavItem[] = localizeNavItems(
    [
      { label: translateApp(locale, 'nav.item.servicesHub'), href: '/services' },
      ...(meetingRoomsItem ? [meetingRoomsItem] : []),
      {
        label: translateApp(locale, 'nav.item.servicesItRequests'),
        href: '/services/it-requests',
        requiredPermission: 'it_requests.read',
      },
      {
        label: translateApp(locale, 'nav.item.servicesProposals'),
        href: '/services/proposals',
        requiredPermission: 'proposals.read',
      },
      {
        label: translateApp(locale, 'nav.item.servicesPayments'),
        href: '/services/payments',
        requiredPermission: 'payments.read',
      },
      {
        label: translateApp(locale, 'nav.item.servicesCarBooking'),
        href: '/services/car-booking',
        isComingSoon: true,
      },
    ].filter(canAccessNavItem),
    locale,
  );

  const groups: PortalRailGroup[] = [
    {
      key: 'workspace',
      shortLabel: translateApp(locale, 'nav.rail.workspace.short'),
      title: translateApp(locale, 'nav.rail.workspace.title'),
      subtitle: translateApp(locale, 'nav.rail.workspace.subtitle'),
      items: personalAndApprovalItems,
    },
    {
      key: 'services',
      shortLabel: translateApp(locale, 'nav.rail.services.short'),
      title: translateApp(locale, 'nav.rail.services.title'),
      subtitle: translateApp(locale, 'nav.rail.services.subtitle'),
      items: serviceItems,
    },
  ];

  const projectItems = localizeNavItems(projectsModule?.navItems ?? [], locale);
  if (projectItems.length > 0) {
    groups.push({
      key: 'projects',
      shortLabel: translateApp(locale, 'nav.rail.projects.short'),
      title: translateApp(locale, 'nav.rail.projects.title'),
      subtitle: translateApp(locale, 'nav.rail.projects.subtitle'),
      items: projectItems,
    });
  }

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
      if (pathname === item.href) {
        return { groupTitle: group.title, itemLabel: item.label };
      }
    }
  }
  for (const group of groups) {
    for (const item of group.items) {
      if (
        item.href !== '/dashboard' &&
        item.href !== '/services' &&
        pathname.startsWith(`${item.href}/`)
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
