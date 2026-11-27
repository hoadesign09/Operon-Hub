import { withAuth } from '@/middlewares/auth';
import { ensureApprovalHooksRegistered } from '@/modules/approvals/register-module-hooks';
import { IT_REQUEST_PERMISSIONS } from '@/modules/it-requests/it-requests.constants';
import { submitItRequest } from '@/modules/it-requests/it-requests.service';
import { AppError, ok } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

export const POST = withAuth<{ id: string }>(
  async (_request, context, auth) => {
    ensureApprovalHooksRegistered();
    const { id } = await context.params;
    const ticketId = Number(id);
    if (!Number.isInteger(ticketId) || ticketId <= 0) {
      throw new AppError('INVALID_ID', 'ID yêu cầu IT không hợp lệ.', 400);
    }
    const detail = await submitItRequest(auth, ticketId);
    return ok(detail);
  },
  { permission: IT_REQUEST_PERMISSIONS.CREATE },
);
