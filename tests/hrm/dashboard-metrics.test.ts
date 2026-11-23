import { describe, expect, it } from 'vitest';
import {
  buildAttendanceBreakdown,
  buildEmploymentStatusDistribution,
  computeDaysRemaining,
  computePercentage,
  formatPeriodMonthLabel,
  resolveDashboardVisibility,
} from '@/modules/hrm/dashboard/dashboard-metrics';

describe('HRM Dashboard Metrics & RBAC Visibility', () => {
  it('enforces strict role visibility and hides payroll data from non-payroll roles', () => {
    const employeeVis = resolveDashboardVisibility(
      {
        isSuperAdmin: false,
        permissions: [
          'core.approvals.read',
          'hrm.dashboard.read',
          'hrm.employees.read',
          'hrm.attendance.read',
          'hrm.assets.read',
        ],
      },
      'OWN',
    );
    expect(employeeVis.canViewWorkforce).toBe(false);
    expect(employeeVis.canViewContracts).toBe(false);
    expect(employeeVis.canViewPayroll).toBe(false);
    expect(employeeVis.canViewAssets).toBe(false);
    expect(employeeVis.canViewAttendance).toBe(true);

    const hrStaffVis = resolveDashboardVisibility(
      {
        isSuperAdmin: false,
        permissions: [
          'hrm.dashboard.read',
          'hrm.employees.read',
          'hrm.contracts.read',
          'hrm.attendance.read',
          'hrm.assets.read',
        ],
      },
      'BRANCH',
    );
    expect(hrStaffVis.canViewWorkforce).toBe(true);
    expect(hrStaffVis.canViewContracts).toBe(true);
    expect(hrStaffVis.canViewPayroll).toBe(false);

    const payrollVis = resolveDashboardVisibility(
      {
        isSuperAdmin: false,
        permissions: ['hrm.dashboard.read', 'hrm.payroll.read', 'hrm.employees.read'],
      },
      'ALL',
    );
    expect(payrollVis.canViewPayroll).toBe(true);
    expect(payrollVis.canViewWorkforce).toBe(true);
  });

  it('computes percentages, contract days remaining, and chart series accurately', () => {
    expect(computePercentage(0, 10)).toBe(0);
    expect(computePercentage(3, 0)).toBe(0);
    expect(computePercentage(1, 3)).toBe(33.3);
    expect(computePercentage(15, 10)).toBe(100);

    const ref = new Date(2026, 10, 23); // 2026-11-23
    expect(computeDaysRemaining('2026-12-05', ref)).toBe(12);
    expect(computeDaysRemaining('2026-11-20', ref)).toBe(-3);

    expect(formatPeriodMonthLabel(3, 2026)).toBe('T03/2026');
    expect(formatPeriodMonthLabel(11, 2026)).toBe('T11/2026');

    const statusDist = buildEmploymentStatusDistribution({ ACTIVE: 12, PROBATION: 3, ON_LEAVE: 0 });
    expect(statusDist).toEqual([
      { status: 'ACTIVE', label: 'Chính thức', count: 12 },
      { status: 'PROBATION', label: 'Thử việc', count: 3 },
    ]);

    const attDist = buildAttendanceBreakdown({ PRESENT: 20, LATE: 2 });
    expect(attDist).toHaveLength(5);
    expect(attDist[0]).toEqual({ status: 'PRESENT', label: 'Đúng giờ', count: 20 });
    expect(attDist[1]).toEqual({ status: 'LATE', label: 'Đi muộn', count: 2 });
  });
});
