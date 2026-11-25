import dayjs from 'dayjs';
import { getDb, type AttendanceSource, type AttendanceStatus } from '@/config/database';
import { formatDateVN } from '@/lib/portable/date-utils';
import { buildExcelBuffer } from '@/lib/portable/excel-exporter';
import { buildPaginationMeta, parsePaginationParams, type PaginationMeta } from '@/lib/portable/pagination';
import { recordAuditLog } from '@/modules/audit/audit.service';
import type { AuthContext } from '@/modules/auth/auth.service';
import {
  isEmployeeWithinScope,
  resolveEmployeeAccessScope,
} from '@/modules/hrm/employees/employees.scope';
import {
  buildSqlDateTime,
  computeAttendanceMetrics,
  extractIsoDate,
  extractTimeHHmm,
  getVietnamNowParts,
  parseTimeToMinutes,
  roundHours,
  type ShiftMetricConfig,
} from '@/modules/hrm/attendance/attendance-calculator';
import type {
  CheckInOutInput,
  UpdateManualAttendanceInput,
  UpsertManualAttendanceInput,
} from '@/modules/hrm/attendance/attendance.schema';
import { isHolidayDate } from '@/modules/hrm/attendance/holidays.service';
import { isEmployeeMonthLocked } from '@/modules/hrm/attendance/attendance-summaries.service';
import { resolveEffectiveShift, type ResolvedEffectiveShift } from '@/modules/hrm/attendance/shifts.service';
import { AppError } from '@/shared/api-response';

export interface AttendanceLogItem {
  id: number;
  employeeId: number;
  employeeCode: string;
  employeeName: string;
  branchId: number;
  branchName: string;
  branchNameEn?: string | null;
  departmentId: number;
  departmentName: string;
  departmentNameEn?: string | null;
  workDate: string;
  shiftId: number | null;
  shiftCode: string | null;
  shiftName: string | null;
  shiftNameEn?: string | null;
  checkInTime: string | null;
  checkOutTime: string | null;
  source: AttendanceSource;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  workedHours: number;
  status: AttendanceStatus;
  note: string | null;
}

export interface MyAttendanceResponse {
  employee: {
    id: number;
    employeeCode: string;
    fullName: string;
    branchName: string;
    branchNameEn?: string | null;
    departmentName: string;
    departmentNameEn?: string | null;
  };
  year: number;
  month: number;
  todayDate: string;
  todayShift: ResolvedEffectiveShift | null;
  isTodayHoliday: boolean;
  todayLog: AttendanceLogItem | null;
  stats: {
    presentDays: number;
    lateDays: number;
    totalLateMinutes: number;
    totalEarlyLeaveMinutes: number;
    totalWorkedHours: number;
  };
  logs: AttendanceLogItem[];
}

export interface AttendanceLogFilterQuery {
  fromDate?: string | null;
  toDate?: string | null;
  branchId?: string | null;
  departmentId?: string | null;
  employeeId?: string | null;
  status?: string | null;
  source?: string | null;
  search?: string | null;
  page?: string | null;
  limit?: string | null;
}

const STATUS_LABELS: Record<AttendanceStatus, string> = {
  PRESENT: 'Đúng giờ',
  LATE: 'Đi muộn',
  ABSENT: 'Vắng mặt',
  LEAVE: 'Nghỉ phép',
  HOLIDAY: 'Ngày lễ',
};

const SOURCE_LABELS: Record<AttendanceSource, string> = {
  WEB: 'Web ESS',
  IMPORT: 'Import Excel',
  MANUAL: 'HR chỉnh tay',
};

async function getSelfEmployee(userId: number) {
  const db = getDb();
  const emp = await db
    .selectFrom('employees as e')
    .innerJoin('branches as b', 'b.id', 'e.branch_id')
    .innerJoin('departments as d', 'd.id', 'e.department_id')
    .select([
      'e.id',
      'e.employee_code',
      'e.full_name',
      'e.branch_id',
      'e.department_id',
      'b.name as branch_name',
      'b.name_en as branch_name_en',
      'd.name as department_name',
      'd.name_en as department_name_en',
    ])
    .where('e.user_id', '=', userId)
    .where('e.deleted_at', 'is', null)
    .executeTakeFirst();

  if (!emp) {
    throw new AppError(
      'EMPLOYEE_PROFILE_NOT_FOUND',
      'Tài khoản của bạn chưa được liên kết với hồ sơ nhân viên. Vui lòng liên hệ Phòng Nhân sự.',
      404,
    );
  }
  return {
    id: Number(emp.id),
    employeeCode: String(emp.employee_code),
    fullName: String(emp.full_name),
    branchId: Number(emp.branch_id),
    departmentId: Number(emp.department_id),
    branchName: String(emp.branch_name),
    branchNameEn: emp.branch_name_en ? String(emp.branch_name_en) : null,
    departmentName: String(emp.department_name),
    departmentNameEn: emp.department_name_en ? String(emp.department_name_en) : null,
  };
}

