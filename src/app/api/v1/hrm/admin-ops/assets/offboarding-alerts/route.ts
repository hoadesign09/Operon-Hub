import { NextRequest } from 'next/server';
import { withAuth } from '@/middlewares/auth';
import { listOffboardingAssetAlerts } from '@/modules/hrm/office/assets.service';
import { ok } from '@/shared/api-response';

export const dynamic = 'force-dynamic';

export const GET = withAuth(
  async (_request: NextRequest, _context, auth) => {
    const items = await listOffboardingAssetAlerts(auth);
    return ok({ items });
  },
  { permission: 'hrm.assets.read' },
);
