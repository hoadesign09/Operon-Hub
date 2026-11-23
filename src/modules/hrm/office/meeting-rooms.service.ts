import { getDb, type RoomBookingStatus } from '@/config/database';
import { formatDateTimeVN } from '@/lib/portable/date-utils';
import {
  buildPaginationMeta,
  parsePaginationParams,
  type PaginationMeta,
} from '@/lib/portable/pagination';
import { recordAuditLog } from '@/modules/audit/audit.service';
import { hasRequiredPermission, type AuthContext } from '@/modules/auth/auth.service';
import { createNotification } from '@/modules/notifications/notifications.service';
import type {
  CancelRoomBookingInput,
  CreateMeetingRoomInput,
  CreateRoomBookingInput,
  UpdateMeetingRoomInput,
  UpdateRoomBookingInput,
} from '@/modules/hrm/office/meeting-rooms.schema';
import {
  formatMysqlDateTime,
  normalizeEquipmentList,
  parseEquipmentJson,
  validateBookingTimeRange,
  validateRoomCapacity,
} from '@/modules/hrm/office/room-booking-validator';
import { AppError } from '@/shared/api-response';

export interface MeetingRoomItem {
  id: number;
  branchId: number;
  branchCode: string;
  branchName: string;
  code: string;
  name: string;
  floor: string | null;
  capacity: number;
  equipment: string[];
  description: string | null;
  isActive: boolean;
  upcomingBookingsCount: number;
  createdAt: string;
}

export interface MeetingRoomStats {
  total: number;
  active: number;
  inactive: number;
  todayBookings: number;
}

export interface RoomBookingItem {
  id: number;
  roomId: number;
  roomCode: string;
  roomName: string;
  roomFloor: string | null;
  roomCapacity: number;
  branchId: number;
  branchCode: string;
  branchName: string;
  bookedByEmployeeId: number;
  bookedByEmployeeCode: string;
  bookedByEmployeeName: string;
  bookedByDepartmentName: string;
  bookedByUserId: number | null;
  title: string;
  startTime: string;
  endTime: string;
  attendeesCount: number;
  status: RoomBookingStatus;
  cancelReason: string | null;
  cancelledByName: string | null;
  cancelledAt: string | null;
  note: string | null;
  canEditOrCancel: boolean;
  createdAt: string;
}

function assertBranchAllowed(auth: AuthContext, branchId: number): void {
  if (auth.isSuperAdmin || auth.hasAllBranches) {
    return;
  }
  if (!auth.branchIds.includes(branchId)) {
    throw new AppError('FORBIDDEN_BRANCH', 'Bạn không có quyền thao tác với phòng họp thuộc chi nhánh này.', 403);
  }
}

async function resolveSelfEmployee(userId: number): Promise<{
  id: number;
  branchId: number;
  fullName: string;
} | null> {
  const db = getDb();
  const row = await db
    .selectFrom('employees')
    .select(['id', 'branch_id', 'full_name'])
    .where('user_id', '=', userId)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (!row) {
    return null;
  }
  return {
    id: Number(row.id),
    branchId: Number(row.branch_id),
    fullName: row.full_name,
  };
}

function toIsoString(val: Date | string | null | undefined): string | null {
  if (!val) {
    return null;
  }
  const d = val instanceof Date ? val : new Date(val);
  return Number.isNaN(d.getTime()) ? String(val) : d.toISOString();
}

