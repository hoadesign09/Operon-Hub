import { getDb, type AttendanceSummaryStatus } from '@/config/database';
import { formatDateTimeVN, formatDateVN } from '@/lib/portable/date-utils';
import { buildExcelBuffer } from '@/lib/portable/excel-exporter';
import {
  buildPaginationMeta,
  parsePaginationParams,
  type PaginationMeta,
} from '@/lib/portable/pagination';
import { recordAuditLog } from '@/modules/audit/audit.service';
import type { AuthContext } from '@/modules/auth/auth.service';
import {
  isEmployeeWithinScope,
  resolveEmployeeAccessScope,
} from '@/modules/hrm/employees/employees.scope';
import {
  extractIsoDate,
  getVietnamNowParts,
} from '@/modules/hrm/attendance/attendance-calculator';
import {
  computeMonthlyAttendanceSummary,
  getMonthBoundaries,
  roundDecimal2,
  type SummaryBusinessTripEntry,
  type SummaryHolidayEntry,
  type SummaryLeaveEntry,
  type SummaryLogEntry,
  type SummaryOtEntry,
} from '@/modules/hrm/attendance/attendance-summary-calculator';
import type {
  CalculateSummariesInput,
  LockAttendanceSummariesInput,
  UnlockAttendanceSummariesInput,
  UpdateAttendanceSummaryInput,
} from '@/modules/hrm/attendance/attendance-summary.schema';
import { AppError } from '@/shared/api-response';

export interface AttendanceSummaryItem {
  id: number;
  employeeId: number;
  employeeCode: string;
  employeeName: string;
  branchId: number;
  branchName: string;
  departmentId: number;
  departmentName: string;
  year: number;
  month: number;
  standardWorkDays: number;
  actualWorkDays: number;
  businessTripDays: number;
  paidLeaveDays: number;
  unpaidLeaveDays: number;
  holidayDays: number;
  payableDays: number;
  otHours150: number;
  otHours200: number;
  otHours300: number;
  lateCount: number;
  totalLateMinutes: number;
  earlyLeaveCount: number;
  totalEarlyLeaveMinutes: number;
  status: AttendanceSummaryStatus;
  lockedBy: number | null;
  lockedByName: string | null;
  lockedAt: string | null;
  adjustmentNote: string | null;
}

export interface AttendanceSummaryPeriodStats {
  totalEmployees: number;
  draftCount: number;
  lockedCount: number;
  totalPayableDays: number;
  totalOtHours: number;
}

export interface AttendanceSummaryFilterQuery {
  year?: string | null;
  month?: string | null;
  branchId?: string | null;
  departmentId?: string | null;
  status?: string | null;
  search?: string | null;
  page?: string | null;
  limit?: string | null;
}

function parseWorkDays(raw: string | number[] | null | undefined): number[] {
  if (Array.isArray(raw)) {
    return raw.map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
  }
  if (typeof raw === 'string') {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
      }
    } catch {
      return [1, 2, 3, 4, 5];
    }
  }
  return [1, 2, 3, 4, 5];
}

function mapRowToSummaryItem(row: {
  id: number | bigint;
  employee_id: number | bigint;
  employee_code: string;
  employee_name: string;
  branch_id: number | bigint;
  branch_name: string;
  department_id: number | bigint;
  department_name: string;
  year: number;
  month: number;
  standard_work_days: string | number;
  actual_work_days: string | number;
  business_trip_days: string | number;
  paid_leave_days: string | number;
  unpaid_leave_days: string | number;
  holiday_days: string | number;
  payable_days: string | number;
  ot_hours_150: string | number;
  ot_hours_200: string | number;
  ot_hours_300: string | number;
  late_count: number;
  total_late_minutes: number;
  early_leave_count: number;
  total_early_leave_minutes: number;
  status: AttendanceSummaryStatus;
  locked_by: number | bigint | null;
  locked_by_name: string | null;
  locked_at: Date | string | null;
  adjustment_note: string | null;
}): AttendanceSummaryItem {
  return {
    id: Number(row.id),
    employeeId: Number(row.employee_id),
    employeeCode: String(row.employee_code),
    employeeName: String(row.employee_name),
    branchId: Number(row.branch_id),
    branchName: String(row.branch_name),
    departmentId: Number(row.department_id),
    departmentName: String(row.department_name),
    year: Number(row.year),
    month: Number(row.month),
    standardWorkDays: Number(row.standard_work_days),
    actualWorkDays: Number(row.actual_work_days),
    businessTripDays: Number(row.business_trip_days),
    paidLeaveDays: Number(row.paid_leave_days),
    unpaidLeaveDays: Number(row.unpaid_leave_days),
    holidayDays: Number(row.holiday_days),
    payableDays: Number(row.payable_days),
    otHours150: Number(row.ot_hours_150),
    otHours200: Number(row.ot_hours_200),
    otHours300: Number(row.ot_hours_300),
    lateCount: Number(row.late_count),
    totalLateMinutes: Number(row.total_late_minutes),
    earlyLeaveCount: Number(row.early_leave_count),
    totalEarlyLeaveMinutes: Number(row.total_early_leave_minutes),
    status: row.status,
    lockedBy: row.locked_by !== null ? Number(row.locked_by) : null,
    lockedByName: row.locked_by_name ? String(row.locked_by_name) : null,
    lockedAt: row.locked_at ? formatDateTimeVN(row.locked_at) : null,
    adjustmentNote: row.adjustment_note ? String(row.adjustment_note) : null,
  };
}

