import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { getDb, type EmployeeDocType } from '@/config/database';
import { recordAuditLog } from '@/modules/audit/audit.service';
import { hasRequiredPermission, type AuthContext } from '@/modules/auth/auth.service';
import type { EmployeeDocumentMetaInput } from '@/modules/hrm/employees/employees.schema';
import {
  canViewSensitiveEmployeeFields,
  isEmployeeWithinScope,
  resolveEmployeeAccessScope,
} from '@/modules/hrm/employees/employees.scope';
import { AppError } from '@/shared/api-response';

export const MAX_DOCUMENT_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export const ALLOWED_DOCUMENT_MIME_TYPES: Record<string, string> = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
};

const UPLOADS_BASE_DIR = path.resolve(process.cwd(), 'uploads', 'hrm', 'employees');

export interface EmployeeDocumentItem {
  id: number;
  employeeId: number;
  docType: EmployeeDocType;
  title: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  expiredAt: string | null;
  createdAt: string;
}

function toIsoDateOnly(value: Date | string | null): string | null {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return String(value).slice(0, 10);
}

export function validateDocumentUploadFile(file: {
  name: string;
  type: string;
  size: number;
}): { safeExt: string; safeOriginalName: string } {
  if (!file || file.size <= 0) {
    throw new AppError('EMPTY_FILE', 'Vui lòng chọn tệp tài liệu hợp lệ (không rỗng).', 400);
  }

  if (file.size > MAX_DOCUMENT_FILE_SIZE_BYTES) {
    throw new AppError(
      'FILE_TOO_LARGE',
      'Dung lượng tệp vượt quá giới hạn tối đa 5 MB.',
      400,
    );
  }

  const allowedExt = ALLOWED_DOCUMENT_MIME_TYPES[file.type];
  if (!allowedExt) {
    throw new AppError(
      'INVALID_FILE_TYPE',
      'Chỉ chấp nhận tệp PDF, ảnh (JPG, PNG, WEBP), Word (.docx) hoặc Excel (.xlsx).',
      400,
    );
  }

  const rawBaseName = path.basename(file.name || `document${allowedExt}`);
  const safeOriginalName = rawBaseName.replace(/[^\p{L}\p{N}._\- ]/gu, '_').slice(0, 200);
  return {
    safeExt: allowedExt,
    safeOriginalName: safeOriginalName || `document${allowedExt}`,
  };
}

export function resolveSafeStoragePath(relativeStorageKey: string): string {
  const normalized = relativeStorageKey.replace(/\\/g, '/').replace(/^\/+/, '');
  const resolved = path.resolve(UPLOADS_BASE_DIR, normalized);
  if (!resolved.startsWith(`${UPLOADS_BASE_DIR}${path.sep}`)) {
    throw new AppError('INVALID_STORAGE_PATH', 'Đường dẫn tệp tài liệu không hợp lệ.', 400);
  }
  return resolved;
}

async function assertEmployeeDocumentAccess(
  auth: AuthContext,
  employeeId: number,
  allowSelfWithoutReadPerm: boolean,
): Promise<{ id: number; userId: number | null; branchId: number; departmentId: number }> {
  const db = getDb();
  const employee = await db
    .selectFrom('employees')
    .select(['id', 'user_id', 'branch_id', 'department_id'])
    .where('id', '=', employeeId)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (!employee) {
    throw new AppError('EMPLOYEE_NOT_FOUND', 'Không tìm thấy hồ sơ nhân viên.', 404);
  }

  const target = {
    id: Number(employee.id),
    userId: employee.user_id !== null ? Number(employee.user_id) : null,
    branchId: Number(employee.branch_id),
    departmentId: Number(employee.department_id),
  };

  if (allowSelfWithoutReadPerm && target.userId === auth.userId) {
    return target;
  }

  if (
    target.userId !== auth.userId &&
    (!hasRequiredPermission(auth, 'hrm.employees.read') ||
      !canViewSensitiveEmployeeFields(auth, target.userId))
  ) {
    throw new AppError(
      'FORBIDDEN',
      'Bạn không có quyền truy cập tài liệu hồ sơ nhạy cảm của nhân viên này.',
      403,
    );
  }

  const scope = await resolveEmployeeAccessScope(auth);
  if (!isEmployeeWithinScope(scope, target, auth.userId)) {
    throw new AppError(
      'FORBIDDEN',
      'Bạn không có quyền truy cập tài liệu của nhân viên này.',
      403,
    );
  }

  return target;
}

export async function listEmployeeDocuments(
  auth: AuthContext,
  employeeId: number,
  allowSelfWithoutReadPerm: boolean = false,
): Promise<EmployeeDocumentItem[]> {
  await assertEmployeeDocumentAccess(auth, employeeId, allowSelfWithoutReadPerm);
  const db = getDb();

  const rows = await db
    .selectFrom('employee_documents')
    .select([
      'id',
      'employee_id',
      'doc_type',
      'title',
      'file_name',
      'file_size',
      'mime_type',
      'expired_at',
      'created_at',
    ])
    .where('employee_id', '=', employeeId)
    .where('deleted_at', 'is', null)
    .orderBy('created_at', 'desc')
    .execute();

  return rows.map((row) => ({
    id: Number(row.id),
    employeeId: Number(row.employee_id),
    docType: row.doc_type,
    title: row.title,
    fileName: row.file_name,
    fileSize: Number(row.file_size),
    mimeType: row.mime_type,
    expiredAt: toIsoDateOnly(row.expired_at),
    createdAt: new Date(row.created_at).toISOString(),
  }));
}

