import { getDb, type ProjectHealthStatus, type ProjectStatus } from '@/config/database';
import { formatVND, roundCurrency } from '@/lib/portable/currency-utils';
import { formatDateVN } from '@/lib/portable/date-utils';
import { buildExcelBuffer } from '@/lib/portable/excel-exporter';
import {
  buildStructuredPdfDocument,
  generatePdfBuffer,
} from '@/lib/portable/pdf-generator';
import type { AuthContext } from '@/modules/auth/auth.service';
import {
  getProjectBudgetOverview,
  listProjectRisks,
} from '@/modules/projects/budget-risks.service';
import { listProjectMilestones } from '@/modules/projects/milestones.service';
import { assertProjectAccess } from '@/modules/projects/projects.access';
import { getProjectDetail, listProjects } from '@/modules/projects/projects.service';
import { listProjectTasks } from '@/modules/projects/tasks.service';
import { listTimeLogs } from '@/modules/projects/timelogs.service';

export interface PortfolioDashboardSummary {
  totals: {
    totalProjects: number;
    activeProjects: number;
    completedProjects: number;
    totalTasks: number;
    completedTasks: number;
    overdueTasks: number;
    onTimeRatePercent: number;
    totalPlannedBudget: number;
    totalActualCost: number;
    budgetBurnPercent: number;
    totalLoggedHours: number;
    highRiskCount: number;
  };
  byStatus: Array<{ status: ProjectStatus; count: number }>;
  byHealth: Array<{ health: ProjectHealthStatus; count: number }>;
  topRiskProjects: Array<{
    projectId: number;
    projectCode: string;
    projectName: string;
    healthStatus: ProjectHealthStatus;
    progressPercent: number;
    openHighRisks: number;
    overdueTasks: number;
  }>;
  recentSprints: Array<{
    sprintName: string;
    projectCode: string;
    committedPoints: number;
    completedPoints: number;
  }>;
}

