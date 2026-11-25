import { NextRequest } from 'next/server';
import { withAuth } from '@/middlewares/auth';
import { convertRiskToActionTask } from '@/modules/projects/budget-risks.service';
import { AppError, created } from '@/shared/api-response';

export const POST = withAuth<{ id: string; riskId: string }>(
  async (_request: NextRequest, context, auth) => {
    const { id, riskId } = await context.params;
    const rid = Number(riskId);
    if (!Number.isInteger(rid) || rid <= 0) {
      throw new AppError('INVALID_RISK_ID', 'ID rủi ro/vấn đề không hợp lệ.', 400);
    }
    return created(await convertRiskToActionTask(auth, id, rid));
  },
  { permission: 'pm.tasks.create' },
);
