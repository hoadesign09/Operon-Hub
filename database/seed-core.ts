import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql, { type Connection } from 'mysql2/promise';
import { parseServerEnv } from '@/config/env';
import { hashPassword } from '@/lib/portable/password-hasher';
import {
  DEFAULT_PROPOSAL_CATEGORIES,
  PROPOSAL_DEFAULT_REQUEST_TYPE,
  PROPOSAL_ENTITY_TYPE,
  PROPOSAL_HIGH_VALUE_THRESHOLD_VND,
  PROPOSAL_MODULE_CODE,
} from '@/modules/proposals/proposals.constants';
import { assertLocalDevEnvironment } from './migrator';

const DEFAULT_ADMIN_EMAIL = 'admin@operonhub.local';
const DEFAULT_ADMIN_PASSWORD = 'Admin@123456';
const DEFAULT_ADMIN_NAME = 'Quản trị Hệ thống';

const SYSTEM_ROLES = [
  { code: 'SUPER_ADMIN', name: 'Quản trị Hệ thống', nameEn: 'System Administrator', dataScope: 'ALL', description: 'Toàn quyền quản trị hệ thống Operon Hub' },
  { code: 'EXECUTIVE', name: 'Ban Giám đốc', nameEn: 'Executive Board', dataScope: 'ALL', description: 'Xem báo cáo tổng quan và duyệt cấp cao' },
  { code: 'HR_MANAGER', name: 'Trưởng phòng Nhân sự', nameEn: 'HR Manager', dataScope: 'ALL', description: 'Quản trị toàn diện phân hệ HRM' },
  { code: 'HR_STAFF', name: 'Chuyên viên Nhân sự', nameEn: 'HR Specialist', dataScope: 'BRANCH', description: 'Vận hành hồ sơ nhân sự và chấm công tại chi nhánh' },
  { code: 'PAYROLL_ACCOUNTANT', name: 'Kế toán Lương (C&B)', nameEn: 'Payroll Accountant (C&B)', dataScope: 'ALL', description: 'Quản lý bảng công và tính lương toàn công ty' },
  { code: 'ADMIN_OPS', name: 'Hành chính Văn phòng', nameEn: 'Office Operations', dataScope: 'BRANCH', description: 'Quản lý tài sản, phòng họp và thông báo nội bộ' },
  { code: 'DEPT_MANAGER', name: 'Trưởng Bộ phận', nameEn: 'Department Manager', dataScope: 'DEPARTMENT', description: 'Quản lý nhân sự và phê duyệt đơn từ trong phòng ban' },
  { code: 'EMPLOYEE', name: 'Nhân viên', nameEn: 'Employee', dataScope: 'OWN', description: 'Cổng nhân viên tự phục vụ (ESS)' },
  { code: 'PMO_MANAGER', name: 'Trưởng ban Quản lý Dự án (PMO)', nameEn: 'PMO Manager', dataScope: 'ALL', description: 'Quản trị toàn diện danh mục dự án, nguồn lực, ngân sách và báo cáo Phase 2' },
] as const;

const BASELINE_PERMISSIONS = [
  { moduleCode: 'core', code: 'core.branches.read', name: 'Xem danh sách chi nhánh', nameEn: 'View branch directory' },
  { moduleCode: 'core', code: 'core.branches.create', name: 'Tạo chi nhánh mới', nameEn: 'Create branch' },
  { moduleCode: 'core', code: 'core.branches.update', name: 'Cập nhật chi nhánh', nameEn: 'Update branch' },
  { moduleCode: 'core', code: 'core.branches.delete', name: 'Xóa mềm chi nhánh', nameEn: 'Archive branch' },
  { moduleCode: 'core', code: 'core.users.read', name: 'Xem danh sách tài khoản', nameEn: 'View user accounts' },
  { moduleCode: 'core', code: 'core.users.create', name: 'Tạo tài khoản người dùng', nameEn: 'Create user account' },
  { moduleCode: 'core', code: 'core.users.update', name: 'Cập nhật tài khoản & gán vai trò', nameEn: 'Update user account & assign roles' },
  { moduleCode: 'core', code: 'core.roles.read', name: 'Xem vai trò & ma trận phân quyền', nameEn: 'View roles & permission matrix' },
  { moduleCode: 'core', code: 'core.roles.update', name: 'Cập nhật phân quyền cho vai trò', nameEn: 'Update role permissions' },
  { moduleCode: 'core', code: 'core.audit_logs.read', name: 'Xem nhật ký kiểm toán hệ thống', nameEn: 'View system audit logs' },
  { moduleCode: 'core', code: 'core.settings.read', name: 'Xem cấu hình hệ thống', nameEn: 'View system settings' },
  { moduleCode: 'core', code: 'core.settings.update', name: 'Cập nhật cấu hình hệ thống', nameEn: 'Update system settings' },
  { moduleCode: 'core', code: 'core.approvals.read', name: 'Xem hộp thư phê duyệt & luồng duyệt', nameEn: 'View approval inbox & workflows' },
  { moduleCode: 'core', code: 'core.approvals.act', name: 'Phê duyệt hoặc từ chối đơn yêu cầu', nameEn: 'Approve or reject requests' },
  { moduleCode: 'core', code: 'core.approvals.workflow_manage', name: 'Cấu hình quy trình duyệt đa cấp', nameEn: 'Configure multi-step approval workflows' },
  { moduleCode: 'hrm', code: 'hrm.dashboard.read', name: 'Xem tổng quan Hành chính Nhân sự', nameEn: 'View HRM overview dashboard' },
  { moduleCode: 'hrm', code: 'hrm.org.read', name: 'Xem cơ cấu tổ chức, phòng ban & chức danh', nameEn: 'View organization chart, departments & positions' },
  { moduleCode: 'hrm', code: 'hrm.org.manage', name: 'Quản trị phòng ban & danh mục chức danh', nameEn: 'Manage departments & job positions' },
  { moduleCode: 'hrm', code: 'hrm.employees.read', name: 'Xem hồ sơ nhân viên (theo Data Scope)', nameEn: 'View employee profiles (by Data Scope)' },
  { moduleCode: 'hrm', code: 'hrm.employees.create', name: 'Thêm mới hồ sơ nhân viên', nameEn: 'Create employee profile' },
  { moduleCode: 'hrm', code: 'hrm.employees.update', name: 'Cập nhật hồ sơ nhân viên & tài liệu', nameEn: 'Update employee profile & documents' },
  { moduleCode: 'hrm', code: 'hrm.employees.delete', name: 'Xóa mềm hồ sơ nhân viên', nameEn: 'Archive employee profile' },
  { moduleCode: 'hrm', code: 'hrm.employees.export', name: 'Xuất danh sách nhân viên ra Excel', nameEn: 'Export employee directory to Excel' },
  { moduleCode: 'hrm', code: 'hrm.contracts.read', name: 'Xem hợp đồng lao động & quá trình công tác', nameEn: 'View labor contracts & work history' },
  { moduleCode: 'hrm', code: 'hrm.contracts.manage', name: 'Quản trị hợp đồng lao động & quyết định công tác', nameEn: 'Manage labor contracts & career decisions' },
  { moduleCode: 'hrm', code: 'hrm.contracts.export', name: 'Xuất danh sách hợp đồng lao động ra Excel', nameEn: 'Export labor contracts to Excel' },
  { moduleCode: 'hrm', code: 'hrm.requests.read', name: 'Xem đơn từ nghỉ phép & quỹ phép (theo Data Scope)', nameEn: 'View leave requests & balances (by Data Scope)' },
  { moduleCode: 'hrm', code: 'hrm.requests.create', name: 'Tạo & gửi đơn nghỉ phép/đơn từ cá nhân (ESS)', nameEn: 'Create & submit personal requests (ESS)' },
  { moduleCode: 'hrm', code: 'hrm.requests.manage', name: 'Quản trị loại phép, khởi tạo & điều chỉnh quỹ phép năm', nameEn: 'Manage leave types & annual leave balances' },
  { moduleCode: 'hrm', code: 'hrm.requests.export', name: 'Xuất danh sách đơn từ nghỉ phép ra Excel', nameEn: 'Export leave requests to Excel' },
  { moduleCode: 'hrm', code: 'hrm.attendance.read', name: 'Xem ca làm việc, ngày lễ & bảng chấm công theo Data Scope', nameEn: 'View work shifts, holidays & attendance logs' },
  { moduleCode: 'hrm', code: 'hrm.attendance.manage', name: 'Quản trị ca làm việc, phân ca, ngày lễ & chỉnh sửa chấm công', nameEn: 'Manage work shifts, assignments, holidays & attendance' },
  { moduleCode: 'hrm', code: 'hrm.attendance.import', name: 'Import dữ liệu chấm công từ file Excel', nameEn: 'Import attendance logs from Excel' },
  { moduleCode: 'hrm', code: 'hrm.attendance.lock', name: 'Chốt & mở khóa bảng công tháng', nameEn: 'Lock & unlock monthly timesheets' },
  { moduleCode: 'hrm', code: 'hrm.attendance.export', name: 'Xuất dữ liệu chấm công ra Excel', nameEn: 'Export attendance data to Excel' },
  { moduleCode: 'hrm', code: 'hrm.payroll.read', name: 'Xem kỳ lương, bảng tính lương và cấu hình thuế/bảo hiểm', nameEn: 'View payroll periods, payslips & tax/SI config' },
  { moduleCode: 'hrm', code: 'hrm.payroll.manage', name: 'Tạo kỳ lương, chạy tính lương, chỉnh thưởng/khấu trừ & cấu hình lương', nameEn: 'Run payroll, adjust bonuses/deductions & config' },
  { moduleCode: 'hrm', code: 'hrm.payroll.approve', name: 'Phê duyệt, mở lại & xác nhận chi trả kỳ lương', nameEn: 'Approve, reopen & confirm payroll payout' },
  { moduleCode: 'hrm', code: 'hrm.payroll.export', name: 'Xuất bảng lương tổng Excel & phiếu lương PDF', nameEn: 'Export payroll Excel & payslip PDF' },
  { moduleCode: 'hrm', code: 'hrm.assets.read', name: 'Xem kho tài sản & lịch sử cấp phát theo Data Scope', nameEn: 'View asset inventory & assignment history' },
  { moduleCode: 'hrm', code: 'hrm.assets.manage', name: 'Quản trị danh mục tài sản, cấp phát, thu hồi & bảo trì', nameEn: 'Manage assets, handovers, returns & maintenance' },
  { moduleCode: 'hrm', code: 'hrm.assets.export', name: 'Xuất danh sách tài sản Excel & biên bản bàn giao PDF', nameEn: 'Export asset Excel & handover PDF' },
  { moduleCode: 'hrm', code: 'hrm.rooms.read', name: 'Xem danh sách phòng họp & lịch đặt phòng', nameEn: 'View meeting rooms & booking schedule' },
  { moduleCode: 'hrm', code: 'hrm.rooms.book', name: 'Đặt lịch phòng họp & quản lý lịch họp cá nhân', nameEn: 'Book meeting rooms & manage own bookings' },
  { moduleCode: 'hrm', code: 'hrm.rooms.manage', name: 'Quản trị phòng họp & điều phối toàn bộ lịch đặt phòng', nameEn: 'Manage meeting rooms & coordinate all bookings' },
  { moduleCode: 'hrm', code: 'hrm.announcements.read', name: 'Đọc bản tin & thông báo nội bộ', nameEn: 'Read company announcements & news' },
  { moduleCode: 'hrm', code: 'hrm.announcements.manage', name: 'Soạn thảo, xuất bản, ghim & thống kê thông báo nội bộ', nameEn: 'Draft, publish, pin & track company announcements' },
  { moduleCode: 'projects', code: 'pm.dashboard.read', name: 'Xem tổng quan Danh mục Dự án', nameEn: 'View Project Portfolio dashboard' },
  { moduleCode: 'projects', code: 'pm.projects.read', name: 'Xem danh sách và chi tiết dự án trong phạm vi', nameEn: 'View project list and details within scope' },
  { moduleCode: 'projects', code: 'pm.projects.create', name: 'Khởi tạo dự án mới và gửi duyệt Charter', nameEn: 'Create projects and submit Charter for approval' },
  { moduleCode: 'projects', code: 'pm.projects.manage', name: 'Quản trị toàn diện danh mục dự án, lưu trữ và chuyển PM', nameEn: 'Manage project portfolio, archiving & PM handover' },
  { moduleCode: 'projects', code: 'pm.tasks.read', name: 'Xem công việc trong dự án và Công việc của tôi', nameEn: 'View project tasks and My Tasks' },
  { moduleCode: 'projects', code: 'pm.tasks.create', name: 'Tạo Task, Subtask, Checklist và Dependency', nameEn: 'Create tasks, subtasks, checklists & dependencies' },
  { moduleCode: 'projects', code: 'pm.tasks.update', name: 'Cập nhật trạng thái, tiến độ, bình luận và đính kèm Task', nameEn: 'Update task status, progress, comments & files' },
  { moduleCode: 'projects', code: 'pm.tasks.delete', name: 'Xóa mềm hoặc lưu trữ Task', nameEn: 'Archive or soft-delete tasks' },
  { moduleCode: 'projects', code: 'pm.sprints.manage', name: 'Quản trị Sprint và sắp xếp Backlog', nameEn: 'Manage Sprints and Backlog prioritization' },
  { moduleCode: 'projects', code: 'pm.timelogs.log', name: 'Ghi nhận giờ công trên công việc', nameEn: 'Log work hours on project tasks' },
  { moduleCode: 'projects', code: 'pm.timelogs.approve', name: 'Xem và phê duyệt Timesheet nhóm/dự án', nameEn: 'Review and approve team/project timesheets' },
  { moduleCode: 'projects', code: 'pm.workload.read', name: 'Xem bản đồ phân bổ nguồn lực (Workload Heatmap)', nameEn: 'View Resource Workload Heatmap' },
  { moduleCode: 'projects', code: 'pm.budget.read', name: 'Xem ngân sách và chi phí dự án', nameEn: 'View project budget and cost tracking' },
  { moduleCode: 'projects', code: 'pm.budget.manage', name: 'Quản trị ngân sách, chi phí và đề xuất điều chỉnh', nameEn: 'Manage project budget, expenses & change requests' },
  { moduleCode: 'projects', code: 'pm.risks.manage', name: 'Quản trị Rủi ro và Vấn đề dự án (RAID)', nameEn: 'Manage Project Risks & Issues (RAID)' },
  { moduleCode: 'projects', code: 'pm.templates.manage', name: 'Quản trị Mẫu Dự án và Luật tự động hóa', nameEn: 'Manage Project Templates & Automation Rules' },
  { moduleCode: 'projects', code: 'pm.reports.export', name: 'Xuất báo cáo Dự án ra Excel và PDF', nameEn: 'Export Project reports to Excel and PDF' },
  { moduleCode: 'proposals', code: 'proposals.read', name: 'Xem đề xuất nội bộ trong phạm vi', nameEn: 'View internal proposals within scope' },
  { moduleCode: 'proposals', code: 'proposals.create', name: 'Tạo, sửa nháp và gửi duyệt đề xuất nội bộ', nameEn: 'Create, edit draft & submit internal proposals' },
  { moduleCode: 'proposals', code: 'proposals.manage', name: 'Quản trị toàn bộ đề xuất, thực thi và danh mục', nameEn: 'Manage all proposals, execution tracking & categories' },
  { moduleCode: 'proposals', code: 'proposals.export', name: 'Xuất danh sách đề xuất Excel và tờ trình PDF', nameEn: 'Export proposal lists to Excel and forms to PDF' },
] as const;

