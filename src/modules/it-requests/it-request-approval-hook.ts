import type { Transaction } from 'kysely';
import type { DatabaseSchema, ItRequestStatus } from '@/config/database';
import { calculateSlaDeadlines } from '@/lib/portable/sla-calculator';
import type { ApprovalCompletionPayload } from '@/modules/approvals/approval-hooks';
import { IT_REQUEST_ENTITY_TYPE } from '@/modules/it-requests/it-requests.constants';

export async function handleItRequestApprovalCompletion(
  trx: Transaction<DatabaseSchema>,
  payload: ApprovalCompletionPayload,
): Promise<void> {
  const ticket = await trx
    .selectFrom('it_requests as r')
    .innerJoin('it_request_categories as c', 'c.id', 'r.category_id')
    .select([
      'r.id',
      'r.code',
      'r.status',
      'r.priority',
      'r.sla_paused_minutes',
      'c.sla_response_hours',
      'c.sla_resolution_hours',
    ])
    .where('r.id', '=', payload.entityId)
    .where('r.deleted_at', 'is', null)
    .forUpdate()
    .executeTakeFirst();

  if (!ticket || ticket.status !== 'PENDING_APPROVAL') {
    return;
  }

  let nextStatus: ItRequestStatus = 'CANCELLED';
  let action = 'APPROVAL_CANCELLED';
  let summary = 'Yêu cầu IT đã bị hủy trong quá trình phê duyệt.';
  let slaResponseDueAt: Date | null = null;
  let slaResolutionDueAt: Date | null = null;

  if (payload.nextStatus === 'APPROVED') {
    nextStatus = 'OPEN';
    action = 'APPROVAL_APPROVED';
    summary = 'Đã hoàn tất phê duyệt. Ticket chuyển sang hàng đợi IT và bắt đầu tính SLA xử lý.';
    const deadlines = calculateSlaDeadlines(
      new Date(),
      Number(ticket.sla_response_hours),
      Number(ticket.sla_resolution_hours),
      {
        priority: ticket.priority,
        pausedMinutes: Number(ticket.sla_paused_minutes ?? 0),
      },
    );
    slaResponseDueAt = deadlines.responseDueAt;
    slaResolutionDueAt = deadlines.resolutionDueAt;
  } else if (payload.nextStatus === 'REJECTED') {
    nextStatus = 'REJECTED';
    action = 'APPROVAL_REJECTED';
    summary = payload.comment
      ? `Yêu cầu IT bị từ chối phê duyệt: ${payload.comment}`
      : 'Yêu cầu IT bị từ chối phê duyệt.';
  }

  await trx
    .updateTable('it_requests')
    .set({
      status: nextStatus,
      sla_response_due_at: nextStatus === 'OPEN' ? slaResponseDueAt : null,
      sla_resolution_due_at: nextStatus === 'OPEN' ? slaResolutionDueAt : null,
      rejection_reason: nextStatus === 'REJECTED' ? payload.comment : null,
      updated_by: payload.actorUserId,
    })
    .where('id', '=', Number(ticket.id))
    .execute();

  await trx
    .insertInto('it_request_activities')
    .values({
      it_request_id: Number(ticket.id),
      actor_user_id: payload.actorUserId,
      action,
      summary,
      metadata_json: JSON.stringify({
        approvalRequestId: payload.approvalRequestId,
        comment: payload.comment,
        nextStatus,
      }),
    })
    .execute();
}

export { IT_REQUEST_ENTITY_TYPE };
