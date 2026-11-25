import { sql } from 'kysely';
import {
  getDb,
  type ProjectHealthStatus,
  type ProjectMemberRole,
  type ProjectMethodology,
  type ProjectPriority,
  type ProjectStatus,
  type ProjectVisibility,
  type TaskStatusCategory,
} from '@/config/database';
import {
  buildPaginationMeta,
  parsePaginationParams,
  type PaginationMeta,
} from '@/lib/portable/pagination';
import { createApprovalRequest } from '@/modules/approvals/approvals.service';
import { recordAuditLog } from '@/modules/audit/audit.service';
import { hasRequiredPermission, type AuthContext } from '@/modules/auth/auth.service';
import { createNotification } from '@/modules/notifications/notifications.service';
import {
  assertProjectAccess,
  isAllowedProjectStatusTransition,
  resolveEmployeeForUser,
} from '@/modules/projects/projects.access';
import {
  DEFAULT_PROJECT_BOARD_COLUMNS,
  DEFAULT_PROJECT_LABELS,
  PROJECT_ADMIN_ROLES,
  PROJECT_CHARTER_ENTITY_TYPE,
  PROJECT_CHARTER_REQUEST_TYPE,
} from '@/modules/projects/projects.constants';
import type {
  AddProjectMemberInput,
  CreateBoardColumnInput,
  CreateLabelInput,
  CreateProjectInput,
  TransitionProjectStatusInput,
  UpdateBoardColumnInput,
  UpdateLabelInput,
  UpdateProjectInput,
  UpdateProjectMemberInput,
} from '@/modules/projects/projects.schema';
import { AppError } from '@/shared/api-response';

export interface ProjectListItem {
  id: number;
  code: string;
  name: string;
  description: string | null;
  branchId: number;
  branchName: string;
  branchNameEn: string | null;
  departmentId: number | null;
  departmentName: string | null;
  departmentNameEn: string | null;
  ownerEmployeeId: number;
  ownerName: string;
  managerEmployeeId: number;
  managerName: string;
  methodology: ProjectMethodology;
  visibility: ProjectVisibility;
  priority: ProjectPriority;
  status: ProjectStatus;
  healthStatus: ProjectHealthStatus;
  startDate: string | null;
  targetEndDate: string | null;
  plannedBudget: number;
  actualCost: number;
  progressPercent: number;
  colorHex: string;
  memberCount: number;
  taskCount: number;
  completedTaskCount: number;
  currentUserRole: ProjectMemberRole | null;
  createdAt: string;
}

export interface ProjectMemberView {
  id: number;
  projectId: number;
  employeeId: number;
  employeeCode: string;
  fullName: string;
  workEmail: string;
  departmentName: string | null;
  departmentNameEn: string | null;
  positionName: string | null;
  positionNameEn: string | null;
  projectRole: ProjectMemberRole;
  allocationPercent: number;
  hourlyCostRate: number;
  joinedAt: string;
}

export interface ProjectColumnView {
  id: number;
  projectId: number;
  code: string;
  name: string;
  nameEn: string | null;
  statusCategory: TaskStatusCategory;
  colorHex: string;
  wipLimit: number | null;
  sortOrder: number;
  isDefaultInitial: boolean;
  isDoneColumn: boolean;
  taskCount: number;
}

export interface ProjectLabelView {
  id: number;
  projectId: number | null;
  name: string;
  colorHex: string;
}

export interface ProjectDetailView extends ProjectListItem {
  approvalRequestId: number | null;
  approvalStatus: string | null;
  canViewBudget: boolean;
  canEditProject: boolean;
  canManageMembers: boolean;
  canManageWorkflow: boolean;
  canCreateTasks: boolean;
  canEditTasks: boolean;
  canArchive: boolean;
  members: ProjectMemberView[];
  columns: ProjectColumnView[];
  labels: ProjectLabelView[];
}

function toIsoDateOnly(val: Date | string | null | undefined): string | null {
  if (!val) {
    return null;
  }
  if (val instanceof Date) {
    return val.toISOString().slice(0, 10);
  }
  return String(val).slice(0, 10);
}

function toIsoDateTime(val: Date | string): string {
  return val instanceof Date ? val.toISOString() : new Date(val).toISOString();
}

