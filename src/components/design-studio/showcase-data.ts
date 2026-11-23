export type PortalThemeId =
  | 'nordic-executive'
  | 'midnight-command'
  | 'warm-corporate'
  | 'obsidian-dark'
  | 'compact-erp';

export interface PortalThemeSpec {
  id: PortalThemeId;
  index: number;
  name: string;
  tagline: string;
  navigationStyle: string;
  bestFor: string;
  palette: {
    canvas: string;
    surface: string;
    primary: string;
    accent: string;
  };
  strengths: readonly string[];
  scalabilityNote: string;
}

export interface ShowcaseApprovalItem {
  id: string;
  code: string;
  type: 'Nghỉ phép năm' | 'Tăng ca (OT)' | 'Công tác' | 'Cấp phát thiết bị';
  requester: string;
  department: string;
  summary: string;
  submittedAt: string;
  priority: 'NORMAL' | 'URGENT';
}

export interface ShowcaseContractAlert {
  id: string;
  employeeCode: string;
  employeeName: string;
  department: string;
  contractType: string;
  daysLeft: number;
  endDate: string;
}

export interface ShowcaseMeetingSlot {
  id: string;
  room: string;
  title: string;
  timeRange: string;
  organizer: string;
  attendees: number;
  status: 'ONGOING' | 'UPCOMING';
}

export interface ShowcaseDepartmentStat {
  name: string;
  shortName: string;
  headcount: number;
  attendanceRate: number;
  budgetShare: number;
}

export interface ShowcasePayrollTrendItem {
  period: string;
  grossMillion: number;
  netMillion: number;
}

export interface ShowcaseAnnouncement {
  id: string;
  title: string;
  category: 'Chính sách' | 'Sự kiện' | 'Khẩn';
  publishedAt: string;
  readRate: number;
  isPinned: boolean;
}

export interface ShowcaseBranchOption {
  id: string;
  label: string;
  headcount: number;
  activeRate: string;
  payrollVnd: string;
}

