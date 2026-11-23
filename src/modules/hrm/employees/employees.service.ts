import crypto from 'node:crypto';
import {
  getDb,
  type EmployeeGender,
  type EmploymentStatus,
  type UserStatus,
} from '@/config/database';
import { formatDateVN } from '@/lib/portable/date-utils';
import { buildExcelBuffer, type ExcelColumn } from '@/lib/portable/excel-exporter';
import {
  buildPaginationMeta,
  parsePaginationParams,
  type PaginationMeta,
} from '@/lib/portable/pagination';
import { hashPassword } from '@/lib/portable/password-hasher';
import { wouldCreateCycle } from '@/lib/portable/tree-utils';
import { recordAuditLog } from '@/modules/audit/audit.service';
import type { AuthContext } from '@/modules/auth/auth.service';
import {
  listEmployeeDocuments,
  type EmployeeDocumentItem,
} from '@/modules/hrm/employees/employee-documents.service';
import type {
  CreateEmployeeInput,
  SelfUpdateEmployeeInput,
  UpdateEmployeeInput,
} from '@/modules/hrm/employees/employees.schema';
import {
  canViewSensitiveEmployeeFields,
  isEmployeeWithinScope,
  resolveEmployeeAccessScope,
  type EmployeeAccessScope,
} from '@/modules/hrm/employees/employees.scope';
import { getUnreturnedAssetsForEmployee } from '@/modules/hrm/office/assets.service';
import { AppError } from '@/shared/api-response';

const DEFAULT_EMPLOYEE_ROLE_CODE = 'EMPLOYEE';
const MAX_EXPORT_ROWS = 5000;

const ALLOWED_SORT_COLUMNS = [
  'employee_code',
  'full_name',
  'hire_date',
  'created_at',
] as const;

const GENDER_LABELS: Record<EmployeeGender, string> = {
  MALE: 'Nam',
  FEMALE: 'Nữ',
  OTHER: 'Khác',
};

const STATUS_LABELS: Record<EmploymentStatus, string> = {
  PROBATION: 'Thử việc',
  ACTIVE: 'Chính thức',
  ON_LEAVE: 'Tạm nghỉ',
  RESIGNED: 'Đã nghỉ việc',
  TERMINATED: 'Chấm dứt HĐ',
};

export interface EmployeeListItem {
  id: number;
  employeeCode: string;
  fullName: string;
  gender: EmployeeGender | null;
  dateOfBirth: string | null;
  phone: string | null;
  workEmail: string;
  branchId: number;
  branchCode: string;
  branchName: string;
  departmentId: number;
  departmentCode: string;
  departmentName: string;
  positionId: number;
  positionCode: string;
  positionName: string;
  managerId: number | null;
  managerName: string | null;
  hireDate: string;
  employmentStatus: EmploymentStatus;
  userId: number | null;
  userStatus: UserStatus | null;
  createdAt: string;
}

export interface EmployeeDetail360 extends EmployeeListItem {
  nationalId: string | null;
  taxCode: string | null;
  socialInsuranceNo: string | null;
  personalEmail: string | null;
  address: string | null;
  bankName: string | null;
  bankAccountNo: string | null;
  probationEndDate: string | null;
  terminationDate: string | null;
  dependentsCount: number;
  avatarUrl: string | null;
  note: string | null;
  userEmail: string | null;
  directReportsCount: number;
  documents: EmployeeDocumentItem[];
  sensitiveFieldsMasked: boolean;
}

export interface ProvisionedAccountInfo {
  userId: number;
  email: string;
  temporaryPassword: string;
  roleCode: string;
}

export interface EmployeeListQuery {
  page?: string | null;
  limit?: string | null;
  search?: string | null;
  branchId?: string | null;
  departmentId?: string | null;
  positionId?: string | null;
  status?: string | null;
  sortBy?: string | null;
  sortOrder?: string | null;
}

function toIsoDateOnly(value: Date | string | null): string | null {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return String(value).slice(0, 10);
}

function generateTemporaryPassword(): string {
  const randomHex = crypto.randomBytes(4).toString('hex');
  return `Op@${randomHex}9`;
}

function assertBranchWriteAllowed(auth: AuthContext, branchId: number): void {
  if (auth.isSuperAdmin || auth.dataScope === 'ALL' || auth.hasAllBranches) {
    return;
  }
  if (!auth.branchIds.includes(branchId)) {
    throw new AppError(
      'BRANCH_ACCESS_DENIED',
      'Bạn không có quyền thao tác hồ sơ nhân viên của chi nhánh này.',
      403,
    );
  }
}

function isEmptyScope(scope: EmployeeAccessScope): boolean {
  if (scope.mode === 'BRANCH' && scope.branchIds.length === 0) {
    return true;
  }
  if (
    scope.mode === 'DEPARTMENT' &&
    scope.departmentIds.length === 0 &&
    scope.selfEmployeeId === null
  ) {
    return true;
  }
  if (scope.mode === 'OWN' && scope.selfEmployeeId === null) {
    return true;
  }
  return false;
}

