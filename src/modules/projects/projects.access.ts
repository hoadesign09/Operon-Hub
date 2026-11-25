import {
  getDb,
  type ProjectMemberRole,
  type ProjectStatus,
  type ProjectVisibility,
} from '@/config/database';
import { hasRequiredPermission, type AuthContext } from '@/modules/auth/auth.service';
import {
  ALLOWED_PROJECT_STATUS_TRANSITIONS,
  PROJECT_ADMIN_ROLES,
  PROJECT_CONTRIBUTOR_ROLES,
} from '@/modules/projects/projects.constants';
import { AppError } from '@/shared/api-response';

export interface ProjectAccessRecord {
  id: number;
  code: string;
  name: string;
  branchId: number;
  departmentId: number | null;
  visibility: ProjectVisibility;
  status: ProjectStatus;
  ownerEmployeeId: number;
  managerEmployeeId: number;
}

export interface ProjectAccessContext {
  project: ProjectAccessRecord;
  employeeId: number | null;
  employeeBranchId: number | null;
  employeeDepartmentId: number | null;
  projectRole: ProjectMemberRole | null;
  isGlobalPmAdmin: boolean;
  canView: boolean;
  canEditProject: boolean;
  canManageMembers: boolean;
  canManageWorkflow: boolean;
  canCreateTasks: boolean;
  canEditTasks: boolean;
  canViewBudget: boolean;
  canArchive: boolean;
}

/**
 * Pure helper validating project lifecycle transitions against the blueprint state machine.
 */
export function isAllowedProjectStatusTransition(
  currentStatus: ProjectStatus,
  targetStatus: ProjectStatus,
): boolean {
  if (currentStatus === targetStatus) {
    return true;
  }
  return ALLOWED_PROJECT_STATUS_TRANSITIONS[currentStatus]?.includes(targetStatus) ?? false;
}

/**
 * Pure helper evaluating 2-tier visibility & capabilities without DB dependencies.
 */
export function evaluateProjectCapabilities(params: {
  isSuperAdmin: boolean;
  isExecutive: boolean;
  hasManagePerm: boolean;
  hasBudgetReadPerm: boolean;
  hasTaskCreatePerm: boolean;
  hasTaskUpdatePerm: boolean;
  dataScope: AuthContext['dataScope'];
  userBranchIds: readonly number[];
  employeeBranchId: number | null;
  employeeDepartmentId: number | null;
  project: Pick<ProjectAccessRecord, 'branchId' | 'departmentId' | 'visibility' | 'status'>;
  projectRole: ProjectMemberRole | null;
}): Omit<
  ProjectAccessContext,
  'project' | 'employeeId' | 'employeeBranchId' | 'employeeDepartmentId' | 'projectRole'
> {
  const isGlobalPmAdmin =
    params.isSuperAdmin ||
    (params.hasManagePerm &&
      (params.dataScope === 'ALL' ||
        (params.dataScope === 'BRANCH' &&
          (params.userBranchIds.includes(params.project.branchId) ||
            params.employeeBranchId === params.project.branchId))));

  const isMember = params.projectRole !== null;
  const isProjectAdmin =
    isGlobalPmAdmin ||
    (params.projectRole !== null && PROJECT_ADMIN_ROLES.includes(params.projectRole));
  const isContributor =
    isGlobalPmAdmin ||
    (params.projectRole !== null && PROJECT_CONTRIBUTOR_ROLES.includes(params.projectRole));

  let canView = isGlobalPmAdmin || isMember || params.isExecutive;
  if (!canView) {
    if (params.project.visibility === 'PUBLIC_COMPANY') {
      canView = true;
    } else if (params.project.visibility === 'BRANCH') {
      canView =
        params.employeeBranchId === params.project.branchId ||
        params.userBranchIds.includes(params.project.branchId);
    } else if (params.project.visibility === 'DEPARTMENT') {
      canView =
        params.project.departmentId !== null &&
        params.employeeDepartmentId === params.project.departmentId;
    }
  }

  const isArchived = params.project.status === 'ARCHIVED';

  return {
    isGlobalPmAdmin,
    canView,
    canEditProject: isProjectAdmin && !isArchived,
    canManageMembers: isProjectAdmin && !isArchived,
    canManageWorkflow: isProjectAdmin && !isArchived,
    canCreateTasks: !isArchived && (isContributor || (canView && params.isSuperAdmin)) && (params.hasTaskCreatePerm || isProjectAdmin),
    canEditTasks: !isArchived && isContributor && (params.hasTaskUpdatePerm || isProjectAdmin),
    canViewBudget: isProjectAdmin || params.hasBudgetReadPerm || params.isExecutive,
    canArchive: isGlobalPmAdmin || params.projectRole === 'PROJECT_OWNER',
  };
}