export async function getPortfolioDashboardSummary(
  auth: AuthContext,
  branchId?: number,
): Promise<PortfolioDashboardSummary> {
  const { items: projects } = await listProjects(auth, {
    branchId: branchId !== undefined ? String(branchId) : undefined,
    limit: '200',
    page: '1',
  });

  const projectIds = projects.map((p) => p.id);
  const db = getDb();

  const statusMap = new Map<ProjectStatus, number>();
  const healthMap = new Map<ProjectHealthStatus, number>();
  let totalPlannedBudget = 0;
  let totalActualCost = 0;

  for (const p of projects) {
    statusMap.set(p.status, (statusMap.get(p.status) ?? 0) + 1);
    healthMap.set(p.healthStatus, (healthMap.get(p.healthStatus) ?? 0) + 1);
    totalPlannedBudget += p.plannedBudget;
    totalActualCost += p.actualCost;
  }

  if (projectIds.length === 0) {
    return {
      totals: {
        totalProjects: 0,
        activeProjects: 0,
        completedProjects: 0,
        totalTasks: 0,
        completedTasks: 0,
        overdueTasks: 0,
        onTimeRatePercent: 100,
        totalPlannedBudget: 0,
        totalActualCost: 0,
        budgetBurnPercent: 0,
        totalLoggedHours: 0,
        highRiskCount: 0,
      },
      byStatus: [],
      byHealth: [],
      topRiskProjects: [],
      recentSprints: [],
    };
  }

  const todayIso = new Date().toISOString().slice(0, 10);

  const [taskRows, timeAgg, riskRows, sprintRows] = await Promise.all([
    db
      .selectFrom('tasks')
      .select(['project_id', 'status_category', 'due_date', 'completed_at'])
      .where('project_id', 'in', projectIds)
      .where('deleted_at', 'is', null)
      .execute(),
    db
      .selectFrom('task_time_logs')
      .select((eb) => eb.fn.sum<string>('duration_minutes').as('totalMinutes'))
      .where('project_id', 'in', projectIds)
      .where('deleted_at', 'is', null)
      .executeTakeFirst(),
    db
      .selectFrom('project_risks')
      .select(['project_id', 'severity_score', 'status'])
      .where('project_id', 'in', projectIds)
      .where('status', 'in', ['OPEN', 'MITIGATING', 'ESCALATED'])
      .where('deleted_at', 'is', null)
      .execute(),
    db
      .selectFrom('project_sprints as s')
      .innerJoin('projects as p', 'p.id', 's.project_id')
      .select(['s.name', 'p.code as project_code', 's.committed_points', 's.completed_points'])
      .where('s.project_id', 'in', projectIds)
      .where('s.status', 'in', ['COMPLETED', 'ACTIVE'])
      .where('s.deleted_at', 'is', null)
      .orderBy('s.id', 'desc')
      .limit(8)
      .execute(),
  ]);

  let completedTasks = 0;
  let completedOnTime = 0;
  let overdueTasks = 0;
  const overdueByProject = new Map<number, number>();

  for (const t of taskRows) {
    const dueIso = t.due_date
      ? t.due_date instanceof Date
        ? t.due_date.toISOString().slice(0, 10)
        : String(t.due_date).slice(0, 10)
      : null;

    if (t.status_category === 'DONE') {
      completedTasks += 1;
      const doneIso = t.completed_at
        ? t.completed_at instanceof Date
          ? t.completed_at.toISOString().slice(0, 10)
          : String(t.completed_at).slice(0, 10)
        : todayIso;
      if (!dueIso || doneIso <= dueIso) {
        completedOnTime += 1;
      }
    } else if (dueIso && dueIso < todayIso) {
      overdueTasks += 1;
      const pid = Number(t.project_id);
      overdueByProject.set(pid, (overdueByProject.get(pid) ?? 0) + 1);
    }
  }

  let highRiskCount = 0;
  const highRisksByProject = new Map<number, number>();
  for (const r of riskRows) {
    if (Number(r.severity_score) >= 12) {
      highRiskCount += 1;
      const pid = Number(r.project_id);
      highRisksByProject.set(pid, (highRisksByProject.get(pid) ?? 0) + 1);
    }
  }

  const topRiskProjects = projects
    .map((p) => ({
      projectId: p.id,
      projectCode: p.code,
      projectName: p.name,
      healthStatus: p.healthStatus,
      progressPercent: p.progressPercent,
      openHighRisks: highRisksByProject.get(p.id) ?? 0,
      overdueTasks: overdueByProject.get(p.id) ?? 0,
    }))
    .sort(
      (a, b) =>
        b.openHighRisks * 3 +
        b.overdueTasks -
        (a.openHighRisks * 3 + a.overdueTasks),
    )
    .slice(0, 6);

  const totalLoggedHours =
    Math.round((Number(timeAgg?.totalMinutes ?? 0) / 60) * 100) / 100;
  const onTimeRatePercent =
    completedTasks > 0 ? Math.round((completedOnTime / completedTasks) * 100) : 100;
  const budgetBurnPercent =
    totalPlannedBudget > 0
      ? Math.round((totalActualCost / totalPlannedBudget) * 1000) / 10
      : 0;

  return {
    totals: {
      totalProjects: projects.length,
      activeProjects: statusMap.get('ACTIVE') ?? 0,
      completedProjects: statusMap.get('COMPLETED') ?? 0,
      totalTasks: taskRows.length,
      completedTasks,
      overdueTasks,
      onTimeRatePercent,
      totalPlannedBudget: roundCurrency(totalPlannedBudget),
      totalActualCost: roundCurrency(totalActualCost),
      budgetBurnPercent,
      totalLoggedHours,
      highRiskCount,
    },
    byStatus: Array.from(statusMap.entries()).map(([status, count]) => ({ status, count })),
    byHealth: Array.from(healthMap.entries()).map(([health, count]) => ({ health, count })),
    topRiskProjects,
    recentSprints: sprintRows
      .map((s) => ({
        sprintName: s.name,
        projectCode: s.project_code,
        committedPoints: Number(s.committed_points),
        completedPoints: Number(s.completed_points),
      }))
      .reverse(),
  };
}

