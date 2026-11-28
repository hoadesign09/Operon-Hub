'use client';

import { useMemo, useState } from 'react';

export type ClassicItemStatus =
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'IN_EXECUTION'
  | 'COMPLETED'
  | 'REJECTED';

export type ClassicModuleType = 'Thanh toán' | 'Tạm ứng' | 'Đề xuất Nội bộ' | 'IT Helpdesk';

export interface ClassicCommentItem {
  id: string;
  author: string;
  role: string;
  createdAt: string;
  content: string;
  attachment?: string;
}

export interface ClassicWorkspaceItem {
  code: string;
  title: string;
  module: ClassicModuleType;
  budgetCode: string;
  requester: string;
  department: string;
  amount: number;
  date: string; // YYYY-MM-DD for accurate range filter & sorting
  dateDisplay: string; // DD/MM/YYYY
  status: ClassicItemStatus;
  isUrgent: boolean;
  isOverBudget: boolean;
  description: string;
  comments: ClassicCommentItem[];
}

export type ClassicSortKey = 'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc' | 'code_asc';

export interface ClassicFilterState {
  // Common filters (always visible directly on toolbar/panel)
  search: string;
  status: 'ALL' | ClassicItemStatus;
  module: 'ALL' | ClassicModuleType;
  budgetCode: string; // 'ALL' or budget code
  department: string; // 'ALL' or department name
  sortBy: ClassicSortKey;
  // Advanced / Extra filters (inside collapsible Advanced Filter panel)
  dateFrom: string;
  dateTo: string;
  minAmount: string;
  maxAmount: string;
  flagFilter: 'ALL' | 'URGENT' | 'OVER_BUDGET';
  requester: string;
}

export const INITIAL_CLASSIC_FILTERS: ClassicFilterState = {
  search: '',
  status: 'ALL',
  module: 'ALL',
  budgetCode: 'ALL',
  department: 'ALL',
  sortBy: 'date_desc',
  dateFrom: '',
  dateTo: '',
  minAmount: '',
  maxAmount: '',
  flagFilter: 'ALL',
  requester: '',
};

export const CLASSIC_BUDGET_OPTIONS = [
  { code: 'BUD-2026-TECH-001', label: 'BUD-2026-TECH-001 • Công nghệ' },
  { code: 'BUD-2026-OPS-001', label: 'BUD-2026-OPS-001 • Vận hành' },
  { code: 'BUD-2026-MKT-001', label: 'BUD-2026-MKT-001 • Tiếp thị' },
  { code: 'BUD-2026-HR-001', label: 'BUD-2026-HR-001 • Nhân sự' },
  { code: 'BUD-2026-PROJ-001', label: 'BUD-2026-PROJ-001 • Dự án' },
] as const;

export const CLASSIC_DEPARTMENT_OPTIONS = [
  'Kỹ thuật Nền tảng',
  'Thiết kế Sản phẩm',
  'Triển khai Dự án',
  'Nhân sự & Hành chính',
  'Tiếp thị & Truyền thông',
  'Tài chính Kế toán',
] as const;

