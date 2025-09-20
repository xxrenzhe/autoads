package subscription

import (
    "fmt"
    "time"

    "github.com/robfig/cron/v3"
    "gofly-admin-v3/utils/gf"
)

var reminderCron *cron.Cron

func init() {
    // 启动每日提醒任务（09:00）
    reminderCron = cron.New()
    // 默认每天 09:00 执行；可通过环境变量 SUBSCRIPTION_REMIND_CRON 覆盖
    spec := gf.String(gf.GetConfig("SUBSCRIPTION_REMIND_CRON", "0 9 * * *"))
    _, err := reminderCron.AddFunc(spec, func() {
        // 默认提前天数：3 天；可通过 SUBSCRIPTION_REMIND_DAYS 覆盖
        days := gf.Int(gf.GetConfig("SUBSCRIPTION_REMIND_DAYS", 3))
        _ = sendExpireReminders(days)
    })
    if err == nil {
        reminderCron.Start()
    }
}

// sendExpireReminders 发送到期提醒
func sendExpireReminders(days int) error {
    if days <= 0 { days = 3 }
    now := time.Now()
    end := now.AddDate(0, 0, days)
    // 查询即将到期的订阅和用户邮箱
    sql := `SELECT s.id as sub_id, s.user_id, s.ended_at, u.email
            FROM subscriptions s JOIN users u ON u.id = s.user_id
            WHERE s.status='ACTIVE' AND s.ended_at BETWEEN ? AND ?`
    rows, err := gf.DB().Query(nil, sql, now, end)
    if err != nil || rows.IsEmpty() { return err }
    for _, r := range rows {
        subID := r["sub_id"].String()
        email := r["email"].String()
        endedAt := r["ended_at"].Time()
        if email == "" { continue }
        // 去重：每日仅发一次
        dedupKey := fmt.Sprintf("sub:renew_notify:%s:%s", subID, now.Format("2006-01-02"))
        if v, err := gf.Redis().Do(nil, "EXISTS", dedupKey); err == nil {
            if v.Bool() { continue }
        }
        // 发送邮件
        title := "订阅即将到期提醒"
        text := fmt.Sprintf("您的订阅将于 %s 到期，请及时续费以避免服务中断。", endedAt.Format("2006-01-02"))
        _, _ = gf.SendEmail(nil, []string{email}, title, text)
        // 标记已发送，过期7天
        _, _ = gf.Redis().Do(nil, "SETEX", dedupKey, 7*24*3600, "1")
    }
    return nil
}
