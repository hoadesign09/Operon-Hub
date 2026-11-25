-- UP
CREATE TABLE IF NOT EXISTS task_time_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  project_id BIGINT UNSIGNED NOT NULL,
  task_id BIGINT UNSIGNED NOT NULL,
  employee_id BIGINT UNSIGNED NOT NULL,
  logged_date DATE NOT NULL,
  started_at DATETIME NULL,
  ended_at DATETIME NULL,
  duration_minutes INT UNSIGNED NOT NULL DEFAULT 0,
  is_billable TINYINT(1) NOT NULL DEFAULT 1,
  hourly_cost_snapshot DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  description VARCHAR(500) NULL,
  approval_status ENUM('DRAFT','SUBMITTED','APPROVED','REJECTED') NOT NULL DEFAULT 'DRAFT',
  approved_by_user_id BIGINT UNSIGNED NULL,
  approved_at DATETIME NULL,
  rejection_reason VARCHAR(500) NULL,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  PRIMARY KEY (id),
  KEY idx_task_time_logs_emp_date (employee_id, logged_date),
  KEY idx_task_time_logs_project_status (project_id, approval_status),
  KEY idx_task_time_logs_task_id (task_id),
  KEY idx_task_time_logs_running (employee_id, started_at, ended_at),
  KEY idx_task_time_logs_deleted_at (deleted_at),
  CONSTRAINT fk_task_time_logs_project_id FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_task_time_logs_task_id FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_task_time_logs_employee_id FOREIGN KEY (employee_id) REFERENCES employees (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_task_time_logs_approved_by FOREIGN KEY (approved_by_user_id) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS project_budget_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  project_id BIGINT UNSIGNED NOT NULL,
  category ENUM('LABOR','VENDOR','INFRA','SOFTWARE','TRAVEL','OTHER') NOT NULL DEFAULT 'OTHER',
  title VARCHAR(200) NOT NULL,
  planned_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  actual_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  incurred_date DATE NULL,
  status ENUM('PLANNED','PENDING_APPROVAL','APPROVED','SPENT','CANCELLED') NOT NULL DEFAULT 'PLANNED',
  approval_request_id BIGINT UNSIGNED NULL,
  note VARCHAR(500) NULL,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  PRIMARY KEY (id),
  KEY idx_project_budget_items_project_cat (project_id, category),
  KEY idx_project_budget_items_status (project_id, status),
  KEY idx_project_budget_items_approval (approval_request_id),
  KEY idx_project_budget_items_deleted_at (deleted_at),
  CONSTRAINT fk_project_budget_items_project_id FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_project_budget_items_approval_id FOREIGN KEY (approval_request_id) REFERENCES approval_requests (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS project_risks (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  project_id BIGINT UNSIGNED NOT NULL,
  code VARCHAR(32) NOT NULL,
  item_type ENUM('RISK','ISSUE') NOT NULL DEFAULT 'RISK',
  title VARCHAR(255) NOT NULL,
  description TEXT NULL,
  probability TINYINT UNSIGNED NOT NULL DEFAULT 3,
  impact TINYINT UNSIGNED NOT NULL DEFAULT 3,
  severity_score TINYINT UNSIGNED NOT NULL DEFAULT 9,
  status ENUM('OPEN','MITIGATING','ESCALATED','RESOLVED','CLOSED') NOT NULL DEFAULT 'OPEN',
  owner_employee_id BIGINT UNSIGNED NULL,
  mitigation_plan TEXT NULL,
  linked_task_id BIGINT UNSIGNED NULL,
  identified_date DATE NOT NULL,
  resolved_at DATETIME NULL,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_project_risks_project_code (project_id, code),
  KEY idx_project_risks_project_status_sev (project_id, status, severity_score),
  KEY idx_project_risks_owner (owner_employee_id),
  KEY idx_project_risks_linked_task (linked_task_id),
  KEY idx_project_risks_deleted_at (deleted_at),
  CONSTRAINT fk_project_risks_project_id FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_project_risks_owner FOREIGN KEY (owner_employee_id) REFERENCES employees (id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_project_risks_linked_task FOREIGN KEY (linked_task_id) REFERENCES tasks (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO approval_workflows (module_code, request_type, branch_id, name, description, conditions_json, is_active)
SELECT 'projects', 'PM_MILESTONE_SIGNOFF', NULL, 'Nghiệm thu Mốc Dự án (Milestone Sign-off)', 'Phê duyệt hoàn tất và nghiệm thu cột mốc dự án quan trọng', NULL, 1
WHERE NOT EXISTS (
  SELECT 1 FROM approval_workflows WHERE module_code = 'projects' AND request_type = 'PM_MILESTONE_SIGNOFF' AND deleted_at IS NULL
);

INSERT INTO approval_workflow_steps (workflow_id, step_order, approver_type, approver_role_id, approver_user_id)
SELECT w.id, 1, 'ROLE', r.id, NULL
FROM approval_workflows w
JOIN roles r ON r.code = 'PMO_MANAGER'
WHERE w.module_code = 'projects'
  AND w.request_type = 'PM_MILESTONE_SIGNOFF'
  AND w.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM approval_workflow_steps s WHERE s.workflow_id = w.id AND s.step_order = 1
  );

INSERT INTO approval_workflows (module_code, request_type, branch_id, name, description, conditions_json, is_active)
SELECT 'projects', 'PM_BUDGET_CHANGE', NULL, 'Phê duyệt Điều chỉnh Ngân sách Dự án', 'Ban Giám đốc phê duyệt hạng mục ngân sách và chi phí bổ sung của dự án', NULL, 1
WHERE NOT EXISTS (
  SELECT 1 FROM approval_workflows WHERE module_code = 'projects' AND request_type = 'PM_BUDGET_CHANGE' AND deleted_at IS NULL
);

INSERT INTO approval_workflow_steps (workflow_id, step_order, approver_type, approver_role_id, approver_user_id)
SELECT w.id, 1, 'ROLE', r.id, NULL
FROM approval_workflows w
JOIN roles r ON r.code = 'EXECUTIVE'
WHERE w.module_code = 'projects'
  AND w.request_type = 'PM_BUDGET_CHANGE'
  AND w.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM approval_workflow_steps s WHERE s.workflow_id = w.id AND s.step_order = 1
  );

-- DOWN
DELETE FROM approval_workflow_steps
WHERE workflow_id IN (
  SELECT id FROM approval_workflows WHERE module_code = 'projects' AND request_type IN ('PM_MILESTONE_SIGNOFF', 'PM_BUDGET_CHANGE')
);
DELETE FROM approval_workflows WHERE module_code = 'projects' AND request_type IN ('PM_MILESTONE_SIGNOFF', 'PM_BUDGET_CHANGE');
DROP TABLE IF EXISTS project_risks;
DROP TABLE IF EXISTS project_budget_items;
DROP TABLE IF EXISTS task_time_logs;