export async function listMeetingRooms(
  auth: AuthContext,
  query: {
    branchId?: string | null;
    isActive?: string | null;
    minCapacity?: string | null;
    search?: string | null;
    page?: string | null;
    limit?: string | null;
  },
): Promise<{ items: MeetingRoomItem[]; stats: MeetingRoomStats; meta: PaginationMeta }> {
  const db = getDb();
  const pagination = parsePaginationParams(
    { page: query.page, limit: query.limit },
    { defaultLimit: 50, maxLimit: 100 },
  );

  const requestedBranchId = query.branchId ? Number(query.branchId) : null;
  if (requestedBranchId && Number.isInteger(requestedBranchId) && requestedBranchId > 0) {
    assertBranchAllowed(auth, requestedBranchId);
  }

  let baseQuery = db
    .selectFrom('meeting_rooms')
    .innerJoin('branches', 'branches.id', 'meeting_rooms.branch_id')
    .where('meeting_rooms.deleted_at', 'is', null);

  if (!auth.isSuperAdmin && !auth.hasAllBranches) {
    if (auth.branchIds.length === 0) {
      return {
        items: [],
        stats: { total: 0, active: 0, inactive: 0, todayBookings: 0 },
        meta: buildPaginationMeta(0, pagination.page, pagination.limit),
      };
    }
    baseQuery = baseQuery.where('meeting_rooms.branch_id', 'in', auth.branchIds);
  }

  if (requestedBranchId && Number.isInteger(requestedBranchId) && requestedBranchId > 0) {
    baseQuery = baseQuery.where('meeting_rooms.branch_id', '=', requestedBranchId);
  }

  if (query.isActive === 'true' || query.isActive === '1') {
    baseQuery = baseQuery.where('meeting_rooms.is_active', '=', 1);
  } else if (query.isActive === 'false' || query.isActive === '0') {
    baseQuery = baseQuery.where('meeting_rooms.is_active', '=', 0);
  }

  const minCap = query.minCapacity ? Number(query.minCapacity) : null;
  if (minCap && Number.isInteger(minCap) && minCap > 0) {
    baseQuery = baseQuery.where('meeting_rooms.capacity', '>=', minCap);
  }

  const keyword = query.search?.trim();
  if (keyword) {
    const like = `%${keyword}%`;
    baseQuery = baseQuery.where((eb) =>
      eb.or([
        eb('meeting_rooms.code', 'like', like),
        eb('meeting_rooms.name', 'like', like),
        eb('meeting_rooms.floor', 'like', like),
      ]),
    );
  }

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

  let statsRoomsQuery = db
    .selectFrom('meeting_rooms')
    .where('meeting_rooms.deleted_at', 'is', null);
  let todayBookingsQuery = db
    .selectFrom('room_bookings')
    .innerJoin('meeting_rooms', 'meeting_rooms.id', 'room_bookings.room_id')
    .where('room_bookings.deleted_at', 'is', null)
    .where('meeting_rooms.deleted_at', 'is', null)
    .where('room_bookings.status', '=', 'CONFIRMED')
    .where('room_bookings.start_time', '<=', formatMysqlDateTime(todayEnd))
    .where('room_bookings.end_time', '>=', formatMysqlDateTime(todayStart));

  if (!auth.isSuperAdmin && !auth.hasAllBranches) {
    statsRoomsQuery = statsRoomsQuery.where('meeting_rooms.branch_id', 'in', auth.branchIds);
    todayBookingsQuery = todayBookingsQuery.where('meeting_rooms.branch_id', 'in', auth.branchIds);
  }
  if (requestedBranchId && Number.isInteger(requestedBranchId) && requestedBranchId > 0) {
    statsRoomsQuery = statsRoomsQuery.where('meeting_rooms.branch_id', '=', requestedBranchId);
    todayBookingsQuery = todayBookingsQuery.where('meeting_rooms.branch_id', '=', requestedBranchId);
  }

  const [countRow, rows, allRoomStatusRows, todayCountRow] = await Promise.all([
    baseQuery.select((eb) => eb.fn.count<number>('meeting_rooms.id').as('total')).executeTakeFirst(),
    baseQuery
      .select([
        'meeting_rooms.id',
        'meeting_rooms.branch_id',
        'branches.code as branch_code',
        'branches.name as branch_name',
        'meeting_rooms.code',
        'meeting_rooms.name',
        'meeting_rooms.floor',
        'meeting_rooms.capacity',
        'meeting_rooms.equipment_json',
        'meeting_rooms.description',
        'meeting_rooms.is_active',
        'meeting_rooms.created_at',
      ])
      .orderBy('meeting_rooms.is_active', 'desc')
      .orderBy('meeting_rooms.code', 'asc')
      .limit(pagination.limit)
      .offset(pagination.offset)
      .execute(),
    statsRoomsQuery.select(['meeting_rooms.is_active']).execute(),
    todayBookingsQuery
      .select((eb) => eb.fn.count<number>('room_bookings.id').as('total'))
      .executeTakeFirst(),
  ]);

  const roomIds = rows.map((r) => Number(r.id));
  const upcomingMap = new Map<number, number>();
  if (roomIds.length > 0) {
    const upcomingRows = await db
      .selectFrom('room_bookings')
      .select(['room_id', (eb) => eb.fn.count<number>('id').as('cnt')])
      .where('room_id', 'in', roomIds)
      .where('status', '=', 'CONFIRMED')
      .where('deleted_at', 'is', null)
      .where('end_time', '>', formatMysqlDateTime(now))
      .groupBy('room_id')
      .execute();
    for (const u of upcomingRows) {
      upcomingMap.set(Number(u.room_id), Number(u.cnt));
    }
  }

  const activeCount = allRoomStatusRows.filter((r) => Number(r.is_active) === 1).length;
  const totalRooms = allRoomStatusRows.length;

  const items: MeetingRoomItem[] = rows.map((r) => ({
    id: Number(r.id),
    branchId: Number(r.branch_id),
    branchCode: r.branch_code,
    branchName: r.branch_name,
    code: r.code,
    name: r.name,
    floor: r.floor,
    capacity: Number(r.capacity),
    equipment: parseEquipmentJson(r.equipment_json),
    description: r.description,
    isActive: Number(r.is_active) === 1,
    upcomingBookingsCount: upcomingMap.get(Number(r.id)) ?? 0,
    createdAt: toIsoString(r.created_at) ?? new Date().toISOString(),
  }));

  return {
    items,
    stats: {
      total: totalRooms,
      active: activeCount,
      inactive: totalRooms - activeCount,
      todayBookings: Number(todayCountRow?.total ?? 0),
    },
    meta: buildPaginationMeta(Number(countRow?.total ?? 0), pagination.page, pagination.limit),
  };
}