export async function isEmployeeMonthLocked(
  employeeId: number,
  workDate: string,
): Promise<boolean> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(workDate)) {
    return false;
  }
  const year = Number(workDate.slice(0, 4));
  const month = Number(workDate.slice(5, 7));

  const db = getDb();
  const found = await db
    .selectFrom('attendance_summaries')
    .select(['id'])
    .where('employee_id', '=', employeeId)
    .where('year', '=', year)
    .where('month', '=', month)
    .where('status', '=', 'LOCKED')
    .where('deleted_at', 'is', null)
    .limit(1)
    .executeTakeFirst();

  return Boolean(found);
}

async function getSummaryByIdInternal(id: number): Promise<AttendanceSummaryItem | null> {
  const db = getDb();
  const row = await db
    .selectFrom('attendance_summaries as asum')
    .innerJoin('employees as e', 'e.id', 'asum.employee_id')
    .innerJoin('branches as b', 'b.id', 'asum.branch_id')
    .innerJoin('departments as d', 'd.id', 'e.department_id')
    .leftJoin('users as lu', 'lu.id', 'asum.locked_by')
    .select([
      'asum.id',
      'asum.employee_id',
      'e.employee_code',
      'e.full_name as employee_name',
      'asum.branch_id',
      'b.name as branch_name',
      'e.department_id',
      'd.name as department_name',
      'asum.year',
      'asum.month',
      'asum.standard_work_days',
      'asum.actual_work_days',
      'asum.business_trip_days',
      'asum.paid_leave_days',
      'asum.unpaid_leave_days',
      'asum.holiday_days',
      'asum.payable_days',
      'asum.ot_hours_150',
      'asum.ot_hours_200',
      'asum.ot_hours_300',
      'asum.late_count',
      'asum.total_late_minutes',
      'asum.early_leave_count',
      'asum.total_early_leave_minutes',
      'asum.status',
      'asum.locked_by',
      'lu.full_name as locked_by_name',
      'asum.locked_at',
      'asum.adjustment_note',
    ])
    .where('asum.id', '=', id)
    .where('asum.deleted_at', 'is', null)
    .executeTakeFirst();

  return row ? mapRowToSummaryItem(row) : null;
}

async function buildFilteredSummaryQuery(
  auth: AuthContext,
  query: AttendanceSummaryFilterQuery,
) {
  const scope = await resolveEmployeeAccessScope(auth);
  if (
    (scope.mode === 'OWN' && scope.selfEmployeeId === null) ||
    (scope.mode === 'DEPARTMENT' &&
      scope.departmentIds.length === 0 &&
      scope.selfEmployeeId === null) ||
    (scope.mode === 'BRANCH' && scope.branchIds.length === 0)
  ) {
    return null;
  }

  const db = getDb();
  let builder = db
    .selectFrom('attendance_summaries as asum')
    .innerJoin('employees as e', 'e.id', 'asum.employee_id')
    .innerJoin('branches as b', 'b.id', 'asum.branch_id')
    .innerJoin('departments as d', 'd.id', 'e.department_id')
    .leftJoin('users as lu', 'lu.id', 'asum.locked_by')
    .where('asum.deleted_at', 'is', null)
    .where('e.deleted_at', 'is', null);

  if (scope.mode === 'BRANCH') {
    builder = builder.where('asum.branch_id', 'in', scope.branchIds);
  } else if (scope.mode === 'DEPARTMENT') {
    builder = builder.where((eb) => {
      const clauses = [];
      if (scope.departmentIds.length > 0) {
        clauses.push(eb('e.department_id', 'in', scope.departmentIds));
      }
      if (scope.selfEmployeeId !== null) {
        clauses.push(eb('e.id', '=', scope.selfEmployeeId));
      }
      return eb.or(clauses);
    });
  } else if (scope.mode === 'OWN' && scope.selfEmployeeId !== null) {
    builder = builder.where('asum.employee_id', '=', scope.selfEmployeeId);
  }

  if (query.year && /^\d{4}$/.test(query.year)) {
    builder = builder.where('asum.year', '=', Number(query.year));
  }
  if (query.month && Number(query.month) >= 1 && Number(query.month) <= 12) {
    builder = builder.where('asum.month', '=', Number(query.month));
  }
  if (query.branchId && Number(query.branchId) > 0) {
    builder = builder.where('asum.branch_id', '=', Number(query.branchId));
  }
  if (query.departmentId && Number(query.departmentId) > 0) {
    builder = builder.where('e.department_id', '=', Number(query.departmentId));
  }
  if (query.status === 'DRAFT' || query.status === 'LOCKED') {
    builder = builder.where('asum.status', '=', query.status);
  }
  if (query.search && query.search.trim().length > 0) {
    const keyword = `%${query.search.trim()}%`;
    builder = builder.where((eb) =>
      eb.or([eb('e.employee_code', 'like', keyword), eb('e.full_name', 'like', keyword)]),
    );
  }

  return builder;
}