export async function exportTasksToExcel(
  auth: AuthContext,
  projectIdOrCode: string | number,
): Promise<{ filename: string; buffer: Buffer }> {
  const ctx = await assertProjectAccess(auth, projectIdOrCode, 'VIEW');
  const tasks = await listProjectTasks(auth, ctx.project.id, {});

  const buffer = await buildExcelBuffer(
    tasks,
    [
      { header: 'Mã Task', key: 'taskKey', width: 16 },
      { header: 'Tiêu đề công việc', key: 'title', width: 38 },
      { header: 'Loại', key: 'taskType', width: 14 },
      { header: 'Ưu tiên', key: 'priority', width: 12 },
      { header: 'Cột trạng thái', key: 'columnName', width: 20 },
      {
        header: 'Người thực hiện',
        key: 'assignees',
        width: 26,
        value: (row) => row.assignees.map((a) => a.fullName).join(', '),
      },
      {
        header: 'Ngày bắt đầu',
        key: 'startDate',
        width: 14,
        value: (row) => (row.startDate ? formatDateVN(row.startDate) : ''),
      },
      {
        header: 'Hạn chót',
        key: 'dueDate',
        width: 14,
        value: (row) => (row.dueDate ? formatDateVN(row.dueDate) : ''),
      },
      { header: 'Ước tính (h)', key: 'estimatedHours', width: 14, align: 'right', numFmt: '0.00' },
      { header: 'Thực tế (h)', key: 'actualHours', width: 14, align: 'right', numFmt: '0.00' },
      { header: 'Tiến độ (%)', key: 'progressPercent', width: 14, align: 'right', numFmt: '0' },
    ],
    {
      sheetName: `Tasks_${ctx.project.code}`,
      title: `DANH SÁCH CÔNG VIỆC DỰ ÁN ${ctx.project.code} — ${ctx.project.name.toUpperCase()}`,
      subtitle: `Xuất lúc ${formatDateVN(new Date())}`,
    },
  );

  return {
    filename: `tasks-${ctx.project.code.toLowerCase()}.xlsx`,
    buffer,
  };
}

export async function exportTimesheetsToExcel(
  auth: AuthContext,
  filters: { projectId?: number; startDate?: string; endDate?: string },
): Promise<{ filename: string; buffer: Buffer }> {
  const logs = await listTimeLogs(auth, filters);
  const buffer = await buildExcelBuffer(
    logs,
    [
      {
        header: 'Ngày',
        key: 'loggedDate',
        width: 14,
        value: (r) => (r.loggedDate ? formatDateVN(r.loggedDate) : ''),
      },
      { header: 'Mã NV', key: 'employeeCode', width: 14 },
      { header: 'Nhân viên', key: 'employeeName', width: 24 },
      { header: 'Dự án', key: 'projectCode', width: 16 },
      { header: 'Mã Task', key: 'taskKey', width: 16 },
      { header: 'Công việc', key: 'taskTitle', width: 32 },
      {
        header: 'Số giờ',
        key: 'hours',
        width: 12,
        align: 'right',
        numFmt: '0.00',
        value: (r) => Math.round((r.durationMinutes / 60) * 100) / 100,
      },
      {
        header: 'Billable',
        key: 'isBillable',
        width: 10,
        align: 'center',
        value: (r) => (r.isBillable ? 'Có' : 'Không'),
      },
      { header: 'Chi phí ước tính (VNĐ)', key: 'estimatedCost', width: 20, align: 'right', numFmt: '#,##0' },
      { header: 'Trạng thái', key: 'approvalStatus', width: 14 },
      { header: 'Ghi chú', key: 'description', width: 30 },
    ],
    {
      sheetName: 'Timesheets',
      title: 'BẢNG TỔNG HỢP TIMESHEET DỰ ÁN',
      subtitle: `Kỳ xuất: ${filters.startDate ?? 'Tất cả'} → ${filters.endDate ?? 'Hiện tại'}`,
    },
  );

  return {
    filename: `timesheets-${new Date().toISOString().slice(0, 10)}.xlsx`,
    buffer,
  };
}

