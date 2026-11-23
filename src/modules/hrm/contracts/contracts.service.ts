import {
  getDb,
  type ContractStatus,
  type ContractType,
} from '@/config/database';
import { roundCurrency } from '@/lib/portable/currency-utils';
import { formatDateVN } from '@/lib/portable/date-utils';
import { buildExcelBuffer, type ExcelColumn } from '@/lib/portable/excel-exporter';
import {
  buildPaginationMeta,
  parsePaginationParams,
  type PaginationMeta,
} from '@/lib/portable/pagination';
import { recordAuditLog } from '@/modules/audit/audit.service';
import type { AuthContext } from '@/modules/auth/auth.service';
import type {
  ContractAllowanceItem,
  CreateContractInput,
  UpdateContractInput,
} from '@/modules/hrm/contracts/contracts.schema';
import {
  isEmployeeWithinScope,
  resolveEmployeeAccessScope,
  type EmployeeAccessScope,
} from '@/modules/hrm/employees/employees.scope';
import { AppError } from '@/shared/api-response';

export type ContractExpiryAlertLevel =
  | 'NONE'
  | 'OVERDUE'
  | 'URGENT_15D'
  | 'WARNING_30D'
  | 'SAFE';

export interface ContractExpiryInfo {
  level: ContractExpiryAlertLevel;
  daysRemaining: number | null;
}

export interface ContractItem {
  id: number;
  employeeId: number;
  employeeCode: string;
  employeeName: string;
  branchId: number;
  branchCode: string;
  branchName: string;
  departmentId: number;
  departmentName: string;
  positionName: string;
  contractNo: string;
  contractType: ContractType;
  startDate: string;
  endDate: string | null;
  baseSalary: number;
  insuranceSalary: number;
  allowances: ContractAllowanceItem[];
  totalAllowances: number;
  status: ContractStatus;
  signedDate: string | null;
  note: string | null;
  expiryLevel: ContractExpiryAlertLevel;
  daysRemaining: number | null;
  createdAt: string;
}

export interface ExpiringContractsSummary {
  overdueCount: number;
  urgent15Count: number;
  warning30Count: number;
  totalAlertCount: number;
}

export interface ContractListQuery {
  page?: string | null;
  limit?: string | null;
  search?: string | null;
  branchId?: string | null;
  employeeId?: string | null;
  contractType?: string | null;
  status?: string | null;
  expiryAlert?: string | null;
}

const CONTRACT_TYPE_LABELS: Record<ContractType, string> = {
  PROBATION: 'Thử việc',
  FIXED_TERM: 'Xác định thời hạn',
  INDEFINITE: 'Không xác định thời hạn',
  PART_TIME: 'Bán thời gian / CTV',
};

const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
  DRAFT: 'Nháp',
  ACTIVE: 'Đang hiệu lực',
  EXPIRED: 'Hết hạn',
  TERMINATED: 'Đã chấm dứt',
};

