import { NextRequest } from 'next/server';
import { getRequestIp, withAuth } from '@/middlewares/auth';
import { selfUpdateEmployeeSchema } from '@/modules/hrm/employees/employees.schema';
import {
  getMyEmployeeProfile,
  selfUpdateMyEmployeeProfile,
} from '@/modules/hrm/employees/employees.service';
import { ok } from '@/shared/api-response';

export const GET = withAuth(async (_request: NextRequest, _context, auth) => {
  const profile = await getMyEmployeeProfile(auth);
  return ok(profile);
});

export const PATCH = withAuth(async (request: NextRequest, _context, auth) => {
  const body: unknown = await request.json();
  const input = selfUpdateEmployeeSchema.parse(body);
  const updated = await selfUpdateMyEmployeeProfile(auth, input, getRequestIp(request));
  return ok(updated);
});
