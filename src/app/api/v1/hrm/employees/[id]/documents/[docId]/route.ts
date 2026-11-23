import { NextRequest } from 'next/server';
import { getRequestIp, withAuth } from '@/middlewares/auth';
import { softDeleteEmployeeDocument } from '@/modules/hrm/employees/employee-documents.service';
import { AppError, ok } from '@/shared/api-response';

function parsePositiveId(raw: string, label: string): number {
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new AppError('INVALID_ID', `${label} không hợp lệ.`, 400);
  }
  return parsed;
}

export const DELETE = withAuth<{ id: string; docId: string }>(
  async (request: NextRequest, context, auth) => {
    const { id, docId } = await context.params;
    await softDeleteEmployeeDocument(
      auth,
      parsePositiveId(id, 'ID nhân viên'),
      parsePositiveId(docId, 'ID tài liệu'),
      getRequestIp(request),
    );
    return ok({ deleted: true });
  },
  { permission: 'hrm.employees.update' },
);