const EXPIRY_LEVEL_LABELS: Record<ContractExpiryAlertLevel, string> = {
  NONE: 'Không áp dụng',
  OVERDUE: 'Đã quá hạn',
  URGENT_15D: 'Khẩn cấp (<= 15 ngày)',
  WARNING_30D: 'Sắp hết hạn (<= 30 ngày)',
  SAFE: 'Còn hạn > 30 ngày',
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MAX_EXPORT_ROWS = 5000;

function toIsoDateOnly(value: Date | string | null): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function parseUtcMidnight(isoDate: string): number {
  const [y, m, d] = isoDate.slice(0, 10).split('-').map(Number);
  return Date.UTC(y, (m || 1) - 1, d || 1);
}

export function classifyContractExpiry(
  endDate: string | null,
  status: ContractStatus,
  referenceDate: Date | string = new Date(),
): ContractExpiryInfo {
  if (status !== 'ACTIVE' || !endDate) {
    return { level: 'NONE', daysRemaining: null };
  }

  const refIso =
    referenceDate instanceof Date
      ? referenceDate.toISOString().slice(0, 10)
      : String(referenceDate).slice(0, 10);

  const diffMs = parseUtcMidnight(endDate) - parseUtcMidnight(refIso);
  const daysRemaining = Math.round(diffMs / MS_PER_DAY);

  if (daysRemaining < 0) {
    return { level: 'OVERDUE', daysRemaining };
  }
  if (daysRemaining <= 15) {
    return { level: 'URGENT_15D', daysRemaining };
  }
  if (daysRemaining <= 30) {
    return { level: 'WARNING_30D', daysRemaining };
  }
  return { level: 'SAFE', daysRemaining };
}

export function validateContractDates(
  contractType: ContractType,
  startDate: string,
  endDate: string | null,
): string | null {
  if (contractType === 'INDEFINITE') {
    return null;
  }
  if ((contractType === 'PROBATION' || contractType === 'FIXED_TERM') && !endDate) {
    throw new AppError(
      'INVALID_CONTRACT_DATES',
      'Hợp đồng thử việc hoặc xác định thời hạn bắt buộc phải có ngày kết thúc.',
      400,
    );
  }
  if (endDate && endDate < startDate) {
    throw new AppError(
      'INVALID_CONTRACT_DATES',
      'Ngày kết thúc hợp đồng không được nhỏ hơn ngày bắt đầu.',
      400,
    );
  }
  return endDate;
}

function parseAllowancesJson(raw: unknown): ContractAllowanceItem[] {
  if (!raw) return [];
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
      .map((item) => ({
        code: String(item.code ?? ''),
        label: String(item.label ?? ''),
        amount: roundCurrency(Number(item.amount ?? 0)),
      }))
      .filter((item) => item.code.length > 0 && item.label.length > 0);
  } catch {
    return [];
  }
}

function isEmptyScope(scope: EmployeeAccessScope): boolean {
  if (scope.mode === 'BRANCH' && scope.branchIds.length === 0) return true;
  if (
    scope.mode === 'DEPARTMENT' &&
    scope.departmentIds.length === 0 &&
    scope.selfEmployeeId === null
  ) {
    return true;
  }
  if (scope.mode === 'OWN' && scope.selfEmployeeId === null) return true;
  return false;
}

function addDaysToIso(baseDate: Date, offsetDays: number): string {
  const utc = parseUtcMidnight(baseDate.toISOString().slice(0, 10)) + offsetDays * MS_PER_DAY;
  return new Date(utc).toISOString().slice(0, 10);
}

