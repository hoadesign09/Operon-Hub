-- Migration: 20261123_000012_init_hrm_assets.sql
-- Mô tả: Tạo bảng Danh mục Tài sản (assets) và Lịch sử Cấp phát / Thu hồi (asset_assignments)

-- UP
CREATE TABLE IF NOT EXISTS assets (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  branch_id BIGINT UNSIGNED NOT NULL,
  asset_code VARCHAR(50) NOT NULL,
  name VARCHAR(200) NOT NULL,
  category ENUM('LAPTOP', 'MONITOR', 'PHONE', 'FURNITURE', 'OTHER') NOT NULL DEFAULT 'OTHER',
  brand VARCHAR(100) NULL,
  model VARCHAR(100) NULL,
  serial_number VARCHAR(100) NULL,
  purchase_date DATE NULL,
  warranty_expiry_date DATE NULL,
  purchase_value DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  status ENUM('AVAILABLE', 'ASSIGNED', 'MAINTENANCE', 'RETIRED') NOT NULL DEFAULT 'AVAILABLE',
  note TEXT NULL,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_assets_asset_code (asset_code),
  KEY idx_assets_branch_id (branch_id),
  KEY idx_assets_category (category),
  KEY idx_assets_status (status),
  KEY idx_assets_serial_number (serial_number),
  KEY idx_assets_deleted_at (deleted_at),
  CONSTRAINT fk_assets_branch_id FOREIGN KEY (branch_id) REFERENCES branches(id),
  CONSTRAINT fk_assets_created_by FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT fk_assets_updated_by FOREIGN KEY (updated_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS asset_assignments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  asset_id BIGINT UNSIGNED NOT NULL,
  employee_id BIGINT UNSIGNED NOT NULL,
  assigned_by BIGINT UNSIGNED NULL,
  returned_by BIGINT UNSIGNED NULL,
  assigned_at DATETIME NOT NULL,
  expected_return_at DATE NULL,
  returned_at DATETIME NULL,
  condition_on_assign VARCHAR(300) NOT NULL,
  condition_on_return VARCHAR(300) NULL,
  status ENUM('ACTIVE', 'RETURNED') NOT NULL DEFAULT 'ACTIVE',
  note TEXT NULL,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  PRIMARY KEY (id),
  KEY idx_asset_assignments_asset_id (asset_id),
  KEY idx_asset_assignments_employee_id (employee_id),
  KEY idx_asset_assignments_status (status),
  KEY idx_asset_assignments_asset_status (asset_id, status),
  KEY idx_asset_assignments_deleted_at (deleted_at),
  CONSTRAINT fk_asset_assignments_asset_id FOREIGN KEY (asset_id) REFERENCES assets(id),
  CONSTRAINT fk_asset_assignments_employee_id FOREIGN KEY (employee_id) REFERENCES employees(id),
  CONSTRAINT fk_asset_assignments_assigned_by FOREIGN KEY (assigned_by) REFERENCES users(id),
  CONSTRAINT fk_asset_assignments_returned_by FOREIGN KEY (returned_by) REFERENCES users(id),
  CONSTRAINT fk_asset_assignments_created_by FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT fk_asset_assignments_updated_by FOREIGN KEY (updated_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- DOWN
DROP TABLE IF EXISTS asset_assignments;
DROP TABLE IF EXISTS assets;