export async function listAttendanceSummaries(
  auth: AuthContext,
  query: AttendanceSummaryFilterQuery,
): Promise<{
  items: AttendanceSummaryItem[];
  stats: AttendanceSummaryPeriodStats;
  meta: PaginationMeta;
}> {
  const pagination = parsePaginationParams(
    { page: query.page ?? undefined, limit: query.limit ?? undefined },
    { defaultLimit: 20, maxLimit: 100 },
  );

  const emptyStats: AttendanceSummaryPeriodStats = {
    totalEmployees: 0,
    draftCount: 0,
    lockedCount: 0,
    totalPayableDays: 0,
    totalOtHours: 0,
  };

  const baseQuery = await buildFilteredSummaryQuery(auth, query);
  if (!baseQuery) {
    return {
      items: [],
      stats: emptyStats,
      meta: buildPaginationMeta(0, pagination.page, pagination.limit),
    };
  }

  const allMetricRows = await baseQuery
    .select([
      'asum.status',
      'asum.payable_days',
      'asum.ot_hours_150',
      'asum.ot_hours_200',
      'asum.ot_hours_300',
    ])
    .execute();

  const total = allMetricRows.length;
  let draftCount = 0;
  let lockedCount = 0;
  let totalPayableDays = 0;
  let totalOtHours = 0;

  for (const r of allMetricRows) {
    if (r.status === 'LOCKED') {
      lockedCount += 1;
    } else {
      draftCount += 1;
    }
    totalPayableDays += Number(r.payable_days);
    totalOtHours +=
      Number(r.ot_hours_150) + Number(r.ot_hours_200) + Number(r.ot_hours_300);
  }

  const rows = await baseQuery
    .select([
      'asum.id',
      'asum.employee_id',
      'e.employee_code',
      'e.full_name as employee_name',
      'asum.branch_id',
      'b.name as branch_name',
      'e.department_id',
      'd.name as department_name',
      'asum.year',
      'asum.month',
      'asum.standard_work_days',
      'asum.actual_work_days',
      'asum.business_trip_days',
      'asum.paid_leave_days',
      'asum.unpaid_leave_days',
      'asum.holiday_days',
      'asum.payable_days',
      'asum.ot_hours_150',
      'asum.ot_hours_200',
      'asum.ot_hours_300',
      'asum.late_count',
      'asum.total_late_minutes',
      'asum.early_leave_count',
      'asum.total_early_leave_minutes',
      'asum.status',
      'asum.locked_by',
      'lu.full_name as locked_by_name',
      'asum.locked_at',
      'asum.adjustment_note',
    ])
    .orderBy('e.employee_code', 'asc')
    .limit(pagination.limit)
    .offset(pagination.offset)
    .execute();

  return {
    items: rows.map(mapRowToSummaryItem),
    stats: {
      totalEmployees: total,
      draftCount,
      lockedCount,
      totalPayableDays: roundDecimal2(totalPayableDays),
      totalOtHours: roundDecimal2(totalOtHours),
    },
    meta: buildPaginationMeta(total, pagination.page, pagination.limit),
  };
}

export async function getMyAttendanceSummary(
  auth: AuthContext,
  query: { year?: string | null; month?: string | null },
): Promise<AttendanceSummaryItem | null> {
  const db = getDb();
  const emp = await db
    .selectFrom('employees')
    .select(['id'])
    .where('user_id', '=', auth.userId)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (!emp) {
    return null;
  }

  const nowParts = getVietnamNowParts();
  const year =
    query.year && /^\d{4}$/.test(query.year)
      ? Number(query.year)
      : Number(nowParts.date.slice(0, 4));
  const month =
    query.month && Number(query.month) >= 1 && Number(query.month) <= 12
      ? Number(query.month)
      : Number(nowParts.date.slice(5, 7));

  const row = await db
    .selectFrom('attendance_summaries as asum')
    .innerJoin('employees as e', 'e.id', 'asum.employee_id')
    .innerJoin('branches as b', 'b.id', 'asum.branch_id')
    .innerJoin('departments as d', 'd.id', 'e.department_id')
    .leftJoin('users as lu', 'lu.id', 'asum.locked_by')
    .select([
      'asum.id',
      'asum.employee_id',
      'e.employee_code',
      'e.full_name as employee_name',
      'asum.branch_id',
      'b.name as branch_name',
      'e.department_id',
      'd.name as department_name',
      'asum.year',
      'asum.month',
      'asum.standard_work_days',
      'asum.actual_work_days',
      'asum.business_trip_days',
      'asum.paid_leave_days',
      'asum.unpaid_leave_days',
      'asum.holiday_days',
      'asum.payable_days',
      'asum.ot_hours_150',
      'asum.ot_hours_200',
      'asum.ot_hours_300',
      'asum.late_count',
      'asum.total_late_minutes',
      'asum.early_leave_count',
      'asum.total_early_leave_minutes',
      'asum.status',
      'asum.locked_by',
      'lu.full_name as locked_by_name',
      'asum.locked_at',
      'asum.adjustment_note',
    ])
    .where('asum.employee_id', '=', Number(emp.id))
    .where('asum.year', '=', year)
    .where('asum.month', '=', month)
    .where('asum.deleted_at', 'is', null)
    .executeTakeFirst();

  return row ? mapRowToSummaryItem(row) : null;
}

