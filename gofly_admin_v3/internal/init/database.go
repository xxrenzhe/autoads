package init

import (
    "context"
    "fmt"
    "log"
    "net"
    "strings"
    "time"
    "os"

	"gofly-admin-v3/internal/config"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// DatabaseInitializer 数据库初始化器
type DatabaseInitializer struct {
    // db 连接到目标数据库（选定 schema）
    db       *gorm.DB
    // serverDB 连接到服务器级（无指定 schema），仅用于 createDatabase
    serverDB *gorm.DB
    config *config.Config
    logger *log.Logger
}

// NewDatabaseInitializer 创建数据库初始化器
func NewDatabaseInitializer(cfg *config.Config, stdLogger *log.Logger) (*DatabaseInitializer, error) {
	// 连接数据库
	// 等待 MySQL 端口可用（避免在 CI 中长时间挂起）
	_ = waitForTCP(cfg.DB.Host, cfg.DB.Port, 30*time.Second)

    dsn := fmt.Sprintf("%s:%s@tcp(%s:%d)/?charset=utf8mb4&parseTime=True&loc=Local&timeout=10s&readTimeout=30s&writeTimeout=30s",
        cfg.DB.Username,
        cfg.DB.Password,
        cfg.DB.Host,
        cfg.DB.Port,
    )

    serverDB, err := gorm.Open(mysql.Open(dsn), &gorm.Config{
        Logger: logger.Default.LogMode(logger.Warn),
    })
    if err != nil {
        return nil, fmt.Errorf("连接数据库失败: %w", err)
    }

    // 轻量 Ping，避免长等待
    if sqlDB, e := serverDB.DB(); e == nil {
        sqlDB.SetMaxIdleConns(10)
        sqlDB.SetMaxOpenConns(100)
        sqlDB.SetConnMaxLifetime(30 * time.Minute)
        ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
        defer cancel()
        _ = sqlDB.PingContext(ctx)
    }

    return &DatabaseInitializer{
        db:       nil,
        serverDB: serverDB,
        config: cfg,
        logger: stdLogger,
    }, nil
}

// Initialize 执行完整的数据库初始化
func (di *DatabaseInitializer) Initialize() error {
	// 创建日志记录器
	logDir := "logs"
	initLogger, err := NewInitLogger(logDir)
	if err != nil {
		di.logger.Printf("警告：无法创建初始化日志记录器: %v", err)
	} else {
		defer initLogger.Close()
	}

	// 创建进度跟踪器
	progressTracker := NewInitProgressTracker(initLogger, 5)
	progressTracker.Start()

	di.logger.Println("开始数据库初始化...")
	if initLogger != nil {
		initLogger.Log("INFO", "database", "开始数据库初始化")
	}

    // 读取跳过标志
    skipCreate := isEnvTrue("SKIP_CREATE_DB") || isEnvTrue("INIT_SKIP_CREATE_DB")
    skipSeed := isEnvTrue("SKIP_SEED") || isEnvTrue("SKIP_BASIC_DATA")
    // 严格只读：即便未显式 SKIP_SEED，也强制跳过数据写入（生产默认）
    if isEnvTrue("GO_SEED_STRICT_READONLY") {
        di.logger.Println("[seed] 严格只读模式（GO_SEED_STRICT_READONLY=true），跳过基础数据写入")
        skipSeed = true
    }
    skipVerify := isEnvTrue("SKIP_VERIFY") || isEnvTrue("INIT_SKIP_VERIFY")

    // 1. 创建数据库（如果不存在）
    progressTracker.UpdateProgress("创建数据库")
    start := time.Now()
    if !skipCreate {
        if err := di.createDatabase(); err != nil {
            if initLogger != nil {
                initLogger.LogError("database", "创建数据库失败", err)
            }
            progressTracker.Fail(err)
            return fmt.Errorf("创建数据库失败: %w", err)
        }
        if initLogger != nil {
            initLogger.LogWithDuration("INFO", "database", "数据库创建成功", time.Since(start), true)
        }
    } else if initLogger != nil {
        initLogger.Log("INFO", "database", "跳过创建数据库（按环境变量）")
    }

	// 2. 连接到目标数据库
	progressTracker.UpdateProgress("连接数据库")
	start = time.Now()
	if err := di.connectToDatabase(); err != nil {
		if initLogger != nil {
			initLogger.LogError("database", "连接数据库失败", err)
		}
		progressTracker.Fail(err)
		return fmt.Errorf("连接到目标数据库失败: %w", err)
	}
	if initLogger != nil {
		initLogger.LogWithDuration("INFO", "database", "数据库连接成功", time.Since(start), true)
	}

    // 3. 执行迁移（已移除：DDL 统一交由 Prisma 迁移管理）
    progressTracker.UpdateProgress("执行数据库迁移(交由 Prisma)")
    start = time.Now()
    if initLogger != nil {
        initLogger.LogWithDuration("INFO", "migration", "跳过 Go 侧迁移：由 Prisma 管理", time.Since(start), true)
    }

    // 4. 初始化基础数据
    progressTracker.UpdateProgress("初始化基础数据")
    start = time.Now()
    if !skipSeed {
        if err := di.initializeBasicData(); err != nil {
            if initLogger != nil {
                initLogger.LogError("data", "初始化基础数据失败", err)
            }
            progressTracker.Fail(err)
            return fmt.Errorf("初始化基础数据失败: %w", err)
        }
        if initLogger != nil {
            initLogger.LogWithDuration("INFO", "data", "基础数据初始化完成", time.Since(start), true)
        }
    } else if initLogger != nil {
        initLogger.Log("INFO", "data", "跳过基础数据初始化（按环境变量）")
    }

    // 5. 验证初始化结果
    progressTracker.UpdateProgress("验证初始化结果")
    start = time.Now()
    if !skipVerify {
        if err := di.verifyInitialization(); err != nil {
            if initLogger != nil {
                initLogger.LogError("verification", "验证初始化失败", err)
            }
            progressTracker.Fail(err)
            return fmt.Errorf("验证初始化失败: %w", err)
        }
        if initLogger != nil {
            initLogger.LogWithDuration("INFO", "verification", "初始化验证通过", time.Since(start), true)
        }
    } else if initLogger != nil {
        initLogger.Log("INFO", "verification", "跳过初始化结果验证（按环境变量）")
    }

	di.logger.Println("✅ 数据库初始化完成")
	progressTracker.Complete()

	// 导出日志
	if initLogger != nil {
		logFile := fmt.Sprintf("logs/init_summary_%s.json", time.Now().Format("20060102_150405"))
		if err := initLogger.ExportLog(logFile); err != nil {
			di.logger.Printf("警告：导出日志失败: %v", err)
		}
	}

	return nil
}

// createDatabase 创建数据库（如果不存在）
func (di *DatabaseInitializer) createDatabase() error {
    dbName := di.config.DB.Database

    // 可选：强制重建数据库（仅在显式设置 DB_RECREATE=true/1 时生效）
    if v := strings.ToLower(strings.TrimSpace(os.Getenv("DB_RECREATE"))); v == "true" || v == "1" {
        di.logger.Printf("检测到 DB_RECREATE 标志，准备删除并重建数据库: %s", dbName)
        if err := di.serverDB.Exec(fmt.Sprintf("DROP DATABASE IF EXISTS `%s`", dbName)).Error; err != nil {
            return fmt.Errorf("删除数据库失败: %w", err)
        }
    }

    // 检查数据库是否存在（使用计数更稳妥避免类型转换问题）
    var count int64
    err := di.serverDB.Raw("SELECT COUNT(*) FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?", dbName).Scan(&count).Error
    if err != nil {
        return err
    }

    if count == 0 {
        di.logger.Printf("创建数据库: %s", dbName)
        sql := fmt.Sprintf("CREATE DATABASE `%s` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci", dbName)
        if err := di.serverDB.Exec(sql).Error; err != nil {
            return err
        }
        di.logger.Printf("✅ 数据库 %s 创建成功", dbName)
    } else {
        di.logger.Printf("数据库 %s 已存在", dbName)
    }

	return nil
}

// connectToDatabase 连接到目标数据库
func (di *DatabaseInitializer) connectToDatabase() error {
	// 再次确认端口可用
	_ = waitForTCP(di.config.DB.Host, di.config.DB.Port, 30*time.Second)

	dsn := fmt.Sprintf("%s:%s@tcp(%s:%d)/%s?charset=utf8mb4&parseTime=True&loc=Local&timeout=10s&readTimeout=30s&writeTimeout=30s",
		di.config.DB.Username,
		di.config.DB.Password,
		di.config.DB.Host,
		di.config.DB.Port,
		di.config.DB.Database,
	)

	db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Warn),
	})
	if err != nil {
		return err
	}

	// 基础连接设置与快速 Ping
	sqlDB, err := db.DB()
	if err == nil {
		sqlDB.SetMaxIdleConns(10)
		sqlDB.SetMaxOpenConns(100)
		sqlDB.SetConnMaxLifetime(30 * time.Minute)
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		_ = sqlDB.PingContext(ctx)
	}

	di.db = db
	return nil
}

