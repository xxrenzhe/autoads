-- AutoAds SaaS 数据库迁移
-- 创建和更新SaaS相关表结构

-- 1. 更新用户表，添加SaaS字段
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS plan_id VARCHAR(50) COMMENT '当前套餐ID',
ADD COLUMN IF NOT EXISTS plan_name VARCHAR(20) DEFAULT 'free' COMMENT '套餐名称(free/pro/max)',
ADD COLUMN IF NOT EXISTS plan_expires_at DATETIME COMMENT '套餐过期时间',
ADD COLUMN IF NOT EXISTS trial_start_at DATETIME COMMENT '试用开始时间',
ADD COLUMN IF NOT EXISTS trial_end_at DATETIME COMMENT '试用结束时间',
ADD COLUMN IF NOT EXISTS trial_source VARCHAR(50) COMMENT '试用来源',
ADD COLUMN IF NOT EXISTS trial_used BOOLEAN DEFAULT FALSE COMMENT '是否已使用过试用',
ADD COLUMN IF NOT EXISTS google_id VARCHAR(100) COMMENT 'Google用户ID',
ADD COLUMN IF NOT EXISTS google_email VARCHAR(255) COMMENT 'Google邮箱',
ADD COLUMN IF NOT EXISTS invite_code VARCHAR(20) COMMENT '邀请码',
ADD COLUMN IF NOT EXISTS invited_by VARCHAR(36) COMMENT '邀请人ID',
ADD COLUMN IF NOT EXISTS invited_at DATETIME COMMENT '被邀请时间',
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE COMMENT '邮箱是否验证',
ADD COLUMN IF NOT EXISTS last_login_at DATETIME COMMENT '最后登录时间',
ADD COLUMN IF NOT EXISTS last_login_ip VARCHAR(45) COMMENT '最后登录IP',
ADD COLUMN IF NOT EXISTS name VARCHAR(100) COMMENT '真实姓名',
ADD COLUMN IF NOT EXISTS company VARCHAR(200) COMMENT '公司名称',
ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'Asia/Shanghai' COMMENT '时区',
ADD COLUMN IF NOT EXISTS language VARCHAR(10) DEFAULT 'zh-CN' COMMENT '语言';

-- 修改现有字段类型和约束
ALTER TABLE users 
MODIFY COLUMN username VARCHAR(100),
MODIFY COLUMN password_hash VARCHAR(255),
MODIFY COLUMN avatar_url VARCHAR(500),
MODIFY COLUMN role VARCHAR(20) DEFAULT 'user',
MODIFY COLUMN status VARCHAR(20) DEFAULT 'active',
MODIFY COLUMN token_balance INT DEFAULT 0;

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
CREATE INDEX IF NOT EXISTS idx_users_invite_code ON users(invite_code);
CREATE INDEX IF NOT EXISTS idx_users_plan_name ON users(plan_name);
CREATE INDEX IF NOT EXISTS idx_users_plan_expires_at ON users(plan_expires_at);