export async function exportPortfolioToExcel(
  auth: AuthContext,
  branchId?: number,
): Promise<{ filename: string; buffer: Buffer }> {
  const { items } = await listProjects(auth, {
    branchId: branchId !== undefined ? String(branchId) : undefined,
    limit: '200',
    page: '1',
  });
  const buffer = await buildExcelBuffer(
    items,
    [
      { header: 'Mã dự án', key: 'code', width: 16 },
      { header: 'Tên dự án', key: 'name', width: 34 },
      { header: 'Chi nhánh', key: 'branchName', width: 22 },
      { header: 'Quản lý (PM)', key: 'managerName', width: 22 },
      { header: 'Phương pháp', key: 'methodology', width: 14 },
      { header: 'Trạng thái', key: 'status', width: 16 },
      { header: 'Sức khỏe RAG', key: 'healthStatus', width: 14 },
      { header: 'Tiến độ (%)', key: 'progressPercent', width: 13, align: 'right', numFmt: '0.0' },
      { header: 'Ngân sách KH (VNĐ)', key: 'plannedBudget', width: 20, align: 'right', numFmt: '#,##0' },
      { header: 'Chi phí TT (VNĐ)', key: 'actualCost', width: 20, align: 'right', numFmt: '#,##0' },
    ],
    {
      sheetName: 'Portfolio',
      title: 'BÁO CÁO DANH MỤC DỰ ÁN (PORTFOLIO REPORT)',
      subtitle: `Ngày xuất: ${formatDateVN(new Date())}`,
    },
  );

  return {
    filename: `portfolio-${new Date().toISOString().slice(0, 10)}.xlsx`,
    buffer,
  };
}