// waitForTCP 尝试在给定超时时间内建立 TCP 连接（用于 CI 等环境避免长时间挂起）
func waitForTCP(host string, port int, total time.Duration) error {
    if host == "" || port == 0 {
        return nil
    }
    addr := fmt.Sprintf("%s:%d", host, port)
    deadline := time.Now().Add(total)
    for {
        d := net.Dialer{Timeout: 2 * time.Second}
        if conn, err := d.Dial("tcp", addr); err == nil {
            _ = conn.Close()
            return nil
        }
        if time.Now().After(deadline) {
            return fmt.Errorf("等待 %s 可用超时(%v)", addr, total)
        }
        time.Sleep(500 * time.Millisecond)
    }
}

// isEnvTrue 判断环境变量是否为真值（1/true/yes/on）
func isEnvTrue(name string) bool {
    v := strings.TrimSpace(strings.ToLower(os.Getenv(name)))
    switch v {
    case "1", "true", "yes", "on":
        return true
    default:
        return false
    }
}

// runMigrations 执行数据库迁移
// (Go-side DDL removed; Prisma owns DDL now)

// initializeBasicData 初始化基础数据
func (di *DatabaseInitializer) initializeBasicData() error {
	di.logger.Println("初始化基础数据...")

    // 初始化管理员账户
    if err := di.initializeAdminAccount(); err != nil {
        return err
    }

	// 初始化速率限制配置
	if err := di.initializeRateLimitConfigs(); err != nil {
		return err
	}

	// 初始化系统配置
	if err := di.initializeSystemConfigs(); err != nil {
		return err
	}

	di.logger.Println("✅ 基础数据初始化完成")
	return nil
}

