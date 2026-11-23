-- UP
CREATE TABLE IF NOT EXISTS approval_workflows (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  module_code VARCHAR(50) NOT NULL,
  request_type VARCHAR(60) NOT NULL,
  branch_id BIGINT UNSIGNED NULL,
  name VARCHAR(150) NOT NULL,
  description VARCHAR(255) NULL,
  conditions_json JSON NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  INDEX idx_approval_workflows_lookup (module_code, request_type, branch_id),
  INDEX idx_approval_workflows_deleted_at (deleted_at),
  CONSTRAINT fk_approval_workflows_branch_id FOREIGN KEY (branch_id) REFERENCES branches (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS approval_workflow_steps (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  workflow_id BIGINT UNSIGNED NOT NULL,
  step_order SMALLINT UNSIGNED NOT NULL,
  approver_type ENUM('DIRECT_MANAGER', 'ROLE', 'SPECIFIC_USER') NOT NULL,
  approver_role_id BIGINT UNSIGNED NULL,
  approver_user_id BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_approval_workflow_steps_order UNIQUE (workflow_id, step_order),
  CONSTRAINT fk_approval_workflow_steps_workflow_id FOREIGN KEY (workflow_id) REFERENCES approval_workflows (id) ON DELETE CASCADE,
  CONSTRAINT fk_approval_workflow_steps_role_id FOREIGN KEY (approver_role_id) REFERENCES roles (id) ON DELETE SET NULL,
  CONSTRAINT fk_approval_workflow_steps_user_id FOREIGN KEY (approver_user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS approval_requests (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  workflow_id BIGINT UNSIGNED NOT NULL,
  module_code VARCHAR(50) NOT NULL,
  request_type VARCHAR(60) NOT NULL,
  entity_type VARCHAR(80) NOT NULL,
  entity_id BIGINT UNSIGNED NOT NULL,
  branch_id BIGINT UNSIGNED NULL,
  requester_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(200) NOT NULL,
  summary TEXT NULL,
  current_step SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  total_steps SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  current_approver_user_id BIGINT UNSIGNED NULL,
  current_approver_role_id BIGINT UNSIGNED NULL,
  status ENUM('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
  submitted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_approval_requests_inbox (status, current_approver_user_id, current_approver_role_id),
  INDEX idx_approval_requests_requester (requester_id, status),
  INDEX idx_approval_requests_entity (module_code, entity_type, entity_id),
  CONSTRAINT fk_approval_requests_workflow_id FOREIGN KEY (workflow_id) REFERENCES approval_workflows (id) ON DELETE RESTRICT,
  CONSTRAINT fk_approval_requests_branch_id FOREIGN KEY (branch_id) REFERENCES branches (id) ON DELETE SET NULL,
  CONSTRAINT fk_approval_requests_requester_id FOREIGN KEY (requester_id) REFERENCES users (id) ON DELETE RESTRICT,
  CONSTRAINT fk_approval_requests_approver_user_id FOREIGN KEY (current_approver_user_id) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT fk_approval_requests_approver_role_id FOREIGN KEY (current_approver_role_id) REFERENCES roles (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS approval_histories (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  approval_request_id BIGINT UNSIGNED NOT NULL,
  step_order SMALLINT UNSIGNED NOT NULL,
  actor_id BIGINT UNSIGNED NOT NULL,
  action ENUM('SUBMIT', 'APPROVE', 'REJECT', 'CANCEL') NOT NULL,
  comment VARCHAR(500) NULL,
  acted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_approval_histories_request_id (approval_request_id),
  CONSTRAINT fk_approval_histories_request_id FOREIGN KEY (approval_request_id) REFERENCES approval_requests (id) ON DELETE CASCADE,
  CONSTRAINT fk_approval_histories_actor_id FOREIGN KEY (actor_id) REFERENCES users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS notifications (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  module_code VARCHAR(50) NOT NULL DEFAULT 'core',
  type VARCHAR(50) NOT NULL DEFAULT 'INFO',
  title VARCHAR(200) NOT NULL,
  message VARCHAR(500) NOT NULL,
  link_url VARCHAR(255) NULL,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  read_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_notifications_user_unread (user_id, is_read, created_at),
  CONSTRAINT fk_notifications_user_id FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- DOWN
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS approval_histories;
DROP TABLE IF EXISTS approval_requests;
DROP TABLE IF EXISTS approval_workflow_steps;
DROP TABLE IF EXISTS approval_workflows;
