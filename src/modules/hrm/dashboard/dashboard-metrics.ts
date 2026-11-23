import type { AttendanceStatus, EmploymentStatus } from '@/config/database';
import { hasRequiredPermission, type AuthContext } from '@/modules/auth/auth.service';
import type { EmployeeAccessScope } from '@/modules/hrm/employees/employees.scope';

export interface DashboardVisibility {
  canViewWorkforce: boolean;
  canViewContracts: boolean;
  canViewAttendance: boolean;
  canViewPayroll: boolean;
  canViewAssets: boolean;
  canViewApprovals: boolean;
}

export interface HeadcountStatusDatum {
  status: EmploymentStatus;
  label: string;
  count: number;
}

export interface AttendanceStatusDatum {
  status: AttendanceStatus;
  label: string;
  count: number;
}

export const EMPLOYMENT_STATUS_LABELS: Record<EmploymentStatus, string> = {
  ACTIVE: 'Chính thức',
  PROBATION: 'Thử việc',
  ON_LEAVE: 'Nghỉ dài hạn',
  RESIGNED: 'Đã nghỉ việc',
  TERMINATED: 'Chấm dứt HĐ',
};

export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
  PRESENT: 'Đúng giờ',
  LATE: 'Đi muộn',
  LEAVE: 'Nghỉ phép',
  HOLIDAY: 'Ngày lễ',
  ABSENT: 'Vắng mặt',
};

export function resolveDashboardVisibility(
  auth: Pick<AuthContext, 'isSuperAdmin' | 'permissions'>,
  scopeMode: EmployeeAccessScope['mode'],
): DashboardVisibility {
  const isOrgScope = scopeMode !== 'OWN';
  return {
    canViewWorkforce: isOrgScope && hasRequiredPermission(auth, 'hrm.employees.read'),
    canViewContracts: isOrgScope && hasRequiredPermission(auth, 'hrm.contracts.read'),
    canViewAttendance: hasRequiredPermission(auth, 'hrm.attendance.read'),
    canViewPayroll: hasRequiredPermission(auth, 'hrm.payroll.read'),
    canViewAssets: isOrgScope && hasRequiredPermission(auth, 'hrm.assets.read'),
    canViewApprovals: hasRequiredPermission(auth, 'core.approvals.read'),
  };
}

export function computePercentage(part: number, total: number): number {
  if (total <= 0 || part <= 0) {
    return 0;
  }
  return Math.min(100, Math.round((part / total) * 1000) / 10);
}

export function computeDaysRemaining(targetDate: string | Date, referenceDate: Date = new Date()): number {
  const target =
    targetDate instanceof Date
      ? new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate())
      : new Date(`${String(targetDate).slice(0, 10)}T00:00:00`);
  const ref = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
  );
  if (Number.isNaN(target.getTime())) {
    return 0;
  }
  return Math.round((target.getTime() - ref.getTime()) / (24 * 60 * 60 * 1000));
}

export function buildEmploymentStatusDistribution(
  counts: Partial<Record<EmploymentStatus, number>>,
): HeadcountStatusDatum[] {
  const order: EmploymentStatus[] = ['ACTIVE', 'PROBATION', 'ON_LEAVE', 'RESIGNED', 'TERMINATED'];
  return order
    .map((status) => ({
      status,
      label: EMPLOYMENT_STATUS_LABELS[status],
      count: Number(counts[status] ?? 0),
    }))
    .filter((item) => item.count > 0);
}

export function buildAttendanceBreakdown(
  counts: Partial<Record<AttendanceStatus, number>>,
): AttendanceStatusDatum[] {
  const order: AttendanceStatus[] = ['PRESENT', 'LATE', 'LEAVE', 'HOLIDAY', 'ABSENT'];
  return order.map((status) => ({
    status,
    label: ATTENDANCE_STATUS_LABELS[status],
    count: Number(counts[status] ?? 0),
  }));
}

export function formatPeriodMonthLabel(month: number, year: number): string {
  return `T${String(month).padStart(2, '0')}/${year}`;
}
