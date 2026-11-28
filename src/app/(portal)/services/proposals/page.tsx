'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  IconCategory,
  IconChecklist,
  IconDownload,
  IconEdit,
  IconEye,
  IconFileDescription,
  IconInbox,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconSend,
  IconTrash,
  IconUser,
} from '@tabler/icons-react';
import { usePortalAuth } from '@/components/portal/PortalAuthContext';
import type { BudgetOptionDto } from '@/components/payments/budget-ui.helpers';
import { ProposalCategoryModal } from '@/components/proposals/ProposalCategoryModal';
import {
  ProposalFormModal,
  type EditableProposalData,
} from '@/components/proposals/ProposalFormModal';
import {
  PROPOSAL_PRIORITY_META,
  PROPOSAL_STATUS_META,
  type ProposalCategoryOption,
  type ProposalPriorityKey,
  type ProposalStatusKey,
} from '@/components/proposals/proposal-ui.constants';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Skeleton, SkeletonTable } from '@/components/ui/Skeleton';
import { formatVND } from '@/lib/portable/currency-utils';
import { formatDateVN } from '@/lib/portable/date-utils';
import type { PaginationMeta } from '@/lib/portable/pagination';
import { useI18n } from '@/shared/i18n/I18nContext';

interface ProposalRow {
  id: number;
  proposalCode: string;
  categoryId: number;
  categoryCode: string;
  categoryName: string;
  categoryNameEn: string | null;
  categoryColorHex: string;
  branchId: number;
  branchName: string;
  branchNameEn: string | null;
  departmentId: number | null;
  departmentName: string | null;
  departmentNameEn: string | null;
  budgetId: number | null;
  budgetCode: string | null;
  budgetName: string | null;
  budgetNameEn: string | null;
  budgetReservedAmount: number;
  isOverBudget: boolean;
  requesterUserId: number;
  requesterName: string;
  title: string;
  summary: string | null;
  priority: ProposalPriorityKey;
  status: ProposalStatusKey;
  estimatedBudget: number;
  approvedBudget: number | null;
  neededByDate: string | null;
  approvalCurrentStep: number | null;
  approvalTotalSteps: number | null;
  approvalRoleName: string | null;
  approvalRoleNameEn: string | null;
  createdAt: string;
}

interface ProposalsSummary {
  total: number;
  draftCount: number;
  pendingCount: number;
  needsRevisionCount: number;
  approvedCount: number;
  inExecutionCount: number;
  completedCount: number;
  rejectedCount: number;
  pendingMyApprovalCount: number;
  totalEstimatedBudget: number;
  totalApprovedBudget: number;
}

interface BranchOption {
  id: number;
  code: string;
  name: string;
  nameEn?: string | null;
}

interface DepartmentOption {
  id: number;
  code: string;
  name: string;
  nameEn?: string | null;
  branchId: number;
}

type ActiveTab = 'all' | 'my' | 'pending_my_approval' | 'categories';

const ERR_LOAD_PROPOSALS = '__ERR_LOAD_PROPOSALS__';
const ERR_NETWORK_PROPOSALS = '__ERR_NETWORK_PROPOSALS__';

