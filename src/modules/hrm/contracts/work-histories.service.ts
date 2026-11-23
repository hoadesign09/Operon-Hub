import { getDb, type WorkHistoryChangeType } from '@/config/database';
import { roundCurrency } from '@/lib/portable/currency-utils';
import { recordAuditLog } from '@/modules/audit/audit.service';
import type { AuthContext } from '@/modules/auth/auth.service';
import type { CreateWorkHistoryInput } from '@/modules/hrm/contracts/contracts.schema';
import {
  isEmployeeWithinScope,
  resolveEmployeeAccessScope,
} from '@/modules/hrm/employees/employees.scope';
import { AppError } from '@/shared/api-response';

export interface WorkHistoryItem {
  id: number;
  employeeId: number;
  changeType: WorkHistoryChangeType;
  effectiveDate: string;
  decisionNo: string | null;
  fromBranchId: number | null;
  fromBranchName: string | null;
  toBranchId: number | null;
  toBranchName: string | null;
  fromDepartmentId: number | null;
  fromDepartmentName: string | null;
  toDepartmentId: number | null;
  toDepartmentName: string | null;
  fromPositionId: number | null;
  fromPositionName: string | null;
  toPositionId: number | null;
  toPositionName: string | null;
  fromSalary: number | null;
  toSalary: number | null;
  note: string | null;
  createdAt: string;
}

function toIsoDateOnly(value: Date | string): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

async function assertEmployeeWorkHistoryAccess(
  auth: AuthContext,
  employeeId: number,
  allowSelfRead: boolean,
): Promise<{
  id: number;
  userId: number | null;
  branchId: number;
  departmentId: number;
  positionId: number;
}> {
  const db = getDb();
  const emp = await db
    .selectFrom('employees')
    .select(['id', 'user_id', 'branch_id', 'department_id', 'position_id'])
    .where('id', '=', employeeId)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (!emp) {
    throw new AppError('EMPLOYEE_NOT_FOUND', 'Không tìm thấy hồ sơ nhân viên.', 404);
  }

  const target = {
    id: Number(emp.id),
    userId: emp.user_id !== null ? Number(emp.user_id) : null,
    branchId: Number(emp.branch_id),
    departmentId: Number(emp.department_id),
    positionId: Number(emp.position_id),
  };

  if (allowSelfRead && target.userId === auth.userId) {
    return target;
  }

  const scope = await resolveEmployeeAccessScope(auth);
  if (!isEmployeeWithinScope(scope, target, auth.userId)) {
    throw new AppError(
      'FORBIDDEN',
      'Bạn không có quyền truy cập quá trình công tác của nhân viên này.',
      403,
    );
  }

  return target;
}

