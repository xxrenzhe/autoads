-- Database optimization script for user activity statistics
-- Run this script to improve statistics query performance

-- 1. Token transaction indexes for statistics queries
CREATE INDEX IF NOT EXISTS idx_token_transactions_type_created ON token_transactions(type, created_at);
CREATE INDEX IF NOT EXISTS idx_token_transactions_user_type_created ON token_transactions(user_id, type, created_at);
CREATE INDEX IF NOT EXISTS idx_token_transactions_metadata_feature ON token_transactions USING gin((metadata->>'feature'));
CREATE INDEX IF NOT EXISTS idx_token_transactions_debit_created ON token_transactions(created_at) WHERE type = 'DEBIT';

-- 2. User behavior analytics indexes (if still used)
CREATE INDEX IF NOT EXISTS idx_user_behavior_feature_created ON user_behavior_analytics(feature, created_at);
CREATE INDEX IF NOT EXISTS idx_user_behavior_user_created ON user_behavior_analytics(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_user_behavior_created_feature ON user_behavior_analytics(created_at, feature);

-- 3. User table indexes for statistics
CREATE INDEX IF NOT EXISTS idx_users_created_active ON users(created_at, is_active);
CREATE INDEX IF NOT EXISTS idx_users_active_role ON users(is_active, role) WHERE is_active = true;

-- 4. Subscription table indexes for user segmentation
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_status_created ON subscriptions(user_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status_provider ON subscriptions(status, provider);

-- 5. Composite indexes for complex statistics queries
CREATE INDEX IF NOT EXISTS idx_token_trans_debit_user_created ON token_transactions(user_id, created_at) WHERE type = 'DEBIT';
CREATE INDEX IF NOT EXISTS idx_token_trans_feature_amount_created ON token_transactions((metadata->>'feature'), amount, created_at) WHERE type = 'DEBIT';

-- 6. Partial indexes for active data (most common queries)
CREATE INDEX IF NOT EXISTS idx_active_users_created ON users(created_at) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_recent_token_transactions ON token_transactions(created_at, type, amount) 
  WHERE created_at >= CURRENT_DATE - INTERVAL '90 days';

-- 7. Create materialized view for daily statistics
CREATE MATERIALIZED VIEW IF NOT EXISTS daily_statistics AS
SELECT 
  DATE_TRUNC('day', created_at) as date,
  metadata->>'feature' as feature,
  COUNT(*) as transaction_count,
  COUNT(DISTINCT user_id) as unique_users,
  ABS(SUM(amount)) as total_tokens_consumed,
  AVG(ABS(amount)) as avg_tokens_per_transaction
FROM token_transactions
WHERE type = 'DEBIT' 
  AND created_at >= CURRENT_DATE - INTERVAL '365 days'
  AND metadata->>'feature' IS NOT NULL
GROUP BY DATE_TRUNC('day', created_at), metadata->>'feature';

-- Create index on materialized view
CREATE INDEX IF NOT EXISTS idx_daily_stats_date_feature ON daily_statistics(date, feature);
CREATE INDEX IF NOT EXISTS idx_daily_stats_date ON daily_statistics(date);

-- 8. Create materialized view for hourly activity patterns
CREATE MATERIALIZED VIEW IF NOT EXISTS hourly_activity_patterns AS
SELECT 
  EXTRACT(HOUR FROM created_at) as hour,
  DATE_TRUNC('day', created_at) as date,
  COUNT(*) as activity_count,
  COUNT(DISTINCT user_id) as unique_users,
  ABS(SUM(amount)) as total_tokens
FROM token_transactions
WHERE type = 'DEBIT' 
  AND created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY EXTRACT(HOUR FROM created_at), DATE_TRUNC('day', created_at);

-- Create index on hourly patterns
CREATE INDEX IF NOT EXISTS idx_hourly_patterns_hour_date ON hourly_activity_patterns(hour, date);

-- 9. Create materialized view for user engagement segments
CREATE MATERIALIZED VIEW IF NOT EXISTS user_engagement_segments AS
WITH user_activity AS (
  SELECT 
    user_id,
    COUNT(*) as activity_count,
    ABS(SUM(amount)) as total_tokens,
    COUNT(DISTINCT DATE(created_at)) as active_days,
    MAX(created_at) as last_activity
  FROM token_transactions
  WHERE type = 'DEBIT' 
    AND created_at >= CURRENT_DATE - INTERVAL '30 days'
  GROUP BY user_id
)
SELECT 
  CASE 
    WHEN activity_count >= 20 THEN 'Active'
    WHEN activity_count >= 1 THEN 'Casual'
    ELSE 'Inactive'
  END as engagement_level,
  COUNT(*) as user_count,
  AVG(activity_count) as avg_activity,
  AVG(total_tokens) as avg_tokens,
  AVG(active_days) as avg_active_days
FROM user_activity
GROUP BY 
  CASE 
    WHEN activity_count >= 20 THEN 'Active'
    WHEN activity_count >= 1 THEN 'Casual'
    ELSE 'Inactive'
  END;

-- 10. Function to refresh materialized views
CREATE OR REPLACE FUNCTION refresh_statistics_views()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW daily_statistics;
  REFRESH MATERIALIZED VIEW hourly_activity_patterns;
  REFRESH MATERIALIZED VIEW user_engagement_segments;
END;
$$ LANGUAGE plpgsql;

-- 11. Create function for automatic cleanup of old statistics data
CREATE OR REPLACE FUNCTION cleanup_old_statistics()
RETURNS void AS $$
BEGIN
  -- Keep only 2 years of detailed token transaction data for statistics
  DELETE FROM token_transactions 
  WHERE created_at < CURRENT_DATE - INTERVAL '2 years'
    AND type = 'DEBIT';
    
  -- Keep only 1 year of user behavior analytics data
  DELETE FROM user_behavior_analytics 
  WHERE created_at < CURRENT_DATE - INTERVAL '1 year';
END;
$$ LANGUAGE plpgsql;

-- 12. Analyze tables to update statistics
ANALYZE token_transactions;
ANALYZE user_behavior_analytics;
ANALYZE users;
ANALYZE subscriptions;

-- 13. Create indexes for export functionality
CREATE INDEX IF NOT EXISTS idx_token_trans_export_date ON token_transactions(created_at, type, metadata, amount, user_id);
CREATE INDEX IF NOT EXISTS idx_user_behavior_export_date ON user_behavior_analytics(created_at, feature, user_id, tokens_consumed);

-- 14. Performance monitoring view
CREATE OR REPLACE VIEW statistics_performance_monitor AS
SELECT 
  schemaname,
  tablename,
  attname,
  n_distinct,
  correlation,
  most_common_vals,
  most_common_freqs
FROM pg_stats 
WHERE schemaname = 'public' 
  AND tablename IN ('token_transactions', 'user_behavior_analytics', 'users')
  AND attname IN ('created_at', 'type', 'feature', 'user_id', 'is_active');

-- Note: Set up cron job to refresh materialized views daily
-- Example cron job (run at 2 AM daily):
-- 0 2 * * * psql -d your_database -c "SELECT refresh_statistics_views();"

-- Note: Set up monthly cleanup job
-- Example cron job (run on 1st of each month at 3 AM):
-- 0 3 1 * * psql -d your_database -c "SELECT cleanup_old_statistics();"