export const PORTAL_THEME_SPECS: readonly PortalThemeSpec[] = [
  {
    id: 'nordic-executive',
    index: 1,
    name: 'Executive Nordic',
    tagline: 'Tối giản Bắc Âu — Trắng sạch, viền mảnh & Indigo tinh tế',
    navigationStyle: 'Slim Sidebar (248px) + Topbar Command Search (Ctrl+K)',
    bestFor: 'Doanh nghiệp công nghệ, dịch vụ chuyên nghiệp, SME thích sự tinh gọn, ít mỏi mắt.',
    palette: {
      canvas: '#F8FAFC',
      surface: '#FFFFFF',
      primary: '#4F46E5',
      accent: '#059669',
    },
    strengths: [
      'Khoảng trắng thoáng, phân cấp thị giác rõ ràng cho 8 giờ làm việc liên tục.',
      'Số liệu tiền lương & công dùng tabular-nums căn thẳng cột tuyệt đối.',
      'Tối ưu trải nghiệm đọc bảng biểu và phê duyệt đơn từ nhanh.',
    ],
    scalabilityNote: 'Mở rộng phân hệ CRM/Finance qua nhóm menu collapsible gọn gàng.',
  },
  {
    id: 'midnight-command',
    index: 2,
    name: 'Midnight Command',
    tagline: 'Trung tâm điều hành — Dual-Rail Navy & Bento Analytics',
    navigationStyle: 'Dual-Rail (App Switcher 64px tối + Sub-menu 224px) + Canvas sáng',
    bestFor: 'Doanh nghiệp đa chi nhánh, nhiều phòng ban cần mở rộng HRM + CRM + Tài chính.',
    palette: {
      canvas: '#F1F5F9',
      surface: '#0B1120',
      primary: '#2563EB',
      accent: '#0EA5E9',
    },
    strengths: [
      'Cột chuyển phân hệ (Core / HRM / CRM / Finance) tách biệt rõ, không bị dài menu dọc.',
      'Bố cục Bento Grid hiện đại giúp Ban Giám đốc nắm KPI + biểu đồ + phê duyệt trong 1 tầm mắt.',
      'Tương phản sắc nét giữa khung điều hướng tối và vùng dữ liệu sáng.',
    ],
    scalabilityNote: 'Kiến trúc lý tưởng nhất khi Operon Hub mở rộng lên 4–8 phân hệ nghiệp vụ.',
  },
  {
    id: 'warm-corporate',
    index: 3,
    name: 'Warm Corporate Glass',
    tagline: 'Thân thiện & Tin cậy — Top Navigation toàn chiều ngang, sắc Emerald',
    navigationStyle: 'Top Navigation Header + Sub-nav Pills (Full-Width Workspace)',
    bestFor: 'Doanh nghiệp đề cao trải nghiệm nhân viên (ESS), thương mại, dịch vụ, bán lẻ.',
    palette: {
      canvas: '#FAF9F6',
      surface: '#FFFFFF',
      primary: '#0F766E',
      accent: '#D97706',
    },
    strengths: [
      'Giải phóng 100% chiều ngang màn hình — cực lợi cho Bảng chấm công 31 ngày & Bảng lương.',
      'Tôn vinh khối Self-Service (Chấm công, Quỹ phép, Phiếu lương) thân thiện với mọi nhân viên.',
      'Tông màu ấm áp, giảm cảm giác khô khan của phần mềm ERP truyền thống.',
    ],
    scalabilityNote: 'Chuyển phân hệ ngay trên thanh Header như một Suite ứng dụng doanh nghiệp.',
  },
  {
    id: 'obsidian-dark',
    index: 4,
    name: 'Obsidian Dark Pro',
    tagline: 'Chế độ Tối cao cấp — Ops Cockpit sắc sảo & độ tương phản chuẩn',
    navigationStyle: 'Floating Inset Dark Sidebar + Elevated Workspace Canvas',
    bestFor: 'Công ty Tech, Agency, đội ngũ vận hành trẻ trung dùng màn hình lớn nhiều giờ.',
    palette: {
      canvas: '#090A0F',
      surface: '#13161F',
      primary: '#8B5CF6',
      accent: '#14B8A6',
    },
    strengths: [
      'Nền tối sâu giảm chói mắt, đường viền tinh tế tạo chiều sâu không gian.',
      'Biểu đồ và chỉ báo cảnh báo (HĐ sắp hết hạn, đơn khẩn) nổi bật ngay lập tức.',
      'Phong cách hiện đại chuẩn sản phẩm SaaS thế hệ mới (Linear / Raycast).',
    ],
    scalabilityNote: 'Hỗ trợ chuyển ngữ cảnh nhanh bằng Command Bar & nhóm phân hệ dạng dock.',
  },
  {
    id: 'compact-erp',
    index: 5,
    name: 'Compact ERP Precision',
    tagline: 'Mật độ dữ liệu cao — Chuẩn nghiệp vụ C&B, Kế toán & Quản trị chặt',
    navigationStyle: 'Collapsible Rail (240px ↔ 68px) + Breadcrumb & Quick-Action Bar',
    bestFor: 'Doanh nghiệp sản xuất, phân phối, chuỗi chi nhánh thao tác nhập liệu & duyệt hàng loạt.',
    palette: {
      canvas: '#F3F5F8',
      surface: '#FFFFFF',
      primary: '#1E40AF',
      accent: '#0D9488',
    },
    strengths: [
      'Hiển thị mật độ thông tin cao ngay màn hình đầu tiên (above-the-fold) không cần cuộn nhiều.',
      'Có nút thu gọn sidebar 1-click, nút "+ Tạo nhanh" đa nghiệp vụ và checkbox duyệt hàng loạt.',
      'Gần gũi, trực quan cho bộ phận Hành chính, C&B và Kế toán tổng hợp.',
    ],
    scalabilityNote: 'Tối ưu tốt cho hệ thống nhiều phân hệ con và bảng dữ liệu hàng trăm dòng.',
  },
] as const;

