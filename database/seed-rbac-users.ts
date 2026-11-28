import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql, { type Connection } from 'mysql2/promise';
import { parseServerEnv } from '@/config/env';
import { hashPassword } from '@/lib/portable/password-hasher';
import { assertLocalDevEnvironment } from './migrator';

export const RBAC_TEST_DEFAULT_PASSWORD = 'Operon@123456';

interface SeedUserSpec {
  email: string;
  password?: string; // Omit to preserve existing user's password; new users get RBAC_TEST_DEFAULT_PASSWORD
  fullName: string;
  status: 'ACTIVE' | 'LOCKED';
  roleCode: string;
  roleBranchCode: 'ALL' | 'HQ' | 'HCM';
  employeeCode: string;
  branchCode: 'HQ' | 'HCM';
  departmentCode: 'BOD' | 'HR' | 'FIN' | 'TECH' | 'HCM_OPS' | 'HCM_TECH';
  positionCode: 'CEO' | 'DEPT_HEAD' | 'TEAM_LEAD' | 'SENIOR' | 'STAFF' | 'INTERN';
  managerEmployeeCode: string | null;
  gender: 'MALE' | 'FEMALE' | 'OTHER';
  phone: string;
  nationalId: string;
  taxCode: string;
  socialInsuranceNo: string;
  bankName: string;
  bankAccountNo: string;
  hireDate: string;
  baseSalary: number;
}

