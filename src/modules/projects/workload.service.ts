import { getDb } from '@/config/database';
import {
  computeWorkloadMatrix,
  type WorkloadMatrixResult,
} from '@/lib/portable/workload-calculator';
import type { AuthContext } from '@/modules/auth/auth.service';
import {
  assertProjectAccess,
  resolveEmployeeForUser,
} from '@/modules/projects/projects.access';
import { DEFAULT_DAILY_WORK_CAPACITY_HOURS } from '@/modules/projects/projects.constants';

function toIsoDate(val: Date | string | null | undefined): string | null {
  if (!val) return null;
  return val instanceof Date ? val.toISOString().slice(0, 10) : String(val).slice(0, 10);
}

/**
 * Đọc kết hợp (Read-Only) Tasks + Project Members + HRM Holidays + HRM Approved Leave Requests
 * để tính Workload Heatmap không làm ảnh hưởng dữ liệu HRM.
 */
export async function getWorkloadHeatmap(
  auth: AuthContext,
  params: {
    startDate: string;
    endDate: string;
    projectId?: number;
    departmentId?: number;
    branchId?: number;
  },
): Promise<WorkloadMatrixResult> {
  const db = getDb();
  const currentEmp = await resolveEmployeeForUser(auth.userId);

  let scopedEmployeeIds: number[] | null = null;
  if (params.projectId) {
    const ctx = await assertProjectAccess(auth, params.projectId, 'VIEW');
    const members = await db
      .selectFrom('project_members')
      .select(['employee_id'])
      .where('project_id', '=', ctx.project.id)
      .where('deleted_at', 'is', null)
      .where('left_at', 'is', null)
      .execute();
    scopedEmployeeIds = members.map((m) => Number(m.employee_id));
    if (scopedEmployeeIds.length === 0) {
      return computeWorkloadMatrix({
        startDate: params.startDate,
        endDate: params.endDate,
        employees: [],
        tasks: [],
      });
    }
  }

  let empQuery = db
    .selectFrom('employees as e')
    .leftJoin('departments as d', 'd.id', 'e.department_id')
    .select([
      'e.id',
      'e.employee_code',
      'e.full_name',
      'e.branch_id',
      'e.department_id',
      'd.name as department_name',
      'd.name_en as department_name_en',
    ])
    .where('e.deleted_at', 'is', null)
    .where('e.employment_status', 'in', ['ACTIVE', 'PROBATION']);

  if (scopedEmployeeIds) {
    empQuery = empQuery.where('e.id', 'in', scopedEmployeeIds);
  } else if (!auth.isSuperAdmin && auth.dataScope === 'OWN') {
    if (!currentEmp) {
      return computeWorkloadMatrix({
        startDate: params.startDate,
        endDate: params.endDate,
        employees: [],
        tasks: [],
      });
    }
    empQuery = empQuery.where('e.id', '=', currentEmp.id);
  } else if (!auth.isSuperAdmin && auth.dataScope === 'DEPARTMENT' && currentEmp?.departmentId) {
    empQuery = empQuery.where('e.department_id', '=', currentEmp.departmentId);
  } else if (!auth.isSuperAdmin && auth.dataScope === 'BRANCH') {
    const branchIds =
      auth.branchIds.length > 0
        ? auth.branchIds
        : currentEmp
          ? [currentEmp.branchId]
          : [];
    if (branchIds.length > 0) {
      empQuery = empQuery.where('e.branch_id', 'in', branchIds);
    }
  }

  if (params.departmentId) {
    empQuery = empQuery.where('e.department_id', '=', params.departmentId);
  }
  if (params.branchId) {
    empQuery = empQuery.where('e.branch_id', '=', params.branchId);
  }

  const employees = await empQuery.orderBy('e.full_name', 'asc').limit(120).execute();
  if (employees.length === 0) {
    return computeWorkloadMatrix({
      startDate: params.startDate,
      endDate: params.endDate,
      employees: [],
      tasks: [],
    });
  }

  const empIds = employees.map((e) => Number(e.id));

  let tasksQuery = db
    .selectFrom('tasks as t')
    .innerJoin('projects as p', 'p.id', 't.project_id')
    .innerJoin('task_assignees as ta', 'ta.task_id', 't.id')
    .select([
      't.id',
      't.task_key',
      't.title',
      't.project_id',
      'p.code as project_code',
      't.start_date',
      't.due_date',
      't.estimated_hours',
      'ta.employee_id',
    ])
    .where('t.deleted_at', 'is', null)
    .where('p.deleted_at', 'is', null)
    .where('t.status_category', '<>', 'DONE')
    .where('ta.employee_id', 'in', empIds);

  if (params.projectId) {
    tasksQuery = tasksQuery.where('t.project_id', '=', params.projectId);
  }

  const [taskAssigneeRows, holidayRows, leaveRows] = await Promise.all([
    tasksQuery.execute(),
    db
      .selectFrom('holidays')
      .select(['holiday_date'])
      .where('deleted_at', 'is', null)
      .where('holiday_date', '>=', params.startDate)
      .where('holiday_date', '<=', params.endDate)
      .execute(),
    db
      .selectFrom('leave_requests')
      .select(['employee_id', 'start_date', 'end_date', 'start_session', 'end_session'])
      .where('deleted_at', 'is', null)
      .where('status', '=', 'APPROVED')
      .where('employee_id', 'in', empIds)
      .where('end_date', '>=', params.startDate)
      .where('start_date', '<=', params.endDate)
      .execute(),
  ]);

  const taskMap = new Map<
    number,
    {
      taskId: number;
      taskKey: string;
      title: string;
      projectId: number;
      projectCode: string;
      startDate: string | null;
      dueDate: string | null;
      estimatedHours: number;
      assigneeEmployeeIds: number[];
    }
  >();

  for (const r of taskAssigneeRows) {
    const tid = Number(r.id);
    const existing = taskMap.get(tid);
    if (existing) {
      existing.assigneeEmployeeIds.push(Number(r.employee_id));
    } else {
      taskMap.set(tid, {
        taskId: tid,
        taskKey: r.task_key,
        title: r.title,
        projectId: Number(r.project_id),
        projectCode: r.project_code,
        startDate: toIsoDate(r.start_date),
        dueDate: toIsoDate(r.due_date),
        estimatedHours: Number(r.estimated_hours) || 4,
        assigneeEmployeeIds: [Number(r.employee_id)],
      });
    }
  }

  return computeWorkloadMatrix({
    startDate: params.startDate,
    endDate: params.endDate,
    defaultDailyCapacityHours: DEFAULT_DAILY_WORK_CAPACITY_HOURS,
    employees: employees.map((e) => ({
      employeeId: Number(e.id),
      employeeCode: e.employee_code,
      fullName: e.full_name,
      departmentName: e.department_name ?? null,
      departmentNameEn: e.department_name_en ?? null,
      dailyCapacityHours: DEFAULT_DAILY_WORK_CAPACITY_HOURS,
    })),
    tasks: Array.from(taskMap.values()),
    holidayDates: holidayRows.map((h) => toIsoDate(h.holiday_date) ?? '').filter(Boolean),
    approvedLeaves: leaveRows.map((l) => ({
      employeeId: Number(l.employee_id),
      startDate: toIsoDate(l.start_date) ?? '',
      endDate: toIsoDate(l.end_date) ?? '',
      startSession: l.start_session,
      endSession: l.end_session,
    })),
  });
}
