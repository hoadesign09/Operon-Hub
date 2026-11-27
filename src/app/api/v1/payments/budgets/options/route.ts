import { withAuth } from '@/middlewares/auth';
import { listActiveBudgetOptions } from '@/modules/payments/budgets.service';
import { AppError, ok } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

function toPositiveInt(raw: string | null): number | undefined {
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

export const GET = withAuth(async (request, _context, auth) => {
  const canReadOptions =
    auth.isSuperAdmin ||
    auth.permissions.includes('payments.read') ||
    auth.permissions.includes('payments.create') ||
    auth.permissions.includes('payments.budgets.read') ||
    auth.permissions.includes('proposals.read') ||
    auth.permissions.includes('proposals.create');

  if (!canReadOptions) {
    throw new AppError('FORBIDDEN', 'Bạn không có quyền truy cập danh sách quỹ ngân sách khả dụng.', 403);
  }

  const sp = request.nextUrl.searchParams;
  const options = await listActiveBudgetOptions(auth, {
    branchId: toPositiveInt(sp.get('branchId')),
    departmentId: toPositiveInt(sp.get('departmentId')),
    fiscalYear: toPositiveInt(sp.get('fiscalYear')),
  });
  return ok(options);
});
