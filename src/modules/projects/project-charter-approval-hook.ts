import type { Transaction } from 'kysely';
import type { DatabaseSchema, ProjectStatus } from '@/config/database';
import type { ApprovalCompletionPayload } from '@/modules/approvals/approval-hooks';
import { PROJECT_CHARTER_ENTITY_TYPE } from '@/modules/projects/projects.constants';

export async function handleProjectCharterApprovalCompletion(
  trx: Transaction<DatabaseSchema>,
  payload: ApprovalCompletionPayload,
): Promise<void> {
  const project = await trx
    .selectFrom('projects')
    .select(['id', 'status'])
    .where('id', '=', payload.entityId)
    .where('deleted_at', 'is', null)
    .forUpdate()
    .executeTakeFirst();

  if (!project || project.status !== 'PENDING_APPROVAL') {
    return;
  }

  const nextProjectStatus: ProjectStatus =
    payload.nextStatus === 'APPROVED' ? 'PLANNING' : 'DRAFT';

  await trx
    .updateTable('projects')
    .set({
      status: nextProjectStatus,
      updated_by: payload.actorUserId,
    })
    .where('id', '=', Number(project.id))
    .execute();
}

export { PROJECT_CHARTER_ENTITY_TYPE };
