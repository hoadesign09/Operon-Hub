export interface OrgDepartmentMember {
  id: number;
  employeeCode: string;
  fullName: string;
  workEmail: string;
  phone: string | null;
  positionName: string;
  positionNameEn: string | null;
  positionLevel: number;
  employmentStatus: string;
  isDepartmentManager: boolean;
}

export interface OrgDepartmentNode {
  id: number;
  branchId: number;
  parentId: number | null;
  code: string;
  name: string;
  nameEn?: string | null;
  description: string | null;
  managerEmployeeId?: number | null;
  managerName?: string | null;
  managerCode?: string | null;
  managerPosition?: string | null;
  managerPositionEn?: string | null;
  managerEmail?: string | null;
  employeeCount?: number;
  totalEmployeeCount?: number;
  members?: OrgDepartmentMember[];
  sortOrder: number;
  isActive: boolean;
  children: OrgDepartmentNode[];
}

export interface BranchOrgTreeData {
  branchId: number;
  branchCode: string;
  branchName: string;
  branchNameEn?: string | null;
  isHeadquarters: boolean;
  totalDepartments?: number;
  totalEmployees?: number;
  departments: OrgDepartmentNode[];
}

export type OrgChartViewMode = 'vertical' | 'horizontal' | 'cards' | 'columns' | 'compact';

export interface OrgDepthTheme {
  topBar: string;
  badgeBg: string;
  avatarBg: string;
  ringHover: string;
  dot: string;
}

const DEPTH_THEMES: readonly OrgDepthTheme[] = [
  {
    topBar: 'bg-gradient-to-r from-slate-900 via-blue-800 to-indigo-700',
    badgeBg: 'bg-indigo-50 text-indigo-700 ring-indigo-200/80',
    avatarBg: 'from-slate-800 to-indigo-700',
    ringHover: 'hover:border-indigo-400 hover:shadow-indigo-100/70',
    dot: 'bg-indigo-600',
  },
  {
    topBar: 'bg-gradient-to-r from-blue-600 to-cyan-500',
    badgeBg: 'bg-blue-50 text-blue-700 ring-blue-200/80',
    avatarBg: 'from-blue-600 to-cyan-500',
    ringHover: 'hover:border-blue-400 hover:shadow-blue-100/70',
    dot: 'bg-blue-500',
  },
  {
    topBar: 'bg-gradient-to-r from-teal-500 to-emerald-500',
    badgeBg: 'bg-teal-50 text-teal-700 ring-teal-200/80',
    avatarBg: 'from-teal-600 to-emerald-500',
    ringHover: 'hover:border-teal-400 hover:shadow-teal-100/70',
    dot: 'bg-teal-500',
  },
  {
    topBar: 'bg-gradient-to-r from-violet-500 to-purple-500',
    badgeBg: 'bg-violet-50 text-violet-700 ring-violet-200/80',
    avatarBg: 'from-violet-600 to-purple-500',
    ringHover: 'hover:border-violet-400 hover:shadow-violet-100/70',
    dot: 'bg-violet-500',
  },
];

export function getOrgDepthTheme(depth: number): OrgDepthTheme {
  const safeIdx = Math.max(0, Math.min(depth, DEPTH_THEMES.length - 1));
  return DEPTH_THEMES[safeIdx]!;
}