export async function calculateMonthlyAttendanceSummaries(
  input: CalculateSummariesInput,
  auth: AuthContext,
  ipAddress: string | null,
): Promise<{
  year: number;
  month: number;
  totalProcessed: number;
  createdCount: number;
  updatedCount: number;
  skippedLockedCount: number;
}> {
  const scope = await resolveEmployeeAccessScope(auth);
  if (
    (scope.mode === 'OWN' && scope.selfEmployeeId === null) ||
    (scope.mode === 'DEPARTMENT' &&
      scope.departmentIds.length === 0 &&
      scope.selfEmployeeId === null) ||
    (scope.mode === 'BRANCH' && scope.branchIds.length === 0)
  ) {
    return {
      year: input.year,
      month: input.month,
      totalProcessed: 0,
      createdCount: 0,
      updatedCount: 0,
      skippedLockedCount: 0,
    };
  }

  const { monthStart, monthEnd } = getMonthBoundaries(input.year, input.month);
  const db = getDb();

  let empQuery = db
    .selectFrom('employees')
    .select(['id', 'branch_id', 'department_id'])
    .where('deleted_at', 'is', null)
    .where('hire_date', '<=', monthEnd)
    .where((eb) =>
      eb.or([
        eb('termination_date', 'is', null),
        eb('termination_date', '>=', monthStart),
      ]),
    );

  if (scope.mode === 'BRANCH') {
    empQuery = empQuery.where('branch_id', 'in', scope.branchIds);
  } else if (scope.mode === 'DEPARTMENT') {
    empQuery = empQuery.where((eb) => {
      const clauses = [];
      if (scope.departmentIds.length > 0) {
        clauses.push(eb('department_id', 'in', scope.departmentIds));
      }
      if (scope.selfEmployeeId !== null) {
        clauses.push(eb('id', '=', scope.selfEmployeeId));
      }
      return eb.or(clauses);
    });
  } else if (scope.mode === 'OWN' && scope.selfEmployeeId !== null) {
    empQuery = empQuery.where('id', '=', scope.selfEmployeeId);
  }

  if (input.branchId) {
    empQuery = empQuery.where('branch_id', '=', input.branchId);
  }
  if (input.departmentId) {
    empQuery = empQuery.where('department_id', '=', input.departmentId);
  }
  if (input.employeeIds && input.employeeIds.length > 0) {
    empQuery = empQuery.where('id', 'in', input.employeeIds);
  }

  const employees = await empQuery.execute();
  if (employees.length === 0) {
    return {
      year: input.year,
      month: input.month,
      totalProcessed: 0,
      createdCount: 0,
      updatedCount: 0,
      skippedLockedCount: 0,
    };
  }

  const empIds = employees.map((e) => Number(e.id));

  // Batch load all 7 sources to avoid N+1 queries
  const [
    existingSummaries,
    allLogs,
    allLeaves,
    allOvertimes,
    allTrips,
    allHolidays,
    allShiftAssignments,
    defaultShifts,
  ] = await Promise.all([
    db
      .selectFrom('attendance_summaries')
      .select(['id', 'employee_id', 'status'])
      .where('employee_id', 'in', empIds)
      .where('year', '=', input.year)
      .where('month', '=', input.month)
      .execute(),
    db
      .selectFrom('attendance_logs')
      .select([
        'employee_id',
        'work_date',
        'status',
        'worked_hours',
        'check_in_at',
        'late_minutes',
        'early_leave_minutes',
      ])
      .where('employee_id', 'in', empIds)
      .where('work_date', '>=', monthStart)
      .where('work_date', '<=', monthEnd)
      .where('deleted_at', 'is', null)
      .execute(),
    db
      .selectFrom('leave_requests as lr')
      .innerJoin('leave_types as lt', 'lt.id', 'lr.leave_type_id')
      .select([
        'lr.employee_id',
        'lr.start_date',
        'lr.end_date',
        'lr.start_session',
        'lr.end_session',
        'lt.is_paid',
      ])
      .where('lr.employee_id', 'in', empIds)
      .where('lr.status', '=', 'APPROVED')
      .where('lr.start_date', '<=', monthEnd)
      .where('lr.end_date', '>=', monthStart)
      .where('lr.deleted_at', 'is', null)
      .execute(),
    db
      .selectFrom('overtime_requests')
      .select(['employee_id', 'work_date', 'total_hours', 'ot_rate_type'])
      .where('employee_id', 'in', empIds)
      .where('status', '=', 'APPROVED')
      .where('work_date', '>=', monthStart)
      .where('work_date', '<=', monthEnd)
      .where('deleted_at', 'is', null)
      .execute(),
    db
      .selectFrom('business_trip_requests')
      .select(['employee_id', 'start_date', 'end_date'])
      .where('employee_id', 'in', empIds)
      .where('status', '=', 'APPROVED')
      .where('start_date', '<=', monthEnd)
      .where('end_date', '>=', monthStart)
      .where('deleted_at', 'is', null)
      .execute(),
    db
      .selectFrom('holidays')
      .select(['branch_id', 'holiday_date', 'is_paid'])
      .where('holiday_date', '>=', monthStart)
      .where('holiday_date', '<=', monthEnd)
      .where('deleted_at', 'is', null)
      .execute(),
    db
      .selectFrom('employee_shift_assignments as esa')
      .innerJoin('work_shifts as ws', 'ws.id', 'esa.shift_id')
      .select([
        'esa.employee_id',
        'esa.effective_from',
        'esa.effective_to',
        'esa.work_days_json',
        'ws.working_hours',
      ])
      .where('esa.employee_id', 'in', empIds)
      .where('esa.deleted_at', 'is', null)
      .where('ws.deleted_at', 'is', null)
      .where('esa.effective_from', '<=', monthEnd)
      .where((eb) =>
        eb.or([
          eb('esa.effective_to', 'is', null),
          eb('esa.effective_to', '>=', monthStart),
        ]),
      )
      .orderBy('esa.effective_from', 'desc')
      .execute(),
    db
      .selectFrom('work_shifts')
      .select(['branch_id', 'working_hours'])
      .where('is_default', '=', 1)
      .where('is_active', '=', 1)
      .where('deleted_at', 'is', null)
      .execute(),
  ]);

  const existingMap = new Map(
    existingSummaries.map((s) => [
      Number(s.employee_id),
      { id: Number(s.id), status: s.status },
    ]),
  );

  const logsByEmp = new Map<number, SummaryLogEntry[]>();
  for (const row of allLogs) {
    const empId = Number(row.employee_id);
    const list = logsByEmp.get(empId) ?? [];
    list.push({
      workDate: extractIsoDate(row.work_date) ?? '',
      status: row.status,
      workedHours: Number(row.worked_hours),
      hasCheckIn: row.check_in_at !== null,
      lateMinutes: Number(row.late_minutes),
      earlyLeaveMinutes: Number(row.early_leave_minutes),
    });
    logsByEmp.set(empId, list);
  }

  const leavesByEmp = new Map<number, SummaryLeaveEntry[]>();
  for (const row of allLeaves) {
    const empId = Number(row.employee_id);
    const list = leavesByEmp.get(empId) ?? [];
    list.push({
      startDate: extractIsoDate(row.start_date) ?? '',
      endDate: extractIsoDate(row.end_date) ?? '',
      startSession: row.start_session,
      endSession: row.end_session,
      isPaid: Number(row.is_paid) === 1,
    });
    leavesByEmp.set(empId, list);
  }

  const otByEmp = new Map<number, SummaryOtEntry[]>();
  for (const row of allOvertimes) {
    const empId = Number(row.employee_id);
    const list = otByEmp.get(empId) ?? [];
    list.push({
      workDate: extractIsoDate(row.work_date) ?? '',
      totalHours: Number(row.total_hours),
      otRateType: row.ot_rate_type,
    });
    otByEmp.set(empId, list);
  }

  const tripsByEmp = new Map<number, SummaryBusinessTripEntry[]>();
  for (const row of allTrips) {
    const empId = Number(row.employee_id);
    const list = tripsByEmp.get(empId) ?? [];
    list.push({
      startDate: extractIsoDate(row.start_date) ?? '',
      endDate: extractIsoDate(row.end_date) ?? '',
    });
    tripsByEmp.set(empId, list);
  }

  const shiftByEmp = new Map<number, { workDays: number[]; workingHours: number }>();
  for (const row of allShiftAssignments) {
    const empId = Number(row.employee_id);
    if (!shiftByEmp.has(empId)) {
      shiftByEmp.set(empId, {
        workDays: parseWorkDays(row.work_days_json),
        workingHours: Number(row.working_hours),
      });
    }
  }

  let createdCount = 0;
  let updatedCount = 0;
  let skippedLockedCount = 0;

  for (const emp of employees) {
    const empId = Number(emp.id);
    const branchId = Number(emp.branch_id);
    const existing = existingMap.get(empId);

    if (existing && existing.status === 'LOCKED') {
      skippedLockedCount += 1;
      continue;
    }

    const assignedShift = shiftByEmp.get(empId);
    const fallbackShift =
      defaultShifts.find((s) => s.branch_id !== null && Number(s.branch_id) === branchId) ??
      defaultShifts.find((s) => s.branch_id === null);

    const branchHolidays: SummaryHolidayEntry[] = allHolidays
      .filter((h) => h.branch_id === null || Number(h.branch_id) === branchId)
      .map((h) => ({
        holidayDate: extractIsoDate(h.holiday_date) ?? '',
        isPaid: Number(h.is_paid) === 1,
      }));

    const computed = computeMonthlyAttendanceSummary({
      year: input.year,
      month: input.month,
      workDays: assignedShift?.workDays ?? [1, 2, 3, 4, 5],
      shiftWorkingHours: assignedShift?.workingHours ?? (fallbackShift ? Number(fallbackShift.working_hours) : 8),
      logs: logsByEmp.get(empId) ?? [],
      approvedLeaves: leavesByEmp.get(empId) ?? [],
      approvedOvertimes: otByEmp.get(empId) ?? [],
      approvedBusinessTrips: tripsByEmp.get(empId) ?? [],
      holidays: branchHolidays,
    });

    const payload = {
      branch_id: branchId,
      standard_work_days: computed.standardWorkDays.toFixed(2),
      actual_work_days: computed.actualWorkDays.toFixed(2),
      business_trip_days: computed.businessTripDays.toFixed(2),
      paid_leave_days: computed.paidLeaveDays.toFixed(2),
      unpaid_leave_days: computed.unpaidLeaveDays.toFixed(2),
      holiday_days: computed.holidayDays.toFixed(2),
      payable_days: computed.payableDays.toFixed(2),
      ot_hours_150: computed.otHours150.toFixed(2),
      ot_hours_200: computed.otHours200.toFixed(2),
      ot_hours_300: computed.otHours300.toFixed(2),
      late_count: computed.lateCount,
      total_late_minutes: computed.totalLateMinutes,
      early_leave_count: computed.earlyLeaveCount,
      total_early_leave_minutes: computed.totalEarlyLeaveMinutes,
      status: 'DRAFT' as const,
      deleted_at: null,
      updated_by: auth.userId,
    };

    if (existing) {
      await db
        .updateTable('attendance_summaries')
        .set(payload)
        .where('id', '=', existing.id)
        .execute();
      updatedCount += 1;
    } else {
      await db
        .insertInto('attendance_summaries')
        .values({
          employee_id: empId,
          year: input.year,
          month: input.month,
          ...payload,
          created_by: auth.userId,
        })
        .execute();
      createdCount += 1;
    }
  }

  await recordAuditLog({
    userId: auth.userId,
    moduleCode: 'hrm',
    action: 'CALCULATE_ATTENDANCE_SUMMARIES',
    entityType: 'attendance_summaries',
    entityId: `${input.year}-${String(input.month).padStart(2, '0')}`,
    newValues: {
      year: input.year,
      month: input.month,
      branchId: input.branchId ?? null,
      totalProcessed: employees.length,
      createdCount,
      updatedCount,
      skippedLockedCount,
    },
    ipAddress,
  });

  return {
    year: input.year,
    month: input.month,
    totalProcessed: employees.length,
    createdCount,
    updatedCount,
    skippedLockedCount,
  };
}

