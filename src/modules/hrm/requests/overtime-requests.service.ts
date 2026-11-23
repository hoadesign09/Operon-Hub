import dayjs from 'dayjs';
import type { Transaction } from 'kysely';
import {
  getDb,
  type DatabaseSchema,
  type LeaveRequestStatus,
  type OtRateType,
} from '@/config/database';
import { formatDateVN } from '@/lib/portable/date-utils';
import { buildExcelBuffer } from '@/lib/portable/excel-exporter';
import {
  buildPaginationMeta,
  parsePaginationParams,
  type PaginationMeta,
} from '@/lib/portable/pagination';
import {
  actOnApprovalRequest,
  createApprovalRequest,
  notifyApprovalRequestCreated,
} from '@/modules/approvals/approvals.service';
import '@/modules/approvals/register-module-hooks';
import { recordAuditLog } from '@/modules/audit/audit.service';
import type { AuthContext } from '@/modules/auth/auth.service';
import {
  isEmployeeWithinScope,
  resolveEmployeeAccessScope,
} from '@/modules/hrm/employees/employees.scope';
import { OVERTIME_REQUEST_ENTITY_TYPE } from '@/modules/hrm/requests/ot-trip-approval-hooks';
import {
  calculateOtHours,
  classifyOtRateType,
  doTimeRangesOverlap,
} from '@/modules/hrm/requests/ot-trip-calculator';
import type {
  CreateOvertimeRequestInput,
  UpdateOvertimeRequestInput,
} from '@/modules/hrm/requests/ot-trip.schema';
import { AppError } from '@/shared/api-response';

export interface OvertimeRequestItem {
  id: number;
  requestCode: string;
  employeeId: number;
  employeeCode: string;
  employeeName: string;
  branchId: number;
  branchName: string | null;
  departmentName: string | null;
  workDate: string;
  startTime: string;
  endTime: string;
  totalHours: number;
  otRateType: OtRateType;
  isHoliday: boolean;
  reason: string;
  status: LeaveRequestStatus;
  approvalRequestId: number | null;
  createdAt: string;
}

const OT_RATE_LABELS: Record<OtRateType, string> = {
  WEEKDAY_150: 'Ngày thường (150%)',
  WEEKEND_200: 'Cuối tuần (200%)',
  HOLIDAY_300: 'Ngày lễ (300%)',
};

const STATUS_LABELS: Record<LeaveRequestStatus, string> = {
  DRAFT: 'Nháp',
  PENDING: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Từ chối',
  CANCELLED: 'Đã hủy',
};

function toIsoDate(value: Date | string): string {
  return value instanceof Date ? dayjs(value).format('YYYY-MM-DD') : String(value).slice(0, 10);
}

async function resolveCurrentEmployee(userId: number) {
  const db = getDb();
  const emp = await db
    .selectFrom('employees')
    .select(['id', 'user_id', 'employee_code', 'full_name', 'branch_id', 'department_id', 'manager_id'])
    .where('user_id', '=', userId)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (!emp) {
    throw new AppError(
      'EMPLOYEE_PROFILE_NOT_LINKED',
      'Tài khoản của bạn chưa được liên kết với hồ sơ nhân viên nên không thể tạo đơn tăng ca.',
      400,
    );
  }
  return emp;
}

async function checkOtOverlapInTrx(
  trx: Transaction<DatabaseSchema>,
  employeeId: number,
  workDate: string,
  startTime: string,
  endTime: string,
  excludeId?: number,
): Promise<void> {
  let query = trx
    .selectFrom('overtime_requests')
    .select(['id', 'request_code', 'start_time', 'end_time'])
    .where('employee_id', '=', employeeId)
    .where('work_date', '=', workDate)
    .where('status', 'in', ['PENDING', 'APPROVED'])
    .where('deleted_at', 'is', null);

  if (excludeId) {
    query = query.where('id', '!=', excludeId);
  }

  const existing = await query.execute();
  for (const row of existing) {
    if (doTimeRangesOverlap(startTime, endTime, row.start_time, row.end_time)) {
      throw new AppError(
        'OT_TIME_OVERLAP',
        `Khung giờ tăng ca bị trùng với đơn ${row.request_code} (${row.start_time} – ${row.end_time} ngày ${formatDateVN(workDate)}).`,
        409,
      );
    }
  }
}