async function queryContractsWithScope(
  auth: AuthContext,
  query: ContractListQuery,
  options: { limit: number; offset: number; includeCount: boolean },
): Promise<{ items: ContractItem[]; total: number }> {
  const scope = await resolveEmployeeAccessScope(auth);
  if (isEmptyScope(scope)) {
    return { items: [], total: 0 };
  }

  const db = getDb();
  let baseQuery = db
    .selectFrom('employee_contracts as c')
    .innerJoin('employees as e', 'e.id', 'c.employee_id')
    .innerJoin('branches as b', 'b.id', 'e.branch_id')
    .innerJoin('departments as d', 'd.id', 'e.department_id')
    .innerJoin('positions as p', 'p.id', 'e.position_id')
    .where('c.deleted_at', 'is', null)
    .where('e.deleted_at', 'is', null);

  if (scope.mode === 'BRANCH') {
    baseQuery = baseQuery.where('e.branch_id', 'in', scope.branchIds);
  } else if (scope.mode === 'DEPARTMENT') {
    baseQuery = baseQuery.where((eb) => {
      const conds = [];
      if (scope.departmentIds.length > 0) conds.push(eb('e.department_id', 'in', scope.departmentIds));
      if (scope.selfEmployeeId !== null) conds.push(eb('e.id', '=', scope.selfEmployeeId));
      return eb.or(conds);
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
          'Bạn không có quyền xem hợp đồng của chi nhánh này.',
          403,
        );
      }
      baseQuery = baseQuery.where('e.branch_id', '=', parsedBranchId);
    }
  }

  if (query.employeeId) {
    const parsedEmpId = Number(query.employeeId);
    if (Number.isInteger(parsedEmpId) && parsedEmpId > 0) {
      baseQuery = baseQuery.where('c.employee_id', '=', parsedEmpId);
    }
  }

  if (
    query.contractType === 'PROBATION' ||
    query.contractType === 'FIXED_TERM' ||
    query.contractType === 'INDEFINITE' ||
    query.contractType === 'PART_TIME'
  ) {
    baseQuery = baseQuery.where('c.contract_type', '=', query.contractType);
  }

  if (
    query.status === 'DRAFT' ||
    query.status === 'ACTIVE' ||
    query.status === 'EXPIRED' ||
    query.status === 'TERMINATED'
  ) {
    baseQuery = baseQuery.where('c.status', '=', query.status);
  }

  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);
  if (query.expiryAlert === 'OVERDUE') {
    baseQuery = baseQuery
      .where('c.status', '=', 'ACTIVE')
      .where('c.end_date', 'is not', null)
      .where('c.end_date', '<', todayIso);
  } else if (query.expiryAlert === 'URGENT_15D') {
    baseQuery = baseQuery
      .where('c.status', '=', 'ACTIVE')
      .where('c.end_date', '>=', todayIso)
      .where('c.end_date', '<=', addDaysToIso(today, 15));
  } else if (query.expiryAlert === 'WARNING_30D') {
    baseQuery = baseQuery
      .where('c.status', '=', 'ACTIVE')
      .where('c.end_date', '>', addDaysToIso(today, 15))
      .where('c.end_date', '<=', addDaysToIso(today, 30));
  } else if (query.expiryAlert === 'ALL_ALERTS') {
    baseQuery = baseQuery
      .where('c.status', '=', 'ACTIVE')
      .where('c.end_date', 'is not', null)
      .where('c.end_date', '<=', addDaysToIso(today, 30));
  }

  if (query.search && query.search.trim().length > 0) {
    const keyword = `%${query.search.trim()}%`;
    baseQuery = baseQuery.where((eb) =>
      eb.or([
        eb('c.contract_no', 'like', keyword),
        eb('e.employee_code', 'like', keyword),
        eb('e.full_name', 'like', keyword),
      ]),
    );
  }

  let total = 0;
  if (options.includeCount) {
    const countRow = await baseQuery
      .select((eb) => eb.fn.count<number>('c.id').as('total'))
      .executeTakeFirst();
    total = Number(countRow?.total ?? 0);
  }

  const rows = await baseQuery
    .select([
      'c.id',
      'c.employee_id',
      'e.employee_code',
      'e.full_name as employee_name',
      'e.branch_id',
      'b.code as branch_code',
      'b.name as branch_name',
      'e.department_id',
      'd.name as department_name',
      'p.name as position_name',
      'c.contract_no',
      'c.contract_type',
      'c.start_date',
      'c.end_date',
      'c.base_salary',
      'c.insurance_salary',
      'c.allowances_json',
      'c.status',
      'c.signed_date',
      'c.note',
      'c.created_at',
    ])
    .orderBy('c.start_date', 'desc')
    .orderBy('c.id', 'desc')
    .limit(options.limit)
    .offset(options.offset)
    .execute();

  const items: ContractItem[] = rows.map((row) => {
    const endDate = toIsoDateOnly(row.end_date);
    const allowances = parseAllowancesJson(row.allowances_json);
    const totalAllowances = roundCurrency(
      allowances.reduce((sum, item) => sum + item.amount, 0),
    );
    const expiry = classifyContractExpiry(endDate, row.status, today);

    return {
      id: Number(row.id),
      employeeId: Number(row.employee_id),
      employeeCode: row.employee_code,
      employeeName: row.employee_name,
      branchId: Number(row.branch_id),
      branchCode: row.branch_code,
      branchName: row.branch_name,
      departmentId: Number(row.department_id),
      departmentName: row.department_name,
      positionName: row.position_name,
      contractNo: row.contract_no,
      contractType: row.contract_type,
      startDate: toIsoDateOnly(row.start_date) ?? '',
      endDate,
      baseSalary: roundCurrency(Number(row.base_salary)),
      insuranceSalary: roundCurrency(Number(row.insurance_salary)),
      allowances,
      totalAllowances,
      status: row.status,
      signedDate: toIsoDateOnly(row.signed_date),
      note: row.note,
      expiryLevel: expiry.level,
      daysRemaining: expiry.daysRemaining,
      createdAt: new Date(row.created_at).toISOString(),
    };
  });

  return { items, total: options.includeCount ? total : items.length };
}

