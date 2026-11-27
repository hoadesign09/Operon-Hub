export const PAYMENT_MODULE_CODE = 'payments';
export const PAYMENT_ENTITY_TYPE = 'payments';
export const PAYMENT_DEFAULT_REQUEST_TYPE = 'PAYMENT_STANDARD';
export const PAYMENT_HIGH_VALUE_THRESHOLD_VND = 20_000_000;

export const PAYMENT_TYPES = [
  'CASH_ADVANCE',
  'REIMBURSEMENT',
  'VENDOR_PAYMENT',
  'ADVANCE_SETTLEMENT',
] as const;

export const PAYMENT_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;

export const PAYMENT_STATUSES = [
  'DRAFT',
  'PENDING_APPROVAL',
  'NEEDS_REVISION',
  'APPROVED',
  'REJECTED',
  'PARTIALLY_PAID',
  'PAID',
  'CANCELLED',
] as const;

export const PAYMENT_METHODS = ['BANK_TRANSFER', 'CASH'] as const;
export const PAYMENT_BENEFICIARY_TYPES = ['EMPLOYEE', 'VENDOR'] as const;
export const PAYMENT_DISBURSEMENT_DIRECTIONS = ['OUTGOING', 'INCOMING_REFUND'] as const;
export const PAYMENT_COMMENT_TYPES = [
  'GENERAL',
  'REVISION_REQUEST',
  'FINANCE_NOTE',
  'SYSTEM',
] as const;
export const PAYMENT_ATTACHMENT_KINDS = [
  'INVOICE',
  'RECEIPT',
  'CONTRACT',
  'UNC_RECEIPT',
  'OTHER',
] as const;

export const MAX_PAYMENT_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10MB

export const ALLOWED_PAYMENT_ATTACHMENT_MIME_EXT: Record<string, readonly string[]> = {
  'application/pdf': ['.pdf'],
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/webp': ['.webp'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'text/csv': ['.csv'],
};

export interface DefaultPaymentCategorySeed {
  code: string;
  name: string;
  nameEn: string;
  description: string;
  defaultPaymentType: (typeof PAYMENT_TYPES)[number];
  requiresReceipt: boolean;
  color: string;
  sortOrder: number;
}

export const DEFAULT_PAYMENT_CATEGORIES: readonly DefaultPaymentCategorySeed[] = [
  {
    code: 'TRAVEL_TRIP',
    name: 'Công tác phí & Đi lại',
    nameEn: 'Business Travel & Per Diem',
    description: 'Vé máy bay, khách sạn, taxi, công tác phí và chi phí di chuyển gặp khách hàng.',
    defaultPaymentType: 'REIMBURSEMENT',
    requiresReceipt: true,
    color: '#0284C7',
    sortOrder: 1,
  },
  {
    code: 'VENDOR_INVOICE',
    name: 'Hóa đơn Nhà cung cấp & Dịch vụ',
    nameEn: 'Vendor Invoices & Services',
    description: 'Thanh toán hợp đồng, hóa đơn VAT, dịch vụ thuê ngoài và mua sắm nhà cung cấp.',
    defaultPaymentType: 'VENDOR_PAYMENT',
    requiresReceipt: true,
    color: '#D97706',
    sortOrder: 2,
  },
  {
    code: 'OFFICE_ADMIN',
    name: 'Chi phí Văn phòng & Hành chính',
    nameEn: 'Office & Administrative Expenses',
    description: 'Văn phòng phẩm, điện nước, internet, chuyển phát nhanh và bảo trì văn phòng.',
    defaultPaymentType: 'REIMBURSEMENT',
    requiresReceipt: true,
    color: '#059669',
    sortOrder: 3,
  },
  {
    code: 'MARKETING_EVENT',
    name: 'Sự kiện, Tiếp khách & Marketing',
    nameEn: 'Events, Client Hosting & Marketing',
    description: 'Tạm ứng tổ chức sự kiện, hội thảo, quà tặng đối tác và chi phí tiếp khách.',
    defaultPaymentType: 'CASH_ADVANCE',
    requiresReceipt: false,
    color: '#7C3AED',
    sortOrder: 4,
  },
  {
    code: 'IT_SOFTWARE_OPS',
    name: 'Phần mềm, Cloud & Hạ tầng IT',
    nameEn: 'Software, Cloud & IT Operations',
    description: 'Gia hạn tên miền, máy chủ cloud, bản quyền phần mềm SaaS và linh kiện kỹ thuật.',
    defaultPaymentType: 'VENDOR_PAYMENT',
    requiresReceipt: true,
    color: '#2563EB',
    sortOrder: 5,
  },
  {
    code: 'PROJECT_EXPENSE',
    name: 'Chi phí Triển khai Dự án',
    nameEn: 'Project Delivery Expenses',
    description: 'Tạm ứng và quyết toán các khoản chi trực tiếp phục vụ triển khai dự án khách hàng.',
    defaultPaymentType: 'CASH_ADVANCE',
    requiresReceipt: false,
    color: '#0F766E',
    sortOrder: 6,
  },
];
