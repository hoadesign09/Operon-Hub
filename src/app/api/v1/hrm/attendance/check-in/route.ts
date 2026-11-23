import { NextRequest } from 'next/server';
import { getRequestIp, withAuth } from '@/middlewares/auth';
import { checkInOutSchema } from '@/modules/hrm/attendance/attendance.schema';
import { checkInMe } from '@/modules/hrm/attendance/attendance-logs.service';
import { created } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

export const POST = withAuth(async (request: NextRequest, _context, auth) => {
  const rawBody = await request.json().catch(() => ({}));
  const input = checkInOutSchema.parse(
    rawBody && typeof rawBody === 'object' ? rawBody : {},
  );
  const log = await checkInMe(auth, input, getRequestIp(request));
  return created({ log });
});
