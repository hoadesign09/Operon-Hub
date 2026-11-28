import { getDb } from '@/config/database';
import { recordAuditLog } from '@/modules/audit/audit.service';
import type { AuthContext } from '@/modules/auth/auth.service';
import { extractIsoDate } from '@/modules/hrm/attendance/attendance-calculator';
import type {
  CreateHolidayInput,
  UpdateHolidayInput,
} from '@/modules/hrm/attendance/attendance.schema';
import { AppError } from '@/shared/api-response';

export interface HolidayItem {
  id: number;
  branchId: number | null;
  branchName: string | null;
  branchNameEn: string | null;
  holidayDate: string;
  name: string;
  nameEn: string | null;
  isPaid: boolean;
  note: string | null;
}

export async function listHolidays(query: {
  year?: string | null;
  branchId?: string | null;
}): Promise<HolidayItem[]> {
  const db = getDb();
  let builder = db
    .selectFrom('holidays as h')
    .leftJoin('branches as b', 'b.id', 'h.branch_id')
    .select([
      'h.id',
      'h.branch_id',
      'b.name as branch_name',
      'b.name_en as branch_name_en',
      'h.holiday_date',
      'h.name',
      'h.name_en',
      'h.is_paid',
      'h.note',
    ])
    .where('h.deleted_at', 'is', null);

  if (query.year && /^\d{4}$/.test(query.year.trim())) {
    const year = query.year.trim();
    builder = builder
      .where('h.holiday_date', '>=', `${year}-01-01`)
      .where('h.holiday_date', '<=', `${year}-12-31`);
  }

  if (query.branchId && Number(query.branchId) > 0) {
    const bId = Number(query.branchId);
    builder = builder.where((eb) =>
      eb.or([eb('h.branch_id', 'is', null), eb('h.branch_id', '=', bId)]),
    );
  }

  const rows = await builder.orderBy('h.holiday_date', 'asc').execute();

  return rows.map((row) => ({
    id: Number(row.id),
    branchId: row.branch_id !== null ? Number(row.branch_id) : null,
    branchName: row.branch_name ? String(row.branch_name) : null,
    branchNameEn: row.branch_name_en ? String(row.branch_name_en) : null,
    holidayDate: extractIsoDate(row.holiday_date) ?? '',
    name: String(row.name),
    nameEn: row.name_en ? String(row.name_en) : null,
    isPaid: Number(row.is_paid) === 1,
    note: row.note ? String(row.note) : null,
  }));
}

async function assertNoDuplicateHoliday(
  branchId: number | null,
  holidayDate: string,
  excludeId?: number,
): Promise<void> {
  const db = getDb();
  let query = db
    .selectFrom('holidays')
    .select(['id'])
    .where('holiday_date', '=', holidayDate)
    .where('deleted_at', 'is', null);

  if (branchId === null) {
    query = query.where('branch_id', 'is', null);
  } else {
    query = query.where('branch_id', '=', branchId);
  }
  if (excludeId !== undefined) {
    query = query.where('id', '!=', excludeId);
  }

  const duplicate = await query.executeTakeFirst();
  if (duplicate) {
    throw new AppError(
      'DUPLICATE_HOLIDAY',
      `Ngày lễ ${holidayDate} đã tồn tại trong phạm vi áp dụng này.`,
      409,
    );
  }
}

function assertHolidayBranchWriteAllowed(auth: AuthContext, branchId: number | null): void {
  if (auth.isSuperAdmin || auth.hasAllBranches) {
    return;
  }
  if (branchId === null || !auth.branchIds.includes(branchId)) {
    throw new AppError(
      'FORBIDDEN',
      'Bạn chỉ được phép quản lý ngày lễ trong phạm vi chi nhánh được phân công.',
      403,
    );
  }
}

export async function createHoliday(
  input: CreateHolidayInput,
  auth: AuthContext,
  ipAddress: string | null,
): Promise<HolidayItem> {
  const db = getDb();
  const branchId = input.branchId ?? null;
  assertHolidayBranchWriteAllowed(auth, branchId);

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

  await assertNoDuplicateHoliday(branchId, input.holidayDate);

  const inserted = await db
    .insertInto('holidays')
    .values({
      branch_id: branchId,
      holiday_date: input.holidayDate,
      name: input.name,
      name_en: input.nameEn?.trim() || null,
      is_paid: input.isPaid ? 1 : 0,
      note: input.note ?? null,
      created_by: auth.userId,
      updated_by: auth.userId,
    })
    .executeTakeFirstOrThrow();

  const items = await listHolidays({ year: input.holidayDate.slice(0, 4) });
  const created = items.find((item) => item.id === Number(inserted.insertId));
  if (!created) {
    throw new AppError('INTERNAL_ERROR', 'Không thể đọc lại ngày lễ vừa tạo.', 500);
  }

  await recordAuditLog({
    userId: auth.userId,
    moduleCode: 'hrm',
    action: 'CREATE_HOLIDAY',
    entityType: 'holidays',
    entityId: String(created.id),
    newValues: { ...created },
    ipAddress,
  });

  return created;
}

