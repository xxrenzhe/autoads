package migration

import (
	"fmt"
	"reflect"
	"strings"

	"gofly-admin-v3/utils/gf"
	"gofly-admin-v3/utils/gform"
)

// MigrationGenerator 迁移生成器
type MigrationGenerator struct {
	db *gform.DB
}

// NewMigrationGenerator 创建迁移生成器
func NewMigrationGenerator(db *gform.DB) *MigrationGenerator {
	return &MigrationGenerator{db: db}
}

// GenerateFromModel 从模型生成迁移
func (g *MigrationGenerator) GenerateFromModel(model interface{}, options ModelMigrationOptions) (*GeneratedMigration, error) {
	modelType := reflect.TypeOf(model)
	if modelType.Kind() == reflect.Ptr {
		modelType = modelType.Elem()
	}

	if modelType.Kind() != reflect.Struct {
		return nil, fmt.Errorf("model must be a struct")
	}

	// 获取表名
	tableName := options.TableName
	if tableName == "" {
		tableName = gf.GetTableName(model)
		if tableName == "" {
			tableName = strings.ToLower(modelType.Name()) + "s"
		}
	}

	// 生成列定义
	columns, err := g.generateColumns(modelType)
	if err != nil {
		return nil, err
	}

	// 生成索引
	indexes := g.generateIndexes(modelType, tableName)

	// 生成外键
	foreignKeys := g.generateForeignKeys(modelType, tableName)

	// 生成迁移代码
	migration := &GeneratedMigration{
		TableName:   tableName,
		Columns:     columns,
		Indexes:     indexes,
		ForeignKeys: foreignKeys,
		Options:     options,
	}

	return migration, nil
}

// ModelMigrationOptions 模型迁移选项
type ModelMigrationOptions struct {
	TableName         string                      `json:"table_name"`
	DropTable         bool                        `json:"drop_table"`
	SoftDeletes       bool                        `json:"soft_deletes"`
	Timestamps        bool                        `json:"timestamps"`
	AutoID            bool                        `json:"auto_id"`
	Engine            string                      `json:"engine"`
	Charset           string                      `json:"charset"`
	Collate           string                      `json:"collate"`
	Comment           string                      `json:"comment"`
	CustomColumns     map[string]ColumnDefinition `json:"custom_columns"`
	CustomIndexes     []IndexDefinition           `json:"custom_indexes"`
	CustomForeignKeys []ForeignKeyDefinition      `json:"custom_foreign_keys"`
}

// ColumnDefinition 列定义
type ColumnDefinition struct {
	Name     string      `json:"name"`
	Type     string      `json:"type"`
	Null     bool        `json:"null"`
	Default  interface{} `json:"default"`
	Comment  string      `json:"comment"`
	Extra    string      `json:"extra"`
	AutoInc  bool        `json:"auto_increment"`
	Unsigned bool        `json:"unsigned"`
}

// IndexDefinition 索引定义
type IndexDefinition struct {
	Name    string   `json:"name"`
	Columns []string `json:"columns"`
	Unique  bool     `json:"unique"`
	Type    string   `json:"type"` // BTREE, HASH, FULLTEXT, SPATIAL
	Comment string   `json:"comment"`
}

// ForeignKeyDefinition 外键定义
type ForeignKeyDefinition struct {
	Name      string `json:"name"`
	Column    string `json:"column"`
	Reference string `json:"reference"`
	OnDelete  string `json:"on_delete"`
	OnUpdate  string `json:"on_update"`
}

// GeneratedMigration 生成的迁移
type GeneratedMigration struct {
	TableName   string                 `json:"table_name"`
	Columns     []ColumnDefinition     `json:"columns"`
	Indexes     []IndexDefinition      `json:"indexes"`
	ForeignKeys []ForeignKeyDefinition `json:"foreign_keys"`
	Options     ModelMigrationOptions  `json:"options"`
}

