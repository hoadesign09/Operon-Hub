import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  getDb,
  type ProposalCommentType,
  type ProposalStatus,
} from '@/config/database';
import type { AuthContext } from '@/modules/auth/auth.service';
import { createNotification } from '@/modules/notifications/notifications.service';
import {
  ALLOWED_PROPOSAL_ATTACHMENT_MIME_EXT,
  MAX_PROPOSAL_ATTACHMENT_BYTES,
  PROPOSAL_MODULE_CODE,
} from '@/modules/proposals/proposals.constants';
import type { CreateProposalCommentInput } from '@/modules/proposals/proposals.schema';
import { assertProposalViewAccess } from '@/modules/proposals/proposals.service';
import { AppError } from '@/shared/api-response';

export interface ProposalCommentView {
  id: number;
  proposalId: number;
  authorUserId: number;
  authorName: string;
  commentType: ProposalCommentType;
  content: string;
  createdAt: string;
}

export interface ProposalAttachmentView {
  id: number;
  proposalId: number;
  uploadedByUserId: number;
  uploadedByName: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  createdAt: string;
  canDelete: boolean;
}

const PROPOSAL_UPLOAD_ROOT = path.resolve(process.cwd(), 'uploads', 'proposals');

/**
 * Chỉ cho phép bình luận và tải/gỡ tệp đính kèm khi đề xuất đang ở trạng thái Chờ phê duyệt (PENDING_APPROVAL).
 */
export function canCollaborateOnProposalStatus(status: ProposalStatus): boolean {
  return status === 'PENDING_APPROVAL';
}

function assertProposalPendingForCollaboration(
  status: ProposalStatus,
  actionLabel: string,
): void {
  if (!canCollaborateOnProposalStatus(status)) {
    throw new AppError(
      'PROPOSAL_COLLAB_LOCKED',
      `Chỉ cho phép ${actionLabel} khi đề xuất đang ở trạng thái Chờ phê duyệt.`,
      409,
    );
  }
}

function resolveSafeProposalStoragePath(relativeKey: string): string {
  const normalized = path.normalize(relativeKey).replace(/^(\.\.(\/|\\|$))+/, '');
  const fullPath = path.resolve(PROPOSAL_UPLOAD_ROOT, normalized);
  if (!fullPath.startsWith(PROPOSAL_UPLOAD_ROOT)) {
    throw new AppError('INVALID_STORAGE_PATH', 'Đường dẫn lưu trữ tệp không hợp lệ.', 400);
  }
  return fullPath;
}

export function validateProposalAttachmentFile(file: {
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
  if (file.size > MAX_PROPOSAL_ATTACHMENT_BYTES) {
    throw new AppError('FILE_TOO_LARGE', 'Tệp đính kèm vượt quá giới hạn tối đa 10MB.', 400);
  }

  const allowedExts = ALLOWED_PROPOSAL_ATTACHMENT_MIME_EXT[file.type];
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
    safeOriginalName: baseName || `document${safeExt}`,
  };
}

export async function listProposalComments(
  auth: AuthContext,
  proposalId: number,
): Promise<ProposalCommentView[]> {
  await assertProposalViewAccess(auth, proposalId);
  const db = getDb();

  const rows = await db
    .selectFrom('proposal_comments as c')
    .innerJoin('users as u', 'u.id', 'c.author_user_id')
    .select([
      'c.id',
      'c.proposal_id',
      'c.author_user_id',
      'u.full_name as author_name',
      'c.comment_type',
      'c.content',
      'c.created_at',
    ])
    .where('c.proposal_id', '=', proposalId)
    .where('c.deleted_at', 'is', null)
    .orderBy('c.created_at', 'asc')
    .orderBy('c.id', 'asc')
    .execute();

  return rows.map((r) => ({
    id: Number(r.id),
    proposalId: Number(r.proposal_id),
    authorUserId: Number(r.author_user_id),
    authorName: r.author_name,
    commentType: r.comment_type,
    content: r.content,
    createdAt: new Date(r.created_at).toISOString(),
  }));
}