async function submitOvertimeInTrx(
  trx: Transaction<DatabaseSchema>,
  params: {
    id: number;
    requestCode: string;
    employeeId: number;
    employeeName: string;
    branchId: number;
    managerId: number | null;
    workDate: string;
    startTime: string;
    endTime: string;
    totalHours: number;
    otRateType: OtRateType;
    reason: string;
    requesterUserId: number;
  },
): Promise<{ approvalRequestId: number }> {
  await checkOtOverlapInTrx(
    trx,
    params.employeeId,
    params.workDate,
    params.startTime,
    params.endTime,
    params.id,
  );

  let directManagerUserId: number | null = null;
  if (params.managerId) {
    const manager = await trx
      .selectFrom('employees')
      .select(['user_id'])
      .where('id', '=', params.managerId)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();
    directManagerUserId = manager?.user_id ? Number(manager.user_id) : null;
  }

  const approvalRes = await createApprovalRequest(
    {
      moduleCode: 'hrm',
      requestType: 'OVERTIME',
      entityType: OVERTIME_REQUEST_ENTITY_TYPE,
      entityId: params.id,
      branchId: params.branchId,
      requesterId: params.requesterUserId,
      directManagerUserId,
      title: `Đơn tăng ca ${params.requestCode} — ${params.employeeName} (${params.totalHours}h)`,
      summary: `${formatDateVN(params.workDate)} (${params.startTime}–${params.endTime}) • ${OT_RATE_LABELS[params.otRateType]}. Lý do: ${params.reason}`,
      evalContext: { days: params.totalHours },
    },
    trx,
  );

  await trx
    .updateTable('overtime_requests')
    .set({
      status: 'PENDING',
      approval_request_id: approvalRes.approvalRequestId,
      updated_by: params.requesterUserId,
    })
    .where('id', '=', params.id)
    .execute();

  return { approvalRequestId: approvalRes.approvalRequestId };
}

