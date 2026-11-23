import {
  getDb,
  type AnnouncementCategory,
  type AttendanceStatus,
  type EmploymentStatus,
  type PayrollPeriodStatus,
} from '@/config/database';
import { roundCurrency } from '@/lib/portable/currency-utils';
import type { AuthContext } from '@/modules/auth/auth.service';
import {
  buildAttendanceBreakdown,
  buildEmploymentStatusDistribution,
  computeDaysRemaining,
  computePercentage,
  formatPeriodMonthLabel,
  resolveDashboardVisibility,
  type AttendanceStatusDatum,
  type DashboardVisibility,
  type HeadcountStatusDatum,
} from '@/modules/hrm/dashboard/dashboard-metrics';
import {
  resolveEmployeeAccessScope,
  type EmployeeAccessScope,
} from '@/modules/hrm/employees/employees.scope';
import { formatMysqlDateTime } from '@/modules/hrm/office/room-booking-validator';
import { AppError } from '@/shared/api-response';

const WORKING_STATUSES: EmploymentStatus[] = ['ACTIVE', 'PROBATION', 'ON_LEAVE'];

export interface DashboardSummaryData {
  period: { year: number; month: number };
  scopeMode: EmployeeAccessScope['mode'];
  visibility: DashboardVisibility;
  kpis: {
    workforce: {
      activeEmployees: number;
      probationCount: number;
      newHiresThisMonth: number;
    } | null;
    expiringContractsCount: number | null;
    pendingApprovalsCount: number;
    attendance: {
      totalLogs: number;
      presentCount: number;
      lateCount: number;
      lateRatePercent: number;
    };
    latestPayroll: {
      id: number;
      code: string;
      name: string;
      year: number;
      month: number;
      status: PayrollPeriodStatus;
      totalEmployees: number;
      totalGross: number;
      totalNet: number;
    } | null;
    assets: {
      total: number;
      assigned: number;
      available: number;
      offboardingAlertsCount: number;
    } | null;
    office: {
      todayBookingsCount: number;
      unreadAnnouncementsCount: number;
    };
  };
  charts: {
    headcountByDepartment: Array<{
      departmentId: number;
      departmentCode: string;
      departmentName: string;
      count: number;
    }>;
    headcountByStatus: HeadcountStatusDatum[];
    attendanceBreakdown: AttendanceStatusDatum[];
    payrollTrend: Array<{
      periodId: number;
      periodLabel: string;
      status: PayrollPeriodStatus;
      totalEmployees: number;
      totalGross: number;
      totalNet: number;
    }>;
  };
  widgets: {
    expiringContracts: Array<{
      id: number;
      contractNo: string;
      employeeId: number;
      employeeCode: string;
      employeeName: string;
      endDate: string;
      daysRemaining: number;
    }>;
    upcomingMeetings: Array<{
      id: number;
      title: string;
      roomCode: string;
      roomName: string;
      startTime: string;
      endTime: string;
      bookedByEmployeeName: string;
    }>;
    latestAnnouncements: Array<{
      id: number;
      title: string;
      category: AnnouncementCategory;
      isPinned: boolean;
      branchName: string | null;
      publishedAt: string | null;
      isReadByMe: boolean;
    }>;
  };
  selfService: {
    employeeId: number;
    employeeCode: string;
    fullName: string;
    departmentName: string;
    positionName: string;
    annualLeaveRemainingDays: number;
    todayAttendanceStatus: 'NOT_CHECKED_IN' | 'CHECKED_IN' | 'CHECKED_OUT';
    todayCheckInAt: string | null;
    assignedAssetsCount: number;
    myPendingRequestsCount: number;
  } | null;
}

