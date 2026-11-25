import { NextResponse } from 'next/server';
import { withAuth } from '@/middlewares/auth';
import { generateProposalPdf } from '@/modules/proposals/proposals-reports.service';
import { AppError } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

export const GET = withAuth<{ id: string }>(
  async (_request, context, auth) => {
    const { id } = await context.params;
    const proposalId = Number(id);
    if (!Number.isInteger(proposalId) || proposalId <= 0) {
      throw new AppError('INVALID_ID', 'ID đề xuất không hợp lệ.', 400);
    }
    const { filename, buffer } = await generateProposalPdf(auth, proposalId);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  },
  { permission: 'proposals.export' },
);
