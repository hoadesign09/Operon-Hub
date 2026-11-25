import dayjs from 'dayjs';
import type { Transaction } from 'kysely';
import {
  getDb,
  type DatabaseSchema,
  type LeaveRequestStatus,
} from '@/config/database';
import { formatVND, roundCurrency } from '@/lib/portable/currency-utils';
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
import { BUSINESS_TRIP_REQUEST_ENTITY_TYPE } from '@/modules/hrm/requests/ot-trip-approval-hooks';
import {
  calculateTripDays,
  doDateRangesOverlap,
} from '@/modules/hrm/requests/ot-trip-calculator';
import type {
  CreateBusinessTripRequestInput,
  UpdateBusinessTripRequestInput,
} from '@/modules/hrm/requests/ot-trip.schema';
import { AppError } from '@/shared/api-response';

export interface BusinessTripRequestItem {
  id: number;
  requestCode: string;
  employeeId: number;
  employeeCode: string;
  employeeName: string;
  branchId: number;
  branchName: string | null;
  branchNameEn?: string | null;
  departmentName: string | null;
  departmentNameEn?: string | null;
  destination: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  purpose: string;
  estimatedCost: number;
  status: LeaveRequestStatus;
  approvalRequestId: number | null;
  createdAt: string;
}

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
      'Tài khoản của bạn chưa được liên kết với hồ sơ nhân viên nên không thể tạo đơn công tác.',
      400,
    );
  }
  return emp;
}

async function checkTripOverlapInTrx(
  trx: Transaction<DatabaseSchema>,
  employeeId: number,
  startDate: string,
  endDate: string,
  excludeId?: number,
): Promise<void> {
  let query = trx
    .selectFrom('business_trip_requests')
    .select(['id', 'request_code', 'start_date', 'end_date'])
    .where('employee_id', '=', employeeId)
    .where('status', 'in', ['PENDING', 'APPROVED'])
    .where('deleted_at', 'is', null)
    .where('start_date', '<=', endDate)
    .where('end_date', '>=', startDate);

  if (excludeId) {
    query = query.where('id', '!=', excludeId);
  }

  const existing = await query.execute();
  for (const row of existing) {
    const exStart = toIsoDate(row.start_date);
    const exEnd = toIsoDate(row.end_date);
    if (doDateRangesOverlap(startDate, endDate, exStart, exEnd)) {
      throw new AppError(
        'TRIP_DATE_OVERLAP',
        `Thời gian công tác bị trùng với đơn ${row.request_code} (${formatDateVN(exStart)} – ${formatDateVN(exEnd)}).`,
        409,
      );
    }
  }
}

async function submitTripInTrx(
  trx: Transaction<DatabaseSchema>,
  params: {
    id: number;
    requestCode: string;
    employeeId: number;
    employeeName: string;
    branchId: number;
    managerId: number | null;
    destination: string;
    startDate: string;
    endDate: string;
    totalDays: number;
    estimatedCost: number;
    purpose: string;
    requesterUserId: number;
  },
): Promise<{ approvalRequestId: number }> {
  await checkTripOverlapInTrx(trx, params.employeeId, params.startDate, params.endDate, params.id);

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
      requestType: 'BUSINESS_TRIP',
      entityType: BUSINESS_TRIP_REQUEST_ENTITY_TYPE,
      entityId: params.id,
      branchId: params.branchId,
      requesterId: params.requesterUserId,
      directManagerUserId,
      title: `Đơn công tác ${params.requestCode} — ${params.employeeName} (${params.destination})`,
      summary: `${formatDateVN(params.startDate)} → ${formatDateVN(params.endDate)} (${params.totalDays} ngày) • Dự kiến: ${formatVND(params.estimatedCost)}. Mục đích: ${params.purpose}`,
      evalContext: { days: params.totalDays, amount: params.estimatedCost },
    },
    trx,
  );

  await trx
    .updateTable('business_trip_requests')
    .set({
      status: 'PENDING',
      approval_request_id: approvalRes.approvalRequestId,
      updated_by: params.requesterUserId,
    })
    .where('id', '=', params.id)
    .execute();

  return { approvalRequestId: approvalRes.approvalRequestId };
}

