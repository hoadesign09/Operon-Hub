import type {
  PaymentAttachmentKind,
  PaymentBeneficiaryType,
  PaymentMethod,
  PaymentPriority,
  PaymentStatus,
  PaymentType,
} from '@/config/database';
import type { SettlementDirection } from '@/lib/portable/payment-calculator';
import type { BudgetOptionDto } from './budget-ui.helpers';

export interface BilingualLabel {
  vi: string;
  en: string;
}

export interface PaymentCategoryDto {
  id: number;
  code: string;
  name: string;
  nameEn: string | null;
  description: string | null;
  defaultPaymentType: PaymentType;
  requiresReceipt: boolean;
  color: string;
  sortOrder: number;
  isActive: boolean;
}

export interface PaymentListItemDto {
  id: number;
  code: string;
  paymentType: PaymentType;
  categoryId: number;
  categoryName: string;
  categoryNameEn: string | null;
  categoryColor: string;
  title: string;
  priority: PaymentPriority;
  status: PaymentStatus;
  requesterUserId: number;
  requesterName: string;
  branchId: number | null;
  branchName: string | null;
  branchNameEn: string | null;
  departmentId: number | null;
  departmentName: string | null;
  departmentNameEn: string | null;
  budgetId: number | null;
  budgetCode: string | null;
  budgetName: string | null;
  budgetNameEn: string | null;
  budgetReservedAmount: number;
  budgetSpentAmount: number;
  proposalReserveUsed: number;
  isOverBudget: boolean;
  proposalId: number | null;
  proposalCode: string | null;
  projectId: number | null;
  projectCode: string | null;
  linkedAdvanceId: number | null;
  isSettled: boolean;
  paymentMethod: PaymentMethod;
  beneficiaryType: PaymentBeneficiaryType;
  beneficiaryName: string;
  currency: string;
  subtotalAmount: number;
  taxAmount: number;
  totalAmount: number;
  advanceAmount: number;
  netSettlementAmount: number;
  payableAmount: number;
  approvedAmount: number | null;
  disbursedAmount: number;
  remainingAmount: number;
  disbursementProgressPercent: number;
  settlementDirection: SettlementDirection | null;
  dueDate: string | null;
  advanceDueDate: string | null;
  isOverdue: boolean;
  submittedAt: string | null;
  approvedAt: string | null;
  paidAt: string | null;
  createdAt: string;
}

export interface PaymentLineItemDto {
  id: number;
  description: string;
  invoiceNo: string | null;
  invoiceDate: string | null;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  subtotalAmount: number;
  taxAmount: number;
  lineTotal: number;
  note: string | null;
  sortOrder: number;
}

export interface PaymentDisbursementDto {
  id: number;
  direction: 'OUTGOING' | 'INCOMING_REFUND';
  disbursementDate: string;
  amount: number;
  paymentMethod: PaymentMethod;
  bankTransactionRef: string | null;
  sourceAccount: string | null;
  note: string | null;
  disbursedByUserId: number;
  disbursedByName: string;
  createdAt: string;
}

export interface PaymentCommentDto {
  id: number;
  authorUserId: number;
  authorName: string;
  commentType: 'GENERAL' | 'REVISION_REQUEST' | 'FINANCE_NOTE' | 'SYSTEM';
  content: string;
  createdAt: string;
}

export interface PaymentAttachmentDto {
  id: number;
  attachmentKind: PaymentAttachmentKind;
  fileName: string;
  mimeType: string;
  fileSize: number;
  uploadedByUserId: number;
  uploadedByName: string;
  createdAt: string;
  canDelete: boolean;
}

export interface PaymentActivityDto {
  id: number;
  actorUserId: number | null;
  actorName: string | null;
  action: string;
  summary: string;
  createdAt: string;
}