export const RBAC_SEED_USERS: readonly SeedUserSpec[] = [
  // Existing SUPER_ADMIN (keep Admin@123456)
  {
    email: 'admin@operonhub.local',
    fullName: 'Portal Admin',
    status: 'ACTIVE',
    roleCode: 'SUPER_ADMIN',
    roleBranchCode: 'ALL',
    employeeCode: 'NV0001',
    branchCode: 'HQ',
    departmentCode: 'BOD',
    positionCode: 'CEO',
    managerEmployeeCode: null,
    gender: 'MALE',
    phone: '0901000001',
    nationalId: '001085000001',
    taxCode: '8010000001',
    socialInsuranceNo: '0123000001',
    bankName: 'Vietcombank',
    bankAccountNo: '0011001000001',
    hireDate: '2025-01-02',
    baseSalary: 65000000,
  },
  // EXECUTIVE (Ban Giám đốc - ALL)
  {
    email: 'ceo@operonhub.local',
    fullName: 'Lê Quốc Hùng (Ban Giám đốc)',
    status: 'ACTIVE',
    roleCode: 'EXECUTIVE',
    roleBranchCode: 'ALL',
    employeeCode: 'NV0004',
    branchCode: 'HQ',
    departmentCode: 'BOD',
    positionCode: 'CEO',
    managerEmployeeCode: null,
    gender: 'MALE',
    phone: '0901000004',
    nationalId: '001080000004',
    taxCode: '8010000004',
    socialInsuranceNo: '0123000004',
    bankName: 'Vietcombank',
    bankAccountNo: '0011001000004',
    hireDate: '2025-01-05',
    baseSalary: 80000000,
  },
  // HR_MANAGER (Trưởng phòng Nhân sự - ALL, links existing NV0002)
  {
    email: 'hr.manager@operonhub.local',
    fullName: 'Nguyễn Thị Minh Anh',
    status: 'ACTIVE',
    roleCode: 'HR_MANAGER',
    roleBranchCode: 'ALL',
    employeeCode: 'NV0002',
    branchCode: 'HQ',
    departmentCode: 'HR',
    positionCode: 'DEPT_HEAD',
    managerEmployeeCode: 'NV0004',
    gender: 'FEMALE',
    phone: '0901000002',
    nationalId: '001188000002',
    taxCode: '8010000002',
    socialInsuranceNo: '0123000002',
    bankName: 'Techcombank',
    bankAccountNo: '1903001000002',
    hireDate: '2025-02-01',
    baseSalary: 38000000,
  },
  // HR_STAFF @ HQ (Chuyên viên Nhân sự - BRANCH: HQ)
  {
    email: 'hr.staff.hq@operonhub.local',
    fullName: 'Phạm Thu Hà (HR HQ)',
    status: 'ACTIVE',
    roleCode: 'HR_STAFF',
    roleBranchCode: 'HQ',
    employeeCode: 'NV0005',
    branchCode: 'HQ',
    departmentCode: 'HR',
    positionCode: 'SENIOR',
    managerEmployeeCode: 'NV0002',
    gender: 'FEMALE',
    phone: '0901000005',
    nationalId: '001193000005',
    taxCode: '8010000005',
    socialInsuranceNo: '0123000005',
    bankName: 'Techcombank',
    bankAccountNo: '1903001000005',
    hireDate: '2025-03-01',
    baseSalary: 20000000,
  },
  // HR_STAFF @ HCM (Chuyên viên Nhân sự - BRANCH: HCM)
  {
    email: 'hr.staff.hcm@operonhub.local',
    fullName: 'Võ Thị Lan Anh (HR HCM)',
    status: 'ACTIVE',
    roleCode: 'HR_STAFF',
    roleBranchCode: 'HCM',
    employeeCode: 'NV0006',
    branchCode: 'HCM',
    departmentCode: 'HCM_OPS',
    positionCode: 'STAFF',
    managerEmployeeCode: 'NV0002',
    gender: 'FEMALE',
    phone: '0902000006',
    nationalId: '079195000006',
    taxCode: '8010000006',
    socialInsuranceNo: '0123000006',
    bankName: 'ACB',
    bankAccountNo: '2098001000006',
    hireDate: '2025-04-01',
    baseSalary: 17000000,
  },
  // PAYROLL_ACCOUNTANT (Kế toán Lương C&B - ALL)
  {
    email: 'payroll@operonhub.local',
    fullName: 'Đặng Thị Mai Phương (C&B)',
    status: 'ACTIVE',
    roleCode: 'PAYROLL_ACCOUNTANT',
    roleBranchCode: 'ALL',
    employeeCode: 'NV0007',
    branchCode: 'HQ',
    departmentCode: 'FIN',
    positionCode: 'SENIOR',
    managerEmployeeCode: 'NV0008',
    gender: 'FEMALE',
    phone: '0901000007',
    nationalId: '001192000007',
    taxCode: '8010000007',
    socialInsuranceNo: '0123000007',
    bankName: 'VietinBank',
    bankAccountNo: '1040001000007',
    hireDate: '2025-02-15',
    baseSalary: 25000000,
  },
  // FINANCE_ACCOUNTANT (Existing user finance@operonhub.local - ALL)
  {
    email: 'finance@operonhub.local',
    fullName: 'Nguyễn Minh Thu (Kế toán Thanh toán)',
    status: 'ACTIVE',
    roleCode: 'FINANCE_ACCOUNTANT',
    roleBranchCode: 'ALL',
    employeeCode: 'NV0008',
    branchCode: 'HQ',
    departmentCode: 'FIN',
    positionCode: 'DEPT_HEAD',
    managerEmployeeCode: 'NV0004',
    gender: 'FEMALE',
    phone: '0901000008',
    nationalId: '001189000008',
    taxCode: '8010000008',
    socialInsuranceNo: '0123000008',
    bankName: 'BIDV',
    bankAccountNo: '2151001000008',
    hireDate: '2025-02-10',
    baseSalary: 32000000,
  },
  // ADMIN_OPS @ HQ (Hành chính Văn phòng - BRANCH: HQ)
  {
    email: 'admin.ops.hq@operonhub.local',
    fullName: 'Bùi Quang Huy (Hành chính HQ)',
    status: 'ACTIVE',
    roleCode: 'ADMIN_OPS',
    roleBranchCode: 'HQ',
    employeeCode: 'NV0009',
    branchCode: 'HQ',
    departmentCode: 'HR',
    positionCode: 'SENIOR',
    managerEmployeeCode: 'NV0002',
    gender: 'MALE',
    phone: '0901000009',
    nationalId: '001091000009',
    taxCode: '8010000009',
    socialInsuranceNo: '0123000009',
    bankName: 'MBBank',
    bankAccountNo: '0880001000009',
    hireDate: '2025-03-10',
    baseSalary: 19500000,
  },
  // PMO_MANAGER (Trưởng ban Quản lý Dự án - ALL)
  {
    email: 'pmo@operonhub.local',
    fullName: 'Hoàng Đức Thắng (PMO)',
    status: 'ACTIVE',
    roleCode: 'PMO_MANAGER',
    roleBranchCode: 'ALL',
    employeeCode: 'NV0010',
    branchCode: 'HQ',
    departmentCode: 'TECH',
    positionCode: 'DEPT_HEAD',
    managerEmployeeCode: 'NV0004',
    gender: 'MALE',
    phone: '0901000010',
    nationalId: '001087000010',
    taxCode: '8010000010',
    socialInsuranceNo: '0123000010',
    bankName: 'Vietcombank',
    bankAccountNo: '0011001000010',
    hireDate: '2025-01-20',
    baseSalary: 45000000,
  },
  // IT_SUPPORT (Existing user it.support@operonhub.local - ALL)
  {
    email: 'it.support@operonhub.local',
    fullName: 'Nguyễn Minh Khôi (IT Support)',
    status: 'ACTIVE',
    roleCode: 'IT_SUPPORT',
    roleBranchCode: 'ALL',
    employeeCode: 'NV0011',
    branchCode: 'HQ',
    departmentCode: 'TECH',
    positionCode: 'SENIOR',
    managerEmployeeCode: 'NV0003',
    gender: 'MALE',
    phone: '0901000011',
    nationalId: '001094000011',
    taxCode: '8010000011',
    socialInsuranceNo: '0123000011',
    bankName: 'TPBank',
    bankAccountNo: '0234001000011',
    hireDate: '2025-03-20',
    baseSalary: 22000000,
  },
  // DEPT_MANAGER @ HQ/TECH (Trưởng Bộ phận - DEPARTMENT, links existing NV0003)
  {
    email: 'manager.tech@operonhub.local',
    fullName: 'Trần Hoàng Nam',
    status: 'ACTIVE',
    roleCode: 'DEPT_MANAGER',
    roleBranchCode: 'HQ',
    employeeCode: 'NV0003',
    branchCode: 'HQ',
    departmentCode: 'TECH',
    positionCode: 'TEAM_LEAD',
    managerEmployeeCode: 'NV0004',
    gender: 'MALE',
    phone: '0901000003',
    nationalId: '001090000003',
    taxCode: '8010000003',
    socialInsuranceNo: '0123000003',
    bankName: 'Techcombank',
    bankAccountNo: '1903001000003',
    hireDate: '2025-03-15',
    baseSalary: 35000000,
  },
  // DEPT_MANAGER @ HCM/HCM_TECH (Trưởng Bộ phận HCM - DEPARTMENT)
  {
    email: 'manager.hcm@operonhub.local',
    fullName: 'Ngô Thanh Tùng (Trưởng BP HCM)',
    status: 'ACTIVE',
    roleCode: 'DEPT_MANAGER',
    roleBranchCode: 'HCM',
    employeeCode: 'NV0012',
    branchCode: 'HCM',
    departmentCode: 'HCM_TECH',
    positionCode: 'DEPT_HEAD',
    managerEmployeeCode: 'NV0004',
    gender: 'MALE',
    phone: '0902000012',
    nationalId: '079089000012',
    taxCode: '8010000012',
    socialInsuranceNo: '0123000012',
    bankName: 'ACB',
    bankAccountNo: '2098001000012',
    hireDate: '2025-04-10',
    baseSalary: 34000000,
  },
  // EMPLOYEE @ HQ/TECH (Nhân viên - OWN)
  {
    email: 'employee.tech1@operonhub.local',
    fullName: 'Đỗ Văn Khoa (Dev HQ)',
    status: 'ACTIVE',
    roleCode: 'EMPLOYEE',
    roleBranchCode: 'HQ',
    employeeCode: 'NV0013',
    branchCode: 'HQ',
    departmentCode: 'TECH',
    positionCode: 'STAFF',
    managerEmployeeCode: 'NV0003',
    gender: 'MALE',
    phone: '0901000013',
    nationalId: '001097000013',
    taxCode: '8010000013',
    socialInsuranceNo: '0123000013',
    bankName: 'Vietcombank',
    bankAccountNo: '0011001000013',
    hireDate: '2025-05-01',
    baseSalary: 18500000,
  },
  // EMPLOYEE @ HQ/FIN (Nhân viên Tài chính - OWN, cross-dept IDOR target)
  {
    email: 'employee.fin@operonhub.local',
    fullName: 'Lý Thị Ngọc Bích (NV Tài chính)',
    status: 'ACTIVE',
    roleCode: 'EMPLOYEE',
    roleBranchCode: 'HQ',
    employeeCode: 'NV0014',
    branchCode: 'HQ',
    departmentCode: 'FIN',
    positionCode: 'STAFF',
    managerEmployeeCode: 'NV0008',
    gender: 'FEMALE',
    phone: '0901000014',
    nationalId: '001196000014',
    taxCode: '8010000014',
    socialInsuranceNo: '0123000014',
    bankName: 'BIDV',
    bankAccountNo: '2151001000014',
    hireDate: '2025-05-15',
    baseSalary: 16500000,
  },
  // EMPLOYEE / INTERN @ HCM/HCM_TECH (Thực tập sinh HCM - OWN, cross-branch)
  {
    email: 'intern.hcm@operonhub.local',
    fullName: 'Trương Gia Bảo (Thực tập sinh HCM)',
    status: 'ACTIVE',
    roleCode: 'EMPLOYEE',
    roleBranchCode: 'HCM',
    employeeCode: 'NV0015',
    branchCode: 'HCM',
    departmentCode: 'HCM_TECH',
    positionCode: 'INTERN',
    managerEmployeeCode: 'NV0012',
    gender: 'MALE',
    phone: '0902000015',
    nationalId: '079202000015',
    taxCode: '8010000015',
    socialInsuranceNo: '0123000015',
    bankName: 'TPBank',
    bankAccountNo: '0234001000015',
    hireDate: '2026-08-01',
    baseSalary: 6000000,
  },
  // LOCKED ACCOUNT @ HQ/TECH (Security negative test)
  {
    email: 'locked.user@operonhub.local',
    fullName: 'Tài khoản Bị Khóa (RBAC Test)',
    status: 'LOCKED',
    roleCode: 'EMPLOYEE',
    roleBranchCode: 'HQ',
    employeeCode: 'NV0016',
    branchCode: 'HQ',
    departmentCode: 'TECH',
    positionCode: 'STAFF',
    managerEmployeeCode: 'NV0003',
    gender: 'OTHER',
    phone: '0901000016',
    nationalId: '001098000016',
    taxCode: '8010000016',
    socialInsuranceNo: '0123000016',
    bankName: 'MBBank',
    bankAccountNo: '0880001000016',
    hireDate: '2025-06-01',
    baseSalary: 15000000,
  },
];

