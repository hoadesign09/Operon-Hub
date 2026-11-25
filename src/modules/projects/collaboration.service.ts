import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { getDb } from '@/config/database';
import type { AuthContext } from '@/modules/auth/auth.service';
import { createNotification } from '@/modules/notifications/notifications.service';
import { assertProjectAccess } from '@/modules/projects/projects.access';
import {
  ALLOWED_TASK_ATTACHMENT_MIME_TYPES,
  MAX_TASK_ATTACHMENT_SIZE_BYTES,
} from '@/modules/projects/projects.constants';
import type { CreateCommentInput, UpdateCommentInput } from '@/modules/projects/projects.schema';
import { AppError } from '@/shared/api-response';

const TASK_UPLOADS_BASE_DIR = path.resolve(process.cwd(), 'uploads', 'projects');

export interface TaskCommentView {
  id: number;
  taskId: number;
  parentCommentId: number | null;
  authorEmployeeId: number;
  authorName: string;
  authorCode: string;
  content: string;
  mentionedEmployeeIds: number[];
  isResolved: boolean;
  editedAt: string | null;
  createdAt: string;
  canEdit: boolean;
}

export interface TaskAttachmentView {
  id: number;
  projectId: number;
  taskId: number | null;
  uploadedByEmployeeId: number;
  uploadedByName: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  createdAt: string;
  canArchive: boolean;
}

export interface TaskActivityView {
  id: number;
  projectId: number;
  taskId: number | null;
  actorUserId: number;
  actorName: string;
  actionType: string;
  fieldName: string | null;
  oldValue: unknown;
  newValue: unknown;
  createdAt: string;
}

function toIso(val: Date | string | null | undefined): string | null {
  if (!val) {
    return null;
  }
  return val instanceof Date ? val.toISOString() : new Date(val).toISOString();
}