async function getAttendanceLogByIdInternal(id: number): Promise<AttendanceLogItem | null> {
  const db = getDb();
  const row = await db
    .selectFrom('attendance_logs as al')
    .innerJoin('employees as e', 'e.id', 'al.employee_id')
    .innerJoin('branches as b', 'b.id', 'e.branch_id')
    .innerJoin('departments as d', 'd.id', 'e.department_id')
    .leftJoin('work_shifts as ws', 'ws.id', 'al.shift_id')
    .select([
      'al.id',
      'al.employee_id',
      'e.employee_code',
      'e.full_name as employee_name',
      'e.branch_id',
      'b.name as branch_name',
      'b.name_en as branch_name_en',
      'e.department_id',
      'd.name as department_name',
      'd.name_en as department_name_en',
      'al.work_date',
      'al.shift_id',
      'ws.code as shift_code',
      'ws.name as shift_name',
      'ws.name_en as shift_name_en',
      'al.check_in_at',
      'al.check_out_at',
      'al.source',
      'al.late_minutes',
      'al.early_leave_minutes',
      'al.worked_hours',
      'al.status',
      'al.note',
    ])
    .where('al.id', '=', id)
    .where('al.deleted_at', 'is', null)
    .executeTakeFirst();

  if (!row) {
    return null;
  }

  return mapRowToAttendanceLogItem(row);
}

function mapRowToAttendanceLogItem(row: {
  id: number | bigint;
  employee_id: number | bigint;
  employee_code: string;
  employee_name: string;
  branch_id: number | bigint;
  branch_name: string;
  branch_name_en?: string | null;
  department_id: number | bigint;
  department_name: string;
  department_name_en?: string | null;
  work_date: Date | string;
  shift_id: number | bigint | null;
  shift_code: string | null;
  shift_name: string | null;
  shift_name_en?: string | null;
  check_in_at: Date | string | null;
  check_out_at: Date | string | null;
  source: AttendanceSource;
  late_minutes: number;
  early_leave_minutes: number;
  worked_hours: string | number;
  status: AttendanceStatus;
  note: string | null;
}): AttendanceLogItem {
  return {
    id: Number(row.id),
    employeeId: Number(row.employee_id),
    employeeCode: String(row.employee_code),
    employeeName: String(row.employee_name),
    branchId: Number(row.branch_id),
    branchName: String(row.branch_name),
    branchNameEn: row.branch_name_en ? String(row.branch_name_en) : null,
    departmentId: Number(row.department_id),
    departmentName: String(row.department_name),
    departmentNameEn: row.department_name_en ? String(row.department_name_en) : null,
    workDate: extractIsoDate(row.work_date) ?? '',
    shiftId: row.shift_id !== null ? Number(row.shift_id) : null,
    shiftCode: row.shift_code ? String(row.shift_code) : null,
    shiftName: row.shift_name ? String(row.shift_name) : null,
    shiftNameEn: row.shift_name_en ? String(row.shift_name_en) : null,
    checkInTime: extractTimeHHmm(row.check_in_at),
    checkOutTime: extractTimeHHmm(row.check_out_at),
    source: row.source,
    lateMinutes: Number(row.late_minutes),
    earlyLeaveMinutes: Number(row.early_leave_minutes),
    workedHours: Number(row.worked_hours),
    status: row.status,
    note: row.note ? String(row.note) : null,
  };
}

async function loadShiftConfigById(shiftId: number): Promise<ShiftMetricConfig | null> {
  const db = getDb();
  const row = await db
    .selectFrom('work_shifts')
    .select([
      'start_time',
      'end_time',
      'break_start_time',
      'break_end_time',
      'late_grace_minutes',
      'early_leave_grace_minutes',
    ])
    .where('id', '=', shiftId)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (!row) {
    return null;
  }

  return {
    startTime: String(row.start_time),
    endTime: String(row.end_time),
    breakStartTime: row.break_start_time ? String(row.break_start_time) : null,
    breakEndTime: row.break_end_time ? String(row.break_end_time) : null,
    lateGraceMinutes: Number(row.late_grace_minutes),
    earlyLeaveGraceMinutes: Number(row.early_leave_grace_minutes),
  };
}

