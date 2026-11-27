import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  getDb,
  type ItRequestCommentType,
  type ItRequestCommentVisibility,
  type ItRequestStatus,
} from '@/config/database';
import type { AuthContext } from '@/modules/auth/auth.service';
import {
  ALLOWED_IT_REQUEST_ATTACHMENT_MIME_EXT,
  IT_REQUEST_MODULE_CODE,
  IT_REQUEST_PERMISSIONS,
  IT_REQUEST_TERMINAL_STATUSES,
  MAX_IT_REQUEST_ATTACHMENT_BYTES,
} from '@/modules/it-requests/it-requests.constants';
import type {
  CreateItChecklistItemInput,
  CreateItCommentInput,
  UpdateItChecklistItemInput,
} from '@/modules/it-requests/it-requests.schema';
import {
  assertItRequestViewAccess,
  type ItChecklistItemView,
} from '@/modules/it-requests/it-requests.service';
import { createNotification } from '@/modules/notifications/notifications.service';
import { AppError } from '@/shared/api-response';

export interface ItCommentView {
  id: number;
  itRequestId: number;
  authorUserId: number;
  authorName: string;
  visibility: ItRequestCommentVisibility;
  commentType: ItRequestCommentType;
  content: string;
  createdAt: string;
}

export interface ItAttachmentView {
  id: number;
  itRequestId: number;
  uploadedByUserId: number;
  uploadedByName: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  createdAt: string;
  canDelete: boolean;
}

const IT_UPLOAD_ROOT = path.resolve(process.cwd(), 'uploads', 'it-requests');

function isItStaff(auth: AuthContext, assignedToUserId: number | null): boolean {
  return (
    auth.isSuperAdmin ||
    auth.permissions.includes(IT_REQUEST_PERMISSIONS.MANAGE) ||
    (assignedToUserId !== null && assignedToUserId === auth.userId)
  );
}

/**
 * Khóa bình luận, tải lên/xóa tệp đính kèm và sửa checklist khi ticket IT đã kết thúc
 * (CLOSED / REJECTED / CANCELLED).
 */
export function canCollaborateOnItRequestStatus(status: ItRequestStatus): boolean {
  return !(IT_REQUEST_TERMINAL_STATUSES as readonly string[]).includes(status);
}

function assertItRequestOpenForCollaboration(status: ItRequestStatus, actionLabel: string): void {
  if (!canCollaborateOnItRequestStatus(status)) {
    throw new AppError(
      'IT_REQUEST_COLLAB_LOCKED',
      `Không thể ${actionLabel} vì yêu cầu IT đã kết thúc (${status}).`,
      409,
    );
  }
}

function resolveSafeItStoragePath(relativeKey: string): string {
  const normalized = path.normalize(relativeKey).replace(/^(\.\.(\/|\\|$))+/, '');
  const fullPath = path.resolve(IT_UPLOAD_ROOT, normalized);
  if (!fullPath.startsWith(IT_UPLOAD_ROOT)) {
    throw new AppError('INVALID_STORAGE_PATH', 'Đường dẫn lưu trữ tệp không hợp lệ.', 400);
  }
  return fullPath;
}

export function validateItAttachmentFile(file: {
  name: string;
  type: string;
  size: number;
}): { safeExt: string; safeOriginalName: string } {
  if (!file.name || file.name.trim().length === 0) {
    throw new AppError('INVALID_FILE_NAME', 'Tên tệp không hợp lệ.', 400);
  }
  if (file.size <= 0) {
    throw new AppError('EMPTY_FILE', 'Tệp đính kèm rỗng.', 400);
  }
  if (file.size > MAX_IT_REQUEST_ATTACHMENT_BYTES) {
    throw new AppError('FILE_TOO_LARGE', 'Tệp đính kèm vượt quá giới hạn tối đa 10MB.', 400);
  }

  const allowedExts = ALLOWED_IT_REQUEST_ATTACHMENT_MIME_EXT[file.type];
  if (!allowedExts) {
    throw new AppError(
      'UNSUPPORTED_FILE_TYPE',
      'Định dạng tệp không được hỗ trợ (chỉ chấp nhận PDF, PNG, JPG, WEBP, DOCX, XLSX, CSV, TXT).',
      400,
    );
  }

  const rawExt = path.extname(file.name).toLowerCase();
  const safeExt = allowedExts.includes(rawExt) ? rawExt : allowedExts[0];
  const baseName = path
    .basename(file.name)
    .replace(/[^\w.\-\u00C0-\u024F\u1E00-\u1EFF ]+/g, '_')
    .trim()
    .slice(0, 220);

  return {
    safeExt,
    safeOriginalName: baseName || `attachment${safeExt}`,
  };
}

