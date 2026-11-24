import { Kysely, MysqlDialect, sql, type Generated } from 'kysely';
import { createPool, type Pool } from 'mysql2';
import { getServerEnv } from '@/config/env';

export type UserStatus = 'ACTIVE' | 'LOCKED';
export type DataScope = 'OWN' | 'DEPARTMENT' | 'BRANCH' | 'ALL';
export type ApproverType = 'DIRECT_MANAGER' | 'ROLE' | 'SPECIFIC_USER';
export type ApprovalRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
export type ApprovalHistoryAction = 'SUBMIT' | 'APPROVE' | 'REJECT' | 'CANCEL';
export type EmployeeGender = 'MALE' | 'FEMALE' | 'OTHER';
export type EmploymentStatus = 'PROBATION' | 'ACTIVE' | 'ON_LEAVE' | 'RESIGNED' | 'TERMINATED';
export type EmployeeDocType = 'ID_CARD' | 'DEGREE' | 'CONTRACT' | 'HEALTH_CERT' | 'OTHER';
export type ContractType = 'PROBATION' | 'FIXED_TERM' | 'INDEFINITE' | 'PART_TIME';
export type ContractStatus = 'DRAFT' | 'ACTIVE' | 'EXPIRED' | 'TERMINATED';
export type WorkHistoryChangeType =
  | 'HIRE'
  | 'PROMOTION'
  | 'TRANSFER'
  | 'SALARY_ADJUST'
  | 'TERMINATION';
export type LeaveSession = 'FULL' | 'AM' | 'PM';
export type LeaveRequestStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
export type OtRateType = 'WEEKDAY_150' | 'WEEKEND_200' | 'HOLIDAY_300';
export type AttendanceSource = 'WEB' | 'IMPORT' | 'MANUAL';
export type AttendanceStatus = 'PRESENT' | 'LATE' | 'ABSENT' | 'LEAVE' | 'HOLIDAY';
export type AttendanceSummaryStatus = 'DRAFT' | 'LOCKED';
export type PayrollPeriodStatus = 'DRAFT' | 'CALCULATED' | 'APPROVED' | 'PAID';
export type PayslipStatus = 'DRAFT' | 'PUBLISHED';
export type PayslipItemType = 'EARNING' | 'DEDUCTION';
export type PayslipItemSource = 'AUTO' | 'MANUAL';
export type AssetCategory = 'LAPTOP' | 'MONITOR' | 'PHONE' | 'FURNITURE' | 'OTHER';
export type AssetStatus = 'AVAILABLE' | 'ASSIGNED' | 'MAINTENANCE' | 'RETIRED';
export type AssetAssignmentStatus = 'ACTIVE' | 'RETURNED';
export type RoomBookingStatus = 'PENDING' | 'IN_PROGRESS' | 'CANCELLED' | 'DONE';
export type AnnouncementCategory = 'GENERAL' | 'HR_POLICY' | 'EVENT' | 'URGENT';
export type AnnouncementStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export interface SchemaMigrationsTable {
  id: Generated<number>;
  filename: string;
  applied_at: Generated<Date>;
}

export interface SettingsTable {
  id: Generated<number>;
  module_code: string;
  setting_key: string;
  setting_value: string;
  description: string | null;
  created_by: number | null;
  updated_by: number | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
  deleted_at: Date | null;
}

export interface BranchesTable {
  id: Generated<number>;
  code: string;
  name: string;
  tax_code: string | null;
  address: string | null;
  phone: string | null;
  is_headquarters: number;
  is_active: number;
  created_by: number | null;
  updated_by: number | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
  deleted_at: Date | null;
}

export interface UsersTable {
  id: Generated<number>;
  email: string;
  password_hash: string;
  full_name: string;
  avatar_url: string | null;
  status: UserStatus;
  last_login_at: Date | null;
  created_by: number | null;
  updated_by: number | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
  deleted_at: Date | null;
}

export interface RolesTable {
  id: Generated<number>;
  code: string;
  name: string;
  data_scope: DataScope;
  description: string | null;
  is_system: number;
  created_by: number | null;
  updated_by: number | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
  deleted_at: Date | null;
}

export interface PermissionsTable {
  id: Generated<number>;
  module_code: string;
  code: string;
  name: string;
  description: string | null;
  created_at: Generated<Date>;
}