async function queryEmployeesWithScope(
  auth: AuthContext,
  query: EmployeeListQuery,
  options: { limit: number; offset: number; includeCount: boolean },
): Promise<{ items: EmployeeListItem[]; total: number }> {
  const scope = await resolveEmployeeAccessScope(auth);
  if (isEmptyScope(scope)) {
    return { items: [], total: 0 };
  }

  const db = getDb();
  let baseQuery = db
    .selectFrom('employees as e')
    .innerJoin('branches as b', 'b.id', 'e.branch_id')
    .innerJoin('departments as d', 'd.id', 'e.department_id')
    .innerJoin('positions as p', 'p.id', 'e.position_id')
    .leftJoin('employees as m', 'm.id', 'e.manager_id')
    .leftJoin('users as u', 'u.id', 'e.user_id')
    .where('e.deleted_at', 'is', null);

  if (scope.mode === 'BRANCH') {
    baseQuery = baseQuery.where('e.branch_id', 'in', scope.branchIds);
  } else if (scope.mode === 'DEPARTMENT') {
    baseQuery = baseQuery.where((eb) => {
      const conditions = [];
      if (scope.departmentIds.length > 0) {
        conditions.push(eb('e.department_id', 'in', scope.departmentIds));
      }
      if (scope.selfEmployeeId !== null) {
        conditions.push(eb('e.id', '=', scope.selfEmployeeId));
      }
      return eb.or(conditions);
    });
  } else if (scope.mode === 'OWN') {
    baseQuery = baseQuery.where('e.user_id', '=', auth.userId);
  }

  if (query.branchId) {
    const parsedBranchId = Number(query.branchId);
    if (Number.isInteger(parsedBranchId) && parsedBranchId > 0) {
      if (scope.mode === 'BRANCH' && !scope.branchIds.includes(parsedBranchId)) {
        throw new AppError(
          'BRANCH_ACCESS_DENIED',
          'Bạn không có quyền xem dữ liệu của chi nhánh này.',
          403,
        );
      }
      baseQuery = baseQuery.where('e.branch_id', '=', parsedBranchId);
    }
  }

  if (query.departmentId) {
    const parsedDeptId = Number(query.departmentId);
    if (Number.isInteger(parsedDeptId) && parsedDeptId > 0) {
      baseQuery = baseQuery.where('e.department_id', '=', parsedDeptId);
    }
  }

  if (query.positionId) {
    const parsedPosId = Number(query.positionId);
    if (Number.isInteger(parsedPosId) && parsedPosId > 0) {
      baseQuery = baseQuery.where('e.position_id', '=', parsedPosId);
    }
  }

  if (
    query.status === 'PROBATION' ||
    query.status === 'ACTIVE' ||
    query.status === 'ON_LEAVE' ||
    query.status === 'RESIGNED' ||
    query.status === 'TERMINATED'
  ) {
    baseQuery = baseQuery.where('e.employment_status', '=', query.status);
  }

  if (query.search && query.search.trim().length > 0) {
    const keyword = `%${query.search.trim()}%`;
    baseQuery = baseQuery.where((eb) =>
      eb.or([
        eb('e.employee_code', 'like', keyword),
        eb('e.full_name', 'like', keyword),
        eb('e.work_email', 'like', keyword),
        eb('e.phone', 'like', keyword),
      ]),
    );
  }

  let total = 0;
  if (options.includeCount) {
    const countRow = await baseQuery
      .select((eb) => eb.fn.count<number>('e.id').as('total'))
      .executeTakeFirst();
    total = Number(countRow?.total ?? 0);
  }

  const paginationSort = parsePaginationParams(
    { sortBy: query.sortBy, sortOrder: query.sortOrder },
    {
      allowedSortFields: ALLOWED_SORT_COLUMNS,
      defaultSortBy: 'employee_code',
      defaultSortOrder: 'asc',
    },
  );

  const sortCol = (paginationSort.sortBy ?? 'employee_code') as (typeof ALLOWED_SORT_COLUMNS)[number];
  const sortDirection = paginationSort.sortOrder;

  const rows = await baseQuery
    .select([
      'e.id',
      'e.employee_code',
      'e.full_name',
      'e.gender',
      'e.date_of_birth',
      'e.phone',
      'e.work_email',
      'e.branch_id',
      'b.code as branch_code',
      'b.name as branch_name',
      'e.department_id',
      'd.code as department_code',
      'd.name as department_name',
      'e.position_id',
      'p.code as position_code',
      'p.name as position_name',
      'e.manager_id',
      'm.full_name as manager_name',
      'e.hire_date',
      'e.employment_status',
      'e.user_id',
      'u.status as user_status',
      'e.created_at',
    ])
    .orderBy(`e.${sortCol}`, sortDirection)
    .limit(options.limit)
    .offset(options.offset)
    .execute();

  const items: EmployeeListItem[] = rows.map((row) => ({
    id: Number(row.id),
    employeeCode: row.employee_code,
    fullName: row.full_name,
    gender: row.gender,
    dateOfBirth: toIsoDateOnly(row.date_of_birth),
    phone: row.phone,
    workEmail: row.work_email,
    branchId: Number(row.branch_id),
    branchCode: row.branch_code,
    branchName: row.branch_name,
    departmentId: Number(row.department_id),
    departmentCode: row.department_code,
    departmentName: row.department_name,
    positionId: Number(row.position_id),
    positionCode: row.position_code,
    positionName: row.position_name,
    managerId: row.manager_id !== null ? Number(row.manager_id) : null,
    managerName: row.manager_name ?? null,
    hireDate: toIsoDateOnly(row.hire_date) ?? '',
    employmentStatus: row.employment_status,
    userId: row.user_id !== null ? Number(row.user_id) : null,
    userStatus: row.user_status ?? null,
    createdAt: new Date(row.created_at).toISOString(),
  }));

  return { items, total: options.includeCount ? total : items.length };
}

