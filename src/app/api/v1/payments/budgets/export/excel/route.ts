import { NextResponse } from 'next/server';
import { withAuth } from '@/middlewares/auth';
import { canManageBudgets, canViewBudgets, exportBudgetsExcel } from '@/modules/payments/budgets.service';
import { AppError } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

function toPositiveInt(raw: string | null): number | undefined {
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

export const GET = withAuth(async (request, _context, auth) => {
  const canExport =
    canManageBudgets(auth) ||
    (canViewBudgets(auth) && auth.permissions.includes('payments.export'));
  if (!canExport) {
    throw new AppError('FORBIDDEN', 'Bạn không có quyền xuất báo cáo ngân sách Excel.', 403);
  }
  const sp = request.nextUrl.searchParams;
  const { filename, buffer } = await exportBudgetsExcel(auth, {
    fiscalYear: toPositiveInt(sp.get('fiscalYear')),
    periodType: sp.get('periodType') ?? undefined,
    status: sp.get('status') ?? undefined,
    branchId: toPositiveInt(sp.get('branchId')),
    departmentId: toPositiveInt(sp.get('departmentId')),
    categoryId: toPositiveInt(sp.get('categoryId')),
    health: sp.get('health') ?? undefined,
    search: sp.get('search') ?? undefined,
  });

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
});
