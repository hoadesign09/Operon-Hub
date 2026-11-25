/**
 * Tiện ích tính toán dự toán, định dạng mã đề xuất và kiểm tra máy trạng thái vòng đời đề xuất (Zero Business Coupling).
 *
 * Dependencies: None
 *
 * Input / Output:
 * - calculateProposalLineTotals(items: ProposalLineInput[]) => { items: ProposalLineCalculated[]; grandTotal: number }
 * - canTransitionProposalStatus(current: ProposalLifecycleStatus, next: ProposalLifecycleStatus) => boolean
 * - formatProposalCode(prefix: string, year: number, month: number, sequence: number) => string
 *
 * Ví dụ:
 * ```ts
 * const calc = calculateProposalLineTotals([{ quantity: 2, unitPrice: 1500000 }]);
 * // { items: [{ quantity: 2, unitPrice: 1500000, lineTotal: 3000000 }], grandTotal: 3000000 }
 * formatProposalCode('PROP', 2026, 11, 7); // 'PROP-202611-0007'
 * ```
 */

export type ProposalLifecycleStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'NEEDS_REVISION'
  | 'APPROVED'
  | 'REJECTED'
  | 'IN_EXECUTION'
  | 'COMPLETED'
  | 'CANCELLED';

export interface ProposalLineInput {
  quantity: number;
  unitPrice: number;
}

export interface ProposalLineCalculated<T extends ProposalLineInput = ProposalLineInput> {
  item: T;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface ProposalTotalsResult<T extends ProposalLineInput = ProposalLineInput> {
  items: ProposalLineCalculated<T>[];
  grandTotal: number;
}

const ALLOWED_TRANSITIONS: Record<ProposalLifecycleStatus, readonly ProposalLifecycleStatus[]> = {
  DRAFT: ['PENDING_APPROVAL', 'CANCELLED'],
  PENDING_APPROVAL: ['APPROVED', 'REJECTED', 'NEEDS_REVISION', 'CANCELLED'],
  NEEDS_REVISION: ['PENDING_APPROVAL', 'CANCELLED'],
  APPROVED: ['IN_EXECUTION', 'COMPLETED', 'CANCELLED'],
  REJECTED: [],
  IN_EXECUTION: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

function round2(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateProposalLineTotals<T extends ProposalLineInput>(
  items: readonly T[],
): ProposalTotalsResult<T> {
  const calculated: ProposalLineCalculated<T>[] = [];
  let sum = 0;

  for (const item of items) {
    const safeQty = Number.isFinite(item.quantity) && item.quantity > 0 ? round2(item.quantity) : 0;
    const safePrice =
      Number.isFinite(item.unitPrice) && item.unitPrice >= 0 ? round2(item.unitPrice) : 0;
    const lineTotal = round2(safeQty * safePrice);
    sum = round2(sum + lineTotal);
    calculated.push({
      item,
      quantity: safeQty,
      unitPrice: safePrice,
      lineTotal,
    });
  }

  return {
    items: calculated,
    grandTotal: sum,
  };
}

export function canTransitionProposalStatus(
  current: ProposalLifecycleStatus,
  next: ProposalLifecycleStatus,
): boolean {
  const allowed = ALLOWED_TRANSITIONS[current];
  return Array.isArray(allowed) && allowed.includes(next);
}

export function formatProposalCode(
  prefix: string,
  year: number,
  month: number,
  sequence: number,
): string {
  const cleanPrefix = prefix.trim().toUpperCase().replace(/[^A-Z0-9]/g, '') || 'PROP';
  const safeYear = Math.max(2000, Math.min(9999, Math.trunc(year)));
  const safeMonth = String(Math.max(1, Math.min(12, Math.trunc(month)))).padStart(2, '0');
  const safeSeq = String(Math.max(1, Math.trunc(sequence))).padStart(4, '0');
  return `${cleanPrefix}-${safeYear}${safeMonth}-${safeSeq}`;
}