export const INITIAL_CLASSIC_ITEMS: ClassicWorkspaceItem[] = [
  {
    code: 'PAY-2026-0042',
    title: 'Thanh toán hạ tầng Cloud Server & Backup Q4/2026',
    module: 'Thanh toán',
    budgetCode: 'BUD-2026-TECH-001',
    requester: 'Nguyễn Minh Quân',
    department: 'Kỹ thuật Nền tảng',
    amount: 48500000,
    date: '2026-11-27',
    dateDisplay: '27/11/2026',
    status: 'PENDING_APPROVAL',
    isUrgent: true,
    isOverBudget: false,
    description: 'Gia hạn cụm máy chủ production, băng thông dự phòng và sao lưu tự động quý 4.',
    comments: [
      {
        id: 'c-1',
        author: 'Phạm Minh Đức',
        role: 'Kế toán trưởng',
        createdAt: '27/11/2026 10:24',
        content: 'Đã đối chiếu hóa đơn GTGT và hạn mức quỹ BUD-2026-TECH-001. Đủ điều kiện trình duyệt.',
        attachment: 'HoaDon_Cloud_Q4.pdf (412 KB)',
      },
    ],
  },
  {
    code: 'PROP-2026-0019',
    title: 'Đề xuất mua 06 màn hình chuẩn màu cho đội Thiết kế UI/UX',
    module: 'Đề xuất Nội bộ',
    budgetCode: 'BUD-2026-OPS-001',
    requester: 'Trần Thu Hà',
    department: 'Thiết kế Sản phẩm',
    amount: 36000000,
    date: '2026-11-26',
    dateDisplay: '26/11/2026',
    status: 'APPROVED',
    isUrgent: false,
    isOverBudget: false,
    description: 'Trang bị màn hình 27 inch 4K cho nhân sự mới gia nhập nhóm Thiết kế & Frontend.',
    comments: [
      {
        id: 'c-2',
        author: 'Nguyễn Hải Đăng',
        role: 'Giám đốc Điều hành',
        createdAt: '26/11/2026 16:10',
        content: 'Đã phê duyệt dự toán. Chuyển bộ phận mua sắm lập phiếu thanh toán kế thừa ngân sách.',
      },
    ],
  },
  {
    code: 'PAY-2026-0041',
    title: 'Tạm ứng chi phí công tác triển khai ERP chi nhánh Đà Nẵng',
    module: 'Tạm ứng',
    budgetCode: 'BUD-2026-PROJ-001',
    requester: 'Lê Hoàng Nam',
    department: 'Triển khai Dự án',
    amount: 15000000,
    date: '2026-11-25',
    dateDisplay: '25/11/2026',
    status: 'IN_EXECUTION',
    isUrgent: false,
    isOverBudget: false,
    description: 'Vé máy bay, lưu trú và công tác phí 5 ngày cho 3 kỹ sư triển khai onsite.',
    comments: [],
  },
  {
    code: 'IT-2026-0118',
    title: 'Cấp quyền VPN & tài khoản Database Staging cho nhân sự mới',
    module: 'IT Helpdesk',
    budgetCode: '—',
    requester: 'Phạm Ngọc Anh',
    department: 'Nhân sự & Hành chính',
    amount: 0,
    date: '2026-11-25',
    dateDisplay: '25/11/2026',
    status: 'COMPLETED',
    isUrgent: false,
    isOverBudget: false,
    description: 'Onboarding kỹ thuật cho 02 kỹ sư Backend mới nhận việc ngày 25/11.',
    comments: [],
  },
  {
    code: 'PAY-2026-0040',
    title: 'Thanh toán chiến dịch truyền thông ra mắt phiên bản 2.0',
    module: 'Thanh toán',
    budgetCode: 'BUD-2026-MKT-001',
    requester: 'Vũ Khánh Linh',
    department: 'Tiếp thị & Truyền thông',
    amount: 64000000,
    date: '2026-11-24',
    dateDisplay: '24/11/2026',
    status: 'PENDING_APPROVAL',
    isUrgent: true,
    isOverBudget: true,
    description: 'Chi phí booking bài PR, hội thảo trực tuyến và tài liệu bán hàng doanh nghiệp.',
    comments: [
      {
        id: 'c-3',
        author: 'Lê Thị Mai',
        role: 'Kiểm soát Ngân sách',
        createdAt: '24/11/2026 15:40',
        content: 'Lưu ý: Khoản chi làm quỹ MKT vượt 89% kế hoạch (SOFT_WARN). Cần Ban Giám đốc xem xét.',
      },
    ],
  },
  {
    code: 'PROP-2026-0018',
    title: 'Đề xuất tổ chức khóa đào tạo nội bộ ISO 27001 & Bảo mật dữ liệu',
    module: 'Đề xuất Nội bộ',
    budgetCode: 'BUD-2026-HR-001',
    requester: 'Phạm Ngọc Anh',
    department: 'Nhân sự & Hành chính',
    amount: 24000000,
    date: '2026-11-22',
    dateDisplay: '22/11/2026',
    status: 'PENDING_APPROVAL',
    isUrgent: false,
    isOverBudget: false,
    description: 'Mời giảng viên chuyên gia đào tạo 2 buổi cho toàn bộ nhân sự khối Kỹ thuật & Vận hành.',
    comments: [],
  },
  {
    code: 'PAY-2026-0039',
    title: 'Thanh toán in ấn ấn phẩm hội thảo khách hàng doanh nghiệp',
    module: 'Thanh toán',
    budgetCode: 'BUD-2026-MKT-001',
    requester: 'Vũ Khánh Linh',
    department: 'Tiếp thị & Truyền thông',
    amount: 22800000,
    date: '2026-11-21',
    dateDisplay: '21/11/2026',
    status: 'REJECTED',
    isUrgent: false,
    isOverBudget: false,
    description: 'In catalogue, standee và bộ quà tặng hội thảo — bị trả lại do thiếu báo giá so sánh.',
    comments: [],
  },
  {
    code: 'PAY-2026-0038',
    title: 'Thanh toán phí bản quyền phần mềm kế toán & chữ ký số năm 2027',
    module: 'Thanh toán',
    budgetCode: 'BUD-2026-OPS-001',
    requester: 'Đặng Bảo Trâm',
    department: 'Tài chính Kế toán',
    amount: 19500000,
    date: '2026-11-19',
    dateDisplay: '19/11/2026',
    status: 'COMPLETED',
    isUrgent: false,
    isOverBudget: false,
    description: 'Gia hạn token chữ ký số công ty và gói hóa đơn điện tử 10.000 số.',
    comments: [],
  },
  {
    code: 'PAY-2026-0037',
    title: 'Tạm ứng mua thiết bị mạng Wi-Fi 6 cho văn phòng mở rộng tầng 8',
    module: 'Tạm ứng',
    budgetCode: 'BUD-2026-TECH-001',
    requester: 'Nguyễn Minh Quân',
    department: 'Kỹ thuật Nền tảng',
    amount: 28000000,
    date: '2026-11-18',
    dateDisplay: '18/11/2026',
    status: 'APPROVED',
    isUrgent: false,
    isOverBudget: false,
    description: '04 bộ phát Access Point doanh nghiệp, switch PoE 24 cổng và thi công cáp mạng.',
    comments: [],
  },
  {
    code: 'IT-2026-0115',
    title: 'Xử lý sự cố đồng bộ máy chấm công vân tay chi nhánh Hà Nội',
    module: 'IT Helpdesk',
    budgetCode: '—',
    requester: 'Lê Hoàng Nam',
    department: 'Triển khai Dự án',
    amount: 0,
    date: '2026-11-16',
    dateDisplay: '16/11/2026',
    status: 'IN_EXECUTION',
    isUrgent: true,
    isOverBudget: false,
    description: 'Kiểm tra kết nối LAN và đồng bộ dữ liệu chấm công về máy chủ trung tâm.',
    comments: [],
  },
  {
    code: 'PROP-2026-0017',
    title: 'Đề xuất gói khám sức khỏe định kỳ nhân viên năm 2026',
    module: 'Đề xuất Nội bộ',
    budgetCode: 'BUD-2026-HR-001',
    requester: 'Phạm Ngọc Anh',
    department: 'Nhân sự & Hành chính',
    amount: 52000000,
    date: '2026-11-14',
    dateDisplay: '14/11/2026',
    status: 'APPROVED',
    isUrgent: false,
    isOverBudget: false,
    description: 'Gói khám tổng quát cho 65 nhân sự tại 2 chi nhánh TP.HCM và Hà Nội.',
    comments: [],
  },
  {
    code: 'PAY-2026-0036',
    title: 'Thanh toán đợt 1 hợp đồng thuê chuyên gia kiểm thử bảo mật',
    module: 'Thanh toán',
    budgetCode: 'BUD-2026-PROJ-001',
    requester: 'Lê Hoàng Nam',
    department: 'Triển khai Dự án',
    amount: 42000000,
    date: '2026-11-10',
    dateDisplay: '10/11/2026',
    status: 'PENDING_APPROVAL',
    isUrgent: false,
    isOverBudget: true,
    description: 'Đánh giá Pentest ứng dụng web và API trước khi bàn giao khách hàng lớn.',
    comments: [],
  },
];

