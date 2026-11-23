-- UP
CREATE TABLE IF NOT EXISTS employee_contracts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  employee_id BIGINT UNSIGNED NOT NULL,
  contract_no VARCHAR(50) NOT NULL,
  contract_type ENUM('PROBATION', 'FIXED_TERM', 'INDEFINITE', 'PART_TIME') NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NULL DEFAULT NULL,
  base_salary DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
  insurance_salary DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
  allowances_json JSON NULL DEFAULT NULL,
  status ENUM('DRAFT', 'ACTIVE', 'EXPIRED', 'TERMINATED') NOT NULL DEFAULT 'DRAFT',
  signed_date DATE NULL DEFAULT NULL,
  note VARCHAR(500) NULL DEFAULT NULL,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  CONSTRAINT uq_employee_contracts_contract_no UNIQUE (contract_no),
  INDEX idx_employee_contracts_employee_id (employee_id),
  INDEX idx_employee_contracts_status (status),
  INDEX idx_employee_contracts_end_date (end_date),
  INDEX idx_employee_contracts_deleted_at (deleted_at),
  CONSTRAINT fk_employee_contracts_employee_id FOREIGN KEY (employee_id) REFERENCES employees (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS employee_work_histories (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  employee_id BIGINT UNSIGNED NOT NULL,
  change_type ENUM('HIRE', 'PROMOTION', 'TRANSFER', 'SALARY_ADJUST', 'TERMINATION') NOT NULL,
  effective_date DATE NOT NULL,
  decision_no VARCHAR(50) NULL DEFAULT NULL,
  from_branch_id BIGINT UNSIGNED NULL DEFAULT NULL,
  to_branch_id BIGINT UNSIGNED NULL DEFAULT NULL,
  from_department_id BIGINT UNSIGNED NULL DEFAULT NULL,
  to_department_id BIGINT UNSIGNED NULL DEFAULT NULL,
  from_position_id BIGINT UNSIGNED NULL DEFAULT NULL,
  to_position_id BIGINT UNSIGNED NULL DEFAULT NULL,
  from_salary DECIMAL(18, 2) NULL DEFAULT NULL,
  to_salary DECIMAL(18, 2) NULL DEFAULT NULL,
  note VARCHAR(500) NULL DEFAULT NULL,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  INDEX idx_employee_work_histories_employee_id (employee_id),
  INDEX idx_employee_work_histories_change_type (change_type),
  INDEX idx_employee_work_histories_effective_date (effective_date),
  INDEX idx_employee_work_histories_deleted_at (deleted_at),
  CONSTRAINT fk_employee_work_histories_employee_id FOREIGN KEY (employee_id) REFERENCES employees (id) ON DELETE RESTRICT,
  CONSTRAINT fk_work_histories_from_branch_id FOREIGN KEY (from_branch_id) REFERENCES branches (id) ON DELETE SET NULL,
  CONSTRAINT fk_work_histories_to_branch_id FOREIGN KEY (to_branch_id) REFERENCES branches (id) ON DELETE SET NULL,
  CONSTRAINT fk_work_histories_from_department_id FOREIGN KEY (from_department_id) REFERENCES departments (id) ON DELETE SET NULL,
  CONSTRAINT fk_work_histories_to_department_id FOREIGN KEY (to_department_id) REFERENCES departments (id) ON DELETE SET NULL,
  CONSTRAINT fk_work_histories_from_position_id FOREIGN KEY (from_position_id) REFERENCES positions (id) ON DELETE SET NULL,
  CONSTRAINT fk_work_histories_to_position_id FOREIGN KEY (to_position_id) REFERENCES positions (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- DOWN
DROP TABLE IF EXISTS employee_work_histories;
DROP TABLE IF EXISTS employee_contracts;
