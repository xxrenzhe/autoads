-- 创建通知表
CREATE TABLE notifications (
    id VARCHAR(191) PRIMARY KEY DEFAULT (GENERATE_UUID()),
    user_id VARCHAR(191) NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'INFO',
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    data JSONB DEFAULT '{}',
    status VARCHAR(20) DEFAULT 'UNREAD',
    priority VARCHAR(20) DEFAULT 'NORMAL',
    channel VARCHAR(20) DEFAULT 'IN_APP',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    read_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 创建通知偏好设置表
CREATE TABLE notification_preferences (
    id VARCHAR(191) PRIMARY KEY DEFAULT (GENERATE_UUID()),
    user_id VARCHAR(191) NOT NULL UNIQUE,
    email_notifications BOOLEAN DEFAULT true,
    push_notifications BOOLEAN DEFAULT true,
    in_app_notifications BOOLEAN DEFAULT true,
    email_types JSONB DEFAULT '["SECURITY", "BILLING", "SYSTEM"]',
    push_types JSONB DEFAULT '["SECURITY", "BILLING", "SYSTEM"]',
    in_app_types JSONB DEFAULT '["ALL"]',
    quiet_hours_start TIME DEFAULT '22:00:00',
    quiet_hours_end TIME DEFAULT '08:00:00',
    timezone VARCHAR(50) DEFAULT 'UTC',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 创建通知模板表
CREATE TABLE notification_templates (
    id VARCHAR(191) PRIMARY KEY DEFAULT (GENERATE_UUID()),
    name VARCHAR(100) NOT NULL UNIQUE,
    type VARCHAR(50) NOT NULL,
    channel VARCHAR(20) NOT NULL,
    title_template TEXT NOT NULL,
    content_template TEXT NOT NULL,
    variables JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建通知发送队列表
CREATE TABLE notification_queue (
    id VARCHAR(191) PRIMARY KEY DEFAULT (GENERATE_UUID()),
    notification_id VARCHAR(191) NOT NULL,
    channel VARCHAR(20) NOT NULL,
    recipient VARCHAR(255) NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING',
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    scheduled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    sent_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE CASCADE
);

-- 创建索引
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_status ON notifications(status);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notification_preferences_user_id ON notification_preferences(user_id);
CREATE INDEX idx_notification_queue_status ON notification_queue(status);
CREATE INDEX idx_notification_queue_scheduled_at ON notification_queue(scheduled_at);

-- 创建触发器：自动创建通知偏好设置
CREATE OR REPLACE FUNCTION create_default_notification_preferences()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO notification_preferences (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_create_notification_preferences
    AFTER INSERT ON users
    FOR EACH ROW
    EXECUTE FUNCTION create_default_notification_preferences();

-- 插入默认通知模板
INSERT INTO notification_templates (name, type, channel, title_template, content_template, variables) VALUES
('WELCOME', 'SYSTEM', 'IN_APP', '欢迎使用 AutoAds', '欢迎使用 AutoAds！开始您的数字营销之旅。', '[]'),
('LOGIN_ALERT', 'SECURITY', 'IN_APP', '新设备登录', '您的账户在新设备上登录：{{device}} {{location}} {{time}}', '["device", "location", "time"]'),
('SUBSCRIPTION_SUCCESS', 'BILLING', 'IN_APP', '订阅成功', '您已成功订阅 {{plan_name}} 计划，有效期至 {{expiry_date}}', '["plan_name", "expiry_date"]'),
('TOKEN_LOW', 'SYSTEM', 'IN_APP', 'Token 余额不足', '您的 Token 余额不足，当前余额：{{balance}}', '["balance"]'),
('PAYMENT_SUCCESS', 'BILLING', 'IN_APP', '支付成功', '您已成功支付 {{amount}} 美元', '["amount"]'),
('FEATURE_UPDATE', 'SYSTEM', 'IN_APP', '功能更新', '{{feature_name}} 功能已更新，快来体验吧！', '["feature_name"]');

-- 创建通知统计视图
CREATE VIEW notification_stats AS
SELECT 
    u.id as user_id,
    u.email,
    COUNT(n.id) as total_notifications,
    COUNT(CASE WHEN n.status = 'UNREAD' THEN 1 END) as unread_count,
    COUNT(CASE WHEN n.type = 'SECURITY' THEN 1 END) as security_count,
    COUNT(CASE WHEN n.type = 'BILLING' THEN 1 END) as billing_count,
    COUNT(CASE WHEN n.type = 'SYSTEM' THEN 1 END) as system_count,
    MAX(n.created_at) as last_notification_at
FROM users u
LEFT JOIN notifications n ON u.id = n.user_id
GROUP BY u.id, u.email;

-- 添加注释
COMMENT ON TABLE notifications IS 'User notifications';
COMMENT ON TABLE notification_preferences IS 'User notification preferences';
COMMENT ON TABLE notification_templates IS 'Notification templates';
COMMENT ON TABLE notification_queue IS 'Notification delivery queue';