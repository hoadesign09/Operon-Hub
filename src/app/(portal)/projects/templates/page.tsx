'use client';

import { useEffect, useState } from 'react';
import { IconCopy, IconPlus } from '@tabler/icons-react';
import { usePortalAuth } from '@/components/portal/PortalAuthContext';
import { SkeletonCardGrid } from '@/components/ui/Skeleton';
import type { ProjectMethodology } from '@/config/database';
import { DEFAULT_PROJECT_BOARD_COLUMNS } from '@/modules/projects/projects.constants';
import type { ProjectTemplateView } from '@/modules/projects/templates-automation.service';
import { useI18n } from '@/shared/i18n/I18nContext';

export default function ProjectTemplatesPage() {
  const { user } = usePortalAuth();
  const { tr, ln } = useI18n();
  const canManage =
    user?.isSuperAdmin || user?.permissions.includes('pm.templates.manage');

  const [templates, setTemplates] = useState<ProjectTemplateView[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [methodology, setMethodology] = useState<ProjectMethodology>('SCRUM');
  const [description, setDescription] = useState('');
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const res = await fetch('/api/v1/pm/templates', { signal: controller.signal });
        const json = (await res.json().catch(() => null)) as {
          data?: ProjectTemplateView[];
        } | null;
        setTemplates(json?.data ?? []);
      } catch {
        // Ignore abort
      } finally {
        setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [reloadTick]);

  function reloadTemplates() {
    setReloadTick((n) => n + 1);
  }

  async function handleCreateQuickTemplate(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim() || !name.trim() || busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/v1/pm/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: code.trim(),
          name: name.trim(),
          nameEn: nameEn.trim() || null,
          description: description.trim() || null,
          methodology,
          columns: DEFAULT_PROJECT_BOARD_COLUMNS.filter((c) => c.code !== 'BACKLOG').map((c) => ({
            code: c.code,
            name: c.name,
            nameEn: c.nameEn,
            statusCategory: c.statusCategory,
            colorHex: c.colorHex,
            isDefaultInitial: c.code === 'TODO',
            isDoneColumn: c.isDoneColumn,
          })),
          tasks: [
            { title: tr('Khởi tạo & Kickoff Dự án', 'Project Initiation & Kickoff'), taskType: 'TASK', priority: 'HIGH', columnCode: 'TODO', startOffsetDays: 0, durationDays: 2, estimatedHours: 4 },
            { title: tr('Thiết kế Kiến trúc & Kế hoạch', 'Architecture & Implementation Plan'), taskType: 'FEATURE', priority: 'HIGH', columnCode: 'TODO', startOffsetDays: 2, durationDays: 5, estimatedHours: 16 },
            { title: tr('Nghiệm thu & Bàn giao Go-Live', 'UAT Sign-off & Go-Live Handover'), taskType: 'TASK', priority: 'URGENT', columnCode: 'TODO', startOffsetDays: 10, durationDays: 2, estimatedHours: 8 },
          ],
        }),
      });
      const json = (await res.json().catch(() => null)) as {
        success?: boolean;
        error?: { message?: string };
      } | null;
      if (!res.ok || !json?.success) {
        throw new Error(json?.error?.message ?? tr('Không thể tạo mẫu dự án.', 'Failed to create template.'));
      }
      setCode('');
      setName('');
      setNameEn('');
      setDescription('');
      setMsg(tr('Đã tạo mẫu dự án mới thành công.', 'Project template created.'));
      reloadTemplates();
    } catch (err: unknown) {
      setMsg(err instanceof Error ? err.message : tr('Lỗi kết nối.', 'Network error.'));
    } finally {
      setBusy(false);
    }
  }

  async function handleToggle(tpl: ProjectTemplateView) {
    await fetch(`/api/v1/pm/templates/${tpl.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !tpl.isActive }),
    });
    reloadTemplates();
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">
          {tr('Thư viện Mẫu Dự án (Project Templates)', 'Project Templates Library')}
        </h1>
        <p className="text-xs text-slate-500">
          {tr(
            'Chuẩn hóa quy trình Kanban/Scrum và bộ công việc khung (T+N ngày) để nhân bản dự án mới chỉ trong vài giây.',
            'Standardize Kanban/Scrum columns and starter tasks (T+N days) to launch new projects in seconds.',
          )}
        </p>
      </div>

      {msg && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-xs text-blue-800">
          {msg}
        </div>
      )}

      {canManage && (
        <form
          onSubmit={(e) => void handleCreateQuickTemplate(e)}
          className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-12"
        >
          <input
            type="text"
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder={tr('Mã mẫu (vd: TPL-ERP)', 'Code (e.g. TPL-ERP)')}
            className="rounded-xl border border-slate-200 px-3 py-2 font-mono text-xs md:col-span-2"
          />
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={tr('Tên mẫu dự án...', 'Template name...')}
            className="rounded-xl border border-slate-200 px-3 py-2 text-xs md:col-span-2"
          />
          <input
            type="text"
            value={nameEn}
            onChange={(e) => setNameEn(e.target.value)}
            placeholder={tr('Tên tiếng Anh...', 'English name...')}
            className="rounded-xl border border-slate-200 px-3 py-2 text-xs md:col-span-2"
          />
          <select
            value={methodology}
            onChange={(e) => setMethodology(e.target.value as ProjectMethodology)}
            className="rounded-xl border border-slate-200 px-3 py-2 text-xs md:col-span-2"
          >
            <option value="KANBAN">KANBAN</option>
            <option value="SCRUM">SCRUM</option>
            <option value="WATERFALL">WATERFALL</option>
            <option value="HYBRID">HYBRID</option>
          </select>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={tr('Mô tả ngắn...', 'Short description...')}
            className="rounded-xl border border-slate-200 px-3 py-2 text-xs md:col-span-2"
          />
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center justify-center gap-1 rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 md:col-span-2"
          >
            <IconPlus size={14} />
            {tr('Tạo Mẫu', 'Create')}
          </button>
        </form>
      )}

      {loading ? (
        <SkeletonCardGrid
          count={3}
          columnsClass="grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
        />
      ) : templates.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-xs text-slate-500">
          <IconCopy size={24} className="mx-auto mb-2 text-slate-300" />
          {tr(
            'Chưa có mẫu dự án nào. Tạo mới ở trên hoặc vào tab Tự động & Mẫu trong 1 dự án để lưu mẫu.',
            'No project templates yet. Create one above or save an existing project as a template.',
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((tpl) => (
            <div key={tpl.id} className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-bold text-blue-700">{tpl.code}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                    {tpl.methodology}
                  </span>
                </div>
                <h3 className="mt-1.5 text-sm font-bold text-slate-900">
                  {ln(tpl.name, tpl.nameEn)}
                </h3>
                {tpl.description && (
                  <p className="mt-1 text-xs text-slate-500">{tpl.description}</p>
                )}
                <div className="mt-3 flex items-center gap-3 text-[11px] text-slate-600">
                  <span>
                    <strong>{tpl.payload.columns.length}</strong> {tr('cột', 'columns')}
                  </span>
                  <span>
                    <strong>{tpl.payload.tasks.length}</strong> {tr('task khung', 'starter tasks')}
                  </span>
                </div>
              </div>
              {canManage && (
                <div className="mt-4 flex justify-end border-t border-slate-100 pt-3">
                  <button
                    type="button"
                    onClick={() => void handleToggle(tpl)}
                    className={`rounded-lg px-3 py-1 text-[11px] font-semibold ${
                      tpl.isActive
                        ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    {tpl.isActive ? tr('Đang kích hoạt', 'Active') : tr('Đã ẩn', 'Inactive')}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
