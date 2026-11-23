import { getDb } from '@/config/database';
import { collectDescendantIds } from '@/lib/portable/tree-utils';
import type { AuthContext } from '@/modules/auth/auth.service';

export interface EmployeeAccessScope {
  mode: 'ALL' | 'BRANCH' | 'DEPARTMENT' | 'OWN';
  branchIds: number[];
  departmentIds: number[];
  selfEmployeeId: number | null;
}

const SENSITIVE_VIEWER_ROLES = new Set([
  'SUPER_ADMIN',
  'EXECUTIVE',
  'HR_MANAGER',
  'HR_STAFF',
  'PAYROLL_ACCOUNTANT',
]);

export function canViewSensitiveEmployeeFields(
  auth: Pick<AuthContext, 'isSuperAdmin' | 'roles' | 'permissions' | 'userId'>,
  targetUserId: number | null,
): boolean {
  if (auth.isSuperAdmin) {
    return true;
  }
  if (targetUserId !== null && targetUserId === auth.userId) {
    return true;
  }
  if (auth.permissions.includes('hrm.employees.update')) {
    return true;
  }
  return auth.roles.some((role) => SENSITIVE_VIEWER_ROLES.has(role.code));
}

export async function resolveEmployeeAccessScope(
  auth: AuthContext,
): Promise<EmployeeAccessScope> {
  if (auth.isSuperAdmin || auth.dataScope === 'ALL') {
    return {
      mode: 'ALL',
      branchIds: auth.branchIds,
      departmentIds: [],
      selfEmployeeId: null,
    };
  }

  if (auth.dataScope === 'BRANCH') {
    return {
      mode: 'BRANCH',
      branchIds: auth.branchIds,
      departmentIds: [],
      selfEmployeeId: null,
    };
  }

  const db = getDb();
  const selfEmployee = await db
    .selectFrom('employees')
    .select(['id', 'branch_id', 'department_id'])
    .where('user_id', '=', auth.userId)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  const selfEmployeeId = selfEmployee ? Number(selfEmployee.id) : null;

  if (auth.dataScope === 'OWN') {
    return {
      mode: 'OWN',
      branchIds: [],
      departmentIds: [],
      selfEmployeeId,
    };
  }

  // DEPARTMENT scope: include actor's own department + departments they manage + all descendant departments
  if (!selfEmployeeId) {
    return {
      mode: 'DEPARTMENT',
      branchIds: [],
      departmentIds: [],
      selfEmployeeId: null,
    };
  }

  const allDepartments = await db
    .selectFrom('departments')
    .select(['id', 'parent_id', 'manager_employee_id'])
    .where('deleted_at', 'is', null)
    .execute();

  const flatNodes = allDepartments.map((d) => ({
    id: Number(d.id),
    parentId: d.parent_id !== null ? Number(d.parent_id) : null,
  }));

  const rootDepartmentIds = new Set<number>();
  if (selfEmployee) {
    rootDepartmentIds.add(Number(selfEmployee.department_id));
  }
  for (const dept of allDepartments) {
    if (dept.manager_employee_id !== null && Number(dept.manager_employee_id) === selfEmployeeId) {
      rootDepartmentIds.add(Number(dept.id));
    }
  }

  const allowedDepartmentIds = new Set<number>();
  for (const rootId of rootDepartmentIds) {
    allowedDepartmentIds.add(rootId);
    for (const descendantId of collectDescendantIds(flatNodes, rootId)) {
      allowedDepartmentIds.add(Number(descendantId));
    }
  }

  return {
    mode: 'DEPARTMENT',
    branchIds: auth.branchIds,
    departmentIds: Array.from(allowedDepartmentIds),
    selfEmployeeId,
  };
}

export function isEmployeeWithinScope(
  scope: EmployeeAccessScope,
  employee: { id: number; branchId: number; departmentId: number; userId: number | null },
  actorUserId: number,
): boolean {
  if (scope.mode === 'ALL') {
    return true;
  }
  if (scope.mode === 'BRANCH') {
    return scope.branchIds.includes(employee.branchId);
  }
  if (scope.mode === 'DEPARTMENT') {
    if (scope.selfEmployeeId !== null && employee.id === scope.selfEmployeeId) {
      return true;
    }
    return scope.departmentIds.includes(employee.departmentId);
  }
  return employee.userId !== null && employee.userId === actorUserId;
}
