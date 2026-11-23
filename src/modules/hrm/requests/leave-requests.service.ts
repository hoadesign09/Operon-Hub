import dayjs from 'dayjs';
import type { Transaction } from 'kysely';
import {
  getDb,
  type DatabaseSchema,
  type LeaveRequestStatus,
  type LeaveSession,
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
import { LEAVE_REQUEST_ENTITY_TYPE } from '@/modules/hrm/requests/leave-approval-hook';
import {
  calculateLeaveDays,
  computeRemainingDays,
  doLeaveRangesOverlap,
  roundLeaveDays,
} from '@/modules/hrm/requests/leave-calculator';
import type {
  CreateLeaveRequestInput,
  UpdateLeaveRequestInput,
} from '@/modules/hrm/requests/leaves.schema';
import { AppError } from '@/shared/api-response';

export interface LeaveRequestItem {
  id: number;
  requestCode: string;
  employeeId: number;
  employeeCode: string;
  employeeName: string;
  branchId: number;
  branchName: string | null;
  departmentName: string | null;
  leaveTypeId: number;
  leaveTypeCode: string;
  leaveTypeName: string;
  isPaid: boolean;
  startDate: string;
  endDate: string;
  startSession: LeaveSession;
  endSession: LeaveSession;
  totalDays: number;
  reason: string;
  attachmentUrl: string | null;
  status: LeaveRequestStatus;
  approvalRequestId: number | null;
  createdAt: string;
}

const SESSION_LABELS: Record<LeaveSession, string> = {
  FULL: 'Cả ngày',
  AM: 'Buổi sáng',
  PM: 'Buổi chiều',
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

async function resolveCurrentEmployeeForUser(userId: number) {
  const db = getDb();
  const emp = await db
    .selectFrom('employees')
    .select([
      'id',
      'user_id',
      'employee_code',
      'full_name',
      'branch_id',
      'department_id',
      'manager_id',
      'employment_status',
    ])
    .where('user_id', '=', userId)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (!emp) {
    throw new AppError(
      'EMPLOYEE_PROFILE_NOT_LINKED',
      'Tài khoản của bạn chưa được liên kết với hồ sơ nhân viên nên không thể tạo đơn nghỉ phép.',
      400,
    );
  }
  return emp;
}

async function checkOverlapInTrx(
  trx: Transaction<DatabaseSchema>,
  employeeId: number,
  candidate: {
    startDate: string;
    endDate: string;
    startSession: LeaveSession;
    endSession: LeaveSession;
  },
  excludeRequestId?: number,
): Promise<void> {
  let query = trx
    .selectFrom('leave_requests')
    .select(['id', 'request_code', 'start_date', 'end_date', 'start_session', 'end_session'])
    .where('employee_id', '=', employeeId)
    .where('status', 'in', ['PENDING', 'APPROVED'])
    .where('deleted_at', 'is', null)
    .where('start_date', '<=', candidate.endDate)
    .where('end_date', '>=', candidate.startDate);

  if (excludeRequestId) {
    query = query.where('id', '!=', excludeRequestId);
  }

  const existingList = await query.execute();
  for (const row of existingList) {
    const overlaps = doLeaveRangesOverlap(candidate, {
      startDate: toIsoDate(row.start_date),
      endDate: toIsoDate(row.end_date),
      startSession: row.start_session,
      endSession: row.end_session,
    });
    if (overlaps) {
      throw new AppError(
        'LEAVE_DATE_OVERLAP',
        `Thời gian nghỉ bị trùng với đơn ${row.request_code} (${formatDateVN(row.start_date)} – ${formatDateVN(row.end_date)}).`,
        409,
      );
    }
  }
}

async function lockBalanceAndSubmitApprovalInTrx(
  trx: Transaction<DatabaseSchema>,
  params: {
    leaveRequestId: number;
    requestCode: string;
    employeeId: number;
    employeeName: string;
    branchId: number;
    managerId: number | null;
    leaveTypeId: number;
    leaveTypeName: string;
    defaultDaysPerYear: number;
    requiresAttachment: boolean;
    attachmentUrl: string | null;
    startDate: string;
    endDate: string;
    startSession: LeaveSession;
    endSession: LeaveSession;
    totalDays: number;
    reason: string;
    requesterUserId: number;
  },
): Promise<{ approvalRequestId: number }> {
  if (params.requiresAttachment && (!params.attachmentUrl || params.attachmentUrl.trim().length === 0)) {
    throw new AppError(
      'ATTACHMENT_REQUIRED',
      `Loại phép "${params.leaveTypeName}" bắt buộc có đường dẫn tài liệu/minh chứng đính kèm trước khi gửi duyệt.`,
      400,
    );
  }

  await checkOverlapInTrx(
    trx,
    params.employeeId,
    {
      startDate: params.startDate,
      endDate: params.endDate,
      startSession: params.startSession,
      endSession: params.endSession,
    },
    params.leaveRequestId,
  );

  const leaveYear = dayjs(params.startDate).year();
  if (params.defaultDaysPerYear > 0) {
    const balanceRow = await trx
      .selectFrom('leave_balances')
      .select(['id', 'entitled_days', 'carried_over_days', 'used_days', 'pending_days'])
      .where('employee_id', '=', params.employeeId)
      .where('leave_type_id', '=', params.leaveTypeId)
      .where('year', '=', leaveYear)
      .where('deleted_at', 'is', null)
      .forUpdate()
      .executeTakeFirst();

    if (!balanceRow) {
      throw new AppError(
        'LEAVE_BALANCE_NOT_INITIALIZED',
        `Quỹ "${params.leaveTypeName}" năm ${leaveYear} của bạn chưa được khởi tạo. Vui lòng liên hệ Phòng Nhân sự.`,
        400,
      );
    }

    const remaining = computeRemainingDays({
      entitledDays: Number(balanceRow.entitled_days),
      carriedOverDays: Number(balanceRow.carried_over_days),
      usedDays: Number(balanceRow.used_days),
      pendingDays: Number(balanceRow.pending_days),
    });

    if (remaining < params.totalDays) {
      throw new AppError(
        'INSUFFICIENT_LEAVE_BALANCE',
        `Số dư "${params.leaveTypeName}" còn lại (${remaining} ngày) không đủ cho đơn xin nghỉ (${params.totalDays} ngày).`,
        400,
      );
    }

    const nextPending = roundLeaveDays(Number(balanceRow.pending_days) + params.totalDays);
    await trx
      .updateTable('leave_balances')
      .set({
        pending_days: nextPending,
        updated_by: params.requesterUserId,
      })
      .where('id', '=', Number(balanceRow.id))
      .execute();
  }

  let directManagerUserId: number | null = null;
  if (params.managerId) {
    const managerRow = await trx
      .selectFrom('employees')
      .select(['user_id'])
      .where('id', '=', params.managerId)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();
    directManagerUserId = managerRow?.user_id ? Number(managerRow.user_id) : null;
  }

  const approvalRes = await createApprovalRequest(
    {
      moduleCode: 'hrm',
      requestType: 'LEAVE',
      entityType: LEAVE_REQUEST_ENTITY_TYPE,
      entityId: params.leaveRequestId,
      branchId: params.branchId,
      requesterId: params.requesterUserId,
      directManagerUserId,
      title: `Đơn nghỉ phép ${params.requestCode} — ${params.employeeName} (${params.totalDays} ngày)`,
      summary: `${params.leaveTypeName}: ${formatDateVN(params.startDate)} (${SESSION_LABELS[params.startSession]}) → ${formatDateVN(params.endDate)} (${SESSION_LABELS[params.endSession]}). Lý do: ${params.reason}`,
      evalContext: { days: params.totalDays },
    },
    trx,
  );

  await trx
    .updateTable('leave_requests')
    .set({
      status: 'PENDING',
      approval_request_id: approvalRes.approvalRequestId,
      updated_by: params.requesterUserId,
    })
    .where('id', '=', params.leaveRequestId)
    .execute();

  return { approvalRequestId: approvalRes.approvalRequestId };
}

async function fetchLeaveRequestByIdInternal(id: number): Promise<LeaveRequestItem | null> {
  const db = getDb();
  const row = await db
    .selectFrom('leave_requests as lr')
    .innerJoin('employees as e', 'e.id', 'lr.employee_id')
    .innerJoin('leave_types as lt', 'lt.id', 'lr.leave_type_id')
    .leftJoin('branches as b', 'b.id', 'e.branch_id')
    .leftJoin('departments as d', 'd.id', 'e.department_id')
    .select([
      'lr.id',
      'lr.request_code',
      'lr.employee_id',
      'e.employee_code',
      'e.full_name as employee_name',
      'e.branch_id',
      'b.name as branch_name',
      'd.name as department_name',
      'lr.leave_type_id',
      'lt.code as leave_type_code',
      'lt.name as leave_type_name',
      'lt.is_paid',
      'lr.start_date',
      'lr.end_date',
      'lr.start_session',
      'lr.end_session',
      'lr.total_days',
      'lr.reason',
      'lr.attachment_url',
      'lr.status',
      'lr.approval_request_id',
      'lr.created_at',
    ])
    .where('lr.id', '=', id)
    .where('lr.deleted_at', 'is', null)
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
    leaveTypeId: Number(row.leave_type_id),
    leaveTypeCode: row.leave_type_code,
    leaveTypeName: row.leave_type_name,
    isPaid: Number(row.is_paid) === 1,
    startDate: toIsoDate(row.start_date),
    endDate: toIsoDate(row.end_date),
    startSession: row.start_session,
    endSession: row.end_session,
    totalDays: Number(row.total_days),
    reason: row.reason,
    attachmentUrl: row.attachment_url,
    status: row.status,
    approvalRequestId:
      row.approval_request_id !== null ? Number(row.approval_request_id) : null,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

export async function listLeaveRequests(
  auth: AuthContext,
  query: {
    mine?: string | null;
    year?: string | null;
    status?: string | null;
    leaveTypeId?: string | null;
    branchId?: string | null;
    search?: string | null;
    page?: string | null;
    limit?: string | null;
  },
): Promise<{ items: LeaveRequestItem[]; meta: PaginationMeta }> {
  const db = getDb();
  const pagination = parsePaginationParams(
    { page: query.page, limit: query.limit },
    { defaultLimit: 20, maxLimit: 100 },
  );

  const isMine = query.mine === 'true' || query.mine === '1';

  let baseQuery = db
    .selectFrom('leave_requests as lr')
    .innerJoin('employees as e', 'e.id', 'lr.employee_id')
    .innerJoin('leave_types as lt', 'lt.id', 'lr.leave_type_id')
    .leftJoin('branches as b', 'b.id', 'e.branch_id')
    .leftJoin('departments as d', 'd.id', 'e.department_id')
    .where('lr.deleted_at', 'is', null)
    .where('e.deleted_at', 'is', null);

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
        meta: buildPaginationMeta(0, pagination.page, pagination.limit),
      };
    }
    baseQuery = baseQuery.where('lr.employee_id', '=', Number(selfEmp.id));
  } else {
    if (!auth.isSuperAdmin && !auth.permissions.includes('hrm.requests.read')) {
      throw new AppError('FORBIDDEN', 'Bạn không có quyền xem danh sách đơn nghỉ phép.', 403);
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
      .where('lr.start_date', '>=', `${parsedYear}-01-01`)
      .where('lr.start_date', '<=', `${parsedYear}-12-31`);
  }

  if (
    query.status &&
    ['DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'].includes(query.status)
  ) {
    baseQuery = baseQuery.where('lr.status', '=', query.status as LeaveRequestStatus);
  }

  const leaveTypeIdNum = Number(query.leaveTypeId);
  if (Number.isInteger(leaveTypeIdNum) && leaveTypeIdNum > 0) {
    baseQuery = baseQuery.where('lr.leave_type_id', '=', leaveTypeIdNum);
  }

  const branchIdNum = Number(query.branchId);
  if (Number.isInteger(branchIdNum) && branchIdNum > 0) {
    baseQuery = baseQuery.where('e.branch_id', '=', branchIdNum);
  }

  if (query.search && query.search.trim().length > 0) {
    const keyword = `%${query.search.trim()}%`;
    baseQuery = baseQuery.where((eb) =>
      eb.or([
        eb('lr.request_code', 'like', keyword),
        eb('e.employee_code', 'like', keyword),
        eb('e.full_name', 'like', keyword),
        eb('lr.reason', 'like', keyword),
      ]),
    );
  }

  const countRow = await baseQuery
    .select((eb) => eb.fn.count<number>('lr.id').as('total'))
    .executeTakeFirst();
  const total = Number(countRow?.total ?? 0);

  const rows = await baseQuery
    .select([
      'lr.id',
      'lr.request_code',
      'lr.employee_id',
      'e.employee_code',
      'e.full_name as employee_name',
      'e.branch_id',
      'b.name as branch_name',
      'd.name as department_name',
      'lr.leave_type_id',
      'lt.code as leave_type_code',
      'lt.name as leave_type_name',
      'lt.is_paid',
      'lr.start_date',
      'lr.end_date',
      'lr.start_session',
      'lr.end_session',
      'lr.total_days',
      'lr.reason',
      'lr.attachment_url',
      'lr.status',
      'lr.approval_request_id',
      'lr.created_at',
    ])
    .orderBy('lr.created_at', 'desc')
    .orderBy('lr.id', 'desc')
    .limit(pagination.limit)
    .offset(pagination.offset)
    .execute();

  const items: LeaveRequestItem[] = rows.map((row) => ({
    id: Number(row.id),
    requestCode: row.request_code,
    employeeId: Number(row.employee_id),
    employeeCode: row.employee_code,
    employeeName: row.employee_name,
    branchId: Number(row.branch_id),
    branchName: row.branch_name ?? null,
    departmentName: row.department_name ?? null,
    leaveTypeId: Number(row.leave_type_id),
    leaveTypeCode: row.leave_type_code,
    leaveTypeName: row.leave_type_name,
    isPaid: Number(row.is_paid) === 1,
    startDate: toIsoDate(row.start_date),
    endDate: toIsoDate(row.end_date),
    startSession: row.start_session,
    endSession: row.end_session,
    totalDays: Number(row.total_days),
    reason: row.reason,
    attachmentUrl: row.attachment_url,
    status: row.status,
    approvalRequestId:
      row.approval_request_id !== null ? Number(row.approval_request_id) : null,
    createdAt: new Date(row.created_at).toISOString(),
  }));

  return {
    items,
    meta: buildPaginationMeta(total, pagination.page, pagination.limit),
  };
}

export async function getLeaveRequestDetail(
  id: number,
  auth: AuthContext,
): Promise<LeaveRequestItem> {
  const db = getDb();
  const item = await fetchLeaveRequestByIdInternal(id);
  if (!item) {
    throw new AppError('LEAVE_REQUEST_NOT_FOUND', 'Không tìm thấy đơn nghỉ phép.', 404);
  }

  const empRow = await db
    .selectFrom('employees')
    .select(['id', 'branch_id', 'department_id', 'user_id'])
    .where('id', '=', item.employeeId)
    .executeTakeFirstOrThrow();

  const isOwner = empRow.user_id !== null && Number(empRow.user_id) === auth.userId;
  if (!isOwner) {
    if (!auth.isSuperAdmin && !auth.permissions.includes('hrm.requests.read')) {
      throw new AppError('FORBIDDEN', 'Bạn không có quyền xem đơn nghỉ phép này.', 403);
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
      throw new AppError('FORBIDDEN', 'Đơn nghỉ phép nằm ngoài phạm vi dữ liệu của bạn.', 403);
    }
  }

  return item;
}

export async function createLeaveRequest(
  input: CreateLeaveRequestInput,
  auth: AuthContext,
  ipAddress: string | null,
): Promise<LeaveRequestItem> {
  const db = getDb();
  const emp = await resolveCurrentEmployeeForUser(auth.userId);

  const leaveType = await db
    .selectFrom('leave_types')
    .select(['id', 'name', 'default_days_per_year', 'requires_attachment', 'is_active'])
    .where('id', '=', input.leaveTypeId)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (!leaveType || Number(leaveType.is_active) !== 1) {
    throw new AppError(
      'LEAVE_TYPE_NOT_FOUND',
      'Loại nghỉ phép không tồn tại hoặc đã ngưng áp dụng.',
      404,
    );
  }

  const totalDays = calculateLeaveDays({
    startDate: input.startDate,
    endDate: input.endDate,
    startSession: input.startSession,
    endSession: input.endSession,
  });

  if (totalDays <= 0) {
    throw new AppError(
      'ZERO_LEAVE_DAYS',
      'Khoảng ngày nghỉ chọn toàn bộ rơi vào ngày nghỉ cuối tuần (Thứ 7, Chủ nhật). Vui lòng chọn lại.',
      400,
    );
  }

  const leaveYear = dayjs(input.startDate).year();
  const tempCode = `NP-${leaveYear}-TMP-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

  const { createdId, approvalRequestId } = await db.transaction().execute(async (trx) => {
    await checkOverlapInTrx(trx, Number(emp.id), {
      startDate: input.startDate,
      endDate: input.endDate,
      startSession: input.startSession,
      endSession: input.endSession,
    });

    const inserted = await trx
      .insertInto('leave_requests')
      .values({
        request_code: tempCode,
        employee_id: Number(emp.id),
        leave_type_id: Number(leaveType.id),
        start_date: input.startDate,
        end_date: input.endDate,
        start_session: input.startSession,
        end_session: input.endSession,
        total_days: totalDays,
        reason: input.reason.trim(),
        attachment_url: input.attachmentUrl?.trim() || null,
        status: 'DRAFT',
        approval_request_id: null,
        created_by: auth.userId,
        updated_by: auth.userId,
      })
      .executeTakeFirstOrThrow();

    const id = Number(inserted.insertId);
    const finalCode = `NP-${leaveYear}-${String(id).padStart(4, '0')}`;

    await trx
      .updateTable('leave_requests')
      .set({ request_code: finalCode })
      .where('id', '=', id)
      .execute();

    let createdApprovalId: number | null = null;
    if (input.submitNow) {
      const submitRes = await lockBalanceAndSubmitApprovalInTrx(trx, {
        leaveRequestId: id,
        requestCode: finalCode,
        employeeId: Number(emp.id),
        employeeName: emp.full_name,
        branchId: Number(emp.branch_id),
        managerId: emp.manager_id !== null ? Number(emp.manager_id) : null,
        leaveTypeId: Number(leaveType.id),
        leaveTypeName: leaveType.name,
        defaultDaysPerYear: Number(leaveType.default_days_per_year),
        requiresAttachment: Number(leaveType.requires_attachment) === 1,
        attachmentUrl: input.attachmentUrl?.trim() || null,
        startDate: input.startDate,
        endDate: input.endDate,
        startSession: input.startSession,
        endSession: input.endSession,
        totalDays,
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

  const created = await fetchLeaveRequestByIdInternal(createdId);
  if (!created) {
    throw new AppError('INTERNAL_ERROR', 'Không thể đọc lại đơn nghỉ phép vừa tạo.', 500);
  }

  await recordAuditLog({
    userId: auth.userId,
    moduleCode: 'hrm',
    action: input.submitNow ? 'LEAVE_REQUEST_SUBMIT' : 'LEAVE_REQUEST_CREATE',
    entityType: 'leave_requests',
    entityId: createdId,
    newValues: {
      requestCode: created.requestCode,
      totalDays: created.totalDays,
      status: created.status,
      approvalRequestId: created.approvalRequestId,
    },
    ipAddress,
  });

  return created;
}

export async function updateLeaveRequest(
  id: number,
  input: UpdateLeaveRequestInput,
  auth: AuthContext,
  ipAddress: string | null,
): Promise<LeaveRequestItem> {
  const db = getDb();
  const existing = await db
    .selectFrom('leave_requests as lr')
    .innerJoin('employees as e', 'e.id', 'lr.employee_id')
    .select([
      'lr.id',
      'lr.employee_id',
      'e.user_id',
      'lr.leave_type_id',
      'lr.start_date',
      'lr.end_date',
      'lr.start_session',
      'lr.end_session',
      'lr.total_days',
      'lr.reason',
      'lr.attachment_url',
      'lr.status',
    ])
    .where('lr.id', '=', id)
    .where('lr.deleted_at', 'is', null)
    .executeTakeFirst();

  if (!existing) {
    throw new AppError('LEAVE_REQUEST_NOT_FOUND', 'Không tìm thấy đơn nghỉ phép.', 404);
  }

  const isOwner = existing.user_id !== null && Number(existing.user_id) === auth.userId;
  if (!isOwner && !auth.isSuperAdmin) {
    throw new AppError('FORBIDDEN', 'Bạn chỉ có thể chỉnh sửa đơn nghỉ phép của chính mình.', 403);
  }

  if (existing.status !== 'DRAFT') {
    throw new AppError(
      'INVALID_LEAVE_STATUS',
      'Chỉ có thể chỉnh sửa đơn nghỉ phép khi đang ở trạng thái Nháp (DRAFT).',
      409,
    );
  }

  const nextLeaveTypeId = input.leaveTypeId ?? Number(existing.leave_type_id);
  const leaveType = await db
    .selectFrom('leave_types')
    .select(['id', 'is_active'])
    .where('id', '=', nextLeaveTypeId)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (!leaveType || Number(leaveType.is_active) !== 1) {
    throw new AppError('LEAVE_TYPE_NOT_FOUND', 'Loại nghỉ phép không tồn tại hoặc ngưng áp dụng.', 404);
  }

  const nextStartDate = input.startDate ?? toIsoDate(existing.start_date);
  const nextEndDate = input.endDate ?? toIsoDate(existing.end_date);
  const nextStartSession = input.startSession ?? existing.start_session;
  const nextEndSession = input.endSession ?? existing.end_session;

  const totalDays = calculateLeaveDays({
    startDate: nextStartDate,
    endDate: nextEndDate,
    startSession: nextStartSession,
    endSession: nextEndSession,
  });

  if (totalDays <= 0) {
    throw new AppError(
      'ZERO_LEAVE_DAYS',
      'Khoảng ngày nghỉ chọn toàn bộ rơi vào cuối tuần. Vui lòng chọn lại.',
      400,
    );
  }

  await db.transaction().execute(async (trx) => {
    await checkOverlapInTrx(
      trx,
      Number(existing.employee_id),
      {
        startDate: nextStartDate,
        endDate: nextEndDate,
        startSession: nextStartSession,
        endSession: nextEndSession,
      },
      id,
    );

    await trx
      .updateTable('leave_requests')
      .set({
        leave_type_id: nextLeaveTypeId,
        start_date: nextStartDate,
        end_date: nextEndDate,
        start_session: nextStartSession,
        end_session: nextEndSession,
        total_days: totalDays,
        reason: input.reason !== undefined ? input.reason.trim() : existing.reason,
        attachment_url:
          input.attachmentUrl !== undefined
            ? input.attachmentUrl?.trim() || null
            : existing.attachment_url,
        updated_by: auth.userId,
      })
      .where('id', '=', id)
      .execute();
  });

  const updated = await fetchLeaveRequestByIdInternal(id);
  if (!updated) {
    throw new AppError('INTERNAL_ERROR', 'Không thể đọc lại đơn sau khi cập nhật.', 500);
  }

  await recordAuditLog({
    userId: auth.userId,
    moduleCode: 'hrm',
    action: 'LEAVE_REQUEST_UPDATE',
    entityType: 'leave_requests',
    entityId: id,
    newValues: {
      startDate: updated.startDate,
      endDate: updated.endDate,
      totalDays: updated.totalDays,
    },
    ipAddress,
  });

  return updated;
}

export async function submitLeaveRequest(
  id: number,
  auth: AuthContext,
  ipAddress: string | null,
): Promise<LeaveRequestItem> {
  const db = getDb();

  const { approvalRequestId } = await db.transaction().execute(async (trx) => {
    const row = await trx
      .selectFrom('leave_requests as lr')
      .innerJoin('employees as e', 'e.id', 'lr.employee_id')
      .innerJoin('leave_types as lt', 'lt.id', 'lr.leave_type_id')
      .select([
        'lr.id',
        'lr.request_code',
        'lr.employee_id',
        'e.user_id',
        'e.full_name as employee_name',
        'e.branch_id',
        'e.manager_id',
        'lr.leave_type_id',
        'lt.name as leave_type_name',
        'lt.default_days_per_year',
        'lt.requires_attachment',
        'lr.start_date',
        'lr.end_date',
        'lr.start_session',
        'lr.end_session',
        'lr.total_days',
        'lr.reason',
        'lr.attachment_url',
        'lr.status',
      ])
      .where('lr.id', '=', id)
      .where('lr.deleted_at', 'is', null)
      .forUpdate()
      .executeTakeFirst();

    if (!row) {
      throw new AppError('LEAVE_REQUEST_NOT_FOUND', 'Không tìm thấy đơn nghỉ phép.', 404);
    }

    const isOwner = row.user_id !== null && Number(row.user_id) === auth.userId;
    if (!isOwner && !auth.isSuperAdmin) {
      throw new AppError('FORBIDDEN', 'Bạn không có quyền gửi duyệt đơn nghỉ phép này.', 403);
    }

    if (row.status !== 'DRAFT') {
      throw new AppError(
        'INVALID_LEAVE_STATUS',
        'Chỉ có thể gửi duyệt đơn đang ở trạng thái Nháp (DRAFT).',
        409,
      );
    }

    return lockBalanceAndSubmitApprovalInTrx(trx, {
      leaveRequestId: Number(row.id),
      requestCode: row.request_code,
      employeeId: Number(row.employee_id),
      employeeName: row.employee_name,
      branchId: Number(row.branch_id),
      managerId: row.manager_id !== null ? Number(row.manager_id) : null,
      leaveTypeId: Number(row.leave_type_id),
      leaveTypeName: row.leave_type_name,
      defaultDaysPerYear: Number(row.default_days_per_year),
      requiresAttachment: Number(row.requires_attachment) === 1,
      attachmentUrl: row.attachment_url,
      startDate: toIsoDate(row.start_date),
      endDate: toIsoDate(row.end_date),
      startSession: row.start_session,
      endSession: row.end_session,
      totalDays: Number(row.total_days),
      reason: row.reason,
      requesterUserId: auth.userId,
    });
  });

  await notifyApprovalRequestCreated(approvalRequestId);

  const updated = await fetchLeaveRequestByIdInternal(id);
  if (!updated) {
    throw new AppError('INTERNAL_ERROR', 'Không thể đọc lại đơn sau khi gửi duyệt.', 500);
  }

  await recordAuditLog({
    userId: auth.userId,
    moduleCode: 'hrm',
    action: 'LEAVE_REQUEST_SUBMIT',
    entityType: 'leave_requests',
    entityId: id,
    newValues: { status: updated.status, approvalRequestId },
    ipAddress,
  });

  return updated;
}

export async function cancelLeaveRequest(
  id: number,
  comment: string | null | undefined,
  auth: AuthContext,
  ipAddress: string | null,
): Promise<LeaveRequestItem> {
  const db = getDb();
  const row = await db
    .selectFrom('leave_requests as lr')
    .innerJoin('employees as e', 'e.id', 'lr.employee_id')
    .select([
      'lr.id',
      'lr.status',
      'lr.approval_request_id',
      'e.user_id',
    ])
    .where('lr.id', '=', id)
    .where('lr.deleted_at', 'is', null)
    .executeTakeFirst();

  if (!row) {
    throw new AppError('LEAVE_REQUEST_NOT_FOUND', 'Không tìm thấy đơn nghỉ phép.', 404);
  }

  const isOwner = row.user_id !== null && Number(row.user_id) === auth.userId;
  if (!isOwner && !auth.isSuperAdmin) {
    throw new AppError('FORBIDDEN', 'Bạn không có quyền hủy đơn nghỉ phép này.', 403);
  }

  if (row.status === 'DRAFT') {
    await db
      .updateTable('leave_requests')
      .set({ status: 'CANCELLED', updated_by: auth.userId })
      .where('id', '=', id)
      .execute();
  } else if (row.status === 'PENDING' && row.approval_request_id !== null) {
    await actOnApprovalRequest(
      Number(row.approval_request_id),
      auth,
      'CANCEL',
      comment ?? 'Người gửi tự hủy đơn nghỉ phép',
      ipAddress,
    );
  } else {
    throw new AppError(
      'INVALID_LEAVE_STATUS',
      'Không thể hủy đơn nghỉ phép đã được phê duyệt, từ chối hoặc hủy trước đó.',
      409,
    );
  }

  const updated = await fetchLeaveRequestByIdInternal(id);
  if (!updated) {
    throw new AppError('INTERNAL_ERROR', 'Không thể đọc lại đơn sau khi hủy.', 500);
  }

  await recordAuditLog({
    userId: auth.userId,
    moduleCode: 'hrm',
    action: 'LEAVE_REQUEST_CANCEL',
    entityType: 'leave_requests',
    entityId: id,
    newValues: { status: updated.status, comment: comment?.trim() || null },
    ipAddress,
  });

  return updated;
}

export async function softDeleteLeaveRequest(
  id: number,
  auth: AuthContext,
  ipAddress: string | null,
): Promise<{ id: number; deleted: true }> {
  const db = getDb();
  const row = await db
    .selectFrom('leave_requests as lr')
    .innerJoin('employees as e', 'e.id', 'lr.employee_id')
    .select(['lr.id', 'lr.request_code', 'lr.status', 'e.user_id'])
    .where('lr.id', '=', id)
    .where('lr.deleted_at', 'is', null)
    .executeTakeFirst();

  if (!row) {
    throw new AppError('LEAVE_REQUEST_NOT_FOUND', 'Không tìm thấy đơn nghỉ phép.', 404);
  }

  const isOwner = row.user_id !== null && Number(row.user_id) === auth.userId;
  if (!isOwner && !auth.isSuperAdmin) {
    throw new AppError('FORBIDDEN', 'Bạn không có quyền xóa đơn nghỉ phép này.', 403);
  }

  if (row.status !== 'DRAFT' && row.status !== 'CANCELLED') {
    throw new AppError(
      'INVALID_LEAVE_STATUS',
      'Chỉ có thể xóa đơn nghỉ phép ở trạng thái Nháp (DRAFT) hoặc Đã hủy (CANCELLED).',
      409,
    );
  }

  await db
    .updateTable('leave_requests')
    .set({ deleted_at: new Date(), updated_by: auth.userId })
    .where('id', '=', id)
    .execute();

  await recordAuditLog({
    userId: auth.userId,
    moduleCode: 'hrm',
    action: 'LEAVE_REQUEST_DELETE',
    entityType: 'leave_requests',
    entityId: id,
    oldValues: { requestCode: row.request_code, status: row.status },
    ipAddress,
  });

  return { id, deleted: true };
}

export async function exportLeaveRequestsToExcel(
  auth: AuthContext,
  query: {
    year?: string | null;
    status?: string | null;
    leaveTypeId?: string | null;
    branchId?: string | null;
    search?: string | null;
  },
): Promise<{ buffer: Buffer; filename: string }> {
  const result = await listLeaveRequests(auth, {
    ...query,
    page: '1',
    limit: '100',
  });

  const rows = result.items.map((item, idx) => ({
    stt: idx + 1,
    requestCode: item.requestCode,
    employeeCode: item.employeeCode,
    employeeName: item.employeeName,
    departmentName: item.departmentName ?? '-',
    branchName: item.branchName ?? '-',
    leaveTypeName: item.leaveTypeName,
    startDate: `${formatDateVN(item.startDate)} (${SESSION_LABELS[item.startSession]})`,
    endDate: `${formatDateVN(item.endDate)} (${SESSION_LABELS[item.endSession]})`,
    totalDays: item.totalDays,
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
      { header: 'Chi nhánh', key: 'branchName', width: 20 },
      { header: 'Loại phép', key: 'leaveTypeName', width: 20 },
      { header: 'Từ ngày', key: 'startDate', width: 22 },
      { header: 'Đến ngày', key: 'endDate', width: 22 },
      { header: 'Số ngày', key: 'totalDays', width: 10, align: 'right', numFmt: '0.00' },
      { header: 'Trạng thái', key: 'status', width: 14, align: 'center' },
      { header: 'Lý do', key: 'reason', width: 34 },
    ],
    {
      sheetName: 'Don_Nghi_Phep',
      title: 'DANH SÁCH ĐƠN NGHỈ PHÉP — OPERON HUB',
      subtitle: `Ngày xuất: ${formatDateVN(new Date())} | Tổng số đơn: ${rows.length}`,
    },
  );

  const dateStamp = dayjs().format('YYYY-MM-DD');
  return {
    buffer,
    filename: `don-nghi-phep-${dateStamp}.xlsx`,
  };
}
