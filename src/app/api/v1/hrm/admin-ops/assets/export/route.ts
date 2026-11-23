import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/middlewares/auth';
import { exportAssetsExcel } from '@/modules/hrm/office/assets.service';

export const dynamic = 'force-dynamic';

export const GET = withAuth(
  async (request: NextRequest, _context, auth) => {
    const sp = request.nextUrl.searchParams;
    const { buffer, fileName } = await exportAssetsExcel(auth, {
      branchId: sp.get('branchId'),
      category: sp.get('category'),
      status: sp.get('status'),
      search: sp.get('search'),
    });

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'no-store',
      },
    });
  },
  { permission: 'hrm.assets.export' },
);