export async function listProjects(
  auth: AuthContext,
  query: {
    page?: string | null;
    limit?: string | null;
    search?: string | null;
    branchId?: string | null;
    departmentId?: string | null;
    status?: string | null;
    healthStatus?: string | null;
    methodology?: string | null;
    onlyMine?: string | null;
    includeArchived?: string | null;
  },
): Promise<{
  items: ProjectListItem[];
  summary: { total: number; active: number; atRisk: number; completed: number };
  meta: PaginationMeta;
}> {
  const db = getDb();
  const pagination = parsePaginationParams(
    { page: query.page, limit: query.limit },
    { defaultLimit: 20, maxLimit: 100 },
  );

  const employee = await resolveEmployeeForUser(auth.userId);
  const isExecutive = auth.roles.some((r) => r.code === 'EXECUTIVE');
  const isGlobalViewer =
    auth.isSuperAdmin ||
    isExecutive ||
    (hasRequiredPermission(auth, 'pm.projects.manage') && auth.dataScope === 'ALL');

  const myMemberships = employee
    ? await db
        .selectFrom('project_members')
        .select(['project_id', 'project_role'])
        .where('employee_id', '=', employee.id)
        .where('deleted_at', 'is', null)
        .where('left_at', 'is', null)
        .execute()
    : [];

  const roleByProjectId = new Map<number, ProjectMemberRole>();
  for (const m of myMemberships) {
    roleByProjectId.set(Number(m.project_id), m.project_role);
  }
  const myProjectIds = Array.from(roleByProjectId.keys());

  let base = db
    .selectFrom('projects')
    .innerJoin('branches', 'branches.id', 'projects.branch_id')
    .leftJoin('departments', 'departments.id', 'projects.department_id')
    .innerJoin('employees as owner_emp', 'owner_emp.id', 'projects.owner_employee_id')
    .innerJoin('employees as mgr_emp', 'mgr_emp.id', 'projects.manager_employee_id')
    .where('projects.deleted_at', 'is', null);

  if (query.includeArchived !== 'true') {
    base = base.where('projects.status', '!=', 'ARCHIVED');
  }

  if (!isGlobalViewer) {
    base = base.where((eb) => {
      const clauses = [eb('projects.visibility', '=', 'PUBLIC_COMPANY')];
      if (myProjectIds.length > 0) {
        clauses.push(eb('projects.id', 'in', myProjectIds));
      }
      const allowedBranchIds = Array.from(
        new Set([
          ...auth.branchIds,
          ...(employee ? [employee.branchId] : []),
        ]),
      );
      if (allowedBranchIds.length > 0) {
        clauses.push(
          eb.and([
            eb('projects.visibility', '=', 'BRANCH'),
            eb('projects.branch_id', 'in', allowedBranchIds),
          ]),
        );
      }
      if (employee?.departmentId) {
        clauses.push(
          eb.and([
            eb('projects.visibility', '=', 'DEPARTMENT'),
            eb('projects.department_id', '=', employee.departmentId),
          ]),
        );
      }
      return eb.or(clauses);
    });
  }

  if (query.onlyMine === 'true') {
    if (myProjectIds.length === 0) {
      return {
        items: [],
        summary: { total: 0, active: 0, atRisk: 0, completed: 0 },
        meta: buildPaginationMeta(0, pagination.page, pagination.limit),
      };
    }
    base = base.where('projects.id', 'in', myProjectIds);
  }

  if (query.branchId && /^\d+$/.test(query.branchId)) {
    base = base.where('projects.branch_id', '=', Number(query.branchId));
  }
  if (query.departmentId && /^\d+$/.test(query.departmentId)) {
    base = base.where('projects.department_id', '=', Number(query.departmentId));
  }
  if (query.status) {
    base = base.where('projects.status', '=', query.status as ProjectStatus);
  }
  if (query.healthStatus) {
    base = base.where('projects.health_status', '=', query.healthStatus as ProjectHealthStatus);
  }
  if (query.methodology) {
    base = base.where('projects.methodology', '=', query.methodology as ProjectMethodology);
  }
  if (query.search && query.search.trim().length > 0) {
    const keyword = `%${query.search.trim()}%`;
    base = base.where((eb) =>
      eb.or([
        eb('projects.code', 'like', keyword),
        eb('projects.name', 'like', keyword),
      ]),
    );
  }

  const allStatsRows = await base
    .select(['projects.id', 'projects.status', 'projects.health_status'])
    .execute();

  const summary = {
    total: allStatsRows.length,
    active: allStatsRows.filter((r) => r.status === 'ACTIVE').length,
    atRisk: allStatsRows.filter(
      (r) => r.status === 'ACTIVE' && (r.health_status === 'AT_RISK' || r.health_status === 'OFF_TRACK'),
    ).length,
    completed: allStatsRows.filter((r) => r.status === 'COMPLETED').length,
  };

  const rows = await base
    .select([
      'projects.id',
      'projects.code',
      'projects.name',
      'projects.description',
      'projects.branch_id',
      'branches.name as branch_name',
      'branches.name_en as branch_name_en',
      'projects.department_id',
      'departments.name as department_name',
      'departments.name_en as department_name_en',
      'projects.owner_employee_id',
      'owner_emp.full_name as owner_name',
      'projects.manager_employee_id',
      'mgr_emp.full_name as manager_name',
      'projects.methodology',
      'projects.visibility',
      'projects.priority',
      'projects.status',
      'projects.health_status',
      'projects.start_date',
      'projects.target_end_date',
      'projects.planned_budget',
      'projects.actual_cost',
      'projects.progress_percent',
      'projects.color_hex',
      'projects.created_at',
    ])
    .orderBy('projects.updated_at', 'desc')
    .limit(pagination.limit)
    .offset(pagination.offset)
    .execute();

  const projectIds = rows.map((r) => Number(r.id));
  const memberCountMap = new Map<number, number>();
  const taskCountMap = new Map<number, { total: number; done: number }>();

  if (projectIds.length > 0) {
    const [memberCounts, taskCounts] = await Promise.all([
      db
        .selectFrom('project_members')
        .select(['project_id', sql<number>`COUNT(*)`.as('cnt')])
        .where('project_id', 'in', projectIds)
        .where('deleted_at', 'is', null)
        .where('left_at', 'is', null)
        .groupBy('project_id')
        .execute(),
      db
        .selectFrom('tasks')
        .select([
          'project_id',
          sql<number>`COUNT(*)`.as('total'),
          sql<number>`SUM(CASE WHEN status_category = 'DONE' THEN 1 ELSE 0 END)`.as('done'),
        ])
        .where('project_id', 'in', projectIds)
        .where('deleted_at', 'is', null)
        .groupBy('project_id')
        .execute(),
    ]);

    for (const row of memberCounts) {
      memberCountMap.set(Number(row.project_id), Number(row.cnt));
    }
    for (const row of taskCounts) {
      taskCountMap.set(Number(row.project_id), {
        total: Number(row.total ?? 0),
        done: Number(row.done ?? 0),
      });
    }
  }

  const canReadBudgetGlobally =
    auth.isSuperAdmin || isExecutive || hasRequiredPermission(auth, 'pm.budget.read');

  const items: ProjectListItem[] = rows.map((row) => {
    const pid = Number(row.id);
    const role = roleByProjectId.get(pid) ?? null;
    const showBudget =
      canReadBudgetGlobally || (role !== null && PROJECT_ADMIN_ROLES.includes(role));
    const tc = taskCountMap.get(pid) ?? { total: 0, done: 0 };

    return {
      id: pid,
      code: row.code,
      name: row.name,
      description: row.description,
      branchId: Number(row.branch_id),
      branchName: row.branch_name,
      branchNameEn: row.branch_name_en ?? null,
      departmentId: row.department_id !== null ? Number(row.department_id) : null,
      departmentName: row.department_name ?? null,
      departmentNameEn: row.department_name_en ?? null,
      ownerEmployeeId: Number(row.owner_employee_id),
      ownerName: row.owner_name,
      managerEmployeeId: Number(row.manager_employee_id),
      managerName: row.manager_name,
      methodology: row.methodology,
      visibility: row.visibility,
      priority: row.priority,
      status: row.status,
      healthStatus: row.health_status,
      startDate: toIsoDateOnly(row.start_date),
      targetEndDate: toIsoDateOnly(row.target_end_date),
      plannedBudget: showBudget ? Number(row.planned_budget ?? 0) : 0,
      actualCost: showBudget ? Number(row.actual_cost ?? 0) : 0,
      progressPercent: Number(row.progress_percent ?? 0),
      colorHex: row.color_hex,
      memberCount: memberCountMap.get(pid) ?? 0,
      taskCount: tc.total,
      completedTaskCount: tc.done,
      currentUserRole: role,
      createdAt: toIsoDateTime(row.created_at),
    };
  });

  return {
    items,
    summary,
    meta: buildPaginationMeta(summary.total, pagination.page, pagination.limit),
  };
}