export async function createProposalComment(
  auth: AuthContext,
  proposalId: number,
  input: CreateProposalCommentInput,
): Promise<ProposalCommentView[]> {
  const proposal = await assertProposalViewAccess(auth, proposalId);
  assertProposalPendingForCollaboration(proposal.status, 'bình luận');
  const db = getDb();

  await db.transaction().execute(async (trx) => {
    await trx
      .insertInto('proposal_comments')
      .values({
        proposal_id: proposalId,
        author_user_id: auth.userId,
        comment_type: input.commentType,
        content: input.content.trim(),
        created_by: auth.userId,
        updated_by: auth.userId,
      })
      .execute();

    await trx
      .insertInto('proposal_activities')
      .values({
        proposal_id: proposalId,
        actor_user_id: auth.userId,
        action_type: 'COMMENTED',
        detail_json: JSON.stringify({ excerpt: input.content.trim().slice(0, 120) }),
      })
      .execute();
  });

  if (proposal.requesterUserId !== auth.userId) {
    await createNotification({
      userId: proposal.requesterUserId,
      moduleCode: PROPOSAL_MODULE_CODE,
      type: 'PROPOSAL_COMMENT',
      title: `Bình luận mới tại đề xuất [${proposal.proposalCode}]`,
      message: `${auth.fullName}: "${input.content.trim().slice(0, 140)}"`,
      linkUrl: `/services/proposals/${proposalId}`,
    });
  }

  return listProposalComments(auth, proposalId);
}

export async function listProposalAttachments(
  auth: AuthContext,
  proposalId: number,
): Promise<ProposalAttachmentView[]> {
  const proposal = await assertProposalViewAccess(auth, proposalId);
  const db = getDb();
  const isManager = auth.isSuperAdmin || auth.permissions.includes('proposals.manage');
  const canMutateAttachments = canCollaborateOnProposalStatus(proposal.status);

  const rows = await db
    .selectFrom('proposal_attachments as a')
    .innerJoin('users as u', 'u.id', 'a.uploaded_by_user_id')
    .select([
      'a.id',
      'a.proposal_id',
      'a.uploaded_by_user_id',
      'u.full_name as uploaded_by_name',
      'a.file_name',
      'a.mime_type',
      'a.file_size_bytes',
      'a.created_at',
    ])
    .where('a.proposal_id', '=', proposalId)
    .where('a.deleted_at', 'is', null)
    .orderBy('a.created_at', 'desc')
    .execute();

  return rows.map((r) => ({
    id: Number(r.id),
    proposalId: Number(r.proposal_id),
    uploadedByUserId: Number(r.uploaded_by_user_id),
    uploadedByName: r.uploaded_by_name,
    fileName: r.file_name,
    mimeType: r.mime_type,
    fileSizeBytes: Number(r.file_size_bytes),
    createdAt: new Date(r.created_at).toISOString(),
    canDelete:
      canMutateAttachments && (isManager || Number(r.uploaded_by_user_id) === auth.userId),
  }));
}

