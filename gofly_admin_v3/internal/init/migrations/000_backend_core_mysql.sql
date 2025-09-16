-- AutoAds Backend Core Schema (MySQL)
-- Clean baseline for admin-only backend tables.

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
    chengelink_enabled BOOLEAN DEFAULT FALSE,
    
    max_batch_size INT DEFAULT 10,
    max_concurrency INT DEFAULT 3,
    max_siterank_queries INT DEFAULT 100,
    max_chengelink_tasks INT DEFAULT 0,
    
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

-- Seed defaults (safe idempotent inserts)
INSERT IGNORE INTO admin_users (username, email, password, role)
VALUES
('admin', 'admin@autoads.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'super_admin'),
('manager', 'manager@autoads.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin');

INSERT IGNORE INTO plan_configs (name, display_name, description, price, duration, batchgo_enabled, siterank_enabled, chengelink_enabled, max_batch_size, max_concurrency, max_siterank_queries, max_chengelink_tasks, initial_tokens, daily_tokens)
VALUES
('free', '免费版', '基础功能，适合个人用户试用', 0.00, 30, TRUE, TRUE, FALSE, 5, 1, 50, 0, 50, 5),
('basic', '基础版', '标准功能，适合小型团队', 29.99, 30, TRUE, TRUE, FALSE, 10, 2, 100, 0, 100, 10),
('pro', '专业版', '全功能版本，适合专业用户', 99.99, 30, TRUE, TRUE, TRUE, 50, 5, 500, 10, 500, 50),
('enterprise', '企业版', '企业级功能，无限制使用', 299.99, 30, TRUE, TRUE, TRUE, 200, 10, 2000, 50, 2000, 200);

INSERT IGNORE INTO token_packages (name, token_amount, price, bonus_tokens, description, sort_order)
VALUES
('小包装', 100, 9.99, 10, '100 Token + 10 赠送Token', 1),
('标准包', 500, 39.99, 100, '500 Token + 100 赠送Token', 2),
('大包装', 1000, 69.99, 300, '1000 Token + 300 赠送Token', 3),
('超值包', 2000, 119.99, 800, '2000 Token + 800 赠送Token', 4),
('企业包', 5000, 249.99, 2500, '5000 Token + 2500 赠送Token', 5);

INSERT IGNORE INTO token_consumption_rules (service, action, token_cost, description)
VALUES
('batchgo', 'basic_task', 1, 'BatchGo基础任务每个URL消费1个Token'),
('batchgo', 'advanced_task', 2, 'BatchGo高级任务每个URL消费2个Token'),
('siterank', 'query', 1, 'SiteRank查询每个域名消费1个Token'),
('chengelink', 'extract_link', 1, '链接提取每个链接消费1个Token'),
('chengelink', 'update_ad', 3, '广告更新每个广告消费3个Token'),
('invitation', 'reward', 50, '邀请成功奖励50个Token'),
('checkin', 'daily', 10, '每日签到奖励10个Token');