function toIsoDateOnly(val: Date | string): string {
  if (val instanceof Date) {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${val.getFullYear()}-${pad(val.getMonth() + 1)}-${pad(val.getDate())}`;
  }
  return String(val).slice(0, 10);
}

function toIsoString(val: Date | string | null | undefined): string | null {
  if (!val) {
    return null;
  }
  const d = val instanceof Date ? val : new Date(val);
  return Number.isNaN(d.getTime()) ? String(val) : d.toISOString();
}

function parseMonthYear(query: { year?: string | null; month?: string | null }): {
  year: number;
  month: number;
} {
  const now = new Date();
  const year = query.year ? Number(query.year) : now.getFullYear();
  const month = query.month ? Number(query.month) : now.getMonth() + 1;

  if (!Number.isInteger(year) || year < 2020 || year > 2100) {
    throw new AppError('INVALID_PERIOD', 'Tham số năm không hợp lệ (2020–2100).', 400);
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new AppError('INVALID_PERIOD', 'Tham số tháng không hợp lệ (1–12).', 400);
  }
  return { year, month };
}

function resolveAllowedBranchFilter(auth: AuthContext, requestedBranchId: number | null): number[] | null {
  if (requestedBranchId !== null) {
    if (!auth.isSuperAdmin && !auth.hasAllBranches && !auth.branchIds.includes(requestedBranchId)) {
      throw new AppError(
        'FORBIDDEN_BRANCH',
        'Bạn không có quyền xem dữ liệu tổng quan của chi nhánh này.',
        403,
      );
    }
    return [requestedBranchId];
  }

  if (auth.isSuperAdmin || auth.hasAllBranches) {
    return null; // All branches
  }
  return auth.branchIds;
}

export async function getHrmDashboardSummary(
  auth: AuthContext,
  query: {
    branchId?: string | null;
    year?: string | null;
    month?: string | null;
  },
): Promise<DashboardSummaryData> {
  const { year, month } = parseMonthYear(query);
  const requestedBranchId = query.branchId ? Number(query.branchId) : null;
  if (
    query.branchId &&
    (requestedBranchId === null || !Number.isInteger(requestedBranchId) || requestedBranchId <= 0)
  ) {
    throw new AppError('INVALID_BRANCH_ID', 'ID chi nhánh không hợp lệ.', 400);
  }

  const branchFilter = resolveAllowedBranchFilter(auth, requestedBranchId);
  const scope = await resolveEmployeeAccessScope(auth);
  const visibility = resolveDashboardVisibility(auth, scope.mode);

  const db = getDb();
  const now = new Date();
  const todayIso = toIsoDateOnly(now);
  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDayOfMonth = new Date(year, month, 0).getDate();
  const monthEnd = `${year}-${String(month).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`;

  const expiryCutoffDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 30);
  const expiryCutoffIso = toIsoDateOnly(expiryCutoffDate);

  // 1. Load accessible employees inside current scope & branch filter
  let scopedEmpQuery = db
    .selectFrom('employees')
    .innerJoin('departments', 'departments.id', 'employees.department_id')
    .select([
      'employees.id',
      'employees.branch_id',
      'employees.department_id',
      'departments.code as department_code',
      'departments.name as department_name',
      'employees.employment_status',
      'employees.hire_date',
    ])
    .where('employees.deleted_at', 'is', null);

  if (branchFilter !== null) {
    if (branchFilter.length === 0) {
      scopedEmpQuery = scopedEmpQuery.where('employees.id', '=', -1);
    } else {
      scopedEmpQuery = scopedEmpQuery.where('employees.branch_id', 'in', branchFilter);
    }
  }

  if (scope.mode === 'DEPARTMENT') {
    if (scope.departmentIds.length > 0) {
      scopedEmpQuery = scopedEmpQuery.where('employees.department_id', 'in', scope.departmentIds);
    } else if (scope.selfEmployeeId !== null) {
      scopedEmpQuery = scopedEmpQuery.where('employees.id', '=', scope.selfEmployeeId);
    } else {
      scopedEmpQuery = scopedEmpQuery.where('employees.id', '=', -1);
    }
  } else if (scope.mode === 'OWN') {
    scopedEmpQuery = scopedEmpQuery.where('employees.id', '=', scope.selfEmployeeId ?? -1);
  }

  const scopedEmployees = await scopedEmpQuery.execute();
  const scopedEmployeeIds = scopedEmployees.map((e) => Number(e.id));

  // Workforce KPI & Charts
  const statusCounts: Partial<Record<EmploymentStatus, number>> = {};
  const deptCounts = new Map<number, { code: string; name: string; count: number }>();
  let activeEmployees = 0;
  let probationCount = 0;
  let newHiresThisMonth = 0;

  for (const emp of scopedEmployees) {
    statusCounts[emp.employment_status] = (statusCounts[emp.employment_status] ?? 0) + 1;
    if (WORKING_STATUSES.includes(emp.employment_status)) {
      activeEmployees += 1;
      const deptId = Number(emp.department_id);
      const existing = deptCounts.get(deptId);
      if (existing) {
        existing.count += 1;
      } else {
        deptCounts.set(deptId, {
          code: emp.department_code,
          name: emp.department_name,
          count: 1,
        });
      }
    }
    if (emp.employment_status === 'PROBATION') {
      probationCount += 1;
    }
    const hireIso = toIsoDateOnly(emp.hire_date);
    if (hireIso >= monthStart && hireIso <= monthEnd) {
      newHiresThisMonth += 1;
    }
  }

  const headcountByDepartment = visibility.canViewWorkforce
    ? Array.from(deptCounts.entries())
        .map(([departmentId, info]) => ({
          departmentId,
          departmentCode: info.code,
          departmentName: info.name,
          count: info.count,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8)
    : [];

  const headcountByStatus = visibility.canViewWorkforce
    ? buildEmploymentStatusDistribution(statusCounts)
    : [];

  // 2. Parallel queries for Contracts, Approvals, Attendance, Payroll, Assets, Office & ESS
  const roleIds = auth.roles.map((r) => r.id);

  const [
    expiringContractRows,
    pendingApprovalRow,
    attendanceRows,
    payrollRows,
    assetRows,
    offboardingAlertRow,
    todayBookingCountRow,
    upcomingMeetingRows,
    announcementRows,
    selfEmployeeRow,
  ] = await Promise.all([
    // Expiring contracts (<= 30 days or overdue)
    visibility.canViewContracts && scopedEmployeeIds.length > 0
      ? db
          .selectFrom('employee_contracts')
          .innerJoin('employees', 'employees.id', 'employee_contracts.employee_id')
          .select([
            'employee_contracts.id',
            'employee_contracts.contract_no',
            'employee_contracts.employee_id',
            'employees.employee_code',
            'employees.full_name',
            'employee_contracts.end_date',
          ])
          .where('employee_contracts.deleted_at', 'is', null)
          .where('employee_contracts.status', '=', 'ACTIVE')
          .where('employee_contracts.end_date', 'is not', null)
          .where('employee_contracts.end_date', '<=', expiryCutoffIso)
          .where('employee_contracts.employee_id', 'in', scopedEmployeeIds)
          .orderBy('employee_contracts.end_date', 'asc')
          .execute()
      : Promise.resolve([]),

    // Pending approvals waiting for current user
    visibility.canViewApprovals
      ? (() => {
          let q = db
            .selectFrom('approval_requests')
            .select((eb) => eb.fn.count<number>('approval_requests.id').as('total'))
            .where('approval_requests.status', '=', 'PENDING');

          if (!auth.isSuperAdmin) {
            q = q.where((eb) => {
              const conds = [eb('approval_requests.current_approver_user_id', '=', auth.userId)];
              if (roleIds.length > 0) {
                conds.push(eb('approval_requests.current_approver_role_id', 'in', roleIds));
              }
              return eb.or(conds);
            });
          }

          if (branchFilter !== null) {
            if (branchFilter.length > 0) {
              q = q.where((eb) =>
                eb.or([
                  eb('approval_requests.branch_id', 'is', null),
                  eb('approval_requests.branch_id', 'in', branchFilter),
                ]),
              );
            } else {
              q = q.where('approval_requests.branch_id', 'is', null);
            }
          }
          return q.executeTakeFirst();
        })()
      : Promise.resolve(undefined),

    // Attendance logs in selected month
    visibility.canViewAttendance && scopedEmployeeIds.length > 0
      ? db
          .selectFrom('attendance_logs')
          .select(['status', (eb) => eb.fn.count<number>('id').as('cnt')])
          .where('deleted_at', 'is', null)
          .where('employee_id', 'in', scopedEmployeeIds)
          .where('work_date', '>=', monthStart)
          .where('work_date', '<=', monthEnd)
          .groupBy('status')
          .execute()
      : Promise.resolve([]),

    // Payroll periods (STRICTLY guarded by canViewPayroll)
    visibility.canViewPayroll
      ? (() => {
          let q = db
            .selectFrom('payroll_periods')
            .select([
              'id',
              'code',
              'name',
              'year',
              'month',
              'status',
              'total_employees',
              'total_gross',
              'total_net',
            ])
            .where('deleted_at', 'is', null);

          if (branchFilter !== null) {
            if (branchFilter.length > 0) {
              q = q.where((eb) =>
                eb.or([
                  eb('branch_id', 'is', null),
                  eb('branch_id', 'in', branchFilter),
                ]),
              );
            } else {
              q = q.where('branch_id', 'is', null);
            }
          }

          return q.orderBy('year', 'desc').orderBy('month', 'desc').orderBy('id', 'desc').limit(6).execute();
        })()
      : Promise.resolve([]),

    // Assets inventory summary
    visibility.canViewAssets
      ? (() => {
          let q = db
            .selectFrom('assets')
            .select(['status', (eb) => eb.fn.count<number>('id').as('cnt')])
            .where('deleted_at', 'is', null);

          if (branchFilter !== null) {
            if (branchFilter.length > 0) {
              q = q.where('branch_id', 'in', branchFilter);
            } else {
              q = q.where('id', '=', -1);
            }
          }
          return q.groupBy('status').execute();
        })()
      : Promise.resolve([]),

    // Offboarding unreturned asset alerts
    visibility.canViewAssets
      ? (() => {
          let q = db
            .selectFrom('asset_assignments')
            .innerJoin('assets', 'assets.id', 'asset_assignments.asset_id')
            .innerJoin('employees', 'employees.id', 'asset_assignments.employee_id')
            .select((eb) => eb.fn.count<number>('asset_assignments.id').as('total'))
            .where('asset_assignments.deleted_at', 'is', null)
            .where('asset_assignments.status', '=', 'ACTIVE')
            .where('assets.deleted_at', 'is', null)
            .where('employees.deleted_at', 'is', null)
            .where('employees.employment_status', 'in', ['RESIGNED', 'TERMINATED']);

          if (branchFilter !== null) {
            if (branchFilter.length > 0) {
              q = q.where('assets.branch_id', 'in', branchFilter);
            } else {
              q = q.where('asset_assignments.id', '=', -1);
            }
          }
          return q.executeTakeFirst();
        })()
      : Promise.resolve(undefined),

    // Today's meeting room bookings count
    (() => {
      const todayStart = `${todayIso} 00:00:00`;
      const todayEnd = `${todayIso} 23:59:59`;
      let q = db
        .selectFrom('room_bookings')
        .innerJoin('meeting_rooms', 'meeting_rooms.id', 'room_bookings.room_id')
        .select((eb) => eb.fn.count<number>('room_bookings.id').as('total'))
        .where('room_bookings.deleted_at', 'is', null)
        .where('meeting_rooms.deleted_at', 'is', null)
        .where('room_bookings.status', '=', 'CONFIRMED')
        .where('room_bookings.start_time', '<=', todayEnd)
        .where('room_bookings.end_time', '>=', todayStart);

      if (branchFilter !== null) {
        if (branchFilter.length > 0) {
          q = q.where('meeting_rooms.branch_id', 'in', branchFilter);
        } else {
          q = q.where('room_bookings.id', '=', -1);
        }
      }
      return q.executeTakeFirst();
    })(),

    // Top 5 upcoming meeting bookings
    (() => {
      let q = db
        .selectFrom('room_bookings')
        .innerJoin('meeting_rooms', 'meeting_rooms.id', 'room_bookings.room_id')
        .innerJoin('employees', 'employees.id', 'room_bookings.booked_by_employee_id')
        .select([
          'room_bookings.id',
          'room_bookings.title',
          'meeting_rooms.code as room_code',
          'meeting_rooms.name as room_name',
          'room_bookings.start_time',
          'room_bookings.end_time',
          'employees.full_name as booked_by_employee_name',
        ])
        .where('room_bookings.deleted_at', 'is', null)
        .where('meeting_rooms.deleted_at', 'is', null)
        .where('room_bookings.status', '=', 'CONFIRMED')
        .where('room_bookings.end_time', '>=', formatMysqlDateTime(now));

      if (branchFilter !== null) {
        if (branchFilter.length > 0) {
          q = q.where('meeting_rooms.branch_id', 'in', branchFilter);
        } else {
          q = q.where('room_bookings.id', '=', -1);
        }
      }
      return q.orderBy('room_bookings.start_time', 'asc').limit(5).execute();
    })(),

    // Published announcements visible to user
    (() => {
      let q = db
        .selectFrom('announcements')
        .leftJoin('branches', 'branches.id', 'announcements.branch_id')
        .select([
          'announcements.id',
          'announcements.title',
          'announcements.category',
          'announcements.is_pinned',
          'branches.name as branch_name',
          'announcements.published_at',
        ])
        .where('announcements.deleted_at', 'is', null)
        .where('announcements.status', '=', 'PUBLISHED');

      if (branchFilter !== null) {
        if (branchFilter.length > 0) {
          q = q.where((eb) =>
            eb.or([
              eb('announcements.branch_id', 'is', null),
              eb('announcements.branch_id', 'in', branchFilter),
            ]),
          );
        } else {
          q = q.where('announcements.branch_id', 'is', null);
        }
      }
      return q
        .orderBy('announcements.is_pinned', 'desc')
        .orderBy('announcements.published_at', 'desc')
        .orderBy('announcements.id', 'desc')
        .execute();
    })(),

    // Self employee profile for ESS
    db
      .selectFrom('employees')
      .innerJoin('departments', 'departments.id', 'employees.department_id')
      .innerJoin('positions', 'positions.id', 'employees.position_id')
      .select([
        'employees.id',
        'employees.employee_code',
        'employees.full_name',
        'departments.name as department_name',
        'positions.name as position_name',
      ])
      .where('employees.user_id', '=', auth.userId)
      .where('employees.deleted_at', 'is', null)
      .executeTakeFirst(),
  ]);

  // Process Attendance
  const attCounts: Partial<Record<AttendanceStatus, number>> = {};
  let totalAttLogs = 0;
  for (const row of attendanceRows) {
    const cnt = Number(row.cnt ?? 0);
    attCounts[row.status] = cnt;
    totalAttLogs += cnt;
  }
  const presentCount = Number(attCounts.PRESENT ?? 0);
  const lateCount = Number(attCounts.LATE ?? 0);
  const attendedBase = presentCount + lateCount;

  // Process Payroll
  const latestPayrollRow = payrollRows[0] ?? null;
  const latestPayroll =
    visibility.canViewPayroll && latestPayrollRow
      ? {
          id: Number(latestPayrollRow.id),
          code: latestPayrollRow.code,
          name: latestPayrollRow.name,
          year: Number(latestPayrollRow.year),
          month: Number(latestPayrollRow.month),
          status: latestPayrollRow.status,
          totalEmployees: Number(latestPayrollRow.total_employees ?? 0),
          totalGross: roundCurrency(Number(latestPayrollRow.total_gross ?? 0)),
          totalNet: roundCurrency(Number(latestPayrollRow.total_net ?? 0)),
        }
      : null;

  const payrollTrend = visibility.canViewPayroll
    ? [...payrollRows].reverse().map((p) => ({
        periodId: Number(p.id),
        periodLabel: formatPeriodMonthLabel(Number(p.month), Number(p.year)),
        status: p.status,
        totalEmployees: Number(p.total_employees ?? 0),
        totalGross: roundCurrency(Number(p.total_gross ?? 0)),
        totalNet: roundCurrency(Number(p.total_net ?? 0)),
      }))
    : [];

  // Process Assets
  let assetsSummary: DashboardSummaryData['kpis']['assets'] = null;
  if (visibility.canViewAssets) {
    let totalAssets = 0;
    let assignedAssets = 0;
    let availableAssets = 0;
    for (const row of assetRows) {
      const cnt = Number(row.cnt ?? 0);
      totalAssets += cnt;
      if (row.status === 'ASSIGNED') {
        assignedAssets = cnt;
      } else if (row.status === 'AVAILABLE') {
        availableAssets = cnt;
      }
    }
    assetsSummary = {
      total: totalAssets,
      assigned: assignedAssets,
      available: availableAssets,
      offboardingAlertsCount: Number(offboardingAlertRow?.total ?? 0),
    };
  }

  // Process Announcements Read Status & Self-Service ESS
  const selfEmpId = selfEmployeeRow ? Number(selfEmployeeRow.id) : null;
  const annIds = announcementRows.map((a) => Number(a.id));

  const [myReadAnnRows, essLeaveRow, essTodayLog, essAssetsRow, essPendingReqRow] = await Promise.all([
    selfEmpId !== null && annIds.length > 0
      ? db
          .selectFrom('announcement_reads')
          .select(['announcement_id'])
          .where('employee_id', '=', selfEmpId)
          .where('announcement_id', 'in', annIds)
          .execute()
      : Promise.resolve([]),
    selfEmpId !== null
      ? db
          .selectFrom('leave_balances')
          .innerJoin('leave_types', 'leave_types.id', 'leave_balances.leave_type_id')
          .select([
            'leave_balances.entitled_days',
            'leave_balances.carried_over_days',
            'leave_balances.used_days',
            'leave_balances.pending_days',
          ])
          .where('leave_balances.employee_id', '=', selfEmpId)
          .where('leave_balances.year', '=', year)
          .where('leave_balances.deleted_at', 'is', null)
          .where('leave_types.code', '=', 'ANNUAL')
          .executeTakeFirst()
      : Promise.resolve(undefined),
    selfEmpId !== null
      ? db
          .selectFrom('attendance_logs')
          .select(['check_in_at', 'check_out_at'])
          .where('employee_id', '=', selfEmpId)
          .where('work_date', '=', todayIso)
          .where('deleted_at', 'is', null)
          .executeTakeFirst()
      : Promise.resolve(undefined),
    selfEmpId !== null
      ? db
          .selectFrom('asset_assignments')
          .select((eb) => eb.fn.count<number>('id').as('total'))
          .where('employee_id', '=', selfEmpId)
          .where('status', '=', 'ACTIVE')
          .where('deleted_at', 'is', null)
          .executeTakeFirst()
      : Promise.resolve(undefined),
    db
      .selectFrom('approval_requests')
      .select((eb) => eb.fn.count<number>('id').as('total'))
      .where('requester_id', '=', auth.userId)
      .where('status', '=', 'PENDING')
      .executeTakeFirst(),
  ]);

  const myReadSet = new Set(myReadAnnRows.map((r) => Number(r.announcement_id)));
  const unreadAnnouncementsCount = announcementRows.filter((a) => !myReadSet.has(Number(a.id))).length;

  const latestAnnouncements = announcementRows.slice(0, 5).map((a) => ({
    id: Number(a.id),
    title: a.title,
    category: a.category,
    isPinned: Number(a.is_pinned) === 1,
    branchName: a.branch_name,
    publishedAt: toIsoString(a.published_at),
    isReadByMe: myReadSet.has(Number(a.id)),
  }));

  const annualLeaveRemainingDays = essLeaveRow
    ? Math.max(
        0,
        Math.round(
          (Number(essLeaveRow.entitled_days) +
            Number(essLeaveRow.carried_over_days) -
            Number(essLeaveRow.used_days) -
            Number(essLeaveRow.pending_days)) *
            100,
        ) / 100,
      )
    : 0;

  const todayAttendanceStatus: 'NOT_CHECKED_IN' | 'CHECKED_IN' | 'CHECKED_OUT' =
    essTodayLog?.check_out_at
      ? 'CHECKED_OUT'
      : essTodayLog?.check_in_at
        ? 'CHECKED_IN'
        : 'NOT_CHECKED_IN';

  return {
    period: { year, month },
    scopeMode: scope.mode,
    visibility,
    kpis: {
      workforce: visibility.canViewWorkforce
        ? { activeEmployees, probationCount, newHiresThisMonth }
        : null,
      expiringContractsCount: visibility.canViewContracts ? expiringContractRows.length : null,
      pendingApprovalsCount: Number(pendingApprovalRow?.total ?? 0),
      attendance: {
        totalLogs: totalAttLogs,
        presentCount,
        lateCount,
        lateRatePercent: computePercentage(lateCount, attendedBase),
      },
      latestPayroll,
      assets: assetsSummary,
      office: {
        todayBookingsCount: Number(todayBookingCountRow?.total ?? 0),
        unreadAnnouncementsCount,
      },
    },
    charts: {
      headcountByDepartment,
      headcountByStatus,
      attendanceBreakdown: visibility.canViewAttendance ? buildAttendanceBreakdown(attCounts) : [],
      payrollTrend,
    },
    widgets: {
      expiringContracts: expiringContractRows.slice(0, 5).map((c) => {
        const endDate = toIsoDateOnly(c.end_date!);
        return {
          id: Number(c.id),
          contractNo: c.contract_no,
          employeeId: Number(c.employee_id),
          employeeCode: c.employee_code,
          employeeName: c.full_name,
          endDate,
          daysRemaining: computeDaysRemaining(endDate, now),
        };
      }),
      upcomingMeetings: upcomingMeetingRows.map((m) => ({
        id: Number(m.id),
        title: m.title,
        roomCode: m.room_code,
        roomName: m.room_name,
        startTime: toIsoString(m.start_time) ?? '',
        endTime: toIsoString(m.end_time) ?? '',
        bookedByEmployeeName: m.booked_by_employee_name,
      })),
      latestAnnouncements,
    },
    selfService: selfEmployeeRow
      ? {
          employeeId: Number(selfEmployeeRow.id),
          employeeCode: selfEmployeeRow.employee_code,
          fullName: selfEmployeeRow.full_name,
          departmentName: selfEmployeeRow.department_name,
          positionName: selfEmployeeRow.position_name,
          annualLeaveRemainingDays,
          todayAttendanceStatus,
          todayCheckInAt: toIsoString(essTodayLog?.check_in_at),
          assignedAssetsCount: Number(essAssetsRow?.total ?? 0),
          myPendingRequestsCount: Number(essPendingReqRow?.total ?? 0),
        }
      : null,
  };
}