export async function listContracts(
  auth: AuthContext,
  query: ContractListQuery,
): Promise<{ items: ContractItem[]; meta: PaginationMeta }> {
  const pagination = parsePaginationParams(
    { page: query.page, limit: query.limit },
    { defaultLimit: 20, maxLimit: 100 },
  );
  const { items, total } = await queryContractsWithScope(auth, query, {
    limit: pagination.limit,
    offset: pagination.offset,
    includeCount: true,
  });
  return {
    items,
    meta: buildPaginationMeta(total, pagination.page, pagination.limit),
  };
}

export async function listExpiringContracts(
  auth: AuthContext,
  query: { days?: string | null; branchId?: string | null },
): Promise<{ summary: ExpiringContractsSummary; items: ContractItem[] }> {
  const rawDays = Number(query.days ?? 30);
  const horizonDays =
    Number.isInteger(rawDays) && rawDays >= 1 && rawDays <= 90 ? rawDays : 30;

  const { items: allActive } = await queryContractsWithScope(
    auth,
    { branchId: query.branchId, status: 'ACTIVE' },
    { limit: 1000, offset: 0, includeCount: false },
  );

  const summary: ExpiringContractsSummary = {
    overdueCount: 0,
    urgent15Count: 0,
    warning30Count: 0,
    totalAlertCount: 0,
  };

  const alertedItems: ContractItem[] = [];
  for (const item of allActive) {
    if (item.daysRemaining === null) continue;
    if (item.expiryLevel === 'OVERDUE') summary.overdueCount += 1;
    else if (item.expiryLevel === 'URGENT_15D') summary.urgent15Count += 1;
    else if (item.expiryLevel === 'WARNING_30D') summary.warning30Count += 1;

    if (item.daysRemaining <= horizonDays) {
      alertedItems.push(item);
    }
  }

  summary.totalAlertCount =
    summary.overdueCount + summary.urgent15Count + summary.warning30Count;

  alertedItems.sort((a, b) => (a.daysRemaining ?? 9999) - (b.daysRemaining ?? 9999));

  return { summary, items: alertedItems };
}

async function assertEmployeeAccessForContract(
  auth: AuthContext,
  employeeId: number,
  allowSelfRead: boolean,
): Promise<{ id: number; branchId: number; departmentId: number; userId: number | null }> {
  const db = getDb();
  const emp = await db
    .selectFrom('employees')
    .select(['id', 'branch_id', 'department_id', 'user_id'])
    .where('id', '=', employeeId)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (!emp) {
    throw new AppError('EMPLOYEE_NOT_FOUND', 'Không tìm thấy hồ sơ nhân viên.', 404);
  }

  const target = {
    id: Number(emp.id),
    branchId: Number(emp.branch_id),
    departmentId: Number(emp.department_id),
    userId: emp.user_id !== null ? Number(emp.user_id) : null,
  };

  if (allowSelfRead && target.userId === auth.userId) {
    return target;
  }

  const scope = await resolveEmployeeAccessScope(auth);
  if (!isEmployeeWithinScope(scope, target, auth.userId)) {
    throw new AppError(
      'FORBIDDEN',
      'Bạn không có quyền truy cập hợp đồng của nhân viên này.',
      403,
    );
  }

  return target;
}

export async function listEmployeeContracts(
  auth: AuthContext,
  employeeId: number,
): Promise<ContractItem[]> {
  const target = await assertEmployeeAccessForContract(auth, employeeId, true);
  const isOwner = target.userId === auth.userId;
  if (!isOwner && !auth.isSuperAdmin && !auth.permissions.includes('hrm.contracts.read')) {
    throw new AppError(
      'FORBIDDEN',
      'Bạn không có quyền xem hợp đồng lao động của nhân viên khác.',
      403,
    );
  }

  const { items } = await queryContractsWithScope(
    isOwner
      ? { ...auth, dataScope: 'ALL', isSuperAdmin: true, hasAllBranches: true }
      : auth,
    { employeeId: String(employeeId) },
    { limit: 100, offset: 0, includeCount: false },
  );
  return items;
}

