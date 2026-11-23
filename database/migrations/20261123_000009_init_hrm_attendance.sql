-- UP
CREATE TABLE IF NOT EXISTS work_shifts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  branch_id BIGINT UNSIGNED NULL,
  code VARCHAR(32) NOT NULL,
  name VARCHAR(120) NOT NULL,
  start_time CHAR(5) NOT NULL,
  end_time CHAR(5) NOT NULL,
  break_start_time CHAR(5) NULL,
  break_end_time CHAR(5) NULL,
  late_grace_minutes INT UNSIGNED NOT NULL DEFAULT 10,
  early_leave_grace_minutes INT UNSIGNED NOT NULL DEFAULT 10,
  working_hours DECIMAL(4,2) NOT NULL DEFAULT 8.00,
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  description VARCHAR(500) NULL,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_work_shifts_code (code),
  KEY idx_work_shifts_branch_id (branch_id),
  KEY idx_work_shifts_is_default (is_default),
  KEY idx_work_shifts_is_active (is_active),
  KEY idx_work_shifts_deleted_at (deleted_at),
  CONSTRAINT fk_work_shifts_branch_id FOREIGN KEY (branch_id) REFERENCES branches (id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS employee_shift_assignments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  employee_id BIGINT UNSIGNED NOT NULL,
  shift_id BIGINT UNSIGNED NOT NULL,
  effective_from DATE NOT NULL,
  effective_to DATE NULL,
  work_days_json JSON NOT NULL,
  note VARCHAR(500) NULL,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  PRIMARY KEY (id),
  KEY idx_emp_shift_assignments_emp_dates (employee_id, effective_from, effective_to),
  KEY idx_emp_shift_assignments_shift_id (shift_id),
  KEY idx_emp_shift_assignments_deleted_at (deleted_at),
  CONSTRAINT fk_emp_shift_assignments_employee_id FOREIGN KEY (employee_id) REFERENCES employees (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_emp_shift_assignments_shift_id FOREIGN KEY (shift_id) REFERENCES work_shifts (id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS holidays (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  branch_id BIGINT UNSIGNED NULL,
  holiday_date DATE NOT NULL,
  name VARCHAR(160) NOT NULL,
  is_paid TINYINT(1) NOT NULL DEFAULT 1,
  note VARCHAR(500) NULL,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  PRIMARY KEY (id),
  KEY idx_holidays_branch_date (branch_id, holiday_date),
  KEY idx_holidays_date (holiday_date),
  KEY idx_holidays_deleted_at (deleted_at),
  CONSTRAINT fk_holidays_branch_id FOREIGN KEY (branch_id) REFERENCES branches (id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS attendance_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  employee_id BIGINT UNSIGNED NOT NULL,
  work_date DATE NOT NULL,
  shift_id BIGINT UNSIGNED NULL,
  check_in_at DATETIME NULL,
  check_out_at DATETIME NULL,
  source ENUM('WEB', 'IMPORT', 'MANUAL') NOT NULL DEFAULT 'WEB',
  late_minutes INT UNSIGNED NOT NULL DEFAULT 0,
  early_leave_minutes INT UNSIGNED NOT NULL DEFAULT 0,
  worked_hours DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  status ENUM('PRESENT', 'LATE', 'ABSENT', 'LEAVE', 'HOLIDAY') NOT NULL DEFAULT 'PRESENT',
  note VARCHAR(500) NULL,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_attendance_logs_emp_date (employee_id, work_date),
  KEY idx_attendance_logs_work_date (work_date),
  KEY idx_attendance_logs_shift_id (shift_id),
  KEY idx_attendance_logs_status (status),
  KEY idx_attendance_logs_source (source),
  KEY idx_attendance_logs_deleted_at (deleted_at),
  CONSTRAINT fk_attendance_logs_employee_id FOREIGN KEY (employee_id) REFERENCES employees (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_attendance_logs_shift_id FOREIGN KEY (shift_id) REFERENCES work_shifts (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- DOWN
DROP TABLE IF EXISTS attendance_logs;
DROP TABLE IF EXISTS holidays;
DROP TABLE IF EXISTS employee_shift_assignments;
DROP TABLE IF EXISTS work_shifts;