async function deduplicateUserRoles(conn: Connection): Promise<void> {
  const [rows] = await conn.execute<mysql.RowDataPacket[]>(
    'SELECT id, user_id, role_id, branch_id FROM user_roles ORDER BY id ASC',
  );
  const seen = new Set<string>();
  const duplicateIds: number[] = [];
  for (const r of rows) {
    const key = `${r.user_id}:${r.role_id}:${r.branch_id === null ? 'NULL' : r.branch_id}`;
    if (seen.has(key)) {
      duplicateIds.push(Number(r.id));
    } else {
      seen.add(key);
    }
  }
  for (const id of duplicateIds) {
    await conn.execute('DELETE FROM user_roles WHERE id = ?', [id]);
  }
}

async function seedBranchesAndDepartments(conn: Connection): Promise<{
  branchMap: Map<string, number>;
  deptMap: Map<string, number>;
  posMap: Map<string, number>;
  roleMap: Map<string, number>;
}> {
  await conn.execute(
    `INSERT INTO branches (code, name, name_en, address, phone, is_headquarters, is_active)
     VALUES ('HCM', 'Chi nhánh TP. Hồ Chí Minh', 'Ho Chi Minh City Branch', 'Tầng 12, Quận 1, TP. Hồ Chí Minh', '02838889999', 0, 1)
     ON DUPLICATE KEY UPDATE name = VALUES(name), name_en = VALUES(name_en), is_active = 1`,
  );

  const [branches] = await conn.execute<mysql.RowDataPacket[]>(
    'SELECT id, code FROM branches WHERE deleted_at IS NULL',
  );
  const branchMap = new Map<string, number>(branches.map((b) => [String(b.code), Number(b.id)]));

  const hcmId = branchMap.get('HCM');
  const [bodRows] = await conn.execute<mysql.RowDataPacket[]>(
    "SELECT id FROM departments WHERE code = 'BOD' AND deleted_at IS NULL LIMIT 1",
  );
  const bodId = bodRows.length > 0 ? Number(bodRows[0].id) : null;

  if (hcmId) {
    const hcmDepts = [
      {
        code: 'HCM_OPS',
        name: 'Phòng Vận hành & Hành chính HCM',
        nameEn: 'HCM Operations & Administration',
        desc: 'Nhân sự và vận hành chi nhánh TP.HCM',
        order: 5,
      },
      {
        code: 'HCM_TECH',
        name: 'Phòng Kỹ thuật HCM',
        nameEn: 'HCM Engineering',
        desc: 'Đội ngũ phát triển phần mềm chi nhánh TP.HCM',
        order: 6,
      },
    ];
    for (const d of hcmDepts) {
      await conn.execute(
        `INSERT INTO departments (branch_id, parent_id, code, name, name_en, description, sort_order, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1)
         ON DUPLICATE KEY UPDATE name = VALUES(name), name_en = VALUES(name_en), branch_id = VALUES(branch_id)`,
        [hcmId, bodId, d.code, d.name, d.nameEn, d.desc, d.order],
      );
    }
  }

  const [depts] = await conn.execute<mysql.RowDataPacket[]>(
    'SELECT id, code FROM departments WHERE deleted_at IS NULL',
  );
  const [positions] = await conn.execute<mysql.RowDataPacket[]>(
    'SELECT id, code FROM positions WHERE deleted_at IS NULL',
  );
  const [roles] = await conn.execute<mysql.RowDataPacket[]>(
    'SELECT id, code FROM roles WHERE deleted_at IS NULL',
  );

  return {
    branchMap,
    deptMap: new Map(depts.map((d) => [String(d.code), Number(d.id)])),
    posMap: new Map(positions.map((p) => [String(p.code), Number(p.id)])),
    roleMap: new Map(roles.map((r) => [String(r.code), Number(r.id)])),
  };
}

