## 4. 数据库设计

### 4.1 设计原则

1. **主键策略**：统一使用BIGINT自增主键（与GoFly gform保持一致）
2. **外键关系**：所有业务表通过user_id关联用户表
3. **时间规范**：统一使用TIMESTAMP，默认CURRENT_TIMESTAMP
4. **软删除**：重要业务表支持deleted_at字段
5. **索引策略**：外键和查询条件字段创建索引

### 4.2 核心表结构

```sql
-- ====================
-- 用户相关表
-- ====================

-- 用户表
CREATE TABLE users (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(191) UNIQUE NOT NULL COMMENT '用户邮箱',
    name VARCHAR(191) COMMENT '用户昵称',
    avatar VARCHAR(500) COMMENT '头像URL',
    email_verified TINYINT DEFAULT 0 COMMENT '邮箱是否验证',
    role ENUM('USER', 'ADMIN') DEFAULT 'USER' COMMENT '用户角色',
    status ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED', 'BANNED') DEFAULT 'ACTIVE' COMMENT '用户状态',
    password_hash VARCHAR(255) COMMENT '密码哈希（仅管理员使用）',
    google_id VARCHAR(191) UNIQUE COMMENT 'Google OAuth ID',
    -- Token余额相关
    token_balance INT DEFAULT 0 COMMENT 'Token总余额',
    trial_used TINYINT DEFAULT 0 COMMENT '是否已使用试用',
    login_count INT DEFAULT 0 COMMENT '登录次数',
    last_login_at TIMESTAMP NULL COMMENT '最后登录时间',
    preferences JSON COMMENT '用户偏好设置',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    INDEX idx_email (email),
    INDEX idx_status (status),
    INDEX idx_role (role)
);

-- 用户订阅表
CREATE TABLE user_subscriptions (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL COMMENT '用户ID',
    plan_id BIGINT NOT NULL COMMENT '套餐ID',
    status ENUM('ACTIVE', 'EXPIRED', 'CANCELLED') DEFAULT 'ACTIVE' COMMENT '订阅状态',
    start_date TIMESTAMP NOT NULL COMMENT '开始时间',
    end_date TIMESTAMP NOT NULL COMMENT '结束时间',
    auto_renew TINYINT DEFAULT 0 COMMENT '是否自动续费',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_status (status),
    INDEX idx_end_date (end_date)
);

-- ====================
-- 套餐相关表
-- ====================

-- 套餐表
CREATE TABLE plans (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL COMMENT '套餐名称',
    description TEXT COMMENT '套餐描述',
    price DECIMAL(10,2) DEFAULT 0.00 COMMENT '价格（人民币）',
    currency VARCHAR(3) DEFAULT 'CNY' COMMENT '币种',
    interval ENUM('MONTH', 'YEAR') DEFAULT 'MONTH' COMMENT '计费周期',
    features JSON COMMENT '功能特性',
    is_active TINYINT DEFAULT 1 COMMENT '是否启用',
    sort_order INT DEFAULT 0 COMMENT '排序',
    token_quota INT DEFAULT 0 COMMENT 'Token配额',
    rate_limit INT DEFAULT 100 COMMENT 'API调用频率限制/小时',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_active (is_active),
    INDEX idx_sort (sort_order)
);

-- 套餐能力配置表
CREATE TABLE plan_capabilities (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    plan_id BIGINT NOT NULL COMMENT '套餐ID',
    feature_code VARCHAR(50) NOT NULL COMMENT '功能代码',
    capability_value VARCHAR(255) COMMENT '能力值',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE,
    UNIQUE KEY uk_plan_feature (plan_id, feature_code)
);

-- ====================
-- Token相关表
-- ====================

-- Token交易记录表
CREATE TABLE token_transactions (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL COMMENT '用户ID',
    type ENUM('CONSUME', 'RECHARGE', 'REWARD', 'EXPIRE') NOT NULL COMMENT '交易类型',
    amount INT NOT NULL COMMENT '数量',
    balance_before INT NOT NULL COMMENT '交易前余额',
    balance_after INT NOT NULL COMMENT '交易后余额',
    source VARCHAR(50) COMMENT '来源',
    description TEXT COMMENT '描述',
    reference_id VARCHAR(191) COMMENT '关联ID',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_type (type),
    INDEX idx_created_at (created_at)
);

-- Token使用记录表
CREATE TABLE token_usage_logs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL COMMENT '用户ID',
    feature_code VARCHAR(50) NOT NULL COMMENT '功能代码',
    tokens_consumed INT NOT NULL COMMENT '消耗Token数',
    item_count INT DEFAULT 0 COMMENT '处理项目数',
    metadata JSON COMMENT '元数据',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_feature (user_id, feature_code),
    INDEX idx_created_at (created_at)
);

-- ====================
-- 业务功能表
-- ====================

-- BatchGo任务表
CREATE TABLE batchgo_tasks (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL COMMENT '用户ID',
    name VARCHAR(255) NOT NULL COMMENT '任务名称',
    mode ENUM('basic', 'silent', 'automated') NOT NULL COMMENT '执行模式',
    access_mode ENUM('http', 'puppeteer') DEFAULT 'http' COMMENT '访问模式',
    status ENUM('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED') DEFAULT 'PENDING',
    total_urls INT DEFAULT 0 COMMENT 'URL总数',
    success_urls INT DEFAULT 0 COMMENT '成功数',
    failed_urls INT DEFAULT 0 COMMENT '失败数',
    config JSON COMMENT '任务配置',
    result JSON COMMENT '执行结果',
    start_time TIMESTAMP NULL COMMENT '开始时间',
    end_time TIMESTAMP NULL COMMENT '结束时间',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_status (user_id, status),
    INDEX idx_created_at (created_at)
);

-- BatchGo任务URL表
CREATE TABLE batchgo_task_urls (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    task_id BIGINT NOT NULL COMMENT '任务ID',
    url TEXT NOT NULL COMMENT 'URL地址',
    status ENUM('PENDING', 'SUCCESS', 'FAILED', 'SKIPPED') DEFAULT 'PENDING',
    response_time INT COMMENT '响应时间(ms)',
    error_message TEXT COMMENT '错误信息',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES batchgo_tasks(id) ON DELETE CASCADE,
    INDEX idx_task_status (task_id, status)
);

-- SiteRankGo查询记录表
CREATE TABLE siterank_queries (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL COMMENT '用户ID',
    domain VARCHAR(255) NOT NULL COMMENT '查询域名',
    query_data JSON COMMENT '查询参数',
    result_data JSON COMMENT '查询结果',
    cache_hit TINYINT DEFAULT 0 COMMENT '是否命中缓存',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_domain (user_id, domain),
    INDEX idx_created_at (created_at)
);

-- AdsCenterGo账号表
CREATE TABLE adscenter_accounts (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL COMMENT '用户ID',
    platform VARCHAR(50) NOT NULL COMMENT '平台（google_ads, adspower等）',
    account_name VARCHAR(255) NOT NULL COMMENT '账号名称',
    account_id VARCHAR(191) COMMENT '平台账号ID',
    credentials JSON COMMENT '认证信息',
    status ENUM('ACTIVE', 'INACTIVE', 'ERROR') DEFAULT 'ACTIVE',
    last_sync_at TIMESTAMP NULL COMMENT '最后同步时间',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_platform (user_id, platform),
    INDEX idx_status (status)
);

-- AdsCenterGo任务表
CREATE TABLE adscenter_tasks (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL COMMENT '用户ID',
    account_id BIGINT NOT NULL COMMENT '账号ID',
    task_type VARCHAR(50) NOT NULL COMMENT '任务类型',
    config JSON NOT NULL COMMENT '任务配置',
    status ENUM('PENDING', 'RUNNING', 'COMPLETED', 'FAILED') DEFAULT 'PENDING',
    result JSON COMMENT '执行结果',
    error_message TEXT COMMENT '错误信息',
    scheduled_at TIMESTAMP NULL COMMENT '计划执行时间',
    started_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (account_id) REFERENCES adscenter_accounts(id) ON DELETE CASCADE,
    INDEX idx_user_status (user_id, status),
    INDEX idx_scheduled_at (scheduled_at)
);

-- ====================
-- 系统管理表
-- ====================

-- 管理员账号表
CREATE TABLE admin_accounts (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL COMMENT '管理员用户名',
    password_hash VARCHAR(255) NOT NULL COMMENT '密码哈希',
    name VARCHAR(100) COMMENT '姓名',
    email VARCHAR(191) COMMENT '邮箱',
    role ENUM('SUPER_ADMIN', 'ADMIN') DEFAULT 'ADMIN' COMMENT '管理员角色',
    status ENUM('ACTIVE', 'INACTIVE') DEFAULT 'ACTIVE' COMMENT '状态',
    last_login_at TIMESTAMP NULL COMMENT '最后登录时间',
    last_login_ip VARCHAR(45) COMMENT '最后登录IP',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_username (username),
    INDEX idx_status (status)
);

-- 管理员登录日志表
CREATE TABLE admin_login_logs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    admin_id BIGINT NOT NULL COMMENT '管理员ID',
    login_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '登录时间',
    login_ip VARCHAR(45) COMMENT '登录IP',
    user_agent TEXT COMMENT '用户代理',
    status ENUM('SUCCESS', 'FAILED') DEFAULT 'SUCCESS' COMMENT '登录状态',
    error_message TEXT COMMENT '错误信息',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (admin_id) REFERENCES admin_accounts(id) ON DELETE CASCADE,
    INDEX idx_admin_id (admin_id),
    INDEX idx_login_time (login_time)
);

-- 系统配置表
CREATE TABLE system_configs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    config_key VARCHAR(100) UNIQUE NOT NULL COMMENT '配置键',
    config_value TEXT COMMENT '配置值',
    description TEXT COMMENT '描述',
    is_system TINYINT DEFAULT 0 COMMENT '是否系统配置',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_key (config_key)
);

-- API限速配置表
CREATE TABLE api_rate_limits (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    api_path VARCHAR(100) NOT NULL COMMENT 'API路径',
    plan_id BIGINT NOT NULL COMMENT '套餐ID',
    requests_per_minute INT DEFAULT 60 COMMENT '每分钟限制',
    requests_per_hour INT DEFAULT 3600 COMMENT '每小时限制',
    requests_per_day INT DEFAULT 86400 COMMENT '每天限制',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE,
    UNIQUE KEY uk_api_plan (api_path, plan_id)
);

-- ====================
-- 用户运营表
-- ====================

-- 邀请码表
CREATE TABLE invitation_codes (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    inviter_id BIGINT NOT NULL COMMENT '邀请者ID',
    code VARCHAR(32) UNIQUE NOT NULL COMMENT '邀请码',
    status ENUM('AVAILABLE', 'USED', 'EXPIRED') DEFAULT 'AVAILABLE' COMMENT '状态',
    invited_id BIGINT COMMENT '被邀请者ID',
    invited_email VARCHAR(191) COMMENT '被邀请邮箱',
    reward_days INT DEFAULT 30 COMMENT '奖励天数',
    expires_at TIMESTAMP NULL COMMENT '过期时间',
    used_at TIMESTAMP NULL COMMENT '使用时间',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (inviter_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (invited_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_code (code),
    INDEX idx_inviter_id (inviter_id),
    INDEX idx_status (status)
);

-- 签到记录表
CREATE TABLE check_in_records (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL COMMENT '用户ID',
    check_in_date DATE NOT NULL COMMENT '签到日期',
    tokens_rewarded INT DEFAULT 0 COMMENT '奖励Token数',
    streak_days INT DEFAULT 1 COMMENT '连续签到天数',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY uk_user_date (user_id, check_in_date),
    INDEX idx_check_in_date (check_in_date)
);

-- 通知表
CREATE TABLE notifications (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NULL COMMENT '用户ID（NULL为系统通知）',
    type ENUM('INFO', 'WARNING', 'ERROR', 'SUCCESS') DEFAULT 'INFO' COMMENT '通知类型',
    title VARCHAR(255) NOT NULL COMMENT '标题',
    content TEXT COMMENT '内容',
    is_read TINYINT DEFAULT 0 COMMENT '是否已读',
    read_at TIMESTAMP NULL COMMENT '阅读时间',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_read (user_id, is_read),
    INDEX idx_created_at (created_at)
);

-- ====================
-- 外部集成表
-- ====================

-- API密钥管理表
CREATE TABLE api_keys (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    service_name VARCHAR(50) NOT NULL COMMENT '服务名称',
    key_type ENUM('PUBLIC', 'SECRET') DEFAULT 'PUBLIC' COMMENT '密钥类型',
    encrypted_key TEXT NOT NULL COMMENT '加密后的密钥',
    is_active TINYINT DEFAULT 1 COMMENT '是否启用',
    last_used_at TIMESTAMP NULL COMMENT '最后使用时间',
    usage_count INT DEFAULT 0 COMMENT '使用次数',
    rate_limit_remaining INT DEFAULT 0 COMMENT '剩余限制',
    reset_at TIMESTAMP NULL COMMENT '重置时间',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_service_active (service_name, is_active),
    INDEX idx_last_used (last_used_at)
);

-- 代理配置表
CREATE TABLE proxy_configs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    provider VARCHAR(50) NOT NULL COMMENT '提供商',
    proxy_type ENUM('HTTP', 'HTTPS', 'SOCKS5') NOT NULL COMMENT '代理类型',
    host VARCHAR(255) NOT NULL COMMENT '主机',
    port INT NOT NULL COMMENT '端口',
    username VARCHAR(191) COMMENT '用户名',
    password_encrypted TEXT COMMENT '加密密码',
    country VARCHAR(50) COMMENT '国家',
    city VARCHAR(50) COMMENT '城市',
    status ENUM('ACTIVE', 'INACTIVE', 'ERROR') DEFAULT 'ACTIVE' COMMENT '状态',
    last_checked_at TIMESTAMP NULL COMMENT '最后检查时间',
    response_time INT COMMENT '响应时间(ms)',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_status_type (status, proxy_type),
    INDEX idx_provider (provider)
);
```

