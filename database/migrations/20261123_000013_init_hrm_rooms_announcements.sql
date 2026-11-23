-- UP
CREATE TABLE IF NOT EXISTS meeting_rooms (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  branch_id BIGINT UNSIGNED NOT NULL,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(150) NOT NULL,
  floor VARCHAR(50) NULL,
  capacity INT UNSIGNED NOT NULL DEFAULT 6,
  equipment_json JSON NULL,
  description TEXT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_meeting_rooms_code (code),
  KEY idx_meeting_rooms_branch_id (branch_id),
  KEY idx_meeting_rooms_is_active (is_active),
  KEY idx_meeting_rooms_deleted_at (deleted_at),
  CONSTRAINT fk_meeting_rooms_branch_id FOREIGN KEY (branch_id) REFERENCES branches (id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS room_bookings (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  room_id BIGINT UNSIGNED NOT NULL,
  booked_by_employee_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(200) NOT NULL,
  start_time DATETIME NOT NULL,
  end_time DATETIME NOT NULL,
  attendees_count INT UNSIGNED NOT NULL DEFAULT 2,
  status ENUM('CONFIRMED', 'CANCELLED') NOT NULL DEFAULT 'CONFIRMED',
  cancel_reason VARCHAR(500) NULL,
  cancelled_by BIGINT UNSIGNED NULL,
  cancelled_at DATETIME NULL,
  note TEXT NULL,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  PRIMARY KEY (id),
  KEY idx_room_bookings_room_schedule (room_id, status, start_time, end_time),
  KEY idx_room_bookings_booked_by_employee_id (booked_by_employee_id),
  KEY idx_room_bookings_start_time (start_time),
  KEY idx_room_bookings_deleted_at (deleted_at),
  CONSTRAINT fk_room_bookings_room_id FOREIGN KEY (room_id) REFERENCES meeting_rooms (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_room_bookings_booked_by_employee_id FOREIGN KEY (booked_by_employee_id) REFERENCES employees (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_room_bookings_cancelled_by FOREIGN KEY (cancelled_by) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS announcements (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  branch_id BIGINT UNSIGNED NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  category ENUM('GENERAL', 'HR_POLICY', 'EVENT', 'URGENT') NOT NULL DEFAULT 'GENERAL',
  is_pinned TINYINT(1) NOT NULL DEFAULT 0,
  published_at DATETIME NULL,
  status ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
  author_id BIGINT UNSIGNED NOT NULL,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  PRIMARY KEY (id),
  KEY idx_announcements_branch_id (branch_id),
  KEY idx_announcements_status_pin_pub (status, is_pinned, published_at),
  KEY idx_announcements_category (category),
  KEY idx_announcements_author_id (author_id),
  KEY idx_announcements_deleted_at (deleted_at),
  CONSTRAINT fk_announcements_branch_id FOREIGN KEY (branch_id) REFERENCES branches (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_announcements_author_id FOREIGN KEY (author_id) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS announcement_reads (
  announcement_id BIGINT UNSIGNED NOT NULL,
  employee_id BIGINT UNSIGNED NOT NULL,
  read_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (announcement_id, employee_id),
  KEY idx_announcement_reads_employee_id (employee_id),
  CONSTRAINT fk_announcement_reads_announcement_id FOREIGN KEY (announcement_id) REFERENCES announcements (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_announcement_reads_employee_id FOREIGN KEY (employee_id) REFERENCES employees (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- DOWN
DROP TABLE IF EXISTS announcement_reads;
DROP TABLE IF EXISTS announcements;
DROP TABLE IF EXISTS room_bookings;
DROP TABLE IF EXISTS meeting_rooms;