const ROLE_DEFAULT_PERMISSIONS: Record<string, readonly string[]> = {
  SUPER_ADMIN: BASELINE_PERMISSIONS.map((p) => p.code),
  EXECUTIVE: [
    'core.branches.read',
    'core.users.read',
    'core.roles.read',
    'core.audit_logs.read',
    'core.approvals.read',
    'core.approvals.act',
    'hrm.dashboard.read',
    'hrm.org.read',
    'hrm.employees.read',
    'hrm.contracts.read',
    'hrm.requests.read',
    'hrm.requests.create',
    'hrm.attendance.read',
    'hrm.payroll.read',
    'hrm.payroll.approve',
    'hrm.payroll.export',
    'hrm.assets.read',
    'hrm.rooms.read',
    'hrm.rooms.book',
    'hrm.announcements.read',
    'hrm.announcements.manage',
    'proposals.read',
    'proposals.create',
    'proposals.manage',
    'proposals.export',
  ],
  HR_MANAGER: [
    'core.branches.read',
    'core.users.read',
    'core.approvals.read',
    'core.approvals.act',
    'core.approvals.workflow_manage',
    'hrm.dashboard.read',
    'hrm.org.read',
    'hrm.org.manage',
    'hrm.employees.read',
    'hrm.employees.create',
    'hrm.employees.update',
    'hrm.employees.delete',
    'hrm.employees.export',
    'hrm.contracts.read',
    'hrm.contracts.manage',
    'hrm.contracts.export',
    'hrm.requests.read',
    'hrm.requests.create',
    'hrm.requests.manage',
    'hrm.requests.export',
    'hrm.attendance.read',
    'hrm.attendance.manage',
    'hrm.attendance.import',
    'hrm.attendance.lock',
    'hrm.attendance.export',
    'hrm.payroll.read',
    'hrm.assets.read',
    'hrm.rooms.read',
    'hrm.rooms.book',
    'hrm.rooms.manage',
    'hrm.announcements.read',
    'hrm.announcements.manage',
    'proposals.read',
    'proposals.create',
    'proposals.manage',
    'proposals.export',
  ],
  HR_STAFF: [
    'core.branches.read',
    'core.approvals.read',
    'hrm.dashboard.read',
    'hrm.org.read',
    'hrm.employees.read',
    'hrm.employees.create',
    'hrm.employees.update',
    'hrm.employees.export',
    'hrm.contracts.read',
    'hrm.contracts.manage',
    'hrm.contracts.export',
    'hrm.requests.read',
    'hrm.requests.create',
    'hrm.requests.export',
    'hrm.attendance.read',
    'hrm.attendance.manage',
    'hrm.attendance.import',
    'hrm.attendance.export',
    'hrm.assets.read',
    'hrm.rooms.read',
    'hrm.rooms.book',
    'hrm.announcements.read',
    'hrm.announcements.manage',
    'proposals.read',
    'proposals.create',
    'proposals.export',
  ],
  PAYROLL_ACCOUNTANT: [
    'core.branches.read',
    'core.approvals.read',
    'hrm.dashboard.read',
    'hrm.org.read',
    'hrm.employees.read',
    'hrm.contracts.read',
    'hrm.contracts.export',
    'hrm.requests.read',
    'hrm.requests.create',
    'hrm.requests.export',
    'hrm.attendance.read',
    'hrm.attendance.export',
    'hrm.payroll.read',
    'hrm.payroll.manage',
    'hrm.payroll.approve',
    'hrm.payroll.export',
    'hrm.assets.read',
    'hrm.rooms.read',
    'hrm.rooms.book',
    'hrm.announcements.read',
    'proposals.read',
    'proposals.create',
    'proposals.export',
  ],
  ADMIN_OPS: [
    'core.branches.read',
    'core.approvals.read',
    'core.approvals.act',
    'hrm.dashboard.read',
    'hrm.org.read',
    'hrm.employees.read',
    'hrm.requests.read',
    'hrm.requests.create',
    'hrm.attendance.read',
    'hrm.assets.read',
    'hrm.assets.manage',
    'hrm.assets.export',
    'hrm.rooms.read',
    'hrm.rooms.book',
    'hrm.rooms.manage',
    'hrm.announcements.read',
    'hrm.announcements.manage',
    'proposals.read',
    'proposals.create',
    'proposals.manage',
    'proposals.export',
  ],
  DEPT_MANAGER: [
    'core.approvals.read',
    'core.approvals.act',
    'hrm.dashboard.read',
    'hrm.org.read',
    'hrm.employees.read',
    'hrm.requests.read',
    'hrm.requests.create',
    'hrm.attendance.read',
    'hrm.assets.read',
    'hrm.rooms.read',
    'hrm.rooms.book',
    'hrm.announcements.read',
    'proposals.read',
    'proposals.create',
    'proposals.export',
  ],
  EMPLOYEE: [
    'core.approvals.read',
    'hrm.dashboard.read',
    'hrm.org.read',
    'hrm.employees.read',
    'hrm.contracts.read',
    'hrm.requests.read',
    'hrm.requests.create',
    'hrm.attendance.read',
    'hrm.assets.read',
    'hrm.rooms.read',
    'hrm.rooms.book',
    'hrm.announcements.read',
    'pm.dashboard.read',
    'pm.projects.read',
    'pm.tasks.read',
    'pm.tasks.create',
    'pm.tasks.update',
    'pm.timelogs.log',
    'proposals.read',
    'proposals.create',
    'proposals.export',
  ],
  PMO_MANAGER: BASELINE_PERMISSIONS.filter(
    (p) =>
      p.moduleCode === 'projects' ||
      p.moduleCode === 'proposals' ||
      p.code === 'core.approvals.read' ||
      p.code === 'core.approvals.act' ||
      p.code === 'core.branches.read' ||
      p.code === 'hrm.org.read' ||
      p.code === 'hrm.employees.read',
  ).map((p) => p.code),
};