export async function getProjectDetail(
  auth: AuthContext,
  idOrCode: string | number,
): Promise<ProjectDetailView> {
  const access = await assertProjectAccess(auth, idOrCode, 'VIEW');
  const db = getDb();

  const row = await db
    .selectFrom('projects')
    .innerJoin('branches', 'branches.id', 'projects.branch_id')
    .leftJoin('departments', 'departments.id', 'projects.department_id')
    .innerJoin('employees as owner_emp', 'owner_emp.id', 'projects.owner_employee_id')
    .innerJoin('employees as mgr_emp', 'mgr_emp.id', 'projects.manager_employee_id')
    .leftJoin('approval_requests', 'approval_requests.id', 'projects.approval_request_id')
    .select([
      'projects.id',
      'projects.code',
      'projects.name',
      'projects.description',
      'projects.branch_id',
      'branches.name as branch_name',
      'branches.name_en as branch_name_en',
      'projects.department_id',
      'departments.name as department_name',
      'departments.name_en as department_name_en',
      'projects.owner_employee_id',
      'owner_emp.full_name as owner_name',
      'projects.manager_employee_id',
      'mgr_emp.full_name as manager_name',
      'projects.methodology',
      'projects.visibility',
      'projects.priority',
      'projects.status',
      'projects.health_status',
      'projects.start_date',
      'projects.target_end_date',
      'projects.planned_budget',
      'projects.actual_cost',
      'projects.progress_percent',
      'projects.color_hex',
      'projects.approval_request_id',
      'approval_requests.status as approval_status',
      'projects.created_at',
    ])
    .where('projects.id', '=', access.project.id)
    .where('projects.deleted_at', 'is', null)
    .executeTakeFirstOrThrow();

  const [memberRows, columnRows, labelRows, taskCountsByCol] = await Promise.all([
    db
      .selectFrom('project_members')
      .innerJoin('employees', 'employees.id', 'project_members.employee_id')
      .leftJoin('departments', 'departments.id', 'employees.department_id')
      .leftJoin('positions', 'positions.id', 'employees.position_id')
      .select([
        'project_members.id',
        'project_members.project_id',
        'project_members.employee_id',
        'employees.employee_code',
        'employees.full_name',
        'employees.work_email',
        'departments.name as department_name',
        'departments.name_en as department_name_en',
        'positions.name as position_name',
        'positions.name_en as position_name_en',
        'project_members.project_role',
        'project_members.allocation_percent',
        'project_members.hourly_cost_rate',
        'project_members.joined_at',
      ])
      .where('project_members.project_id', '=', access.project.id)
      .where('project_members.deleted_at', 'is', null)
      .where('project_members.left_at', 'is', null)
      .orderBy('project_members.joined_at', 'asc')
      .execute(),
    db
      .selectFrom('project_board_columns')
      .select([
        'id',
        'project_id',
        'code',
        'name',
        'name_en',
        'status_category',
        'color_hex',
        'wip_limit',
        'sort_order',
        'is_default_initial',
        'is_done_column',
      ])
      .where('project_id', '=', access.project.id)
      .where('deleted_at', 'is', null)
      .orderBy('sort_order', 'asc')
      .execute(),
    db
      .selectFrom('project_labels')
      .select(['id', 'project_id', 'name', 'color_hex'])
      .where('project_id', '=', access.project.id)
      .where('deleted_at', 'is', null)
      .orderBy('name', 'asc')
      .execute(),
    db
      .selectFrom('tasks')
      .select(['column_id', 'status_category', sql<number>`COUNT(*)`.as('cnt')])
      .where('project_id', '=', access.project.id)
      .where('deleted_at', 'is', null)
      .groupBy(['column_id', 'status_category'])
      .execute(),
  ]);

  const colCountMap = new Map<number, number>();
  let totalTasks = 0;
  let completedTasks = 0;
  for (const tc of taskCountsByCol) {
    const cid = Number(tc.column_id);
    const cnt = Number(tc.cnt ?? 0);
    colCountMap.set(cid, (colCountMap.get(cid) ?? 0) + cnt);
    totalTasks += cnt;
    if (tc.status_category === 'DONE') {
      completedTasks += cnt;
    }
  }

  return {
    id: Number(row.id),
    code: row.code,
    name: row.name,
    description: row.description,
    branchId: Number(row.branch_id),
    branchName: row.branch_name,
    branchNameEn: row.branch_name_en ?? null,
    departmentId: row.department_id !== null ? Number(row.department_id) : null,
    departmentName: row.department_name ?? null,
    departmentNameEn: row.department_name_en ?? null,
    ownerEmployeeId: Number(row.owner_employee_id),
    ownerName: row.owner_name,
    managerEmployeeId: Number(row.manager_employee_id),
    managerName: row.manager_name,
    methodology: row.methodology,
    visibility: row.visibility,
    priority: row.priority,
    status: row.status,
    healthStatus: row.health_status,
    startDate: toIsoDateOnly(row.start_date),
    targetEndDate: toIsoDateOnly(row.target_end_date),
    plannedBudget: access.canViewBudget ? Number(row.planned_budget ?? 0) : 0,
    actualCost: access.canViewBudget ? Number(row.actual_cost ?? 0) : 0,
    progressPercent: Number(row.progress_percent ?? 0),
    colorHex: row.color_hex,
    memberCount: memberRows.length,
    taskCount: totalTasks,
    completedTaskCount: completedTasks,
    currentUserRole: access.projectRole,
    createdAt: toIsoDateTime(row.created_at),
    approvalRequestId: row.approval_request_id !== null ? Number(row.approval_request_id) : null,
    approvalStatus: row.approval_status ?? null,
    canViewBudget: access.canViewBudget,
    canEditProject: access.canEditProject,
    canManageMembers: access.canManageMembers,
    canManageWorkflow: access.canManageWorkflow,
    canCreateTasks: access.canCreateTasks,
    canEditTasks: access.canEditTasks,
    canArchive: access.canArchive,
    members: memberRows.map((m) => ({
      id: Number(m.id),
      projectId: Number(m.project_id),
      employeeId: Number(m.employee_id),
      employeeCode: m.employee_code,
      fullName: m.full_name,
      workEmail: m.work_email,
      departmentName: m.department_name ?? null,
      departmentNameEn: m.department_name_en ?? null,
      positionName: m.position_name ?? null,
      positionNameEn: m.position_name_en ?? null,
      projectRole: m.project_role,
      allocationPercent: Number(m.allocation_percent),
      hourlyCostRate: access.canViewBudget ? Number(m.hourly_cost_rate ?? 0) : 0,
      joinedAt: toIsoDateTime(m.joined_at),
    })),
    columns: columnRows.map((c) => ({
      id: Number(c.id),
      projectId: Number(c.project_id),
      code: c.code,
      name: c.name,
      nameEn: c.name_en ?? null,
      statusCategory: c.status_category,
      colorHex: c.color_hex,
      wipLimit: c.wip_limit !== null ? Number(c.wip_limit) : null,
      sortOrder: Number(c.sort_order),
      isDefaultInitial: Number(c.is_default_initial) === 1,
      isDoneColumn: Number(c.is_done_column) === 1,
      taskCount: colCountMap.get(Number(c.id)) ?? 0,
    })),
    labels: labelRows.map((l) => ({
      id: Number(l.id),
      projectId: l.project_id !== null ? Number(l.project_id) : null,
      name: l.name,
      colorHex: l.color_hex,
    })),
  };
}

