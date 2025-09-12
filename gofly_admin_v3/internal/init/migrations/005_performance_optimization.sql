-- 性能优化和安全加固相关表结构

-- 审计事件表
CREATE TABLE IF NOT EXISTS audit_events (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id VARCHAR(36) NOT NULL,
    action VARCHAR(100) NOT NULL,
    resource VARCHAR(100) NOT NULL,
    resource_id VARCHAR(100),
    details TEXT,
    ip_address VARCHAR(45),
    user_agent TEXT,
    success BOOLEAN NOT NULL DEFAULT TRUE,
    error_message TEXT,
    duration BIGINT, -- 毫秒
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_audit_user_id (user_id),
    INDEX idx_audit_action (action),
    INDEX idx_audit_resource (resource),
    INDEX idx_audit_success (success),
    INDEX idx_audit_created_at (created_at),
    INDEX idx_audit_user_action (user_id, action),
    INDEX idx_audit_resource_action (resource, action)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 安全事件表
CREATE TABLE IF NOT EXISTS security_events (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    event_type VARCHAR(100) NOT NULL,
    user_id VARCHAR(36),
    ip_address VARCHAR(45) NOT NULL,
    user_agent TEXT,
    details TEXT,
    severity ENUM('low', 'medium', 'high', 'critical') NOT NULL DEFAULT 'medium',
    resolved BOOLEAN NOT NULL DEFAULT FALSE,
    resolved_at TIMESTAMP NULL,
    resolved_by VARCHAR(36),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_security_event_type (event_type),
    INDEX idx_security_user_id (user_id),
    INDEX idx_security_ip_address (ip_address),
    INDEX idx_security_severity (severity),
    INDEX idx_security_resolved (resolved),
    INDEX idx_security_created_at (created_at),
    INDEX idx_security_unresolved (resolved, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 为现有表添加性能优化索引

-- 用户表索引优化
ALTER TABLE users 
ADD INDEX IF NOT EXISTS idx_users_email (email),
ADD INDEX IF NOT EXISTS idx_users_google_id (google_id),
ADD INDEX IF NOT EXISTS idx_users_plan (plan),
ADD INDEX IF NOT EXISTS idx_users_plan_expires (plan_expires_at),
ADD INDEX IF NOT EXISTS idx_users_last_login (last_login_at),
ADD INDEX IF NOT EXISTS idx_users_created_at (created_at),
ADD INDEX IF NOT EXISTS idx_users_active_plan (plan, plan_expires_at);

-- Token交易表索引优化
ALTER TABLE token_transactions 
ADD INDEX IF NOT EXISTS idx_token_user_type (user_id, type),
ADD INDEX IF NOT EXISTS idx_token_created_at (created_at),
ADD INDEX IF NOT EXISTS idx_token_user_created (user_id, created_at),
ADD INDEX IF NOT EXISTS idx_token_type_created (type, created_at);

-- 批量任务表索引优化
ALTER TABLE batch_tasks 
ADD INDEX IF NOT EXISTS idx_batch_user_status (user_id, status),
ADD INDEX IF NOT EXISTS idx_batch_status_created (status, created_at),
ADD INDEX IF NOT EXISTS idx_batch_task_type (task_type),
ADD INDEX IF NOT EXISTS idx_batch_created_at (created_at),
ADD INDEX IF NOT EXISTS idx_batch_user_created (user_id, created_at);

-- 网站排名查询表索引优化
ALTER TABLE siterank_queries 
ADD INDEX IF NOT EXISTS idx_siterank_user_domain (user_id, domain),
ADD INDEX IF NOT EXISTS idx_siterank_status_created (status, created_at),
ADD INDEX IF NOT EXISTS idx_siterank_cache_until (cache_until),
ADD INDEX IF NOT EXISTS idx_siterank_priority (priority),
ADD INDEX IF NOT EXISTS idx_siterank_user_created (user_id, created_at);

-- Chengelink任务表索引优化
ALTER TABLE chengelink_tasks 
ADD INDEX IF NOT EXISTS idx_chengelink_user_status (user_id, status),
ADD INDEX IF NOT EXISTS idx_chengelink_status_created (status, created_at),
ADD INDEX IF NOT EXISTS idx_chengelink_created_at (created_at),
ADD INDEX IF NOT EXISTS idx_chengelink_user_created (user_id, created_at);

-- 邀请表索引优化
ALTER TABLE invitations 
ADD INDEX IF NOT EXISTS idx_invitations_inviter (inviter_id),
ADD INDEX IF NOT EXISTS idx_invitations_invitee (invitee_id),
ADD INDEX IF NOT EXISTS idx_invitations_code (invite_code),
ADD INDEX IF NOT EXISTS idx_invitations_created (created_at);

-- 签到记录表索引优化
ALTER TABLE checkin_records 
ADD INDEX IF NOT EXISTS idx_checkin_user_date (user_id, checkin_date),
ADD INDEX IF NOT EXISTS idx_checkin_date (checkin_date),
ADD INDEX IF NOT EXISTS idx_checkin_created (created_at);

-- 添加数据库级别的性能优化配置注释
-- 建议的MySQL配置优化：
-- innodb_buffer_pool_size = 70% of RAM
-- innodb_log_file_size = 256M
-- innodb_flush_log_at_trx_commit = 2
-- query_cache_size = 64M
-- max_connections = 500
-- slow_query_log = ON
-- long_query_time = 2

-- 创建分区表（如果数据量大的话）
-- 审计事件表按月分区
-- ALTER TABLE audit_events PARTITION BY RANGE (YEAR(created_at) * 100 + MONTH(created_at)) (
--     PARTITION p202501 VALUES LESS THAN (202502),
--     PARTITION p202502 VALUES LESS THAN (202503),
--     -- 继续添加更多分区...
--     PARTITION p_future VALUES LESS THAN MAXVALUE
-- );

-- 创建视图用于常用查询
CREATE OR REPLACE VIEW user_stats AS
SELECT 
    u.id,
    u.email,
    u.plan,
    u.plan_expires_at,
    u.token_balance,
    u.created_at,
    u.last_login_at,
    COALESCE(tt.total_consumed, 0) as total_tokens_consumed,
    COALESCE(bt.total_tasks, 0) as total_tasks,
    COALESCE(sr.total_queries, 0) as total_siterank_queries,
    COALESCE(cl.total_chengelink_tasks, 0) as total_chengelink_tasks
FROM users u
LEFT JOIN (
    SELECT user_id, SUM(ABS(amount)) as total_consumed
    FROM token_transactions 
    WHERE type = 'consume'
    GROUP BY user_id
) tt ON u.id = tt.user_id
LEFT JOIN (
    SELECT user_id, COUNT(*) as total_tasks
    FROM batch_tasks
    GROUP BY user_id
) bt ON u.id = bt.user_id
LEFT JOIN (
    SELECT user_id, COUNT(*) as total_queries
    FROM siterank_queries
    GROUP BY user_id
) sr ON u.id = sr.user_id
LEFT JOIN (
    SELECT user_id, COUNT(*) as total_chengelink_tasks
    FROM chengelink_tasks
    GROUP BY user_id
) cl ON u.id = cl.user_id;

-- 创建活跃用户视图
CREATE OR REPLACE VIEW active_users AS
SELECT 
    u.*,
    CASE 
        WHEN u.last_login_at > DATE_SUB(NOW(), INTERVAL 1 HOUR) THEN 'active_1h'
        WHEN u.last_login_at > DATE_SUB(NOW(), INTERVAL 24 HOUR) THEN 'active_24h'
        WHEN u.last_login_at > DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 'active_7d'
        WHEN u.last_login_at > DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 'active_30d'
        ELSE 'inactive'
    END as activity_level
FROM users u
WHERE u.last_login_at IS NOT NULL;

-- 创建任务统计视图
CREATE OR REPLACE VIEW task_stats AS
SELECT 
    DATE(created_at) as task_date,
    task_type,
    status,
    COUNT(*) as task_count,
    AVG(CASE WHEN status = 'completed' AND completed_at IS NOT NULL 
        THEN TIMESTAMPDIFF(SECOND, created_at, completed_at) 
        ELSE NULL END) as avg_execution_time
FROM batch_tasks
WHERE created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
GROUP BY DATE(created_at), task_type, status;

-- 创建Token消费统计视图
CREATE OR REPLACE VIEW token_consumption_stats AS
SELECT 
    DATE(created_at) as consumption_date,
    type,
    description,
    COUNT(*) as transaction_count,
    SUM(ABS(amount)) as total_amount,
    AVG(ABS(amount)) as avg_amount
FROM token_transactions
WHERE created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
GROUP BY DATE(created_at), type, description;