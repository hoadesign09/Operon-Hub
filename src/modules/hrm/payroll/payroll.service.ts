import {
  getDb,
  type ContractType,
  type PayrollPeriodStatus,
  type PayslipItemSource,
  type PayslipItemType,
  type PayslipStatus,
} from '@/config/database';
import { formatDateTimeVN } from '@/lib/portable/date-utils';
import { buildExcelBuffer, type ExcelColumn } from '@/lib/portable/excel-exporter';
import {
  buildPaginationMeta,
  parsePaginationParams,
  type PaginationMeta,
} from '@/lib/portable/pagination';
import { roundCurrency } from '@/lib/portable/currency-utils';
import { recordAuditLog } from '@/modules/audit/audit.service';
import { hasRequiredPermission, type AuthContext } from '@/modules/auth/auth.service';
import {
  isEmployeeWithinScope,
  resolveEmployeeAccessScope,
} from '@/modules/hrm/employees/employees.scope';
import { getMonthBoundaries } from '@/modules/hrm/attendance/attendance-summary-calculator';
import {
  calculateEmployeePayslip,
  type ContractAllowanceEntry,
  type ManualAdjustmentEntry,
  type PayrollConfig,
} from '@/modules/hrm/payroll/payroll-calculator';
import {
  getPayrollConfig,
  parsePayrollConfigJson,
} from '@/modules/hrm/payroll/payroll-config.service';
import type {
  CalculatePayrollPeriodInput,
  CreatePayrollPeriodInput,
  ReopenPayrollPeriodInput,
  UpdatePayslipManualInput,
} from '@/modules/hrm/payroll/payroll.schema';
import { AppError } from '@/shared/api-response';

export interface PayrollPeriodItem {
  id: number;
  branchId: number | null;
  branchCode: string | null;
  branchName: string;
  branchNameEn?: string | null;
  year: number;
  month: number;
  code: string;
  name: string;
  status: PayrollPeriodStatus;
  totalEmployees: number;
  totalGross: number;
  totalInsuranceEmp: number;
  totalPit: number;
  totalNet: number;
  approvedBy: number | null;
  approvedByName: string | null;
  approvedAt: string | null;
  paidBy: number | null;
  paidByName: string | null;
  paidAt: string | null;
  note: string | null;
  createdAt: string;
}

export interface PayslipRowItem {
  id: number;
  payrollPeriodId: number;
  periodCode: string;
  periodName: string;
  periodStatus: PayrollPeriodStatus;
  year: number;
  month: number;
  employeeId: number;
  employeeCode: string;
  employeeName: string;
  branchId: number;
  branchName: string;
  branchNameEn?: string | null;
  departmentId: number;
  departmentName: string;
  departmentNameEn?: string | null;
  positionName: string;
  positionNameEn?: string | null;
  taxCode: string | null;
  socialInsuranceNo: string | null;
  standardWorkDays: number;
  payableDays: number;
  otHours150: number;
  otHours200: number;
  otHours300: number;
  dependentsCount: number;
  baseSalary: number;
  insuranceSalary: number;
  proratedSalary: number;
  totalAllowances: number;
  totalOtPay: number;
  totalBonus: number;
  grossSalary: number;
  socialInsuranceEmp: number;
  healthInsuranceEmp: number;
  unemploymentInsuranceEmp: number;
  totalInsuranceEmp: number;
  taxableIncome: number;
  personalIncomeTax: number;
  otherDeductions: number;
  netSalary: number;
  status: PayslipStatus;
  publishedAt: string | null;
  bankName: string | null;
  bankAccountNo: string | null;
  note: string | null;
}

export interface PayslipLineItem {
  id: number;
  itemType: PayslipItemType;
  source: PayslipItemSource;
  code: string;
  label: string;
  amount: number;
  isTaxable: boolean;
  note: string | null;
}

export interface PayslipDetail extends PayslipRowItem {
  items: PayslipLineItem[];
}

export interface PayrollPeriodListQuery {
  year?: string | null;
  month?: string | null;
  branchId?: string | null;
  status?: string | null;
  search?: string | null;
  page?: string | null;
  limit?: string | null;
}

export interface PayrollPeriodPayslipsQuery {
  departmentId?: string | null;
  search?: string | null;
  page?: string | null;
  limit?: string | null;
}

const VALID_PERIOD_STATUSES = new Set<PayrollPeriodStatus>([
  'DRAFT',
  'CALCULATED',
  'APPROVED',
  'PAID',
]);

function parseAllowancesJson(raw: unknown): ContractAllowanceEntry[] {
  let list: unknown = raw;
  if (typeof raw === 'string' && raw.trim().length > 0) {
    try {
      list = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(list)) {
    return [];
  }

  const parsed: ContractAllowanceEntry[] = [];
  for (const entry of list) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }
    const obj = entry as Record<string, unknown>;
    const amount = Number(obj.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      continue;
    }
    parsed.push({
      code: String(obj.code ?? 'OTHER').trim() || 'OTHER',
      label: String(obj.label ?? obj.name ?? 'Phụ cấp').trim() || 'Phụ cấp',
      amount,
    });
  }
  return parsed;
}

function mapPeriodRow(row: {
  id: number | bigint;
  branch_id: number | bigint | null;
  branch_code: string | null;
  branch_name: string | null;
  branch_name_en?: string | null;
  year: number;
  month: number;
  code: string;
  name: string;
  status: PayrollPeriodStatus;
  total_employees: number;
  total_gross: string | number;
  total_insurance_emp: string | number;
  total_pit: string | number;
  total_net: string | number;
  approved_by: number | bigint | null;
  approved_by_name: string | null;
  approved_at: Date | string | null;
  paid_by: number | bigint | null;
  paid_by_name: string | null;
  paid_at: Date | string | null;
  note: string | null;
  created_at: Date | string;
}): PayrollPeriodItem {
  return {
    id: Number(row.id),
    branchId: row.branch_id !== null ? Number(row.branch_id) : null,
    branchCode: row.branch_code ? String(row.branch_code) : null,
    branchName: row.branch_name ? String(row.branch_name) : 'Toàn công ty',
    branchNameEn: row.branch_name_en ? String(row.branch_name_en) : row.branch_id === null ? 'Company-wide' : null,
    year: Number(row.year),
    month: Number(row.month),
    code: String(row.code),
    name: String(row.name),
    status: row.status,
    totalEmployees: Number(row.total_employees),
    totalGross: Number(row.total_gross),
    totalInsuranceEmp: Number(row.total_insurance_emp),
    totalPit: Number(row.total_pit),
    totalNet: Number(row.total_net),
    approvedBy: row.approved_by !== null ? Number(row.approved_by) : null,
    approvedByName: row.approved_by_name ? String(row.approved_by_name) : null,
    approvedAt: row.approved_at ? formatDateTimeVN(row.approved_at) : null,
    paidBy: row.paid_by !== null ? Number(row.paid_by) : null,
    paidByName: row.paid_by_name ? String(row.paid_by_name) : null,
    paidAt: row.paid_at ? formatDateTimeVN(row.paid_at) : null,
    note: row.note ? String(row.note) : null,
    createdAt: formatDateTimeVN(row.created_at),
  };
}

