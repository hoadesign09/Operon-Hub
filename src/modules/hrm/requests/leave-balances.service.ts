import dayjs from 'dayjs';
import { getDb } from '@/config/database';
import {
  buildPaginationMeta,
  parsePaginationParams,
  type PaginationMeta,
} from '@/lib/portable/pagination';
import { recordAuditLog } from '@/modules/audit/audit.service';
import type { AuthContext } from '@/modules/auth/auth.service';
import { resolveEmployeeAccessScope } from '@/modules/hrm/employees/employees.scope';
import {
  computeRemainingDays,
  computeSeniorityBonusDays,
  roundLeaveDays,
} from '@/modules/hrm/requests/leave-calculator';
import type {
  InitializeLeaveBalancesInput,
  UpdateLeaveBalanceInput,
} from '@/modules/hrm/requests/leaves.schema';
import { AppError } from '@/shared/api-response';

export interface LeaveBalanceItem {
  id: number;
  employeeId: number;
  employeeCode: string;
  employeeName: string;
  branchId: number;
  branchName: string | null;
  branchNameEn: string | null;
  departmentName: string | null;
  departmentNameEn: string | null;
  leaveTypeId: number;
  leaveTypeCode: string;
  leaveTypeName: string;
  leaveTypeNameEn: string | null;
  isPaid: boolean;
  year: number;
  entitledDays: number;
  carriedOverDays: number;
  usedDays: number;
  pendingDays: number;
  remainingDays: number;
  note: string | null;
}

