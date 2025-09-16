package main

import (
    "log"
    "os"
    dbinit "gofly-admin-v3/internal/init"
    "gofly-admin-v3/internal/config"
)

func main() {
    // 仅基于环境变量加载配置，避免文件监控与额外开销
    cfg, err := config.LoadFromEnv()
    if err != nil {
        log.Fatalf("加载环境配置失败: %v", err)
    }

    // 执行嵌入式 SQL 迁移与基础数据初始化（幂等）
    initializer, err := dbinit.NewDatabaseInitializer(cfg, log.Default())
    if err != nil {
        log.Fatalf("初始化器创建失败: %v", err)
    }
    if err := initializer.Initialize(); err != nil {
        log.Fatalf("数据库初始化失败: %v", err)
    }

    // 迁移成功后立即退出
    os.Exit(0)
}

