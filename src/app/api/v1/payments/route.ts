import { withAuth } from '@/middlewares/auth';
import { ensureApprovalHooksRegistered } from '@/modules/approvals/register-module-hooks';
import { createPaymentSchema } from '@/modules/payments/payments.schema';
import { createPaymentRequest, listPayments } from '@/modules/payments/payments.service';
import { AppError, created, ok } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

function toPositiveInt(raw: string | null): number | undefined {
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

export const GET = withAuth(
  async (request, _context, auth) => {
    const sp = request.nextUrl.searchParams;
    const result = await listPayments(auth, {
      scope: sp.get('scope') ?? undefined,
      paymentType: sp.get('paymentType') ?? undefined,
      status: sp.get('status') ?? undefined,
      priority: sp.get('priority') ?? undefined,
      categoryId: toPositiveInt(sp.get('categoryId')),
      branchId: toPositiveInt(sp.get('branchId')),
      budgetId: toPositiveInt(sp.get('budgetId')),
      fromDate: sp.get('fromDate') ?? undefined,
      toDate: sp.get('toDate') ?? undefined,
      search: sp.get('search') ?? undefined,
      page: toPositiveInt(sp.get('page')),
      limit: toPositiveInt(sp.get('limit')),
    });
    return ok(result.items, result.meta);
  },
  { permission: 'payments.read' },
);

export const POST = withAuth(
  async (request, _context, auth) => {
    ensureApprovalHooksRegistered();
    const rawBody = await request.json().catch(() => null);
    if (!rawBody || typeof rawBody !== 'object') {
      throw new AppError('INVALID_JSON', 'Dữ liệu yêu cầu không đúng định dạng JSON.', 400);
    }
    const input = createPaymentSchema.parse(rawBody);
    const ip = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip');
    const detail = await createPaymentRequest(auth, input, ip);
    return created(detail);
  },
  { permission: 'payments.create' },
);