export async function getContractById(
  auth: AuthContext,
  contractId: number,
): Promise<ContractItem> {
  const db = getDb();
  const row = await db
    .selectFrom('employee_contracts')
    .select(['id', 'employee_id'])
    .where('id', '=', contractId)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (!row) {
    throw new AppError('CONTRACT_NOT_FOUND', 'Không tìm thấy hợp đồng lao động.', 404);
  }

  await assertEmployeeAccessForContract(auth, Number(row.employee_id), true);
  const list = await listEmployeeContracts(auth, Number(row.employee_id));
  const found = list.find((c) => c.id === contractId);
  if (!found) {
    throw new AppError('CONTRACT_NOT_FOUND', 'Không tìm thấy hợp đồng lao động.', 404);
  }
  return found;
}

export async function createContract(
  auth: AuthContext,
  input: CreateContractInput,
  ipAddress: string | null,
): Promise<ContractItem> {
  await assertEmployeeAccessForContract(auth, input.employeeId, false);
  const normalizedEndDate = validateContractDates(
    input.contractType,
    input.startDate,
    input.endDate ?? null,
  );

  const db = getDb();
  const duplicate = await db
    .selectFrom('employee_contracts')
    .select(['id'])
    .where('contract_no', '=', input.contractNo)
    .executeTakeFirst();

  if (duplicate) {
    throw new AppError(
      'CONTRACT_NO_EXISTS',
      `Số hợp đồng "${input.contractNo}" đã tồn tại trong hệ thống.`,
      409,
    );
  }

  if (input.status === 'ACTIVE' && !input.autoClosePreviousActive) {
    const existingActive = await db
      .selectFrom('employee_contracts')
      .select(['id', 'contract_no'])
      .where('employee_id', '=', input.employeeId)
      .where('status', '=', 'ACTIVE')
      .where('deleted_at', 'is', null)
      .executeTakeFirst();

    if (existingActive) {
      throw new AppError(
        'ACTIVE_CONTRACT_EXISTS',
        `Nhân viên đang có hợp đồng hiệu lực (${existingActive.contract_no}). Hãy bật tự đóng HĐ cũ hoặc chuyển trạng thái HĐ cũ trước.`,
        409,
      );
    }
  }

  const createdId = await db.transaction().execute(async (trx) => {
    if (input.status === 'ACTIVE' && input.autoClosePreviousActive) {
      await trx
        .updateTable('employee_contracts')
        .set({ status: 'EXPIRED', updated_by: auth.userId })
        .where('employee_id', '=', input.employeeId)
        .where('status', '=', 'ACTIVE')
        .where('deleted_at', 'is', null)
        .execute();
    }

    const inserted = await trx
      .insertInto('employee_contracts')
      .values({
        employee_id: input.employeeId,
        contract_no: input.contractNo,
        contract_type: input.contractType,
        start_date: input.startDate,
        end_date: normalizedEndDate,
        base_salary: input.baseSalary,
        insurance_salary: input.insuranceSalary,
        allowances_json: JSON.stringify(input.allowances),
        status: input.status,
        signed_date: input.signedDate ?? null,
        note: input.note ?? null,
        created_by: auth.userId,
        updated_by: auth.userId,
      })
      .executeTakeFirstOrThrow();

    return Number(inserted.insertId);
  });

  await recordAuditLog({
    userId: auth.userId,
    moduleCode: 'hrm',
    action: 'HRM_CONTRACT_CREATE',
    entityType: 'employee_contracts',
    entityId: createdId,
    newValues: {
      employeeId: input.employeeId,
      contractNo: input.contractNo,
      contractType: input.contractType,
      baseSalary: input.baseSalary,
      status: input.status,
    },
    ipAddress,
  });

  return getContractById(auth, createdId);
}

