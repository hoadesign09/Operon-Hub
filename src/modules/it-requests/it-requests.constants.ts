export const IT_REQUEST_MODULE_CODE = 'it_requests' as const;
export const IT_REQUEST_ENTITY_TYPE = 'it_requests' as const;
export const IT_REQUEST_ACCESS_SOFTWARE_TYPE = 'IT_ACCESS_SOFTWARE' as const;
export const IT_REQUEST_HARDWARE_TYPE = 'IT_HARDWARE' as const;
export const IT_REQUEST_CODE_PREFIX = 'ITR' as const;

export const IT_REQUEST_PERMISSIONS = {
  READ: 'it_requests.read',
  CREATE: 'it_requests.create',
  MANAGE: 'it_requests.manage',
  EXPORT: 'it_requests.export',
} as const;

export const IT_REQUEST_KINDS = [
  'INCIDENT',
  'SERVICE_REQUEST',
  'ACCESS_REQUEST',
  'HARDWARE_PROVISION',
] as const;

export const IT_REQUEST_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;

export const IT_REQUEST_STATUSES = [
  'DRAFT',
  'PENDING_APPROVAL',
  'OPEN',
  'IN_PROGRESS',
  'WAITING_USER',
  'RESOLVED',
  'CLOSED',
  'REJECTED',
  'CANCELLED',
] as const;

export const IT_REQUEST_TERMINAL_STATUSES = ['CLOSED', 'REJECTED', 'CANCELLED'] as const;

export const IT_REQUEST_COMMENT_VISIBILITIES = ['PUBLIC', 'INTERNAL_NOTE'] as const;

export const MAX_IT_REQUEST_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export const ALLOWED_IT_REQUEST_ATTACHMENT_MIME_EXT: Record<string, readonly string[]> = {
  'application/pdf': ['.pdf'],
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/webp': ['.webp'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'text/csv': ['.csv'],
  'text/plain': ['.txt'],
};

export interface DefaultItCategorySeed {
  code: string;
  name: string;
  nameEn: string;
  description: string;
  requestKind: (typeof IT_REQUEST_KINDS)[number];
  requiresApproval: boolean;
  defaultPriority: (typeof IT_REQUEST_PRIORITIES)[number];
  slaResponseHours: number;
  slaResolutionHours: number;
  color: string;
  sortOrder: number;
}

export const DEFAULT_IT_REQUEST_CATEGORIES: readonly DefaultItCategorySeed[] = [
  {
    code: 'IT_HARDWARE_ISSUE',
    name: 'Sự cố Máy tính & Thiết bị',
    nameEn: 'Hardware & Device Issue',
    description: 'Khắc phục lỗi laptop, màn hình, bàn phím, máy in và thiết bị ngoại vi.',
    requestKind: 'INCIDENT',
    requiresApproval: false,
    defaultPriority: 'HIGH',
    slaResponseHours: 2,
    slaResolutionHours: 8,
    color: '#DC2626',
    sortOrder: 1,
  },
  {
    code: 'IT_NETWORK_VPN',
    name: 'Sự cố Mạng, Wifi & VPN',
    nameEn: 'Network, Wifi & VPN',
    description: 'Mất kết nối mạng nội bộ, lỗi Wifi văn phòng, cấu hình hoặc gián đoạn VPN.',
    requestKind: 'INCIDENT',
    requiresApproval: false,
    defaultPriority: 'URGENT',
    slaResponseHours: 1,
    slaResolutionHours: 4,
    color: '#EA580C',
    sortOrder: 2,
  },
  {
    code: 'IT_ACCOUNT_ACCESS',
    name: 'Cấp Tài khoản & Phân quyền Hệ thống',
    nameEn: 'Account & System Access',
    description: 'Tạo email công ty, cấp quyền ERP/Git/VPN hoặc mở quyền truy cập hệ thống.',
    requestKind: 'ACCESS_REQUEST',
    requiresApproval: true,
    defaultPriority: 'MEDIUM',
    slaResponseHours: 4,
    slaResolutionHours: 16,
    color: '#2563EB',
    sortOrder: 3,
  },
  {
    code: 'IT_SOFTWARE_LICENSE',
    name: 'Cài đặt Phần mềm & Bản quyền',
    nameEn: 'Software & License Provisioning',
    description: 'Cài đặt công cụ làm việc, gia hạn hoặc cấp license phần mềm chuyên dụng.',
    requestKind: 'SERVICE_REQUEST',
    requiresApproval: true,
    defaultPriority: 'MEDIUM',
    slaResponseHours: 4,
    slaResolutionHours: 24,
    color: '#7C3AED',
    sortOrder: 4,
  },
  {
    code: 'IT_NEW_EQUIPMENT',
    name: 'Đề nghị Cấp phát Thiết bị Mới',
    nameEn: 'New Hardware Provisioning',
    description: 'Yêu cầu cấp laptop, màn hình rời, thiết bị test cho nhân sự mới hoặc nâng cấp.',
    requestKind: 'HARDWARE_PROVISION',
    requiresApproval: true,
    defaultPriority: 'MEDIUM',
    slaResponseHours: 4,
    slaResolutionHours: 48,
    color: '#0D9488',
    sortOrder: 5,
  },
  {
    code: 'IT_SECURITY_SUPPORT',
    name: 'An toàn Thông tin & Khôi phục Dữ liệu',
    nameEn: 'Information Security & Recovery',
    description: 'Báo cáo email giả mạo, khóa tài khoản khẩn cấp, khôi phục dữ liệu bị xóa.',
    requestKind: 'INCIDENT',
    requiresApproval: false,
    defaultPriority: 'URGENT',
    slaResponseHours: 1,
    slaResolutionHours: 6,
    color: '#BE123C',
    sortOrder: 6,
  },
];
