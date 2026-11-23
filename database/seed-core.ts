import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql, { type Connection } from 'mysql2/promise';
import { parseServerEnv } from '@/config/env';
import { hashPassword } from '@/lib/portable/password-hasher';
import { assertLocalDevEnvironment } from './migrator';

const DEFAULT_ADMIN_EMAIL = 'admin@operonhub.local';
const DEFAULT_ADMIN_PASSWORD = 'Admin@123456';
const DEFAULT_ADMIN_NAME = 'Quản trị Hệ thống';

const SYSTEM_ROLES = [
  { code: 'SUPER_ADMIN', name: 'Quản trị Hệ thống', dataScope: 'ALL', description: 'Toàn quyền quản trị hệ thống Operon Hub' },
  { code: 'EXECUTIVE', name: 'Ban Giám đốc', dataScope: 'ALL', description: 'Xem báo cáo tổng quan và duyệt cấp cao' },
  { code: 'HR_MANAGER', name: 'Trưởng phòng Nhân sự', dataScope: 'ALL', description: 'Quản trị toàn diện phân hệ HRM' },
  { code: 'HR_STAFF', name: 'Chuyên viên Nhân sự', dataScope: 'BRANCH', description: 'Vận hành hồ sơ nhân sự và chấm công tại chi nhánh' },
  { code: 'PAYROLL_ACCOUNTANT', name: 'Kế toán Lương (C&B)', dataScope: 'ALL', description: 'Quản lý bảng công và tính lương toàn công ty' },
  { code: 'ADMIN_OPS', name: 'Hành chính Văn phòng', dataScope: 'BRANCH', description: 'Quản lý tài sản, phòng họp và thông báo nội bộ' },
  { code: 'DEPT_MANAGER', name: 'Trưởng Bộ phận', dataScope: 'DEPARTMENT', description: 'Quản lý nhân sự và phê duyệt đơn từ trong phòng ban' },
  { code: 'EMPLOYEE', name: 'Nhân viên', dataScope: 'OWN', description: 'Cổng nhân viên tự phục vụ (ESS)' },
] as const;

