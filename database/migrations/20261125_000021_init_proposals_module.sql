-- UP
CREATE TABLE IF NOT EXISTS proposal_categories (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(40) NOT NULL,
  name VARCHAR(150) NOT NULL,
  name_en VARCHAR(200) NULL,
  description VARCHAR(500) NULL,
  default_request_type VARCHAR(60) NOT NULL DEFAULT 'PROPOSAL_STANDARD',
  requires_budget TINYINT(1) NOT NULL DEFAULT 0,
  budget_threshold_high DECIMAL(18,2) NOT NULL DEFAULT 20000000.00,
  icon_name VARCHAR(50) NULL,
  color_hex VARCHAR(20) NOT NULL DEFAULT '#2563EB',
  sort_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  CONSTRAINT uq_proposal_categories_code UNIQUE (code),
  INDEX idx_proposal_categories_active (is_active, deleted_at, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS proposals (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  proposal_code VARCHAR(32) NOT NULL,
  category_id BIGINT UNSIGNED NOT NULL,
  branch_id BIGINT UNSIGNED NOT NULL,
  department_id BIGINT UNSIGNED NULL,
  requester_employee_id BIGINT UNSIGNED NULL,
  requester_user_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(255) NOT NULL,
  summary VARCHAR(500) NULL,
  content TEXT NOT NULL,
  expected_outcome TEXT NULL,
  priority ENUM('LOW', 'MEDIUM', 'HIGH', 'URGENT') NOT NULL DEFAULT 'MEDIUM',
  status ENUM(
    'DRAFT',
    'PENDING_APPROVAL',
    'NEEDS_REVISION',
    'APPROVED',
    'REJECTED',
    'IN_EXECUTION',
    'COMPLETED',
    'CANCELLED'
  ) NOT NULL DEFAULT 'DRAFT',
  estimated_budget DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  approved_budget DECIMAL(18,2) NULL DEFAULT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'VND',
  needed_by_date DATE NULL DEFAULT NULL,
  effective_from DATE NULL DEFAULT NULL,
  effective_to DATE NULL DEFAULT NULL,
  vendor_name VARCHAR(200) NULL DEFAULT NULL,
  approval_request_id BIGINT UNSIGNED NULL DEFAULT NULL,
  submitted_at TIMESTAMP NULL DEFAULT NULL,
  approved_at TIMESTAMP NULL DEFAULT NULL,
  completed_at TIMESTAMP NULL DEFAULT NULL,
  rejection_reason VARCHAR(500) NULL DEFAULT NULL,
  execution_notes TEXT NULL,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  CONSTRAINT uq_proposals_code UNIQUE (proposal_code),
  CONSTRAINT fk_proposals_category_id FOREIGN KEY (category_id) REFERENCES proposal_categories(id),
  CONSTRAINT fk_proposals_branch_id FOREIGN KEY (branch_id) REFERENCES branches(id),
  CONSTRAINT fk_proposals_department_id FOREIGN KEY (department_id) REFERENCES departments(id),
  CONSTRAINT fk_proposals_requester_employee_id FOREIGN KEY (requester_employee_id) REFERENCES employees(id),
  CONSTRAINT fk_proposals_requester_user_id FOREIGN KEY (requester_user_id) REFERENCES users(id),
  CONSTRAINT fk_proposals_approval_request_id FOREIGN KEY (approval_request_id) REFERENCES approval_requests(id),
  INDEX idx_proposals_status_deleted (status, deleted_at, created_at),
  INDEX idx_proposals_branch_dept (branch_id, department_id, deleted_at),
  INDEX idx_proposals_requester (requester_user_id, deleted_at),
  INDEX idx_proposals_category (category_id, deleted_at),
  INDEX idx_proposals_priority_needed (priority, needed_by_date),
  INDEX idx_proposals_approval_request (approval_request_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS proposal_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  proposal_id BIGINT UNSIGNED NOT NULL,
  line_no INT NOT NULL DEFAULT 1,
  item_name VARCHAR(255) NOT NULL,
  specification VARCHAR(500) NULL,
  unit VARCHAR(40) NOT NULL DEFAULT 'Cái',
  quantity DECIMAL(12,2) NOT NULL DEFAULT 1.00,
  unit_price DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  line_total DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  vendor_note VARCHAR(255) NULL,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  CONSTRAINT fk_proposal_items_proposal_id FOREIGN KEY (proposal_id) REFERENCES proposals(id),
  INDEX idx_proposal_items_proposal (proposal_id, deleted_at, line_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS proposal_comments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  proposal_id BIGINT UNSIGNED NOT NULL,
  author_user_id BIGINT UNSIGNED NOT NULL,
  comment_type ENUM('GENERAL', 'REVISION_REQUEST', 'EXECUTION_UPDATE') NOT NULL DEFAULT 'GENERAL',
  content TEXT NOT NULL,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  CONSTRAINT fk_proposal_comments_proposal_id FOREIGN KEY (proposal_id) REFERENCES proposals(id),
  CONSTRAINT fk_proposal_comments_author_user_id FOREIGN KEY (author_user_id) REFERENCES users(id),
  INDEX idx_proposal_comments_proposal (proposal_id, deleted_at, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS proposal_attachments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  proposal_id BIGINT UNSIGNED NOT NULL,
  uploaded_by_user_id BIGINT UNSIGNED NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  stored_path VARCHAR(500) NOT NULL,
  mime_type VARCHAR(120) NOT NULL,
  file_size_bytes BIGINT UNSIGNED NOT NULL,
  checksum_sha256 VARCHAR(64) NOT NULL,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  CONSTRAINT fk_proposal_attachments_proposal_id FOREIGN KEY (proposal_id) REFERENCES proposals(id),
  CONSTRAINT fk_proposal_attachments_uploaded_by FOREIGN KEY (uploaded_by_user_id) REFERENCES users(id),
  INDEX idx_proposal_attachments_proposal (proposal_id, deleted_at, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS proposal_activities (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  proposal_id BIGINT UNSIGNED NOT NULL,
  actor_user_id BIGINT UNSIGNED NOT NULL,
  action_type VARCHAR(50) NOT NULL,
  detail_json TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_proposal_activities_proposal_id FOREIGN KEY (proposal_id) REFERENCES proposals(id),
  CONSTRAINT fk_proposal_activities_actor_user_id FOREIGN KEY (actor_user_id) REFERENCES users(id),
  INDEX idx_proposal_activities_proposal (proposal_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- DOWN
DROP TABLE IF EXISTS proposal_activities;
DROP TABLE IF EXISTS proposal_attachments;
DROP TABLE IF EXISTS proposal_comments;
DROP TABLE IF EXISTS proposal_items;
DROP TABLE IF EXISTS proposals;
DROP TABLE IF EXISTS proposal_categories;