export async function listEmployees(
  auth: AuthContext,
  query: EmployeeListQuery,
): Promise<{ items: EmployeeListItem[]; meta: PaginationMeta }> {
  const pagination = parsePaginationParams(
    { page: query.page, limit: query.limit },
    { defaultLimit: 20, maxLimit: 100 },
  );

  const { items, total } = await queryEmployeesWithScope(auth, query, {
    limit: pagination.limit,
    offset: pagination.offset,
    includeCount: true,
  });

  return {
    items,
    meta: buildPaginationMeta(total, pagination.page, pagination.limit),
  };
}

async function fetchEmployeeDetailByRowId(
  auth: AuthContext,
  employeeId: number,
  skipScopeCheck: boolean,
): Promise<EmployeeDetail360> {
  const db = getDb();

  const row = await db
    .selectFrom('employees as e')
    .innerJoin('branches as b', 'b.id', 'e.branch_id')
    .innerJoin('departments as d', 'd.id', 'e.department_id')
    .innerJoin('positions as p', 'p.id', 'e.position_id')
    .leftJoin('employees as m', 'm.id', 'e.manager_id')
    .leftJoin('users as u', 'u.id', 'e.user_id')
    .select([
      'e.id',
      'e.user_id',
      'u.email as user_email',
      'u.status as user_status',
      'e.employee_code',
      'e.branch_id',
      'b.code as branch_code',
      'b.name as branch_name',
      'e.department_id',
      'd.code as department_code',
      'd.name as department_name',
      'e.position_id',
      'p.code as position_code',
      'p.name as position_name',
      'e.manager_id',
      'm.full_name as manager_name',
      'e.full_name',
      'e.gender',
      'e.date_of_birth',
      'e.national_id',
      'e.tax_code',
      'e.social_insurance_no',
      'e.phone',
      'e.work_email',
      'e.personal_email',
      'e.address',
      'e.bank_name',
      'e.bank_account_no',
      'e.hire_date',
      'e.probation_end_date',
      'e.termination_date',
      'e.employment_status',
      'e.dependents_count',
      'e.avatar_url',
      'e.note',
      'e.created_at',
    ])
    .where('e.id', '=', employeeId)
    .where('e.deleted_at', 'is', null)
    .executeTakeFirst();

  if (!row) {
    throw new AppError('EMPLOYEE_NOT_FOUND', 'Không tìm thấy hồ sơ nhân viên.', 404);
  }

  const targetUserId = row.user_id !== null ? Number(row.user_id) : null;
  if (!skipScopeCheck) {
    const scope = await resolveEmployeeAccessScope(auth);
    const allowed = isEmployeeWithinScope(
      scope,
      {
        id: Number(row.id),
        branchId: Number(row.branch_id),
        departmentId: Number(row.department_id),
        userId: targetUserId,
      },
      auth.userId,
    );
    if (!allowed) {
      throw new AppError(
        'FORBIDDEN',
        'Bạn không có quyền xem hồ sơ nhân viên này.',
        403,
      );
    }
  }

  const directReportsRow = await db
    .selectFrom('employees')
    .select((eb) => eb.fn.count<number>('id').as('total'))
    .where('manager_id', '=', employeeId)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  const documents = await listEmployeeDocuments(auth, employeeId, skipScopeCheck);
  const canViewSensitive =
    skipScopeCheck || canViewSensitiveEmployeeFields(auth, targetUserId);

  return {
    id: Number(row.id),
    employeeCode: row.employee_code,
    fullName: row.full_name,
    gender: row.gender,
    dateOfBirth: toIsoDateOnly(row.date_of_birth),
    phone: row.phone,
    workEmail: row.work_email,
    branchId: Number(row.branch_id),
    branchCode: row.branch_code,
    branchName: row.branch_name,
    departmentId: Number(row.department_id),
    departmentCode: row.department_code,
    departmentName: row.department_name,
    positionId: Number(row.position_id),
    positionCode: row.position_code,
    positionName: row.position_name,
    managerId: row.manager_id !== null ? Number(row.manager_id) : null,
    managerName: row.manager_name ?? null,
    hireDate: toIsoDateOnly(row.hire_date) ?? '',
    employmentStatus: row.employment_status,
    userId: targetUserId,
    userStatus: row.user_status ?? null,
    userEmail: row.user_email ?? null,
    createdAt: new Date(row.created_at).toISOString(),
    nationalId: canViewSensitive ? row.national_id : null,
    taxCode: canViewSensitive ? row.tax_code : null,
    socialInsuranceNo: canViewSensitive ? row.social_insurance_no : null,
    personalEmail: row.personal_email,
    address: row.address,
    bankName: canViewSensitive ? row.bank_name : null,
    bankAccountNo: canViewSensitive ? row.bank_account_no : null,
    probationEndDate: toIsoDateOnly(row.probation_end_date),
    terminationDate: toIsoDateOnly(row.termination_date),
    dependentsCount: Number(row.dependents_count),
    avatarUrl: row.avatar_url,
    note: row.note,
    directReportsCount: Number(directReportsRow?.total ?? 0),
    documents,
    sensitiveFieldsMasked: !canViewSensitive,
  };
}