export async function updateContract(
  auth: AuthContext,
  contractId: number,
  input: UpdateContractInput,
  ipAddress: string | null,
): Promise<ContractItem> {
  const db = getDb();
  const existing = await db
    .selectFrom('employee_contracts')
    .select([
      'id',
      'employee_id',
      'contract_no',
      'contract_type',
      'start_date',
      'end_date',
      'base_salary',
      'insurance_salary',
      'status',
    ])
    .where('id', '=', contractId)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (!existing) {
    throw new AppError('CONTRACT_NOT_FOUND', 'Không tìm thấy hợp đồng lao động.', 404);
  }

  const employeeId = Number(existing.employee_id);
  await assertEmployeeAccessForContract(auth, employeeId, false);

  const nextType = input.contractType ?? existing.contract_type;
  const nextStart = input.startDate ?? toIsoDateOnly(existing.start_date) ?? '';
  const rawNextEnd =
    input.endDate !== undefined ? input.endDate : toIsoDateOnly(existing.end_date);
  const nextEnd = validateContractDates(nextType, nextStart, rawNextEnd);
  const nextStatus = input.status ?? existing.status;

  if (input.contractNo && input.contractNo !== existing.contract_no) {
    const dup = await db
      .selectFrom('employee_contracts')
      .select(['id'])
      .where('contract_no', '=', input.contractNo)
      .where('id', '!=', contractId)
      .executeTakeFirst();
    if (dup) {
      throw new AppError(
        'CONTRACT_NO_EXISTS',
        `Số hợp đồng "${input.contractNo}" đã tồn tại.`,
        409,
      );
    }
  }

  const autoClosePrev = input.autoClosePreviousActive !== false;
  if (nextStatus === 'ACTIVE' && !autoClosePrev) {
    const otherActive = await db
      .selectFrom('employee_contracts')
      .select(['id', 'contract_no'])
      .where('employee_id', '=', employeeId)
      .where('status', '=', 'ACTIVE')
      .where('id', '!=', contractId)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();
    if (otherActive) {
      throw new AppError(
        'ACTIVE_CONTRACT_EXISTS',
        `Nhân viên đang có hợp đồng hiệu lực khác (${otherActive.contract_no}).`,
        409,
      );
    }
  }

  await db.transaction().execute(async (trx) => {
    if (nextStatus === 'ACTIVE' && autoClosePrev) {
      await trx
        .updateTable('employee_contracts')
        .set({ status: 'EXPIRED', updated_by: auth.userId })
        .where('employee_id', '=', employeeId)
        .where('status', '=', 'ACTIVE')
        .where('id', '!=', contractId)
        .where('deleted_at', 'is', null)
        .execute();
    }

    const payload: Record<string, unknown> = {
      contract_type: nextType,
      start_date: nextStart,
      end_date: nextEnd,
      status: nextStatus,
      updated_by: auth.userId,
    };
    if (input.contractNo !== undefined) payload.contract_no = input.contractNo;
    if (input.baseSalary !== undefined) payload.base_salary = input.baseSalary;
    if (input.insuranceSalary !== undefined) payload.insurance_salary = input.insuranceSalary;
    if (input.allowances !== undefined) payload.allowances_json = JSON.stringify(input.allowances);
    if (input.signedDate !== undefined) payload.signed_date = input.signedDate;
    if (input.note !== undefined) payload.note = input.note;

    await trx
      .updateTable('employee_contracts')
      .set(payload)
      .where('id', '=', contractId)
      .execute();
  });

  await recordAuditLog({
    userId: auth.userId,
    moduleCode: 'hrm',
    action: 'HRM_CONTRACT_UPDATE',
    entityType: 'employee_contracts',
    entityId: contractId,
    oldValues: {
      contractNo: existing.contract_no,
      status: existing.status,
      baseSalary: Number(existing.base_salary),
    },
    newValues: {
      contractNo: input.contractNo ?? existing.contract_no,
      status: nextStatus,
      baseSalary: input.baseSalary ?? Number(existing.base_salary),
    },
    ipAddress,
  });

  return getContractById(auth, contractId);
}

