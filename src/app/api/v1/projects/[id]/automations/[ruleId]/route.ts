import { NextRequest } from 'next/server';
import { withAuth } from '@/middlewares/auth';
import { updateAutomationRuleSchema } from '@/modules/projects/projects-advanced.schema';
import { updateProjectAutomation } from '@/modules/projects/templates-automation.service';
import { AppError, ok } from '@/shared/api-response';

export const PATCH = withAuth<{ id: string; ruleId: string }>(
  async (request: NextRequest, context, auth) => {
    const { id, ruleId } = await context.params;
    const rid = Number(ruleId);
    if (!Number.isInteger(rid) || rid <= 0) {
      throw new AppError('INVALID_RULE_ID', 'ID luật tự động không hợp lệ.', 400);
    }
    const input = updateAutomationRuleSchema.parse(await request.json());
    return ok(await updateProjectAutomation(auth, id, rid, input));
  },
  { permission: 'pm.templates.manage' },
);