export const SHOWCASE_BRANCHES: readonly ShowcaseBranchOption[] = [
  {
    id: 'all',
    label: 'Tất cả chi nhánh (3)',
    headcount: 148,
    activeRate: '96.4%',
    payrollVnd: '2,84 tỷ',
  },
  {
    id: 'hq-hn',
    label: 'Trụ sở chính Hà Nội (HQ)',
    headcount: 86,
    activeRate: '97.2%',
    payrollVnd: '1,72 tỷ',
  },
  {
    id: 'cn-hcm',
    label: 'Chi nhánh TP.HCM (HCM)',
    headcount: 44,
    activeRate: '95.5%',
    payrollVnd: '0,81 tỷ',
  },
  {
    id: 'cn-dn',
    label: 'Chi nhánh Đà Nẵng (DN)',
    headcount: 18,
    activeRate: '94.8%',
    payrollVnd: '0,31 tỷ',
  },
] as const;

export const SHOWCASE_DEPARTMENTS: readonly ShowcaseDepartmentStat[] = [
  { name: 'Kỹ thuật & Sản phẩm', shortName: 'Kỹ thuật', headcount: 46, attendanceRate: 97.8, budgetShare: 38 },
  { name: 'Kinh doanh & CSKH', shortName: 'Kinh doanh', headcount: 39, attendanceRate: 95.1, budgetShare: 26 },
  { name: 'Vận hành & Chuỗi cung ứng', shortName: 'Vận hành', headcount: 31, attendanceRate: 96.4, budgetShare: 17 },
  { name: 'Tài chính - Kế toán', shortName: 'Tài chính', headcount: 16, attendanceRate: 98.5, budgetShare: 11 },
  { name: 'Hành chính Nhân sự', shortName: 'HCNS', headcount: 16, attendanceRate: 97.0, budgetShare: 8 },
] as const;

export const SHOWCASE_PAYROLL_TREND: readonly ShowcasePayrollTrendItem[] = [
  { period: 'T06', grossMillion: 2510, netMillion: 2180 },
  { period: 'T07', grossMillion: 2590, netMillion: 2245 },
  { period: 'T08', grossMillion: 2640, netMillion: 2290 },
  { period: 'T09', grossMillion: 2710, netMillion: 2350 },
  { period: 'T10', grossMillion: 2785, netMillion: 2410 },
  { period: 'T11', grossMillion: 2840, netMillion: 2465 },
] as const;

export const SHOWCASE_APPROVALS: readonly ShowcaseApprovalItem[] = [
  {
    id: 'APR-1042',
    code: 'NP-2026-089',
    type: 'Nghỉ phép năm',
    requester: 'Nguyễn Minh Anh',
    department: 'Kỹ thuật & Sản phẩm',
    summary: 'Nghỉ phép 2 ngày (26/11 – 27/11) • Còn 8,5 ngày phép',
    submittedAt: '12 phút trước',
    priority: 'URGENT',
  },
  {
    id: 'APR-1043',
    code: 'OT-2026-054',
    type: 'Tăng ca (OT)',
    requester: 'Trần Quốc Bảo',
    department: 'Vận hành & Chuỗi cung ứng',
    summary: 'Tăng ca triển khai kiểm kê cuối tháng • 3,5 giờ (Hệ số 1.5x)',
    submittedAt: '38 phút trước',
    priority: 'NORMAL',
  },
  {
    id: 'APR-1044',
    code: 'CT-2026-021',
    type: 'Công tác',
    requester: 'Lê Thu Hà',
    department: 'Kinh doanh & CSKH',
    summary: 'Gặp khách hàng đối tác tại Hải Phòng • Tạm ứng 4.500.000 đ',
    submittedAt: '2 giờ trước',
    priority: 'NORMAL',
  },
  {
    id: 'APR-1045',
    code: 'TS-2026-019',
    type: 'Cấp phát thiết bị',
    requester: 'Phạm Đức Mạnh',
    department: 'Kỹ thuật & Sản phẩm',
    summary: 'Cấp MacBook Pro 14" M3 cho nhân sự mới nhận việc',
    submittedAt: 'Hôm qua',
    priority: 'NORMAL',
  },
] as const;

