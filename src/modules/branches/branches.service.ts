import { getDb } from '@/config/database';
import {
  buildPaginationMeta,
  parsePaginationParams,
  type PaginationMeta,
} from '@/lib/portable/pagination';
import { recordAuditLog } from '@/modules/audit/audit.service';
import type { CreateBranchInput, UpdateBranchInput } from '@/modules/branches/branches.schema';
import { AppError } from '@/shared/api-response';

export interface BranchItem {
  id: number;
  code: string;
  name: string;
  nameEn: string | null;
  taxCode: string | null;
  address: string | null;
  phone: string | null;
  isHeadquarters: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

function mapBranchRow(row: {
  id: number;
  code: string;
  name: string;
  name_en: string | null;
  tax_code: string | null;
  address: string | null;
  phone: string | null;
  is_headquarters: number;
  is_active: number;
  created_at: Date;
  updated_at: Date;
}): BranchItem {
  return {
    id: Number(row.id),
    code: row.code,
    name: row.name,
    nameEn: row.name_en ?? null,
    taxCode: row.tax_code,
    address: row.address,
    phone: row.phone,
    isHeadquarters: Boolean(row.is_headquarters),
    isActive: Boolean(row.is_active),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export async function listBranches(query: {
  page?: string | null;
  limit?: string | null;
  search?: string | null;
  isActive?: string | null;
}): Promise<{ items: BranchItem[]; meta: PaginationMeta }> {
  const db = getDb();
  const pagination = parsePaginationParams(
    { page: query.page, limit: query.limit },
    { defaultLimit: 20, maxLimit: 100 },
  );

  let baseQuery = db.selectFrom('branches').where('deleted_at', 'is', null);

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
    .select([
      'id',
      'code',
      'name',
      'name_en',
      'tax_code',
      'address',
      'phone',
      'is_headquarters',
      'is_active',
      'created_at',
      'updated_at',
    ])
    .orderBy('is_headquarters', 'desc')
    .orderBy('name', 'asc')
    .limit(pagination.limit)
    .offset(pagination.offset)
    .execute();

  return {
    items: rows.map(mapBranchRow),
    meta: buildPaginationMeta(total, pagination.page, pagination.limit),
  };
}

export async function createBranch(
  input: CreateBranchInput,
  actorId: number,
  ipAddress: string | null,
): Promise<BranchItem> {
  const db = getDb();

  const existing = await db
    .selectFrom('branches')
    .select(['id'])
    .where('code', '=', input.code)
    .executeTakeFirst();

  if (existing) {
    throw new AppError('BRANCH_CODE_EXISTS', `Mã chi nhánh "${input.code}" đã tồn tại.`, 409);
  }

  const createdId = await db.transaction().execute(async (trx) => {
    if (input.isHeadquarters) {
      await trx
        .updateTable('branches')
        .set({ is_headquarters: 0, updated_by: actorId })
        .where('is_headquarters', '=', 1)
        .execute();
    }

    const result = await trx
      .insertInto('branches')
      .values({
        code: input.code,
        name: input.name,
        name_en: input.nameEn?.trim() || null,
        tax_code: input.taxCode ?? null,
        address: input.address ?? null,
        phone: input.phone ?? null,
        is_headquarters: input.isHeadquarters ? 1 : 0,
        is_active: input.isActive ? 1 : 0,
        created_by: actorId,
        updated_by: actorId,
      })
      .executeTakeFirstOrThrow();

    return Number(result.insertId);
  });

  const row = await db
    .selectFrom('branches')
    .select([
      'id',
      'code',
      'name',
      'name_en',
      'tax_code',
      'address',
      'phone',
      'is_headquarters',
      'is_active',
      'created_at',
      'updated_at',
    ])
    .where('id', '=', createdId)
    .executeTakeFirstOrThrow();

  const item = mapBranchRow(row);
  await recordAuditLog({
    userId: actorId,
    moduleCode: 'core',
    action: 'BRANCH_CREATE',
    entityType: 'branches',
    entityId: item.id,
    newValues: { code: item.code, name: item.name, isHeadquarters: item.isHeadquarters },
    ipAddress,
  });

  return item;
}

export async function updateBranch(
  branchId: number,
  input: UpdateBranchInput,
  actorId: number,
  ipAddress: string | null,
): Promise<BranchItem> {
  const db = getDb();

  const existing = await db
    .selectFrom('branches')
    .select([
      'id',
      'code',
      'name',
      'name_en',
      'tax_code',
      'address',
      'phone',
      'is_headquarters',
      'is_active',
    ])
    .where('id', '=', branchId)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (!existing) {
    throw new AppError('BRANCH_NOT_FOUND', 'Không tìm thấy chi nhánh.', 404);
  }

  if (input.code && input.code !== existing.code) {
    const duplicate = await db
      .selectFrom('branches')
      .select(['id'])
      .where('code', '=', input.code)
      .where('id', '!=', branchId)
      .executeTakeFirst();
    if (duplicate) {
      throw new AppError('BRANCH_CODE_EXISTS', `Mã chi nhánh "${input.code}" đã tồn tại.`, 409);
    }
  }

  if (existing.is_headquarters === 1 && input.isHeadquarters === false) {
    throw new AppError(
      'CANNOT_UNSET_HEADQUARTERS',
      'Không thể bỏ cờ trụ sở chính trực tiếp. Hãy chọn chi nhánh khác làm trụ sở chính.',
      400,
    );
  }

  await db.transaction().execute(async (trx) => {
    if (input.isHeadquarters === true && existing.is_headquarters !== 1) {
      await trx
        .updateTable('branches')
        .set({ is_headquarters: 0, updated_by: actorId })
        .where('is_headquarters', '=', 1)
        .execute();
    }

    await trx
      .updateTable('branches')
      .set({
        code: input.code ?? existing.code,
        name: input.name ?? existing.name,
        name_en: input.nameEn !== undefined ? input.nameEn?.trim() || null : existing.name_en,
        tax_code: input.taxCode !== undefined ? input.taxCode : existing.tax_code,
        address: input.address !== undefined ? input.address : existing.address,
        phone: input.phone !== undefined ? input.phone : existing.phone,
        is_headquarters:
          input.isHeadquarters !== undefined
            ? input.isHeadquarters
              ? 1
              : 0
            : existing.is_headquarters,
        is_active:
          input.isActive !== undefined ? (input.isActive ? 1 : 0) : existing.is_active,
        updated_by: actorId,
      })
      .where('id', '=', branchId)
      .execute();
  });

  const updated = await db
    .selectFrom('branches')
    .select([
      'id',
      'code',
      'name',
      'name_en',
      'tax_code',
      'address',
      'phone',
      'is_headquarters',
      'is_active',
      'created_at',
      'updated_at',
    ])
    .where('id', '=', branchId)
    .executeTakeFirstOrThrow();

  const item = mapBranchRow(updated);
  await recordAuditLog({
    userId: actorId,
    moduleCode: 'core',
    action: 'BRANCH_UPDATE',
    entityType: 'branches',
    entityId: item.id,
    oldValues: { code: existing.code, name: existing.name, isActive: Boolean(existing.is_active) },
    newValues: { code: item.code, name: item.name, isActive: item.isActive },
    ipAddress,
  });

  return item;
}

export async function softDeleteBranch(
  branchId: number,
  actorId: number,
  ipAddress: string | null,
): Promise<void> {
  const db = getDb();

  const existing = await db
    .selectFrom('branches')
    .select(['id', 'code', 'name', 'is_headquarters'])
    .where('id', '=', branchId)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (!existing) {
    throw new AppError('BRANCH_NOT_FOUND', 'Không tìm thấy chi nhánh.', 404);
  }

  if (existing.is_headquarters === 1) {
    throw new AppError(
      'CANNOT_DELETE_HEADQUARTERS',
      'Không thể xóa chi nhánh đang là Trụ sở chính. Vui lòng chuyển trụ sở chính trước.',
      400,
    );
  }

  await db
    .updateTable('branches')
    .set({ deleted_at: new Date(), is_active: 0, updated_by: actorId })
    .where('id', '=', branchId)
    .execute();

  await recordAuditLog({
    userId: actorId,
    moduleCode: 'core',
    action: 'BRANCH_DELETE',
    entityType: 'branches',
    entityId: branchId,
    oldValues: { code: existing.code, name: existing.name },
    ipAddress,
  });
}
