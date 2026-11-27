'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  IconBriefcase,
  IconBuilding,
  IconEdit,
  IconHierarchy2,
  IconInbox,
  IconListDetails,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconTrash,
  IconUserCheck,
  IconUsers,
  IconX,
} from '@tabler/icons-react';
import {
  OrgChartTree,
  type BranchOrgTreeData,
  type OrgDepartmentNode,
} from '@/components/hrm/OrgChartTree';
import { usePortalAuth } from '@/components/portal/PortalAuthContext';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { computeOrgTreeMetrics } from '@/lib/portable/org-chart-utils';
import { useI18n } from '@/shared/i18n/I18nContext';

interface DepartmentRow {
  id: number;
  branchId: number;
  branchCode: string;
  branchName: string;
  branchNameEn?: string | null;
  parentId: number | null;
  parentName: string | null;
  parentNameEn?: string | null;
  code: string;
  name: string;
  nameEn?: string | null;
  description: string | null;
  managerEmployeeId?: number | null;
  managerName?: string | null;
  managerCode?: string | null;
  managerPosition?: string | null;
  managerPositionEn?: string | null;
  employeeCount?: number;
  sortOrder: number;
  isActive: boolean;
}

interface PositionRow {
  id: number;
  code: string;
  name: string;
  nameEn?: string | null;
  level: number;
  description: string | null;
  isActive: boolean;
}

interface EmployeeOption {
  id: number;
  employeeCode: string;
  fullName: string;
  branchId: number;
  departmentName?: string | null;
  positionName?: string | null;
  positionNameEn?: string | null;
}

type OrgTab = 'tree' | 'departments' | 'positions';