export async function createProject(
  auth: AuthContext,
  input: CreateProjectInput,
  ipAddress: string | null,
): Promise<ProjectDetailView> {
  const normalizedCode = input.code.trim().toUpperCase();
  if (input.startDate && input.targetEndDate && input.targetEndDate < input.startDate) {
    throw new AppError(
      'INVALID_DATE_RANGE',
      'Ngày kết thúc dự kiến phải lớn hơn hoặc bằng ngày bắt đầu.',
      400,
    );
  }

  const db = getDb();
  const [existingCode, branch, ownerEmp, mgrEmp] = await Promise.all([
    db.selectFrom('projects').select(['id']).where('code', '=', normalizedCode).executeTakeFirst(),
    db
      .selectFrom('branches')
      .select(['id'])
      .where('id', '=', input.branchId)
      .where('deleted_at', 'is', null)
      .executeTakeFirst(),
    db
      .selectFrom('employees')
      .select(['id'])
      .where('id', '=', input.ownerEmployeeId)
      .where('deleted_at', 'is', null)
      .executeTakeFirst(),
    db
      .selectFrom('employees')
      .select(['id'])
      .where('id', '=', input.managerEmployeeId)
      .where('deleted_at', 'is', null)
      .executeTakeFirst(),
  ]);

  if (existingCode) {
    throw new AppError(
      'PROJECT_CODE_EXISTS',
      `Mã dự án "${normalizedCode}" đã tồn tại. Vui lòng chọn mã khác.`,
      409,
    );
  }
  if (!branch) {
    throw new AppError('BRANCH_NOT_FOUND', 'Chi nhánh không tồn tại.', 404);
  }
  if (!ownerEmp || !mgrEmp) {
    throw new AppError('EMPLOYEE_NOT_FOUND', 'Chủ dự án hoặc Quản lý dự án không tồn tại.', 404);
  }

  const creatorEmployee = await resolveEmployeeForUser(auth.userId);

  const projectId = await db.transaction().execute(async (trx) => {
    const inserted = await trx
      .insertInto('projects')
      .values({
        code: normalizedCode,
        name: input.name.trim(),
        description: input.description ?? null,
        branch_id: input.branchId,
        department_id: input.departmentId ?? null,
        owner_employee_id: input.ownerEmployeeId,
        manager_employee_id: input.managerEmployeeId,
        methodology: input.methodology,
        visibility: input.visibility,
        priority: input.priority,
        status: 'DRAFT',
        health_status: 'ON_TRACK',
        start_date: input.startDate ?? null,
        target_end_date: input.targetEndDate ?? null,
        actual_end_date: null,
        baseline_start_date: input.startDate ?? null,
        baseline_end_date: input.targetEndDate ?? null,
        planned_budget: input.plannedBudget.toFixed(2),
        actual_cost: '0.00',
        progress_percent: '0.00',
        task_seq_counter: 0,
        approval_request_id: null,
        color_hex: input.colorHex ?? '#2563EB',
        created_by: auth.userId,
        updated_by: auth.userId,
      })
      .executeTakeFirstOrThrow();

    const pid = Number(inserted.insertId);

    const initialMembers = new Map<number, ProjectMemberRole>();
    initialMembers.set(input.ownerEmployeeId, 'PROJECT_OWNER');
    if (!initialMembers.has(input.managerEmployeeId)) {
      initialMembers.set(input.managerEmployeeId, 'PROJECT_MANAGER');
    }
    if (creatorEmployee && !initialMembers.has(creatorEmployee.id)) {
      initialMembers.set(creatorEmployee.id, 'PROJECT_MANAGER');
    }

    await trx
      .insertInto('project_members')
      .values(
        Array.from(initialMembers.entries()).map(([empId, role]) => ({
          project_id: pid,
          employee_id: empId,
          project_role: role,
          allocation_percent: 100,
          hourly_cost_rate: '0.00',
          left_at: null,
          created_by: auth.userId,
          updated_by: auth.userId,
        })),
      )
      .execute();

    await trx
      .insertInto('project_board_columns')
      .values(
        DEFAULT_PROJECT_BOARD_COLUMNS.map((col) => ({
          project_id: pid,
          code: col.code,
          name: col.name,
          name_en: col.nameEn,
          status_category: col.statusCategory,
          color_hex: col.colorHex,
          wip_limit: col.wipLimit,
          sort_order: col.sortOrder,
          is_default_initial: col.isDefaultInitial,
          is_done_column: col.isDoneColumn,
          created_by: auth.userId,
          updated_by: auth.userId,
        })),
      )
      .execute();

    await trx
      .insertInto('project_labels')
      .values(
        DEFAULT_PROJECT_LABELS.map((lbl) => ({
          project_id: pid,
          name: lbl.name,
          color_hex: lbl.colorHex,
          created_by: auth.userId,
          updated_by: auth.userId,
        })),
      )
      .execute();

    return pid;
  });

  if (input.templateId) {
    const { applyTemplateToNewProject } = await import(
      '@/modules/projects/templates-automation.service'
    );
    await applyTemplateToNewProject({
      templateId: input.templateId,
      projectId,
      projectCode: normalizedCode,
      projectStartDate: input.startDate ?? null,
      reporterEmployeeId: creatorEmployee?.id ?? input.managerEmployeeId,
      actorUserId: auth.userId,
    });
  }

  await recordAuditLog({
    userId: auth.userId,
    moduleCode: 'projects',
    action: 'PROJECT_CREATE',
    entityType: 'projects',
    entityId: String(projectId),
    newValues: { code: normalizedCode, name: input.name, methodology: input.methodology },
    ipAddress,
  });

  return getProjectDetail(auth, projectId);
}

