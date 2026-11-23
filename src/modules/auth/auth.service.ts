import { getDb, type DataScope } from '@/config/database';
import { getServerEnv } from '@/config/env';
import { hashPassword, verifyPassword } from '@/lib/portable/password-hasher';
import { generateSecureToken, sha256Hex } from '@/lib/portable/token-hash';
import { recordAuditLog } from '@/modules/audit/audit.service';
import { signAccessToken } from '@/modules/auth/jwt';
import { AppError } from '@/shared/api-response';

const DATA_SCOPE_PRIORITY: Record<DataScope, number> = {
  OWN: 1,
  DEPARTMENT: 2,
  BRANCH: 3,
  ALL: 4,
};

const SUPER_ADMIN_ROLE_CODE = 'SUPER_ADMIN';
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface AuthBranchSummary {
  id: number;
  code: string;
  name: string;
  isHeadquarters: boolean;
}

export interface AuthRoleSummary {
  id: number;
  code: string;
  name: string;
  dataScope: DataScope;
  branchId: number | null;
}

export interface AuthContext {
  userId: number;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  status: 'ACTIVE' | 'LOCKED';
  roles: AuthRoleSummary[];
  permissions: string[];
  dataScope: DataScope;
  isSuperAdmin: boolean;
  hasAllBranches: boolean;
  branchIds: number[];
  branches: AuthBranchSummary[];
}

export interface SessionMeta {
  userAgent: string | null;
  ipAddress: string | null;
}

export function resolveHighestDataScope(scopes: DataScope[]): DataScope {
  if (scopes.length === 0) {
    return 'OWN';
  }
  return scopes.reduce<DataScope>((highest, current) => {
    return DATA_SCOPE_PRIORITY[current] > DATA_SCOPE_PRIORITY[highest] ? current : highest;
  }, 'OWN');
}

export function hasRequiredPermission(
  auth: Pick<AuthContext, 'isSuperAdmin' | 'permissions'>,
  permission?: string,
): boolean {
  if (!permission) {
    return true;
  }
  if (auth.isSuperAdmin) {
    return true;
  }
  return auth.permissions.includes(permission);
}

export async function loadAuthContext(userId: number): Promise<AuthContext | null> {
  const db = getDb();

  const user = await db
    .selectFrom('users')
    .select(['id', 'email', 'full_name', 'avatar_url', 'status'])
    .where('id', '=', userId)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (!user) {
    return null;
  }

  const roleRows = await db
    .selectFrom('user_roles')
    .innerJoin('roles', 'roles.id', 'user_roles.role_id')
    .select([
      'roles.id as role_id',
      'roles.code as role_code',
      'roles.name as role_name',
      'roles.data_scope as data_scope',
      'user_roles.branch_id as branch_id',
    ])
    .where('user_roles.user_id', '=', userId)
    .where('roles.deleted_at', 'is', null)
    .execute();

  const roles: AuthRoleSummary[] = roleRows.map((r) => ({
    id: Number(r.role_id),
    code: r.role_code,
    name: r.role_name,
    dataScope: r.data_scope,
    branchId: r.branch_id !== null ? Number(r.branch_id) : null,
  }));

  const roleIds = Array.from(new Set(roles.map((r) => r.id)));
  const isSuperAdmin = roles.some((r) => r.code === SUPER_ADMIN_ROLE_CODE);
  const dataScope = isSuperAdmin
    ? 'ALL'
    : resolveHighestDataScope(roles.map((r) => r.dataScope));

  let permissions: string[] = [];
  if (isSuperAdmin) {
    const allPerms = await db.selectFrom('permissions').select(['code']).execute();
    permissions = allPerms.map((p) => p.code);
  } else if (roleIds.length > 0) {
    const permRows = await db
      .selectFrom('role_permissions')
      .innerJoin('permissions', 'permissions.id', 'role_permissions.permission_id')
      .select(['permissions.code'])
      .where('role_permissions.role_id', 'in', roleIds)
      .distinct()
      .execute();
    permissions = permRows.map((p) => p.code);
  }

  const hasAllBranches =
    isSuperAdmin ||
    dataScope === 'ALL' ||
    roles.some((r) => r.branchId === null);

  const assignedBranchIds = Array.from(
    new Set(roles.map((r) => r.branchId).filter((id): id is number => id !== null)),
  );

  let branchQuery = db
    .selectFrom('branches')
    .select(['id', 'code', 'name', 'is_headquarters'])
    .where('deleted_at', 'is', null)
    .where('is_active', '=', 1)
    .orderBy('is_headquarters', 'desc')
    .orderBy('name', 'asc');

  if (!hasAllBranches) {
    if (assignedBranchIds.length === 0) {
      return {
        userId: Number(user.id),
        email: user.email,
        fullName: user.full_name,
        avatarUrl: user.avatar_url,
        status: user.status,
        roles,
        permissions,
        dataScope,
        isSuperAdmin,
        hasAllBranches,
        branchIds: [],
        branches: [],
      };
    }
    branchQuery = branchQuery.where('id', 'in', assignedBranchIds);
  }

  const branchRows = await branchQuery.execute();
  const branches: AuthBranchSummary[] = branchRows.map((b) => ({
    id: Number(b.id),
    code: b.code,
    name: b.name,
    isHeadquarters: Boolean(b.is_headquarters),
  }));

  return {
    userId: Number(user.id),
    email: user.email,
    fullName: user.full_name,
    avatarUrl: user.avatar_url,
    status: user.status,
    roles,
    permissions,
    dataScope,
    isSuperAdmin,
    hasAllBranches,
    branchIds: branches.map((b) => b.id),
    branches,
  };
}

