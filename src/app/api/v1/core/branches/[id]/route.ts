import { getRequestIp, withAuth } from '@/middlewares/auth';
import { updateBranchSchema } from '@/modules/branches/branches.schema';
import { softDeleteBranch, updateBranch } from '@/modules/branches/branches.service';
import { AppError, ok } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

function parseBranchId(rawId: string): number {
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError('INVALID_ID', 'Mã ID chi nhánh không hợp lệ.', 400);
  }
  return id;
}

export const PATCH = withAuth<{ id: string }>(
  async (request, context, auth) => {
    const { id: rawId } = await context.params;
    const branchId = parseBranchId(rawId);

    const rawBody = await request.json().catch(() => null);
    if (!rawBody || typeof rawBody !== 'object') {
      throw new AppError('INVALID_JSON', 'Dữ liệu yêu cầu không đúng định dạng JSON.', 400);
    }

    const input = updateBranchSchema.parse(rawBody);
    const updated = await updateBranch(branchId, input, auth.userId, getRequestIp(request));
    return ok(updated);
  },
  { permission: 'core.branches.update' },
);

export const DELETE = withAuth<{ id: string }>(
  async (request, context, auth) => {
    const { id: rawId } = await context.params;
    const branchId = parseBranchId(rawId);

    await softDeleteBranch(branchId, auth.userId, getRequestIp(request));
    return ok({ deleted: true, id: branchId });
  },
  { permission: 'core.branches.delete' },
);
