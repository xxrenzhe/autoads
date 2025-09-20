package main

import (
    "bytes"
    "context"
    "errors"
    "fmt"
    "log"
    "os"
    "os/exec"
    "path/filepath"
    "strings"
    "time"

    "gofly-admin-v3/internal/config"
    dbinit "gofly-admin-v3/internal/init"
    "database/sql"
    _ "github.com/go-sql-driver/mysql"
)

func run(cmd *exec.Cmd) (string, error) {
    var buf bytes.Buffer
    cmd.Stdout = &buf
    cmd.Stderr = &buf
    err := cmd.Run()
    return buf.String(), err
}

func runPrismaFront(args ...string) (string, error) {
    ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
    defer cancel()
    dir := filepath.Clean(filepath.Join("..", "apps", "frontend"))
    // Prefer npx prisma in repo context
    c1 := exec.CommandContext(ctx, "npx", append([]string{"prisma"}, args...)...)
    c1.Dir = dir
    out, err := run(c1)
    if err == nil {
        return out, nil
    }
    // Fallback only when npx not found
    var execErr *exec.Error
    if errors.As(err, &execErr) && execErr.Err != nil {
        // try PATH prisma
        c2 := exec.CommandContext(ctx, "prisma", args...)
        c2.Dir = dir
        return run(c2)
    }
    return out, err
}

func migrateWithAutoSkip(schemaPath string) error {
    // 1st attempt
    out, err := runPrismaFront("migrate", "deploy", "--schema", "prisma/schema.prisma")
    if err == nil {
        fmt.Print(out)
        return nil
    }

    // Auto-skip historical fix migrations on fresh DBs
    // a) Duplicate foreign key constraints (1826) in 20250919072000
    if strings.Contains(out, "20250919072000_add_critical_foreign_keys") || strings.Contains(out, "Duplicate foreign key constraint") || strings.Contains(out, "code: 1826") {
        _, _ = runPrismaFront("migrate", "resolve", "--schema", "prisma/schema.prisma", "--applied", "20250919072000_add_critical_foreign_keys")
        out, err = runPrismaFront("migrate", "deploy", "--schema", "prisma/schema.prisma")
        if err == nil {
            fmt.Print(out)
            return nil
        }
    }
    // b) Collation mix (1267) in 20250919073000
    if strings.Contains(out, "20250919073000_add_more_foreign_keys") || strings.Contains(out, "Illegal mix of collations") || strings.Contains(out, "code: 1267") {
        _, _ = runPrismaFront("migrate", "resolve", "--schema", "prisma/schema.prisma", "--applied", "20250919073000_add_more_foreign_keys")
        out, err = runPrismaFront("migrate", "deploy", "--schema", "prisma/schema.prisma")
        if err == nil {
            fmt.Print(out)
            return nil
        }
    }

    // If still failing, surface the original prisma output for clarity
    if out != "" {
        return fmt.Errorf("prisma migrate deploy failed:\n%s", out)
    }
    return err
}

func runPrismaSeed(schemaPath string) error {
    ctx, cancel := context.WithTimeout(context.Background(), 3*time.Minute)
    defer cancel()
    dir := filepath.Clean(filepath.Join("..", "apps", "frontend"))
    // Prefer npx prisma db seed
    c1 := exec.CommandContext(ctx, "npx", "prisma", "db", "seed", "--schema", "prisma/schema.prisma")
    c1.Dir = dir
    if out, err := run(c1); err == nil { fmt.Print(out); return nil }
    // Fallback PATH prisma
    c2 := exec.CommandContext(ctx, "prisma", "db", "seed", "--schema", schemaPath)
    c2.Dir = dir
    if out, err := run(c2); err == nil { fmt.Print(out); return nil }
    // Final fallback: node seed.js
    seedPath := filepath.Clean(filepath.Join(dir, "prisma", "seed.js"))
    if _, statErr := os.Stat(seedPath); statErr == nil {
        c3 := exec.CommandContext(ctx, "node", seedPath)
        if out, err := run(c3); err == nil { fmt.Print(out); return nil }
    }
    return fmt.Errorf("no usable prisma seed configuration and seed.js not found")
}

func main() {
    cfg, err := config.LoadFromEnv()
    if err != nil {
        log.Fatal("加载环境配置失败: ", err)
    }

    if v := os.Getenv("DB_RECREATE"); v == "true" || v == "1" {
        dsn := cfg.DB.Username + ":" + cfg.DB.Password + "@tcp(" + cfg.DB.Host + ":" + fmt.Sprint(cfg.DB.Port) + ")/"
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

    schemaPath := filepath.Clean(filepath.Join("..", "apps", "frontend", "prisma", "schema.prisma"))
    log.Printf("执行 Prisma 迁移: %s", schemaPath)
    if err := migrateWithAutoSkip(schemaPath); err != nil {
        log.Fatalf("Prisma 迁移失败: %v", err)
    }
    if err := runPrismaSeed(schemaPath); err != nil {
        log.Printf("警告：Prisma seed 失败(可忽略): %v", err)
    }

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
        log.Printf("关闭数据库连接警告: %v", err)
    }
}