export async function getMyAttendance(
  auth: AuthContext,
  query: { year?: string | null; month?: string | null },
): Promise<MyAttendanceResponse> {
  const employee = await getSelfEmployee(auth.userId);
  const nowParts = getVietnamNowParts();
  const defaultYear = Number(nowParts.date.slice(0, 4));
  const defaultMonth = Number(nowParts.date.slice(5, 7));

  const year =
    query.year && /^\d{4}$/.test(query.year) ? Number(query.year) : defaultYear;
  const month =
    query.month && Number(query.month) >= 1 && Number(query.month) <= 12
      ? Number(query.month)
      : defaultMonth;

  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = dayjs(startDate).endOf('month').format('YYYY-MM-DD');

  const db = getDb();
  const [todayShift, isTodayHoliday, rows, todayRow] = await Promise.all([
    resolveEffectiveShift(employee.id, employee.branchId, nowParts.date),
    isHolidayDate(nowParts.date, employee.branchId),
    db
      .selectFrom('attendance_logs as al')
      .innerJoin('employees as e', 'e.id', 'al.employee_id')
      .innerJoin('branches as b', 'b.id', 'e.branch_id')
      .innerJoin('departments as d', 'd.id', 'e.department_id')
      .leftJoin('work_shifts as ws', 'ws.id', 'al.shift_id')
      .select([
        'al.id',
        'al.employee_id',
        'e.employee_code',
        'e.full_name as employee_name',
        'e.branch_id',
        'b.name as branch_name',
        'b.name_en as branch_name_en',
        'e.department_id',
        'd.name as department_name',
        'd.name_en as department_name_en',
        'al.work_date',
        'al.shift_id',
        'ws.code as shift_code',
        'ws.name as shift_name',
        'ws.name_en as shift_name_en',
        'al.check_in_at',
        'al.check_out_at',
        'al.source',
        'al.late_minutes',
        'al.early_leave_minutes',
        'al.worked_hours',
        'al.status',
        'al.note',
      ])
      .where('al.employee_id', '=', employee.id)
      .where('al.work_date', '>=', startDate)
      .where('al.work_date', '<=', endDate)
      .where('al.deleted_at', 'is', null)
      .orderBy('al.work_date', 'desc')
      .execute(),
    db
      .selectFrom('attendance_logs as al')
      .innerJoin('employees as e', 'e.id', 'al.employee_id')
      .innerJoin('branches as b', 'b.id', 'e.branch_id')
      .innerJoin('departments as d', 'd.id', 'e.department_id')
      .leftJoin('work_shifts as ws', 'ws.id', 'al.shift_id')
      .select([
        'al.id',
        'al.employee_id',
        'e.employee_code',
        'e.full_name as employee_name',
        'e.branch_id',
        'b.name as branch_name',
        'b.name_en as branch_name_en',
        'e.department_id',
        'd.name as department_name',
        'd.name_en as department_name_en',
        'al.work_date',
        'al.shift_id',
        'ws.code as shift_code',
        'ws.name as shift_name',
        'ws.name_en as shift_name_en',
        'al.check_in_at',
        'al.check_out_at',
        'al.source',
        'al.late_minutes',
        'al.early_leave_minutes',
        'al.worked_hours',
        'al.status',
        'al.note',
      ])
      .where('al.employee_id', '=', employee.id)
      .where('al.work_date', '=', nowParts.date)
      .where('al.deleted_at', 'is', null)
      .executeTakeFirst(),
  ]);

  const logs = rows.map(mapRowToAttendanceLogItem);
  const todayLog = todayRow ? mapRowToAttendanceLogItem(todayRow) : null;

  let presentDays = 0;
  let lateDays = 0;
  let totalLateMinutes = 0;
  let totalEarlyLeaveMinutes = 0;
  let totalWorkedHours = 0;

  for (const item of logs) {
    if (item.status === 'PRESENT' || item.status === 'LATE') {
      presentDays += 1;
    }
    if (item.status === 'LATE' || item.lateMinutes > 0) {
      lateDays += 1;
    }
    totalLateMinutes += item.lateMinutes;
    totalEarlyLeaveMinutes += item.earlyLeaveMinutes;
    totalWorkedHours += item.workedHours;
  }

  return {
    employee: {
      id: employee.id,
      employeeCode: employee.employeeCode,
      fullName: employee.fullName,
      branchName: employee.branchName,
      departmentName: employee.departmentName,
    },
    year,
    month,
    todayDate: nowParts.date,
    todayShift,
    isTodayHoliday,
    todayLog,
    stats: {
      presentDays,
      lateDays,
      totalLateMinutes,
      totalEarlyLeaveMinutes,
      totalWorkedHours: roundHours(totalWorkedHours),
    },
    logs,
  };
}