// ============================================================
// CHECKLIST ITEMS
// ============================================================

export async function listItChecklistItems(
  auth: AuthContext,
  ticketId: number,
): Promise<ItChecklistItemView[]> {
  await assertItRequestViewAccess(auth, ticketId);
  const db = getDb();

  const rows = await db
    .selectFrom('it_request_checklist_items as ck')
    .leftJoin('users as u', 'u.id', 'ck.done_by_user_id')
    .select([
      'ck.id',
      'ck.it_request_id',
      'ck.title',
      'ck.note',
      'ck.is_done',
      'ck.done_by_user_id',
      'u.full_name as done_by_name',
      'ck.done_at',
      'ck.sort_order',
    ])
    .where('ck.it_request_id', '=', ticketId)
    .orderBy('ck.sort_order', 'asc')
    .orderBy('ck.id', 'asc')
    .execute();

  return rows.map((r) => ({
    id: Number(r.id),
    itRequestId: Number(r.it_request_id),
    title: r.title,
    note: r.note ?? null,
    isDone: Number(r.is_done) === 1,
    doneByUserId: r.done_by_user_id !== null ? Number(r.done_by_user_id) : null,
    doneByName: r.done_by_name ?? null,
    doneAt: r.done_at ? new Date(r.done_at).toISOString() : null,
    sortOrder: Number(r.sort_order),
  }));
}

export async function createItChecklistItem(
  auth: AuthContext,
  ticketId: number,
  input: CreateItChecklistItemInput,
): Promise<ItChecklistItemView[]> {
  const ticket = await assertItRequestViewAccess(auth, ticketId);
  assertItRequestOpenForCollaboration(ticket.status, 'thêm checklist kỹ thuật');
  if (!isItStaff(auth, ticket.assignedToUserId)) {
    throw new AppError('FORBIDDEN', 'Chỉ kỹ thuật viên IT mới có quyền quản lý checklist xử lý.', 403);
  }

  const db = getDb();
  const maxOrderRow = await db
    .selectFrom('it_request_checklist_items')
    .select((eb) => eb.fn.max<number>('sort_order').as('max_order'))
    .where('it_request_id', '=', ticketId)
    .executeTakeFirst();

  await db
    .insertInto('it_request_checklist_items')
    .values({
      it_request_id: ticketId,
      title: input.title,
      note: input.note ?? null,
      is_done: 0,
      done_by_user_id: null,
      done_at: null,
      sort_order: Number(maxOrderRow?.max_order ?? 0) + 1,
      created_by: auth.userId,
      updated_by: auth.userId,
    })
    .execute();

  return listItChecklistItems(auth, ticketId);
}

