'use client';

import { useEffect, useState } from 'react';
import { IconBolt, IconCopy, IconPlayerPlay, IconPlus, IconRepeat } from '@tabler/icons-react';
import type {
  ProjectAutomationAction,
  ProjectAutomationTrigger,
  TaskRecurrenceFrequency,
} from '@/config/database';
import type { TaskListItem } from '@/modules/projects/tasks.service';
import type {
  AutomationRuleView,
  RecurrenceRuleView,
} from '@/modules/projects/templates-automation.service';
import { useI18n } from '@/shared/i18n/I18nContext';

interface ProjectAutomationPanelProps {
  projectId: number;
  projectCode: string;
  tasks: TaskListItem[];
  canManage: boolean;
}

export function ProjectAutomationPanel({
  projectId,
  projectCode,
  tasks,
  canManage,
}: ProjectAutomationPanelProps) {
  const { tr } = useI18n();
  const [automations, setAutomations] = useState<AutomationRuleView[]>([]);
  const [recurrences, setRecurrences] = useState<RecurrenceRuleView[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Automation Form
  const [ruleName, setRuleName] = useState('');
  const [triggerEvent, setTriggerEvent] = useState<ProjectAutomationTrigger>('TASK_MOVED_COLUMN');
  const [actionType, setActionType] = useState<ProjectAutomationAction>('NOTIFY_PM');

  // Recurrence Form
  const [recTaskId, setRecTaskId] = useState('');
  const [recFreq, setRecFreq] = useState<TaskRecurrenceFrequency>('WEEKLY');
  const [recNextDate, setRecNextDate] = useState(() => new Date().toISOString().slice(0, 10));

  // Save as Template Form
  const [tplCode, setTplCode] = useState(`TPL-${projectCode}`);
  const [tplName, setTplName] = useState('');
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const [aRes, rRes] = await Promise.all([
          fetch(`/api/v1/projects/${projectId}/automations`, { signal: controller.signal }),
          fetch(`/api/v1/projects/${projectId}/recurrences`, { signal: controller.signal }),
        ]);
        const aJson = (await aRes.json().catch(() => null)) as { data?: AutomationRuleView[] } | null;
        const rJson = (await rRes.json().catch(() => null)) as { data?: RecurrenceRuleView[] } | null;
        setAutomations(aJson?.data ?? []);
        setRecurrences(rJson?.data ?? []);
      } catch {
        // Ignore abort
      }
    })();
    return () => controller.abort();
  }, [projectId, reloadTick]);

  function loadAll() {
    setReloadTick((n) => n + 1);
  }

  async function handleAddAutomation(e: React.FormEvent) {
    e.preventDefault();
    if (!ruleName.trim() || busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/automations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: ruleName.trim(),
          triggerEvent,
          actionType,
          isActive: true,
        }),
      });
      if (res.ok) {
        setRuleName('');
        await loadAll();
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleAutomation(rule: AutomationRuleView) {
    await fetch(`/api/v1/projects/${projectId}/automations/${rule.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !rule.isActive }),
    });
    await loadAll();
  }

  async function handleAddRecurrence(e: React.FormEvent) {
    e.preventDefault();
    if (!recTaskId || busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/recurrences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateTaskId: Number(recTaskId),
          frequency: recFreq,
          intervalValue: 1,
          nextRunDate: recNextDate,
        }),
      });
      if (res.ok) {
        setRecTaskId('');
        await loadAll();
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleRunDueRecurrences() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch('/api/v1/pm/recurrences/run-due', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      });
      const json = (await res.json().catch(() => null)) as {
        data?: { generatedCount: number };
      } | null;
      if (res.ok) {
        setMsg(
          tr(
            `Đã sinh ${json?.data?.generatedCount ?? 0} công việc định kỳ đến hạn.`,
            `Generated ${json?.data?.generatedCount ?? 0} due recurring tasks.`,
          ),
        );
        await loadAll();
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveAsTemplate(e: React.FormEvent) {
    e.preventDefault();
    if (!tplCode.trim() || !tplName.trim() || busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/save-as-template`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: tplCode.trim(),
          name: tplName.trim(),
          isCompanyWide: true,
        }),
      });
      const json = (await res.json().catch(() => null)) as {
        success?: boolean;
        error?: { message?: string };
      } | null;
      if (res.ok && json?.success) {
        setTplName('');
        setMsg(tr('Đã lưu cấu trúc dự án vào Thư viện Mẫu Dự án!', 'Project saved to Template Library!'));
      } else {
        setMsg(json?.error?.message ?? tr('Không thể lưu mẫu dự án.', 'Unable to save template.'));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      {msg && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-medium text-emerald-800">
          {msg}
        </div>
      )}

      {/* Save As Template */}
      {canManage && (
        <form
          onSubmit={(e) => void handleSaveAsTemplate(e)}
          className="rounded-2xl border border-slate-200 bg-white p-4"
        >
          <h4 className="mb-3 flex items-center gap-1.5 text-sm font-bold text-slate-900">
            <IconCopy size={16} className="text-blue-600" />
            {tr('Lưu Dự án hiện tại thành Mẫu Dự án (Project Template)', 'Save Project as Reusable Template')}
          </h4>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-12">
            <input
              type="text"
              required
              value={tplCode}
              onChange={(e) => setTplCode(e.target.value)}
              placeholder={tr('Mã mẫu (vd: TPL-WEB)', 'Template code')}
              className="rounded-xl border border-slate-200 px-3 py-1.5 font-mono text-xs sm:col-span-3"
            />
            <input
              type="text"
              required
              value={tplName}
              onChange={(e) => setTplName(e.target.value)}
              placeholder={tr('Tên mẫu dự án chuẩn...', 'Standard template name...')}
              className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs sm:col-span-6"
            />
            <button
              type="submit"
              disabled={busy}
              className="rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 sm:col-span-3"
            >
              {tr('Lưu vào Thư viện Mẫu', 'Save as Template')}
            </button>
          </div>
        </form>
      )}

      {/* Automation Rules */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <h4 className="mb-3 flex items-center gap-1.5 text-sm font-bold text-slate-900">
          <IconBolt size={16} className="text-amber-500" />
          {tr('Luật Tự động hóa (Project Automation Rules)', 'Project Automation Rules')}
        </h4>
        {canManage && (
          <form onSubmit={(e) => void handleAddAutomation(e)} className="mb-4 grid grid-cols-1 gap-2 md:grid-cols-12">
            <input
              type="text"
              required
              value={ruleName}
              onChange={(e) => setRuleName(e.target.value)}
              placeholder={tr('Tên luật (vd: Báo PM khi xong hết Subtask)', 'Rule name...')}
              className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs md:col-span-4"
            />
            <select
              value={triggerEvent}
              onChange={(e) => setTriggerEvent(e.target.value as ProjectAutomationTrigger)}
              className="rounded-xl border border-slate-200 px-2.5 py-1.5 text-xs md:col-span-3"
            >
              <option value="TASK_MOVED_COLUMN">TASK_MOVED_COLUMN</option>
              <option value="ALL_SUBTASKS_DONE">ALL_SUBTASKS_DONE</option>
              <option value="TASK_ASSIGNED">TASK_ASSIGNED</option>
              <option value="TASK_OVERDUE">TASK_OVERDUE</option>
            </select>
            <select
              value={actionType}
              onChange={(e) => setActionType(e.target.value as ProjectAutomationAction)}
              className="rounded-xl border border-slate-200 px-2.5 py-1.5 text-xs md:col-span-3"
            >
              <option value="NOTIFY_PM">NOTIFY_PM</option>
              <option value="SET_BLOCKED">SET_BLOCKED</option>
              <option value="MOVE_COLUMN">MOVE_COLUMN</option>
              <option value="ADD_WATCHER">ADD_WATCHER</option>
            </select>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center justify-center gap-1 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white md:col-span-2"
            >
              <IconPlus size={14} />
              {tr('Thêm luật', 'Add Rule')}
            </button>
          </form>
        )}
        <div className="divide-y divide-slate-100 text-xs">
          {automations.length === 0 ? (
            <p className="py-4 text-center text-slate-400">
              {tr('Chưa cấu hình luật tự động hóa.', 'No automation rules configured.')}
            </p>
          ) : (
            automations.map((rule) => (
              <div key={rule.id} className="flex items-center justify-between py-2.5">
                <div>
                  <p className="font-semibold text-slate-900">{rule.name}</p>
                  <p className="font-mono text-[11px] text-slate-500">
                    WHEN {rule.triggerEvent} → DO {rule.actionType}
                  </p>
                </div>
                {canManage && (
                  <button
                    type="button"
                    onClick={() => void handleToggleAutomation(rule)}
                    className={`rounded-full px-3 py-1 text-[11px] font-bold ${
                      rule.isActive
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {rule.isActive ? tr('Đang bật', 'Active') : tr('Đang tắt', 'Paused')}
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Recurring Tasks */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h4 className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
            <IconRepeat size={16} className="text-indigo-600" />
            {tr('Công việc Lặp định kỳ (Recurring Tasks)', 'Recurring Task Rules')}
          </h4>
          {canManage && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleRunDueRecurrences()}
              className="inline-flex items-center gap-1 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
            >
              <IconPlayerPlay size={13} />
              {tr('Chạy sinh việc đến hạn ngay', 'Run Due Recurrences Now')}
            </button>
          )}
        </div>
        {canManage && (
          <form onSubmit={(e) => void handleAddRecurrence(e)} className="mb-4 grid grid-cols-1 gap-2 md:grid-cols-12">
            <select
              required
              value={recTaskId}
              onChange={(e) => setRecTaskId(e.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs md:col-span-5"
            >
              <option value="">{tr('-- Chọn công việc mẫu --', '-- Select template task --')}</option>
              {tasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.taskKey} — {t.title}
                </option>
              ))}
            </select>
            <select
              value={recFreq}
              onChange={(e) => setRecFreq(e.target.value as TaskRecurrenceFrequency)}
              className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs md:col-span-2"
            >
              <option value="DAILY">{tr('Hằng ngày', 'Daily')}</option>
              <option value="WEEKLY">{tr('Hằng tuần', 'Weekly')}</option>
              <option value="MONTHLY">{tr('Hằng tháng', 'Monthly')}</option>
            </select>
            <input
              type="date"
              required
              value={recNextDate}
              onChange={(e) => setRecNextDate(e.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs md:col-span-3"
            />
            <button
              type="submit"
              disabled={busy}
              className="rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white md:col-span-2"
            >
              {tr('Tạo lịch lặp', 'Add Schedule')}
            </button>
          </form>
        )}
        <div className="divide-y divide-slate-100 text-xs">
          {recurrences.length === 0 ? (
            <p className="py-4 text-center text-slate-400">
              {tr('Chưa có lịch lặp định kỳ nào.', 'No recurrence schedules yet.')}
            </p>
          ) : (
            recurrences.map((r) => (
              <div key={r.id} className="flex items-center justify-between py-2">
                <div>
                  <span className="mr-2 font-mono font-bold text-slate-500">{r.templateTaskKey}</span>
                  <span className="font-semibold text-slate-800">{r.templateTaskTitle}</span>
                </div>
                <span className="text-slate-500">
                  {r.frequency} • {tr('Kế tiếp', 'Next')}: <strong>{r.nextRunDate}</strong>
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
