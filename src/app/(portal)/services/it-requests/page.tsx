'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  IconAlertTriangle,
  IconCheck,
  IconClock,
  IconDeviceLaptop,
  IconDownload,
  IconEdit,
  IconEye,
  IconHeadset,
  IconInbox,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconShieldCheck,
  IconStarFilled,
  IconTrash,
  IconUserCheck,
} from '@tabler/icons-react';
import type { ItRequestKind, ItRequestPriority, ItRequestStatus } from '@/config/database';
import { ItCategoryModal } from '@/components/it-requests/ItCategoryModal';
import {
  ItRequestFormModal,
  type ItCategoryOption,
} from '@/components/it-requests/ItRequestFormModal';
import { usePortalAuth } from '@/components/portal/PortalAuthContext';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Skeleton, SkeletonTable } from '@/components/ui/Skeleton';
import { formatDateTimeVN } from '@/lib/portable/date-utils';
import type { PaginationMeta } from '@/lib/portable/pagination';
import type { SlaHealthStatus } from '@/lib/portable/sla-calculator';
import { useI18n } from '@/shared/i18n/I18nContext';

interface ItRequestRow {
  id: number;
  code: string;
  categoryId: number;
  categoryName: string;
  categoryNameEn: string | null;
  categoryColor: string;
  requiresApproval: boolean;
  requestKind: ItRequestKind;
  title: string;
  priority: ItRequestPriority;
  status: ItRequestStatus;
  requesterName: string;
  branchName: string | null;
  branchNameEn: string | null;
  departmentName: string | null;
  departmentNameEn: string | null;
  assetCode: string | null;
  assetName: string | null;
  assignedToName: string | null;
  estimatedCost: number;
  sla: {
    resolutionDueAt: string | null;
    resolutionStatus: SlaHealthStatus;
    remainingMinutes: number | null;
    overdueMinutes: number;
  };
  satisfactionRating: number | null;
  createdAt: string;
}

interface ItSummaryPayload {
  total: number;
  draftCount: number;
  pendingApprovalCount: number;
  openCount: number;
  inProgressCount: number;
  waitingUserCount: number;
  resolvedCount: number;
  closedCount: number;
  unassignedCount: number;
  assignedToMeCount: number;
  pendingMyApprovalCount: number;
  slaBreachedCount: number;
  slaAtRiskCount: number;
  avgSatisfactionRating: number | null;
}

type ActiveTab =
  | 'all'
  | 'mine'
  | 'assigned_to_me'
  | 'unassigned'
  | 'pending_my_approval'
  | 'sla_breached'
  | 'categories';

const ERR_LOAD_TICKETS = '__ERR_LOAD_TICKETS__';
const ERR_NETWORK = '__ERR_NETWORK__';

const STATUS_BADGES: Record<ItRequestStatus, { vi: string; en: string; cls: string }> = {
  DRAFT: { vi: 'Nháp', en: 'Draft', cls: 'bg-slate-100 text-slate-600' },
  PENDING_APPROVAL: { vi: 'Chờ duyệt', en: 'Pending Approval', cls: 'bg-amber-50 text-amber-700' },
  OPEN: { vi: 'Chờ tiếp nhận', en: 'Open', cls: 'bg-sky-50 text-sky-700' },
  IN_PROGRESS: { vi: 'Đang xử lý', en: 'In Progress', cls: 'bg-indigo-50 text-indigo-700' },
  WAITING_USER: { vi: 'Chờ người gửi', en: 'Waiting User', cls: 'bg-purple-50 text-purple-700' },
  RESOLVED: { vi: 'Đã xử lý', en: 'Resolved', cls: 'bg-teal-50 text-teal-700' },
  CLOSED: { vi: 'Đã đóng', en: 'Closed', cls: 'bg-emerald-50 text-emerald-700' },
  REJECTED: { vi: 'Từ chối', en: 'Rejected', cls: 'bg-rose-50 text-rose-700' },
  CANCELLED: { vi: 'Đã hủy', en: 'Cancelled', cls: 'bg-slate-100 text-slate-500' },
};