export async function getMeetingRoomDetail(id: number, auth: AuthContext): Promise<MeetingRoomItem> {
  const db = getDb();
  const row = await db
    .selectFrom('meeting_rooms')
    .innerJoin('branches', 'branches.id', 'meeting_rooms.branch_id')
    .select([
      'meeting_rooms.id',
      'meeting_rooms.branch_id',
      'branches.code as branch_code',
      'branches.name as branch_name',
      'meeting_rooms.code',
      'meeting_rooms.name',
      'meeting_rooms.floor',
      'meeting_rooms.capacity',
      'meeting_rooms.equipment_json',
      'meeting_rooms.description',
      'meeting_rooms.is_active',
      'meeting_rooms.created_at',
    ])
    .where('meeting_rooms.id', '=', id)
    .where('meeting_rooms.deleted_at', 'is', null)
    .executeTakeFirst();

  if (!row) {
    throw new AppError('MEETING_ROOM_NOT_FOUND', 'Không tìm thấy phòng họp.', 404);
  }

  assertBranchAllowed(auth, Number(row.branch_id));

  const upcomingRow = await db
    .selectFrom('room_bookings')
    .select((eb) => eb.fn.count<number>('id').as('total'))
    .where('room_id', '=', id)
    .where('status', '=', 'CONFIRMED')
    .where('deleted_at', 'is', null)
    .where('end_time', '>', formatMysqlDateTime(new Date()))
    .executeTakeFirst();

  return {
    id: Number(row.id),
    branchId: Number(row.branch_id),
    branchCode: row.branch_code,
    branchName: row.branch_name,
    code: row.code,
    name: row.name,
    floor: row.floor,
    capacity: Number(row.capacity),
    equipment: parseEquipmentJson(row.equipment_json),
    description: row.description,
    isActive: Number(row.is_active) === 1,
    upcomingBookingsCount: Number(upcomingRow?.total ?? 0),
    createdAt: toIsoString(row.created_at) ?? new Date().toISOString(),
  };
}

export async function createMeetingRoom(
  input: CreateMeetingRoomInput,
  auth: AuthContext,
  ipAddress: string | null,
): Promise<MeetingRoomItem> {
  assertBranchAllowed(auth, input.branchId);
  const db = getDb();

  const branch = await db
    .selectFrom('branches')
    .select(['id'])
    .where('id', '=', input.branchId)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();
  if (!branch) {
    throw new AppError('BRANCH_NOT_FOUND', 'Chi nhánh không tồn tại.', 404);
  }

  const normalizedCode = input.code.trim().toUpperCase();
  const duplicate = await db
    .selectFrom('meeting_rooms')
    .select(['id'])
    .where('code', '=', normalizedCode)
    .executeTakeFirst();
  if (duplicate) {
    throw new AppError(
      'MEETING_ROOM_CODE_EXISTS',
      `Mã phòng họp "${normalizedCode}" đã tồn tại trong hệ thống.`,
      409,
    );
  }

  const equipment = normalizeEquipmentList(input.equipment);
  const inserted = await db
    .insertInto('meeting_rooms')
    .values({
      branch_id: input.branchId,
      code: normalizedCode,
      name: input.name.trim(),
      floor: input.floor?.trim() || null,
      capacity: input.capacity,
      equipment_json: JSON.stringify(equipment),
      description: input.description?.trim() || null,
      is_active: input.isActive ? 1 : 0,
      created_by: auth.userId,
      updated_by: auth.userId,
    })
    .executeTakeFirstOrThrow();

  const roomId = Number(inserted.insertId);
  const detail = await getMeetingRoomDetail(roomId, auth);

  await recordAuditLog({
    userId: auth.userId,
    moduleCode: 'hrm',
    action: 'MEETING_ROOM_CREATE',
    entityType: 'meeting_rooms',
    entityId: String(roomId),
    newValues: { ...detail },
    ipAddress,
  });

  return detail;
}

