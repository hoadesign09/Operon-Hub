import { NextRequest } from 'next/server';
import { getRequestIp, withAuth } from '@/middlewares/auth';
import {
  listEmployeeDocuments,
  uploadEmployeeDocument,
} from '@/modules/hrm/employees/employee-documents.service';
import { employeeDocumentMetaSchema } from '@/modules/hrm/employees/employees.schema';
import { AppError, created, ok } from '@/shared/api-response';

function parsePositiveId(rawId: string): number {
  const parsed = Number(rawId);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new AppError('INVALID_ID', 'ID nhân viên không hợp lệ.', 400);
  }
  return parsed;
}

export const GET = withAuth<{ id: string }>(
  async (_request: NextRequest, context, auth) => {
    const { id } = await context.params;
    const docs = await listEmployeeDocuments(auth, parsePositiveId(id), false);
    return ok(docs);
  },
  { permission: 'hrm.employees.read' },
);

export const POST = withAuth<{ id: string }>(
  async (request: NextRequest, context, auth) => {
    const { id } = await context.params;
    const formData = await request.formData();
    const rawFile = formData.get('file');

    if (!(rawFile instanceof File)) {
      throw new AppError('MISSING_FILE', 'Vui lòng đính kèm tệp tài liệu.', 400);
    }

    const meta = employeeDocumentMetaSchema.parse({
      docType: formData.get('docType') ?? 'OTHER',
      title: formData.get('title') ?? rawFile.name,
      expiredAt: formData.get('expiredAt') ?? null,
    });

    const doc = await uploadEmployeeDocument(
      auth,
      parsePositiveId(id),
      meta,
      rawFile,
      getRequestIp(request),
    );
    return created(doc);
  },
  { permission: 'hrm.employees.update' },
);
