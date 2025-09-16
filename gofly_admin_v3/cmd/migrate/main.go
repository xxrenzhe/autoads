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
        log.Fatal("加载环境配置失败: ", err)
    }

    // 执行嵌入式 SQL 迁移与基础数据初始化（幂等）
    initializer, err := dbinit.NewDatabaseInitializer(cfg, log.Default())
    if err != nil {
        log.Fatal("初始化器创建失败: ", err)
    }
    // 确保底层连接关闭，避免极端情况下句柄未释放导致进程不退出
    defer initializer.Close()

    if err := initializer.Initialize(); err != nil {
        log.Fatal("数据库初始化失败: ", err)
    }
    // 明确以 0 退出，杜绝任何残留阻塞
    os.Exit(0)
}
