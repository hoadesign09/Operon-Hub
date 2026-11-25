import { NextRequest } from 'next/server';
import { getRequestIp, withAuth } from '@/middlewares/auth';
import { updateProjectMemberSchema } from '@/modules/projects/projects.schema';
import { removeProjectMember, updateProjectMember } from '@/modules/projects/projects.service';
import { AppError, ok } from '@/shared/api-response';

function parseMemberId(raw: string): number {
  const num = Number(raw);
  if (!Number.isInteger(num) || num <= 0) {
    throw new AppError('INVALID_ID', 'ID thành viên không hợp lệ.', 400);
  }
  return num;
}

export const PATCH = withAuth<{ id: string; memberId: string }>(
  async (request: NextRequest, context, auth) => {
    const { id, memberId } = await context.params;
    const body = await request.json();
    const input = updateProjectMemberSchema.parse(body);
    const members = await updateProjectMember(
      auth,
      id,
      parseMemberId(memberId),
      input,
      getRequestIp(request),
    );
    return ok(members);
  },
  { permission: 'pm.projects.read' },
);

export const DELETE = withAuth<{ id: string; memberId: string }>(
  async (request: NextRequest, context, auth) => {
    const { id, memberId } = await context.params;
    const members = await removeProjectMember(
      auth,
      id,
      parseMemberId(memberId),
      getRequestIp(request),
    );
    return ok(members);
  },
  { permission: 'pm.projects.read' },
);
