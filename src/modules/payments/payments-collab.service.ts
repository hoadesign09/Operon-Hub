import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { getDb, type PaymentAttachmentKind } from '@/config/database';
import { canCollaborateOnPaymentStatus } from '@/lib/portable/payment-calculator';
import type { AuthContext } from '@/modules/auth/auth.service';
import { createNotification } from '@/modules/notifications/notifications.service';
import {
  ALLOWED_PAYMENT_ATTACHMENT_MIME_EXT,
  MAX_PAYMENT_ATTACHMENT_BYTES,
  PAYMENT_MODULE_CODE,
} from '@/modules/payments/payments.constants';
import type { CreatePaymentCommentInput } from '@/modules/payments/payments.schema';
import {
  assertPaymentViewAccess,
  type PaymentAttachmentView,
  type PaymentCommentView,
} from '@/modules/payments/payments.service';
import { AppError } from '@/shared/api-response';

const PAYMENT_UPLOAD_ROOT = path.resolve(process.cwd(), 'uploads', 'payments');

function isFinanceManager(auth: AuthContext): boolean {
  return (
    auth.isSuperAdmin ||
    auth.permissions.includes('payments.manage') ||
    auth.permissions.includes('payments.disburse')
  );
}

function resolveSafePaymentStoragePath(relativeKey: string): string {
  const normalized = path.normalize(relativeKey).replace(/^(\.\.(\/|\\|$))+/, '');
  const fullPath = path.resolve(PAYMENT_UPLOAD_ROOT, normalized);
  if (!fullPath.startsWith(PAYMENT_UPLOAD_ROOT)) {
    throw new AppError('INVALID_STORAGE_PATH', 'Đường dẫn lưu trữ tệp không hợp lệ.', 400);
  }
  return fullPath;
}

