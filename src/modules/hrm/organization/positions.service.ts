import { getDb } from '@/config/database';
import {
  buildPaginationMeta,
  parsePaginationParams,
  type PaginationMeta,
} from '@/lib/portable/pagination';
import { recordAuditLog } from '@/modules/audit/audit.service';
import type {
  CreatePositionInput,
  UpdatePositionInput,
} from '@/modules/hrm/organization/organization.schema';
import { AppError } from '@/shared/api-response';

export interface PositionItem {
  id: number;
  code: string;
  name: string;
  nameEn: string | null;
  level: number;
  description: string | null;
  isActive: boolean;
  createdAt: string;
}

function mapPositionRow(row: {
  id: number;
  code: string;
  name: string;
  name_en: string | null;
  level: number;
  description: string | null;
  is_active: number;
  created_at: Date;
}): PositionItem {
  return {
    id: Number(row.id),
    code: row.code,
    name: row.name,
    nameEn: row.name_en ?? null,
    level: Number(row.level),
    description: row.description,
    isActive: Boolean(row.is_active),
    createdAt: new Date(row.created_at).toISOString(),
  };
}

export async function listPositions(query: {
  page?: string | null;
  limit?: string | null;
  search?: string | null;
  isActive?: string | null;
}): Promise<{ items: PositionItem[]; meta: PaginationMeta }> {
  const db = getDb();
  const pagination = parsePaginationParams(
    { page: query.page, limit: query.limit },
    { defaultLimit: 50, maxLimit: 200 },
  );

  let baseQuery = db.selectFrom('positions').where('deleted_at', 'is', null);

  if (query.search && query.search.trim().length > 0) {
    const keyword = `%${query.search.trim()}%`;
    baseQuery = baseQuery.where((eb) =>
      eb.or([eb('code', 'like', keyword), eb('name', 'like', keyword), eb('name_en', 'like', keyword)]),
    );
  }

  if (query.isActive === 'true' || query.isActive === '1') {
    baseQuery = baseQuery.where('is_active', '=', 1);
  } else if (query.isActive === 'false' || query.isActive === '0') {
    baseQuery = baseQuery.where('is_active', '=', 0);
  }

  const countRow = await baseQuery
    .select((eb) => eb.fn.count<number>('id').as('total'))
    .executeTakeFirst();
  const total = Number(countRow?.total ?? 0);

  const rows = await baseQuery
    .select(['id', 'code', 'name', 'name_en', 'level', 'description', 'is_active', 'created_at'])
    .orderBy('level', 'desc')
    .orderBy('name', 'asc')
    .limit(pagination.limit)
    .offset(pagination.offset)
    .execute();

  return {
    items: rows.map(mapPositionRow),
    meta: buildPaginationMeta(total, pagination.page, pagination.limit),
  };
}

export async function createPosition(
  input: CreatePositionInput,
  actorId: number,
  ipAddress: string | null,
): Promise<PositionItem> {
  const db = getDb();

  const duplicate = await db
    .selectFrom('positions')
    .select(['id'])
    .where('code', '=', input.code)
    .executeTakeFirst();

  if (duplicate) {
    throw new AppError('POSITION_CODE_EXISTS', `Mã chức danh "${input.code}" đã tồn tại.`, 409);
  }

  const inserted = await db
    .insertInto('positions')
    .values({
      code: input.code,
      name: input.name,
      name_en: input.nameEn?.trim() || null,
      level: input.level,
      description: input.description ?? null,
      is_active: input.isActive ? 1 : 0,
      created_by: actorId,
      updated_by: actorId,
    })
    .executeTakeFirstOrThrow();

  const createdId = Number(inserted.insertId);
  const row = await db
    .selectFrom('positions')
    .select(['id', 'code', 'name', 'name_en', 'level', 'description', 'is_active', 'created_at'])
    .where('id', '=', createdId)
    .executeTakeFirstOrThrow();

  await recordAuditLog({
    userId: actorId,
    moduleCode: 'hrm',
    action: 'HRM_POSITION_CREATE',
    entityType: 'positions',
    entityId: createdId,
    newValues: { code: input.code, name: input.name, level: input.level },
    ipAddress,
  });

  return mapPositionRow(row);
}

export async function updatePosition(
  positionId: number,
  input: UpdatePositionInput,
  actorId: number,
  ipAddress: string | null,
): Promise<PositionItem> {
  const db = getDb();

  const existing = await db
    .selectFrom('positions')
    .select(['id', 'code', 'name', 'name_en', 'level', 'description', 'is_active'])
    .where('id', '=', positionId)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (!existing) {
    throw new AppError('POSITION_NOT_FOUND', 'Không tìm thấy chức danh.', 404);
  }

  if (input.code && input.code !== existing.code) {
    const duplicate = await db
      .selectFrom('positions')
      .select(['id'])
      .where('code', '=', input.code)
      .where('id', '!=', positionId)
      .executeTakeFirst();
    if (duplicate) {
      throw new AppError('POSITION_CODE_EXISTS', `Mã chức danh "${input.code}" đã tồn tại.`, 409);
    }
  }

  await db
    .updateTable('positions')
    .set({
      code: input.code ?? existing.code,
      name: input.name ?? existing.name,
      name_en: input.nameEn !== undefined ? input.nameEn?.trim() || null : existing.name_en,
      level: input.level ?? Number(existing.level),
      description: input.description !== undefined ? input.description : existing.description,
      is_active:
        input.isActive !== undefined ? (input.isActive ? 1 : 0) : existing.is_active,
      updated_by: actorId,
    })
    .where('id', '=', positionId)
    .execute();

  const updated = await db
    .selectFrom('positions')
    .select(['id', 'code', 'name', 'name_en', 'level', 'description', 'is_active', 'created_at'])
    .where('id', '=', positionId)
    .executeTakeFirstOrThrow();

  await recordAuditLog({
    userId: actorId,
    moduleCode: 'hrm',
    action: 'HRM_POSITION_UPDATE',
    entityType: 'positions',
    entityId: positionId,
    oldValues: { code: existing.code, name: existing.name, level: existing.level },
    newValues: { code: updated.code, name: updated.name, level: updated.level },
    ipAddress,
  });

  return mapPositionRow(updated);
}

export async function softDeletePosition(
  positionId: number,
  actorId: number,
  ipAddress: string | null,
): Promise<void> {
  const db = getDb();

  const existing = await db
    .selectFrom('positions')
    .select(['id', 'code', 'name'])
    .where('id', '=', positionId)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (!existing) {
    throw new AppError('POSITION_NOT_FOUND', 'Không tìm thấy chức danh.', 404);
  }

  await db
    .updateTable('positions')
    .set({ deleted_at: new Date(), is_active: 0, updated_by: actorId })
    .where('id', '=', positionId)
    .execute();

  await recordAuditLog({
    userId: actorId,
    moduleCode: 'hrm',
    action: 'HRM_POSITION_DELETE',
    entityType: 'positions',
    entityId: positionId,
    oldValues: { code: existing.code, name: existing.name },
    ipAddress,
  });
}