function mapPayslipRow(row: {
  id: number | bigint;
  payroll_period_id: number | bigint;
  period_code: string;
  period_name: string;
  period_status: PayrollPeriodStatus;
  year: number;
  month: number;
  employee_id: number | bigint;
  employee_code: string;
  employee_name: string;
  branch_id: number | bigint;
  branch_name: string;
  branch_name_en?: string | null;
  department_id: number | bigint;
  department_name: string;
  department_name_en?: string | null;
  position_name: string;
  position_name_en?: string | null;
  tax_code: string | null;
  social_insurance_no: string | null;
  standard_work_days: string | number;
  payable_days: string | number;
  ot_hours_150: string | number;
  ot_hours_200: string | number;
  ot_hours_300: string | number;
  dependents_count: number;
  base_salary: string | number;
  insurance_salary: string | number;
  prorated_salary: string | number;
  total_allowances: string | number;
  total_ot_pay: string | number;
  total_bonus: string | number;
  gross_salary: string | number;
  social_insurance_emp: string | number;
  health_insurance_emp: string | number;
  unemployment_insurance_emp: string | number;
  taxable_income: string | number;
  personal_income_tax: string | number;
  other_deductions: string | number;
  net_salary: string | number;
  status: PayslipStatus;
  published_at: Date | string | null;
  bank_name_snapshot: string | null;
  bank_account_snapshot: string | null;
  note: string | null;
}): PayslipRowItem {
  const bhxh = Number(row.social_insurance_emp);
  const bhyt = Number(row.health_insurance_emp);
  const bhtn = Number(row.unemployment_insurance_emp);

  return {
    id: Number(row.id),
    payrollPeriodId: Number(row.payroll_period_id),
    periodCode: String(row.period_code),
    periodName: String(row.period_name),
    periodStatus: row.period_status,
    year: Number(row.year),
    month: Number(row.month),
    employeeId: Number(row.employee_id),
    employeeCode: String(row.employee_code),
    employeeName: String(row.employee_name),
    branchId: Number(row.branch_id),
    branchName: String(row.branch_name),
    branchNameEn: row.branch_name_en ? String(row.branch_name_en) : null,
    departmentId: Number(row.department_id),
    departmentName: String(row.department_name),
    departmentNameEn: row.department_name_en ? String(row.department_name_en) : null,
    positionName: String(row.position_name),
    positionNameEn: row.position_name_en ? String(row.position_name_en) : null,
    taxCode: row.tax_code ? String(row.tax_code) : null,
    socialInsuranceNo: row.social_insurance_no ? String(row.social_insurance_no) : null,
    standardWorkDays: Number(row.standard_work_days),
    payableDays: Number(row.payable_days),
    otHours150: Number(row.ot_hours_150),
    otHours200: Number(row.ot_hours_200),
    otHours300: Number(row.ot_hours_300),
    dependentsCount: Number(row.dependents_count),
    baseSalary: Number(row.base_salary),
    insuranceSalary: Number(row.insurance_salary),
    proratedSalary: Number(row.prorated_salary),
    totalAllowances: Number(row.total_allowances),
    totalOtPay: Number(row.total_ot_pay),
    totalBonus: Number(row.total_bonus),
    grossSalary: Number(row.gross_salary),
    socialInsuranceEmp: bhxh,
    healthInsuranceEmp: bhyt,
    unemploymentInsuranceEmp: bhtn,
    totalInsuranceEmp: roundCurrency(bhxh + bhyt + bhtn, 0),
    taxableIncome: Number(row.taxable_income),
    personalIncomeTax: Number(row.personal_income_tax),
    otherDeductions: Number(row.other_deductions),
    netSalary: Number(row.net_salary),
    status: row.status,
    publishedAt: row.published_at ? formatDateTimeVN(row.published_at) : null,
    bankName: row.bank_name_snapshot ? String(row.bank_name_snapshot) : null,
    bankAccountNo: row.bank_account_snapshot ? String(row.bank_account_snapshot) : null,
    note: row.note ? String(row.note) : null,
  };
}

async function getPeriodByIdRaw(periodId: number) {
  const db = getDb();
  return db
    .selectFrom('payroll_periods as pp')
    .leftJoin('branches as b', 'b.id', 'pp.branch_id')
    .leftJoin('users as au', 'au.id', 'pp.approved_by')
    .leftJoin('users as pu', 'pu.id', 'pp.paid_by')
    .select([
      'pp.id',
      'pp.branch_id',
      'b.code as branch_code',
      'b.name as branch_name',
      'b.name_en as branch_name_en',
      'pp.year',
      'pp.month',
      'pp.code',
      'pp.name',
      'pp.status',
      'pp.total_employees',
      'pp.total_gross',
      'pp.total_insurance_emp',
      'pp.total_pit',
      'pp.total_net',
      'pp.config_snapshot_json',
      'pp.approved_by',
      'au.full_name as approved_by_name',
      'pp.approved_at',
      'pp.paid_by',
      'pu.full_name as paid_by_name',
      'pp.paid_at',
      'pp.note',
      'pp.created_at',
    ])
    .where('pp.id', '=', periodId)
    .where('pp.deleted_at', 'is', null)
    .executeTakeFirst();
}

async function assertPeriodAccess(
  periodId: number,
  auth: AuthContext,
): Promise<NonNullable<Awaited<ReturnType<typeof getPeriodByIdRaw>>>> {
  const period = await getPeriodByIdRaw(periodId);
  if (!period) {
    throw new AppError('PAYROLL_PERIOD_NOT_FOUND', 'Không tìm thấy kỳ lương.', 404);
  }

  const scope = await resolveEmployeeAccessScope(auth);
  if (scope.mode === 'BRANCH') {
    if (
      period.branch_id === null ||
      !scope.branchIds.includes(Number(period.branch_id))
    ) {
      throw new AppError(
        'FORBIDDEN',
        'Bạn không có quyền truy cập kỳ lương ngoài phạm vi chi nhánh được phân công.',
        403,
      );
    }
  } else if (scope.mode === 'OWN' || scope.mode === 'DEPARTMENT') {
    if (!auth.isSuperAdmin && !hasRequiredPermission(auth, 'hrm.payroll.read')) {
      throw new AppError('FORBIDDEN', 'Bạn không có quyền truy cập kỳ lương này.', 403);
    }
  }

  return period;
}

export async function listPayrollPeriods(
  auth: AuthContext,
  query: PayrollPeriodListQuery,
): Promise<{ items: PayrollPeriodItem[]; meta: PaginationMeta }> {
  const pagination = parsePaginationParams(
    { page: query.page ?? undefined, limit: query.limit ?? undefined },
    { defaultLimit: 20, maxLimit: 100 },
  );

  const scope = await resolveEmployeeAccessScope(auth);
  if (scope.mode === 'BRANCH' && scope.branchIds.length === 0) {
    return {
      items: [],
      meta: buildPaginationMeta(0, pagination.page, pagination.limit),
    };
  }

  const db = getDb();
  let baseQuery = db
    .selectFrom('payroll_periods as pp')
    .leftJoin('branches as b', 'b.id', 'pp.branch_id')
    .leftJoin('users as au', 'au.id', 'pp.approved_by')
    .leftJoin('users as pu', 'pu.id', 'pp.paid_by')
    .where('pp.deleted_at', 'is', null);

  if (scope.mode === 'BRANCH') {
    baseQuery = baseQuery.where('pp.branch_id', 'in', scope.branchIds);
  }

  if (query.year && /^\d{4}$/.test(query.year)) {
    baseQuery = baseQuery.where('pp.year', '=', Number(query.year));
  }
  if (query.month && Number(query.month) >= 1 && Number(query.month) <= 12) {
    baseQuery = baseQuery.where('pp.month', '=', Number(query.month));
  }
  if (query.branchId && Number(query.branchId) > 0) {
    baseQuery = baseQuery.where('pp.branch_id', '=', Number(query.branchId));
  }
  if (query.status && VALID_PERIOD_STATUSES.has(query.status as PayrollPeriodStatus)) {
    baseQuery = baseQuery.where('pp.status', '=', query.status as PayrollPeriodStatus);
  }
  if (query.search && query.search.trim().length > 0) {
    const keyword = `%${query.search.trim()}%`;
    baseQuery = baseQuery.where((eb) =>
      eb.or([eb('pp.code', 'like', keyword), eb('pp.name', 'like', keyword)]),
    );
  }

  const [countRow, rows] = await Promise.all([
    baseQuery
      .select((eb) => eb.fn.count<number>('pp.id').as('total'))
      .executeTakeFirst(),
    baseQuery
      .select([
        'pp.id',
        'pp.branch_id',
        'b.code as branch_code',
        'b.name as branch_name',
        'b.name_en as branch_name_en',
        'pp.year',
        'pp.month',
        'pp.code',
        'pp.name',
        'pp.status',
        'pp.total_employees',
        'pp.total_gross',
        'pp.total_insurance_emp',
        'pp.total_pit',
        'pp.total_net',
        'pp.approved_by',
        'au.full_name as approved_by_name',
        'pp.approved_at',
        'pp.paid_by',
        'pu.full_name as paid_by_name',
        'pp.paid_at',
        'pp.note',
        'pp.created_at',
      ])
      .orderBy('pp.year', 'desc')
      .orderBy('pp.month', 'desc')
      .orderBy('pp.id', 'desc')
      .limit(pagination.limit)
      .offset(pagination.offset)
      .execute(),
  ]);

  const total = Number(countRow?.total ?? 0);
  return {
    items: rows.map(mapPeriodRow),
    meta: buildPaginationMeta(total, pagination.page, pagination.limit),
  };
}

