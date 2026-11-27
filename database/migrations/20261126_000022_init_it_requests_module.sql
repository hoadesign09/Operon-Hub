-- Migration: 20261126_000022_init_it_requests_module.sql
-- Mô tả: Khởi tạo phân hệ Yêu cầu Hỗ trợ IT & Service Desk (it_request_categories, it_requests, it_request_checklist_items, it_request_comments, it_request_attachments, it_request_activities)

-- UP
CREATE TABLE IF NOT EXISTS it_request_categories (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(150) NOT NULL,
  name_en VARCHAR(180) NULL,
  description VARCHAR(500) NULL,
  request_kind ENUM('INCIDENT', 'SERVICE_REQUEST', 'ACCESS_REQUEST', 'HARDWARE_PROVISION') NOT NULL DEFAULT 'INCIDENT',
  requires_approval TINYINT(1) NOT NULL DEFAULT 0,
  default_priority ENUM('LOW', 'MEDIUM', 'HIGH', 'URGENT') NOT NULL DEFAULT 'MEDIUM',
  sla_response_hours SMALLINT UNSIGNED NOT NULL DEFAULT 4,
  sla_resolution_hours SMALLINT UNSIGNED NOT NULL DEFAULT 24,
  color VARCHAR(20) NOT NULL DEFAULT '#2563EB',
  sort_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_it_request_categories_code (code),
  KEY idx_it_request_categories_active (is_active, sort_order),
  KEY idx_it_request_categories_deleted_at (deleted_at),
  CONSTRAINT fk_it_request_categories_created_by FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT fk_it_request_categories_updated_by FOREIGN KEY (updated_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS it_requests (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(40) NOT NULL,
  category_id BIGINT UNSIGNED NOT NULL,
  request_kind ENUM('INCIDENT', 'SERVICE_REQUEST', 'ACCESS_REQUEST', 'HARDWARE_PROVISION') NOT NULL DEFAULT 'INCIDENT',
  title VARCHAR(250) NOT NULL,
  description TEXT NOT NULL,
  priority ENUM('LOW', 'MEDIUM', 'HIGH', 'URGENT') NOT NULL DEFAULT 'MEDIUM',
  status ENUM('DRAFT', 'PENDING_APPROVAL', 'OPEN', 'IN_PROGRESS', 'WAITING_USER', 'RESOLVED', 'CLOSED', 'REJECTED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
  requester_user_id BIGINT UNSIGNED NOT NULL,
  requester_employee_id BIGINT UNSIGNED NULL,
  branch_id BIGINT UNSIGNED NULL,
  department_id BIGINT UNSIGNED NULL,
  asset_id BIGINT UNSIGNED NULL,
  assigned_to_user_id BIGINT UNSIGNED NULL,
  estimated_cost DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  location_detail VARCHAR(200) NULL,
  contact_phone VARCHAR(30) NULL,
  approval_request_id BIGINT UNSIGNED NULL,
  sla_response_due_at DATETIME NULL,
  sla_resolution_due_at DATETIME NULL,
  first_responded_at DATETIME NULL,
  sla_paused_at DATETIME NULL,
  sla_paused_minutes INT UNSIGNED NOT NULL DEFAULT 0,
  submitted_at DATETIME NULL,
  resolved_at DATETIME NULL,
  closed_at DATETIME NULL,
  resolution_summary TEXT NULL,
  rejection_reason VARCHAR(500) NULL,
  satisfaction_rating TINYINT UNSIGNED NULL,
  satisfaction_feedback VARCHAR(500) NULL,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_it_requests_code (code),
  KEY idx_it_requests_status_priority (status, priority),
  KEY idx_it_requests_requester (requester_user_id, status),
  KEY idx_it_requests_assignee (assigned_to_user_id, status),
  KEY idx_it_requests_branch_dept (branch_id, department_id),
  KEY idx_it_requests_category (category_id),
  KEY idx_it_requests_asset (asset_id),
  KEY idx_it_requests_approval_request_id (approval_request_id),
  KEY idx_it_requests_sla_due (status, sla_resolution_due_at),
  KEY idx_it_requests_deleted_at (deleted_at),
  CONSTRAINT fk_it_requests_category_id FOREIGN KEY (category_id) REFERENCES it_request_categories(id),
  CONSTRAINT fk_it_requests_requester_user_id FOREIGN KEY (requester_user_id) REFERENCES users(id),
  CONSTRAINT fk_it_requests_requester_employee_id FOREIGN KEY (requester_employee_id) REFERENCES employees(id),
  CONSTRAINT fk_it_requests_branch_id FOREIGN KEY (branch_id) REFERENCES branches(id),
  CONSTRAINT fk_it_requests_department_id FOREIGN KEY (department_id) REFERENCES departments(id),
  CONSTRAINT fk_it_requests_asset_id FOREIGN KEY (asset_id) REFERENCES assets(id),
  CONSTRAINT fk_it_requests_assigned_to_user_id FOREIGN KEY (assigned_to_user_id) REFERENCES users(id),
  CONSTRAINT fk_it_requests_approval_request_id FOREIGN KEY (approval_request_id) REFERENCES approval_requests(id),
  CONSTRAINT fk_it_requests_created_by FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT fk_it_requests_updated_by FOREIGN KEY (updated_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS it_request_checklist_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  it_request_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(250) NOT NULL,
  note VARCHAR(500) NULL,
  is_done TINYINT(1) NOT NULL DEFAULT 0,
  done_by_user_id BIGINT UNSIGNED NULL,
  done_at DATETIME NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_it_checklist_request_order (it_request_id, sort_order),
  CONSTRAINT fk_it_checklist_request_id FOREIGN KEY (it_request_id) REFERENCES it_requests(id) ON DELETE CASCADE,
  CONSTRAINT fk_it_checklist_done_by_user_id FOREIGN KEY (done_by_user_id) REFERENCES users(id),
  CONSTRAINT fk_it_checklist_created_by FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT fk_it_checklist_updated_by FOREIGN KEY (updated_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS it_request_comments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  it_request_id BIGINT UNSIGNED NOT NULL,
  author_user_id BIGINT UNSIGNED NOT NULL,
  visibility ENUM('PUBLIC', 'INTERNAL_NOTE') NOT NULL DEFAULT 'PUBLIC',
  comment_type ENUM('COMMENT', 'RESOLUTION', 'STATUS_NOTE', 'SYSTEM') NOT NULL DEFAULT 'COMMENT',
  content TEXT NOT NULL,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  PRIMARY KEY (id),
  KEY idx_it_comments_request_id (it_request_id, created_at),
  KEY idx_it_comments_deleted_at (deleted_at),
  CONSTRAINT fk_it_comments_request_id FOREIGN KEY (it_request_id) REFERENCES it_requests(id) ON DELETE CASCADE,
  CONSTRAINT fk_it_comments_author_user_id FOREIGN KEY (author_user_id) REFERENCES users(id),
  CONSTRAINT fk_it_comments_created_by FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT fk_it_comments_updated_by FOREIGN KEY (updated_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS it_request_attachments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  it_request_id BIGINT UNSIGNED NOT NULL,
  uploaded_by_user_id BIGINT UNSIGNED NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  stored_path VARCHAR(500) NOT NULL,
  mime_type VARCHAR(120) NOT NULL,
  file_size BIGINT UNSIGNED NOT NULL,
  checksum_sha256 CHAR(64) NOT NULL,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  PRIMARY KEY (id),
  KEY idx_it_attachments_request_id (it_request_id),
  KEY idx_it_attachments_deleted_at (deleted_at),
  CONSTRAINT fk_it_attachments_request_id FOREIGN KEY (it_request_id) REFERENCES it_requests(id) ON DELETE CASCADE,
  CONSTRAINT fk_it_attachments_uploaded_by_user_id FOREIGN KEY (uploaded_by_user_id) REFERENCES users(id),
  CONSTRAINT fk_it_attachments_created_by FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT fk_it_attachments_updated_by FOREIGN KEY (updated_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS it_request_activities (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  it_request_id BIGINT UNSIGNED NOT NULL,
  actor_user_id BIGINT UNSIGNED NULL,
  action VARCHAR(60) NOT NULL,
  summary VARCHAR(500) NOT NULL,
  metadata_json JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_it_activities_request_id (it_request_id, created_at),
  CONSTRAINT fk_it_activities_request_id FOREIGN KEY (it_request_id) REFERENCES it_requests(id) ON DELETE CASCADE,
  CONSTRAINT fk_it_activities_actor_user_id FOREIGN KEY (actor_user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- DOWN
DROP TABLE IF EXISTS it_request_activities;
DROP TABLE IF EXISTS it_request_attachments;
DROP TABLE IF EXISTS it_request_comments;
DROP TABLE IF EXISTS it_request_checklist_items;
DROP TABLE IF EXISTS it_requests;
DROP TABLE IF EXISTS it_request_categories;