export async function checkInMe(
  auth: AuthContext,
  input: CheckInOutInput,
  ipAddress: string | null,
): Promise<AttendanceLogItem> {
  const employee = await getSelfEmployee(auth.userId);
  const nowParts = getVietnamNowParts();
  const db = getDb();

  const existing = await db
    .selectFrom('attendance_logs')
    .select(['id', 'check_in_at', 'check_out_at', 'shift_id', 'deleted_at'])
    .where('employee_id', '=', employee.id)
    .where('work_date', '=', nowParts.date)
    .executeTakeFirst();

  if (existing && existing.deleted_at === null && existing.check_in_at !== null) {
    throw new AppError(
      'ALREADY_CHECKED_IN',
      `Bạn đã Check-in hôm nay lúc ${extractTimeHHmm(existing.check_in_at) ?? ''}.`,
      409,
    );
  }

  const [shift, holiday] = await Promise.all([
    resolveEffectiveShift(employee.id, employee.branchId, nowParts.date),
    isHolidayDate(nowParts.date, employee.branchId),
  ]);

  const metrics = computeAttendanceMetrics({
    checkInMinutes: nowParts.minutes,
    checkOutMinutes: null,
    shift,
    isHoliday: holiday,
  });

  let logId: number;
  if (existing) {
    logId = Number(existing.id);
    await db
      .updateTable('attendance_logs')
      .set({
        shift_id: shift?.id ?? null,
        check_in_at: nowParts.sqlDateTime,
        check_out_at: null,
        source: 'WEB',
        late_minutes: metrics.lateMinutes,
        early_leave_minutes: 0,
        worked_hours: '0.00',
        status: metrics.status,
        note: input.note ?? null,
        deleted_at: null,
        updated_by: auth.userId,
      })
      .where('id', '=', logId)
      .execute();
  } else {
    const inserted = await db
      .insertInto('attendance_logs')
      .values({
        employee_id: employee.id,
        work_date: nowParts.date,
        shift_id: shift?.id ?? null,
        check_in_at: nowParts.sqlDateTime,
        check_out_at: null,
        source: 'WEB',
        late_minutes: metrics.lateMinutes,
        early_leave_minutes: 0,
        worked_hours: '0.00',
        status: metrics.status,
        note: input.note ?? null,
        created_by: auth.userId,
        updated_by: auth.userId,
      })
      .executeTakeFirstOrThrow();
    logId = Number(inserted.insertId);
  }

  const result = await getAttendanceLogByIdInternal(logId);
  if (!result) {
    throw new AppError('INTERNAL_ERROR', 'Không thể đọc bản ghi chấm công sau khi Check-in.', 500);
  }

  await recordAuditLog({
    userId: auth.userId,
    moduleCode: 'hrm',
    action: 'ATTENDANCE_CHECK_IN',
    entityType: 'attendance_logs',
    entityId: String(logId),
    newValues: {
      workDate: result.workDate,
      checkInTime: result.checkInTime,
      lateMinutes: result.lateMinutes,
      status: result.status,
    },
    ipAddress,
  });

  return result;
}

export async function checkOutMe(
  auth: AuthContext,
  input: CheckInOutInput,
  ipAddress: string | null,
): Promise<AttendanceLogItem> {
  const employee = await getSelfEmployee(auth.userId);
  const nowParts = getVietnamNowParts();
  const db = getDb();

  const existing = await db
    .selectFrom('attendance_logs')
    .select(['id', 'shift_id', 'check_in_at', 'note'])
    .where('employee_id', '=', employee.id)
    .where('work_date', '=', nowParts.date)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (!existing || !existing.check_in_at) {
    throw new AppError(
      'NOT_CHECKED_IN',
      'Bạn chưa Check-in hôm nay nên không thể Check-out.',
      400,
    );
  }

  const checkInTimeStr = extractTimeHHmm(existing.check_in_at);
  const checkInMinutes = parseTimeToMinutes(checkInTimeStr);
  if (checkInMinutes === null) {
    throw new AppError('INVALID_CHECK_IN', 'Dữ liệu giờ Check-in không hợp lệ.', 400);
  }

  const [shiftConfig, holiday] = await Promise.all([
    existing.shift_id !== null
      ? loadShiftConfigById(Number(existing.shift_id))
      : resolveEffectiveShift(employee.id, employee.branchId, nowParts.date),
    isHolidayDate(nowParts.date, employee.branchId),
  ]);

  let metrics;
  try {
    metrics = computeAttendanceMetrics({
      checkInMinutes,
      checkOutMinutes: nowParts.minutes,
      shift: shiftConfig,
      isHoliday: holiday,
    });
  } catch (err) {
    throw new AppError(
      'INVALID_CHECK_OUT',
      err instanceof Error ? err.message : 'Giờ Check-out không hợp lệ.',
      400,
    );
  }

  const logId = Number(existing.id);
  const nextNote =
    input.note && input.note.trim().length > 0
      ? input.note.trim()
      : existing.note
        ? String(existing.note)
        : null;

  await db
    .updateTable('attendance_logs')
    .set({
      check_out_at: nowParts.sqlDateTime,
      late_minutes: metrics.lateMinutes,
      early_leave_minutes: metrics.earlyLeaveMinutes,
      worked_hours: metrics.workedHours.toFixed(2),
      status: metrics.status,
      note: nextNote,
      updated_by: auth.userId,
    })
    .where('id', '=', logId)
    .execute();

  const result = await getAttendanceLogByIdInternal(logId);
  if (!result) {
    throw new AppError('INTERNAL_ERROR', 'Không thể đọc bản ghi chấm công sau khi Check-out.', 500);
  }

  await recordAuditLog({
    userId: auth.userId,
    moduleCode: 'hrm',
    action: 'ATTENDANCE_CHECK_OUT',
    entityType: 'attendance_logs',
    entityId: String(logId),
    newValues: {
      workDate: result.workDate,
      checkInTime: result.checkInTime,
      checkOutTime: result.checkOutTime,
      workedHours: result.workedHours,
      earlyLeaveMinutes: result.earlyLeaveMinutes,
    },
    ipAddress,
  });

  return result;
}