export async function createPayrollPeriod(
  input: CreatePayrollPeriodInput,
  auth: AuthContext,
  ipAddress: string | null,
): Promise<PayrollPeriodItem> {
  const scope = await resolveEmployeeAccessScope(auth);
  const targetBranchId = input.branchId ?? null;

  if (scope.mode === 'BRANCH') {
    if (targetBranchId === null || !scope.branchIds.includes(targetBranchId)) {
      throw new AppError(
        'FORBIDDEN',
        'Bạn chỉ được tạo kỳ lương cho chi nhánh thuộc phạm vi quản lý của mình.',
        403,
      );
    }
  }

  const db = getDb();
  let branchCode = 'ALL';
  let branchName = 'Toàn công ty';

  if (targetBranchId !== null) {
    const branch = await db
      .selectFrom('branches')
      .select(['id', 'code', 'name'])
      .where('id', '=', targetBranchId)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();
    if (!branch) {
      throw new AppError('BRANCH_NOT_FOUND', 'Không tìm thấy chi nhánh đã chọn.', 404);
    }
    branchCode = String(branch.code).toUpperCase();
    branchName = String(branch.name);
  }

  const monthPadded = String(input.month).padStart(2, '0');
  const code = (input.code?.trim() || `BL-${input.year}-${monthPadded}-${branchCode}`).toUpperCase();
  const name =
    input.name?.trim() ||
    `Bảng lương tháng ${monthPadded}/${input.year} - ${branchName}`;

  let dupQuery = db
    .selectFrom('payroll_periods')
    .select(['id'])
    .where('year', '=', input.year)
    .where('month', '=', input.month)
    .where('deleted_at', 'is', null);

  if (targetBranchId === null) {
    dupQuery = dupQuery.where('branch_id', 'is', null);
  } else {
    dupQuery = dupQuery.where('branch_id', '=', targetBranchId);
  }

  const [dupPeriod, dupCode] = await Promise.all([
    dupQuery.executeTakeFirst(),
    db
      .selectFrom('payroll_periods')
      .select(['id'])
      .where('code', '=', code)
      .executeTakeFirst(),
  ]);

  if (dupPeriod || dupCode) {
    throw new AppError(
      'PAYROLL_PERIOD_DUPLICATE',
      'Kỳ lương cho tháng/chi nhánh này hoặc mã kỳ lương đã tồn tại.',
      409,
    );
  }

  const insertResult = await db
    .insertInto('payroll_periods')
    .values({
      branch_id: targetBranchId,
      year: input.year,
      month: input.month,
      code,
      name,
      status: 'DRAFT',
      total_employees: 0,
      total_gross: '0.00',
      total_insurance_emp: '0.00',
      total_pit: '0.00',
      total_net: '0.00',
      note: input.note?.trim() || null,
      created_by: auth.userId,
      updated_by: auth.userId,
    })
    .executeTakeFirstOrThrow();

  const periodId = Number(insertResult.insertId);
  const created = await getPeriodByIdRaw(periodId);
  if (!created) {
    throw new AppError('INTERNAL_ERROR', 'Không thể đọc lại kỳ lương vừa tạo.', 500);
  }

  const mapped = mapPeriodRow(created);
  await recordAuditLog({
    userId: auth.userId,
    moduleCode: 'hrm',
    action: 'CREATE_PAYROLL_PERIOD',
    entityType: 'payroll_periods',
    entityId: String(periodId),
    newValues: { ...mapped },
    ipAddress,
  });

  return mapped;
}

export async function getPayrollPeriodDetail(
  periodId: number,
  auth: AuthContext,
  query: PayrollPeriodPayslipsQuery,
): Promise<{
  period: PayrollPeriodItem;
  payslips: PayslipRowItem[];
  meta: PaginationMeta;
}> {
  const periodRow = await assertPeriodAccess(periodId, auth);
  const pagination = parsePaginationParams(
    { page: query.page ?? undefined, limit: query.limit ?? undefined },
    { defaultLimit: 50, maxLimit: 200 },
  );

  const db = getDb();
  let baseQuery = db
    .selectFrom('payslips as ps')
    .innerJoin('payroll_periods as pp', 'pp.id', 'ps.payroll_period_id')
    .innerJoin('employees as e', 'e.id', 'ps.employee_id')
    .innerJoin('branches as b', 'b.id', 'ps.branch_id')
    .innerJoin('departments as d', 'd.id', 'ps.department_id')
    .innerJoin('positions as pos', 'pos.id', 'e.position_id')
    .where('ps.payroll_period_id', '=', periodId)
    .where('ps.deleted_at', 'is', null);

  if (query.departmentId && Number(query.departmentId) > 0) {
    baseQuery = baseQuery.where('ps.department_id', '=', Number(query.departmentId));
  }
  if (query.search && query.search.trim().length > 0) {
    const keyword = `%${query.search.trim()}%`;
    baseQuery = baseQuery.where((eb) =>
      eb.or([eb('e.employee_code', 'like', keyword), eb('e.full_name', 'like', keyword)]),
    );
  }

  const [countRow, rows] = await Promise.all([
    baseQuery
      .select((eb) => eb.fn.count<number>('ps.id').as('total'))
      .executeTakeFirst(),
    baseQuery
      .select([
        'ps.id',
        'ps.payroll_period_id',
        'pp.code as period_code',
        'pp.name as period_name',
        'pp.status as period_status',
        'pp.year',
        'pp.month',
        'ps.employee_id',
        'e.employee_code',
        'e.full_name as employee_name',
        'ps.branch_id',
        'b.name as branch_name',
        'b.name_en as branch_name_en',
        'ps.department_id',
        'd.name as department_name',
        'd.name_en as department_name_en',
        'pos.name as position_name',
        'pos.name_en as position_name_en',
        'e.tax_code',
        'e.social_insurance_no',
        'ps.standard_work_days',
        'ps.payable_days',
        'ps.ot_hours_150',
        'ps.ot_hours_200',
        'ps.ot_hours_300',
        'ps.dependents_count',
        'ps.base_salary',
        'ps.insurance_salary',
        'ps.prorated_salary',
        'ps.total_allowances',
        'ps.total_ot_pay',
        'ps.total_bonus',
        'ps.gross_salary',
        'ps.social_insurance_emp',
        'ps.health_insurance_emp',
        'ps.unemployment_insurance_emp',
        'ps.taxable_income',
        'ps.personal_income_tax',
        'ps.other_deductions',
        'ps.net_salary',
        'ps.status',
        'ps.published_at',
        'ps.bank_name_snapshot',
        'ps.bank_account_snapshot',
        'ps.note',
      ])
      .orderBy('e.employee_code', 'asc')
      .limit(pagination.limit)
      .offset(pagination.offset)
      .execute(),
  ]);

  return {
    period: mapPeriodRow(periodRow),
    payslips: rows.map(mapPayslipRow),
    meta: buildPaginationMeta(
      Number(countRow?.total ?? 0),
      pagination.page,
      pagination.limit,
    ),
  };
}

