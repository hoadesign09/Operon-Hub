export type ClassicThemeId =
  | 'swiss-slate'
  | 'graphite-executive'
  | 'paper-ink'
  | 'oxford-topbar'
  | 'precision-grid';

export type ClassicNavLayout = 'sidebar-light' | 'sidebar-dark' | 'sidebar-warm' | 'topbar-dual' | 'sidebar-compact';

export interface ClassicThemeTokens {
  id: ClassicThemeId;
  index: number;
  name: string;
  subtitle: string;
  tagline: string;
  navLayout: ClassicNavLayout;
  navigationSummary: string;
  densityLabel: string;
  bestFor: string;
  palette: {
    canvas: string;
    surface: string;
    navigation: string;
    primary: string;
    border: string;
  };
  highlights: readonly string[];
  classes: {
    // App Shell
    canvas: string;
    sidebar: string;
    sidebarHeader: string;
    sidebarBrand: string;
    sidebarSubBrand: string;
    sidebarGroupLabel: string;
    sidebarItemActive: string;
    sidebarItemIdle: string;
    sidebarIconActive: string;
    sidebarIconIdle: string;
    sidebarFooter: string;
    topbar: string;
    topbarSubnav: string;
    topbarSubnavActive: string;
    topbarSubnavIdle: string;
    topbarTitle: string;
    topbarBreadcrumb: string;
    topbarControl: string;

    // Layout & Cards
    card: string;
    cardHeader: string;
    cardMuted: string;
    divider: string;
    radius: string;

    // Typography
    heading1: string;
    heading2: string;
    heading3: string;
    bodyText: string;
    mutedText: string;
    codeTag: string;

    // Buttons
    btnPrimary: string;
    btnSecondary: string;
    btnOutline: string;
    btnGhost: string;
    btnDanger: string;
    btnSuccess: string;
    btnDisabled: string;
    btnIcon: string;
    segmentedWrap: string;
    segmentedActive: string;
    segmentedIdle: string;

    // Form Elements
    label: string;
    input: string;
    inputError: string;
    inputDisabled: string;
    select: string;
    checkbox: string;
    switchTrackOn: string;
    switchTrackOff: string;
    dropzone: string;

    // Tables
    tableWrap: string;
    tableHead: string;
    tableTh: string;
    tableRow: string;
    tableCell: string;
    tableFooter: string;

    // Badges
    badgeNeutral: string;
    badgeInfo: string;
    badgeSuccess: string;
    badgeWarning: string;
    badgeDanger: string;

    // Alerts
    alertInfo: string;
    alertSuccess: string;
    alertWarning: string;
    alertDanger: string;

    // Tabs & Progress
    tabsWrap: string;
    tabActive: string;
    tabIdle: string;
    progressTrack: string;
    progressFill: string;
    progressFillWarn: string;

    // Modal & Drawer
    modalBackdrop: string;
    modalSurface: string;
    modalHeader: string;
    modalFooter: string;

    // Chart bars
    chartBarPrimary: string;
    chartBarSecondary: string;
  };
}

