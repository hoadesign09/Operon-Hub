-- UP
CREATE TABLE IF NOT EXISTS task_comments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  task_id BIGINT UNSIGNED NOT NULL,
  parent_comment_id BIGINT UNSIGNED NULL,
  author_employee_id BIGINT UNSIGNED NOT NULL,
  content TEXT NOT NULL,
  mentioned_employee_ids_json JSON NULL,
  is_resolved TINYINT(1) NOT NULL DEFAULT 0,
  edited_at DATETIME NULL,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  PRIMARY KEY (id),
  KEY idx_task_comments_task_created (task_id, created_at),
  KEY idx_task_comments_parent_comment_id (parent_comment_id),
  KEY idx_task_comments_author_employee_id (author_employee_id),
  KEY idx_task_comments_deleted_at (deleted_at),
  CONSTRAINT fk_task_comments_task_id FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_task_comments_parent_comment_id FOREIGN KEY (parent_comment_id) REFERENCES task_comments (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_task_comments_author_employee_id FOREIGN KEY (author_employee_id) REFERENCES employees (id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS task_attachments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  project_id BIGINT UNSIGNED NOT NULL,
  task_id BIGINT UNSIGNED NULL,
  uploaded_by_employee_id BIGINT UNSIGNED NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  stored_path VARCHAR(500) NOT NULL,
  mime_type VARCHAR(150) NOT NULL,
  file_size_bytes BIGINT UNSIGNED NOT NULL DEFAULT 0,
  checksum_sha256 VARCHAR(64) NULL,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  PRIMARY KEY (id),
  KEY idx_task_attachments_project_task (project_id, task_id),
  KEY idx_task_attachments_uploaded_by (uploaded_by_employee_id),
  KEY idx_task_attachments_deleted_at (deleted_at),
  CONSTRAINT fk_task_attachments_project_id FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_task_attachments_task_id FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_task_attachments_uploaded_by FOREIGN KEY (uploaded_by_employee_id) REFERENCES employees (id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS task_activities (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  project_id BIGINT UNSIGNED NOT NULL,
  task_id BIGINT UNSIGNED NULL,
  actor_user_id BIGINT UNSIGNED NOT NULL,
  action_type VARCHAR(64) NOT NULL,
  field_name VARCHAR(80) NULL,
  old_value_json JSON NULL,
  new_value_json JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_task_activities_task_created (task_id, created_at),
  KEY idx_task_activities_project_created (project_id, created_at),
  KEY idx_task_activities_actor_user_id (actor_user_id),
  CONSTRAINT fk_task_activities_project_id FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_task_activities_task_id FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_task_activities_actor_user_id FOREIGN KEY (actor_user_id) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- DOWN
DROP TABLE IF EXISTS task_activities;
DROP TABLE IF EXISTS task_attachments;
DROP TABLE IF EXISTS task_comments;