export async function deletePayrollPeriod(
  periodId: number,
  auth: AuthContext,
  ipAddress: string | null,
): Promise<void> {
  const periodRow = await assertPeriodAccess(periodId, auth);
  if (periodRow.status === 'APPROVED' || periodRow.status === 'PAID') {
    throw new AppError(
      'PAYROLL_PERIOD_LOCKED',
      'Không thể xóa kỳ lương đã được phê duyệt hoặc đã chi trả.',
      409,
    );
  }

  const db = getDb();
  const now = new Date();
  await db.transaction().execute(async (trx) => {
    await trx
      .updateTable('payslips')
      .set({ deleted_at: now, updated_by: auth.userId })
      .where('payroll_period_id', '=', periodId)
      .where('deleted_at', 'is', null)
      .execute();

    await trx
      .updateTable('payroll_periods')
      .set({ deleted_at: now, updated_by: auth.userId })
      .where('id', '=', periodId)
      .execute();
  });

  await recordAuditLog({
    userId: auth.userId,
    moduleCode: 'hrm',
    action: 'DELETE_PAYROLL_PERIOD',
    entityType: 'payroll_periods',
    entityId: String(periodId),
    oldValues: { code: periodRow.code, name: periodRow.name, status: periodRow.status },
    ipAddress,
  });
}