export async function updateMeetingRoom(
  id: number,
  input: UpdateMeetingRoomInput,
  auth: AuthContext,
  ipAddress: string | null,
): Promise<MeetingRoomItem> {
  const existing = await getMeetingRoomDetail(id, auth);
  const db = getDb();

  if (input.branchId !== undefined && input.branchId !== existing.branchId) {
    assertBranchAllowed(auth, input.branchId);
    const branch = await db
      .selectFrom('branches')
      .select(['id'])
      .where('id', '=', input.branchId)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();
    if (!branch) {
      throw new AppError('BRANCH_NOT_FOUND', 'Chi nhánh đích không tồn tại.', 404);
    }
  }

  let normalizedCode = existing.code;
  if (input.code !== undefined) {
    normalizedCode = input.code.trim().toUpperCase();
    if (normalizedCode !== existing.code) {
      const dup = await db
        .selectFrom('meeting_rooms')
        .select(['id'])
        .where('code', '=', normalizedCode)
        .where('id', '!=', id)
        .executeTakeFirst();
      if (dup) {
        throw new AppError(
          'MEETING_ROOM_CODE_EXISTS',
          `Mã phòng họp "${normalizedCode}" đã được sử dụng.`,
          409,
        );
      }
    }
  }

  await db
    .updateTable('meeting_rooms')
    .set({
      branch_id: input.branchId ?? existing.branchId,
      code: normalizedCode,
      name: input.name !== undefined ? input.name.trim() : existing.name,
      floor: input.floor !== undefined ? input.floor?.trim() || null : existing.floor,
      capacity: input.capacity ?? existing.capacity,
      equipment_json:
        input.equipment !== undefined
          ? JSON.stringify(normalizeEquipmentList(input.equipment))
          : JSON.stringify(existing.equipment),
      description:
        input.description !== undefined ? input.description?.trim() || null : existing.description,
      is_active: input.isActive !== undefined ? (input.isActive ? 1 : 0) : existing.isActive ? 1 : 0,
      updated_by: auth.userId,
    })
    .where('id', '=', id)
    .where('deleted_at', 'is', null)
    .execute();

  const updated = await getMeetingRoomDetail(id, auth);

  await recordAuditLog({
    userId: auth.userId,
    moduleCode: 'hrm',
    action: 'MEETING_ROOM_UPDATE',
    entityType: 'meeting_rooms',
    entityId: String(id),
    oldValues: { ...existing },
    newValues: { ...updated },
    ipAddress,
  });

  return updated;
}

export async function deleteMeetingRoom(
  id: number,
  auth: AuthContext,
  ipAddress: string | null,
): Promise<void> {
  const existing = await getMeetingRoomDetail(id, auth);
  const db = getDb();

  const upcoming = await db
    .selectFrom('room_bookings')
    .select((eb) => eb.fn.count<number>('id').as('total'))
    .where('room_id', '=', id)
    .where('status', '=', 'CONFIRMED')
    .where('deleted_at', 'is', null)
    .where('end_time', '>', formatMysqlDateTime(new Date()))
    .executeTakeFirst();

  const upcomingCount = Number(upcoming?.total ?? 0);
  if (upcomingCount > 0) {
    throw new AppError(
      'ROOM_HAS_UPCOMING_BOOKINGS',
      `Không thể xóa phòng họp đang có ${upcomingCount} lịch đặt sắp tới. Vui lòng hủy các lịch đó hoặc tạm ngưng hoạt động phòng.`,
      409,
    );
  }

  await db
    .updateTable('meeting_rooms')
    .set({
      deleted_at: new Date(),
      is_active: 0,
      updated_by: auth.userId,
    })
    .where('id', '=', id)
    .where('deleted_at', 'is', null)
    .execute();

  await recordAuditLog({
    userId: auth.userId,
    moduleCode: 'hrm',
    action: 'MEETING_ROOM_DELETE',
    entityType: 'meeting_rooms',
    entityId: String(id),
    oldValues: { ...existing },
    ipAddress,
  });
}

function canManageBooking(
  auth: AuthContext,
  selfEmployeeId: number | null,
  bookingOwnerEmployeeId: number,
  bookingBranchId: number,
): boolean {
  if (selfEmployeeId !== null && bookingOwnerEmployeeId === selfEmployeeId) {
    return true;
  }
  if (!hasRequiredPermission(auth, 'hrm.rooms.manage')) {
    return false;
  }
  if (auth.isSuperAdmin || auth.hasAllBranches) {
    return true;
  }
  return auth.branchIds.includes(bookingBranchId);
}