export default function HrmOrganizationPage() {
  const { user, selectedBranchId, hasPermission } = usePortalAuth();
  const { tr, ln } = useI18n();
  const trRef = useRef(tr);
  useEffect(() => {
    trRef.current = tr;
  }, [tr]);
  const canManage = hasPermission('hrm.org.manage');

  const [activeTab, setActiveTab] = useState<OrgTab>('tree');
  const [viewState, setViewState] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [reloadTick, setReloadTick] = useState(0);

  const [orgTree, setOrgTree] = useState<BranchOrgTreeData[]>([]);
  const [departments, setDepartments] = useState<DepartmentRow[]>([]);
  const [positions, setPositions] = useState<PositionRow[]>([]);
  const [employeeOptions, setEmployeeOptions] = useState<EmployeeOption[]>([]);

  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Department modal state
  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  const [editingDeptId, setEditingDeptId] = useState<number | null>(null);
  const [deptBranchId, setDeptBranchId] = useState('');
  const [deptParentId, setDeptParentId] = useState('');
  const [deptManagerId, setDeptManagerId] = useState('');
  const [deptCode, setDeptCode] = useState('');
  const [deptName, setDeptName] = useState('');
  const [deptNameEn, setDeptNameEn] = useState('');
  const [deptDesc, setDeptDesc] = useState('');
  const [deptSortOrder, setDeptSortOrder] = useState('0');
  const [deptIsActive, setDeptIsActive] = useState(true);
  const [deptFormError, setDeptFormError] = useState('');
  const [isSavingDept, setIsSavingDept] = useState(false);

  // Position modal state
  const [isPosModalOpen, setIsPosModalOpen] = useState(false);
  const [editingPosId, setEditingPosId] = useState<number | null>(null);
  const [posCode, setPosCode] = useState('');
  const [posName, setPosName] = useState('');
  const [posNameEn, setPosNameEn] = useState('');
  const [posLevel, setPosLevel] = useState('1');
  const [posDesc, setPosDesc] = useState('');
  const [posIsActive, setPosIsActive] = useState(true);
  const [posFormError, setPosFormError] = useState('');
  const [isSavingPos, setIsSavingPos] = useState(false);

  // Confirm delete modal
  const [deleteTarget, setDeleteTarget] = useState<{
    kind: 'department' | 'position';
    id: number;
    label: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    const controller = new AbortController();
    const branchParam = selectedBranchId ? `&branchId=${selectedBranchId}` : '';
    const searchParam = debouncedSearch ? `&search=${encodeURIComponent(debouncedSearch)}` : '';

    const requests: Promise<Response>[] = [
      fetch(`/api/v1/hrm/org/departments/tree?includeInactive=true${branchParam}`, {
        cache: 'no-store',
        signal: controller.signal,
      }),
      fetch(`/api/v1/hrm/org/departments?limit=200${branchParam}${searchParam}`, {
        cache: 'no-store',
        signal: controller.signal,
      }),
      fetch(`/api/v1/hrm/org/positions?limit=200${searchParam}`, {
        cache: 'no-store',
        signal: controller.signal,
      }),
    ];

    if (canManage) {
      requests.push(
        fetch(`/api/v1/hrm/employees?limit=200${branchParam}`, {
          cache: 'no-store',
          signal: controller.signal,
        }),
      );
    }

    Promise.all(requests)
      .then(async ([treeRes, deptRes, posRes, empRes]) => {
        if (controller.signal.aborted) {
          return;
        }
        const [treeJson, deptJson, posJson, empJson] = await Promise.all([
          treeRes.json().catch(() => null),
          deptRes.json().catch(() => null),
          posRes.json().catch(() => null),
          empRes ? empRes.json().catch(() => null) : Promise.resolve(null),
        ]);

        if (!treeRes.ok || !treeJson?.success) {
          setErrorMessage(
            treeJson?.error?.message ??
              trRef.current(
                'Không thể tải dữ liệu cơ cấu tổ chức.',
                'Failed to load organization structure data.',
              ),
          );
          setViewState('error');
          return;
        }

        setOrgTree((treeJson.data ?? []) as BranchOrgTreeData[]);
        setDepartments((deptJson?.data ?? []) as DepartmentRow[]);
        setPositions((posJson?.data ?? []) as PositionRow[]);
        if (empRes?.ok && empJson?.success && Array.isArray(empJson.data)) {
          setEmployeeOptions(empJson.data as EmployeeOption[]);
        }
        setErrorMessage('');
        setViewState('success');
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }
        setErrorMessage(
          trRef.current(
            'Lỗi kết nối khi tải cơ cấu tổ chức.',
            'Connection error while loading organization structure.',
          ),
        );
        setViewState('error');
      });

    return () => controller.abort();
  }, [selectedBranchId, debouncedSearch, reloadTick, canManage]);

  const orgKpis = useMemo(() => {
    let totalDepartments = 0;
    let activeDepartments = 0;
    let totalStaff = 0;
    let maxDepth = 0;

    for (const branch of orgTree) {
      const m = computeOrgTreeMetrics(branch.departments, (n) => n.employeeCount ?? 0);
      totalDepartments += m.totalNodes;
      activeDepartments += m.activeNodes;
      totalStaff += m.totalHeadcount;
      if (m.maxDepth > maxDepth) {
        maxDepth = m.maxDepth;
      }
    }

    return {
      branches: orgTree.length,
      totalDepartments,
      activeDepartments,
      totalStaff,
      maxDepth,
    };
  }, [orgTree]);

  function triggerReload() {
    setViewState('loading');
    setReloadTick((t) => t + 1);
  }

  function openCreateDepartment(prefillBranchId?: number, prefillParentId?: number) {
    const defaultBranch = prefillBranchId ?? selectedBranchId ?? user?.branches[0]?.id ?? '';
    setEditingDeptId(null);
    setDeptBranchId(String(defaultBranch));
    setDeptParentId(prefillParentId ? String(prefillParentId) : '');
    setDeptManagerId('');
    setDeptCode('');
    setDeptName('');
    setDeptNameEn('');
    setDeptDesc('');
    setDeptSortOrder('0');
    setDeptIsActive(true);
    setDeptFormError('');
    setIsDeptModalOpen(true);
  }

  function openEditDepartment(dept: DepartmentRow | OrgDepartmentNode) {
    setEditingDeptId(dept.id);
    setDeptBranchId(String(dept.branchId));
    setDeptParentId(dept.parentId ? String(dept.parentId) : '');
    setDeptManagerId(dept.managerEmployeeId ? String(dept.managerEmployeeId) : '');
    setDeptCode(dept.code);
    setDeptName(dept.name);
    setDeptNameEn(dept.nameEn ?? '');
    setDeptDesc(dept.description ?? '');
    setDeptSortOrder(String(dept.sortOrder));
    setDeptIsActive(dept.isActive);
    setDeptFormError('');
    setIsDeptModalOpen(true);
  }

  async function handleSaveDepartment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setDeptFormError('');
    setIsSavingDept(true);

    try {
      const url = editingDeptId
        ? `/api/v1/hrm/org/departments/${editingDeptId}`
        : '/api/v1/hrm/org/departments';
      const method = editingDeptId ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchId: Number(deptBranchId),
          parentId: deptParentId ? Number(deptParentId) : null,
          managerEmployeeId: deptManagerId ? Number(deptManagerId) : null,
          code: deptCode.trim().toUpperCase(),
          name: deptName.trim(),
          nameEn: deptNameEn.trim() || null,
          description: deptDesc.trim() || null,
          sortOrder: Number(deptSortOrder) || 0,
          isActive: deptIsActive,
        }),
      });
      const json = (await res.json().catch(() => null)) as {
        success?: boolean;
        error?: { message?: string };
      } | null;

      if (!res.ok || !json?.success) {
        setDeptFormError(
          json?.error?.message ?? tr('Không thể lưu phòng ban.', 'Failed to save department.'),
        );
        return;
      }

      setIsDeptModalOpen(false);
      triggerReload();
    } catch {
      setDeptFormError(
        tr('Lỗi kết nối khi lưu phòng ban.', 'Connection error while saving department.'),
      );
    } finally {
      setIsSavingDept(false);
    }
  }

  function openCreatePosition() {
    setEditingPosId(null);
    setPosCode('');
    setPosName('');
    setPosNameEn('');
    setPosLevel('1');
    setPosDesc('');
    setPosIsActive(true);
    setPosFormError('');
    setIsPosModalOpen(true);
  }

  function openEditPosition(pos: PositionRow) {
    setEditingPosId(pos.id);
    setPosCode(pos.code);
    setPosName(pos.name);
    setPosNameEn(pos.nameEn ?? '');
    setPosLevel(String(pos.level));
    setPosDesc(pos.description ?? '');
    setPosIsActive(pos.isActive);
    setPosFormError('');
    setIsPosModalOpen(true);
  }

  async function handleSavePosition(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPosFormError('');
    setIsSavingPos(true);

    try {
      const url = editingPosId
        ? `/api/v1/hrm/org/positions/${editingPosId}`
        : '/api/v1/hrm/org/positions';
      const method = editingPosId ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: posCode.trim().toUpperCase(),
          name: posName.trim(),
          nameEn: posNameEn.trim() || null,
          level: Number(posLevel) || 1,
          description: posDesc.trim() || null,
          isActive: posIsActive,
        }),
      });
      const json = (await res.json().catch(() => null)) as {
        success?: boolean;
        error?: { message?: string };
      } | null;

      if (!res.ok || !json?.success) {
        setPosFormError(
          json?.error?.message ?? tr('Không thể lưu chức danh.', 'Failed to save position.'),
        );
        return;
      }

      setIsPosModalOpen(false);
      triggerReload();
    } catch {
      setPosFormError(
        tr('Lỗi kết nối khi lưu chức danh.', 'Connection error while saving position.'),
      );
    } finally {
      setIsSavingPos(false);
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) {
      return;
    }
    setIsDeleting(true);
    try {
      const url =
        deleteTarget.kind === 'department'
          ? `/api/v1/hrm/org/departments/${deleteTarget.id}`
          : `/api/v1/hrm/org/positions/${deleteTarget.id}`;

      const res = await fetch(url, { method: 'DELETE' });
      const json = (await res.json().catch(() => null)) as {
        success?: boolean;
        error?: { message?: string };
      } | null;

      if (!res.ok || !json?.success) {
        setErrorMessage(
          json?.error?.message ??
            tr('Không thể xóa mục đã chọn.', 'Failed to delete the selected item.'),
        );
        setViewState('error');
      } else {
        triggerReload();
      }
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  }

  const candidateParentDepts = departments.filter(
    (d) => String(d.branchId) === deptBranchId && d.id !== editingDeptId,
  );

  const candidateManagers = employeeOptions.filter(
    (emp) => !deptBranchId || String(emp.branchId) === deptBranchId,
  );

  return (
    <div className="w-full space-y-5">
      {/* Executive Midnight Hero Header */}
      <section className="relative overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-br from-[#080E1A] via-[#0F1C36] to-[#162C52] p-5 text-white shadow-lg sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-cyan-400/15 px-3 py-1 text-[11px] font-semibold tracking-wider text-cyan-300 uppercase ring-1 ring-cyan-400/30">
              <IconHierarchy2 size={14} />
              <span>{tr('Sơ đồ Tổ chức Tương tác', 'Interactive Organization Chart')}</span>
            </div>
            <h1 className="mt-2.5 text-xl font-bold tracking-tight text-white sm:text-2xl">
              {tr('Cơ cấu Tổ chức (HRM)', 'Organization Structure (HRM)')}
            </h1>
            <p className="mt-1 text-xs text-slate-300 sm:text-sm">
              {tr(
                'Trực quan hóa cơ cấu tổ chức đa góc nhìn (Sơ đồ dọc, Sơ đồ ngang, Lưới thẻ, Cột phân cấp, Danh sách cây) và quản lý Danh mục Phòng ban & Chức danh.',
                'Visualize organization hierarchy across multiple layouts (Top-Down, Horizontal, Card Grid, Columns, Tree List) and manage Departments & Positions.',
              )}
            </p>
          </div>

          {canManage && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => openCreateDepartment()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-blue-600/30 transition hover:bg-blue-500 sm:text-sm"
              >
                <IconPlus size={16} />
                <span>{tr('Thêm phòng ban', 'Add Department')}</span>
              </button>
              <button
                type="button"
                onClick={openCreatePosition}
                className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-4 py-2 text-xs font-semibold text-white ring-1 ring-white/20 transition hover:bg-white/20 sm:text-sm"
              >
                <IconBriefcase size={16} />
                <span>{tr('Thêm chức danh', 'Add Position')}</span>
              </button>
            </div>
          )}
        </div>

        {/* Live Org KPI Strip */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-xs">
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-300">
              <IconBuilding size={14} className="text-cyan-400" />
              <span>{tr('Chi nhánh hiển thị', 'Visible Branches')}</span>
            </div>
            <div className="mt-1 text-xl font-bold text-white">{orgKpis.branches}</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-xs">
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-300">
              <IconHierarchy2 size={14} className="text-blue-400" />
              <span>{tr('Phòng ban hoạt động', 'Active Departments')}</span>
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-xl font-bold text-white">{orgKpis.activeDepartments}</span>
              {orgKpis.totalDepartments !== orgKpis.activeDepartments && (
                <span className="text-xs text-slate-400">/ {orgKpis.totalDepartments}</span>
              )}
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-xs">
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-300">
              <IconUsers size={14} className="text-emerald-400" />
              <span>{tr('Nhân sự thuộc sơ đồ', 'Staff on Chart')}</span>
            </div>
            <div className="mt-1 text-xl font-bold text-white">{orgKpis.totalStaff}</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-xs">
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-300">
              <IconBriefcase size={14} className="text-amber-400" />
              <span>{tr('Cấp bậc / Chức danh', 'Depth / Positions')}</span>
            </div>
            <div className="mt-1 text-xl font-bold text-white">
              L{orgKpis.maxDepth}{' '}
              <span className="text-xs font-normal text-slate-300">
                · {positions.length} {tr('chức danh', 'titles')}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Main Module Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200">
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab('tree')}
            className={`inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
              activeTab === 'tree'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <IconHierarchy2 size={17} />
            <span>{tr('Sơ đồ Tổ chức (Org Chart)', 'Org Chart')}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('departments')}
            className={`inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
              activeTab === 'departments'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <IconListDetails size={17} />
            <span>
              {tr('Danh sách Phòng ban', 'Departments')} ({departments.length})
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('positions')}
            className={`inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
              activeTab === 'positions'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <IconBriefcase size={17} />
            <span>
              {tr('Danh mục Chức danh', 'Positions')} ({positions.length})
            </span>
          </button>
        </div>

        <button
          type="button"
          onClick={triggerReload}
          className="mb-1.5 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
        >
          <IconRefresh size={14} />
          <span>{tr('Làm mới', 'Refresh')}</span>
        </button>
      </div>

      {activeTab !== 'tree' && (
        <div className="relative rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <IconSearch
            size={16}
            className="pointer-events-none absolute top-1/2 left-7 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            placeholder={
              activeTab === 'departments'
                ? tr(
                    'Tìm theo mã, tên phòng ban hoặc trưởng bộ phận...',
                    'Search by department code, name, or manager...',
                  )
                : tr(
                    'Tìm theo mã hoặc tên chức danh...',
                    'Search by position code or name...',
                  )
            }
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full rounded-xl border border-slate-300 py-2 pr-3 pl-9 text-sm outline-none focus:border-blue-500"
          />
        </div>
      )}

      {viewState === 'loading' && (
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      )}

      {viewState === 'error' && (
        <div className="flex items-center justify-between rounded-2xl border border-rose-200 bg-rose-50 p-5">
          <span className="text-sm font-medium text-rose-700">{errorMessage}</span>
          <button
            type="button"
            onClick={triggerReload}
            className="inline-flex items-center gap-1.5 rounded-xl border border-rose-300 bg-white px-3.5 py-2 text-xs font-medium text-rose-700"
          >
            <IconRefresh size={14} />
            <span>{tr('Thử lại', 'Retry')}</span>
          </button>
        </div>
      )}

      {viewState === 'success' && activeTab === 'tree' && (
        orgTree.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white py-14 text-center">
            <IconInbox size={34} className="text-slate-400" />
            <p className="mt-2 text-sm font-semibold text-slate-800">
              {tr('Chưa có dữ liệu sơ đồ tổ chức', 'No organization chart data yet')}
            </p>
          </div>
        ) : (
          <OrgChartTree
            branches={orgTree}
            canManage={canManage}
            onAddRoot={(branchId) => openCreateDepartment(branchId)}
            onAddChild={(branchId, parentId) => openCreateDepartment(branchId, parentId)}
            onEdit={(node) => openEditDepartment(node)}
            onDelete={
              canManage
                ? (node) =>
                    setDeleteTarget({
                      kind: 'department',
                      id: node.id,
                      label: `${ln(node.name, node.nameEn)} (${node.code})`,
                    })
                : undefined
            }
          />
        )
      )}

      {viewState === 'success' && activeTab === 'departments' && (
        departments.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white py-14 text-center">
            <IconInbox size={34} className="text-slate-400" />
            <p className="mt-2 text-sm font-semibold text-slate-800">
              {tr('Không có phòng ban phù hợp', 'No matching departments found')}
            </p>
            {canManage && (
              <button
                type="button"
                onClick={() => openCreateDepartment()}
                className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-medium text-white"
              >
                <IconPlus size={15} />
                <span>{tr('Thêm phòng ban', 'Add Department')}</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase">
                  <tr>
                    <th className="px-4 py-3">{tr('Mã', 'Code')}</th>
                    <th className="px-4 py-3">{tr('Tên phòng ban', 'Department Name')}</th>
                    <th className="px-4 py-3">{tr('Chi nhánh', 'Branch')}</th>
                    <th className="px-4 py-3">{tr('Trực thuộc', 'Parent Department')}</th>
                    <th className="px-4 py-3">{tr('Trưởng bộ phận', 'Manager')}</th>
                    <th className="px-4 py-3 text-center">{tr('Nhân sự', 'Staff')}</th>
                    <th className="px-4 py-3">{tr('Trạng thái', 'Status')}</th>
                    <th className="px-4 py-3 text-right">{tr('Thao tác', 'Actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {departments.map((d) => (
                    <tr key={d.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3 font-mono text-xs font-semibold whitespace-nowrap text-slate-800">
                        {d.code}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{ln(d.name, d.nameEn)}</div>
                        {d.description && (
                          <div className="text-xs text-slate-500">{d.description}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap text-slate-700">
                        {ln(d.branchName, d.branchNameEn)} ({d.branchCode})
                      </td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap text-slate-600">
                        {d.parentName ? ln(d.parentName, d.parentNameEn) : tr('Cấp gốc', 'Root Level')}
                      </td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap text-slate-700">
                        {d.managerName ? (
                          <div className="inline-flex items-center gap-1.5">
                            <IconUserCheck size={14} className="text-blue-600" />
                            <span className="font-medium text-slate-900">{d.managerName}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">
                            {tr('Chưa gán', 'Unassigned')}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                          <IconUsers size={12} className="text-blue-500" />
                          <span>{d.employeeCount ?? 0}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            d.isActive
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {d.isActive ? tr('Hoạt động', 'Active') : tr('Tạm ngưng', 'Inactive')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {canManage && (
                          <div className="inline-flex gap-1.5">
                            <button
                              type="button"
                              onClick={() => openEditDepartment(d)}
                              className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 hover:text-blue-600"
                              title={tr('Chỉnh sửa', 'Edit')}
                            >
                              <IconEdit size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setDeleteTarget({
                                  kind: 'department',
                                  id: d.id,
                                  label: `${ln(d.name, d.nameEn)} (${d.code})`,
                                })
                              }
                              className="rounded-lg p-1.5 text-slate-600 hover:bg-rose-50 hover:text-rose-600"
                              title={tr('Xóa mềm', 'Soft delete')}
                            >
                              <IconTrash size={16} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {viewState === 'success' && activeTab === 'positions' && (
        positions.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white py-14 text-center">
            <IconInbox size={34} className="text-slate-400" />
            <p className="mt-2 text-sm font-semibold text-slate-800">
              {tr('Không có chức danh phù hợp', 'No matching positions found')}
            </p>
            {canManage && (
              <button
                type="button"
                onClick={openCreatePosition}
                className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-medium text-white"
              >
                <IconPlus size={15} />
                <span>{tr('Thêm chức danh', 'Add Position')}</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase">
                  <tr>
                    <th className="px-4 py-3">{tr('Mã', 'Code')}</th>
                    <th className="px-4 py-3">{tr('Tên chức danh', 'Position Name')}</th>
                    <th className="px-4 py-3">{tr('Cấp bậc (Level)', 'Level')}</th>
                    <th className="px-4 py-3">{tr('Trạng thái', 'Status')}</th>
                    <th className="px-4 py-3 text-right">{tr('Thao tác', 'Actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {positions.map((pos) => (
                    <tr key={pos.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3 font-mono text-xs font-semibold whitespace-nowrap text-slate-800">
                        {pos.code}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{ln(pos.name, pos.nameEn)}</div>
                        {pos.description && (
                          <div className="text-xs text-slate-500">{pos.description}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="rounded-md bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                          Level {pos.level}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            pos.isActive
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {pos.isActive ? tr('Hoạt động', 'Active') : tr('Tạm ngưng', 'Inactive')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {canManage && (
                          <div className="inline-flex gap-1.5">
                            <button
                              type="button"
                              onClick={() => openEditPosition(pos)}
                              className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 hover:text-blue-600"
                              title={tr('Chỉnh sửa', 'Edit')}
                            >
                              <IconEdit size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setDeleteTarget({
                                  kind: 'position',
                                  id: pos.id,
                                  label: `${ln(pos.name, pos.nameEn)} (${pos.code})`,
                                })
                              }
                              className="rounded-lg p-1.5 text-slate-600 hover:bg-rose-50 hover:text-rose-600"
                              title={tr('Xóa mềm', 'Soft delete')}
                            >
                              <IconTrash size={16} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {isDeptModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">
                {editingDeptId
                  ? tr('Cập nhật Phòng ban', 'Update Department')
                  : tr('Thêm Phòng ban mới', 'Add New Department')}
              </h2>
              <button
                type="button"
                disabled={isSavingDept}
                onClick={() => setIsDeptModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <IconX size={18} />
              </button>
            </div>

            <form onSubmit={(e) => void handleSaveDepartment(e)} className="mt-4 space-y-3.5">
              {deptFormError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  {deptFormError}
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    {tr('Chi nhánh *', 'Branch *')}
                  </label>
                  <select
                    required
                    value={deptBranchId}
                    onChange={(e) => {
                      setDeptBranchId(e.target.value);
                      setDeptParentId('');
                    }}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    {(user?.branches ?? []).map((b) => (
                      <option key={b.id} value={b.id}>
                        {ln(b.name, b.nameEn)} ({b.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    {tr('Phòng ban cha', 'Parent Department')}
                  </label>
                  <select
                    value={deptParentId}
                    onChange={(e) => setDeptParentId(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="">{tr('-- Không (Cấp gốc) --', '-- None (Root Level) --')}</option>
                    {candidateParentDepts.map((d) => (
                      <option key={d.id} value={d.id}>
                        {ln(d.name, d.nameEn)} ({d.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    {tr('Mã phòng ban *', 'Department Code *')}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={tr('VD: SALES-HN', 'e.g. SALES-HN')}
                    value={deptCode}
                    onChange={(e) => setDeptCode(e.target.value.toUpperCase())}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm uppercase"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    {tr('Tên phòng ban *', 'Department Name *')}
                  </label>
                  <input
                    type="text"
                    required
                    value={deptName}
                    onChange={(e) => setDeptName(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    {tr('Tên tiếng Anh', 'English Name')}
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Sales Department"
                    value={deptNameEn}
                    onChange={(e) => setDeptNameEn(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    {tr('Trưởng bộ phận', 'Department Manager')}
                  </label>
                  <select
                    value={deptManagerId}
                    onChange={(e) => setDeptManagerId(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="">{tr('-- Chưa gán --', '-- Unassigned --')}</option>
                    {candidateManagers.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.fullName} ({emp.employeeCode})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    {tr('Mô tả', 'Description')}
                  </label>
                  <input
                    type="text"
                    value={deptDesc}
                    onChange={(e) => setDeptDesc(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    {tr('Thứ tự', 'Sort Order')}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={deptSortOrder}
                    onChange={(e) => setDeptSortOrder(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={deptIsActive}
                  onChange={(e) => setDeptIsActive(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300"
                />
                <span>{tr('Đang hoạt động', 'Active')}</span>
              </label>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  disabled={isSavingDept}
                  onClick={() => setIsDeptModalOpen(false)}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
                >
                  {tr('Hủy', 'Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isSavingDept}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {isSavingDept
                    ? tr('Đang lưu...', 'Saving...')
                    : tr('Lưu phòng ban', 'Save Department')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isPosModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">
                {editingPosId
                  ? tr('Cập nhật Chức danh', 'Update Position')
                  : tr('Thêm Chức danh mới', 'Add New Position')}
              </h2>
              <button
                type="button"
                disabled={isSavingPos}
                onClick={() => setIsPosModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <IconX size={18} />
              </button>
            </div>

            <form onSubmit={(e) => void handleSavePosition(e)} className="mt-4 space-y-3.5">
              {posFormError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  {posFormError}
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    {tr('Mã chức danh *', 'Position Code *')}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={tr('VD: BA_LEAD', 'e.g. BA_LEAD')}
                    value={posCode}
                    onChange={(e) => setPosCode(e.target.value.toUpperCase())}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm uppercase"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    {tr('Cấp bậc (1–10) *', 'Level (1–10) *')}
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    max="10"
                    value={posLevel}
                    onChange={(e) => setPosLevel(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  {tr('Tên chức danh *', 'Position Name *')}
                </label>
                <input
                  type="text"
                  required
                  value={posName}
                  onChange={(e) => setPosName(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  {tr('Tên tiếng Anh', 'English Name')}
                </label>
                <input
                  type="text"
                  placeholder="e.g. Senior Specialist"
                  value={posNameEn}
                  onChange={(e) => setPosNameEn(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  {tr('Mô tả', 'Description')}
                </label>
                <input
                  type="text"
                  value={posDesc}
                  onChange={(e) => setPosDesc(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={posIsActive}
                  onChange={(e) => setPosIsActive(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300"
                />
                <span>{tr('Đang hoạt động', 'Active')}</span>
              </label>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  disabled={isSavingPos}
                  onClick={() => setIsPosModalOpen(false)}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
                >
                  {tr('Hủy', 'Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isSavingPos}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {isSavingPos
                    ? tr('Đang lưu...', 'Saving...')
                    : tr('Lưu chức danh', 'Save Position')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        title={
          deleteTarget?.kind === 'department'
            ? tr('Xác nhận xóa mềm phòng ban', 'Confirm Soft Delete Department')
            : tr('Xác nhận xóa mềm chức danh', 'Confirm Soft Delete Position')
        }
        description={tr(
          `Bạn có chắc muốn xóa mềm "${deleteTarget?.label ?? ''}"?`,
          `Are you sure you want to soft-delete "${deleteTarget?.label ?? ''}"?`,
        )}
        confirmLabel={tr('Xóa mềm', 'Soft Delete')}
        isProcessing={isDeleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void handleConfirmDelete()}
      />
    </div>
  );
}