export async function calculatePayrollPeriod(
  periodId: number,
  input: CalculatePayrollPeriodInput,
  auth: AuthContext,
  ipAddress: string | null,
): Promise<{
  period: PayrollPeriodItem;
  processedCount: number;
  skippedNoContractCount: number;
  skippedUnlockedAttendanceCount: number;
  warnings: string[];
}> {
  const periodRow = await assertPeriodAccess(periodId, auth);
  if (periodRow.status === 'APPROVED' || periodRow.status === 'PAID') {
    throw new AppError(
      'PAYROLL_PERIOD_LOCKED',
      'Kỳ lương đã được phê duyệt hoặc chi trả, không thể chạy tính lại.',
      409,
    );
  }

  const config = await getPayrollConfig();
  const { monthStart, monthEnd } = getMonthBoundaries(
    Number(periodRow.year),
    Number(periodRow.month),
  );
  const db = getDb();

  let empQuery = db
    .selectFrom('employees')
    .select([
      'id',
      'employee_code',
      'full_name',
      'branch_id',
      'department_id',
      'dependents_count',
      'bank_name',
      'bank_account_no',
    ])
    .where('deleted_at', 'is', null)
    .where('hire_date', '<=', monthEnd)
    .where((eb) =>
      eb.or([
        eb('termination_date', 'is', null),
        eb('termination_date', '>=', monthStart),
      ]),
    );

  if (periodRow.branch_id !== null) {
    empQuery = empQuery.where('branch_id', '=', Number(periodRow.branch_id));
  }

  const employees = await empQuery.orderBy('employee_code', 'asc').execute();
  const empIds = employees.map((e) => Number(e.id));

  if (empIds.length === 0) {
    throw new AppError(
      'NO_ELIGIBLE_EMPLOYEES',
      'Không có nhân viên đang hoạt động trong kỳ lương này để tính lương.',
      400,
    );
  }

  // Batch load toàn bộ nguồn dữ liệu (Zero N+1)
  const [contracts, summaries, existingPayslips] = await Promise.all([
    db
      .selectFrom('employee_contracts')
      .select([
        'id',
        'employee_id',
        'contract_type',
        'base_salary',
        'insurance_salary',
        'allowances_json',
      ])
      .where('employee_id', 'in', empIds)
      .where('status', '=', 'ACTIVE')
      .where('deleted_at', 'is', null)
      .orderBy('start_date', 'desc')
      .execute(),
    db
      .selectFrom('attendance_summaries')
      .select([
        'id',
        'employee_id',
        'standard_work_days',
        'payable_days',
        'ot_hours_150',
        'ot_hours_200',
        'ot_hours_300',
        'status',
      ])
      .where('employee_id', 'in', empIds)
      .where('year', '=', Number(periodRow.year))
      .where('month', '=', Number(periodRow.month))
      .where('deleted_at', 'is', null)
      .execute(),
    db
      .selectFrom('payslips')
      .select(['id', 'employee_id', 'note'])
      .where('payroll_period_id', '=', periodId)
      .execute(),
  ]);

  const existingPayslipIds = existingPayslips.map((p) => Number(p.id));
  const existingManualItems =
    existingPayslipIds.length > 0
      ? await db
          .selectFrom('payslip_items')
          .select([
            'payslip_id',
            'item_type',
            'code',
            'label',
            'amount',
            'is_taxable',
            'note',
          ])
          .where('payslip_id', 'in', existingPayslipIds)
          .where('source', '=', 'MANUAL')
          .execute()
      : [];

  const contractByEmp = new Map<
    number,
    {
      id: number;
      contractType: ContractType;
      baseSalary: number;
      insuranceSalary: number;
      allowances: ContractAllowanceEntry[];
    }
  >();
  for (const c of contracts) {
    const empId = Number(c.employee_id);
    if (!contractByEmp.has(empId)) {
      contractByEmp.set(empId, {
        id: Number(c.id),
        contractType: c.contract_type,
        baseSalary: Number(c.base_salary),
        insuranceSalary: Number(c.insurance_salary),
        allowances: parseAllowancesJson(c.allowances_json),
      });
    }
  }

  const summaryByEmp = new Map(
    summaries.map((s) => [
      Number(s.employee_id),
      {
        id: Number(s.id),
        standardWorkDays: Number(s.standard_work_days),
        payableDays: Number(s.payable_days),
        otHours150: Number(s.ot_hours_150),
        otHours200: Number(s.ot_hours_200),
        otHours300: Number(s.ot_hours_300),
        status: s.status,
      },
    ]),
  );

  const existingPayslipByEmp = new Map(
    existingPayslips.map((p) => [
      Number(p.employee_id),
      { id: Number(p.id), note: p.note ? String(p.note) : null },
    ]),
  );

  const manualItemsByPayslipId = new Map<number, ManualAdjustmentEntry[]>();
  for (const item of existingManualItems) {
    const pid = Number(item.payslip_id);
    const list = manualItemsByPayslipId.get(pid) ?? [];
    list.push({
      itemType: item.item_type,
      code: String(item.code),
      label: String(item.label),
      amount: Number(item.amount),
      isTaxable: Number(item.is_taxable) === 1,
      note: item.note ? String(item.note) : null,
    });
    manualItemsByPayslipId.set(pid, list);
  }

  const requireLocked = config.requireLockedAttendance && !input.includeDraftAttendance;
  const warnings: string[] = [];
  let processedCount = 0;
  let skippedNoContractCount = 0;
  let skippedUnlockedAttendanceCount = 0;

  let periodTotalGross = 0;
  let periodTotalInsurance = 0;
  let periodTotalPit = 0;
  let periodTotalNet = 0;

  await db.transaction().execute(async (trx) => {
    for (const emp of employees) {
      const empId = Number(emp.id);
      const contract = contractByEmp.get(empId);
      if (!contract) {
        skippedNoContractCount += 1;
        warnings.push(
          `${emp.employee_code} (${emp.full_name}): Bỏ qua do chưa có hợp đồng lao động đang hiệu lực (ACTIVE).`,
        );
        continue;
      }

      const summary = summaryByEmp.get(empId);
      if (!summary) {
        skippedUnlockedAttendanceCount += 1;
        warnings.push(
          `${emp.employee_code} (${emp.full_name}): Bỏ qua do chưa tổng hợp bảng công tháng ${periodRow.month}/${periodRow.year}.`,
        );
        continue;
      }

      if (requireLocked && summary.status !== 'LOCKED') {
        skippedUnlockedAttendanceCount += 1;
        warnings.push(
          `${emp.employee_code} (${emp.full_name}): Bỏ qua do bảng công tháng ${periodRow.month}/${periodRow.year} chưa được chốt (LOCKED).`,
        );
        continue;
      }

      const existing = existingPayslipByEmp.get(empId);
      const preservedManual = existing ? manualItemsByPayslipId.get(existing.id) ?? [] : [];

      const computed = calculateEmployeePayslip({
        contractType: contract.contractType,
        baseSalary: contract.baseSalary,
        insuranceSalary: contract.insuranceSalary,
        allowances: contract.allowances,
        standardWorkDays: summary.standardWorkDays,
        payableDays: summary.payableDays,
        otHours150: summary.otHours150,
        otHours200: summary.otHours200,
        otHours300: summary.otHours300,
        dependentsCount: Number(emp.dependents_count),
        manualItems: preservedManual,
        config,
      });

      const payslipValues = {
        branch_id: Number(emp.branch_id),
        department_id: Number(emp.department_id),
        attendance_summary_id: summary.id,
        contract_id: contract.id,
        standard_work_days: summary.standardWorkDays.toFixed(2),
        payable_days: summary.payableDays.toFixed(2),
        ot_hours_150: summary.otHours150.toFixed(2),
        ot_hours_200: summary.otHours200.toFixed(2),
        ot_hours_300: summary.otHours300.toFixed(2),
        dependents_count: Number(emp.dependents_count),
        base_salary: computed.baseSalary.toFixed(2),
        insurance_salary: computed.insuranceSalary.toFixed(2),
        prorated_salary: computed.proratedSalary.toFixed(2),
        total_allowances: computed.totalAllowances.toFixed(2),
        total_ot_pay: computed.totalOtPay.toFixed(2),
        total_bonus: computed.totalBonus.toFixed(2),
        gross_salary: computed.grossSalary.toFixed(2),
        social_insurance_emp: computed.socialInsuranceEmp.toFixed(2),
        health_insurance_emp: computed.healthInsuranceEmp.toFixed(2),
        unemployment_insurance_emp: computed.unemploymentInsuranceEmp.toFixed(2),
        taxable_income: computed.taxableIncome.toFixed(2),
        personal_income_tax: computed.personalIncomeTax.toFixed(2),
        other_deductions: computed.otherDeductions.toFixed(2),
        net_salary: computed.netSalary.toFixed(2),
        status: 'DRAFT' as const,
        bank_name_snapshot: emp.bank_name ? String(emp.bank_name) : null,
        bank_account_snapshot: emp.bank_account_no ? String(emp.bank_account_no) : null,
        updated_by: auth.userId,
        deleted_at: null,
      };

      let payslipId: number;
      if (existing) {
        await trx
          .updateTable('payslips')
          .set(payslipValues)
          .where('id', '=', existing.id)
          .execute();
        payslipId = existing.id;
      } else {
        const inserted = await trx
          .insertInto('payslips')
          .values({
            payroll_period_id: periodId,
            employee_id: empId,
            ...payslipValues,
            note: null,
            created_by: auth.userId,
          })
          .executeTakeFirstOrThrow();
        payslipId = Number(inserted.insertId);
      }

      await trx
        .deleteFrom('payslip_items')
        .where('payslip_id', '=', payslipId)
        .execute();

      if (computed.items.length > 0) {
        await trx
          .insertInto('payslip_items')
          .values(
            computed.items.map((it) => ({
              payslip_id: payslipId,
              item_type: it.itemType,
              source: it.source,
              code: it.code,
              label: it.label,
              amount: it.amount.toFixed(2),
              is_taxable: it.isTaxable ? 1 : 0,
              note: it.note,
            })),
          )
          .execute();
      }

      processedCount += 1;
      periodTotalGross += computed.grossSalary;
      periodTotalInsurance += computed.totalInsuranceEmp;
      periodTotalPit += computed.personalIncomeTax;
      periodTotalNet += computed.netSalary;
    }

    await trx
      .updateTable('payroll_periods')
      .set({
        status: processedCount > 0 ? 'CALCULATED' : periodRow.status,
        total_employees: processedCount,
        total_gross: roundCurrency(periodTotalGross, 0).toFixed(2),
        total_insurance_emp: roundCurrency(periodTotalInsurance, 0).toFixed(2),
        total_pit: roundCurrency(periodTotalPit, 0).toFixed(2),
        total_net: roundCurrency(periodTotalNet, 0).toFixed(2),
        config_snapshot_json: JSON.stringify(config),
        updated_by: auth.userId,
      })
      .where('id', '=', periodId)
      .execute();
  });

  const updatedPeriodRow = await getPeriodByIdRaw(periodId);
  const mappedPeriod = mapPeriodRow(updatedPeriodRow!);

  await recordAuditLog({
    userId: auth.userId,
    moduleCode: 'hrm',
    action: 'CALCULATE_PAYROLL_PERIOD',
    entityType: 'payroll_periods',
    entityId: String(periodId),
    newValues: {
      code: mappedPeriod.code,
      processedCount,
      skippedNoContractCount,
      skippedUnlockedAttendanceCount,
      totalGross: mappedPeriod.totalGross,
      totalNet: mappedPeriod.totalNet,
      includeDraftAttendance: input.includeDraftAttendance,
    },
    ipAddress,
  });

  return {
    period: mappedPeriod,
    processedCount,
    skippedNoContractCount,
    skippedUnlockedAttendanceCount,
    warnings,
  };
}

