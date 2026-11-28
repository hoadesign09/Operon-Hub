'use client';

import { use, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  IconAlertTriangle,
  IconArrowLeft,
  IconBolt,
  IconCalendar,
  IconCash,
  IconChartBar,
  IconDownload,
  IconEdit,
  IconFileTypePdf,
  IconFlame,
  IconInfoCircle,
  IconLayoutKanban,
  IconListTree,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconSettings,
  IconShieldExclamation,
  IconUsers,
} from '@tabler/icons-react';
import { usePortalAuth } from '@/components/portal/PortalAuthContext';
import { SkeletonDetailPage } from '@/components/ui/Skeleton';
import { ProjectAutomationPanel } from '@/components/projects/ProjectAutomationPanel';
import { ProjectBudgetRisksPanel } from '@/components/projects/ProjectBudgetRisksPanel';
import { ProjectCalendarView } from '@/components/projects/ProjectCalendarView';
import {
  ProjectFormModal,
  type SimpleDepartmentOption,
  type SimpleEmployeeOption,
} from '@/components/projects/ProjectFormModal';
import { ProjectGanttChart } from '@/components/projects/ProjectGanttChart';
import { ProjectKanbanBoard } from '@/components/projects/ProjectKanbanBoard';
import { ProjectListView } from '@/components/projects/ProjectListView';
import { ProjectMembersPanel } from '@/components/projects/ProjectMembersPanel';
import { ProjectSprintBoard } from '@/components/projects/ProjectSprintBoard';
import { ProjectWorkflowPanel } from '@/components/projects/ProjectWorkflowPanel';
import { TaskDetailDrawer } from '@/components/projects/TaskDetailDrawer';
import { TaskFormModal } from '@/components/projects/TaskFormModal';
import {
  pickLabel,
  PROJECT_HEALTH_META,
  PROJECT_METHODOLOGY_META,
  PROJECT_PRIORITY_META,
  PROJECT_STATUS_META,
  PROJECT_VISIBILITY_META,
  TASK_PRIORITY_META,
} from '@/components/projects/project-ui-helpers';
import type { ProjectStatus, TaskPriority } from '@/config/database';
import { formatVND } from '@/lib/portable/currency-utils';
import { formatDateVN } from '@/lib/portable/date-utils';
import type { ProjectDetailView } from '@/modules/projects/projects.service';
import type { TaskDetailView, TaskListItem } from '@/modules/projects/tasks.service';
import { useI18n } from '@/shared/i18n/I18nContext';

type WorkspaceTab =
  | 'board'
  | 'list'
  | 'sprints'
  | 'gantt'
  | 'calendar'
  | 'budget'
  | 'risks'
  | 'overview'
  | 'members'
  | 'workflow'
  | 'automation';