async function fetchOvertimeByIdInternal(id: number): Promise<OvertimeRequestItem | null> {
  const db = getDb();
  const row = await db
    .selectFrom('overtime_requests as ot')
    .innerJoin('employees as e', 'e.id', 'ot.employee_id')
    .leftJoin('branches as b', 'b.id', 'e.branch_id')
    .leftJoin('departments as d', 'd.id', 'e.department_id')
    .select([
      'ot.id',
      'ot.request_code',
      'ot.employee_id',
      'e.employee_code',
      'e.full_name as employee_name',
      'e.branch_id',
      'b.name as branch_name',
      'd.name as department_name',
      'ot.work_date',
      'ot.start_time',
      'ot.end_time',
      'ot.total_hours',
      'ot.ot_rate_type',
      'ot.is_holiday',
      'ot.reason',
      'ot.status',
      'ot.approval_request_id',
      'ot.created_at',
    ])
    .where('ot.id', '=', id)
    .where('ot.deleted_at', 'is', null)
    .executeTakeFirst();

  if (!row) {
    return null;
  }

  return {
    id: Number(row.id),
    requestCode: row.request_code,
    employeeId: Number(row.employee_id),
    employeeCode: row.employee_code,
    employeeName: row.employee_name,
    branchId: Number(row.branch_id),
    branchName: row.branch_name ?? null,
    departmentName: row.department_name ?? null,
    workDate: toIsoDate(row.work_date),
    startTime: row.start_time,
    endTime: row.end_time,
    totalHours: Number(row.total_hours),
    otRateType: row.ot_rate_type,
    isHoliday: Number(row.is_holiday) === 1,
    reason: row.reason,
    status: row.status,
    approvalRequestId:
      row.approval_request_id !== null ? Number(row.approval_request_id) : null,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

export async function listOvertimeRequests(
  auth: AuthContext,
  query: {
    mine?: string | null;
    year?: string | null;
    status?: string | null;
    otRateType?: string | null;
    branchId?: string | null;
    search?: string | null;
    page?: string | null;
    limit?: string | null;
  },
): Promise<{ items: OvertimeRequestItem[]; meta: PaginationMeta }> {
  const db = getDb();
  const pagination = parsePaginationParams(
    { page: query.page, limit: query.limit },
    { defaultLimit: 20, maxLimit: 100 },
  );

  const isMine = query.mine === 'true' || query.mine === '1';

  let baseQuery = db
    .selectFrom('overtime_requests as ot')
    .innerJoin('employees as e', 'e.id', 'ot.employee_id')
    .leftJoin('branches as b', 'b.id', 'e.branch_id')
    .leftJoin('departments as d', 'd.id', 'e.department_id')
    .where('ot.deleted_at', 'is', null)
    .where('e.deleted_at', 'is', null);

  if (isMine) {
    const selfEmp = await db
      .selectFrom('employees')
      .select(['id'])
      .where('user_id', '=', auth.userId)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();

    if (!selfEmp) {
      return { items: [], meta: buildPaginationMeta(0, pagination.page, pagination.limit) };
    }
    baseQuery = baseQuery.where('ot.employee_id', '=', Number(selfEmp.id));
  } else {
    if (!auth.isSuperAdmin && !auth.permissions.includes('hrm.requests.read')) {
      throw new AppError('FORBIDDEN', 'Bạn không có quyền xem danh sách đơn tăng ca.', 403);
    }
    const scope = await resolveEmployeeAccessScope(auth);
    if (scope.mode === 'BRANCH') {
      if (scope.branchIds.length === 0) {
        return { items: [], meta: buildPaginationMeta(0, pagination.page, pagination.limit) };
      }
      baseQuery = baseQuery.where('e.branch_id', 'in', scope.branchIds);
    } else if (scope.mode === 'DEPARTMENT') {
      if (scope.departmentIds.length === 0 && !scope.selfEmployeeId) {
        return { items: [], meta: buildPaginationMeta(0, pagination.page, pagination.limit) };
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
        return { items: [], meta: buildPaginationMeta(0, pagination.page, pagination.limit) };
      }
      baseQuery = baseQuery.where('e.id', '=', scope.selfEmployeeId);
    }
  }

  const parsedYear = Number(query.year);
  if (Number.isInteger(parsedYear) && parsedYear >= 2020 && parsedYear <= 2100) {
    baseQuery = baseQuery
      .where('ot.work_date', '>=', `${parsedYear}-01-01`)
      .where('ot.work_date', '<=', `${parsedYear}-12-31`);
  }

  if (
    query.status &&
    ['DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'].includes(query.status)
  ) {
    baseQuery = baseQuery.where('ot.status', '=', query.status as LeaveRequestStatus);
  }

  if (
    query.otRateType &&
    ['WEEKDAY_150', 'WEEKEND_200', 'HOLIDAY_300'].includes(query.otRateType)
  ) {
    baseQuery = baseQuery.where('ot.ot_rate_type', '=', query.otRateType as OtRateType);
  }

  const branchIdNum = Number(query.branchId);
  if (Number.isInteger(branchIdNum) && branchIdNum > 0) {
    baseQuery = baseQuery.where('e.branch_id', '=', branchIdNum);
  }

  if (query.search && query.search.trim().length > 0) {
    const keyword = `%${query.search.trim()}%`;
    baseQuery = baseQuery.where((eb) =>
      eb.or([
        eb('ot.request_code', 'like', keyword),
        eb('e.employee_code', 'like', keyword),
        eb('e.full_name', 'like', keyword),
        eb('ot.reason', 'like', keyword),
      ]),
    );
  }

  const countRow = await baseQuery
    .select((eb) => eb.fn.count<number>('ot.id').as('total'))
    .executeTakeFirst();
  const total = Number(countRow?.total ?? 0);

  const rows = await baseQuery
    .select([
      'ot.id',
      'ot.request_code',
      'ot.employee_id',
      'e.employee_code',
      'e.full_name as employee_name',
      'e.branch_id',
      'b.name as branch_name',
      'd.name as department_name',
      'ot.work_date',
      'ot.start_time',
      'ot.end_time',
      'ot.total_hours',
      'ot.ot_rate_type',
      'ot.is_holiday',
      'ot.reason',
      'ot.status',
      'ot.approval_request_id',
      'ot.created_at',
    ])
    .orderBy('ot.work_date', 'desc')
    .orderBy('ot.id', 'desc')
    .limit(pagination.limit)
    .offset(pagination.offset)
    .execute();

  const items: OvertimeRequestItem[] = rows.map((row) => ({
    id: Number(row.id),
    requestCode: row.request_code,
    employeeId: Number(row.employee_id),
    employeeCode: row.employee_code,
    employeeName: row.employee_name,
    branchId: Number(row.branch_id),
    branchName: row.branch_name ?? null,
    departmentName: row.department_name ?? null,
    workDate: toIsoDate(row.work_date),
    startTime: row.start_time,
    endTime: row.end_time,
    totalHours: Number(row.total_hours),
    otRateType: row.ot_rate_type,
    isHoliday: Number(row.is_holiday) === 1,
    reason: row.reason,
    status: row.status,
    approvalRequestId:
      row.approval_request_id !== null ? Number(row.approval_request_id) : null,
    createdAt: new Date(row.created_at).toISOString(),
  }));

  return { items, meta: buildPaginationMeta(total, pagination.page, pagination.limit) };
}

export async function getOvertimeRequestDetail(
  id: number,
  auth: AuthContext,
): Promise<OvertimeRequestItem> {
  const db = getDb();
  const item = await fetchOvertimeByIdInternal(id);
  if (!item) {
    throw new AppError('OT_REQUEST_NOT_FOUND', 'Không tìm thấy đơn tăng ca.', 404);
  }

  const empRow = await db
    .selectFrom('employees')
    .select(['id', 'branch_id', 'department_id', 'user_id'])
    .where('id', '=', item.employeeId)
    .executeTakeFirstOrThrow();

  const isOwner = empRow.user_id !== null && Number(empRow.user_id) === auth.userId;
  if (!isOwner) {
    if (!auth.isSuperAdmin && !auth.permissions.includes('hrm.requests.read')) {
      throw new AppError('FORBIDDEN', 'Bạn không có quyền xem đơn tăng ca này.', 403);
    }
    const scope = await resolveEmployeeAccessScope(auth);
    const allowed = isEmployeeWithinScope(
      scope,
      {
        id: Number(empRow.id),
        branchId: Number(empRow.branch_id),
        departmentId: Number(empRow.department_id),
        userId: empRow.user_id !== null ? Number(empRow.user_id) : null,
      },
      auth.userId,
    );
    if (!allowed) {
      throw new AppError('FORBIDDEN', 'Đơn tăng ca nằm ngoài phạm vi dữ liệu của bạn.', 403);
    }
  }

  return item;
}

export async function createOvertimeRequest(
  input: CreateOvertimeRequestInput,
  auth: AuthContext,
  ipAddress: string | null,
): Promise<OvertimeRequestItem> {
  const db = getDb();
  const emp = await resolveCurrentEmployee(auth.userId);

  const totalHours = calculateOtHours(input.startTime, input.endTime);
  const otRateType = classifyOtRateType(input.workDate, { isHoliday: input.isHoliday });
  const year = dayjs(input.workDate).year();
  const tempCode = `OT-${year}-TMP-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

  const { createdId, approvalRequestId } = await db.transaction().execute(async (trx) => {
    await checkOtOverlapInTrx(trx, Number(emp.id), input.workDate, input.startTime, input.endTime);

    const inserted = await trx
      .insertInto('overtime_requests')
      .values({
        request_code: tempCode,
        employee_id: Number(emp.id),
        work_date: input.workDate,
        start_time: input.startTime,
        end_time: input.endTime,
        total_hours: totalHours,
        ot_rate_type: otRateType,
        is_holiday: input.isHoliday ? 1 : 0,
        reason: input.reason.trim(),
        status: 'DRAFT',
        approval_request_id: null,
        created_by: auth.userId,
        updated_by: auth.userId,
      })
      .executeTakeFirstOrThrow();

    const id = Number(inserted.insertId);
    const finalCode = `OT-${year}-${String(id).padStart(4, '0')}`;

    await trx
      .updateTable('overtime_requests')
      .set({ request_code: finalCode })
      .where('id', '=', id)
      .execute();

    let createdApprovalId: number | null = null;
    if (input.submitNow) {
      const submitRes = await submitOvertimeInTrx(trx, {
        id,
        requestCode: finalCode,
        employeeId: Number(emp.id),
        employeeName: emp.full_name,
        branchId: Number(emp.branch_id),
        managerId: emp.manager_id !== null ? Number(emp.manager_id) : null,
        workDate: input.workDate,
        startTime: input.startTime,
        endTime: input.endTime,
        totalHours,
        otRateType,
        reason: input.reason.trim(),
        requesterUserId: auth.userId,
      });
      createdApprovalId = submitRes.approvalRequestId;
    }

    return { createdId: id, approvalRequestId: createdApprovalId };
  });

  if (approvalRequestId) {
    await notifyApprovalRequestCreated(approvalRequestId);
  }

  const created = await fetchOvertimeByIdInternal(createdId);
  if (!created) {
    throw new AppError('INTERNAL_ERROR', 'Không thể đọc lại đơn tăng ca vừa tạo.', 500);
  }

  await recordAuditLog({
    userId: auth.userId,
    moduleCode: 'hrm',
    action: input.submitNow ? 'OVERTIME_REQUEST_SUBMIT' : 'OVERTIME_REQUEST_CREATE',
    entityType: 'overtime_requests',
    entityId: createdId,
    newValues: {
      requestCode: created.requestCode,
      totalHours: created.totalHours,
      otRateType: created.otRateType,
      status: created.status,
    },
    ipAddress,
  });

  return created;
}

export async function updateOvertimeRequest(
  id: number,
  input: UpdateOvertimeRequestInput,
  auth: AuthContext,
  ipAddress: string | null,
): Promise<OvertimeRequestItem> {
  const db = getDb();
  const existing = await db
    .selectFrom('overtime_requests as ot')
    .innerJoin('employees as e', 'e.id', 'ot.employee_id')
    .select([
      'ot.id',
      'ot.employee_id',
      'e.user_id',
      'ot.work_date',
      'ot.start_time',
      'ot.end_time',
      'ot.is_holiday',
      'ot.reason',
      'ot.status',
    ])
    .where('ot.id', '=', id)
    .where('ot.deleted_at', 'is', null)
    .executeTakeFirst();

  if (!existing) {
    throw new AppError('OT_REQUEST_NOT_FOUND', 'Không tìm thấy đơn tăng ca.', 404);
  }

  const isOwner = existing.user_id !== null && Number(existing.user_id) === auth.userId;
  if (!isOwner && !auth.isSuperAdmin) {
    throw new AppError('FORBIDDEN', 'Bạn chỉ có thể sửa đơn tăng ca của chính mình.', 403);
  }

  if (existing.status !== 'DRAFT') {
    throw new AppError(
      'INVALID_OT_STATUS',
      'Chỉ có thể chỉnh sửa đơn tăng ca khi đang ở trạng thái Nháp (DRAFT).',
      409,
    );
  }

  const nextWorkDate = input.workDate ?? toIsoDate(existing.work_date);
  const nextStartTime = input.startTime ?? existing.start_time;
  const nextEndTime = input.endTime ?? existing.end_time;
  const nextIsHoliday =
    input.isHoliday !== undefined ? input.isHoliday : Number(existing.is_holiday) === 1;

  const totalHours = calculateOtHours(nextStartTime, nextEndTime);
  const otRateType = classifyOtRateType(nextWorkDate, { isHoliday: nextIsHoliday });

  await db.transaction().execute(async (trx) => {
    await checkOtOverlapInTrx(
      trx,
      Number(existing.employee_id),
      nextWorkDate,
      nextStartTime,
      nextEndTime,
      id,
    );

    await trx
      .updateTable('overtime_requests')
      .set({
        work_date: nextWorkDate,
        start_time: nextStartTime,
        end_time: nextEndTime,
        total_hours: totalHours,
        ot_rate_type: otRateType,
        is_holiday: nextIsHoliday ? 1 : 0,
        reason: input.reason !== undefined ? input.reason.trim() : existing.reason,
        updated_by: auth.userId,
      })
      .where('id', '=', id)
      .execute();
  });

  const updated = await fetchOvertimeByIdInternal(id);
  if (!updated) {
    throw new AppError('INTERNAL_ERROR', 'Không thể đọc lại đơn tăng ca sau cập nhật.', 500);
  }

  await recordAuditLog({
    userId: auth.userId,
    moduleCode: 'hrm',
    action: 'OVERTIME_REQUEST_UPDATE',
    entityType: 'overtime_requests',
    entityId: id,
    newValues: { workDate: updated.workDate, totalHours: updated.totalHours, otRateType },
    ipAddress,
  });

  return updated;
}

export async function submitOvertimeRequest(
  id: number,
  auth: AuthContext,
  ipAddress: string | null,
): Promise<OvertimeRequestItem> {
  const db = getDb();

  const { approvalRequestId } = await db.transaction().execute(async (trx) => {
    const row = await trx
      .selectFrom('overtime_requests as ot')
      .innerJoin('employees as e', 'e.id', 'ot.employee_id')
      .select([
        'ot.id',
        'ot.request_code',
        'ot.employee_id',
        'e.user_id',
        'e.full_name as employee_name',
        'e.branch_id',
        'e.manager_id',
        'ot.work_date',
        'ot.start_time',
        'ot.end_time',
        'ot.total_hours',
        'ot.ot_rate_type',
        'ot.reason',
        'ot.status',
      ])
      .where('ot.id', '=', id)
      .where('ot.deleted_at', 'is', null)
      .forUpdate()
      .executeTakeFirst();

    if (!row) {
      throw new AppError('OT_REQUEST_NOT_FOUND', 'Không tìm thấy đơn tăng ca.', 404);
    }

    const isOwner = row.user_id !== null && Number(row.user_id) === auth.userId;
    if (!isOwner && !auth.isSuperAdmin) {
      throw new AppError('FORBIDDEN', 'Bạn không có quyền gửi duyệt đơn tăng ca này.', 403);
    }

    if (row.status !== 'DRAFT') {
      throw new AppError('INVALID_OT_STATUS', 'Chỉ có thể gửi duyệt đơn ở trạng thái Nháp.', 409);
    }

    return submitOvertimeInTrx(trx, {
      id: Number(row.id),
      requestCode: row.request_code,
      employeeId: Number(row.employee_id),
      employeeName: row.employee_name,
      branchId: Number(row.branch_id),
      managerId: row.manager_id !== null ? Number(row.manager_id) : null,
      workDate: toIsoDate(row.work_date),
      startTime: row.start_time,
      endTime: row.end_time,
      totalHours: Number(row.total_hours),
      otRateType: row.ot_rate_type,
      reason: row.reason,
      requesterUserId: auth.userId,
    });
  });

  await notifyApprovalRequestCreated(approvalRequestId);

  const updated = await fetchOvertimeByIdInternal(id);
  if (!updated) {
    throw new AppError('INTERNAL_ERROR', 'Không thể đọc lại đơn tăng ca sau khi gửi.', 500);
  }

  await recordAuditLog({
    userId: auth.userId,
    moduleCode: 'hrm',
    action: 'OVERTIME_REQUEST_SUBMIT',
    entityType: 'overtime_requests',
    entityId: id,
    newValues: { status: updated.status, approvalRequestId },
    ipAddress,
  });

  return updated;
}

export async function cancelOvertimeRequest(
  id: number,
  comment: string | null | undefined,
  auth: AuthContext,
  ipAddress: string | null,
): Promise<OvertimeRequestItem> {
  const db = getDb();
  const row = await db
    .selectFrom('overtime_requests as ot')
    .innerJoin('employees as e', 'e.id', 'ot.employee_id')
    .select(['ot.id', 'ot.status', 'ot.approval_request_id', 'e.user_id'])
    .where('ot.id', '=', id)
    .where('ot.deleted_at', 'is', null)
    .executeTakeFirst();

  if (!row) {
    throw new AppError('OT_REQUEST_NOT_FOUND', 'Không tìm thấy đơn tăng ca.', 404);
  }

  const isOwner = row.user_id !== null && Number(row.user_id) === auth.userId;
  if (!isOwner && !auth.isSuperAdmin) {
    throw new AppError('FORBIDDEN', 'Bạn không có quyền hủy đơn tăng ca này.', 403);
  }

  if (row.status === 'DRAFT') {
    await db
      .updateTable('overtime_requests')
      .set({ status: 'CANCELLED', updated_by: auth.userId })
      .where('id', '=', id)
      .execute();
  } else if (row.status === 'PENDING' && row.approval_request_id !== null) {
    await actOnApprovalRequest(
      Number(row.approval_request_id),
      auth,
      'CANCEL',
      comment ?? 'Người gửi tự hủy đơn tăng ca',
      ipAddress,
    );
  } else {
    throw new AppError(
      'INVALID_OT_STATUS',
      'Không thể hủy đơn tăng ca đã hoàn tất hoặc đã hủy trước đó.',
      409,
    );
  }

  const updated = await fetchOvertimeByIdInternal(id);
  if (!updated) {
    throw new AppError('INTERNAL_ERROR', 'Không thể đọc lại đơn tăng ca sau khi hủy.', 500);
  }

  await recordAuditLog({
    userId: auth.userId,
    moduleCode: 'hrm',
    action: 'OVERTIME_REQUEST_CANCEL',
    entityType: 'overtime_requests',
    entityId: id,
    newValues: { status: updated.status, comment: comment?.trim() || null },
    ipAddress,
  });

  return updated;
}

export async function softDeleteOvertimeRequest(
  id: number,
  auth: AuthContext,
  ipAddress: string | null,
): Promise<{ id: number; deleted: true }> {
  const db = getDb();
  const row = await db
    .selectFrom('overtime_requests as ot')
    .innerJoin('employees as e', 'e.id', 'ot.employee_id')
    .select(['ot.id', 'ot.request_code', 'ot.status', 'e.user_id'])
    .where('ot.id', '=', id)
    .where('ot.deleted_at', 'is', null)
    .executeTakeFirst();

  if (!row) {
    throw new AppError('OT_REQUEST_NOT_FOUND', 'Không tìm thấy đơn tăng ca.', 404);
  }

  const isOwner = row.user_id !== null && Number(row.user_id) === auth.userId;
  if (!isOwner && !auth.isSuperAdmin) {
    throw new AppError('FORBIDDEN', 'Bạn không có quyền xóa đơn tăng ca này.', 403);
  }

  if (row.status !== 'DRAFT' && row.status !== 'CANCELLED') {
    throw new AppError(
      'INVALID_OT_STATUS',
      'Chỉ có thể xóa đơn tăng ca ở trạng thái Nháp hoặc Đã hủy.',
      409,
    );
  }

  await db
    .updateTable('overtime_requests')
    .set({ deleted_at: new Date(), updated_by: auth.userId })
    .where('id', '=', id)
    .execute();

  await recordAuditLog({
    userId: auth.userId,
    moduleCode: 'hrm',
    action: 'OVERTIME_REQUEST_DELETE',
    entityType: 'overtime_requests',
    entityId: id,
    oldValues: { requestCode: row.request_code, status: row.status },
    ipAddress,
  });

  return { id, deleted: true };
}

export async function exportOvertimeRequestsToExcel(
  auth: AuthContext,
  query: {
    year?: string | null;
    status?: string | null;
    otRateType?: string | null;
    branchId?: string | null;
    search?: string | null;
  },
): Promise<{ buffer: Buffer; filename: string }> {
  const result = await listOvertimeRequests(auth, { ...query, page: '1', limit: '100' });

  const rows = result.items.map((item, idx) => ({
    stt: idx + 1,
    requestCode: item.requestCode,
    employeeCode: item.employeeCode,
    employeeName: item.employeeName,
    departmentName: item.departmentName ?? '-',
    workDate: formatDateVN(item.workDate),
    timeRange: `${item.startTime} – ${item.endTime}`,
    totalHours: item.totalHours,
    otRateType: OT_RATE_LABELS[item.otRateType],
    status: STATUS_LABELS[item.status],
    reason: item.reason,
  }));

  const buffer = await buildExcelBuffer(
    rows,
    [
      { header: 'STT', key: 'stt', width: 6, align: 'center' },
      { header: 'Mã đơn', key: 'requestCode', width: 16 },
      { header: 'Mã NV', key: 'employeeCode', width: 12 },
      { header: 'Họ và tên', key: 'employeeName', width: 24 },
      { header: 'Phòng ban', key: 'departmentName', width: 24 },
      { header: 'Ngày OT', key: 'workDate', width: 14, align: 'center' },
      { header: 'Khung giờ', key: 'timeRange', width: 16, align: 'center' },
      { header: 'Tổng giờ', key: 'totalHours', width: 12, align: 'right', numFmt: '0.00' },
      { header: 'Hệ số OT', key: 'otRateType', width: 20 },
      { header: 'Trạng thái', key: 'status', width: 14, align: 'center' },
      { header: 'Lý do', key: 'reason', width: 36 },
    ],
    {
      sheetName: 'Don_Tang_Ca_OT',
      title: 'DANH SÁCH ĐƠN TĂNG CA (OT) — OPERON HUB',
      subtitle: `Ngày xuất: ${formatDateVN(new Date())} | Tổng số đơn: ${rows.length}`,
    },
  );

  return {
    buffer,
    filename: `don-tang-ca-${dayjs().format('YYYY-MM-DD')}.xlsx`,
  };
}