export interface RolePermissionsTable {
  role_id: number;
  permission_id: number;
  created_at: Generated<Date>;
}

export interface UserRolesTable {
  id: Generated<number>;
  user_id: number;
  role_id: number;
  branch_id: number | null;
  created_at: Generated<Date>;
}

export interface RefreshTokensTable {
  id: Generated<number>;
  user_id: number;
  token_hash: string;
  expires_at: Date;
  revoked_at: Date | null;
  user_agent: string | null;
  ip_address: string | null;
  created_at: Generated<Date>;
}

export interface AuditLogsTable {
  id: Generated<number>;
  user_id: number | null;
  module_code: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  old_values: string | null;
  new_values: string | null;
  ip_address: string | null;
  created_at: Generated<Date>;
}

export interface ApprovalWorkflowsTable {
  id: Generated<number>;
  module_code: string;
  request_type: string;
  branch_id: number | null;
  name: string;
  description: string | null;
  conditions_json: string | null;
  is_active: number;
  created_by: number | null;
  updated_by: number | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
  deleted_at: Date | null;
}

export interface ApprovalWorkflowStepsTable {
  id: Generated<number>;
  workflow_id: number;
  step_order: number;
  approver_type: ApproverType;
  approver_role_id: number | null;
  approver_user_id: number | null;
  created_at: Generated<Date>;
}

