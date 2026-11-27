import { withAuth } from '@/middlewares/auth';
import { canViewBudgets, getBudgetsSummary } from '@/modules/payments/budgets.service';
import { AppError, ok } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

function toPositiveInt(raw: string | null): number | undefined {
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

export const GET = withAuth(async (request, _context, auth) => {
  if (!canViewBudgets(auth)) {
    throw new AppError('FORBIDDEN', 'Bạn không có quyền xem thống kê ngân sách.', 403);
  }
  const sp = request.nextUrl.searchParams;
  const summary = await getBudgetsSummary(auth, {
    fiscalYear: toPositiveInt(sp.get('fiscalYear')),
    branchId: toPositiveInt(sp.get('branchId')),
  });
  return ok(summary);
});
