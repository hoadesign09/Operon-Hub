import { getDb } from '@/config/database';
import {
  buildPaginationMeta,
  parsePaginationParams,
  type PaginationMeta,
} from '@/lib/portable/pagination';
import { buildTree, wouldCreateCycle, type TreeNode } from '@/lib/portable/tree-utils';
import { recordAuditLog } from '@/modules/audit/audit.service';
import type { AuthContext } from '@/modules/auth/auth.service';
import type {
  CreateDepartmentInput,
  UpdateDepartmentInput,
} from '@/modules/hrm/organization/organization.schema';
import { AppError } from '@/shared/api-response';

export interface DepartmentMemberSummary {
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

export interface DepartmentItem {
  id: number;
  branchId: number;
  branchCode: string;
  branchName: string;
  branchNameEn: string | null;
  parentId: number | null;
  parentName: string | null;
  parentNameEn: string | null;
  code: string;
  name: string;
  nameEn: string | null;
  description: string | null;
  managerEmployeeId: number | null;
  managerName: string | null;
  managerCode: string | null;
  managerPosition: string | null;
  managerPositionEn: string | null;
  managerEmail: string | null;
  employeeCount: number;
  totalEmployeeCount: number;
  members: DepartmentMemberSummary[];
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
}

export interface BranchOrgTree {
  branchId: number;
  branchCode: string;
  branchName: string;
  branchNameEn: string | null;
  isHeadquarters: boolean;
  totalDepartments: number;
  totalEmployees: number;
  departments: TreeNode<DepartmentItem>[];
}

function assertBranchAllowed(auth: AuthContext, branchId: number): void {
  if (auth.hasAllBranches || auth.isSuperAdmin) {
    return;
  }
  if (!auth.branchIds.includes(branchId)) {
    throw new AppError(
      'BRANCH_ACCESS_DENIED',
      'Bạn không có quyền thao tác dữ liệu của chi nhánh này.',
      403,
    );
  }
}

function computeRecursiveEmployeeCounts(nodes: TreeNode<DepartmentItem>[]): number {
  let sum = 0;
  for (const node of nodes) {
    const childTotal = computeRecursiveEmployeeCounts(node.children);
    node.totalEmployeeCount = node.employeeCount + childTotal;
    sum += node.totalEmployeeCount;
  }
  return sum;
}

async function validateManagerEmployee(managerEmployeeId: number | null | undefined): Promise<void> {
  if (!managerEmployeeId) {
    return;
  }
  const db = getDb();
  const emp = await db
    .selectFrom('employees')
    .select(['id'])
    .where('id', '=', managerEmployeeId)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (!emp) {
    throw new AppError(
      'INVALID_MANAGER_EMPLOYEE',
      'Nhân sự trưởng phòng ban được chọn không tồn tại.',
      400,
    );
  }
}

export async function listDepartments(
  auth: AuthContext,
  query: {
    page?: string | null;
    limit?: string | null;
    search?: string | null;
    branchId?: string | null;
    isActive?: string | null;
  },
): Promise<{ items: DepartmentItem[]; meta: PaginationMeta }> {
  const db = getDb();
  const pagination = parsePaginationParams(
    { page: query.page, limit: query.limit },
    { defaultLimit: 50, maxLimit: 200 },
  );

  let baseQuery = db
    .selectFrom('departments as d')
    .innerJoin('branches as b', 'b.id', 'd.branch_id')
    .leftJoin('departments as p', 'p.id', 'd.parent_id')
    .leftJoin('employees as mgr', (join) =>
      join.onRef('mgr.id', '=', 'd.manager_employee_id').on('mgr.deleted_at', 'is', null),
    )
    .leftJoin('positions as mgr_pos', 'mgr_pos.id', 'mgr.position_id')
    .where('d.deleted_at', 'is', null)
    .where('b.deleted_at', 'is', null);

  if (!auth.hasAllBranches && !auth.isSuperAdmin) {
    if (auth.branchIds.length === 0) {
      return { items: [], meta: buildPaginationMeta(0, pagination.page, pagination.limit) };
    }
    baseQuery = baseQuery.where('d.branch_id', 'in', auth.branchIds);
  }

  if (query.branchId) {
    const parsedBranchId = Number(query.branchId);
    if (Number.isInteger(parsedBranchId) && parsedBranchId > 0) {
      assertBranchAllowed(auth, parsedBranchId);
      baseQuery = baseQuery.where('d.branch_id', '=', parsedBranchId);
    }
  }

  if (query.search && query.search.trim().length > 0) {
    const keyword = `%${query.search.trim()}%`;
    baseQuery = baseQuery.where((eb) =>
      eb.or([
        eb('d.code', 'like', keyword),
        eb('d.name', 'like', keyword),
        eb('d.name_en', 'like', keyword),
        eb('mgr.full_name', 'like', keyword),
      ]),
    );
  }

  if (query.isActive === 'true' || query.isActive === '1') {
    baseQuery = baseQuery.where('d.is_active', '=', 1);
  } else if (query.isActive === 'false' || query.isActive === '0') {
    baseQuery = baseQuery.where('d.is_active', '=', 0);
  }

  const countRow = await baseQuery
    .select((eb) => eb.fn.count<number>('d.id').as('total'))
    .executeTakeFirst();
  const total = Number(countRow?.total ?? 0);

  const rows = await baseQuery
    .select([
      'd.id',
      'd.branch_id',
      'b.code as branch_code',
      'b.name as branch_name',
      'b.name_en as branch_name_en',
      'd.parent_id',
      'p.name as parent_name',
      'p.name_en as parent_name_en',
      'd.code',
      'd.name',
      'd.name_en',
      'd.description',
      'd.manager_employee_id',
      'mgr.full_name as manager_name',
      'mgr.employee_code as manager_code',
      'mgr.work_email as manager_email',
      'mgr_pos.name as manager_position',
      'mgr_pos.name_en as manager_position_en',
      'd.sort_order',
      'd.is_active',
      'd.created_at',
    ])
    .orderBy('d.branch_id', 'asc')
    .orderBy('d.sort_order', 'asc')
    .orderBy('d.name', 'asc')
    .limit(pagination.limit)
    .offset(pagination.offset)
    .execute();

  const deptIds = rows.map((row) => Number(row.id));
  const countByDept = new Map<number, number>();
  if (deptIds.length > 0) {
    const empCounts = await db
      .selectFrom('employees')
      .select(['department_id', (eb) => eb.fn.count<number>('id').as('cnt')])
      .where('deleted_at', 'is', null)
      .where('employment_status', 'in', ['PROBATION', 'ACTIVE', 'ON_LEAVE'])
      .where('department_id', 'in', deptIds)
      .groupBy('department_id')
      .execute();

    for (const row of empCounts) {
      countByDept.set(Number(row.department_id), Number(row.cnt));
    }
  }

  const items: DepartmentItem[] = rows.map((row) => {
    const id = Number(row.id);
    const empCount = countByDept.get(id) ?? 0;
    return {
      id,
      branchId: Number(row.branch_id),
      branchCode: row.branch_code,
      branchName: row.branch_name,
      branchNameEn: row.branch_name_en ?? null,
      parentId: row.parent_id !== null ? Number(row.parent_id) : null,
      parentName: row.parent_name ?? null,
      parentNameEn: row.parent_name_en ?? null,
      code: row.code,
      name: row.name,
      nameEn: row.name_en ?? null,
      description: row.description,
      managerEmployeeId: row.manager_employee_id !== null ? Number(row.manager_employee_id) : null,
      managerName: row.manager_name ?? null,
      managerCode: row.manager_code ?? null,
      managerPosition: row.manager_position ?? null,
      managerPositionEn: row.manager_position_en ?? null,
      managerEmail: row.manager_email ?? null,
      employeeCount: empCount,
      totalEmployeeCount: empCount,
      members: [],
      sortOrder: Number(row.sort_order),
      isActive: Boolean(row.is_active),
      createdAt: new Date(row.created_at).toISOString(),
    };
  });

  return {
    items,
    meta: buildPaginationMeta(total, pagination.page, pagination.limit),
  };
}

export async function getOrganizationTree(
  auth: AuthContext,
  query: { branchId?: string | null; includeInactive?: string | null },
): Promise<BranchOrgTree[]> {
  const db = getDb();

  let branchQuery = db
    .selectFrom('branches')
    .select(['id', 'code', 'name', 'name_en', 'is_headquarters'])
    .where('deleted_at', 'is', null)
    .where('is_active', '=', 1)
    .orderBy('is_headquarters', 'desc')
    .orderBy('name', 'asc');

  if (!auth.hasAllBranches && !auth.isSuperAdmin) {
    if (auth.branchIds.length === 0) {
      return [];
    }
    branchQuery = branchQuery.where('id', 'in', auth.branchIds);
  }

  if (query.branchId) {
    const parsedBranchId = Number(query.branchId);
    if (Number.isInteger(parsedBranchId) && parsedBranchId > 0) {
      assertBranchAllowed(auth, parsedBranchId);
      branchQuery = branchQuery.where('id', '=', parsedBranchId);
    }
  }

  const branches = await branchQuery.execute();
  if (branches.length === 0) {
    return [];
  }

  const branchIds = branches.map((b) => Number(b.id));
  let deptQuery = db
    .selectFrom('departments as d')
    .innerJoin('branches as b', 'b.id', 'd.branch_id')
    .leftJoin('departments as p', 'p.id', 'd.parent_id')
    .leftJoin('employees as mgr', (join) =>
      join.onRef('mgr.id', '=', 'd.manager_employee_id').on('mgr.deleted_at', 'is', null),
    )
    .leftJoin('positions as mgr_pos', 'mgr_pos.id', 'mgr.position_id')
    .select([
      'd.id',
      'd.branch_id',
      'b.code as branch_code',
      'b.name as branch_name',
      'b.name_en as branch_name_en',
      'd.parent_id',
      'p.name as parent_name',
      'p.name_en as parent_name_en',
      'd.code',
      'd.name',
      'd.name_en',
      'd.description',
      'd.manager_employee_id',
      'mgr.full_name as manager_name',
      'mgr.employee_code as manager_code',
      'mgr.work_email as manager_email',
      'mgr_pos.name as manager_position',
      'mgr_pos.name_en as manager_position_en',
      'd.sort_order',
      'd.is_active',
      'd.created_at',
    ])
    .where('d.deleted_at', 'is', null)
    .where('d.branch_id', 'in', branchIds)
    .orderBy('d.sort_order', 'asc')
    .orderBy('d.name', 'asc');

  if (query.includeInactive !== 'true') {
    deptQuery = deptQuery.where('d.is_active', '=', 1);
  }

  const [deptRows, empRows] = await Promise.all([
    deptQuery.execute(),
    db
      .selectFrom('employees as e')
      .innerJoin('positions as pos', 'pos.id', 'e.position_id')
      .select([
        'e.id',
        'e.user_id',
        'e.department_id',
        'e.employee_code',
        'e.full_name',
        'e.work_email',
        'e.phone',
        'e.employment_status',
        'pos.name as position_name',
        'pos.name_en as position_name_en',
        'pos.level as position_level',
      ])
      .where('e.deleted_at', 'is', null)
      .where('e.branch_id', 'in', branchIds)
      .where('e.employment_status', 'in', ['PROBATION', 'ACTIVE', 'ON_LEAVE'])
      .orderBy('pos.level', 'desc')
      .orderBy('e.full_name', 'asc')
      .execute(),
  ]);

  const managerIdByDept = new Map<number, number | null>();
  for (const row of deptRows) {
    managerIdByDept.set(
      Number(row.id),
      row.manager_employee_id !== null ? Number(row.manager_employee_id) : null,
    );
  }

  const maskPeerPhones = !auth.isSuperAdmin && auth.dataScope === 'OWN';
  const membersByDept = new Map<number, DepartmentMemberSummary[]>();
  for (const emp of empRows) {
    const deptId = Number(emp.department_id);
    const empId = Number(emp.id);
    const isSelf = emp.user_id !== null && Number(emp.user_id) === auth.userId;
    const list = membersByDept.get(deptId) ?? [];
    list.push({
      id: empId,
      employeeCode: emp.employee_code,
      fullName: emp.full_name,
      workEmail: emp.work_email,
      phone: maskPeerPhones && !isSelf ? null : (emp.phone ?? null),
      positionName: emp.position_name,
      positionNameEn: emp.position_name_en ?? null,
      positionLevel: Number(emp.position_level),
      employmentStatus: emp.employment_status,
      isDepartmentManager: managerIdByDept.get(deptId) === empId,
    });
    membersByDept.set(deptId, list);
  }

  const byBranch = new Map<number, DepartmentItem[]>();

  for (const row of deptRows) {
    const deptId = Number(row.id);
    const bid = Number(row.branch_id);
    const members = membersByDept.get(deptId) ?? [];
    // Sort manager first, then by positionLevel desc
    members.sort((a, b) => {
      if (a.isDepartmentManager !== b.isDepartmentManager) {
        return a.isDepartmentManager ? -1 : 1;
      }
      if (a.positionLevel !== b.positionLevel) {
        return b.positionLevel - a.positionLevel;
      }
      return a.fullName.localeCompare(b.fullName);
    });

    // If manager_employee_id isn't explicitly set, infer lead display only from explicit manager_employee_id
    const list = byBranch.get(bid) ?? [];
    list.push({
      id: deptId,
      branchId: bid,
      branchCode: row.branch_code,
      branchName: row.branch_name,
      branchNameEn: row.branch_name_en ?? null,
      parentId: row.parent_id !== null ? Number(row.parent_id) : null,
      parentName: row.parent_name ?? null,
      parentNameEn: row.parent_name_en ?? null,
      code: row.code,
      name: row.name,
      nameEn: row.name_en ?? null,
      description: row.description,
      managerEmployeeId: row.manager_employee_id !== null ? Number(row.manager_employee_id) : null,
      managerName: row.manager_name ?? null,
      managerCode: row.manager_code ?? null,
      managerPosition: row.manager_position ?? null,
      managerPositionEn: row.manager_position_en ?? null,
      managerEmail: row.manager_email ?? null,
      employeeCount: members.length,
      totalEmployeeCount: members.length,
      members,
      sortOrder: Number(row.sort_order),
      isActive: Boolean(row.is_active),
      createdAt: new Date(row.created_at).toISOString(),
    });
    byBranch.set(bid, list);
  }

  return branches.map((branch) => {
    const bid = Number(branch.id);
    const flatDepts = byBranch.get(bid) ?? [];
    const tree = buildTree(flatDepts);
    const totalEmployees = computeRecursiveEmployeeCounts(tree);
    return {
      branchId: bid,
      branchCode: branch.code,
      branchName: branch.name,
      branchNameEn: branch.name_en ?? null,
      isHeadquarters: Boolean(branch.is_headquarters),
      totalDepartments: flatDepts.length,
      totalEmployees,
      departments: tree,
    };
  });
}

async function validateBranchAndParent(
  branchId: number,
  parentId: number | null | undefined,
  currentDeptId?: number,
): Promise<void> {
  const db = getDb();

  const branch = await db
    .selectFrom('branches')
    .select(['id'])
    .where('id', '=', branchId)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (!branch) {
    throw new AppError('INVALID_BRANCH', 'Chi nhánh được chọn không tồn tại.', 400);
  }

  if (!parentId) {
    return;
  }

  const parent = await db
    .selectFrom('departments')
    .select(['id', 'branch_id'])
    .where('id', '=', parentId)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (!parent) {
    throw new AppError('INVALID_PARENT_DEPARTMENT', 'Phòng ban cha không tồn tại.', 400);
  }

  if (Number(parent.branch_id) !== branchId) {
    throw new AppError(
      'PARENT_BRANCH_MISMATCH',
      'Phòng ban cha bắt buộc phải thuộc cùng một chi nhánh.',
      400,
    );
  }

  if (currentDeptId !== undefined) {
    const branchDepts = await db
      .selectFrom('departments')
      .select(['id', 'parent_id'])
      .where('branch_id', '=', branchId)
      .where('deleted_at', 'is', null)
      .execute();

    const flatItems = branchDepts.map((d) => ({
      id: Number(d.id),
      parentId: d.parent_id !== null ? Number(d.parent_id) : null,
    }));

    if (wouldCreateCycle(flatItems, currentDeptId, parentId)) {
      throw new AppError(
        'DEPARTMENT_CYCLE_DETECTED',
        'Không thể chọn phòng ban cha gây vòng lặp phân cấp.',
        400,
      );
    }
  }
}

export async function createDepartment(
  auth: AuthContext,
  input: CreateDepartmentInput,
  ipAddress: string | null,
): Promise<DepartmentItem> {
  assertBranchAllowed(auth, input.branchId);
  const db = getDb();

  const duplicate = await db
    .selectFrom('departments')
    .select(['id'])
    .where('code', '=', input.code)
    .executeTakeFirst();

  if (duplicate) {
    throw new AppError(
      'DEPARTMENT_CODE_EXISTS',
      `Mã phòng ban "${input.code}" đã tồn tại.`,
      409,
    );
  }

  await validateBranchAndParent(input.branchId, input.parentId);
  await validateManagerEmployee(input.managerEmployeeId);

  const inserted = await db
    .insertInto('departments')
    .values({
      branch_id: input.branchId,
      parent_id: input.parentId ?? null,
      manager_employee_id: input.managerEmployeeId ?? null,
      code: input.code,
      name: input.name,
      name_en: input.nameEn?.trim() || null,
      description: input.description ?? null,
      sort_order: input.sortOrder,
      is_active: input.isActive ? 1 : 0,
      created_by: auth.userId,
      updated_by: auth.userId,
    })
    .executeTakeFirstOrThrow();

  const createdId = Number(inserted.insertId);
  await recordAuditLog({
    userId: auth.userId,
    moduleCode: 'hrm',
    action: 'HRM_DEPARTMENT_CREATE',
    entityType: 'departments',
    entityId: createdId,
    newValues: {
      code: input.code,
      name: input.name,
      branchId: input.branchId,
      managerEmployeeId: input.managerEmployeeId ?? null,
    },
    ipAddress,
  });

  const list = await listDepartments(auth, { page: '1', limit: '200', branchId: String(input.branchId) });
  const createdItem = list.items.find((d) => d.id === createdId);
  if (!createdItem) {
    throw new AppError('DEPARTMENT_NOT_FOUND', 'Không thể đọc lại phòng ban vừa tạo.', 500);
  }
  return createdItem;
}

export async function updateDepartment(
  auth: AuthContext,
  departmentId: number,
  input: UpdateDepartmentInput,
  ipAddress: string | null,
): Promise<DepartmentItem> {
  const db = getDb();

  const existing = await db
    .selectFrom('departments')
    .select([
      'id',
      'branch_id',
      'parent_id',
      'manager_employee_id',
      'code',
      'name',
      'name_en',
      'description',
      'sort_order',
      'is_active',
    ])
    .where('id', '=', departmentId)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (!existing) {
    throw new AppError('DEPARTMENT_NOT_FOUND', 'Không tìm thấy phòng ban.', 404);
  }

  const nextBranchId = input.branchId ?? Number(existing.branch_id);
  assertBranchAllowed(auth, Number(existing.branch_id));
  assertBranchAllowed(auth, nextBranchId);

  if (input.code && input.code !== existing.code) {
    const duplicate = await db
      .selectFrom('departments')
      .select(['id'])
      .where('code', '=', input.code)
      .where('id', '!=', departmentId)
      .executeTakeFirst();
    if (duplicate) {
      throw new AppError(
        'DEPARTMENT_CODE_EXISTS',
        `Mã phòng ban "${input.code}" đã tồn tại.`,
        409,
      );
    }
  }

  const nextParentId =
    input.parentId !== undefined
      ? input.parentId
      : existing.parent_id !== null
        ? Number(existing.parent_id)
        : null;

  const nextManagerEmployeeId =
    input.managerEmployeeId !== undefined
      ? input.managerEmployeeId
      : existing.manager_employee_id !== null
        ? Number(existing.manager_employee_id)
        : null;

  await validateBranchAndParent(nextBranchId, nextParentId, departmentId);
  await validateManagerEmployee(nextManagerEmployeeId);

  await db
    .updateTable('departments')
    .set({
      branch_id: nextBranchId,
      parent_id: nextParentId,
      manager_employee_id: nextManagerEmployeeId,
      code: input.code ?? existing.code,
      name: input.name ?? existing.name,
      name_en: input.nameEn !== undefined ? input.nameEn?.trim() || null : existing.name_en,
      description: input.description !== undefined ? input.description : existing.description,
      sort_order: input.sortOrder ?? Number(existing.sort_order),
      is_active:
        input.isActive !== undefined ? (input.isActive ? 1 : 0) : existing.is_active,
      updated_by: auth.userId,
    })
    .where('id', '=', departmentId)
    .execute();

  await recordAuditLog({
    userId: auth.userId,
    moduleCode: 'hrm',
    action: 'HRM_DEPARTMENT_UPDATE',
    entityType: 'departments',
    entityId: departmentId,
    oldValues: {
      code: existing.code,
      name: existing.name,
      parentId: existing.parent_id,
      managerEmployeeId: existing.manager_employee_id,
    },
    newValues: {
      code: input.code ?? existing.code,
      name: input.name ?? existing.name,
      parentId: nextParentId,
      managerEmployeeId: nextManagerEmployeeId,
    },
    ipAddress,
  });

  const list = await listDepartments(auth, { page: '1', limit: '200', branchId: String(nextBranchId) });
  const updatedItem = list.items.find((d) => d.id === departmentId);
  if (!updatedItem) {
    throw new AppError('DEPARTMENT_NOT_FOUND', 'Không tìm thấy phòng ban sau cập nhật.', 404);
  }
  return updatedItem;
}

export async function softDeleteDepartment(
  auth: AuthContext,
  departmentId: number,
  ipAddress: string | null,
): Promise<void> {
  const db = getDb();

  const existing = await db
    .selectFrom('departments')
    .select(['id', 'branch_id', 'code', 'name'])
    .where('id', '=', departmentId)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (!existing) {
    throw new AppError('DEPARTMENT_NOT_FOUND', 'Không tìm thấy phòng ban.', 404);
  }

  assertBranchAllowed(auth, Number(existing.branch_id));

  const child = await db
    .selectFrom('departments')
    .select(['id'])
    .where('parent_id', '=', departmentId)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (child) {
    throw new AppError(
      'DEPARTMENT_HAS_CHILDREN',
      'Không thể xóa phòng ban đang có phòng ban trực thuộc. Vui lòng chuyển hoặc xóa phòng ban con trước.',
      400,
    );
  }

  await db
    .updateTable('departments')
    .set({ deleted_at: new Date(), is_active: 0, updated_by: auth.userId })
    .where('id', '=', departmentId)
    .execute();

  await recordAuditLog({
    userId: auth.userId,
    moduleCode: 'hrm',
    action: 'HRM_DEPARTMENT_DELETE',
    entityType: 'departments',
    entityId: departmentId,
    oldValues: { code: existing.code, name: existing.name },
    ipAddress,
  });
}