export async function updateItChecklistItem(
  auth: AuthContext,
  ticketId: number,
  itemId: number,
  input: UpdateItChecklistItemInput,
): Promise<ItChecklistItemView[]> {
  const ticket = await assertItRequestViewAccess(auth, ticketId);
  assertItRequestOpenForCollaboration(ticket.status, 'cập nhật checklist kỹ thuật');
  if (!isItStaff(auth, ticket.assignedToUserId)) {
    throw new AppError('FORBIDDEN', 'Chỉ kỹ thuật viên IT mới có quyền cập nhật checklist xử lý.', 403);
  }

  const db = getDb();
  const item = await db
    .selectFrom('it_request_checklist_items')
    .select(['id'])
    .where('id', '=', itemId)
    .where('it_request_id', '=', ticketId)
    .executeTakeFirst();

  if (!item) {
    throw new AppError('CHECKLIST_ITEM_NOT_FOUND', 'Không tìm thấy hạng mục checklist.', 404);
  }

  await db
    .updateTable('it_request_checklist_items')
    .set({
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.note !== undefined ? { note: input.note } : {}),
      ...(input.isDone !== undefined
        ? {
            is_done: input.isDone ? 1 : 0,
            done_by_user_id: input.isDone ? auth.userId : null,
            done_at: input.isDone ? new Date() : null,
          }
        : {}),
      updated_by: auth.userId,
    })
    .where('id', '=', itemId)
    .execute();

  return listItChecklistItems(auth, ticketId);
}

export async function deleteItChecklistItem(
  auth: AuthContext,
  ticketId: number,
  itemId: number,
): Promise<ItChecklistItemView[]> {
  const ticket = await assertItRequestViewAccess(auth, ticketId);
  assertItRequestOpenForCollaboration(ticket.status, 'xóa hạng mục checklist');
  if (!isItStaff(auth, ticket.assignedToUserId)) {
    throw new AppError('FORBIDDEN', 'Chỉ kỹ thuật viên IT mới có quyền xóa checklist xử lý.', 403);
  }

  const db = getDb();
  await db
    .deleteFrom('it_request_checklist_items')
    .where('id', '=', itemId)
    .where('it_request_id', '=', ticketId)
    .execute();

  return listItChecklistItems(auth, ticketId);
}

// ============================================================
// COMMENTS (PUBLIC + INTERNAL NOTE)
// ============================================================

export async function listItComments(
  auth: AuthContext,
  ticketId: number,
): Promise<ItCommentView[]> {
  const ticket = await assertItRequestViewAccess(auth, ticketId);
  const canSeeInternal = isItStaff(auth, ticket.assignedToUserId);
  const db = getDb();

  let query = db
    .selectFrom('it_request_comments as c')
    .innerJoin('users as u', 'u.id', 'c.author_user_id')
    .select([
      'c.id',
      'c.it_request_id',
      'c.author_user_id',
      'u.full_name as author_name',
      'c.visibility',
      'c.comment_type',
      'c.content',
      'c.created_at',
    ])
    .where('c.it_request_id', '=', ticketId)
    .where('c.deleted_at', 'is', null)
    .orderBy('c.created_at', 'asc')
    .orderBy('c.id', 'asc');

  if (!canSeeInternal) {
    query = query.where('c.visibility', '=', 'PUBLIC');
  }

  const rows = await query.execute();
  return rows.map((r) => ({
    id: Number(r.id),
    itRequestId: Number(r.it_request_id),
    authorUserId: Number(r.author_user_id),
    authorName: r.author_name,
    visibility: r.visibility,
    commentType: r.comment_type,
    content: r.content,
    createdAt: new Date(r.created_at).toISOString(),
  }));
}

