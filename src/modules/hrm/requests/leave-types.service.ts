import { getDb } from '@/config/database';
import { recordAuditLog } from '@/modules/audit/audit.service';
import type { AuthContext } from '@/modules/auth/auth.service';
import type {
  CreateLeaveTypeInput,
  UpdateLeaveTypeInput,
} from '@/modules/hrm/requests/leaves.schema';
import { AppError } from '@/shared/api-response';

export interface LeaveTypeItem {
  id: number;
  code: string;
  name: string;
  isPaid: boolean;
  defaultDaysPerYear: number;
  allowCarryOver: boolean;
  maxCarryOverDays: number;
  requiresAttachment: boolean;
  description: string | null;
  isActive: boolean;
  tracksBalance: boolean;
}

function mapLeaveTypeRow(row: {
  id: number;
  code: string;
  name: string;
  is_paid: number;
  default_days_per_year: string | number;
  allow_carry_over: number;
  max_carry_over_days: string | number;
  requires_attachment: number;
  description: string | null;
  is_active: number;
}): LeaveTypeItem {
  const defaultDays = Number(row.default_days_per_year);
  return {
    id: Number(row.id),
    code: row.code,
    name: row.name,
    isPaid: Number(row.is_paid) === 1,
    defaultDaysPerYear: defaultDays,
    allowCarryOver: Number(row.allow_carry_over) === 1,
    maxCarryOverDays: Number(row.max_carry_over_days),
    requiresAttachment: Number(row.requires_attachment) === 1,
    description: row.description,
    isActive: Number(row.is_active) === 1,
    tracksBalance: defaultDays > 0,
  };
}

export async function listLeaveTypes(options: {
  activeOnly?: boolean;
} = {}): Promise<LeaveTypeItem[]> {
  const db = getDb();
  let query = db
    .selectFrom('leave_types')
    .select([
      'id',
      'code',
      'name',
      'is_paid',
      'default_days_per_year',
      'allow_carry_over',
      'max_carry_over_days',
      'requires_attachment',
      'description',
      'is_active',
    ])
    .where('deleted_at', 'is', null);

  if (options.activeOnly) {
    query = query.where('is_active', '=', 1);
  }

  const rows = await query.orderBy('is_active', 'desc').orderBy('id', 'asc').execute();
  return rows.map(mapLeaveTypeRow);
}

export async function createLeaveType(
  input: CreateLeaveTypeInput,
  actor: AuthContext,
  ipAddress: string | null,
): Promise<LeaveTypeItem> {
  const db = getDb();
  const normalizedCode = input.code.trim().toUpperCase();

  const existing = await db
    .selectFrom('leave_types')
    .select(['id'])
    .where('code', '=', normalizedCode)
    .executeTakeFirst();

  if (existing) {
    throw new AppError(
      'DUPLICATE_LEAVE_TYPE_CODE',
      `Mã loại nghỉ phép "${normalizedCode}" đã tồn tại trong hệ thống.`,
      409,
    );
  }

  const maxCarryOver = input.allowCarryOver ? input.maxCarryOverDays : 0;

  const inserted = await db
    .insertInto('leave_types')
    .values({
      code: normalizedCode,
      name: input.name.trim(),
      is_paid: input.isPaid ? 1 : 0,
      default_days_per_year: input.defaultDaysPerYear,
      allow_carry_over: input.allowCarryOver ? 1 : 0,
      max_carry_over_days: maxCarryOver,
      requires_attachment: input.requiresAttachment ? 1 : 0,
      description: input.description?.trim() || null,
      is_active: input.isActive ? 1 : 0,
      created_by: actor.userId,
      updated_by: actor.userId,
    })
    .executeTakeFirstOrThrow();

  const createdId = Number(inserted.insertId);
  const createdRow = await db
    .selectFrom('leave_types')
    .select([
      'id',
      'code',
      'name',
      'is_paid',
      'default_days_per_year',
      'allow_carry_over',
      'max_carry_over_days',
      'requires_attachment',
      'description',
      'is_active',
    ])
    .where('id', '=', createdId)
    .executeTakeFirstOrThrow();

  const result = mapLeaveTypeRow(createdRow);

  await recordAuditLog({
    userId: actor.userId,
    moduleCode: 'hrm',
    action: 'LEAVE_TYPE_CREATE',
    entityType: 'leave_types',
    entityId: createdId,
    newValues: { ...result },
    ipAddress,
  });

  return result;
}

