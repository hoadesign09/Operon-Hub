-- UP
CREATE TABLE IF NOT EXISTS leave_types (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(32) NOT NULL,
  name VARCHAR(120) NOT NULL,
  is_paid TINYINT(1) NOT NULL DEFAULT 1,
  default_days_per_year DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
  allow_carry_over TINYINT(1) NOT NULL DEFAULT 0,
  max_carry_over_days DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
  requires_attachment TINYINT(1) NOT NULL DEFAULT 0,
  description VARCHAR(255) NULL DEFAULT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  CONSTRAINT uq_leave_types_code UNIQUE (code),
  INDEX idx_leave_types_active (is_active, deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS leave_balances (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  employee_id BIGINT UNSIGNED NOT NULL,
  leave_type_id BIGINT UNSIGNED NOT NULL,
  year SMALLINT UNSIGNED NOT NULL,
  entitled_days DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
  carried_over_days DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
  used_days DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
  pending_days DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
  note VARCHAR(255) NULL DEFAULT NULL,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  CONSTRAINT uq_leave_balances_emp_type_year UNIQUE (employee_id, leave_type_id, year),
  INDEX idx_leave_balances_year (year, deleted_at),
  INDEX idx_leave_balances_employee (employee_id, year),
  INDEX idx_leave_balances_leave_type (leave_type_id),
  CONSTRAINT fk_leave_balances_employee_id FOREIGN KEY (employee_id) REFERENCES employees (id) ON DELETE RESTRICT,
  CONSTRAINT fk_leave_balances_leave_type_id FOREIGN KEY (leave_type_id) REFERENCES leave_types (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS leave_requests (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  request_code VARCHAR(40) NOT NULL,
  employee_id BIGINT UNSIGNED NOT NULL,
  leave_type_id BIGINT UNSIGNED NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  start_session ENUM('FULL', 'AM', 'PM') NOT NULL DEFAULT 'FULL',
  end_session ENUM('FULL', 'AM', 'PM') NOT NULL DEFAULT 'FULL',
  total_days DECIMAL(5, 2) NOT NULL,
  reason TEXT NOT NULL,
  attachment_url VARCHAR(500) NULL DEFAULT NULL,
  status ENUM('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
  approval_request_id BIGINT UNSIGNED NULL DEFAULT NULL,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  CONSTRAINT uq_leave_requests_code UNIQUE (request_code),
  INDEX idx_leave_requests_employee_dates (employee_id, start_date, end_date),
  INDEX idx_leave_requests_status (status, deleted_at),
  INDEX idx_leave_requests_leave_type (leave_type_id),
  INDEX idx_leave_requests_approval (approval_request_id),
  CONSTRAINT fk_leave_requests_employee_id FOREIGN KEY (employee_id) REFERENCES employees (id) ON DELETE RESTRICT,
  CONSTRAINT fk_leave_requests_leave_type_id FOREIGN KEY (leave_type_id) REFERENCES leave_types (id) ON DELETE RESTRICT,
  CONSTRAINT fk_leave_requests_approval_request_id FOREIGN KEY (approval_request_id) REFERENCES approval_requests (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- DOWN
DROP TABLE IF EXISTS leave_requests;
DROP TABLE IF EXISTS leave_balances;
DROP TABLE IF EXISTS leave_types;
