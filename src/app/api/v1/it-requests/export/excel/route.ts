import { NextResponse } from 'next/server';
import { withAuth } from '@/middlewares/auth';
import { IT_REQUEST_PERMISSIONS } from '@/modules/it-requests/it-requests.constants';
import { exportItRequestsExcelBuffer } from '@/modules/it-requests/it-requests-reports.service';

export const dynamic = 'force-dynamic';

function toPositiveInt(raw: string | null): number | undefined {
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

export const GET = withAuth(
  async (request, _context, auth) => {
    const sp = request.nextUrl.searchParams;
    const buffer = await exportItRequestsExcelBuffer(auth, {
      scope: sp.get('scope') ?? undefined,
      status: sp.get('status') ?? undefined,
      priority: sp.get('priority') ?? undefined,
      requestKind: sp.get('requestKind') ?? undefined,
      categoryId: toPositiveInt(sp.get('categoryId')),
      branchId: toPositiveInt(sp.get('branchId')),
      assignedToUserId: toPositiveInt(sp.get('assignedToUserId')),
      search: sp.get('search') ?? undefined,
    });
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="it-requests-${stamp}.xlsx"`,
      },
    });
  },
  { permission: IT_REQUEST_PERMISSIONS.EXPORT },
);