export async function updateHoliday(
  id: number,
  input: UpdateHolidayInput,
  auth: AuthContext,
  ipAddress: string | null,
): Promise<HolidayItem> {
  const db = getDb();
  const current = await db
    .selectFrom('holidays')
    .select(['id', 'branch_id', 'holiday_date', 'name', 'name_en', 'is_paid', 'note'])
    .where('id', '=', id)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (!current) {
    throw new AppError('HOLIDAY_NOT_FOUND', 'Không tìm thấy ngày lễ.', 404);
  }

  const currentBranchId = current.branch_id !== null ? Number(current.branch_id) : null;
  assertHolidayBranchWriteAllowed(auth, currentBranchId);

  const nextBranchId =
    input.branchId !== undefined
      ? input.branchId
      : currentBranchId;
  assertHolidayBranchWriteAllowed(auth, nextBranchId);
  const nextDate = input.holidayDate ?? extractIsoDate(current.holiday_date) ?? '';

  await assertNoDuplicateHoliday(nextBranchId, nextDate, id);

  await db
    .updateTable('holidays')
    .set({
      branch_id: nextBranchId,
      holiday_date: nextDate,
      name: input.name ?? String(current.name),
      name_en: input.nameEn !== undefined ? input.nameEn?.trim() || null : current.name_en ?? null,
      is_paid: input.isPaid !== undefined ? (input.isPaid ? 1 : 0) : Number(current.is_paid),
      note:
        input.note !== undefined
          ? input.note
          : current.note
            ? String(current.note)
            : null,
      updated_by: auth.userId,
    })
    .where('id', '=', id)
    .execute();

  const items = await listHolidays({ year: nextDate.slice(0, 4) });
  const updated = items.find((item) => item.id === id);
  if (!updated) {
    throw new AppError('INTERNAL_ERROR', 'Không thể tải lại ngày lễ sau khi cập nhật.', 500);
  }

  await recordAuditLog({
    userId: auth.userId,
    moduleCode: 'hrm',
    action: 'UPDATE_HOLIDAY',
    entityType: 'holidays',
    entityId: String(id),
    oldValues: {
      holidayDate: extractIsoDate(current.holiday_date),
      name: String(current.name),
      isPaid: Number(current.is_paid) === 1,
    },
    newValues: { ...updated },
    ipAddress,
  });

  return updated;
}

export async function deleteHoliday(
  id: number,
  auth: AuthContext,
  ipAddress: string | null,
): Promise<{ id: number; deleted: true }> {
  const db = getDb();
  const current = await db
    .selectFrom('holidays')
    .select(['id', 'branch_id', 'holiday_date', 'name'])
    .where('id', '=', id)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (!current) {
    throw new AppError('HOLIDAY_NOT_FOUND', 'Không tìm thấy ngày lễ.', 404);
  }

  assertHolidayBranchWriteAllowed(
    auth,
    current.branch_id !== null ? Number(current.branch_id) : null,
  );

  await db
    .updateTable('holidays')
    .set({ deleted_at: new Date(), updated_by: auth.userId })
    .where('id', '=', id)
    .execute();

  await recordAuditLog({
    userId: auth.userId,
    moduleCode: 'hrm',
    action: 'DELETE_HOLIDAY',
    entityType: 'holidays',
    entityId: String(id),
    oldValues: {
      holidayDate: extractIsoDate(current.holiday_date),
      name: String(current.name),
    },
    ipAddress,
  });

  return { id, deleted: true };
}

export async function isHolidayDate(workDate: string, branchId: number): Promise<boolean> {
  const db = getDb();
  const found = await db
    .selectFrom('holidays')
    .select(['id'])
    .where('holiday_date', '=', workDate)
    .where('deleted_at', 'is', null)
    .where((eb) => eb.or([eb('branch_id', 'is', null), eb('branch_id', '=', branchId)]))
    .limit(1)
    .executeTakeFirst();

  return Boolean(found);
}