export async function loginWithPassword(
  email: string,
  password: string,
  meta: SessionMeta,
): Promise<{
  accessToken: string;
  refreshToken: string;
  refreshExpiresDays: number;
  user: AuthContext;
}> {
  const db = getDb();
  const normalizedEmail = email.trim().toLowerCase();

  const userRow = await db
    .selectFrom('users')
    .select(['id', 'email', 'password_hash', 'status'])
    .where('email', '=', normalizedEmail)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (!userRow) {
    throw new AppError('INVALID_CREDENTIALS', 'Email hoặc mật khẩu không chính xác.', 401);
  }

  if (userRow.status === 'LOCKED') {
    throw new AppError(
      'ACCOUNT_LOCKED',
      'Tài khoản của bạn đang bị khóa. Vui lòng liên hệ quản trị viên.',
      403,
    );
  }

  const isPasswordValid = await verifyPassword(password, userRow.password_hash);
  if (!isPasswordValid) {
    throw new AppError('INVALID_CREDENTIALS', 'Email hoặc mật khẩu không chính xác.', 401);
  }

  const userId = Number(userRow.id);
  const env = getServerEnv();
  const refreshToken = generateSecureToken(32);
  const tokenHash = sha256Hex(refreshToken);
  const expiresAt = new Date(Date.now() + env.JWT_REFRESH_EXPIRES_DAYS * MS_PER_DAY);

  await db
    .updateTable('users')
    .set({ last_login_at: new Date() })
    .where('id', '=', userId)
    .execute();

  await db
    .insertInto('refresh_tokens')
    .values({
      user_id: userId,
      token_hash: tokenHash,
      expires_at: expiresAt,
      user_agent: meta.userAgent ? meta.userAgent.slice(0, 255) : null,
      ip_address: meta.ipAddress,
    })
    .execute();

  const accessToken = await signAccessToken({ userId, email: userRow.email });
  const authContext = await loadAuthContext(userId);
  if (!authContext) {
    throw new AppError('UNAUTHORIZED', 'Không thể tải thông tin phiên đăng nhập.', 401);
  }

  await recordAuditLog({
    userId,
    moduleCode: 'core',
    action: 'AUTH_LOGIN',
    entityType: 'users',
    entityId: userId,
    newValues: { email: userRow.email },
    ipAddress: meta.ipAddress,
  });

  return {
    accessToken,
    refreshToken,
    refreshExpiresDays: env.JWT_REFRESH_EXPIRES_DAYS,
    user: authContext,
  };
}

