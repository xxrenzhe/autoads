-- Database optimization script for user management
-- Run this script to improve user management query performance

-- 1. User table indexes for common queries
CREATE INDEX IF NOT EXISTS idx_users_role_status ON users(role, status);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
CREATE INDEX IF NOT EXISTS idx_users_email_name ON users(email, name);
CREATE INDEX IF NOT EXISTS idx_users_token_balance ON users(token_balance);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login_at);

-- 2. Full-text search index for user search
CREATE INDEX IF NOT EXISTS idx_users_search ON users USING gin(
  to_tsvector('english', coalesce(name, '') || ' ' || coalesce(email, ''))
);

-- 3. Subscription table indexes for user-subscription queries
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_status ON subscriptions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status_period ON subscriptions(status, current_period_end);

-- 4. Token transaction indexes for user token management
CREATE INDEX IF NOT EXISTS idx_token_transactions_user_date ON token_transactions(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_token_transactions_type_amount ON token_transactions(type, amount);

-- 5. Admin log indexes for audit queries
CREATE INDEX IF NOT EXISTS idx_admin_logs_action_date ON admin_logs(action, created_at);
CREATE INDEX IF NOT EXISTS idx_admin_logs_user_id ON admin_logs(user_id);

-- 6. Composite indexes for complex queries
CREATE INDEX IF NOT EXISTS idx_users_role_status_created ON users(role, status, created_at);
CREATE INDEX IF NOT EXISTS idx_users_active_token_balance ON users(is_active, token_balance) WHERE is_active = true;

-- 7. Partial indexes for active users (most common queries)
CREATE INDEX IF NOT EXISTS idx_active_users_role ON users(role) WHERE status = 'ACTIVE';
CREATE INDEX IF NOT EXISTS idx_active_users_created ON users(created_at) WHERE status = 'ACTIVE';

-- 8. Analyze tables to update statistics
ANALYZE users;
ANALYZE subscriptions;
ANALYZE token_transactions;
ANALYZE admin_logs;

-- 9. Create materialized view for user statistics (optional, for heavy reporting)
CREATE MATERIALIZED VIEW IF NOT EXISTS user_stats_summary AS
SELECT 
  DATE_TRUNC('day', created_at) as date,
  role,
  status,
  COUNT(*) as user_count,
  AVG(token_balance) as avg_token_balance,
  COUNT(CASE WHEN is_active THEN 1 END) as active_count
FROM users
GROUP BY DATE_TRUNC('day', created_at), role, status;

-- Create index on materialized view
CREATE INDEX IF NOT EXISTS idx_user_stats_summary_date_role ON user_stats_summary(date, role);

-- 10. Set up automatic refresh for materialized view (run daily)
-- Note: This would typically be set up as a cron job or scheduled task
-- REFRESH MATERIALIZED VIEW user_stats_summary;