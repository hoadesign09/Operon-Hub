/**
 * Thuật toán tính ma trận phân bổ nguồn lực (Workload Heatmap) thuần túy, loại trừ cuối tuần, ngày lễ và nghỉ phép.
 *
 * Dependencies: dayjs (MIT)
 * Input / Output:
 *   - computeWorkloadMatrix(input) => WorkloadMatrixResult
 *
 * Ví dụ:
 * ```ts
 * const matrix = computeWorkloadMatrix({
 *   startDate: '2026-11-23',
 *   endDate: '2026-11-29',
 *   employees: [{ employeeId: 1, fullName: 'Nguyễn Văn A', dailyCapacityHours: 8 }],
 *   tasks: [{ taskId: 10, taskKey: 'PRJ-1', title: 'Build API', assigneeEmployeeIds: [1], startDate: '2026-11-23', dueDate: '2026-11-25', estimatedHours: 18 }],
 *   holidayDates: ['2026-11-26'],
 *   approvedLeaves: [],
 * });
 * ```
 */

import dayjs from 'dayjs';

export interface WorkloadEmployeeInput {
  employeeId: number;
  fullName: string;
  employeeCode?: string;
  departmentName?: string | null;
  departmentNameEn?: string | null;
  dailyCapacityHours?: number;
  weekendDays?: readonly number[]; // 0=Sun, 6=Sat
}

export interface WorkloadTaskInput {
  taskId: number;
  taskKey: string;
  title: string;
  projectId?: number;
  projectCode?: string;
  assigneeEmployeeIds: readonly number[];
  startDate: string | null;
  dueDate: string | null;
  estimatedHours: number;
}

export interface WorkloadLeaveInput {
  employeeId: number;
  startDate: string;
  endDate: string;
  startSession?: 'FULL' | 'AM' | 'PM';
  endSession?: 'FULL' | 'AM' | 'PM';
}

export interface WorkloadMatrixInput {
  startDate: string;
  endDate: string;
  employees: readonly WorkloadEmployeeInput[];
  tasks: readonly WorkloadTaskInput[];
  holidayDates?: readonly string[];
  approvedLeaves?: readonly WorkloadLeaveInput[];
  defaultDailyCapacityHours?: number;
}

export type WorkloadHeatLevel = 'OFF' | 'IDLE' | 'UNDER' | 'OPTIMAL' | 'OVERLOADED';

export interface WorkloadDayCell {
  date: string;
  capacityHours: number;
  allocatedHours: number;
  utilizationPercent: number;
  heatLevel: WorkloadHeatLevel;
  isWeekend: boolean;
  isHoliday: boolean;
  leaveHours: number;
  taskRefs: Array<{ taskId: number; taskKey: string; title: string; hours: number }>;
}

export interface WorkloadEmployeeRow {
  employeeId: number;
  fullName: string;
  employeeCode: string;
  departmentName: string | null;
  departmentNameEn?: string | null;
  totalCapacityHours: number;
  totalAllocatedHours: number;
  utilizationPercent: number;
  overloadedDays: number;
  days: WorkloadDayCell[];
}

export interface WorkloadMatrixResult {
  dates: string[];
  rows: WorkloadEmployeeRow[];
  summary: {
    employeeCount: number;
    overloadedEmployeeCount: number;
    averageUtilizationPercent: number;
  };
}

function roundTwo(value: number): number {
  return Math.round(value * 100) / 100;
}

function enumerateIsoDates(startIso: string, endIso: string): string[] {
  const start = dayjs(startIso.slice(0, 10));
  const end = dayjs(endIso.slice(0, 10));
  if (!start.isValid() || !end.isValid() || end.isBefore(start, 'day')) {
    return [];
  }
  const dates: string[] = [];
  let cursor = start;
  let guard = 0;
  while ((cursor.isBefore(end, 'day') || cursor.isSame(end, 'day')) && guard < 120) {
    dates.push(cursor.format('YYYY-MM-DD'));
    cursor = cursor.add(1, 'day');
    guard += 1;
  }
  return dates;
}

function getLeaveFractionForDay(leave: WorkloadLeaveInput, dateIso: string): number {
  const s = leave.startDate.slice(0, 10);
  const e = leave.endDate.slice(0, 10);
  if (dateIso < s || dateIso > e) {
    return 0;
  }
  if (s === e) {
    if (leave.startSession === 'AM' || leave.startSession === 'PM') {
      return 0.5;
    }
    return 1;
  }
  if (dateIso === s && leave.startSession === 'PM') {
    return 0.5;
  }
  if (dateIso === e && leave.endSession === 'AM') {
    return 0.5;
  }
  return 1;
}

function classifyHeatLevel(capacity: number, allocated: number): WorkloadHeatLevel {
  if (capacity <= 0) {
    return allocated > 0 ? 'OVERLOADED' : 'OFF';
  }
  if (allocated <= 0) {
    return 'IDLE';
  }
  const pct = (allocated / capacity) * 100;
  if (pct > 100) {
    return 'OVERLOADED';
  }
  if (pct >= 60) {
    return 'OPTIMAL';
  }
  return 'UNDER';
}

