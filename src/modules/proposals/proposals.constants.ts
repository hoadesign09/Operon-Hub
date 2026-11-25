export const PROPOSAL_MODULE_CODE = 'proposals';
export const PROPOSAL_ENTITY_TYPE = 'proposals';
export const PROPOSAL_DEFAULT_REQUEST_TYPE = 'PROPOSAL_STANDARD';
export const PROPOSAL_HIGH_VALUE_THRESHOLD_VND = 20_000_000;

export const PROPOSAL_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
export const PROPOSAL_STATUSES = [
  'DRAFT',
  'PENDING_APPROVAL',
  'NEEDS_REVISION',
  'APPROVED',
  'REJECTED',
  'IN_EXECUTION',
  'COMPLETED',
  'CANCELLED',
] as const;

export const PROPOSAL_COMMENT_TYPES = [
  'GENERAL',
  'REVISION_REQUEST',
  'EXECUTION_UPDATE',
] as const;

export const MAX_PROPOSAL_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10MB

export const ALLOWED_PROPOSAL_ATTACHMENT_MIME_EXT: Record<string, readonly string[]> = {
  'application/pdf': ['.pdf'],
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/webp': ['.webp'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'text/csv': ['.csv'],
  'text/plain': ['.txt'],
};

export interface DefaultProposalCategorySeed {
  code: string;
  name: string;
  nameEn: string;
  description: string;
  defaultRequestType: string;
  requiresBudget: boolean;
  budgetThresholdHigh: number;
  iconName: string;
  colorHex: string;
  sortOrder: number;
}

export const DEFAULT_PROPOSAL_CATEGORIES: readonly DefaultProposalCategorySeed[] = [
  {
    code: 'PROCUREMENT',
    name: 'Mua sắm & Văn phòng phẩm',
    nameEn: 'Procurement & Office Supplies',
    description: 'Đề xuất mua sắm thiết bị, phần mềm, vật tư và dịch vụ nhà cung cấp.',
    defaultRequestType: PROPOSAL_DEFAULT_REQUEST_TYPE,
    requiresBudget: true,
    budgetThresholdHigh: PROPOSAL_HIGH_VALUE_THRESHOLD_VND,
    iconName: 'shopping-cart',
    colorHex: '#2563EB',
    sortOrder: 1,
  },
  {
    code: 'EQUIPMENT',
    name: 'Cấp phát & Nâng cấp Thiết bị',
    nameEn: 'Hardware & Equipment Upgrade',
    description: 'Đề xuất trang bị mới, nâng cấp máy tính, màn hình hoặc thiết bị làm việc.',
    defaultRequestType: PROPOSAL_DEFAULT_REQUEST_TYPE,
    requiresBudget: true,
    budgetThresholdHigh: PROPOSAL_HIGH_VALUE_THRESHOLD_VND,
    iconName: 'device-laptop',
    colorHex: '#0891B2',
    sortOrder: 2,
  },
  {
    code: 'EVENT',
    name: 'Tổ chức Sự kiện & Team Building',
    nameEn: 'Events & Team Building',
    description: 'Tờ trình tổ chức hội thảo, sinh nhật công ty, du lịch và hoạt động gắn kết.',
    defaultRequestType: PROPOSAL_DEFAULT_REQUEST_TYPE,
    requiresBudget: true,
    budgetThresholdHigh: PROPOSAL_HIGH_VALUE_THRESHOLD_VND,
    iconName: 'confetti',
    colorHex: '#7C3AED',
    sortOrder: 3,
  },
  {
    code: 'HR_TRAINING',
    name: 'Đào tạo & Phát triển Nhân sự',
    nameEn: 'Training & Talent Development',
    description: 'Đề xuất tài trợ khóa học, chứng chỉ chuyên môn, hội nghị và tuyển dụng đặc biệt.',
    defaultRequestType: PROPOSAL_DEFAULT_REQUEST_TYPE,
    requiresBudget: true,
    budgetThresholdHigh: PROPOSAL_HIGH_VALUE_THRESHOLD_VND,
    iconName: 'school',
    colorHex: '#059669',
    sortOrder: 4,
  },
  {
    code: 'PROCESS_IMPROVEMENT',
    name: 'Cải tiến Quy trình & Vận hành',
    nameEn: 'Process & Operations Improvement',
    description: 'Đề xuất sáng kiến tối ưu quy trình nội bộ, chuyển đổi số hoặc chính sách làm việc.',
    defaultRequestType: PROPOSAL_DEFAULT_REQUEST_TYPE,
    requiresBudget: false,
    budgetThresholdHigh: PROPOSAL_HIGH_VALUE_THRESHOLD_VND,
    iconName: 'bulb',
    colorHex: '#D97706',
    sortOrder: 5,
  },
  {
    code: 'GENERAL',
    name: 'Đề xuất Hành chính Chung',
    nameEn: 'General Administrative Proposal',
    description: 'Các tờ trình nội bộ khác gửi cấp quản lý và bộ phận hành chính xem xét.',
    defaultRequestType: PROPOSAL_DEFAULT_REQUEST_TYPE,
    requiresBudget: false,
    budgetThresholdHigh: PROPOSAL_HIGH_VALUE_THRESHOLD_VND,
    iconName: 'file-description',
    colorHex: '#475569',
    sortOrder: 6,
  },
];
