-- Add SystemLog table for scheduled task execution tracking
CREATE TABLE IF NOT EXISTS system_logs (
    id VARCHAR(191) PRIMARY KEY DEFAULT (cuid()),
    action VARCHAR(191) NOT NULL,
    resource VARCHAR(191),
    level VARCHAR(191) DEFAULT 'info',
    message TEXT,
    metadata JSONB,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS system_logs_action_timestamp_idx ON system_logs (action, timestamp);
CREATE INDEX IF NOT EXISTS system_logs_level_timestamp_idx ON system_logs (level, timestamp);
CREATE INDEX IF NOT EXISTS system_logs_resource_timestamp_idx ON system_logs (resource, timestamp);

-- Add a comment for documentation
COMMENT ON TABLE system_logs IS 'System log entries for tracking scheduled task executions and system events';