export async function updateAttendanceSummaryManual(
  id: number,
  input: UpdateAttendanceSummaryInput,
  auth: AuthContext,
  ipAddress: string | null,
): Promise<AttendanceSummaryItem> {
  const db = getDb();
  const current = await db
    .selectFrom('attendance_summaries as asum')
    .innerJoin('employees as e', 'e.id', 'asum.employee_id')
    .select([
      'asum.id',
      'asum.employee_id',
      'asum.branch_id',
      'asum.standard_work_days',
      'asum.actual_work_days',
      'asum.business_trip_days',
      'asum.paid_leave_days',
      'asum.unpaid_leave_days',
      'asum.holiday_days',
      'asum.payable_days',
      'asum.ot_hours_150',
      'asum.ot_hours_200',
      'asum.ot_hours_300',
      'asum.late_count',
      'asum.status',
      'asum.adjustment_note',
      'e.department_id',
      'e.user_id',
    ])
    .where('asum.id', '=', id)
    .where('asum.deleted_at', 'is', null)
    .executeTakeFirst();

  if (!current) {
    throw new AppError('SUMMARY_NOT_FOUND', 'Không tìm thấy bản ghi bảng công tháng.', 404);
  }

  const scope = await resolveEmployeeAccessScope(auth);
  const allowed = isEmployeeWithinScope(
    scope,
    {
      id: Number(current.employee_id),
      branchId: Number(current.branch_id),
      departmentId: Number(current.department_id),
      userId: current.user_id !== null ? Number(current.user_id) : null,
    },
    auth.userId,
  );
  if (!allowed) {
    throw new AppError('FORBIDDEN_SCOPE', 'Bạn không có quyền điều chỉnh bảng công ngoài phạm vi.', 403);
  }

  if (current.status === 'LOCKED') {
    throw new AppError(
      'SUMMARY_LOCKED',
      'Bảng công tháng này đã chốt khóa (LOCKED). Vui lòng mở khóa trước khi điều chỉnh.',
      409,
    );
  }

  const nextStandard = input.standardWorkDays ?? Number(current.standard_work_days);
  const nextActual = input.actualWorkDays ?? Number(current.actual_work_days);
  const nextTrip = input.businessTripDays ?? Number(current.business_trip_days);
  const nextPaidLeave = input.paidLeaveDays ?? Number(current.paid_leave_days);
  const nextUnpaidLeave = input.unpaidLeaveDays ?? Number(current.unpaid_leave_days);
  const nextHoliday = input.holidayDays ?? Number(current.holiday_days);
  const nextPayable = roundDecimal2(nextActual + nextPaidLeave + nextHoliday);
  const nextOt150 = input.otHours150 ?? Number(current.ot_hours_150);
  const nextOt200 = input.otHours200 ?? Number(current.ot_hours_200);
  const nextOt300 = input.otHours300 ?? Number(current.ot_hours_300);
  const nextLateCount = input.lateCount ?? Number(current.late_count);

  await db
    .updateTable('attendance_summaries')
    .set({
      standard_work_days: nextStandard.toFixed(2),
      actual_work_days: nextActual.toFixed(2),
      business_trip_days: nextTrip.toFixed(2),
      paid_leave_days: nextPaidLeave.toFixed(2),
      unpaid_leave_days: nextUnpaidLeave.toFixed(2),
      holiday_days: nextHoliday.toFixed(2),
      payable_days: nextPayable.toFixed(2),
      ot_hours_150: nextOt150.toFixed(2),
      ot_hours_200: nextOt200.toFixed(2),
      ot_hours_300: nextOt300.toFixed(2),
      late_count: nextLateCount,
      adjustment_note: input.adjustmentNote,
      updated_by: auth.userId,
    })
    .where('id', '=', id)
    .execute();

  const updated = await getSummaryByIdInternal(id);
  if (!updated) {
    throw new AppError('INTERNAL_ERROR', 'Không thể đọc lại bảng công sau khi cập nhật.', 500);
  }

  await recordAuditLog({
    userId: auth.userId,
    moduleCode: 'hrm',
    action: 'ADJUST_ATTENDANCE_SUMMARY',
    entityType: 'attendance_summaries',
    entityId: String(id),
    oldValues: {
      actualWorkDays: Number(current.actual_work_days),
      paidLeaveDays: Number(current.paid_leave_days),
      unpaidLeaveDays: Number(current.unpaid_leave_days),
      holidayDays: Number(current.holiday_days),
      payableDays: Number(current.payable_days),
      otHours150: Number(current.ot_hours_150),
      otHours200: Number(current.ot_hours_200),
      otHours300: Number(current.ot_hours_300),
      adjustmentNote: current.adjustment_note,
    },
    newValues: { ...updated },
    ipAddress,
  });

  return updated;
}

