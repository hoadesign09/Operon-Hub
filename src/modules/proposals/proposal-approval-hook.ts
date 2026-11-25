import type { Transaction } from 'kysely';
import type { DatabaseSchema, ProposalStatus } from '@/config/database';
import type { ApprovalCompletionPayload } from '@/modules/approvals/approval-hooks';
import { PROPOSAL_ENTITY_TYPE } from '@/modules/proposals/proposals.constants';

export async function handleProposalApprovalCompletion(
  trx: Transaction<DatabaseSchema>,
  payload: ApprovalCompletionPayload,
): Promise<void> {
  const proposal = await trx
    .selectFrom('proposals')
    .select(['id', 'status', 'estimated_budget'])
    .where('id', '=', payload.entityId)
    .where('deleted_at', 'is', null)
    .forUpdate()
    .executeTakeFirst();

  if (!proposal || proposal.status !== 'PENDING_APPROVAL') {
    return;
  }

  let nextStatus: ProposalStatus = 'CANCELLED';
  let actionType = 'CANCELLED';

  if (payload.nextStatus === 'APPROVED') {
    nextStatus = 'APPROVED';
    actionType = 'APPROVED';
  } else if (payload.nextStatus === 'REJECTED') {
    nextStatus = 'REJECTED';
    actionType = 'REJECTED';
  }

  await trx
    .updateTable('proposals')
    .set({
      status: nextStatus,
      approved_at: nextStatus === 'APPROVED' ? new Date() : null,
      approved_budget:
        nextStatus === 'APPROVED' ? Number(proposal.estimated_budget) : null,
      rejection_reason: nextStatus === 'REJECTED' ? payload.comment : null,
      updated_by: payload.actorUserId,
    })
    .where('id', '=', Number(proposal.id))
    .execute();

  await trx
    .insertInto('proposal_activities')
    .values({
      proposal_id: Number(proposal.id),
      actor_user_id: payload.actorUserId,
      action_type: actionType,
      detail_json: JSON.stringify({
        approvalRequestId: payload.approvalRequestId,
        comment: payload.comment,
      }),
    })
    .execute();
}

export { PROPOSAL_ENTITY_TYPE };
