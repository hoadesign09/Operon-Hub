import dayjs from 'dayjs';
import { getDb } from '@/config/database';
import { buildPaginationMeta, parsePaginationParams, type PaginationMeta } from '@/lib/portable/pagination';
import { recordAuditLog } from '@/modules/audit/audit.service';
import type { AuthContext } from '@/modules/auth/auth.service';
import {
  isEmployeeWithinScope,
  resolveEmployeeAccessScope,
} from '@/modules/hrm/employees/employees.scope';
import {
  computeShiftWorkingHours,
  extractIsoDate,
  type ShiftMetricConfig,
} from '@/modules/hrm/attendance/attendance-calculator';
import type {
  CreateShiftAssignmentInput,
  CreateWorkShiftInput,
  UpdateWorkShiftInput,
} from '@/modules/hrm/attendance/attendance.schema';
import { AppError } from '@/shared/api-response';

export interface WorkShiftItem {
  id: number;
  branchId: number | null;
  branchName: string | null;
  code: string;
  name: string;
  startTime: string;
  endTime: string;
  breakStartTime: string | null;
  breakEndTime: string | null;
  lateGraceMinutes: number;
  earlyLeaveGraceMinutes: number;
  workingHours: number;
  isDefault: boolean;
  isActive: boolean;
  description: string | null;
  assignedEmployeeCount: number;
}

export interface ShiftAssignmentItem {
  id: number;
  employeeId: number;
  employeeCode: string;
  employeeName: string;
  branchId: number;
  branchName: string;
  departmentName: string;
  shiftId: number;
  shiftCode: string;
  shiftName: string;
  startTime: string;
  endTime: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  workDays: number[];
  note: string | null;
}

export interface ResolvedEffectiveShift extends ShiftMetricConfig {
  id: number;
  code: string;
  name: string;
  workingHours: number;
  workDays: number[];
}

