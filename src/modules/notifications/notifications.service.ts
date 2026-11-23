import { getDb } from '@/config/database';
import {
  buildPaginationMeta,
  parsePaginationParams,
  type PaginationMeta,
} from '@/lib/portable/pagination';
import { AppError } from '@/shared/api-response';

export interface NotificationItem {
  id: number;
  userId: number;
  moduleCode: string;
  type: string;
  title: string;
  message: string;
  linkUrl: string | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

export interface CreateNotificationInput {
  userId: number;
  moduleCode?: string;
  type?: string;
  title: string;
  message: string;
  linkUrl?: string | null;
}

export async function createNotification(input: CreateNotificationInput): Promise<number> {
  const db = getDb();
  const result = await db
    .insertInto('notifications')
    .values({
      user_id: input.userId,
      module_code: input.moduleCode ?? 'core',
      type: input.type ?? 'INFO',
      title: input.title,
      message: input.message,
      link_url: input.linkUrl ?? null,
      is_read: 0,
    })
    .executeTakeFirstOrThrow();

  return Number(result.insertId);
}

export async function createNotificationsForRole(input: {
  roleId: number;
  branchId?: number | null;
  excludeUserId?: number;
  moduleCode?: string;
  type?: string;
  title: string;
  message: string;
  linkUrl?: string | null;
}): Promise<number> {
  const db = getDb();

  let query = db
    .selectFrom('user_roles')
    .innerJoin('users', 'users.id', 'user_roles.user_id')
    .select(['users.id'])
    .where('user_roles.role_id', '=', input.roleId)
    .where('users.status', '=', 'ACTIVE')
    .where('users.deleted_at', 'is', null)
    .distinct();

  if (input.branchId !== null && input.branchId !== undefined) {
    query = query.where((eb) =>
      eb.or([
        eb('user_roles.branch_id', 'is', null),
        eb('user_roles.branch_id', '=', input.branchId!),
      ]),
    );
  }

  const rows = await query.execute();
  const targetUserIds = rows
    .map((r) => Number(r.id))
    .filter((uid) => uid !== input.excludeUserId);

  if (targetUserIds.length === 0) {
    return 0;
  }

  await db
    .insertInto('notifications')
    .values(
      targetUserIds.map((userId) => ({
        user_id: userId,
        module_code: input.moduleCode ?? 'core',
        type: input.type ?? 'APPROVAL',
        title: input.title,
        message: input.message,
        link_url: input.linkUrl ?? null,
        is_read: 0,
      })),
    )
    .execute();

  return targetUserIds.length;
}

export async function listUserNotifications(
  userId: number,
  query: {
    page?: string | null;
    limit?: string | null;
    unreadOnly?: string | null;
  },
): Promise<{ items: NotificationItem[]; unreadCount: number; meta: PaginationMeta }> {
  const db = getDb();
  const pagination = parsePaginationParams(
    { page: query.page, limit: query.limit },
    { defaultLimit: 10, maxLimit: 50 },
  );

  let baseQuery = db.selectFrom('notifications').where('user_id', '=', userId);
  if (query.unreadOnly === 'true' || query.unreadOnly === '1') {
    baseQuery = baseQuery.where('is_read', '=', 0);
  }

  const [countRow, unreadRow, rows] = await Promise.all([
    baseQuery.select((eb) => eb.fn.count<number>('id').as('total')).executeTakeFirst(),
    db
      .selectFrom('notifications')
      .select((eb) => eb.fn.count<number>('id').as('total'))
      .where('user_id', '=', userId)
      .where('is_read', '=', 0)
      .executeTakeFirst(),
    baseQuery
      .select([
        'id',
        'user_id',
        'module_code',
        'type',
        'title',
        'message',
        'link_url',
        'is_read',
        'read_at',
        'created_at',
      ])
      .orderBy('created_at', 'desc')
      .orderBy('id', 'desc')
      .limit(pagination.limit)
      .offset(pagination.offset)
      .execute(),
  ]);

  const total = Number(countRow?.total ?? 0);
  const unreadCount = Number(unreadRow?.total ?? 0);

  const items: NotificationItem[] = rows.map((row) => ({
    id: Number(row.id),
    userId: Number(row.user_id),
    moduleCode: row.module_code,
    type: row.type,
    title: row.title,
    message: row.message,
    linkUrl: row.link_url,
    isRead: Boolean(row.is_read),
    readAt: row.read_at ? new Date(row.read_at).toISOString() : null,
    createdAt: new Date(row.created_at).toISOString(),
  }));

  return {
    items,
    unreadCount,
    meta: buildPaginationMeta(total, pagination.page, pagination.limit),
  };
}

export async function markNotificationRead(userId: number, notificationId: number): Promise<void> {
  const db = getDb();
  const existing = await db
    .selectFrom('notifications')
    .select(['id', 'is_read'])
    .where('id', '=', notificationId)
    .where('user_id', '=', userId)
    .executeTakeFirst();

  if (!existing) {
    throw new AppError('NOTIFICATION_NOT_FOUND', 'Không tìm thấy thông báo.', 404);
  }

  if (existing.is_read === 1) {
    return;
  }

  await db
    .updateTable('notifications')
    .set({ is_read: 1, read_at: new Date() })
    .where('id', '=', notificationId)
    .where('user_id', '=', userId)
    .execute();
}

export async function markAllNotificationsRead(userId: number): Promise<number> {
  const db = getDb();
  const result = await db
    .updateTable('notifications')
    .set({ is_read: 1, read_at: new Date() })
    .where('user_id', '=', userId)
    .where('is_read', '=', 0)
    .executeTakeFirst();

  return Number(result.numUpdatedRows ?? 0);
}