export async function getEmployeeById(
  auth: AuthContext,
  employeeId: number,
): Promise<EmployeeDetail360> {
  return fetchEmployeeDetailByRowId(auth, employeeId, false);
}

export async function getMyEmployeeProfile(
  auth: AuthContext,
): Promise<EmployeeDetail360> {
  const db = getDb();
  const selfRow = await db
    .selectFrom('employees')
    .select(['id'])
    .where('user_id', '=', auth.userId)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (!selfRow) {
    throw new AppError(
      'EMPLOYEE_PROFILE_NOT_LINKED',
      'Tài khoản của bạn chưa được liên kết với hồ sơ nhân viên nào. Vui lòng liên hệ Phòng Nhân sự.',
      404,
    );
  }

  return fetchEmployeeDetailByRowId(auth, Number(selfRow.id), true);
}

async function validateOrgReferences(params: {
  branchId: number;
  departmentId: number;
  positionId: number;
  managerId?: number | null;
  currentEmployeeId?: number;
}): Promise<void> {
  const db = getDb();

  const [branch, dept, pos] = await Promise.all([
    db
      .selectFrom('branches')
      .select(['id'])
      .where('id', '=', params.branchId)
      .where('deleted_at', 'is', null)
      .executeTakeFirst(),
    db
      .selectFrom('departments')
      .select(['id', 'branch_id'])
      .where('id', '=', params.departmentId)
      .where('deleted_at', 'is', null)
      .executeTakeFirst(),
    db
      .selectFrom('positions')
      .select(['id'])
      .where('id', '=', params.positionId)
      .where('deleted_at', 'is', null)
      .executeTakeFirst(),
  ]);

  if (!branch) {
    throw new AppError('INVALID_BRANCH', 'Chi nhánh được chọn không tồn tại.', 400);
  }
  if (!dept) {
    throw new AppError('INVALID_DEPARTMENT', 'Phòng ban được chọn không tồn tại.', 400);
  }
  if (Number(dept.branch_id) !== params.branchId) {
    throw new AppError(
      'DEPARTMENT_BRANCH_MISMATCH',
      'Phòng ban phải thuộc cùng chi nhánh đã chọn.',
      400,
    );
  }
  if (!pos) {
    throw new AppError('INVALID_POSITION', 'Chức danh được chọn không tồn tại.', 400);
  }

  if (params.managerId) {
    if (params.currentEmployeeId && params.managerId === params.currentEmployeeId) {
      throw new AppError(
        'MANAGER_CYCLE_DETECTED',
        'Nhân viên không thể là quản lý trực tiếp của chính mình.',
        400,
      );
    }

    const manager = await db
      .selectFrom('employees')
      .select(['id'])
      .where('id', '=', params.managerId)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();

    if (!manager) {
      throw new AppError('INVALID_MANAGER', 'Quản lý trực tiếp được chọn không tồn tại.', 400);
    }

    if (params.currentEmployeeId) {
      const allManagers = await db
        .selectFrom('employees')
        .select(['id', 'manager_id'])
        .where('deleted_at', 'is', null)
        .execute();

      const flat = allManagers.map((row) => ({
        id: Number(row.id),
        parentId: row.manager_id !== null ? Number(row.manager_id) : null,
      }));

      if (wouldCreateCycle(flat, params.currentEmployeeId, params.managerId)) {
        throw new AppError(
          'MANAGER_CYCLE_DETECTED',
          'Không thể gán quản lý trực tiếp gây vòng lặp phân cấp.',
          400,
        );
      }
    }
  }
}