function parseWorkDaysJson(raw: string | number[] | null | undefined): number[] {
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

export async function listWorkShifts(query: {
  branchId?: string | null;
  isActive?: string | null;
  search?: string | null;
}): Promise<WorkShiftItem[]> {
  const db = getDb();
  let builder = db
    .selectFrom('work_shifts as ws')
    .leftJoin('branches as b', 'b.id', 'ws.branch_id')
    .select([
      'ws.id',
      'ws.branch_id',
      'b.name as branch_name',
      'ws.code',
      'ws.name',
      'ws.start_time',
      'ws.end_time',
      'ws.break_start_time',
      'ws.break_end_time',
      'ws.late_grace_minutes',
      'ws.early_leave_grace_minutes',
      'ws.working_hours',
      'ws.is_default',
      'ws.is_active',
      'ws.description',
    ])
    .where('ws.deleted_at', 'is', null);

  if (query.branchId && Number(query.branchId) > 0) {
    const bId = Number(query.branchId);
    builder = builder.where((eb) =>
      eb.or([eb('ws.branch_id', 'is', null), eb('ws.branch_id', '=', bId)]),
    );
  }
  if (query.isActive === 'true' || query.isActive === '1') {
    builder = builder.where('ws.is_active', '=', 1);
  } else if (query.isActive === 'false' || query.isActive === '0') {
    builder = builder.where('ws.is_active', '=', 0);
  }
  if (query.search && query.search.trim().length > 0) {
    const keyword = `%${query.search.trim()}%`;
    builder = builder.where((eb) =>
      eb.or([eb('ws.code', 'like', keyword), eb('ws.name', 'like', keyword)]),
    );
  }

  const rows = await builder
    .orderBy('ws.is_default', 'desc')
    .orderBy('ws.code', 'asc')
    .execute();

  const shiftIds = rows.map((r) => Number(r.id));
  const countMap = new Map<number, number>();
  if (shiftIds.length > 0) {
    const assignmentRows = await db
      .selectFrom('employee_shift_assignments')
      .select(['shift_id', db.fn.count<number>('id').as('total')])
      .where('shift_id', 'in', shiftIds)
      .where('deleted_at', 'is', null)
      .groupBy('shift_id')
      .execute();
    for (const row of assignmentRows) {
      countMap.set(Number(row.shift_id), Number(row.total));
    }
  }

  return rows.map((row) => ({
    id: Number(row.id),
    branchId: row.branch_id !== null ? Number(row.branch_id) : null,
    branchName: row.branch_name ? String(row.branch_name) : null,
    code: String(row.code),
    name: String(row.name),
    startTime: String(row.start_time),
    endTime: String(row.end_time),
    breakStartTime: row.break_start_time ? String(row.break_start_time) : null,
    breakEndTime: row.break_end_time ? String(row.break_end_time) : null,
    lateGraceMinutes: Number(row.late_grace_minutes),
    earlyLeaveGraceMinutes: Number(row.early_leave_grace_minutes),
    workingHours: Number(row.working_hours),
    isDefault: Number(row.is_default) === 1,
    isActive: Number(row.is_active) === 1,
    description: row.description ? String(row.description) : null,
    assignedEmployeeCount: countMap.get(Number(row.id)) ?? 0,
  }));
}

export async function createWorkShift(
  input: CreateWorkShiftInput,
  auth: AuthContext,
  ipAddress: string | null,
): Promise<WorkShiftItem> {
  let workingHours: number;
  try {
    workingHours = computeShiftWorkingHours(
      input.startTime,
      input.endTime,
      input.breakStartTime,
      input.breakEndTime,
    );
  } catch (err) {
    throw new AppError(
      'INVALID_SHIFT_TIME',
      err instanceof Error ? err.message : 'Khung giờ ca làm việc không hợp lệ.',
      400,
    );
  }

  const db = getDb();
  const existing = await db
    .selectFrom('work_shifts')
    .select(['id'])
    .where('code', '=', input.code)
    .executeTakeFirst();
  if (existing) {
    throw new AppError('DUPLICATE_SHIFT_CODE', `Mã ca làm việc "${input.code}" đã tồn tại.`, 409);
  }

  const branchId = input.branchId ?? null;
  if (branchId !== null) {
    const branch = await db
      .selectFrom('branches')
      .select(['id'])
      .where('id', '=', branchId)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();
    if (!branch) {
      throw new AppError('BRANCH_NOT_FOUND', 'Chi nhánh không tồn tại.', 404);
    }
  }

  const insertedId = await db.transaction().execute(async (trx) => {
    if (input.isDefault) {
      let resetQuery = trx
        .updateTable('work_shifts')
        .set({ is_default: 0, updated_by: auth.userId })
        .where('deleted_at', 'is', null);
      if (branchId === null) {
        resetQuery = resetQuery.where('branch_id', 'is', null);
      } else {
        resetQuery = resetQuery.where('branch_id', '=', branchId);
      }
      await resetQuery.execute();
    }

    const res = await trx
      .insertInto('work_shifts')
      .values({
        branch_id: branchId,
        code: input.code,
        name: input.name,
        start_time: input.startTime,
        end_time: input.endTime,
        break_start_time: input.breakStartTime ?? null,
        break_end_time: input.breakEndTime ?? null,
        late_grace_minutes: input.lateGraceMinutes,
        early_leave_grace_minutes: input.earlyLeaveGraceMinutes,
        working_hours: workingHours.toFixed(2),
        is_default: input.isDefault ? 1 : 0,
        is_active: input.isActive ? 1 : 0,
        description: input.description ?? null,
        created_by: auth.userId,
        updated_by: auth.userId,
      })
      .executeTakeFirstOrThrow();

    return Number(res.insertId);
  });

  const shifts = await listWorkShifts({});
  const created = shifts.find((s) => s.id === insertedId);
  if (!created) {
    throw new AppError('INTERNAL_ERROR', 'Không thể đọc lại ca làm việc vừa tạo.', 500);
  }

  await recordAuditLog({
    userId: auth.userId,
    moduleCode: 'hrm',
    action: 'CREATE_WORK_SHIFT',
    entityType: 'work_shifts',
    entityId: String(created.id),
    newValues: { ...created },
    ipAddress,
  });

  return created;
}

export async function updateWorkShift(
  id: number,
  input: UpdateWorkShiftInput,
  auth: AuthContext,
  ipAddress: string | null,
): Promise<WorkShiftItem> {
  const db = getDb();
  const current = await db
    .selectFrom('work_shifts')
    .select([
      'id',
      'branch_id',
      'code',
      'name',
      'start_time',
      'end_time',
      'break_start_time',
      'break_end_time',
      'late_grace_minutes',
      'early_leave_grace_minutes',
      'working_hours',
      'is_default',
      'is_active',
      'description',
    ])
    .where('id', '=', id)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (!current) {
    throw new AppError('SHIFT_NOT_FOUND', 'Không tìm thấy ca làm việc.', 404);
  }

  const nextStart = input.startTime ?? String(current.start_time);
  const nextEnd = input.endTime ?? String(current.end_time);
  const nextBreakStart =
    input.breakStartTime !== undefined
      ? input.breakStartTime
      : current.break_start_time
        ? String(current.break_start_time)
        : null;
  const nextBreakEnd =
    input.breakEndTime !== undefined
      ? input.breakEndTime
      : current.break_end_time
        ? String(current.break_end_time)
        : null;
  const nextBranchId =
    input.branchId !== undefined
      ? input.branchId
      : current.branch_id !== null
        ? Number(current.branch_id)
        : null;

  let workingHours: number;
  try {
    workingHours = computeShiftWorkingHours(nextStart, nextEnd, nextBreakStart, nextBreakEnd);
  } catch (err) {
    throw new AppError(
      'INVALID_SHIFT_TIME',
      err instanceof Error ? err.message : 'Khung giờ ca làm việc không hợp lệ.',
      400,
    );
  }

  await db.transaction().execute(async (trx) => {
    if (input.isDefault === true) {
      let resetQuery = trx
        .updateTable('work_shifts')
        .set({ is_default: 0, updated_by: auth.userId })
        .where('id', '!=', id)
        .where('deleted_at', 'is', null);
      if (nextBranchId === null) {
        resetQuery = resetQuery.where('branch_id', 'is', null);
      } else {
        resetQuery = resetQuery.where('branch_id', '=', nextBranchId);
      }
      await resetQuery.execute();
    }

    await trx
      .updateTable('work_shifts')
      .set({
        branch_id: nextBranchId,
        name: input.name ?? String(current.name),
        start_time: nextStart,
        end_time: nextEnd,
        break_start_time: nextBreakStart,
        break_end_time: nextBreakEnd,
        late_grace_minutes: input.lateGraceMinutes ?? Number(current.late_grace_minutes),
        early_leave_grace_minutes:
          input.earlyLeaveGraceMinutes ?? Number(current.early_leave_grace_minutes),
        working_hours: workingHours.toFixed(2),
        is_default:
          input.isDefault !== undefined ? (input.isDefault ? 1 : 0) : Number(current.is_default),
        is_active:
          input.isActive !== undefined ? (input.isActive ? 1 : 0) : Number(current.is_active),
        description:
          input.description !== undefined
            ? input.description
            : current.description
              ? String(current.description)
              : null,
        updated_by: auth.userId,
      })
      .where('id', '=', id)
      .execute();
  });

  const shifts = await listWorkShifts({});
  const updated = shifts.find((s) => s.id === id);
  if (!updated) {
    throw new AppError('INTERNAL_ERROR', 'Không thể tải lại ca làm việc sau khi cập nhật.', 500);
  }

  await recordAuditLog({
    userId: auth.userId,
    moduleCode: 'hrm',
    action: 'UPDATE_WORK_SHIFT',
    entityType: 'work_shifts',
    entityId: String(id),
    oldValues: {
      name: String(current.name),
      startTime: String(current.start_time),
      endTime: String(current.end_time),
      isDefault: Number(current.is_default) === 1,
      isActive: Number(current.is_active) === 1,
    },
    newValues: { ...updated },
    ipAddress,
  });

  return updated;
}

export async function deleteWorkShift(
  id: number,
  auth: AuthContext,
  ipAddress: string | null,
): Promise<{ id: number; deleted: true }> {
  const db = getDb();
  const current = await db
    .selectFrom('work_shifts')
    .select(['id', 'code', 'name'])
    .where('id', '=', id)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (!current) {
    throw new AppError('SHIFT_NOT_FOUND', 'Không tìm thấy ca làm việc.', 404);
  }

  const assigned = await db
    .selectFrom('employee_shift_assignments')
    .select(['id'])
    .where('shift_id', '=', id)
    .where('deleted_at', 'is', null)
    .limit(1)
    .executeTakeFirst();

  if (assigned) {
    throw new AppError(
      'SHIFT_IN_USE',
      'Ca làm việc đang được phân cho nhân viên, vui lòng gỡ phân ca trước khi xóa.',
      409,
    );
  }

  await db
    .updateTable('work_shifts')
    .set({
      deleted_at: new Date(),
      is_default: 0,
      is_active: 0,
      updated_by: auth.userId,
    })
    .where('id', '=', id)
    .execute();

  await recordAuditLog({
    userId: auth.userId,
    moduleCode: 'hrm',
    action: 'DELETE_WORK_SHIFT',
    entityType: 'work_shifts',
    entityId: String(id),
    oldValues: { code: String(current.code), name: String(current.name) },
    ipAddress,
  });

  return { id, deleted: true };
}

export async function listShiftAssignments(
  auth: AuthContext,
  query: {
    branchId?: string | null;
    departmentId?: string | null;
    employeeId?: string | null;
    shiftId?: string | null;
    search?: string | null;
    page?: string | null;
    limit?: string | null;
  },
): Promise<{ items: ShiftAssignmentItem[]; meta: PaginationMeta }> {
  const scope = await resolveEmployeeAccessScope(auth);
  const pagination = parsePaginationParams(
    { page: query.page ?? undefined, limit: query.limit ?? undefined },
    { defaultLimit: 20, maxLimit: 100 },
  );

  if (
    (scope.mode === 'OWN' && scope.selfEmployeeId === null) ||
    (scope.mode === 'DEPARTMENT' &&
      scope.departmentIds.length === 0 &&
      scope.selfEmployeeId === null) ||
    (scope.mode === 'BRANCH' && scope.branchIds.length === 0)
  ) {
    return { items: [], meta: buildPaginationMeta(0, pagination.page, pagination.limit) };
  }

  const db = getDb();
  let baseQuery = db
    .selectFrom('employee_shift_assignments as esa')
    .innerJoin('employees as e', 'e.id', 'esa.employee_id')
    .innerJoin('branches as b', 'b.id', 'e.branch_id')
    .innerJoin('departments as d', 'd.id', 'e.department_id')
    .innerJoin('work_shifts as ws', 'ws.id', 'esa.shift_id')
    .where('esa.deleted_at', 'is', null)
    .where('e.deleted_at', 'is', null);

  if (scope.mode === 'BRANCH') {
    baseQuery = baseQuery.where('e.branch_id', 'in', scope.branchIds);
  } else if (scope.mode === 'DEPARTMENT') {
    baseQuery = baseQuery.where((eb) => {
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
    baseQuery = baseQuery.where('e.id', '=', scope.selfEmployeeId);
  }

  if (query.branchId && Number(query.branchId) > 0) {
    baseQuery = baseQuery.where('e.branch_id', '=', Number(query.branchId));
  }
  if (query.departmentId && Number(query.departmentId) > 0) {
    baseQuery = baseQuery.where('e.department_id', '=', Number(query.departmentId));
  }
  if (query.employeeId && Number(query.employeeId) > 0) {
    baseQuery = baseQuery.where('esa.employee_id', '=', Number(query.employeeId));
  }
  if (query.shiftId && Number(query.shiftId) > 0) {
    baseQuery = baseQuery.where('esa.shift_id', '=', Number(query.shiftId));
  }
  if (query.search && query.search.trim().length > 0) {
    const keyword = `%${query.search.trim()}%`;
    baseQuery = baseQuery.where((eb) =>
      eb.or([eb('e.employee_code', 'like', keyword), eb('e.full_name', 'like', keyword)]),
    );
  }

  const countRow = await baseQuery
    .select((eb) => eb.fn.count<number>('esa.id').as('total'))
    .executeTakeFirst();
  const total = Number(countRow?.total ?? 0);

  const rows = await baseQuery
    .select([
      'esa.id',
      'esa.employee_id',
      'e.employee_code',
      'e.full_name as employee_name',
      'e.branch_id',
      'b.name as branch_name',
      'd.name as department_name',
      'esa.shift_id',
      'ws.code as shift_code',
      'ws.name as shift_name',
      'ws.start_time',
      'ws.end_time',
      'esa.effective_from',
      'esa.effective_to',
      'esa.work_days_json',
      'esa.note',
    ])
    .orderBy('esa.effective_from', 'desc')
    .orderBy('e.employee_code', 'asc')
    .limit(pagination.limit)
    .offset(pagination.offset)
    .execute();

  const items: ShiftAssignmentItem[] = rows.map((row) => ({
    id: Number(row.id),
    employeeId: Number(row.employee_id),
    employeeCode: String(row.employee_code),
    employeeName: String(row.employee_name),
    branchId: Number(row.branch_id),
    branchName: String(row.branch_name),
    departmentName: String(row.department_name),
    shiftId: Number(row.shift_id),
    shiftCode: String(row.shift_code),
    shiftName: String(row.shift_name),
    startTime: String(row.start_time),
    endTime: String(row.end_time),
    effectiveFrom: extractIsoDate(row.effective_from) ?? '',
    effectiveTo: extractIsoDate(row.effective_to),
    workDays: parseWorkDaysJson(row.work_days_json),
    note: row.note ? String(row.note) : null,
  }));

  return { items, meta: buildPaginationMeta(total, pagination.page, pagination.limit) };
}

export async function assignShiftToEmployees(
  input: CreateShiftAssignmentInput,
  auth: AuthContext,
  ipAddress: string | null,
): Promise<{ assignedCount: number; shiftId: number }> {
  const db = getDb();
  const shift = await db
    .selectFrom('work_shifts')
    .select(['id', 'code', 'name', 'is_active'])
    .where('id', '=', input.shiftId)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (!shift || Number(shift.is_active) !== 1) {
    throw new AppError('SHIFT_NOT_FOUND', 'Ca làm việc không tồn tại hoặc đang ngừng hoạt động.', 404);
  }

  const uniqueEmpIds = Array.from(new Set(input.employeeIds));
  const scope = await resolveEmployeeAccessScope(auth);

  const employees = await db
    .selectFrom('employees')
    .select(['id', 'employee_code', 'branch_id', 'department_id', 'user_id'])
    .where('id', 'in', uniqueEmpIds)
    .where('deleted_at', 'is', null)
    .execute();

  if (employees.length !== uniqueEmpIds.length) {
    throw new AppError('EMPLOYEE_NOT_FOUND', 'Có nhân viên không tồn tại trong hệ thống.', 404);
  }

  for (const emp of employees) {
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
      throw new AppError(
        'FORBIDDEN_SCOPE',
        `Bạn không có quyền phân ca cho nhân viên ${String(emp.employee_code)}.`,
        403,
      );
    }
  }

  const uniqueWorkDays = Array.from(new Set(input.workDays)).sort((a, b) => a - b);
  const closePreviousDate = dayjs(input.effectiveFrom).subtract(1, 'day').format('YYYY-MM-DD');

  await db.transaction().execute(async (trx) => {
    for (const emp of employees) {
      const empId = Number(emp.id);
      const existingAssignments = await trx
        .selectFrom('employee_shift_assignments')
        .select(['id', 'effective_from', 'effective_to'])
        .where('employee_id', '=', empId)
        .where('deleted_at', 'is', null)
        .execute();

      for (const existing of existingAssignments) {
        const exFrom = extractIsoDate(existing.effective_from) ?? '';
        const exTo = extractIsoDate(existing.effective_to);

        // If an open-ended assignment started strictly before effectiveFrom, close it gracefully
        if (exTo === null && exFrom < input.effectiveFrom) {
          await trx
            .updateTable('employee_shift_assignments')
            .set({ effective_to: closePreviousDate, updated_by: auth.userId })
            .where('id', '=', Number(existing.id))
            .execute();
          continue;
        }

        const newEnd = input.effectiveTo ?? '9999-12-31';
        const oldEnd = exTo ?? '9999-12-31';
        if (exFrom <= newEnd && oldEnd >= input.effectiveFrom) {
          throw new AppError(
            'SHIFT_ASSIGNMENT_OVERLAP',
            `Nhân viên ${String(emp.employee_code)} đã có phân ca trùng khoảng thời gian hiệu lực.`,
            409,
          );
        }
      }

      await trx
        .insertInto('employee_shift_assignments')
        .values({
          employee_id: empId,
          shift_id: input.shiftId,
          effective_from: input.effectiveFrom,
          effective_to: input.effectiveTo ?? null,
          work_days_json: JSON.stringify(uniqueWorkDays),
          note: input.note ?? null,
          created_by: auth.userId,
          updated_by: auth.userId,
        })
        .execute();
    }
  });

  await recordAuditLog({
    userId: auth.userId,
    moduleCode: 'hrm',
    action: 'ASSIGN_WORK_SHIFT',
    entityType: 'employee_shift_assignments',
    entityId: String(input.shiftId),
    newValues: {
      shiftCode: String(shift.code),
      employeeIds: uniqueEmpIds,
      effectiveFrom: input.effectiveFrom,
      effectiveTo: input.effectiveTo ?? null,
      workDays: uniqueWorkDays,
    },
    ipAddress,
  });

  return { assignedCount: uniqueEmpIds.length, shiftId: input.shiftId };
}

export async function deleteShiftAssignment(
  id: number,
  auth: AuthContext,
  ipAddress: string | null,
): Promise<{ id: number; deleted: true }> {
  const db = getDb();
  const row = await db
    .selectFrom('employee_shift_assignments as esa')
    .innerJoin('employees as e', 'e.id', 'esa.employee_id')
    .select(['esa.id', 'esa.employee_id', 'esa.shift_id', 'e.branch_id', 'e.department_id', 'e.user_id'])
    .where('esa.id', '=', id)
    .where('esa.deleted_at', 'is', null)
    .executeTakeFirst();

  if (!row) {
    throw new AppError('ASSIGNMENT_NOT_FOUND', 'Không tìm thấy bản ghi phân ca.', 404);
  }

  const scope = await resolveEmployeeAccessScope(auth);
  const allowed = isEmployeeWithinScope(
    scope,
    {
      id: Number(row.employee_id),
      branchId: Number(row.branch_id),
      departmentId: Number(row.department_id),
      userId: row.user_id !== null ? Number(row.user_id) : null,
    },
    auth.userId,
  );
  if (!allowed) {
    throw new AppError('FORBIDDEN_SCOPE', 'Bạn không có quyền gỡ phân ca nhân viên ngoài phạm vi.', 403);
  }

  await db
    .updateTable('employee_shift_assignments')
    .set({ deleted_at: new Date(), updated_by: auth.userId })
    .where('id', '=', id)
    .execute();

  await recordAuditLog({
    userId: auth.userId,
    moduleCode: 'hrm',
    action: 'DELETE_SHIFT_ASSIGNMENT',
    entityType: 'employee_shift_assignments',
    entityId: String(id),
    oldValues: { employeeId: Number(row.employee_id), shiftId: Number(row.shift_id) },
    ipAddress,
  });

  return { id, deleted: true };
}

export async function resolveEffectiveShift(
  employeeId: number,
  branchId: number,
  workDate: string,
): Promise<ResolvedEffectiveShift | null> {
  const db = getDb();

  const assigned = await db
    .selectFrom('employee_shift_assignments as esa')
    .innerJoin('work_shifts as ws', 'ws.id', 'esa.shift_id')
    .select([
      'ws.id',
      'ws.code',
      'ws.name',
      'ws.start_time',
      'ws.end_time',
      'ws.break_start_time',
      'ws.break_end_time',
      'ws.late_grace_minutes',
      'ws.early_leave_grace_minutes',
      'ws.working_hours',
      'esa.work_days_json',
    ])
    .where('esa.employee_id', '=', employeeId)
    .where('esa.deleted_at', 'is', null)
    .where('ws.deleted_at', 'is', null)
    .where('esa.effective_from', '<=', workDate)
    .where((eb) =>
      eb.or([eb('esa.effective_to', 'is', null), eb('esa.effective_to', '>=', workDate)]),
    )
    .orderBy('esa.effective_from', 'desc')
    .limit(1)
    .executeTakeFirst();

  if (assigned) {
    return {
      id: Number(assigned.id),
      code: String(assigned.code),
      name: String(assigned.name),
      startTime: String(assigned.start_time),
      endTime: String(assigned.end_time),
      breakStartTime: assigned.break_start_time ? String(assigned.break_start_time) : null,
      breakEndTime: assigned.break_end_time ? String(assigned.break_end_time) : null,
      lateGraceMinutes: Number(assigned.late_grace_minutes),
      earlyLeaveGraceMinutes: Number(assigned.early_leave_grace_minutes),
      workingHours: Number(assigned.working_hours),
      workDays: parseWorkDaysJson(assigned.work_days_json),
    };
  }

  // Fallback: default active shift for employee's branch, else company-wide default shift
  const defaultShifts = await db
    .selectFrom('work_shifts')
    .select([
      'id',
      'branch_id',
      'code',
      'name',
      'start_time',
      'end_time',
      'break_start_time',
      'break_end_time',
      'late_grace_minutes',
      'early_leave_grace_minutes',
      'working_hours',
    ])
    .where('deleted_at', 'is', null)
    .where('is_active', '=', 1)
    .where('is_default', '=', 1)
    .where((eb) => eb.or([eb('branch_id', '=', branchId), eb('branch_id', 'is', null)]))
    .execute();

  const chosen =
    defaultShifts.find((s) => s.branch_id !== null && Number(s.branch_id) === branchId) ??
    defaultShifts.find((s) => s.branch_id === null);

  if (!chosen) {
    return null;
  }

  return {
    id: Number(chosen.id),
    code: String(chosen.code),
    name: String(chosen.name),
    startTime: String(chosen.start_time),
    endTime: String(chosen.end_time),
    breakStartTime: chosen.break_start_time ? String(chosen.break_start_time) : null,
    breakEndTime: chosen.break_end_time ? String(chosen.break_end_time) : null,
    lateGraceMinutes: Number(chosen.late_grace_minutes),
    earlyLeaveGraceMinutes: Number(chosen.early_leave_grace_minutes),
    workingHours: Number(chosen.working_hours),
    workDays: [1, 2, 3, 4, 5],
  };
}