export async function getPayslipDetail(
  payslipId: number,
  auth: AuthContext,
): Promise<PayslipDetail> {
  const db = getDb();
  const row = await db
    .selectFrom('payslips as ps')
    .innerJoin('payroll_periods as pp', 'pp.id', 'ps.payroll_period_id')
    .innerJoin('employees as e', 'e.id', 'ps.employee_id')
    .innerJoin('branches as b', 'b.id', 'ps.branch_id')
    .innerJoin('departments as d', 'd.id', 'ps.department_id')
    .innerJoin('positions as pos', 'pos.id', 'e.position_id')
    .select([
      'ps.id',
      'ps.payroll_period_id',
      'pp.code as period_code',
      'pp.name as period_name',
      'pp.status as period_status',
      'pp.year',
      'pp.month',
      'ps.employee_id',
      'e.employee_code',
      'e.full_name as employee_name',
      'e.user_id as employee_user_id',
      'ps.branch_id',
      'b.name as branch_name',
      'b.name_en as branch_name_en',
      'ps.department_id',
      'd.name as department_name',
      'd.name_en as department_name_en',
      'pos.name as position_name',
      'pos.name_en as position_name_en',
      'e.tax_code',
      'e.social_insurance_no',
      'ps.standard_work_days',
      'ps.payable_days',
      'ps.ot_hours_150',
      'ps.ot_hours_200',
      'ps.ot_hours_300',
      'ps.dependents_count',
      'ps.base_salary',
      'ps.insurance_salary',
      'ps.prorated_salary',
      'ps.total_allowances',
      'ps.total_ot_pay',
      'ps.total_bonus',
      'ps.gross_salary',
      'ps.social_insurance_emp',
      'ps.health_insurance_emp',
      'ps.unemployment_insurance_emp',
      'ps.taxable_income',
      'ps.personal_income_tax',
      'ps.other_deductions',
      'ps.net_salary',
      'ps.status',
      'ps.published_at',
      'ps.bank_name_snapshot',
      'ps.bank_account_snapshot',
      'ps.note',
    ])
    .where('ps.id', '=', payslipId)
    .where('ps.deleted_at', 'is', null)
    .where('pp.deleted_at', 'is', null)
    .executeTakeFirst();

  if (!row) {
    throw new AppError('PAYSLIP_NOT_FOUND', 'Không tìm thấy phiếu lương.', 404);
  }

  const canReadPayroll = hasRequiredPermission(auth, 'hrm.payroll.read');
  if (canReadPayroll) {
    const scope = await resolveEmployeeAccessScope(auth);
    const allowed = isEmployeeWithinScope(
      scope,
      {
        id: Number(row.employee_id),
        branchId: Number(row.branch_id),
        departmentId: Number(row.department_id),
        userId: row.employee_user_id !== null ? Number(row.employee_user_id) : null,
      },
      auth.userId,
    );
    if (!allowed) {
      throw new AppError(
        'FORBIDDEN',
        'Bạn không có quyền xem phiếu lương ngoài phạm vi dữ liệu được phân công.',
        403,
      );
    }
  } else {
    const isOwner =
      row.employee_user_id !== null && Number(row.employee_user_id) === auth.userId;
    if (!isOwner || row.status !== 'PUBLISHED') {
      throw new AppError(
        'FORBIDDEN',
        'Bạn chỉ được xem phiếu lương đã phát hành của chính mình.',
        403,
      );
    }
  }

  const itemRows = await db
    .selectFrom('payslip_items')
    .select([
      'id',
      'item_type',
      'source',
      'code',
      'label',
      'amount',
      'is_taxable',
      'note',
    ])
    .where('payslip_id', '=', payslipId)
    .orderBy('item_type', 'asc')
    .orderBy('source', 'asc')
    .orderBy('id', 'asc')
    .execute();

  return {
    ...mapPayslipRow(row),
    items: itemRows.map((it) => ({
      id: Number(it.id),
      itemType: it.item_type,
      source: it.source,
      code: String(it.code),
      label: String(it.label),
      amount: Number(it.amount),
      isTaxable: Number(it.is_taxable) === 1,
      note: it.note ? String(it.note) : null,
    })),
  };
}

export async function updatePayslipManualItems(
  payslipId: number,
  input: UpdatePayslipManualInput,
  auth: AuthContext,
  ipAddress: string | null,
): Promise<PayslipDetail> {
  const db = getDb();
  const row = await db
    .selectFrom('payslips as ps')
    .innerJoin('payroll_periods as pp', 'pp.id', 'ps.payroll_period_id')
    .select([
      'ps.id',
      'ps.payroll_period_id',
      'ps.employee_id',
      'ps.branch_id',
      'ps.department_id',
      'ps.contract_id',
      'ps.standard_work_days',
      'ps.payable_days',
      'ps.ot_hours_150',
      'ps.ot_hours_200',
      'ps.ot_hours_300',
      'ps.dependents_count',
      'ps.base_salary',
      'ps.insurance_salary',
      'ps.gross_salary',
      'ps.net_salary',
      'ps.note',
      'pp.status as period_status',
      'pp.config_snapshot_json',
    ])
    .where('ps.id', '=', payslipId)
    .where('ps.deleted_at', 'is', null)
    .where('pp.deleted_at', 'is', null)
    .executeTakeFirst();

  if (!row) {
    throw new AppError('PAYSLIP_NOT_FOUND', 'Không tìm thấy phiếu lương.', 404);
  }

  await assertPeriodAccess(Number(row.payroll_period_id), auth);

  if (row.period_status === 'APPROVED' || row.period_status === 'PAID') {
    throw new AppError(
      'PAYROLL_PERIOD_LOCKED',
      'Kỳ lương đã được phê duyệt hoặc chi trả, không thể chỉnh sửa phiếu lương.',
      409,
    );
  }

  let contractType: ContractType = 'INDEFINITE';
  let allowances: ContractAllowanceEntry[] = [];

  if (row.contract_id !== null) {
    const contract = await db
      .selectFrom('employee_contracts')
      .select(['contract_type', 'allowances_json'])
      .where('id', '=', Number(row.contract_id))
      .executeTakeFirst();
    if (contract) {
      contractType = contract.contract_type;
      allowances = parseAllowancesJson(contract.allowances_json);
    }
  }

  const config: PayrollConfig = row.config_snapshot_json
    ? parsePayrollConfigJson(row.config_snapshot_json)
    : await getPayrollConfig();

  const manualEntries: ManualAdjustmentEntry[] = input.manualItems.map((item) => ({
    itemType: item.itemType,
    code: item.code,
    label: item.label,
    amount: item.amount,
    isTaxable: item.isTaxable,
    note: item.note ?? null,
  }));

  const computed = calculateEmployeePayslip({
    contractType,
    baseSalary: Number(row.base_salary),
    insuranceSalary: Number(row.insurance_salary),
    allowances,
    standardWorkDays: Number(row.standard_work_days),
    payableDays: Number(row.payable_days),
    otHours150: Number(row.ot_hours_150),
    otHours200: Number(row.ot_hours_200),
    otHours300: Number(row.ot_hours_300),
    dependentsCount: Number(row.dependents_count),
    manualItems: manualEntries,
    config,
  });

  const periodId = Number(row.payroll_period_id);

  await db.transaction().execute(async (trx) => {
    await trx
      .updateTable('payslips')
      .set({
        prorated_salary: computed.proratedSalary.toFixed(2),
        total_allowances: computed.totalAllowances.toFixed(2),
        total_ot_pay: computed.totalOtPay.toFixed(2),
        total_bonus: computed.totalBonus.toFixed(2),
        gross_salary: computed.grossSalary.toFixed(2),
        social_insurance_emp: computed.socialInsuranceEmp.toFixed(2),
        health_insurance_emp: computed.healthInsuranceEmp.toFixed(2),
        unemployment_insurance_emp: computed.unemploymentInsuranceEmp.toFixed(2),
        taxable_income: computed.taxableIncome.toFixed(2),
        personal_income_tax: computed.personalIncomeTax.toFixed(2),
        other_deductions: computed.otherDeductions.toFixed(2),
        net_salary: computed.netSalary.toFixed(2),
        note: input.note !== undefined ? input.note : row.note,
        updated_by: auth.userId,
      })
      .where('id', '=', payslipId)
      .execute();

    await trx
      .deleteFrom('payslip_items')
      .where('payslip_id', '=', payslipId)
      .execute();

    if (computed.items.length > 0) {
      await trx
        .insertInto('payslip_items')
        .values(
          computed.items.map((it) => ({
            payslip_id: payslipId,
            item_type: it.itemType,
            source: it.source,
            code: it.code,
            label: it.label,
            amount: it.amount.toFixed(2),
            is_taxable: it.isTaxable ? 1 : 0,
            note: it.note,
          })),
        )
        .execute();
    }

    const periodSlips = await trx
      .selectFrom('payslips')
      .select([
        'gross_salary',
        'social_insurance_emp',
        'health_insurance_emp',
        'unemployment_insurance_emp',
        'personal_income_tax',
        'net_salary',
      ])
      .where('payroll_period_id', '=', periodId)
      .where('deleted_at', 'is', null)
      .execute();

    let sumGross = 0;
    let sumIns = 0;
    let sumPit = 0;
    let sumNet = 0;
    for (const s of periodSlips) {
      sumGross += Number(s.gross_salary);
      sumIns +=
        Number(s.social_insurance_emp) +
        Number(s.health_insurance_emp) +
        Number(s.unemployment_insurance_emp);
      sumPit += Number(s.personal_income_tax);
      sumNet += Number(s.net_salary);
    }

    await trx
      .updateTable('payroll_periods')
      .set({
        total_employees: periodSlips.length,
        total_gross: roundCurrency(sumGross, 0).toFixed(2),
        total_insurance_emp: roundCurrency(sumIns, 0).toFixed(2),
        total_pit: roundCurrency(sumPit, 0).toFixed(2),
        total_net: roundCurrency(sumNet, 0).toFixed(2),
        updated_by: auth.userId,
      })
      .where('id', '=', periodId)
      .execute();
  });

  await recordAuditLog({
    userId: auth.userId,
    moduleCode: 'hrm',
    action: 'UPDATE_PAYSLIP_MANUAL',
    entityType: 'payslips',
    entityId: String(payslipId),
    oldValues: {
      grossSalary: Number(row.gross_salary),
      netSalary: Number(row.net_salary),
      note: row.note,
    },
    newValues: {
      grossSalary: computed.grossSalary,
      netSalary: computed.netSalary,
      totalBonus: computed.totalBonus,
      otherDeductions: computed.otherDeductions,
      manualItemCount: manualEntries.length,
    },
    ipAddress,
  });

  return getPayslipDetail(payslipId, auth);
}