async function seedUsersAndEmployees(
  conn: Connection,
  maps: {
    branchMap: Map<string, number>;
    deptMap: Map<string, number>;
    posMap: Map<string, number>;
    roleMap: Map<string, number>;
  },
): Promise<{ userMap: Map<string, number>; empMap: Map<string, number> }> {
  const defaultPasswordHash = await hashPassword(RBAC_TEST_DEFAULT_PASSWORD);
  const userMap = new Map<string, number>();
  const empMap = new Map<string, number>();

  for (const spec of RBAC_SEED_USERS) {
    const [existingUsers] = await conn.execute<mysql.RowDataPacket[]>(
      'SELECT id FROM users WHERE email = ? AND deleted_at IS NULL LIMIT 1',
      [spec.email],
    );
    let userId: number;
    if (existingUsers.length > 0) {
      userId = Number(existingUsers[0].id);
      await conn.execute('UPDATE users SET status = ? WHERE id = ?', [spec.status, userId]);
    } else {
      const pwdHash = spec.password ? await hashPassword(spec.password) : defaultPasswordHash;
      const [inserted] = await conn.execute<mysql.ResultSetHeader>(
        `INSERT INTO users (email, password_hash, full_name, status)
         VALUES (?, ?, ?, ?)`,
        [spec.email, pwdHash, spec.fullName, spec.status],
      );
      userId = Number(inserted.insertId);
    }
    userMap.set(spec.email, userId);

    const roleId = maps.roleMap.get(spec.roleCode);
    const assignedBranchId =
      spec.roleBranchCode === 'ALL' ? null : (maps.branchMap.get(spec.roleBranchCode) ?? null);
    if (roleId) {
      const [existingRole] = await conn.execute<mysql.RowDataPacket[]>(
        assignedBranchId === null
          ? 'SELECT id FROM user_roles WHERE user_id = ? AND role_id = ? AND branch_id IS NULL LIMIT 1'
          : 'SELECT id FROM user_roles WHERE user_id = ? AND role_id = ? AND branch_id = ? LIMIT 1',
        assignedBranchId === null ? [userId, roleId] : [userId, roleId, assignedBranchId],
      );
      if (existingRole.length === 0) {
        await conn.execute(
          'INSERT INTO user_roles (user_id, role_id, branch_id) VALUES (?, ?, ?)',
          [userId, roleId, assignedBranchId],
        );
      }
    }

    const branchId = maps.branchMap.get(spec.branchCode)!;
    const departmentId = maps.deptMap.get(spec.departmentCode)!;
    const positionId = maps.posMap.get(spec.positionCode)!;

    const [existingEmp] = await conn.execute<mysql.RowDataPacket[]>(
      'SELECT id FROM employees WHERE employee_code = ? AND deleted_at IS NULL LIMIT 1',
      [spec.employeeCode],
    );

    let empId: number;
    if (existingEmp.length > 0) {
      empId = Number(existingEmp[0].id);
      await conn.execute(
        `UPDATE employees
         SET user_id = ?, branch_id = ?, department_id = ?, position_id = ?,
             national_id = COALESCE(national_id, ?),
             tax_code = COALESCE(tax_code, ?),
             social_insurance_no = COALESCE(social_insurance_no, ?),
             bank_name = COALESCE(bank_name, ?),
             bank_account_no = COALESCE(bank_account_no, ?)
         WHERE id = ?`,
        [
          userId,
          branchId,
          departmentId,
          positionId,
          spec.nationalId,
          spec.taxCode,
          spec.socialInsuranceNo,
          spec.bankName,
          spec.bankAccountNo,
          empId,
        ],
      );
    } else {
      const [insertedEmp] = await conn.execute<mysql.ResultSetHeader>(
        `INSERT INTO employees (
          user_id, employee_code, branch_id, department_id, position_id, manager_id,
          full_name, gender, national_id, tax_code, social_insurance_no,
          phone, work_email, bank_name, bank_account_no,
          hire_date, employment_status, dependents_count
        ) VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', 0)`,
        [
          userId,
          spec.employeeCode,
          branchId,
          departmentId,
          positionId,
          spec.fullName,
          spec.gender,
          spec.nationalId,
          spec.taxCode,
          spec.socialInsuranceNo,
          spec.phone,
          spec.email,
          spec.bankName,
          spec.bankAccountNo,
          spec.hireDate,
        ],
      );
      empId = Number(insertedEmp.insertId);
    }
    empMap.set(spec.employeeCode, empId);
  }

  // Second pass: set manager_id hierarchy + department managers
  for (const spec of RBAC_SEED_USERS) {
    if (!spec.managerEmployeeCode) continue;
    const empId = empMap.get(spec.employeeCode);
    const mgrId = empMap.get(spec.managerEmployeeCode);
    if (empId && mgrId) {
      await conn.execute('UPDATE employees SET manager_id = ? WHERE id = ?', [mgrId, empId]);
    }
  }

  const deptManagers: Array<{ deptCode: string; empCode: string }> = [
    { deptCode: 'BOD', empCode: 'NV0004' },
    { deptCode: 'HR', empCode: 'NV0002' },
    { deptCode: 'FIN', empCode: 'NV0008' },
    { deptCode: 'TECH', empCode: 'NV0003' },
    { deptCode: 'HCM_OPS', empCode: 'NV0006' },
    { deptCode: 'HCM_TECH', empCode: 'NV0012' },
  ];
  for (const dm of deptManagers) {
    const deptId = maps.deptMap.get(dm.deptCode);
    const empId = empMap.get(dm.empCode);
    if (deptId && empId) {
      await conn.execute('UPDATE departments SET manager_employee_id = ? WHERE id = ?', [
        empId,
        deptId,
      ]);
    }
  }

  return { userMap, empMap };
}

