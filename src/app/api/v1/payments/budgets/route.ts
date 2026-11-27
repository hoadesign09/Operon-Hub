import { withAuth } from '@/middlewares/auth';
import { createBudgetSchema } from '@/modules/payments/budgets.schema';
import {
  canManageBudgets,
  canViewBudgets,
  createBudget,
  listBudgets,
} from '@/modules/payments/budgets.service';
import { AppError, created, ok } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

function toPositiveInt(raw: string | null): number | undefined {
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

export const GET = withAuth(async (request, _context, auth) => {
  if (!canViewBudgets(auth)) {
    throw new AppError('FORBIDDEN', 'Bạn không có quyền xem quản lý ngân sách.', 403);
  }
  const sp = request.nextUrl.searchParams;
  const result = await listBudgets(auth, {
    fiscalYear: toPositiveInt(sp.get('fiscalYear')),
    periodType: sp.get('periodType') ?? undefined,
    status: sp.get('status') ?? undefined,
    branchId: toPositiveInt(sp.get('branchId')),
    departmentId: toPositiveInt(sp.get('departmentId')),
    categoryId: toPositiveInt(sp.get('categoryId')),
    health: sp.get('health') ?? undefined,
    search: sp.get('search') ?? undefined,
    page: toPositiveInt(sp.get('page')),
    limit: toPositiveInt(sp.get('limit')),
  });
  return ok(result.items, result.meta);
});

export const POST = withAuth(async (request, _context, auth) => {
  if (!canManageBudgets(auth)) {
    throw new AppError('FORBIDDEN', 'Bạn không có quyền tạo quỹ ngân sách mới.', 403);
  }
  const rawBody = await request.json().catch(() => null);
  if (!rawBody || typeof rawBody !== 'object') {
    throw new AppError('INVALID_JSON', 'Dữ liệu yêu cầu không đúng định dạng JSON.', 400);
  }
  const input = createBudgetSchema.parse(rawBody);
  const ip = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip');
  const detail = await createBudget(auth, input, ip);
  return created(detail);
});