export async function lockAttendanceSummaries(
  input: LockAttendanceSummariesInput,
  auth: AuthContext,
  ipAddress: string | null,
): Promise<{ lockedCount: number }> {
  const scope = await resolveEmployeeAccessScope(auth);
  const db = getDb();

  let targetQuery = db
    .selectFrom('attendance_summaries as asum')
    .innerJoin('employees as e', 'e.id', 'asum.employee_id')
    .select(['asum.id'])
    .where('asum.year', '=', input.year)
    .where('asum.month', '=', input.month)
    .where('asum.status', '=', 'DRAFT')
    .where('asum.deleted_at', 'is', null);

  if (scope.mode === 'BRANCH') {
    if (scope.branchIds.length === 0) {
      throw new AppError('NO_DRAFT_SUMMARIES', 'Không có bản ghi bảng công Nháp nào để chốt.', 400);
    }
    targetQuery = targetQuery.where('asum.branch_id', 'in', scope.branchIds);
  } else if (scope.mode === 'DEPARTMENT') {
    if (scope.departmentIds.length === 0) {
      throw new AppError('NO_DRAFT_SUMMARIES', 'Không có bản ghi bảng công Nháp nào để chốt.', 400);
    }
    targetQuery = targetQuery.where('e.department_id', 'in', scope.departmentIds);
  } else if (scope.mode === 'OWN') {
    throw new AppError('FORBIDDEN_SCOPE', 'Bạn không có quyền chốt bảng công tháng.', 403);
  }

  if (input.branchId) {
    targetQuery = targetQuery.where('asum.branch_id', '=', input.branchId);
  }
  if (input.summaryIds && input.summaryIds.length > 0) {
    targetQuery = targetQuery.where('asum.id', 'in', input.summaryIds);
  }

  const rows = await targetQuery.execute();
  const ids = rows.map((r) => Number(r.id));
  if (ids.length === 0) {
    throw new AppError(
      'NO_DRAFT_SUMMARIES',
      `Không có bản ghi bảng công ở trạng thái Nháp trong tháng ${input.month}/${input.year} để chốt.`,
      400,
    );
  }

  const nowParts = getVietnamNowParts();
  await db
    .updateTable('attendance_summaries')
    .set({
      status: 'LOCKED',
      locked_by: auth.userId,
      locked_at: nowParts.sqlDateTime,
      ...(input.note ? { adjustment_note: input.note } : {}),
      updated_by: auth.userId,
    })
    .where('id', 'in', ids)
    .execute();

  await recordAuditLog({
    userId: auth.userId,
    moduleCode: 'hrm',
    action: 'LOCK_ATTENDANCE_SUMMARIES',
    entityType: 'attendance_summaries',
    entityId: `${input.year}-${String(input.month).padStart(2, '0')}`,
    newValues: {
      year: input.year,
      month: input.month,
      branchId: input.branchId ?? null,
      lockedCount: ids.length,
      note: input.note ?? null,
    },
    ipAddress,
  });

  return { lockedCount: ids.length };
}