// initializeAdminAccount 初始化管理员账户
func (di *DatabaseInitializer) initializeAdminAccount() error {
    // 兼容当前迁移（admin_users 表），而非历史 admin_accounts 表
    table := "admin_users"

    // 检查表是否存在，不存在则跳过（由迁移负责创建）
    if !di.db.Migrator().HasTable(table) {
        di.logger.Printf("表 %s 不存在，跳过管理员初始化", table)
        return nil
    }

    // 检查是否已存在管理员
    var count int64
    if err := di.db.Table(table).Count(&count).Error; err != nil {
        return err
    }

    if count > 0 {
        di.logger.Println("管理员账户已存在，跳过初始化")
        return nil
    }

    // 创建默认管理员（与 000_backend_core_mysql.sql 对齐）
    admin := map[string]interface{}{
        "username":    "admin",
        "password":    "$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi", // bcrypt: password
        "email":       "admin@autoads.com",
        "role":        "super_admin",
        "is_active":   true,
        "last_login_at": nil,
        "created_at":  time.Now(),
        "updated_at":  time.Now(),
    }

    if err := di.db.Table(table).Create(admin).Error; err != nil {
        return err
    }

    di.logger.Println("✅ 默认管理员账户创建成功")
    return nil
}

// initializeRateLimitConfigs 初始化速率限制配置
func (di *DatabaseInitializer) initializeRateLimitConfigs() error {
	// 检查是否已存在配置
	var count int64
	if err := di.db.Table("rate_limit_configs").Count(&count).Error; err != nil {
		return err
	}

	if count > 0 {
		di.logger.Println("速率限制配置已存在，跳过初始化")
		return nil
	}

	// 默认配置
	defaultConfigs := []map[string]interface{}{
		{
			"id":         "rlc_FREE_API",
			"plan":       "FREE",
			"feature":    "API",
			"per_minute": 30,
			"per_hour":   1000,
			"concurrent": 0,
			"is_active":  true,
			"created_at": time.Now(),
			"updated_at": time.Now(),
		},
		{
			"id":         "rlc_FREE_SITE_RANK",
			"plan":       "FREE",
			"feature":    "SITE_RANK",
			"per_minute": 2,
			"per_hour":   50,
			"concurrent": 0,
			"is_active":  true,
			"created_at": time.Now(),
			"updated_at": time.Now(),
		},
		{
			"id":         "rlc_FREE_BATCH",
			"plan":       "FREE",
			"feature":    "BATCH",
			"per_minute": 5,
			"per_hour":   300,
			"concurrent": 1,
			"is_active":  true,
			"created_at": time.Now(),
			"updated_at": time.Now(),
		},
		{
			"id":         "rlc_PRO_API",
			"plan":       "PRO",
			"feature":    "API",
			"per_minute": 100,
			"per_hour":   5000,
			"concurrent": 0,
			"is_active":  true,
			"created_at": time.Now(),
			"updated_at": time.Now(),
		},
		{
			"id":         "rlc_PRO_SITE_RANK",
			"plan":       "PRO",
			"feature":    "SITE_RANK",
			"per_minute": 10,
			"per_hour":   200,
			"concurrent": 0,
			"is_active":  true,
			"created_at": time.Now(),
			"updated_at": time.Now(),
		},
		{
			"id":         "rlc_PRO_BATCH",
			"plan":       "PRO",
			"feature":    "BATCH",
			"per_minute": 20,
			"per_hour":   1200,
			"concurrent": 5,
			"is_active":  true,
			"created_at": time.Now(),
			"updated_at": time.Now(),
		},
		{
			"id":         "rlc_MAX_API",
			"plan":       "MAX",
			"feature":    "API",
			"per_minute": 500,
			"per_hour":   20000,
			"concurrent": 0,
			"is_active":  true,
			"created_at": time.Now(),
			"updated_at": time.Now(),
		},
		{
			"id":         "rlc_MAX_SITE_RANK",
			"plan":       "MAX",
			"feature":    "SITE_RANK",
			"per_minute": 50,
			"per_hour":   1000,
			"concurrent": 0,
			"is_active":  true,
			"created_at": time.Now(),
			"updated_at": time.Now(),
		},
		{
			"id":         "rlc_MAX_BATCH",
			"plan":       "MAX",
			"feature":    "BATCH",
			"per_minute": 100,
			"per_hour":   6000,
			"concurrent": 20,
			"is_active":  true,
			"created_at": time.Now(),
			"updated_at": time.Now(),
		},
	}

	// 批量插入
	for _, config := range defaultConfigs {
		if err := di.db.Table("rate_limit_configs").Create(config).Error; err != nil {
			return err
		}
	}

	di.logger.Println("✅ 速率限制配置初始化完成")
	return nil
}

