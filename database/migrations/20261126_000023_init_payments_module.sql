-- UP
CREATE TABLE IF NOT EXISTS payment_categories (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(150) NOT NULL,
  name_en VARCHAR(180) NULL,
  description VARCHAR(500) NULL,
  default_payment_type ENUM('CASH_ADVANCE', 'REIMBURSEMENT', 'VENDOR_PAYMENT', 'ADVANCE_SETTLEMENT') NOT NULL DEFAULT 'REIMBURSEMENT',
  requires_receipt TINYINT(1) NOT NULL DEFAULT 1,
  color VARCHAR(20) NOT NULL DEFAULT '#D97706',
  sort_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  CONSTRAINT uq_payment_categories_code UNIQUE (code),
  INDEX idx_payment_categories_active (is_active, sort_order),
  INDEX idx_payment_categories_deleted_at (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payment_requests (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(40) NOT NULL,
  payment_type ENUM('CASH_ADVANCE', 'REIMBURSEMENT', 'VENDOR_PAYMENT', 'ADVANCE_SETTLEMENT') NOT NULL DEFAULT 'REIMBURSEMENT',
  category_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(250) NOT NULL,
  description TEXT NOT NULL,
  priority ENUM('LOW', 'MEDIUM', 'HIGH', 'URGENT') NOT NULL DEFAULT 'MEDIUM',
  status ENUM('DRAFT', 'PENDING_APPROVAL', 'NEEDS_REVISION', 'APPROVED', 'REJECTED', 'PARTIALLY_PAID', 'PAID', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
  requester_user_id BIGINT UNSIGNED NOT NULL,
  requester_employee_id BIGINT UNSIGNED NULL,
  branch_id BIGINT UNSIGNED NULL,
  department_id BIGINT UNSIGNED NULL,
  proposal_id BIGINT UNSIGNED NULL,
  project_id BIGINT UNSIGNED NULL,
  linked_advance_id BIGINT UNSIGNED NULL,
  is_settled TINYINT(1) NOT NULL DEFAULT 0,
  settled_by_payment_id BIGINT UNSIGNED NULL,
  payment_method ENUM('BANK_TRANSFER', 'CASH') NOT NULL DEFAULT 'BANK_TRANSFER',
  beneficiary_type ENUM('EMPLOYEE', 'VENDOR') NOT NULL DEFAULT 'EMPLOYEE',
  beneficiary_name VARCHAR(200) NOT NULL,
  beneficiary_tax_code VARCHAR(40) NULL,
  bank_name VARCHAR(150) NULL,
  bank_account_no VARCHAR(80) NULL,
  bank_branch VARCHAR(150) NULL,
  currency CHAR(3) NOT NULL DEFAULT 'VND',
  subtotal_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  tax_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  total_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  advance_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  net_settlement_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  payable_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  approved_amount DECIMAL(18,2) NULL,
  disbursed_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  due_date DATE NULL,
  advance_due_date DATE NULL,
  approval_request_id BIGINT UNSIGNED NULL,
  submitted_at DATETIME NULL,
  approved_at DATETIME NULL,
  paid_at DATETIME NULL,
  rejection_reason VARCHAR(500) NULL,
  revision_note VARCHAR(500) NULL,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  CONSTRAINT uq_payment_requests_code UNIQUE (code),
  INDEX idx_payment_requests_status_type (status, payment_type),
  INDEX idx_payment_requests_requester (requester_user_id, status),
  INDEX idx_payment_requests_branch_dept (branch_id, department_id),
  INDEX idx_payment_requests_due_date (status, due_date),
  INDEX idx_payment_requests_advance_open (payment_type, is_settled, status),
  INDEX idx_payment_requests_linked_advance (linked_advance_id),
  INDEX idx_payment_requests_proposal (proposal_id),
  INDEX idx_payment_requests_project (project_id),
  INDEX idx_payment_requests_deleted_at (deleted_at),
  CONSTRAINT fk_payment_requests_category_id FOREIGN KEY (category_id) REFERENCES payment_categories (id) ON DELETE RESTRICT,
  CONSTRAINT fk_payment_requests_requester_user_id FOREIGN KEY (requester_user_id) REFERENCES users (id) ON DELETE RESTRICT,
  CONSTRAINT fk_payment_requests_requester_employee_id FOREIGN KEY (requester_employee_id) REFERENCES employees (id) ON DELETE SET NULL,
  CONSTRAINT fk_payment_requests_branch_id FOREIGN KEY (branch_id) REFERENCES branches (id) ON DELETE SET NULL,
  CONSTRAINT fk_payment_requests_department_id FOREIGN KEY (department_id) REFERENCES departments (id) ON DELETE SET NULL,
  CONSTRAINT fk_payment_requests_proposal_id FOREIGN KEY (proposal_id) REFERENCES proposals (id) ON DELETE SET NULL,
  CONSTRAINT fk_payment_requests_project_id FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE SET NULL,
  CONSTRAINT fk_payment_requests_linked_advance_id FOREIGN KEY (linked_advance_id) REFERENCES payment_requests (id) ON DELETE SET NULL,
  CONSTRAINT fk_payment_requests_settled_by_id FOREIGN KEY (settled_by_payment_id) REFERENCES payment_requests (id) ON DELETE SET NULL,
  CONSTRAINT fk_payment_requests_approval_request_id FOREIGN KEY (approval_request_id) REFERENCES approval_requests (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payment_request_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  payment_request_id BIGINT UNSIGNED NOT NULL,
  description VARCHAR(300) NOT NULL,
  invoice_no VARCHAR(80) NULL,
  invoice_date DATE NULL,
  quantity DECIMAL(12,2) NOT NULL DEFAULT 1.00,
  unit_price DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  tax_rate DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  subtotal_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  tax_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  line_total DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  note VARCHAR(300) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_payment_items_request (payment_request_id, sort_order),
  INDEX idx_payment_items_invoice_no (invoice_no),
  CONSTRAINT fk_payment_items_request_id FOREIGN KEY (payment_request_id) REFERENCES payment_requests (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payment_disbursements (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  payment_request_id BIGINT UNSIGNED NOT NULL,
  direction ENUM('OUTGOING', 'INCOMING_REFUND') NOT NULL DEFAULT 'OUTGOING',
  disbursement_date DATE NOT NULL,
  amount DECIMAL(18,2) NOT NULL,
  payment_method ENUM('BANK_TRANSFER', 'CASH') NOT NULL DEFAULT 'BANK_TRANSFER',
  bank_transaction_ref VARCHAR(120) NULL,
  source_account VARCHAR(150) NULL,
  note VARCHAR(500) NULL,
  disbursed_by_user_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_payment_disbursements_request (payment_request_id, disbursement_date),
  INDEX idx_payment_disbursements_ref (bank_transaction_ref),
  CONSTRAINT fk_payment_disbursements_request_id FOREIGN KEY (payment_request_id) REFERENCES payment_requests (id) ON DELETE CASCADE,
  CONSTRAINT fk_payment_disbursements_user_id FOREIGN KEY (disbursed_by_user_id) REFERENCES users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payment_comments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  payment_request_id BIGINT UNSIGNED NOT NULL,
  author_user_id BIGINT UNSIGNED NOT NULL,
  comment_type ENUM('GENERAL', 'REVISION_REQUEST', 'FINANCE_NOTE', 'SYSTEM') NOT NULL DEFAULT 'GENERAL',
  content TEXT NOT NULL,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  INDEX idx_payment_comments_request (payment_request_id, created_at),
  INDEX idx_payment_comments_deleted_at (deleted_at),
  CONSTRAINT fk_payment_comments_request_id FOREIGN KEY (payment_request_id) REFERENCES payment_requests (id) ON DELETE CASCADE,
  CONSTRAINT fk_payment_comments_author_user_id FOREIGN KEY (author_user_id) REFERENCES users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payment_attachments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  payment_request_id BIGINT UNSIGNED NOT NULL,
  attachment_kind ENUM('INVOICE', 'RECEIPT', 'CONTRACT', 'UNC_RECEIPT', 'OTHER') NOT NULL DEFAULT 'RECEIPT',
  file_name VARCHAR(255) NOT NULL,
  stored_path VARCHAR(500) NOT NULL,
  mime_type VARCHAR(120) NOT NULL,
  file_size BIGINT UNSIGNED NOT NULL,
  checksum_sha256 CHAR(64) NOT NULL,
  uploaded_by_user_id BIGINT UNSIGNED NOT NULL,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  INDEX idx_payment_attachments_request (payment_request_id, attachment_kind),
  INDEX idx_payment_attachments_deleted_at (deleted_at),
  CONSTRAINT fk_payment_attachments_request_id FOREIGN KEY (payment_request_id) REFERENCES payment_requests (id) ON DELETE CASCADE,
  CONSTRAINT fk_payment_attachments_user_id FOREIGN KEY (uploaded_by_user_id) REFERENCES users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payment_activities (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  payment_request_id BIGINT UNSIGNED NOT NULL,
  actor_user_id BIGINT UNSIGNED NULL,
  action VARCHAR(60) NOT NULL,
  summary VARCHAR(500) NOT NULL,
  metadata_json JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_payment_activities_request (payment_request_id, created_at),
  CONSTRAINT fk_payment_activities_request_id FOREIGN KEY (payment_request_id) REFERENCES payment_requests (id) ON DELETE CASCADE,
  CONSTRAINT fk_payment_activities_actor_user_id FOREIGN KEY (actor_user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- DOWN
DROP TABLE IF EXISTS payment_activities;
DROP TABLE IF EXISTS payment_attachments;
DROP TABLE IF EXISTS payment_comments;
DROP TABLE IF EXISTS payment_disbursements;
DROP TABLE IF EXISTS payment_request_items;
DROP TABLE IF EXISTS payment_requests;
DROP TABLE IF EXISTS payment_categories;
