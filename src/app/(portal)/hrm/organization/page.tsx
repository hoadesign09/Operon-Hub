'use client';

import { useEffect, useState, type FormEvent } from 'react';
import {
  IconBriefcase,
  IconEdit,
  IconHierarchy2,
  IconInbox,
  IconListDetails,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconTrash,
  IconX,
} from '@tabler/icons-react';
import {
  OrgChartTree,
  type BranchOrgTreeData,
  type OrgDepartmentNode,
} from '@/components/hrm/OrgChartTree';
import { usePortalAuth } from '@/components/portal/PortalAuthContext';
import { ConfirmModal } from '@/components/ui/ConfirmModal';

interface DepartmentRow {
  id: number;
  branchId: number;
  branchCode: string;
  branchName: string;
  parentId: number | null;
  parentName: string | null;
  code: string;
  name: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
}

interface PositionRow {
  id: number;
  code: string;
  name: string;
  level: number;
  description: string | null;
  isActive: boolean;
}

type OrgTab = 'tree' | 'departments' | 'positions';

export default function HrmOrganizationPage() {
  const { user, selectedBranchId, hasPermission } = usePortalAuth();
  const canManage = hasPermission('hrm.org.manage');

  const [activeTab, setActiveTab] = useState<OrgTab>('tree');
  const [viewState, setViewState] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [reloadTick, setReloadTick] = useState(0);

  const [orgTree, setOrgTree] = useState<BranchOrgTreeData[]>([]);
  const [departments, setDepartments] = useState<DepartmentRow[]>([]);
  const [positions, setPositions] = useState<PositionRow[]>([]);

  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Department modal state
  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  const [editingDeptId, setEditingDeptId] = useState<number | null>(null);
  const [deptBranchId, setDeptBranchId] = useState('');
  const [deptParentId, setDeptParentId] = useState('');
  const [deptCode, setDeptCode] = useState('');
  const [deptName, setDeptName] = useState('');
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

    Promise.all([
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
    ])
      .then(async ([treeRes, deptRes, posRes]) => {
        if (controller.signal.aborted) {
          return;
        }
        const [treeJson, deptJson, posJson] = await Promise.all([
          treeRes.json().catch(() => null),
          deptRes.json().catch(() => null),
          posRes.json().catch(() => null),
        ]);

        if (!treeRes.ok || !treeJson?.success) {
          setErrorMessage(treeJson?.error?.message ?? 'Không thể tải dữ liệu cơ cấu tổ chức.');
          setViewState('error');
          return;
        }

        setOrgTree((treeJson.data ?? []) as BranchOrgTreeData[]);
        setDepartments((deptJson?.data ?? []) as DepartmentRow[]);
        setPositions((posJson?.data ?? []) as PositionRow[]);
        setErrorMessage('');
        setViewState('success');
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }
        setErrorMessage('Lỗi kết nối khi tải cơ cấu tổ chức.');
        setViewState('error');
      });

    return () => controller.abort();
  }, [selectedBranchId, debouncedSearch, reloadTick]);

  function triggerReload() {
    setViewState('loading');
    setReloadTick((t) => t + 1);
  }

  function openCreateDepartment(prefillBranchId?: number, prefillParentId?: number) {
    const defaultBranch = prefillBranchId ?? selectedBranchId ?? user?.branches[0]?.id ?? '';
    setEditingDeptId(null);
    setDeptBranchId(String(defaultBranch));
    setDeptParentId(prefillParentId ? String(prefillParentId) : '');
    setDeptCode('');
    setDeptName('');
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
    setDeptCode(dept.code);
    setDeptName(dept.name);
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
          code: deptCode.trim().toUpperCase(),
          name: deptName.trim(),
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
        setDeptFormError(json?.error?.message ?? 'Không thể lưu phòng ban.');
        return;
      }

      setIsDeptModalOpen(false);
      triggerReload();
    } catch {
      setDeptFormError('Lỗi kết nối khi lưu phòng ban.');
    } finally {
      setIsSavingDept(false);
    }
  }

  function openCreatePosition() {
    setEditingPosId(null);
    setPosCode('');
    setPosName('');
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
        setPosFormError(json?.error?.message ?? 'Không thể lưu chức danh.');
        return;
      }

      setIsPosModalOpen(false);
      triggerReload();
    } catch {
      setPosFormError('Lỗi kết nối khi lưu chức danh.');
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
        setErrorMessage(json?.error?.message ?? 'Không thể xóa mục đã chọn.');
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

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Cơ cấu Tổ chức (HRM)</h1>
          <p className="text-sm text-slate-500">
            Quản lý Sơ đồ Tổ chức, cây Phòng ban đa cấp theo Chi nhánh và Danh mục Chức danh.
          </p>
        </div>

        {canManage && (
          <div className="flex flex-wrap gap-2">
            {activeTab === 'positions' ? (
              <button
                type="button"
                onClick={openCreatePosition}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
              >
                <IconPlus size={17} />
                <span>Thêm chức danh</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => openCreateDepartment()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
              >
                <IconPlus size={17} />
                <span>Thêm phòng ban</span>
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab('tree')}
          className={`inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium ${
            activeTab === 'tree'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <IconHierarchy2 size={17} />
          <span>Sơ đồ Tổ chức (Org Chart)</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('departments')}
          className={`inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium ${
            activeTab === 'departments'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <IconListDetails size={17} />
          <span>Phòng ban ({departments.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('positions')}
          className={`inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium ${
            activeTab === 'positions'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <IconBriefcase size={17} />
          <span>Chức danh ({positions.length})</span>
        </button>
      </div>

      {activeTab !== 'tree' && (
        <div className="relative rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <IconSearch
            size={16}
            className="pointer-events-none absolute left-7 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            placeholder={
              activeTab === 'departments'
                ? 'Tìm theo mã hoặc tên phòng ban...'
                : 'Tìm theo mã hoặc tên chức danh...'
            }
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full rounded-xl border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-500"
          />
        </div>
      )}

      {viewState === 'loading' && (
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl bg-slate-100" />
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
            <span>Thử lại</span>
          </button>
        </div>
      )}

      {viewState === 'success' && activeTab === 'tree' && (
        orgTree.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white py-14 text-center">
            <IconInbox size={34} className="text-slate-400" />
            <p className="mt-2 text-sm font-semibold text-slate-800">Chưa có dữ liệu sơ đồ tổ chức</p>
          </div>
        ) : (
          <OrgChartTree
            branches={orgTree}
            canManage={canManage}
            onAddRoot={(branchId) => openCreateDepartment(branchId)}
            onAddChild={(branchId, parentId) => openCreateDepartment(branchId, parentId)}
            onEdit={(node) => openEditDepartment(node)}
          />
        )
      )}

      {viewState === 'success' && activeTab === 'departments' && (
        departments.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white py-14 text-center">
            <IconInbox size={34} className="text-slate-400" />
            <p className="mt-2 text-sm font-semibold text-slate-800">Không có phòng ban phù hợp</p>
            {canManage && (
              <button
                type="button"
                onClick={() => openCreateDepartment()}
                className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-medium text-white"
              >
                <IconPlus size={15} />
                <span>Thêm phòng ban</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Mã</th>
                    <th className="px-4 py-3">Tên phòng ban</th>
                    <th className="px-4 py-3">Chi nhánh</th>
                    <th className="px-4 py-3">Trực thuộc</th>
                    <th className="px-4 py-3">Trạng thái</th>
                    <th className="px-4 py-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {departments.map((d) => (
                    <tr key={d.id} className="hover:bg-slate-50/70">
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs font-semibold text-slate-800">
                        {d.code}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{d.name}</div>
                        {d.description && (
                          <div className="text-xs text-slate-500">{d.description}</div>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-700">
                        {d.branchName} ({d.branchCode})
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600">
                        {d.parentName ?? 'Cấp gốc'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            d.isActive
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {d.isActive ? 'Hoạt động' : 'Tạm ngưng'}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        {canManage && (
                          <div className="inline-flex gap-1.5">
                            <button
                              type="button"
                              onClick={() => openEditDepartment(d)}
                              className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 hover:text-blue-600"
                              title="Chỉnh sửa"
                            >
                              <IconEdit size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setDeleteTarget({
                                  kind: 'department',
                                  id: d.id,
                                  label: `${d.name} (${d.code})`,
                                })
                              }
                              className="rounded-lg p-1.5 text-slate-600 hover:bg-rose-50 hover:text-rose-600"
                              title="Xóa mềm"
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
            <p className="mt-2 text-sm font-semibold text-slate-800">Không có chức danh phù hợp</p>
            {canManage && (
              <button
                type="button"
                onClick={openCreatePosition}
                className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-medium text-white"
              >
                <IconPlus size={15} />
                <span>Thêm chức danh</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Mã</th>
                    <th className="px-4 py-3">Tên chức danh</th>
                    <th className="px-4 py-3">Cấp bậc (Level)</th>
                    <th className="px-4 py-3">Trạng thái</th>
                    <th className="px-4 py-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {positions.map((pos) => (
                    <tr key={pos.id} className="hover:bg-slate-50/70">
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs font-semibold text-slate-800">
                        {pos.code}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{pos.name}</div>
                        {pos.description && (
                          <div className="text-xs text-slate-500">{pos.description}</div>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className="rounded-md bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                          Level {pos.level}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            pos.isActive
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {pos.isActive ? 'Hoạt động' : 'Tạm ngưng'}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        {canManage && (
                          <div className="inline-flex gap-1.5">
                            <button
                              type="button"
                              onClick={() => openEditPosition(pos)}
                              className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 hover:text-blue-600"
                              title="Chỉnh sửa"
                            >
                              <IconEdit size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setDeleteTarget({
                                  kind: 'position',
                                  id: pos.id,
                                  label: `${pos.name} (${pos.code})`,
                                })
                              }
                              className="rounded-lg p-1.5 text-slate-600 hover:bg-rose-50 hover:text-rose-600"
                              title="Xóa mềm"
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
                {editingDeptId ? 'Cập nhật Phòng ban' : 'Thêm Phòng ban mới'}
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
                  <label className="mb-1 block text-xs font-medium text-slate-700">Chi nhánh *</label>
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
                        {b.name} ({b.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    Phòng ban cha
                  </label>
                  <select
                    value={deptParentId}
                    onChange={(e) => setDeptParentId(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="">-- Không (Cấp gốc) --</option>
                    {candidateParentDepts.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    Mã phòng ban *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="VD: SALES-HN"
                    value={deptCode}
                    onChange={(e) => setDeptCode(e.target.value.toUpperCase())}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm uppercase"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    Tên phòng ban *
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

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-slate-700">Mô tả</label>
                  <input
                    type="text"
                    value={deptDesc}
                    onChange={(e) => setDeptDesc(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">Thứ tự</label>
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
                <span>Đang hoạt động</span>
              </label>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  disabled={isSavingDept}
                  onClick={() => setIsDeptModalOpen(false)}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSavingDept}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {isSavingDept ? 'Đang lưu...' : 'Lưu phòng ban'}
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
                {editingPosId ? 'Cập nhật Chức danh' : 'Thêm Chức danh mới'}
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
                    Mã chức danh *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="VD: BA_LEAD"
                    value={posCode}
                    onChange={(e) => setPosCode(e.target.value.toUpperCase())}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm uppercase"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    Cấp bậc (1–10) *
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
                  Tên chức danh *
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
                <label className="mb-1 block text-xs font-medium text-slate-700">Mô tả</label>
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
                <span>Đang hoạt động</span>
              </label>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  disabled={isSavingPos}
                  onClick={() => setIsPosModalOpen(false)}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSavingPos}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {isSavingPos ? 'Đang lưu...' : 'Lưu chức danh'}
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
            ? 'Xác nhận xóa mềm phòng ban'
            : 'Xác nhận xóa mềm chức danh'
        }
        description={`Bạn có chắc muốn xóa mềm "${deleteTarget?.label ?? ''}"?`}
        confirmLabel="Xóa mềm"
        isProcessing={isDeleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void handleConfirmDelete()}
      />
    </div>
  );
}