export default function ProposalsPage() {
  const router = useRouter();
  const { locale, tr, ln } = useI18n();
  const { user, hasPermission } = usePortalAuth();
  const canCreate = hasPermission('proposals.create');
  const canManage = hasPermission('proposals.manage');
  const canExport = hasPermission('proposals.export');

  const [activeTab, setActiveTab] = useState<ActiveTab>('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [page, setPage] = useState(1);
  const [reloadTick, setReloadTick] = useState(0);

  const [viewState, setViewState] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [proposals, setProposals] = useState<ProposalRow[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [summary, setSummary] = useState<ProposalsSummary | null>(null);
  const [categories, setCategories] = useState<ProposalCategoryOption[]>([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [budgetOptions, setBudgetOptions] = useState<BudgetOptionDto[]>([]);

  const [isProposalModalOpen, setIsProposalModalOpen] = useState(false);
  const [editingProposal, setEditingProposal] = useState<EditableProposalData | null>(null);
  const [deletingProposal, setDeletingProposal] = useState<ProposalRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [submittingId, setSubmittingId] = useState<number | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ProposalCategoryOption | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<ProposalCategoryOption | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetch('/api/v1/proposals/categories?includeInactive=true', {
        cache: 'no-store',
        signal: controller.signal,
      }),
      fetch('/api/v1/core/branches?limit=100&isActive=true', {
        cache: 'no-store',
        signal: controller.signal,
      }),
      fetch('/api/v1/hrm/org/departments?limit=200', {
        cache: 'no-store',
        signal: controller.signal,
      }),
      fetch('/api/v1/payments/budgets/options', {
        cache: 'no-store',
        signal: controller.signal,
      }),
    ])
      .then(async ([catRes, brRes, deptRes, budRes]) => {
        if (controller.signal.aborted) {
          return;
        }
        const [catJson, brJson, deptJson, budJson] = await Promise.all([
          catRes.json().catch(() => null),
          brRes.json().catch(() => null),
          deptRes.json().catch(() => null),
          budRes.json().catch(() => null),
        ]);
        if (catRes.ok && catJson?.success) {
          setCategories((catJson.data ?? []) as ProposalCategoryOption[]);
        }
        if (brRes.ok && brJson?.success) {
          setBranches((brJson.data ?? []) as BranchOption[]);
        }
        if (deptRes.ok && deptJson?.success) {
          setDepartments((deptJson.data ?? []) as DepartmentOption[]);
        }
        if (budRes.ok && budJson?.success) {
          setBudgetOptions((budJson.data ?? []) as BudgetOptionDto[]);
        }
      })
      .catch(() => undefined);

    return () => controller.abort();
  }, [reloadTick]);

  useEffect(() => {
    if (activeTab === 'categories') {
      return;
    }
    const controller = new AbortController();
    const params = new URLSearchParams({
      scope: activeTab,
      page: String(page),
      limit: '15',
    });
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (statusFilter) params.set('status', statusFilter);
    if (categoryFilter) params.set('categoryId', categoryFilter);
    if (priorityFilter) params.set('priority', priorityFilter);
    if (branchFilter) params.set('branchId', branchFilter);

    Promise.all([
      fetch(`/api/v1/proposals?${params.toString()}`, {
        cache: 'no-store',
        signal: controller.signal,
      }),
      fetch('/api/v1/proposals/summary', {
        cache: 'no-store',
        signal: controller.signal,
      }),
    ])
      .then(async ([listRes, sumRes]) => {
        if (controller.signal.aborted) {
          return;
        }
        const [listJson, sumJson] = await Promise.all([
          listRes.json().catch(() => null),
          sumRes.json().catch(() => null),
        ]);
        if (!listRes.ok || !listJson?.success) {
          setErrorMessage(listJson?.error?.message ?? ERR_LOAD_PROPOSALS);
          setViewState('error');
          return;
        }
        setProposals((listJson.data ?? []) as ProposalRow[]);
        setMeta((listJson.meta ?? null) as PaginationMeta | null);
        if (sumRes.ok && sumJson?.success) {
          setSummary(sumJson.data as ProposalsSummary);
        }
        setErrorMessage('');
        setViewState('success');
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }
        setErrorMessage(ERR_NETWORK_PROPOSALS);
        setViewState('error');
      });

    return () => controller.abort();
  }, [
    activeTab,
    debouncedSearch,
    statusFilter,
    categoryFilter,
    priorityFilter,
    branchFilter,
    page,
    reloadTick,
  ]);

  function triggerReload() {
    setViewState('loading');
    setReloadTick((t) => t + 1);
  }

  function openCreateModal() {
    setEditingProposal(null);
    setIsProposalModalOpen(true);
  }

  async function openEditModal(proposalId: number) {
    try {
      const res = await fetch(`/api/v1/proposals/${proposalId}`, { cache: 'no-store' });
      const json = (await res.json().catch(() => null)) as {
        success?: boolean;
        data?: EditableProposalData;
      } | null;
      if (res.ok && json?.success && json.data) {
        setEditingProposal(json.data);
        setIsProposalModalOpen(true);
      }
    } catch {
      setErrorMessage(
        tr('Không thể tải chi tiết đề xuất để chỉnh sửa.', 'Unable to load proposal details for editing.'),
      );
      setViewState('error');
    }
  }

  async function handleQuickSubmit(proposalId: number) {
    setSubmittingId(proposalId);
    try {
      const res = await fetch(`/api/v1/proposals/${proposalId}/submit`, { method: 'POST' });
      const json = (await res.json().catch(() => null)) as {
        success?: boolean;
        error?: { message?: string };
      } | null;
      if (!res.ok || !json?.success) {
        setErrorMessage(
          json?.error?.message ??
            tr('Không thể gửi duyệt đề xuất.', 'Unable to submit proposal for approval.'),
        );
        setViewState('error');
      } else {
        triggerReload();
      }
    } finally {
      setSubmittingId(null);
    }
  }

  async function handleConfirmDeleteProposal() {
    if (!deletingProposal) {
      return;
    }
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/v1/proposals/${deletingProposal.id}`, { method: 'DELETE' });
      if (!res.ok) {
        setErrorMessage(tr('Không thể xóa mềm đề xuất.', 'Unable to archive proposal.'));
        setViewState('error');
      } else {
        triggerReload();
      }
    } finally {
      setIsDeleting(false);
      setDeletingProposal(null);
    }
  }

  async function handleConfirmDeleteCategory() {
    if (!deletingCategory) {
      return;
    }
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/v1/proposals/categories/${deletingCategory.id}`, {
        method: 'DELETE',
      });
      const json = (await res.json().catch(() => null)) as {
        success?: boolean;
        error?: { message?: string };
      } | null;
      if (!res.ok || !json?.success) {
        setErrorMessage(
          json?.error?.message ??
            tr('Không thể ẩn danh mục đề xuất.', 'Unable to archive proposal category.'),
        );
        setViewState('error');
      } else {
        triggerReload();
      }
    } finally {
      setIsDeleting(false);
      setDeletingCategory(null);
    }
  }

  async function handleExportExcel() {
    setIsExporting(true);
    try {
      const params = new URLSearchParams({ scope: activeTab === 'categories' ? 'all' : activeTab });
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (statusFilter) params.set('status', statusFilter);
      if (categoryFilter) params.set('categoryId', categoryFilter);
      if (priorityFilter) params.set('priority', priorityFilter);
      if (branchFilter) params.set('branchId', branchFilter);

      const res = await fetch(`/api/v1/proposals/export/excel?${params.toString()}`);
      if (!res.ok) {
        setErrorMessage(tr('Không thể xuất file Excel.', 'Unable to export Excel file.'));
        setViewState('error');
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `operon-proposals-${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  }

  const resolvedError =
    errorMessage === ERR_LOAD_PROPOSALS
      ? tr('Không thể tải danh sách đề xuất nội bộ.', 'Unable to load internal proposals.')
      : errorMessage === ERR_NETWORK_PROPOSALS
        ? tr('Lỗi kết nối khi tải đề xuất nội bộ.', 'Connection error while loading proposals.')
        : errorMessage;

  return (
    <div className="w-full space-y-5">
      {/* Hero Banner */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#080E1A] via-[#0F172A] to-[#1E3A8A] p-6 text-white shadow-sm">
        <div className="pointer-events-none absolute -top-16 -right-16 h-60 w-60 rounded-full bg-violet-400/15 blur-3xl" />

        <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold text-cyan-300">
              <IconFileDescription size={14} />
              <span>{tr('Phân hệ Đề xuất & Tờ trình Nội bộ', 'Internal Proposals & Approvals')}</span>
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-white">
              {tr('Quản lý Đề xuất Nội bộ', 'Internal Proposals Workspace')}
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-300">
              {tr(
                'Lập tờ trình mua sắm, sự kiện, đào tạo, cải tiến quy trình kèm bảng dự toán chi tiết và phê duyệt đa cấp tự động qua Core Approval Engine.',
                'Submit procurement, event, training, and process proposals with itemized budgets and multi-level routing via the Core Approval Engine.',
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {canExport && (
              <button
                type="button"
                disabled={isExporting}
                onClick={() => void handleExportExcel()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-3.5 py-2 text-xs font-semibold text-white backdrop-blur-xs hover:bg-white/20 disabled:opacity-60"
              >
                <IconDownload size={16} />
                <span>
                  {isExporting ? tr('Đang xuất...', 'Exporting...') : tr('Xuất Excel', 'Export Excel')}
                </span>
              </button>
            )}
            {canCreate && (
              <button
                type="button"
                onClick={openCreateModal}
                className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-500 px-4 py-2 text-xs font-bold text-slate-950 shadow-sm hover:bg-cyan-400"
              >
                <IconPlus size={16} />
                <span>{tr('Tạo đề xuất mới', 'New Proposal')}</span>
              </button>
            )}
          </div>
        </div>

        {/* KPI Strip */}
        <div className="relative z-10 mt-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
            <div className="text-[11px] font-medium text-slate-300">
              {tr('Tổng số đề xuất', 'Total Proposals')}
            </div>
            {viewState === 'loading' && !summary ? (
              <Skeleton tone="dark" className="mt-1.5 h-6 w-12" />
            ) : (
              <div className="mt-1 text-xl font-bold text-white">{summary?.total ?? 0}</div>
            )}
          </div>
          <div className="rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-3">
            <div className="text-[11px] font-medium text-amber-200">
              {tr('Chờ tôi phê duyệt', 'Pending My Approval')}
            </div>
            {viewState === 'loading' && !summary ? (
              <Skeleton tone="dark" className="mt-1.5 h-6 w-12" />
            ) : (
              <div className="mt-1 text-xl font-bold text-amber-300">
                {summary?.pendingMyApprovalCount ?? 0}
              </div>
            )}
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
            <div className="text-[11px] font-medium text-slate-300">
              {tr('Đang chờ duyệt', 'In Approval')}
            </div>
            {viewState === 'loading' && !summary ? (
              <Skeleton tone="dark" className="mt-1.5 h-6 w-12" />
            ) : (
              <div className="mt-1 text-xl font-bold text-cyan-300">
                {summary?.pendingCount ?? 0}
              </div>
            )}
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
            <div className="text-[11px] font-medium text-slate-300">
              {tr('Đã duyệt / Đang thực thi', 'Approved / Executing')}
            </div>
            {viewState === 'loading' && !summary ? (
              <Skeleton tone="dark" className="mt-1.5 h-6 w-12" />
            ) : (
              <div className="mt-1 text-xl font-bold text-emerald-300">
                {(summary?.approvedCount ?? 0) +
                  (summary?.inExecutionCount ?? 0) +
                  (summary?.completedCount ?? 0)}
              </div>
            )}
          </div>
          <div className="col-span-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 lg:col-span-1">
            <div className="text-[11px] font-medium text-slate-300">
              {tr('Ngân sách đã duyệt', 'Approved Budget')}
            </div>
            {viewState === 'loading' && !summary ? (
              <Skeleton tone="dark" className="mt-1.5 h-6 w-28" />
            ) : (
              <div className="mt-1 truncate text-base font-bold text-white">
                {formatVND(summary?.totalApprovedBudget ?? 0)}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200">
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            onClick={() => {
              setActiveTab('all');
              setPage(1);
              setViewState('loading');
            }}
            className={`inline-flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-semibold ${
              activeTab === 'all'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <IconFileDescription size={16} />
            <span>{tr('Tất cả đề xuất', 'All Proposals')}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('my');
              setPage(1);
              setViewState('loading');
            }}
            className={`inline-flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-semibold ${
              activeTab === 'my'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <IconUser size={16} />
            <span>{tr('Đề xuất của tôi', 'My Proposals')}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('pending_my_approval');
              setPage(1);
              setViewState('loading');
            }}
            className={`inline-flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-semibold ${
              activeTab === 'pending_my_approval'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <IconChecklist size={16} />
            <span>{tr('Chờ tôi duyệt', 'Pending My Approval')}</span>
            {(summary?.pendingMyApprovalCount ?? 0) > 0 && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">
                {summary?.pendingMyApprovalCount}
              </span>
            )}
          </button>
          {canManage && (
            <button
              type="button"
              onClick={() => setActiveTab('categories')}
              className={`inline-flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-semibold ${
                activeTab === 'categories'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <IconCategory size={16} />
              <span>{tr('Danh mục đề xuất', 'Categories')}</span>
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={triggerReload}
          className="mb-1.5 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          <IconRefresh size={14} />
          <span>{tr('Làm mới', 'Refresh')}</span>
        </button>
      </div>

      {/* Categories Admin Tab */}
      {activeTab === 'categories' && canManage ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {tr('Danh mục Loại Đề xuất (Song ngữ VI/EN)', 'Proposal Categories (Bilingual VI/EN)')}
              </h2>
              <p className="text-xs text-slate-500">
                {tr(
                  'Cấu hình nhóm đề xuất, ngưỡng ngân sách kích hoạt luồng duyệt cấp cao và trạng thái sử dụng.',
                  'Configure proposal types, high-value budget thresholds for executive routing, and active status.',
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setEditingCategory(null);
                setIsCategoryModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700"
            >
              <IconPlus size={15} />
              <span>{tr('Thêm danh mục', 'Add Category')}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {categories.map((cat) => (
              <article
                key={cat.id}
                className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: cat.colorHex }}
                      />
                      <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-700">
                        {cat.code}
                      </span>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        cat.isActive
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {cat.isActive ? tr('Hoạt động', 'Active') : tr('Tạm ngưng', 'Inactive')}
                    </span>
                  </div>
                  <h3 className="mt-2.5 text-sm font-bold text-slate-900">
                    {ln(cat.name, cat.nameEn)}
                  </h3>
                  {cat.nameEn && locale === 'vi' && (
                    <div className="text-[11px] text-slate-400">{cat.nameEn}</div>
                  )}
                  {cat.description && (
                    <p className="mt-1.5 text-xs text-slate-600">{cat.description}</p>
                  )}
                  <div className="mt-3 space-y-1 border-t border-slate-100 pt-2.5 text-[11px] text-slate-500">
                    <div>
                      {tr('Loại luồng duyệt', 'Workflow Type')}:{' '}
                      <span className="font-mono font-semibold text-slate-700">
                        {cat.defaultRequestType}
                      </span>
                    </div>
                    <div>
                      {tr('Ngưỡng duyệt cấp cao', 'Executive Threshold')}:{' '}
                      <span className="font-semibold text-slate-800">
                        {formatVND(cat.budgetThresholdHigh)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex justify-end gap-1.5 border-t border-slate-100 pt-3">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingCategory(cat);
                      setIsCategoryModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <IconEdit size={13} />
                    <span>{tr('Sửa', 'Edit')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeletingCategory(cat)}
                    className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2.5 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50"
                  >
                    <IconTrash size={13} />
                    <span>{tr('Ẩn', 'Archive')}</span>
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* Filter Bar */}
          <div className="grid grid-cols-1 gap-2.5 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs sm:grid-cols-2 lg:grid-cols-5">
            <div className="relative lg:col-span-2">
              <IconSearch
                size={15}
                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={tr(
                  'Tìm mã đề xuất, tiêu đề, người tạo, nhà cung cấp...',
                  'Search code, title, requester, vendor...',
                )}
                className="w-full rounded-xl border border-slate-300 py-2 pr-3 pl-9 text-xs text-slate-800 outline-none focus:border-blue-500"
              />
            </div>

            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setPage(1);
                setViewState('loading');
              }}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700"
            >
              <option value="">{tr('Tất cả danh mục', 'All categories')}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {ln(c.name, c.nameEn)}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
                setViewState('loading');
              }}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700"
            >
              <option value="">{tr('Tất cả trạng thái', 'All statuses')}</option>
              {(Object.keys(PROPOSAL_STATUS_META) as ProposalStatusKey[]).map((key) => (
                <option key={key} value={key}>
                  {locale === 'en' ? PROPOSAL_STATUS_META[key].en : PROPOSAL_STATUS_META[key].vi}
                </option>
              ))}
            </select>

            <div className="flex gap-2">
              <select
                value={priorityFilter}
                onChange={(e) => {
                  setPriorityFilter(e.target.value);
                  setPage(1);
                  setViewState('loading');
                }}
                className="w-full rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-700"
              >
                <option value="">{tr('Mọi ưu tiên', 'All priorities')}</option>
                {(Object.keys(PROPOSAL_PRIORITY_META) as ProposalPriorityKey[]).map((key) => (
                  <option key={key} value={key}>
                    {locale === 'en'
                      ? PROPOSAL_PRIORITY_META[key].en
                      : PROPOSAL_PRIORITY_META[key].vi}
                  </option>
                ))}
              </select>
              {branches.length > 1 && (
                <select
                  value={branchFilter}
                  onChange={(e) => {
                    setBranchFilter(e.target.value);
                    setPage(1);
                    setViewState('loading');
                  }}
                  className="w-full rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-700"
                >
                  <option value="">{tr('Mọi chi nhánh', 'All branches')}</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {ln(b.name, b.nameEn)}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* 4 Mandatory States */}
          {viewState === 'loading' && (
            <SkeletonTable rows={6} columns={7} showToolbar={false} showPagination={false} />
          )}

          {viewState === 'error' && (
            <div className="flex items-center justify-between rounded-2xl border border-rose-200 bg-rose-50 p-5">
              <span className="text-sm font-medium text-rose-700">{resolvedError}</span>
              <button
                type="button"
                onClick={triggerReload}
                className="rounded-xl border border-rose-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50"
              >
                {tr('Thử lại', 'Retry')}
              </button>
            </div>
          )}

          {viewState === 'success' && proposals.length === 0 && (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white py-14 text-center">
              <IconInbox size={38} className="text-slate-400" />
              <p className="mt-2.5 text-sm font-semibold text-slate-800">
                {tr('Chưa có đề xuất nội bộ nào khớp bộ lọc', 'No matching internal proposals found')}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {tr(
                  'Hãy tạo tờ trình đề xuất mới hoặc thay đổi bộ lọc trạng thái/danh mục.',
                  'Create a new proposal or adjust your status/category filters.',
                )}
              </p>
              {canCreate && (
                <button
                  type="button"
                  onClick={openCreateModal}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                >
                  <IconPlus size={15} />
                  <span>{tr('Tạo đề xuất đầu tiên', 'Create First Proposal')}</span>
                </button>
              )}
            </div>
          )}

          {viewState === 'success' && proposals.length > 0 && (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                  <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-4 py-3">{tr('Mã & Tiêu đề đề xuất', 'Code & Title')}</th>
                      <th className="px-4 py-3">{tr('Danh mục', 'Category')}</th>
                      <th className="px-4 py-3">{tr('Người đề xuất', 'Requester')}</th>
                      <th className="px-4 py-3 text-right">{tr('Ngân sách dự kiến', 'Est. Budget')}</th>
                      <th className="px-4 py-3">{tr('Ưu tiên & Hạn cần', 'Priority & Due')}</th>
                      <th className="px-4 py-3">{tr('Trạng thái & Duyệt', 'Status & Approval')}</th>
                      <th className="px-4 py-3 text-right">{tr('Thao tác', 'Actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {proposals.map((item) => {
                      const statusMeta = PROPOSAL_STATUS_META[item.status];
                      const priorityMeta = PROPOSAL_PRIORITY_META[item.priority];
                      const isOwner = user?.userId === item.requesterUserId;
                      const canEditItem =
                        (isOwner || canManage) &&
                        (item.status === 'DRAFT' || item.status === 'NEEDS_REVISION');
                      const canDeleteItem =
                        (isOwner || canManage) &&
                        (item.status === 'DRAFT' || item.status === 'CANCELLED');

                      return (
                        <tr key={item.id} className="hover:bg-slate-50/80">
                          <td className="max-w-xs px-4 py-3">
                            <Link
                              href={`/services/proposals/${item.id}`}
                              className="font-semibold text-slate-900 hover:text-blue-600"
                            >
                              {item.title}
                            </Link>
                            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                              <span className="font-mono font-semibold text-blue-700">
                                {item.proposalCode}
                              </span>
                              <span>•</span>
                              <span>{ln(item.branchName, item.branchNameEn)}</span>
                              {item.budgetCode && (
                                <span className="rounded bg-emerald-50 px-1.5 py-0.5 font-mono text-[10px] font-bold text-emerald-700">
                                  {item.budgetCode}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3">
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                              <span
                                className="h-2 w-2 rounded-full"
                                style={{ backgroundColor: item.categoryColorHex }}
                              />
                              <span>{ln(item.categoryName, item.categoryNameEn)}</span>
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-700">
                            <div className="font-medium text-slate-800">{item.requesterName}</div>
                            {item.departmentName && (
                              <div className="text-[11px] text-slate-500">
                                {ln(item.departmentName, item.departmentNameEn)}
                              </div>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-right text-xs font-semibold text-slate-900">
                            {item.estimatedBudget > 0
                              ? formatVND(item.estimatedBudget)
                              : tr('Không phát sinh', 'No budget')}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-xs">
                            <span className={`rounded-full px-2 py-0.5 text-[11px] ${priorityMeta.cls}`}>
                              {locale === 'en' ? priorityMeta.en : priorityMeta.vi}
                            </span>
                            {item.neededByDate && (
                              <div className="mt-1 text-[11px] text-slate-500">
                                {formatDateVN(item.neededByDate)}
                              </div>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-xs">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${statusMeta.cls}`}
                            >
                              {locale === 'en' ? statusMeta.en : statusMeta.vi}
                            </span>
                            {item.status === 'PENDING_APPROVAL' &&
                              item.approvalCurrentStep &&
                              item.approvalTotalSteps && (
                                <div className="mt-1 text-[11px] text-slate-500">
                                  {tr('Bước', 'Step')} {item.approvalCurrentStep}/
                                  {item.approvalTotalSteps}
                                  {item.approvalRoleName
                                    ? ` • ${ln(item.approvalRoleName, item.approvalRoleNameEn)}`
                                    : ''}
                                </div>
                              )}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-right">
                            <div className="inline-flex items-center gap-1">
                              <Link
                                href={`/services/proposals/${item.id}`}
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                              >
                                <IconEye size={14} />
                                <span>{tr('Chi tiết', 'Open')}</span>
                              </Link>
                              {canEditItem && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => void openEditModal(item.id)}
                                    className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-blue-600"
                                    title={tr('Chỉnh sửa', 'Edit')}
                                  >
                                    <IconEdit size={15} />
                                  </button>
                                  <button
                                    type="button"
                                    disabled={submittingId === item.id}
                                    onClick={() => void handleQuickSubmit(item.id)}
                                    className="rounded-lg p-1.5 text-blue-600 hover:bg-blue-50 disabled:opacity-50"
                                    title={tr('Gửi duyệt ngay', 'Submit now')}
                                  >
                                    <IconSend size={15} />
                                  </button>
                                </>
                              )}
                              {canDeleteItem && (
                                <button
                                  type="button"
                                  onClick={() => setDeletingProposal(item)}
                                  className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                                  title={tr('Xóa mềm', 'Archive')}
                                >
                                  <IconTrash size={15} />
                                </button>
                              )}
                            </div>
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
                      `Trang ${meta.page}/${meta.totalPages} (Tổng ${meta.total} đề xuất)`,
                      `Page ${meta.page}/${meta.totalPages} (${meta.total} total)`,
                    )}
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={!meta.hasPrev}
                      onClick={() => {
                        setPage((p) => Math.max(1, p - 1));
                        setViewState('loading');
                      }}
                      className="rounded-lg border border-slate-300 px-3 py-1 disabled:opacity-50"
                    >
                      {tr('Trước', 'Previous')}
                    </button>
                    <button
                      type="button"
                      disabled={!meta.hasNext}
                      onClick={() => {
                        setPage((p) => p + 1);
                        setViewState('loading');
                      }}
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

      {isProposalModalOpen && (
        <ProposalFormModal
          key={editingProposal ? `edit-${editingProposal.id}` : 'create-new'}
          isOpen={isProposalModalOpen}
          editingProposal={editingProposal}
          categories={categories}
          branches={branches}
          departments={departments}
          budgets={budgetOptions}
          onClose={() => setIsProposalModalOpen(false)}
          onSaved={(savedId) => {
            setIsProposalModalOpen(false);
            if (!editingProposal && savedId) {
              router.push(`/services/proposals/${savedId}`);
            } else {
              triggerReload();
            }
          }}
        />
      )}

      {isCategoryModalOpen && (
        <ProposalCategoryModal
          key={editingCategory ? `cat-${editingCategory.id}` : 'cat-new'}
          isOpen={isCategoryModalOpen}
          editingCategory={editingCategory}
          onClose={() => setIsCategoryModalOpen(false)}
          onSaved={() => {
            setIsCategoryModalOpen(false);
            triggerReload();
          }}
        />
      )}

      <ConfirmModal
        isOpen={Boolean(deletingProposal)}
        title={tr('Xác nhận xóa mềm đề xuất', 'Confirm Archive Proposal')}
        description={tr(
          `Bạn có chắc muốn lưu trữ và ẩn đề xuất "${deletingProposal?.proposalCode ?? ''} — ${deletingProposal?.title ?? ''}"?`,
          `Are you sure you want to archive proposal "${deletingProposal?.proposalCode ?? ''} — ${deletingProposal?.title ?? ''}"?`,
        )}
        confirmLabel={tr('Xác nhận xóa mềm', 'Archive Proposal')}
        isProcessing={isDeleting}
        onCancel={() => setDeletingProposal(null)}
        onConfirm={() => void handleConfirmDeleteProposal()}
      />

      <ConfirmModal
        isOpen={Boolean(deletingCategory)}
        title={tr('Xác nhận ẩn danh mục đề xuất', 'Confirm Archive Category')}
        description={tr(
          `Bạn có chắc muốn ẩn danh mục "${deletingCategory?.name ?? ''}"?`,
          `Are you sure you want to archive category "${deletingCategory?.nameEn || deletingCategory?.name || ''}"?`,
        )}
        confirmLabel={tr('Ẩn danh mục', 'Archive Category')}
        isProcessing={isDeleting}
        onCancel={() => setDeletingCategory(null)}
        onConfirm={() => void handleConfirmDeleteCategory()}
      />
    </div>
  );
}