export interface ApprovalRequestsTable {
  id: Generated<number>;
  workflow_id: number;
  module_code: string;
  request_type: string;
  entity_type: string;
  entity_id: number;
  branch_id: number | null;
  requester_id: number;
  title: string;
  summary: string | null;
  current_step: number;
  total_steps: number;
  current_approver_user_id: number | null;
  current_approver_role_id: number | null;
  status: ApprovalRequestStatus;
  submitted_at: Generated<Date>;
  completed_at: Date | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface ApprovalHistoriesTable {
  id: Generated<number>;
  approval_request_id: number;
  step_order: number;
  actor_id: number;
  action: ApprovalHistoryAction;
  comment: string | null;
  acted_at: Generated<Date>;
}

export interface NotificationsTable {
  id: Generated<number>;
  user_id: number;
  module_code: string;
  type: string;
  title: string;
  message: string;
  link_url: string | null;
  is_read: number;
  read_at: Date | null;
  created_at: Generated<Date>;
}

export interface DepartmentsTable {
  id: Generated<number>;
  branch_id: number;
  parent_id: number | null;
  code: string;
  name: string;
  description: string | null;
  manager_employee_id: number | null;
  sort_order: number;
  is_active: number;
  created_by: number | null;
  updated_by: number | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
  deleted_at: Date | null;
}

export interface PositionsTable {
  id: Generated<number>;
  code: string;
  name: string;
  level: number;
  description: string | null;
  is_active: number;
  created_by: number | null;
  updated_by: number | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
  deleted_at: Date | null;
}

export interface EmployeesTable {
  id: Generated<number>;
  user_id: number | null;
  employee_code: string;
  branch_id: number;
  department_id: number;
  position_id: number;
  manager_id: number | null;
  full_name: string;
  gender: EmployeeGender | null;
  date_of_birth: Date | string | null;
  national_id: string | null;
  tax_code: string | null;
  social_insurance_no: string | null;
  phone: string | null;
  work_email: string;
  personal_email: string | null;
  address: string | null;
  bank_name: string | null;
  bank_account_no: string | null;
  hire_date: Date | string;
  probation_end_date: Date | string | null;
  termination_date: Date | string | null;
  employment_status: EmploymentStatus;
  dependents_count: number;
  avatar_url: string | null;
  note: string | null;
  created_by: number | null;
  updated_by: number | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
  deleted_at: Date | null;
}

export interface EmployeeDocumentsTable {
  id: Generated<number>;
  employee_id: number;
  doc_type: EmployeeDocType;
  title: string;
  file_name: string;
  file_url: string;
  file_size: number;
  mime_type: string;
  expired_at: Date | string | null;
  created_by: number | null;
  updated_by: number | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
  deleted_at: Date | null;
}

export interface EmployeeContractsTable {
  id: Generated<number>;
  employee_id: number;
  contract_no: string;
  contract_type: ContractType;
  start_date: Date | string;
  end_date: Date | string | null;
  base_salary: string | number;
  insurance_salary: string | number;
  allowances_json: string | null;
  status: ContractStatus;
  signed_date: Date | string | null;
  note: string | null;
  created_by: number | null;
  updated_by: number | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
  deleted_at: Date | null;
}

export interface EmployeeWorkHistoriesTable {
  id: Generated<number>;
  employee_id: number;
  change_type: WorkHistoryChangeType;
  effective_date: Date | string;
  decision_no: string | null;
  from_branch_id: number | null;
  to_branch_id: number | null;
  from_department_id: number | null;
  to_department_id: number | null;
  from_position_id: number | null;
  to_position_id: number | null;
  from_salary: string | number | null;
  to_salary: string | number | null;
  note: string | null;
  created_by: number | null;
  updated_by: number | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
  deleted_at: Date | null;
}

export interface LeaveTypesTable {
  id: Generated<number>;
  code: string;
  name: string;
  is_paid: number;
  default_days_per_year: string | number;
  allow_carry_over: number;
  max_carry_over_days: string | number;
  requires_attachment: number;
  description: string | null;
  is_active: number;
  created_by: number | null;
  updated_by: number | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
  deleted_at: Date | null;
}

export interface LeaveBalancesTable {
  id: Generated<number>;
  employee_id: number;
  leave_type_id: number;
  year: number;
  entitled_days: string | number;
  carried_over_days: string | number;
  used_days: string | number;
  pending_days: string | number;
  note: string | null;
  created_by: number | null;
  updated_by: number | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
  deleted_at: Date | null;
}

export interface LeaveRequestsTable {
  id: Generated<number>;
  request_code: string;
  employee_id: number;
  leave_type_id: number;
  start_date: Date | string;
  end_date: Date | string;
  start_session: LeaveSession;
  end_session: LeaveSession;
  total_days: string | number;
  reason: string;
  attachment_url: string | null;
  status: LeaveRequestStatus;
  approval_request_id: number | null;
  created_by: number | null;
  updated_by: number | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
  deleted_at: Date | null;
}

export interface OvertimeRequestsTable {
  id: Generated<number>;
  request_code: string;
  employee_id: number;
  work_date: Date | string;
  start_time: string;
  end_time: string;
  total_hours: string | number;
  ot_rate_type: OtRateType;
  is_holiday: number;
  reason: string;
  status: LeaveRequestStatus;
  approval_request_id: number | null;
  created_by: number | null;
  updated_by: number | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
  deleted_at: Date | null;
}

export interface BusinessTripRequestsTable {
  id: Generated<number>;
  request_code: string;
  employee_id: number;
  destination: string;
  start_date: Date | string;
  end_date: Date | string;
  total_days: string | number;
  purpose: string;
  estimated_cost: string | number;
  status: LeaveRequestStatus;
  approval_request_id: number | null;
  created_by: number | null;
  updated_by: number | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
  deleted_at: Date | null;
}

export interface WorkShiftsTable {
  id: Generated<number>;
  branch_id: number | null;
  code: string;
  name: string;
  start_time: string;
  end_time: string;
  break_start_time: string | null;
  break_end_time: string | null;
  late_grace_minutes: number;
  early_leave_grace_minutes: number;
  working_hours: string | number;
  is_default: number;
  is_active: number;
  description: string | null;
  created_by: number | null;
  updated_by: number | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
  deleted_at: Date | null;
}

export interface EmployeeShiftAssignmentsTable {
  id: Generated<number>;
  employee_id: number;
  shift_id: number;
  effective_from: Date | string;
  effective_to: Date | string | null;
  work_days_json: string | number[];
  note: string | null;
  created_by: number | null;
  updated_by: number | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
  deleted_at: Date | null;
}

export interface HolidaysTable {
  id: Generated<number>;
  branch_id: number | null;
  holiday_date: Date | string;
  name: string;
  is_paid: number;
  note: string | null;
  created_by: number | null;
  updated_by: number | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
  deleted_at: Date | null;
}

export interface AttendanceLogsTable {
  id: Generated<number>;
  employee_id: number;
  work_date: Date | string;
  shift_id: number | null;
  check_in_at: Date | string | null;
  check_out_at: Date | string | null;
  source: AttendanceSource;
  late_minutes: number;
  early_leave_minutes: number;
  worked_hours: string | number;
  status: AttendanceStatus;
  note: string | null;
  created_by: number | null;
  updated_by: number | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
  deleted_at: Date | null;
}

export interface AttendanceSummariesTable {
  id: Generated<number>;
  employee_id: number;
  branch_id: number;
  year: number;
  month: number;
  standard_work_days: string | number;
  actual_work_days: string | number;
  business_trip_days: string | number;
  paid_leave_days: string | number;
  unpaid_leave_days: string | number;
  holiday_days: string | number;
  payable_days: string | number;
  ot_hours_150: string | number;
  ot_hours_200: string | number;
  ot_hours_300: string | number;
  late_count: number;
  total_late_minutes: number;
  early_leave_count: number;
  total_early_leave_minutes: number;
  status: AttendanceSummaryStatus;
  locked_by: number | null;
  locked_at: Date | string | null;
  adjustment_note: string | null;
  created_by: number | null;
  updated_by: number | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
  deleted_at: Date | null;
}

export interface PayrollPeriodsTable {
  id: Generated<number>;
  branch_id: number | null;
  year: number;
  month: number;
  code: string;
  name: string;
  status: PayrollPeriodStatus;
  total_employees: number;
  total_gross: string | number;
  total_insurance_emp: string | number;
  total_pit: string | number;
  total_net: string | number;
  config_snapshot_json: string | null;
  approved_by: number | null;
  approved_at: Date | string | null;
  paid_by: number | null;
  paid_at: Date | string | null;
  note: string | null;
  created_by: number | null;
  updated_by: number | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
  deleted_at: Date | null;
}

export interface PayslipsTable {
  id: Generated<number>;
  payroll_period_id: number;
  employee_id: number;
  branch_id: number;
  department_id: number;
  attendance_summary_id: number | null;
  contract_id: number | null;
  standard_work_days: string | number;
  payable_days: string | number;
  ot_hours_150: string | number;
  ot_hours_200: string | number;
  ot_hours_300: string | number;
  dependents_count: number;
  base_salary: string | number;
  insurance_salary: string | number;
  prorated_salary: string | number;
  total_allowances: string | number;
  total_ot_pay: string | number;
  total_bonus: string | number;
  gross_salary: string | number;
  social_insurance_emp: string | number;
  health_insurance_emp: string | number;
  unemployment_insurance_emp: string | number;
  taxable_income: string | number;
  personal_income_tax: string | number;
  other_deductions: string | number;
  net_salary: string | number;
  status: PayslipStatus;
  published_at: Date | string | null;
  bank_name_snapshot: string | null;
  bank_account_snapshot: string | null;
  note: string | null;
  created_by: number | null;
  updated_by: number | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
  deleted_at: Date | null;
}

export interface PayslipItemsTable {
  id: Generated<number>;
  payslip_id: number;
  item_type: PayslipItemType;
  source: PayslipItemSource;
  code: string;
  label: string;
  amount: string | number;
  is_taxable: number;
  note: string | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface AssetsTable {
  id: Generated<number>;
  branch_id: number;
  asset_code: string;
  name: string;
  category: AssetCategory;
  brand: string | null;
  model: string | null;
  serial_number: string | null;
  purchase_date: Date | string | null;
  warranty_expiry_date: Date | string | null;
  purchase_value: string | number;
  status: AssetStatus;
  note: string | null;
  created_by: number | null;
  updated_by: number | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
  deleted_at: Date | null;
}

export interface AssetAssignmentsTable {
  id: Generated<number>;
  asset_id: number;
  employee_id: number;
  assigned_by: number | null;
  returned_by: number | null;
  assigned_at: Date | string;
  expected_return_at: Date | string | null;
  returned_at: Date | string | null;
  condition_on_assign: string;
  condition_on_return: string | null;
  status: AssetAssignmentStatus;
  note: string | null;
  created_by: number | null;
  updated_by: number | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
  deleted_at: Date | null;
}

export interface MeetingRoomsTable {
  id: Generated<number>;
  branch_id: number;
  code: string;
  name: string;
  floor: string | null;
  capacity: number;
  equipment_json: string | string[] | null;
  description: string | null;
  is_active: number;
  created_by: number | null;
  updated_by: number | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
  deleted_at: Date | null;
}

export interface RoomBookingsTable {
  id: Generated<number>;
  room_id: number;
  booked_by_employee_id: number;
  title: string;
  start_time: Date | string;
  end_time: Date | string;
  attendees_count: number;
  status: RoomBookingStatus;
  cancel_reason: string | null;
  cancelled_by: number | null;
  cancelled_at: Date | string | null;
  note: string | null;
  created_by: number | null;
  updated_by: number | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
  deleted_at: Date | null;
}

export interface AnnouncementsTable {
  id: Generated<number>;
  branch_id: number | null;
  title: string;
  content: string;
  category: AnnouncementCategory;
  is_pinned: number;
  published_at: Date | string | null;
  status: AnnouncementStatus;
  author_id: number;
  created_by: number | null;
  updated_by: number | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
  deleted_at: Date | null;
}

export interface AnnouncementReadsTable {
  announcement_id: number;
  employee_id: number;
  read_at: Generated<Date>;
}

export interface DatabaseSchema {
  schema_migrations: SchemaMigrationsTable;
  settings: SettingsTable;
  branches: BranchesTable;
  users: UsersTable;
  roles: RolesTable;
  permissions: PermissionsTable;
  role_permissions: RolePermissionsTable;
  user_roles: UserRolesTable;
  refresh_tokens: RefreshTokensTable;
  audit_logs: AuditLogsTable;
  approval_workflows: ApprovalWorkflowsTable;
  approval_workflow_steps: ApprovalWorkflowStepsTable;
  approval_requests: ApprovalRequestsTable;
  approval_histories: ApprovalHistoriesTable;
  notifications: NotificationsTable;
  departments: DepartmentsTable;
  positions: PositionsTable;
  employees: EmployeesTable;
  employee_documents: EmployeeDocumentsTable;
  employee_contracts: EmployeeContractsTable;
  employee_work_histories: EmployeeWorkHistoriesTable;
  leave_types: LeaveTypesTable;
  leave_balances: LeaveBalancesTable;
  leave_requests: LeaveRequestsTable;
  overtime_requests: OvertimeRequestsTable;
  business_trip_requests: BusinessTripRequestsTable;
  work_shifts: WorkShiftsTable;
  employee_shift_assignments: EmployeeShiftAssignmentsTable;
  holidays: HolidaysTable;
  attendance_logs: AttendanceLogsTable;
  attendance_summaries: AttendanceSummariesTable;
  payroll_periods: PayrollPeriodsTable;
  payslips: PayslipsTable;
  payslip_items: PayslipItemsTable;
  assets: AssetsTable;
  asset_assignments: AssetAssignmentsTable;
  meeting_rooms: MeetingRoomsTable;
  room_bookings: RoomBookingsTable;
  announcements: AnnouncementsTable;
  announcement_reads: AnnouncementReadsTable;
}

export interface DatabasePingResult {
  ok: boolean;
  latencyMs: number | null;
  errorCode?: string;
}

interface GlobalDbContainer {
  __operonMysqlPool?: Pool;
  __operonKyselyDb?: Kysely<DatabaseSchema>;
}

const globalContainer = globalThis as unknown as GlobalDbContainer;

function createMysqlPool(): Pool {
  const env = getServerEnv();
  return createPool({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    connectionLimit: env.DB_POOL_LIMIT,
    waitForConnections: true,
    charset: 'utf8mb4',
    decimalNumbers: false,
  });
}

export function getDb(): Kysely<DatabaseSchema> {
  if (globalContainer.__operonKyselyDb) {
    return globalContainer.__operonKyselyDb;
  }

  const pool = createMysqlPool();
  const db = new Kysely<DatabaseSchema>({
    dialect: new MysqlDialect({ pool }),
  });

  globalContainer.__operonMysqlPool = pool;
  globalContainer.__operonKyselyDb = db;
  return db;
}

export async function pingDatabase(): Promise<DatabasePingResult> {
  const startedAt = Date.now();
  try {
    const db = getDb();
    await sql`SELECT 1 AS ok`.execute(db);
    return {
      ok: true,
      latencyMs: Date.now() - startedAt,
    };
  } catch {
    return {
      ok: false,
      latencyMs: null,
      errorCode: 'DATABASE_UNAVAILABLE',
    };
  }
}

export async function closeDatabase(): Promise<void> {
  if (globalContainer.__operonKyselyDb) {
    await globalContainer.__operonKyselyDb.destroy();
    globalContainer.__operonKyselyDb = undefined;
    globalContainer.__operonMysqlPool = undefined;
  }
}