export async function unlockAttendanceSummaries(
  input: UnlockAttendanceSummariesInput,
  auth: AuthContext,
  ipAddress: string | null,
): Promise<{ unlockedCount: number }> {
  const scope = await resolveEmployeeAccessScope(auth);
  const db = getDb();

  let targetQuery = db
    .selectFrom('attendance_summaries as asum')
    .innerJoin('employees as e', 'e.id', 'asum.employee_id')
    .select(['asum.id'])
    .where('asum.year', '=', input.year)
    .where('asum.month', '=', input.month)
    .where('asum.status', '=', 'LOCKED')
    .where('asum.deleted_at', 'is', null);

  if (scope.mode === 'BRANCH') {
    if (scope.branchIds.length === 0) {
      throw new AppError('NO_LOCKED_SUMMARIES', 'Không có bản ghi bảng công đã chốt nào để mở khóa.', 400);
    }
    targetQuery = targetQuery.where('asum.branch_id', 'in', scope.branchIds);
  } else if (scope.mode === 'DEPARTMENT') {
    if (scope.departmentIds.length === 0) {
      throw new AppError('NO_LOCKED_SUMMARIES', 'Không có bản ghi bảng công đã chốt nào để mở khóa.', 400);
    }
    targetQuery = targetQuery.where('e.department_id', 'in', scope.departmentIds);
  } else if (scope.mode === 'OWN') {
    throw new AppError('FORBIDDEN_SCOPE', 'Bạn không có quyền mở khóa bảng công tháng.', 403);
  }

  if (input.branchId) {
    targetQuery = targetQuery.where('asum.branch_id', '=', input.branchId);
  }
  if (input.summaryIds && input.summaryIds.length > 0) {
    targetQuery = targetQuery.where('asum.id', 'in', input.summaryIds);
  }

  const rows = await targetQuery.execute();
  const ids = rows.map((r) => Number(r.id));
  if (ids.length === 0) {
    throw new AppError(
      'NO_LOCKED_SUMMARIES',
      `Không có bản ghi bảng công đã chốt trong tháng ${input.month}/${input.year} để mở khóa.`,
      400,
    );
  }

  await db
    .updateTable('attendance_summaries')
    .set({
      status: 'DRAFT',
      locked_by: null,
      locked_at: null,
      adjustment_note: `[Mở khóa] ${input.reason}`,
      updated_by: auth.userId,
    })
    .where('id', 'in', ids)
    .execute();

  await recordAuditLog({
    userId: auth.userId,
    moduleCode: 'hrm',
    action: 'UNLOCK_ATTENDANCE_SUMMARIES',
    entityType: 'attendance_summaries',
    entityId: `${input.year}-${String(input.month).padStart(2, '0')}`,
    newValues: {
      year: input.year,
      month: input.month,
      branchId: input.branchId ?? null,
      unlockedCount: ids.length,
      reason: input.reason,
    },
    ipAddress,
  });

  return { unlockedCount: ids.length };
}