async function seedDefaultBranch(conn: Connection): Promise<void> {
  await conn.execute(
    `INSERT INTO branches (code, name, name_en, address, is_headquarters, is_active)
     VALUES (?, ?, ?, ?, 1, 1)
     ON DUPLICATE KEY UPDATE name = VALUES(name), name_en = VALUES(name_en)`,
    ['HQ', 'Trụ sở chính', 'Headquarters', 'Văn phòng trung tâm Operon Hub'],
  );
}

async function seedRolesAndPermissions(conn: Connection): Promise<Map<string, number>> {
  for (const role of SYSTEM_ROLES) {
    await conn.execute(
      `INSERT INTO roles (code, name, name_en, data_scope, description, is_system)
       VALUES (?, ?, ?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE name = VALUES(name), name_en = VALUES(name_en), data_scope = VALUES(data_scope), description = VALUES(description)`,
      [role.code, role.name, role.nameEn, role.dataScope, role.description],
    );
  }

  for (const perm of BASELINE_PERMISSIONS) {
    await conn.execute(
      `INSERT INTO permissions (module_code, code, name, name_en)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE module_code = VALUES(module_code), name = VALUES(name), name_en = VALUES(name_en)`,
      [perm.moduleCode, perm.code, perm.name, perm.nameEn],
    );
  }

  const [roleRows] = await conn.execute<mysql.RowDataPacket[]>('SELECT id, code FROM roles WHERE deleted_at IS NULL');
  const [permRows] = await conn.execute<mysql.RowDataPacket[]>('SELECT id, code FROM permissions');

  const roleMap = new Map<string, number>(roleRows.map((r) => [String(r.code), Number(r.id)]));
  const permMap = new Map<string, number>(permRows.map((p) => [String(p.code), Number(p.id)]));

  for (const [roleCode, permCodes] of Object.entries(ROLE_DEFAULT_PERMISSIONS)) {
    const roleId = roleMap.get(roleCode);
    if (!roleId) {
      continue;
    }
    for (const permCode of permCodes) {
      const permId = permMap.get(permCode);
      if (!permId) {
        continue;
      }
      await conn.execute(
        'INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)',
        [roleId, permId],
      );
    }
  }

  return roleMap;
}

async function seedSuperAdminUser(conn: Connection, superAdminRoleId: number): Promise<void> {
  const [existingUsers] = await conn.execute<mysql.RowDataPacket[]>(
    'SELECT id FROM users WHERE email = ? LIMIT 1',
    [DEFAULT_ADMIN_EMAIL],
  );

  let adminUserId: number;
  if (existingUsers.length > 0) {
    adminUserId = Number(existingUsers[0].id);
  } else {
    const passwordHash = await hashPassword(DEFAULT_ADMIN_PASSWORD);
    const [result] = await conn.execute<mysql.ResultSetHeader>(
      `INSERT INTO users (email, password_hash, full_name, status)
       VALUES (?, ?, ?, 'ACTIVE')`,
      [DEFAULT_ADMIN_EMAIL, passwordHash, DEFAULT_ADMIN_NAME],
    );
    adminUserId = Number(result.insertId);
  }

  const [existingAssignments] = await conn.execute<mysql.RowDataPacket[]>(
    'SELECT id FROM user_roles WHERE user_id = ? AND role_id = ? AND branch_id IS NULL LIMIT 1',
    [adminUserId, superAdminRoleId],
  );

  if (existingAssignments.length === 0) {
    await conn.execute(
      'INSERT INTO user_roles (user_id, role_id, branch_id) VALUES (?, ?, NULL)',
      [adminUserId, superAdminRoleId],
    );
  }
}

async function seedDefaultApprovalWorkflows(
  conn: Connection,
  roleMap: Map<string, number>,
): Promise<void> {
  const deptManagerRoleId = roleMap.get('DEPT_MANAGER') ?? null;
  const hrManagerRoleId = roleMap.get('HR_MANAGER') ?? null;
  if (!deptManagerRoleId || !hrManagerRoleId) {
    return;
  }

  const [tables] = await conn.execute<mysql.RowDataPacket[]>(
    "SHOW TABLES LIKE 'approval_workflows'",
  );
  if (tables.length === 0) {
    return;
  }

  const templates = [
    {
      moduleCode: 'hrm',
      requestType: 'LEAVE',
      name: 'Quy trình duyệt Nghỉ phép chuẩn (2 cấp)',
      nameEn: 'Standard Leave Approval Workflow (2 Steps)',
      description: 'Cấp 1: Trưởng bộ phận duyệt -> Cấp 2: Trưởng phòng Nhân sự phê duyệt cuối',
      steps: [
        { stepOrder: 1, approverType: 'ROLE', approverRoleId: deptManagerRoleId },
        { stepOrder: 2, approverType: 'ROLE', approverRoleId: hrManagerRoleId },
      ],
    },
    {
      moduleCode: 'hrm',
      requestType: 'OVERTIME',
      name: 'Quy trình duyệt Tăng ca OT (1 cấp)',
      nameEn: 'Overtime (OT) Approval Workflow (1 Step)',
      description: 'Trưởng bộ phận xác nhận kế hoạch làm thêm giờ',
      steps: [{ stepOrder: 1, approverType: 'ROLE', approverRoleId: deptManagerRoleId }],
    },
    {
      moduleCode: 'hrm',
      requestType: 'BUSINESS_TRIP',
      name: 'Quy trình duyệt Đơn Công tác (2 cấp)',
      nameEn: 'Business Trip Approval Workflow (2 Steps)',
      description: 'Cấp 1: Trưởng bộ phận duyệt -> Cấp 2: Trưởng phòng Nhân sự xác nhận công tác',
      steps: [
        { stepOrder: 1, approverType: 'ROLE', approverRoleId: deptManagerRoleId },
        { stepOrder: 2, approverType: 'ROLE', approverRoleId: hrManagerRoleId },
      ],
    },
  ];

  for (const tpl of templates) {
    const [existing] = await conn.execute<mysql.RowDataPacket[]>(
      `SELECT id FROM approval_workflows
       WHERE module_code = ? AND request_type = ? AND name = ? AND deleted_at IS NULL
       LIMIT 1`,
      [tpl.moduleCode, tpl.requestType, tpl.name],
    );
    if (existing.length > 0) {
      await conn.execute(
        'UPDATE approval_workflows SET name_en = ? WHERE id = ? AND (name_en IS NULL OR name_en = "")',
        [tpl.nameEn, Number(existing[0].id)],
      );
      continue;
    }

    const [inserted] = await conn.execute<mysql.ResultSetHeader>(
      `INSERT INTO approval_workflows (module_code, request_type, branch_id, name, name_en, description, is_active)
       VALUES (?, ?, NULL, ?, ?, ?, 1)`,
      [tpl.moduleCode, tpl.requestType, tpl.name, tpl.nameEn, tpl.description],
    );
    const workflowId = Number(inserted.insertId);

    for (const step of tpl.steps) {
      await conn.execute(
        `INSERT INTO approval_workflow_steps (workflow_id, step_order, approver_type, approver_role_id, approver_user_id)
         VALUES (?, ?, ?, ?, NULL)`,
        [workflowId, step.stepOrder, step.approverType, step.approverRoleId],
      );
    }
  }
}

async function seedDefaultHrmOrganization(conn: Connection): Promise<void> {
  const [deptTables] = await conn.execute<mysql.RowDataPacket[]>("SHOW TABLES LIKE 'departments'");
  const [posTables] = await conn.execute<mysql.RowDataPacket[]>("SHOW TABLES LIKE 'positions'");
  if (deptTables.length === 0 || posTables.length === 0) {
    return;
  }

  const [hqRows] = await conn.execute<mysql.RowDataPacket[]>(
    "SELECT id FROM branches WHERE code = 'HQ' AND deleted_at IS NULL LIMIT 1",
  );
  if (hqRows.length > 0) {
    const hqId = Number(hqRows[0].id);

    await conn.execute(
      `INSERT INTO departments (branch_id, parent_id, code, name, name_en, description, sort_order, is_active)
       VALUES (?, NULL, 'BOD', 'Ban Giám đốc', 'Board of Directors', 'Điều hành chiến lược toàn doanh nghiệp', 1, 1)
       ON DUPLICATE KEY UPDATE name = VALUES(name), name_en = VALUES(name_en)`,
      [hqId],
    );

    const [bodRows] = await conn.execute<mysql.RowDataPacket[]>(
      "SELECT id FROM departments WHERE code = 'BOD' LIMIT 1",
    );
    const bodId = bodRows.length > 0 ? Number(bodRows[0].id) : null;

    const childDepts = [
      { code: 'HR', name: 'Phòng Hành chính Nhân sự', nameEn: 'Human Resources & Administration', desc: 'Quản trị nhân sự, tuyển dụng, C&B và hành chính', order: 2 },
      { code: 'FIN', name: 'Phòng Kế toán Tài chính', nameEn: 'Finance & Accounting', desc: 'Kế toán tổng hợp, tài chính và chi trả lương', order: 3 },
      { code: 'TECH', name: 'Phòng Công nghệ Thông tin', nameEn: 'Information Technology', desc: 'Phát triển sản phẩm và vận hành hạ tầng IT', order: 4 },
    ];

    for (const dept of childDepts) {
      await conn.execute(
        `INSERT INTO departments (branch_id, parent_id, code, name, name_en, description, sort_order, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1)
         ON DUPLICATE KEY UPDATE name = VALUES(name), name_en = VALUES(name_en), parent_id = VALUES(parent_id)`,
        [hqId, bodId, dept.code, dept.name, dept.nameEn, dept.desc, dept.order],
      );
    }
  }

  const positions = [
    { code: 'CEO', name: 'Giám đốc Điều hành (CEO)', nameEn: 'Chief Executive Officer (CEO)', level: 5, desc: 'Lãnh đạo cao nhất doanh nghiệp' },
    { code: 'DEPT_HEAD', name: 'Trưởng phòng / Trưởng bộ phận', nameEn: 'Department Head', level: 4, desc: 'Quản lý trực tiếp phòng ban' },
    { code: 'TEAM_LEAD', name: 'Trưởng nhóm (Team Lead)', nameEn: 'Team Lead', level: 3, desc: 'Điều phối nhóm chuyên môn' },
    { code: 'SENIOR', name: 'Chuyên viên Cao cấp (Senior)', nameEn: 'Senior Specialist', level: 2, desc: 'Nhân sự chuyên môn giàu kinh nghiệm' },
    { code: 'STAFF', name: 'Nhân viên / Chuyên viên', nameEn: 'Staff / Specialist', level: 1, desc: 'Nhân sự vận hành chính thức' },
    { code: 'INTERN', name: 'Thực tập sinh', nameEn: 'Intern', level: 1, desc: 'Nhân sự thực tập và đào tạo' },
  ];

  for (const pos of positions) {
    await conn.execute(
      `INSERT INTO positions (code, name, name_en, level, description, is_active)
       VALUES (?, ?, ?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE name = VALUES(name), name_en = VALUES(name_en), level = VALUES(level)`,
      [pos.code, pos.name, pos.nameEn, pos.level, pos.desc],
    );
  }
}

