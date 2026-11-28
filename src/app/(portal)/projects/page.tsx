'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  IconAlertTriangle,
  IconArrowRight,
  IconCheck,
  IconFolder,
  IconLayoutGrid,
  IconList,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconUsers,
} from '@tabler/icons-react';
import { usePortalAuth } from '@/components/portal/PortalAuthContext';
import { SkeletonCardGrid, SkeletonTableRows } from '@/components/ui/Skeleton';
import {
  ProjectFormModal,
  type SimpleDepartmentOption,
  type SimpleEmployeeOption,
} from '@/components/projects/ProjectFormModal';
import {
  pickLabel,
  PROJECT_HEALTH_META,
  PROJECT_METHODOLOGY_META,
  PROJECT_PRIORITY_META,
  PROJECT_STATUS_META,
} from '@/components/projects/project-ui-helpers';
import type { ProjectHealthStatus, ProjectMethodology, ProjectStatus } from '@/config/database';
import { formatVND } from '@/lib/portable/currency-utils';
import { formatDateVN } from '@/lib/portable/date-utils';
import type { ProjectListItem } from '@/modules/projects/projects.service';
import { useI18n } from '@/shared/i18n/I18nContext';

interface ProjectsResponse {
  items: ProjectListItem[];
  summary: { total: number; active: number; atRisk: number; completed: number };
}

