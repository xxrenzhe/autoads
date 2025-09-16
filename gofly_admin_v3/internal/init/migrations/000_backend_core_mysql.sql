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

INSERT IGNORE INTO plan_configs (name, display_name, description, price, duration, batchgo_enabled, siterank_enabled, adscenter_enabled, max_batch_size, max_concurrency, max_siterank_queries, max_adscenter_accounts, initial_tokens, daily_tokens)
VALUES
('free', '免费套餐（Free）', '“真实点击”功能（初级/静默）；“网站排名”批量查询上限100个/次；包含1,000 tokens', 0.00, 30, TRUE, TRUE, FALSE, 10, 1, 100, 0, 1000, 0),
('pro', '高级套餐（Pro）', '支持免费套餐全部功能；“真实点击”新增自动化版本；“网站排名”上限500个/次；“自动化广告”支持管理至多10个ads账号；包含10,000 tokens', 298.00, 30, TRUE, TRUE, TRUE, 50, 3, 500, 10, 10000, 0),
('max', '白金套餐（Max）', '支持高级套餐全部功能；“网站排名”上限5000个/次；“自动化广告”支持管理至多100个ads账号；包含100,000 tokens', 998.00, 30, TRUE, TRUE, TRUE, 200, 10, 5000, 100, 100000, 0);

INSERT IGNORE INTO token_packages (name, token_amount, price, bonus_tokens, description, sort_order)
VALUES
('小包', 10000, 99.00, 0, '¥99 = 10,000 tokens', 1),
('中包', 50000, 299.00, 0, '¥299 = 50,000 tokens', 2),
('大包', 200000, 599.00, 0, '¥599 = 200,000 tokens', 3),
('超大包', 500000, 999.00, 0, '¥999 = 500,000 tokens', 4);

INSERT IGNORE INTO token_consumption_rules (service, action, token_cost, description)
VALUES
('batchgo', 'basic_task', 1, 'BatchGo基础任务每个URL消费1个Token'),
('batchgo', 'advanced_task', 2, 'BatchGo高级任务每个URL消费2个Token'),
('siterank', 'query', 1, 'SiteRank查询每个域名消费1个Token'),
('adscenter', 'extract_link', 1, '自动化广告：链接提取消费1个Token'),
('adscenter', 'update_ad', 3, '自动化广告：广告更新每个广告消费3个Token'),
-- 兼容历史服务名（chengelink），与 adscenter 等价
('chengelink', 'extract_link', 1, '兼容：chengelink 链接提取消费1个Token'),
('chengelink', 'update_ad', 3, '兼容：chengelink 广告更新每个广告消费3个Token'),
('invitation', 'reward', 50, '邀请成功奖励50个Token'),
('checkin', 'daily', 10, '每日签到奖励10个Token');