const PRIORITY_BADGES: Record<ItRequestPriority, { vi: string; en: string; cls: string }> = {
  LOW: { vi: 'Thấp', en: 'Low', cls: 'bg-slate-100 text-slate-600' },
  MEDIUM: { vi: 'Trung bình', en: 'Medium', cls: 'bg-blue-50 text-blue-700' },
  HIGH: { vi: 'Cao', en: 'High', cls: 'bg-orange-50 text-orange-700' },
  URGENT: { vi: 'Khẩn cấp', en: 'Urgent', cls: 'bg-rose-100 text-rose-700' },
};

const SLA_BADGES: Record<SlaHealthStatus, { vi: string; en: string; cls: string }> = {
  ON_TRACK: { vi: 'Đúng hạn', en: 'On Track', cls: 'bg-emerald-50 text-emerald-700' },
  AT_RISK: { vi: 'Sắp quá hạn', en: 'At Risk', cls: 'bg-amber-50 text-amber-700' },
  BREACHED: { vi: 'Quá hạn SLA', en: 'SLA Breached', cls: 'bg-rose-100 text-rose-700' },
  MET: { vi: 'Đạt SLA', en: 'SLA Met', cls: 'bg-teal-50 text-teal-700' },
  PAUSED: { vi: 'Tạm dừng', en: 'Paused', cls: 'bg-purple-50 text-purple-700' },
  NONE: { vi: 'Chưa tính', en: 'Not Started', cls: 'bg-slate-100 text-slate-500' },
};

const KIND_LABELS: Record<ItRequestKind, { vi: string; en: string }> = {
  INCIDENT: { vi: 'Sự cố', en: 'Incident' },
  SERVICE_REQUEST: { vi: 'Dịch vụ / Phần mềm', en: 'Service / Software' },
  ACCESS_REQUEST: { vi: 'Tài khoản & Quyền', en: 'Access & Account' },
  HARDWARE_PROVISION: { vi: 'Cấp thiết bị', en: 'Hardware' },
};

function formatDurationShort(minutes: number, isEn: boolean): string {
  const abs = Math.max(1, Math.round(minutes));
  const hours = Math.floor(abs / 60);
  const rem = abs % 60;
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const remH = hours % 24;
    return isEn ? `${days}d ${remH}h` : `${days}ng ${remH}g`;
  }
  if (hours > 0) {
    return isEn ? `${hours}h ${rem}m` : `${hours}g ${rem}p`;
  }
  return isEn ? `${rem}m` : `${rem}p`;
}

