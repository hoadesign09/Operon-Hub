'use client';

import { useEffect, useRef, useState } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  IconCheck,
  IconFlame,
  IconPlayerPlay,
  IconPlus,
} from '@tabler/icons-react';
import { SkeletonKanbanBoard } from '@/components/ui/Skeleton';
import type { ProjectSprintView, SprintAnalyticsView } from '@/modules/projects/sprints.service';
import type { TaskListItem } from '@/modules/projects/tasks.service';
import { useI18n } from '@/shared/i18n/I18nContext';
import { formatDateVN } from '@/lib/portable/date-utils';

interface ProjectSprintBoardProps {
  projectId: number;
  tasks: TaskListItem[];
  canManageSprints: boolean;
  onSelectTask: (taskId: number) => void;
  onTasksChanged: () => void;
}

export function ProjectSprintBoard({
  projectId,
  tasks,
  canManageSprints,
  onSelectTask,
  onTasksChanged,
}: ProjectSprintBoardProps) {
  const { tr } = useI18n();
  const trRef = useRef(tr);
  useEffect(() => {
    trRef.current = tr;
  }, [tr]);

  const [sprints, setSprints] = useState<ProjectSprintView[]>([]);
  const [selectedSprintId, setSelectedSprintId] = useState<number | null>(null);
  const [analytics, setAnalytics] = useState<SprintAnalyticsView | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Create Sprint Form
  const [newName, setNewName] = useState('');
  const [newGoal, setNewGoal] = useState('');
  const [newStart, setNewStart] = useState('');
  const [newEnd, setNewEnd] = useState('');

  // Complete modal state
  const [completingSprint, setCompletingSprint] = useState<ProjectSprintView | null>(null);
  const [carryoverAction, setCarryoverAction] = useState<'BACKLOG' | 'NEXT_SPRINT'>('BACKLOG');
  const [targetSprintId, setTargetSprintId] = useState<string>('');
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const res = await fetch(`/api/v1/projects/${projectId}/sprints`, {
          signal: controller.signal,
        });
        const json = (await res.json().catch(() => null)) as {
          success?: boolean;
          data?: ProjectSprintView[];
        } | null;
        const list = json?.data ?? [];
        setSprints(list);
        setSelectedSprintId((prev) => {
          if (prev && list.some((s) => s.id === prev)) return prev;
          const active = list.find((s) => s.status === 'ACTIVE');
          return active?.id ?? list[0]?.id ?? null;
        });
      } catch {
        // Ignore abort
      } finally {
        setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [projectId, reloadTick]);

  function loadSprints() {
    setReloadTick((n) => n + 1);
  }

  useEffect(() => {
    if (!selectedSprintId) {
      return;
    }
    const controller = new AbortController();
    void (async () => {
      try {
        const res = await fetch(
          `/api/v1/projects/${projectId}/sprints/${selectedSprintId}/burndown`,
          { signal: controller.signal },
        );
        const json = (await res.json().catch(() => null)) as {
          success?: boolean;
          data?: SprintAnalyticsView;
        } | null;
        if (json?.success && json.data) {
          setAnalytics(json.data);
        }
      } catch {
        // Ignore abort
      }
    })();
    return () => controller.abort();
  }, [projectId, selectedSprintId, sprints]);

  async function handleCreateSprint(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim() || busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/sprints`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          goal: newGoal.trim() || null,
          startDate: newStart || null,
          endDate: newEnd || null,
        }),
      });
      const json = (await res.json().catch(() => null)) as {
        success?: boolean;
        error?: { message?: string };
      } | null;
      if (!res.ok || !json?.success) {
        throw new Error(json?.error?.message ?? tr('Không thể tạo Sprint.', 'Failed to create sprint.'));
      }
      setNewName('');
      setNewGoal('');
      setNewStart('');
      setNewEnd('');
      await loadSprints();
    } catch (err: unknown) {
      setMsg(err instanceof Error ? err.message : tr('Lỗi kết nối.', 'Network error.'));
    } finally {
      setBusy(false);
    }
  }

  async function handleStartSprint(sprintId: number) {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/sprints/${sprintId}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const json = (await res.json().catch(() => null)) as {
        success?: boolean;
        error?: { message?: string };
      } | null;
      if (!res.ok || !json?.success) {
        throw new Error(json?.error?.message ?? tr('Không thể bắt đầu Sprint.', 'Unable to start sprint.'));
      }
      setMsg(tr('Đã kích hoạt Sprint thành công.', 'Sprint started successfully.'));
      await loadSprints();
    } catch (err: unknown) {
      setMsg(err instanceof Error ? err.message : tr('Lỗi kết nối.', 'Network error.'));
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirmComplete() {
    if (!completingSprint || busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/sprints/${completingSprint.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          carryoverAction,
          targetSprintId:
            carryoverAction === 'NEXT_SPRINT' && targetSprintId ? Number(targetSprintId) : null,
        }),
      });
      const json = (await res.json().catch(() => null)) as {
        success?: boolean;
        data?: { completedTaskCount: number; carriedOverCount: number };
        error?: { message?: string };
      } | null;
      if (!res.ok || !json?.success) {
        throw new Error(json?.error?.message ?? tr('Không thể chốt Sprint.', 'Failed to complete sprint.'));
      }
      setCompletingSprint(null);
      setMsg(
        tr(
          `Đã chốt Sprint: ${json.data?.completedTaskCount ?? 0} xong, ${json.data?.carriedOverCount ?? 0} chuyển tiếp.`,
          `Sprint completed: ${json.data?.completedTaskCount ?? 0} done, ${json.data?.carriedOverCount ?? 0} carried over.`,
        ),
      );
      await loadSprints();
      onTasksChanged();
    } catch (err: unknown) {
      setMsg(err instanceof Error ? err.message : tr('Lỗi kết nối.', 'Network error.'));
    } finally {
      setBusy(false);
    }
  }

  async function handleAssignTaskToSprint(task: TaskListItem, nextSprintId: number | null) {
    const res = await fetch(`/api/v1/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sprintId: nextSprintId }),
    });
    if (res.ok) {
      onTasksChanged();
      await loadSprints();
    }
  }

  const backlogTasks = tasks.filter((t) => t.sprintId === null);
  const plannedSprints = sprints.filter((s) => s.status === 'PLANNED');

  if (loading) {
    return <SkeletonKanbanBoard />;
  }

  return (
    <div className="space-y-5">
      {msg && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs font-medium text-blue-800">
          {msg}
        </div>
      )}

      {/* Create Sprint Bar */}
      {canManageSprints && (
        <form
          onSubmit={(e) => void handleCreateSprint(e)}
          className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-12"
        >
          <input
            type="text"
            required
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={tr('Tên Sprint mới (vd: Sprint 01 — Core API)', 'New Sprint name (e.g. Sprint 01)')}
            className="rounded-xl border border-slate-200 px-3 py-2 text-xs md:col-span-3"
          />
          <input
            type="text"
            value={newGoal}
            onChange={(e) => setNewGoal(e.target.value)}
            placeholder={tr('Mục tiêu Sprint (Sprint Goal)...', 'Sprint goal...')}
            className="rounded-xl border border-slate-200 px-3 py-2 text-xs md:col-span-3"
          />
          <input
            type="date"
            value={newStart}
            onChange={(e) => setNewStart(e.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2 text-xs md:col-span-2"
          />
          <input
            type="date"
            value={newEnd}
            onChange={(e) => setNewEnd(e.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2 text-xs md:col-span-2"
          />
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 md:col-span-2"
          >
            <IconPlus size={15} />
            {tr('Tạo Sprint', 'Create Sprint')}
          </button>
        </form>
      )}

      {/* Charts: Burndown & Velocity */}
      {analytics && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
                <IconFlame size={16} className="text-orange-500" />
                {tr('Biểu đồ Burndown', 'Sprint Burndown')} — {analytics.sprint.name}
              </h4>
              <select
                value={selectedSprintId ?? ''}
                onChange={(e) => setSelectedSprintId(Number(e.target.value))}
                className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
              >
                {sprints.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.status})
                  </option>
                ))}
              </select>
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analytics.burndown}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line
                    type="monotone"
                    dataKey="idealRemaining"
                    name={tr('Đường lý tưởng', 'Ideal')}
                    stroke="#94a3b8"
                    strokeDasharray="4 4"
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="actualRemaining"
                    name={tr('Còn lại thực tế', 'Actual Remaining')}
                    stroke="#2563eb"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-900">
                {tr('Biểu đồ Velocity (6 Sprint gần nhất)', 'Sprint Velocity (Recent 6)')}
              </h4>
              <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                {tr('TB', 'Avg')}: {analytics.velocity.averageVelocity} pts (
                {analytics.velocity.averageCompletionRate}%)
              </span>
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.velocity.items}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar
                    dataKey="committedPoints"
                    name={tr('Cam kết', 'Committed')}
                    fill="#93c5fd"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="completedPoints"
                    name={tr('Hoàn thành', 'Completed')}
                    fill="#10b981"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Split View: Sprints + Backlog */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-7">
          <h3 className="text-sm font-bold text-slate-900">
            {tr('Danh sách Sprint', 'Project Sprints')} ({sprints.length})
          </h3>
          {sprints.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-xs text-slate-500">
              {tr('Chưa có Sprint nào. Tạo Sprint đầu tiên ở phía trên để lập kế hoạch Agile.', 'No sprints yet. Create your first sprint above.')}
            </div>
          ) : (
            sprints.map((sprint) => {
              const sprintTasks = tasks.filter((t) => t.sprintId === sprint.id);
              return (
                <div key={sprint.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900">{sprint.name}</span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            sprint.status === 'ACTIVE'
                              ? 'bg-emerald-100 text-emerald-700'
                              : sprint.status === 'COMPLETED'
                                ? 'bg-slate-100 text-slate-600'
                                : 'bg-blue-50 text-blue-700'
                          }`}
                        >
                          {sprint.status}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {sprint.startDate ? formatDateVN(sprint.startDate) : '—'} →{' '}
                        {sprint.endDate ? formatDateVN(sprint.endDate) : '—'} • {sprint.completedTaskCount}/
                        {sprint.taskCount} {tr('việc', 'tasks')} • {sprint.donePoints}/{sprint.totalPoints} pts
                      </p>
                      {sprint.goal && <p className="mt-1 text-xs text-slate-600">{sprint.goal}</p>}
                    </div>
                    {canManageSprints && (
                      <div className="flex items-center gap-2">
                        {sprint.status === 'PLANNED' && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void handleStartSprint(sprint.id)}
                            className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                          >
                            <IconPlayerPlay size={14} />
                            {tr('Bắt đầu', 'Start')}
                          </button>
                        )}
                        {sprint.status === 'ACTIVE' && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => setCompletingSprint(sprint)}
                            className="inline-flex items-center gap-1 rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
                          >
                            <IconCheck size={14} />
                            {tr('Chốt Sprint', 'Complete')}
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="mt-3 divide-y divide-slate-100">
                    {sprintTasks.length === 0 ? (
                      <p className="py-3 text-center text-xs text-slate-400">
                        {tr('Chưa có công việc trong Sprint này.', 'No tasks assigned to this sprint yet.')}
                      </p>
                    ) : (
                      sprintTasks.map((t) => (
                        <div key={t.id} className="flex items-center justify-between gap-2 py-2 text-xs">
                          <button
                            type="button"
                            onClick={() => onSelectTask(t.id)}
                            className="min-w-0 flex-1 truncate text-left hover:text-blue-600"
                          >
                            <span className="mr-2 font-mono font-semibold text-slate-500">{t.taskKey}</span>
                            <span className="font-medium text-slate-800">{t.title}</span>
                          </button>
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                            {t.storyPoints ?? t.estimatedHours} pts
                          </span>
                          {canManageSprints && sprint.status !== 'COMPLETED' && (
                            <button
                              type="button"
                              onClick={() => void handleAssignTaskToSprint(t, null)}
                              className="text-[11px] font-medium text-slate-400 hover:text-rose-600"
                            >
                              {tr('Về Backlog', 'To Backlog')}
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Backlog Column */}
        <div className="space-y-3 lg:col-span-5">
          <h3 className="text-sm font-bold text-slate-900">
            {tr('Product Backlog', 'Product Backlog')} ({backlogTasks.length})
          </h3>
          <div className="rounded-2xl border border-slate-200 bg-white p-3">
            {backlogTasks.length === 0 ? (
              <p className="py-8 text-center text-xs text-slate-400">
                {tr('Tất cả công việc đã được đưa vào Sprint.', 'All tasks have been assigned to sprints.')}
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {backlogTasks.map((t) => (
                  <div key={t.id} className="flex items-center justify-between gap-2 py-2 text-xs">
                    <button
                      type="button"
                      onClick={() => onSelectTask(t.id)}
                      className="min-w-0 flex-1 truncate text-left hover:text-blue-600"
                    >
                      <span className="mr-1.5 font-mono font-semibold text-slate-500">{t.taskKey}</span>
                      <span className="font-medium text-slate-800">{t.title}</span>
                    </button>
                    {canManageSprints && sprints.some((s) => s.status !== 'COMPLETED') && (
                      <select
                        defaultValue=""
                        onChange={(e) => {
                          if (e.target.value) {
                            void handleAssignTaskToSprint(t, Number(e.target.value));
                          }
                        }}
                        className="rounded-lg border border-slate-200 px-2 py-1 text-[11px]"
                      >
                        <option value="">{tr('+ Đưa vào Sprint', '+ Move to Sprint')}</option>
                        {sprints
                          .filter((s) => s.status !== 'COMPLETED' && s.status !== 'CANCELLED')
                          .map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                      </select>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Complete Sprint Modal */}
      {completingSprint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md space-y-4 rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-base font-bold text-slate-900">
              {tr('Chốt Sprint', 'Complete Sprint')}: {completingSprint.name}
            </h3>
            <p className="text-xs text-slate-600">
              {tr(
                'Chọn cách xử lý các công việc chưa hoàn thành trong Sprint này:',
                'Choose what to do with unfinished tasks in this sprint:',
              )}
            </p>
            <div className="space-y-2 text-xs">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={carryoverAction === 'BACKLOG'}
                  onChange={() => setCarryoverAction('BACKLOG')}
                />
                {tr('Trả về Product Backlog', 'Return to Product Backlog')}
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={carryoverAction === 'NEXT_SPRINT'}
                  onChange={() => setCarryoverAction('NEXT_SPRINT')}
                />
                {tr('Chuyển sang Sprint kế tiếp (PLANNED)', 'Move to next planned sprint')}
              </label>
              {carryoverAction === 'NEXT_SPRINT' && (
                <select
                  value={targetSprintId}
                  onChange={(e) => setTargetSprintId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
                >
                  <option value="">{tr('-- Chọn Sprint đích --', '-- Select target sprint --')}</option>
                  {plannedSprints.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCompletingSprint(null)}
                className="rounded-xl border border-slate-200 px-4 py-1.5 text-xs font-semibold text-slate-600"
              >
                {tr('Hủy', 'Cancel')}
              </button>
              <button
                type="button"
                disabled={busy || (carryoverAction === 'NEXT_SPRINT' && !targetSprintId)}
                onClick={() => void handleConfirmComplete()}
                className="rounded-xl bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {tr('Xác nhận chốt Sprint', 'Confirm Complete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