export async function listRoomBookings(
  auth: AuthContext,
  query: {
    branchId?: string | null;
    roomId?: string | null;
    status?: string | null;
    dateFrom?: string | null;
    dateTo?: string | null;
    mineOnly?: string | null;
    search?: string | null;
    page?: string | null;
    limit?: string | null;
  },
): Promise<{ items: RoomBookingItem[]; meta: PaginationMeta }> {
  const db = getDb();
  const pagination = parsePaginationParams(
    { page: query.page, limit: query.limit },
    { defaultLimit: 100, maxLimit: 300 },
  );

  const requestedBranchId = query.branchId ? Number(query.branchId) : null;
  if (requestedBranchId && Number.isInteger(requestedBranchId) && requestedBranchId > 0) {
    assertBranchAllowed(auth, requestedBranchId);
  }

  const selfEmployee = await resolveSelfEmployee(auth.userId);
  const mineOnly = query.mineOnly === 'true' || query.mineOnly === '1';

  if (mineOnly && !selfEmployee) {
    return {
      items: [],
      meta: buildPaginationMeta(0, pagination.page, pagination.limit),
    };
  }

  let baseQuery = db
    .selectFrom('room_bookings')
    .innerJoin('meeting_rooms', 'meeting_rooms.id', 'room_bookings.room_id')
    .innerJoin('branches', 'branches.id', 'meeting_rooms.branch_id')
    .innerJoin('employees', 'employees.id', 'room_bookings.booked_by_employee_id')
    .innerJoin('departments', 'departments.id', 'employees.department_id')
    .leftJoin('users as canceller', 'canceller.id', 'room_bookings.cancelled_by')
    .where('room_bookings.deleted_at', 'is', null)
    .where('meeting_rooms.deleted_at', 'is', null);

  if (!auth.isSuperAdmin && !auth.hasAllBranches) {
    if (auth.branchIds.length === 0) {
      return {
        items: [],
        meta: buildPaginationMeta(0, pagination.page, pagination.limit),
      };
    }
    baseQuery = baseQuery.where('meeting_rooms.branch_id', 'in', auth.branchIds);
  }

  if (requestedBranchId && Number.isInteger(requestedBranchId) && requestedBranchId > 0) {
    baseQuery = baseQuery.where('meeting_rooms.branch_id', '=', requestedBranchId);
  }

  const roomIdNum = query.roomId ? Number(query.roomId) : null;
  if (roomIdNum && Number.isInteger(roomIdNum) && roomIdNum > 0) {
    baseQuery = baseQuery.where('room_bookings.room_id', '=', roomIdNum);
  }

  if (query.status === 'CONFIRMED' || query.status === 'CANCELLED') {
    baseQuery = baseQuery.where('room_bookings.status', '=', query.status);
  }

  if (query.dateFrom && /^\d{4}-\d{2}-\d{2}$/.test(query.dateFrom.trim())) {
    baseQuery = baseQuery.where('room_bookings.end_time', '>=', `${query.dateFrom.trim()} 00:00:00`);
  }

  if (query.dateTo && /^\d{4}-\d{2}-\d{2}$/.test(query.dateTo.trim())) {
    baseQuery = baseQuery.where('room_bookings.start_time', '<=', `${query.dateTo.trim()} 23:59:59`);
  }

  if (mineOnly && selfEmployee) {
    baseQuery = baseQuery.where('room_bookings.booked_by_employee_id', '=', selfEmployee.id);
  }

  const keyword = query.search?.trim();
  if (keyword) {
    const like = `%${keyword}%`;
    baseQuery = baseQuery.where((eb) =>
      eb.or([
        eb('room_bookings.title', 'like', like),
        eb('meeting_rooms.name', 'like', like),
        eb('meeting_rooms.code', 'like', like),
        eb('employees.full_name', 'like', like),
      ]),
    );
  }

  const [countRow, rows] = await Promise.all([
    baseQuery.select((eb) => eb.fn.count<number>('room_bookings.id').as('total')).executeTakeFirst(),
    baseQuery
      .select([
        'room_bookings.id',
        'room_bookings.room_id',
        'meeting_rooms.code as room_code',
        'meeting_rooms.name as room_name',
        'meeting_rooms.floor as room_floor',
        'meeting_rooms.capacity as room_capacity',
        'meeting_rooms.branch_id',
        'branches.code as branch_code',
        'branches.name as branch_name',
        'room_bookings.booked_by_employee_id',
        'employees.employee_code as booked_by_employee_code',
        'employees.full_name as booked_by_employee_name',
        'employees.user_id as booked_by_user_id',
        'departments.name as booked_by_department_name',
        'room_bookings.title',
        'room_bookings.start_time',
        'room_bookings.end_time',
        'room_bookings.attendees_count',
        'room_bookings.status',
        'room_bookings.cancel_reason',
        'canceller.full_name as cancelled_by_name',
        'room_bookings.cancelled_at',
        'room_bookings.note',
        'room_bookings.created_at',
      ])
      .orderBy('room_bookings.start_time', 'asc')
      .orderBy('room_bookings.id', 'asc')
      .limit(pagination.limit)
      .offset(pagination.offset)
      .execute(),
  ]);

  const selfEmpId = selfEmployee?.id ?? null;
  const items: RoomBookingItem[] = rows.map((row) => ({
    id: Number(row.id),
    roomId: Number(row.room_id),
    roomCode: row.room_code,
    roomName: row.room_name,
    roomFloor: row.room_floor,
    roomCapacity: Number(row.room_capacity),
    branchId: Number(row.branch_id),
    branchCode: row.branch_code,
    branchName: row.branch_name,
    bookedByEmployeeId: Number(row.booked_by_employee_id),
    bookedByEmployeeCode: row.booked_by_employee_code,
    bookedByEmployeeName: row.booked_by_employee_name,
    bookedByDepartmentName: row.booked_by_department_name,
    bookedByUserId: row.booked_by_user_id !== null ? Number(row.booked_by_user_id) : null,
    title: row.title,
    startTime: toIsoString(row.start_time) ?? '',
    endTime: toIsoString(row.end_time) ?? '',
    attendeesCount: Number(row.attendees_count),
    status: row.status,
    cancelReason: row.cancel_reason,
    cancelledByName: row.cancelled_by_name,
    cancelledAt: toIsoString(row.cancelled_at),
    note: row.note,
    canEditOrCancel:
      row.status === 'CONFIRMED' &&
      canManageBooking(auth, selfEmpId, Number(row.booked_by_employee_id), Number(row.branch_id)),
    createdAt: toIsoString(row.created_at) ?? new Date().toISOString(),
  }));

  return {
    items,
    meta: buildPaginationMeta(Number(countRow?.total ?? 0), pagination.page, pagination.limit),
  };
}