export async function updateProject(
  auth: AuthContext,
  idOrCode: string | number,
  input: UpdateProjectInput,
  ipAddress: string | null,
): Promise<ProjectDetailView> {
  const access = await assertProjectAccess(auth, idOrCode, 'MANAGE');
  const db = getDb();

  const current = await db
    .selectFrom('projects')
    .select(['start_date', 'target_end_date', 'name', 'health_status', 'visibility'])
    .where('id', '=', access.project.id)
    .executeTakeFirstOrThrow();

  const nextStart =
    input.startDate !== undefined ? input.startDate : toIsoDateOnly(current.start_date);
  const nextEnd =
    input.targetEndDate !== undefined ? input.targetEndDate : toIsoDateOnly(current.target_end_date);

  if (nextStart && nextEnd && nextEnd < nextStart) {
    throw new AppError(
      'INVALID_DATE_RANGE',
      'Ngày kết thúc dự kiến phải lớn hơn hoặc bằng ngày bắt đầu.',
      400,
    );
  }

  await db
    .updateTable('projects')
    .set({
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.departmentId !== undefined ? { department_id: input.departmentId } : {}),
      ...(input.ownerEmployeeId !== undefined ? { owner_employee_id: input.ownerEmployeeId } : {}),
      ...(input.managerEmployeeId !== undefined
        ? { manager_employee_id: input.managerEmployeeId }
        : {}),
      ...(input.methodology !== undefined ? { methodology: input.methodology } : {}),
      ...(input.visibility !== undefined ? { visibility: input.visibility } : {}),
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
      ...(input.healthStatus !== undefined ? { health_status: input.healthStatus } : {}),
      ...(input.startDate !== undefined ? { start_date: input.startDate } : {}),
      ...(input.targetEndDate !== undefined ? { target_end_date: input.targetEndDate } : {}),
      ...(input.plannedBudget !== undefined
        ? { planned_budget: input.plannedBudget.toFixed(2) }
        : {}),
      ...(input.progressPercent !== undefined
        ? { progress_percent: input.progressPercent.toFixed(2) }
        : {}),
      ...(input.colorHex !== undefined ? { color_hex: input.colorHex } : {}),
      updated_by: auth.userId,
    })
    .where('id', '=', access.project.id)
    .execute();

  await recordAuditLog({
    userId: auth.userId,
    moduleCode: 'projects',
    action: 'PROJECT_UPDATE',
    entityType: 'projects',
    entityId: String(access.project.id),
    oldValues: {
      name: current.name,
      healthStatus: current.health_status,
      visibility: current.visibility,
    },
    newValues: input as Record<string, unknown>,
    ipAddress,
  });

  return getProjectDetail(auth, access.project.id);
}

