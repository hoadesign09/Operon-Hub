-- UP
CREATE TABLE IF NOT EXISTS overtime_requests (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  request_code VARCHAR(40) NOT NULL,
  employee_id BIGINT UNSIGNED NOT NULL,
  work_date DATE NOT NULL,
  start_time VARCHAR(5) NOT NULL,
  end_time VARCHAR(5) NOT NULL,
  total_hours DECIMAL(5, 2) NOT NULL,
  ot_rate_type ENUM('WEEKDAY_150', 'WEEKEND_200', 'HOLIDAY_300') NOT NULL,
  is_holiday TINYINT(1) NOT NULL DEFAULT 0,
  reason TEXT NOT NULL,
  status ENUM('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
  approval_request_id BIGINT UNSIGNED NULL DEFAULT NULL,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  CONSTRAINT uq_overtime_requests_code UNIQUE (request_code),
  INDEX idx_overtime_requests_emp_date (employee_id, work_date),
  INDEX idx_overtime_requests_status (status, deleted_at),
  INDEX idx_overtime_requests_approval (approval_request_id),
  CONSTRAINT fk_overtime_requests_employee_id FOREIGN KEY (employee_id) REFERENCES employees (id) ON DELETE RESTRICT,
  CONSTRAINT fk_overtime_requests_approval_request_id FOREIGN KEY (approval_request_id) REFERENCES approval_requests (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS business_trip_requests (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  request_code VARCHAR(40) NOT NULL,
  employee_id BIGINT UNSIGNED NOT NULL,
  destination VARCHAR(200) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_days DECIMAL(5, 2) NOT NULL,
  purpose TEXT NOT NULL,
  estimated_cost DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
  status ENUM('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
  approval_request_id BIGINT UNSIGNED NULL DEFAULT NULL,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  CONSTRAINT uq_business_trip_requests_code UNIQUE (request_code),
  INDEX idx_business_trip_requests_emp_dates (employee_id, start_date, end_date),
  INDEX idx_business_trip_requests_status (status, deleted_at),
  INDEX idx_business_trip_requests_approval (approval_request_id),
  CONSTRAINT fk_business_trip_requests_employee_id FOREIGN KEY (employee_id) REFERENCES employees (id) ON DELETE RESTRICT,
  CONSTRAINT fk_business_trip_requests_approval_request_id FOREIGN KEY (approval_request_id) REFERENCES approval_requests (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- DOWN
DROP TABLE IF EXISTS business_trip_requests;
DROP TABLE IF EXISTS overtime_requests;
