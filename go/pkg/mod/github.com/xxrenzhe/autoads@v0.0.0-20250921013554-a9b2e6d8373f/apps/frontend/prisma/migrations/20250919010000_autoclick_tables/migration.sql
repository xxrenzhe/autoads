-- Migrated from gofly_admin_v3/internal/init/migrations/070_autoclick_tables.sql

CREATE TABLE IF NOT EXISTS autoclick_schedules (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  urls JSON NOT NULL,
  timezone VARCHAR(32) NOT NULL,
  time_window VARCHAR(16) NOT NULL,
  daily_target INT NOT NULL,
  referer_type VARCHAR(32) DEFAULT '',
  referer_value VARCHAR(255) DEFAULT '',
  proxy_url VARCHAR(512) NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'DISABLED',
  last_run_at DATETIME NULL,
  next_run_at DATETIME NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  INDEX idx_autoclick_schedules_user (user_id),
  INDEX idx_autoclick_schedules_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS autoclick_daily_plans (
  id VARCHAR(36) PRIMARY KEY,
  schedule_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  date CHAR(10) NOT NULL,
  distribution JSON NOT NULL,
  variance DOUBLE NOT NULL DEFAULT 0.3,
  weight_profile VARCHAR(32) NOT NULL DEFAULT 'default',
  created_at DATETIME NOT NULL,
  UNIQUE KEY uniq_schedule_date (schedule_id, date),
  INDEX idx_autoclick_plans_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS autoclick_executions (
  id VARCHAR(36) PRIMARY KEY,
  schedule_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  date CHAR(10) NOT NULL,
  status VARCHAR(16) NOT NULL,
  message TEXT,
  progress INT NOT NULL DEFAULT 0,
  success INT NOT NULL DEFAULT 0,
  fail INT NOT NULL DEFAULT 0,
  total INT NOT NULL DEFAULT 0,
  started_at DATETIME NULL,
  completed_at DATETIME NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  INDEX idx_autoclick_exec_user (user_id),
  INDEX idx_autoclick_exec_schedule (schedule_id),
  INDEX idx_autoclick_exec_date (date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS autoclick_execution_snapshots (
  id VARCHAR(36) PRIMARY KEY,
  execution_id VARCHAR(36) NOT NULL,
  hour INT NOT NULL,
  success INT NOT NULL DEFAULT 0,
  fail INT NOT NULL DEFAULT 0,
  total INT NOT NULL DEFAULT 0,
  failed_urls JSON,
  created_at DATETIME NOT NULL,
  INDEX idx_autoclick_snapshot_exec (execution_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS autoclick_url_failures (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  url_hash VARCHAR(64) NOT NULL,
  url TEXT NOT NULL,
  http_fail_consecutive INT NOT NULL DEFAULT 0,
  browser_fail_consecutive INT NOT NULL DEFAULT 0,
  last_fail_at DATETIME NULL,
  prefer_browser_until DATETIME NULL,
  notes TEXT,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  INDEX idx_autoclick_fail_user (user_id),
  INDEX idx_autoclick_fail_hash (url_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
