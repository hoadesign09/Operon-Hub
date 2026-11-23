import { getDb, type UserStatus } from '@/config/database';
import { hashPassword } from '@/lib/portable/password-hasher';
import {
  buildPaginationMeta,
  parsePaginationParams,
  type PaginationMeta,
} from '@/lib/portable/pagination';
import { recordAuditLog } from '@/modules/audit/audit.service';
import type { CreateUserInput, UpdateUserInput } from '@/modules/users/users.schema';
import { AppError } from '@/shared/api-response';

export interface UserRoleAssignmentView {
  roleId: number;
  roleCode: string;
  roleName: string;
  branchId: number | null;
  branchName: string | null;
}

export interface UserItem {
  id: number;
  email: string;
  fullName: string;
  status: UserStatus;
  lastLoginAt: string | null;
  createdAt: string;
  assignments: UserRoleAssignmentView[];
}

async function fetchAssignmentsByUserIds(
  userIds: number[],
): Promise<Map<number, UserRoleAssignmentView[]>> {
  const map = new Map<number, UserRoleAssignmentView[]>();
  if (userIds.length === 0) {
    return map;
  }

  const db = getDb();
  const rows = await db
    .selectFrom('user_roles')
    .innerJoin('roles', 'roles.id', 'user_roles.role_id')
    .leftJoin('branches', 'branches.id', 'user_roles.branch_id')
    .select([
      'user_roles.user_id',
      'roles.id as role_id',
      'roles.code as role_code',
      'roles.name as role_name',
      'user_roles.branch_id',
      'branches.name as branch_name',
    ])
    .where('user_roles.user_id', 'in', userIds)
    .where('roles.deleted_at', 'is', null)
    .execute();

  for (const row of rows) {
    const uid = Number(row.user_id);
    const list = map.get(uid) ?? [];
    list.push({
      roleId: Number(row.role_id),
      roleCode: row.role_code,
      roleName: row.role_name,
      branchId: row.branch_id !== null ? Number(row.branch_id) : null,
      branchName: row.branch_name ?? null,
    });
    map.set(uid, list);
  }

  return map;
}

export async function listUsers(query: {
  page?: string | null;
  limit?: string | null;
  search?: string | null;
  status?: string | null;
}): Promise<{ items: UserItem[]; meta: PaginationMeta }> {
  const db = getDb();
  const pagination = parsePaginationParams(
    { page: query.page, limit: query.limit },
    { defaultLimit: 20, maxLimit: 100 },
  );

  let baseQuery = db.selectFrom('users').where('deleted_at', 'is', null);

  if (query.search && query.search.trim().length > 0) {
    const keyword = `%${query.search.trim()}%`;
    baseQuery = baseQuery.where((eb) =>
      eb.or([eb('email', 'like', keyword), eb('full_name', 'like', keyword)]),
    );
  }

  if (query.status === 'ACTIVE' || query.status === 'LOCKED') {
    baseQuery = baseQuery.where('status', '=', query.status);
  }

  const countRow = await baseQuery
    .select((eb) => eb.fn.count<number>('id').as('total'))
    .executeTakeFirst();
  const total = Number(countRow?.total ?? 0);

  const userRows = await baseQuery
    .select(['id', 'email', 'full_name', 'status', 'last_login_at', 'created_at'])
    .orderBy('created_at', 'desc')
    .limit(pagination.limit)
    .offset(pagination.offset)
    .execute();

  const userIds = userRows.map((u) => Number(u.id));
  const assignmentsMap = await fetchAssignmentsByUserIds(userIds);

  const items: UserItem[] = userRows.map((u) => {
    const id = Number(u.id);
    return {
      id,
      email: u.email,
      fullName: u.full_name,
      status: u.status,
      lastLoginAt: u.last_login_at ? new Date(u.last_login_at).toISOString() : null,
      createdAt: new Date(u.created_at).toISOString(),
      assignments: assignmentsMap.get(id) ?? [],
    };
  });

  return {
    items,
    meta: buildPaginationMeta(total, pagination.page, pagination.limit),
  };
}

async function validateAssignments(
  assignments: Array<{ roleId: number; branchId?: number | null }>,
): Promise<void> {
  const db = getDb();
  const uniqueRoleIds = Array.from(new Set(assignments.map((a) => a.roleId)));
  const foundRoles = await db
    .selectFrom('roles')
    .select(['id'])
    .where('id', 'in', uniqueRoleIds)
    .where('deleted_at', 'is', null)
    .execute();

  if (foundRoles.length !== uniqueRoleIds.length) {
    throw new AppError('INVALID_ROLE', 'Một hoặc nhiều vai trò được chọn không tồn tại.', 400);
  }

  const uniqueBranchIds = Array.from(
    new Set(
      assignments
        .map((a) => a.branchId)
        .filter((id): id is number => id !== null && id !== undefined),
    ),
  );

  if (uniqueBranchIds.length > 0) {
    const foundBranches = await db
      .selectFrom('branches')
      .select(['id'])
      .where('id', 'in', uniqueBranchIds)
      .where('deleted_at', 'is', null)
      .execute();

    if (foundBranches.length !== uniqueBranchIds.length) {
      throw new AppError('INVALID_BRANCH', 'Một hoặc nhiều chi nhánh được chọn không tồn tại.', 400);
    }
  }
}