export async function listLeaveBalances(
  auth: AuthContext,
  query: {
    year?: string | null;
    mine?: string | null;
    branchId?: string | null;
    employeeId?: string | null;
    leaveTypeId?: string | null;
    search?: string | null;
    page?: string | null;
    limit?: string | null;
  },
): Promise<{ items: LeaveBalanceItem[]; year: number; meta: PaginationMeta }> {
  const db = getDb();
  const parsedYear = Number(query.year);
  const year =
    Number.isInteger(parsedYear) && parsedYear >= 2020 && parsedYear <= 2100
      ? parsedYear
      : dayjs().year();

  const pagination = parsePaginationParams(
    { page: query.page, limit: query.limit },
    { defaultLimit: 30, maxLimit: 100 },
  );

  const isMine = query.mine === 'true' || query.mine === '1';

  let baseQuery = db
    .selectFrom('leave_balances as lb')
    .innerJoin('employees as e', 'e.id', 'lb.employee_id')
    .innerJoin('leave_types as lt', 'lt.id', 'lb.leave_type_id')
    .leftJoin('branches as b', 'b.id', 'e.branch_id')
    .leftJoin('departments as d', 'd.id', 'e.department_id')
    .where('lb.deleted_at', 'is', null)
    .where('e.deleted_at', 'is', null)
    .where('lt.deleted_at', 'is', null)
    .where('lb.year', '=', year);

  if (isMine) {
    const selfEmp = await db
      .selectFrom('employees')
      .select(['id'])
      .where('user_id', '=', auth.userId)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();

    if (!selfEmp) {
      return {
        items: [],
        year,
        meta: buildPaginationMeta(0, pagination.page, pagination.limit),
      };
    }
    baseQuery = baseQuery.where('lb.employee_id', '=', Number(selfEmp.id));
  } else {
    if (!auth.isSuperAdmin && !auth.permissions.includes('hrm.requests.read')) {
      throw new AppError('FORBIDDEN', 'Bạn không có quyền xem quỹ phép của nhân sự.', 403);
    }

    const scope = await resolveEmployeeAccessScope(auth);
    if (scope.mode === 'BRANCH') {
      if (scope.branchIds.length === 0) {
        return {
          items: [],
          year,
          meta: buildPaginationMeta(0, pagination.page, pagination.limit),
        };
      }
      baseQuery = baseQuery.where('e.branch_id', 'in', scope.branchIds);
    } else if (scope.mode === 'DEPARTMENT') {
      if (scope.departmentIds.length === 0 && !scope.selfEmployeeId) {
        return {
          items: [],
          year,
          meta: buildPaginationMeta(0, pagination.page, pagination.limit),
        };
      }
      baseQuery = baseQuery.where((eb) => {
        const conds = [];
        if (scope.departmentIds.length > 0) {
          conds.push(eb('e.department_id', 'in', scope.departmentIds));
        }
        if (scope.selfEmployeeId) {
          conds.push(eb('e.id', '=', scope.selfEmployeeId));
        }
        return eb.or(conds);
      });
    } else if (scope.mode === 'OWN') {
      if (!scope.selfEmployeeId) {
        return {
          items: [],
          year,
          meta: buildPaginationMeta(0, pagination.page, pagination.limit),
        };
      }
      baseQuery = baseQuery.where('e.id', '=', scope.selfEmployeeId);
    }
  }

  const branchIdNum = Number(query.branchId);
  if (Number.isInteger(branchIdNum) && branchIdNum > 0) {
    baseQuery = baseQuery.where('e.branch_id', '=', branchIdNum);
  }

  const employeeIdNum = Number(query.employeeId);
  if (Number.isInteger(employeeIdNum) && employeeIdNum > 0) {
    baseQuery = baseQuery.where('lb.employee_id', '=', employeeIdNum);
  }

  const leaveTypeIdNum = Number(query.leaveTypeId);
  if (Number.isInteger(leaveTypeIdNum) && leaveTypeIdNum > 0) {
    baseQuery = baseQuery.where('lb.leave_type_id', '=', leaveTypeIdNum);
  }

  if (query.search && query.search.trim().length > 0) {
    const keyword = `%${query.search.trim()}%`;
    baseQuery = baseQuery.where((eb) =>
      eb.or([
        eb('e.employee_code', 'like', keyword),
        eb('e.full_name', 'like', keyword),
        eb('lt.name', 'like', keyword),
      ]),
    );
  }

  const countRow = await baseQuery
    .select((eb) => eb.fn.count<number>('lb.id').as('total'))
    .executeTakeFirst();
  const total = Number(countRow?.total ?? 0);

  const rows = await baseQuery
    .select([
      'lb.id',
      'lb.employee_id',
      'e.employee_code',
      'e.full_name as employee_name',
      'e.branch_id',
      'b.name as branch_name',
      'b.name_en as branch_name_en',
      'd.name as department_name',
      'd.name_en as department_name_en',
      'lb.leave_type_id',
      'lt.code as leave_type_code',
      'lt.name as leave_type_name',
      'lt.name_en as leave_type_name_en',
      'lt.is_paid',
      'lb.year',
      'lb.entitled_days',
      'lb.carried_over_days',
      'lb.used_days',
      'lb.pending_days',
      'lb.note',
    ])
    .orderBy('e.employee_code', 'asc')
    .orderBy('lt.id', 'asc')
    .limit(pagination.limit)
    .offset(pagination.offset)
    .execute();

  const items: LeaveBalanceItem[] = rows.map((row) => {
    const entitledDays = Number(row.entitled_days);
    const carriedOverDays = Number(row.carried_over_days);
    const usedDays = Number(row.used_days);
    const pendingDays = Number(row.pending_days);

    return {
      id: Number(row.id),
      employeeId: Number(row.employee_id),
      employeeCode: row.employee_code,
      employeeName: row.employee_name,
      branchId: Number(row.branch_id),
      branchName: row.branch_name ?? null,
      branchNameEn: row.branch_name_en ?? null,
      departmentName: row.department_name ?? null,
      departmentNameEn: row.department_name_en ?? null,
      leaveTypeId: Number(row.leave_type_id),
      leaveTypeCode: row.leave_type_code,
      leaveTypeName: row.leave_type_name,
      leaveTypeNameEn: row.leave_type_name_en ?? null,
      isPaid: Number(row.is_paid) === 1,
      year: Number(row.year),
      entitledDays,
      carriedOverDays,
      usedDays,
      pendingDays,
      remainingDays: computeRemainingDays({
        entitledDays,
        carriedOverDays,
        usedDays,
        pendingDays,
      }),
      note: row.note,
    };
  });

  return {
    items,
    year,
    meta: buildPaginationMeta(total, pagination.page, pagination.limit),
  };
}

