import { NextResponse } from 'next/server';
import { withAuth } from '@/middlewares/auth';
import { exportPaymentsExcel } from '@/modules/payments/payments-reports.service';

export const dynamic = 'force-dynamic';

function toPositiveInt(raw: string | null): number | undefined {
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

export const GET = withAuth(
  async (request, _context, auth) => {
    const sp = request.nextUrl.searchParams;
    const { filename, buffer } = await exportPaymentsExcel(auth, {
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
    });

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  },
  { permission: 'payments.export' },
);
