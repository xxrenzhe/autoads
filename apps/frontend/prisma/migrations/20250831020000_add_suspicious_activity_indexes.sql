-- This is an empty migration file.
-- The suspicious activity detection models are already included in the main schema.
-- You can add additional indexes here if needed.

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_activity_user_timestamp ON user_activity(user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_user_activity_action ON user_activity(action);
CREATE INDEX IF NOT EXISTS idx_suspicious_alert_user_created ON suspicious_alert(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_suspicious_alert_resolved ON suspicious_alert(resolved, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_risk_score_level ON user_risk_score(level);
CREATE INDEX IF NOT EXISTS idx_suspicious_pattern_user_detected ON suspicious_pattern_detection(user_id, detected_at DESC);