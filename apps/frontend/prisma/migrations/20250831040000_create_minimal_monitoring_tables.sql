-- 创建极简监控表

-- 用户事件表（只记录必要信息）
CREATE TABLE IF NOT EXISTS user_events (
    id VARCHAR(255) PRIMARY KEY DEFAULT (CUID()),
    user_id VARCHAR(255) NOT NULL,
    action VARCHAR(50) NOT NULL,
    endpoint VARCHAR(255) NOT NULL,
    user_agent TEXT,
    ip INET,
    metadata JSONB,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 可疑事件表
CREATE TABLE IF NOT EXISTS suspicious_events (
    id VARCHAR(255) PRIMARY KEY DEFAULT (CUID()),
    user_id VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('automation_tool', 'brute_force', 'abnormal_token_consumption', 'suspicious_ip_rotation')),
    details JSONB NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by VARCHAR(255)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_user_events_user_time ON user_events(user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_user_events_ip ON user_events(ip);
CREATE INDEX IF NOT EXISTS idx_suspicious_events_user_type ON suspicious_events(user_id, type);
CREATE INDEX IF NOT EXISTS idx_suspicious_events_resolved ON suspicious_events(resolved, timestamp DESC);

-- 添加注释
COMMENT ON TABLE user_events IS '用户事件记录表（极简版）';
COMMENT ON TABLE suspicious_events IS '可疑事件记录表';

-- 创建更新时间触发器（可选）
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.timestamp = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_suspicious_events_timestamp 
    BEFORE UPDATE ON suspicious_events
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();