export async function initializeLeaveBalancesForYear(
  input: InitializeLeaveBalancesInput,
  actor: AuthContext,
  ipAddress: string | null,
): Promise<{ year: number; createdCount: number; skippedCount: number }> {
  const db = getDb();

  const leaveTypes = await db
    .selectFrom('leave_types')
    .select([
      'id',
      'code',
      'default_days_per_year',
      'allow_carry_over',
      'max_carry_over_days',
    ])
    .where('is_active', '=', 1)
    .where('deleted_at', 'is', null)
    .where('default_days_per_year', '>', 0)
    .execute();

  if (leaveTypes.length === 0) {
    throw new AppError(
      'NO_TRACKED_LEAVE_TYPES',
      'Chưa có loại nghỉ phép nào có hạn mức ngày/năm > 0 để khởi tạo.',
      400,
    );
  }

  let empQuery = db
    .selectFrom('employees')
    .select(['id', 'hire_date', 'branch_id'])
    .where('deleted_at', 'is', null)
    .where('employment_status', 'in', ['PROBATION', 'ACTIVE', 'ON_LEAVE']);

  if (input.branchId) {
    empQuery = empQuery.where('branch_id', '=', input.branchId);
  }

  const employees = await empQuery.execute();
  if (employees.length === 0) {
    return { year: input.year, createdCount: 0, skippedCount: 0 };
  }

  const employeeIds = employees.map((e) => Number(e.id));

  const existingCurrent = await db
    .selectFrom('leave_balances')
    .select(['employee_id', 'leave_type_id'])
    .where('year', '=', input.year)
    .where('employee_id', 'in', employeeIds)
    .execute();

  const existingSet = new Set(
    existingCurrent.map((r) => `${Number(r.employee_id)}:${Number(r.leave_type_id)}`),
  );

  const prevBalanceMap = new Map<string, number>();
  if (input.includeCarryOver) {
    const prevRows = await db
      .selectFrom('leave_balances')
      .select([
        'employee_id',
        'leave_type_id',
        'entitled_days',
        'carried_over_days',
        'used_days',
        'pending_days',
      ])
      .where('year', '=', input.year - 1)
      .where('employee_id', 'in', employeeIds)
      .where('deleted_at', 'is', null)
      .execute();

    for (const prev of prevRows) {
      const rem = computeRemainingDays({
        entitledDays: Number(prev.entitled_days),
        carriedOverDays: Number(prev.carried_over_days),
        usedDays: Number(prev.used_days),
        pendingDays: Number(prev.pending_days),
      });
      prevBalanceMap.set(
        `${Number(prev.employee_id)}:${Number(prev.leave_type_id)}`,
        Math.max(0, rem),
      );
    }
  }

  const rowsToInsert: Array<{
    employee_id: number;
    leave_type_id: number;
    year: number;
    entitled_days: number;
    carried_over_days: number;
    used_days: number;
    pending_days: number;
    note: string;
    created_by: number;
    updated_by: number;
  }> = [];

  let skippedCount = 0;

  for (const emp of employees) {
    const empId = Number(emp.id);
    const hireDateStr = dayjs(emp.hire_date).format('YYYY-MM-DD');

    for (const lt of leaveTypes) {
      const ltId = Number(lt.id);
      const key = `${empId}:${ltId}`;
      if (existingSet.has(key)) {
        skippedCount += 1;
        continue;
      }

      const baseDays = Number(lt.default_days_per_year);
      const seniorityBonus =
        input.includeSeniorityBonus && lt.code === 'ANNUAL'
          ? computeSeniorityBonusDays(hireDateStr, input.year)
          : 0;
      const entitledDays = roundLeaveDays(baseDays + seniorityBonus);

      let carriedOverDays = 0;
      if (input.includeCarryOver && Number(lt.allow_carry_over) === 1) {
        const prevRem = prevBalanceMap.get(key) ?? 0;
        const maxCarry = Number(lt.max_carry_over_days);
        carriedOverDays = roundLeaveDays(Math.min(prevRem, maxCarry));
      }

      rowsToInsert.push({
        employee_id: empId,
        leave_type_id: ltId,
        year: input.year,
        entitled_days: entitledDays,
        carried_over_days: carriedOverDays,
        used_days: 0,
        pending_days: 0,
        note:
          seniorityBonus > 0
            ? `Khởi tạo tự động (gồm +${seniorityBonus} ngày thâm niên)`
            : 'Khởi tạo quỹ phép năm tự động',
        created_by: actor.userId,
        updated_by: actor.userId,
      });
    }
  }

  if (rowsToInsert.length > 0) {
    await db.transaction().execute(async (trx) => {
      await trx.insertInto('leave_balances').values(rowsToInsert).execute();
    });
  }

  await recordAuditLog({
    userId: actor.userId,
    moduleCode: 'hrm',
    action: 'LEAVE_BALANCE_INITIALIZE',
    entityType: 'leave_balances',
    entityId: `${input.year}`,
    newValues: {
      year: input.year,
      branchId: input.branchId ?? null,
      includeCarryOver: input.includeCarryOver,
      includeSeniorityBonus: input.includeSeniorityBonus,
      createdCount: rowsToInsert.length,
      skippedCount,
    },
    ipAddress,
  });

  return {
    year: input.year,
    createdCount: rowsToInsert.length,
    skippedCount,
  };
}