export async function createEmployee(
  auth: AuthContext,
  input: CreateEmployeeInput,
  ipAddress: string | null,
): Promise<{
  employee: EmployeeDetail360;
  provisionedAccount: ProvisionedAccountInfo | null;
}> {
  assertBranchWriteAllowed(auth, input.branchId);
  await validateOrgReferences({
    branchId: input.branchId,
    departmentId: input.departmentId,
    positionId: input.positionId,
    managerId: input.managerId ?? null,
  });

  const db = getDb();

  const [dupCode, dupEmail] = await Promise.all([
    db
      .selectFrom('employees')
      .select(['id'])
      .where('employee_code', '=', input.employeeCode)
      .executeTakeFirst(),
    db
      .selectFrom('employees')
      .select(['id'])
      .where('work_email', '=', input.workEmail)
      .executeTakeFirst(),
  ]);

  if (dupCode) {
    throw new AppError(
      'EMPLOYEE_CODE_EXISTS',
      `Mã nhân viên "${input.employeeCode}" đã tồn tại.`,
      409,
    );
  }
  if (dupEmail) {
    throw new AppError(
      'WORK_EMAIL_EXISTS',
      `Email công việc "${input.workEmail}" đã tồn tại trong hệ thống.`,
      409,
    );
  }

  let linkedUserId: number | null = null;
  let provisionedAccount: ProvisionedAccountInfo | null = null;
  let rawTempPassword: string | null = null;
  let passwordHash: string | null = null;
  let employeeRoleId: number | null = null;

  if (input.autoCreateAccount) {
    const existingUser = await db
      .selectFrom('users')
      .select(['id'])
      .where('email', '=', input.workEmail)
      .executeTakeFirst();

    if (existingUser) {
      throw new AppError(
        'USER_EMAIL_EXISTS',
        `Tài khoản đăng nhập với email "${input.workEmail}" đã tồn tại. Vui lòng tắt tự tạo tài khoản và chọn liên kết thủ công.`,
        409,
      );
    }

    const roleRow = await db
      .selectFrom('roles')
      .select(['id'])
      .where('code', '=', DEFAULT_EMPLOYEE_ROLE_CODE)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();

    if (!roleRow) {
      throw new AppError(
        'DEFAULT_ROLE_MISSING',
        'Không tìm thấy vai trò mặc định EMPLOYEE để cấp tài khoản.',
        500,
      );
    }

    employeeRoleId = Number(roleRow.id);
    rawTempPassword = input.initialPassword ?? generateTemporaryPassword();
    passwordHash = await hashPassword(rawTempPassword);
  } else if (input.userId) {
    const targetUser = await db
      .selectFrom('users')
      .select(['id'])
      .where('id', '=', input.userId)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();

    if (!targetUser) {
      throw new AppError('USER_NOT_FOUND', 'Tài khoản người dùng liên kết không tồn tại.', 400);
    }

    const alreadyLinked = await db
      .selectFrom('employees')
      .select(['id'])
      .where('user_id', '=', input.userId)
      .executeTakeFirst();

    if (alreadyLinked) {
      throw new AppError(
        'USER_ALREADY_LINKED',
        'Tài khoản người dùng này đã được liên kết với một hồ sơ nhân viên khác.',
        409,
      );
    }
    linkedUserId = input.userId;
  }

  const createdEmployeeId = await db.transaction().execute(async (trx) => {
    if (input.autoCreateAccount && passwordHash && employeeRoleId && rawTempPassword) {
      const insertedUser = await trx
        .insertInto('users')
        .values({
          email: input.workEmail,
          password_hash: passwordHash,
          full_name: input.fullName,
          status: 'ACTIVE',
          created_by: auth.userId,
          updated_by: auth.userId,
        })
        .executeTakeFirstOrThrow();

      linkedUserId = Number(insertedUser.insertId);
      await trx
        .insertInto('user_roles')
        .values({
          user_id: linkedUserId,
          role_id: employeeRoleId,
          branch_id: input.branchId,
        })
        .execute();

      provisionedAccount = {
        userId: linkedUserId,
        email: input.workEmail,
        temporaryPassword: rawTempPassword,
        roleCode: DEFAULT_EMPLOYEE_ROLE_CODE,
      };
    }

    const insertedEmp = await trx
      .insertInto('employees')
      .values({
        user_id: linkedUserId,
        employee_code: input.employeeCode,
        branch_id: input.branchId,
        department_id: input.departmentId,
        position_id: input.positionId,
        manager_id: input.managerId ?? null,
        full_name: input.fullName,
        gender: input.gender ?? null,
        date_of_birth: input.dateOfBirth ?? null,
        national_id: input.nationalId ?? null,
        tax_code: input.taxCode ?? null,
        social_insurance_no: input.socialInsuranceNo ?? null,
        phone: input.phone ?? null,
        work_email: input.workEmail,
        personal_email: input.personalEmail ?? null,
        address: input.address ?? null,
        bank_name: input.bankName ?? null,
        bank_account_no: input.bankAccountNo ?? null,
        hire_date: input.hireDate,
        probation_end_date: input.probationEndDate ?? null,
        termination_date: input.terminationDate ?? null,
        employment_status: input.employmentStatus,
        dependents_count: input.dependentsCount,
        note: input.note ?? null,
        created_by: auth.userId,
        updated_by: auth.userId,
      })
      .executeTakeFirstOrThrow();

    return Number(insertedEmp.insertId);
  });

  await recordAuditLog({
    userId: auth.userId,
    moduleCode: 'hrm',
    action: 'HRM_EMPLOYEE_CREATE',
    entityType: 'employees',
    entityId: createdEmployeeId,
    newValues: {
      employeeCode: input.employeeCode,
      fullName: input.fullName,
      branchId: input.branchId,
      departmentId: input.departmentId,
      positionId: input.positionId,
      autoCreateAccount: input.autoCreateAccount,
      linkedUserId,
    },
    ipAddress,
  });

  const employee = await getEmployeeById(auth, createdEmployeeId);
  return { employee, provisionedAccount };
}