async function seedRbacTestFixtures(
  conn: Connection,
  maps: {
    branchMap: Map<string, number>;
    deptMap: Map<string, number>;
    roleMap: Map<string, number>;
  },
  userMap: Map<string, number>,
  empMap: Map<string, number>,
): Promise<void> {
  const adminUserId = userMap.get('admin@operonhub.local')!;
  const pmoUserId = userMap.get('pmo@operonhub.local')!;
  const finEmpUserId = userMap.get('employee.fin@operonhub.local')!;
  const techEmpUserId = userMap.get('employee.tech1@operonhub.local')!;
  const financeMgrUserId = userMap.get('finance@operonhub.local')!;

  const hqId = maps.branchMap.get('HQ')!;
  const hcmId = maps.branchMap.get('HCM')!;
  const finDeptId = maps.deptMap.get('FIN')!;
  const techDeptId = maps.deptMap.get('TECH')!;
  const hcmTechDeptId = maps.deptMap.get('HCM_TECH')!;
  const deptMgrRoleId = maps.roleMap.get('DEPT_MANAGER')!;

  // 1. Seed Active Contracts for key employees
  const contractSeeds = [
    { code: 'HD-RBAC-NV0005', empCode: 'NV0005', salary: 20000000 },
    { code: 'HD-RBAC-NV0006', empCode: 'NV0006', salary: 17000000 },
    { code: 'HD-RBAC-NV0013', empCode: 'NV0013', salary: 18500000 },
    { code: 'HD-RBAC-NV0014', empCode: 'NV0014', salary: 16500000 },
    { code: 'HD-RBAC-NV0015', empCode: 'NV0015', salary: 6000000 },
  ];
  for (const c of contractSeeds) {
    const empId = empMap.get(c.empCode)!;
    const [existing] = await conn.execute<mysql.RowDataPacket[]>(
      'SELECT id FROM employee_contracts WHERE contract_no = ? LIMIT 1',
      [c.code],
    );
    if (existing.length === 0) {
      await conn.execute(
        `INSERT INTO employee_contracts (
          employee_id, contract_no, contract_type, start_date, end_date,
          base_salary, insurance_salary, status, signed_date, created_by, updated_by
        ) VALUES (?, ?, 'FIXED_TERM', '2026-01-01', '2027-12-31', ?, ?, 'ACTIVE', '2026-01-01', ?, ?)`,
        [empId, c.code, c.salary, Math.min(c.salary, 15000000), adminUserId, adminUserId],
      );
    }
  }

  // 2. Seed Sensitive Employee Document (ID_CARD / CCCD) on NV0014 (FIN) & NV0013 (TECH) + dummy PDF file
  const docSeeds = [
    { empCode: 'NV0014', title: 'CCCD mặt trước/sau - Lý Thị Ngọc Bích', fileName: 'cccd-nv0014.pdf' },
    { empCode: 'NV0013', title: 'CCCD mặt trước/sau - Đỗ Văn Khoa', fileName: 'cccd-nv0013.pdf' },
  ];
  for (const d of docSeeds) {
    const empId = empMap.get(d.empCode)!;
    const relKey = `${empId}/${d.fileName}`;
    const absDir = path.resolve(process.cwd(), 'uploads', 'hrm', 'employees', String(empId));
    await fs.mkdir(absDir, { recursive: true });
    const dummyPdf = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n', 'utf8');
    await fs.writeFile(path.join(absDir, d.fileName), dummyPdf);

    const [existing] = await conn.execute<mysql.RowDataPacket[]>(
      'SELECT id FROM employee_documents WHERE employee_id = ? AND file_name = ? AND deleted_at IS NULL LIMIT 1',
      [empId, d.fileName],
    );
    if (existing.length === 0) {
      await conn.execute(
        `INSERT INTO employee_documents (
          employee_id, doc_type, title, file_name, file_url, file_size, mime_type, created_by, updated_by
        ) VALUES (?, 'ID_CARD', ?, ?, ?, ?, 'application/pdf', ?, ?)`,
        [empId, d.title, d.fileName, relKey, dummyPdf.length, adminUserId, adminUserId],
      );
    }
  }

  // 3. Seed Leave Requests across HQ/TECH, HQ/FIN, HCM/HCM_TECH
  const [ltRows] = await conn.execute<mysql.RowDataPacket[]>(
    'SELECT id FROM leave_types WHERE deleted_at IS NULL ORDER BY id ASC LIMIT 1',
  );
  if (ltRows.length > 0) {
    const leaveTypeId = Number(ltRows[0].id);
    const leaveSeeds = [
      { code: 'LR-RBAC-TECH-01', empCode: 'NV0013', userId: techEmpUserId, status: 'DRAFT' },
      { code: 'LR-RBAC-FIN-01', empCode: 'NV0014', userId: finEmpUserId, status: 'DRAFT' },
      { code: 'LR-RBAC-HCM-01', empCode: 'NV0015', userId: userMap.get('intern.hcm@operonhub.local')!, status: 'DRAFT' },
    ];
    for (const lr of leaveSeeds) {
      const empId = empMap.get(lr.empCode)!;
      const [existing] = await conn.execute<mysql.RowDataPacket[]>(
        'SELECT id FROM leave_requests WHERE request_code = ? LIMIT 1',
        [lr.code],
      );
      if (existing.length === 0) {
        await conn.execute(
          `INSERT INTO leave_requests (
            request_code, employee_id, leave_type_id, start_date, end_date,
            start_session, end_session, total_days, reason, status, created_by, updated_by
          ) VALUES (?, ?, ?, '2026-12-07', '2026-12-08', 'FULL', 'FULL', 2.00, 'Đơn nghỉ phép mẫu phục vụ kiểm thử phân quyền RBAC', ?, ?, ?)`,
          [lr.code, empId, leaveTypeId, lr.status, lr.userId, lr.userId],
        );
      }
    }
  }

  // 4. Seed Payroll Period (APPROVED) + Payslips (PUBLISHED for NV0013/NV0014, DRAFT for NV0015)
  const periodCode = 'PAYROLL-2026-10-HQ';
  const [existingPeriod] = await conn.execute<mysql.RowDataPacket[]>(
    'SELECT id FROM payroll_periods WHERE code = ? LIMIT 1',
    [periodCode],
  );
  let periodId: number;
  if (existingPeriod.length > 0) {
    periodId = Number(existingPeriod[0].id);
  } else {
    const [insertedPeriod] = await conn.execute<mysql.ResultSetHeader>(
      `INSERT INTO payroll_periods (
        branch_id, year, month, code, name, status,
        total_employees, total_gross, total_insurance_emp, total_pit, total_net,
        approved_by, approved_at, created_by, updated_by
      ) VALUES (?, 2026, 10, ?, 'Bảng lương Tháng 10/2026 - HQ (RBAC Test)', 'APPROVED', 2, 35000000, 3150000, 500000, 31350000, ?, NOW(), ?, ?)`,
      [hqId, periodCode, adminUserId, adminUserId, adminUserId],
    );
    periodId = Number(insertedPeriod.insertId);
  }

  const payslipSeeds = [
    { empCode: 'NV0013', branchId: hqId, deptId: techDeptId, base: 18500000, net: 16400000, status: 'PUBLISHED' },
    { empCode: 'NV0014', branchId: hqId, deptId: finDeptId, base: 16500000, net: 14950000, status: 'PUBLISHED' },
    { empCode: 'NV0015', branchId: hcmId, deptId: hcmTechDeptId, base: 6000000, net: 6000000, status: 'DRAFT' },
  ];
  for (const ps of payslipSeeds) {
    const empId = empMap.get(ps.empCode)!;
    const [existingPs] = await conn.execute<mysql.RowDataPacket[]>(
      'SELECT id FROM payslips WHERE payroll_period_id = ? AND employee_id = ? LIMIT 1',
      [periodId, empId],
    );
    if (existingPs.length === 0) {
      await conn.execute(
        `INSERT INTO payslips (
          payroll_period_id, employee_id, branch_id, department_id,
          standard_work_days, payable_days, base_salary, insurance_salary, prorated_salary,
          gross_salary, social_insurance_emp, health_insurance_emp, unemployment_insurance_emp,
          taxable_income, personal_income_tax, net_salary, status, published_at, created_by, updated_by
        ) VALUES (?, ?, ?, ?, 22, 22, ?, ?, ?, ?, 1200000, 225000, 150000, ?, 250000, ?, ?, ?, ?, ?)`,
        [
          periodId,
          empId,
          ps.branchId,
          ps.deptId,
          ps.base,
          Math.min(ps.base, 15000000),
          ps.base,
          ps.base,
          Math.max(0, ps.base - 11000000),
          ps.net,
          ps.status,
          ps.status === 'PUBLISHED' ? new Date() : null,
          adminUserId,
          adminUserId,
        ],
      );
    }
  }

  // 5. Seed Assets in HQ (FIN) & HCM (HCM_TECH) + Assignments
  const assetSeeds = [
    { code: 'AST-RBAC-HQ-FIN', name: 'Laptop Dell Latitude FIN-01', branchId: hqId, empCode: 'NV0014' },
    { code: 'AST-RBAC-HCM-01', name: 'MacBook Air M3 HCM-01', branchId: hcmId, empCode: 'NV0015' },
  ];
  for (const a of assetSeeds) {
    const [existingAsset] = await conn.execute<mysql.RowDataPacket[]>(
      'SELECT id FROM assets WHERE asset_code = ? LIMIT 1',
      [a.code],
    );
    let assetId: number;
    if (existingAsset.length > 0) {
      assetId = Number(existingAsset[0].id);
    } else {
      const [ins] = await conn.execute<mysql.ResultSetHeader>(
        `INSERT INTO assets (branch_id, asset_code, name, category, brand, model, purchase_value, status, created_by, updated_by)
         VALUES (?, ?, ?, 'LAPTOP', 'OperonTest', 'Pro', 24000000, 'ASSIGNED', ?, ?)`,
        [a.branchId, a.code, a.name, adminUserId, adminUserId],
      );
      assetId = Number(ins.insertId);
    }
    const empId = empMap.get(a.empCode)!;
    const [existingAssign] = await conn.execute<mysql.RowDataPacket[]>(
      "SELECT id FROM asset_assignments WHERE asset_id = ? AND status = 'ACTIVE' LIMIT 1",
      [assetId],
    );
    if (existingAssign.length === 0) {
      await conn.execute(
        `INSERT INTO asset_assignments (asset_id, employee_id, assigned_by, assigned_at, condition_on_assign, status, created_by, updated_by)
         VALUES (?, ?, ?, NOW(), 'Mới 100% (RBAC Test)', 'ACTIVE', ?, ?)`,
        [assetId, empId, adminUserId, adminUserId, adminUserId],
      );
    }
  }

  // 6. Seed PRIVATE_INVITE Project (PMO + CEO only — employee.tech1 & manager.tech are NOT members) + HCM BRANCH project
  const pmoEmpId = empMap.get('NV0010')!;
  const ceoEmpId = empMap.get('NV0004')!;
  const hcmMgrEmpId = empMap.get('NV0012')!;

  const projectSeeds = [
    {
      code: 'PRJ-SECRET-01',
      name: 'Dự án Bảo mật M&A Nội bộ (Private)',
      branchId: hqId,
      deptId: maps.deptMap.get('BOD')!,
      ownerEmpId: ceoEmpId,
      mgrEmpId: pmoEmpId,
      visibility: 'PRIVATE_INVITE',
      members: [
        { empId: ceoEmpId, role: 'PROJECT_OWNER' },
        { empId: pmoEmpId, role: 'PROJECT_MANAGER' },
      ],
    },
    {
      code: 'PRJ-HCM-01',
      name: 'Dự án Mở rộng Chi nhánh HCM (Branch Scope)',
      branchId: hcmId,
      deptId: hcmTechDeptId,
      ownerEmpId: hcmMgrEmpId,
      mgrEmpId: hcmMgrEmpId,
      visibility: 'BRANCH',
      members: [{ empId: hcmMgrEmpId, role: 'PROJECT_MANAGER' }],
    },
  ];
  for (const p of projectSeeds) {
    const [existingPrj] = await conn.execute<mysql.RowDataPacket[]>(
      'SELECT id FROM projects WHERE code = ? LIMIT 1',
      [p.code],
    );
    let prjId: number;
    if (existingPrj.length > 0) {
      prjId = Number(existingPrj[0].id);
    } else {
      const [ins] = await conn.execute<mysql.ResultSetHeader>(
        `INSERT INTO projects (
          code, name, description, branch_id, department_id, owner_employee_id, manager_employee_id,
          methodology, visibility, priority, status, health_status, planned_budget, color_hex, created_by, updated_by
        ) VALUES (?, ?, 'Dự án kiểm thử phân quyền RBAC', ?, ?, ?, ?, 'KANBAN', ?, 'HIGH', 'ACTIVE', 'ON_TRACK', 500000000, '#1D4E89', ?, ?)`,
        [p.code, p.name, p.branchId, p.deptId, p.ownerEmpId, p.mgrEmpId, p.visibility, pmoUserId, pmoUserId],
      );
      prjId = Number(ins.insertId);
    }

    for (const m of p.members) {
      await conn.execute(
        `INSERT IGNORE INTO project_members (project_id, employee_id, project_role, created_by)
         VALUES (?, ?, ?, ?)`,
        [prjId, m.empId, m.role, pmoUserId],
      );
    }

    const [cols] = await conn.execute<mysql.RowDataPacket[]>(
      'SELECT id FROM project_board_columns WHERE project_id = ? LIMIT 1',
      [prjId],
    );
    let colId: number;
    if (cols.length > 0) {
      colId = Number(cols[0].id);
    } else {
      const [insCol] = await conn.execute<mysql.ResultSetHeader>(
        `INSERT INTO project_board_columns (project_id, code, name, status_category, sort_order, is_default_initial)
         VALUES (?, 'TODO', 'Cần làm', 'TODO', 1, 1)`,
        [prjId],
      );
      colId = Number(insCol.insertId);
    }

    const taskKey = `${p.code}-1`;
    const [existingTask] = await conn.execute<mysql.RowDataPacket[]>(
      'SELECT id FROM tasks WHERE task_key = ? LIMIT 1',
      [taskKey],
    );
    if (existingTask.length === 0) {
      await conn.execute(
        `INSERT INTO tasks (
          project_id, column_id, task_key, title, description, task_type, priority,
          reporter_employee_id, created_by, updated_by
        ) VALUES (?, ?, ?, ?, 'Công việc nhạy cảm phục vụ test phân quyền', 'TASK', 'HIGH', ?, ?, ?)`,
        [prjId, colId, taskKey, `Task bảo mật thuộc ${p.code}`, p.mgrEmpId, pmoUserId, pmoUserId],
      );
    }
  }

  // 7. Seed Cross-Department Pending-Approval Proposal & Payment Request owned by employee.fin (HQ/FIN)
  const [propCatRows] = await conn.execute<mysql.RowDataPacket[]>(
    'SELECT id FROM proposal_categories WHERE deleted_at IS NULL ORDER BY id ASC LIMIT 1',
  );
  const [propWfRows] = await conn.execute<mysql.RowDataPacket[]>(
    "SELECT id FROM approval_workflows WHERE module_code = 'proposals' AND deleted_at IS NULL ORDER BY id DESC LIMIT 1",
  );
  if (propCatRows.length > 0 && propWfRows.length > 0) {
    const propCode = 'PROP-RBAC-FIN-01';
    const [existingProp] = await conn.execute<mysql.RowDataPacket[]>(
      'SELECT id FROM proposals WHERE proposal_code = ? LIMIT 1',
      [propCode],
    );
    if (existingProp.length === 0) {
      const [insProp] = await conn.execute<mysql.ResultSetHeader>(
        `INSERT INTO proposals (
          proposal_code, category_id, branch_id, department_id, requester_user_id, requester_employee_id,
          title, content, priority, estimated_budget, status, submitted_at, created_by, updated_by
        ) VALUES (?, ?, ?, ?, ?, ?, 'Đề xuất mua phần mềm Kế toán FIN (RBAC Cross-Dept Test)', 'Nội dung mật phòng Tài chính', 'MEDIUM', 12000000, 'PENDING_APPROVAL', NOW(), ?, ?)`,
        [
          propCode,
          Number(propCatRows[0].id),
          hqId,
          finDeptId,
          finEmpUserId,
          empMap.get('NV0014')!,
          finEmpUserId,
          finEmpUserId,
        ],
      );
      const propId = Number(insProp.insertId);
      const [insAppr] = await conn.execute<mysql.ResultSetHeader>(
        `INSERT INTO approval_requests (
          workflow_id, module_code, request_type, entity_type, entity_id, branch_id, requester_id,
          title, summary, current_step, total_steps, current_approver_user_id, current_approver_role_id, status
        ) VALUES (?, 'proposals', 'PROPOSAL_STANDARD', 'proposals', ?, ?, ?, ?, 'Kiểm thử phân quyền duyệt chéo phòng ban', 1, 2, ?, ?, 'PENDING')`,
        [
          Number(propWfRows[0].id),
          propId,
          hqId,
          finEmpUserId,
          `[Đề xuất] ${propCode}`,
          financeMgrUserId,
          deptMgrRoleId,
        ],
      );
      await conn.execute('UPDATE proposals SET approval_request_id = ? WHERE id = ?', [
        Number(insAppr.insertId),
        propId,
      ]);
    }
  }

  const [payCatRows] = await conn.execute<mysql.RowDataPacket[]>(
    'SELECT id FROM payment_categories WHERE deleted_at IS NULL ORDER BY id ASC LIMIT 1',
  );
  const [payWfRows] = await conn.execute<mysql.RowDataPacket[]>(
    "SELECT id FROM approval_workflows WHERE module_code = 'payments' AND deleted_at IS NULL ORDER BY id DESC LIMIT 1",
  );
  if (payCatRows.length > 0 && payWfRows.length > 0) {
    const payCode = 'PAY-RBAC-FIN-01';
    const [existingPay] = await conn.execute<mysql.RowDataPacket[]>(
      'SELECT id FROM payment_requests WHERE code = ? LIMIT 1',
      [payCode],
    );
    if (existingPay.length === 0) {
      const [insPay] = await conn.execute<mysql.ResultSetHeader>(
        `INSERT INTO payment_requests (
          code, category_id, payment_type, priority, title, description,
          branch_id, department_id, requester_user_id, requester_employee_id,
          beneficiary_type, beneficiary_name, total_amount, status, submitted_at, created_by, updated_by
        ) VALUES (?, ?, 'REIMBURSEMENT', 'MEDIUM', 'Thanh toán công tác phí phòng FIN (RBAC Cross-Dept Test)', 'Chứng từ nội bộ phòng FIN', ?, ?, ?, ?, 'EMPLOYEE', 'Lý Thị Ngọc Bích', 4500000, 'PENDING_APPROVAL', NOW(), ?, ?)`,
        [
          payCode,
          Number(payCatRows[0].id),
          hqId,
          finDeptId,
          finEmpUserId,
          empMap.get('NV0014')!,
          finEmpUserId,
          finEmpUserId,
        ],
      );
      const payId = Number(insPay.insertId);
      const [insAppr] = await conn.execute<mysql.ResultSetHeader>(
        `INSERT INTO approval_requests (
          workflow_id, module_code, request_type, entity_type, entity_id, branch_id, requester_id,
          title, summary, current_step, total_steps, current_approver_user_id, current_approver_role_id, status
        ) VALUES (?, 'payments', 'PAYMENT_STANDARD', 'payment_requests', ?, ?, ?, ?, 'Kiểm thử phân quyền duyệt thanh toán chéo phòng ban', 1, 2, ?, ?, 'PENDING')`,
        [
          Number(payWfRows[0].id),
          payId,
          hqId,
          finEmpUserId,
          `[Thanh toán] ${payCode}`,
          financeMgrUserId,
          deptMgrRoleId,
        ],
      );
      await conn.execute('UPDATE payment_requests SET approval_request_id = ? WHERE id = ?', [
        Number(insAppr.insertId),
        payId,
      ]);
    }
  }
}