export async function getRoomBookingDetail(id: number, auth: AuthContext): Promise<RoomBookingItem> {
  const db = getDb();
  const [selfEmployee, row] = await Promise.all([
    resolveSelfEmployee(auth.userId),
    db
      .selectFrom('room_bookings')
      .innerJoin('meeting_rooms', 'meeting_rooms.id', 'room_bookings.room_id')
      .innerJoin('branches', 'branches.id', 'meeting_rooms.branch_id')
      .innerJoin('employees', 'employees.id', 'room_bookings.booked_by_employee_id')
      .innerJoin('departments', 'departments.id', 'employees.department_id')
      .leftJoin('users as canceller', 'canceller.id', 'room_bookings.cancelled_by')
      .select([
        'room_bookings.id',
        'room_bookings.room_id',
        'meeting_rooms.code as room_code',
        'meeting_rooms.name as room_name',
        'meeting_rooms.floor as room_floor',
        'meeting_rooms.capacity as room_capacity',
        'meeting_rooms.branch_id',
        'branches.code as branch_code',
        'branches.name as branch_name',
        'room_bookings.booked_by_employee_id',
        'employees.employee_code as booked_by_employee_code',
        'employees.full_name as booked_by_employee_name',
        'employees.user_id as booked_by_user_id',
        'departments.name as booked_by_department_name',
        'room_bookings.title',
        'room_bookings.start_time',
        'room_bookings.end_time',
        'room_bookings.attendees_count',
        'room_bookings.status',
        'room_bookings.cancel_reason',
        'canceller.full_name as cancelled_by_name',
        'room_bookings.cancelled_at',
        'room_bookings.note',
        'room_bookings.created_at',
      ])
      .where('room_bookings.id', '=', id)
      .where('room_bookings.deleted_at', 'is', null)
      .executeTakeFirst(),
  ]);

  if (!row) {
    throw new AppError('ROOM_BOOKING_NOT_FOUND', 'Không tìm thấy lịch đặt phòng họp.', 404);
  }

  assertBranchAllowed(auth, Number(row.branch_id));

  return {
    id: Number(row.id),
    roomId: Number(row.room_id),
    roomCode: row.room_code,
    roomName: row.room_name,
    roomFloor: row.room_floor,
    roomCapacity: Number(row.room_capacity),
    branchId: Number(row.branch_id),
    branchCode: row.branch_code,
    branchName: row.branch_name,
    bookedByEmployeeId: Number(row.booked_by_employee_id),
    bookedByEmployeeCode: row.booked_by_employee_code,
    bookedByEmployeeName: row.booked_by_employee_name,
    bookedByDepartmentName: row.booked_by_department_name,
    bookedByUserId: row.booked_by_user_id !== null ? Number(row.booked_by_user_id) : null,
    title: row.title,
    startTime: toIsoString(row.start_time) ?? '',
    endTime: toIsoString(row.end_time) ?? '',
    attendeesCount: Number(row.attendees_count),
    status: row.status,
    cancelReason: row.cancel_reason,
    cancelledByName: row.cancelled_by_name,
    cancelledAt: toIsoString(row.cancelled_at),
    note: row.note,
    canEditOrCancel:
      row.status === 'CONFIRMED' &&
      canManageBooking(
        auth,
        selfEmployee?.id ?? null,
        Number(row.booked_by_employee_id),
        Number(row.branch_id),
      ),
    createdAt: toIsoString(row.created_at) ?? new Date().toISOString(),
  };
}

