import { NextRequest } from 'next/server';
import { withAuth } from '@/middlewares/auth';
import { updateChecklistSchema } from '@/modules/projects/projects.schema';
import { updateChecklistItem } from '@/modules/projects/tasks.service';
import { AppError, ok } from '@/shared/api-response';

function parsePositiveId(raw: string): number {
  const num = Number(raw);
  if (!Number.isInteger(num) || num <= 0) {
    throw new AppError('INVALID_ID', 'ID không hợp lệ.', 400);
  }
  return num;
}

export const PATCH = withAuth<{ id: string; checklistId: string }>(
  async (request: NextRequest, context, auth) => {
    const { id, checklistId } = await context.params;
    const body = await request.json();
    const input = updateChecklistSchema.parse(body);
    const checklists = await updateChecklistItem(
      auth,
      parsePositiveId(id),
      parsePositiveId(checklistId),
      input,
    );
    return ok(checklists);
  },
  { permission: 'pm.tasks.update' },
);