export async function transitionProjectStatus(
  auth: AuthContext,
  idOrCode: string | number,
  input: TransitionProjectStatusInput,
  ipAddress: string | null,
): Promise<ProjectDetailView> {
  const requirement = input.targetStatus === 'ARCHIVED' ? 'ARCHIVE' : 'MANAGE';
  const access = await assertProjectAccess(auth, idOrCode, requirement);

  if (!isAllowedProjectStatusTransition(access.project.status, input.targetStatus)) {
    throw new AppError(
      'INVALID_PROJECT_STATUS_TRANSITION',
      `Không thể chuyển trạng thái dự án từ "${access.project.status}" sang "${input.targetStatus}".`,
      409,
    );
  }

  const db = getDb();
  let approvalRequestId: number | null | undefined;

  if (input.targetStatus === 'PENDING_APPROVAL') {
    const projectRow = await db
      .selectFrom('projects')
      .select(['planned_budget'])
      .where('id', '=', access.project.id)
      .executeTakeFirstOrThrow();

    const approval = await createApprovalRequest({
      moduleCode: 'projects',
      requestType: PROJECT_CHARTER_REQUEST_TYPE,
      entityType: PROJECT_CHARTER_ENTITY_TYPE,
      entityId: access.project.id,
      branchId: access.project.branchId,
      requesterId: auth.userId,
      title: `Duyệt mở dự án [${access.project.code}] ${access.project.name}`,
      summary: input.reason?.trim() || `Ngân sách dự kiến: ${Number(projectRow.planned_budget).toLocaleString('vi-VN')} VNĐ`,
      evalContext: { amount: Number(projectRow.planned_budget) },
    });
    approvalRequestId = approval.approvalRequestId;
  }

  await db
    .updateTable('projects')
    .set({
      status: input.targetStatus,
      ...(input.targetStatus === 'COMPLETED' ? { actual_end_date: new Date().toISOString().slice(0, 10) } : {}),
      ...(approvalRequestId !== undefined ? { approval_request_id: approvalRequestId } : {}),
      updated_by: auth.userId,
    })
    .where('id', '=', access.project.id)
    .execute();

  await recordAuditLog({
    userId: auth.userId,
    moduleCode: 'projects',
    action: 'PROJECT_STATUS_TRANSITION',
    entityType: 'projects',
    entityId: String(access.project.id),
    oldValues: { status: access.project.status },
    newValues: { status: input.targetStatus, reason: input.reason ?? null },
    ipAddress,
  });

  return getProjectDetail(auth, access.project.id);
}

export async function addProjectMember(
  auth: AuthContext,
  idOrCode: string | number,
  input: AddProjectMemberInput,
  ipAddress: string | null,
): Promise<ProjectMemberView[]> {
  const access = await assertProjectAccess(auth, idOrCode, 'MANAGE');
  const db = getDb();

  const employee = await db
    .selectFrom('employees')
    .select(['id', 'user_id', 'full_name'])
    .where('id', '=', input.employeeId)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (!employee) {
    throw new AppError('EMPLOYEE_NOT_FOUND', 'Không tìm thấy nhân viên cần thêm vào dự án.', 404);
  }

  const existing = await db
    .selectFrom('project_members')
    .select(['id', 'deleted_at', 'left_at'])
    .where('project_id', '=', access.project.id)
    .where('employee_id', '=', input.employeeId)
    .executeTakeFirst();

  if (existing && !existing.deleted_at && !existing.left_at) {
    throw new AppError('MEMBER_ALREADY_IN_PROJECT', 'Nhân viên này đã là thành viên của dự án.', 409);
  }

  if (existing) {
    await db
      .updateTable('project_members')
      .set({
        project_role: input.projectRole,
        allocation_percent: input.allocationPercent,
        hourly_cost_rate: input.hourlyCostRate.toFixed(2),
        joined_at: new Date(),
        left_at: null,
        deleted_at: null,
        updated_by: auth.userId,
      })
      .where('id', '=', Number(existing.id))
      .execute();
  } else {
    await db
      .insertInto('project_members')
      .values({
        project_id: access.project.id,
        employee_id: input.employeeId,
        project_role: input.projectRole,
        allocation_percent: input.allocationPercent,
        hourly_cost_rate: input.hourlyCostRate.toFixed(2),
        left_at: null,
        created_by: auth.userId,
        updated_by: auth.userId,
      })
      .execute();
  }

  if (employee.user_id && Number(employee.user_id) !== auth.userId) {
    await createNotification({
      userId: Number(employee.user_id),
      moduleCode: 'projects',
      type: 'PROJECT_MEMBER_ADDED',
      title: `Bạn được thêm vào dự án [${access.project.code}]`,
      message: `${auth.fullName} đã mời bạn tham gia dự án "${access.project.name}" với vai trò ${input.projectRole}.`,
      linkUrl: `/projects/${access.project.code}`,
    });
  }

  await recordAuditLog({
    userId: auth.userId,
    moduleCode: 'projects',
    action: 'PROJECT_MEMBER_ADD',
    entityType: 'project_members',
    entityId: `${access.project.id}:${input.employeeId}`,
    newValues: { employeeId: input.employeeId, projectRole: input.projectRole },
    ipAddress,
  });

  const detail = await getProjectDetail(auth, access.project.id);
  return detail.members;
}