export async function uploadProposalAttachment(
  auth: AuthContext,
  proposalId: number,
  file: File,
): Promise<ProposalAttachmentView[]> {
  const proposal = await assertProposalViewAccess(auth, proposalId);
  assertProposalPendingForCollaboration(proposal.status, 'tải tệp đính kèm');
  const isManager = auth.isSuperAdmin || auth.permissions.includes('proposals.manage');
  if (proposal.requesterUserId !== auth.userId && !isManager) {
    throw new AppError('FORBIDDEN', 'Bạn không có quyền tải tệp đính kèm lên đề xuất này.', 403);
  }

  const { safeExt, safeOriginalName } = validateProposalAttachmentFile({
    name: file.name,
    type: file.type,
    size: file.size,
  });

  const buffer = Buffer.from(await file.arrayBuffer());
  const checksum = crypto.createHash('sha256').update(buffer).digest('hex');
  const fileToken = `${Date.now()}_${crypto.randomBytes(8).toString('hex')}${safeExt}`;
  const relativeKey = `proposal_${proposalId}/${fileToken}`;
  const fullPath = resolveSafeProposalStoragePath(relativeKey);

  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, buffer);

  const db = getDb();
  await db.transaction().execute(async (trx) => {
    await trx
      .insertInto('proposal_attachments')
      .values({
        proposal_id: proposalId,
        uploaded_by_user_id: auth.userId,
        file_name: safeOriginalName,
        stored_path: relativeKey,
        mime_type: file.type,
        file_size_bytes: buffer.byteLength,
        checksum_sha256: checksum,
        created_by: auth.userId,
        updated_by: auth.userId,
      })
      .execute();

    await trx
      .insertInto('proposal_activities')
      .values({
        proposal_id: proposalId,
        actor_user_id: auth.userId,
        action_type: 'ATTACHMENT_UPLOADED',
        detail_json: JSON.stringify({ fileName: safeOriginalName, sizeBytes: buffer.byteLength }),
      })
      .execute();
  });

  return listProposalAttachments(auth, proposalId);
}

export async function downloadProposalAttachment(
  auth: AuthContext,
  proposalId: number,
  attachmentId: number,
): Promise<{ buffer: Buffer; fileName: string; mimeType: string }> {
  await assertProposalViewAccess(auth, proposalId);
  const db = getDb();

  const row = await db
    .selectFrom('proposal_attachments')
    .select(['id', 'file_name', 'stored_path', 'mime_type'])
    .where('id', '=', attachmentId)
    .where('proposal_id', '=', proposalId)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (!row) {
    throw new AppError('ATTACHMENT_NOT_FOUND', 'Không tìm thấy tệp đính kèm.', 404);
  }

  const fullPath = resolveSafeProposalStoragePath(row.stored_path);
  try {
    const buffer = await fs.readFile(fullPath);
    return { buffer, fileName: row.file_name, mimeType: row.mime_type };
  } catch {
    throw new AppError('ATTACHMENT_FILE_MISSING', 'Tệp vật lý không tồn tại trên máy chủ.', 404);
  }
}

export async function softDeleteProposalAttachment(
  auth: AuthContext,
  proposalId: number,
  attachmentId: number,
): Promise<ProposalAttachmentView[]> {
  const proposal = await assertProposalViewAccess(auth, proposalId);
  assertProposalPendingForCollaboration(proposal.status, 'gỡ tệp đính kèm');
  const db = getDb();

  const row = await db
    .selectFrom('proposal_attachments')
    .select(['id', 'uploaded_by_user_id', 'file_name'])
    .where('id', '=', attachmentId)
    .where('proposal_id', '=', proposalId)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (!row) {
    throw new AppError('ATTACHMENT_NOT_FOUND', 'Không tìm thấy tệp đính kèm.', 404);
  }

  const isManager = auth.isSuperAdmin || auth.permissions.includes('proposals.manage');
  if (!isManager && Number(row.uploaded_by_user_id) !== auth.userId) {
    throw new AppError('FORBIDDEN', 'Bạn không có quyền gỡ tệp đính kèm này.', 403);
  }

  await db.transaction().execute(async (trx) => {
    await trx
      .updateTable('proposal_attachments')
      .set({ deleted_at: new Date(), updated_by: auth.userId })
      .where('id', '=', attachmentId)
      .execute();

    await trx
      .insertInto('proposal_activities')
      .values({
        proposal_id: proposalId,
        actor_user_id: auth.userId,
        action_type: 'ATTACHMENT_REMOVED',
        detail_json: JSON.stringify({ fileName: row.file_name }),
      })
      .execute();
  });

  return listProposalAttachments(auth, proposalId);
}