### 4.3 初始数据

```sql
-- 初始化管理员账号
INSERT INTO admin_accounts (username, password_hash, name, role) VALUES 
('admin', '$2a$10$N9qo8uLOickgx2ZMRZoMy.MwrGMjCVfLqJdO8kEZfGhBkL8JpYvqO', '系统管理员', 'SUPER_ADMIN');

-- 初始化套餐
INSERT INTO plans (name, description, price, interval, token_quota, rate_limit, sort_order) VALUES
('免费套餐', '基础功能体验', 0.00, 'MONTH', 1000, 100, 1),
('专业套餐', '适合个人开发者和小团队', 298.00, 'MONTH', 10000, 1000, 2),
('白金套餐', '适合企业和大型团队', 998.00, 'MONTH', 100000, 10000, 3);

-- 初始化套餐能力配置
-- Free套餐
INSERT INTO plan_capabilities (plan_id, feature_code, capability_value) VALUES
(1, 'batchgo_basic_urls', '10'),
(1, 'batchgo_silent_urls', '10'),
(1, 'batchgo_concurrent_basic', '1'),
(1, 'batchgo_concurrent_silent', '5'),
(1, 'siterank_batch_limit', '100'),
(1, 'api_calls_per_hour', '100');

-- Pro套餐
INSERT INTO plan_capabilities (plan_id, feature_code, capability_value) VALUES
(2, 'batchgo_basic_urls', '100'),
(2, 'batchgo_silent_urls', '100'),
(2, 'batchgo_automated_urls', '100'),
(2, 'batchgo_concurrent_basic', '1'),
(2, 'batchgo_concurrent_silent', '5'),
(2, 'batchgo_concurrent_automated', '50'),
(2, 'siterank_batch_limit', '500'),
(2, 'adscenter_accounts', '10'),
(2, 'api_calls_per_hour', '1000');

-- Max套餐
INSERT INTO plan_capabilities (plan_id, feature_code, capability_value) VALUES
(3, 'batchgo_basic_urls', '1000'),
(3, 'batchgo_silent_urls', '1000'),
(3, 'batchgo_automated_urls', '1000'),
(3, 'batchgo_concurrent_basic', '1'),
(3, 'batchgo_concurrent_silent', '5'),
(3, 'batchgo_concurrent_automated', '50'),
(3, 'siterank_batch_limit', '5000'),
(3, 'adscenter_accounts', '100'),
(3, 'api_calls_per_hour', '10000');

-- 初始化系统配置
INSERT INTO system_configs (config_key, config_value, description, is_system) VALUES
('site_rank_rate_limit', '30', 'SiteRank查询频率限制（次/分钟）', 1),
('token_reward_check_in', '10', '每日签到奖励Token数', 1),
('token_reward_invite', '30', '邀请奖励天数', 1),
('trial_days_new_user', '14', '新用户试用天数', 1),
('max_upload_size', '10485760', '最大上传文件大小（字节）', 1);
```