export default function ProjectsPortfolioPage() {
  const router = useRouter();
  const { user, selectedBranchId, hasPermission } = usePortalAuth();
  const { locale, tr, ln } = useI18n();
  const trRef = useRef(tr);
  useEffect(() => {
    trRef.current = tr;
  }, [tr]);

  const canCreate = hasPermission('pm.projects.create');

  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [healthFilter, setHealthFilter] = useState<string>('');
  const [methodologyFilter, setMethodologyFilter] = useState<string>('');
  const [onlyMine, setOnlyMine] = useState(false);
  const [includeArchived, setIncludeArchived] = useState(false);

  const [data, setData] = useState<ProjectsResponse>({
    items: [],
    summary: { total: 0, active: 0, atRisk: 0, completed: 0 },
  });
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [departments, setDepartments] = useState<SimpleDepartmentOption[]>([]);
  const [employees, setEmployees] = useState<SimpleEmployeeOption[]>([]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput.trim()), 250);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      setIsLoading(true);
      setErrorMsg(null);
      try {
        const sp = new URLSearchParams({ limit: '60' });
        if (selectedBranchId) sp.set('branchId', String(selectedBranchId));
        if (debouncedSearch) sp.set('search', debouncedSearch);
        if (statusFilter) sp.set('status', statusFilter);
        if (healthFilter) sp.set('healthStatus', healthFilter);
        if (methodologyFilter) sp.set('methodology', methodologyFilter);
        if (onlyMine) sp.set('onlyMine', 'true');
        if (includeArchived) sp.set('includeArchived', 'true');

        const res = await fetch(`/api/v1/projects?${sp.toString()}`, {
          signal: controller.signal,
        });
        const json = (await res.json().catch(() => null)) as {
          success?: boolean;
          data?: ProjectsResponse;
          error?: { message?: string };
        } | null;
        if (!res.ok || !json?.success || !json.data) {
          throw new Error(
            json?.error?.message ??
              trRef.current('Không thể tải danh sách dự án.', 'Unable to load projects portfolio.'),
          );
        }
        setData(json.data);
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setErrorMsg(
          err instanceof Error
            ? err.message
            : trRef.current('Lỗi kết nối máy chủ.', 'Network error.'),
        );
      } finally {
        setIsLoading(false);
      }
    })();
    return () => controller.abort();
  }, [
    debouncedSearch,
    healthFilter,
    includeArchived,
    methodologyFilter,
    onlyMine,
    reloadTick,
    selectedBranchId,
    statusFilter,
  ]);

  useEffect(() => {
    if (!canCreate) return;
    const controller = new AbortController();
    void (async () => {
      try {
        const [deptRes, empRes] = await Promise.all([
          fetch('/api/v1/hrm/org/departments?limit=200', { signal: controller.signal }),
          fetch('/api/v1/hrm/employees?limit=200', { signal: controller.signal }),
        ]);
        const deptJson = (await deptRes.json().catch(() => null)) as {
          data?: { items?: SimpleDepartmentOption[] } | SimpleDepartmentOption[];
        } | null;
        const empJson = (await empRes.json().catch(() => null)) as {
          data?: { items?: Array<{ id: number; fullName: string; employeeCode: string }> } | Array<{ id: number; fullName: string; employeeCode: string }>;
        } | null;

        const deptList = Array.isArray(deptJson?.data)
          ? deptJson.data
          : deptJson?.data?.items ?? [];
        const empList = Array.isArray(empJson?.data)
          ? empJson.data
          : empJson?.data?.items ?? [];

        setDepartments(deptList);
        setEmployees(empList);
      } catch {
        // Non-blocking reference fetch
      }
    })();
    return () => controller.abort();
  }, [canCreate]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {tr('Danh mục Dự án & Công việc', 'Projects & Tasks Portfolio')}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {tr(
              'Quản trị dự án đa phòng ban, bảng Kanban kéo-thả, phân cấp công việc và theo dõi tiến độ.',
              'Manage cross-functional projects, Kanban boards, task hierarchy, and delivery health.',
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/my/tasks"
            className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            {tr('Công việc của tôi', 'My Tasks')}
          </Link>
          <button
            type="button"
            onClick={() => setReloadTick((n) => n + 1)}
            className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50"
            title={tr('Làm mới', 'Refresh')}
          >
            <IconRefresh size={17} />
          </button>
          {canCreate && (
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700"
            >
              <IconPlus size={16} />
              {tr('Tạo dự án mới', 'New Project')}
            </button>
          )}
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>{tr('Tổng dự án', 'Total Projects')}</span>
            <IconFolder size={17} className="text-blue-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">{data.summary.total}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>{tr('Đang triển khai', 'Active')}</span>
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-emerald-700">{data.summary.active}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>{tr('Cảnh báo rủi ro / Trễ', 'At Risk / Off Track')}</span>
            <IconAlertTriangle size={17} className="text-amber-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-amber-700">{data.summary.atRisk}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>{tr('Đã hoàn thành', 'Completed')}</span>
            <IconCheck size={17} className="text-indigo-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-indigo-700">{data.summary.completed}</p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3.5">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
            <IconSearch
              size={15}
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={tr('Tìm mã hoặc tên dự án...', 'Search project code or name...')}
              className="w-full rounded-xl border border-slate-200 py-1.5 pr-3 pl-9 text-xs"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-slate-200 px-2.5 py-1.5 text-xs"
          >
            <option value="">{tr('Tất cả trạng thái', 'All Statuses')}</option>
            {(Object.keys(PROJECT_STATUS_META) as ProjectStatus[]).map((st) => (
              <option key={st} value={st}>
                {pickLabel(PROJECT_STATUS_META[st], locale)}
              </option>
            ))}
          </select>

          <select
            value={healthFilter}
            onChange={(e) => setHealthFilter(e.target.value)}
            className="rounded-xl border border-slate-200 px-2.5 py-1.5 text-xs"
          >
            <option value="">{tr('Mọi sức khỏe RAG', 'All Health')}</option>
            {(Object.keys(PROJECT_HEALTH_META) as ProjectHealthStatus[]).map((h) => (
              <option key={h} value={h}>
                {pickLabel(PROJECT_HEALTH_META[h], locale)}
              </option>
            ))}
          </select>

          <select
            value={methodologyFilter}
            onChange={(e) => setMethodologyFilter(e.target.value)}
            className="rounded-xl border border-slate-200 px-2.5 py-1.5 text-xs"
          >
            <option value="">{tr('Mọi phương pháp', 'All Methodologies')}</option>
            {(Object.keys(PROJECT_METHODOLOGY_META) as ProjectMethodology[]).map((m) => (
              <option key={m} value={m}>
                {pickLabel(PROJECT_METHODOLOGY_META[m], locale)}
              </option>
            ))}
          </select>

          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700">
            <input
              type="checkbox"
              checked={onlyMine}
              onChange={(e) => setOnlyMine(e.target.checked)}
              className="rounded border-slate-300 text-blue-600"
            />
            {tr('Dự án của tôi', 'My Projects')}
          </label>

          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600">
            <input
              type="checkbox"
              checked={includeArchived}
              onChange={(e) => setIncludeArchived(e.target.checked)}
              className="rounded border-slate-300 text-blue-600"
            />
            {tr('Hiện đã lưu trữ', 'Show Archived')}
          </label>
        </div>

        <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            className={`rounded-lg p-1.5 ${viewMode === 'grid' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'}`}
            title={tr('Dạng thẻ', 'Grid view')}
          >
            <IconLayoutGrid size={16} />
          </button>
          <button
            type="button"
            onClick={() => setViewMode('table')}
            className={`rounded-lg p-1.5 ${viewMode === 'table' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'}`}
            title={tr('Dạng bảng', 'Table view')}
          >
            <IconList size={16} />
          </button>
        </div>
      </div>

      {/* States: Loading / Error / Empty / Success */}
      {!isLoading && errorMsg ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center">
          <p className="text-sm font-medium text-rose-700">{errorMsg}</p>
          <button
            type="button"
            onClick={() => setReloadTick((n) => n + 1)}
            className="mt-3 rounded-xl bg-rose-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-rose-700"
          >
            {tr('Thử lại', 'Retry')}
          </button>
        </div>
      ) : !isLoading && data.items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
          <IconFolder size={36} className="mx-auto mb-3 text-slate-300" />
          <h3 className="text-base font-semibold text-slate-800">
            {tr('Chưa có dự án nào phù hợp bộ lọc', 'No projects match your filters')}
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            {tr(
              'Khởi tạo dự án đầu tiên để tổ chức công việc, bảng Kanban và cộng tác cùng đội nhóm.',
              'Create your first project to organize tasks, Kanban boards, and team collaboration.',
            )}
          </p>
          {canCreate && (
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
            >
              <IconPlus size={15} />
              {tr('Tạo dự án đầu tiên', 'Create First Project')}
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        isLoading ? (
          <SkeletonCardGrid
            count={6}
            columnsClass="grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
          />
        ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.items.map((proj) => (
            <Link
              key={proj.id}
              href={`/projects/${proj.code}`}
              className="group flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: proj.colorHex }}
                    />
                    <span className="font-mono text-xs font-bold text-slate-500">{proj.code}</span>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${PROJECT_STATUS_META[proj.status].cls}`}
                    >
                      {pickLabel(PROJECT_STATUS_META[proj.status], locale)}
                    </span>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${PROJECT_HEALTH_META[proj.healthStatus].cls}`}
                  >
                    {pickLabel(PROJECT_HEALTH_META[proj.healthStatus], locale)}
                  </span>
                </div>

                <h3 className="mt-2.5 line-clamp-1 text-base font-bold text-slate-900 group-hover:text-blue-700">
                  {proj.name}
                </h3>
                <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                  {proj.description || tr('Chưa có mô tả dự án.', 'No project description.')}
                </p>

                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">
                      {tr('Tiến độ', 'Progress')} ({proj.completedTaskCount}/{proj.taskCount}{' '}
                      {tr('việc', 'tasks')})
                    </span>
                    <span className="font-bold text-slate-800">{Math.round(proj.progressPercent)}%</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, Math.max(0, proj.progressPercent))}%`,
                        backgroundColor: proj.colorHex,
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center gap-1">
                    <IconUsers size={14} />
                    {proj.memberCount}
                  </span>
                  <span>{pickLabel(PROJECT_METHODOLOGY_META[proj.methodology], locale)}</span>
                  {proj.targetEndDate && <span>{formatDateVN(proj.targetEndDate)}</span>}
                </div>
                <IconArrowRight
                  size={15}
                  className="text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-blue-600"
                />
              </div>
            </Link>
          ))}
        </div>
        )
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">{tr('Dự án', 'Project')}</th>
                  <th className="px-3 py-3">{tr('PM / Chi nhánh', 'PM / Branch')}</th>
                  <th className="px-3 py-3">{tr('Trạng thái', 'Status')}</th>
                  <th className="px-3 py-3">{tr('Ưu tiên & RAG', 'Priority & RAG')}</th>
                  <th className="px-3 py-3">{tr('Tiến độ', 'Progress')}</th>
                  <th className="px-3 py-3">{tr('Ngân sách', 'Budget')}</th>
                  <th className="px-3 py-3">{tr('Hạn đích', 'Target End')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <SkeletonTableRows rows={6} columns={7} />
                ) : (
                  data.items.map((proj) => (
                    <tr
                      key={proj.id}
                      onClick={() => router.push(`/projects/${proj.code}`)}
                      className="cursor-pointer hover:bg-blue-50/40"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: proj.colorHex }}
                          />
                          <span className="font-mono font-bold text-slate-500">{proj.code}</span>
                          <span className="font-semibold text-slate-900">{proj.name}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-slate-600">
                        <div className="font-medium text-slate-800">{proj.managerName}</div>
                        <div className="text-[11px] text-slate-400">
                          {ln(proj.branchName, proj.branchNameEn)}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${PROJECT_STATUS_META[proj.status].cls}`}
                        >
                          {pickLabel(PROJECT_STATUS_META[proj.status], locale)}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${PROJECT_PRIORITY_META[proj.priority].cls}`}
                          >
                            {pickLabel(PROJECT_PRIORITY_META[proj.priority], locale)}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${PROJECT_HEALTH_META[proj.healthStatus].cls}`}
                          >
                            {pickLabel(PROJECT_HEALTH_META[proj.healthStatus], locale)}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-3 font-semibold text-slate-800">
                        {Math.round(proj.progressPercent)}% ({proj.completedTaskCount}/{proj.taskCount})
                      </td>
                      <td className="px-3 py-3 font-medium text-slate-700">
                        {proj.plannedBudget > 0 ? formatVND(proj.plannedBudget) : '—'}
                      </td>
                      <td className="px-3 py-3 text-slate-600">
                        {proj.targetEndDate ? formatDateVN(proj.targetEndDate) : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showCreateModal && (
        <ProjectFormModal
          isOpen={showCreateModal}
          branches={user?.branches ?? []}
          departments={departments}
          employees={employees}
          defaultBranchId={selectedBranchId}
          onClose={() => setShowCreateModal(false)}
          onSaved={(created) => {
            setShowCreateModal(false);
            router.push(`/projects/${created.code}`);
          }}
        />
      )}
    </div>
  );
}