export async function listEmployeeWorkHistories(
  auth: AuthContext,
  employeeId: number,
): Promise<WorkHistoryItem[]> {
  const target = await assertEmployeeWorkHistoryAccess(auth, employeeId, true);
  const isOwner = target.userId === auth.userId;
  if (
    !isOwner &&
    !auth.isSuperAdmin &&
    !auth.permissions.includes('hrm.contracts.read') &&
    !auth.permissions.includes('hrm.employees.read')
  ) {
    throw new AppError(
      'FORBIDDEN',
      'Bạn không có quyền xem quá trình công tác của nhân viên này.',
      403,
    );
  }

  const db = getDb();
  const rows = await db
    .selectFrom('employee_work_histories as h')
    .leftJoin('branches as fb', 'fb.id', 'h.from_branch_id')
    .leftJoin('branches as tb', 'tb.id', 'h.to_branch_id')
    .leftJoin('departments as fd', 'fd.id', 'h.from_department_id')
    .leftJoin('departments as td', 'td.id', 'h.to_department_id')
    .leftJoin('positions as fp', 'fp.id', 'h.from_position_id')
    .leftJoin('positions as tp', 'tp.id', 'h.to_position_id')
    .select([
      'h.id',
      'h.employee_id',
      'h.change_type',
      'h.effective_date',
      'h.decision_no',
      'h.from_branch_id',
      'fb.name as from_branch_name',
      'h.to_branch_id',
      'tb.name as to_branch_name',
      'h.from_department_id',
      'fd.name as from_department_name',
      'h.to_department_id',
      'td.name as to_department_name',
      'h.from_position_id',
      'fp.name as from_position_name',
      'h.to_position_id',
      'tp.name as to_position_name',
      'h.from_salary',
      'h.to_salary',
      'h.note',
      'h.created_at',
    ])
    .where('h.employee_id', '=', employeeId)
    .where('h.deleted_at', 'is', null)
    .orderBy('h.effective_date', 'desc')
    .orderBy('h.id', 'desc')
    .execute();

  const canSeeSalary =
    isOwner ||
    auth.isSuperAdmin ||
    auth.permissions.includes('hrm.contracts.read') ||
    auth.permissions.includes('hrm.contracts.manage');

  return rows.map((row) => ({
    id: Number(row.id),
    employeeId: Number(row.employee_id),
    changeType: row.change_type,
    effectiveDate: toIsoDateOnly(row.effective_date),
    decisionNo: row.decision_no,
    fromBranchId: row.from_branch_id !== null ? Number(row.from_branch_id) : null,
    fromBranchName: row.from_branch_name ?? null,
    toBranchId: row.to_branch_id !== null ? Number(row.to_branch_id) : null,
    toBranchName: row.to_branch_name ?? null,
    fromDepartmentId: row.from_department_id !== null ? Number(row.from_department_id) : null,
    fromDepartmentName: row.from_department_name ?? null,
    toDepartmentId: row.to_department_id !== null ? Number(row.to_department_id) : null,
    toDepartmentName: row.to_department_name ?? null,
    fromPositionId: row.from_position_id !== null ? Number(row.from_position_id) : null,
    fromPositionName: row.from_position_name ?? null,
    toPositionId: row.to_position_id !== null ? Number(row.to_position_id) : null,
    toPositionName: row.to_position_name ?? null,
    fromSalary:
      canSeeSalary && row.from_salary !== null ? roundCurrency(Number(row.from_salary)) : null,
    toSalary:
      canSeeSalary && row.to_salary !== null ? roundCurrency(Number(row.to_salary)) : null,
    note: row.note,
    createdAt: new Date(row.created_at).toISOString(),
  }));
}