export async function createItComment(
  auth: AuthContext,
  ticketId: number,
  input: CreateItCommentInput,
): Promise<ItCommentView[]> {
  const ticket = await assertItRequestViewAccess(auth, ticketId);
  assertItRequestOpenForCollaboration(ticket.status, 'bình luận');

  const staff = isItStaff(auth, ticket.assignedToUserId);
  if (input.visibility === 'INTERNAL_NOTE' && !staff) {
    throw new AppError('FORBIDDEN', 'Chỉ bộ phận IT mới có quyền đăng ghi chú nội bộ.', 403);
  }

  const db = getDb();
  const trimmed = input.content.trim();

  await db.transaction().execute(async (trx) => {
    await trx
      .insertInto('it_request_comments')
      .values({
        it_request_id: ticketId,
        author_user_id: auth.userId,
        visibility: input.visibility,
        comment_type: 'COMMENT',
        content: trimmed,
        created_by: auth.userId,
        updated_by: auth.userId,
      })
      .execute();

    // Auto-record first_responded_at when IT posts first public response
    if (staff && input.visibility === 'PUBLIC') {
      await trx
        .updateTable('it_requests')
        .set({ first_responded_at: new Date(), updated_by: auth.userId })
        .where('id', '=', ticketId)
        .where('first_responded_at', 'is', null)
        .execute();
    }

    await trx
      .insertInto('it_request_activities')
      .values({
        it_request_id: ticketId,
        actor_user_id: auth.userId,
        action: input.visibility === 'INTERNAL_NOTE' ? 'INTERNAL_NOTE_ADDED' : 'COMMENTED',
        summary:
          input.visibility === 'INTERNAL_NOTE'
            ? 'Thêm ghi chú kỹ thuật nội bộ IT'
            : `Bình luận mới: "${trimmed.slice(0, 120)}"`,
        metadata_json: JSON.stringify({ visibility: input.visibility }),
      })
      .execute();
  });

  if (input.visibility === 'PUBLIC') {
    if (ticket.requesterUserId !== auth.userId) {
      await createNotification({
        userId: ticket.requesterUserId,
        moduleCode: IT_REQUEST_MODULE_CODE,
        type: 'IT_REQUEST_COMMENT',
        title: `Phản hồi mới tại ticket [${ticket.code}]`,
        message: `${auth.fullName}: "${trimmed.slice(0, 140)}"`,
        linkUrl: `/services/it-requests/${ticketId}`,
      });
    } else if (ticket.assignedToUserId && ticket.assignedToUserId !== auth.userId) {
      await createNotification({
        userId: ticket.assignedToUserId,
        moduleCode: IT_REQUEST_MODULE_CODE,
        type: 'IT_REQUEST_COMMENT',
        title: `Người gửi phản hồi tại ticket [${ticket.code}]`,
        message: `${auth.fullName}: "${trimmed.slice(0, 140)}"`,
        linkUrl: `/services/it-requests/${ticketId}`,
      });
    }
  }

  return listItComments(auth, ticketId);
}

// ============================================================
// ATTACHMENTS
// ============================================================

export async function listItAttachments(
  auth: AuthContext,
  ticketId: number,
): Promise<ItAttachmentView[]> {
  const ticket = await assertItRequestViewAccess(auth, ticketId);
  const db = getDb();
  const manager = auth.isSuperAdmin || auth.permissions.includes(IT_REQUEST_PERMISSIONS.MANAGE);
  const canMutate = canCollaborateOnItRequestStatus(ticket.status);

  const rows = await db
    .selectFrom('it_request_attachments as a')
    .innerJoin('users as u', 'u.id', 'a.uploaded_by_user_id')
    .select([
      'a.id',
      'a.it_request_id',
      'a.uploaded_by_user_id',
      'u.full_name as uploaded_by_name',
      'a.file_name',
      'a.mime_type',
      'a.file_size',
      'a.created_at',
    ])
    .where('a.it_request_id', '=', ticketId)
    .where('a.deleted_at', 'is', null)
    .orderBy('a.created_at', 'desc')
    .execute();

  return rows.map((r) => ({
    id: Number(r.id),
    itRequestId: Number(r.it_request_id),
    uploadedByUserId: Number(r.uploaded_by_user_id),
    uploadedByName: r.uploaded_by_name,
    fileName: r.file_name,
    mimeType: r.mime_type,
    fileSizeBytes: Number(r.file_size),
    createdAt: new Date(r.created_at).toISOString(),
    canDelete: canMutate && (manager || Number(r.uploaded_by_user_id) === auth.userId),
  }));
}

