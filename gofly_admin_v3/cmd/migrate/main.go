package main

import (
    "log"
    dbinit "gofly-admin-v3/internal/init"
    "gofly-admin-v3/internal/config"
)

func main() {
    // 仅基于环境变量加载配置，避免文件监控与额外开销
    cfg, err := config.LoadFromEnv()
    if err != nil {
        log.Fatal("加载环境配置失败: ", err)
    }

    // 执行嵌入式 SQL 迁移与基础数据初始化（幂等）
    initializer, err := dbinit.NewDatabaseInitializer(cfg, log.Default())
    if err != nil {
        log.Fatal("初始化器创建失败: ", err)
    }
    if err := initializer.Initialize(); err != nil {
        log.Fatal("数据库初始化失败: ", err)
    }
    if err := initializer.Close(); err != nil {
        // 连接关闭失败不应导致 CI 失败，记录并继续退出
        log.Printf("关闭数据库连接警告: %v", err)
    }
}
