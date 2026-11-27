import { withAuth } from '@/middlewares/auth';
import { createPaymentCategorySchema } from '@/modules/payments/payments.schema';
import {
  createPaymentCategory,
  listPaymentCategories,
} from '@/modules/payments/payments.service';
import { AppError, created, ok } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

export const GET = withAuth(
  async (request) => {
    const includeInactive = request.nextUrl.searchParams.get('includeInactive') === 'true';
    const categories = await listPaymentCategories(includeInactive);
    return ok(categories);
  },
  { permission: 'payments.read' },
);

export const POST = withAuth(
  async (request, _context, auth) => {
    const rawBody = await request.json().catch(() => null);
    if (!rawBody || typeof rawBody !== 'object') {
      throw new AppError('INVALID_JSON', 'Dữ liệu danh mục không đúng định dạng JSON.', 400);
    }
    const input = createPaymentCategorySchema.parse(rawBody);
    const ip = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip');
    const createdCat = await createPaymentCategory(auth, input, ip);
    return created(createdCat);
  },
  { permission: 'payments.manage' },
);