async function buildFilteredLogsQuery(auth: AuthContext, query: AttendanceLogFilterQuery) {
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
    .selectFrom('attendance_logs as al')
    .innerJoin('employees as e', 'e.id', 'al.employee_id')
    .innerJoin('branches as b', 'b.id', 'e.branch_id')
    .innerJoin('departments as d', 'd.id', 'e.department_id')
    .leftJoin('work_shifts as ws', 'ws.id', 'al.shift_id')
    .where('al.deleted_at', 'is', null)
    .where('e.deleted_at', 'is', null);

  if (scope.mode === 'BRANCH') {
    builder = builder.where('e.branch_id', 'in', scope.branchIds);
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
    builder = builder.where('e.id', '=', scope.selfEmployeeId);
  }

  if (query.fromDate && /^\d{4}-\d{2}-\d{2}$/.test(query.fromDate)) {
    builder = builder.where('al.work_date', '>=', query.fromDate);
  }
  if (query.toDate && /^\d{4}-\d{2}-\d{2}$/.test(query.toDate)) {
    builder = builder.where('al.work_date', '<=', query.toDate);
  }
  if (query.branchId && Number(query.branchId) > 0) {
    builder = builder.where('e.branch_id', '=', Number(query.branchId));
  }
  if (query.departmentId && Number(query.departmentId) > 0) {
    builder = builder.where('e.department_id', '=', Number(query.departmentId));
  }
  if (query.employeeId && Number(query.employeeId) > 0) {
    builder = builder.where('al.employee_id', '=', Number(query.employeeId));
  }
  if (
    query.status &&
    ['PRESENT', 'LATE', 'ABSENT', 'LEAVE', 'HOLIDAY'].includes(query.status)
  ) {
    builder = builder.where('al.status', '=', query.status as AttendanceStatus);
  }
  if (query.source && ['WEB', 'IMPORT', 'MANUAL'].includes(query.source)) {
    builder = builder.where('al.source', '=', query.source as AttendanceSource);
  }
  if (query.search && query.search.trim().length > 0) {
    const keyword = `%${query.search.trim()}%`;
    builder = builder.where((eb) =>
      eb.or([eb('e.employee_code', 'like', keyword), eb('e.full_name', 'like', keyword)]),
    );
  }

  return builder;
}