export async function generateProjectStatusPdf(
  auth: AuthContext,
  projectIdOrCode: string | number,
): Promise<{ filename: string; buffer: Buffer }> {
  const project = await getProjectDetail(auth, projectIdOrCode);
  const [milestones, risks, budget] = await Promise.all([
    listProjectMilestones(auth, project.id),
    listProjectRisks(auth, project.id),
    project.canViewBudget ? getProjectBudgetOverview(auth, project.id) : Promise.resolve(null),
  ]);

  const doc = buildStructuredPdfDocument({
    companyName: 'OPERON HUB — ENTERPRISE OPERATIONS PORTAL',
    companyMeta: `Chi nhánh: ${project.branchName}${project.departmentName ? ` • Phòng ban: ${project.departmentName}` : ''}`,
    title: 'BÁO CÁO TÌNH HÌNH TRIỂN KHAI DỰ ÁN',
    subtitle: `${project.code} — ${project.name}`,
    pageSize: 'A4',
    pageOrientation: 'portrait',
    metadata: [
      { label: 'Mã dự án', value: project.code },
      { label: 'Trạng thái / RAG', value: `${project.status} (${project.healthStatus})` },
      { label: 'Chủ dự án (Sponsor)', value: project.ownerName },
      { label: 'Quản lý dự án (PM)', value: project.managerName },
      {
        label: 'Thời gian',
        value: `${project.startDate ? formatDateVN(project.startDate) : '—'} → ${project.targetEndDate ? formatDateVN(project.targetEndDate) : '—'}`,
      },
      {
        label: 'Hoàn thành công việc',
        value: `${project.completedTaskCount}/${project.taskCount} (${Math.round(project.progressPercent)}%)`,
      },
    ],
    sections: [
      {
        title: '1. Tiến độ Các Cột mốc Trọng yếu (Milestones)',
        labelHeader: 'Tên cột mốc',
        valueHeader: 'Trạng thái / Tiến độ',
        noteHeader: 'Ghi chú',
        valueAlignment: 'left',
        columnWidths: ['38%', '24%', '38%'],
        rows:
          milestones.length > 0
            ? milestones.map((m) => ({
                label: m.name,
                value: `${m.status} (${m.progressPercent}%)`,
                note: `Hạn: ${formatDateVN(m.dueDate)}${m.ownerName ? ` • PT: ${m.ownerName}` : ''}`,
              }))
            : [{ label: 'Chưa thiết lập cột mốc dự án', value: '—' }],
      },
      ...(budget
        ? [
            {
              title: '2. Tổng hợp Ngân sách & Chi phí (VNĐ)',
              labelHeader: 'Hạng mục chi phí',
              valueHeader: 'Thực tế (VNĐ)',
              noteHeader: 'Ghi chú',
              valueAlignment: 'right' as const,
              columnWidths: ['40%', '24%', '36%'] as [string, string, string],
              rows:
                budget.items.length > 0
                  ? budget.items.slice(0, 12).map((b) => ({
                      label: `[${b.category}] ${b.title}`,
                      value: formatVND(b.actualAmount),
                      note: `KH: ${formatVND(b.plannedAmount)} • ${b.status}`,
                    }))
                  : [
                      {
                        label: 'Chi phí nhân công từ Timesheet đã duyệt',
                        value: formatVND(budget.approvedLaborCost),
                        note: 'Tự động tổng hợp',
                      },
                    ],
              totalLabel: 'Tổng Chi phí Thực tế',
              totalValue: formatVND(budget.actualCost),
              totalNote: `Ngân sách KH: ${formatVND(budget.plannedBudget)}`,
            },
          ]
        : []),
      {
        title: budget ? '3. Rủi ro & Vấn đề Trọng yếu (RAID Register)' : '2. Rủi ro & Vấn đề Trọng yếu (RAID Register)',
        labelHeader: 'Mã & Nội dung rủi ro',
        valueHeader: 'Mức độ (P×I)',
        noteHeader: 'Ghi chú',
        valueAlignment: 'right',
        columnWidths: ['42%', '22%', '36%'],
        rows:
          risks.length > 0
            ? risks.slice(0, 10).map((r) => ({
                label: `[${r.code}] ${r.title}`,
                value: `${r.severityScore}/25 (${r.probability}×${r.impact})`,
                note: `${r.itemType} • ${r.status}${r.ownerName ? ` • ${r.ownerName}` : ''}`,
                isBold: r.severityScore >= 15,
              }))
            : [{ label: 'Không ghi nhận rủi ro/vấn đề tồn đọng', value: 'An toàn' }],
      },
    ],
    highlight: {
      label: 'TỔNG TIẾN ĐỘ DỰ ÁN HIỆN TẠI',
      subtext: `Ngày xuất báo cáo: ${formatDateVN(new Date())} • Phương pháp: ${project.methodology}`,
      value: `${Math.round(project.progressPercent)}%`,
    },
    footnote: 'Tài liệu được xuất tự động từ hệ thống Operon Hub Project Management.',
    signatureSectionTitle: 'XÁC NHẬN BÁO CÁO DỰ ÁN',
    signatures: [
      {
        stepLabel: 'LẬP BÁO CÁO',
        title: 'QUẢN LÝ DỰ ÁN (PM)',
        roleTitle: project.branchName,
        subtitle: '(Ký, ghi rõ họ tên)',
        name: project.managerName,
      },
      {
        stepLabel: 'BẢO TRỢ DỰ ÁN',
        title: 'CHỦ SỞ HỮU DỰ ÁN (SPONSOR)',
        roleTitle: project.departmentName ?? project.branchName,
        subtitle: '(Ký, ghi rõ họ tên)',
        name: project.ownerName,
      },
      {
        stepLabel: 'PHÊ DUYỆT',
        title: 'BAN GIÁM ĐỐC / PMO',
        roleTitle: 'Kiểm duyệt & xác nhận',
        subtitle: '(Ký duyệt & đóng dấu)',
      },
    ],
  });

  const buffer = await generatePdfBuffer(doc);
  return {
    filename: `status-report-${project.code.toLowerCase()}.pdf`,
    buffer,
  };
}