export interface PaymentDetailDto extends PaymentListItemDto {
  budgetAllocatedAmount: number | null;
  budgetAvailableAmount: number | null;
  budgetEnforcementMode: 'HARD_BLOCK' | 'SOFT_WARN' | null;
  description: string;
  beneficiaryTaxCode: string | null;
  bankName: string | null;
  bankAccountNo: string | null;
  bankBranch: string | null;
  categoryRequiresReceipt: boolean;
  rejectionReason: string | null;
  revisionNote: string | null;
  approvalRequestId: number | null;
  linkedAdvanceCode: string | null;
  linkedAdvanceTitle: string | null;
  proposalTitle: string | null;
  projectName: string | null;
  settledByPaymentId: number | null;
  settledByPaymentCode: string | null;
  amountInWordsVi: string;
  amountInWordsEn: string;
  items: PaymentLineItemDto[];
  disbursements: PaymentDisbursementDto[];
  comments: PaymentCommentDto[];
  attachments: PaymentAttachmentDto[];
  activities: PaymentActivityDto[];
  approval: {
    request: {
      id: number;
      workflowId: number;
      currentStep: number;
      totalSteps: number;
      currentApproverRoleName: string | null;
      currentApproverRoleNameEn?: string | null;
      status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
      submittedAt: string;
      completedAt: string | null;
    };
    histories: Array<{
      id: number;
      stepOrder: number;
      actorId: number;
      actorName: string | null;
      action: 'SUBMIT' | 'APPROVE' | 'REJECT' | 'CANCEL';
      comment: string | null;
      actedAt: string;
    }>;
    canApproveOrReject: boolean;
    canCancel: boolean;
  } | null;
  actions: {
    canEdit: boolean;
    canDelete: boolean;
    canSubmit: boolean;
    canCancel: boolean;
    canRequestRevision: boolean;
    canDisburse: boolean;
    canConfirmRefund: boolean;
    canCreateSettlement: boolean;
    canComment: boolean;
    canUploadAttachment: boolean;
    canUploadUncReceipt: boolean;
    canExportPdf: boolean;
  };
}

export interface PaymentSummaryDto {
  totalCount: number;
  totalAmount: number;
  pendingMyApprovalCount: number;
  pendingMyApprovalAmount: number;
  readyToDisburseCount: number;
  readyToDisburseAmount: number;
  paidThisMonthCount: number;
  paidThisMonthAmount: number;
  unsettledAdvancesCount: number;
  unsettledAdvancesAmount: number;
  overdueAdvancesCount: number;
  overdueDueDateCount: number;
  draftCount: number;
  needsRevisionCount: number;
}

export interface PaymentFormOptionsDto {
  myBankProfile: {
    fullName: string;
    bankName: string | null;
    bankAccountNo: string | null;
    branchId: number | null;
    departmentId: number | null;
  };
  openAdvances: Array<{
    id: number;
    code: string;
    title: string;
    disbursedAmount: number;
    advanceDueDate: string | null;
    budgetId: number | null;
    budgetCode: string | null;
    budgetName: string | null;
    budgetNameEn: string | null;
  }>;
  approvedProposals: Array<{
    id: number;
    code: string;
    title: string;
    approvedBudget: number;
    budgetId: number | null;
    budgetCode: string | null;
    budgetName: string | null;
    budgetNameEn: string | null;
    budgetReservedAmount: number;
    vendorName: string | null;
  }>;
  activeProjects: Array<{
    id: number;
    code: string;
    name: string;
  }>;
  activeBudgets: BudgetOptionDto[];
}

export const PAYMENT_TYPE_META: Record<
  PaymentType,
  {
    vi: string;
    en: string;
    short: BilingualLabel;
    desc: BilingualLabel;
    cls: string;
  }
> = {
  CASH_ADVANCE: {
    vi: 'Đề nghị Tạm ứng',
    en: 'Cash Advance',
    short: { vi: 'Tạm ứng', en: 'Advance' },
    desc: {
      vi: 'Ứng trước tiền công tác, sự kiện hoặc mua sắm',
      en: 'Request upfront funds for trips, events or ops',
    },
    cls: 'bg-violet-50 text-violet-700 ring-violet-200/80',
  },
  REIMBURSEMENT: {
    vi: 'Hoàn ứng / Công tác phí',
    en: 'Expense Reimbursement',
    short: { vi: 'Hoàn ứng', en: 'Reimburse' },
    desc: {
      vi: 'Thanh toán lại chi phí cá nhân đã chi kèm hóa đơn',
      en: 'Reimburse out-of-pocket expenses with receipts',
    },
    cls: 'bg-sky-50 text-sky-700 ring-sky-200/80',
  },
  VENDOR_PAYMENT: {
    vi: 'Thanh toán Nhà cung cấp',
    en: 'Vendor Invoice Payment',
    short: { vi: 'Nhà cung cấp', en: 'Vendor' },
    desc: {
      vi: 'Chi trả hóa đơn VAT & hợp đồng cho đối tác',
      en: 'Pay vendor VAT invoices & service contracts',
    },
    cls: 'bg-amber-50 text-amber-800 ring-amber-200/80',
  },
  ADVANCE_SETTLEMENT: {
    vi: 'Quyết toán Tạm ứng',
    en: 'Advance Settlement',
    short: { vi: 'Quyết toán', en: 'Settlement' },
    desc: {
      vi: 'Đối chiếu chứng từ thực chi với phiếu tạm ứng gốc',
      en: 'Reconcile actual receipts against a prior advance',
    },
    cls: 'bg-teal-50 text-teal-700 ring-teal-200/80',
  },
};

