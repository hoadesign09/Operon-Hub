-- UP
CREATE TABLE IF NOT EXISTS projects (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(24) NOT NULL,
  name VARCHAR(200) NOT NULL,
  description TEXT NULL,
  branch_id BIGINT UNSIGNED NOT NULL,
  department_id BIGINT UNSIGNED NULL,
  owner_employee_id BIGINT UNSIGNED NOT NULL,
  manager_employee_id BIGINT UNSIGNED NOT NULL,
  methodology ENUM('KANBAN', 'SCRUM', 'WATERFALL', 'HYBRID') NOT NULL DEFAULT 'KANBAN',
  visibility ENUM('PUBLIC_COMPANY', 'BRANCH', 'DEPARTMENT', 'PRIVATE_INVITE') NOT NULL DEFAULT 'BRANCH',
  priority ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') NOT NULL DEFAULT 'MEDIUM',
  status ENUM('DRAFT', 'PENDING_APPROVAL', 'PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
  health_status ENUM('ON_TRACK', 'AT_RISK', 'OFF_TRACK') NOT NULL DEFAULT 'ON_TRACK',
  start_date DATE NULL,
  target_end_date DATE NULL,
  actual_end_date DATE NULL,
  baseline_start_date DATE NULL,
  baseline_end_date DATE NULL,
  planned_budget DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  actual_cost DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  progress_percent DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  task_seq_counter INT UNSIGNED NOT NULL DEFAULT 0,
  approval_request_id BIGINT UNSIGNED NULL,
  color_hex VARCHAR(16) NOT NULL DEFAULT '#2563EB',
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_projects_code (code),
  KEY idx_projects_branch_status (branch_id, status),
  KEY idx_projects_department_id (department_id),
  KEY idx_projects_owner_employee_id (owner_employee_id),
  KEY idx_projects_manager_employee_id (manager_employee_id),
  KEY idx_projects_visibility (visibility),
  KEY idx_projects_approval_request_id (approval_request_id),
  KEY idx_projects_deleted_at (deleted_at),
  CONSTRAINT fk_projects_branch_id FOREIGN KEY (branch_id) REFERENCES branches (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_projects_department_id FOREIGN KEY (department_id) REFERENCES departments (id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_projects_owner_employee_id FOREIGN KEY (owner_employee_id) REFERENCES employees (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_projects_manager_employee_id FOREIGN KEY (manager_employee_id) REFERENCES employees (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_projects_approval_request_id FOREIGN KEY (approval_request_id) REFERENCES approval_requests (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS project_members (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  project_id BIGINT UNSIGNED NOT NULL,
  employee_id BIGINT UNSIGNED NOT NULL,
  project_role ENUM('PROJECT_OWNER', 'PROJECT_MANAGER', 'TEAM_LEAD', 'MEMBER', 'VIEWER') NOT NULL DEFAULT 'MEMBER',
  allocation_percent TINYINT UNSIGNED NOT NULL DEFAULT 100,
  hourly_cost_rate DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  left_at DATETIME NULL,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_project_members_project_employee (project_id, employee_id),
  KEY idx_project_members_employee_id (employee_id),
  KEY idx_project_members_role (project_id, project_role),
  KEY idx_project_members_deleted_at (deleted_at),
  CONSTRAINT fk_project_members_project_id FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_project_members_employee_id FOREIGN KEY (employee_id) REFERENCES employees (id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS project_board_columns (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  project_id BIGINT UNSIGNED NOT NULL,
  code VARCHAR(40) NOT NULL,
  name VARCHAR(120) NOT NULL,
  status_category ENUM('TODO', 'IN_PROGRESS', 'IN_REVIEW', 'BLOCKED', 'DONE') NOT NULL DEFAULT 'TODO',
  color_hex VARCHAR(16) NOT NULL DEFAULT '#64748B',
  wip_limit INT UNSIGNED NULL,
  sort_order INT UNSIGNED NOT NULL DEFAULT 0,
  is_default_initial TINYINT(1) NOT NULL DEFAULT 0,
  is_done_column TINYINT(1) NOT NULL DEFAULT 0,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_project_board_columns_project_code (project_id, code),
  KEY idx_project_board_columns_sort (project_id, sort_order),
  KEY idx_project_board_columns_deleted_at (deleted_at),
  CONSTRAINT fk_project_board_columns_project_id FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS project_labels (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  project_id BIGINT UNSIGNED NULL,
  name VARCHAR(80) NOT NULL,
  color_hex VARCHAR(16) NOT NULL DEFAULT '#3B82F6',
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_project_labels_project_name (project_id, name),
  KEY idx_project_labels_deleted_at (deleted_at),
  CONSTRAINT fk_project_labels_project_id FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO roles (code, name, data_scope, description, is_system)
VALUES ('PMO_MANAGER', 'Trưởng ban Quản lý Dự án (PMO)', 'ALL', 'Quản trị toàn diện danh mục dự án, nguồn lực, ngân sách và báo cáo Phase 2', 1);

INSERT IGNORE INTO permissions (module_code, code, name) VALUES
('projects', 'pm.dashboard.read', 'Xem tổng quan Danh mục Dự án'),
('projects', 'pm.projects.read', 'Xem danh sách và chi tiết dự án trong phạm vi'),
('projects', 'pm.projects.create', 'Khởi tạo dự án mới và gửi duyệt Charter'),
('projects', 'pm.projects.manage', 'Quản trị toàn diện danh mục dự án, lưu trữ và chuyển PM'),
('projects', 'pm.tasks.read', 'Xem công việc trong dự án và Công việc của tôi'),
('projects', 'pm.tasks.create', 'Tạo Task, Subtask, Checklist và Dependency'),
('projects', 'pm.tasks.update', 'Cập nhật trạng thái, tiến độ, bình luận và đính kèm Task'),
('projects', 'pm.tasks.delete', 'Xóa mềm hoặc lưu trữ Task'),
('projects', 'pm.sprints.manage', 'Quản trị Sprint và sắp xếp Backlog'),
('projects', 'pm.timelogs.log', 'Ghi nhận giờ công trên công việc'),
('projects', 'pm.timelogs.approve', 'Xem và phê duyệt Timesheet nhóm/dự án'),
('projects', 'pm.workload.read', 'Xem bản đồ phân bổ nguồn lực (Workload Heatmap)'),
('projects', 'pm.budget.read', 'Xem ngân sách và chi phí dự án'),
('projects', 'pm.budget.manage', 'Quản trị ngân sách, chi phí và đề xuất điều chỉnh'),
('projects', 'pm.risks.manage', 'Quản trị Rủi ro và Vấn đề dự án (RAID)'),
('projects', 'pm.templates.manage', 'Quản trị Mẫu Dự án và Luật tự động hóa'),
('projects', 'pm.reports.export', 'Xuất báo cáo Dự án ra Excel và PDF');

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.module_code = 'projects'
WHERE r.code IN ('SUPER_ADMIN', 'PMO_MANAGER');

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
  'pm.dashboard.read', 'pm.projects.read', 'pm.tasks.read',
  'pm.timelogs.approve', 'pm.workload.read', 'pm.budget.read', 'pm.reports.export'
)
WHERE r.code = 'EXECUTIVE';

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
  'pm.dashboard.read', 'pm.projects.read', 'pm.projects.create',
  'pm.tasks.read', 'pm.tasks.create', 'pm.tasks.update', 'pm.tasks.delete',
  'pm.sprints.manage', 'pm.timelogs.log', 'pm.timelogs.approve',
  'pm.workload.read', 'pm.budget.read', 'pm.risks.manage',
  'pm.templates.manage', 'pm.reports.export'
)
WHERE r.code = 'DEPT_MANAGER';

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
  'pm.dashboard.read', 'pm.projects.read', 'pm.tasks.read',
  'pm.tasks.create', 'pm.tasks.update', 'pm.timelogs.log', 'pm.workload.read'
)
WHERE r.code IN ('HR_MANAGER', 'HR_STAFF', 'ADMIN_OPS');

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
  'pm.dashboard.read', 'pm.projects.read', 'pm.tasks.read',
  'pm.tasks.create', 'pm.tasks.update', 'pm.timelogs.log', 'pm.budget.read'
)
WHERE r.code = 'PAYROLL_ACCOUNTANT';

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
  'pm.dashboard.read', 'pm.projects.read', 'pm.tasks.read',
  'pm.tasks.create', 'pm.tasks.update', 'pm.timelogs.log'
)
WHERE r.code = 'EMPLOYEE';

INSERT INTO approval_workflows (module_code, request_type, branch_id, name, description, conditions_json, is_active)
SELECT 'projects', 'PM_PROJECT_CHARTER', NULL, 'Phê duyệt Mở Dự án (Project Charter)', 'Ban Giám đốc phê duyệt khởi tạo và ngân sách dự án mới', NULL, 1
WHERE NOT EXISTS (
  SELECT 1 FROM approval_workflows WHERE module_code = 'projects' AND request_type = 'PM_PROJECT_CHARTER' AND deleted_at IS NULL
);

INSERT INTO approval_workflow_steps (workflow_id, step_order, approver_type, approver_role_id, approver_user_id)
SELECT w.id, 1, 'ROLE', r.id, NULL
FROM approval_workflows w
JOIN roles r ON r.code = 'EXECUTIVE'
WHERE w.module_code = 'projects'
  AND w.request_type = 'PM_PROJECT_CHARTER'
  AND w.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM approval_workflow_steps s WHERE s.workflow_id = w.id AND s.step_order = 1
  );

-- DOWN
DELETE FROM approval_workflow_steps
WHERE workflow_id IN (SELECT id FROM approval_workflows WHERE module_code = 'projects' AND request_type = 'PM_PROJECT_CHARTER');
DELETE FROM approval_workflows WHERE module_code = 'projects' AND request_type = 'PM_PROJECT_CHARTER';
DELETE FROM role_permissions WHERE permission_id IN (SELECT id FROM permissions WHERE module_code = 'projects');
DELETE FROM permissions WHERE module_code = 'projects';
DELETE FROM roles WHERE code = 'PMO_MANAGER';
DROP TABLE IF EXISTS project_labels;
DROP TABLE IF EXISTS project_board_columns;
DROP TABLE IF EXISTS project_members;
DROP TABLE IF EXISTS projects;
