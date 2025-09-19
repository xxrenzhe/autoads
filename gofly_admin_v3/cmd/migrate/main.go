package main

import (
    "context"
    "fmt"
    "log"
    "os"
    "os/exec"
    "path/filepath"
    "time"

    "gofly-admin-v3/internal/config"
    dbinit "gofly-admin-v3/internal/init"
    "database/sql"
    _ "github.com/go-sql-driver/mysql"
)

func runPrismaMigrate(schemaPath string) error {
    ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
    defer cancel()

    // Prefer npx prisma ... from repo
    // Run in apps/frontend so npx can pick local devDependency 'prisma'
    // Note: prisma schema resides under prisma/schema.prisma within apps/frontend
    cmd := exec.CommandContext(ctx, "npx", "prisma", "migrate", "deploy", "--schema", "prisma/schema.prisma")
    cmd.Dir = filepath.Clean(filepath.Join("..", "apps", "frontend"))
    cmd.Stdout = os.Stdout
    cmd.Stderr = os.Stderr
    if err := cmd.Run(); err == nil {
        return nil
    }
    // Fallback: prisma in PATH
    cmd = exec.CommandContext(ctx, "prisma", "migrate", "deploy", "--schema", schemaPath)
    cmd.Stdout = os.Stdout
    cmd.Stderr = os.Stderr
    return cmd.Run()
}

func runPrismaSeed(schemaPath string) error {
    ctx, cancel := context.WithTimeout(context.Background(), 3*time.Minute)
    defer cancel()
    // apps/frontend has prisma/seed.js and devDependency prisma
    cmd := exec.CommandContext(ctx, "npx", "prisma", "db", "seed", "--schema", "prisma/schema.prisma")
    cmd.Dir = filepath.Clean(filepath.Join("..", "apps", "frontend"))
    cmd.Stdout = os.Stdout
    cmd.Stderr = os.Stderr
    if err := cmd.Run(); err == nil { return nil }
    // Fallback: PATH prisma
    cmd = exec.CommandContext(ctx, "prisma", "db", "seed", "--schema", schemaPath)
    cmd.Stdout = os.Stdout
    cmd.Stderr = os.Stderr
    return cmd.Run()
}

func main() {
    // 仅基于环境变量加载配置，避免文件监控与额外开销
    cfg, err := config.LoadFromEnv()
    if err != nil {
        log.Fatal("加载环境配置失败: ", err)
    }

    // 可选：CI 重建数据库（危险操作，需 DB_RECREATE=true）
    if v := os.Getenv("DB_RECREATE"); v == "true" || v == "1" {
        dsn := cfg.DB.Username + ":" + cfg.DB.Password + "@tcp(" + cfg.DB.Host + ":" +  fmt.Sprint(cfg.DB.Port) + ")/"
        sqldb, e := sql.Open("mysql", dsn+"?charset=utf8mb4&parseTime=true&loc=Local")
        if e != nil {
            log.Fatalf("连接 MySQL 失败(重建DB): %v", e)
        }
        defer sqldb.Close()
        if _, e := sqldb.Exec("DROP DATABASE IF EXISTS `" + cfg.DB.Database + "`"); e != nil {
            log.Fatalf("删除数据库失败: %v", e)
        }
        if _, e := sqldb.Exec("CREATE DATABASE `" + cfg.DB.Database + "` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"); e != nil {
            log.Fatalf("创建数据库失败: %v", e)
        }
        log.Printf("已重建数据库: %s", cfg.DB.Database)
    }

    // 先执行 Prisma 迁移（DDL 统一由 Prisma 管理）
    // 该命令从 gofly_admin_v3 目录相对定位到 monorepo 下的 Prisma schema。
    // 支持使用环境变量 DATABASE_URL/SHADOW_DATABASE_URL。
    schemaPath := filepath.Clean(filepath.Join("..", "apps", "frontend", "prisma", "schema.prisma"))
    log.Printf("执行 Prisma 迁移: %s", schemaPath)
    if err := runPrismaMigrate(schemaPath); err != nil {
        log.Fatalf("Prisma 迁移失败: %v", err)
    }
    // 执行 Prisma seed（幂等）
    if err := runPrismaSeed(schemaPath); err != nil {
        log.Printf("警告：Prisma seed 失败(可忽略): %v", err)
    }

    // 执行基础数据初始化（幂等）
    // 注意：为避免再次触发内部的 DB 重建逻辑，这里显式禁用 DB_RECREATE/创建步骤。
    _ = os.Unsetenv("DB_RECREATE")
    _ = os.Setenv("SKIP_CREATE_DB", "true")
    _ = os.Setenv("INIT_SKIP_CREATE_DB", "true")
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
