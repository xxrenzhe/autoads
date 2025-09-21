-- Migrated from gofly_admin_v3/internal/init/migrations/000_backend_core_mysql.sql
-- Backend core admin tables (MySQL)

-- 1) Admin users
CREATE TABLE IF NOT EXISTS admin_users (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'admin',
    is_active BOOLEAN DEFAULT TRUE,
    last_login_at DATETIME,
    
    INDEX idx_username (username),
    INDEX idx_email (email),
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7) Idempotency requests (backend-only)
CREATE TABLE IF NOT EXISTS idempotency_requests (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id VARCHAR(191) NOT NULL,
  endpoint VARCHAR(255) NOT NULL,
  idem_key VARCHAR(128) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_user_endpoint_key (user_id, endpoint, idem_key),
  KEY idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2) User operation logs
CREATE TABLE IF NOT EXISTS user_operation_logs (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    admin_id BIGINT UNSIGNED NOT NULL,
    target_user_id VARCHAR(191) NOT NULL,
    operation VARCHAR(100) NOT NULL,
    details TEXT,
    ip_address VARCHAR(45),
    
    INDEX idx_admin_id (admin_id),
    INDEX idx_target_user_id (target_user_id),
    INDEX idx_operation (operation),
    INDEX idx_created_at (created_at),
    CONSTRAINT fk_user_operation_logs_admin FOREIGN KEY (admin_id) REFERENCES admin_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3) Plan configs (admin-managed)
CREATE TABLE IF NOT EXISTS plan_configs (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    name VARCHAR(50) NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) DEFAULT 0,
    duration INT DEFAULT 30 COMMENT 'days',
    
    batchgo_enabled BOOLEAN DEFAULT TRUE,
    siterank_enabled BOOLEAN DEFAULT TRUE,
    adscenter_enabled BOOLEAN DEFAULT FALSE,
    
    max_batch_size INT DEFAULT 10,
    max_concurrency INT DEFAULT 3,
    max_siterank_queries INT DEFAULT 100,
    max_adscenter_accounts INT DEFAULT 0,
    
    initial_tokens INT DEFAULT 100,
    daily_tokens INT DEFAULT 10,
    
    is_active BOOLEAN DEFAULT TRUE,
    
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4) Token packages
CREATE TABLE IF NOT EXISTS token_packages (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    name VARCHAR(100) NOT NULL,
    token_amount INT NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    bonus_tokens INT DEFAULT 0,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INT DEFAULT 0,
    
    INDEX idx_is_active (is_active),
    INDEX idx_sort_order (sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5) Token consumption rules
CREATE TABLE IF NOT EXISTS token_consumption_rules (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    service VARCHAR(50) NOT NULL,
    action VARCHAR(50) NOT NULL,
    token_cost INT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    
    UNIQUE KEY uk_service_action (service, action),
    INDEX idx_service (service),
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6) Rate limit configs
CREATE TABLE IF NOT EXISTS rate_limit_configs (
    id VARCHAR(64) PRIMARY KEY,
    plan VARCHAR(50) NOT NULL,
    feature VARCHAR(50) NOT NULL,
    per_minute INT DEFAULT 60,
    per_hour INT DEFAULT 1000,
    concurrent INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_plan (plan),
    INDEX idx_feature (feature),
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
