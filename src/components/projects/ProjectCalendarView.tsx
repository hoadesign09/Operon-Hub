'use client';

import { useMemo, useState } from 'react';
import { IconChevronLeft, IconChevronRight, IconPlus, IconX } from '@tabler/icons-react';
import dayjs from 'dayjs';
import { formatDateVN } from '@/lib/portable/date-utils';
import type { TaskListItem } from '@/modules/projects/tasks.service';
import { useI18n } from '@/shared/i18n/I18nContext';
import { pickLabel, TASK_PRIORITY_META } from './project-ui-helpers';

interface ProjectCalendarViewProps {
  tasks: TaskListItem[];
  canEditTasks: boolean;
  onSelectTask: (taskId: number) => void;
  onCreateTaskOnDate: (isoDate: string) => void;
}

const WEEKDAY_LABELS = [
  { vi: 'T2', en: 'Mon' },
  { vi: 'T3', en: 'Tue' },
  { vi: 'T4', en: 'Wed' },
  { vi: 'T5', en: 'Thu' },
  { vi: 'T6', en: 'Fri' },
  { vi: 'T7', en: 'Sat' },
  { vi: 'CN', en: 'Sun' },
] as const;

export function ProjectCalendarView({
  tasks,
  canEditTasks,
  onSelectTask,
  onCreateTaskOnDate,
}: ProjectCalendarViewProps) {
  const { locale, tr } = useI18n();
  const [cursorIso, setCursorIso] = useState(() => dayjs().format('YYYY-MM-DD'));
  const [mode, setMode] = useState<'month' | 'week'>('month');
  const [selectedDayIso, setSelectedDayIso] = useState<string | null>(null);

  const todayIso = useMemo(() => dayjs().format('YYYY-MM-DD'), []);

  const tasksByDate = useMemo(() => {
    const map = new Map<string, TaskListItem[]>();
    for (const t of tasks) {
      if (!t.dueDate) continue;
      const list = map.get(t.dueDate) ?? [];
      list.push(t);
      map.set(t.dueDate, list);
    }
    return map;
  }, [tasks]);

  const calendarDays = useMemo(() => {
    const anchor = dayjs(cursorIso);
    if (mode === 'week') {
      const dow = (anchor.day() + 6) % 7;
      const monday = anchor.subtract(dow, 'day');
      return Array.from({ length: 7 }, (_, i) => {
        const d = monday.add(i, 'day');
        return { iso: d.format('YYYY-MM-DD'), dayNum: d.date(), inCurrentMonth: true };
      });
    }

    const firstOfMonth = anchor.startOf('month');
    const offset = (firstOfMonth.day() + 6) % 7;
    const gridStart = firstOfMonth.subtract(offset, 'day');
    return Array.from({ length: 42 }, (_, i) => {
      const d = gridStart.add(i, 'day');
      return {
        iso: d.format('YYYY-MM-DD'),
        dayNum: d.date(),
        inCurrentMonth: d.month() === anchor.month(),
      };
    });
  }, [cursorIso, mode]);

  const maxVisiblePerCell = mode === 'month' ? 2 : 3;
  const selectedDayTasks = selectedDayIso ? tasksByDate.get(selectedDayIso) ?? [] : [];

  function stepPeriod(delta: -1 | 1) {
    const d = dayjs(cursorIso);
    setCursorIso((mode === 'month' ? d.add(delta, 'month') : d.add(delta, 'week')).format('YYYY-MM-DD'));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => stepPeriod(-1)}
            className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50"
          >
            <IconChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={() => setCursorIso(todayIso)}
            className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            {tr('Hôm nay', 'Today')}
          </button>
          <button
            type="button"
            onClick={() => stepPeriod(1)}
            className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50"
          >
            <IconChevronRight size={16} />
          </button>
          <h3 className="ml-2 text-sm font-bold text-slate-900">
            {dayjs(cursorIso).format('MM / YYYY')}
          </h3>
        </div>

        <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 text-xs">
          <button
            type="button"
            onClick={() => setMode('month')}
            className={`rounded-lg px-3 py-1 font-semibold ${
              mode === 'month' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
            }`}
          >
            {tr('Tháng', 'Month')}
          </button>
          <button
            type="button"
            onClick={() => setMode('week')}
            className={`rounded-lg px-3 py-1 font-semibold ${
              mode === 'week' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
            }`}
          >
            {tr('Tuần', 'Week')}
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center text-xs font-semibold text-slate-500">
          {WEEKDAY_LABELS.map((w) => (
            <div key={w.en} className="py-2.5">
              {locale === 'en' ? w.en : w.vi}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 divide-x divide-y divide-slate-100">
          {calendarDays.map((cell) => {
            const dayTasks = tasksByDate.get(cell.iso) ?? [];
            const isToday = cell.iso === todayIso;
            const hasOverflow = dayTasks.length > maxVisiblePerCell;
            const visibleSlice = hasOverflow
              ? dayTasks.slice(0, maxVisiblePerCell - 1)
              : dayTasks;
            const hiddenCount = dayTasks.length - visibleSlice.length;

            return (
              <div
                key={cell.iso}
                className={`flex flex-col p-2 ${
                  mode === 'month' ? 'h-[118px]' : 'h-[230px]'
                } ${cell.inCurrentMonth ? 'bg-white' : 'bg-slate-50/70 text-slate-400'}`}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span
                    className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                      isToday ? 'bg-blue-600 text-white' : 'text-slate-700'
                    }`}
                  >
                    {cell.dayNum}
                  </span>
                  {canEditTasks && (
                    <button
                      type="button"
                      onClick={() => onCreateTaskOnDate(cell.iso)}
                      className="rounded p-0.5 text-slate-300 hover:bg-slate-100 hover:text-blue-600"
                      title={tr('Thêm công việc ngày này', 'Add task on this date')}
                    >
                      <IconPlus size={13} />
                    </button>
                  )}
                </div>

                <div className="flex flex-1 flex-col gap-1 overflow-hidden">
                  {visibleSlice.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => onSelectTask(t.id)}
                      className={`truncate rounded-md px-1.5 py-0.5 text-left text-[11px] font-medium transition hover:opacity-90 ${
                        t.statusCategory === 'DONE'
                          ? 'bg-emerald-50 text-emerald-700 line-through'
                          : 'bg-blue-50 text-blue-800'
                      }`}
                      title={`${t.taskKey}: ${t.title}`}
                    >
                      {t.taskKey} {t.title}
                    </button>
                  ))}

                  {hiddenCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedDayIso(cell.iso)}
                      className="mt-auto rounded-md bg-slate-100 px-1.5 py-0.5 text-left text-[11px] font-semibold text-slate-700 hover:bg-slate-200"
                    >
                      +{hiddenCount} {tr('công việc khác', 'more')}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* DayTasksModal (z-40, sits below TaskDetailDrawer z-50) */}
      {selectedDayIso && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
              <div>
                <h4 className="text-sm font-bold text-slate-900">
                  {tr('Công việc đến hạn ngày', 'Tasks due on')} {formatDateVN(selectedDayIso)}
                </h4>
                <p className="text-xs text-slate-500">
                  {selectedDayTasks.length} {tr('công việc', 'tasks')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDayIso(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <IconX size={18} />
              </button>
            </div>
            <div className="max-h-[60vh] space-y-2 overflow-y-auto p-4">
              {selectedDayTasks.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onSelectTask(t.id)}
                  className="flex w-full items-center justify-between gap-2 rounded-xl border border-slate-200 px-3.5 py-2.5 text-left text-xs hover:border-blue-300 hover:bg-blue-50/40"
                >
                  <div className="min-w-0">
                    <span className="font-mono font-semibold text-slate-500">{t.taskKey}</span>
                    <p className="truncate font-semibold text-slate-900">{t.title}</p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${TASK_PRIORITY_META[t.priority].cls}`}
                  >
                    {pickLabel(TASK_PRIORITY_META[t.priority], locale)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