export const PAYMENT_STATUS_META: Record<
  PaymentStatus,
  { vi: string; en: string; cls: string; dotCls: string }
> = {
  DRAFT: {
    vi: 'Nháp',
    en: 'Draft',
    cls: 'bg-slate-100 text-slate-700',
    dotCls: 'bg-slate-400',
  },
  PENDING_APPROVAL: {
    vi: 'Chờ phê duyệt',
    en: 'Pending Approval',
    cls: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200/70',
    dotCls: 'bg-amber-500',
  },
  NEEDS_REVISION: {
    vi: 'Cần bổ sung',
    en: 'Needs Revision',
    cls: 'bg-orange-50 text-orange-700 ring-1 ring-orange-200/70',
    dotCls: 'bg-orange-500',
  },
  APPROVED: {
    vi: 'Chờ giải ngân',
    en: 'Ready to Disburse',
    cls: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200/70',
    dotCls: 'bg-blue-500',
  },
  PARTIALLY_PAID: {
    vi: 'Chi từng phần',
    en: 'Partially Paid',
    cls: 'bg-cyan-50 text-cyan-700 ring-1 ring-cyan-200/70',
    dotCls: 'bg-cyan-500',
  },
  PAID: {
    vi: 'Đã hoàn tất chi',
    en: 'Paid',
    cls: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/70',
    dotCls: 'bg-emerald-500',
  },
  REJECTED: {
    vi: 'Từ chối',
    en: 'Rejected',
    cls: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200/70',
    dotCls: 'bg-rose-500',
  },
  CANCELLED: {
    vi: 'Đã hủy',
    en: 'Cancelled',
    cls: 'bg-slate-100 text-slate-500',
    dotCls: 'bg-slate-400',
  },
};

export const PAYMENT_PRIORITY_META: Record<
  PaymentPriority,
  { vi: string; en: string; cls: string }
> = {
  LOW: { vi: 'Thấp', en: 'Low', cls: 'bg-slate-100 text-slate-600' },
  MEDIUM: { vi: 'Trung bình', en: 'Medium', cls: 'bg-blue-50 text-blue-700' },
  HIGH: { vi: 'Cao', en: 'High', cls: 'bg-amber-50 text-amber-700' },
  URGENT: { vi: 'Khẩn cấp', en: 'Urgent', cls: 'bg-rose-50 text-rose-700' },
};

export const ATTACHMENT_KIND_META: Record<
  PaymentAttachmentKind,
  { vi: string; en: string; cls: string }
> = {
  INVOICE: { vi: 'Hóa đơn VAT', en: 'VAT Invoice', cls: 'bg-amber-50 text-amber-700' },
  RECEIPT: { vi: 'Biên lai / Chứng từ', en: 'Receipt', cls: 'bg-sky-50 text-sky-700' },
  CONTRACT: { vi: 'Hợp đồng / Báo giá', en: 'Contract / Quote', cls: 'bg-violet-50 text-violet-700' },
  UNC_RECEIPT: { vi: 'Ủy nhiệm chi (UNC)', en: 'Bank Transfer Proof', cls: 'bg-emerald-50 text-emerald-700' },
  OTHER: { vi: 'Tài liệu khác', en: 'Other Document', cls: 'bg-slate-100 text-slate-700' },
};

export function formatBytesCompact(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