// GenerateMigrationCode 生成迁移代码
func (g *GeneratedMigration) GenerateMigrationCode() string {
	var builder strings.Builder

	// 生成头部
	builder.WriteString("package migrations\n\n")
	builder.WriteString("import (\n")
	builder.WriteString("\t\"gofly-admin-v3/utils/gform\"\n")
	builder.WriteString(")\n\n")

	// 生成结构体
	className := strings.Title(g.TableName) + "Migration"
	builder.WriteString(fmt.Sprintf("type %s struct{}\n\n", className))

	// 生成ID方法
	timestamp := gf.Now().Format("20060102150405")
	migrationID := fmt.Sprintf("%s_create_%s", timestamp, g.TableName)
	builder.WriteString(fmt.Sprintf("func (m *%s) ID() string {\n", className))
	builder.WriteString(fmt.Sprintf("\treturn \"%s\"\n", migrationID))
	builder.WriteString("}\n\n")

	// 生成Name方法
	builder.WriteString(fmt.Sprintf("func (m *%s) Name() string {\n", className))
	builder.WriteString(fmt.Sprintf("\treturn \"Create %s table\"\n", g.TableName))
	builder.WriteString("}\n\n")

	// 生成Description方法
	builder.WriteString(fmt.Sprintf("func (m *%s) Description() string {\n", className))
	builder.WriteString(fmt.Sprintf("\treturn \"Create %s table with GoFly model columns\"\n", g.TableName))
	builder.WriteString("}\n\n")

	// 生成Version方法
	builder.WriteString(fmt.Sprintf("func (m *%s) Version() string {\n", className))
	builder.WriteString("\treturn \"1.0.0\"\n")
	builder.WriteString("}\n\n")

	// 生成Author方法
	builder.WriteString(fmt.Sprintf("func (m *%s) Author() string {\n", className))
	builder.WriteString("\treturn \"GoFly Generator\"\n")
	builder.WriteString("}\n\n")

	// 生成Up方法
	builder.WriteString(fmt.Sprintf("func (m *%s) Up(db *gform.DB) error {\n", className))
	builder.WriteString("\treturn db.Exec(`\n")
	builder.WriteString(g.generateCreateTableSQL())
	builder.WriteString("\t`).Error\n")
	builder.WriteString("}\n\n")

	// 生成Down方法
	builder.WriteString(fmt.Sprintf("func (m *%s) Down(db *gform.DB) error {\n", className))
	builder.WriteString(fmt.Sprintf("\treturn db.Exec(\"DROP TABLE IF EXISTS %s\").Error\n", g.TableName))
	builder.WriteString("}\n\n")

	// 生成其他必需方法
	builder.WriteString(g.generateRequiredMethods(className))

	return builder.String()
}

// generateCreateTableSQL 生成创建表SQL
func (g *GeneratedMigration) generateCreateTableSQL() string {
	var builder strings.Builder

	builder.WriteString(fmt.Sprintf("CREATE TABLE IF NOT EXISTS %s (\n", g.TableName))

	// 添加列
	columnDefs := make([]string, 0, len(g.Columns))
	for _, col := range g.Columns {
		columnDefs = append(columnDefs, g.generateColumnSQL(col))
	}

	// 添加主键
	if !g.hasPrimaryKey() {
		pkName := "id"
		if g.Options.AutoID {
			columnDefs = append([]string{fmt.Sprintf("%s VARCHAR(36) PRIMARY KEY", pkName)}, columnDefs...)
		}
	}

	builder.WriteString(strings.Join(columnDefs, ",\n"))
	builder.WriteString("\n)")

	// 添加表选项
	if g.Options.Engine != "" {
		builder.WriteString(fmt.Sprintf(" ENGINE=%s", g.Options.Engine))
	}

	if g.Options.Charset != "" {
		builder.WriteString(fmt.Sprintf(" DEFAULT CHARSET=%s", g.Options.Charset))
	}

	if g.Options.Collate != "" {
		builder.WriteString(fmt.Sprintf(" COLLATE=%s", g.Options.Collate))
	}

	if g.Options.Comment != "" {
		builder.WriteString(fmt.Sprintf(" COMMENT='%s'", g.Options.Comment))
	}

	return builder.String()
}

