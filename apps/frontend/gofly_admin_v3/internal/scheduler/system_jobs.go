package scheduler

import (
    "context"
    "fmt"
    "time"
    
    "gofly-admin-v3/utils/gf"
    "gofly-admin-v3/internal/audit"
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
    _, _ = gf.DB().Exec(ctx, "DELETE FROM idempotency_requests WHERE (expires_at IS NOT NULL AND expires_at < NOW()) OR created_at < DATE_SUB(NOW(), INTERVAL 7 DAY)")
    return nil
}

// DailyUsageReportJob: 生成昨日使用/扣费日报（最简：写入日志或统计表，当前仅预留）
type DailyUsageReportJob struct{}
func (j *DailyUsageReportJob) GetName() string { return "daily_usage_report" }
func (j *DailyUsageReportJob) GetDescription() string { return "Generate daily usage/cost report (placeholder)" }
func (j *DailyUsageReportJob) Run(ctx context.Context) error { return nil }

// OrphanInspectionJob: 巡检关键外键关系的“孤儿”记录，仅扫描与告警，不做删除
type OrphanInspectionJob struct{}
func (j *OrphanInspectionJob) GetName() string { return "orphan_inspection" }
func (j *OrphanInspectionJob) GetDescription() string { return "Scan DB for orphaned rows and report" }
func (j *OrphanInspectionJob) Run(ctx context.Context) error {
    type check struct{ name, sql string }
    checks := []check{
        {"payments.user", "SELECT COUNT(*) AS c FROM payments p LEFT JOIN users u ON u.id=p.userId WHERE u.id IS NULL"},
        {"payments.subscription", "SELECT COUNT(*) AS c FROM payments p LEFT JOIN subscriptions s ON s.id=p.subscriptionId WHERE p.subscriptionId IS NOT NULL AND s.id IS NULL"},
        {"subscriptions.user", "SELECT COUNT(*) AS c FROM subscriptions s LEFT JOIN users u ON u.id=s.userId WHERE u.id IS NULL"},
        {"subscriptions.plan", "SELECT COUNT(*) AS c FROM subscriptions s LEFT JOIN plans p ON p.id=s.planId WHERE p.id IS NULL"},
        {"token_transactions.user", "SELECT COUNT(*) AS c FROM token_transactions t LEFT JOIN users u ON u.id=t.userId WHERE u.id IS NULL"},
        {"token_usage.user", "SELECT COUNT(*) AS c FROM token_usage t LEFT JOIN users u ON u.id=t.userId WHERE u.id IS NULL"},
        {"token_usage.plan", "SELECT COUNT(*) AS c FROM token_usage t LEFT JOIN plans p ON p.id=t.planId WHERE p.id IS NULL"},
        {"subscription_history.subscription", "SELECT COUNT(*) AS c FROM subscription_history sh LEFT JOIN subscriptions s ON s.id=sh.subscriptionId WHERE s.id IS NULL"},
        {"invitations.inviter", "SELECT COUNT(*) AS c FROM invitations i LEFT JOIN users u ON u.id=i.inviterId WHERE u.id IS NULL"},
        {"check_ins.user", "SELECT COUNT(*) AS c FROM check_ins c LEFT JOIN users u ON u.id=c.userId WHERE u.id IS NULL"},
        {"accounts.user", "SELECT COUNT(*) AS c FROM accounts a LEFT JOIN users u ON u.id=a.userId WHERE u.id IS NULL"},
        {"sessions.user", "SELECT COUNT(*) AS c FROM sessions s LEFT JOIN users u ON u.id=s.userId WHERE u.id IS NULL"},
    }
    total := 0
    byCheck := make(map[string]int)
    for _, ch := range checks {
        rows, err := gf.DB().Query(ctx, ch.sql)
        if err != nil { return err }
        c := 0
        if len(rows) > 0 {
            c = rows[0]["c"].Int()
        }
        byCheck[ch.name] = c
        total += c
    }
    details := gf.Map{
        "total_orphans": total,
        "by_check":      byCheck,
        "ts":            time.Now().Format(time.RFC3339),
    }
    // 记录审计事件（若默认审计服务已初始化）
    audit.LogUserAction("system", "consistency_check", "db_orphans_report", "", details, "", "", true, "", 0)
    if total > 0 {
        audit.LogError(ctx, "consistency", fmt.Errorf("orphan rows detected: %d", total), gf.Map{"by_check": byCheck})
    }
    return nil
}