-- 2. 创建Token交易记录表
CREATE TABLE IF NOT EXISTS token_transactions (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    amount INT NOT NULL COMMENT '正数增加，负数消费',
    balance INT NOT NULL COMMENT '变动后余额',
    type VARCHAR(20) NOT NULL COMMENT '类型:purchase,checkin,invite,consume',
    description VARCHAR(200) COMMENT '描述',
    reference VARCHAR(100) COMMENT '关联ID(任务ID等)',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_token_transactions_user_id (user_id),
    INDEX idx_token_transactions_type (type),
    INDEX idx_token_transactions_created_at (created_at),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. 创建邀请记录表
CREATE TABLE IF NOT EXISTS invitations (
    id VARCHAR(36) PRIMARY KEY,
    inviter_id VARCHAR(36) NOT NULL,
    invitee_id VARCHAR(36) NOT NULL UNIQUE,
    invite_code VARCHAR(20) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' COMMENT 'pending,completed',
    inviter_reward_given BOOLEAN DEFAULT FALSE,
    invitee_reward_given BOOLEAN DEFAULT FALSE,
    reward_days INT DEFAULT 30,
    token_reward INT DEFAULT 1000,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_invitations_inviter_id (inviter_id),
    INDEX idx_invitations_invite_code (invite_code),
    INDEX idx_invitations_status (status),
    FOREIGN KEY (inviter_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (invitee_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. 创建签到记录表
CREATE TABLE IF NOT EXISTS checkin_records (
    user_id VARCHAR(36) NOT NULL,
    checkin_date DATE NOT NULL,
    token_reward INT DEFAULT 10,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    PRIMARY KEY (user_id, checkin_date),
    INDEX idx_checkin_records_checkin_date (checkin_date),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. 更新BatchGo任务表，添加用户关联
ALTER TABLE batch_tasks 
ADD COLUMN IF NOT EXISTS user_id VARCHAR(36) NOT NULL AFTER id,
ADD INDEX IF NOT EXISTS idx_batch_tasks_user_id (user_id);

-- 6. 更新SiteRank任务表，添加用户关联
ALTER TABLE site_rank_tasks 
ADD COLUMN IF NOT EXISTS user_id VARCHAR(36) NOT NULL AFTER id,
ADD INDEX IF NOT EXISTS idx_site_rank_tasks_user_id (user_id);

-- 7. 创建SiteRank查询结果表（如果不存在）
CREATE TABLE IF NOT EXISTS siterank_queries (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    domain VARCHAR(255) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' COMMENT 'pending,running,completed,failed',
    source VARCHAR(50) DEFAULT 'similarweb' COMMENT 'similarweb',
    global_rank INT COMMENT '全球排名',
    category_rank INT COMMENT '分类排名',
    category VARCHAR(100) COMMENT '分类',
    country VARCHAR(2) COMMENT '国家代码',
    visits DECIMAL(10,2) COMMENT '访问量',
    bounce_rate DECIMAL(5,2) COMMENT '跳出率',
    pages_per_visit DECIMAL(5,2) COMMENT '每次访问页面数',
    avg_duration DECIMAL(8,2) COMMENT '平均访问时长',
    priority VARCHAR(10) COMMENT 'High,Medium,Low',
    cache_until DATETIME COMMENT '缓存过期时间',
    request_count INT DEFAULT 1 COMMENT '请求次数',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_siterank_queries_user_id (user_id),
    INDEX idx_siterank_queries_domain (domain),
    INDEX idx_siterank_queries_status (status),
    INDEX idx_siterank_queries_cache_until (cache_until),
    UNIQUE KEY uk_user_domain_source (user_id, domain, source),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. 创建Chengelink任务表（如果不存在）
CREATE TABLE IF NOT EXISTS chengelink_tasks (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' COMMENT 'pending,extracting,updating,completed,failed,cancelled',
    affiliate_links JSON COMMENT '联盟链接列表',
    adspower_profile VARCHAR(255) COMMENT 'AdsPower配置ID',
    google_ads_account VARCHAR(255) COMMENT 'Google Ads账号ID',
    extracted_links JSON COMMENT '提取的链接结果',
    update_results JSON COMMENT '广告更新结果',
    total_links INT DEFAULT 0 COMMENT '总链接数',
    extracted_count INT DEFAULT 0 COMMENT '成功提取数',
    updated_count INT DEFAULT 0 COMMENT '成功更新数',
    failed_count INT DEFAULT 0 COMMENT '失败数量',
    tokens_consumed INT DEFAULT 0 COMMENT '消费Token数',
    execution_log JSON COMMENT '执行日志',
    error_message TEXT COMMENT '错误信息',
    started_at DATETIME COMMENT '开始时间',
    completed_at DATETIME COMMENT '完成时间',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_chengelink_tasks_user_id (user_id),
    INDEX idx_chengelink_tasks_status (status),
    INDEX idx_chengelink_tasks_created_at (created_at),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. 创建AdsPower配置表
CREATE TABLE IF NOT EXISTS adspower_configs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    profile_id VARCHAR(255) NOT NULL,
    api_endpoint VARCHAR(500) NOT NULL,
    api_key VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_adspower_configs_user_id (user_id),
    INDEX idx_adspower_configs_profile_id (profile_id),
    INDEX idx_adspower_configs_is_active (is_active),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. 创建Google Ads配置表
CREATE TABLE IF NOT EXISTS google_ads_configs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    customer_id VARCHAR(50) NOT NULL,
    developer_token VARCHAR(255),
    client_id VARCHAR(255),
    client_secret VARCHAR(255),
    refresh_token TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_google_ads_configs_user_id (user_id),
    INDEX idx_google_ads_configs_customer_id (customer_id),
    INDEX idx_google_ads_configs_is_active (is_active),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;