export async function updateLeaveType(
  id: number,
  input: UpdateLeaveTypeInput,
  actor: AuthContext,
  ipAddress: string | null,
): Promise<LeaveTypeItem> {
  const db = getDb();
  const existing = await db
    .selectFrom('leave_types')
    .select([
      'id',
      'code',
      'name',
      'is_paid',
      'default_days_per_year',
      'allow_carry_over',
      'max_carry_over_days',
      'requires_attachment',
      'description',
      'is_active',
    ])
    .where('id', '=', id)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (!existing) {
    throw new AppError('LEAVE_TYPE_NOT_FOUND', 'Không tìm thấy loại nghỉ phép.', 404);
  }

  const nextAllowCarryOver =
    input.allowCarryOver !== undefined
      ? input.allowCarryOver
      : Number(existing.allow_carry_over) === 1;
  const nextMaxCarryOver = nextAllowCarryOver
    ? (input.maxCarryOverDays ?? Number(existing.max_carry_over_days))
    : 0;

  await db
    .updateTable('leave_types')
    .set({
      name: input.name !== undefined ? input.name.trim() : existing.name,
      is_paid: input.isPaid !== undefined ? (input.isPaid ? 1 : 0) : existing.is_paid,
      default_days_per_year:
        input.defaultDaysPerYear !== undefined
          ? input.defaultDaysPerYear
          : existing.default_days_per_year,
      allow_carry_over: nextAllowCarryOver ? 1 : 0,
      max_carry_over_days: nextMaxCarryOver,
      requires_attachment:
        input.requiresAttachment !== undefined
          ? input.requiresAttachment
            ? 1
            : 0
          : existing.requires_attachment,
      description:
        input.description !== undefined
          ? input.description?.trim() || null
          : existing.description,
      is_active: input.isActive !== undefined ? (input.isActive ? 1 : 0) : existing.is_active,
      updated_by: actor.userId,
    })
    .where('id', '=', id)
    .execute();

  const updatedRow = await db
    .selectFrom('leave_types')
    .select([
      'id',
      'code',
      'name',
      'is_paid',
      'default_days_per_year',
      'allow_carry_over',
      'max_carry_over_days',
      'requires_attachment',
      'description',
      'is_active',
    ])
    .where('id', '=', id)
    .executeTakeFirstOrThrow();

  const result = mapLeaveTypeRow(updatedRow);

  await recordAuditLog({
    userId: actor.userId,
    moduleCode: 'hrm',
    action: 'LEAVE_TYPE_UPDATE',
    entityType: 'leave_types',
    entityId: id,
    oldValues: { ...mapLeaveTypeRow(existing) },
    newValues: { ...result },
    ipAddress,
  });

  return result;
}

export async function softDeleteLeaveType(
  id: number,
  actor: AuthContext,
  ipAddress: string | null,
): Promise<{ id: number; deleted: true }> {
  const db = getDb();
  const existing = await db
    .selectFrom('leave_types')
    .select(['id', 'code', 'name'])
    .where('id', '=', id)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (!existing) {
    throw new AppError('LEAVE_TYPE_NOT_FOUND', 'Không tìm thấy loại nghỉ phép.', 404);
  }

  const activeUsage = await db
    .selectFrom('leave_requests')
    .select(['id'])
    .where('leave_type_id', '=', id)
    .where('status', 'in', ['PENDING', 'APPROVED'])
    .where('deleted_at', 'is', null)
    .limit(1)
    .executeTakeFirst();

  if (activeUsage) {
    throw new AppError(
      'LEAVE_TYPE_IN_USE',
      'Loại nghỉ phép này đang có đơn chờ duyệt hoặc đã duyệt. Vui lòng chuyển sang Ngưng hoạt động thay vì xóa.',
      409,
    );
  }

  await db
    .updateTable('leave_types')
    .set({
      is_active: 0,
      deleted_at: new Date(),
      updated_by: actor.userId,
    })
    .where('id', '=', id)
    .execute();

  await recordAuditLog({
    userId: actor.userId,
    moduleCode: 'hrm',
    action: 'LEAVE_TYPE_DELETE',
    entityType: 'leave_types',
    entityId: id,
    oldValues: { code: existing.code, name: existing.name },
    ipAddress,
  });

  return { id, deleted: true };
}
