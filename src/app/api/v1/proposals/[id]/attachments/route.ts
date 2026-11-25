import { withAuth } from '@/middlewares/auth';
import {
  listProposalAttachments,
  uploadProposalAttachment,
} from '@/modules/proposals/proposals-collab.service';
import { AppError, created, ok } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

function parseProposalId(raw: string): number {
  const num = Number(raw);
  if (!Number.isInteger(num) || num <= 0) {
    throw new AppError('INVALID_ID', 'ID đề xuất không hợp lệ.', 400);
  }
  return num;
}

export const GET = withAuth<{ id: string }>(
  async (_request, context, auth) => {
    const { id } = await context.params;
    const items = await listProposalAttachments(auth, parseProposalId(id));
    return ok(items);
  },
  { permission: 'proposals.read' },
);

export const POST = withAuth<{ id: string }>(
  async (request, context, auth) => {
    const { id } = await context.params;
    const formData = await request.formData();
    const rawFile = formData.get('file');
    if (!(rawFile instanceof File)) {
      throw new AppError('MISSING_FILE', 'Vui lòng chọn tệp tài liệu để tải lên.', 400);
    }
    const items = await uploadProposalAttachment(auth, parseProposalId(id), rawFile);
    return created(items);
  },
  { permission: 'proposals.create' },
);