export async function createEmployeeWorkHistory(
  auth: AuthContext,
  employeeId: number,
  input: CreateWorkHistoryInput,
  ipAddress: string | null,
): Promise<WorkHistoryItem> {
  const emp = await assertEmployeeWorkHistoryAccess(auth, employeeId, false);
  const db = getDb();

  const toBranchId = input.toBranchId ?? null;
  const toDepartmentId = input.toDepartmentId ?? null;
  const toPositionId = input.toPositionId ?? null;

  const targetBranchId = toBranchId ?? emp.branchId;
  const targetDepartmentId = toDepartmentId ?? emp.departmentId;
  const targetPositionId = toPositionId ?? emp.positionId;

  if (toBranchId !== null) {
    const branch = await db
      .selectFrom('branches')
      .select(['id'])
      .where('id', '=', toBranchId)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();
    if (!branch) {
      throw new AppError('INVALID_BRANCH', 'Chi nhánh đích không tồn tại.', 400);
    }
  }

  if (toDepartmentId !== null || toBranchId !== null) {
    const dept = await db
      .selectFrom('departments')
      .select(['id', 'branch_id'])
      .where('id', '=', targetDepartmentId)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();
    if (!dept) {
      throw new AppError('INVALID_DEPARTMENT', 'Phòng ban đích không tồn tại.', 400);
    }
    if (Number(dept.branch_id) !== targetBranchId) {
      throw new AppError(
        'DEPARTMENT_BRANCH_MISMATCH',
        'Phòng ban đích phải thuộc cùng chi nhánh đích.',
        400,
      );
    }
  }

  if (toPositionId !== null) {
    const pos = await db
      .selectFrom('positions')
      .select(['id'])
      .where('id', '=', toPositionId)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();
    if (!pos) {
      throw new AppError('INVALID_POSITION', 'Chức danh đích không tồn tại.', 400);
    }
  }

  const createdId = await db.transaction().execute(async (trx) => {
    const inserted = await trx
      .insertInto('employee_work_histories')
      .values({
        employee_id: employeeId,
        change_type: input.changeType,
        effective_date: input.effectiveDate,
        decision_no: input.decisionNo ?? null,
        from_branch_id: input.changeType === 'HIRE' ? null : emp.branchId,
        to_branch_id: toBranchId ?? (input.changeType === 'HIRE' ? emp.branchId : null),
        from_department_id: input.changeType === 'HIRE' ? null : emp.departmentId,
        to_department_id: toDepartmentId ?? (input.changeType === 'HIRE' ? emp.departmentId : null),
        from_position_id: input.changeType === 'HIRE' ? null : emp.positionId,
        to_position_id: toPositionId ?? (input.changeType === 'HIRE' ? emp.positionId : null),
        from_salary: input.fromSalary ?? null,
        to_salary: input.toSalary ?? null,
        note: input.note ?? null,
        created_by: auth.userId,
        updated_by: auth.userId,
      })
      .executeTakeFirstOrThrow();

    if (input.syncToEmployeeProfile) {
      if (input.changeType === 'PROMOTION' || input.changeType === 'TRANSFER') {
        await trx
          .updateTable('employees')
          .set({
            branch_id: targetBranchId,
            department_id: targetDepartmentId,
            position_id: targetPositionId,
            updated_by: auth.userId,
          })
          .where('id', '=', employeeId)
          .execute();
      } else if (input.changeType === 'TERMINATION') {
        await trx
          .updateTable('employees')
          .set({
            employment_status: 'TERMINATED',
            termination_date: input.effectiveDate,
            updated_by: auth.userId,
          })
          .where('id', '=', employeeId)
          .execute();

        if (emp.userId !== null && emp.userId !== auth.userId) {
          await trx
            .updateTable('users')
            .set({ status: 'LOCKED', updated_by: auth.userId })
            .where('id', '=', emp.userId)
            .execute();

          await trx
            .updateTable('refresh_tokens')
            .set({ revoked_at: new Date() })
            .where('user_id', '=', emp.userId)
            .where('revoked_at', 'is', null)
            .execute();
        }
      }
    }

    return Number(inserted.insertId);
  });

  await recordAuditLog({
    userId: auth.userId,
    moduleCode: 'hrm',
    action: 'HRM_WORK_HISTORY_CREATE',
    entityType: 'employee_work_histories',
    entityId: createdId,
    newValues: {
      employeeId,
      changeType: input.changeType,
      effectiveDate: input.effectiveDate,
      decisionNo: input.decisionNo ?? null,
      syncToEmployeeProfile: input.syncToEmployeeProfile,
    },
    ipAddress,
  });

  const histories = await listEmployeeWorkHistories(auth, employeeId);
  const created = histories.find((h) => h.id === createdId);
  if (!created) {
    throw new AppError('WORK_HISTORY_NOT_FOUND', 'Không thể đọc lại quyết định vừa tạo.', 500);
  }
  return created;
}

export async function softDeleteWorkHistory(
  auth: AuthContext,
  historyId: number,
  ipAddress: string | null,
): Promise<void> {
  const db = getDb();
  const existing = await db
    .selectFrom('employee_work_histories')
    .select(['id', 'employee_id', 'change_type', 'decision_no'])
    .where('id', '=', historyId)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (!existing) {
    throw new AppError('WORK_HISTORY_NOT_FOUND', 'Không tìm thấy bản ghi quá trình công tác.', 404);
  }

  await assertEmployeeWorkHistoryAccess(auth, Number(existing.employee_id), false);

  await db
    .updateTable('employee_work_histories')
    .set({ deleted_at: new Date(), updated_by: auth.userId })
    .where('id', '=', historyId)
    .execute();

  await recordAuditLog({
    userId: auth.userId,
    moduleCode: 'hrm',
    action: 'HRM_WORK_HISTORY_DELETE',
    entityType: 'employee_work_histories',
    entityId: historyId,
    oldValues: {
      employeeId: Number(existing.employee_id),
      changeType: existing.change_type,
      decisionNo: existing.decision_no,
    },
    ipAddress,
  });
}