// initializeSystemConfigs 初始化系统配置
func (di *DatabaseInitializer) initializeSystemConfigs() error {
    // 检查系统配置表是否存在
    if !di.db.Migrator().HasTable("system_configs") {
        di.logger.Println("系统配置表不存在，跳过初始化")
        return nil
    }

	// 检查是否已有配置
	var count int64
	if err := di.db.Table("system_configs").Count(&count).Error; err != nil {
		return err
	}

	if count > 0 {
		di.logger.Println("系统配置已存在，跳过初始化")
		return nil
	}

    // 默认系统配置（与 system_configs 表结构对齐）
    defaultConfigs := []map[string]interface{}{
        {
            "config_key":   "system_name",
            "config_value": "GoFly Admin V3",
            "category":     "system",
            "description":  "系统名称",
            "is_secret":    false,
            "is_active":    true,
            "created_by":   "system",
            "updated_by":   "system",
        },
        {
            "config_key":   "rate_limit_plans",
            "config_value": `{"FREE":{"rps":5,"burst":10},"PRO":{"rps":50,"burst":100},"MAX":{"rps":200,"burst":400}}`,
            "category":     "ratelimit",
            "description":  "按套餐的默认限流配置(JSON)",
            "is_secret":    false,
            "is_active":    true,
            "created_by":   "system",
            "updated_by":   "system",
        },
        {
            "config_key":   "maintenance_mode",
            "config_value": "false",
            "category":     "system",
            "description":  "维护模式",
            "is_secret":    false,
            "is_active":    true,
            "created_by":   "system",
            "updated_by":   "system",
        },
        {
            "config_key":   "max_upload_size",
            "config_value": "10485760",
            "category":     "upload",
            "description":  "最大上传大小（字节）",
            "is_secret":    false,
            "is_active":    true,
            "created_by":   "system",
            "updated_by":   "system",
        },
    }

	// 批量插入
	for _, config := range defaultConfigs {
		if err := di.db.Table("system_configs").Create(config).Error; err != nil {
			return err
		}
	}

	di.logger.Println("✅ 系统配置初始化完成")
	return nil
}