const BASELINE_PERMISSIONS = [
  { moduleCode: 'core', code: 'core.branches.read', name: 'Xem danh sách chi nhánh' },
  { moduleCode: 'core', code: 'core.branches.create', name: 'Tạo chi nhánh mới' },
  { moduleCode: 'core', code: 'core.branches.update', name: 'Cập nhật chi nhánh' },
  { moduleCode: 'core', code: 'core.branches.delete', name: 'Xóa mềm chi nhánh' },
  { moduleCode: 'core', code: 'core.users.read', name: 'Xem danh sách tài khoản' },
  { moduleCode: 'core', code: 'core.users.create', name: 'Tạo tài khoản người dùng' },
  { moduleCode: 'core', code: 'core.users.update', name: 'Cập nhật tài khoản & gán vai trò' },
  { moduleCode: 'core', code: 'core.roles.read', name: 'Xem vai trò & ma trận phân quyền' },
  { moduleCode: 'core', code: 'core.roles.update', name: 'Cập nhật phân quyền cho vai trò' },
  { moduleCode: 'core', code: 'core.audit_logs.read', name: 'Xem nhật ký kiểm toán hệ thống' },
  { moduleCode: 'core', code: 'core.settings.read', name: 'Xem cấu hình hệ thống' },
  { moduleCode: 'core', code: 'core.settings.update', name: 'Cập nhật cấu hình hệ thống' },
  { moduleCode: 'core', code: 'core.approvals.read', name: 'Xem hộp thư phê duyệt & luồng duyệt' },
  { moduleCode: 'core', code: 'core.approvals.act', name: 'Phê duyệt hoặc từ chối đơn yêu cầu' },
  { moduleCode: 'core', code: 'core.approvals.workflow_manage', name: 'Cấu hình quy trình duyệt đa cấp' },
  { moduleCode: 'hrm', code: 'hrm.dashboard.read', name: 'Xem tổng quan Hành chính Nhân sự' },
  { moduleCode: 'hrm', code: 'hrm.org.read', name: 'Xem cơ cấu tổ chức, phòng ban & chức danh' },
  { moduleCode: 'hrm', code: 'hrm.org.manage', name: 'Quản trị phòng ban & danh mục chức danh' },
  { moduleCode: 'hrm', code: 'hrm.employees.read', name: 'Xem hồ sơ nhân viên (theo Data Scope)' },
  { moduleCode: 'hrm', code: 'hrm.employees.create', name: 'Thêm mới hồ sơ nhân viên' },
  { moduleCode: 'hrm', code: 'hrm.employees.update', name: 'Cập nhật hồ sơ nhân viên & tài liệu' },
  { moduleCode: 'hrm', code: 'hrm.employees.delete', name: 'Xóa mềm hồ sơ nhân viên' },
  { moduleCode: 'hrm', code: 'hrm.employees.export', name: 'Xuất danh sách nhân viên ra Excel' },
  { moduleCode: 'hrm', code: 'hrm.contracts.read', name: 'Xem hợp đồng lao động & quá trình công tác' },
  { moduleCode: 'hrm', code: 'hrm.contracts.manage', name: 'Quản trị hợp đồng lao động & quyết định công tác' },
  { moduleCode: 'hrm', code: 'hrm.contracts.export', name: 'Xuất danh sách hợp đồng lao động ra Excel' },
  { moduleCode: 'hrm', code: 'hrm.requests.read', name: 'Xem đơn từ nghỉ phép & quỹ phép (theo Data Scope)' },
  { moduleCode: 'hrm', code: 'hrm.requests.create', name: 'Tạo & gửi đơn nghỉ phép/đơn từ cá nhân (ESS)' },
  { moduleCode: 'hrm', code: 'hrm.requests.manage', name: 'Quản trị loại phép, khởi tạo & điều chỉnh quỹ phép năm' },
  { moduleCode: 'hrm', code: 'hrm.requests.export', name: 'Xuất danh sách đơn từ nghỉ phép ra Excel' },
  { moduleCode: 'hrm', code: 'hrm.attendance.read', name: 'Xem ca làm việc, ngày lễ & bảng chấm công theo Data Scope' },
  { moduleCode: 'hrm', code: 'hrm.attendance.manage', name: 'Quản trị ca làm việc, phân ca, ngày lễ & chỉnh sửa chấm công' },
  { moduleCode: 'hrm', code: 'hrm.attendance.import', name: 'Import dữ liệu chấm công từ file Excel' },
  { moduleCode: 'hrm', code: 'hrm.attendance.lock', name: 'Chốt & mở khóa bảng công tháng' },
  { moduleCode: 'hrm', code: 'hrm.attendance.export', name: 'Xuất dữ liệu chấm công ra Excel' },
  { moduleCode: 'hrm', code: 'hrm.payroll.read', name: 'Xem kỳ lương, bảng tính lương và cấu hình thuế/bảo hiểm' },
  { moduleCode: 'hrm', code: 'hrm.payroll.manage', name: 'Tạo kỳ lương, chạy tính lương, chỉnh thưởng/khấu trừ & cấu hình lương' },
  { moduleCode: 'hrm', code: 'hrm.payroll.approve', name: 'Phê duyệt, mở lại & xác nhận chi trả kỳ lương' },
  { moduleCode: 'hrm', code: 'hrm.payroll.export', name: 'Xuất bảng lương tổng Excel & phiếu lương PDF' },
  { moduleCode: 'hrm', code: 'hrm.assets.read', name: 'Xem kho tài sản & lịch sử cấp phát theo Data Scope' },
  { moduleCode: 'hrm', code: 'hrm.assets.manage', name: 'Quản trị danh mục tài sản, cấp phát, thu hồi & bảo trì' },
  { moduleCode: 'hrm', code: 'hrm.assets.export', name: 'Xuất danh sách tài sản Excel & biên bản bàn giao PDF' },
  { moduleCode: 'hrm', code: 'hrm.rooms.read', name: 'Xem danh sách phòng họp & lịch đặt phòng' },
  { moduleCode: 'hrm', code: 'hrm.rooms.book', name: 'Đặt lịch phòng họp & quản lý lịch họp cá nhân' },
  { moduleCode: 'hrm', code: 'hrm.rooms.manage', name: 'Quản trị phòng họp & điều phối toàn bộ lịch đặt phòng' },
  { moduleCode: 'hrm', code: 'hrm.announcements.read', name: 'Đọc bản tin & thông báo nội bộ' },
  { moduleCode: 'hrm', code: 'hrm.announcements.manage', name: 'Soạn thảo, xuất bản, ghim & thống kê thông báo nội bộ' },
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
  ],
  ADMIN_OPS: [
    'core.branches.read',
    'core.approvals.read',
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
  ],
};