export async function resolveEmployeeForUser(userId: number): Promise<{
  id: number;
  branchId: number;
  departmentId: number | null;
  fullName: string;
  managerEmployeeId: number | null;
} | null> {
  const db = getDb();
  const row = await db
    .selectFrom('employees')
    .select(['id', 'branch_id', 'department_id', 'full_name', 'manager_id'])
    .where('user_id', '=', userId)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (!row) {
    return null;
  }

  return {
    id: Number(row.id),
    branchId: Number(row.branch_id),
    departmentId: row.department_id !== null ? Number(row.department_id) : null,
    fullName: row.full_name,
    managerEmployeeId: row.manager_id !== null ? Number(row.manager_id) : null,
  };
}

export async function resolveProjectByIdOrCode(idOrCode: string | number): Promise<ProjectAccessRecord | null> {
  const db = getDb();
  const raw = String(idOrCode).trim();
  if (!raw) {
    return null;
  }

  const isNumeric = /^\d+$/.test(raw);
  let query = db
    .selectFrom('projects')
    .select([
      'id',
      'code',
      'name',
      'branch_id',
      'department_id',
      'visibility',
      'status',
      'owner_employee_id',
      'manager_employee_id',
    ])
    .where('deleted_at', 'is', null);

  if (isNumeric) {
    query = query.where('id', '=', Number(raw));
  } else {
    query = query.where('code', '=', raw.toUpperCase());
  }

  const row = await query.executeTakeFirst();
  if (!row) {
    return null;
  }

  return {
    id: Number(row.id),
    code: row.code,
    name: row.name,
    branchId: Number(row.branch_id),
    departmentId: row.department_id !== null ? Number(row.department_id) : null,
    visibility: row.visibility,
    status: row.status,
    ownerEmployeeId: Number(row.owner_employee_id),
    managerEmployeeId: Number(row.manager_employee_id),
  };
}

export async function assertProjectAccess(
  auth: AuthContext,
  idOrCode: string | number,
  requirement: 'VIEW' | 'CONTRIBUTE' | 'MANAGE' | 'ARCHIVE' = 'VIEW',
): Promise<ProjectAccessContext> {
  const project = await resolveProjectByIdOrCode(idOrCode);
  if (!project) {
    throw new AppError('PROJECT_NOT_FOUND', 'Không tìm thấy dự án yêu cầu.', 404);
  }

  const employee = await resolveEmployeeForUser(auth.userId);
  const db = getDb();

  let projectRole: ProjectMemberRole | null = null;
  if (employee) {
    const memberRow = await db
      .selectFrom('project_members')
      .select(['project_role'])
      .where('project_id', '=', project.id)
      .where('employee_id', '=', employee.id)
      .where('deleted_at', 'is', null)
      .where('left_at', 'is', null)
      .executeTakeFirst();

    if (memberRow) {
      projectRole = memberRow.project_role;
    }
  }

  const isExecutive = auth.roles.some((r) => r.code === 'EXECUTIVE');
  const caps = evaluateProjectCapabilities({
    isSuperAdmin: auth.isSuperAdmin,
    isExecutive,
    hasManagePerm: hasRequiredPermission(auth, 'pm.projects.manage'),
    hasBudgetReadPerm: hasRequiredPermission(auth, 'pm.budget.read'),
    hasTaskCreatePerm: hasRequiredPermission(auth, 'pm.tasks.create'),
    hasTaskUpdatePerm: hasRequiredPermission(auth, 'pm.tasks.update'),
    dataScope: auth.dataScope,
    userBranchIds: auth.branchIds,
    employeeBranchId: employee?.branchId ?? null,
    employeeDepartmentId: employee?.departmentId ?? null,
    project,
    projectRole,
  });

  if (!caps.canView) {
    throw new AppError(
      'PROJECT_ACCESS_DENIED',
      'Bạn không có quyền xem dự án này (dự án thuộc phạm vi giới hạn).',
      403,
    );
  }

  if (requirement === 'CONTRIBUTE' && !caps.canEditTasks) {
    throw new AppError(
      'PROJECT_CONTRIBUTE_DENIED',
      'Bạn cần là thành viên thực thi của dự án để tạo hoặc chỉnh sửa công việc.',
      403,
    );
  }

  if (requirement === 'MANAGE' && !caps.canEditProject) {
    throw new AppError(
      'PROJECT_MANAGE_DENIED',
      'Chỉ Chủ dự án (Owner), Quản lý dự án (PM) hoặc PMO mới có quyền quản trị cấu hình dự án.',
      403,
    );
  }

  if (requirement === 'ARCHIVE' && !caps.canArchive) {
    throw new AppError(
      'PROJECT_ARCHIVE_DENIED',
      'Chỉ Chủ dự án hoặc Quản trị PMO mới có quyền lưu trữ / mở lại dự án.',
      403,
    );
  }

  return {
    project,
    employeeId: employee?.id ?? null,
    employeeBranchId: employee?.branchId ?? null,
    employeeDepartmentId: employee?.departmentId ?? null,
    projectRole,
    ...caps,
  };
}
