-- Batch processing minimal tables

CREATE TABLE IF NOT EXISTS batch_jobs (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  type VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL,
  options JSON,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  INDEX idx_batch_jobs_user (user_id),
  INDEX idx_batch_jobs_status (status),
  INDEX idx_batch_jobs_type (type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS batch_job_items (
  id VARCHAR(36) PRIMARY KEY,
  job_id VARCHAR(36) NOT NULL,
  url TEXT NOT NULL,
  status VARCHAR(20) NOT NULL,
  result JSON,
  retries INT NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  INDEX idx_batch_job_items_job (job_id),
  INDEX idx_batch_job_items_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS batch_job_progress (
  job_id VARCHAR(36) PRIMARY KEY,
  total INT NOT NULL DEFAULT 0,
  success INT NOT NULL DEFAULT 0,
  fail INT NOT NULL DEFAULT 0,
  running INT NOT NULL DEFAULT 0,
  started_at DATETIME NULL,
  finished_at DATETIME NULL,
  updated_at DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

