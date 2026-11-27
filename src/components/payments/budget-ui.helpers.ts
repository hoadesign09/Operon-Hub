import type {
  BudgetEnforcementMode,
  BudgetPeriodType,
  BudgetStatus,
  BudgetTxType,
} from '@/config/database';
import type { BudgetHealthStatus } from '@/lib/portable/budget-calculator';

export interface BudgetListItemDto {
  id: number;
  code: string;
  name: string;
  nameEn: string | null;
  description: string | null;
  fiscalYear: number;
  periodType: BudgetPeriodType;
  periodLabel: string;
  startDate: string;
  endDate: string;
  branchId: number | null;
  branchName: string | null;
  branchNameEn: string | null;
  departmentId: number | null;
  departmentName: string | null;
  departmentNameEn: string | null;
  categoryId: number | null;
  categoryName: string | null;
  categoryNameEn: string | null;
  categoryColor: string | null;
  projectId: number | null;
  projectCode: string | null;
  projectName: string | null;
  ownerUserId: number | null;
  ownerName: string | null;
  currency: string;
  allocatedAmount: number;
  reservedAmount: number;
  spentAmount: number;
  committedTotal: number;
  availableAmount: number;
  utilizationPercent: number;
  spentPercent: number;
  reservedPercent: number;
  warningThresholdPercent: number;
  enforcementMode: BudgetEnforcementMode;
  status: BudgetStatus;
  health: BudgetHealthStatus;
  linkedProposalCount: number;
  linkedPaymentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface BudgetTransactionDto {
  id: number;
  budgetId: number;
  txType: BudgetTxType;
  sourceType: 'MANUAL' | 'TRANSFER' | 'PROPOSAL' | 'PAYMENT' | 'DISBURSEMENT';
  sourceId: number | null;
  sourceCode: string | null;
  relatedBudgetId: number | null;
  relatedBudgetCode: string | null;
  allocatedDelta: number;
  reservedDelta: number;
  spentDelta: number;
  balanceAllocatedAfter: number;
  balanceReservedAfter: number;
  balanceSpentAfter: number;
  balanceAvailableAfter: number;
  note: string | null;
  actorUserId: number | null;
  actorName: string | null;
  createdAt: string;
}

export interface BudgetLinkedProposalDto {
  id: number;
  proposalCode: string;
  title: string;
  status: string;
  requesterName: string;
  estimatedBudget: number;
  approvedBudget: number | null;
  budgetReservedAmount: number;
  isOverBudget: boolean;
  createdAt: string;
}

export interface BudgetLinkedPaymentDto {
  id: number;
  code: string;
  paymentType: string;
  title: string;
  status: string;
  requesterName: string;
  totalAmount: number;
  disbursedAmount: number;
  budgetReservedAmount: number;
  budgetSpentAmount: number;
  proposalCode: string | null;
  isOverBudget: boolean;
  createdAt: string;
}

export interface BudgetDetailDto extends BudgetListItemDto {
  transactions: BudgetTransactionDto[];
  linkedProposals: BudgetLinkedProposalDto[];
  linkedPayments: BudgetLinkedPaymentDto[];
  actions: {
    canEdit: boolean;
    canAdjust: boolean;
    canTransfer: boolean;
    canActivate: boolean;
    canFreeze: boolean;
    canClose: boolean;
    canDelete: boolean;
  };
}

export interface BudgetSummaryDto {
  totalBudgets: number;
  activeBudgets: number;
  frozenBudgets: number;
  closedBudgets: number;
  totalAllocated: number;
  totalReserved: number;
  totalSpent: number;
  totalAvailable: number;
  overallUtilizationPercent: number;
  warningCount: number;
  exceededCount: number;
}

export interface BudgetOptionDto {
  id: number;
  code: string;
  name: string;
  nameEn: string | null;
  fiscalYear: number;
  periodLabel: string;
  branchId: number | null;
  branchName: string | null;
  departmentId: number | null;
  departmentName: string | null;
  categoryId: number | null;
  allocatedAmount: number;
  reservedAmount: number;
  spentAmount: number;
  availableAmount: number;
  utilizationPercent: number;
  warningThresholdPercent: number;
  enforcementMode: BudgetEnforcementMode;
  health: BudgetHealthStatus;
}

export const BUDGET_STATUS_META: Record<
  BudgetStatus,
  { vi: string; en: string; cls: string; dotCls: string }
> = {
  DRAFT: {
    vi: 'Nháp',
    en: 'Draft',
    cls: 'bg-slate-100 text-slate-700',
    dotCls: 'bg-slate-400',
  },
  ACTIVE: {
    vi: 'Đang hiệu lực',
    en: 'Active',
    cls: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/80',
    dotCls: 'bg-emerald-500',
  },
  FROZEN: {
    vi: 'Tạm khóa',
    en: 'Frozen',
    cls: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200/80',
    dotCls: 'bg-amber-500',
  },
  CLOSED: {
    vi: 'Đã đóng sổ',
    en: 'Closed',
    cls: 'bg-slate-200/80 text-slate-600',
    dotCls: 'bg-slate-500',
  },
};

export const BUDGET_PERIOD_META: Record<BudgetPeriodType, { vi: string; en: string }> = {
  ANNUAL: { vi: 'Theo năm', en: 'Annual' },
  QUARTERLY: { vi: 'Theo quý', en: 'Quarterly' },
  MONTHLY: { vi: 'Theo tháng', en: 'Monthly' },
  CUSTOM: { vi: 'Tùy chỉnh', en: 'Custom' },
};

export const BUDGET_ENFORCEMENT_META: Record<
  BudgetEnforcementMode,
  { vi: string; en: string; cls: string }
> = {
  HARD_BLOCK: {
    vi: 'Chặn cứng',
    en: 'Hard Block',
    cls: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200/70',
  },
  SOFT_WARN: {
    vi: 'Cảnh báo mềm',
    en: 'Soft Warn',
    cls: 'bg-sky-50 text-sky-700 ring-1 ring-sky-200/70',
  },
};

export const BUDGET_HEALTH_META: Record<
  BudgetHealthStatus,
  { vi: string; en: string; cls: string }
> = {
  HEALTHY: {
    vi: 'An toàn',
    en: 'Healthy',
    cls: 'bg-emerald-50 text-emerald-700',
  },
  WARNING: {
    vi: 'Cảnh báo',
    en: 'Warning',
    cls: 'bg-amber-50 text-amber-700',
  },
  EXCEEDED: {
    vi: 'Vượt hạn mức',
    en: 'Exceeded',
    cls: 'bg-rose-50 text-rose-700',
  },
};

export const BUDGET_TX_TYPE_META: Record<
  BudgetTxType,
  { vi: string; en: string; cls: string }
> = {
  ALLOCATE: { vi: 'Cấp ban đầu', en: 'Initial Allocation', cls: 'bg-blue-50 text-blue-700' },
  TOP_UP: { vi: 'Bổ sung ngân sách', en: 'Top Up', cls: 'bg-emerald-50 text-emerald-700' },
  REDUCE: { vi: 'Cắt giảm ngân sách', en: 'Reduction', cls: 'bg-orange-50 text-orange-700' },
  TRANSFER_OUT: { vi: 'Điều chuyển đi', en: 'Transfer Out', cls: 'bg-violet-50 text-violet-700' },
  TRANSFER_IN: { vi: 'Nhận điều chuyển', en: 'Transfer In', cls: 'bg-teal-50 text-teal-700' },
  RESERVE: { vi: 'Giữ chỗ chi tiêu', en: 'Reserve Hold', cls: 'bg-amber-50 text-amber-700' },
  RELEASE: { vi: 'Hoàn trả giữ chỗ', en: 'Reserve Release', cls: 'bg-slate-100 text-slate-700' },
  CONSUME: { vi: 'Thực chi giải ngân', en: 'Disbursed Spend', cls: 'bg-indigo-50 text-indigo-700' },
  REFUND: { vi: 'Hoàn quỹ tạm ứng', en: 'Advance Refund', cls: 'bg-emerald-50 text-emerald-800' },
};