export async function rotateRefreshToken(
  rawRefreshToken: string,
  meta: SessionMeta,
): Promise<{
  accessToken: string;
  refreshToken: string;
  refreshExpiresDays: number;
}> {
  if (!rawRefreshToken) {
    throw new AppError('INVALID_REFRESH_TOKEN', 'Phiên đăng nhập đã hết hạn.', 401);
  }

  const db = getDb();
  const tokenHash = sha256Hex(rawRefreshToken);

  const existing = await db
    .selectFrom('refresh_tokens')
    .select(['id', 'user_id', 'expires_at', 'revoked_at'])
    .where('token_hash', '=', tokenHash)
    .executeTakeFirst();

  if (!existing || existing.revoked_at !== null || new Date(existing.expires_at) <= new Date()) {
    throw new AppError('INVALID_REFRESH_TOKEN', 'Phiên đăng nhập đã hết hạn hoặc bị thu hồi.', 401);
  }

  const userId = Number(existing.user_id);
  const userRow = await db
    .selectFrom('users')
    .select(['id', 'email', 'status'])
    .where('id', '=', userId)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (!userRow || userRow.status !== 'ACTIVE') {
    throw new AppError('UNAUTHORIZED', 'Tài khoản không còn hiệu lực.', 401);
  }

  const env = getServerEnv();
  const nextRefreshToken = generateSecureToken(32);
  const nextTokenHash = sha256Hex(nextRefreshToken);
  const nextExpiresAt = new Date(Date.now() + env.JWT_REFRESH_EXPIRES_DAYS * MS_PER_DAY);

  await db.transaction().execute(async (trx) => {
    await trx
      .updateTable('refresh_tokens')
      .set({ revoked_at: new Date() })
      .where('id', '=', Number(existing.id))
      .execute();

    await trx
      .insertInto('refresh_tokens')
      .values({
        user_id: userId,
        token_hash: nextTokenHash,
        expires_at: nextExpiresAt,
        user_agent: meta.userAgent ? meta.userAgent.slice(0, 255) : null,
        ip_address: meta.ipAddress,
      })
      .execute();
  });

  const accessToken = await signAccessToken({ userId, email: userRow.email });
  return {
    accessToken,
    refreshToken: nextRefreshToken,
    refreshExpiresDays: env.JWT_REFRESH_EXPIRES_DAYS,
  };
}

export async function logoutSession(rawRefreshToken?: string): Promise<void> {
  if (!rawRefreshToken) {
    return;
  }
  const db = getDb();
  const tokenHash = sha256Hex(rawRefreshToken);
  await db
    .updateTable('refresh_tokens')
    .set({ revoked_at: new Date() })
    .where('token_hash', '=', tokenHash)
    .where('revoked_at', 'is', null)
    .execute();
}

export async function changeUserPassword(
  userId: number,
  currentPassword: string,
  newPassword: string,
  ipAddress: string | null,
): Promise<void> {
  const db = getDb();

  const userRow = await db
    .selectFrom('users')
    .select(['id', 'password_hash'])
    .where('id', '=', userId)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (!userRow) {
    throw new AppError('USER_NOT_FOUND', 'Không tìm thấy tài khoản.', 404);
  }

  const isCurrentValid = await verifyPassword(currentPassword, userRow.password_hash);
  if (!isCurrentValid) {
    throw new AppError('INVALID_CURRENT_PASSWORD', 'Mật khẩu hiện tại không chính xác.', 400);
  }

  const nextHash = await hashPassword(newPassword);

  await db.transaction().execute(async (trx) => {
    await trx
      .updateTable('users')
      .set({ password_hash: nextHash, updated_by: userId })
      .where('id', '=', userId)
      .execute();

    await trx
      .updateTable('refresh_tokens')
      .set({ revoked_at: new Date() })
      .where('user_id', '=', userId)
      .where('revoked_at', 'is', null)
      .execute();
  });

  await recordAuditLog({
    userId,
    moduleCode: 'core',
    action: 'AUTH_CHANGE_PASSWORD',
    entityType: 'users',
    entityId: userId,
    newValues: { passwordChanged: true },
    ipAddress,
  });
}