export async function updateLeaveBalance(
  id: number,
  input: UpdateLeaveBalanceInput,
  actor: AuthContext,
  ipAddress: string | null,
): Promise<LeaveBalanceItem> {
  const db = getDb();
  const existing = await db
    .selectFrom('leave_balances as lb')
    .innerJoin('employees as e', 'e.id', 'lb.employee_id')
    .innerJoin('leave_types as lt', 'lt.id', 'lb.leave_type_id')
    .leftJoin('branches as b', 'b.id', 'e.branch_id')
    .leftJoin('departments as d', 'd.id', 'e.department_id')
    .select([
      'lb.id',
      'lb.employee_id',
      'e.employee_code',
      'e.full_name as employee_name',
      'e.branch_id',
      'b.name as branch_name',
      'b.name_en as branch_name_en',
      'd.name as department_name',
      'd.name_en as department_name_en',
      'lb.leave_type_id',
      'lt.code as leave_type_code',
      'lt.name as leave_type_name',
      'lt.name_en as leave_type_name_en',
      'lt.is_paid',
      'lb.year',
      'lb.entitled_days',
      'lb.carried_over_days',
      'lb.used_days',
      'lb.pending_days',
      'lb.note',
    ])
    .where('lb.id', '=', id)
    .where('lb.deleted_at', 'is', null)
    .executeTakeFirst();

  if (!existing) {
    throw new AppError('LEAVE_BALANCE_NOT_FOUND', 'Không tìm thấy bản ghi quỹ phép năm.', 404);
  }

  const usedDays = Number(existing.used_days);
  const pendingDays = Number(existing.pending_days);
  const nextEntitled = roundLeaveDays(input.entitledDays);
  const nextCarried = roundLeaveDays(input.carriedOverDays);

  if (nextEntitled + nextCarried < roundLeaveDays(usedDays + pendingDays)) {
    throw new AppError(
      'INVALID_BALANCE_ADJUSTMENT',
      `Tổng quỹ phép mới (${roundLeaveDays(nextEntitled + nextCarried)} ngày) không thể nhỏ hơn tổng số ngày đã dùng và đang chờ duyệt (${roundLeaveDays(usedDays + pendingDays)} ngày).`,
      400,
    );
  }

  const nextNote = input.note !== undefined ? input.note?.trim() || null : existing.note;

  await db
    .updateTable('leave_balances')
    .set({
      entitled_days: nextEntitled,
      carried_over_days: nextCarried,
      note: nextNote,
      updated_by: actor.userId,
    })
    .where('id', '=', id)
    .execute();

  await recordAuditLog({
    userId: actor.userId,
    moduleCode: 'hrm',
    action: 'LEAVE_BALANCE_ADJUST',
    entityType: 'leave_balances',
    entityId: id,
    oldValues: {
      entitledDays: Number(existing.entitled_days),
      carriedOverDays: Number(existing.carried_over_days),
      note: existing.note,
    },
    newValues: {
      entitledDays: nextEntitled,
      carriedOverDays: nextCarried,
      note: nextNote,
    },
    ipAddress,
  });

  return {
    id: Number(existing.id),
    employeeId: Number(existing.employee_id),
    employeeCode: existing.employee_code,
    employeeName: existing.employee_name,
    branchId: Number(existing.branch_id),
    branchName: existing.branch_name ?? null,
    branchNameEn: existing.branch_name_en ?? null,
    departmentName: existing.department_name ?? null,
    departmentNameEn: existing.department_name_en ?? null,
    leaveTypeId: Number(existing.leave_type_id),
    leaveTypeCode: existing.leave_type_code,
    leaveTypeName: existing.leave_type_name,
    leaveTypeNameEn: existing.leave_type_name_en ?? null,
    isPaid: Number(existing.is_paid) === 1,
    year: Number(existing.year),
    entitledDays: nextEntitled,
    carriedOverDays: nextCarried,
    usedDays,
    pendingDays,
    remainingDays: computeRemainingDays({
      entitledDays: nextEntitled,
      carriedOverDays: nextCarried,
      usedDays,
      pendingDays,
    }),
    note: nextNote,
  };
}
