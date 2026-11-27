/**
 * Portable Payment, VAT, Cash-Advance Settlement & Amount-in-Words Calculator.
 *
 * Purpose: Pure financial calculation utilities for payment requests, VAT line items,
 * advance settlement reconciliation, disbursement progress, status transitions, and
 * Vietnamese / English accounting amount-in-words conversion.
 * Dependencies: None
 * Input/Output: Plain numeric & object inputs -> deterministic calculated results.
 * Example:
 *   const totals = calculatePaymentLineItems([{ quantity: 2, unitPrice: 500000, taxRate: 10 }]);
 *   const words = amountToVietnameseWords(totals.totalAmount); // "Một triệu một trăm nghìn đồng"
 */

export type PortablePaymentStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'NEEDS_REVISION'
  | 'APPROVED'
  | 'REJECTED'
  | 'PARTIALLY_PAID'
  | 'PAID'
  | 'CANCELLED';

export type SettlementDirection = 'PAY_MORE' | 'REFUND_COMPANY' | 'BALANCED';

export interface PaymentLineItemInput {
  quantity: number;
  unitPrice: number;
  taxRate?: number;
}

export interface CalculatedPaymentLineItem {
  quantity: number;
  unitPrice: number;
  taxRate: number;
  subtotalAmount: number;
  taxAmount: number;
  lineTotal: number;
}

export interface PaymentCalculationSummary {
  items: CalculatedPaymentLineItem[];
  subtotalAmount: number;
  taxAmount: number;
  totalAmount: number;
}

export interface AdvanceSettlementResult {
  totalAmount: number;
  advanceAmount: number;
  netSettlementAmount: number;
  settlementDirection: SettlementDirection;
  payableAmount: number;
  refundAmount: number;
}

export interface DisbursementProgressResult {
  targetAmount: number;
  disbursedAmount: number;
  remainingAmount: number;
  progressPercent: number;
  stage: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';
}

const VALID_PAYMENT_TRANSITIONS: Record<PortablePaymentStatus, readonly PortablePaymentStatus[]> = {
  DRAFT: ['PENDING_APPROVAL', 'CANCELLED'],
  PENDING_APPROVAL: ['NEEDS_REVISION', 'APPROVED', 'REJECTED', 'CANCELLED'],
  NEEDS_REVISION: ['PENDING_APPROVAL', 'CANCELLED'],
  APPROVED: ['PARTIALLY_PAID', 'PAID'],
  PARTIALLY_PAID: ['PAID'],
  PAID: [],
  REJECTED: [],
  CANCELLED: [],
};

/**
 * Returns true ONLY when the payment request is in PENDING_APPROVAL status,
 * matching strict collaboration & document upload lock policy.
 */
export function canCollaborateOnPaymentStatus(status: PortablePaymentStatus): boolean {
  return status === 'PENDING_APPROVAL';
}