export async function createUser(
  input: CreateUserInput,
  actorId: number,
  ipAddress: string | null,
): Promise<UserItem> {
  const db = getDb();

  const existing = await db
    .selectFrom('users')
    .select(['id'])
    .where('email', '=', input.email)
    .executeTakeFirst();

  if (existing) {
    throw new AppError('EMAIL_ALREADY_EXISTS', `Email "${input.email}" đã tồn tại trong hệ thống.`, 409);
  }

  await validateAssignments(input.assignments);
  const passwordHash = await hashPassword(input.password);

  const createdId = await db.transaction().execute(async (trx) => {
    const inserted = await trx
      .insertInto('users')
      .values({
        email: input.email,
        password_hash: passwordHash,
        full_name: input.fullName,
        status: input.status,
        created_by: actorId,
        updated_by: actorId,
      })
      .executeTakeFirstOrThrow();

    const userId = Number(inserted.insertId);
    for (const item of input.assignments) {
      await trx
        .insertInto('user_roles')
        .values({
          user_id: userId,
          role_id: item.roleId,
          branch_id: item.branchId ?? null,
        })
        .execute();
    }

    return userId;
  });

  const userRow = await db
    .selectFrom('users')
    .select(['id', 'email', 'full_name', 'status', 'last_login_at', 'created_at'])
    .where('id', '=', createdId)
    .executeTakeFirstOrThrow();

  const assignmentsMap = await fetchAssignmentsByUserIds([createdId]);
  const createdUser: UserItem = {
    id: createdId,
    email: userRow.email,
    fullName: userRow.full_name,
    status: userRow.status,
    lastLoginAt: null,
    createdAt: new Date(userRow.created_at).toISOString(),
    assignments: assignmentsMap.get(createdId) ?? [],
  };

  await recordAuditLog({
    userId: actorId,
    moduleCode: 'core',
    action: 'USER_CREATE',
    entityType: 'users',
    entityId: createdId,
    newValues: {
      email: createdUser.email,
      fullName: createdUser.fullName,
      status: createdUser.status,
      roles: createdUser.assignments.map((a) => a.roleCode),
    },
    ipAddress,
  });

  return createdUser;
}

export async function updateUser(
  userId: number,
  input: UpdateUserInput,
  actorId: number,
  ipAddress: string | null,
): Promise<UserItem> {
  const db = getDb();

  const existing = await db
    .selectFrom('users')
    .select(['id', 'email', 'full_name', 'status'])
    .where('id', '=', userId)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (!existing) {
    throw new AppError('USER_NOT_FOUND', 'Không tìm thấy tài khoản người dùng.', 404);
  }

  if (userId === actorId && input.status === 'LOCKED') {
    throw new AppError(
      'CANNOT_LOCK_SELF',
      'Bạn không thể tự khóa chính tài khoản đang đăng nhập.',
      400,
    );
  }

  if (input.assignments) {
    await validateAssignments(input.assignments);
  }

  await db.transaction().execute(async (trx) => {
    await trx
      .updateTable('users')
      .set({
        full_name: input.fullName ?? existing.full_name,
        status: input.status ?? existing.status,
        updated_by: actorId,
      })
      .where('id', '=', userId)
      .execute();

    if (input.assignments) {
      await trx.deleteFrom('user_roles').where('user_id', '=', userId).execute();
      for (const item of input.assignments) {
        await trx
          .insertInto('user_roles')
          .values({
            user_id: userId,
            role_id: item.roleId,
            branch_id: item.branchId ?? null,
          })
          .execute();
      }
    }

    if (input.status === 'LOCKED') {
      await trx
        .updateTable('refresh_tokens')
        .set({ revoked_at: new Date() })
        .where('user_id', '=', userId)
        .where('revoked_at', 'is', null)
        .execute();
    }
  });

  const updatedRow = await db
    .selectFrom('users')
    .select(['id', 'email', 'full_name', 'status', 'last_login_at', 'created_at'])
    .where('id', '=', userId)
    .executeTakeFirstOrThrow();

  const assignmentsMap = await fetchAssignmentsByUserIds([userId]);
  const updatedUser: UserItem = {
    id: userId,
    email: updatedRow.email,
    fullName: updatedRow.full_name,
    status: updatedRow.status,
    lastLoginAt: updatedRow.last_login_at ? new Date(updatedRow.last_login_at).toISOString() : null,
    createdAt: new Date(updatedRow.created_at).toISOString(),
    assignments: assignmentsMap.get(userId) ?? [],
  };

  await recordAuditLog({
    userId: actorId,
    moduleCode: 'core',
    action: 'USER_UPDATE',
    entityType: 'users',
    entityId: userId,
    oldValues: { fullName: existing.full_name, status: existing.status },
    newValues: { fullName: updatedUser.fullName, status: updatedUser.status },
    ipAddress,
  });

  return updatedUser;
}