export async function listAttendanceLogs(
  auth: AuthContext,
  query: AttendanceLogFilterQuery,
): Promise<{ items: AttendanceLogItem[]; meta: PaginationMeta }> {
  const pagination = parsePaginationParams(
    { page: query.page ?? undefined, limit: query.limit ?? undefined },
    { defaultLimit: 20, maxLimit: 100 },
  );

  const baseQuery = await buildFilteredLogsQuery(auth, query);
  if (!baseQuery) {
    return { items: [], meta: buildPaginationMeta(0, pagination.page, pagination.limit) };
  }

  const countRow = await baseQuery
    .select((eb) => eb.fn.count<number>('al.id').as('total'))
    .executeTakeFirst();
  const total = Number(countRow?.total ?? 0);

  const rows = await baseQuery
    .select([
      'al.id',
      'al.employee_id',
      'e.employee_code',
      'e.full_name as employee_name',
      'e.branch_id',
      'b.name as branch_name',
      'b.name_en as branch_name_en',
      'e.department_id',
      'd.name as department_name',
      'd.name_en as department_name_en',
      'al.work_date',
      'al.shift_id',
      'ws.code as shift_code',
      'ws.name as shift_name',
      'ws.name_en as shift_name_en',
      'al.check_in_at',
      'al.check_out_at',
      'al.source',
      'al.late_minutes',
      'al.early_leave_minutes',
      'al.worked_hours',
      'al.status',
      'al.note',
    ])
    .orderBy('al.work_date', 'desc')
    .orderBy('e.employee_code', 'asc')
    .limit(pagination.limit)
    .offset(pagination.offset)
    .execute();

  return {
    items: rows.map(mapRowToAttendanceLogItem),
    meta: buildPaginationMeta(total, pagination.page, pagination.limit),
  };
}

export async function upsertManualAttendanceLog(
  input: UpsertManualAttendanceInput,
  auth: AuthContext,
  ipAddress: string | null,
): Promise<{ item: AttendanceLogItem; created: boolean }> {
  const db = getDb();
  const emp = await db
    .selectFrom('employees')
    .select(['id', 'branch_id', 'department_id', 'user_id', 'employee_code'])
    .where('id', '=', input.employeeId)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (!emp) {
    throw new AppError('EMPLOYEE_NOT_FOUND', 'Không tìm thấy nhân viên.', 404);
  }

  const scope = await resolveEmployeeAccessScope(auth);
  const allowed = isEmployeeWithinScope(
    scope,
    {
      id: Number(emp.id),
      branchId: Number(emp.branch_id),
      departmentId: Number(emp.department_id),
      userId: emp.user_id !== null ? Number(emp.user_id) : null,
    },
    auth.userId,
  );
  if (!allowed) {
    throw new AppError('FORBIDDEN_SCOPE', 'Bạn không có quyền chấm công nhân viên ngoài phạm vi.', 403);
  }

  if (await isEmployeeMonthLocked(input.employeeId, input.workDate)) {
    throw new AppError(
      'ATTENDANCE_PERIOD_LOCKED',
      'Kỳ bảng công tháng của ngày này đã được chốt khóa (LOCKED). Vui lòng mở khóa kỳ công trước khi điều chỉnh.',
      409,
    );
  }

  let resolvedShift: ShiftMetricConfig | null = null;
  let shiftId: number | null = null;
  if (input.shiftId !== undefined && input.shiftId !== null) {
    resolvedShift = await loadShiftConfigById(input.shiftId);
    shiftId = input.shiftId;
  } else {
    const effectiveShift = await resolveEffectiveShift(
      Number(emp.id),
      Number(emp.branch_id),
      input.workDate,
    );
    resolvedShift = effectiveShift;
    shiftId = effectiveShift ? effectiveShift.id : null;
  }

  const holiday = await isHolidayDate(input.workDate, Number(emp.branch_id));
  const checkInMinutes = parseTimeToMinutes(input.checkInTime);
  const checkOutMinutes = parseTimeToMinutes(input.checkOutTime);

  let metrics;
  try {
    metrics = computeAttendanceMetrics({
      checkInMinutes,
      checkOutMinutes,
      shift: resolvedShift,
      isHoliday: holiday,
      overrideStatus: input.status ?? null,
    });
  } catch (err) {
    throw new AppError(
      'INVALID_ATTENDANCE_TIME',
      err instanceof Error ? err.message : 'Thời gian chấm công không hợp lệ.',
      400,
    );
  }

  const existing = await db
    .selectFrom('attendance_logs')
    .select(['id', 'check_in_at', 'check_out_at', 'status', 'worked_hours', 'note', 'deleted_at'])
    .where('employee_id', '=', input.employeeId)
    .where('work_date', '=', input.workDate)
    .executeTakeFirst();

  let logId: number;
  let isCreated = false;
  if (existing) {
    logId = Number(existing.id);
    await db
      .updateTable('attendance_logs')
      .set({
        shift_id: shiftId,
        check_in_at: buildSqlDateTime(input.workDate, input.checkInTime),
        check_out_at: buildSqlDateTime(input.workDate, input.checkOutTime),
        source: 'MANUAL',
        late_minutes: metrics.lateMinutes,
        early_leave_minutes: metrics.earlyLeaveMinutes,
        worked_hours: metrics.workedHours.toFixed(2),
        status: metrics.status,
        note: input.note,
        deleted_at: null,
        updated_by: auth.userId,
      })
      .where('id', '=', logId)
      .execute();
  } else {
    isCreated = true;
    const inserted = await db
      .insertInto('attendance_logs')
      .values({
        employee_id: input.employeeId,
        work_date: input.workDate,
        shift_id: shiftId,
        check_in_at: buildSqlDateTime(input.workDate, input.checkInTime),
        check_out_at: buildSqlDateTime(input.workDate, input.checkOutTime),
        source: 'MANUAL',
        late_minutes: metrics.lateMinutes,
        early_leave_minutes: metrics.earlyLeaveMinutes,
        worked_hours: metrics.workedHours.toFixed(2),
        status: metrics.status,
        note: input.note,
        created_by: auth.userId,
        updated_by: auth.userId,
      })
      .executeTakeFirstOrThrow();
    logId = Number(inserted.insertId);
  }

  const item = await getAttendanceLogByIdInternal(logId);
  if (!item) {
    throw new AppError('INTERNAL_ERROR', 'Không thể đọc bản ghi chấm công vừa lưu.', 500);
  }

  await recordAuditLog({
    userId: auth.userId,
    moduleCode: 'hrm',
    action: isCreated ? 'MANUAL_CREATE_ATTENDANCE' : 'MANUAL_UPDATE_ATTENDANCE',
    entityType: 'attendance_logs',
    entityId: String(logId),
    oldValues: existing
      ? {
          checkInTime: extractTimeHHmm(existing.check_in_at),
          checkOutTime: extractTimeHHmm(existing.check_out_at),
          status: existing.status,
          workedHours: Number(existing.worked_hours),
          note: existing.note,
        }
      : null,
    newValues: { ...item },
    ipAddress,
  });

  return { item, created: isCreated };
}