async function seedDefaultHrmEmployees(conn: Connection): Promise<void> {
  const [empTables] = await conn.execute<mysql.RowDataPacket[]>("SHOW TABLES LIKE 'employees'");
  if (empTables.length === 0) {
    return;
  }

  const [hqRows] = await conn.execute<mysql.RowDataPacket[]>(
    "SELECT id FROM branches WHERE code = 'HQ' AND deleted_at IS NULL LIMIT 1",
  );
  if (hqRows.length === 0) {
    return;
  }
  const hqId = Number(hqRows[0].id);

  const [deptRows] = await conn.execute<mysql.RowDataPacket[]>(
    "SELECT id, code FROM departments WHERE code IN ('BOD', 'HR', 'TECH') AND deleted_at IS NULL",
  );
  const [posRows] = await conn.execute<mysql.RowDataPacket[]>(
    "SELECT id, code FROM positions WHERE code IN ('CEO', 'DEPT_HEAD', 'TEAM_LEAD') AND deleted_at IS NULL",
  );
  const [adminRows] = await conn.execute<mysql.RowDataPacket[]>(
    'SELECT id FROM users WHERE email = ? AND deleted_at IS NULL LIMIT 1',
    [DEFAULT_ADMIN_EMAIL],
  );

  const deptMap = new Map<string, number>(deptRows.map((d) => [String(d.code), Number(d.id)]));
  const posMap = new Map<string, number>(posRows.map((p) => [String(p.code), Number(p.id)]));
  const adminUserId = adminRows.length > 0 ? Number(adminRows[0].id) : null;

  const bodId = deptMap.get('BOD');
  const hrId = deptMap.get('HR');
  const techId = deptMap.get('TECH');
  const ceoId = posMap.get('CEO');
  const deptHeadId = posMap.get('DEPT_HEAD');
  const teamLeadId = posMap.get('TEAM_LEAD');

  if (!bodId || !hrId || !techId || !ceoId || !deptHeadId || !teamLeadId) {
    return;
  }

  const ensureEmployee = async (sample: {
    code: string;
    userId: number | null;
    departmentId: number;
    positionId: number;
    managerId: number | null;
    fullName: string;
    gender: 'MALE' | 'FEMALE' | 'OTHER';
    phone: string;
    workEmail: string;
    hireDate: string;
  }): Promise<number> => {
    const [existing] = await conn.execute<mysql.RowDataPacket[]>(
      'SELECT id FROM employees WHERE employee_code = ? LIMIT 1',
      [sample.code],
    );
    if (existing.length > 0) {
      return Number(existing[0].id);
    }

    const [inserted] = await conn.execute<mysql.ResultSetHeader>(
      `INSERT INTO employees (
        user_id, employee_code, branch_id, department_id, position_id, manager_id,
        full_name, gender, phone, work_email, hire_date, employment_status, dependents_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', 0)`,
      [
        sample.userId,
        sample.code,
        hqId,
        sample.departmentId,
        sample.positionId,
        sample.managerId,
        sample.fullName,
        sample.gender,
        sample.phone,
        sample.workEmail,
        sample.hireDate,
      ],
    );
    return Number(inserted.insertId);
  };

  const ceoEmpId = await ensureEmployee({
    code: 'NV0001',
    userId: adminUserId,
    departmentId: bodId,
    positionId: ceoId,
    managerId: null,
    fullName: 'Quản trị Hệ thống',
    gender: 'MALE',
    phone: '0901000001',
    workEmail: DEFAULT_ADMIN_EMAIL,
    hireDate: '2025-01-02',
  });

  const hrEmpId = await ensureEmployee({
    code: 'NV0002',
    userId: null,
    departmentId: hrId,
    positionId: deptHeadId,
    managerId: ceoEmpId,
    fullName: 'Nguyễn Thị Minh Anh',
    gender: 'FEMALE',
    phone: '0901000002',
    workEmail: 'hr.manager@operonhub.local',
    hireDate: '2025-02-01',
  });

  const techEmpId = await ensureEmployee({
    code: 'NV0003',
    userId: null,
    departmentId: techId,
    positionId: teamLeadId,
    managerId: ceoEmpId,
    fullName: 'Trần Hoàng Nam',
    gender: 'MALE',
    phone: '0901000003',
    workEmail: 'tech.lead@operonhub.local',
    hireDate: '2025-03-15',
  });

  await conn.execute(
    'UPDATE departments SET manager_employee_id = ? WHERE id = ? AND manager_employee_id IS NULL',
    [ceoEmpId, bodId],
  );
  await conn.execute(
    'UPDATE departments SET manager_employee_id = ? WHERE id = ? AND manager_employee_id IS NULL',
    [hrEmpId, hrId],
  );
  await conn.execute(
    'UPDATE departments SET manager_employee_id = ? WHERE id = ? AND manager_employee_id IS NULL',
    [techEmpId, techId],
  );
}

async function seedDefaultHrmContractsAndHistories(conn: Connection): Promise<void> {
  const [contractTables] = await conn.execute<mysql.RowDataPacket[]>(
    "SHOW TABLES LIKE 'employee_contracts'",
  );
  const [historyTables] = await conn.execute<mysql.RowDataPacket[]>(
    "SHOW TABLES LIKE 'employee_work_histories'",
  );
  if (contractTables.length === 0 || historyTables.length === 0) {
    return;
  }

  const [empRows] = await conn.execute<mysql.RowDataPacket[]>(
    `SELECT id, employee_code, branch_id, department_id, position_id, hire_date
     FROM employees
     WHERE employee_code IN ('NV0001', 'NV0002', 'NV0003') AND deleted_at IS NULL`,
  );

  const empMap = new Map<
    string,
    { id: number; branchId: number; departmentId: number; positionId: number; hireDate: string }
  >();
  for (const row of empRows) {
    const hireDateStr =
      row.hire_date instanceof Date
        ? row.hire_date.toISOString().slice(0, 10)
        : String(row.hire_date).slice(0, 10);
    empMap.set(String(row.employee_code), {
      id: Number(row.id),
      branchId: Number(row.branch_id),
      departmentId: Number(row.department_id),
      positionId: Number(row.position_id),
      hireDate: hireDateStr,
    });
  }

  const sampleContracts = [
    {
      empCode: 'NV0001',
      contractNo: 'HDLD-2025-001',
      contractType: 'INDEFINITE',
      startDate: '2025-01-02',
      endDate: null,
      baseSalary: 45000000,
      insuranceSalary: 36000000,
      allowances: [
        { code: 'MEAL', label: 'Phụ cấp ăn trưa', amount: 1200000 },
        { code: 'PHONE', label: 'Phụ cấp điện thoại', amount: 800000 },
      ],
      note: 'Hợp đồng không xác định thời hạn Ban Giám đốc',
    },
    {
      empCode: 'NV0002',
      contractNo: 'HDLD-2025-002',
      contractType: 'FIXED_TERM',
      startDate: '2025-02-01',
      endDate: '2027-01-31',
      baseSalary: 26000000,
      insuranceSalary: 22000000,
      allowances: [{ code: 'MEAL', label: 'Phụ cấp ăn trưa', amount: 1000000 }],
      note: 'Hợp đồng xác định thời hạn 24 tháng',
    },
    {
      empCode: 'NV0003',
      contractNo: 'HDLD-2025-003',
      contractType: 'FIXED_TERM',
      startDate: '2025-12-06',
      endDate: '2026-12-05',
      baseSalary: 30000000,
      insuranceSalary: 25000000,
      allowances: [
        { code: 'MEAL', label: 'Phụ cấp ăn trưa', amount: 1000000 },
        { code: 'TECH', label: 'Phụ cấp trực hệ thống', amount: 1500000 },
      ],
      note: 'Hợp đồng sắp hết hạn (mẫu kiểm thử cảnh báo <= 15 ngày)',
    },
  ];

  for (const item of sampleContracts) {
    const emp = empMap.get(item.empCode);
    if (!emp) {
      continue;
    }

    const [existingContract] = await conn.execute<mysql.RowDataPacket[]>(
      'SELECT id FROM employee_contracts WHERE contract_no = ? LIMIT 1',
      [item.contractNo],
    );
    if (existingContract.length === 0) {
      await conn.execute(
        `INSERT INTO employee_contracts (
          employee_id, contract_no, contract_type, start_date, end_date,
          base_salary, insurance_salary, allowances_json, status, signed_date, note
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)`,
        [
          emp.id,
          item.contractNo,
          item.contractType,
          item.startDate,
          item.endDate,
          item.baseSalary,
          item.insuranceSalary,
          JSON.stringify(item.allowances),
          item.startDate,
          item.note,
        ],
      );
    }

    const [existingHire] = await conn.execute<mysql.RowDataPacket[]>(
      "SELECT id FROM employee_work_histories WHERE employee_id = ? AND change_type = 'HIRE' AND deleted_at IS NULL LIMIT 1",
      [emp.id],
    );
    if (existingHire.length === 0) {
      await conn.execute(
        `INSERT INTO employee_work_histories (
          employee_id, change_type, effective_date, decision_no,
          to_branch_id, to_department_id, to_position_id, to_salary, note
        ) VALUES (?, 'HIRE', ?, ?, ?, ?, ?, ?, ?)`,
        [
          emp.id,
          emp.hireDate,
          `QD-TD-${item.empCode}`,
          emp.branchId,
          emp.departmentId,
          emp.positionId,
          item.baseSalary,
          'Tiếp nhận nhân sự chính thức vào doanh nghiệp',
        ],
      );
    }
  }
}

