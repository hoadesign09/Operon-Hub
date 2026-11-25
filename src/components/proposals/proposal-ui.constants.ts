export type ProposalStatusKey =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'NEEDS_REVISION'
  | 'APPROVED'
  | 'REJECTED'
  | 'IN_EXECUTION'
  | 'COMPLETED'
  | 'CANCELLED';

export type ProposalPriorityKey = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface ProposalCategoryOption {
  id: number;
  code: string;
  name: string;
  nameEn: string | null;
  description: string | null;
  defaultRequestType: string;
  requiresBudget: boolean;
  budgetThresholdHigh: number;
  iconName: string | null;
  colorHex: string;
  sortOrder: number;
  isActive: boolean;
}

export interface ProposalLineDraft {
  itemName: string;
  specification: string;
  unit: string;
  quantity: string;
  unitPrice: string;
  vendorNote: string;
}

export const PROPOSAL_STATUS_META: Record<
  ProposalStatusKey,
  { vi: string; en: string; cls: string }
> = {
  DRAFT: { vi: 'Nháp', en: 'Draft', cls: 'bg-slate-100 text-slate-700' },
  PENDING_APPROVAL: {
    vi: 'Chờ phê duyệt',
    en: 'Pending Approval',
    cls: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  },
  NEEDS_REVISION: {
    vi: 'Cần chỉnh sửa',
    en: 'Needs Revision',
    cls: 'bg-orange-50 text-orange-700 ring-1 ring-orange-200',
  },
  APPROVED: {
    vi: 'Đã phê duyệt',
    en: 'Approved',
    cls: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  },
  REJECTED: {
    vi: 'Từ chối',
    en: 'Rejected',
    cls: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200',
  },
  IN_EXECUTION: {
    vi: 'Đang thực thi',
    en: 'In Execution',
    cls: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
  },
  COMPLETED: {
    vi: 'Hoàn tất',
    en: 'Completed',
    cls: 'bg-teal-50 text-teal-700 ring-1 ring-teal-200',
  },
  CANCELLED: {
    vi: 'Đã hủy',
    en: 'Cancelled',
    cls: 'bg-slate-100 text-slate-500',
  },
};

export const PROPOSAL_PRIORITY_META: Record<
  ProposalPriorityKey,
  { vi: string; en: string; cls: string }
> = {
  LOW: { vi: 'Thấp', en: 'Low', cls: 'bg-slate-100 text-slate-600' },
  MEDIUM: { vi: 'Trung bình', en: 'Medium', cls: 'bg-sky-50 text-sky-700' },
  HIGH: { vi: 'Cao', en: 'High', cls: 'bg-amber-50 text-amber-700' },
  URGENT: { vi: 'Khẩn cấp', en: 'Urgent', cls: 'bg-rose-50 text-rose-700 font-semibold' },
};

export const PROPOSAL_ACTIVITY_LABELS: Record<string, { vi: string; en: string }> = {
  CREATED: { vi: 'Khởi tạo đề xuất', en: 'Created proposal' },
  UPDATED: { vi: 'Cập nhật nội dung đề xuất', en: 'Updated proposal details' },
  SUBMITTED: { vi: 'Gửi phê duyệt', en: 'Submitted for approval' },
  RESUBMITTED: { vi: 'Gửi phê duyệt lại', en: 'Resubmitted for approval' },
  APPROVED: { vi: 'Phê duyệt hoàn tất', en: 'Final approval granted' },
  REJECTED: { vi: 'Từ chối đề xuất', en: 'Proposal rejected' },
  REVISION_REQUESTED: { vi: 'Yêu cầu chỉnh sửa', en: 'Requested revision' },
  CANCELLED: { vi: 'Hủy đề xuất', en: 'Cancelled proposal' },
  EXECUTION_STARTED: { vi: 'Bắt đầu thực thi', en: 'Started execution' },
  COMPLETED: { vi: 'Đánh dấu hoàn tất', en: 'Marked as completed' },
  COMMENTED: { vi: 'Thêm bình luận', en: 'Posted a comment' },
  ATTACHMENT_UPLOADED: { vi: 'Tải lên tệp đính kèm', en: 'Uploaded attachment' },
  ATTACHMENT_REMOVED: { vi: 'Gỡ tệp đính kèm', en: 'Removed attachment' },
};
