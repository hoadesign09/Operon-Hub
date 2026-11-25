import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/middlewares/auth';
import { generateProjectStatusPdf } from '@/modules/projects/reports.service';

export const GET = withAuth<{ id: string }>(
  async (_request: NextRequest, context, auth) => {
    const { id } = await context.params;
    const { filename, buffer } = await generateProjectStatusPdf(auth, id);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  },
  { permission: 'pm.reports.export' },
);