export async function createRoomBooking(
  input: CreateRoomBookingInput,
  auth: AuthContext,
  ipAddress: string | null,
): Promise<RoomBookingItem> {
  const { start, end } = validateBookingTimeRange(input.startTime, input.endTime);
  const db = getDb();

  let bookedByEmployeeId: number;
  if (input.bookedByEmployeeId && hasRequiredPermission(auth, 'hrm.rooms.manage')) {
    const targetEmp = await db
      .selectFrom('employees')
      .select(['id'])
      .where('id', '=', input.bookedByEmployeeId)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();
    if (!targetEmp) {
      throw new AppError('EMPLOYEE_NOT_FOUND', 'Không tìm thấy nhân viên đặt phòng.', 404);
    }
    bookedByEmployeeId = Number(targetEmp.id);
  } else {
    const selfEmp = await resolveSelfEmployee(auth.userId);
    if (!selfEmp) {
      throw new AppError(
        'EMPLOYEE_PROFILE_REQUIRED',
        'Tài khoản của bạn chưa được liên kết với hồ sơ nhân viên để đặt phòng họp.',
        400,
      );
    }
    bookedByEmployeeId = selfEmp.id;
  }

  const startSql = formatMysqlDateTime(start);
  const endSql = formatMysqlDateTime(end);

  const createdBookingId = await db.transaction().execute(async (trx) => {
    const lockedRoom = await trx
      .selectFrom('meeting_rooms')
      .select(['id', 'branch_id', 'name', 'capacity', 'is_active'])
      .where('id', '=', input.roomId)
      .where('deleted_at', 'is', null)
      .forUpdate()
      .executeTakeFirst();

    if (!lockedRoom) {
      throw new AppError('MEETING_ROOM_NOT_FOUND', 'Phòng họp không tồn tại.', 404);
    }

    assertBranchAllowed(auth, Number(lockedRoom.branch_id));

    if (Number(lockedRoom.is_active) !== 1) {
      throw new AppError(
        'ROOM_INACTIVE',
        `Phòng họp "${lockedRoom.name}" hiện đang tạm ngưng hoạt động.`,
        400,
      );
    }

    validateRoomCapacity(input.attendeesCount, Number(lockedRoom.capacity));

    const conflicts = await trx
      .selectFrom('room_bookings')
      .select(['id', 'title', 'start_time', 'end_time'])
      .where('room_id', '=', input.roomId)
      .where('status', '=', 'CONFIRMED')
      .where('deleted_at', 'is', null)
      .where('start_time', '<', endSql)
      .where('end_time', '>', startSql)
      .orderBy('start_time', 'asc')
      .execute();

    if (conflicts.length > 0) {
      const details = conflicts.map((c) => ({
        field: 'timeRange',
        message: `"${c.title}" (${formatDateTimeVN(c.start_time)} – ${formatDateTimeVN(c.end_time)})`,
      }));
      throw new AppError(
        'ROOM_BOOKING_CONFLICT',
        `Phòng "${lockedRoom.name}" đã có lịch đặt trùng trong khung giờ này. Vui lòng chọn phòng hoặc khung giờ khác.`,
        409,
        details,
      );
    }

    const inserted = await trx
      .insertInto('room_bookings')
      .values({
        room_id: input.roomId,
        booked_by_employee_id: bookedByEmployeeId,
        title: input.title.trim(),
        start_time: startSql,
        end_time: endSql,
        attendees_count: input.attendeesCount,
        status: 'CONFIRMED',
        note: input.note?.trim() || null,
        created_by: auth.userId,
        updated_by: auth.userId,
      })
      .executeTakeFirstOrThrow();

    return Number(inserted.insertId);
  });

  const detail = await getRoomBookingDetail(createdBookingId, auth);

  await recordAuditLog({
    userId: auth.userId,
    moduleCode: 'hrm',
    action: 'ROOM_BOOKING_CREATE',
    entityType: 'room_bookings',
    entityId: String(createdBookingId),
    newValues: { ...detail },
    ipAddress,
  });

  return detail;
}

