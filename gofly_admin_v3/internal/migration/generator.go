package migration

import (
	"fmt"
	"reflect"
	"strings"

	"gofly-admin-v3/utils/gform"
)

// MigrationGenerator 迁移生成器
type MigrationGenerator struct {
	db gform.DB
}

// NewMigrationGenerator 创建迁移生成器
func NewMigrationGenerator(db gform.DB) *MigrationGenerator {
	return &MigrationGenerator{db: db}
}

// GeneratedMigration 生成的迁移
type GeneratedMigration struct {
	TableName   string
	Columns     []ColumnDefinition
	Indexes     []IndexDefinition
	ForeignKeys []ForeignKeyDefinition
}

// ColumnDefinition 列定义
type ColumnDefinition struct {
	Name     string
	Type     string
	Nullable bool
	Default  string
	Comment  string
}

// IndexDefinition 索引定义
type IndexDefinition struct {
	Name    string
	Columns []string
	Unique  bool
}

// ForeignKeyDefinition 外键定义
type ForeignKeyDefinition struct {
	Name           string
	Column         string
	ReferenceTable string
	ReferenceColumn string
	OnDelete       string
}

// ModelMigrationOptions 模型迁移选项
type ModelMigrationOptions struct {
	TableName   string
	DropTable   bool
	SoftDeletes bool
	Timestamps  bool
	AutoID      bool
	Engine      string
	Charset     string
	Collate     string
	Comment     string
}

// GenerateFromModel 从模型生成迁移
func (g *MigrationGenerator) GenerateFromModel(model interface{}, options ModelMigrationOptions) (*GeneratedMigration, error) {
	// 获取模型类型
	val := reflect.ValueOf(model)
	if val.Kind() == reflect.Ptr {
		val = val.Elem()
	}
	
	if val.Kind() != reflect.Struct {
		return nil, fmt.Errorf("model must be a struct or pointer to struct")
	}
	
	// 获取表名
	tableName := options.TableName
	if tableName == "" {
		// 尝试从 TableName 方法获取
		if method := val.MethodByName("TableName"); method.IsValid() {
			results := method.Call(nil)
			if len(results) > 0 {
				tableName = results[0].String()
			}
		}
		
		// 如果还是没有，使用结构体名称的复数形式
		if tableName == "" {
			tableName = strings.ToLower(val.Type().Name()) + "s"
		}
	}
	
	// 解析结构体字段
	columns := make([]ColumnDefinition, 0)
	typ := val.Type()
	
	for i := 0; i < typ.NumField(); i++ {
		field := typ.Field(i)
		
		// 跳过非导出字段
		if !field.IsExported() {
			continue
		}
		
		// 解析 gorm 标签
		columnName := field.Tag.Get("gorm")
		if columnName == "" {
			columnName = strings.ToLower(field.Name)
		} else {
			// 解析 column 名称
			parts := strings.Split(columnName, ";")
			for _, part := range parts {
				if strings.HasPrefix(part, "column:") {
					columnName = strings.TrimPrefix(part, "column:")
					break
				}
			}
		}
		
		// 跳过特定字段
		if columnName == "-" || columnName == "gorm" {
			continue
		}
		
		// 确定列类型
		var columnType string
		switch field.Type.Kind() {
		case reflect.String:
			columnType = "VARCHAR(255)"
		case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
			if field.Type.Name() == "Time" {
				columnType = "TIMESTAMP"
			} else {
				columnType = "BIGINT"
			}
		case reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64:
			columnType = "BIGINT UNSIGNED"
		case reflect.Float32, reflect.Float64:
			columnType = "DOUBLE"
		case reflect.Bool:
			columnType = "BOOLEAN"
		default:
			if field.Type.Name() == "Time" {
				columnType = "TIMESTAMP"
			} else {
				columnType = "TEXT"
			}
		}
		
		// 检查是否可为空
		nullable := true
		if strings.Contains(field.Tag.Get("gorm"), "not null") {
			nullable = false
		}
		
		// 获取默认值
		var defaultValue string
		if strings.Contains(field.Tag.Get("gorm"), "default:") {
			parts := strings.Split(field.Tag.Get("gorm"), ";")
			for _, part := range parts {
				if strings.HasPrefix(part, "default:") {
					defaultValue = strings.TrimPrefix(part, "default:")
					break
				}
			}
		}
		
		columns = append(columns, ColumnDefinition{
			Name:     columnName,
			Type:     columnType,
			Nullable: nullable,
			Default:  defaultValue,
		})
	}
	
	// 添加时间戳字段
	if options.Timestamps {
		columns = append(columns,
			ColumnDefinition{
				Name:     "created_at",
				Type:     "TIMESTAMP",
				Nullable: false,
				Default:  "CURRENT_TIMESTAMP",
			},
			ColumnDefinition{
				Name:     "updated_at",
				Type:     "TIMESTAMP",
				Nullable: false,
				Default:  "CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP",
			},
		)
	}
	
	// 添加软删除字段
	if options.SoftDeletes {
		columns = append(columns,
			ColumnDefinition{
				Name:     "deleted_at",
				Type:     "TIMESTAMP",
				Nullable: true,
			},
		)
	}
	
	// 添加自增ID字段
	if options.AutoID {
		columns = append([]ColumnDefinition{
			{
				Name:     "id",
				Type:     "BIGINT UNSIGNED",
				Nullable: false,
			},
		}, columns...)
	}
	
	return &GeneratedMigration{
		TableName: tableName,
		Columns:   columns,
		Indexes:   []IndexDefinition{},
		ForeignKeys: []ForeignKeyDefinition{},
	}, nil
}

// GenerateMigrationCode 生成迁移代码
func (g *GeneratedMigration) GenerateMigrationCode() string {
	var builder strings.Builder
	
	// 生成 Up 方法
	builder.WriteString("func (m *Migration) Up(db gform.DB) error {\n")
	builder.WriteString("\treturn db.Exec(context.Background(), `\n")
	builder.WriteString("\t\tCREATE TABLE IF NOT EXISTS " + g.TableName + " (\n")
	
	for i, col := range g.Columns {
		builder.WriteString("\t\t\t" + col.Name + " " + col.Type)
		if !col.Nullable {
			builder.WriteString(" NOT NULL")
		}
		if col.Default != "" {
			builder.WriteString(" DEFAULT " + col.Default)
		}
		if i < len(g.Columns)-1 {
			builder.WriteString(",\n")
		} else {
			builder.WriteString("\n")
		}
	}
	
	builder.WriteString("\t\t)\n")
	builder.WriteString("\t\tENGINE=" + "InnoDB" + " DEFAULT CHARSET=" + "utf8mb4" + " COLLATE=" + "utf8mb4_unicode_ci" + "\n")
	builder.WriteString("\t`)\n")
	builder.WriteString("}\n\n")
	
	// 生成 Down 方法
	builder.WriteString("func (m *Migration) Down(db gform.DB) error {\n")
	builder.WriteString("\treturn db.Exec(context.Background(), `DROP TABLE IF EXISTS " + g.TableName + "`)\n")
	builder.WriteString("}\n")
	
	return builder.String()
}