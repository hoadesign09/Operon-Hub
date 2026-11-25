'use client';

import { useState, type FormEvent } from 'react';
import { IconArrowDown, IconArrowUp, IconPlus, IconTag, IconTrash } from '@tabler/icons-react';
import type { TaskStatusCategory } from '@/config/database';
import type { ProjectColumnView, ProjectLabelView } from '@/modules/projects/projects.service';
import { useI18n } from '@/shared/i18n/I18nContext';
import { pickLabel, PROJECT_COLOR_PRESETS, STATUS_CATEGORY_META } from './project-ui-helpers';

interface ProjectWorkflowPanelProps {
  projectId: number;
  columns: ProjectColumnView[];
  labels: ProjectLabelView[];
  canManage: boolean;
  onColumnsChanged: (next: ProjectColumnView[]) => void;
  onLabelsChanged: (next: ProjectLabelView[]) => void;
}

export function ProjectWorkflowPanel({
  projectId,
  columns,
  labels,
  canManage,
  onColumnsChanged,
  onLabelsChanged,
}: ProjectWorkflowPanelProps) {
  const { locale, tr, ln } = useI18n();
  const [colCode, setColCode] = useState('');
  const [colName, setColName] = useState('');
  const [colNameEn, setColNameEn] = useState('');
  const [colCategory, setColCategory] = useState<TaskStatusCategory>('IN_PROGRESS');
  const [colWip, setColWip] = useState('');
  const [colColor, setColColor] = useState('#3B82F6');

  const [labelName, setLabelName] = useState('');
  const [labelColor, setLabelColor] = useState('#2563EB');

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleAddColumn(e: FormEvent) {
    e.preventDefault();
    if (!colCode.trim() || !colName.trim() || busy) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/columns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: colCode.trim().toUpperCase(),
          name: colName.trim(),
          nameEn: colNameEn.trim() || null,
          statusCategory: colCategory,
          wipLimit: colWip ? Number(colWip) : null,
          colorHex: colColor,
        }),
      });
      const json = (await res.json().catch(() => null)) as {
        success?: boolean;
        data?: ProjectColumnView[];
        error?: { message?: string };
      } | null;
      if (!res.ok || !json?.success || !json.data) {
        throw new Error(json?.error?.message ?? tr('Không thể tạo cột mới.', 'Unable to add column.'));
      }
      onColumnsChanged(json.data);
      setColCode('');
      setColName('');
      setColNameEn('');
      setColWip('');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : tr('Lỗi kết nối.', 'Network error.'));
    } finally {
      setBusy(false);
    }
  }

  async function patchColumn(payload: Record<string, unknown>) {
    setBusy(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/columns`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => null)) as {
        success?: boolean;
        data?: ProjectColumnView[];
        error?: { message?: string };
      } | null;
      if (!res.ok || !json?.success || !json.data) {
        throw new Error(json?.error?.message ?? tr('Không thể cập nhật cột.', 'Unable to update column.'));
      }
      onColumnsChanged(json.data);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : tr('Lỗi kết nối.', 'Network error.'));
    } finally {
      setBusy(false);
    }
  }

  async function swapColumnOrder(index: number, delta: -1 | 1) {
    const targetIdx = index + delta;
    if (targetIdx < 0 || targetIdx >= columns.length) return;
    const a = columns[index]!;
    const b = columns[targetIdx]!;
    await patchColumn({ columnId: a.id, sortOrder: b.sortOrder });
    await patchColumn({ columnId: b.id, sortOrder: a.sortOrder });
  }

  async function handleAddLabel(e: FormEvent) {
    e.preventDefault();
    if (!labelName.trim() || busy) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/labels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: labelName.trim(), colorHex: labelColor }),
      });
      const json = (await res.json().catch(() => null)) as {
        success?: boolean;
        data?: ProjectLabelView[];
        error?: { message?: string };
      } | null;
      if (!res.ok || !json?.success || !json.data) {
        throw new Error(json?.error?.message ?? tr('Không thể tạo nhãn.', 'Unable to create label.'));
      }
      onLabelsChanged(json.data);
      setLabelName('');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : tr('Lỗi kết nối.', 'Network error.'));
    } finally {
      setBusy(false);
    }
  }

  async function handleArchiveLabel(labelId: number) {
    setBusy(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/labels`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ labelId, archive: true }),
      });
      const json = (await res.json().catch(() => null)) as {
        success?: boolean;
        data?: ProjectLabelView[];
        error?: { message?: string };
      } | null;
      if (!res.ok || !json?.success || !json.data) {
        throw new Error(json?.error?.message ?? tr('Không thể ẩn nhãn.', 'Unable to archive label.'));
      }
      onLabelsChanged(json.data);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : tr('Lỗi kết nối.', 'Network error.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {errorMsg && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 lg:col-span-12">
          {errorMsg}
        </div>
      )}

      {/* Kanban Columns Config */}
      <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-8">
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            {tr('Cấu hình cột Kanban & Giới hạn WIP', 'Kanban Workflow Columns & WIP Limits')}
          </h3>
          <p className="text-xs text-slate-500">
            {tr(
              'Mỗi cột ánh xạ về 1 nhóm trạng thái chuẩn để đồng bộ báo cáo tiến độ toàn công ty.',
              'Each column maps to a standard status category for consistent portfolio reporting.',
            )}
          </p>
        </div>

        <div className="space-y-2">
          {columns.map((col, idx) => (
            <div
              key={col.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <span
                  className="h-3.5 w-3.5 rounded-full"
                  style={{ backgroundColor: col.colorHex }}
                />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900">
                      {ln(col.name, col.nameEn)}
                    </span>
                    <span className="rounded bg-slate-200/70 px-1.5 py-0.5 font-mono text-[11px] text-slate-600">
                      {col.code}
                    </span>
                    {col.isDefaultInitial && (
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
                        {tr('Mặc định', 'Default')}
                      </span>
                    )}
                    {col.isDoneColumn && (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                        {tr('Hoàn thành', 'Done')}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex items-center gap-3 text-xs text-slate-500">
                    <span>{pickLabel(STATUS_CATEGORY_META[col.statusCategory], locale)}</span>
                    <span>•</span>
                    <span>
                      {tr('WIP tối đa:', 'WIP limit:')}{' '}
                      <strong>{col.wipLimit ?? tr('Không giới hạn', 'Unlimited')}</strong>
                    </span>
                    <span>•</span>
                    <span>
                      {col.taskCount} {tr('công việc', 'tasks')}
                    </span>
                  </div>
                </div>
              </div>

              {canManage && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={idx === 0 || busy}
                    onClick={() => swapColumnOrder(idx, -1)}
                    className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-200 disabled:opacity-30"
                    title={tr('Lên trên', 'Move up')}
                  >
                    <IconArrowUp size={15} />
                  </button>
                  <button
                    type="button"
                    disabled={idx === columns.length - 1 || busy}
                    onClick={() => swapColumnOrder(idx, 1)}
                    className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-200 disabled:opacity-30"
                    title={tr('Xuống dưới', 'Move down')}
                  >
                    <IconArrowDown size={15} />
                  </button>
                  <button
                    type="button"
                    disabled={busy || col.isDefaultInitial || col.taskCount > 0}
                    onClick={() => patchColumn({ columnId: col.id, archive: true })}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30"
                    title={tr('Ẩn cột (chỉ khi trống)', 'Archive empty column')}
                  >
                    <IconTrash size={15} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {canManage && (
          <form
            onSubmit={handleAddColumn}
            className="grid grid-cols-1 gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50/70 p-4 sm:grid-cols-12"
          >
            <div className="sm:col-span-2">
              <input
                type="text"
                value={colCode}
                onChange={(e) => setColCode(e.target.value.toUpperCase())}
                placeholder={tr('Mã (VD: QA_TEST)', 'Code (e.g. QA_TEST)')}
                required
                className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs uppercase"
              />
            </div>
            <div className="sm:col-span-2">
              <input
                type="text"
                value={colName}
                onChange={(e) => setColName(e.target.value)}
                placeholder={tr('Tên cột', 'Column Name')}
                required
                className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
              />
            </div>
            <div className="sm:col-span-2">
              <input
                type="text"
                value={colNameEn}
                onChange={(e) => setColNameEn(e.target.value)}
                placeholder={tr('Tên tiếng Anh', 'English Name')}
                className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
              />
            </div>
            <div className="sm:col-span-3">
              <select
                value={colCategory}
                onChange={(e) => setColCategory(e.target.value as TaskStatusCategory)}
                className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
              >
                {(Object.keys(STATUS_CATEGORY_META) as TaskStatusCategory[]).map((cat) => (
                  <option key={cat} value={cat}>
                    {pickLabel(STATUS_CATEGORY_META[cat], locale)}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-1">
              <input
                type="number"
                min={1}
                value={colWip}
                onChange={(e) => setColWip(e.target.value)}
                placeholder="WIP"
                className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs"
              />
            </div>
            <div className="flex items-center gap-1 sm:col-span-2">
              <input
                type="color"
                value={colColor}
                onChange={(e) => setColColor(e.target.value)}
                className="h-8 w-8 cursor-pointer rounded border border-slate-300 bg-white p-0.5"
              />
              <button
                type="submit"
                disabled={busy}
                className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                <IconPlus size={14} />
                {tr('Thêm', 'Add')}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Labels Config */}
      <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-4">
        <div className="flex items-center gap-2">
          <IconTag size={18} className="text-blue-600" />
          <h3 className="text-base font-semibold text-slate-900">
            {tr('Nhãn công việc (Labels)', 'Project Labels')}
          </h3>
        </div>

        <div className="flex flex-wrap gap-2">
          {labels.map((lbl) => (
            <span
              key={lbl.id}
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium"
              style={{
                borderColor: `${lbl.colorHex}55`,
                backgroundColor: `${lbl.colorHex}14`,
                color: lbl.colorHex,
              }}
            >
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: lbl.colorHex }} />
              {lbl.name}
              {canManage && (
                <button
                  type="button"
                  onClick={() => handleArchiveLabel(lbl.id)}
                  className="ml-1 opacity-70 hover:opacity-100"
                  title={tr('Ẩn nhãn', 'Archive label')}
                >
                  ×
                </button>
              )}
            </span>
          ))}
        </div>

        {canManage && (
          <form onSubmit={handleAddLabel} className="space-y-3 border-t border-slate-200 pt-4">
            <input
              type="text"
              value={labelName}
              onChange={(e) => setLabelName(e.target.value)}
              placeholder={tr('Tên nhãn mới (VD: Backend, UX)...', 'New label (e.g. Backend, UX)...')}
              required
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
            />
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                {PROJECT_COLOR_PRESETS.slice(0, 6).map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    onClick={() => setLabelColor(hex)}
                    style={{ backgroundColor: hex }}
                    className={`h-5 w-5 rounded-full ${
                      labelColor === hex ? 'ring-2 ring-slate-900 ring-offset-1' : 'opacity-75'
                    }`}
                  />
                ))}
              </div>
              <button
                type="submit"
                disabled={busy || !labelName.trim()}
                className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {tr('Thêm nhãn', 'Add Label')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