async function syncEssPermissionsForSpecialistRoles(
  conn: Connection,
  roleMap: Map<string, number>,
): Promise<void> {
  const specialistRoles = ['PMO_MANAGER', 'IT_SUPPORT', 'FINANCE_ACCOUNTANT'];
  const essPermCodes = ['hrm.requests.read', 'hrm.requests.create', 'hrm.attendance.read'];
  const [permRows] = await conn.execute<mysql.RowDataPacket[]>(
    `SELECT id, code FROM permissions WHERE code IN ('hrm.requests.read', 'hrm.requests.create', 'hrm.attendance.read')`,
  );
  const permMap = new Map<string, number>(permRows.map((p) => [String(p.code), Number(p.id)]));

  for (const rc of specialistRoles) {
    const roleId = roleMap.get(rc);
    if (!roleId) continue;
    for (const pc of essPermCodes) {
      const permId = permMap.get(pc);
      if (!permId) continue;
      await conn.execute(
        'INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)',
        [roleId, permId],
      );
    }
  }
}

export async function runRbacUsersSeed(): Promise<void> {
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
    await deduplicateUserRoles(conn);
    const maps = await seedBranchesAndDepartments(conn);
    await syncEssPermissionsForSpecialistRoles(conn, maps.roleMap);
    const { userMap, empMap } = await seedUsersAndEmployees(conn, maps);
    await deduplicateUserRoles(conn);
    await seedRbacTestFixtures(conn, maps, userMap, empMap);

    console.log(
      `[SEED RBAC OK] Đã khởi tạo đầy đủ 2 chi nhánh (HQ, HCM), 6 phòng ban, ${RBAC_SEED_USERS.length} tài khoản (đủ 11 vai trò + 6 chức danh + 4 data scope + 1 tài khoản LOCKED) và bộ dữ liệu mẫu kiểm thử phân quyền chéo.`,
    );
  } finally {
    await conn.end();
  }
}

const currentFilePath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(currentFilePath)) {
  runRbacUsersSeed().catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[SEED RBAC ERROR] ${message}`);
    process.exit(1);
  });
}