export async function exportAttendanceSummariesExcel(
  auth: AuthContext,
  query: AttendanceSummaryFilterQuery,
): Promise<{ buffer: Buffer; fileName: string }> {
  const baseQuery = await buildFilteredSummaryQuery(auth, query);
  const rows = baseQuery
    ? await baseQuery
        .select([
          'asum.id',
          'asum.employee_id',
          'e.employee_code',
          'e.full_name as employee_name',
          'asum.branch_id',
          'b.name as branch_name',
          'e.department_id',
          'd.name as department_name',
          'asum.year',
          'asum.month',
          'asum.standard_work_days',
          'asum.actual_work_days',
          'asum.business_trip_days',
          'asum.paid_leave_days',
          'asum.unpaid_leave_days',
          'asum.holiday_days',
          'asum.payable_days',
          'asum.ot_hours_150',
          'asum.ot_hours_200',
          'asum.ot_hours_300',
          'asum.late_count',
          'asum.total_late_minutes',
          'asum.early_leave_count',
          'asum.total_early_leave_minutes',
          'asum.status',
          'asum.locked_by',
          'lu.full_name as locked_by_name',
          'asum.locked_at',
          'asum.adjustment_note',
        ])
        .orderBy('e.employee_code', 'asc')
        .limit(5000)
        .execute()
    : [];

  const items = rows.map(mapRowToSummaryItem);
  const nowParts = getVietnamNowParts();
  const yearLabel = query.year ?? nowParts.date.slice(0, 4);
  const monthLabel = String(query.month ?? Number(nowParts.date.slice(5, 7))).padStart(2, '0');

  const buffer = await buildExcelBuffer(
    items,
    [
      { header: 'STT', key: 'stt', width: 6, align: 'center', value: (_r, idx) => idx + 1 },
      { header: 'Mã NV', key: 'employeeCode', width: 12 },
      { header: 'Họ và tên', key: 'employeeName', width: 24 },
      { header: 'Chi nhánh', key: 'branchName', width: 20 },
      { header: 'Phòng ban', key: 'departmentName', width: 22 },
      { header: 'Công chuẩn', key: 'standardWorkDays', width: 12, align: 'right', numFmt: '0.00' },
      { header: 'Công thực tế', key: 'actualWorkDays', width: 13, align: 'right', numFmt: '0.00' },
      { header: 'Công tác', key: 'businessTripDays', width: 11, align: 'right', numFmt: '0.00' },
      { header: 'Phép hưởng lương', key: 'paidLeaveDays', width: 16, align: 'right', numFmt: '0.00' },
      { header: 'Phép không lương', key: 'unpaidLeaveDays', width: 16, align: 'right', numFmt: '0.00' },
      { header: 'Ngày lễ', key: 'holidayDays', width: 10, align: 'right', numFmt: '0.00' },
      { header: 'Công hưởng lương', key: 'payableDays', width: 17, align: 'right', numFmt: '0.00' },
      { header: 'OT 150% (h)', key: 'otHours150', width: 12, align: 'right', numFmt: '0.00' },
      { header: 'OT 200% (h)', key: 'otHours200', width: 12, align: 'right', numFmt: '0.00' },
      { header: 'OT 300% (h)', key: 'otHours300', width: 12, align: 'right', numFmt: '0.00' },
      { header: 'Số lần đi muộn', key: 'lateCount', width: 14, align: 'right', numFmt: '#,##0' },
      {
        header: 'Trạng thái',
        key: 'status',
        width: 14,
        align: 'center',
        value: (r) => (r.status === 'LOCKED' ? 'Đã chốt' : 'Nháp'),
      },
      { header: 'Ghi chú điều chỉnh', key: 'adjustmentNote', width: 28, value: (r) => r.adjustmentNote ?? '' },
    ],
    {
      sheetName: `BangCong_${yearLabel}_${monthLabel}`,
      title: `BẢNG TỔNG HỢP CHẤM CÔNG THÁNG ${monthLabel}/${yearLabel}`,
      subtitle: `Ngày xuất: ${formatDateVN(nowParts.date)} | Tổng số nhân viên: ${items.length}`,
    },
  );

  return {
    buffer,
    fileName: `bang-cong-thang-${yearLabel}-${monthLabel}.xlsx`,
  };
}
