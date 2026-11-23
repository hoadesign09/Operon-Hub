import { getDb, type DataScope } from '@/config/database';
import { recordAuditLog } from '@/modules/audit/audit.service';
import { AppError } from '@/shared/api-response';

const SUPER_ADMIN_CODE = 'SUPER_ADMIN';

export interface RoleItem {
  id: number;
  code: string;
  name: string;
  dataScope: DataScope;
  description: string | null;
  isSystem: boolean;
  permissionIds: number[];
  userCount: number;
}

export interface PermissionItem {
  id: number;
  moduleCode: string;
  code: string;
  name: string;
  description: string | null;
}

export async function listRoles(): Promise<RoleItem[]> {
  const db = getDb();

  const roles = await db
    .selectFrom('roles')
    .select(['id', 'code', 'name', 'data_scope', 'description', 'is_system'])
    .where('deleted_at', 'is', null)
    .orderBy('id', 'asc')
    .execute();

  if (roles.length === 0) {
    return [];
  }

  const roleIds = roles.map((r) => Number(r.id));

  const [rolePermRows, userCountRows] = await Promise.all([
    db
      .selectFrom('role_permissions')
      .select(['role_id', 'permission_id'])
      .where('role_id', 'in', roleIds)
      .execute(),
    db
      .selectFrom('user_roles')
      .select(['role_id'])
      .select((eb) => eb.fn.count<number>('user_id').distinct().as('total'))
      .where('role_id', 'in', roleIds)
      .groupBy('role_id')
      .execute(),
  ]);

  const permsByRole = new Map<number, number[]>();
  for (const row of rolePermRows) {
    const rid = Number(row.role_id);
    const list = permsByRole.get(rid) ?? [];
    list.push(Number(row.permission_id));
    permsByRole.set(rid, list);
  }

  const userCountByRole = new Map<number, number>(
    userCountRows.map((row) => [Number(row.role_id), Number(row.total)]),
  );

  return roles.map((r) => {
    const id = Number(r.id);
    return {
      id,
      code: r.code,
      name: r.name,
      dataScope: r.data_scope,
      description: r.description,
      isSystem: Boolean(r.is_system),
      permissionIds: permsByRole.get(id) ?? [],
      userCount: userCountByRole.get(id) ?? 0,
    };
  });
}

export async function listPermissions(): Promise<{
  items: PermissionItem[];
  grouped: Record<string, PermissionItem[]>;
}> {
  const db = getDb();
  const rows = await db
    .selectFrom('permissions')
    .select(['id', 'module_code', 'code', 'name', 'description'])
    .orderBy('module_code', 'asc')
    .orderBy('code', 'asc')
    .execute();

  const items: PermissionItem[] = rows.map((row) => ({
    id: Number(row.id),
    moduleCode: row.module_code,
    code: row.code,
    name: row.name,
    description: row.description,
  }));

  const grouped: Record<string, PermissionItem[]> = {};
  for (const item of items) {
    const group = grouped[item.moduleCode] ?? [];
    group.push(item);
    grouped[item.moduleCode] = group;
  }

  return { items, grouped };
}

export async function updateRolePermissions(
  roleId: number,
  permissionIds: number[],
  actorId: number,
  ipAddress: string | null,
): Promise<{ roleId: number; permissionIds: number[] }> {
  const db = getDb();

  const role = await db
    .selectFrom('roles')
    .select(['id', 'code', 'name'])
    .where('id', '=', roleId)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (!role) {
    throw new AppError('ROLE_NOT_FOUND', 'Không tìm thấy vai trò.', 404);
  }

  if (role.code === SUPER_ADMIN_CODE) {
    throw new AppError(
      'CANNOT_MODIFY_SUPER_ADMIN',
      'Không thể thay đổi quyền của vai trò hệ thống SUPER_ADMIN.',
      400,
    );
  }

  const uniquePermIds = Array.from(new Set(permissionIds));
  if (uniquePermIds.length > 0) {
    const foundPerms = await db
      .selectFrom('permissions')
      .select(['id'])
      .where('id', 'in', uniquePermIds)
      .execute();

    if (foundPerms.length !== uniquePermIds.length) {
      throw new AppError('INVALID_PERMISSION', 'Một hoặc nhiều quyền không tồn tại.', 400);
    }
  }

  const oldPerms = await db
    .selectFrom('role_permissions')
    .select(['permission_id'])
    .where('role_id', '=', roleId)
    .execute();

  await db.transaction().execute(async (trx) => {
    await trx.deleteFrom('role_permissions').where('role_id', '=', roleId).execute();
    for (const permId of uniquePermIds) {
      await trx
        .insertInto('role_permissions')
        .values({ role_id: roleId, permission_id: permId })
        .execute();
    }
  });

  await recordAuditLog({
    userId: actorId,
    moduleCode: 'core',
    action: 'ROLE_PERMISSIONS_UPDATE',
    entityType: 'roles',
    entityId: roleId,
    oldValues: { permissionIds: oldPerms.map((p) => Number(p.permission_id)) },
    newValues: { roleCode: role.code, permissionIds: uniquePermIds },
    ipAddress,
  });

  return { roleId, permissionIds: uniquePermIds };
}