export function computeWorkloadMatrix(input: WorkloadMatrixInput): WorkloadMatrixResult {
  const dates = enumerateIsoDates(input.startDate, input.endDate);
  const holidaySet = new Set((input.holidayDates ?? []).map((d) => d.slice(0, 10)));
  const defaultCap = input.defaultDailyCapacityHours ?? 8;

  const leavesByEmp = new Map<number, WorkloadLeaveInput[]>();
  for (const leave of input.approvedLeaves ?? []) {
    const list = leavesByEmp.get(leave.employeeId) ?? [];
    list.push(leave);
    leavesByEmp.set(leave.employeeId, list);
  }

  const rows: WorkloadEmployeeRow[] = input.employees.map((emp) => {
    const weekendSet = new Set(emp.weekendDays ?? [0, 6]);
    const baseCap = emp.dailyCapacityHours ?? defaultCap;
    const empLeaves = leavesByEmp.get(emp.employeeId) ?? [];

    const dayCells = new Map<string, WorkloadDayCell>();
    for (const dateIso of dates) {
      const dow = dayjs(dateIso).day();
      const isWeekend = weekendSet.has(dow);
      const isHoliday = holidaySet.has(dateIso);
      let leaveFraction = 0;
      if (!isWeekend && !isHoliday) {
        for (const leave of empLeaves) {
          leaveFraction = Math.min(1, leaveFraction + getLeaveFractionForDay(leave, dateIso));
        }
      }
      const leaveHours = roundTwo(baseCap * leaveFraction);
      const capacityHours = isWeekend || isHoliday ? 0 : roundTwo(Math.max(0, baseCap - leaveHours));
      dayCells.set(dateIso, {
        date: dateIso,
        capacityHours,
        allocatedHours: 0,
        utilizationPercent: 0,
        heatLevel: capacityHours <= 0 ? 'OFF' : 'IDLE',
        isWeekend,
        isHoliday,
        leaveHours,
        taskRefs: [],
      });
    }

    // Distribute open tasks assigned to this employee across working days in the range
    for (const task of input.tasks) {
      if (!task.assigneeEmployeeIds.includes(emp.employeeId)) {
        continue;
      }
      const hoursPerAssignee =
        task.assigneeEmployeeIds.length > 0
          ? Math.max(0, Number(task.estimatedHours) || 0) / task.assigneeEmployeeIds.length
          : 0;
      if (hoursPerAssignee <= 0) {
        continue;
      }

      const rawStart = task.startDate?.slice(0, 10) ?? task.dueDate?.slice(0, 10) ?? dates[0];
      const rawEnd = task.dueDate?.slice(0, 10) ?? task.startDate?.slice(0, 10) ?? rawStart;
      if (!rawStart || !rawEnd) {
        continue;
      }
      const taskDates = enumerateIsoDates(rawStart, rawEnd > rawStart ? rawEnd : rawStart);
      const workingTaskDates = taskDates.filter((d) => {
        const dow = dayjs(d).day();
        return !weekendSet.has(dow) && !holidaySet.has(d);
      });
      const activeDates = workingTaskDates.length > 0 ? workingTaskDates : taskDates;
      if (activeDates.length === 0) {
        continue;
      }

      const hoursPerDay = hoursPerAssignee / activeDates.length;
      for (const dateIso of activeDates) {
        const cell = dayCells.get(dateIso);
        if (!cell) {
          continue;
        }
        cell.allocatedHours = roundTwo(cell.allocatedHours + hoursPerDay);
        cell.taskRefs.push({
          taskId: task.taskId,
          taskKey: task.taskKey,
          title: task.title,
          hours: roundTwo(hoursPerDay),
        });
      }
    }

    let totalCapacity = 0;
    let totalAllocated = 0;
    let overloadedDays = 0;

    const daysList: WorkloadDayCell[] = dates.map((d) => {
      const cell = dayCells.get(d)!;
      cell.utilizationPercent =
        cell.capacityHours > 0
          ? roundTwo((cell.allocatedHours / cell.capacityHours) * 100)
          : cell.allocatedHours > 0
            ? 150
            : 0;
      cell.heatLevel = classifyHeatLevel(cell.capacityHours, cell.allocatedHours);
      totalCapacity += cell.capacityHours;
      totalAllocated += cell.allocatedHours;
      if (cell.heatLevel === 'OVERLOADED') {
        overloadedDays += 1;
      }
      return cell;
    });

    const overallUtil =
      totalCapacity > 0
        ? roundTwo((totalAllocated / totalCapacity) * 100)
        : totalAllocated > 0
          ? 150
          : 0;

    return {
      employeeId: emp.employeeId,
      fullName: emp.fullName,
      employeeCode: emp.employeeCode ?? '',
      departmentName: emp.departmentName ?? null,
      departmentNameEn: emp.departmentNameEn ?? null,
      totalCapacityHours: roundTwo(totalCapacity),
      totalAllocatedHours: roundTwo(totalAllocated),
      utilizationPercent: overallUtil,
      overloadedDays,
      days: daysList,
    };
  });

  const overloadedEmployeeCount = rows.filter(
    (r) => r.utilizationPercent > 100 || r.overloadedDays > 0,
  ).length;
  const averageUtilizationPercent =
    rows.length > 0
      ? roundTwo(rows.reduce((sum, r) => sum + r.utilizationPercent, 0) / rows.length)
      : 0;

  return {
    dates,
    rows,
    summary: {
      employeeCount: rows.length,
      overloadedEmployeeCount,
      averageUtilizationPercent,
    },
  };
}