export const SHOWCASE_CONTRACT_ALERTS: readonly ShowcaseContractAlert[] = [
  {
    id: 'HD-01',
    employeeCode: 'NV0042',
    employeeName: 'Hoàng Gia Huy',
    department: 'Kinh doanh & CSKH',
    contractType: 'HĐ Thử việc 2 tháng',
    daysLeft: 5,
    endDate: '28/11/2026',
  },
  {
    id: 'HD-02',
    employeeCode: 'NV0019',
    employeeName: 'Vũ Thị Mai Linh',
    department: 'Tài chính - Kế toán',
    contractType: 'HĐ Xác định 12 tháng',
    daysLeft: 14,
    endDate: '07/12/2026',
  },
  {
    id: 'HD-03',
    employeeCode: 'NV0087',
    employeeName: 'Đỗ Quang Khải',
    department: 'Vận hành',
    contractType: 'HĐ Xác định 12 tháng',
    daysLeft: 26,
    endDate: '19/12/2026',
  },
] as const;

export const SHOWCASE_MEETINGS: readonly ShowcaseMeetingSlot[] = [
  {
    id: 'MT-01',
    room: 'Phòng Hội thảo A (Tầng 5)',
    title: 'Họp giao ban Vận hành & Chốt KPI tháng 11',
    timeRange: '09:00 – 10:30',
    organizer: 'Ban Giám đốc',
    attendees: 14,
    status: 'ONGOING',
  },
  {
    id: 'MT-02',
    room: 'Phòng Sáng tạo B (Tầng 4)',
    title: 'Phỏng vấn vị trí Senior Backend Engineer',
    timeRange: '14:00 – 15:00',
    organizer: 'Phòng HCNS',
    attendees: 4,
    status: 'UPCOMING',
  },
  {
    id: 'MT-03',
    room: 'Phòng Hợp tác C (Tầng 3)',
    title: 'Rà soát quy trình chốt công & thuế TNCN',
    timeRange: '16:00 – 17:00',
    organizer: 'Tài chính - Kế toán',
    attendees: 6,
    status: 'UPCOMING',
  },
] as const;

export const SHOWCASE_ANNOUNCEMENTS: readonly ShowcaseAnnouncement[] = [
  {
    id: 'TB-01',
    title: 'Lịch chốt công tháng 11 và phát phiếu lương trước ngày 05/12',
    category: 'Khẩn',
    publishedAt: 'Hôm nay, 08:30',
    readRate: 84,
    isPinned: true,
  },
  {
    id: 'TB-02',
    title: 'Cập nhật quy định đăng ký phòng họp & bàn giao thiết bị',
    category: 'Chính sách',
    publishedAt: '21/11/2026',
    readRate: 92,
    isPinned: false,
  },
] as const;

export const NAV_GROUPS = {
  workspace: [
    { key: 'dashboard', label: 'Tổng quan Portal' },
    { key: 'approvals', label: 'Hộp thư Phê duyệt', badge: 4 },
    { key: 'ess', label: 'Không gian Cá nhân' },
  ],
  hrm: [
    { key: 'org', label: 'Cơ cấu tổ chức' },
    { key: 'employees', label: 'Hồ sơ Nhân viên' },
    { key: 'contracts', label: 'Hợp đồng lao động', badge: 3 },
    { key: 'attendance', label: 'Chấm công & Ca làm' },
    { key: 'payroll', label: 'Tính lương & Phiếu lương' },
    { key: 'office', label: 'Tài sản & Phòng họp' },
  ],
  platform: [
    { key: 'crm', label: 'CRM Kinh doanh', soon: true },
    { key: 'settings', label: 'Quản trị & Phân quyền' },
  ],
} as const;
