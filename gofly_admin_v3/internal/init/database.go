package init

import (
    "context"
    "embed"
    "fmt"
    "log"
    "net"
    "regexp"
    "sort"
    "strings"
    "time"
    "os"

	"gofly-admin-v3/internal/config"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

//go:embed migrations/*.sql
var migrationFS embed.FS

// DatabaseInitializer 数据库初始化器
type DatabaseInitializer struct {
	db     *gorm.DB
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

    db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{
        Logger: logger.Default.LogMode(logger.Warn),
    })
    if err != nil {
        return nil, fmt.Errorf("连接数据库失败: %w", err)
    }

    // 轻量 Ping，避免长等待
    if sqlDB, e := db.DB(); e == nil {
        sqlDB.SetMaxIdleConns(10)
        sqlDB.SetMaxOpenConns(100)
        sqlDB.SetConnMaxLifetime(30 * time.Minute)
        ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
        defer cancel()
        _ = sqlDB.PingContext(ctx)
    }

    return &DatabaseInitializer{
        db:     db,
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
    skipMigrate := isEnvTrue("SKIP_MIGRATIONS") || isEnvTrue("INIT_SKIP_MIGRATIONS")
    skipSeed := isEnvTrue("SKIP_SEED") || isEnvTrue("SKIP_BASIC_DATA")
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

    // 3. 执行迁移
    progressTracker.UpdateProgress("执行数据库迁移")
    start = time.Now()
    if !skipMigrate {
        if err := di.runMigrations(); err != nil {
            if initLogger != nil {
                initLogger.LogError("migration", "执行迁移失败", err)
            }
            progressTracker.Fail(err)
            return fmt.Errorf("执行迁移失败: %w", err)
        }
        if initLogger != nil {
            initLogger.LogWithDuration("INFO", "migration", "数据库迁移完成", time.Since(start), true)
        }
    } else if initLogger != nil {
        initLogger.Log("INFO", "migration", "跳过数据库迁移（按环境变量）")
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
        if err := di.db.Exec(fmt.Sprintf("DROP DATABASE IF EXISTS `%s`", dbName)).Error; err != nil {
            return fmt.Errorf("删除数据库失败: %w", err)
        }
    }

    // 检查数据库是否存在（使用计数更稳妥避免类型转换问题）
    var count int64
    err := di.db.Raw("SELECT COUNT(*) FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?", dbName).Scan(&count).Error
    if err != nil {
        return err
    }

    if count == 0 {
        di.logger.Printf("创建数据库: %s", dbName)
        sql := fmt.Sprintf("CREATE DATABASE `%s` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci", dbName)
        if err := di.db.Exec(sql).Error; err != nil {
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
func (di *DatabaseInitializer) runMigrations() error {
	di.logger.Println("执行数据库迁移...")

	// 获取迁移文件
	migrations, err := di.getMigrationFiles()
	if err != nil {
		return err
	}

	if len(migrations) == 0 {
		di.logger.Println("没有找到迁移文件")
		return nil
	}

    // 按文件名排序，并对关键迁移文件施加优先级（确保 users 表先于依赖它的迁移）
    sort.Strings(migrations)
    priorities := map[string]int{
        "001_create_users_tables.sql":      -100,
        "001_create_saas_tables.sql":      -50,
        "003_create_chengelink_tables.sql": -40,
    }
    sort.SliceStable(migrations, func(i, j int) bool {
        wi := priorities[migrations[i]]
        wj := priorities[migrations[j]]
        if wi != wj {
            return wi < wj
        }
        return migrations[i] < migrations[j]
    })

	// 创建迁移记录表
	if err := di.createMigrationsTable(); err != nil {
		return err
	}

	// 执行每个迁移文件
	for _, migration := range migrations {
		if err := di.runMigration(migration); err != nil {
			return fmt.Errorf("执行迁移 %s 失败: %w", migration, err)
		}
	}

	di.logger.Println("✅ 数据库迁移完成")
	return nil
}

// getMigrationFiles 获取迁移文件列表
func (di *DatabaseInitializer) getMigrationFiles() ([]string, error) {
	var migrations []string

	entries, err := migrationFS.ReadDir("migrations")
	if err != nil {
		return nil, err
	}

	for _, entry := range entries {
		if !entry.IsDir() && strings.HasSuffix(entry.Name(), ".sql") {
			migrations = append(migrations, entry.Name())
		}
	}

	return migrations, nil
}

// createMigrationsTable 创建迁移记录表
func (di *DatabaseInitializer) createMigrationsTable() error {
	sql := `
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version VARCHAR(255) PRIMARY KEY,
			applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		)
	`
	return di.db.Exec(sql).Error
}

// runMigration 执行单个迁移文件
func (di *DatabaseInitializer) runMigration(filename string) error {
	// 检查是否已执行
	var applied bool
	err := di.db.Model(&struct{}{}).
		Table("schema_migrations").
		Select("COUNT(*) > 0").
		Where("version = ?", filename).
		Scan(&applied).Error

	if err != nil {
		return err
	}

	if applied {
		di.logger.Printf("迁移 %s 已执行，跳过", filename)
		return nil
	}

    // 读取迁移文件内容
    content, err := migrationFS.ReadFile("migrations/" + filename)
    if err != nil {
        return err
    }

    di.logger.Printf("执行迁移: %s", filename)

    // 为了兼容较低版本 MySQL/MariaDB，不支持 "ADD COLUMN IF NOT EXISTS"、"CREATE INDEX IF NOT EXISTS"
    // 将迁移 SQL 拆分并进行条件处理
    statements := splitSQLStatements(string(content))
    for _, stmt := range statements {
        s := strings.TrimSpace(stmt)
        if s == "" {
            continue
        }

        handled, err := di.handleCompatibilityStatements(s)
        if err != nil {
            return err
        }
        if handled {
            continue
        }

        if err := di.db.Exec(s).Error; err != nil {
            return err
        }
    }

	// 记录迁移
	return di.db.Table("schema_migrations").Create(map[string]interface{}{
		"version": filename,
	}).Error
}

// splitSQLStatements 粗略按分号拆分 SQL 语句（忽略简单换行与空白）
func splitSQLStatements(sql string) []string {
    // 简化处理：按分号分割
    parts := strings.Split(sql, ";")
    var res []string
    for _, p := range parts {
        t := strings.TrimSpace(p)
        if t == "" {
            continue
        }
        res = append(res, t)
    }
    return res
}

// stripLeadingSQLComments removes leading SQL comments ("-- ..." and /* ... */)
// and whitespace so prefix detection works regardless of comment headers.
func stripLeadingSQLComments(s string) string {
    t := strings.TrimSpace(s)
    for {
        t = strings.TrimLeft(t, " \t\r\n")
        if t == "" {
            return t
        }
        // Line comment: -- ...\n
        if strings.HasPrefix(t, "--") {
            if idx := strings.IndexByte(t, '\n'); idx >= 0 {
                t = t[idx+1:]
                continue
            }
            // Only comments remaining
            return ""
        }
        // Block comment: /* ... */
        if strings.HasPrefix(t, "/*") {
            if idx := strings.Index(t, "*/"); idx >= 0 {
                t = t[idx+2:]
                continue
            }
            // Unclosed comment; treat as empty
            return ""
        }
        break
    }
    return strings.TrimLeft(t, " \t\r\n")
}

// handleCompatibilityStatements 处理不兼容的 IF NOT EXISTS 语法，返回是否已处理
func (di *DatabaseInitializer) handleCompatibilityStatements(stmt string) (bool, error) {
    // Strip leading comments so detection works with commented headers
    cleaned := stripLeadingSQLComments(stmt)
    upper := strings.ToUpper(strings.TrimSpace(cleaned))
    // 处理 CREATE INDEX IF NOT EXISTS
    if strings.HasPrefix(upper, "CREATE INDEX IF NOT EXISTS") {
        // CREATE INDEX IF NOT EXISTS idx ON table (cols)
        re := regexp.MustCompile(`(?is)^CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+([`+"`"+`\w]+)\s+ON\s+([`+"`"+`\w\.]+)\s*\((.+)\)$`)
        m := re.FindStringSubmatch(cleaned)
        if len(m) == 4 {
            idx := strings.Trim(m[1], "`")
            tbl := strings.Trim(m[2], "`")
            cols := m[3]
            // 检查索引是否存在
            if di.db.Migrator().HasIndex(tbl, idx) {
                di.logger.Printf("索引 %s 已存在于表 %s，跳过创建", idx, tbl)
                return true, nil
            }
            q := fmt.Sprintf("CREATE INDEX %s ON %s (%s)", idx, tbl, cols)
            return true, di.db.Exec(q).Error
        }
        // 无法解析则回退让上层执行（可能不会命中这条分支）
        return false, nil
    }

    // 处理 ALTER TABLE ... 包含 ADD COLUMN IF NOT EXISTS / ADD INDEX IF NOT EXISTS
    if strings.HasPrefix(upper, "ALTER TABLE ") && strings.Contains(upper, "IF NOT EXISTS") {
        // 提取表名
        reTbl := regexp.MustCompile(`(?i)^ALTER\s+TABLE\s+([`+"`"+`\w\.]+)\s`)
        mt := reTbl.FindStringSubmatch(cleaned)
        if len(mt) < 2 {
            return false, nil
        }
        tbl := strings.Trim(mt[1], "`")

        // 按行拆分处理 ADD COLUMN IF NOT EXISTS 与 ADD INDEX IF NOT EXISTS
        lines := strings.Split(cleaned, "\n")
        var leftovers []string
        // ADD COLUMN IF NOT EXISTS <col> <def>
        reAddCol := regexp.MustCompile(`(?i)ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+([`+"`"+`\w]+)\s+(.*?)(,)?\s*$`)
        // ADD INDEX IF NOT EXISTS idx_name (cols)
        reAddIdx := regexp.MustCompile(`(?i)ADD\s+INDEX\s+IF\s+NOT\s+EXISTS\s+([`+"`"+`\w]+)\s*\((.+)\)\s*,?\s*$`)

        for _, raw := range lines {
            l := strings.TrimSpace(raw)
            if l == "" || strings.HasPrefix(l, "--") {
                continue
            }
            if m := reAddCol.FindStringSubmatch(l); len(m) > 0 {
                col := strings.Trim(m[1], "`")
                def := strings.TrimSpace(m[2])
                def = strings.TrimSuffix(def, ",")
                // 检查列
                if di.db.Migrator().HasColumn(tbl, col) {
                    di.logger.Printf("表 %s 列 %s 已存在，跳过添加", tbl, col)
                    continue
                }
                q := fmt.Sprintf("ALTER TABLE %s ADD COLUMN %s %s", tbl, col, def)
                if err := di.db.Exec(q).Error; err != nil {
                    return true, err
                }
                continue
            }
            if m := reAddIdx.FindStringSubmatch(l); len(m) > 0 {
                idx := strings.Trim(m[1], "`")
                cols := m[2]
                if di.db.Migrator().HasIndex(tbl, idx) {
                    di.logger.Printf("索引 %s 已存在于表 %s，跳过添加", idx, tbl)
                    continue
                }
                q := fmt.Sprintf("CREATE INDEX %s ON %s (%s)", idx, tbl, cols)
                if err := di.db.Exec(q).Error; err != nil {
                    return true, err
                }
                continue
            }
            // 保留其他（如 MODIFY COLUMN ...）
            // 去掉尾部逗号，稍后重新拼装
            leftovers = append(leftovers, strings.TrimSuffix(l, ","))
        }

        // 执行剩余修改（如果有）
        var realOps []string
        reModify := regexp.MustCompile(`(?i)^MODIFY\s+COLUMN\s+([`+"`"+`\w]+)\b`)
        for _, op := range leftovers {
            u := strings.ToUpper(op)
            if strings.HasPrefix(u, "ALTER TABLE") || u == "" {
                continue
            }
            // 跳过以 ADD COLUMN IF NOT EXISTS / ADD INDEX IF NOT EXISTS 开头的行（已处理）
            if strings.Contains(u, "ADD COLUMN IF NOT EXISTS") || strings.Contains(u, "ADD INDEX IF NOT EXISTS") {
                continue
            }
            // 对 MODIFY COLUMN 做存在性检查，列不存在则跳过
            if strings.HasPrefix(u, "MODIFY COLUMN ") {
                mm := reModify.FindStringSubmatch(op)
                if len(mm) > 1 {
                    col := strings.Trim(mm[1], "`")
                    if !di.db.Migrator().HasColumn(tbl, col) {
                        di.logger.Printf("表 %s 列 %s 不存在，跳过 MODIFY", tbl, col)
                        continue
                    }
                }
            }
            // 只拼接以 MODIFY/CHANGE/ADD COLUMN(不带 IF NOT EXISTS) 等安全操作
            realOps = append(realOps, op)
        }
        if len(realOps) > 0 {
            q := fmt.Sprintf("ALTER TABLE %s \n%s", tbl, strings.Join(realOps, ",\n"))
            if err := di.db.Exec(q).Error; err != nil {
                return true, err
            }
        }
        return true, nil
    }

    return false, nil
}

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
        "schema_migrations",
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
	sqlDB, err := di.db.DB()
	if err != nil {
		return err
	}
	return sqlDB.Close()
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