export async function updateEmployee(
  auth: AuthContext,
  employeeId: number,
  input: UpdateEmployeeInput,
  ipAddress: string | null,
): Promise<EmployeeDetail360> {
  const db = getDb();

  const existing = await db
    .selectFrom('employees')
    .select([
      'id',
      'user_id',
      'employee_code',
      'branch_id',
      'department_id',
      'position_id',
      'manager_id',
      'full_name',
      'work_email',
      'employment_status',
    ])
    .where('id', '=', employeeId)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (!existing) {
    throw new AppError('EMPLOYEE_NOT_FOUND', 'Không tìm thấy hồ sơ nhân viên.', 404);
  }

  const scope = await resolveEmployeeAccessScope(auth);
  const existingUserId = existing.user_id !== null ? Number(existing.user_id) : null;
  if (
    !isEmployeeWithinScope(
      scope,
      {
        id: Number(existing.id),
        branchId: Number(existing.branch_id),
        departmentId: Number(existing.department_id),
        userId: existingUserId,
      },
      auth.userId,
    )
  ) {
    throw new AppError('FORBIDDEN', 'Bạn không có quyền cập nhật hồ sơ nhân viên này.', 403);
  }

  const nextBranchId = input.branchId ?? Number(existing.branch_id);
  const nextDepartmentId = input.departmentId ?? Number(existing.department_id);
  const nextPositionId = input.positionId ?? Number(existing.position_id);
  const nextManagerId =
    input.managerId !== undefined
      ? input.managerId
      : existing.manager_id !== null
        ? Number(existing.manager_id)
        : null;

  assertBranchWriteAllowed(auth, Number(existing.branch_id));
  assertBranchWriteAllowed(auth, nextBranchId);

  await validateOrgReferences({
    branchId: nextBranchId,
    departmentId: nextDepartmentId,
    positionId: nextPositionId,
    managerId: nextManagerId,
    currentEmployeeId: employeeId,
  });

  if (input.employeeCode && input.employeeCode !== existing.employee_code) {
    const dupCode = await db
      .selectFrom('employees')
      .select(['id'])
      .where('employee_code', '=', input.employeeCode)
      .where('id', '!=', employeeId)
      .executeTakeFirst();
    if (dupCode) {
      throw new AppError(
        'EMPLOYEE_CODE_EXISTS',
        `Mã nhân viên "${input.employeeCode}" đã tồn tại.`,
        409,
      );
    }
  }

  if (input.workEmail && input.workEmail !== existing.work_email) {
    const dupEmail = await db
      .selectFrom('employees')
      .select(['id'])
      .where('work_email', '=', input.workEmail)
      .where('id', '!=', employeeId)
      .executeTakeFirst();
    if (dupEmail) {
      throw new AppError(
        'WORK_EMAIL_EXISTS',
        `Email công việc "${input.workEmail}" đã tồn tại.`,
        409,
      );
    }
  }

  const nextStatus = input.employmentStatus ?? existing.employment_status;
  const isTransitioningToOffboard =
    (nextStatus === 'RESIGNED' || nextStatus === 'TERMINATED') &&
    existing.employment_status !== nextStatus;

  if (isTransitioningToOffboard && !input.forceOffboardWithUnreturnedAssets) {
    const unreturnedAssets = await getUnreturnedAssetsForEmployee(employeeId);
    if (unreturnedAssets.length > 0) {
      const codes = unreturnedAssets.map((a) => `${a.assetCode} (${a.assetName})`).join(', ');
      throw new AppError(
        'UNRETURNED_ASSETS_WARNING',
        `Nhân viên vẫn còn ${unreturnedAssets.length} tài sản đang cấp phát chưa thu hồi: ${codes}. Vui lòng thu hồi thiết bị trước khi hoàn tất nghỉ việc.`,
        409,
        unreturnedAssets.map((a) => ({
          field: a.assetCode,
          message: `${a.assetCode} — ${a.assetName} (cấp phát ngày ${a.assignedAt})`,
        })),
      );
    }
  }

  const shouldLockUser =
    (nextStatus === 'RESIGNED' || nextStatus === 'TERMINATED') &&
    input.lockAccountOnTermination !== false &&
    existingUserId !== null &&
    existingUserId !== auth.userId;

  await db.transaction().execute(async (trx) => {
    const updatePayload: Record<string, unknown> = {
      branch_id: nextBranchId,
      department_id: nextDepartmentId,
      position_id: nextPositionId,
      manager_id: nextManagerId,
      employment_status: nextStatus,
      updated_by: auth.userId,
    };

    if (input.employeeCode !== undefined) updatePayload.employee_code = input.employeeCode;
    if (input.fullName !== undefined) updatePayload.full_name = input.fullName;
    if (input.gender !== undefined) updatePayload.gender = input.gender;
    if (input.dateOfBirth !== undefined) updatePayload.date_of_birth = input.dateOfBirth;
    if (input.nationalId !== undefined) updatePayload.national_id = input.nationalId;
    if (input.taxCode !== undefined) updatePayload.tax_code = input.taxCode;
    if (input.socialInsuranceNo !== undefined) updatePayload.social_insurance_no = input.socialInsuranceNo;
    if (input.phone !== undefined) updatePayload.phone = input.phone;
    if (input.workEmail !== undefined) updatePayload.work_email = input.workEmail;
    if (input.personalEmail !== undefined) updatePayload.personal_email = input.personalEmail;
    if (input.address !== undefined) updatePayload.address = input.address;
    if (input.bankName !== undefined) updatePayload.bank_name = input.bankName;
    if (input.bankAccountNo !== undefined) updatePayload.bank_account_no = input.bankAccountNo;
    if (input.hireDate !== undefined) updatePayload.hire_date = input.hireDate;
    if (input.probationEndDate !== undefined) updatePayload.probation_end_date = input.probationEndDate;
    if (input.terminationDate !== undefined) updatePayload.termination_date = input.terminationDate;
    if (input.dependentsCount !== undefined) updatePayload.dependents_count = input.dependentsCount;
    if (input.note !== undefined) updatePayload.note = input.note;

    await trx
      .updateTable('employees')
      .set(updatePayload)
      .where('id', '=', employeeId)
      .execute();

    if (shouldLockUser && existingUserId !== null) {
      await trx
        .updateTable('users')
        .set({ status: 'LOCKED', updated_by: auth.userId })
        .where('id', '=', existingUserId)
        .execute();

      await trx
        .updateTable('refresh_tokens')
        .set({ revoked_at: new Date() })
        .where('user_id', '=', existingUserId)
        .where('revoked_at', 'is', null)
        .execute();
    }
  });

  await recordAuditLog({
    userId: auth.userId,
    moduleCode: 'hrm',
    action: 'HRM_EMPLOYEE_UPDATE',
    entityType: 'employees',
    entityId: employeeId,
    oldValues: {
      employeeCode: existing.employee_code,
      fullName: existing.full_name,
      branchId: Number(existing.branch_id),
      departmentId: Number(existing.department_id),
      positionId: Number(existing.position_id),
      employmentStatus: existing.employment_status,
    },
    newValues: {
      employeeCode: input.employeeCode ?? existing.employee_code,
      fullName: input.fullName ?? existing.full_name,
      branchId: nextBranchId,
      departmentId: nextDepartmentId,
      positionId: nextPositionId,
      employmentStatus: nextStatus,
      lockedLinkedAccount: shouldLockUser,
    },
    ipAddress,
  });

  return getEmployeeById(auth, employeeId);
}

