-- UP
CREATE TABLE IF NOT EXISTS project_templates (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  branch_id BIGINT UNSIGNED NULL,
  code VARCHAR(40) NOT NULL,
  name VARCHAR(180) NOT NULL,
  description TEXT NULL,
  methodology ENUM('KANBAN','SCRUM','WATERFALL','HYBRID') NOT NULL DEFAULT 'KANBAN',
  template_payload_json JSON NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_project_templates_code (code),
  KEY idx_project_templates_branch_active (branch_id, is_active),
  KEY idx_project_templates_deleted_at (deleted_at),
  CONSTRAINT fk_project_templates_branch_id FOREIGN KEY (branch_id) REFERENCES branches (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS task_recurrence_rules (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  project_id BIGINT UNSIGNED NOT NULL,
  template_task_id BIGINT UNSIGNED NOT NULL,
  frequency ENUM('DAILY','WEEKLY','MONTHLY') NOT NULL DEFAULT 'WEEKLY',
  interval_value TINYINT UNSIGNED NOT NULL DEFAULT 1,
  weekdays_json JSON NULL,
  day_of_month TINYINT UNSIGNED NULL,
  next_run_date DATE NOT NULL,
  end_date DATE NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  PRIMARY KEY (id),
  KEY idx_task_recurrence_rules_active_next (is_active, next_run_date),
  KEY idx_task_recurrence_rules_project (project_id),
  KEY idx_task_recurrence_rules_template_task (template_task_id),
  KEY idx_task_recurrence_rules_deleted_at (deleted_at),
  CONSTRAINT fk_task_recurrence_rules_project_id FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_task_recurrence_rules_template_task FOREIGN KEY (template_task_id) REFERENCES tasks (id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS project_automation_rules (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  project_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(180) NOT NULL,
  trigger_event ENUM('TASK_MOVED_COLUMN','TASK_OVERDUE','ALL_SUBTASKS_DONE','TASK_ASSIGNED') NOT NULL,
  condition_json JSON NULL,
  action_type ENUM('NOTIFY_PM','MOVE_COLUMN','SET_BLOCKED','ADD_WATCHER') NOT NULL,
  action_payload_json JSON NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  PRIMARY KEY (id),
  KEY idx_project_automation_rules_lookup (project_id, trigger_event, is_active),
  KEY idx_project_automation_rules_deleted_at (deleted_at),
  CONSTRAINT fk_project_automation_rules_project_id FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- DOWN
DROP TABLE IF EXISTS project_automation_rules;
DROP TABLE IF EXISTS task_recurrence_rules;
DROP TABLE IF EXISTS project_templates;