export function validatePaymentAttachmentFile(file: {
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
  if (file.size > MAX_PAYMENT_ATTACHMENT_BYTES) {
    throw new AppError('FILE_TOO_LARGE', 'Tệp đính kèm vượt quá giới hạn tối đa 10MB.', 400);
  }

  const allowedExts = ALLOWED_PAYMENT_ATTACHMENT_MIME_EXT[file.type];
  if (!allowedExts) {
    throw new AppError(
      'UNSUPPORTED_FILE_TYPE',
      'Định dạng tệp không hỗ trợ (chỉ chấp nhận PDF, PNG, JPG, WEBP, DOCX, XLSX, CSV).',
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
    safeOriginalName: baseName || `receipt${safeExt}`,
  };
}

export async function listPaymentComments(
  auth: AuthContext,
  paymentId: number,
): Promise<PaymentCommentView[]> {
  await assertPaymentViewAccess(auth, paymentId);
  const db = getDb();

  const rows = await db
    .selectFrom('payment_comments as pc')
    .innerJoin('users as u', 'u.id', 'pc.author_user_id')
    .select([
      'pc.id',
      'pc.author_user_id',
      'u.full_name as author_name',
      'pc.comment_type',
      'pc.content',
      'pc.created_at',
    ])
    .where('pc.payment_request_id', '=', paymentId)
    .where('pc.deleted_at', 'is', null)
    .orderBy('pc.created_at', 'asc')
    .orderBy('pc.id', 'asc')
    .execute();

  return rows.map((r) => ({
    id: Number(r.id),
    authorUserId: Number(r.author_user_id),
    authorName: r.author_name,
    commentType: r.comment_type,
    content: r.content,
    createdAt: new Date(r.created_at).toISOString(),
  }));
}

export async function createPaymentComment(
  auth: AuthContext,
  paymentId: number,
  input: CreatePaymentCommentInput,
): Promise<PaymentCommentView[]> {
  const payment = await assertPaymentViewAccess(auth, paymentId);
  if (!canCollaborateOnPaymentStatus(payment.status)) {
    throw new AppError(
      'PAYMENT_COLLAB_LOCKED',
      'Chỉ cho phép bình luận khi phiếu thanh toán đang ở trạng thái Chờ phê duyệt.',
      409,
    );
  }

  const db = getDb();
  await db.transaction().execute(async (trx) => {
    await trx
      .insertInto('payment_comments')
      .values({
        payment_request_id: paymentId,
        author_user_id: auth.userId,
        comment_type: input.commentType,
        content: input.content.trim(),
        created_by: auth.userId,
        updated_by: auth.userId,
      })
      .execute();

    await trx
      .insertInto('payment_activities')
      .values({
        payment_request_id: paymentId,
        actor_user_id: auth.userId,
        action: 'COMMENTED',
        summary: `${auth.fullName} bình luận: "${input.content.trim().slice(0, 120)}"`,
        metadata_json: JSON.stringify({ commentType: input.commentType }),
      })
      .execute();
  });

  if (payment.requesterUserId !== auth.userId) {
    await createNotification({
      userId: payment.requesterUserId,
      moduleCode: PAYMENT_MODULE_CODE,
      type: 'PAYMENT_COMMENT',
      title: `Trao đổi mới tại phiếu [${payment.code}]`,
      message: `${auth.fullName}: "${input.content.trim().slice(0, 140)}"`,
      linkUrl: `/services/payments/${paymentId}`,
    });
  }

  return listPaymentComments(auth, paymentId);
}

export async function listPaymentAttachments(
  auth: AuthContext,
  paymentId: number,
): Promise<PaymentAttachmentView[]> {
  const payment = await assertPaymentViewAccess(auth, paymentId);
  const db = getDb();
  const isMgr = isFinanceManager(auth);
  const canCollab = canCollaborateOnPaymentStatus(payment.status);

  const rows = await db
    .selectFrom('payment_attachments as pa')
    .innerJoin('users as u', 'u.id', 'pa.uploaded_by_user_id')
    .select([
      'pa.id',
      'pa.attachment_kind',
      'pa.file_name',
      'pa.mime_type',
      'pa.file_size',
      'pa.uploaded_by_user_id',
      'u.full_name as uploaded_by_name',
      'pa.created_at',
    ])
    .where('pa.payment_request_id', '=', paymentId)
    .where('pa.deleted_at', 'is', null)
    .orderBy('pa.created_at', 'desc')
    .execute();

  return rows.map((r) => ({
    id: Number(r.id),
    attachmentKind: r.attachment_kind,
    fileName: r.file_name,
    mimeType: r.mime_type,
    fileSize: Number(r.file_size),
    uploadedByUserId: Number(r.uploaded_by_user_id),
    uploadedByName: r.uploaded_by_name,
    createdAt: new Date(r.created_at).toISOString(),
    canDelete: canCollab && (isMgr || Number(r.uploaded_by_user_id) === auth.userId),
  }));
}

export async function uploadPaymentAttachment(
  auth: AuthContext,
  paymentId: number,
  file: File,
  attachmentKind: PaymentAttachmentKind,
): Promise<PaymentAttachmentView[]> {
  const payment = await assertPaymentViewAccess(auth, paymentId);
  if (!canCollaborateOnPaymentStatus(payment.status)) {
    throw new AppError(
      'PAYMENT_COLLAB_LOCKED',
      'Chỉ cho phép tải lên tệp đính kèm khi phiếu thanh toán đang ở trạng thái Chờ phê duyệt.',
      409,
    );
  }
  const isFinance = isFinanceManager(auth);
  const isOwner = payment.requesterUserId === auth.userId;
  if (!isOwner && !isFinance) {
    throw new AppError(
      'FORBIDDEN',
      'Chỉ người tạo phiếu hoặc Kế toán quản trị mới được tải lên chứng từ đính kèm.',
      403,
    );
  }
  const isUnc = attachmentKind === 'UNC_RECEIPT';
  if (isUnc && !isFinance && !auth.permissions.includes('payments.disburse')) {
    throw new AppError(
      'FORBIDDEN',
      'Chỉ Kế toán Thanh toán / Thủ quỹ mới được tải lên chứng từ Ủy nhiệm chi (UNC).',
      403,
    );
  }

  const { safeExt, safeOriginalName } = validatePaymentAttachmentFile({
    name: file.name,
    type: file.type,
    size: file.size,
  });

  const buffer = Buffer.from(await file.arrayBuffer());
  const checksum = crypto.createHash('sha256').update(buffer).digest('hex');
  const uniqueName = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${safeExt}`;
  const relativeKey = path.join(String(paymentId), uniqueName);
  const fullPath = resolveSafePaymentStoragePath(relativeKey);

  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, buffer);

  const db = getDb();
  await db.transaction().execute(async (trx) => {
    await trx
      .insertInto('payment_attachments')
      .values({
        payment_request_id: paymentId,
        attachment_kind: attachmentKind,
        file_name: safeOriginalName,
        stored_path: relativeKey,
        mime_type: file.type,
        file_size: buffer.length,
        checksum_sha256: checksum,
        uploaded_by_user_id: auth.userId,
        created_by: auth.userId,
        updated_by: auth.userId,
      })
      .execute();

    await trx
      .insertInto('payment_activities')
      .values({
        payment_request_id: paymentId,
        actor_user_id: auth.userId,
        action: isUnc ? 'UNC_UPLOADED' : 'ATTACHMENT_UPLOADED',
        summary: `Đính kèm ${isUnc ? 'Ủy nhiệm chi' : 'chứng từ'}: ${safeOriginalName}`,
        metadata_json: JSON.stringify({ fileName: safeOriginalName, attachmentKind }),
      })
      .execute();
  });

  return listPaymentAttachments(auth, paymentId);
}

export async function getPaymentAttachmentDownload(
  auth: AuthContext,
  paymentId: number,
  attachmentId: number,
): Promise<{ fileName: string; mimeType: string; buffer: Buffer }> {
  await assertPaymentViewAccess(auth, paymentId);
  const db = getDb();

  const row = await db
    .selectFrom('payment_attachments')
    .select(['id', 'file_name', 'stored_path', 'mime_type'])
    .where('id', '=', attachmentId)
    .where('payment_request_id', '=', paymentId)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (!row) {
    throw new AppError('ATTACHMENT_NOT_FOUND', 'Không tìm thấy tệp chứng từ.', 404);
  }

  const fullPath = resolveSafePaymentStoragePath(row.stored_path);
  let buffer: Buffer;
  try {
    buffer = await fs.readFile(fullPath);
  } catch {
    throw new AppError('ATTACHMENT_FILE_MISSING', 'Tệp chứng từ không còn tồn tại trên máy chủ.', 404);
  }

  return {
    fileName: row.file_name,
    mimeType: row.mime_type,
    buffer,
  };
}

export async function deletePaymentAttachment(
  auth: AuthContext,
  paymentId: number,
  attachmentId: number,
): Promise<PaymentAttachmentView[]> {
  const payment = await assertPaymentViewAccess(auth, paymentId);
  const db = getDb();

  const row = await db
    .selectFrom('payment_attachments')
    .select(['id', 'attachment_kind', 'file_name', 'uploaded_by_user_id'])
    .where('id', '=', attachmentId)
    .where('payment_request_id', '=', paymentId)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (!row) {
    throw new AppError('ATTACHMENT_NOT_FOUND', 'Không tìm thấy tệp chứng từ.', 404);
  }

  if (!canCollaborateOnPaymentStatus(payment.status)) {
    throw new AppError(
      'PAYMENT_COLLAB_LOCKED',
      'Chỉ cho phép gỡ tệp đính kèm khi phiếu thanh toán đang ở trạng thái Chờ phê duyệt.',
      409,
    );
  }

  if (!isFinanceManager(auth) && Number(row.uploaded_by_user_id) !== auth.userId) {
    throw new AppError('FORBIDDEN', 'Bạn chỉ có thể xóa tệp chứng từ do chính mình tải lên.', 403);
  }

  await db
    .updateTable('payment_attachments')
    .set({ deleted_at: new Date(), updated_by: auth.userId })
    .where('id', '=', attachmentId)
    .execute();

  return listPaymentAttachments(auth, paymentId);
}