export async function selfUpdateMyEmployeeProfile(
  auth: AuthContext,
  input: SelfUpdateEmployeeInput,
  ipAddress: string | null,
): Promise<EmployeeDetail360> {
  const db = getDb();
  const selfRow = await db
    .selectFrom('employees')
    .select(['id', 'phone', 'personal_email', 'address', 'bank_name', 'bank_account_no'])
    .where('user_id', '=', auth.userId)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (!selfRow) {
    throw new AppError(
      'EMPLOYEE_PROFILE_NOT_LINKED',
      'Tài khoản của bạn chưa được liên kết với hồ sơ nhân viên nào.',
      404,
    );
  }

  const employeeId = Number(selfRow.id);
  const updatePayload: Record<string, unknown> = { updated_by: auth.userId };
  if (input.phone !== undefined) updatePayload.phone = input.phone;
  if (input.personalEmail !== undefined) updatePayload.personal_email = input.personalEmail;
  if (input.address !== undefined) updatePayload.address = input.address;
  if (input.bankName !== undefined) updatePayload.bank_name = input.bankName;
  if (input.bankAccountNo !== undefined) updatePayload.bank_account_no = input.bankAccountNo;

  await db
    .updateTable('employees')
    .set(updatePayload)
    .where('id', '=', employeeId)
    .execute();

  await recordAuditLog({
    userId: auth.userId,
    moduleCode: 'hrm',
    action: 'HRM_EMPLOYEE_SELF_UPDATE',
    entityType: 'employees',
    entityId: employeeId,
    oldValues: {
      phone: selfRow.phone,
      personalEmail: selfRow.personal_email,
      address: selfRow.address,
    },
    newValues: {
      phone: input.phone ?? selfRow.phone,
      personalEmail: input.personalEmail ?? selfRow.personal_email,
      address: input.address ?? selfRow.address,
    },
    ipAddress,
  });

  return fetchEmployeeDetailByRowId(auth, employeeId, true);
}