export const CLASSIC_THEME_SPECS: readonly ClassicThemeTokens[] = [
  {
    id: 'swiss-slate',
    index: 1,
    name: 'Swiss Slate',
    subtitle: 'Tối giản Thụy Sĩ — Đơn sắc Sạch & Hiện đại',
    tagline: 'Nền xám rất nhẹ, bề mặt trắng sắc nét, viền mảnh 1px và điểm nhấn đen than chuẩn mực.',
    navLayout: 'sidebar-light',
    navigationSummary: 'Sidebar trắng (240px) • Dải KPI phẳng • Tab lọc trạng thái nhanh + Dòng bảng mở rộng trực tiếp',
    densityLabel: 'Cân bằng thoáng (Minimal Linear)',
    bestFor: 'Đội ngũ thích sự tinh gọn tối đa, mở chi tiết trực tiếp ngay tại dòng bảng mà không nhảy trang.',
    palette: {
      canvas: '#F8F9FA',
      surface: '#FFFFFF',
      navigation: '#FFFFFF',
      primary: '#18181B',
      border: '#E4E4E7',
    },
    highlights: [
      'Đơn sắc Zinc/Charcoal hiện đại — gần như không có màu trang trí thừa, cực kỳ bền dáng theo thời gian.',
      'Viền mảnh 1px kết hợp bo góc 8px vừa phải, giảm tối đa bóng đổ nặng nề.',
      'Badge trạng thái dùng tông pastel dịu có viền mảnh giúp đọc nhanh mà không chói mắt.',
    ],
    classes: {
      canvas: 'bg-[#F8F9FA] text-zinc-900',
      sidebar: 'w-[240px] border-r border-zinc-200 bg-white text-zinc-700',
      sidebarHeader: 'h-14 border-b border-zinc-200 px-4',
      sidebarBrand: 'text-sm font-semibold tracking-tight text-zinc-950',
      sidebarSubBrand: 'text-[11px] font-medium text-zinc-500',
      sidebarGroupLabel: 'px-3 pt-4 pb-1.5 text-[10px] font-semibold tracking-wider text-zinc-400 uppercase',
      sidebarItemActive: 'bg-zinc-100 text-zinc-950 font-semibold border-l-2 border-zinc-900 rounded-r-md rounded-l-none',
      sidebarItemIdle: 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-950 rounded-md',
      sidebarIconActive: 'text-zinc-900',
      sidebarIconIdle: 'text-zinc-400',
      sidebarFooter: 'border-t border-zinc-200 bg-zinc-50/70 p-3',
      topbar: 'h-14 border-b border-zinc-200 bg-white/95 backdrop-blur-xs',
      topbarSubnav: '',
      topbarSubnavActive: '',
      topbarSubnavIdle: '',
      topbarTitle: 'text-sm font-semibold tracking-tight text-zinc-950',
      topbarBreadcrumb: 'text-xs text-zinc-400',
      topbarControl: 'h-8 rounded-md border border-zinc-200 bg-white px-2.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50',

      card: 'rounded-lg border border-zinc-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)]',
      cardHeader: 'border-b border-zinc-100 px-5 py-3.5',
      cardMuted: 'rounded-lg border border-zinc-200 bg-zinc-50/80',
      divider: 'border-zinc-200',
      radius: 'rounded-md',

      heading1: 'text-xl font-semibold tracking-tight text-zinc-950',
      heading2: 'text-sm font-semibold tracking-tight text-zinc-900',
      heading3: 'text-xs font-semibold tracking-wide text-zinc-700 uppercase',
      bodyText: 'text-sm text-zinc-700',
      mutedText: 'text-xs text-zinc-500',
      codeTag: 'rounded border border-zinc-200 bg-zinc-100 px-1.5 py-0.5 font-mono text-[11px] font-medium text-zinc-800',

      btnPrimary: 'inline-flex items-center justify-center gap-1.5 rounded-md bg-zinc-900 px-3.5 py-2 text-xs font-medium text-white transition hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900/20',
      btnSecondary: 'inline-flex items-center justify-center gap-1.5 rounded-md bg-zinc-100 px-3.5 py-2 text-xs font-medium text-zinc-900 transition hover:bg-zinc-200/80',
      btnOutline: 'inline-flex items-center justify-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3.5 py-2 text-xs font-medium text-zinc-800 transition hover:bg-zinc-50',
      btnGhost: 'inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900',
      btnDanger: 'inline-flex items-center justify-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-3.5 py-2 text-xs font-medium text-red-700 transition hover:bg-red-100',
      btnSuccess: 'inline-flex items-center justify-center gap-1.5 rounded-md bg-emerald-700 px-3.5 py-2 text-xs font-medium text-white transition hover:bg-emerald-800',
      btnDisabled: 'inline-flex items-center justify-center gap-1.5 rounded-md border border-zinc-200 bg-zinc-100 px-3.5 py-2 text-xs font-medium text-zinc-400 cursor-not-allowed',
      btnIcon: 'inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-600 transition hover:bg-zinc-50 hover:text-zinc-950',
      segmentedWrap: 'inline-flex rounded-md border border-zinc-200 bg-zinc-100 p-0.5',
      segmentedActive: 'rounded bg-white px-3 py-1 text-xs font-semibold text-zinc-900 shadow-2xs',
      segmentedIdle: 'rounded px-3 py-1 text-xs font-medium text-zinc-600 hover:text-zinc-900',

      label: 'block text-xs font-medium text-zinc-700 mb-1.5',
      input: 'w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 transition focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10',
      inputError: 'w-full rounded-md border border-red-400 bg-white px-3 py-2 text-xs text-zinc-900 focus:border-red-600 focus:outline-none focus:ring-2 focus:ring-red-500/15',
      inputDisabled: 'w-full rounded-md border border-zinc-200 bg-zinc-100 px-3 py-2 text-xs text-zinc-500 cursor-not-allowed',
      select: 'w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-900 transition focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10',
      checkbox: 'h-4 w-4 rounded border-zinc-300 accent-zinc-900',
      switchTrackOn: 'bg-zinc-900',
      switchTrackOff: 'bg-zinc-200',
      dropzone: 'rounded-lg border border-dashed border-zinc-300 bg-zinc-50/70 p-5 text-center transition hover:border-zinc-500 hover:bg-zinc-100/60',

      tableWrap: 'overflow-x-auto rounded-lg border border-zinc-200 bg-white',
      tableHead: 'border-b border-zinc-200 bg-zinc-50',
      tableTh: 'px-4 py-2.5 text-left text-[11px] font-semibold tracking-wide text-zinc-500 uppercase',
      tableRow: 'border-b border-zinc-100 transition hover:bg-zinc-50/90 last:border-b-0',
      tableCell: 'px-4 py-3 text-xs text-zinc-700',
      tableFooter: 'flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 bg-zinc-50/60 px-4 py-2.5 text-xs text-zinc-500',

      badgeNeutral: 'inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-700',
      badgeInfo: 'inline-flex items-center gap-1 rounded-md border border-slate-300 bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-800',
      badgeSuccess: 'inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800',
      badgeWarning: 'inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800',
      badgeDanger: 'inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-800',

      alertInfo: 'rounded-lg border border-zinc-200 bg-zinc-50 p-3.5 text-xs text-zinc-800',
      alertSuccess: 'rounded-lg border border-emerald-200 bg-emerald-50/70 p-3.5 text-xs text-emerald-900',
      alertWarning: 'rounded-lg border border-amber-200 bg-amber-50/70 p-3.5 text-xs text-amber-900',
      alertDanger: 'rounded-lg border border-red-200 bg-red-50/70 p-3.5 text-xs text-red-900',

      tabsWrap: 'flex items-center gap-5 border-b border-zinc-200',
      tabActive: 'border-b-2 border-zinc-900 pb-2.5 text-xs font-semibold text-zinc-950',
      tabIdle: 'border-b-2 border-transparent pb-2.5 text-xs font-medium text-zinc-500 hover:text-zinc-800',
      progressTrack: 'h-1.5 w-full overflow-hidden rounded-full bg-zinc-200',
      progressFill: 'h-full rounded-full bg-zinc-900',
      progressFillWarn: 'h-full rounded-full bg-amber-600',

      modalBackdrop: 'bg-zinc-950/45 backdrop-blur-[1px]',
      modalSurface: 'rounded-xl border border-zinc-200 bg-white shadow-xl',
      modalHeader: 'border-b border-zinc-200 px-5 py-4',
      modalFooter: 'border-t border-zinc-200 bg-zinc-50 px-5 py-3',

      chartBarPrimary: 'bg-zinc-800',
      chartBarSecondary: 'bg-zinc-300',
    },
  },
  {
    id: 'graphite-executive',
    index: 2,
    name: 'Graphite Executive',
    subtitle: 'Cổ điển Hiện đại — Sidebar Than chì + Nội dung Trắng sắc',
    tagline: 'Sidebar đơn màu than chì lì sang trọng kết hợp vùng làm việc trắng tinh và điểm nhấn xanh thép trầm.',
    navLayout: 'sidebar-dark',
    navigationSummary: 'Sidebar than chì (248px) • Bộ lọc khung 2 tầng • Bố cục Master-Detail (Danh sách trái + Xem nhanh phải)',
    densityLabel: 'Chuẩn Doanh nghiệp (Split Inspector)',
    bestFor: 'Doanh nghiệp thích cấu trúc kinh điển (menu tối bên trái, dữ liệu sáng bên phải) nhưng thanh lịch, không chói xanh neon.',
    palette: {
      canvas: '#F4F5F7',
      surface: '#FFFFFF',
      navigation: '#1C1F26',
      primary: '#2B4C7E',
      border: '#E2E5EC',
    },
    highlights: [
      'Sidebar đơn gọn gàng hơn Dual-Rail hiện tại, dùng nền than chì lì (#1C1F26) không màu mè gradient.',
      'Điểm nhấn duy nhất là Xanh Oxford trầm (#2B4C7E) tạo sự tin cậy cho phần mềm tài chính/nhân sự.',
      'Cấu trúc card, bảng, form rõ ràng, tương phản tốt trên mọi màn hình văn phòng.',
    ],
    classes: {
      canvas: 'bg-[#F4F5F7] text-slate-900',
      sidebar: 'w-[248px] border-r border-slate-800 bg-[#1C1F26] text-slate-300',
      sidebarHeader: 'h-14 border-b border-white/10 px-4',
      sidebarBrand: 'text-sm font-semibold tracking-tight text-white',
      sidebarSubBrand: 'text-[11px] text-slate-400',
      sidebarGroupLabel: 'px-3 pt-4 pb-1.5 text-[10px] font-semibold tracking-wider text-slate-500 uppercase',
      sidebarItemActive: 'bg-white/10 text-white font-semibold rounded-md',
      sidebarItemIdle: 'text-slate-400 hover:bg-white/5 hover:text-slate-100 rounded-md',
      sidebarIconActive: 'text-white',
      sidebarIconIdle: 'text-slate-500',
      sidebarFooter: 'border-t border-white/10 bg-[#161920] p-3',
      topbar: 'h-14 border-b border-[#E2E5EC] bg-white',
      topbarSubnav: '',
      topbarSubnavActive: '',
      topbarSubnavIdle: '',
      topbarTitle: 'text-sm font-semibold text-slate-900',
      topbarBreadcrumb: 'text-xs text-slate-400',
      topbarControl: 'h-8 rounded-md border border-slate-200 bg-slate-50 px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-100',

      card: 'rounded-lg border border-[#E2E5EC] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]',
      cardHeader: 'border-b border-[#EDF0F5] px-5 py-3.5',
      cardMuted: 'rounded-lg border border-[#E2E5EC] bg-[#F8F9FB]',
      divider: 'border-[#E2E5EC]',
      radius: 'rounded-md',

      heading1: 'text-xl font-semibold tracking-tight text-slate-900',
      heading2: 'text-sm font-semibold text-slate-900',
      heading3: 'text-xs font-semibold tracking-wide text-slate-600 uppercase',
      bodyText: 'text-sm text-slate-700',
      mutedText: 'text-xs text-slate-500',
      codeTag: 'rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] font-medium text-slate-700',

      btnPrimary: 'inline-flex items-center justify-center gap-1.5 rounded-md bg-[#2B4C7E] px-3.5 py-2 text-xs font-medium text-white transition hover:bg-[#223D66] focus:outline-none focus:ring-2 focus:ring-[#2B4C7E]/25',
      btnSecondary: 'inline-flex items-center justify-center gap-1.5 rounded-md bg-slate-100 px-3.5 py-2 text-xs font-medium text-slate-800 transition hover:bg-slate-200',
      btnOutline: 'inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50',
      btnGhost: 'inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900',
      btnDanger: 'inline-flex items-center justify-center gap-1.5 rounded-md bg-rose-700 px-3.5 py-2 text-xs font-medium text-white transition hover:bg-rose-800',
      btnSuccess: 'inline-flex items-center justify-center gap-1.5 rounded-md bg-emerald-700 px-3.5 py-2 text-xs font-medium text-white transition hover:bg-emerald-800',
      btnDisabled: 'inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-slate-100 px-3.5 py-2 text-xs font-medium text-slate-400 cursor-not-allowed',
      btnIcon: 'inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-900',
      segmentedWrap: 'inline-flex rounded-md border border-slate-200 bg-slate-100 p-0.5',
      segmentedActive: 'rounded bg-white px-3 py-1 text-xs font-semibold text-[#2B4C7E] shadow-2xs',
      segmentedIdle: 'rounded px-3 py-1 text-xs font-medium text-slate-600 hover:text-slate-900',

      label: 'block text-xs font-medium text-slate-700 mb-1.5',
      input: 'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 transition focus:border-[#2B4C7E] focus:outline-none focus:ring-2 focus:ring-[#2B4C7E]/15',
      inputError: 'w-full rounded-md border border-rose-400 bg-white px-3 py-2 text-xs text-slate-900 focus:border-rose-600 focus:outline-none focus:ring-2 focus:ring-rose-500/15',
      inputDisabled: 'w-full rounded-md border border-slate-200 bg-slate-100 px-3 py-2 text-xs text-slate-400 cursor-not-allowed',
      select: 'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 transition focus:border-[#2B4C7E] focus:outline-none focus:ring-2 focus:ring-[#2B4C7E]/15',
      checkbox: 'h-4 w-4 rounded border-slate-300 accent-[#2B4C7E]',
      switchTrackOn: 'bg-[#2B4C7E]',
      switchTrackOff: 'bg-slate-300',
      dropzone: 'rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 text-center transition hover:border-[#2B4C7E] hover:bg-slate-100/70',

      tableWrap: 'overflow-x-auto rounded-lg border border-[#E2E5EC] bg-white',
      tableHead: 'border-b border-[#E2E5EC] bg-[#F8F9FB]',
      tableTh: 'px-4 py-2.5 text-left text-[11px] font-semibold tracking-wide text-slate-600 uppercase',
      tableRow: 'border-b border-slate-100 transition hover:bg-slate-50 last:border-b-0',
      tableCell: 'px-4 py-3 text-xs text-slate-700',
      tableFooter: 'flex flex-wrap items-center justify-between gap-3 border-t border-[#E2E5EC] bg-[#F8F9FB] px-4 py-2.5 text-xs text-slate-500',

      badgeNeutral: 'inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700',
      badgeInfo: 'inline-flex items-center gap-1 rounded-md border border-[#C7D7EE] bg-[#EDF3FB] px-2 py-0.5 text-[11px] font-medium text-[#24426F]',
      badgeSuccess: 'inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800',
      badgeWarning: 'inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800',
      badgeDanger: 'inline-flex items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-800',

      alertInfo: 'rounded-lg border border-[#C7D7EE] bg-[#F4F8FD] p-3.5 text-xs text-[#1E3A63]',
      alertSuccess: 'rounded-lg border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-900',
      alertWarning: 'rounded-lg border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900',
      alertDanger: 'rounded-lg border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-900',

      tabsWrap: 'flex items-center gap-5 border-b border-slate-200',
      tabActive: 'border-b-2 border-[#2B4C7E] pb-2.5 text-xs font-semibold text-[#2B4C7E]',
      tabIdle: 'border-b-2 border-transparent pb-2.5 text-xs font-medium text-slate-500 hover:text-slate-800',
      progressTrack: 'h-2 w-full overflow-hidden rounded-full bg-slate-200',
      progressFill: 'h-full rounded-full bg-[#2B4C7E]',
      progressFillWarn: 'h-full rounded-full bg-amber-600',

      modalBackdrop: 'bg-slate-950/50 backdrop-blur-[1px]',
      modalSurface: 'rounded-xl border border-slate-200 bg-white shadow-xl',
      modalHeader: 'border-b border-slate-200 px-5 py-4',
      modalFooter: 'border-t border-slate-200 bg-slate-50 px-5 py-3',

      chartBarPrimary: 'bg-[#2B4C7E]',
      chartBarSecondary: 'bg-slate-300',
    },
  },
  {
    id: 'paper-ink',
    index: 3,
    name: 'Paper & Ink',
    subtitle: 'Giấy Ngà & Mực Trầm — Êm mắt, Tinh tế Cổ điển',
    tagline: 'Tông giấy ngà ấm (#F7F6F2) kết hợp mực đá trầm và viền đá dịu mắt, làm việc 8 tiếng không mỏi.',
    navLayout: 'sidebar-warm',
    navigationSummary: 'Sidebar giấy ngà (244px) • Cột Bộ lọc dọc cố định bên trái • Đổi mượt Dạng Thẻ ↔ Dạng Sổ cái',
    densityLabel: 'Thoáng & Dịu mắt (Editorial Rail)',
    bestFor: 'Người dùng làm việc lâu với văn bản, đề xuất, hồ sơ nhân sự và tài chính muốn cảm giác ấm áp, trang nhã.',
    palette: {
      canvas: '#F7F6F2',
      surface: '#FFFFFF',
      navigation: '#F1EFEA',
      primary: '#292524',
      border: '#E5E2DC',
    },
    highlights: [
      'Giảm ánh sáng xanh chói gắt nhờ nền giấy Alabaster ấm (#F7F6F2) và bề mặt trắng tự nhiên.',
      'Màu nhấn chính là Mực Đá (#292524) + Xanh Petrol trầm (#1F515B) cho liên kết và chỉ báo.',
      'Cảm giác gọn gàng, nhân văn, rất giống phong cách tài liệu cao cấp của châu Âu.',
    ],
    classes: {
      canvas: 'bg-[#F7F6F2] text-stone-900',
      sidebar: 'w-[244px] border-r border-[#E5E2DC] bg-[#F1EFEA] text-stone-700',
      sidebarHeader: 'h-14 border-b border-[#E5E2DC] px-4',
      sidebarBrand: 'text-sm font-semibold tracking-tight text-stone-900',
      sidebarSubBrand: 'text-[11px] text-stone-500',
      sidebarGroupLabel: 'px-3 pt-4 pb-1.5 text-[10px] font-semibold tracking-wider text-stone-400 uppercase',
      sidebarItemActive: 'bg-white text-stone-950 font-semibold shadow-2xs ring-1 ring-[#E5E2DC] rounded-lg',
      sidebarItemIdle: 'text-stone-600 hover:bg-stone-200/60 hover:text-stone-900 rounded-lg',
      sidebarIconActive: 'text-[#1F515B]',
      sidebarIconIdle: 'text-stone-400',
      sidebarFooter: 'border-t border-[#E5E2DC] bg-[#ECE9E2]/80 p-3',
      topbar: 'h-14 border-b border-[#E5E2DC] bg-[#F7F6F2]/95 backdrop-blur-xs',
      topbarSubnav: '',
      topbarSubnavActive: '',
      topbarSubnavIdle: '',
      topbarTitle: 'text-sm font-semibold text-stone-900',
      topbarBreadcrumb: 'text-xs text-stone-400',
      topbarControl: 'h-8 rounded-lg border border-[#DDD9D0] bg-white px-2.5 text-xs font-medium text-stone-700 hover:bg-stone-50',

      card: 'rounded-xl border border-[#E5E2DC] bg-white shadow-[0_1px_2px_rgba(41,37,36,0.03)]',
      cardHeader: 'border-b border-[#EFECE6] px-5 py-3.5',
      cardMuted: 'rounded-xl border border-[#E5E2DC] bg-[#FAF9F5]',
      divider: 'border-[#E5E2DC]',
      radius: 'rounded-lg',

      heading1: 'text-xl font-semibold tracking-tight text-stone-900',
      heading2: 'text-sm font-semibold text-stone-900',
      heading3: 'text-xs font-semibold tracking-wide text-stone-600 uppercase',
      bodyText: 'text-sm text-stone-700',
      mutedText: 'text-xs text-stone-500',
      codeTag: 'rounded border border-[#E5E2DC] bg-[#F5F3EE] px-1.5 py-0.5 font-mono text-[11px] font-medium text-stone-800',

      btnPrimary: 'inline-flex items-center justify-center gap-1.5 rounded-lg bg-stone-800 px-3.5 py-2 text-xs font-medium text-stone-50 transition hover:bg-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-800/20',
      btnSecondary: 'inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#EFECE6] px-3.5 py-2 text-xs font-medium text-stone-800 transition hover:bg-[#E5E1D8]',
      btnOutline: 'inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#D6D2C9] bg-white px-3.5 py-2 text-xs font-medium text-stone-700 transition hover:bg-[#FAF9F5]',
      btnGhost: 'inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-stone-600 transition hover:bg-stone-200/60 hover:text-stone-900',
      btnDanger: 'inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2 text-xs font-medium text-red-800 transition hover:bg-red-100',
      btnSuccess: 'inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#1F515B] px-3.5 py-2 text-xs font-medium text-white transition hover:bg-[#174048]',
      btnDisabled: 'inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#E5E2DC] bg-[#F5F3EE] px-3.5 py-2 text-xs font-medium text-stone-400 cursor-not-allowed',
      btnIcon: 'inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#DDD9D0] bg-white text-stone-600 transition hover:bg-stone-50 hover:text-stone-900',
      segmentedWrap: 'inline-flex rounded-lg border border-[#E5E2DC] bg-[#EFECE6] p-0.5',
      segmentedActive: 'rounded-md bg-white px-3 py-1 text-xs font-semibold text-stone-900 shadow-2xs',
      segmentedIdle: 'rounded-md px-3 py-1 text-xs font-medium text-stone-600 hover:text-stone-900',

      label: 'block text-xs font-medium text-stone-700 mb-1.5',
      input: 'w-full rounded-lg border border-[#D6D2C9] bg-white px-3 py-2 text-xs text-stone-900 placeholder:text-stone-400 transition focus:border-stone-800 focus:outline-none focus:ring-2 focus:ring-stone-800/10',
      inputError: 'w-full rounded-lg border border-red-400 bg-white px-3 py-2 text-xs text-stone-900 focus:border-red-600 focus:outline-none focus:ring-2 focus:ring-red-500/15',
      inputDisabled: 'w-full rounded-lg border border-[#E5E2DC] bg-[#F5F3EE] px-3 py-2 text-xs text-stone-400 cursor-not-allowed',
      select: 'w-full rounded-lg border border-[#D6D2C9] bg-white px-3 py-2 text-xs text-stone-900 transition focus:border-stone-800 focus:outline-none focus:ring-2 focus:ring-stone-800/10',
      checkbox: 'h-4 w-4 rounded border-stone-300 accent-stone-800',
      switchTrackOn: 'bg-[#1F515B]',
      switchTrackOff: 'bg-stone-300',
      dropzone: 'rounded-xl border border-dashed border-[#CFCAC0] bg-[#FAF9F5] p-5 text-center transition hover:border-stone-500 hover:bg-[#F3F1EA]',

      tableWrap: 'overflow-x-auto rounded-xl border border-[#E5E2DC] bg-white',
      tableHead: 'border-b border-[#E5E2DC] bg-[#FAF9F5]',
      tableTh: 'px-4 py-2.5 text-left text-[11px] font-semibold tracking-wide text-stone-500 uppercase',
      tableRow: 'border-b border-[#F1EFEA] transition hover:bg-[#FAF9F5] last:border-b-0',
      tableCell: 'px-4 py-3 text-xs text-stone-700',
      tableFooter: 'flex flex-wrap items-center justify-between gap-3 border-t border-[#E5E2DC] bg-[#FAF9F5] px-4 py-2.5 text-xs text-stone-500',

      badgeNeutral: 'inline-flex items-center gap-1 rounded-full border border-[#DDD9D0] bg-[#F5F3EE] px-2.5 py-0.5 text-[11px] font-medium text-stone-700',
      badgeInfo: 'inline-flex items-center gap-1 rounded-full border border-[#C3D9DD] bg-[#EDF5F6] px-2.5 py-0.5 text-[11px] font-medium text-[#1F515B]',
      badgeSuccess: 'inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50/80 px-2.5 py-0.5 text-[11px] font-medium text-emerald-800',
      badgeWarning: 'inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50/80 px-2.5 py-0.5 text-[11px] font-medium text-amber-800',
      badgeDanger: 'inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50/80 px-2.5 py-0.5 text-[11px] font-medium text-red-800',

      alertInfo: 'rounded-xl border border-[#C3D9DD] bg-[#F2F7F8] p-3.5 text-xs text-[#1B454E]',
      alertSuccess: 'rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5 text-xs text-emerald-900',
      alertWarning: 'rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 text-xs text-amber-900',
      alertDanger: 'rounded-xl border border-red-200 bg-red-50/70 p-3.5 text-xs text-red-900',

      tabsWrap: 'flex items-center gap-5 border-b border-[#E5E2DC]',
      tabActive: 'border-b-2 border-stone-900 pb-2.5 text-xs font-semibold text-stone-950',
      tabIdle: 'border-b-2 border-transparent pb-2.5 text-xs font-medium text-stone-500 hover:text-stone-800',
      progressTrack: 'h-2 w-full overflow-hidden rounded-full bg-[#EAE7DF]',
      progressFill: 'h-full rounded-full bg-[#1F515B]',
      progressFillWarn: 'h-full rounded-full bg-amber-600',

      modalBackdrop: 'bg-stone-950/45 backdrop-blur-[1px]',
      modalSurface: 'rounded-xl border border-[#E5E2DC] bg-white shadow-xl',
      modalHeader: 'border-b border-[#EFECE6] px-5 py-4',
      modalFooter: 'border-t border-[#EFECE6] bg-[#FAF9F5] px-5 py-3',

      chartBarPrimary: 'bg-[#1F515B]',
      chartBarSecondary: 'bg-[#D6D2C9]',
    },
  },
  {
    id: 'oxford-topbar',
    index: 4,
    name: 'Oxford Topbar',
    subtitle: 'Điều hướng Ngang Cổ điển — 100% Chiều rộng Toàn màn hình',
    tagline: 'Thanh điều hướng 2 tầng trên cùng (không sidebar trái), giải phóng trọn vẹn 100% chiều ngang cho bảng biểu, Gantt và Org Chart.',
    navLayout: 'topbar-dual',
    navigationSummary: 'Header Ngang 2 tầng (0px Sidebar) • Dải KPI + Biểu đồ ngang • Bảng rộng 11 cột không cắt chữ',
    densityLabel: 'Toàn chiều rộng (Full-Bleed 100%)',
    bestFor: 'Hệ thống nhiều bảng rộng (Bảng lương, Ngân sách, Gantt, Org Chart) muốn tối đa hóa chiều ngang màn hình.',
    palette: {
      canvas: '#F5F6F8',
      surface: '#FFFFFF',
      navigation: '#1E293B',
      primary: '#1E3A5F',
      border: '#DCE1E8',
    },
    highlights: [
      'Loại bỏ hoàn toàn sidebar trái — toàn bộ 100% bề rộng trình duyệt dành cho nội dung và bảng dữ liệu.',
      'Bố cục Topbar 2 tầng kinh điển chuẩn GitHub Enterprise / cổng ngân hàng doanh nghiệp.',
      'Rất mạch lạc khi chuyển giữa các phân hệ lớn (Tổng quan, HRM, Dự án, Dịch vụ, Quản trị).',
    ],
    classes: {
      canvas: 'bg-[#F5F6F8] text-slate-900',
      sidebar: '',
      sidebarHeader: '',
      sidebarBrand: 'text-sm font-semibold tracking-tight text-white',
      sidebarSubBrand: 'text-[11px] text-slate-400',
      sidebarGroupLabel: '',
      sidebarItemActive: 'bg-white/15 text-white font-semibold rounded-md',
      sidebarItemIdle: 'text-slate-300 hover:bg-white/10 hover:text-white rounded-md',
      sidebarIconActive: 'text-white',
      sidebarIconIdle: 'text-slate-400',
      sidebarFooter: '',
      topbar: 'h-[50px] border-b border-slate-800 bg-[#1E293B] text-white',
      topbarSubnav: 'h-[42px] border-b border-[#DCE1E8] bg-white text-slate-700',
      topbarSubnavActive: 'border-b-2 border-[#1E3A5F] text-[#1E3A5F] font-semibold',
      topbarSubnavIdle: 'border-b-2 border-transparent text-slate-600 hover:text-slate-900',
      topbarTitle: 'text-sm font-semibold text-white',
      topbarBreadcrumb: 'text-xs text-slate-400',
      topbarControl: 'h-8 rounded-md border border-slate-700 bg-slate-800/80 px-2.5 text-xs font-medium text-slate-200 hover:bg-slate-700',

      card: 'rounded-md border border-[#DCE1E8] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]',
      cardHeader: 'border-b border-[#E8ECF1] px-5 py-3',
      cardMuted: 'rounded-md border border-[#DCE1E8] bg-[#F8FAFC]',
      divider: 'border-[#DCE1E8]',
      radius: 'rounded-md',

      heading1: 'text-xl font-semibold tracking-tight text-slate-900',
      heading2: 'text-sm font-semibold text-slate-900',
      heading3: 'text-xs font-semibold tracking-wide text-slate-600 uppercase',
      bodyText: 'text-sm text-slate-700',
      mutedText: 'text-xs text-slate-500',
      codeTag: 'rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] font-medium text-slate-800',

      btnPrimary: 'inline-flex items-center justify-center gap-1.5 rounded-md bg-[#1E3A5F] px-3.5 py-2 text-xs font-medium text-white transition hover:bg-[#162C49] focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/25',
      btnSecondary: 'inline-flex items-center justify-center gap-1.5 rounded-md bg-slate-100 px-3.5 py-2 text-xs font-medium text-slate-800 transition hover:bg-slate-200',
      btnOutline: 'inline-flex items-center justify-center gap-1.5 rounded-md border border-[#CBD3DE] bg-white px-3.5 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50',
      btnGhost: 'inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900',
      btnDanger: 'inline-flex items-center justify-center gap-1.5 rounded-md bg-red-700 px-3.5 py-2 text-xs font-medium text-white transition hover:bg-red-800',
      btnSuccess: 'inline-flex items-center justify-center gap-1.5 rounded-md bg-emerald-700 px-3.5 py-2 text-xs font-medium text-white transition hover:bg-emerald-800',
      btnDisabled: 'inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-slate-100 px-3.5 py-2 text-xs font-medium text-slate-400 cursor-not-allowed',
      btnIcon: 'inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#CBD3DE] bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-900',
      segmentedWrap: 'inline-flex rounded-md border border-[#CBD3DE] bg-slate-100 p-0.5',
      segmentedActive: 'rounded bg-white px-3 py-1 text-xs font-semibold text-[#1E3A5F] shadow-2xs',
      segmentedIdle: 'rounded px-3 py-1 text-xs font-medium text-slate-600 hover:text-slate-900',

      label: 'block text-xs font-medium text-slate-700 mb-1.5',
      input: 'w-full rounded-md border border-[#CBD3DE] bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 transition focus:border-[#1E3A5F] focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/15',
      inputError: 'w-full rounded-md border border-red-400 bg-white px-3 py-2 text-xs text-slate-900 focus:border-red-600 focus:outline-none focus:ring-2 focus:ring-red-500/15',
      inputDisabled: 'w-full rounded-md border border-slate-200 bg-slate-100 px-3 py-2 text-xs text-slate-400 cursor-not-allowed',
      select: 'w-full rounded-md border border-[#CBD3DE] bg-white px-3 py-2 text-xs text-slate-900 transition focus:border-[#1E3A5F] focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/15',
      checkbox: 'h-4 w-4 rounded border-slate-300 accent-[#1E3A5F]',
      switchTrackOn: 'bg-[#1E3A5F]',
      switchTrackOff: 'bg-slate-300',
      dropzone: 'rounded-md border border-dashed border-[#BFC9D6] bg-slate-50 p-5 text-center transition hover:border-[#1E3A5F] hover:bg-slate-100/70',

      tableWrap: 'overflow-x-auto rounded-md border border-[#DCE1E8] bg-white',
      tableHead: 'border-b border-[#DCE1E8] bg-[#F8FAFC]',
      tableTh: 'px-4 py-2.5 text-left text-[11px] font-semibold tracking-wide text-slate-600 uppercase',
      tableRow: 'border-b border-slate-100 transition hover:bg-slate-50 last:border-b-0',
      tableCell: 'px-4 py-3 text-xs text-slate-700',
      tableFooter: 'flex flex-wrap items-center justify-between gap-3 border-t border-[#DCE1E8] bg-[#F8FAFC] px-4 py-2.5 text-xs text-slate-500',

      badgeNeutral: 'inline-flex items-center gap-1 rounded border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700',
      badgeInfo: 'inline-flex items-center gap-1 rounded border border-[#C2D4EA] bg-[#EEF4FB] px-2 py-0.5 text-[11px] font-medium text-[#1E3A5F]',
      badgeSuccess: 'inline-flex items-center gap-1 rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800',
      badgeWarning: 'inline-flex items-center gap-1 rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800',
      badgeDanger: 'inline-flex items-center gap-1 rounded border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-800',

      alertInfo: 'rounded-md border-l-4 border-[#1E3A5F] border-y border-r border-y-[#DCE1E8] border-r-[#DCE1E8] bg-white p-3.5 text-xs text-slate-800',
      alertSuccess: 'rounded-md border-l-4 border-emerald-600 border-y border-r border-y-emerald-200 border-r-emerald-200 bg-emerald-50/40 p-3.5 text-xs text-emerald-900',
      alertWarning: 'rounded-md border-l-4 border-amber-500 border-y border-r border-y-amber-200 border-r-amber-200 bg-amber-50/40 p-3.5 text-xs text-amber-900',
      alertDanger: 'rounded-md border-l-4 border-red-600 border-y border-r border-y-red-200 border-r-red-200 bg-red-50/40 p-3.5 text-xs text-red-900',

      tabsWrap: 'flex items-center gap-5 border-b border-[#DCE1E8]',
      tabActive: 'border-b-2 border-[#1E3A5F] pb-2.5 text-xs font-semibold text-[#1E3A5F]',
      tabIdle: 'border-b-2 border-transparent pb-2.5 text-xs font-medium text-slate-500 hover:text-slate-800',
      progressTrack: 'h-2 w-full overflow-hidden rounded-sm bg-slate-200',
      progressFill: 'h-full rounded-sm bg-[#1E3A5F]',
      progressFillWarn: 'h-full rounded-sm bg-amber-600',

      modalBackdrop: 'bg-slate-950/50',
      modalSurface: 'rounded-lg border border-[#DCE1E8] bg-white shadow-xl',
      modalHeader: 'border-b border-[#E8ECF1] px-5 py-3.5',
      modalFooter: 'border-t border-[#E8ECF1] bg-[#F8FAFC] px-5 py-3',

      chartBarPrimary: 'bg-[#1E3A5F]',
      chartBarSecondary: 'bg-slate-300',
    },
  },
  {
    id: 'precision-grid',
    index: 5,
    name: 'Precision Grid',
    subtitle: 'ERP Cổ điển Sắc nét — Góc Vuông 4px, Kẻ ô Rõ ràng',
    tagline: 'Bố cục mật độ cao chuyên dụng cho kế toán, nhân sự và vận hành dữ liệu lớn — góc sắc 4px, viền rõ, không thừa khoảng trống.',
    navLayout: 'sidebar-compact',
    navigationSummary: 'Sidebar gọn (224px) • Ma trận lọc 7 cột • Bảng kẻ ô + Dòng cộng tổng • Dock Tab thư mục cuối trang',
    densityLabel: 'Mật độ cao (Compact Classic ERP)',
    bestFor: 'Kế toán, HR Payroll, vận hành cần nhìn nhiều dòng dữ liệu cùng lúc, thích sự ngăn nắp, vuông vức, chuẩn xác.',
    palette: {
      canvas: '#EFF1F4',
      surface: '#FFFFFF',
      navigation: '#F8F9FB',
      primary: '#1D4E89',
      border: '#CFD6DF',
    },
    highlights: [
      'Bo góc 4px sắc gọn, kẻ đường chia ô bảng rõ ràng giúp dò số tiền và mã chứng từ không bị lệch dòng.',
      'Chiều cao input, nút bấm và dòng bảng gọn hơn ~15%, hiển thị được nhiều thông tin hơn trên 1 màn hình.',
      'Hoàn toàn phẳng, trung tính, không hiệu ứng cầu kỳ — mang phong cách ERP cổ điển đã được tinh chỉnh hiện đại.',
    ],
    classes: {
      canvas: 'bg-[#EFF1F4] text-slate-900',
      sidebar: 'w-[224px] border-r border-[#CFD6DF] bg-[#F8F9FB] text-slate-700',
      sidebarHeader: 'h-12 border-b border-[#CFD6DF] bg-white px-3.5',
      sidebarBrand: 'text-[13px] font-bold tracking-tight text-slate-900',
      sidebarSubBrand: 'text-[10px] font-medium text-slate-500',
      sidebarGroupLabel: 'px-3 pt-3.5 pb-1 text-[10px] font-bold tracking-wider text-slate-500 uppercase',
      sidebarItemActive: 'bg-[#E6EEF8] text-[#1D4E89] font-semibold border border-[#BDD2EC] rounded',
      sidebarItemIdle: 'text-slate-700 hover:bg-slate-200/60 hover:text-slate-950 rounded border border-transparent',
      sidebarIconActive: 'text-[#1D4E89]',
      sidebarIconIdle: 'text-slate-500',
      sidebarFooter: 'border-t border-[#CFD6DF] bg-white p-2.5',
      topbar: 'h-12 border-b border-[#CFD6DF] bg-white',
      topbarSubnav: '',
      topbarSubnavActive: '',
      topbarSubnavIdle: '',
      topbarTitle: 'text-[13px] font-bold text-slate-900',
      topbarBreadcrumb: 'text-[11px] text-slate-500',
      topbarControl: 'h-7 rounded border border-[#CFD6DF] bg-white px-2 text-xs font-medium text-slate-800 hover:bg-slate-50',

      card: 'rounded border border-[#CFD6DF] bg-white',
      cardHeader: 'border-b border-[#DCE2EA] bg-[#F8F9FB] px-4 py-2.5',
      cardMuted: 'rounded border border-[#CFD6DF] bg-[#F8F9FB]',
      divider: 'border-[#CFD6DF]',
      radius: 'rounded',

      heading1: 'text-lg font-bold tracking-tight text-slate-900',
      heading2: 'text-[13px] font-bold text-slate-900',
      heading3: 'text-[11px] font-bold tracking-wide text-slate-600 uppercase',
      bodyText: 'text-[13px] text-slate-800',
      mutedText: 'text-[11px] text-slate-500',
      codeTag: 'rounded-xs border border-[#CFD6DF] bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-slate-800',

      btnPrimary: 'inline-flex items-center justify-center gap-1.5 rounded bg-[#1D4E89] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#163D6B] focus:outline-none focus:ring-2 focus:ring-[#1D4E89]/30',
      btnSecondary: 'inline-flex items-center justify-center gap-1.5 rounded border border-[#CFD6DF] bg-[#F1F4F8] px-3 py-1.5 text-xs font-semibold text-slate-800 transition hover:bg-[#E5EAF0]',
      btnOutline: 'inline-flex items-center justify-center gap-1.5 rounded border border-[#BFC8D4] bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 transition hover:bg-slate-50',
      btnGhost: 'inline-flex items-center justify-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-200/70 hover:text-slate-900',
      btnDanger: 'inline-flex items-center justify-center gap-1.5 rounded border border-red-300 bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700',
      btnSuccess: 'inline-flex items-center justify-center gap-1.5 rounded bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-800',
      btnDisabled: 'inline-flex items-center justify-center gap-1.5 rounded border border-[#DCE2EA] bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-400 cursor-not-allowed',
      btnIcon: 'inline-flex h-7 w-7 items-center justify-center rounded border border-[#CFD6DF] bg-white text-slate-700 transition hover:bg-slate-50 hover:text-slate-950',
      segmentedWrap: 'inline-flex rounded border border-[#CFD6DF] bg-[#EFF1F4] p-0.5',
      segmentedActive: 'rounded-xs bg-white px-2.5 py-0.5 text-xs font-semibold text-[#1D4E89] border border-[#CFD6DF]',
      segmentedIdle: 'rounded-xs px-2.5 py-0.5 text-xs font-medium text-slate-600 hover:text-slate-900',

      label: 'block text-[11px] font-semibold text-slate-700 mb-1',
      input: 'w-full rounded border border-[#BFC8D4] bg-white px-2.5 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 transition focus:border-[#1D4E89] focus:outline-none focus:ring-2 focus:ring-[#1D4E89]/15',
      inputError: 'w-full rounded border border-red-500 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-red-600 focus:outline-none focus:ring-2 focus:ring-red-500/15',
      inputDisabled: 'w-full rounded border border-[#DCE2EA] bg-slate-100 px-2.5 py-1.5 text-xs text-slate-400 cursor-not-allowed',
      select: 'w-full rounded border border-[#BFC8D4] bg-white px-2.5 py-1.5 text-xs text-slate-900 transition focus:border-[#1D4E89] focus:outline-none focus:ring-2 focus:ring-[#1D4E89]/15',
      checkbox: 'h-3.5 w-3.5 rounded-xs border-slate-400 accent-[#1D4E89]',
      switchTrackOn: 'bg-[#1D4E89]',
      switchTrackOff: 'bg-slate-300',
      dropzone: 'rounded border border-dashed border-[#B5C0CE] bg-[#F8F9FB] p-4 text-center transition hover:border-[#1D4E89] hover:bg-[#EFF4FA]',

      tableWrap: 'overflow-x-auto rounded border border-[#CFD6DF] bg-white',
      tableHead: 'border-b border-[#CFD6DF] bg-[#F1F4F8]',
      tableTh: 'border-r border-[#E2E7EE] last:border-r-0 px-3 py-2 text-left text-[11px] font-bold tracking-wide text-slate-700 uppercase',
      tableRow: 'border-b border-[#E2E7EE] odd:bg-white even:bg-[#FAFBFD] transition hover:bg-[#EDF3FA] last:border-b-0',
      tableCell: 'border-r border-[#EDF0F4] last:border-r-0 px-3 py-2 text-xs text-slate-800',
      tableFooter: 'flex flex-wrap items-center justify-between gap-3 border-t border-[#CFD6DF] bg-[#F1F4F8] px-3 py-2 text-xs text-slate-600',

      badgeNeutral: 'inline-flex items-center gap-1 rounded-xs border border-[#CFD6DF] bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700 uppercase',
      badgeInfo: 'inline-flex items-center gap-1 rounded-xs border border-[#B4CCE8] bg-[#E8F1FB] px-1.5 py-0.5 text-[10px] font-semibold text-[#1D4E89] uppercase',
      badgeSuccess: 'inline-flex items-center gap-1 rounded-xs border border-emerald-300 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800 uppercase',
      badgeWarning: 'inline-flex items-center gap-1 rounded-xs border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900 uppercase',
      badgeDanger: 'inline-flex items-center gap-1 rounded-xs border border-red-300 bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-800 uppercase',

      alertInfo: 'rounded border border-[#B4CCE8] bg-[#EFF5FC] p-3 text-xs text-[#163D6B]',
      alertSuccess: 'rounded border border-emerald-300 bg-emerald-50 p-3 text-xs text-emerald-900',
      alertWarning: 'rounded border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950',
      alertDanger: 'rounded border border-red-300 bg-red-50 p-3 text-xs text-red-900',

      tabsWrap: 'flex items-center gap-1 border-b border-[#CFD6DF]',
      tabActive: 'rounded-t border border-b-white border-[#CFD6DF] bg-white px-3.5 py-1.5 text-xs font-bold text-[#1D4E89] -mb-px',
      tabIdle: 'rounded-t border border-transparent px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200/50 hover:text-slate-900',
      progressTrack: 'h-2 w-full overflow-hidden rounded-xs border border-[#CFD6DF] bg-slate-100',
      progressFill: 'h-full bg-[#1D4E89]',
      progressFillWarn: 'h-full bg-amber-600',

      modalBackdrop: 'bg-slate-950/50',
      modalSurface: 'rounded border border-[#BFC8D4] bg-white shadow-lg',
      modalHeader: 'border-b border-[#CFD6DF] bg-[#F8F9FB] px-4 py-3',
      modalFooter: 'border-t border-[#CFD6DF] bg-[#F1F4F8] px-4 py-2.5',

      chartBarPrimary: 'bg-[#1D4E89]',
      chartBarSecondary: 'bg-[#BCC6D4]',
    },
  },
];