export default function ProjectWorkspacePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);
  const searchParams = useSearchParams();
  const initialTaskIdParam = searchParams.get('taskId');

  const { user } = usePortalAuth();
  const { locale, tr, ln } = useI18n();
  const trRef = useRef(tr);
  useEffect(() => {
    trRef.current = tr;
  }, [tr]);

  const [project, setProject] = useState<ProjectDetailView | null>(null);
  const [tasks, setTasks] = useState<TaskListItem[]>([]);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('board');
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [bannerMsg, setBannerMsg] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('');

  // Modals & Drawer
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(() =>
    initialTaskIdParam && /^\d+$/.test(initialTaskIdParam) ? Number(initialTaskIdParam) : null,
  );
  const [showEditProjectModal, setShowEditProjectModal] = useState(false);
  const [taskModalConfig, setTaskModalConfig] = useState<{
    isOpen: boolean;
    defaultColumnId?: number;
    parentTaskId?: number | null;
    parentTaskLabel?: string | null;
    defaultDueDate?: string | null;
  }>({ isOpen: false });

  const [departments, setDepartments] = useState<SimpleDepartmentOption[]>([]);
  const [employees, setEmployees] = useState<SimpleEmployeeOption[]>([]);
  const [statusBusy, setStatusBusy] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      setIsLoading(true);
      setErrorMsg(null);
      try {
        const [projRes, tasksRes] = await Promise.all([
          fetch(`/api/v1/projects/${encodeURIComponent(code)}`, { signal: controller.signal }),
          fetch(`/api/v1/tasks?projectCode=${encodeURIComponent(code)}`, {
            signal: controller.signal,
          }),
        ]);
        const projJson = (await projRes.json().catch(() => null)) as {
          success?: boolean;
          data?: ProjectDetailView;
          error?: { message?: string };
        } | null;
        if (!projRes.ok || !projJson?.success || !projJson.data) {
          throw new Error(
            projJson?.error?.message ??
              trRef.current('Không thể tải thông tin dự án.', 'Unable to load project workspace.'),
          );
        }
        const tasksJson = (await tasksRes.json().catch(() => null)) as {
          success?: boolean;
          data?: TaskListItem[];
        } | null;

        setProject(projJson.data);
        setTasks(tasksJson?.data ?? []);
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
  }, [code, reloadTick]);

  useEffect(() => {
    if (!project?.canManageMembers && !project?.canEditProject) return;
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
          data?: { items?: SimpleEmployeeOption[] } | SimpleEmployeeOption[];
        } | null;
        setDepartments(Array.isArray(deptJson?.data) ? deptJson.data : deptJson?.data?.items ?? []);
        setEmployees(Array.isArray(empJson?.data) ? empJson.data : empJson?.data?.items ?? []);
      } catch {
        // Non-blocking
      }
    })();
    return () => controller.abort();
  }, [project?.canEditProject, project?.canManageMembers]);

  async function refreshTasksOnly() {
    if (!project) return;
    const [projRes, tasksRes] = await Promise.all([
      fetch(`/api/v1/projects/${project.id}`),
      fetch(`/api/v1/tasks?projectId=${project.id}`),
    ]);
    const projJson = (await projRes.json().catch(() => null)) as { data?: ProjectDetailView } | null;
    const tasksJson = (await tasksRes.json().catch(() => null)) as { data?: TaskListItem[] } | null;
    if (projJson?.data) setProject(projJson.data);
    if (tasksJson?.data) setTasks(tasksJson.data);
  }

  async function handleTransitionStatus(targetStatus: ProjectStatus) {
    if (!project || statusBusy) return;
    setStatusBusy(true);
    setBannerMsg(null);
    try {
      const res = await fetch(`/api/v1/projects/${project.id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetStatus }),
      });
      const json = (await res.json().catch(() => null)) as {
        success?: boolean;
        data?: ProjectDetailView;
        error?: { message?: string };
      } | null;
      if (!res.ok || !json?.success || !json.data) {
        throw new Error(
          json?.error?.message ??
            tr('Không thể chuyển trạng thái dự án.', 'Unable to change project status.'),
        );
      }
      setProject(json.data);
      setBannerMsg(
        targetStatus === 'PENDING_APPROVAL'
          ? tr(
              'Đã gửi hồ sơ dự án sang Hộp thư Phê duyệt (Core Approval Engine).',
              'Project Charter submitted to the Core Approval Inbox.',
            )
          : tr('Đã cập nhật trạng thái dự án.', 'Project status updated.'),
      );
    } catch (err: unknown) {
      setBannerMsg(err instanceof Error ? err.message : tr('Lỗi kết nối.', 'Network error.'));
    } finally {
      setStatusBusy(false);
    }
  }

  async function handleMoveTask(params: {
    taskId: number;
    targetColumnId: number;
    prevRank: string | null;
    nextRank: string | null;
    expectedVersion: number;
  }) {
    setBannerMsg(null);
    const res = await fetch(`/api/v1/tasks/${params.taskId}/move`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetColumnId: params.targetColumnId,
        prevRank: params.prevRank,
        nextRank: params.nextRank,
        expectedVersion: params.expectedVersion,
      }),
    });
    const json = (await res.json().catch(() => null)) as {
      success?: boolean;
      data?: { wipLimitExceeded?: boolean; wipLimit?: number | null };
      error?: { message?: string };
    } | null;
    if (!res.ok || !json?.success) {
      setBannerMsg(
        json?.error?.message ?? tr('Không thể di chuyển công việc.', 'Failed to move task.'),
      );
    } else if (json.data?.wipLimitExceeded) {
      setBannerMsg(
        tr(
          `Cảnh báo: Cột đích đã vượt giới hạn WIP (${json.data.wipLimit} thẻ).`,
          `Warning: Target column exceeded its WIP limit (${json.data.wipLimit} cards).`,
        ),
      );
    }
    await refreshTasksOnly();
  }

  async function handleQuickColumnChange(task: TaskListItem, nextColumnId: number) {
    await handleMoveTask({
      taskId: task.id,
      targetColumnId: nextColumnId,
      prevRank: null,
      nextRank: null,
      expectedVersion: task.version,
    });
  }

  const filteredTasks = tasks.filter((t) => {
    if (searchTerm.trim()) {
      const kw = searchTerm.trim().toLowerCase();
      if (!t.taskKey.toLowerCase().includes(kw) && !t.title.toLowerCase().includes(kw)) {
        return false;
      }
    }
    if (priorityFilter && t.priority !== priorityFilter) return false;
    if (assigneeFilter) {
      const empId = Number(assigneeFilter);
      if (!t.assignees.some((a) => a.employeeId === empId)) return false;
    }
    return true;
  });

  if (isLoading) {
    return <SkeletonDetailPage showTabs showBottomWorkflow={false} />;
  }

  if (errorMsg || !project) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center">
        <p className="text-sm font-semibold text-rose-700">
          {errorMsg ?? tr('Không tìm thấy dự án.', 'Project not found.')}
        </p>
        <div className="mt-4 flex justify-center gap-2">
          <Link
            href="/projects"
            className="rounded-xl border border-slate-300 bg-white px-4 py-1.5 text-xs font-semibold text-slate-700"
          >
            {tr('Quay lại Danh mục Dự án', 'Back to Portfolio')}
          </Link>
          <button
            type="button"
            onClick={() => setReloadTick((n) => n + 1)}
            className="rounded-xl bg-rose-600 px-4 py-1.5 text-xs font-semibold text-white"
          >
            {tr('Thử lại', 'Retry')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Top Project Header */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/projects"
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              >
                <IconArrowLeft size={14} />
                {tr('Danh mục', 'Portfolio')}
              </Link>
              <span
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: project.colorHex }}
              />
              <span className="font-mono text-xs font-bold text-slate-600">{project.code}</span>
              <span
                className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${PROJECT_STATUS_META[project.status].cls}`}
              >
                {pickLabel(PROJECT_STATUS_META[project.status], locale)}
              </span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${PROJECT_HEALTH_META[project.healthStatus].cls}`}
              >
                {pickLabel(PROJECT_HEALTH_META[project.healthStatus], locale)}
              </span>
            </div>
            <h1 className="mt-2 text-xl font-bold text-slate-900">{project.name}</h1>
            <p className="mt-1 text-xs text-slate-500">
              {ln(project.branchName, project.branchNameEn)}
              {project.departmentName
                ? ` • ${ln(project.departmentName, project.departmentNameEn)}`
                : ''}{' '}
              • PM:{' '}
              <strong className="text-slate-700">{project.managerName}</strong> •{' '}
              {Math.round(project.progressPercent)}% ({project.completedTaskCount}/
              {project.taskCount} {tr('công việc', 'tasks')})
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {project.canEditProject && project.status === 'DRAFT' && (
              <>
                <button
                  type="button"
                  disabled={statusBusy}
                  onClick={() => handleTransitionStatus('PENDING_APPROVAL')}
                  className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                >
                  {tr('Trình duyệt Charter', 'Submit Charter')}
                </button>
                <button
                  type="button"
                  disabled={statusBusy}
                  onClick={() => handleTransitionStatus('ACTIVE')}
                  className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {tr('Kích hoạt ngay', 'Activate')}
                </button>
              </>
            )}
            {project.canEditProject && project.status === 'PLANNING' && (
              <button
                type="button"
                disabled={statusBusy}
                onClick={() => handleTransitionStatus('ACTIVE')}
                className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {tr('Bắt đầu triển khai', 'Start Active')}
              </button>
            )}
            {project.canEditProject && project.status === 'ACTIVE' && (
              <button
                type="button"
                disabled={statusBusy}
                onClick={() => handleTransitionStatus('COMPLETED')}
                className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
              >
                {tr('Hoàn tất dự án', 'Mark Completed')}
              </button>
            )}
            {project.canEditProject && (
              <button
                type="button"
                onClick={() => setShowEditProjectModal(true)}
                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <IconEdit size={14} />
                {tr('Sửa dự án', 'Edit')}
              </button>
            )}
            {project.canCreateTasks && (
              <button
                type="button"
                onClick={() => setTaskModalConfig({ isOpen: true })}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
              >
                <IconPlus size={15} />
                {tr('Tạo công việc', 'New Task')}
              </button>
            )}
            <a
              href={`/api/v1/pm/reports/tasks/export?projectId=${project.id}`}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              title={tr('Xuất danh sách Task (Excel)', 'Export Tasks (Excel)')}
            >
              <IconDownload size={14} />
              Excel
            </a>
            <a
              href={`/api/v1/projects/${project.id}/status-report/pdf`}
              className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
              title={tr('Xuất Báo cáo Tình hình Dự án (PDF A4)', 'Export Project Status PDF')}
            >
              <IconFileTypePdf size={14} />
              PDF
            </a>
            <button
              type="button"
              onClick={() => void refreshTasksOnly()}
              className="rounded-xl border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50"
              title={tr('Làm mới', 'Refresh')}
            >
              <IconRefresh size={16} />
            </button>
          </div>
        </div>

        {bannerMsg && (
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2 text-xs font-medium text-amber-800">
            <IconAlertTriangle size={15} />
            <span>{bannerMsg}</span>
          </div>
        )}

        {/* Workspace Tabs */}
        <div className="mt-4 flex flex-wrap items-center gap-1 border-t border-slate-100 pt-3">
          {(
            [
              { id: 'board', label: tr('Kanban Board', 'Kanban Board'), icon: IconLayoutKanban },
              { id: 'list', label: tr('Danh sách', 'List View'), icon: IconListTree },
              { id: 'sprints', label: tr('Backlog & Sprints', 'Sprints'), icon: IconFlame },
              { id: 'gantt', label: tr('Gantt & CPM', 'Gantt Timeline'), icon: IconChartBar },
              { id: 'calendar', label: tr('Lịch biểu', 'Calendar'), icon: IconCalendar },
              { id: 'budget', label: tr('Ngân sách', 'Budget'), icon: IconCash },
              { id: 'risks', label: tr('Rủi ro (RAID)', 'Risks (RAID)'), icon: IconShieldExclamation },
              { id: 'overview', label: tr('Tổng quan', 'Overview'), icon: IconInfoCircle },
              { id: 'members', label: `${tr('Thành viên', 'Members')} (${project.members.length})`, icon: IconUsers },
              { id: 'workflow', label: tr('Cột & Nhãn', 'Workflow'), icon: IconSettings },
              { id: 'automation', label: tr('Tự động & Mẫu', 'Automation'), icon: IconBolt },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                  active
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon size={15} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Filter bar for task views */}
      {(activeTab === 'board' || activeTab === 'list' || activeTab === 'calendar') && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5">
          <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
            <IconSearch
              size={14}
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={tr('Lọc theo mã hoặc tiêu đề task...', 'Filter by task key or title...')}
              className="w-full rounded-xl border border-slate-200 py-1.5 pr-3 pl-8 text-xs"
            />
          </div>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="rounded-xl border border-slate-200 px-2.5 py-1.5 text-xs"
          >
            <option value="">{tr('Mọi độ ưu tiên', 'All Priorities')}</option>
            {(Object.keys(TASK_PRIORITY_META) as TaskPriority[]).map((p) => (
              <option key={p} value={p}>
                {pickLabel(TASK_PRIORITY_META[p], locale)}
              </option>
            ))}
          </select>
          <select
            value={assigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value)}
            className="rounded-xl border border-slate-200 px-2.5 py-1.5 text-xs"
          >
            <option value="">{tr('Tất cả thành viên', 'All Assignees')}</option>
            {project.members.map((m) => (
              <option key={m.employeeId} value={m.employeeId}>
                {m.fullName}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Active Tab Content */}
      {activeTab === 'board' && (
        <ProjectKanbanBoard
          columns={project.columns}
          tasks={filteredTasks}
          canEditTasks={project.canEditTasks}
          onSelectTask={(tid) => setSelectedTaskId(tid)}
          onAddTaskInColumn={(colId) =>
            setTaskModalConfig({ isOpen: true, defaultColumnId: colId })
          }
          onMoveTask={handleMoveTask}
        />
      )}

      {activeTab === 'list' && (
        <ProjectListView
          columns={project.columns}
          tasks={filteredTasks}
          canEditTasks={project.canEditTasks}
          onSelectTask={(tid) => setSelectedTaskId(tid)}
          onQuickColumnChange={handleQuickColumnChange}
          onCreateTask={() => setTaskModalConfig({ isOpen: true })}
        />
      )}

      {activeTab === 'sprints' && (
        <ProjectSprintBoard
          projectId={project.id}
          tasks={tasks}
          canManageSprints={project.canEditTasks}
          onSelectTask={(tid) => setSelectedTaskId(tid)}
          onTasksChanged={() => void refreshTasksOnly()}
        />
      )}

      {activeTab === 'gantt' && (
        <ProjectGanttChart
          projectId={project.id}
          canManage={project.canEditProject}
          canEditTasks={project.canEditTasks}
          onSelectTask={(tid) => setSelectedTaskId(tid)}
        />
      )}

      {activeTab === 'budget' && (
        <ProjectBudgetRisksPanel
          projectId={project.id}
          mode="budget"
          canViewBudget={project.canViewBudget}
          canManage={project.canEditProject}
          canEditTasks={project.canEditTasks}
          onSelectTask={(tid) => setSelectedTaskId(tid)}
        />
      )}

      {activeTab === 'risks' && (
        <ProjectBudgetRisksPanel
          projectId={project.id}
          mode="risks"
          canViewBudget={project.canViewBudget}
          canManage={project.canEditProject}
          canEditTasks={project.canEditTasks}
          onSelectTask={(tid) => setSelectedTaskId(tid)}
        />
      )}

      {activeTab === 'automation' && (
        <ProjectAutomationPanel
          projectId={project.id}
          projectCode={project.code}
          tasks={tasks}
          canManage={project.canEditProject}
        />
      )}

      {activeTab === 'calendar' && (
        <ProjectCalendarView
          tasks={filteredTasks}
          canEditTasks={project.canEditTasks}
          onSelectTask={(tid) => setSelectedTaskId(tid)}
          onCreateTaskOnDate={(iso) =>
            setTaskModalConfig({ isOpen: true, defaultDueDate: iso })
          }
        />
      )}

      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-8">
            <h3 className="text-sm font-bold text-slate-900">
              {tr('Hồ sơ Dự án (Project Charter)', 'Project Charter & Scope')}
            </h3>
            <p className="whitespace-pre-wrap text-sm text-slate-600">
              {project.description || tr('Chưa có mô tả chi tiết cho dự án này.', 'No charter description yet.')}
            </p>
            <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 text-xs sm:grid-cols-3">
              <div>
                <span className="text-slate-400">{tr('Chủ dự án (Sponsor)', 'Sponsor / Owner')}</span>
                <p className="mt-1 font-semibold text-slate-900">{project.ownerName}</p>
              </div>
              <div>
                <span className="text-slate-400">{tr('Quản lý dự án (PM)', 'Project Manager')}</span>
                <p className="mt-1 font-semibold text-slate-900">{project.managerName}</p>
              </div>
              <div>
                <span className="text-slate-400">{tr('Phương pháp', 'Methodology')}</span>
                <p className="mt-1 font-semibold text-slate-900">
                  {pickLabel(PROJECT_METHODOLOGY_META[project.methodology], locale)}
                </p>
              </div>
              <div>
                <span className="text-slate-400">{tr('Phạm vi hiển thị', 'Visibility')}</span>
                <p className="mt-1 font-semibold text-slate-900">
                  {pickLabel(PROJECT_VISIBILITY_META[project.visibility], locale)}
                </p>
              </div>
              <div>
                <span className="text-slate-400">{tr('Mức ưu tiên', 'Priority')}</span>
                <p className="mt-1 font-semibold text-slate-900">
                  {pickLabel(PROJECT_PRIORITY_META[project.priority], locale)}
                </p>
              </div>
              <div>
                <span className="text-slate-400">{tr('Khung thời gian', 'Timeline')}</span>
                <p className="mt-1 font-semibold text-slate-900">
                  {project.startDate ? formatDateVN(project.startDate) : '—'} →{' '}
                  {project.targetEndDate ? formatDateVN(project.targetEndDate) : '—'}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-4">
            <h3 className="text-sm font-bold text-slate-900">
              {tr('Tóm tắt Vận hành & Ngân sách', 'Delivery & Budget Snapshot')}
            </h3>
            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">{tr('Tiến độ hoàn thành', 'Overall Progress')}</span>
                <span className="font-bold text-blue-700">{Math.round(project.progressPercent)}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-blue-600"
                  style={{ width: `${Math.min(100, Math.max(0, project.progressPercent))}%` }}
                />
              </div>
              {project.canViewBudget && (
                <>
                  <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                    <span className="text-slate-500">{tr('Ngân sách dự kiến', 'Planned Budget')}</span>
                    <span className="font-bold text-slate-900">
                      {formatVND(project.plannedBudget)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">{tr('Chi phí thực tế', 'Actual Cost')}</span>
                    <span className="font-semibold text-slate-700">
                      {formatVND(project.actualCost)}
                    </span>
                  </div>
                </>
              )}
              {project.approvalRequestId && (
                <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-blue-800">
                  {tr('Yêu cầu duyệt Charter #', 'Charter Approval #')}
                  {project.approvalRequestId}: <strong>{project.approvalStatus ?? 'PENDING'}</strong>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'members' && (
        <ProjectMembersPanel
          projectId={project.id}
          members={project.members}
          employees={employees}
          canManage={project.canManageMembers}
          canViewBudget={project.canViewBudget}
          onMembersChanged={(nextMembers) => setProject({ ...project, members: nextMembers, memberCount: nextMembers.length })}
        />
      )}

      {activeTab === 'workflow' && (
        <ProjectWorkflowPanel
          projectId={project.id}
          columns={project.columns}
          labels={project.labels}
          canManage={project.canManageWorkflow}
          onColumnsChanged={(nextCols) => setProject({ ...project, columns: nextCols })}
          onLabelsChanged={(nextLabels) => setProject({ ...project, labels: nextLabels })}
        />
      )}

      {/* Drawers & Modals */}
      <TaskDetailDrawer
        taskId={selectedTaskId}
        columns={project.columns}
        members={project.members}
        labels={project.labels}
        allProjectTasks={tasks}
        onClose={() => setSelectedTaskId(null)}
        onTaskUpdated={() => void refreshTasksOnly()}
        onSelectTask={(nextId) => setSelectedTaskId(nextId)}
        onRequestCreateSubtask={(parentTask: TaskDetailView) =>
          setTaskModalConfig({
            isOpen: true,
            defaultColumnId: parentTask.columnId,
            parentTaskId: parentTask.id,
            parentTaskLabel: `${parentTask.taskKey} — ${parentTask.title}`,
          })
        }
      />

      {taskModalConfig.isOpen && (
        <TaskFormModal
          isOpen={taskModalConfig.isOpen}
          projectId={project.id}
          columns={project.columns}
          members={project.members}
          labels={project.labels}
          defaultColumnId={taskModalConfig.defaultColumnId}
          parentTaskId={taskModalConfig.parentTaskId}
          parentTaskLabel={taskModalConfig.parentTaskLabel}
          defaultDueDate={taskModalConfig.defaultDueDate}
          onClose={() => setTaskModalConfig({ isOpen: false })}
          onCreated={(createdTask) => {
            setTaskModalConfig({ isOpen: false });
            void refreshTasksOnly();
            setSelectedTaskId(createdTask.id);
          }}
        />
      )}

      {showEditProjectModal && (
        <ProjectFormModal
          isOpen={showEditProjectModal}
          editingProject={project}
          branches={user?.branches ?? []}
          departments={departments}
          employees={employees}
          onClose={() => setShowEditProjectModal(false)}
          onSaved={(updated) => {
            setProject(updated);
            setShowEditProjectModal(false);
          }}
        />
      )}
    </div>
  );
}
