import type { Transaction } from 'kysely';
import type { DatabaseSchema } from '@/config/database';
import type { ApprovalCompletionPayload } from '@/modules/approvals/approval-hooks';

export const OVERTIME_REQUEST_ENTITY_TYPE = 'overtime_requests';
export const BUSINESS_TRIP_REQUEST_ENTITY_TYPE = 'business_trip_requests';

export async function handleOvertimeApprovalCompletion(
  trx: Transaction<DatabaseSchema>,
  payload: ApprovalCompletionPayload,
): Promise<void> {
  const row = await trx
    .selectFrom('overtime_requests')
    .select(['id', 'status'])
    .where('id', '=', payload.entityId)
    .where('deleted_at', 'is', null)
    .forUpdate()
    .executeTakeFirst();

  if (!row || row.status !== 'PENDING') {
    return;
  }

  await trx
    .updateTable('overtime_requests')
    .set({
      status: payload.nextStatus,
      updated_by: payload.actorUserId,
    })
    .where('id', '=', Number(row.id))
    .execute();
}

export async function handleBusinessTripApprovalCompletion(
  trx: Transaction<DatabaseSchema>,
  payload: ApprovalCompletionPayload,
): Promise<void> {
  const row = await trx
    .selectFrom('business_trip_requests')
    .select(['id', 'status'])
    .where('id', '=', payload.entityId)
    .where('deleted_at', 'is', null)
    .forUpdate()
    .executeTakeFirst();

  if (!row || row.status !== 'PENDING') {
    return;
  }

  await trx
    .updateTable('business_trip_requests')
    .set({
      status: payload.nextStatus,
      updated_by: payload.actorUserId,
    })
    .where('id', '=', Number(row.id))
    .execute();
}
