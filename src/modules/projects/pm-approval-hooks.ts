import type { Transaction } from 'kysely';
import type { DatabaseSchema, MilestoneStatus, ProjectBudgetStatus } from '@/config/database';
import type { ApprovalCompletionPayload } from '@/modules/approvals/approval-hooks';
import {
  PROJECT_BUDGET_ENTITY_TYPE,
  PROJECT_MILESTONE_ENTITY_TYPE,
} from '@/modules/projects/projects.constants';

export async function handleMilestoneSignoffApprovalCompletion(
  trx: Transaction<DatabaseSchema>,
  payload: ApprovalCompletionPayload,
): Promise<void> {
  const milestone = await trx
    .selectFrom('project_milestones')
    .select(['id', 'status'])
    .where('id', '=', payload.entityId)
    .where('deleted_at', 'is', null)
    .forUpdate()
    .executeTakeFirst();

  if (!milestone || milestone.status !== 'PENDING_SIGNOFF') {
    return;
  }

  const nextStatus: MilestoneStatus =
    payload.nextStatus === 'APPROVED' ? 'COMPLETED' : 'IN_PROGRESS';

  await trx
    .updateTable('project_milestones')
    .set({
      status: nextStatus,
      completed_at: payload.nextStatus === 'APPROVED' ? new Date() : null,
      updated_by: payload.actorUserId,
    })
    .where('id', '=', Number(milestone.id))
    .execute();
}

export async function handleBudgetChangeApprovalCompletion(
  trx: Transaction<DatabaseSchema>,
  payload: ApprovalCompletionPayload,
): Promise<void> {
  const item = await trx
    .selectFrom('project_budget_items')
    .select(['id', 'project_id', 'status'])
    .where('id', '=', payload.entityId)
    .where('deleted_at', 'is', null)
    .forUpdate()
    .executeTakeFirst();

  if (!item || item.status !== 'PENDING_APPROVAL') {
    return;
  }

  const nextStatus: ProjectBudgetStatus =
    payload.nextStatus === 'APPROVED' ? 'APPROVED' : 'PLANNED';

  await trx
    .updateTable('project_budget_items')
    .set({
      status: nextStatus,
      updated_by: payload.actorUserId,
    })
    .where('id', '=', Number(item.id))
    .execute();

  if (payload.nextStatus === 'APPROVED') {
    const totals = await trx
      .selectFrom('project_budget_items')
      .select((eb) => [
        eb.fn.sum<string>('planned_amount').as('totalPlanned'),
        eb.fn.sum<string>('actual_amount').as('totalActual'),
      ])
      .where('project_id', '=', Number(item.project_id))
      .where('status', 'in', ['APPROVED', 'SPENT'])
      .where('deleted_at', 'is', null)
      .executeTakeFirst();

    await trx
      .updateTable('projects')
      .set({
        planned_budget: Number(totals?.totalPlanned ?? 0),
        actual_cost: Number(totals?.totalActual ?? 0),
        updated_by: payload.actorUserId,
      })
      .where('id', '=', Number(item.project_id))
      .execute();
  }
}

export { PROJECT_BUDGET_ENTITY_TYPE, PROJECT_MILESTONE_ENTITY_TYPE };
