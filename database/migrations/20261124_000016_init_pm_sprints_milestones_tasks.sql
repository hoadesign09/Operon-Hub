-- UP
CREATE TABLE IF NOT EXISTS project_sprints (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  project_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(150) NOT NULL,
  goal TEXT NULL,
  start_date DATE NULL,
  end_date DATE NULL,
  status ENUM('PLANNED', 'ACTIVE', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'PLANNED',
  committed_points DECIMAL(6,2) NOT NULL DEFAULT 0.00,
  completed_points DECIMAL(6,2) NOT NULL DEFAULT 0.00,
  completed_at DATETIME NULL,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  PRIMARY KEY (id),
  KEY idx_project_sprints_project_status (project_id, status),
  KEY idx_project_sprints_deleted_at (deleted_at),
  CONSTRAINT fk_project_sprints_project_id FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS project_milestones (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  project_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(200) NOT NULL,
  description TEXT NULL,
  due_date DATE NOT NULL,
  completed_at DATETIME NULL,
  status ENUM('UPCOMING', 'IN_PROGRESS', 'PENDING_SIGNOFF', 'COMPLETED', 'DELAYED', 'CANCELLED') NOT NULL DEFAULT 'UPCOMING',
  requires_signoff TINYINT(1) NOT NULL DEFAULT 0,
  approval_request_id BIGINT UNSIGNED NULL,
  owner_employee_id BIGINT UNSIGNED NULL,
  sort_order INT UNSIGNED NOT NULL DEFAULT 0,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  PRIMARY KEY (id),
  KEY idx_project_milestones_project_due (project_id, due_date),
  KEY idx_project_milestones_approval_request_id (approval_request_id),
  KEY idx_project_milestones_owner_employee_id (owner_employee_id),
  KEY idx_project_milestones_deleted_at (deleted_at),
  CONSTRAINT fk_project_milestones_project_id FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_project_milestones_approval_request_id FOREIGN KEY (approval_request_id) REFERENCES approval_requests (id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_project_milestones_owner_employee_id FOREIGN KEY (owner_employee_id) REFERENCES employees (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tasks (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  project_id BIGINT UNSIGNED NOT NULL,
  parent_task_id BIGINT UNSIGNED NULL,
  column_id BIGINT UNSIGNED NOT NULL,
  sprint_id BIGINT UNSIGNED NULL,
  milestone_id BIGINT UNSIGNED NULL,
  task_key VARCHAR(40) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description MEDIUMTEXT NULL,
  task_type ENUM('EPIC', 'TASK', 'BUG', 'FEATURE', 'IMPROVEMENT') NOT NULL DEFAULT 'TASK',
  priority ENUM('LOW', 'MEDIUM', 'HIGH', 'URGENT') NOT NULL DEFAULT 'MEDIUM',
  status_category ENUM('TODO', 'IN_PROGRESS', 'IN_REVIEW', 'BLOCKED', 'DONE') NOT NULL DEFAULT 'TODO',
  reporter_employee_id BIGINT UNSIGNED NOT NULL,
  start_date DATE NULL,
  due_date DATE NULL,
  baseline_start_date DATE NULL,
  baseline_due_date DATE NULL,
  completed_at DATETIME NULL,
  estimated_hours DECIMAL(6,2) NOT NULL DEFAULT 0.00,
  actual_hours DECIMAL(6,2) NOT NULL DEFAULT 0.00,
  story_points DECIMAL(5,2) NULL,
  progress_percent TINYINT UNSIGNED NOT NULL DEFAULT 0,
  sort_rank VARCHAR(64) NOT NULL DEFAULT 'n',
  is_blocked TINYINT(1) NOT NULL DEFAULT 0,
  blocked_reason VARCHAR(500) NULL,
  version INT UNSIGNED NOT NULL DEFAULT 1,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_tasks_task_key (task_key),
  KEY idx_tasks_project_column_rank (project_id, column_id, sort_rank),
  KEY idx_tasks_project_sprint (project_id, sprint_id),
  KEY idx_tasks_project_milestone (project_id, milestone_id),
  KEY idx_tasks_parent_task_id (parent_task_id),
  KEY idx_tasks_due_status (due_date, status_category),
  KEY idx_tasks_reporter_employee_id (reporter_employee_id),
  KEY idx_tasks_deleted_at (deleted_at),
  CONSTRAINT fk_tasks_project_id FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_tasks_parent_task_id FOREIGN KEY (parent_task_id) REFERENCES tasks (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_tasks_column_id FOREIGN KEY (column_id) REFERENCES project_board_columns (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_tasks_sprint_id FOREIGN KEY (sprint_id) REFERENCES project_sprints (id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_tasks_milestone_id FOREIGN KEY (milestone_id) REFERENCES project_milestones (id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_tasks_reporter_employee_id FOREIGN KEY (reporter_employee_id) REFERENCES employees (id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS task_assignees (
  task_id BIGINT UNSIGNED NOT NULL,
  employee_id BIGINT UNSIGNED NOT NULL,
  assignment_role ENUM('PRIMARY', 'COLLABORATOR') NOT NULL DEFAULT 'PRIMARY',
  assigned_by BIGINT UNSIGNED NULL,
  assigned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (task_id, employee_id),
  KEY idx_task_assignees_employee_id (employee_id),
  CONSTRAINT fk_task_assignees_task_id FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_task_assignees_employee_id FOREIGN KEY (employee_id) REFERENCES employees (id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS task_watchers (
  task_id BIGINT UNSIGNED NOT NULL,
  employee_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (task_id, employee_id),
  KEY idx_task_watchers_employee_id (employee_id),
  CONSTRAINT fk_task_watchers_task_id FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_task_watchers_employee_id FOREIGN KEY (employee_id) REFERENCES employees (id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS task_label_links (
  task_id BIGINT UNSIGNED NOT NULL,
  label_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (task_id, label_id),
  KEY idx_task_label_links_label_id (label_id),
  CONSTRAINT fk_task_label_links_task_id FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_task_label_links_label_id FOREIGN KEY (label_id) REFERENCES project_labels (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS task_checklists (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  task_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(255) NOT NULL,
  is_completed TINYINT(1) NOT NULL DEFAULT 0,
  assignee_employee_id BIGINT UNSIGNED NULL,
  due_date DATE NULL,
  sort_order INT UNSIGNED NOT NULL DEFAULT 0,
  completed_at DATETIME NULL,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  PRIMARY KEY (id),
  KEY idx_task_checklists_task_sort (task_id, sort_order),
  KEY idx_task_checklists_assignee_employee_id (assignee_employee_id),
  KEY idx_task_checklists_deleted_at (deleted_at),
  CONSTRAINT fk_task_checklists_task_id FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_task_checklists_assignee_employee_id FOREIGN KEY (assignee_employee_id) REFERENCES employees (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS task_dependencies (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  project_id BIGINT UNSIGNED NOT NULL,
  predecessor_task_id BIGINT UNSIGNED NOT NULL,
  successor_task_id BIGINT UNSIGNED NOT NULL,
  dependency_type ENUM('FS', 'SS', 'FF', 'SF') NOT NULL DEFAULT 'FS',
  lag_days SMALLINT NOT NULL DEFAULT 0,
  created_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_task_dependencies_pair (predecessor_task_id, successor_task_id),
  KEY idx_task_dependencies_project_id (project_id),
  KEY idx_task_dependencies_successor_task_id (successor_task_id),
  CONSTRAINT fk_task_dependencies_project_id FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_task_dependencies_predecessor_task_id FOREIGN KEY (predecessor_task_id) REFERENCES tasks (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_task_dependencies_successor_task_id FOREIGN KEY (successor_task_id) REFERENCES tasks (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- DOWN
DROP TABLE IF EXISTS task_dependencies;
DROP TABLE IF EXISTS task_checklists;
DROP TABLE IF EXISTS task_label_links;
DROP TABLE IF EXISTS task_watchers;
DROP TABLE IF EXISTS task_assignees;
DROP TABLE IF EXISTS tasks;
DROP TABLE IF EXISTS project_milestones;
DROP TABLE IF EXISTS project_sprints;