export async function uploadItAttachment(
  auth: AuthContext,
  ticketId: number,
  file: File,
): Promise<ItAttachmentView[]> {
  const ticket = await assertItRequestViewAccess(auth, ticketId);
  assertItRequestOpenForCollaboration(ticket.status, 'tải tệp đính kèm');

  const allowedUploader =
    ticket.requesterUserId === auth.userId || isItStaff(auth, ticket.assignedToUserId);
  if (!allowedUploader) {
    throw new AppError('FORBIDDEN', 'Bạn không có quyền tải tệp đính kèm lên ticket này.', 403);
  }

  const { safeExt, safeOriginalName } = validateItAttachmentFile({
    name: file.name,
    type: file.type,
    size: file.size,
  });

  const buffer = Buffer.from(await file.arrayBuffer());
  const checksum = crypto.createHash('sha256').update(buffer).digest('hex');
  const fileToken = `${Date.now()}_${crypto.randomBytes(8).toString('hex')}${safeExt}`;
  const relativeKey = `ticket_${ticketId}/${fileToken}`;
  const fullPath = resolveSafeItStoragePath(relativeKey);

  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, buffer);

  const db = getDb();
  await db.transaction().execute(async (trx) => {
    await trx
      .insertInto('it_request_attachments')
      .values({
        it_request_id: ticketId,
        uploaded_by_user_id: auth.userId,
        file_name: safeOriginalName,
        stored_path: relativeKey,
        mime_type: file.type,
        file_size: buffer.length,
        checksum_sha256: checksum,
        created_by: auth.userId,
        updated_by: auth.userId,
      })
      .execute();

    await trx
      .insertInto('it_request_activities')
      .values({
        it_request_id: ticketId,
        actor_user_id: auth.userId,
        action: 'ATTACHMENT_UPLOADED',
        summary: `Đính kèm tệp "${safeOriginalName}"`,
        metadata_json: JSON.stringify({ fileName: safeOriginalName, sizeBytes: buffer.length }),
      })
      .execute();
  });

  return listItAttachments(auth, ticketId);
}

export async function downloadItAttachment(
  auth: AuthContext,
  ticketId: number,
  attachmentId: number,
): Promise<{ buffer: Buffer; fileName: string; mimeType: string }> {
  await assertItRequestViewAccess(auth, ticketId);
  const db = getDb();

  const row = await db
    .selectFrom('it_request_attachments')
    .select(['id', 'file_name', 'stored_path', 'mime_type'])
    .where('id', '=', attachmentId)
    .where('it_request_id', '=', ticketId)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (!row) {
    throw new AppError('ATTACHMENT_NOT_FOUND', 'Không tìm thấy tệp đính kèm.', 404);
  }

  const fullPath = resolveSafeItStoragePath(row.stored_path);
  let buffer: Buffer;
  try {
    buffer = await fs.readFile(fullPath);
  } catch {
    throw new AppError('FILE_MISSING_ON_DISK', 'Tệp đính kèm không tồn tại trên máy chủ.', 404);
  }

  return {
    buffer,
    fileName: row.file_name,
    mimeType: row.mime_type,
  };
}

export async function softDeleteItAttachment(
  auth: AuthContext,
  ticketId: number,
  attachmentId: number,
): Promise<ItAttachmentView[]> {
  const ticket = await assertItRequestViewAccess(auth, ticketId);
  assertItRequestOpenForCollaboration(ticket.status, 'xóa tệp đính kèm');

  const db = getDb();
  const row = await db
    .selectFrom('it_request_attachments')
    .select(['id', 'uploaded_by_user_id', 'file_name'])
    .where('id', '=', attachmentId)
    .where('it_request_id', '=', ticketId)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (!row) {
    throw new AppError('ATTACHMENT_NOT_FOUND', 'Không tìm thấy tệp đính kèm.', 404);
  }

  const manager = auth.isSuperAdmin || auth.permissions.includes(IT_REQUEST_PERMISSIONS.MANAGE);
  if (!manager && Number(row.uploaded_by_user_id) !== auth.userId) {
    throw new AppError('FORBIDDEN', 'Bạn không có quyền xóa tệp đính kèm này.', 403);
  }

  await db
    .updateTable('it_request_attachments')
    .set({ deleted_at: new Date(), updated_by: auth.userId })
    .where('id', '=', attachmentId)
    .execute();

  return listItAttachments(auth, ticketId);
}
