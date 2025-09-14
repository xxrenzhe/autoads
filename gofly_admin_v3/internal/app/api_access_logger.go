package app

import (
    "time"
    "github.com/gin-gonic/gin"
    "gofly-admin-v3/utils/gf"
)

// ApiAccessLogger 记录API访问日志到数据库（api_access_logs）
func ApiAccessLogger() gin.HandlerFunc {
    return func(c *gin.Context) {
        start := time.Now()
        // 处理请求
        c.Next()

        // 仅记录 /api/ 路径
        path := c.Request.URL.Path
        if len(path) < 5 || path[:5] != "/api/" {
            return
        }

        method := c.Request.Method
        status := c.Writer.Status()
        ua := c.GetHeader("User-Agent")
        ip := c.ClientIP()
        durationMs := int(time.Since(start).Milliseconds())
        userID := c.GetString("user_id")
        if userID == "" {
            // 优先记录管理员ID（若存在）
            userID = c.GetString("admin_id")
        }

        // 使用原始路径（FullPath 可能为空）
        endpoint := path
        if fp := c.FullPath(); fp != "" { endpoint = fp }

        // 异步写库，降低延迟
        go func() {
            _, _ = gf.DB().Exec(c, `INSERT INTO api_access_logs (id, user_id, endpoint, method, status_code, duration_ms, ip_address, user_agent, created_at) VALUES (?,?,?,?,?,?,?,?,NOW())`,
                gf.UUID(), userID, endpoint, method, status, durationMs, ip, ua,
            )
        }()
    }
}

