import { withAuth } from '@/middlewares/auth';
import { IT_REQUEST_PERMISSIONS } from '@/modules/it-requests/it-requests.constants';
import { createItCategorySchema } from '@/modules/it-requests/it-requests.schema';
import { createItCategory, listItCategories } from '@/modules/it-requests/it-requests.service';
import { AppError, created, ok } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

export const GET = withAuth(
  async (request) => {
    const includeInactive = request.nextUrl.searchParams.get('includeInactive') === 'true';
    const items = await listItCategories(includeInactive);
    return ok(items);
  },
  { permission: IT_REQUEST_PERMISSIONS.READ },
);

export const POST = withAuth(
  async (request, _context, auth) => {
    const rawBody = await request.json().catch(() => null);
    if (!rawBody || typeof rawBody !== 'object') {
      throw new AppError('INVALID_JSON', 'Dữ liệu yêu cầu không đúng định dạng JSON.', 400);
    }
    const input = createItCategorySchema.parse(rawBody);
    const category = await createItCategory(auth, input);
    return created(category);
  },
  { permission: IT_REQUEST_PERMISSIONS.MANAGE },
);