export async function approvePayrollPeriod(
  periodId: number,
  auth: AuthContext,
  ipAddress: string | null,
): Promise<PayrollPeriodItem> {
  const periodRow = await assertPeriodAccess(periodId, auth);
  if (periodRow.status !== 'CALCULATED') {
    throw new AppError(
      'INVALID_STATUS_TRANSITION',
      'Chỉ được phê duyệt kỳ lương đang ở trạng thái Đã tính (CALCULATED).',
      409,
    );
  }
  if (Number(periodRow.total_employees) <= 0) {
    throw new AppError(
      'PAYROLL_EMPTY',
      'Kỳ lương chưa có phiếu lương nhân viên nào để phê duyệt.',
      400,
    );
  }

  const db = getDb();
  await db
    .updateTable('payroll_periods')
    .set({
      status: 'APPROVED',
      approved_by: auth.userId,
      approved_at: new Date(),
      updated_by: auth.userId,
    })
    .where('id', '=', periodId)
    .execute();

  const updated = mapPeriodRow((await getPeriodByIdRaw(periodId))!);
  await recordAuditLog({
    userId: auth.userId,
    moduleCode: 'hrm',
    action: 'APPROVE_PAYROLL_PERIOD',
    entityType: 'payroll_periods',
    entityId: String(periodId),
    oldValues: { status: 'CALCULATED' },
    newValues: {
      status: 'APPROVED',
      totalEmployees: updated.totalEmployees,
      totalGross: updated.totalGross,
      totalNet: updated.totalNet,
    },
    ipAddress,
  });

  return updated;
}

export async function reopenPayrollPeriod(
  periodId: number,
  input: ReopenPayrollPeriodInput,
  auth: AuthContext,
  ipAddress: string | null,
): Promise<PayrollPeriodItem> {
  const periodRow = await assertPeriodAccess(periodId, auth);
  if (periodRow.status === 'PAID') {
    throw new AppError(
      'PAYROLL_ALREADY_PAID',
      'Kỳ lương đã chi trả và phát hành phiếu lương, không thể mở lại.',
      409,
    );
  }
  if (periodRow.status !== 'APPROVED') {
    throw new AppError(
      'INVALID_STATUS_TRANSITION',
      'Chỉ được mở lại kỳ lương đang ở trạng thái Đã duyệt (APPROVED).',
      409,
    );
  }

  const db = getDb();
  await db
    .updateTable('payroll_periods')
    .set({
      status: 'CALCULATED',
      approved_by: null,
      approved_at: null,
      updated_by: auth.userId,
    })
    .where('id', '=', periodId)
    .execute();

  const updated = mapPeriodRow((await getPeriodByIdRaw(periodId))!);
  await recordAuditLog({
    userId: auth.userId,
    moduleCode: 'hrm',
    action: 'REOPEN_PAYROLL_PERIOD',
    entityType: 'payroll_periods',
    entityId: String(periodId),
    oldValues: { status: 'APPROVED' },
    newValues: { status: 'CALCULATED', reason: input.reason },
    ipAddress,
  });

  return updated;
}

export async function payPayrollPeriod(
  periodId: number,
  auth: AuthContext,
  ipAddress: string | null,
): Promise<{
  period: PayrollPeriodItem;
  publishedCount: number;
  notifiedCount: number;
}> {
  if (!hasRequiredPermission(auth, 'hrm.payroll.approve')) {
    throw new AppError(
      'FORBIDDEN',
      'Bạn không có quyền xác nhận chi trả & phát hành phiếu lương (yêu cầu quyền duyệt lương).',
      403,
    );
  }

  const periodRow = await assertPeriodAccess(periodId, auth);
  if (periodRow.status !== 'APPROVED') {
    throw new AppError(
      'INVALID_STATUS_TRANSITION',
      'Chỉ được xác nhận chi trả kỳ lương đã được phê duyệt (APPROVED).',
      409,
    );
  }

  const db = getDb();
  const now = new Date();
  let publishedCount = 0;

  await db.transaction().execute(async (trx) => {
    await trx
      .updateTable('payroll_periods')
      .set({
        status: 'PAID',
        paid_by: auth.userId,
        paid_at: now,
        updated_by: auth.userId,
      })
      .where('id', '=', periodId)
      .execute();

    const updateSlips = await trx
      .updateTable('payslips')
      .set({
        status: 'PUBLISHED',
        published_at: now,
        updated_by: auth.userId,
      })
      .where('payroll_period_id', '=', periodId)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();

    publishedCount = Number(updateSlips.numUpdatedRows ?? 0);
  });

  const recipients = await db
    .selectFrom('payslips as ps')
    .innerJoin('employees as e', 'e.id', 'ps.employee_id')
    .select(['e.user_id', 'ps.net_salary'])
    .where('ps.payroll_period_id', '=', periodId)
    .where('ps.deleted_at', 'is', null)
    .where('e.user_id', 'is not', null)
    .execute();

  const monthPadded = String(periodRow.month).padStart(2, '0');
  let notifiedCount = 0;
  if (recipients.length > 0) {
    await db
      .insertInto('notifications')
      .values(
        recipients.map((r) => ({
          user_id: Number(r.user_id),
          module_code: 'hrm',
          type: 'PAYSLIP',
          title: `Phiếu lương tháng ${monthPadded}/${periodRow.year} đã phát hành`,
          message: `Kỳ lương "${periodRow.name}" đã hoàn tất chi trả. Bạn có thể xem chi tiết và tải Phiếu lương PDF tại mục Phiếu lương của tôi.`,
          link_url: '/my/payslips',
          is_read: 0,
        })),
      )
      .execute();
    notifiedCount = recipients.length;
  }

  const updated = mapPeriodRow((await getPeriodByIdRaw(periodId))!);
  await recordAuditLog({
    userId: auth.userId,
    moduleCode: 'hrm',
    action: 'PAY_PAYROLL_PERIOD',
    entityType: 'payroll_periods',
    entityId: String(periodId),
    oldValues: { status: 'APPROVED' },
    newValues: {
      status: 'PAID',
      publishedCount,
      notifiedCount,
      totalNet: updated.totalNet,
    },
    ipAddress,
  });

  return {
    period: updated,
    publishedCount,
    notifiedCount,
  };
}