export async function updateManualAttendanceLog(
  id: number,
  input: UpdateManualAttendanceInput,
  auth: AuthContext,
  ipAddress: string | null,
): Promise<AttendanceLogItem> {
  const db = getDb();
  const current = await db
    .selectFrom('attendance_logs as al')
    .innerJoin('employees as e', 'e.id', 'al.employee_id')
    .select([
      'al.id',
      'al.employee_id',
      'al.work_date',
      'al.shift_id',
      'al.check_in_at',
      'al.check_out_at',
      'al.status',
      'al.worked_hours',
      'al.note',
      'e.branch_id',
      'e.department_id',
      'e.user_id',
    ])
    .where('al.id', '=', id)
    .where('al.deleted_at', 'is', null)
    .executeTakeFirst();

  if (!current) {
    throw new AppError('ATTENDANCE_LOG_NOT_FOUND', 'Không tìm thấy bản ghi chấm công.', 404);
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
    throw new AppError('FORBIDDEN_SCOPE', 'Bạn không có quyền chỉnh sửa chấm công ngoài phạm vi.', 403);
  }

  const workDate = extractIsoDate(current.work_date) ?? '';
  if (await isEmployeeMonthLocked(Number(current.employee_id), workDate)) {
    throw new AppError(
      'ATTENDANCE_PERIOD_LOCKED',
      'Kỳ bảng công tháng của bản ghi này đã được chốt khóa (LOCKED). Vui lòng mở khóa kỳ công trước khi điều chỉnh.',
      409,
    );
  }
  const nextShiftId =
    input.shiftId !== undefined
      ? input.shiftId
      : current.shift_id !== null
        ? Number(current.shift_id)
        : null;

  const shiftConfig =
    nextShiftId !== null
      ? await loadShiftConfigById(nextShiftId)
      : await resolveEffectiveShift(Number(current.employee_id), Number(current.branch_id), workDate);

  const nextCheckInStr =
    input.checkInTime !== undefined ? input.checkInTime : extractTimeHHmm(current.check_in_at);
  const nextCheckOutStr =
    input.checkOutTime !== undefined ? input.checkOutTime : extractTimeHHmm(current.check_out_at);

  const holiday = await isHolidayDate(workDate, Number(current.branch_id));
  let metrics;
  try {
    metrics = computeAttendanceMetrics({
      checkInMinutes: parseTimeToMinutes(nextCheckInStr),
      checkOutMinutes: parseTimeToMinutes(nextCheckOutStr),
      shift: shiftConfig,
      isHoliday: holiday,
      overrideStatus: input.status ?? null,
    });
  } catch (err) {
    throw new AppError(
      'INVALID_ATTENDANCE_TIME',
      err instanceof Error ? err.message : 'Thời gian chấm công không hợp lệ.',
      400,
    );
  }

  await db
    .updateTable('attendance_logs')
    .set({
      shift_id: nextShiftId,
      check_in_at: buildSqlDateTime(workDate, nextCheckInStr),
      check_out_at: buildSqlDateTime(workDate, nextCheckOutStr),
      source: 'MANUAL',
      late_minutes: metrics.lateMinutes,
      early_leave_minutes: metrics.earlyLeaveMinutes,
      worked_hours: metrics.workedHours.toFixed(2),
      status: metrics.status,
      note: input.note,
      updated_by: auth.userId,
    })
    .where('id', '=', id)
    .execute();

  const updated = await getAttendanceLogByIdInternal(id);
  if (!updated) {
    throw new AppError('INTERNAL_ERROR', 'Không thể đọc lại bản ghi chấm công sau cập nhật.', 500);
  }

  await recordAuditLog({
    userId: auth.userId,
    moduleCode: 'hrm',
    action: 'MANUAL_UPDATE_ATTENDANCE',
    entityType: 'attendance_logs',
    entityId: String(id),
    oldValues: {
      checkInTime: extractTimeHHmm(current.check_in_at),
      checkOutTime: extractTimeHHmm(current.check_out_at),
      status: current.status,
      workedHours: Number(current.worked_hours),
      note: current.note,
    },
    newValues: { ...updated },
    ipAddress,
  });

  return updated;
}

