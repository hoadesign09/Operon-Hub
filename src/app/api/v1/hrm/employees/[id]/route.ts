import { NextRequest } from 'next/server';
import { getRequestIp, withAuth } from '@/middlewares/auth';
import { updateEmployeeSchema } from '@/modules/hrm/employees/employees.schema';
import {
  getEmployeeById,
  softDeleteEmployee,
  updateEmployee,
} from '@/modules/hrm/employees/employees.service';
import { AppError, ok } from '@/shared/api-response';

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
    const employee = await getEmployeeById(auth, parsePositiveId(id));
    return ok(employee);
  },
  { permission: 'hrm.employees.read' },
);

export const PATCH = withAuth<{ id: string }>(
  async (request: NextRequest, context, auth) => {
    const { id } = await context.params;
    const body: unknown = await request.json();
    const input = updateEmployeeSchema.parse(body);
    const updated = await updateEmployee(auth, parsePositiveId(id), input, getRequestIp(request));
    return ok(updated);
  },
  { permission: 'hrm.employees.update' },
);

export const DELETE = withAuth<{ id: string }>(
  async (request: NextRequest, context, auth) => {
    const { id } = await context.params;
    await softDeleteEmployee(auth, parsePositiveId(id), getRequestIp(request));
    return ok({ deleted: true });
  },
  { permission: 'hrm.employees.delete' },
);