export async function exportPayrollPeriodExcel(
  periodId: number,
  auth: AuthContext,
  query: { departmentId?: string | null; search?: string | null },
): Promise<{ buffer: Buffer; fileName: string }> {
  const { period, payslips } = await getPayrollPeriodDetail(periodId, auth, {
    departmentId: query.departmentId,
    search: query.search,
    page: '1',
    limit: '200',
  });

  const columns: ExcelColumn<PayslipRowItem>[] = [
    { header: 'Mã NV', key: 'employeeCode', width: 14 },
    { header: 'Họ và tên', key: 'employeeName', width: 24 },
    { header: 'Chi nhánh', key: 'branchName', width: 20 },
    { header: 'Phòng ban', key: 'departmentName', width: 22 },
    { header: 'Chức danh', key: 'positionName', width: 20 },
    { header: 'Công chuẩn', key: 'standardWorkDays', width: 12, numFmt: '0.00' },
    { header: 'Công tính lương', key: 'payableDays', width: 14, numFmt: '0.00' },
    { header: 'OT 150% (h)', key: 'otHours150', width: 12, numFmt: '0.00' },
    { header: 'OT 200% (h)', key: 'otHours200', width: 12, numFmt: '0.00' },
    { header: 'OT 300% (h)', key: 'otHours300', width: 12, numFmt: '0.00' },
    { header: 'Lương cơ bản', key: 'baseSalary', width: 16, numFmt: '#,##0' },
    { header: 'Lương theo công', key: 'proratedSalary', width: 16, numFmt: '#,##0' },
    { header: 'Tổng phụ cấp', key: 'totalAllowances', width: 15, numFmt: '#,##0' },
    { header: 'Tiền OT', key: 'totalOtPay', width: 14, numFmt: '#,##0' },
    { header: 'Thưởng / Cộng khác', key: 'totalBonus', width: 16, numFmt: '#,##0' },
    { header: 'Tổng thu nhập (Gross)', key: 'grossSalary', width: 18, numFmt: '#,##0' },
    { header: 'BHXH (8%)', key: 'socialInsuranceEmp', width: 14, numFmt: '#,##0' },
    { header: 'BHYT (1.5%)', key: 'healthInsuranceEmp', width: 14, numFmt: '#,##0' },
    { header: 'BHTN (1%)', key: 'unemploymentInsuranceEmp', width: 14, numFmt: '#,##0' },
    { header: 'Thuế TNCN', key: 'personalIncomeTax', width: 14, numFmt: '#,##0' },
    { header: 'Khấu trừ khác', key: 'otherDeductions', width: 15, numFmt: '#,##0' },
    { header: 'Thực lĩnh (Net)', key: 'netSalary', width: 18, numFmt: '#,##0' },
    { header: 'Ngân hàng', key: 'bankName', width: 18 },
    { header: 'Số tài khoản', key: 'bankAccountNo', width: 18 },
  ];

  const buffer = await buildExcelBuffer(payslips, columns, {
    sheetName: `BangLuong_${String(period.month).padStart(2, '0')}_${period.year}`,
    freezeHeader: true,
    autoFilter: true,
  });

  const safeCode = period.code.replace(/[^A-Za-z0-9_-]/g, '_');
  return {
    buffer,
    fileName: `bang-luong-${safeCode}.xlsx`,
  };
}

export async function listMyPayslips(
  auth: AuthContext,
  query: { year?: string | null },
): Promise<{
  items: PayslipRowItem[];
  summary: {
    year: number | null;
    count: number;
    totalGross: number;
    totalInsuranceEmp: number;
    totalTax: number;
    totalNet: number;
  };
}> {
  const db = getDb();
  const emp = await db
    .selectFrom('employees')
    .select(['id'])
    .where('user_id', '=', auth.userId)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  const filterYear = query.year && /^\d{4}$/.test(query.year) ? Number(query.year) : null;

  if (!emp) {
    return {
      items: [],
      summary: {
        year: filterYear,
        count: 0,
        totalGross: 0,
        totalInsuranceEmp: 0,
        totalTax: 0,
        totalNet: 0,
      },
    };
  }

  let q = db
    .selectFrom('payslips as ps')
    .innerJoin('payroll_periods as pp', 'pp.id', 'ps.payroll_period_id')
    .innerJoin('employees as e', 'e.id', 'ps.employee_id')
    .innerJoin('branches as b', 'b.id', 'ps.branch_id')
    .innerJoin('departments as d', 'd.id', 'ps.department_id')
    .innerJoin('positions as pos', 'pos.id', 'e.position_id')
    .select([
      'ps.id',
      'ps.payroll_period_id',
      'pp.code as period_code',
      'pp.name as period_name',
      'pp.status as period_status',
      'pp.year',
      'pp.month',
      'ps.employee_id',
      'e.employee_code',
      'e.full_name as employee_name',
      'ps.branch_id',
      'b.name as branch_name',
      'b.name_en as branch_name_en',
      'ps.department_id',
      'd.name as department_name',
      'd.name_en as department_name_en',
      'pos.name as position_name',
      'pos.name_en as position_name_en',
      'e.tax_code',
      'e.social_insurance_no',
      'ps.standard_work_days',
      'ps.payable_days',
      'ps.ot_hours_150',
      'ps.ot_hours_200',
      'ps.ot_hours_300',
      'ps.dependents_count',
      'ps.base_salary',
      'ps.insurance_salary',
      'ps.prorated_salary',
      'ps.total_allowances',
      'ps.total_ot_pay',
      'ps.total_bonus',
      'ps.gross_salary',
      'ps.social_insurance_emp',
      'ps.health_insurance_emp',
      'ps.unemployment_insurance_emp',
      'ps.taxable_income',
      'ps.personal_income_tax',
      'ps.other_deductions',
      'ps.net_salary',
      'ps.status',
      'ps.published_at',
      'ps.bank_name_snapshot',
      'ps.bank_account_snapshot',
      'ps.note',
    ])
    .where('ps.employee_id', '=', Number(emp.id))
    .where('ps.status', '=', 'PUBLISHED')
    .where('ps.deleted_at', 'is', null)
    .where('pp.deleted_at', 'is', null);

  if (filterYear !== null) {
    q = q.where('pp.year', '=', filterYear);
  }

  const rows = await q
    .orderBy('pp.year', 'desc')
    .orderBy('pp.month', 'desc')
    .orderBy('ps.id', 'desc')
    .execute();

  const items = rows.map(mapPayslipRow);
  let totalGross = 0;
  let totalInsuranceEmp = 0;
  let totalTax = 0;
  let totalNet = 0;

  for (const item of items) {
    totalGross += item.grossSalary;
    totalInsuranceEmp += item.totalInsuranceEmp;
    totalTax += item.personalIncomeTax;
    totalNet += item.netSalary;
  }

  return {
    items,
    summary: {
      year: filterYear,
      count: items.length,
      totalGross: roundCurrency(totalGross, 0),
      totalInsuranceEmp: roundCurrency(totalInsuranceEmp, 0),
      totalTax: roundCurrency(totalTax, 0),
      totalNet: roundCurrency(totalNet, 0),
    },
  };
}