export async function updateProjectMember(
  auth: AuthContext,
  idOrCode: string | number,
  memberId: number,
  input: UpdateProjectMemberInput,
  ipAddress: string | null,
): Promise<ProjectMemberView[]> {
  const access = await assertProjectAccess(auth, idOrCode, 'MANAGE');
  const db = getDb();

  const member = await db
    .selectFrom('project_members')
    .select(['id', 'project_role', 'employee_id'])
    .where('id', '=', memberId)
    .where('project_id', '=', access.project.id)
    .where('deleted_at', 'is', null)
    .where('left_at', 'is', null)
    .executeTakeFirst();

  if (!member) {
    throw new AppError('PROJECT_MEMBER_NOT_FOUND', 'Không tìm thấy thành viên trong dự án.', 404);
  }

  if (
    input.projectRole &&
    PROJECT_ADMIN_ROLES.includes(member.project_role) &&
    !PROJECT_ADMIN_ROLES.includes(input.projectRole)
  ) {
    const adminCountRow = await db
      .selectFrom('project_members')
      .select(sql<number>`COUNT(*)`.as('cnt'))
      .where('project_id', '=', access.project.id)
      .where('project_role', 'in', [...PROJECT_ADMIN_ROLES])
      .where('deleted_at', 'is', null)
      .where('left_at', 'is', null)
      .executeTakeFirst();

    if (Number(adminCountRow?.cnt ?? 0) <= 1) {
      throw new AppError(
        'LAST_PROJECT_ADMIN',
        'Dự án bắt buộc phải giữ tối thiểu 1 Chủ dự án hoặc Quản lý dự án.',
        409,
      );
    }
  }

  await db
    .updateTable('project_members')
    .set({
      ...(input.projectRole !== undefined ? { project_role: input.projectRole } : {}),
      ...(input.allocationPercent !== undefined
        ? { allocation_percent: input.allocationPercent }
        : {}),
      ...(input.hourlyCostRate !== undefined
        ? { hourly_cost_rate: input.hourlyCostRate.toFixed(2) }
        : {}),
      updated_by: auth.userId,
    })
    .where('id', '=', memberId)
    .execute();

  await recordAuditLog({
    userId: auth.userId,
    moduleCode: 'projects',
    action: 'PROJECT_MEMBER_UPDATE',
    entityType: 'project_members',
    entityId: String(memberId),
    oldValues: { projectRole: member.project_role },
    newValues: input as Record<string, unknown>,
    ipAddress,
  });

  const detail = await getProjectDetail(auth, access.project.id);
  return detail.members;
}

export async function removeProjectMember(
  auth: AuthContext,
  idOrCode: string | number,
  memberId: number,
  ipAddress: string | null,
): Promise<ProjectMemberView[]> {
  const access = await assertProjectAccess(auth, idOrCode, 'MANAGE');
  const db = getDb();

  const member = await db
    .selectFrom('project_members')
    .select(['id', 'project_role', 'employee_id'])
    .where('id', '=', memberId)
    .where('project_id', '=', access.project.id)
    .where('deleted_at', 'is', null)
    .where('left_at', 'is', null)
    .executeTakeFirst();

  if (!member) {
    throw new AppError('PROJECT_MEMBER_NOT_FOUND', 'Không tìm thấy thành viên trong dự án.', 404);
  }

  if (PROJECT_ADMIN_ROLES.includes(member.project_role)) {
    const adminCountRow = await db
      .selectFrom('project_members')
      .select(sql<number>`COUNT(*)`.as('cnt'))
      .where('project_id', '=', access.project.id)
      .where('project_role', 'in', [...PROJECT_ADMIN_ROLES])
      .where('deleted_at', 'is', null)
      .where('left_at', 'is', null)
      .executeTakeFirst();

    if (Number(adminCountRow?.cnt ?? 0) <= 1) {
      throw new AppError(
        'LAST_PROJECT_ADMIN',
        'Không thể gỡ Chủ dự án / Quản lý dự án cuối cùng khỏi dự án.',
        409,
      );
    }
  }

  const now = new Date();
  await db
    .updateTable('project_members')
    .set({
      left_at: now,
      deleted_at: now,
      updated_by: auth.userId,
    })
    .where('id', '=', memberId)
    .execute();

  await recordAuditLog({
    userId: auth.userId,
    moduleCode: 'projects',
    action: 'PROJECT_MEMBER_REMOVE',
    entityType: 'project_members',
    entityId: String(memberId),
    oldValues: { employeeId: Number(member.employee_id), projectRole: member.project_role },
    ipAddress,
  });

  const detail = await getProjectDetail(auth, access.project.id);
  return detail.members;
}

export async function createBoardColumn(
  auth: AuthContext,
  idOrCode: string | number,
  input: CreateBoardColumnInput,
): Promise<ProjectColumnView[]> {
  const access = await assertProjectAccess(auth, idOrCode, 'MANAGE');
  const db = getDb();
  const normalizedCode = input.code.trim().toUpperCase();

  const existing = await db
    .selectFrom('project_board_columns')
    .select(['id'])
    .where('project_id', '=', access.project.id)
    .where('code', '=', normalizedCode)
    .executeTakeFirst();

  if (existing) {
    throw new AppError('COLUMN_CODE_EXISTS', `Mã cột "${normalizedCode}" đã tồn tại trong dự án.`, 409);
  }

  const maxSortRow = await db
    .selectFrom('project_board_columns')
    .select(sql<number>`COALESCE(MAX(sort_order), -1)`.as('max_sort'))
    .where('project_id', '=', access.project.id)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  await db.transaction().execute(async (trx) => {
    if (input.isDefaultInitial) {
      await trx
        .updateTable('project_board_columns')
        .set({ is_default_initial: 0 })
        .where('project_id', '=', access.project.id)
        .execute();
    }

    await trx
      .insertInto('project_board_columns')
      .values({
        project_id: access.project.id,
        code: normalizedCode,
        name: input.name.trim(),
        name_en: input.nameEn?.trim() || null,
        status_category: input.statusCategory,
        color_hex: input.colorHex ?? '#64748B',
        wip_limit: input.wipLimit ?? null,
        sort_order: Number(maxSortRow?.max_sort ?? -1) + 1,
        is_default_initial: input.isDefaultInitial ? 1 : 0,
        is_done_column: input.isDoneColumn || input.statusCategory === 'DONE' ? 1 : 0,
        created_by: auth.userId,
        updated_by: auth.userId,
      })
      .execute();
  });

  const detail = await getProjectDetail(auth, access.project.id);
  return detail.columns;
}

