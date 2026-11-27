-- UP
CREATE TABLE IF NOT EXISTS payment_budgets (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(200) NOT NULL,
  name_en VARCHAR(220) NULL,
  description TEXT NULL,
  fiscal_year SMALLINT UNSIGNED NOT NULL,
  period_type ENUM('ANNUAL', 'QUARTERLY', 'MONTHLY', 'CUSTOM') NOT NULL DEFAULT 'ANNUAL',
  period_label VARCHAR(60) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  branch_id BIGINT UNSIGNED NULL,
  department_id BIGINT UNSIGNED NULL,
  category_id BIGINT UNSIGNED NULL,
  project_id BIGINT UNSIGNED NULL,
  owner_user_id BIGINT UNSIGNED NULL,
  currency CHAR(3) NOT NULL DEFAULT 'VND',
  allocated_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  reserved_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  spent_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  warning_threshold_percent DECIMAL(5,2) NOT NULL DEFAULT 80.00,
  enforcement_mode ENUM('HARD_BLOCK', 'SOFT_WARN') NOT NULL DEFAULT 'HARD_BLOCK',
  status ENUM('DRAFT', 'ACTIVE', 'FROZEN', 'CLOSED') NOT NULL DEFAULT 'ACTIVE',
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  CONSTRAINT uq_payment_budgets_code UNIQUE (code),
  INDEX idx_payment_budgets_fiscal_status (fiscal_year, status),
  INDEX idx_payment_budgets_scope (branch_id, department_id, category_id),
  INDEX idx_payment_budgets_dates (start_date, end_date),
  INDEX idx_payment_budgets_owner (owner_user_id),
  INDEX idx_payment_budgets_project (project_id),
  INDEX idx_payment_budgets_deleted_at (deleted_at),
  CONSTRAINT fk_payment_budgets_branch_id FOREIGN KEY (branch_id) REFERENCES branches (id) ON DELETE SET NULL,
  CONSTRAINT fk_payment_budgets_department_id FOREIGN KEY (department_id) REFERENCES departments (id) ON DELETE SET NULL,
  CONSTRAINT fk_payment_budgets_category_id FOREIGN KEY (category_id) REFERENCES payment_categories (id) ON DELETE SET NULL,
  CONSTRAINT fk_payment_budgets_project_id FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE SET NULL,
  CONSTRAINT fk_payment_budgets_owner_user_id FOREIGN KEY (owner_user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payment_budget_transactions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  budget_id BIGINT UNSIGNED NOT NULL,
  tx_type ENUM('ALLOCATE', 'TOP_UP', 'REDUCE', 'TRANSFER_OUT', 'TRANSFER_IN', 'RESERVE', 'RELEASE', 'CONSUME', 'REFUND') NOT NULL,
  source_type ENUM('MANUAL', 'TRANSFER', 'PROPOSAL', 'PAYMENT', 'DISBURSEMENT') NOT NULL,
  source_id BIGINT UNSIGNED NULL,
  source_code VARCHAR(60) NULL,
  related_budget_id BIGINT UNSIGNED NULL,
  allocated_delta DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  reserved_delta DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  spent_delta DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  balance_allocated_after DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  balance_reserved_after DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  balance_spent_after DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  balance_available_after DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  note VARCHAR(500) NULL,
  actor_user_id BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_pbt_budget_created (budget_id, created_at),
  INDEX idx_pbt_source (source_type, source_id),
  INDEX idx_pbt_tx_type (tx_type),
  INDEX idx_pbt_related_budget (related_budget_id),
  CONSTRAINT fk_pbt_budget_id FOREIGN KEY (budget_id) REFERENCES payment_budgets (id) ON DELETE CASCADE,
  CONSTRAINT fk_pbt_related_budget_id FOREIGN KEY (related_budget_id) REFERENCES payment_budgets (id) ON DELETE SET NULL,
  CONSTRAINT fk_pbt_actor_user_id FOREIGN KEY (actor_user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE proposals
  ADD COLUMN budget_id BIGINT UNSIGNED NULL AFTER department_id,
  ADD COLUMN budget_reserved_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00 AFTER approved_budget,
  ADD COLUMN is_over_budget TINYINT(1) NOT NULL DEFAULT 0 AFTER budget_reserved_amount,
  ADD INDEX idx_proposals_budget_id (budget_id),
  ADD CONSTRAINT fk_proposals_budget_id FOREIGN KEY (budget_id) REFERENCES payment_budgets (id) ON DELETE SET NULL;

ALTER TABLE payment_requests
  ADD COLUMN budget_id BIGINT UNSIGNED NULL AFTER department_id,
  ADD COLUMN budget_reserved_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00 AFTER disbursed_amount,
  ADD COLUMN budget_spent_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00 AFTER budget_reserved_amount,
  ADD COLUMN proposal_reserve_used DECIMAL(18,2) NOT NULL DEFAULT 0.00 AFTER budget_spent_amount,
  ADD COLUMN is_over_budget TINYINT(1) NOT NULL DEFAULT 0 AFTER proposal_reserve_used,
  ADD INDEX idx_payment_requests_budget_id (budget_id),
  ADD CONSTRAINT fk_payment_requests_budget_id FOREIGN KEY (budget_id) REFERENCES payment_budgets (id) ON DELETE SET NULL;

-- DOWN
ALTER TABLE payment_requests
  DROP FOREIGN KEY fk_payment_requests_budget_id,
  DROP INDEX idx_payment_requests_budget_id,
  DROP COLUMN is_over_budget,
  DROP COLUMN proposal_reserve_used,
  DROP COLUMN budget_spent_amount,
  DROP COLUMN budget_reserved_amount,
  DROP COLUMN budget_id;

ALTER TABLE proposals
  DROP FOREIGN KEY fk_proposals_budget_id,
  DROP INDEX idx_proposals_budget_id,
  DROP COLUMN is_over_budget,
  DROP COLUMN budget_reserved_amount,
  DROP COLUMN budget_id;

DROP TABLE IF EXISTS payment_budget_transactions;
DROP TABLE IF EXISTS payment_budgets;
