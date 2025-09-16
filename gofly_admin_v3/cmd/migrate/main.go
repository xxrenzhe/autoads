package main

import (
    "context"
    "log"
    "os"
    "time"
    dbinit "gofly-admin-v3/internal/init"
    "gofly-admin-v3/internal/config"
)

func main() {
    // 仅基于环境变量加载配置，避免文件监控与额外开销
    cfg, err := config.LoadFromEnv()
    if err != nil {
        log.Fatalf("加载环境配置失败: %v", err)
    }

    // 整体超时保护：防止在 CI 中意外挂起
    timeout := 5 * time.Minute
    if v := os.Getenv("MIGRATE_TIMEOUT"); v != "" {
        if d, e := time.ParseDuration(v); e == nil && d > 0 {
            timeout = d
        }
    }
    ctx, cancel := context.WithTimeout(context.Background(), timeout)
    defer cancel()
    done := make(chan struct{})

    go func() {
        // 执行嵌入式 SQL 迁移与基础数据初始化（幂等）
        initializer, err := dbinit.NewDatabaseInitializer(cfg, log.Default())
        if err != nil {
            log.Fatalf("初始化器创建失败: %v", err)
        }
        if err := initializer.Initialize(); err != nil {
            log.Fatalf("数据库初始化失败: %v", err)
        }
        close(done)
    }()

    select {
    case <-done:
        os.Exit(0)
    case <-ctx.Done():
        log.Fatalf("迁移超时(%v)未完成，强制退出", timeout)
    }
}