export function formatVndCompact(amount: number): string {
  return `${new Intl.NumberFormat('vi-VN').format(amount)} ₫`;
}

export function formatStatusLabel(status: ClassicItemStatus): string {
  switch (status) {
    case 'PENDING_APPROVAL':
      return 'Chờ phê duyệt';
    case 'APPROVED':
      return 'Đã duyệt';
    case 'IN_EXECUTION':
      return 'Đang giải ngân';
    case 'COMPLETED':
      return 'Hoàn tất';
    case 'REJECTED':
      return 'Từ chối';
  }
}

export interface ActiveFilterChip {
  key: string;
  label: string;
  onRemove: () => void;
}

export function useClassicWorkspaceState() {
  const [items, setItems] = useState<ClassicWorkspaceItem[]>(INITIAL_CLASSIC_ITEMS);
  const [filters, setFilters] = useState<ClassicFilterState>(INITIAL_CLASSIC_FILTERS);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [selectedCodes, setSelectedCodes] = useState<string[]>(['PAY-2026-0042']);
  const [activeItemCode, setActiveItemCode] = useState<string>('PAY-2026-0042');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  function showToast(message: string) {
    setToastMessage(message);
    window.setTimeout(() => {
      setToastMessage((cur) => (cur === message ? null : cur));
    }, 3200);
  }

  function updateFilter<K extends keyof ClassicFilterState>(key: K, value: ClassicFilterState[K]) {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  }

  function resetAllFilters() {
    setFilters(INITIAL_CLASSIC_FILTERS);
    setPage(1);
  }

  function resetAdvancedFilters() {
    setFilters((prev) => ({
      ...prev,
      dateFrom: '',
      dateTo: '',
      minAmount: '',
      maxAmount: '',
      flagFilter: 'ALL',
      requester: '',
    }));
    setPage(1);
  }

  const activeAdvancedCount = useMemo(() => {
    let count = 0;
    if (filters.dateFrom) count += 1;
    if (filters.dateTo) count += 1;
    if (filters.minAmount.trim()) count += 1;
    if (filters.maxAmount.trim()) count += 1;
    if (filters.flagFilter !== 'ALL') count += 1;
    if (filters.requester.trim()) count += 1;
    return count;
  }, [filters]);

  const statusCounts = useMemo(() => {
    const counts: Record<'ALL' | ClassicItemStatus, number> = {
      ALL: items.length,
      PENDING_APPROVAL: 0,
      APPROVED: 0,
      IN_EXECUTION: 0,
      COMPLETED: 0,
      REJECTED: 0,
    };
    for (const item of items) {
      counts[item.status] += 1;
    }
    return counts;
  }, [items]);

  const filteredItems = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    const reqQ = filters.requester.trim().toLowerCase();
    const minAmt = filters.minAmount.trim() ? Number(filters.minAmount.replace(/[^\d]/g, '')) : null;
    const maxAmt = filters.maxAmount.trim() ? Number(filters.maxAmount.replace(/[^\d]/g, '')) : null;

    const list = items.filter((item) => {
      if (filters.status !== 'ALL' && item.status !== filters.status) return false;
      if (filters.module !== 'ALL' && item.module !== filters.module) return false;
      if (filters.budgetCode !== 'ALL' && item.budgetCode !== filters.budgetCode) return false;
      if (filters.department !== 'ALL' && item.department !== filters.department) return false;
      if (filters.dateFrom && item.date < filters.dateFrom) return false;
      if (filters.dateTo && item.date > filters.dateTo) return false;
      if (minAmt !== null && !Number.isNaN(minAmt) && item.amount < minAmt) return false;
      if (maxAmt !== null && !Number.isNaN(maxAmt) && item.amount > maxAmt) return false;
      if (filters.flagFilter === 'URGENT' && !item.isUrgent) return false;
      if (filters.flagFilter === 'OVER_BUDGET' && !item.isOverBudget) return false;
      if (reqQ && !item.requester.toLowerCase().includes(reqQ)) return false;
      if (q) {
        const hay = `${item.code} ${item.title} ${item.requester} ${item.department} ${item.budgetCode}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    return [...list].sort((a, b) => {
      switch (filters.sortBy) {
        case 'date_desc':
          return b.date.localeCompare(a.date) || b.code.localeCompare(a.code);
        case 'date_asc':
          return a.date.localeCompare(b.date) || a.code.localeCompare(b.code);
        case 'amount_desc':
          return b.amount - a.amount;
        case 'amount_asc':
          return a.amount - b.amount;
        case 'code_asc':
          return a.code.localeCompare(b.code);
      }
    });
  }, [items, filters]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const safePage = Math.min(page, totalPages);

  const paginatedItems = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, safePage, pageSize]);

  const filteredTotalAmount = useMemo(
    () => filteredItems.reduce((sum, item) => sum + item.amount, 0),
    [filteredItems],
  );

  const activeItem = useMemo(
    () => items.find((item) => item.code === activeItemCode) ?? filteredItems[0] ?? items[0],
    [items, activeItemCode, filteredItems],
  );

  const activeFilterChips = useMemo<ActiveFilterChip[]>(() => {
    const chips: ActiveFilterChip[] = [];
    if (filters.search.trim()) {
      chips.push({
        key: 'search',
        label: `Từ khóa: "${filters.search.trim()}"`,
        onRemove: () => updateFilter('search', ''),
      });
    }
    if (filters.status !== 'ALL') {
      chips.push({
        key: 'status',
        label: `Trạng thái: ${formatStatusLabel(filters.status)}`,
        onRemove: () => updateFilter('status', 'ALL'),
      });
    }
    if (filters.module !== 'ALL') {
      chips.push({
        key: 'module',
        label: `Phân hệ: ${filters.module}`,
        onRemove: () => updateFilter('module', 'ALL'),
      });
    }
    if (filters.budgetCode !== 'ALL') {
      chips.push({
        key: 'budgetCode',
        label: `Quỹ: ${filters.budgetCode}`,
        onRemove: () => updateFilter('budgetCode', 'ALL'),
      });
    }
    if (filters.department !== 'ALL') {
      chips.push({
        key: 'department',
        label: `Phòng ban: ${filters.department}`,
        onRemove: () => updateFilter('department', 'ALL'),
      });
    }
    if (filters.dateFrom || filters.dateTo) {
      chips.push({
        key: 'dateRange',
        label: `Ngày: ${filters.dateFrom || '...'} → ${filters.dateTo || '...'}`,
        onRemove: () => {
          setFilters((prev) => ({ ...prev, dateFrom: '', dateTo: '' }));
          setPage(1);
        },
      });
    }
    if (filters.minAmount || filters.maxAmount) {
      chips.push({
        key: 'amountRange',
        label: `Số tiền: ${filters.minAmount || '0'} → ${filters.maxAmount || '∞'}`,
        onRemove: () => {
          setFilters((prev) => ({ ...prev, minAmount: '', maxAmount: '' }));
          setPage(1);
        },
      });
    }
    if (filters.flagFilter !== 'ALL') {
      chips.push({
        key: 'flag',
        label: filters.flagFilter === 'URGENT' ? 'Cờ: Khẩn cấp' : 'Cờ: Vượt ngân sách',
        onRemove: () => updateFilter('flagFilter', 'ALL'),
      });
    }
    if (filters.requester.trim()) {
      chips.push({
        key: 'requester',
        label: `Người lập: ${filters.requester.trim()}`,
        onRemove: () => updateFilter('requester', ''),
      });
    }
    return chips;
  }, [filters]);

  function toggleRowSelection(code: string) {
    setSelectedCodes((prev) =>
      prev.includes(code) ? prev.filter((item) => item !== code) : [...prev, code],
    );
  }

  function toggleSelectAllPage() {
    const pageCodes = paginatedItems.map((r) => r.code);
    const allSelected = pageCodes.length > 0 && pageCodes.every((code) => selectedCodes.includes(code));
    if (allSelected) {
      setSelectedCodes((prev) => prev.filter((c) => !pageCodes.includes(c)));
    } else {
      setSelectedCodes((prev) => Array.from(new Set([...prev, ...pageCodes])));
    }
  }

  function updateItemStatus(code: string, status: ClassicItemStatus) {
    setItems((prev) => prev.map((item) => (item.code === code ? { ...item, status } : item)));
    showToast(`Đã cập nhật ${code} → ${formatStatusLabel(status)}`);
  }

  function bulkApproveSelected() {
    if (selectedCodes.length === 0) return;
    setItems((prev) =>
      prev.map((item) =>
        selectedCodes.includes(item.code) && item.status === 'PENDING_APPROVAL'
          ? { ...item, status: 'APPROVED' }
          : item,
      ),
    );
    showToast(`Đã duyệt nhanh các hồ sơ Chờ phê duyệt trong ${selectedCodes.length} dòng đã chọn.`);
    setSelectedCodes([]);
  }

  function createItem(payload: {
    title: string;
    module: ClassicModuleType;
    budgetCode: string;
    department: string;
    amount: number;
    isUrgent: boolean;
  }) {
    const nextNum = 43 + items.length - INITIAL_CLASSIC_ITEMS.length;
    const prefix =
      payload.module === 'Đề xuất Nội bộ'
        ? 'PROP'
        : payload.module === 'IT Helpdesk'
          ? 'IT'
          : 'PAY';
    const newCode = `${prefix}-2026-00${nextNum}`;
    const newItem: ClassicWorkspaceItem = {
      code: newCode,
      title: payload.title.trim() || 'Phiếu đề nghị vận hành mới',
      module: payload.module,
      budgetCode: payload.budgetCode || '—',
      requester: 'Nguyễn Quản Trị',
      department: payload.department,
      amount: payload.amount,
      date: '2026-11-27',
      dateDisplay: '27/11/2026',
      status: 'PENDING_APPROVAL',
      isUrgent: payload.isUrgent,
      isOverBudget: payload.amount > 65000000,
      description: 'Hồ sơ vừa khởi tạo trực tiếp trong bản xem trước tương tác.',
      comments: [],
    };
    setItems((prev) => [newItem, ...prev]);
    setActiveItemCode(newCode);
    setPage(1);
    showToast(`Đã tạo mới hồ sơ ${newCode} thành công.`);
  }

  function addComment(code: string, content: string, attachment?: string) {
    if (!content.trim() && !attachment) return;
    const comment: ClassicCommentItem = {
      id: `c-${Date.now()}`,
      author: 'Nguyễn Quản Trị',
      role: 'Super Admin',
      createdAt: '27/11/2026 vừa xong',
      content: content.trim() || 'Đã tải lên tệp chứng từ bổ sung.',
      attachment,
    };
    setItems((prev) =>
      prev.map((item) =>
        item.code === code ? { ...item, comments: [...item.comments, comment] } : item,
      ),
    );
    showToast(`Đã thêm ghi chú vào hồ sơ ${code}.`);
  }

  return {
    items,
    filters,
    isAdvancedOpen,
    setIsAdvancedOpen,
    updateFilter,
    resetAllFilters,
    resetAdvancedFilters,
    activeAdvancedCount,
    activeFilterChips,
    statusCounts,
    filteredItems,
    paginatedItems,
    filteredTotalAmount,
    page: safePage,
    setPage,
    pageSize,
    setPageSize,
    totalPages,
    selectedCodes,
    setSelectedCodes,
    toggleRowSelection,
    toggleSelectAllPage,
    activeItem,
    setActiveItemCode,
    updateItemStatus,
    bulkApproveSelected,
    createItem,
    addComment,
    toastMessage,
    showToast,
  };
}

export type ClassicWorkspaceStore = ReturnType<typeof useClassicWorkspaceState>;