// generateColumnSQL 生成列SQL
func (g *GeneratedMigration) generateColumnSQL(col ColumnDefinition) string {
	var builder strings.Builder

	builder.WriteString(col.Name)
	builder.WriteString(" ")
	builder.WriteString(col.Type)

	if col.Unsigned {
		builder.WriteString(" UNSIGNED")
	}

	if !col.Null {
		builder.WriteString(" NOT NULL")
	}

	if col.Default != nil {
		builder.WriteString(" DEFAULT ")
		if s, ok := col.Default.(string); ok {
			builder.WriteString(fmt.Sprintf("'%s'", s))
		} else {
			builder.WriteString(fmt.Sprintf("%v", col.Default))
		}
	}

	if col.AutoInc {
		builder.WriteString(" AUTO_INCREMENT")
	}

	if col.Extra != "" {
		builder.WriteString(" ")
		builder.WriteString(col.Extra)
	}

	if col.Comment != "" {
		builder.WriteString(fmt.Sprintf(" COMMENT '%s'", col.Comment))
	}

	return builder.String()
}

// hasPrimaryKey 检查是否有主键
func (g *GeneratedMigration) hasPrimaryKey() bool {
	for _, col := range g.Columns {
		if strings.Contains(col.Extra, "PRIMARY KEY") {
			return true
		}
	}
	return false
}

// generateRequiredMethods 生成必需方法
func (g *GeneratedMigration) generateRequiredMethods(className string) string {
	template := `func (m *%s) Dependencies() []string {
	return []string{}
}

func (m *%s) Environment() string {
	return ""
}

func (m *%s) BeforeUp(db *gform.DB) error {
	return nil
}

func (m *%s) AfterUp(db *gform.DB) error {
	// 创建索引
	%s
	
	// 创建外键
	%s
	
	return nil
}

func (m *%s) BeforeDown(db *gform.DB) error {
	return nil
}

func (m *%s) AfterDown(db *gform.DB) error {
	return nil
}

func (m *%s) Validate(db *gform.DB) error {
	return nil
}
`

	// 生成索引创建代码
	indexCode := ""
	if len(g.Indexes) > 0 {
		for _, idx := range g.Indexes {
			indexCode += fmt.Sprintf("\tdb.Exec(\"CREATE %s INDEX idx_%s ON %s (%s)\")\n",
				map[bool]string{true: "UNIQUE", false: ""}[idx.Unique],
				idx.Name, g.TableName, strings.Join(idx.Columns, ", "))
		}
	}

	// 生成外键创建代码
	fkCode := ""
	if len(g.ForeignKeys) > 0 {
		for _, fk := range g.ForeignKeys {
			fkCode += fmt.Sprintf("\tdb.Exec(\"ALTER TABLE %s ADD CONSTRAINT fk_%s FOREIGN KEY (%s) REFERENCES %s(id) ON DELETE %s ON UPDATE %s\")\n",
				g.TableName, fk.Name, fk.Column, fk.Reference, fk.OnDelete, fk.OnUpdate)
		}
	}

	return fmt.Sprintf(template, className, className, className, className, indexCode, fkCode, className, className, className)
}

// generateColumns 生成列定义
func (g *MigrationGenerator) generateColumns(modelType reflect.Type) ([]ColumnDefinition, error) {
	columns := make([]ColumnDefinition, 0)

	for i := 0; i < modelType.NumField(); i++ {
		field := modelType.Field(i)

		// 跳过非导出字段
		if field.PkgPath != "" {
			continue
		}

		// 解析gform标签
		gformTag := field.Tag.Get("gform")
		if gformTag == "-" {
			continue
		}

		// 生成列定义
		colDef, err := g.parseFieldToColumn(field, gformTag)
		if err != nil {
			return nil, err
		}

		if colDef != nil {
			columns = append(columns, *colDef)
		}
	}

	return columns, nil
}