export const CLASSIC_DEMO_REQUESTS = [
  {
    code: 'PAY-2026-0042',
    title: 'Thanh toán hạ tầng Cloud Server Q4/2026',
    module: 'Thanh toán',
    budgetCode: 'BUD-2026-TECH-001',
    requester: 'Nguyễn Minh Quân',
    department: 'Kỹ thuật Nền tảng',
    amount: '48.500.000 ₫',
    date: '27/11/2026',
    status: 'PENDING_APPROVAL' as const,
  },
  {
    code: 'PROP-2026-0019',
    title: 'Đề xuất nâng cấp 06 màn hình thiết kế UI/UX',
    module: 'Đề xuất Nội bộ',
    budgetCode: 'BUD-2026-OPS-001',
    requester: 'Trần Thu Hà',
    department: 'Thiết kế Sản phẩm',
    amount: '36.000.000 ₫',
    date: '26/11/2026',
    status: 'APPROVED' as const,
  },
  {
    code: 'PAY-2026-0041',
    title: 'Tạm ứng chi phí công tác triển khai chi nhánh Đà Nẵng',
    module: 'Tạm ứng',
    budgetCode: 'BUD-2026-PROJ-001',
    requester: 'Lê Hoàng Nam',
    department: 'Triển khai Dự án',
    amount: '15.000.000 ₫',
    date: '25/11/2026',
    status: 'IN_EXECUTION' as const,
  },
  {
    code: 'IT-2026-0118',
    title: 'Cấp quyền VPN & tài khoản Database Staging cho nhân sự mới',
    module: 'IT Helpdesk',
    budgetCode: '—',
    requester: 'Phạm Ngọc Anh',
    department: 'Nhân sự & Tuyển dụng',
    amount: '0 ₫',
    date: '25/11/2026',
    status: 'COMPLETED' as const,
  },
  {
    code: 'PAY-2026-0039',
    title: 'Thanh toán ấn phẩm hội thảo khách hàng doanh nghiệp',
    module: 'Thanh toán',
    budgetCode: 'BUD-2026-MKT-001',
    requester: 'Vũ Khánh Linh',
    department: 'Tiếp thị & Truyền thông',
    amount: '22.800.000 ₫',
    date: '24/11/2026',
    status: 'REJECTED' as const,
  },
] as const;

export const CLASSIC_BUDGET_BARS = [
  { code: 'BUD-TECH', name: 'Quỹ Công nghệ & Hạ tầng', usedPct: 74, spent: '185 tr', total: '250 tr', isWarn: false },
  { code: 'BUD-OPS', name: 'Quỹ Vận hành Văn phòng', usedPct: 58, spent: '87 tr', total: '150 tr', isWarn: false },
  { code: 'BUD-MKT', name: 'Quỹ Tiếp thị & Sự kiện', usedPct: 89, spent: '178 tr', total: '200 tr', isWarn: true },
  { code: 'BUD-HR', name: 'Quỹ Đào tạo & Phúc lợi', usedPct: 42, spent: '76 tr', total: '180 tr', isWarn: false },
] as const;

export const CLASSIC_MONTHLY_CHART = [
  { month: 'T6', allocated: 78, actual: 52 },
  { month: 'T7', allocated: 84, actual: 64 },
  { month: 'T8', allocated: 80, actual: 71 },
  { month: 'T9', allocated: 90, actual: 68 },
  { month: 'T10', allocated: 95, actual: 82 },
  { month: 'T11', allocated: 100, actual: 76 },
] as const;