export async function exportAttendanceLogsExcel(
  auth: AuthContext,
  query: AttendanceLogFilterQuery,
): Promise<{ buffer: Buffer; fileName: string }> {
  const baseQuery = await buildFilteredLogsQuery(auth, query);
  const rows = baseQuery
    ? await baseQuery
        .select([
          'al.id',
          'al.employee_id',
          'e.employee_code',
          'e.full_name as employee_name',
          'e.branch_id',
          'b.name as branch_name',
          'b.name_en as branch_name_en',
          'e.department_id',
          'd.name as department_name',
          'd.name_en as department_name_en',
          'al.work_date',
          'al.shift_id',
          'ws.code as shift_code',
          'ws.name as shift_name',
          'ws.name_en as shift_name_en',
          'al.check_in_at',
          'al.check_out_at',
          'al.source',
          'al.late_minutes',
          'al.early_leave_minutes',
          'al.worked_hours',
          'al.status',
          'al.note',
        ])
        .orderBy('al.work_date', 'desc')
        .orderBy('e.employee_code', 'asc')
        .limit(5000)
        .execute()
    : [];

  const items = rows.map(mapRowToAttendanceLogItem);
  const nowParts = getVietnamNowParts();

  const buffer = await buildExcelBuffer(
    items,
    [
      { header: 'STT', key: 'stt', width: 7, align: 'center', value: (_r, idx) => idx + 1 },
      { header: 'Ngày công', key: 'workDate', width: 14, align: 'center', value: (r) => formatDateVN(r.workDate) },
      { header: 'Mã NV', key: 'employeeCode', width: 12 },
      { header: 'Họ và tên', key: 'employeeName', width: 24 },
      { header: 'Chi nhánh', key: 'branchName', width: 20 },
      { header: 'Phòng ban', key: 'departmentName', width: 22 },
      { header: 'Ca làm việc', key: 'shiftName', width: 20, value: (r) => r.shiftCode ? `${r.shiftCode} - ${r.shiftName ?? ''}` : '-' },
      { header: 'Giờ vào', key: 'checkInTime', width: 11, align: 'center', value: (r) => r.checkInTime ?? '-' },
      { header: 'Giờ ra', key: 'checkOutTime', width: 11, align: 'center', value: (r) => r.checkOutTime ?? '-' },
      { header: 'Đi muộn (phút)', key: 'lateMinutes', width: 15, align: 'right', numFmt: '#,##0' },
      { header: 'Về sớm (phút)', key: 'earlyLeaveMinutes', width: 15, align: 'right', numFmt: '#,##0' },
      { header: 'Giờ công', key: 'workedHours', width: 12, align: 'right', numFmt: '0.00' },
      { header: 'Trạng thái', key: 'status', width: 14, align: 'center', value: (r) => STATUS_LABELS[r.status] },
      { header: 'Nguồn', key: 'source', width: 14, align: 'center', value: (r) => SOURCE_LABELS[r.source] },
      { header: 'Ghi chú', key: 'note', width: 28, value: (r) => r.note ?? '' },
    ],
    {
      sheetName: 'ChamCongNgay',
      title: 'BẢNG NHẬT KÝ CHẤM CÔNG HÀNG NGÀY',
      subtitle: `Ngày xuất: ${formatDateVN(nowParts.date)} | Tổng số dòng: ${items.length}`,
    },
  );

  return {
    buffer,
    fileName: `cham-cong-ngay-${nowParts.date}.xlsx`,
  };
}