export default function ItRequestsPage() {
  const router = useRouter();
  const { locale, tr, ln } = useI18n();
  const { hasPermission } = usePortalAuth();
  const isEn = locale === 'en';

  const canCreate = hasPermission('it_requests.create');
  const canManage = hasPermission('it_requests.manage');
  const canExport = hasPermission('it_requests.export');

  const [tab, setTab] = useState<ActiveTab>('all');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [page, setPage] = useState(1);
  const [reloadTick, setReloadTick] = useState(0);

  const [viewState, setViewState] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorCode, setErrorCode] = useState('');
  const [items, setItems] = useState<ItRequestRow[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [summary, setSummary] = useState<ItSummaryPayload | null>(null);
  const [categories, setCategories] = useState<ItCategoryOption[]>([]);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ItCategoryOption | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<ItCategoryOption | null>(null);
  const [isDeletingCategory, setIsDeletingCategory] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchDebounced(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetch('/api/v1/it-requests/summary', { cache: 'no-store', signal: controller.signal }),
      fetch('/api/v1/it-requests/categories?includeInactive=true', {
        cache: 'no-store',
        signal: controller.signal,
      }),
    ])
      .then(async ([sumRes, catRes]) => {
        if (controller.signal.aborted) return;
        const [sumJson, catJson] = await Promise.all([
          sumRes.json().catch(() => null),
          catRes.json().catch(() => null),
        ]);
        if (sumRes.ok && sumJson?.success) setSummary(sumJson.data as ItSummaryPayload);
        if (catRes.ok && catJson?.success) setCategories((catJson.data ?? []) as ItCategoryOption[]);
      })
      .catch(() => {
        // Non-fatal metadata fetch
      });
    return () => controller.abort();
  }, [reloadTick]);

  useEffect(() => {
    if (tab === 'categories') {
      return;
    }
    const controller = new AbortController();

    const params = new URLSearchParams({
      scope: tab,
      page: String(page),
      limit: '15',
    });
    if (statusFilter) params.set('status', statusFilter);
    if (priorityFilter) params.set('priority', priorityFilter);
    if (categoryFilter) params.set('categoryId', categoryFilter);
    if (searchDebounced) params.set('search', searchDebounced);

    fetch(`/api/v1/it-requests?${params.toString()}`, {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (res) => {
        const json = (await res.json().catch(() => null)) as {
          success?: boolean;
          data?: ItRequestRow[];
          meta?: PaginationMeta;
          error?: { message?: string };
        } | null;
        if (controller.signal.aborted) return;
        if (!res.ok || !json?.success) {
          setErrorCode(json?.error?.message ?? ERR_LOAD_TICKETS);
          setViewState('error');
          return;
        }
        setItems(json.data ?? []);
        setMeta(json.meta ?? null);
        setErrorCode('');
        setViewState('success');
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setErrorCode(ERR_NETWORK);
        setViewState('error');
      });

    return () => controller.abort();
  }, [tab, statusFilter, priorityFilter, categoryFilter, searchDebounced, page, reloadTick]);

  function refreshAll() {
    if (tab !== 'categories') {
      setViewState('loading');
    }
    setReloadTick((t) => t + 1);
  }

  async function handleExportExcel() {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const params = new URLSearchParams({ scope: tab === 'categories' ? 'all' : tab });
      if (statusFilter) params.set('status', statusFilter);
      if (priorityFilter) params.set('priority', priorityFilter);
      if (categoryFilter) params.set('categoryId', categoryFilter);
      if (searchDebounced) params.set('search', searchDebounced);

      const res = await fetch(`/api/v1/it-requests/export/excel?${params.toString()}`);
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `it-requests-${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  }

  async function handleDeleteCategory() {
    if (!deletingCategory || isDeletingCategory) return;
    setIsDeletingCategory(true);
    try {
      const res = await fetch(`/api/v1/it-requests/categories/${deletingCategory.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        setErrorCode(
          json?.error?.message ??
            tr('Không thể xóa danh mục đang được sử dụng.', 'Unable to delete active category.'),
        );
        setViewState('error');
      } else {
        refreshAll();
      }
    } finally {
      setIsDeletingCategory(false);
      setDeletingCategory(null);
    }
  }

  const resolvedError =
    errorCode === ERR_LOAD_TICKETS
      ? tr('Không thể tải danh sách yêu cầu hỗ trợ IT.', 'Unable to load IT support requests.')
      : errorCode === ERR_NETWORK
        ? tr('Lỗi kết nối tới máy chủ.', 'Server connection error.')
        : errorCode;

  const tabs: Array<{ key: ActiveTab; vi: string; en: string; badge?: number; visible?: boolean }> = [
    { key: 'all', vi: 'Tất cả', en: 'All Tickets', badge: summary?.total },
    { key: 'mine', vi: 'Của tôi', en: 'My Tickets' },
    {
      key: 'assigned_to_me',
      vi: 'Tôi phụ trách',
      en: 'Assigned to Me',
      badge: summary?.assignedToMeCount,
      visible: canManage,
    },
    {
      key: 'unassigned',
      vi: 'Chưa phân công',
      en: 'Unassigned',
      badge: summary?.unassignedCount,
      visible: canManage,
    },
    {
      key: 'pending_my_approval',
      vi: 'Chờ tôi duyệt',
      en: 'Pending My Approval',
      badge: summary?.pendingMyApprovalCount,
    },
    {
      key: 'sla_breached',
      vi: 'Quá hạn SLA',
      en: 'SLA Breached',
      badge: summary?.slaBreachedCount,
      visible: canManage,
    },
    {
      key: 'categories',
      vi: 'Danh mục & SLA',
      en: 'Categories & SLA',
      visible: canManage,
    },
  ];

  const activeInProgressTotal =
    (summary?.openCount ?? 0) + (summary?.inProgressCount ?? 0) + (summary?.waitingUserCount ?? 0);

  return (
    <div className="w-full space-y-5">
      {/* Midnight Command Hero */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#080E1A] via-[#0F172A] to-[#1E1B4B] p-6 text-white shadow-sm">
        <div className="pointer-events-none absolute -top-20 -right-16 h-64 w-64 rounded-full bg-indigo-500/20 blur-3xl" />

        <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-indigo-400/35 bg-indigo-400/15 px-3 py-1 text-[11px] font-semibold text-indigo-200">
              <IconHeadset size={14} />
              <span>{tr('CNTT & Trung tâm Hỗ trợ IT', 'IT Service Desk & Helpdesk')}</span>
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-white">
              {tr('Yêu cầu Hỗ trợ IT (IT Request)', 'IT Helpdesk Requests')}
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-300">
              {tr(
                'Tiếp nhận sự cố kỹ thuật, cấp tài khoản/VPN, bản quyền phần mềm & thiết bị mới kèm theo dõi SLA tự động và tích hợp Kho tài sản.',
                'Manage technical incidents, account/VPN access, software licenses, and hardware provisioning with automated SLA & Asset tracking.',
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {canExport && (
              <button
                type="button"
                disabled={isExporting}
                onClick={() => void handleExportExcel()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-3.5 py-2 text-xs font-semibold text-white backdrop-blur-xs hover:bg-white/20 disabled:opacity-50"
              >
                <IconDownload size={15} />
                <span>
                  {isExporting ? tr('Đang xuất...', 'Exporting...') : tr('Xuất Excel', 'Export Excel')}
                </span>
              </button>
            )}
            {canCreate && (
              <button
                type="button"
                onClick={() => setIsCreateOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-500 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-400"
              >
                <IconPlus size={16} />
                <span>{tr('Tạo yêu cầu IT', 'New IT Ticket')}</span>
              </button>
            )}
          </div>
        </div>

        {/* KPI Cards */}
        <div className="relative z-10 mt-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-xs">
            <div className="text-[11px] font-medium text-slate-300">
              {tr('Tổng số ticket', 'Total Tickets')}
            </div>
            {viewState === 'loading' && !summary ? (
              <Skeleton tone="dark" className="mt-1.5 h-7 w-12" />
            ) : (
              <div className="mt-1 text-2xl font-bold text-white">{summary?.total ?? '—'}</div>
            )}
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-xs">
            <div className="text-[11px] font-medium text-sky-200">
              {tr('Đang mở / Xử lý', 'Open / In Progress')}
            </div>
            {viewState === 'loading' && !summary ? (
              <Skeleton tone="dark" className="mt-1.5 h-7 w-24" />
            ) : (
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-white">{activeInProgressTotal}</span>
                <span className="text-[11px] text-slate-300">
                  ({summary?.unassignedCount ?? 0} {tr('chưa gán', 'unassigned')})
                </span>
              </div>
            )}
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-xs">
            <div className="text-[11px] font-medium text-amber-200">
              {tr('Chờ tôi phê duyệt', 'Pending My Approval')}
            </div>
            {viewState === 'loading' && !summary ? (
              <Skeleton tone="dark" className="mt-1.5 h-7 w-12" />
            ) : (
              <div className="mt-1 text-2xl font-bold text-amber-300">
                {summary?.pendingMyApprovalCount ?? 0}
              </div>
            )}
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-xs">
            <div className="flex items-center gap-1 text-[11px] font-medium text-rose-200">
              <IconAlertTriangle size={13} />
              <span>{tr('Cảnh báo / Quá hạn SLA', 'SLA At Risk / Breached')}</span>
            </div>
            {viewState === 'loading' && !summary ? (
              <Skeleton tone="dark" className="mt-1.5 h-7 w-24" />
            ) : (
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-rose-300">
                  {summary?.slaBreachedCount ?? 0}
                </span>
                <span className="text-[11px] text-amber-200">
                  / {summary?.slaAtRiskCount ?? 0} {tr('sắp hạn', 'at risk')}
                </span>
              </div>
            )}
          </div>
          <div className="col-span-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-xs lg:col-span-1">
            <div className="flex items-center gap-1 text-[11px] font-medium text-emerald-200">
              <IconStarFilled size={13} className="text-amber-300" />
              <span>{tr('Điểm hài lòng CSAT', 'Avg CSAT Rating')}</span>
            </div>
            {viewState === 'loading' && !summary ? (
              <Skeleton tone="dark" className="mt-1.5 h-7 w-16" />
            ) : (
              <div className="mt-1 text-2xl font-bold text-white">
                {summary?.avgSatisfactionRating !== null && summary?.avgSatisfactionRating !== undefined
                  ? `${summary.avgSatisfactionRating}/5`
                  : '—'}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-2xs">
        {tabs
          .filter((t) => t.visible !== false)
          .map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => {
                  setTab(t.key);
                  setPage(1);
                }}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
                  active
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <span>{isEn ? t.en : t.vi}</span>
                {t.badge !== undefined && t.badge > 0 && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                      active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {t.badge}
                  </span>
                )}
              </button>
            );
          })}
      </div>

      {/* Categories & SLA Tab */}
      {tab === 'categories' ? (
        <section className="rounded-2xl border border-slate-200 bg-white shadow-2xs">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                {tr('Danh mục Dịch vụ IT & Cam kết SLA', 'IT Service Categories & SLA Policies')}
              </h2>
              <p className="text-xs text-slate-500">
                {tr(
                  'Cấu hình tên song ngữ VI/EN, cờ yêu cầu phê duyệt và khung giờ SLA chuẩn.',
                  'Configure bilingual VI/EN names, approval requirement, and baseline SLA hours.',
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setEditingCategory(null);
                setIsCategoryModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
            >
              <IconPlus size={15} />
              <span>{tr('Thêm danh mục', 'Add Category')}</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[11px] font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">{tr('Mã & Tên danh mục', 'Code & Category Name')}</th>
                  <th className="px-4 py-3">{tr('Loại', 'Kind')}</th>
                  <th className="px-4 py-3">{tr('Phê duyệt', 'Approval')}</th>
                  <th className="px-4 py-3">{tr('SLA Phản hồi / Xử lý', 'Response / Resolution SLA')}</th>
                  <th className="px-4 py-3">{tr('Trạng thái', 'Status')}</th>
                  <th className="px-4 py-3 text-right">{tr('Thao tác', 'Actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {categories.map((cat) => (
                  <tr key={cat.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: cat.color }}
                        />
                        <div>
                          <div className="font-semibold text-slate-900">
                            {ln(cat.name, cat.nameEn)}
                          </div>
                          <div className="font-mono text-[11px] text-slate-400">{cat.code}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {isEn ? KIND_LABELS[cat.requestKind].en : KIND_LABELS[cat.requestKind].vi}
                    </td>
                    <td className="px-4 py-3">
                      {cat.requiresApproval ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700">
                          <IconShieldCheck size={12} />
                          {tr('Cần phê duyệt', 'Approval Required')}
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
                          {tr('Gửi thẳng IT', 'Direct IT')}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-700">
                      {cat.slaResponseHours}h / {cat.slaResolutionHours}h
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                          cat.isActive
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {cat.isActive ? tr('Đang dùng', 'Active') : tr('Tạm ẩn', 'Inactive')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingCategory(cat);
                            setIsCategoryModalOpen(true);
                          }}
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-indigo-600"
                          title={tr('Chỉnh sửa', 'Edit')}
                        >
                          <IconEdit size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingCategory(cat)}
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600"
                          title={tr('Xóa mềm', 'Soft Delete')}
                        >
                          <IconTrash size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <>
          {/* Filter Bar */}
          <section className="grid grid-cols-1 gap-2.5 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs sm:grid-cols-2 lg:grid-cols-12">
            <div className="relative lg:col-span-4">
              <IconSearch
                size={15}
                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder={tr(
                  'Tìm mã ITR, tiêu đề, người gửi, mã tài sản...',
                  'Search ITR code, subject, requester, asset...',
                )}
                className="w-full rounded-xl border border-slate-300 py-2 pr-3 pl-9 text-xs text-slate-800 outline-none focus:border-indigo-500"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700 outline-none lg:col-span-3"
            >
              <option value="">{tr('Tất cả trạng thái', 'All Statuses')}</option>
              {(Object.keys(STATUS_BADGES) as ItRequestStatus[]).map((st) => (
                <option key={st} value={st}>
                  {isEn ? STATUS_BADGES[st].en : STATUS_BADGES[st].vi}
                </option>
              ))}
            </select>

            <select
              value={priorityFilter}
              onChange={(e) => {
                setPriorityFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700 outline-none lg:col-span-2"
            >
              <option value="">{tr('Mọi mức ưu tiên', 'All Priorities')}</option>
              {(Object.keys(PRIORITY_BADGES) as ItRequestPriority[]).map((pr) => (
                <option key={pr} value={pr}>
                  {isEn ? PRIORITY_BADGES[pr].en : PRIORITY_BADGES[pr].vi}
                </option>
              ))}
            </select>

            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700 outline-none lg:col-span-3"
            >
              <option value="">{tr('Tất cả danh mục IT', 'All IT Categories')}</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {ln(cat.name, cat.nameEn)}
                </option>
              ))}
            </select>
          </section>

          {/* 4 Required States: Loading / Error / Empty / Success */}
          {viewState === 'loading' && (
            <SkeletonTable rows={6} columns={7} showToolbar={false} showPagination={false} />
          )}

          {viewState === 'error' && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-5">
              <span className="text-sm font-medium text-rose-700">{resolvedError}</span>
              <button
                type="button"
                onClick={refreshAll}
                className="inline-flex items-center gap-1.5 rounded-xl border border-rose-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50"
              >
                <IconRefresh size={14} />
                <span>{tr('Thử lại', 'Retry')}</span>
              </button>
            </div>
          )}

          {viewState === 'success' && items.length === 0 && (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white py-14 text-center">
              <IconInbox size={36} className="text-slate-400" />
              <p className="mt-2.5 text-sm font-semibold text-slate-800">
                {tr('Chưa có yêu cầu hỗ trợ IT nào phù hợp', 'No matching IT tickets found')}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {tr(
                  'Hãy thử điều chỉnh bộ lọc hoặc gửi một yêu cầu hỗ trợ IT mới.',
                  'Try adjusting your filters or submit a new IT helpdesk ticket.',
                )}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {(statusFilter || priorityFilter || categoryFilter || searchInput) && (
                  <button
                    type="button"
                    onClick={() => {
                      setStatusFilter('');
                      setPriorityFilter('');
                      setCategoryFilter('');
                      setSearchInput('');
                      setPage(1);
                    }}
                    className="rounded-xl border border-slate-300 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    {tr('Đặt lại bộ lọc', 'Reset Filters')}
                  </button>
                )}
                {canCreate && (
                  <button
                    type="button"
                    onClick={() => setIsCreateOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
                  >
                    <IconPlus size={15} />
                    <span>{tr('Tạo yêu cầu IT đầu tiên', 'Create First IT Ticket')}</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {viewState === 'success' && items.length > 0 && (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[11px] font-semibold uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3">{tr('Ticket & Tiêu đề', 'Ticket & Subject')}</th>
                      <th className="px-4 py-3">{tr('Danh mục', 'Category')}</th>
                      <th className="px-4 py-3">{tr('Người gửi / Kỹ thuật viên', 'Requester / Assignee')}</th>
                      <th className="px-4 py-3">{tr('Ưu tiên', 'Priority')}</th>
                      <th className="px-4 py-3">{tr('Cam kết SLA', 'SLA Status')}</th>
                      <th className="px-4 py-3">{tr('Trạng thái', 'Status')}</th>
                      <th className="px-4 py-3 text-right">{tr('Chi tiết', 'Action')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map((item) => {
                      const stBadge = STATUS_BADGES[item.status];
                      const prBadge = PRIORITY_BADGES[item.priority];
                      const slaBadge = SLA_BADGES[item.sla.resolutionStatus];

                      return (
                        <tr key={item.id} className="hover:bg-slate-50/70">
                          <td className="max-w-xs px-4 py-3">
                            <Link
                              href={`/services/it-requests/${item.id}`}
                              className="line-clamp-2 font-semibold text-slate-900 hover:text-indigo-600"
                            >
                              {item.title}
                            </Link>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                              <span className="font-mono font-semibold text-indigo-700">
                                {item.code}
                              </span>
                              <span>•</span>
                              <span>{formatDateTimeVN(item.createdAt)}</span>
                              {item.assetCode && (
                                <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-700">
                                  <IconDeviceLaptop size={11} />
                                  {item.assetCode}
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <span
                                className="h-2 w-2 shrink-0 rounded-full"
                                style={{ backgroundColor: item.categoryColor }}
                              />
                              <span className="font-medium text-slate-800">
                                {ln(item.categoryName, item.categoryNameEn)}
                              </span>
                            </div>
                            <div className="mt-0.5 text-[11px] text-slate-500">
                              {isEn ? KIND_LABELS[item.requestKind].en : KIND_LABELS[item.requestKind].vi}
                            </div>
                          </td>

                          <td className="px-4 py-3">
                            <div className="font-medium text-slate-800">{item.requesterName}</div>
                            <div className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-500">
                              <IconUserCheck size={12} className="text-slate-400" />
                              <span>
                                {item.assignedToName ?? tr('Chưa phân công', 'Unassigned')}
                              </span>
                            </div>
                          </td>

                          <td className="whitespace-nowrap px-4 py-3">
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${prBadge.cls}`}
                            >
                              {isEn ? prBadge.en : prBadge.vi}
                            </span>
                          </td>

                          <td className="whitespace-nowrap px-4 py-3">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${slaBadge.cls}`}
                            >
                              {item.sla.resolutionStatus === 'MET' ? (
                                <IconCheck size={12} />
                              ) : (
                                <IconClock size={12} />
                              )}
                              <span>{isEn ? slaBadge.en : slaBadge.vi}</span>
                            </span>
                            {item.sla.resolutionStatus === 'BREACHED' && item.sla.overdueMinutes > 0 && (
                              <div className="mt-0.5 text-[10px] font-semibold text-rose-600">
                                +{formatDurationShort(item.sla.overdueMinutes, isEn)}
                              </div>
                            )}
                            {(item.sla.resolutionStatus === 'ON_TRACK' ||
                              item.sla.resolutionStatus === 'AT_RISK') &&
                              item.sla.remainingMinutes !== null && (
                                <div className="mt-0.5 text-[10px] text-slate-500">
                                  {tr('Còn', 'Left')}{' '}
                                  {formatDurationShort(item.sla.remainingMinutes, isEn)}
                                </div>
                              )}
                          </td>

                          <td className="whitespace-nowrap px-4 py-3">
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${stBadge.cls}`}
                            >
                              {isEn ? stBadge.en : stBadge.vi}
                            </span>
                          </td>

                          <td className="whitespace-nowrap px-4 py-3 text-right">
                            <Link
                              href={`/services/it-requests/${item.id}`}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
                            >
                              <IconEye size={14} />
                              <span>{tr('Mở', 'Open')}</span>
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {meta && meta.totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-xs text-slate-600">
                  <span>
                    {tr(
                      `Trang ${meta.page}/${meta.totalPages} (Tổng ${meta.total} ticket)`,
                      `Page ${meta.page}/${meta.totalPages} (${meta.total} tickets)`,
                    )}
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={!meta.hasPrev}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="rounded-lg border border-slate-300 px-3 py-1 disabled:opacity-50"
                    >
                      {tr('Trước', 'Previous')}
                    </button>
                    <button
                      type="button"
                      disabled={!meta.hasNext}
                      onClick={() => setPage((p) => p + 1)}
                      className="rounded-lg border border-slate-300 px-3 py-1 disabled:opacity-50"
                    >
                      {tr('Sau', 'Next')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      <ItRequestFormModal
        open={isCreateOpen}
        categories={categories}
        onClose={() => setIsCreateOpen(false)}
        onSaved={(ticketId) => {
          setIsCreateOpen(false);
          refreshAll();
          router.push(`/services/it-requests/${ticketId}`);
        }}
      />

      <ItCategoryModal
        open={isCategoryModalOpen}
        editing={editingCategory}
        onClose={() => setIsCategoryModalOpen(false)}
        onSaved={() => {
          setIsCategoryModalOpen(false);
          refreshAll();
        }}
      />

      <ConfirmModal
        isOpen={Boolean(deletingCategory)}
        title={tr('Xóa danh mục IT?', 'Delete IT Category?')}
        description={
          deletingCategory
            ? tr(
                `Bạn có chắc muốn xóa mềm danh mục "${deletingCategory.name}"? Danh mục đang có ticket hoạt động sẽ không thể xóa.`,
                `Are you sure you want to archive category "${deletingCategory.nameEn ?? deletingCategory.name}"? Categories with active tickets cannot be deleted.`,
              )
            : ''
        }
        confirmLabel={tr('Xác nhận xóa', 'Confirm Delete')}
        cancelLabel={tr('Hủy', 'Cancel')}
        variant="danger"
        isProcessing={isDeletingCategory}
        onCancel={() => setDeletingCategory(null)}
        onConfirm={() => void handleDeleteCategory()}
      />
    </div>
  );
}