// verifyInitialization 验证初始化结果
func (di *DatabaseInitializer) verifyInitialization() error {
    di.logger.Println("验证初始化结果...")

    // 验证表是否存在
    expectedTables := []string{
        // 与当前迁移集对齐：核心管理与令牌配置
        "admin_users",
        "rate_limit_configs",
        "token_packages",
        "token_consumption_rules",
        "idempotency_requests",
        "_prisma_migrations", // 由 Prisma 维护
    }

	for _, table := range expectedTables {
		if !di.db.Migrator().HasTable(table) {
			return fmt.Errorf("表 %s 不存在", table)
		}
	}

	// 验证数据
	var configCount int64
	if err := di.db.Table("rate_limit_configs").Where("is_active = ?", true).Count(&configCount).Error; err != nil {
		return err
	}

	if configCount == 0 {
		return fmt.Errorf("没有速率限制配置")
	}

	di.logger.Printf("✅ 验证通过：共 %d 个表，%d 条速率限制配置", len(expectedTables), configCount)
	return nil
}

// Close 关闭数据库连接
func (di *DatabaseInitializer) Close() error {
    // 依次关闭 db 与 serverDB
    var firstErr error
    if di.db != nil {
        if sqlDB, err := di.db.DB(); err == nil {
            if err := sqlDB.Close(); err != nil && firstErr == nil { firstErr = err }
        } else if firstErr == nil { firstErr = err }
    }
    if di.serverDB != nil {
        if sqlDB, err := di.serverDB.DB(); err == nil {
            if err := sqlDB.Close(); err != nil && firstErr == nil { firstErr = err }
        } else if firstErr == nil { firstErr = err }
    }
    return firstErr
}

// AutoInitialize 自动初始化数据库
func AutoInitialize() error {
	// 加载配置
	cfg, err := config.Load()
	if err != nil {
		return fmt.Errorf("加载配置失败: %w", err)
	}

	// 创建初始化器
	logger := log.Default()
	logger.SetPrefix("[DB Init] ")

	initializer, err := NewDatabaseInitializer(cfg, logger)
	if err != nil {
		return err
	}
	defer initializer.Close()

	// 执行初始化
	return initializer.Initialize()
}