async function fetchTripByIdInternal(id: number): Promise<BusinessTripRequestItem | null> {
  const db = getDb();
  const row = await db
    .selectFrom('business_trip_requests as bt')
    .innerJoin('employees as e', 'e.id', 'bt.employee_id')
    .leftJoin('branches as b', 'b.id', 'e.branch_id')
    .leftJoin('departments as d', 'd.id', 'e.department_id')
    .select([
      'bt.id',
      'bt.request_code',
      'bt.employee_id',
      'e.employee_code',
      'e.full_name as employee_name',
      'e.branch_id',
      'b.name as branch_name',
      'b.name_en as branch_name_en',
      'd.name as department_name',
      'd.name_en as department_name_en',
      'bt.destination',
      'bt.start_date',
      'bt.end_date',
      'bt.total_days',
      'bt.purpose',
      'bt.estimated_cost',
      'bt.status',
      'bt.approval_request_id',
      'bt.created_at',
    ])
    .where('bt.id', '=', id)
    .where('bt.deleted_at', 'is', null)
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
    branchNameEn: row.branch_name_en ?? null,
    departmentName: row.department_name ?? null,
    departmentNameEn: row.department_name_en ?? null,
    destination: row.destination,
    startDate: toIsoDate(row.start_date),
    endDate: toIsoDate(row.end_date),
    totalDays: Number(row.total_days),
    purpose: row.purpose,
    estimatedCost: Number(row.estimated_cost),
    status: row.status,
    approvalRequestId:
      row.approval_request_id !== null ? Number(row.approval_request_id) : null,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

export async function listBusinessTripRequests(
  auth: AuthContext,
  query: {
    mine?: string | null;
    year?: string | null;
    status?: string | null;
    branchId?: string | null;
    search?: string | null;
    page?: string | null;
    limit?: string | null;
  },
): Promise<{ items: BusinessTripRequestItem[]; meta: PaginationMeta }> {
  const db = getDb();
  const pagination = parsePaginationParams(
    { page: query.page, limit: query.limit },
    { defaultLimit: 20, maxLimit: 100 },
  );

  const isMine = query.mine === 'true' || query.mine === '1';

  let baseQuery = db
    .selectFrom('business_trip_requests as bt')
    .innerJoin('employees as e', 'e.id', 'bt.employee_id')
    .leftJoin('branches as b', 'b.id', 'e.branch_id')
    .leftJoin('departments as d', 'd.id', 'e.department_id')
    .where('bt.deleted_at', 'is', null)
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
    baseQuery = baseQuery.where('bt.employee_id', '=', Number(selfEmp.id));
  } else {
    if (!auth.isSuperAdmin && !auth.permissions.includes('hrm.requests.read')) {
      throw new AppError('FORBIDDEN', 'Bạn không có quyền xem danh sách đơn công tác.', 403);
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
      .where('bt.start_date', '>=', `${parsedYear}-01-01`)
      .where('bt.start_date', '<=', `${parsedYear}-12-31`);
  }

  if (
    query.status &&
    ['DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'].includes(query.status)
  ) {
    baseQuery = baseQuery.where('bt.status', '=', query.status as LeaveRequestStatus);
  }

  const branchIdNum = Number(query.branchId);
  if (Number.isInteger(branchIdNum) && branchIdNum > 0) {
    baseQuery = baseQuery.where('e.branch_id', '=', branchIdNum);
  }

  if (query.search && query.search.trim().length > 0) {
    const keyword = `%${query.search.trim()}%`;
    baseQuery = baseQuery.where((eb) =>
      eb.or([
        eb('bt.request_code', 'like', keyword),
        eb('e.employee_code', 'like', keyword),
        eb('e.full_name', 'like', keyword),
        eb('bt.destination', 'like', keyword),
        eb('bt.purpose', 'like', keyword),
      ]),
    );
  }

  const countRow = await baseQuery
    .select((eb) => eb.fn.count<number>('bt.id').as('total'))
    .executeTakeFirst();
  const total = Number(countRow?.total ?? 0);

  const rows = await baseQuery
    .select([
      'bt.id',
      'bt.request_code',
      'bt.employee_id',
      'e.employee_code',
      'e.full_name as employee_name',
      'e.branch_id',
      'b.name as branch_name',
      'b.name_en as branch_name_en',
      'd.name as department_name',
      'd.name_en as department_name_en',
      'bt.destination',
      'bt.start_date',
      'bt.end_date',
      'bt.total_days',
      'bt.purpose',
      'bt.estimated_cost',
      'bt.status',
      'bt.approval_request_id',
      'bt.created_at',
    ])
    .orderBy('bt.start_date', 'desc')
    .orderBy('bt.id', 'desc')
    .limit(pagination.limit)
    .offset(pagination.offset)
    .execute();

  const items: BusinessTripRequestItem[] = rows.map((row) => ({
    id: Number(row.id),
    requestCode: row.request_code,
    employeeId: Number(row.employee_id),
    employeeCode: row.employee_code,
    employeeName: row.employee_name,
    branchId: Number(row.branch_id),
    branchName: row.branch_name ?? null,
    branchNameEn: row.branch_name_en ?? null,
    departmentName: row.department_name ?? null,
    departmentNameEn: row.department_name_en ?? null,
    destination: row.destination,
    startDate: toIsoDate(row.start_date),
    endDate: toIsoDate(row.end_date),
    totalDays: Number(row.total_days),
    purpose: row.purpose,
    estimatedCost: Number(row.estimated_cost),
    status: row.status,
    approvalRequestId:
      row.approval_request_id !== null ? Number(row.approval_request_id) : null,
    createdAt: new Date(row.created_at).toISOString(),
  }));

  return { items, meta: buildPaginationMeta(total, pagination.page, pagination.limit) };
}

export async function getBusinessTripRequestDetail(
  id: number,
  auth: AuthContext,
): Promise<BusinessTripRequestItem> {
  const db = getDb();
  const item = await fetchTripByIdInternal(id);
  if (!item) {
    throw new AppError('TRIP_REQUEST_NOT_FOUND', 'Không tìm thấy đơn công tác.', 404);
  }

  const empRow = await db
    .selectFrom('employees')
    .select(['id', 'branch_id', 'department_id', 'user_id'])
    .where('id', '=', item.employeeId)
    .executeTakeFirstOrThrow();

  const isOwner = empRow.user_id !== null && Number(empRow.user_id) === auth.userId;
  if (!isOwner) {
    if (!auth.isSuperAdmin && !auth.permissions.includes('hrm.requests.read')) {
      throw new AppError('FORBIDDEN', 'Bạn không có quyền xem đơn công tác này.', 403);
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
      throw new AppError('FORBIDDEN', 'Đơn công tác nằm ngoài phạm vi dữ liệu của bạn.', 403);
    }
  }

  return item;
}

export async function createBusinessTripRequest(
  input: CreateBusinessTripRequestInput,
  auth: AuthContext,
  ipAddress: string | null,
): Promise<BusinessTripRequestItem> {
  const db = getDb();
  const emp = await resolveCurrentEmployee(auth.userId);

  const totalDays = calculateTripDays(input.startDate, input.endDate);
  const estimatedCost = roundCurrency(input.estimatedCost, 2);
  const year = dayjs(input.startDate).year();
  const tempCode = `CT-${year}-TMP-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

  const { createdId, approvalRequestId } = await db.transaction().execute(async (trx) => {
    await checkTripOverlapInTrx(trx, Number(emp.id), input.startDate, input.endDate);

    const inserted = await trx
      .insertInto('business_trip_requests')
      .values({
        request_code: tempCode,
        employee_id: Number(emp.id),
        destination: input.destination.trim(),
        start_date: input.startDate,
        end_date: input.endDate,
        total_days: totalDays,
        purpose: input.purpose.trim(),
        estimated_cost: estimatedCost,
        status: 'DRAFT',
        approval_request_id: null,
        created_by: auth.userId,
        updated_by: auth.userId,
      })
      .executeTakeFirstOrThrow();

    const id = Number(inserted.insertId);
    const finalCode = `CT-${year}-${String(id).padStart(4, '0')}`;

    await trx
      .updateTable('business_trip_requests')
      .set({ request_code: finalCode })
      .where('id', '=', id)
      .execute();

    let createdApprovalId: number | null = null;
    if (input.submitNow) {
      const submitRes = await submitTripInTrx(trx, {
        id,
        requestCode: finalCode,
        employeeId: Number(emp.id),
        employeeName: emp.full_name,
        branchId: Number(emp.branch_id),
        managerId: emp.manager_id !== null ? Number(emp.manager_id) : null,
        destination: input.destination.trim(),
        startDate: input.startDate,
        endDate: input.endDate,
        totalDays,
        estimatedCost,
        purpose: input.purpose.trim(),
        requesterUserId: auth.userId,
      });
      createdApprovalId = submitRes.approvalRequestId;
    }

    return { createdId: id, approvalRequestId: createdApprovalId };
  });

  if (approvalRequestId) {
    await notifyApprovalRequestCreated(approvalRequestId);
  }

  const created = await fetchTripByIdInternal(createdId);
  if (!created) {
    throw new AppError('INTERNAL_ERROR', 'Không thể đọc lại đơn công tác vừa tạo.', 500);
  }

  await recordAuditLog({
    userId: auth.userId,
    moduleCode: 'hrm',
    action: input.submitNow ? 'BUSINESS_TRIP_SUBMIT' : 'BUSINESS_TRIP_CREATE',
    entityType: 'business_trip_requests',
    entityId: createdId,
    newValues: {
      requestCode: created.requestCode,
      destination: created.destination,
      totalDays: created.totalDays,
      estimatedCost: created.estimatedCost,
      status: created.status,
    },
    ipAddress,
  });

  return created;
}

export async function updateBusinessTripRequest(
  id: number,
  input: UpdateBusinessTripRequestInput,
  auth: AuthContext,
  ipAddress: string | null,
): Promise<BusinessTripRequestItem> {
  const db = getDb();
  const existing = await db
    .selectFrom('business_trip_requests as bt')
    .innerJoin('employees as e', 'e.id', 'bt.employee_id')
    .select([
      'bt.id',
      'bt.employee_id',
      'e.user_id',
      'bt.destination',
      'bt.start_date',
      'bt.end_date',
      'bt.purpose',
      'bt.estimated_cost',
      'bt.status',
    ])
    .where('bt.id', '=', id)
    .where('bt.deleted_at', 'is', null)
    .executeTakeFirst();

  if (!existing) {
    throw new AppError('TRIP_REQUEST_NOT_FOUND', 'Không tìm thấy đơn công tác.', 404);
  }

  const isOwner = existing.user_id !== null && Number(existing.user_id) === auth.userId;
  if (!isOwner && !auth.isSuperAdmin) {
    throw new AppError('FORBIDDEN', 'Bạn chỉ có thể sửa đơn công tác của chính mình.', 403);
  }

  if (existing.status !== 'DRAFT') {
    throw new AppError(
      'INVALID_TRIP_STATUS',
      'Chỉ có thể chỉnh sửa đơn công tác khi đang ở trạng thái Nháp (DRAFT).',
      409,
    );
  }

  const nextStartDate = input.startDate ?? toIsoDate(existing.start_date);
  const nextEndDate = input.endDate ?? toIsoDate(existing.end_date);
  const totalDays = calculateTripDays(nextStartDate, nextEndDate);
  const nextCost =
    input.estimatedCost !== undefined
      ? roundCurrency(input.estimatedCost, 2)
      : Number(existing.estimated_cost);

  await db.transaction().execute(async (trx) => {
    await checkTripOverlapInTrx(trx, Number(existing.employee_id), nextStartDate, nextEndDate, id);

    await trx
      .updateTable('business_trip_requests')
      .set({
        destination:
          input.destination !== undefined ? input.destination.trim() : existing.destination,
        start_date: nextStartDate,
        end_date: nextEndDate,
        total_days: totalDays,
        purpose: input.purpose !== undefined ? input.purpose.trim() : existing.purpose,
        estimated_cost: nextCost,
        updated_by: auth.userId,
      })
      .where('id', '=', id)
      .execute();
  });

  const updated = await fetchTripByIdInternal(id);
  if (!updated) {
    throw new AppError('INTERNAL_ERROR', 'Không thể đọc lại đơn công tác sau cập nhật.', 500);
  }

  await recordAuditLog({
    userId: auth.userId,
    moduleCode: 'hrm',
    action: 'BUSINESS_TRIP_UPDATE',
    entityType: 'business_trip_requests',
    entityId: id,
    newValues: {
      destination: updated.destination,
      totalDays: updated.totalDays,
      estimatedCost: updated.estimatedCost,
    },
    ipAddress,
  });

  return updated;
}

export async function submitBusinessTripRequest(
  id: number,
  auth: AuthContext,
  ipAddress: string | null,
): Promise<BusinessTripRequestItem> {
  const db = getDb();

  const { approvalRequestId } = await db.transaction().execute(async (trx) => {
    const row = await trx
      .selectFrom('business_trip_requests as bt')
      .innerJoin('employees as e', 'e.id', 'bt.employee_id')
      .select([
        'bt.id',
        'bt.request_code',
        'bt.employee_id',
        'e.user_id',
        'e.full_name as employee_name',
        'e.branch_id',
        'e.manager_id',
        'bt.destination',
        'bt.start_date',
        'bt.end_date',
        'bt.total_days',
        'bt.estimated_cost',
        'bt.purpose',
        'bt.status',
      ])
      .where('bt.id', '=', id)
      .where('bt.deleted_at', 'is', null)
      .forUpdate()
      .executeTakeFirst();

    if (!row) {
      throw new AppError('TRIP_REQUEST_NOT_FOUND', 'Không tìm thấy đơn công tác.', 404);
    }

    const isOwner = row.user_id !== null && Number(row.user_id) === auth.userId;
    if (!isOwner && !auth.isSuperAdmin) {
      throw new AppError('FORBIDDEN', 'Bạn không có quyền gửi duyệt đơn công tác này.', 403);
    }

    if (row.status !== 'DRAFT') {
      throw new AppError('INVALID_TRIP_STATUS', 'Chỉ có thể gửi duyệt đơn ở trạng thái Nháp.', 409);
    }

    return submitTripInTrx(trx, {
      id: Number(row.id),
      requestCode: row.request_code,
      employeeId: Number(row.employee_id),
      employeeName: row.employee_name,
      branchId: Number(row.branch_id),
      managerId: row.manager_id !== null ? Number(row.manager_id) : null,
      destination: row.destination,
      startDate: toIsoDate(row.start_date),
      endDate: toIsoDate(row.end_date),
      totalDays: Number(row.total_days),
      estimatedCost: Number(row.estimated_cost),
      purpose: row.purpose,
      requesterUserId: auth.userId,
    });
  });

  await notifyApprovalRequestCreated(approvalRequestId);

  const updated = await fetchTripByIdInternal(id);
  if (!updated) {
    throw new AppError('INTERNAL_ERROR', 'Không thể đọc lại đơn công tác sau khi gửi.', 500);
  }

  await recordAuditLog({
    userId: auth.userId,
    moduleCode: 'hrm',
    action: 'BUSINESS_TRIP_SUBMIT',
    entityType: 'business_trip_requests',
    entityId: id,
    newValues: { status: updated.status, approvalRequestId },
    ipAddress,
  });

  return updated;
}

export async function cancelBusinessTripRequest(
  id: number,
  comment: string | null | undefined,
  auth: AuthContext,
  ipAddress: string | null,
): Promise<BusinessTripRequestItem> {
  const db = getDb();
  const row = await db
    .selectFrom('business_trip_requests as bt')
    .innerJoin('employees as e', 'e.id', 'bt.employee_id')
    .select(['bt.id', 'bt.status', 'bt.approval_request_id', 'e.user_id'])
    .where('bt.id', '=', id)
    .where('bt.deleted_at', 'is', null)
    .executeTakeFirst();

  if (!row) {
    throw new AppError('TRIP_REQUEST_NOT_FOUND', 'Không tìm thấy đơn công tác.', 404);
  }

  const isOwner = row.user_id !== null && Number(row.user_id) === auth.userId;
  if (!isOwner && !auth.isSuperAdmin) {
    throw new AppError('FORBIDDEN', 'Bạn không có quyền hủy đơn công tác này.', 403);
  }

  if (row.status === 'DRAFT') {
    await db
      .updateTable('business_trip_requests')
      .set({ status: 'CANCELLED', updated_by: auth.userId })
      .where('id', '=', id)
      .execute();
  } else if (row.status === 'PENDING' && row.approval_request_id !== null) {
    await actOnApprovalRequest(
      Number(row.approval_request_id),
      auth,
      'CANCEL',
      comment ?? 'Người gửi tự hủy đơn công tác',
      ipAddress,
    );
  } else {
    throw new AppError(
      'INVALID_TRIP_STATUS',
      'Không thể hủy đơn công tác đã hoàn tất hoặc đã hủy trước đó.',
      409,
    );
  }

  const updated = await fetchTripByIdInternal(id);
  if (!updated) {
    throw new AppError('INTERNAL_ERROR', 'Không thể đọc lại đơn công tác sau khi hủy.', 500);
  }

  await recordAuditLog({
    userId: auth.userId,
    moduleCode: 'hrm',
    action: 'BUSINESS_TRIP_CANCEL',
    entityType: 'business_trip_requests',
    entityId: id,
    newValues: { status: updated.status, comment: comment?.trim() || null },
    ipAddress,
  });

  return updated;
}

export async function softDeleteBusinessTripRequest(
  id: number,
  auth: AuthContext,
  ipAddress: string | null,
): Promise<{ id: number; deleted: true }> {
  const db = getDb();
  const row = await db
    .selectFrom('business_trip_requests as bt')
    .innerJoin('employees as e', 'e.id', 'bt.employee_id')
    .select(['bt.id', 'bt.request_code', 'bt.status', 'e.user_id'])
    .where('bt.id', '=', id)
    .where('bt.deleted_at', 'is', null)
    .executeTakeFirst();

  if (!row) {
    throw new AppError('TRIP_REQUEST_NOT_FOUND', 'Không tìm thấy đơn công tác.', 404);
  }

  const isOwner = row.user_id !== null && Number(row.user_id) === auth.userId;
  if (!isOwner && !auth.isSuperAdmin) {
    throw new AppError('FORBIDDEN', 'Bạn không có quyền xóa đơn công tác này.', 403);
  }

  if (row.status !== 'DRAFT' && row.status !== 'CANCELLED') {
    throw new AppError(
      'INVALID_TRIP_STATUS',
      'Chỉ có thể xóa đơn công tác ở trạng thái Nháp hoặc Đã hủy.',
      409,
    );
  }

  await db
    .updateTable('business_trip_requests')
    .set({ deleted_at: new Date(), updated_by: auth.userId })
    .where('id', '=', id)
    .execute();

  await recordAuditLog({
    userId: auth.userId,
    moduleCode: 'hrm',
    action: 'BUSINESS_TRIP_DELETE',
    entityType: 'business_trip_requests',
    entityId: id,
    oldValues: { requestCode: row.request_code, status: row.status },
    ipAddress,
  });

  return { id, deleted: true };
}

export async function exportBusinessTripRequestsToExcel(
  auth: AuthContext,
  query: {
    year?: string | null;
    status?: string | null;
    branchId?: string | null;
    search?: string | null;
  },
): Promise<{ buffer: Buffer; filename: string }> {
  const result = await listBusinessTripRequests(auth, { ...query, page: '1', limit: '100' });

  const rows = result.items.map((item, idx) => ({
    stt: idx + 1,
    requestCode: item.requestCode,
    employeeCode: item.employeeCode,
    employeeName: item.employeeName,
    departmentName: item.departmentName ?? '-',
    destination: item.destination,
    startDate: formatDateVN(item.startDate),
    endDate: formatDateVN(item.endDate),
    totalDays: item.totalDays,
    estimatedCost: item.estimatedCost,
    status: STATUS_LABELS[item.status],
    purpose: item.purpose,
  }));

  const buffer = await buildExcelBuffer(
    rows,
    [
      { header: 'STT', key: 'stt', width: 6, align: 'center' },
      { header: 'Mã đơn', key: 'requestCode', width: 16 },
      { header: 'Mã NV', key: 'employeeCode', width: 12 },
      { header: 'Họ và tên', key: 'employeeName', width: 24 },
      { header: 'Phòng ban', key: 'departmentName', width: 24 },
      { header: 'Địa điểm công tác', key: 'destination', width: 28 },
      { header: 'Từ ngày', key: 'startDate', width: 14, align: 'center' },
      { header: 'Đến ngày', key: 'endDate', width: 14, align: 'center' },
      { header: 'Số ngày', key: 'totalDays', width: 10, align: 'right', numFmt: '0.00' },
      { header: 'Chi phí dự kiến', key: 'estimatedCost', width: 18, align: 'right', numFmt: '#,##0' },
      { header: 'Trạng thái', key: 'status', width: 14, align: 'center' },
      { header: 'Mục đích', key: 'purpose', width: 34 },
    ],
    {
      sheetName: 'Don_Cong_Tac',
      title: 'DANH SÁCH ĐƠN CÔNG TÁC — OPERON HUB',
      subtitle: `Ngày xuất: ${formatDateVN(new Date())} | Tổng số đơn: ${rows.length}`,
    },
  );

  return {
    buffer,
    filename: `don-cong-tac-${dayjs().format('YYYY-MM-DD')}.xlsx`,
  };
}
