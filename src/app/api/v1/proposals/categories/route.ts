import { getRequestIp, withAuth } from '@/middlewares/auth';
import { createProposalCategorySchema } from '@/modules/proposals/proposals.schema';
import {
  createProposalCategory,
  listProposalCategories,
} from '@/modules/proposals/proposals.service';
import { AppError, created, ok } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

export const GET = withAuth(
  async (request) => {
    const includeInactive = request.nextUrl.searchParams.get('includeInactive') === 'true';
    const items = await listProposalCategories(includeInactive);
    return ok(items);
  },
  { permission: 'proposals.read' },
);

export const POST = withAuth(
  async (request, _context, auth) => {
    const rawBody = await request.json().catch(() => null);
    if (!rawBody || typeof rawBody !== 'object') {
      throw new AppError('INVALID_JSON', 'Dữ liệu danh mục không đúng định dạng JSON.', 400);
    }
    const input = createProposalCategorySchema.parse(rawBody);
    const item = await createProposalCategory(input, auth, getRequestIp(request));
    return created(item);
  },
  { permission: 'proposals.manage' },
);