async function seedDefaultHrmLeaves(conn: Connection): Promise<void> {
  const [typeTables] = await conn.execute<mysql.RowDataPacket[]>("SHOW TABLES LIKE 'leave_types'");
  const [balTables] = await conn.execute<mysql.RowDataPacket[]>("SHOW TABLES LIKE 'leave_balances'");
  if (typeTables.length === 0 || balTables.length === 0) {
    return;
  }

  const leaveTypes = [
    {
      code: 'ANNUAL',
      name: 'Nghỉ phép năm',
      nameEn: 'Annual Leave',
      isPaid: 1,
      defaultDays: 12.0,
      allowCarryOver: 1,
      maxCarryOver: 5.0,
      requiresAttachment: 0,
      description: 'Nghỉ phép năm hưởng nguyên lương theo Bộ luật Lao động',
    },
    {
      code: 'SICK',
      name: 'Nghỉ ốm (BHXH)',
      nameEn: 'Sick Leave (Social Insurance)',
      isPaid: 0,
      defaultDays: 0.0,
      allowCarryOver: 0,
      maxCarryOver: 0.0,
      requiresAttachment: 1,
      description: 'Nghỉ ốm hưởng chế độ BHXH (yêu cầu giấy xác nhận cơ sở y tế)',
    },
    {
      code: 'UNPAID',
      name: 'Nghỉ không lương',
      nameEn: 'Unpaid Leave',
      isPaid: 0,
      defaultDays: 0.0,
      allowCarryOver: 0,
      maxCarryOver: 0.0,
      requiresAttachment: 0,
      description: 'Nghỉ việc riêng không hưởng lương',
    },
    {
      code: 'MARRIAGE',
      name: 'Nghỉ kết hôn',
      nameEn: 'Marriage Leave',
      isPaid: 1,
      defaultDays: 3.0,
      allowCarryOver: 0,
      maxCarryOver: 0.0,
      requiresAttachment: 0,
      description: 'Nghỉ kết hôn hưởng nguyên lương (tối đa 3 ngày)',
    },
    {
      code: 'BEREAVEMENT',
      name: 'Nghỉ việc hiếu',
      nameEn: 'Bereavement Leave',
      isPaid: 1,
      defaultDays: 3.0,
      allowCarryOver: 0,
      maxCarryOver: 0.0,
      requiresAttachment: 0,
      description: 'Nghỉ tang chế hưởng nguyên lương (tối đa 3 ngày)',
    },
  ];

  for (const lt of leaveTypes) {
    await conn.execute(
      `INSERT INTO leave_types (
        code, name, name_en, is_paid, default_days_per_year, allow_carry_over,
        max_carry_over_days, requires_attachment, description, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        name_en = VALUES(name_en),
        description = VALUES(description)`,
      [
        lt.code,
        lt.name,
        lt.nameEn,
        lt.isPaid,
        lt.defaultDays,
        lt.allowCarryOver,
        lt.maxCarryOver,
        lt.requiresAttachment,
        lt.description,
      ],
    );
  }

  const [ltRows] = await conn.execute<mysql.RowDataPacket[]>(
    'SELECT id, code, default_days_per_year FROM leave_types WHERE default_days_per_year > 0 AND deleted_at IS NULL',
  );
  const [empRows] = await conn.execute<mysql.RowDataPacket[]>(
    "SELECT id, employee_code FROM employees WHERE employee_code IN ('NV0001', 'NV0002', 'NV0003') AND deleted_at IS NULL",
  );

  const targetYear = 2026;
  for (const emp of empRows) {
    const empId = Number(emp.id);
    const empCode = String(emp.employee_code);
    for (const lt of ltRows) {
      const ltId = Number(lt.id);
      const ltCode = String(lt.code);
      const defaultDays = Number(lt.default_days_per_year);
      const carriedOver = empCode === 'NV0001' && ltCode === 'ANNUAL' ? 2.0 : 0.0;
      await conn.execute(
        `INSERT IGNORE INTO leave_balances (
          employee_id, leave_type_id, year, entitled_days, carried_over_days, used_days, pending_days, note
        ) VALUES (?, ?, ?, ?, ?, 0.00, 0.00, ?)`,
        [empId, ltId, targetYear, defaultDays, carriedOver, 'Khởi tạo quỹ phép năm mẫu'],
      );
    }
  }
}

async function seedDefaultHrmAttendance(conn: Connection): Promise<void> {
  const [shiftTables] = await conn.execute<mysql.RowDataPacket[]>("SHOW TABLES LIKE 'work_shifts'");
  const [assignTables] = await conn.execute<mysql.RowDataPacket[]>(
    "SHOW TABLES LIKE 'employee_shift_assignments'",
  );
  const [holidayTables] = await conn.execute<mysql.RowDataPacket[]>("SHOW TABLES LIKE 'holidays'");
  if (shiftTables.length === 0 || assignTables.length === 0 || holidayTables.length === 0) {
    return;
  }

  const defaultShifts = [
    {
      code: 'HC',
      name: 'Ca Hành chính chuẩn',
      nameEn: 'Standard Office Shift',
      startTime: '08:00',
      endTime: '17:30',
      breakStart: '12:00',
      breakEnd: '13:30',
      lateGrace: 10,
      earlyGrace: 10,
      workingHours: 8.0,
      isDefault: 1,
      description: 'Ca hành chính tiêu chuẩn 8 giờ/ngày (nghỉ trưa 12:00–13:30)',
    },
    {
      code: 'CA_SANG',
      name: 'Ca Sáng linh hoạt',
      nameEn: 'Flexible Morning Shift',
      startTime: '07:30',
      endTime: '16:30',
      breakStart: '11:30',
      breakEnd: '12:30',
      lateGrace: 10,
      earlyGrace: 10,
      workingHours: 8.0,
      isDefault: 0,
      description: 'Ca làm việc bắt đầu sớm 07:30–16:30 (nghỉ trưa 1 giờ)',
    },
  ];

  for (const shift of defaultShifts) {
    await conn.execute(
      `INSERT INTO work_shifts (
        branch_id, code, name, name_en, start_time, end_time, break_start_time, break_end_time,
        late_grace_minutes, early_leave_grace_minutes, working_hours, is_default, is_active, description
      ) VALUES (NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
      ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        name_en = VALUES(name_en),
        description = VALUES(description)`,
      [
        shift.code,
        shift.name,
        shift.nameEn,
        shift.startTime,
        shift.endTime,
        shift.breakStart,
        shift.breakEnd,
        shift.lateGrace,
        shift.earlyGrace,
        shift.workingHours,
        shift.isDefault,
        shift.description,
      ],
    );
  }

  const [hcRows] = await conn.execute<mysql.RowDataPacket[]>(
    "SELECT id FROM work_shifts WHERE code = 'HC' AND deleted_at IS NULL LIMIT 1",
  );
  if (hcRows.length > 0) {
    const hcShiftId = Number(hcRows[0].id);
    const [empRows] = await conn.execute<mysql.RowDataPacket[]>(
      "SELECT id FROM employees WHERE employee_code IN ('NV0001', 'NV0002', 'NV0003') AND deleted_at IS NULL",
    );
    for (const emp of empRows) {
      const empId = Number(emp.id);
      const [existingAssign] = await conn.execute<mysql.RowDataPacket[]>(
        'SELECT id FROM employee_shift_assignments WHERE employee_id = ? AND deleted_at IS NULL LIMIT 1',
        [empId],
      );
      if (existingAssign.length === 0) {
        await conn.execute(
          `INSERT INTO employee_shift_assignments (
            employee_id, shift_id, effective_from, effective_to, work_days_json, note
          ) VALUES (?, ?, '2026-01-01', NULL, ?, ?)`,
          [empId, hcShiftId, JSON.stringify([1, 2, 3, 4, 5]), 'Phân ca hành chính mặc định'],
        );
      }
    }
  }

  const vnHolidays2026 = [
    { date: '2026-01-01', name: 'Tết Dương lịch 2026', nameEn: "New Year's Day 2026", note: 'Nghỉ lễ toàn quốc hưởng nguyên lương' },
    { date: '2026-04-26', name: 'Giỗ Tổ Hùng Vương (10/3 ÂL)', nameEn: "Hung Kings' Commemoration Day (10/3 Lunar)", note: 'Nghỉ lễ toàn quốc hưởng nguyên lương' },
    { date: '2026-04-30', name: 'Ngày Giải phóng miền Nam 30/4', nameEn: 'Reunification Day (Apr 30)', note: 'Nghỉ lễ toàn quốc hưởng nguyên lương' },
    { date: '2026-05-01', name: 'Ngày Quốc tế Lao động 1/5', nameEn: 'International Labor Day (May 1)', note: 'Nghỉ lễ toàn quốc hưởng nguyên lương' },
    { date: '2026-09-02', name: 'Ngày Quốc khánh nước CHXHCN Việt Nam 2/9', nameEn: 'Vietnam National Day (Sep 2)', note: 'Nghỉ lễ toàn quốc hưởng nguyên lương' },
  ];

  for (const h of vnHolidays2026) {
    const [existingHoliday] = await conn.execute<mysql.RowDataPacket[]>(
      'SELECT id FROM holidays WHERE branch_id IS NULL AND holiday_date = ? AND deleted_at IS NULL LIMIT 1',
      [h.date],
    );
    if (existingHoliday.length === 0) {
      await conn.execute(
        `INSERT INTO holidays (branch_id, holiday_date, name, name_en, is_paid, note)
         VALUES (NULL, ?, ?, ?, 1, ?)`,
        [h.date, h.name, h.nameEn, h.note],
      );
    }
  }
}

async function seedDefaultHrmPayrollConfig(conn: Connection): Promise<void> {
  const [settingsTables] = await conn.execute<mysql.RowDataPacket[]>("SHOW TABLES LIKE 'settings'");
  if (settingsTables.length === 0) {
    return;
  }

  const defaultConfig = {
    bhxhEmpRate: 0.08,
    bhytEmpRate: 0.015,
    bhtnEmpRate: 0.01,
    bhxhBhytSalaryCap: 46800000,
    bhtnSalaryCap: 99200000,
    personalDeduction: 11000000,
    dependentDeduction: 4400000,
    workingHoursPerDay: 8,
    otRate150: 1.5,
    otRate200: 2.0,
    otRate300: 3.0,
    requireLockedAttendance: true,
    pitBrackets: [
      { upTo: 5000000, rate: 0.05 },
      { upTo: 10000000, rate: 0.1 },
      { upTo: 18000000, rate: 0.15 },
      { upTo: 32000000, rate: 0.2 },
      { upTo: 52000000, rate: 0.25 },
      { upTo: 80000000, rate: 0.3 },
      { upTo: null, rate: 0.35 },
    ],
  };

  await conn.execute(
    `INSERT IGNORE INTO settings (module_code, setting_key, setting_value, description)
     VALUES ('hrm', 'hrm.payroll.config', ?, 'Cấu hình tỷ lệ BHXH/BHYT/BHTN, mức trần, giảm trừ gia cảnh và biểu thuế TNCN lũy tiến 7 bậc')`,
    [JSON.stringify(defaultConfig)],
  );
}

