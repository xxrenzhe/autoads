package cmd

import (
	"flag"
	"fmt"
	"os"

	"gofly-admin-v3/internal/migration"
	"gofly-admin-v3/utils/gf"
)

// MigrateCommand 迁移命令
type MigrateCommand struct {
}

// NewMigrateCommand 创建迁移命令
func NewMigrateCommand() *MigrateCommand {
	return &MigrateCommand{}
}

// Run 执行命令
func (c *MigrateCommand) Run(args []string) {
	// 解析命令行参数
	fs := flag.NewFlagSet("migrate", flag.ExitOnError)

	var (
		direction   = fs.String("direction", "up", "Migration direction (up/down)")
		step        = fs.Int("step", 0, "Number of migrations to run/rollback")
		version     = fs.String("version", "", "Target version")
		dryRun      = fs.Bool("dry-run", false, "Dry run mode")
		force       = fs.Bool("force", false, "Force migration")
		verbose     = fs.Bool("verbose", false, "Verbose output")
		environment = fs.String("env", gf.GetConfig("app.env").(string), "Environment (development/staging/production)")
		create      = fs.String("create", "", "Create new migration")
		type_       = fs.String("type", "generic", "Migration type (create_table/add_column/drop_table/raw_sql/generic)")
		status      = fs.Bool("status", false, "Show migration status")
	)

	if err := fs.Parse(args); err != nil {
		fmt.Printf("Error parsing flags: %v\n", err)
		os.Exit(1)
	}

	// 获取数据库连接
	db := gf.DB()
	if db == nil {
		fmt.Println("Database connection not initialized")
		os.Exit(1)
	}

	// 创建迁移管理器
	migrationDir := gf.GetConfig("migration.dir")
	if migrationDir == nil {
		migrationDir = "migrations"
	}

	manager := migration.NewMigrationManager(db, migrationDir.(string))

	// 初始化
	if err := manager.Initialize(); err != nil {
		fmt.Printf("Failed to initialize migration manager: %v\n", err)
		os.Exit(1)
	}

	// 处理不同的子命令
	if *create != "" {
		// 创建新迁移
		if err := manager.CreateMigration(*create, *type_); err != nil {
			fmt.Printf("Failed to create migration: %v\n", err)
			os.Exit(1)
		}
		fmt.Printf("Migration created successfully: %s\n", *create)
		return
	}

	if *status {
		// 显示状态
		status := manager.Status()
		c.printStatus(status)
		return
	}

	// 构建迁移选项
	options := migration.MigrationOptions{
		DryRun:      *dryRun,
		Force:       *force,
		Step:        *step,
		ToVersion:   *version,
		Environment: *environment,
		Verbose:     *verbose,
	}

	// 执行迁移
	switch *direction {
	case "up":
		if err := manager.Migrate(options); err != nil {
			fmt.Printf("Migration failed: %v\n", err)
			os.Exit(1)
		}
		fmt.Println("Migration completed successfully")
	case "down":
		if err := manager.Rollback(options); err != nil {
			fmt.Printf("Rollback failed: %v\n", err)
			os.Exit(1)
		}
		fmt.Println("Rollback completed successfully")
	default:
		fmt.Printf("Invalid direction: %s\n", *direction)
		os.Exit(1)
	}
}

// printStatus 打印迁移状态
func (c *MigrateCommand) printStatus(status gf.Map) {
	fmt.Println("\nMigration Status:")
	fmt.Println("=================")

	pending := status["pending"].([]string)
	completed := status["completed"].([]migration.MigrationHistory)
	failed := status["failed"].([]migration.MigrationHistory)
	total := status["total"].(int)

	fmt.Printf("\nTotal migrations: %d\n", total)
	fmt.Printf("Pending: %d\n", len(pending))
	fmt.Printf("Completed: %d\n", len(completed))
	fmt.Printf("Failed: %d\n", len(failed))

	if len(pending) > 0 {
		fmt.Println("\nPending migrations:")
		for _, id := range pending {
			fmt.Printf("  - %s\n", id)
		}
	}

	if len(failed) > 0 {
		fmt.Println("\nFailed migrations:")
		for _, h := range failed {
			fmt.Printf("  - %s (%s): %s\n", h.ID, h.Version, h.Error)
		}
	}

	if len(completed) > 0 {
		fmt.Println("\nRecent completed migrations:")
		limit := 5
		if len(completed) < limit {
			limit = len(completed)
		}
		for i := 0; i < limit; i++ {
			h := completed[i]
			fmt.Printf("  - %s (%s) at %s (%dms)\n", h.ID, h.Version, h.ExecutedAt.Format("2006-01-02 15:04:05"), h.ExecutionTime)
		}
	}
}

// RegisterMigrationCommand 注册迁移命令
func RegisterMigrationCommand() {
	// gf.RegisterCommand("migrate", NewMigrateCommand())
	// TODO: 实现命令注册
}