export async function updateRoomBooking(
  id: number,
  input: UpdateRoomBookingInput,
  auth: AuthContext,
  ipAddress: string | null,
): Promise<RoomBookingItem> {
  const existing = await getRoomBookingDetail(id, auth);
  if (existing.status === 'CANCELLED') {
    throw new AppError('BOOKING_ALREADY_CANCELLED', 'Không thể chỉnh sửa lịch họp đã hủy.', 409);
  }
  if (!existing.canEditOrCancel) {
    throw new AppError(
      'FORBIDDEN_BOOKING_ACTION',
      'Bạn chỉ có thể chỉnh sửa lịch phòng họp do chính mình đặt.',
      403,
    );
  }

  const nextRoomId = input.roomId ?? existing.roomId;
  const nextStartRaw = input.startTime ?? existing.startTime;
  const nextEndRaw = input.endTime ?? existing.endTime;
  const nextAttendees = input.attendeesCount ?? existing.attendeesCount;

  const { start, end } = validateBookingTimeRange(nextStartRaw, nextEndRaw, { allowPast: true });
  const startSql = formatMysqlDateTime(start);
  const endSql = formatMysqlDateTime(end);
  const db = getDb();

  await db.transaction().execute(async (trx) => {
    const lockedRoom = await trx
      .selectFrom('meeting_rooms')
      .select(['id', 'branch_id', 'name', 'capacity', 'is_active'])
      .where('id', '=', nextRoomId)
      .where('deleted_at', 'is', null)
      .forUpdate()
      .executeTakeFirst();

    if (!lockedRoom) {
      throw new AppError('MEETING_ROOM_NOT_FOUND', 'Phòng họp không tồn tại.', 404);
    }

    assertBranchAllowed(auth, Number(lockedRoom.branch_id));

    if (Number(lockedRoom.is_active) !== 1) {
      throw new AppError(
        'ROOM_INACTIVE',
        `Phòng họp "${lockedRoom.name}" hiện đang tạm ngưng hoạt động.`,
        400,
      );
    }

    validateRoomCapacity(nextAttendees, Number(lockedRoom.capacity));

    const conflicts = await trx
      .selectFrom('room_bookings')
      .select(['id', 'title', 'start_time', 'end_time'])
      .where('room_id', '=', nextRoomId)
      .where('id', '!=', id)
      .where('status', '=', 'CONFIRMED')
      .where('deleted_at', 'is', null)
      .where('start_time', '<', endSql)
      .where('end_time', '>', startSql)
      .orderBy('start_time', 'asc')
      .execute();

    if (conflicts.length > 0) {
      const details = conflicts.map((c) => ({
        field: 'timeRange',
        message: `"${c.title}" (${formatDateTimeVN(c.start_time)} – ${formatDateTimeVN(c.end_time)})`,
      }));
      throw new AppError(
        'ROOM_BOOKING_CONFLICT',
        `Phòng "${lockedRoom.name}" bị trùng lịch với cuộc họp khác trong khung giờ đã chọn.`,
        409,
        details,
      );
    }

    await trx
      .updateTable('room_bookings')
      .set({
        room_id: nextRoomId,
        title: input.title !== undefined ? input.title.trim() : existing.title,
        start_time: startSql,
        end_time: endSql,
        attendees_count: nextAttendees,
        note: input.note !== undefined ? input.note?.trim() || null : existing.note,
        updated_by: auth.userId,
      })
      .where('id', '=', id)
      .where('deleted_at', 'is', null)
      .execute();
  });

  const updated = await getRoomBookingDetail(id, auth);

  await recordAuditLog({
    userId: auth.userId,
    moduleCode: 'hrm',
    action: 'ROOM_BOOKING_UPDATE',
    entityType: 'room_bookings',
    entityId: String(id),
    oldValues: { ...existing },
    newValues: { ...updated },
    ipAddress,
  });

  return updated;
}

export async function cancelRoomBooking(
  id: number,
  input: CancelRoomBookingInput,
  auth: AuthContext,
  ipAddress: string | null,
): Promise<RoomBookingItem> {
  const existing = await getRoomBookingDetail(id, auth);
  if (existing.status === 'CANCELLED') {
    throw new AppError('BOOKING_ALREADY_CANCELLED', 'Lịch họp này đã được hủy trước đó.', 409);
  }
  if (!existing.canEditOrCancel) {
    throw new AppError(
      'FORBIDDEN_BOOKING_ACTION',
      'Bạn chỉ có thể hủy lịch phòng họp do chính mình đặt.',
      403,
    );
  }

  const db = getDb();
  await db
    .updateTable('room_bookings')
    .set({
      status: 'CANCELLED',
      cancel_reason: input.cancelReason.trim(),
      cancelled_by: auth.userId,
      cancelled_at: new Date(),
      updated_by: auth.userId,
    })
    .where('id', '=', id)
    .where('deleted_at', 'is', null)
    .execute();

  const updated = await getRoomBookingDetail(id, auth);

  if (existing.bookedByUserId !== null && existing.bookedByUserId !== auth.userId) {
    await createNotification({
      userId: existing.bookedByUserId,
      moduleCode: 'hrm',
      type: 'ROOM_BOOKING_CANCELLED',
      title: `Lịch phòng họp "${existing.title}" đã bị hủy`,
      message: `${auth.fullName} đã hủy lịch đặt phòng ${existing.roomName} (${formatDateTimeVN(existing.startTime)}). Lý do: ${input.cancelReason.trim()}`,
      linkUrl: '/hrm/office/meeting-rooms',
    });
  }

  await recordAuditLog({
    userId: auth.userId,
    moduleCode: 'hrm',
    action: 'ROOM_BOOKING_CANCEL',
    entityType: 'room_bookings',
    entityId: String(id),
    oldValues: { status: existing.status },
    newValues: { status: 'CANCELLED', cancelReason: input.cancelReason.trim() },
    ipAddress,
  });

  return updated;
}
