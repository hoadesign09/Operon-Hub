/**
 * Động cơ trạng thái phê duyệt đa cấp thuần túy (Zero Business Coupling).
 * Hỗ trợ đánh giá điều kiện chọn quy trình và tính chuyển trạng thái bước duyệt.
 *
 * Dependencies: None
 *
 * Input / Output:
 * - evaluateWorkflowConditions(conditions: WorkflowConditionRule | null | undefined, context?: WorkflowEvalContext) => boolean
 * - computeApprovalTransition(currentStep: number, totalSteps: number, action: ApprovalActionType) => ApprovalTransitionResult
 *
 * Ví dụ:
 * ```ts
 * evaluateWorkflowConditions({ minDays: 3 }, { days: 4 }); // true
 * computeApprovalTransition(1, 2, 'APPROVE'); // { nextStatus: 'PENDING', nextStep: 2, isCompleted: false }
 * ```
 */

export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
export type ApprovalActionType = 'APPROVE' | 'REJECT' | 'CANCEL';

export interface WorkflowConditionRule {
  minDays?: number | null;
  maxDays?: number | null;
  minAmount?: number | null;
  maxAmount?: number | null;
}

export interface WorkflowEvalContext {
  days?: number | null;
  amount?: number | null;
}

export interface ApprovalTransitionResult {
  nextStatus: ApprovalStatus;
  nextStep: number;
  isCompleted: boolean;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function evaluateWorkflowConditions(
  conditions: WorkflowConditionRule | null | undefined,
  context: WorkflowEvalContext = {},
): boolean {
  if (!conditions) {
    return true;
  }

  if (isFiniteNumber(conditions.minDays)) {
    if (!isFiniteNumber(context.days) || context.days < conditions.minDays) {
      return false;
    }
  }

  if (isFiniteNumber(conditions.maxDays)) {
    if (!isFiniteNumber(context.days) || context.days > conditions.maxDays) {
      return false;
    }
  }

  if (isFiniteNumber(conditions.minAmount)) {
    if (!isFiniteNumber(context.amount) || context.amount < conditions.minAmount) {
      return false;
    }
  }

  if (isFiniteNumber(conditions.maxAmount)) {
    if (!isFiniteNumber(context.amount) || context.amount > conditions.maxAmount) {
      return false;
    }
  }

  return true;
}

export function computeApprovalTransition(
  currentStep: number,
  totalSteps: number,
  action: ApprovalActionType,
): ApprovalTransitionResult {
  if (!Number.isInteger(currentStep) || currentStep < 1) {
    throw new Error('Bước duyệt hiện tại (currentStep) phải là số nguyên dương >= 1.');
  }
  if (!Number.isInteger(totalSteps) || totalSteps < 1) {
    throw new Error('Tổng số bước duyệt (totalSteps) phải là số nguyên dương >= 1.');
  }
  if (currentStep > totalSteps) {
    throw new Error('Bước duyệt hiện tại không thể lớn hơn tổng số bước duyệt.');
  }

  if (action === 'CANCEL') {
    return { nextStatus: 'CANCELLED', nextStep: currentStep, isCompleted: true };
  }

  if (action === 'REJECT') {
    return { nextStatus: 'REJECTED', nextStep: currentStep, isCompleted: true };
  }

  if (currentStep < totalSteps) {
    return {
      nextStatus: 'PENDING',
      nextStep: currentStep + 1,
      isCompleted: false,
    };
  }

  return {
    nextStatus: 'APPROVED',
    nextStep: currentStep,
    isCompleted: true,
  };
}
