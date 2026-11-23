-- UP
CREATE TABLE IF NOT EXISTS employees (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NULL,
  employee_code VARCHAR(30) NOT NULL,
  branch_id BIGINT UNSIGNED NOT NULL,
  department_id BIGINT UNSIGNED NOT NULL,
  position_id BIGINT UNSIGNED NOT NULL,
  manager_id BIGINT UNSIGNED NULL,
  full_name VARCHAR(150) NOT NULL,
  gender ENUM('MALE', 'FEMALE', 'OTHER') NULL DEFAULT NULL,
  date_of_birth DATE NULL DEFAULT NULL,
  national_id VARCHAR(30) NULL DEFAULT NULL,
  tax_code VARCHAR(30) NULL DEFAULT NULL,
  social_insurance_no VARCHAR(30) NULL DEFAULT NULL,
  phone VARCHAR(30) NULL DEFAULT NULL,
  work_email VARCHAR(191) NOT NULL,
  personal_email VARCHAR(191) NULL DEFAULT NULL,
  address VARCHAR(255) NULL DEFAULT NULL,
  bank_name VARCHAR(120) NULL DEFAULT NULL,
  bank_account_no VARCHAR(50) NULL DEFAULT NULL,
  hire_date DATE NOT NULL,
  probation_end_date DATE NULL DEFAULT NULL,
  termination_date DATE NULL DEFAULT NULL,
  employment_status ENUM('PROBATION', 'ACTIVE', 'ON_LEAVE', 'RESIGNED', 'TERMINATED') NOT NULL DEFAULT 'PROBATION',
  dependents_count TINYINT UNSIGNED NOT NULL DEFAULT 0,
  avatar_url VARCHAR(255) NULL DEFAULT NULL,
  note VARCHAR(500) NULL DEFAULT NULL,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  CONSTRAINT uq_employees_employee_code UNIQUE (employee_code),
  CONSTRAINT uq_employees_work_email UNIQUE (work_email),
  CONSTRAINT uq_employees_user_id UNIQUE (user_id),
  INDEX idx_employees_branch_id (branch_id),
  INDEX idx_employees_department_id (department_id),
  INDEX idx_employees_position_id (position_id),
  INDEX idx_employees_manager_id (manager_id),
  INDEX idx_employees_employment_status (employment_status),
  INDEX idx_employees_deleted_at (deleted_at),
  CONSTRAINT fk_employees_user_id FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT fk_employees_branch_id FOREIGN KEY (branch_id) REFERENCES branches (id) ON DELETE RESTRICT,
  CONSTRAINT fk_employees_department_id FOREIGN KEY (department_id) REFERENCES departments (id) ON DELETE RESTRICT,
  CONSTRAINT fk_employees_position_id FOREIGN KEY (position_id) REFERENCES positions (id) ON DELETE RESTRICT,
  CONSTRAINT fk_employees_manager_id FOREIGN KEY (manager_id) REFERENCES employees (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS employee_documents (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  employee_id BIGINT UNSIGNED NOT NULL,
  doc_type ENUM('ID_CARD', 'DEGREE', 'CONTRACT', 'HEALTH_CERT', 'OTHER') NOT NULL DEFAULT 'OTHER',
  title VARCHAR(200) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_url VARCHAR(500) NOT NULL,
  file_size INT UNSIGNED NOT NULL,
  mime_type VARCHAR(120) NOT NULL,
  expired_at DATE NULL DEFAULT NULL,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  INDEX idx_employee_documents_employee_id (employee_id),
  INDEX idx_employee_documents_doc_type (doc_type),
  INDEX idx_employee_documents_deleted_at (deleted_at),
  CONSTRAINT fk_employee_documents_employee_id FOREIGN KEY (employee_id) REFERENCES employees (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE departments
  ADD INDEX idx_departments_manager_employee_id (manager_employee_id),
  ADD CONSTRAINT fk_departments_manager_employee_id FOREIGN KEY (manager_employee_id) REFERENCES employees (id) ON DELETE SET NULL;

-- DOWN
ALTER TABLE departments
  DROP FOREIGN KEY fk_departments_manager_employee_id,
  DROP INDEX idx_departments_manager_employee_id;

DROP TABLE IF EXISTS employee_documents;
DROP TABLE IF EXISTS employees;
