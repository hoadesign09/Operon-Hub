import dayjs from 'dayjs';
import type { Transaction } from 'kysely';
import type { DatabaseSchema } from '@/config/database';
import type { ApprovalCompletionPayload } from '@/modules/approvals/approval-hooks';
import { roundLeaveDays } from '@/modules/hrm/requests/leave-calculator';

export const LEAVE_REQUEST_ENTITY_TYPE = 'leave_requests';

function toYear(dateVal: Date | string): number {
  return dayjs(dateVal).year();
}

export async function handleLeaveApprovalCompletion(
  trx: Transaction<DatabaseSchema>,
  payload: ApprovalCompletionPayload,
): Promise<void> {
  const leaveRow = await trx
    .selectFrom('leave_requests')
    .select([
      'id',
      'employee_id',
      'leave_type_id',
      'start_date',
      'total_days',
      'status',
    ])
    .where('id', '=', payload.entityId)
    .where('deleted_at', 'is', null)
    .forUpdate()
    .executeTakeFirst();

  if (!leaveRow || leaveRow.status !== 'PENDING') {
    return;
  }

  await trx
    .updateTable('leave_requests')
    .set({
      status: payload.nextStatus,
      updated_by: payload.actorUserId,
    })
    .where('id', '=', Number(leaveRow.id))
    .execute();

  const leaveType = await trx
    .selectFrom('leave_types')
    .select(['id', 'default_days_per_year'])
    .where('id', '=', Number(leaveRow.leave_type_id))
    .executeTakeFirst();

  if (!leaveType || Number(leaveType.default_days_per_year) <= 0) {
    return;
  }

  const leaveYear = toYear(leaveRow.start_date);
  const totalDays = Number(leaveRow.total_days);

  const balanceRow = await trx
    .selectFrom('leave_balances')
    .select(['id', 'used_days', 'pending_days'])
    .where('employee_id', '=', Number(leaveRow.employee_id))
    .where('leave_type_id', '=', Number(leaveRow.leave_type_id))
    .where('year', '=', leaveYear)
    .where('deleted_at', 'is', null)
    .forUpdate()
    .executeTakeFirst();

  if (!balanceRow) {
    return;
  }

  const currentPending = Number(balanceRow.pending_days);
  const currentUsed = Number(balanceRow.used_days);
  const nextPending = roundLeaveDays(Math.max(0, currentPending - totalDays));
  const nextUsed =
    payload.nextStatus === 'APPROVED'
      ? roundLeaveDays(currentUsed + totalDays)
      : currentUsed;

  await trx
    .updateTable('leave_balances')
    .set({
      pending_days: nextPending,
      used_days: nextUsed,
      updated_by: payload.actorUserId,
    })
    .where('id', '=', Number(balanceRow.id))
    .execute();
}
