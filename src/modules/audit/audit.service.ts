import { getDb } from '@/config/database';
import {
  buildPaginationMeta,
  parsePaginationParams,
  type PaginationMeta,
} from '@/lib/portable/pagination';

const SENSITIVE_KEYS = new Set([
  'password',
  'passwordhash',
  'password_hash',
  'currentpassword',
  'newpassword',
  'refreshtoken',
  'refresh_token',
  'accesstoken',
  'access_token',
  'token',
  'tokenhash',
  'token_hash',
]);

export interface RecordAuditLogInput {
  userId: number | null;
  moduleCode: string;
  action: string;
  entityType: string;
  entityId?: string | number | null;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  ipAddress?: string | null;
}

export interface AuditLogItem {
  id: number;
  userId: number | null;
  actorName: string | null;
  actorEmail: string | null;
  moduleCode: string;
  action: string;
  entityType: string;
  entityId: string | null;
  oldValues: unknown;
  newValues: unknown;
  ipAddress: string | null;
  createdAt: string;
}

function sanitizePayload(
  payload: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (!payload) {
    return null;
  }
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      continue;
    }
    clean[key] = value;
  }
  return clean;
}

function parseJsonColumn(raw: unknown): unknown {
  if (raw === null || raw === undefined) {
    return null;
  }
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }
  return raw;
}

export async function recordAuditLog(input: RecordAuditLogInput): Promise<void> {
  const db = getDb();
  const safeOld = sanitizePayload(input.oldValues);
  const safeNew = sanitizePayload(input.newValues);

  await db
    .insertInto('audit_logs')
    .values({
      user_id: input.userId,
      module_code: input.moduleCode,
      action: input.action,
      entity_type: input.entityType,
      entity_id: input.entityId !== undefined && input.entityId !== null ? String(input.entityId) : null,
      old_values: safeOld ? JSON.stringify(safeOld) : null,
      new_values: safeNew ? JSON.stringify(safeNew) : null,
      ip_address: input.ipAddress ?? null,
    })
    .execute();
}

export async function listAuditLogs(query: {
  page?: string | null;
  limit?: string | null;
  moduleCode?: string | null;
  action?: string | null;
}): Promise<{ items: AuditLogItem[]; meta: PaginationMeta }> {
  const db = getDb();
  const pagination = parsePaginationParams(
    { page: query.page, limit: query.limit },
    { defaultLimit: 20, maxLimit: 100 },
  );

  let baseQuery = db.selectFrom('audit_logs');
  if (query.moduleCode && query.moduleCode.trim().length > 0) {
    baseQuery = baseQuery.where('audit_logs.module_code', '=', query.moduleCode.trim());
  }
  if (query.action && query.action.trim().length > 0) {
    baseQuery = baseQuery.where('audit_logs.action', 'like', `%${query.action.trim()}%`);
  }

  const countRow = await baseQuery
    .select((eb) => eb.fn.count<number>('audit_logs.id').as('total'))
    .executeTakeFirst();
  const total = Number(countRow?.total ?? 0);

  const rows = await baseQuery
    .leftJoin('users', 'users.id', 'audit_logs.user_id')
    .select([
      'audit_logs.id',
      'audit_logs.user_id',
      'users.full_name as actor_name',
      'users.email as actor_email',
      'audit_logs.module_code',
      'audit_logs.action',
      'audit_logs.entity_type',
      'audit_logs.entity_id',
      'audit_logs.old_values',
      'audit_logs.new_values',
      'audit_logs.ip_address',
      'audit_logs.created_at',
    ])
    .orderBy('audit_logs.created_at', 'desc')
    .orderBy('audit_logs.id', 'desc')
    .limit(pagination.limit)
    .offset(pagination.offset)
    .execute();

  const items: AuditLogItem[] = rows.map((row) => ({
    id: Number(row.id),
    userId: row.user_id !== null ? Number(row.user_id) : null,
    actorName: row.actor_name ?? null,
    actorEmail: row.actor_email ?? null,
    moduleCode: row.module_code,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    oldValues: parseJsonColumn(row.old_values),
    newValues: parseJsonColumn(row.new_values),
    ipAddress: row.ip_address,
    createdAt: new Date(row.created_at).toISOString(),
  }));

  return {
    items,
    meta: buildPaginationMeta(total, pagination.page, pagination.limit),
  };
}
