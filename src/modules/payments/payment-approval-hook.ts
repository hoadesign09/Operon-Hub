import type { Transaction } from 'kysely';
import type { DatabaseSchema, PaymentStatus } from '@/config/database';
import type { ApprovalCompletionPayload } from '@/modules/approvals/approval-hooks';
import { releasePaymentBudgetReserve } from '@/modules/payments/budget-ledger.service';
import { PAYMENT_ENTITY_TYPE } from '@/modules/payments/payments.constants';

export async function handlePaymentApprovalCompletion(
  trx: Transaction<DatabaseSchema>,
  payload: ApprovalCompletionPayload,
): Promise<void> {
  const payment = await trx
    .selectFrom('payment_requests')
    .select([
      'id',
      'code',
      'payment_type',
      'status',
      'total_amount',
      'net_settlement_amount',
      'linked_advance_id',
      'budget_id',
      'budget_reserved_amount',
    ])
    .where('id', '=', payload.entityId)
    .where('deleted_at', 'is', null)
    .forUpdate()
    .executeTakeFirst();

  if (!payment || payment.status !== 'PENDING_APPROVAL') {
    return;
  }

  const now = new Date();
  let nextStatus: PaymentStatus = 'CANCELLED';
  let action = 'APPROVAL_CANCELLED';
  let summary = 'Phiếu thanh toán đã bị hủy trong quá trình phê duyệt.';
  let autoSettledBalanced = false;

  if (payload.nextStatus === 'APPROVED') {
    const netSettlement = Number(payment.net_settlement_amount ?? 0);
    if (payment.payment_type === 'ADVANCE_SETTLEMENT' && Math.abs(netSettlement) < 0.01) {
      nextStatus = 'PAID';
      action = 'APPROVED_AND_SETTLED';
      summary =
        'Đã hoàn tất phê duyệt quyết toán tạm ứng (khớp số 0 ₫). Hệ thống tự động hoàn tất và đóng phiếu tạm ứng gốc.';
      autoSettledBalanced = true;
    } else {
      nextStatus = 'APPROVED';
      action = 'APPROVAL_APPROVED';
      summary = 'Đã hoàn tất phê duyệt đa cấp. Chuyển sang Kế toán chờ giải ngân / xác nhận.';
    }
  } else if (payload.nextStatus === 'REJECTED') {
    nextStatus = 'REJECTED';
    action = 'APPROVAL_REJECTED';
    summary = payload.comment
      ? `Phiếu thanh toán bị từ chối: ${payload.comment}`
      : 'Phiếu thanh toán bị từ chối phê duyệt.';
  }

  if (
    (nextStatus === 'REJECTED' || nextStatus === 'CANCELLED') &&
    payment.budget_id &&
    Number(payment.budget_reserved_amount ?? 0) > 0
  ) {
    await releasePaymentBudgetReserve(trx, {
      paymentId: Number(payment.id),
      paymentCode: payment.code,
      actorUserId: payload.actorUserId,
      reason:
        nextStatus === 'REJECTED'
          ? `Hoàn trả giữ chỗ do Phiếu thanh toán ${payment.code} bị từ chối duyệt`
          : `Hoàn trả giữ chỗ do Phiếu thanh toán ${payment.code} bị hủy trong quá trình duyệt`,
    });
  }

  await trx
    .updateTable('payment_requests')
    .set({
      status: nextStatus,
      approved_at:
        nextStatus === 'APPROVED' || nextStatus === 'PAID' ? now : null,
      approved_amount:
        nextStatus === 'APPROVED' || nextStatus === 'PAID'
          ? Number(payment.total_amount)
          : null,
      paid_at: autoSettledBalanced ? now : null,
      rejection_reason: nextStatus === 'REJECTED' ? payload.comment : null,
      updated_by: payload.actorUserId,
    })
    .where('id', '=', Number(payment.id))
    .execute();

  if (autoSettledBalanced && payment.linked_advance_id) {
    await trx
      .updateTable('payment_requests')
      .set({
        is_settled: 1,
        settled_by_payment_id: Number(payment.id),
        updated_by: payload.actorUserId,
      })
      .where('id', '=', Number(payment.linked_advance_id))
      .execute();
  }

  await trx
    .insertInto('payment_activities')
    .values({
      payment_request_id: Number(payment.id),
      actor_user_id: payload.actorUserId,
      action,
      summary,
      metadata_json: JSON.stringify({
        approvalRequestId: payload.approvalRequestId,
        comment: payload.comment,
        nextStatus,
        autoSettledBalanced,
      }),
    })
    .execute();
}

export { PAYMENT_ENTITY_TYPE };
