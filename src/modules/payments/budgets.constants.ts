export const BUDGET_PERIOD_TYPES = ['ANNUAL', 'QUARTERLY', 'MONTHLY', 'CUSTOM'] as const;
export const BUDGET_ENFORCEMENT_MODES = ['HARD_BLOCK', 'SOFT_WARN'] as const;
export const BUDGET_STATUSES = ['DRAFT', 'ACTIVE', 'FROZEN', 'CLOSED'] as const;
export const BUDGET_TX_TYPES = [
  'ALLOCATE',
  'TOP_UP',
  'REDUCE',
  'TRANSFER_OUT',
  'TRANSFER_IN',
  'RESERVE',
  'RELEASE',
  'CONSUME',
  'REFUND',
] as const;
export const BUDGET_SOURCE_TYPES = [
  'MANUAL',
  'TRANSFER',
  'PROPOSAL',
  'PAYMENT',
  'DISBURSEMENT',
] as const;

export const BUDGET_DEFAULT_WARNING_PERCENT = 80;
export const BUDGET_ENTITY_TYPE = 'payment_budgets';

export interface DefaultBudgetSeed {
  code: string;
  name: string;
  nameEn: string;
  description: string;
  fiscalYear: number;
  periodType: (typeof BUDGET_PERIOD_TYPES)[number];
  periodLabel: string;
  startDate: string;
  endDate: string;
  deptCode: string | null;
  categoryCode: string | null;
  allocatedAmount: number;
  warningThresholdPercent: number;
  enforcementMode: (typeof BUDGET_ENFORCEMENT_MODES)[number];
}

export const DEFAULT_PAYMENT_BUDGETS_2026: readonly DefaultBudgetSeed[] = [
  {
    code: 'BUD-2026-TECH-001',
    name: 'Ngân sách Hạ tầng IT, Phần mềm & Cloud 2026',
    nameEn: '2026 IT Infrastructure, Software & Cloud Budget',
    description:
      'Quỹ ngân sách thường niên dành cho hạ tầng máy chủ, bản quyền SaaS, thiết bị kỹ thuật và bảo mật CNTT.',
    fiscalYear: 2026,
    periodType: 'ANNUAL',
    periodLabel: 'FY2026',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    deptCode: 'TECH',
    categoryCode: 'IT_SOFTWARE_OPS',
    allocatedAmount: 250_000_000,
    warningThresholdPercent: 80,
    enforcementMode: 'HARD_BLOCK',
  },
  {
    code: 'BUD-2026-OPS-001',
    name: 'Ngân sách Vận hành Văn phòng & Hành chính 2026',
    nameEn: '2026 Office Operations & Admin Budget',
    description:
      'Quỹ chi tiêu bảo trì cơ sở vật chất, văn phòng phẩm, điện nước và dịch vụ vận hành trụ sở chính.',
    fiscalYear: 2026,
    periodType: 'ANNUAL',
    periodLabel: 'FY2026',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    deptCode: 'HR',
    categoryCode: 'OFFICE_ADMIN',
    allocatedAmount: 150_000_000,
    warningThresholdPercent: 80,
    enforcementMode: 'HARD_BLOCK',
  },
  {
    code: 'BUD-2026-MKT-001',
    name: 'Ngân sách Sự kiện, Tiếp khách & Marketing Q4/2026',
    nameEn: 'Q4/2026 Events, Client Hosting & Marketing Budget',
    description:
      'Quỹ tổ chức tiệc tất niên, hội thảo khách hàng, truyền thông thương hiệu và chi phí công tác tiếp khách.',
    fiscalYear: 2026,
    periodType: 'QUARTERLY',
    periodLabel: 'Q4/2026',
    startDate: '2026-10-01',
    endDate: '2026-12-31',
    deptCode: 'HR',
    categoryCode: 'MARKETING_EVENT',
    allocatedAmount: 200_000_000,
    warningThresholdPercent: 75,
    enforcementMode: 'HARD_BLOCK',
  },
  {
    code: 'BUD-2026-HR-001',
    name: 'Ngân sách Đào tạo, Chứng chỉ & Phúc lợi 2026',
    nameEn: '2026 Training, Certifications & Welfare Budget',
    description:
      'Quỹ tài trợ đào tạo chuyên môn, chứng chỉ quốc tế, công tác phí và các hoạt động phát triển nhân sự.',
    fiscalYear: 2026,
    periodType: 'ANNUAL',
    periodLabel: 'FY2026',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    deptCode: null,
    categoryCode: 'TRAVEL_TRIP',
    allocatedAmount: 180_000_000,
    warningThresholdPercent: 80,
    enforcementMode: 'HARD_BLOCK',
  },
  {
    code: 'BUD-2026-PROJ-001',
    name: 'Ngân sách Triển khai Dự án Khách hàng 2026',
    nameEn: '2026 Client Project Delivery Budget',
    description:
      'Quỹ linh hoạt phục vụ tạm ứng hiện trường, chi phí nhà cung cấp phụ trợ và triển khai dự án (chế độ cảnh báo mềm).',
    fiscalYear: 2026,
    periodType: 'ANNUAL',
    periodLabel: 'FY2026',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    deptCode: 'TECH',
    categoryCode: 'PROJECT_EXPENSE',
    allocatedAmount: 300_000_000,
    warningThresholdPercent: 85,
    enforcementMode: 'SOFT_WARN',
  },
];