function safeJsonParse(raw: unknown): unknown {
  if (raw === null || raw === undefined) {
    return null;
  }
  if (typeof raw !== 'string') {
    return raw;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

export async function recordTaskActivity(input: {
  projectId: number;
  taskId?: number | null;
  actorUserId: number;
  actionType: string;
  fieldName?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
}): Promise<void> {
  const db = getDb();
  await db
    .insertInto('task_activities')
    .values({
      project_id: input.projectId,
      task_id: input.taskId ?? null,
      actor_user_id: input.actorUserId,
      action_type: input.actionType,
      field_name: input.fieldName ?? null,
      old_value_json: input.oldValue !== undefined ? JSON.stringify(input.oldValue) : null,
      new_value_json: input.newValue !== undefined ? JSON.stringify(input.newValue) : null,
    })
    .execute();
}

export async function listTaskActivities(
  auth: AuthContext,
  taskId: number,
): Promise<TaskActivityView[]> {
  const db = getDb();
  const task = await db
    .selectFrom('tasks')
    .select(['id', 'project_id'])
    .where('id', '=', taskId)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (!task) {
    throw new AppError('TASK_NOT_FOUND', 'Không tìm thấy công việc.', 404);
  }

  await assertProjectAccess(auth, Number(task.project_id), 'VIEW');

  const rows = await db
    .selectFrom('task_activities')
    .innerJoin('users', 'users.id', 'task_activities.actor_user_id')
    .select([
      'task_activities.id',
      'task_activities.project_id',
      'task_activities.task_id',
      'task_activities.actor_user_id',
      'users.full_name as actor_name',
      'task_activities.action_type',
      'task_activities.field_name',
      'task_activities.old_value_json',
      'task_activities.new_value_json',
      'task_activities.created_at',
    ])
    .where('task_activities.task_id', '=', taskId)
    .orderBy('task_activities.created_at', 'desc')
    .limit(100)
    .execute();

  return rows.map((r) => ({
    id: Number(r.id),
    projectId: Number(r.project_id),
    taskId: r.task_id !== null ? Number(r.task_id) : null,
    actorUserId: Number(r.actor_user_id),
    actorName: r.actor_name,
    actionType: r.action_type,
    fieldName: r.field_name,
    oldValue: safeJsonParse(r.old_value_json),
    newValue: safeJsonParse(r.new_value_json),
    createdAt: toIso(r.created_at)!,
  }));
}

export async function listTaskComments(
  auth: AuthContext,
  taskId: number,
): Promise<TaskCommentView[]> {
  const db = getDb();
  const task = await db
    .selectFrom('tasks')
    .select(['id', 'project_id'])
    .where('id', '=', taskId)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (!task) {
    throw new AppError('TASK_NOT_FOUND', 'Không tìm thấy công việc.', 404);
  }

  const access = await assertProjectAccess(auth, Number(task.project_id), 'VIEW');

  const rows = await db
    .selectFrom('task_comments')
    .innerJoin('employees', 'employees.id', 'task_comments.author_employee_id')
    .select([
      'task_comments.id',
      'task_comments.task_id',
      'task_comments.parent_comment_id',
      'task_comments.author_employee_id',
      'employees.full_name as author_name',
      'employees.employee_code as author_code',
      'task_comments.content',
      'task_comments.mentioned_employee_ids_json',
      'task_comments.is_resolved',
      'task_comments.edited_at',
      'task_comments.created_at',
    ])
    .where('task_comments.task_id', '=', taskId)
    .where('task_comments.deleted_at', 'is', null)
    .orderBy('task_comments.created_at', 'asc')
    .execute();

  return rows.map((r) => {
    const parsedMentions = safeJsonParse(r.mentioned_employee_ids_json);
    const mentionedEmployeeIds = Array.isArray(parsedMentions)
      ? parsedMentions.map((x) => Number(x)).filter((x) => Number.isFinite(x))
      : [];
    const authorId = Number(r.author_employee_id);
    return {
      id: Number(r.id),
      taskId: Number(r.task_id),
      parentCommentId: r.parent_comment_id !== null ? Number(r.parent_comment_id) : null,
      authorEmployeeId: authorId,
      authorName: r.author_name,
      authorCode: r.author_code,
      content: r.content,
      mentionedEmployeeIds,
      isResolved: Number(r.is_resolved) === 1,
      editedAt: toIso(r.edited_at),
      createdAt: toIso(r.created_at)!,
      canEdit: access.canEditProject || (access.employeeId !== null && access.employeeId === authorId),
    };
  });
}

export async function createTaskComment(
  auth: AuthContext,
  taskId: number,
  input: CreateCommentInput,
): Promise<TaskCommentView[]> {
  const db = getDb();
  const task = await db
    .selectFrom('tasks')
    .innerJoin('projects', 'projects.id', 'tasks.project_id')
    .select(['tasks.id', 'tasks.project_id', 'tasks.task_key', 'tasks.title', 'projects.code as project_code'])
    .where('tasks.id', '=', taskId)
    .where('tasks.deleted_at', 'is', null)
    .executeTakeFirst();

  if (!task) {
    throw new AppError('TASK_NOT_FOUND', 'Không tìm thấy công việc.', 404);
  }

  const access = await assertProjectAccess(auth, Number(task.project_id), 'VIEW');
  const authorEmployeeId = access.employeeId ?? access.project.managerEmployeeId;
  const mentionedIds = Array.from(new Set(input.mentionedEmployeeIds ?? []));

  if (input.parentCommentId) {
    const parent = await db
      .selectFrom('task_comments')
      .select(['id'])
      .where('id', '=', input.parentCommentId)
      .where('task_id', '=', taskId)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();
    if (!parent) {
      throw new AppError('PARENT_COMMENT_NOT_FOUND', 'Bình luận gốc không tồn tại.', 404);
    }
  }

  await db
    .insertInto('task_comments')
    .values({
      task_id: taskId,
      parent_comment_id: input.parentCommentId ?? null,
      author_employee_id: authorEmployeeId,
      content: input.content.trim(),
      mentioned_employee_ids_json: mentionedIds.length > 0 ? JSON.stringify(mentionedIds) : null,
      is_resolved: 0,
      edited_at: null,
      created_by: auth.userId,
      updated_by: auth.userId,
    })
    .execute();

  await recordTaskActivity({
    projectId: Number(task.project_id),
    taskId,
    actorUserId: auth.userId,
    actionType: 'COMMENTED',
    newValue: { excerpt: input.content.trim().slice(0, 120) },
  });

  if (mentionedIds.length > 0) {
    const mentionedUsers = await db
      .selectFrom('employees')
      .select(['id', 'user_id'])
      .where('id', 'in', mentionedIds)
      .where('user_id', 'is not', null)
      .execute();

    for (const mu of mentionedUsers) {
      if (mu.user_id && Number(mu.user_id) !== auth.userId) {
        await createNotification({
          userId: Number(mu.user_id),
          moduleCode: 'projects',
          type: 'TASK_MENTION',
          title: `${auth.fullName} đã nhắc đến bạn trong [${task.task_key}]`,
          message: input.content.trim().slice(0, 180),
          linkUrl: `/projects/${task.project_code}?taskId=${taskId}`,
        });
      }
    }
  }

  return listTaskComments(auth, taskId);
}

export async function updateTaskComment(
  auth: AuthContext,
  taskId: number,
  commentId: number,
  input: UpdateCommentInput,
): Promise<TaskCommentView[]> {
  const db = getDb();
  const comment = await db
    .selectFrom('task_comments')
    .innerJoin('tasks', 'tasks.id', 'task_comments.task_id')
    .select(['task_comments.id', 'task_comments.author_employee_id', 'tasks.project_id'])
    .where('task_comments.id', '=', commentId)
    .where('task_comments.task_id', '=', taskId)
    .where('task_comments.deleted_at', 'is', null)
    .executeTakeFirst();

  if (!comment) {
    throw new AppError('COMMENT_NOT_FOUND', 'Không tìm thấy bình luận.', 404);
  }

  const access = await assertProjectAccess(auth, Number(comment.project_id), 'VIEW');
  const isAuthor = access.employeeId !== null && access.employeeId === Number(comment.author_employee_id);

  if ((input.content !== undefined || input.archive) && !isAuthor && !access.canEditProject) {
    throw new AppError('COMMENT_FORBIDDEN', 'Bạn chỉ có thể chỉnh sửa hoặc ẩn bình luận của mình.', 403);
  }

  await db
    .updateTable('task_comments')
    .set({
      ...(input.content !== undefined ? { content: input.content.trim(), edited_at: new Date() } : {}),
      ...(input.isResolved !== undefined ? { is_resolved: input.isResolved ? 1 : 0 } : {}),
      ...(input.archive ? { deleted_at: new Date() } : {}),
      updated_by: auth.userId,
    })
    .where('id', '=', commentId)
    .execute();

  return listTaskComments(auth, taskId);
}

export function validateTaskAttachmentFile(file: {
  name: string;
  type: string;
  size: number;
}): { safeExt: string; safeOriginalName: string } {
  if (!file || file.size <= 0) {
    throw new AppError('EMPTY_FILE', 'Vui lòng chọn tệp đính kèm hợp lệ (không rỗng).', 400);
  }
  if (file.size > MAX_TASK_ATTACHMENT_SIZE_BYTES) {
    throw new AppError('FILE_TOO_LARGE', 'Dung lượng tệp vượt quá giới hạn tối đa 10 MB.', 400);
  }
  const safeExt = ALLOWED_TASK_ATTACHMENT_MIME_TYPES[file.type];
  if (!safeExt) {
    throw new AppError(
      'INVALID_FILE_TYPE',
      'Định dạng tệp không được hỗ trợ (chấp nhận PDF, ảnh, DOCX, XLSX, PPTX, TXT, CSV, ZIP).',
      400,
    );
  }
  const rawBase = path.basename(file.name || `attachment${safeExt}`);
  const safeOriginalName = rawBase.replace(/[^\p{L}\p{N}._\- ]/gu, '_').slice(0, 200);
  return {
    safeExt,
    safeOriginalName: safeOriginalName || `attachment${safeExt}`,
  };
}

function resolveSafeProjectStoragePath(relativeKey: string): string {
  const normalized = relativeKey.replace(/\\/g, '/').replace(/^\/+/, '');
  const resolved = path.resolve(TASK_UPLOADS_BASE_DIR, normalized);
  if (!resolved.startsWith(`${TASK_UPLOADS_BASE_DIR}${path.sep}`)) {
    throw new AppError('INVALID_STORAGE_PATH', 'Đường dẫn tệp lưu trữ không hợp lệ.', 400);
  }
  return resolved;
}

export async function listTaskAttachments(
  auth: AuthContext,
  taskId: number,
): Promise<TaskAttachmentView[]> {
  const db = getDb();
  const task = await db
    .selectFrom('tasks')
    .select(['id', 'project_id'])
    .where('id', '=', taskId)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (!task) {
    throw new AppError('TASK_NOT_FOUND', 'Không tìm thấy công việc.', 404);
  }

  const access = await assertProjectAccess(auth, Number(task.project_id), 'VIEW');
  const rows = await db
    .selectFrom('task_attachments')
    .innerJoin('employees', 'employees.id', 'task_attachments.uploaded_by_employee_id')
    .select([
      'task_attachments.id',
      'task_attachments.project_id',
      'task_attachments.task_id',
      'task_attachments.uploaded_by_employee_id',
      'employees.full_name as uploaded_by_name',
      'task_attachments.file_name',
      'task_attachments.mime_type',
      'task_attachments.file_size_bytes',
      'task_attachments.created_at',
    ])
    .where('task_attachments.task_id', '=', taskId)
    .where('task_attachments.deleted_at', 'is', null)
    .orderBy('task_attachments.created_at', 'desc')
    .execute();

  return rows.map((r) => ({
    id: Number(r.id),
    projectId: Number(r.project_id),
    taskId: r.task_id !== null ? Number(r.task_id) : null,
    uploadedByEmployeeId: Number(r.uploaded_by_employee_id),
    uploadedByName: r.uploaded_by_name,
    fileName: r.file_name,
    mimeType: r.mime_type,
    fileSizeBytes: Number(r.file_size_bytes),
    createdAt: toIso(r.created_at)!,
    canArchive:
      access.canEditProject ||
      (access.employeeId !== null && access.employeeId === Number(r.uploaded_by_employee_id)),
  }));
}

export async function uploadTaskAttachment(
  auth: AuthContext,
  taskId: number,
  file: File,
): Promise<TaskAttachmentView[]> {
  const db = getDb();
  const task = await db
    .selectFrom('tasks')
    .select(['id', 'project_id'])
    .where('id', '=', taskId)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (!task) {
    throw new AppError('TASK_NOT_FOUND', 'Không tìm thấy công việc.', 404);
  }

  const access = await assertProjectAccess(auth, Number(task.project_id), 'CONTRIBUTE');
  const { safeExt, safeOriginalName } = validateTaskAttachmentFile({
    name: file.name,
    type: file.type,
    size: file.size,
  });

  const buffer = Buffer.from(await file.arrayBuffer());
  const checksum = crypto.createHash('sha256').update(buffer).digest('hex');
  const fileToken = `${Date.now()}_${crypto.randomBytes(8).toString('hex')}${safeExt}`;
  const relativeKey = `project_${task.project_id}/task_${taskId}/${fileToken}`;
  const fullPath = resolveSafeProjectStoragePath(relativeKey);

  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, buffer);

  const uploaderEmpId = access.employeeId ?? access.project.managerEmployeeId;
  await db
    .insertInto('task_attachments')
    .values({
      project_id: Number(task.project_id),
      task_id: taskId,
      uploaded_by_employee_id: uploaderEmpId,
      file_name: safeOriginalName,
      stored_path: relativeKey,
      mime_type: file.type,
      file_size_bytes: buffer.byteLength,
      checksum_sha256: checksum,
      created_by: auth.userId,
      updated_by: auth.userId,
    })
    .execute();

  await recordTaskActivity({
    projectId: Number(task.project_id),
    taskId,
    actorUserId: auth.userId,
    actionType: 'ATTACHMENT_UPLOADED',
    newValue: { fileName: safeOriginalName, sizeBytes: buffer.byteLength },
  });

  return listTaskAttachments(auth, taskId);
}

export async function downloadTaskAttachment(
  auth: AuthContext,
  taskId: number,
  attachmentId: number,
): Promise<{ buffer: Buffer; fileName: string; mimeType: string }> {
  const db = getDb();
  const row = await db
    .selectFrom('task_attachments')
    .select(['id', 'project_id', 'task_id', 'file_name', 'stored_path', 'mime_type'])
    .where('id', '=', attachmentId)
    .where('task_id', '=', taskId)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (!row) {
    throw new AppError('ATTACHMENT_NOT_FOUND', 'Không tìm thấy tệp đính kèm.', 404);
  }

  await assertProjectAccess(auth, Number(row.project_id), 'VIEW');
  const fullPath = resolveSafeProjectStoragePath(row.stored_path);

  try {
    const buffer = await fs.readFile(fullPath);
    return { buffer, fileName: row.file_name, mimeType: row.mime_type };
  } catch {
    throw new AppError('ATTACHMENT_FILE_MISSING', 'Tệp vật lý không tồn tại trên máy chủ.', 404);
  }
}

export async function archiveTaskAttachment(
  auth: AuthContext,
  taskId: number,
  attachmentId: number,
): Promise<TaskAttachmentView[]> {
  const db = getDb();
  const row = await db
    .selectFrom('task_attachments')
    .select(['id', 'project_id', 'uploaded_by_employee_id', 'file_name'])
    .where('id', '=', attachmentId)
    .where('task_id', '=', taskId)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (!row) {
    throw new AppError('ATTACHMENT_NOT_FOUND', 'Không tìm thấy tệp đính kèm.', 404);
  }

  const access = await assertProjectAccess(auth, Number(row.project_id), 'CONTRIBUTE');
  const isUploader = access.employeeId !== null && access.employeeId === Number(row.uploaded_by_employee_id);
  if (!access.canEditProject && !isUploader) {
    throw new AppError('ATTACHMENT_FORBIDDEN', 'Bạn không có quyền gỡ tệp đính kèm này.', 403);
  }

  await db
    .updateTable('task_attachments')
    .set({ deleted_at: new Date(), updated_by: auth.userId })
    .where('id', '=', attachmentId)
    .execute();

  return listTaskAttachments(auth, taskId);
}
