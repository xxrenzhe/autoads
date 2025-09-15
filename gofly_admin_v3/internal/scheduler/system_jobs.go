package scheduler

import (
    "context"
    "time"
    "gofly-admin-v3/utils/gf"
)

// RefreshRateLimitsJob: 通过 Redis 发布消息触发各节点刷新套餐限额
type RefreshRateLimitsJob struct{}
func (j *RefreshRateLimitsJob) GetName() string { return "refresh_rate_limits" }
func (j *RefreshRateLimitsJob) GetDescription() string { return "Publish ratelimit:plans:update to refresh plan limits" }
func (j *RefreshRateLimitsJob) Run(ctx context.Context) error {
    if gf.Redis() != nil {
        _, _ = gf.Redis().GroupPubSub().Publish(ctx, "ratelimit:plans:update", time.Now().Unix())
    }
    return nil
}

// ExpireSubscriptionsJob: 将过期订阅置为 EXPIRED
type ExpireSubscriptionsJob struct{}
func (j *ExpireSubscriptionsJob) GetName() string { return "expire_subscriptions" }
func (j *ExpireSubscriptionsJob) GetDescription() string { return "Expire subscriptions whose ended_at < now" }
func (j *ExpireSubscriptionsJob) Run(ctx context.Context) error {
    _, _ = gf.DB().Exec(ctx, "UPDATE subscriptions SET status='EXPIRED' WHERE status='ACTIVE' AND ended_at IS NOT NULL AND ended_at < NOW()")
    return nil
}

// CleanupIdempotencyAndTasksJob: 清理过期幂等登记（7天）
type CleanupIdempotencyAndTasksJob struct{}
func (j *CleanupIdempotencyAndTasksJob) GetName() string { return "cleanup_idempotency_and_tasks" }
func (j *CleanupIdempotencyAndTasksJob) GetDescription() string { return "Cleanup idempotency requests older than 7 days" }
func (j *CleanupIdempotencyAndTasksJob) Run(ctx context.Context) error {
    _, _ = gf.DB().Exec(ctx, "DELETE FROM idempotency_requests WHERE created_at < DATE_SUB(NOW(), INTERVAL 7 DAY)")
    return nil
}

// DailyUsageReportJob: 生成昨日使用/扣费日报（最简：写入日志或统计表，当前仅预留）
type DailyUsageReportJob struct{}
func (j *DailyUsageReportJob) GetName() string { return "daily_usage_report" }
func (j *DailyUsageReportJob) GetDescription() string { return "Generate daily usage/cost report (placeholder)" }
func (j *DailyUsageReportJob) Run(ctx context.Context) error { return nil }
