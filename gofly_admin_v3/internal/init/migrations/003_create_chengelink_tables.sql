-- Chengelink 功能相关表

-- AdsPower 浏览器配置表
CREATE TABLE IF NOT EXISTS adspower_configs (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    user_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    profile_id VARCHAR(255) NOT NULL,
    api_endpoint VARCHAR(500) NOT NULL,
    api_key VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    
    INDEX idx_user_id (user_id),
    INDEX idx_profile_id (profile_id),
    UNIQUE KEY uk_user_profile (user_id, profile_id)
);

-- Google Ads 配置表
CREATE TABLE IF NOT EXISTS google_ads_configs (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    user_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    customer_id VARCHAR(50) NOT NULL,
    developer_token VARCHAR(255),
    client_id VARCHAR(255),
    client_secret VARCHAR(255),
    refresh_token TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    
    INDEX idx_user_id (user_id),
    INDEX idx_customer_id (customer_id),
    UNIQUE KEY uk_user_customer (user_id, customer_id)
);

-- Chengelink 任务表
CREATE TABLE IF NOT EXISTS chengelink_tasks (
    id VARCHAR(36) PRIMARY KEY,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    user_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    
    -- 配置信息
    affiliate_links JSON,
    adspower_profile VARCHAR(255),
    google_ads_account VARCHAR(255),
    
    -- 执行结果
    extracted_links JSON,
    update_results JSON,
    
    -- 统计信息
    total_links INT DEFAULT 0,
    extracted_count INT DEFAULT 0,
    updated_count INT DEFAULT 0,
    failed_count INT DEFAULT 0,
    tokens_consumed INT DEFAULT 0,
    
    -- 执行日志
    execution_log JSON,
    error_message TEXT,
    
    -- 时间信息
    started_at DATETIME,
    completed_at DATETIME,
    
    INDEX idx_user_id (user_id),
    INDEX idx_status (status),
    INDEX idx_user_status (user_id, status),
    INDEX idx_created_at (created_at)
);

-- 插入示例配置数据
INSERT IGNORE INTO adspower_configs (user_id, name, profile_id, api_endpoint, api_key, is_active) VALUES
('demo-user', '演示配置', 'demo-profile', 'http://localhost:50325', 'demo-key', TRUE),
('demo-user', '测试配置', 'test-profile', 'mock', '', TRUE);

INSERT IGNORE INTO google_ads_configs (user_id, name, customer_id, developer_token, client_id, client_secret, refresh_token, is_active) VALUES
('demo-user', '演示账号', 'demo-customer', 'demo-token', 'demo-client-id', 'demo-secret', 'demo-refresh', TRUE),
('demo-user', '测试账号', 'mock', '', '', '', '', TRUE);