export async function uploadEmployeeDocument(
  auth: AuthContext,
  employeeId: number,
  meta: EmployeeDocumentMetaInput,
  file: { name: string; type: string; size: number; arrayBuffer: () => Promise<ArrayBuffer> },
  ipAddress: string | null,
): Promise<EmployeeDocumentItem> {
  await assertEmployeeDocumentAccess(auth, employeeId, false);
  const { safeExt, safeOriginalName } = validateDocumentUploadFile(file);

  const uniqueFileName = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${safeExt}`;
  const relativeStorageKey = `${employeeId}/${uniqueFileName}`;
  const absolutePath = resolveSafeStoragePath(relativeStorageKey);

  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  const fileBuffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(absolutePath, fileBuffer);

  const db = getDb();
  const inserted = await db
    .insertInto('employee_documents')
    .values({
      employee_id: employeeId,
      doc_type: meta.docType,
      title: meta.title,
      file_name: safeOriginalName,
      file_url: relativeStorageKey,
      file_size: fileBuffer.length,
      mime_type: file.type,
      expired_at: meta.expiredAt ?? null,
      created_by: auth.userId,
      updated_by: auth.userId,
    })
    .executeTakeFirstOrThrow();

  const docId = Number(inserted.insertId);
  await recordAuditLog({
    userId: auth.userId,
    moduleCode: 'hrm',
    action: 'HRM_EMPLOYEE_DOC_UPLOAD',
    entityType: 'employee_documents',
    entityId: docId,
    newValues: {
      employeeId,
      docType: meta.docType,
      title: meta.title,
      fileName: safeOriginalName,
      fileSize: fileBuffer.length,
    },
    ipAddress,
  });

  const createdRow = await db
    .selectFrom('employee_documents')
    .select([
      'id',
      'employee_id',
      'doc_type',
      'title',
      'file_name',
      'file_size',
      'mime_type',
      'expired_at',
      'created_at',
    ])
    .where('id', '=', docId)
    .executeTakeFirstOrThrow();

  return {
    id: Number(createdRow.id),
    employeeId: Number(createdRow.employee_id),
    docType: createdRow.doc_type,
    title: createdRow.title,
    fileName: createdRow.file_name,
    fileSize: Number(createdRow.file_size),
    mimeType: createdRow.mime_type,
    expiredAt: toIsoDateOnly(createdRow.expired_at),
    createdAt: new Date(createdRow.created_at).toISOString(),
  };
}

export async function getEmployeeDocumentForDownload(
  auth: AuthContext,
  employeeId: number,
  docId: number,
): Promise<{
  buffer: Buffer;
  fileName: string;
  mimeType: string;
}> {
  await assertEmployeeDocumentAccess(auth, employeeId, true);
  const db = getDb();

  const doc = await db
    .selectFrom('employee_documents')
    .select(['id', 'file_name', 'file_url', 'mime_type'])
    .where('id', '=', docId)
    .where('employee_id', '=', employeeId)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (!doc) {
    throw new AppError('DOCUMENT_NOT_FOUND', 'Không tìm thấy tài liệu hồ sơ.', 404);
  }

  const absolutePath = resolveSafeStoragePath(doc.file_url);
  try {
    const buffer = await fs.readFile(absolutePath);
    return {
      buffer,
      fileName: doc.file_name,
      mimeType: doc.mime_type,
    };
  } catch {
    throw new AppError(
      'DOCUMENT_FILE_MISSING',
      'Tệp đính kèm không tồn tại trên hệ thống lưu trữ.',
      404,
    );
  }
}

export async function softDeleteEmployeeDocument(
  auth: AuthContext,
  employeeId: number,
  docId: number,
  ipAddress: string | null,
): Promise<void> {
  await assertEmployeeDocumentAccess(auth, employeeId, false);
  const db = getDb();

  const doc = await db
    .selectFrom('employee_documents')
    .select(['id', 'title', 'file_name'])
    .where('id', '=', docId)
    .where('employee_id', '=', employeeId)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (!doc) {
    throw new AppError('DOCUMENT_NOT_FOUND', 'Không tìm thấy tài liệu hồ sơ.', 404);
  }

  await db
    .updateTable('employee_documents')
    .set({ deleted_at: new Date(), updated_by: auth.userId })
    .where('id', '=', docId)
    .execute();

  await recordAuditLog({
    userId: auth.userId,
    moduleCode: 'hrm',
    action: 'HRM_EMPLOYEE_DOC_DELETE',
    entityType: 'employee_documents',
    entityId: docId,
    oldValues: { employeeId, title: doc.title, fileName: doc.file_name },
    ipAddress,
  });
}