export async function softDeleteEmployee(
  auth: AuthContext,
  employeeId: number,
  ipAddress: string | null,
): Promise<void> {
  const db = getDb();
  const existing = await db
    .selectFrom('employees')
    .select(['id', 'user_id', 'branch_id', 'department_id', 'employee_code', 'full_name'])
    .where('id', '=', employeeId)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (!existing) {
    throw new AppError('EMPLOYEE_NOT_FOUND', 'Không tìm thấy hồ sơ nhân viên.', 404);
  }

  const existingUserId = existing.user_id !== null ? Number(existing.user_id) : null;
  if (existingUserId !== null && existingUserId === auth.userId) {
    throw new AppError(
      'CANNOT_DELETE_SELF',
      'Bạn không thể xóa hồ sơ nhân viên đang gắn với tài khoản của chính mình.',
      400,
    );
  }

  assertBranchWriteAllowed(auth, Number(existing.branch_id));

  await db.transaction().execute(async (trx) => {
    await trx
      .updateTable('departments')
      .set({ manager_employee_id: null, updated_by: auth.userId })
      .where('manager_employee_id', '=', employeeId)
      .execute();

    await trx
      .updateTable('employees')
      .set({ manager_id: null, updated_by: auth.userId })
      .where('manager_id', '=', employeeId)
      .execute();

    await trx
      .updateTable('employees')
      .set({ deleted_at: new Date(), updated_by: auth.userId })
      .where('id', '=', employeeId)
      .execute();

    if (existingUserId !== null) {
      await trx
        .updateTable('users')
        .set({ status: 'LOCKED', updated_by: auth.userId })
        .where('id', '=', existingUserId)
        .execute();

      await trx
        .updateTable('refresh_tokens')
        .set({ revoked_at: new Date() })
        .where('user_id', '=', existingUserId)
        .where('revoked_at', 'is', null)
        .execute();
    }
  });

  await recordAuditLog({
    userId: auth.userId,
    moduleCode: 'hrm',
    action: 'HRM_EMPLOYEE_DELETE',
    entityType: 'employees',
    entityId: employeeId,
    oldValues: {
      employeeCode: existing.employee_code,
      fullName: existing.full_name,
    },
    ipAddress,
  });
}

export async function exportEmployeesToExcel(
  auth: AuthContext,
  query: EmployeeListQuery,
): Promise<{ buffer: Buffer; filename: string; rowCount: number }> {
  const { items } = await queryEmployeesWithScope(auth, query, {
    limit: MAX_EXPORT_ROWS,
    offset: 0,
    includeCount: false,
  });

  const columns: ExcelColumn<EmployeeListItem>[] = [
    { header: 'STT', key: 'stt', width: 8, align: 'center', value: (_, i) => i + 1 },
    { header: 'Mã NV', key: 'employeeCode', width: 14 },
    { header: 'Họ và tên', key: 'fullName', width: 26 },
    {
      header: 'Giới tính',
      key: 'gender',
      width: 12,
      align: 'center',
      value: (row) => (row.gender ? GENDER_LABELS[row.gender] : ''),
    },
    {
      header: 'Ngày sinh',
      key: 'dateOfBirth',
      width: 14,
      align: 'center',
      value: (row) => (row.dateOfBirth ? formatDateVN(row.dateOfBirth) : ''),
    },
    { header: 'Email công việc', key: 'workEmail', width: 28 },
    { header: 'Điện thoại', key: 'phone', width: 16, value: (row) => row.phone ?? '' },
    { header: 'Chi nhánh', key: 'branchName', width: 22 },
    { header: 'Phòng ban', key: 'departmentName', width: 24 },
    { header: 'Chức danh', key: 'positionName', width: 24 },
    {
      header: 'Quản lý trực tiếp',
      key: 'managerName',
      width: 22,
      value: (row) => row.managerName ?? '',
    },
    {
      header: 'Ngày vào làm',
      key: 'hireDate',
      width: 14,
      align: 'center',
      value: (row) => formatDateVN(row.hireDate),
    },
    {
      header: 'Trạng thái',
      key: 'employmentStatus',
      width: 16,
      align: 'center',
      value: (row) => STATUS_LABELS[row.employmentStatus],
    },
    {
      header: 'Tài khoản Portal',
      key: 'userStatus',
      width: 18,
      align: 'center',
      value: (row) =>
        row.userId === null
          ? 'Chưa liên kết'
          : row.userStatus === 'LOCKED'
            ? 'Đã khóa'
            : 'Đang hoạt động',
    },
  ];

  const today = new Date();
  const dateStamp = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
  const buffer = await buildExcelBuffer(items, columns, {
    sheetName: 'DanhSachNhanVien',
    title: 'DANH SÁCH HỒ SƠ NHÂN VIÊN — OPERON HUB',
    subtitle: `Ngày xuất: ${formatDateVN(today)} • Tổng số: ${items.length} nhân sự`,
    freezeHeader: true,
    autoFilter: true,
  });

  return {
    buffer,
    filename: `danh-sach-nhan-vien-${dateStamp}.xlsx`,
    rowCount: items.length,
  };
}