export async function softDeleteContract(
  auth: AuthContext,
  contractId: number,
  ipAddress: string | null,
): Promise<void> {
  const db = getDb();
  const existing = await db
    .selectFrom('employee_contracts')
    .select(['id', 'employee_id', 'contract_no'])
    .where('id', '=', contractId)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (!existing) {
    throw new AppError('CONTRACT_NOT_FOUND', 'Không tìm thấy hợp đồng lao động.', 404);
  }

  await assertEmployeeAccessForContract(auth, Number(existing.employee_id), false);

  await db
    .updateTable('employee_contracts')
    .set({ deleted_at: new Date(), updated_by: auth.userId })
    .where('id', '=', contractId)
    .execute();

  await recordAuditLog({
    userId: auth.userId,
    moduleCode: 'hrm',
    action: 'HRM_CONTRACT_DELETE',
    entityType: 'employee_contracts',
    entityId: contractId,
    oldValues: {
      employeeId: Number(existing.employee_id),
      contractNo: existing.contract_no,
    },
    ipAddress,
  });
}

export async function exportContractsToExcel(
  auth: AuthContext,
  query: ContractListQuery,
): Promise<{ buffer: Buffer; filename: string; rowCount: number }> {
  const { items } = await queryContractsWithScope(auth, query, {
    limit: MAX_EXPORT_ROWS,
    offset: 0,
    includeCount: false,
  });

  const columns: ExcelColumn<ContractItem>[] = [
    { header: 'STT', key: 'stt', width: 8, align: 'center', value: (_, i) => i + 1 },
    { header: 'Số Hợp đồng', key: 'contractNo', width: 20 },
    { header: 'Mã NV', key: 'employeeCode', width: 14 },
    { header: 'Họ và tên', key: 'employeeName', width: 24 },
    { header: 'Chi nhánh', key: 'branchName', width: 20 },
    { header: 'Phòng ban', key: 'departmentName', width: 22 },
    {
      header: 'Loại hợp đồng',
      key: 'contractType',
      width: 24,
      value: (r) => CONTRACT_TYPE_LABELS[r.contractType],
    },
    {
      header: 'Ngày bắt đầu',
      key: 'startDate',
      width: 14,
      align: 'center',
      value: (r) => formatDateVN(r.startDate),
    },
    {
      header: 'Ngày kết thúc',
      key: 'endDate',
      width: 14,
      align: 'center',
      value: (r) => (r.endDate ? formatDateVN(r.endDate) : 'Không thời hạn'),
    },
    {
      header: 'Lương cơ bản (VNĐ)',
      key: 'baseSalary',
      width: 18,
      numFmt: '#,##0',
      align: 'right',
    },
    {
      header: 'Lương BHXH (VNĐ)',
      key: 'insuranceSalary',
      width: 18,
      numFmt: '#,##0',
      align: 'right',
    },
    {
      header: 'Tổng phụ cấp (VNĐ)',
      key: 'totalAllowances',
      width: 18,
      numFmt: '#,##0',
      align: 'right',
    },
    {
      header: 'Trạng thái',
      key: 'status',
      width: 16,
      align: 'center',
      value: (r) => CONTRACT_STATUS_LABELS[r.status],
    },
    {
      header: 'Cảnh báo hết hạn',
      key: 'expiryLevel',
      width: 24,
      value: (r) =>
        r.daysRemaining !== null
          ? `${EXPIRY_LEVEL_LABELS[r.expiryLevel]} (${r.daysRemaining} ngày)`
          : EXPIRY_LEVEL_LABELS[r.expiryLevel],
    },
  ];

  const today = new Date();
  const dateStamp = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
  const buffer = await buildExcelBuffer(items, columns, {
    sheetName: 'HopDongLaoDong',
    title: 'DANH SÁCH HỢP ĐỒNG LAO ĐỘNG — OPERON HUB',
    subtitle: `Ngày xuất: ${formatDateVN(today)} • Tổng số: ${items.length} hợp đồng`,
    freezeHeader: true,
    autoFilter: true,
  });

  return {
    buffer,
    filename: `danh-sach-hop-dong-${dateStamp}.xlsx`,
    rowCount: items.length,
  };
}
