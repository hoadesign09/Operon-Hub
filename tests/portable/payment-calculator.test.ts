import { describe, expect, it } from 'vitest';
import {
  amountToEnglishWords,
  amountToVietnameseWords,
  calculatePaymentLineItems,
  canCollaborateOnPaymentStatus,
  canTransitionPaymentStatus,
  computeAdvanceSettlement,
  evaluateDisbursementProgress,
  formatPaymentCode,
} from '@/lib/portable/payment-calculator';

describe('Portable Payment Calculator (Zero Dependencies)', () => {
  it('computes line item subtotals, VAT amounts, and grand total accurately', () => {
    const res = calculatePaymentLineItems([
      { quantity: 2, unitPrice: 11_000_000, taxRate: 10 },
      { quantity: 1, unitPrice: 4_000_000, taxRate: 10 },
    ]);

    expect(res.subtotalAmount).toBe(26_000_000);
    expect(res.taxAmount).toBe(2_600_000);
    expect(res.totalAmount).toBe(28_600_000);
    expect(res.items[0].lineTotal).toBe(24_200_000);
    expect(res.items[1].lineTotal).toBe(4_400_000);
  });

  it('reconciles cash advance settlement for PAY_MORE, REFUND_COMPANY, and BALANCED cases', () => {
    const payMore = computeAdvanceSettlement(18_500_000, 15_000_000);
    expect(payMore.settlementDirection).toBe('PAY_MORE');
    expect(payMore.netSettlementAmount).toBe(3_500_000);
    expect(payMore.payableAmount).toBe(3_500_000);
    expect(payMore.refundAmount).toBe(0);

    const refund = computeAdvanceSettlement(12_000_000, 15_000_000);
    expect(refund.settlementDirection).toBe('REFUND_COMPANY');
    expect(refund.netSettlementAmount).toBe(-3_000_000);
    expect(refund.payableAmount).toBe(0);
    expect(refund.refundAmount).toBe(3_000_000);

    const balanced = computeAdvanceSettlement(15_000_000, 15_000_000);
    expect(balanced.settlementDirection).toBe('BALANCED');
    expect(balanced.netSettlementAmount).toBe(0);
    expect(balanced.payableAmount).toBe(0);
    expect(balanced.refundAmount).toBe(0);
  });

  it('evaluates disbursement progress across unpaid, partial, and paid stages', () => {
    expect(evaluateDisbursementProgress(20_000_000, 0)).toMatchObject({
      remainingAmount: 20_000_000,
      progressPercent: 0,
      stage: 'UNPAID',
    });
    expect(evaluateDisbursementProgress(20_000_000, 10_000_000)).toMatchObject({
      remainingAmount: 10_000_000,
      progressPercent: 50,
      stage: 'PARTIALLY_PAID',
    });
    expect(evaluateDisbursementProgress(20_000_000, 20_000_000)).toMatchObject({
      remainingAmount: 0,
      progressPercent: 100,
      stage: 'PAID',
    });
  });

  it('enforces valid lifecycle transitions, collaboration lock, and code formatting', () => {
    expect(canTransitionPaymentStatus('DRAFT', 'PENDING_APPROVAL')).toBe(true);
    expect(canTransitionPaymentStatus('APPROVED', 'PARTIALLY_PAID')).toBe(true);
    expect(canTransitionPaymentStatus('PAID', 'CANCELLED')).toBe(false);

    expect(canCollaborateOnPaymentStatus('DRAFT')).toBe(false);
    expect(canCollaborateOnPaymentStatus('NEEDS_REVISION')).toBe(false);
    expect(canCollaborateOnPaymentStatus('PENDING_APPROVAL')).toBe(true);
    expect(canCollaborateOnPaymentStatus('APPROVED')).toBe(false);
    expect(canCollaborateOnPaymentStatus('PARTIALLY_PAID')).toBe(false);
    expect(canCollaborateOnPaymentStatus('PAID')).toBe(false);
    expect(canCollaborateOnPaymentStatus('REJECTED')).toBe(false);
    expect(canCollaborateOnPaymentStatus('CANCELLED')).toBe(false);

    expect(formatPaymentCode(2026, 11, 7)).toBe('PAY-202611-0007');
  });

  it('converts amounts to standard Vietnamese and English accounting words', () => {
    expect(amountToVietnameseWords(0)).toBe('Không đồng');
    expect(amountToVietnameseWords(1_100_000)).toBe('Một triệu một trăm nghìn đồng');
    expect(amountToVietnameseWords(28_605_000)).toBe(
      'Hai mươi tám triệu sáu trăm linh năm nghìn đồng',
    );
    expect(amountToEnglishWords(1_250_000)).toBe('One million two hundred fifty thousand VND');
  });
});
