'use client';

import { useEffect, useState } from 'react';
import {
  IconAlertTriangle,
  IconArrowRight,
  IconCash,
  IconPlus,
  IconSend,
} from '@tabler/icons-react';
import {
  SkeletonFormFields,
  SkeletonKpiGrid,
  SkeletonTable,
  SkeletonText,
} from '@/components/ui/Skeleton';
import type { ProjectBudgetCategory, ProjectRiskItemType } from '@/config/database';
import { formatVND } from '@/lib/portable/currency-utils';
import type {
  ProjectBudgetOverview,
  ProjectRiskItemView,
} from '@/modules/projects/budget-risks.service';
import { useI18n } from '@/shared/i18n/I18nContext';

interface ProjectBudgetRisksPanelProps {
  projectId: number;
  mode: 'budget' | 'risks';
  canViewBudget: boolean;
  canManage: boolean;
  canEditTasks: boolean;
  onSelectTask?: (taskId: number) => void;
}

export function ProjectBudgetRisksPanel({
  projectId,
  mode,
  canViewBudget,
  canManage,
  canEditTasks,
  onSelectTask,
}: ProjectBudgetRisksPanelProps) {
  const { tr } = useI18n();
  const [budget, setBudget] = useState<ProjectBudgetOverview | null>(null);
  const [risks, setRisks] = useState<ProjectRiskItemView[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Budget form
  const [bCat, setBCat] = useState<ProjectBudgetCategory>('VENDOR');
  const [bTitle, setBTitle] = useState('');
  const [bPlanned, setBPlanned] = useState('');
  const [bActual, setBActual] = useState('');

  // Risk form
  const [rType, setRType] = useState<ProjectRiskItemType>('RISK');
  const [rTitle, setRTitle] = useState('');
  const [rProb, setRProb] = useState(3);
  const [rImpact, setRImpact] = useState(3);
  const [rPlan, setRPlan] = useState('');
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        if (mode === 'budget' && canViewBudget) {
          const res = await fetch(`/api/v1/projects/${projectId}/budget-items`, {
            signal: controller.signal,
          });
          const json = (await res.json().catch(() => null)) as {
            success?: boolean;
            data?: ProjectBudgetOverview;
          } | null;
          if (json?.success && json.data) setBudget(json.data);
        } else if (mode === 'risks') {
          const res = await fetch(`/api/v1/projects/${projectId}/risks`, {
            signal: controller.signal,
          });
          const json = (await res.json().catch(() => null)) as {
            success?: boolean;
            data?: ProjectRiskItemView[];
          } | null;
          if (json?.success && json.data) setRisks(json.data);
        }
      } catch {
        // Ignore abort
      } finally {
        setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [projectId, mode, canViewBudget, reloadTick]);

  function loadData() {
    setReloadTick((n) => n + 1);
  }

  async function handleAddBudgetItem(e: React.FormEvent) {
    e.preventDefault();
    if (!bTitle.trim() || busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/budget-items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: bCat,
          title: bTitle.trim(),
          plannedAmount: Number(bPlanned) || 0,
          actualAmount: Number(bActual) || 0,
        }),
      });
      const json = (await res.json().catch(() => null)) as {
        success?: boolean;
        data?: ProjectBudgetOverview;
      } | null;
      if (res.ok && json?.success && json.data) {
        setBudget(json.data);
        setBTitle('');
        setBPlanned('');
        setBActual('');
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleRequestBudgetApproval(itemId: number) {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/v1/projects/${projectId}/budget-items/${itemId}/request-approval`,
        { method: 'POST' },
      );
      const json = (await res.json().catch(() => null)) as {
        success?: boolean;
        data?: ProjectBudgetOverview;
      } | null;
      if (res.ok && json?.success && json.data) {
        setBudget(json.data);
        setMsg(
          tr(
            'Đã trình duyệt điều chỉnh ngân sách sang Core Approval Engine.',
            'Budget item submitted to Core Approval Engine.',
          ),
        );
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleAddRisk(e: React.FormEvent) {
    e.preventDefault();
    if (!rTitle.trim() || busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/risks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemType: rType,
          title: rTitle.trim(),
          probability: rProb,
          impact: rImpact,
          mitigationPlan: rPlan.trim() || null,
        }),
      });
      if (res.ok) {
        setRTitle('');
        setRPlan('');
        await loadData();
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleConvertRiskToTask(riskId: number) {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/risks/${riskId}/create-task`, {
        method: 'POST',
      });
      if (res.ok) {
        setMsg(
          tr(
            'Đã tạo Công việc khắc phục và liên kết với mục RAID.',
            'Action task created and linked to this RAID item.',
          ),
        );
        await loadData();
      }
    } finally {
      setBusy(false);
    }
  }

  if (mode === 'budget' && !canViewBudget) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center text-xs font-medium text-amber-800">
        {tr('Bạn không có quyền xem dữ liệu ngân sách nhạy cảm của dự án này.', 'You do not have permission to view project budget data.')}
      </div>
    );
  }

  if (loading) {
    if (mode === 'budget') {
      return (
        <div className="space-y-4">
          <SkeletonKpiGrid
            count={4}
            compact
            columnsClass="grid-cols-2 gap-3 lg:grid-cols-4"
          />
          <SkeletonTable rows={5} columns={7} showToolbar={false} showPagination={false} />
        </div>
      );
    }
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 lg:col-span-5">
            <SkeletonText lines={4} />
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 lg:col-span-7">
            <SkeletonFormFields fields={4} columns={2} />
          </div>
        </div>
        <SkeletonTable rows={5} columns={6} showToolbar={false} showPagination={false} />
      </div>
    );
  }

  if (mode === 'budget' && budget) {
    return (
      <div className="space-y-4">
        {msg && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-xs text-blue-800">
            {msg}
          </div>
        )}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-[11px] font-medium text-slate-500">{tr('Ngân sách kế hoạch', 'Planned Budget')}</p>
            <p className="mt-1 text-lg font-bold text-slate-900">{formatVND(budget.plannedBudget)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-[11px] font-medium text-slate-500">{tr('Chi phí thực tế', 'Actual Cost')}</p>
            <p className="mt-1 text-lg font-bold text-blue-700">{formatVND(budget.actualCost)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-[11px] font-medium text-slate-500">{tr('Nhân công (Timesheet đã duyệt)', 'Approved Labor Cost')}</p>
            <p className="mt-1 text-lg font-bold text-emerald-700">{formatVND(budget.approvedLaborCost)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-[11px] font-medium text-slate-500">{tr('Tỉ lệ giải ngân (Burn Rate)', 'Burn Rate')}</p>
            <p className={`mt-1 text-lg font-bold ${budget.evm.burnRatePercent > 100 ? 'text-rose-600' : 'text-slate-900'}`}>
              {budget.evm.burnRatePercent}%
            </p>
          </div>
        </div>

        {canManage && (
          <form
            onSubmit={(e) => void handleAddBudgetItem(e)}
            className="grid grid-cols-1 gap-2 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-12"
          >
            <select
              value={bCat}
              onChange={(e) => setBCat(e.target.value as ProjectBudgetCategory)}
              className="rounded-xl border border-slate-200 px-2.5 py-1.5 text-xs md:col-span-2"
            >
              <option value="LABOR">LABOR</option>
              <option value="VENDOR">VENDOR</option>
              <option value="INFRA">INFRA</option>
              <option value="SOFTWARE">SOFTWARE</option>
              <option value="TRAVEL">TRAVEL</option>
              <option value="OTHER">OTHER</option>
            </select>
            <input
              type="text"
              required
              value={bTitle}
              onChange={(e) => setBTitle(e.target.value)}
              placeholder={tr('Tên hạng mục chi phí...', 'Budget item title...')}
              className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs md:col-span-4"
            />
            <input
              type="number"
              min="0"
              value={bPlanned}
              onChange={(e) => setBPlanned(e.target.value)}
              placeholder={tr('Kế hoạch (VNĐ)', 'Planned (VND)')}
              className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs md:col-span-2"
            />
            <input
              type="number"
              min="0"
              value={bActual}
              onChange={(e) => setBActual(e.target.value)}
              placeholder={tr('Thực chi (VNĐ)', 'Actual (VND)')}
              className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs md:col-span-2"
            />
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center justify-center gap-1 rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 md:col-span-2"
            >
              <IconPlus size={14} />
              {tr('Thêm mục', 'Add Item')}
            </button>
          </form>
        )}

        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-600">
              <tr>
                <th className="px-4 py-2.5">{tr('Nhóm', 'Category')}</th>
                <th className="px-4 py-2.5">{tr('Hạng mục', 'Title')}</th>
                <th className="px-4 py-2.5 text-right">{tr('Kế hoạch', 'Planned')}</th>
                <th className="px-4 py-2.5 text-right">{tr('Thực tế', 'Actual')}</th>
                <th className="px-4 py-2.5 text-right">{tr('Chênh lệch', 'Variance')}</th>
                <th className="px-4 py-2.5">{tr('Trạng thái', 'Status')}</th>
                <th className="px-4 py-2.5 text-right">{tr('Thao tác', 'Action')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {budget.items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    <IconCash size={20} className="mx-auto mb-1 text-slate-300" />
                    {tr('Chưa có hạng mục ngân sách chi tiết.', 'No budget line items yet.')}
                  </td>
                </tr>
              ) : (
                budget.items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-2.5 font-mono font-semibold text-slate-600">{item.category}</td>
                    <td className="px-4 py-2.5 font-medium text-slate-900">{item.title}</td>
                    <td className="px-4 py-2.5 text-right">{formatVND(item.plannedAmount)}</td>
                    <td className="px-4 py-2.5 text-right font-semibold">{formatVND(item.actualAmount)}</td>
                    <td
                      className={`px-4 py-2.5 text-right font-semibold ${
                        item.variance < 0 ? 'text-rose-600' : 'text-emerald-700'
                      }`}
                    >
                      {formatVND(item.variance)}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                        {item.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {canManage && item.status === 'PLANNED' && (
                        <button
                          type="button"
                          onClick={() => void handleRequestBudgetApproval(item.id)}
                          className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-800 hover:bg-amber-100"
                        >
                          <IconSend size={12} />
                          {tr('Trình duyệt', 'Submit')}
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // Risks & RAID 5x5 Matrix Mode
  return (
    <div className="space-y-4">
      {msg && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-xs text-blue-800">
          {msg}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* 5x5 Risk Matrix */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 lg:col-span-5">
          <h4 className="mb-3 flex items-center gap-1.5 text-sm font-bold text-slate-900">
            <IconAlertTriangle size={16} className="text-amber-500" />
            {tr('Ma trận Rủi ro 5×5 (Xác suất × Tác động)', '5×5 Risk Matrix (Prob × Impact)')}
          </h4>
          <div className="grid grid-cols-5 gap-1">
            {[5, 4, 3, 2, 1].map((prob) =>
              [1, 2, 3, 4, 5].map((imp) => {
                const score = prob * imp;
                const count = risks.filter(
                  (r) =>
                    r.probability === prob &&
                    r.impact === imp &&
                    r.status !== 'CLOSED' &&
                    r.status !== 'RESOLVED',
                ).length;
                const bg =
                  score >= 15
                    ? 'bg-rose-500 text-white'
                    : score >= 9
                      ? 'bg-amber-400 text-slate-900'
                      : score >= 5
                        ? 'bg-yellow-200 text-slate-800'
                        : 'bg-emerald-100 text-emerald-900';
                return (
                  <div
                    key={`${prob}-${imp}`}
                    className={`flex h-12 flex-col items-center justify-center rounded-lg text-xs font-bold ${bg}`}
                    title={`P=${prob} × I=${imp} = ${score}`}
                  >
                    <span>{count > 0 ? count : ''}</span>
                    <span className="text-[9px] opacity-75">{score}</span>
                  </div>
                );
              }),
            )}
          </div>
        </div>

        {/* Add Risk Form */}
        {canEditTasks && (
          <form
            onSubmit={(e) => void handleAddRisk(e)}
            className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 lg:col-span-7"
          >
            <h4 className="text-sm font-bold text-slate-900">
              {tr('Ghi nhận Rủi ro / Vấn đề mới (RAID)', 'Log New Risk / Issue')}
            </h4>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <select
                value={rType}
                onChange={(e) => setRType(e.target.value as ProjectRiskItemType)}
                className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs"
              >
                <option value="RISK">{tr('Rủi ro tiềm ẩn (RISK)', 'Risk (RISK)')}</option>
                <option value="ISSUE">{tr('Vấn đề phát sinh (ISSUE)', 'Issue (ISSUE)')}</option>
              </select>
              <select
                value={rProb}
                onChange={(e) => setRProb(Number(e.target.value))}
                className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs"
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {tr('Xác suất', 'Probability')}: {n}/5
                  </option>
                ))}
              </select>
              <select
                value={rImpact}
                onChange={(e) => setRImpact(Number(e.target.value))}
                className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs"
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {tr('Tác động', 'Impact')}: {n}/5
                  </option>
                ))}
              </select>
            </div>
            <input
              type="text"
              required
              value={rTitle}
              onChange={(e) => setRTitle(e.target.value)}
              placeholder={tr('Tiêu đề rủi ro hoặc vấn đề...', 'Risk or issue title...')}
              className="w-full rounded-xl border border-slate-200 px-3 py-1.5 text-xs"
            />
            <textarea
              rows={2}
              value={rPlan}
              onChange={(e) => setRPlan(e.target.value)}
              placeholder={tr('Phương án phòng ngừa / khắc phục...', 'Mitigation or action plan...')}
              className="w-full rounded-xl border border-slate-200 px-3 py-1.5 text-xs"
            />
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
            >
              <IconPlus size={14} />
              {tr('Ghi nhận RAID', 'Add RAID Item')}
            </button>
          </form>
        )}
      </div>

      {/* RAID Table */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-600">
            <tr>
              <th className="px-4 py-2.5">{tr('Mã', 'Code')}</th>
              <th className="px-4 py-2.5">{tr('Loại', 'Type')}</th>
              <th className="px-4 py-2.5">{tr('Tiêu đề & Phương án', 'Title & Mitigation')}</th>
              <th className="px-4 py-2.5 text-center">{tr('Điểm (P×I)', 'Score')}</th>
              <th className="px-4 py-2.5">{tr('Trạng thái', 'Status')}</th>
              <th className="px-4 py-2.5 text-right">{tr('Task khắc phục', 'Action Task')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {risks.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  {tr('Chưa ghi nhận rủi ro hoặc vấn đề nào.', 'No risks or issues logged yet.')}
                </td>
              </tr>
            ) : (
              risks.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-2.5 font-mono font-bold text-slate-600">{r.code}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        r.itemType === 'ISSUE'
                          ? 'bg-rose-100 text-rose-700'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {r.itemType}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <p className="font-semibold text-slate-900">{r.title}</p>
                    {r.mitigationPlan && (
                      <p className="mt-0.5 text-[11px] text-slate-500">{r.mitigationPlan}</p>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <span
                      className={`rounded-lg px-2 py-0.5 font-bold ${
                        r.severityScore >= 15
                          ? 'bg-rose-100 text-rose-700'
                          : r.severityScore >= 9
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      {r.severityScore} ({r.probability}×{r.impact})
                    </span>
                  </td>
                  <td className="px-4 py-2.5 font-semibold text-slate-700">{r.status}</td>
                  <td className="px-4 py-2.5 text-right">
                    {r.linkedTaskId ? (
                      <button
                        type="button"
                        onClick={() => onSelectTask?.(r.linkedTaskId!)}
                        className="font-mono font-bold text-blue-600 hover:underline"
                      >
                        {r.linkedTaskKey ?? `#${r.linkedTaskId}`}
                      </button>
                    ) : (
                      canEditTasks && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void handleConvertRiskToTask(r.id)}
                          className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-100"
                        >
                          {tr('Tạo Task', 'Create Task')}
                          <IconArrowRight size={12} />
                        </button>
                      )
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