function roundMoney(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Calculates subtotal, VAT tax, and line totals for payment request items.
 */
export function calculatePaymentLineItems(
  rawItems: readonly PaymentLineItemInput[],
): PaymentCalculationSummary {
  let subtotalAmount = 0;
  let taxAmount = 0;
  let totalAmount = 0;

  const items: CalculatedPaymentLineItem[] = rawItems.map((item) => {
    const quantity = Math.max(0, roundMoney(Number(item.quantity) || 0));
    const unitPrice = Math.max(0, roundMoney(Number(item.unitPrice) || 0));
    const taxRate = Math.min(100, Math.max(0, roundMoney(Number(item.taxRate ?? 0) || 0)));

    const lineSubtotal = roundMoney(quantity * unitPrice);
    const lineTax = roundMoney((lineSubtotal * taxRate) / 100);
    const lineTotal = roundMoney(lineSubtotal + lineTax);

    subtotalAmount = roundMoney(subtotalAmount + lineSubtotal);
    taxAmount = roundMoney(taxAmount + lineTax);
    totalAmount = roundMoney(totalAmount + lineTotal);

    return {
      quantity,
      unitPrice,
      taxRate,
      subtotalAmount: lineSubtotal,
      taxAmount: lineTax,
      lineTotal,
    };
  });

  return {
    items,
    subtotalAmount,
    taxAmount,
    totalAmount,
  };
}

/**
 * Computes net reconciliation between actual settlement expenses and a prior cash advance.
 */
export function computeAdvanceSettlement(
  totalAmountInput: number,
  advanceAmountInput: number,
): AdvanceSettlementResult {
  const totalAmount = Math.max(0, roundMoney(Number(totalAmountInput) || 0));
  const advanceAmount = Math.max(0, roundMoney(Number(advanceAmountInput) || 0));
  const netSettlementAmount = roundMoney(totalAmount - advanceAmount);

  if (netSettlementAmount > 0) {
    return {
      totalAmount,
      advanceAmount,
      netSettlementAmount,
      settlementDirection: 'PAY_MORE',
      payableAmount: netSettlementAmount,
      refundAmount: 0,
    };
  }

  if (netSettlementAmount < 0) {
    return {
      totalAmount,
      advanceAmount,
      netSettlementAmount,
      settlementDirection: 'REFUND_COMPANY',
      payableAmount: 0,
      refundAmount: roundMoney(Math.abs(netSettlementAmount)),
    };
  }

  return {
    totalAmount,
    advanceAmount,
    netSettlementAmount: 0,
    settlementDirection: 'BALANCED',
    payableAmount: 0,
    refundAmount: 0,
  };
}

/**
 * Evaluates remaining balance and completion percentage for disbursements or refund collection.
 */
export function evaluateDisbursementProgress(
  targetAmountInput: number,
  disbursedAmountInput: number,
): DisbursementProgressResult {
  const targetAmount = Math.max(0, roundMoney(Number(targetAmountInput) || 0));
  const disbursedAmount = Math.max(0, roundMoney(Number(disbursedAmountInput) || 0));
  const remainingAmount = Math.max(0, roundMoney(targetAmount - disbursedAmount));

  if (targetAmount === 0) {
    return {
      targetAmount: 0,
      disbursedAmount,
      remainingAmount: 0,
      progressPercent: 100,
      stage: 'PAID',
    };
  }

  const progressPercent = Math.min(100, Math.round((disbursedAmount / targetAmount) * 100));
  let stage: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' = 'UNPAID';
  if (remainingAmount <= 0) {
    stage = 'PAID';
  } else if (disbursedAmount > 0) {
    stage = 'PARTIALLY_PAID';
  }

  return {
    targetAmount,
    disbursedAmount,
    remainingAmount,
    progressPercent,
    stage,
  };
}

/**
 * Validates whether a payment request status transition is permitted.
 */
export function canTransitionPaymentStatus(
  currentStatus: PortablePaymentStatus,
  targetStatus: PortablePaymentStatus,
): boolean {
  return VALID_PAYMENT_TRANSITIONS[currentStatus]?.includes(targetStatus) ?? false;
}

/**
 * Formats a standardized payment request code: PAY-YYYYMM-NNNN.
 */
export function formatPaymentCode(
  year: number,
  month: number,
  sequence: number,
  prefix = 'PAY',
): string {
  const yyyy = String(Math.max(2000, Math.floor(year))).padStart(4, '0');
  const mm = String(Math.min(12, Math.max(1, Math.floor(month)))).padStart(2, '0');
  const seq = String(Math.max(1, Math.floor(sequence))).padStart(4, '0');
  return `${prefix.toUpperCase()}-${yyyy}${mm}-${seq}`;
}

const VI_DIGITS = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'] as const;
const VI_SCALES = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ', 'triệu tỷ'] as const;

function readViThreeDigits(num: number, showFullHundreds: boolean): string {
  const hundreds = Math.floor(num / 100);
  const tens = Math.floor((num % 100) / 10);
  const ones = num % 10;
  const parts: string[] = [];

  if (hundreds > 0 || showFullHundreds) {
    parts.push(`${VI_DIGITS[hundreds]} trăm`);
  }

  if (tens > 1) {
    parts.push(`${VI_DIGITS[tens]} mươi`);
    if (ones === 1) {
      parts.push('mốt');
    } else if (ones === 4) {
      parts.push('tư');
    } else if (ones === 5) {
      parts.push('lăm');
    } else if (ones > 0) {
      parts.push(VI_DIGITS[ones]);
    }
  } else if (tens === 1) {
    parts.push('mười');
    if (ones === 5) {
      parts.push('lăm');
    } else if (ones > 0) {
      parts.push(VI_DIGITS[ones]);
    }
  } else if (ones > 0) {
    if (hundreds > 0 || showFullHundreds) {
      parts.push('linh');
    }
    parts.push(VI_DIGITS[ones]);
  }

  return parts.join(' ');
}

/**
 * Converts a non-negative VND amount to standard Vietnamese accounting words.
 */
export function amountToVietnameseWords(amountInput: number, currencySuffix = 'đồng'): string {
  const rounded = Math.round(Number(amountInput) || 0);
  if (!Number.isFinite(rounded) || rounded === 0) {
    return `Không ${currencySuffix}`;
  }

  const isNegative = rounded < 0;
  let remaining = Math.abs(rounded);
  const groups: number[] = [];
  while (remaining > 0) {
    groups.push(remaining % 1000);
    remaining = Math.floor(remaining / 1000);
  }

  const words: string[] = [];
  for (let i = groups.length - 1; i >= 0; i -= 1) {
    const groupVal = groups[i];
    if (groupVal === 0) {
      continue;
    }
    const isHighestGroup = i === groups.length - 1;
    const chunk = readViThreeDigits(groupVal, !isHighestGroup);
    const scale = VI_SCALES[i] ?? '';
    words.push(scale ? `${chunk} ${scale}` : chunk);
  }

  const body = words.join(' ').trim();
  const prefixed = isNegative ? `Âm ${body}` : body;
  const capitalized = prefixed.charAt(0).toUpperCase() + prefixed.slice(1);
  return `${capitalized} ${currencySuffix}`.trim();
}

const EN_ONES = [
  '',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
] as const;
const EN_TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'] as const;
const EN_SCALES = ['', 'thousand', 'million', 'billion', 'trillion'] as const;

function readEnThreeDigits(num: number): string {
  const hundreds = Math.floor(num / 100);
  const rest = num % 100;
  const parts: string[] = [];

  if (hundreds > 0) {
    parts.push(`${EN_ONES[hundreds]} hundred`);
  }
  if (rest >= 20) {
    const ten = Math.floor(rest / 10);
    const one = rest % 10;
    parts.push(one > 0 ? `${EN_TENS[ten]}-${EN_ONES[one]}` : EN_TENS[ten]);
  } else if (rest > 0) {
    parts.push(EN_ONES[rest]);
  }
  return parts.join(' ');
}

/**
 * Converts a non-negative amount to English accounting words.
 */
export function amountToEnglishWords(amountInput: number, currencySuffix = 'VND'): string {
  const rounded = Math.round(Number(amountInput) || 0);
  if (!Number.isFinite(rounded) || rounded === 0) {
    return `Zero ${currencySuffix}`;
  }

  const isNegative = rounded < 0;
  let remaining = Math.abs(rounded);
  const groups: number[] = [];
  while (remaining > 0) {
    groups.push(remaining % 1000);
    remaining = Math.floor(remaining / 1000);
  }

  const words: string[] = [];
  for (let i = groups.length - 1; i >= 0; i -= 1) {
    const groupVal = groups[i];
    if (groupVal === 0) {
      continue;
    }
    const chunk = readEnThreeDigits(groupVal);
    const scale = EN_SCALES[i] ?? '';
    words.push(scale ? `${chunk} ${scale}` : chunk);
  }

  const body = words.join(' ').trim();
  const prefixed = isNegative ? `Minus ${body}` : body;
  const capitalized = prefixed.charAt(0).toUpperCase() + prefixed.slice(1);
  return `${capitalized} ${currencySuffix}`.trim();
}
