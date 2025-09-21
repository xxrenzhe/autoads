-- 创建简化的安全监控表

-- 用户风险表
CREATE TABLE IF NOT EXISTS user_risks (
    user_id VARCHAR(255) PRIMARY KEY,
    risk_level VARCHAR(20) NOT NULL DEFAULT 'normal' CHECK (risk_level IN ('normal', 'suspicious', 'dangerous')),
    risk_score INTEGER NOT NULL DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
    factors TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 可疑事件表
CREATE TABLE IF NOT EXISTS suspicious_events (
    id VARCHAR(255) PRIMARY KEY DEFAULT (CUID()),
    user_id VARCHAR(255) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
    message TEXT NOT NULL,
    metadata JSONB,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by VARCHAR(255)
);

-- 用户活动表（简化版）
CREATE TABLE IF NOT EXISTS user_activities (
    id VARCHAR(255) PRIMARY KEY DEFAULT (CUID()),
    user_id VARCHAR(255) NOT NULL,
    action VARCHAR(100) NOT NULL,
    resource VARCHAR(255) NOT NULL,
    metadata JSONB,
    ip INET,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 用户限制表
CREATE TABLE IF NOT EXISTS user_restrictions (
    id VARCHAR(255) PRIMARY KEY DEFAULT (CUID()),
    user_id VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('api_limit', 'batch_limit', 'account_suspend')),
    reason TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_user_activities_user_created ON user_activities(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_activities_ip ON user_activities(ip);
CREATE INDEX IF NOT EXISTS idx_suspicious_events_user_time ON suspicious_events(user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_suspicious_events_resolved ON suspicious_events(resolved, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_user_restrictions_user_expires ON user_restrictions(user_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_user_risks_level ON user_risks(risk_level);

-- 添加注释
COMMENT ON TABLE user_risks IS '用户风险等级表';
COMMENT ON TABLE suspicious_events IS '可疑事件记录表';
COMMENT ON TABLE user_activities IS '用户活动记录表（简化版）';
COMMENT ON TABLE user_restrictions IS '用户限制表';