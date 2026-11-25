import { NextRequest } from 'next/server';
import { withAuth } from '@/middlewares/auth';
import { updateProjectRisk } from '@/modules/projects/budget-risks.service';
import { updateRiskSchema } from '@/modules/projects/projects-advanced.schema';
import { AppError, ok } from '@/shared/api-response';

export const PATCH = withAuth<{ id: string; riskId: string }>(
  async (request: NextRequest, context, auth) => {
    const { id, riskId } = await context.params;
    const rid = Number(riskId);
    if (!Number.isInteger(rid) || rid <= 0) {
      throw new AppError('INVALID_RISK_ID', 'ID rủi ro/vấn đề không hợp lệ.', 400);
    }
    const input = updateRiskSchema.parse(await request.json());
    return ok(await updateProjectRisk(auth, id, rid, input));
  },
  { permission: 'pm.projects.read' },
);