async function seedDefaultHrmAssets(conn: Connection): Promise<void> {
  const [assetTables] = await conn.execute<mysql.RowDataPacket[]>("SHOW TABLES LIKE 'assets'");
  const [assignTables] = await conn.execute<mysql.RowDataPacket[]>(
    "SHOW TABLES LIKE 'asset_assignments'",
  );
  if (assetTables.length === 0 || assignTables.length === 0) {
    return;
  }

  const [hqRows] = await conn.execute<mysql.RowDataPacket[]>(
    "SELECT id FROM branches WHERE code = 'HQ' AND deleted_at IS NULL LIMIT 1",
  );
  if (hqRows.length === 0) {
    return;
  }
  const hqId = Number(hqRows[0].id);

  const [empRows] = await conn.execute<mysql.RowDataPacket[]>(
    "SELECT id, employee_code FROM employees WHERE employee_code IN ('NV0002', 'NV0003') AND deleted_at IS NULL",
  );
  const empMap = new Map<string, number>(
    empRows.map((r) => [String(r.employee_code), Number(r.id)]),
  );

  const sampleAssets = [
    {
      code: 'TS-LT-001',
      name: 'MacBook Pro 14 M3 Pro 18GB/512GB',
      category: 'LAPTOP',
      brand: 'Apple',
      model: 'A2992',
      serial: 'C02M3PRO001',
      purchaseDate: '2025-03-10',
      warrantyDate: '2027-03-10',
      value: 48500000,
      status: 'ASSIGNED',
      assignTo: 'NV0003',
      condition: 'Mới 100%, nguyên hộp kèm sạc MagSafe 70W',
      note: 'Máy làm việc chính của Trưởng nhóm Công nghệ',
    },
    {
      code: 'TS-LT-002',
      name: 'Dell XPS 13 9340 Core Ultra 7',
      category: 'LAPTOP',
      brand: 'Dell',
      model: 'XPS-9340',
      serial: 'DLXPS934002',
      purchaseDate: '2025-02-01',
      warrantyDate: '2027-02-01',
      value: 34900000,
      status: 'ASSIGNED',
      assignTo: 'NV0002',
      condition: 'Mới 100%, kèm sạc Type-C 65W và chuột không dây',
      note: 'Máy làm việc Phòng Hành chính Nhân sự',
    },
    {
      code: 'TS-MN-001',
      name: 'Màn hình Dell UltraSharp 27" 4K U2723QE',
      category: 'MONITOR',
      brand: 'Dell',
      model: 'U2723QE',
      serial: 'DLU2723QE01',
      purchaseDate: '2025-06-15',
      warrantyDate: '2028-06-15',
      value: 14200000,
      status: 'AVAILABLE',
      assignTo: null,
      condition: null,
      note: 'Sẵn sàng cấp phát tại kho Trụ sở chính',
    },
    {
      code: 'TS-PH-001',
      name: 'iPhone 15 128GB (Thiết bị kiểm thử)',
      category: 'PHONE',
      brand: 'Apple',
      model: 'A3090',
      serial: 'IP15TEST001',
      purchaseDate: '2025-04-20',
      warrantyDate: '2026-04-20',
      value: 19500000,
      status: 'MAINTENANCE',
      assignTo: null,
      condition: null,
      note: 'Đang thay pin và kiểm tra cổng sạc tại trung tâm bảo hành',
    },
  ];

  for (const item of sampleAssets) {
    const [existing] = await conn.execute<mysql.RowDataPacket[]>(
      'SELECT id FROM assets WHERE asset_code = ? LIMIT 1',
      [item.code],
    );
    let assetId: number;
    if (existing.length > 0) {
      assetId = Number(existing[0].id);
    } else {
      const targetEmpId = item.assignTo ? empMap.get(item.assignTo) ?? null : null;
      const finalStatus = targetEmpId ? item.status : item.status === 'ASSIGNED' ? 'AVAILABLE' : item.status;
      const [inserted] = await conn.execute<mysql.ResultSetHeader>(
        `INSERT INTO assets (
          branch_id, asset_code, name, category, brand, model, serial_number,
          purchase_date, warranty_expiry_date, purchase_value, status, note
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          hqId,
          item.code,
          item.name,
          item.category,
          item.brand,
          item.model,
          item.serial,
          item.purchaseDate,
          item.warrantyDate,
          item.value,
          finalStatus,
          item.note,
        ],
      );
      assetId = Number(inserted.insertId);

      if (targetEmpId && item.condition) {
        await conn.execute(
          `INSERT INTO asset_assignments (
            asset_id, employee_id, assigned_at, condition_on_assign, status, note
          ) VALUES (?, ?, NOW(), ?, 'ACTIVE', ?)`,
          [assetId, targetEmpId, item.condition, 'Cấp phát thiết bị mẫu khi khởi tạo hệ thống'],
        );
      }
    }
  }
}

async function seedDefaultHrmRoomsAndAnnouncements(conn: Connection): Promise<void> {
  const [roomTables] = await conn.execute<mysql.RowDataPacket[]>("SHOW TABLES LIKE 'meeting_rooms'");
  const [annTables] = await conn.execute<mysql.RowDataPacket[]>("SHOW TABLES LIKE 'announcements'");
  if (roomTables.length === 0 || annTables.length === 0) {
    return;
  }

  const [hqRows] = await conn.execute<mysql.RowDataPacket[]>(
    "SELECT id FROM branches WHERE code = 'HQ' AND deleted_at IS NULL LIMIT 1",
  );
  const [adminRows] = await conn.execute<mysql.RowDataPacket[]>(
    'SELECT id FROM users WHERE email = ? AND deleted_at IS NULL LIMIT 1',
    [DEFAULT_ADMIN_EMAIL],
  );
  if (hqRows.length === 0 || adminRows.length === 0) {
    return;
  }

  const hqId = Number(hqRows[0].id);
  const adminUserId = Number(adminRows[0].id);

  const sampleRooms = [
    {
      code: 'PH-01',
      name: 'Phòng họp Lớn (Boardroom)',
      nameEn: 'Main Boardroom',
      floor: 'Tầng 5',
      capacity: 16,
      equipment: ['TV 75 inch 4K', 'Hệ thống hội nghị truyền hình', 'Bảng kính trắng', 'Micro không dây'],
      description: 'Phòng họp chính phục vụ giao ban tuần, họp Ban Giám đốc và tiếp đón đối tác',
    },
    {
      code: 'PH-02',
      name: 'Phòng họp Nhỏ A (Focus Room)',
      nameEn: 'Focus Room A',
      floor: 'Tầng 4',
      capacity: 6,
      equipment: ['Màn hình 55 inch', 'Bảng trắng', 'Cáp HDMI / USB-C'],
      description: 'Phòng họp nhanh theo nhóm dự án, phỏng vấn ứng viên hoặc trao đổi 1-1',
    },
    {
      code: 'PH-03',
      name: 'Phòng Đào tạo & Hội thảo',
      nameEn: 'Training & Conference Hall',
      floor: 'Tầng 6',
      capacity: 30,
      equipment: ['Máy chiếu Laser', 'Hệ thống âm thanh hội trường', 'Bảng Flipchart', 'Bục phát biểu'],
      description: 'Không gian tổ chức đào tạo nội bộ, onboarding nhân sự mới và hội thảo toàn công ty',
    },
  ];

  for (const room of sampleRooms) {
    await conn.execute(
      `INSERT INTO meeting_rooms (
        branch_id, code, name, name_en, floor, capacity, equipment_json, description, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
      ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        name_en = VALUES(name_en),
        floor = VALUES(floor),
        capacity = VALUES(capacity),
        equipment_json = VALUES(equipment_json),
        description = VALUES(description)`,
      [
        hqId,
        room.code,
        room.name,
        room.nameEn,
        room.floor,
        room.capacity,
        JSON.stringify(room.equipment),
        room.description,
      ],
    );
  }

  const sampleAnnouncements = [
    {
      branchId: null as number | null,
      title: 'Quy định chấm công, nghỉ phép & sử dụng phòng họp Operon Hub',
      content:
        'Kính gửi toàn thể CBNV,\n\nNhằm chuẩn hóa quy trình vận hành nội bộ trên cổng Operon Hub, Phòng Hành chính Nhân sự thông báo áp dụng thống nhất các quy định sau:\n1. Chấm công: Thực hiện Check-in/Check-out đúng giờ quy định của ca làm việc được phân công.\n2. Đơn từ: Gửi đơn nghỉ phép, tăng ca (OT), công tác trực tiếp tại mục Đơn từ của tôi để hệ thống tự động luân chuyển phê duyệt.\n3. Đặt phòng họp: Vui lòng đặt lịch trước trên hệ thống và hủy lịch tối thiểu 30 phút nếu không sử dụng để tối ưu không gian chung.\n\nTrân trọng cảm ơn sự phối hợp của Anh/Chị!',
      category: 'HR_POLICY',
      isPinned: 1,
    },
    {
      branchId: hqId,
      title: 'Lịch tổng kết vận hành cuối tháng & giao lưu nội bộ Trụ sở chính',
      content:
        'Thân gửi Anh/Chị CBNV Trụ sở chính (HQ),\n\nBan Giám đốc và Phòng Hành chính trân trọng mời toàn thể thành viên tham dự buổi Tổng kết vận hành tháng và giao lưu sinh nhật thành viên trong tháng.\n- Thời gian dự kiến: 16:00 – 17:30 ngày thứ Sáu tuần cuối tháng.\n- Địa điểm: Phòng Đào tạo & Hội thảo (PH-03, Tầng 6).\n\nKính mong Anh/Chị sắp xếp công việc tham dự đầy đủ và bấm xác nhận đã đọc thông báo này.',
      category: 'EVENT',
      isPinned: 0,
    },
  ];

  for (const ann of sampleAnnouncements) {
    const [existingAnn] = await conn.execute<mysql.RowDataPacket[]>(
      'SELECT id FROM announcements WHERE title = ? AND deleted_at IS NULL LIMIT 1',
      [ann.title],
    );
    if (existingAnn.length === 0) {
      await conn.execute(
        `INSERT INTO announcements (
          branch_id, title, content, category, is_pinned, published_at, status, author_id, created_by
        ) VALUES (?, ?, ?, ?, ?, NOW(), 'PUBLISHED', ?, ?)`,
        [
          ann.branchId,
          ann.title,
          ann.content,
          ann.category,
          ann.isPinned,
          adminUserId,
          adminUserId,
        ],
      );
    }
  }
}

async function seedDefaultProposalsModule(
  conn: Connection,
  roleMap: Map<string, number>,
): Promise<void> {
  const [catTables] = await conn.execute<mysql.RowDataPacket[]>(
    "SHOW TABLES LIKE 'proposal_categories'",
  );
  if (catTables.length === 0) {
    return;
  }

  for (const cat of DEFAULT_PROPOSAL_CATEGORIES) {
    await conn.execute(
      `INSERT INTO proposal_categories (
        code, name, name_en, description, default_request_type,
        requires_budget, budget_threshold_high, icon_name, color_hex, sort_order, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        name_en = VALUES(name_en),
        description = VALUES(description),
        budget_threshold_high = VALUES(budget_threshold_high),
        color_hex = VALUES(color_hex),
        sort_order = VALUES(sort_order)`,
      [
        cat.code,
        cat.name,
        cat.nameEn,
        cat.description,
        cat.defaultRequestType,
        cat.requiresBudget ? 1 : 0,
        cat.budgetThresholdHigh,
        cat.iconName,
        cat.colorHex,
        cat.sortOrder,
      ],
    );
  }

  const deptManagerRoleId = roleMap.get('DEPT_MANAGER') ?? null;
  const adminOpsRoleId = roleMap.get('ADMIN_OPS') ?? null;
  const executiveRoleId = roleMap.get('EXECUTIVE') ?? null;

  let highValueWorkflowId: number | null = null;
  let standardWorkflowId: number | null = null;

  if (deptManagerRoleId && adminOpsRoleId && executiveRoleId) {
    const proposalWorkflows = [
      {
        key: 'high',
        name: 'Quy trình duyệt Đề xuất Giá trị lớn (≥ 20 triệu — 3 cấp)',
        nameEn: 'High-Value Proposal Approval (≥ 20M VND — 3 Steps)',
        description:
          'Áp dụng cho đề xuất có ngân sách từ 20.000.000 VNĐ: Quản lý trực tiếp -> Hành chính -> Ban Giám đốc',
        conditionsJson: JSON.stringify({ minAmount: PROPOSAL_HIGH_VALUE_THRESHOLD_VND }),
        steps: [
          { stepOrder: 1, approverType: 'DIRECT_MANAGER', approverRoleId: deptManagerRoleId },
          { stepOrder: 2, approverType: 'ROLE', approverRoleId: adminOpsRoleId },
          { stepOrder: 3, approverType: 'ROLE', approverRoleId: executiveRoleId },
        ],
      },
      {
        key: 'standard',
        name: 'Quy trình duyệt Đề xuất Tiêu chuẩn (2 cấp)',
        nameEn: 'Standard Internal Proposal Approval (2 Steps)',
        description:
          'Áp dụng cho đề xuất thường (< 20 triệu hoặc không phát sinh ngân sách): Quản lý trực tiếp -> Hành chính',
        conditionsJson: null as string | null,
        steps: [
          { stepOrder: 1, approverType: 'DIRECT_MANAGER', approverRoleId: deptManagerRoleId },
          { stepOrder: 2, approverType: 'ROLE', approverRoleId: adminOpsRoleId },
        ],
      },
    ];

    for (const wf of proposalWorkflows) {
      const [existingWf] = await conn.execute<mysql.RowDataPacket[]>(
        `SELECT id FROM approval_workflows
         WHERE module_code = ? AND request_type = ? AND name = ? AND deleted_at IS NULL
         LIMIT 1`,
        [PROPOSAL_MODULE_CODE, PROPOSAL_DEFAULT_REQUEST_TYPE, wf.name],
      );
      let wfId: number;
      if (existingWf.length > 0) {
        wfId = Number(existingWf[0].id);
      } else {
        const [inserted] = await conn.execute<mysql.ResultSetHeader>(
          `INSERT INTO approval_workflows (
            module_code, request_type, branch_id, name, name_en, description, conditions_json, is_active
          ) VALUES (?, ?, NULL, ?, ?, ?, ?, 1)`,
          [
            PROPOSAL_MODULE_CODE,
            PROPOSAL_DEFAULT_REQUEST_TYPE,
            wf.name,
            wf.nameEn,
            wf.description,
            wf.conditionsJson,
          ],
        );
        wfId = Number(inserted.insertId);
        for (const step of wf.steps) {
          await conn.execute(
            `INSERT INTO approval_workflow_steps (workflow_id, step_order, approver_type, approver_role_id, approver_user_id)
             VALUES (?, ?, ?, ?, NULL)`,
            [wfId, step.stepOrder, step.approverType, step.approverRoleId],
          );
        }
      }
      if (wf.key === 'high') {
        highValueWorkflowId = wfId;
      } else {
        standardWorkflowId = wfId;
      }
    }
  }

  const [hqRows] = await conn.execute<mysql.RowDataPacket[]>(
    "SELECT id FROM branches WHERE code = 'HQ' AND deleted_at IS NULL LIMIT 1",
  );
  const [adminRows] = await conn.execute<mysql.RowDataPacket[]>(
    'SELECT id FROM users WHERE email = ? AND deleted_at IS NULL LIMIT 1',
    [DEFAULT_ADMIN_EMAIL],
  );
  if (hqRows.length === 0 || adminRows.length === 0) {
    return;
  }

  const hqId = Number(hqRows[0].id);
  const adminUserId = Number(adminRows[0].id);

  const [empRows] = await conn.execute<mysql.RowDataPacket[]>(
    'SELECT id, department_id FROM employees WHERE user_id = ? AND deleted_at IS NULL LIMIT 1',
    [adminUserId],
  );
  const [deptRows] = await conn.execute<mysql.RowDataPacket[]>(
    'SELECT id, code FROM departments WHERE deleted_at IS NULL',
  );
  const [catRows] = await conn.execute<mysql.RowDataPacket[]>(
    'SELECT id, code FROM proposal_categories WHERE deleted_at IS NULL',
  );

  const deptMap = new Map<string, number>(deptRows.map((d) => [String(d.code), Number(d.id)]));
  const catMap = new Map<string, number>(catRows.map((c) => [String(c.code), Number(c.id)]));
  const adminEmpId = empRows.length > 0 ? Number(empRows[0].id) : null;

  const sampleProposals = [
    {
      code: 'PROP-202611-0001',
      categoryCode: 'EQUIPMENT',
      deptCode: 'TECH',
      title: 'Đề xuất nâng cấp màn hình 4K & docking station cho đội Kỹ thuật',
      summary: 'Trang bị 6 màn hình 27 inch 4K và 6 hub USB-C nhằm tăng hiệu suất lập trình và review UI.',
      content:
        'Hiện tại đội Kỹ thuật đã mở rộng thêm 6 nhân sự mới cho Phase 2 Operon Hub nhưng thiết bị màn hình rời đang thiếu. Đề xuất mua sắm 6 bộ màn hình 27 inch 4K chuẩn màu sRGB 99% kèm docking station USB-C để chuẩn hóa góc làm việc và bảo vệ thị lực cho nhân viên.',
      expectedOutcome: 'Tăng 20% tốc độ xử lý đa nhiệm, giảm tình trạng mỏi mắt khi làm việc kéo dài.',
      priority: 'HIGH',
      status: 'PENDING_APPROVAL',
      vendorName: 'Công ty TNHH Máy tính Minh Anh',
      neededByDate: '2026-12-10',
      items: [
        { name: 'Màn hình Dell UltraSharp 27" 4K USB-C', spec: 'U2723QE, bảo hành 36 tháng', unit: 'Chiếc', qty: 6, price: 11500000 },
        { name: 'Docking Station USB-C 10-in-1', spec: 'Hỗ trợ sạc PD 100W, HDMI 4K', unit: 'Bộ', qty: 6, price: 1450000 },
      ],
      needsApproval: true,
    },
    {
      code: 'PROP-202611-0002',
      categoryCode: 'EVENT',
      deptCode: 'HR',
      title: 'Tờ trình tổ chức Tiệc Tất niên & Vinh danh cuối năm 2026',
      summary: 'Kế hoạch tổ chức Year-End Party cho 85 CBNV Trụ sở chính kèm quà vinh danh cá nhân xuất sắc.',
      content:
        'Nhằm tổng kết thành tựu năm 2026 và gắn kết đội ngũ trước thềm năm mới 2027, Phòng Hành chính Nhân sự đề xuất tổ chức chương trình Year-End Party tại khách sạn trung tâm với các hạng mục: hội trường âm thanh ánh sáng, tiệc tối buffet, kỷ niệm chương vinh danh và quà bốc thăm may mắn.',
      expectedOutcome: 'Nâng cao mức độ gắn kết nội bộ (eNPS >= 85%) và tạo động lực bứt phá quý I/2027.',
      priority: 'MEDIUM',
      status: 'APPROVED',
      vendorName: 'Trung tâm Hội nghị Grand Palace',
      neededByDate: '2026-12-20',
      items: [
        { name: 'Gói tiệc tối & hội trường 85 khách', spec: 'Bao gồm LED screen + âm thanh ánh sáng', unit: 'Suất', qty: 85, price: 650000 },
        { name: 'Kỷ niệm chương pha lê & khung bằng khen', spec: 'Khắc laser logo Operon Hub', unit: 'Bộ', qty: 15, price: 450000 },
      ],
      needsApproval: false,
    },
    {
      code: 'PROP-202611-0003',
      categoryCode: 'HR_TRAINING',
      deptCode: 'TECH',
      title: 'Đề xuất tài trợ chứng chỉ Cloud & Bảo mật ứng dụng cho nhóm Backend',
      summary: 'Đăng ký khóa ôn luyện và lệ phí thi chứng chỉ bảo mật & tối ưu cơ sở dữ liệu cho 4 kỹ sư.',
      content:
        'Đáp ứng yêu cầu nâng chuẩn bảo mật và tối ưu hiệu năng truy vấn MySQL trên các hệ thống doanh nghiệp, đề xuất công ty tài trợ 100% học phí và lệ phí thi chứng chỉ cho 4 kỹ sư chủ chốt kèm cam kết chia sẻ seminar nội bộ sau khóa học.',
      expectedOutcome: 'Đội ngũ tự chủ kiểm định bảo mật và giảm 40% thời gian phản hồi API trọng yếu.',
      priority: 'MEDIUM',
      status: 'IN_EXECUTION',
      vendorName: 'Học viện Công nghệ CloudVN',
      neededByDate: '2026-12-15',
      items: [
        { name: 'Khóa đào tạo Database Performance & Security', spec: 'Online + thực hành 8 tuần', unit: 'Học viên', qty: 4, price: 3200000 },
        { name: 'Lệ phí thi chứng chỉ quốc tế', spec: 'Voucher thi chính thức', unit: 'Voucher', qty: 4, price: 1500000 },
      ],
      needsApproval: false,
    },
    {
      code: 'PROP-202611-0004',
      categoryCode: 'PROCESS_IMPROVEMENT',
      deptCode: 'BOD',
      title: 'Đề xuất áp dụng quy trình Số hóa Tờ trình & Ký duyệt không giấy tờ',
      summary: 'Chuyển toàn bộ tờ trình mua sắm, sự kiện và hành chính sang vận hành trực tuyến trên Operon Hub.',
      content:
        'Hiện tại các đề xuất nội bộ vẫn phải in giấy, trình ký thủ công qua nhiều tầng gây chậm trễ 3–5 ngày và khó tra cứu lịch sử. Đề xuất áp dụng chính thức phân hệ Đề xuất Nội bộ trên Operon Hub từ ngày 01/12/2026 với 2 mức phê duyệt tự động theo giá trị ngân sách.',
      expectedOutcome: 'Rút ngắn thời gian phê duyệt trung bình xuống dưới 24 giờ và tiết kiệm 80% chi phí in ấn.',
      priority: 'HIGH',
      status: 'COMPLETED',
      vendorName: null,
      neededByDate: '2026-11-30',
      items: [],
      needsApproval: false,
    },
    {
      code: 'PROP-202611-0005',
      categoryCode: 'PROCUREMENT',
      deptCode: 'HR',
      title: 'Đề xuất bổ sung văn phòng phẩm & máy pha cà phê khu vực Pantry',
      summary: 'Mua sắm định kỳ văn phòng phẩm tháng 12 và thay mới máy pha cà phê tự động tầng 5.',
      content:
        'Máy pha cà phê khu vực Pantry tầng 5 đã hết bảo hành và thường xuyên lỗi áp suất. Đồng thời cần bổ sung giấy in A4, bút viết bảng và phụ kiện phòng họp cho tháng 12.',
      expectedOutcome: 'Đảm bảo tiện nghi văn phòng và trải nghiệm làm việc tốt nhất cho CBNV.',
      priority: 'LOW',
      status: 'NEEDS_REVISION',
      vendorName: 'Siêu thị Văn phòng Thiên Long Pro',
      neededByDate: '2026-12-05',
      items: [
        { name: 'Máy pha cà phê tự động hạt nguyên chất', spec: 'Công suất 80 ly/ngày, BH 24 tháng', unit: 'Máy', qty: 1, price: 14500000 },
        { name: 'Combo giấy A4 Double A & VPP tháng 12', spec: '20 ram giấy + bút bảng + bìa hồ sơ', unit: 'Gói', qty: 1, price: 2800000 },
      ],
      needsApproval: false,
    },
  ];

  for (const sample of sampleProposals) {
    const [existing] = await conn.execute<mysql.RowDataPacket[]>(
      'SELECT id FROM proposals WHERE proposal_code = ? LIMIT 1',
      [sample.code],
    );
    if (existing.length > 0) {
      continue;
    }

    const categoryId = catMap.get(sample.categoryCode) ?? Array.from(catMap.values())[0];
    if (!categoryId) {
      continue;
    }
    const departmentId = deptMap.get(sample.deptCode) ?? null;
    const estimatedBudget = sample.items.reduce((sum, it) => sum + it.qty * it.price, 0);

    const [inserted] = await conn.execute<mysql.ResultSetHeader>(
      `INSERT INTO proposals (
        proposal_code, category_id, branch_id, department_id,
        requester_employee_id, requester_user_id, title, summary, content, expected_outcome,
        priority, status, estimated_budget, approved_budget, currency, needed_by_date, vendor_name,
        submitted_at, approved_at, completed_at, rejection_reason, execution_notes, created_by, updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'VND', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sample.code,
        categoryId,
        hqId,
        departmentId,
        adminEmpId,
        adminUserId,
        sample.title,
        sample.summary,
        sample.content,
        sample.expectedOutcome,
        sample.priority,
        sample.status,
        estimatedBudget,
        ['APPROVED', 'IN_EXECUTION', 'COMPLETED'].includes(sample.status) ? estimatedBudget : null,
        sample.neededByDate,
        sample.vendorName,
        sample.status !== 'DRAFT' ? new Date() : null,
        ['APPROVED', 'IN_EXECUTION', 'COMPLETED'].includes(sample.status) ? new Date() : null,
        sample.status === 'COMPLETED' ? new Date() : null,
        sample.status === 'NEEDS_REVISION'
          ? 'Vui lòng đính kèm thêm tối thiểu 02 báo giá so sánh cho máy pha cà phê trước khi gửi duyệt lại.'
          : null,
        sample.status === 'COMPLETED'
          ? 'Đã ban hành hướng dẫn sử dụng toàn công ty và vận hành ổn định.'
          : sample.status === 'IN_EXECUTION'
            ? 'Đã đăng ký lịch khai giảng khóa đầu tiên cho 4 kỹ sư Backend.'
            : null,
        adminUserId,
        adminUserId,
      ],
    );

    const proposalId = Number(inserted.insertId);
    for (let i = 0; i < sample.items.length; i += 1) {
      const it = sample.items[i];
      await conn.execute(
        `INSERT INTO proposal_items (
          proposal_id, line_no, item_name, specification, unit, quantity, unit_price, line_total, created_by, updated_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          proposalId,
          i + 1,
          it.name,
          it.spec,
          it.unit,
          it.qty,
          it.price,
          it.qty * it.price,
          adminUserId,
          adminUserId,
        ],
      );
    }

    if (sample.needsApproval && (highValueWorkflowId || standardWorkflowId)) {
      const wfId =
        estimatedBudget >= PROPOSAL_HIGH_VALUE_THRESHOLD_VND && highValueWorkflowId
          ? highValueWorkflowId
          : (standardWorkflowId ?? highValueWorkflowId!);
      const totalSteps =
        estimatedBudget >= PROPOSAL_HIGH_VALUE_THRESHOLD_VND && highValueWorkflowId ? 3 : 2;
      const [arInserted] = await conn.execute<mysql.ResultSetHeader>(
        `INSERT INTO approval_requests (
          workflow_id, module_code, request_type, entity_type, entity_id,
          branch_id, requester_id, title, summary, current_step, total_steps,
          current_approver_user_id, current_approver_role_id, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, NULL, ?, 'PENDING')`,
        [
          wfId,
          PROPOSAL_MODULE_CODE,
          PROPOSAL_DEFAULT_REQUEST_TYPE,
          PROPOSAL_ENTITY_TYPE,
          proposalId,
          hqId,
          adminUserId,
          `[${sample.code}] ${sample.title}`,
          `Dự toán: ${estimatedBudget.toLocaleString('vi-VN')} ₫`,
          totalSteps,
          deptManagerRoleId,
        ],
      );
      const arId = Number(arInserted.insertId);
      await conn.execute(
        `INSERT INTO approval_histories (approval_request_id, step_order, actor_id, action, comment)
         VALUES (?, 1, ?, 'SUBMIT', 'Gửi đề xuất phê duyệt tự động')`,
        [arId, adminUserId],
      );
      await conn.execute('UPDATE proposals SET approval_request_id = ? WHERE id = ?', [
        arId,
        proposalId,
      ]);
    }

    if (sample.status === 'NEEDS_REVISION') {
      await conn.execute(
        `INSERT INTO proposal_comments (proposal_id, author_user_id, comment_type, content, created_by, updated_by)
         VALUES (?, ?, 'REVISION_REQUEST', ?, ?, ?)`,
        [
          proposalId,
          adminUserId,
          'Vui lòng đính kèm thêm tối thiểu 02 báo giá so sánh cho máy pha cà phê trước khi gửi duyệt lại.',
          adminUserId,
          adminUserId,
        ],
      );
    }

    await conn.execute(
      `INSERT INTO proposal_activities (proposal_id, actor_user_id, action_type, detail_json)
       VALUES (?, ?, 'CREATED', ?)`,
      [proposalId, adminUserId, JSON.stringify({ proposalCode: sample.code, estimatedBudget })],
    );
  }
}

export async function runCoreSeed(): Promise<void> {
  assertLocalDevEnvironment(process.env);
  const env = parseServerEnv(process.env);

  const conn = await mysql.createConnection({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    charset: 'utf8mb4',
  });

  try {
    await seedDefaultBranch(conn);
    const roleMap = await seedRolesAndPermissions(conn);
    const superAdminRoleId = roleMap.get('SUPER_ADMIN');
    if (!superAdminRoleId) {
      throw new Error('Không khởi tạo được vai trò SUPER_ADMIN.');
    }
    await seedSuperAdminUser(conn, superAdminRoleId);
    await seedDefaultApprovalWorkflows(conn, roleMap);
    await seedDefaultHrmOrganization(conn);
    await seedDefaultHrmEmployees(conn);
    await seedDefaultHrmContractsAndHistories(conn);
    await seedDefaultHrmLeaves(conn);
    await seedDefaultHrmAttendance(conn);
    await seedDefaultHrmPayrollConfig(conn);
    await seedDefaultHrmAssets(conn);
    await seedDefaultHrmRoomsAndAnnouncements(conn);
    await seedDefaultProposalsModule(conn, roleMap);
    console.log(
      '[SEED CORE OK] Đã khởi tạo chi nhánh HQ, 9 roles, permissions, Super Admin, quy trình duyệt, cơ cấu tổ chức, hồ sơ NV, hợp đồng, quỹ phép, chấm công, cấu hình lương, kho tài sản, phòng họp, thông báo & module Đề xuất mẫu.',
    );
  } finally {
    await conn.end();
  }
}

const currentFilePath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(currentFilePath)) {
  runCoreSeed().catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[SEED ERROR] ${message}`);
    process.exit(1);
  });
}
