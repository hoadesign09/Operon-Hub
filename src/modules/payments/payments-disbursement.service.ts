import { getDb, type PaymentStatus } from '@/config/database';
import { roundCurrency } from '@/lib/portable/currency-utils';
import { evaluateDisbursementProgress } from '@/lib/portable/payment-calculator';
import { recordAuditLog } from '@/modules/audit/audit.service';
import type { AuthContext } from '@/modules/auth/auth.service';
import { createNotification } from '@/modules/notifications/notifications.service';
import { applyDisbursementToBudget } from '@/modules/payments/budget-ledger.service';
import { PAYMENT_MODULE_CODE } from '@/modules/payments/payments.constants';
import type { CreatePaymentDisbursementInput } from '@/modules/payments/payments.schema';
import {
  getPaymentDetail,
  type PaymentDetailView,
} from '@/modules/payments/payments.service';
import { AppError } from '@/shared/api-response';

export async function recordPaymentDisbursement(
  auth: AuthContext,
  paymentId: number,
  input: CreatePaymentDisbursementInput,
  ipAddress?: string | null,
): Promise<PaymentDetailView> {
  const db = getDb();

  const outcome = await db.transaction().execute(async (trx) => {
    const payment = await trx
      .selectFrom('payment_requests')
      .select([
        'id',
        'code',
        'title',
        'payment_type',
        'status',
        'requester_user_id',
        'budget_id',
        'linked_advance_id',
        'net_settlement_amount',
        'payable_amount',
        'disbursed_amount',
        'budget_reserved_amount',
        'budget_spent_amount',
      ])
      .where('id', '=', paymentId)
      .where('deleted_at', 'is', null)
      .forUpdate()
      .executeTakeFirst();

    if (!payment) {
      throw new AppError('PAYMENT_NOT_FOUND', 'Không tìm thấy đề nghị thanh toán.', 404);
    }

    if (!['APPROVED', 'PARTIALLY_PAID'].includes(payment.status)) {
      throw new AppError(
        'PAYMENT_NOT_READY_FOR_DISBURSEMENT',
        'Chỉ cho phép ghi nhận giải ngân khi phiếu ở trạng thái Đã duyệt hoặc Đang chi trả từng phần.',
        409,
      );
    }

    const netSettlement = Number(payment.net_settlement_amount ?? 0);
    const isRefundCase = payment.payment_type === 'ADVANCE_SETTLEMENT' && netSettlement < 0;
    const expectedDirection = isRefundCase ? 'INCOMING_REFUND' : 'OUTGOING';
    const targetAmount = isRefundCase
      ? Math.abs(netSettlement)
      : Number(payment.payable_amount ?? 0);
    const currentDisbursed = Number(payment.disbursed_amount ?? 0);
    const amount = roundCurrency(input.amount);
    const remaining = roundCurrency(Math.max(0, targetAmount - currentDisbursed));

    if (remaining <= 0) {
      throw new AppError(
        'PAYMENT_ALREADY_SETTLED',
        'Phiếu thanh toán này đã hoàn tất đủ số tiền cần giải ngân/thu hồi.',
        409,
      );
    }

    if (amount > remaining + 0.01) {
      throw new AppError(
        'DISBURSEMENT_EXCEEDS_REMAINING',
        `Số tiền ghi nhận (${amount.toLocaleString('vi-VN')} ₫) vượt quá số tiền còn lại (${remaining.toLocaleString('vi-VN')} ₫).`,
        409,
      );
    }

    await trx
      .insertInto('payment_disbursements')
      .values({
        payment_request_id: paymentId,
        direction: expectedDirection,
        disbursement_date: input.disbursementDate,
        amount,
        payment_method: input.paymentMethod,
        bank_transaction_ref: input.bankTransactionRef?.trim() || null,
        source_account: input.sourceAccount?.trim() || null,
        note: input.note?.trim() || null,
        disbursed_by_user_id: auth.userId,
      })
      .execute();

    const nextDisbursed = roundCurrency(currentDisbursed + amount);
    const progress = evaluateDisbursementProgress(targetAmount, nextDisbursed);
    const nextStatus: PaymentStatus = progress.stage === 'PAID' ? 'PAID' : 'PARTIALLY_PAID';
    const now = new Date();

    await trx
      .updateTable('payment_requests')
      .set({
        disbursed_amount: nextDisbursed,
        status: nextStatus,
        paid_at: nextStatus === 'PAID' ? now : null,
        updated_by: auth.userId,
      })
      .where('id', '=', paymentId)
      .execute();

    if (payment.budget_id) {
      await applyDisbursementToBudget(trx, {
        budgetId: Number(payment.budget_id),
        paymentId,
        paymentCode: payment.code,
        direction: expectedDirection,
        amount,
        currentPaymentReserved: Number(payment.budget_reserved_amount ?? 0),
        currentPaymentSpent: Number(payment.budget_spent_amount ?? 0),
        actorUserId: auth.userId,
        bankRef: input.bankTransactionRef?.trim() || null,
      });
    }

    if (
      nextStatus === 'PAID' &&
      payment.payment_type === 'ADVANCE_SETTLEMENT' &&
      payment.linked_advance_id
    ) {
      await trx
        .updateTable('payment_requests')
        .set({
          is_settled: 1,
          settled_by_payment_id: paymentId,
          updated_by: auth.userId,
        })
        .where('id', '=', Number(payment.linked_advance_id))
        .execute();
    }

    const actionVerb = isRefundCase ? 'thu hồi hoàn quỹ' : 'giải ngân';
    const refText = input.bankTransactionRef ? ` (Mã GD: ${input.bankTransactionRef})` : '';
    await trx
      .insertInto('payment_activities')
      .values({
        payment_request_id: paymentId,
        actor_user_id: auth.userId,
        action: nextStatus === 'PAID' ? 'PAID_FULL' : 'DISBURSED_PARTIAL',
        summary: `Ghi nhận ${actionVerb} ${amount.toLocaleString('vi-VN')} ₫${refText}. Tiến độ: ${progress.progressPercent}%`,
        metadata_json: JSON.stringify({
          direction: expectedDirection,
          amount,
          nextDisbursed,
          nextStatus,
          bankTransactionRef: input.bankTransactionRef ?? null,
        }),
      })
      .execute();

    return {
      code: payment.code,
      title: payment.title,
      requesterUserId: Number(payment.requester_user_id),
      amount,
      nextStatus,
      isRefundCase,
    };
  });

  await recordAuditLog({
    userId: auth.userId,
    moduleCode: PAYMENT_MODULE_CODE,
    action: outcome.nextStatus === 'PAID' ? 'PAYMENT_PAID' : 'PAYMENT_PARTIALLY_PAID',
    entityType: 'payment_requests',
    entityId: paymentId,
    newValues: {
      amount: outcome.amount,
      status: outcome.nextStatus,
      bankTransactionRef: input.bankTransactionRef ?? null,
    },
    ipAddress,
  });

  if (outcome.requesterUserId !== auth.userId) {
    const label = outcome.isRefundCase
      ? 'đã xác nhận thu hồi hoàn quỹ'
      : outcome.nextStatus === 'PAID'
        ? 'đã được giải ngân hoàn tất'
        : 'đã được giải ngân một phần';

    await createNotification({
      userId: outcome.requesterUserId,
      moduleCode: PAYMENT_MODULE_CODE,
      type: 'PAYMENT_DISBURSED',
      title: `Cập nhật chi trả [${outcome.code}]`,
      message: `Phiếu "${outcome.title}" ${label} (${outcome.amount.toLocaleString('vi-VN')} ₫).`,
      linkUrl: `/services/payments/${paymentId}`,
    });
  }

  return getPaymentDetail(auth, paymentId);
}
