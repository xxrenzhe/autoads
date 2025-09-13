package cmd

import (
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"path/filepath"

	"gofly-admin-v3/internal/migration"
	"gofly-admin-v3/utils/gf"
)

// ModelMigrateCommand 模型迁移命令
type ModelMigrateCommand struct {
}

// NewModelMigrateCommand 创建模型迁移命令
func NewModelMigrateCommand() *ModelMigrateCommand {
	return &ModelMigrateCommand{}
}

// Run 执行命令
func (c *ModelMigrateCommand) Run(args []string) {
	// 解析命令行参数
	// flagSet := gf.NewFlagSet()
	flagSet := flag.NewFlagSet("model-migrate", flag.ExitOnError)

	var (
		model      = flagSet.String("model", "", "Model name (required)")
		table      = flagSet.String("table", "", "Table name (optional)")
		path       = flagSet.String("path", "migrations", "Migration directory")
		package_   = flagSet.String("package", "migrations", "Package name")
		drop       = flagSet.Bool("drop", false, "Generate drop table migration")
		softDelete = flagSet.Bool("soft-delete", true, "Enable soft deletes")
		timestamps = flagSet.Bool("timestamps", true, "Enable timestamps")
		autoID     = flagSet.Bool("auto-id", true, "Enable auto ID")
		engine     = flagSet.String("engine", "InnoDB", "Table engine")
		charset    = flagSet.String("charset", "utf8mb4", "Table charset")
		collate    = flagSet.String("collate", "utf8mb4_unicode_ci", "Table collation")
		comment    = flagSet.String("comment", "", "Table comment")
		config     = flagSet.String("config", "", "JSON config file for custom options")
		force      = flagSet.Bool("force", false, "Overwrite existing migration")
	)

	flagSet.Parse(args)

	// 验证必需参数
	if *model == "" {
		fmt.Println("Error: model name is required")
		os.Exit(1)
	}

	// 获取数据库连接
	db := gf.DB()
	if db == nil {
		fmt.Println("Error: database connection not initialized")
		os.Exit(1)
	}

	// 加载模型
	modelInstance, err := c.loadModel(*model)
	if err != nil {
		fmt.Printf("Error loading model: %v\n", err)
		os.Exit(1)
	}

	// 构建迁移选项
	options := migration.ModelMigrationOptions{
		TableName:   *table,
		DropTable:   *drop,
		SoftDeletes: *softDelete,
		Timestamps:  *timestamps,
		AutoID:      *autoID,
		Engine:      *engine,
		Charset:     *charset,
		Collate:     *collate,
		Comment:     *comment,
	}

	// 如果有配置文件，加载自定义选项
	if *config != "" {
		if err := c.loadConfig(*config, &options); err != nil {
			fmt.Printf("Error loading config: %v\n", err)
			os.Exit(1)
		}
	}

	// 生成迁移
	generator := migration.NewMigrationGenerator(db)
	genMigration, err := generator.GenerateFromModel(modelInstance, options)
	if err != nil {
		fmt.Printf("Error generating migration: %v\n", err)
		os.Exit(1)
	}

	// 生成迁移代码
	migrationCode := genMigration.GenerateMigrationCode()

	// 生成文件名
	timestamp := gf.Now().Format("20060102150405")
	action := "create"
	if *drop {
		action = "drop"
	}
	filename := fmt.Sprintf("%s_%s_%s.go", timestamp, action, genMigration.TableName)
	filepath := filepath.Join(*path, filename)

	// 检查文件是否存在
	if _, err := os.Stat(filepath); err == nil && !*force {
		fmt.Printf("Error: migration file already exists: %s\n", filepath)
		fmt.Println("Use --force to overwrite")
		os.Exit(1)
	}

	// 创建目录
	if err := os.MkdirAll(*path, 0755); err != nil {
		fmt.Printf("Error creating directory: %v\n", err)
		os.Exit(1)
	}

	// 写入文件
	if err := os.WriteFile(filepath, []byte(migrationCode), 0644); err != nil {
		fmt.Printf("Error writing migration file: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("Migration generated successfully: %s\n", filepath)
	fmt.Printf("Table: %s\n", genMigration.TableName)
	fmt.Printf("Columns: %d\n", len(genMigration.Columns))
	fmt.Printf("Indexes: %d\n", len(genMigration.Indexes))
	fmt.Printf("Foreign keys: %d\n", len(genMigration.ForeignKeys))
}

// loadModel 加载模型
func (c *ModelMigrateCommand) loadModel(modelName string) (interface{}, error) {
	// 这里需要根据实际项目结构加载模型
	// 由于Go的限制，无法完全动态加载，这里返回一个示例
	return nil, fmt.Errorf("model loading not implemented in this example")
}

// loadConfig 加载配置文件
func (c *ModelMigrateCommand) loadConfig(configPath string, options *migration.ModelMigrationOptions) error {
	data, err := os.ReadFile(configPath)
	if err != nil {
		return err
	}

	return json.Unmarshal(data, options)
}

// RegisterModelMigrateCommand 注册模型迁移命令
func RegisterModelMigrateCommand() {
	// gf.RegisterCommand("model:migrate", NewModelMigrateCommand())
	// TODO: 实现命令注册
}