// parseFieldToColumn 解析字段到列
func (g *MigrationGenerator) parseFieldToColumn(field reflect.StructField, gformTag string) (*ColumnDefinition, error) {
	col := &ColumnDefinition{
		Name:    gf.GetColumnName(field),
		Null:    true,
		Type:    g.mapTypeToSQL(field.Type),
		Comment: field.Tag.Get("doc"),
	}

	// 解析gform标签
	if gformTag != "" {
		tags := strings.Split(gformTag, ";")
		for _, tag := range tags {
			if tag == "primary" {
				col.Extra += " PRIMARY KEY"
			} else if tag == "auto_id" {
				col.Extra += " AUTO_INCREMENT"
			} else if tag == "unique" {
				col.Extra += " UNIQUE"
			} else if strings.HasPrefix(tag, "default:") {
				col.Default = strings.TrimPrefix(tag, "default:")
			} else if tag == "required" {
				col.Null = false
			} else if strings.HasPrefix(tag, "size:") {
				size := strings.TrimPrefix(tag, "size:")
				col.Type = strings.Replace(col.Type, "255", size, 1)
			} else if strings.HasPrefix(tag, "type:") {
				col.Type = strings.TrimPrefix(tag, "type:")
			} else if tag == "soft_delete" {
				col.Null = true
			} else if tag == "auto_time" {
				col.Extra += " DEFAULT CURRENT_TIMESTAMP"
				if strings.Contains(col.Name, "updated") {
					col.Extra += " ON UPDATE CURRENT_TIMESTAMP"
				}
			}
		}
	}

	return col, nil
}

// mapTypeToSQL 映射Go类型到SQL类型
func (g *MigrationGenerator) mapTypeToSQL(t reflect.Type) string {
	switch t.Kind() {
	case reflect.String:
		return "VARCHAR(255)"
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32:
		return "INT"
	case reflect.Int64:
		return "BIGINT"
	case reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32:
		return "INT UNSIGNED"
	case reflect.Uint64:
		return "BIGINT UNSIGNED"
	case reflect.Float32:
		return "FLOAT"
	case reflect.Float64:
		return "DOUBLE"
	case reflect.Bool:
		return "TINYINT(1)"
	case reflect.Struct:
		if t.Name() == "Time" {
			return "DATETIME"
		}
		return "TEXT"
	case reflect.Ptr:
		if t.Elem().Kind() == reflect.Struct {
			if t.Elem().Name() == "Time" {
				return "DATETIME"
			}
		}
		return "TEXT"
	case reflect.Slice:
		if t.Elem().Kind() == reflect.Uint8 {
			return "BLOB"
		}
		return "TEXT"
	default:
		return "TEXT"
	}
}

// generateIndexes 生成索引
func (g *MigrationGenerator) generateIndexes(modelType reflect.Type, tableName string) []IndexDefinition {
	indexes := make([]IndexDefinition, 0)

	for i := 0; i < modelType.NumField(); i++ {
		field := modelType.Field(i)

		// 获取gform标签
		gformTag := field.Tag.Get("gform")
		if gformTag == "-" {
			continue
		}

		// 检查是否需要索引
		if strings.Contains(gformTag, "index") {
			indexName := fmt.Sprintf("idx_%s_%s", tableName, gf.GetColumnName(field))
			indexes = append(indexes, IndexDefinition{
				Name:    indexName,
				Columns: []string{gf.GetColumnName(field)},
				Unique:  strings.Contains(gformTag, "unique"),
			})
		}
	}

	return indexes
}

// generateForeignKeys 生成外键
func (g *MigrationGenerator) generateForeignKeys(modelType reflect.Type, tableName string) []ForeignKeyDefinition {
	foreignKeys := make([]ForeignKeyDefinition, 0)

	for i := 0; i < modelType.NumField(); i++ {
		field := modelType.Field(i)

		// 检查是否是外键
		if strings.HasSuffix(field.Name, "ID") && field.Name != "ID" {
			refTable := strings.TrimSuffix(field.Name, "ID") + "s"
			if refTable == "addresss" {
				refTable = "addresses"
			}

			fkName := fmt.Sprintf("fk_%s_%s", tableName, field.Name)
			foreignKeys = append(foreignKeys, ForeignKeyDefinition{
				Name:      fkName,
				Column:    gf.GetColumnName(field),
				Reference: refTable,
				OnDelete:  "CASCADE",
				OnUpdate:  "CASCADE",
			})
		}
	}

	return foreignKeys
}

// GenerateDiffMigration 生成差异迁移
func (g *MigrationGenerator) GenerateDiffMigration(currentState, targetState gf.Map) (*GeneratedMigration, error) {
	// 实现差异迁移生成逻辑
	return nil, nil
}

// GenerateSeedMigration 生成种子数据迁移
func (g *MigrationGenerator) GenerateSeedMigration(tableName string, data []interface{}) (*GeneratedMigration, error) {
	// 实现种子数据迁移生成逻辑
	return nil, nil
}
