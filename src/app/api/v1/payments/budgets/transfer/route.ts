import { withAuth } from '@/middlewares/auth';
import { transferBudgetSchema } from '@/modules/payments/budgets.schema';
import { canManageBudgets, transferBudgetAllocation } from '@/modules/payments/budgets.service';
import { AppError, ok } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

export const POST = withAuth(async (request, _context, auth) => {
  if (!canManageBudgets(auth)) {
    throw new AppError('FORBIDDEN', 'Bạn không có quyền điều chuyển ngân sách giữa các quỹ.', 403);
  }
  const rawBody = await request.json().catch(() => null);
  if (!rawBody || typeof rawBody !== 'object') {
    throw new AppError('INVALID_JSON', 'Dữ liệu yêu cầu không đúng định dạng JSON.', 400);
  }
  const input = transferBudgetSchema.parse(rawBody);
  const ip = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip');
  const result = await transferBudgetAllocation(auth, input, ip);
  return ok(result);
});