export async function updateBoardColumn(
  auth: AuthContext,
  idOrCode: string | number,
  input: UpdateBoardColumnInput,
): Promise<ProjectColumnView[]> {
  const access = await assertProjectAccess(auth, idOrCode, 'MANAGE');
  const db = getDb();

  const col = await db
    .selectFrom('project_board_columns')
    .select(['id', 'is_default_initial', 'is_done_column'])
    .where('id', '=', input.columnId)
    .where('project_id', '=', access.project.id)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (!col) {
    throw new AppError('COLUMN_NOT_FOUND', 'Không tìm thấy cột Kanban trong dự án.', 404);
  }

  if (input.archive) {
    if (Number(col.is_default_initial) === 1) {
      throw new AppError(
        'CANNOT_ARCHIVE_DEFAULT_COLUMN',
        'Không thể ẩn cột khởi tạo mặc định. Hãy chọn cột mặc định khác trước.',
        409,
      );
    }

    if (Number(col.is_done_column) === 1) {
      const doneCount = await db
        .selectFrom('project_board_columns')
        .select(sql<number>`COUNT(*)`.as('cnt'))
        .where('project_id', '=', access.project.id)
        .where('is_done_column', '=', 1)
        .where('deleted_at', 'is', null)
        .executeTakeFirst();

      if (Number(doneCount?.cnt ?? 0) <= 1) {
        throw new AppError(
          'CANNOT_ARCHIVE_LAST_DONE_COLUMN',
          'Dự án phải giữ tối thiểu 1 cột Hoàn thành (Done).',
          409,
        );
      }
    }

    const activeTasksInCol = await db
      .selectFrom('tasks')
      .select(sql<number>`COUNT(*)`.as('cnt'))
      .where('column_id', '=', input.columnId)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();

    if (Number(activeTasksInCol?.cnt ?? 0) > 0) {
      throw new AppError(
        'COLUMN_HAS_TASKS',
        'Cột này vẫn còn công việc. Vui lòng di chuyển công việc sang cột khác trước khi ẩn.',
        409,
      );
    }

    await db
      .updateTable('project_board_columns')
      .set({ deleted_at: new Date(), updated_by: auth.userId })
      .where('id', '=', input.columnId)
      .execute();
  } else {
    await db.transaction().execute(async (trx) => {
      if (input.isDefaultInitial) {
        await trx
          .updateTable('project_board_columns')
          .set({ is_default_initial: 0 })
          .where('project_id', '=', access.project.id)
          .execute();
      }
      await trx
        .updateTable('project_board_columns')
        .set({
          ...(input.name !== undefined ? { name: input.name.trim() } : {}),
          ...(input.nameEn !== undefined ? { name_en: input.nameEn?.trim() || null } : {}),
          ...(input.statusCategory !== undefined ? { status_category: input.statusCategory } : {}),
          ...(input.colorHex !== undefined ? { color_hex: input.colorHex } : {}),
          ...(input.wipLimit !== undefined ? { wip_limit: input.wipLimit } : {}),
          ...(input.sortOrder !== undefined ? { sort_order: input.sortOrder } : {}),
          ...(input.isDefaultInitial !== undefined
            ? { is_default_initial: input.isDefaultInitial ? 1 : 0 }
            : {}),
          ...(input.isDoneColumn !== undefined ? { is_done_column: input.isDoneColumn ? 1 : 0 } : {}),
          updated_by: auth.userId,
        })
        .where('id', '=', input.columnId)
        .execute();
    });
  }

  const detail = await getProjectDetail(auth, access.project.id);
  return detail.columns;
}

export async function createProjectLabel(
  auth: AuthContext,
  idOrCode: string | number,
  input: CreateLabelInput,
): Promise<ProjectLabelView[]> {
  const access = await assertProjectAccess(auth, idOrCode, 'MANAGE');
  const db = getDb();

  const existing = await db
    .selectFrom('project_labels')
    .select(['id', 'deleted_at'])
    .where('project_id', '=', access.project.id)
    .where('name', '=', input.name.trim())
    .executeTakeFirst();

  if (existing && !existing.deleted_at) {
    throw new AppError('LABEL_EXISTS', `Nhãn "${input.name.trim()}" đã tồn tại trong dự án.`, 409);
  }

  if (existing) {
    await db
      .updateTable('project_labels')
      .set({
        color_hex: input.colorHex ?? '#3B82F6',
        deleted_at: null,
        updated_by: auth.userId,
      })
      .where('id', '=', Number(existing.id))
      .execute();
  } else {
    await db
      .insertInto('project_labels')
      .values({
        project_id: access.project.id,
        name: input.name.trim(),
        color_hex: input.colorHex ?? '#3B82F6',
        created_by: auth.userId,
        updated_by: auth.userId,
      })
      .execute();
  }

  const detail = await getProjectDetail(auth, access.project.id);
  return detail.labels;
}

export async function updateProjectLabel(
  auth: AuthContext,
  idOrCode: string | number,
  input: UpdateLabelInput,
): Promise<ProjectLabelView[]> {
  const access = await assertProjectAccess(auth, idOrCode, 'MANAGE');
  const db = getDb();

  const label = await db
    .selectFrom('project_labels')
    .select(['id'])
    .where('id', '=', input.labelId)
    .where('project_id', '=', access.project.id)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (!label) {
    throw new AppError('LABEL_NOT_FOUND', 'Không tìm thấy nhãn dự án.', 404);
  }

  await db
    .updateTable('project_labels')
    .set({
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.colorHex !== undefined ? { color_hex: input.colorHex } : {}),
      ...(input.archive ? { deleted_at: new Date() } : {}),
      updated_by: auth.userId,
    })
    .where('id', '=', input.labelId)
    .execute();

  const detail = await getProjectDetail(auth, access.project.id);
  return detail.labels;
}

export async function recalculateProjectProgress(projectId: number): Promise<number> {
  const db = getDb();
  const row = await db
    .selectFrom('tasks')
    .select([
      sql<number>`COUNT(*)`.as('total'),
      sql<number>`SUM(CASE WHEN status_category = 'DONE' THEN 100 ELSE progress_percent END)`.as(
        'sum_progress',
      ),
    ])
    .where('project_id', '=', projectId)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  const total = Number(row?.total ?? 0);
  const progress = total > 0 ? Math.round((Number(row?.sum_progress ?? 0) / total) * 100) / 100 : 0;

  await db
    .updateTable('projects')
    .set({ progress_percent: progress.toFixed(2) })
    .where('id', '=', projectId)
    .execute();

  return progress;
}