async function seedDefaultBranch(conn: Connection): Promise<void> {
  await conn.execute(
    `INSERT INTO branches (code, name, address, is_headquarters, is_active)
     VALUES (?, ?, ?, 1, 1)
     ON DUPLICATE KEY UPDATE name = VALUES(name)`,
    ['HQ', 'Trụ sở chính', 'Văn phòng trung tâm Operon Hub'],
  );
}

async function seedRolesAndPermissions(conn: Connection): Promise<Map<string, number>> {
  for (const role of SYSTEM_ROLES) {
    await conn.execute(
      `INSERT INTO roles (code, name, data_scope, description, is_system)
       VALUES (?, ?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE name = VALUES(name), data_scope = VALUES(data_scope), description = VALUES(description)`,
      [role.code, role.name, role.dataScope, role.description],
    );
  }

  for (const perm of BASELINE_PERMISSIONS) {
    await conn.execute(
      `INSERT INTO permissions (module_code, code, name)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE module_code = VALUES(module_code), name = VALUES(name)`,
      [perm.moduleCode, perm.code, perm.name],
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
      description: 'Trưởng bộ phận xác nhận kế hoạch làm thêm giờ',
      steps: [{ stepOrder: 1, approverType: 'ROLE', approverRoleId: deptManagerRoleId }],
    },
    {
      moduleCode: 'hrm',
      requestType: 'BUSINESS_TRIP',
      name: 'Quy trình duyệt Đơn Công tác (2 cấp)',
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
      continue;
    }

    const [inserted] = await conn.execute<mysql.ResultSetHeader>(
      `INSERT INTO approval_workflows (module_code, request_type, branch_id, name, description, is_active)
       VALUES (?, ?, NULL, ?, ?, 1)`,
      [tpl.moduleCode, tpl.requestType, tpl.name, tpl.description],
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
      `INSERT INTO departments (branch_id, parent_id, code, name, description, sort_order, is_active)
       VALUES (?, NULL, 'BOD', 'Ban Giám đốc', 'Điều hành chiến lược toàn doanh nghiệp', 1, 1)
       ON DUPLICATE KEY UPDATE name = VALUES(name)`,
      [hqId],
    );

    const [bodRows] = await conn.execute<mysql.RowDataPacket[]>(
      "SELECT id FROM departments WHERE code = 'BOD' LIMIT 1",
    );
    const bodId = bodRows.length > 0 ? Number(bodRows[0].id) : null;

    const childDepts = [
      { code: 'HR', name: 'Phòng Hành chính Nhân sự', desc: 'Quản trị nhân sự, tuyển dụng, C&B và hành chính', order: 2 },
      { code: 'FIN', name: 'Phòng Kế toán Tài chính', desc: 'Kế toán tổng hợp, tài chính và chi trả lương', order: 3 },
      { code: 'TECH', name: 'Phòng Công nghệ Thông tin', desc: 'Phát triển sản phẩm và vận hành hạ tầng IT', order: 4 },
    ];

    for (const dept of childDepts) {
      await conn.execute(
        `INSERT INTO departments (branch_id, parent_id, code, name, description, sort_order, is_active)
         VALUES (?, ?, ?, ?, ?, ?, 1)
         ON DUPLICATE KEY UPDATE name = VALUES(name), parent_id = VALUES(parent_id)`,
        [hqId, bodId, dept.code, dept.name, dept.desc, dept.order],
      );
    }
  }

  const positions = [
    { code: 'CEO', name: 'Giám đốc Điều hành (CEO)', level: 5, desc: 'Lãnh đạo cao nhất doanh nghiệp' },
    { code: 'DEPT_HEAD', name: 'Trưởng phòng / Trưởng bộ phận', level: 4, desc: 'Quản lý trực tiếp phòng ban' },
    { code: 'TEAM_LEAD', name: 'Trưởng nhóm (Team Lead)', level: 3, desc: 'Điều phối nhóm chuyên môn' },
    { code: 'SENIOR', name: 'Chuyên viên Cao cấp (Senior)', level: 2, desc: 'Nhân sự chuyên môn giàu kinh nghiệm' },
    { code: 'STAFF', name: 'Nhân viên / Chuyên viên', level: 1, desc: 'Nhân sự vận hành chính thức' },
    { code: 'INTERN', name: 'Thực tập sinh', level: 1, desc: 'Nhân sự thực tập và đào tạo' },
  ];

  for (const pos of positions) {
    await conn.execute(
      `INSERT INTO positions (code, name, level, description, is_active)
       VALUES (?, ?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE name = VALUES(name), level = VALUES(level)`,
      [pos.code, pos.name, pos.level, pos.desc],
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
        code, name, is_paid, default_days_per_year, allow_carry_over,
        max_carry_over_days, requires_attachment, description, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
      ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        description = VALUES(description)`,
      [
        lt.code,
        lt.name,
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
        branch_id, code, name, start_time, end_time, break_start_time, break_end_time,
        late_grace_minutes, early_leave_grace_minutes, working_hours, is_default, is_active, description
      ) VALUES (NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
      ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        description = VALUES(description)`,
      [
        shift.code,
        shift.name,
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
    { date: '2026-01-01', name: 'Tết Dương lịch 2026', note: 'Nghỉ lễ toàn quốc hưởng nguyên lương' },
    { date: '2026-04-26', name: 'Giỗ Tổ Hùng Vương (10/3 ÂL)', note: 'Nghỉ lễ toàn quốc hưởng nguyên lương' },
    { date: '2026-04-30', name: 'Ngày Giải phóng miền Nam 30/4', note: 'Nghỉ lễ toàn quốc hưởng nguyên lương' },
    { date: '2026-05-01', name: 'Ngày Quốc tế Lao động 1/5', note: 'Nghỉ lễ toàn quốc hưởng nguyên lương' },
    { date: '2026-09-02', name: 'Ngày Quốc khánh nước CHXHCN Việt Nam 2/9', note: 'Nghỉ lễ toàn quốc hưởng nguyên lương' },
  ];

  for (const h of vnHolidays2026) {
    const [existingHoliday] = await conn.execute<mysql.RowDataPacket[]>(
      'SELECT id FROM holidays WHERE branch_id IS NULL AND holiday_date = ? AND deleted_at IS NULL LIMIT 1',
      [h.date],
    );
    if (existingHoliday.length === 0) {
      await conn.execute(
        `INSERT INTO holidays (branch_id, holiday_date, name, is_paid, note)
         VALUES (NULL, ?, ?, 1, ?)`,
        [h.date, h.name, h.note],
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
      floor: 'Tầng 5',
      capacity: 16,
      equipment: ['TV 75 inch 4K', 'Hệ thống hội nghị truyền hình', 'Bảng kính trắng', 'Micro không dây'],
      description: 'Phòng họp chính phục vụ giao ban tuần, họp Ban Giám đốc và tiếp đón đối tác',
    },
    {
      code: 'PH-02',
      name: 'Phòng họp Nhỏ A (Focus Room)',
      floor: 'Tầng 4',
      capacity: 6,
      equipment: ['Màn hình 55 inch', 'Bảng trắng', 'Cáp HDMI / USB-C'],
      description: 'Phòng họp nhanh theo nhóm dự án, phỏng vấn ứng viên hoặc trao đổi 1-1',
    },
    {
      code: 'PH-03',
      name: 'Phòng Đào tạo & Hội thảo',
      floor: 'Tầng 6',
      capacity: 30,
      equipment: ['Máy chiếu Laser', 'Hệ thống âm thanh hội trường', 'Bảng Flipchart', 'Bục phát biểu'],
      description: 'Không gian tổ chức đào tạo nội bộ, onboarding nhân sự mới và hội thảo toàn công ty',
    },
  ];

  for (const room of sampleRooms) {
    await conn.execute(
      `INSERT INTO meeting_rooms (
        branch_id, code, name, floor, capacity, equipment_json, description, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 1)
      ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        floor = VALUES(floor),
        capacity = VALUES(capacity),
        equipment_json = VALUES(equipment_json),
        description = VALUES(description)`,
      [
        hqId,
        room.code,
        room.name,
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
    console.log(
      '[SEED CORE OK] Đã khởi tạo chi nhánh HQ, 8 roles, permissions, Super Admin, quy trình duyệt, cơ cấu tổ chức, hồ sơ NV, hợp đồng, quỹ phép, chấm công, cấu hình lương, kho tài sản, phòng họp & thông báo mẫu.',
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
