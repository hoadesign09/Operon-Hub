export type PortalModuleStatus = 'ACTIVE' | 'COMING_SOON' | 'DISABLED';

export interface PortalNavItem {
  label: string;
  href: string;
  requiredPermission?: string;
}

export interface PortalModuleDefinition {
  code: string;
  name: string;
  description: string;
  basePath: string;
  status: PortalModuleStatus;
  order: number;
  navItems: PortalNavItem[];
}

export const PORTAL_MODULES: readonly PortalModuleDefinition[] = [
  {
    code: 'core',
    name: 'Nền tảng Hệ thống',
    description: 'Quản trị chi nhánh, người dùng, phân quyền RBAC, luồng duyệt và thông báo.',
    basePath: '/settings/branches',
    status: 'ACTIVE',
    order: 1,
    navItems: [
      {
        label: 'Hồ sơ của tôi',
        href: '/my/profile',
      },
      {
        label: 'Đơn từ của tôi',
        href: '/my/requests',
      },
      {
        label: 'Chấm công của tôi',
        href: '/my/attendance',
      },
      {
        label: 'Phiếu lương của tôi',
        href: '/my/payslips',
      },
      {
        label: 'Tài sản của tôi',
        href: '/my/assets',
      },
      {
        label: 'Hộp thư Phê duyệt',
        href: '/approvals',
        requiredPermission: 'core.approvals.read',
      },
      {
        label: 'Chi nhánh',
        href: '/settings/branches',
        requiredPermission: 'core.branches.read',
      },
      {
        label: 'Người dùng & Phân quyền',
        href: '/settings/users-roles',
        requiredPermission: 'core.users.read',
      },
      {
        label: 'Luồng phê duyệt',
        href: '/settings/workflows',
        requiredPermission: 'core.approvals.workflow_manage',
      },
      {
        label: 'Nhật ký hệ thống',
        href: '/settings/audit-logs',
        requiredPermission: 'core.audit_logs.read',
      },
    ],
  },
  {
    code: 'hrm',
    name: 'Hành chính Nhân sự (HRM)',
    description: 'Cơ cấu tổ chức, hồ sơ NV, hợp đồng, nghỉ phép, chấm công, tính lương và hành chính văn phòng.',
    basePath: '/hrm/organization',
    status: 'ACTIVE',
    order: 2,
    navItems: [
      {
        label: 'Cơ cấu tổ chức',
        href: '/hrm/organization',
        requiredPermission: 'hrm.org.read',
      },
      {
        label: 'Hồ sơ Nhân viên',
        href: '/hrm/employees',
        requiredPermission: 'hrm.employees.read',
      },
      {
        label: 'Hợp đồng lao động',
        href: '/hrm/contracts',
        requiredPermission: 'hrm.contracts.read',
      },
      {
        label: 'Nghỉ phép & Đơn từ',
        href: '/hrm/requests',
        requiredPermission: 'hrm.requests.read',
      },
      {
        label: 'Chấm công & Ca làm',
        href: '/hrm/attendance',
        requiredPermission: 'hrm.attendance.read',
      },
      {
        label: 'Tính lương & Phiếu lương',
        href: '/hrm/payroll',
        requiredPermission: 'hrm.payroll.read',
      },
      {
        label: 'Kho tài sản & Thiết bị',
        href: '/hrm/office/assets',
        requiredPermission: 'hrm.assets.read',
      },
      {
        label: 'Đặt phòng họp',
        href: '/hrm/office/meeting-rooms',
        requiredPermission: 'hrm.rooms.read',
      },
      {
        label: 'Thông báo nội bộ',
        href: '/hrm/office/announcements',
        requiredPermission: 'hrm.announcements.read',
      },
    ],
  },
  {
    code: 'crm',
    name: 'Quan hệ Khách hàng (CRM)',
    description: 'Quản lý khách hàng, cơ hội bán hàng, báo giá và hợp đồng kinh doanh (Giai đoạn 2).',
    basePath: '/crm',
    status: 'COMING_SOON',
    order: 3,
    navItems: [],
  },
] as const;

export function getVisibleModules(includeComingSoon: boolean = true): PortalModuleDefinition[] {
  return [...PORTAL_MODULES]
    .filter((mod) => {
      if (mod.status === 'DISABLED') {
        return false;
      }
      if (!includeComingSoon && mod.status === 'COMING_SOON') {
        return false;
      }
      return true;
    })
    .sort((a, b) => a.order - b.order);
}

export function getAuthorizedModules(
  permissions: readonly string[],
  isSuperAdmin: boolean = false,
): PortalModuleDefinition[] {
  const permSet = new Set(permissions);
  return getVisibleModules(true)
    .map((mod) => ({
      ...mod,
      navItems: mod.navItems.filter(
        (item) =>
          isSuperAdmin ||
          !item.requiredPermission ||
          permSet.has(item.requiredPermission),
      ),
    }))
    .filter((mod) => mod.status === 'COMING_SOON' || mod.navItems.length > 0 || isSuperAdmin);
}

export function getModuleByCode(code: string): PortalModuleDefinition | undefined {
  return PORTAL_MODULES.find((mod) => mod.code === code);
}
