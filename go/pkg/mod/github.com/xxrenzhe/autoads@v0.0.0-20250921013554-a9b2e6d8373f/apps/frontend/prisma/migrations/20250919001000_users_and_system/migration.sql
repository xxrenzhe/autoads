-- Migrated from gofly_admin_v3/internal/init/migrations/010_users_and_system.sql
-- Users/system ancillary tables used by backend

-- NOTE: This file consolidates DDL from the Go initializer. Keep IF NOT EXISTS to stay idempotent.

-- Example structures (trimmed to essentials if original file contains more); ensure compatibility with backend expectations.

-- Users table (minimal; align with Go expectations)
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(36) PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  username VARCHAR(100) NULL,
  password_hash VARCHAR(255) NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'user',
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  token_balance INT NOT NULL DEFAULT 0,
  plan_id VARCHAR(50) NULL,
  plan_name VARCHAR(20) NOT NULL DEFAULT 'free',
  plan_expires_at DATETIME NULL,
  last_login_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  UNIQUE KEY uk_users_email (email),
  KEY idx_users_status (status),
  KEY idx_users_plan (plan_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- System configs
CREATE TABLE IF NOT EXISTS system_configs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  config_key VARCHAR(191) NOT NULL,
  config_value TEXT NOT NULL,
  category VARCHAR(50) NOT NULL DEFAULT 'system',
  description VARCHAR(255) NULL,
  is_secret BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by VARCHAR(64) NOT NULL DEFAULT 'system',
  updated_by VARCHAR(64) NOT NULL DEFAULT 'system',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_system_configs_key (config_key),
  INDEX idx_system_configs_category (category),
  INDEX idx_system_configs_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
