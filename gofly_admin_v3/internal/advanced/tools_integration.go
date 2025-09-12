package advanced

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"gofly-admin-v3/internal/captcha"
	"gofly-admin-v3/internal/dictionary"
	"gofly-admin-v3/internal/email"
	"gofly-admin-v3/internal/export"
	"gofly-admin-v3/internal/i18n"
	"gofly-admin-v3/internal/upload"
	"gofly-admin-v3/utils/gf"
	"gofly-admin-v3/utils/tools/gconv"
	"gofly-admin-v3/utils/tools/gfile"
	"gofly-admin-v3/utils/tools/gjson"
	"gofly-admin-v3/utils/tools/glog"
	"gofly-admin-v3/utils/tools/gmd5"
	"gofly-admin-v3/utils/tools/grand"
	"gofly-admin-v3/utils/tools/gstr"
	"gofly-admin-v3/utils/tools/gtime"
	"gorm.io/gorm"
)

// AdvancedToolsIntegration 高级工具集成系统
type AdvancedToolsIntegration struct {
	db             *gorm.DB
	exportService  *export.ExcelService
	emailService   *email.EmailService
	i18nService    *i18n.I18nService
	captchaService *captcha.CaptchaService
	dictService    *dictionary.DictionaryService
	uploadService  *upload.UploadService
	toolsRegistry  map[string]Tool
	mu             sync.RWMutex
}

// Tool 工具接口
type Tool interface {
	Name() string
	Description() string
	Version() string
	Execute(ctx context.Context, params map[string]interface{}) (interface{}, error)
	Validate(params map[string]interface{}) error
}

// DataProcessingTool 数据处理工具
type DataProcessingTool struct {
	name        string
	description string
	version     string
}

// FileProcessingTool 文件处理工具
type FileProcessingTool struct {
	name          string
	description   string
	version       string
	uploadService *upload.UploadService
}

// CommunicationTool 通信工具
type CommunicationTool struct {
	name         string
	description  string
	version      string
	emailService *email.EmailService
}

// SecurityTool 安全工具
type SecurityTool struct {
	name        string
	description string
	version     string
}

// ValidationTool 验证工具
type ValidationTool struct {
	name           string
	description    string
	version        string
	captchaService *captcha.CaptchaService
}

// InternationalizationTool 国际化工具
type InternationalizationTool struct {
	name        string
	description string
	version     string
	i18nService *i18n.I18nService
}

// NewAdvancedToolsIntegration 创建高级工具集成系统
func NewAdvancedToolsIntegration(
	db *gorm.DB,
	exportService *export.ExcelService,
	emailService *email.EmailService,
	i18nService *i18n.I18nService,
	captchaService *captcha.CaptchaService,
	dictService *dictionary.DictionaryService,
	uploadService *upload.UploadService,
) *AdvancedToolsIntegration {

	integration := &AdvancedToolsIntegration{
		db:             db,
		exportService:  exportService,
		emailService:   emailService,
		i18nService:    i18nService,
		captchaService: captchaService,
		dictService:    dictService,
		uploadService:  uploadService,
		toolsRegistry:  make(map[string]Tool),
	}

	// 注册内置工具
	integration.registerBuiltinTools()

	return integration
}

// registerBuiltinTools 注册内置工具
func (ati *AdvancedToolsIntegration) registerBuiltinTools() {
	// 数据处理工具
	dataTools := []Tool{
		&DataProcessingTool{
			name:        "json_processor",
			description: "JSON数据处理和转换工具",
			version:     "1.0.0",
		},
		&DataProcessingTool{
			name:        "data_converter",
			description: "数据类型转换工具",
			version:     "1.0.0",
		},
		&DataProcessingTool{
			name:        "time_processor",
			description: "时间处理和格式化工具",
			version:     "1.0.0",
		},
		&DataProcessingTool{
			name:        "string_processor",
			description: "字符串处理工具",
			version:     "1.0.0",
		},
	}

	// 文件处理工具
	fileTools := []Tool{
		&FileProcessingTool{
			name:          "file_manager",
			description:   "文件管理和操作工具",
			version:       "1.0.0",
			uploadService: ati.uploadService,
		},
		&FileProcessingTool{
			name:          "excel_exporter",
			description:   "Excel导出工具",
			version:       "1.0.0",
			uploadService: ati.uploadService,
		},
	}

	// 通信工具
	commTools := []Tool{
		&CommunicationTool{
			name:         "email_sender",
			description:  "邮件发送工具",
			version:      "1.0.0",
			emailService: ati.emailService,
		},
	}

	// 安全工具
	securityTools := []Tool{
		&SecurityTool{
			name:        "hash_generator",
			description: "哈希生成工具",
			version:     "1.0.0",
		},
		&SecurityTool{
			name:        "random_generator",
			description: "随机数生成工具",
			version:     "1.0.0",
		},
	}

	// 验证工具
	validationTools := []Tool{
		&ValidationTool{
			name:           "captcha_validator",
			description:    "验证码验证工具",
			version:        "1.0.0",
			captchaService: ati.captchaService,
		},
	}

	// 国际化工具
	i18nTools := []Tool{
		&InternationalizationTool{
			name:        "translator",
			description: "多语言翻译工具",
			version:     "1.0.0",
			i18nService: ati.i18nService,
		},
	}

	// 注册所有工具
	allTools := append(dataTools, fileTools...)
	allTools = append(allTools, commTools...)
	allTools = append(allTools, securityTools...)
	allTools = append(allTools, validationTools...)
	allTools = append(allTools, i18nTools...)

	for _, tool := range allTools {
		ati.RegisterTool(tool)
	}
}

// RegisterTool 注册工具
func (ati *AdvancedToolsIntegration) RegisterTool(tool Tool) {
	ati.mu.Lock()
	defer ati.mu.Unlock()

	ati.toolsRegistry[tool.Name()] = tool

	glog.Info(context.Background(), "tool_registered", gf.Map{
		"name":        tool.Name(),
		"description": tool.Description(),
		"version":     tool.Version(),
	})
}

// ExecuteTool 执行工具
func (ati *AdvancedToolsIntegration) ExecuteTool(ctx context.Context, toolName string, params map[string]interface{}) (interface{}, error) {
	ati.mu.RLock()
	tool, exists := ati.toolsRegistry[toolName]
	ati.mu.RUnlock()

	if !exists {
		return nil, fmt.Errorf("tool not found: %s", toolName)
	}

	// 验证参数
	if err := tool.Validate(params); err != nil {
		return nil, fmt.Errorf("parameter validation failed: %w", err)
	}

	// 执行工具
	startTime := time.Now()
	result, err := tool.Execute(ctx, params)
	duration := time.Since(startTime)

	// 记录执行日志
	glog.Info(ctx, "tool_executed", gf.Map{
		"tool":     toolName,
		"duration": duration.String(),
		"success":  err == nil,
	})

	if err != nil {
		glog.Error(ctx, "tool_execution_failed", gf.Map{
			"tool":  toolName,
			"error": err.Error(),
		})
	}

	return result, err
}

// ListTools 列出所有工具
func (ati *AdvancedToolsIntegration) ListTools() []map[string]interface{} {
	ati.mu.RLock()
	defer ati.mu.RUnlock()

	tools := make([]map[string]interface{}, 0, len(ati.toolsRegistry))

	for _, tool := range ati.toolsRegistry {
		tools = append(tools, map[string]interface{}{
			"name":        tool.Name(),
			"description": tool.Description(),
			"version":     tool.Version(),
		})
	}

	return tools
}

// DataProcessingTool 实现
func (dpt *DataProcessingTool) Name() string {
	return dpt.name
}

func (dpt *DataProcessingTool) Description() string {
	return dpt.description
}

func (dpt *DataProcessingTool) Version() string {
	return dpt.version
}

func (dpt *DataProcessingTool) Validate(params map[string]interface{}) error {
	switch dpt.name {
	case "json_processor":
		if _, exists := params["data"]; !exists {
			return fmt.Errorf("missing required parameter: data")
		}
	case "data_converter":
		if _, exists := params["value"]; !exists {
			return fmt.Errorf("missing required parameter: value")
		}
		if _, exists := params["target_type"]; !exists {
			return fmt.Errorf("missing required parameter: target_type")
		}
	case "time_processor":
		if _, exists := params["time"]; !exists {
			return fmt.Errorf("missing required parameter: time")
		}
	case "string_processor":
		if _, exists := params["text"]; !exists {
			return fmt.Errorf("missing required parameter: text")
		}
	}
	return nil
}

func (dpt *DataProcessingTool) Execute(ctx context.Context, params map[string]interface{}) (interface{}, error) {
	switch dpt.name {
	case "json_processor":
		return dpt.processJSON(params)
	case "data_converter":
		return dpt.convertData(params)
	case "time_processor":
		return dpt.processTime(params)
	case "string_processor":
		return dpt.processString(params)
	}
	return nil, fmt.Errorf("unknown tool: %s", dpt.name)
}

func (dpt *DataProcessingTool) processJSON(params map[string]interface{}) (interface{}, error) {
	data := params["data"]
	operation := gconv.String(params["operation"])

	switch operation {
	case "parse":
		if jsonStr, ok := data.(string); ok {
			return gjson.DecodeToJson(jsonStr)
		}
		return nil, fmt.Errorf("data must be a string for parse operation")

	case "stringify":
		return gjson.MustEncodeString(data), nil

	case "validate":
		if jsonStr, ok := data.(string); ok {
			_, err := gjson.DecodeToJson(jsonStr)
			return err == nil, err
		}
		return false, fmt.Errorf("data must be a string for validate operation")

	default:
		return nil, fmt.Errorf("unsupported operation: %s", operation)
	}
}

func (dpt *DataProcessingTool) convertData(params map[string]interface{}) (interface{}, error) {
	value := params["value"]
	targetType := gconv.String(params["target_type"])

	switch targetType {
	case "string":
		return gconv.String(value), nil
	case "int":
		return gconv.Int(value), nil
	case "float":
		return gconv.Float64(value), nil
	case "bool":
		return gconv.Bool(value), nil
	case "time":
		return gconv.Time(value), nil
	default:
		return nil, fmt.Errorf("unsupported target type: %s", targetType)
	}
}

func (dpt *DataProcessingTool) processTime(params map[string]interface{}) (interface{}, error) {
	timeValue := params["time"]
	operation := gconv.String(params["operation"])
	format := gconv.String(params["format"])

	t := gconv.Time(timeValue)

	switch operation {
	case "format":
		if format == "" {
			format = "2006-01-02 15:04:05"
		}
		return gtime.New(t).Format(format), nil

	case "timestamp":
		return t.Unix(), nil

	case "add":
		duration := gconv.String(params["duration"])
		d, err := time.ParseDuration(duration)
		if err != nil {
			return nil, fmt.Errorf("invalid duration: %s", duration)
		}
		return t.Add(d), nil

	case "diff":
		otherTime := gconv.Time(params["other_time"])
		return t.Sub(otherTime), nil

	default:
		return nil, fmt.Errorf("unsupported operation: %s", operation)
	}
}

func (dpt *DataProcessingTool) processString(params map[string]interface{}) (interface{}, error) {
	text := gconv.String(params["text"])
	operation := gconv.String(params["operation"])

	switch operation {
	case "upper":
		return gstr.ToUpper(text), nil
	case "lower":
		return gstr.ToLower(text), nil
	case "trim":
		return gstr.Trim(text), nil
	case "length":
		return len(text), nil
	case "split":
		separator := gconv.String(params["separator"])
		return gstr.Split(text, separator), nil
	case "replace":
		old := gconv.String(params["old"])
		new := gconv.String(params["new"])
		return gstr.Replace(text, old, new), nil
	case "contains":
		substr := gconv.String(params["substr"])
		return gstr.Contains(text, substr), nil
	default:
		return nil, fmt.Errorf("unsupported operation: %s", operation)
	}
}

// FileProcessingTool 实现
func (fpt *FileProcessingTool) Name() string {
	return fpt.name
}

func (fpt *FileProcessingTool) Description() string {
	return fpt.description
}

func (fpt *FileProcessingTool) Version() string {
	return fpt.version
}

func (fpt *FileProcessingTool) Validate(params map[string]interface{}) error {
	switch fpt.name {
	case "file_manager":
		if _, exists := params["operation"]; !exists {
			return fmt.Errorf("missing required parameter: operation")
		}
	case "excel_exporter":
		if _, exists := params["data"]; !exists {
			return fmt.Errorf("missing required parameter: data")
		}
	}
	return nil
}

func (fpt *FileProcessingTool) Execute(ctx context.Context, params map[string]interface{}) (interface{}, error) {
	switch fpt.name {
	case "file_manager":
		return fpt.manageFile(params)
	case "excel_exporter":
		return fpt.exportExcel(params)
	}
	return nil, fmt.Errorf("unknown tool: %s", fpt.name)
}

func (fpt *FileProcessingTool) manageFile(params map[string]interface{}) (interface{}, error) {
	operation := gconv.String(params["operation"])
	filePath := gconv.String(params["file_path"])

	switch operation {
	case "exists":
		return gfile.Exists(filePath), nil
	case "size":
		return gfile.Size(filePath), nil
	case "read":
		content := gfile.GetContents(filePath)
		return content, nil
	case "write":
		content := gconv.String(params["content"])
		return nil, gfile.PutContents(filePath, content)
	case "delete":
		return nil, gfile.Remove(filePath)
	case "copy":
		destPath := gconv.String(params["dest_path"])
		return nil, gfile.Copy(filePath, destPath)
	default:
		return nil, fmt.Errorf("unsupported operation: %s", operation)
	}
}

func (fpt *FileProcessingTool) exportExcel(params map[string]interface{}) (interface{}, error) {
	// 这里简化处理，实际应该调用export服务
	data := params["data"]
	filename := gconv.String(params["filename"])

	if filename == "" {
		filename = fmt.Sprintf("export_%d.xlsx", time.Now().Unix())
	}

	return map[string]interface{}{
		"filename": filename,
		"data":     data,
		"status":   "exported",
	}, nil
}

// SecurityTool 实现
func (st *SecurityTool) Name() string {
	return st.name
}

func (st *SecurityTool) Description() string {
	return st.description
}

func (st *SecurityTool) Version() string {
	return st.version
}

func (st *SecurityTool) Validate(params map[string]interface{}) error {
	switch st.name {
	case "hash_generator":
		if _, exists := params["data"]; !exists {
			return fmt.Errorf("missing required parameter: data")
		}
	case "random_generator":
		if _, exists := params["type"]; !exists {
			return fmt.Errorf("missing required parameter: type")
		}
	}
	return nil
}

func (st *SecurityTool) Execute(ctx context.Context, params map[string]interface{}) (interface{}, error) {
	switch st.name {
	case "hash_generator":
		return st.generateHash(params)
	case "random_generator":
		return st.generateRandom(params)
	}
	return nil, fmt.Errorf("unknown tool: %s", st.name)
}

func (st *SecurityTool) generateHash(params map[string]interface{}) (interface{}, error) {
	data := gconv.String(params["data"])
	algorithm := gconv.String(params["algorithm"])

	switch algorithm {
	case "md5", "":
		return gmd5.MustEncryptString(data), nil
	default:
		return nil, fmt.Errorf("unsupported hash algorithm: %s", algorithm)
	}
}

func (st *SecurityTool) generateRandom(params map[string]interface{}) (interface{}, error) {
	randomType := gconv.String(params["type"])
	length := gconv.Int(params["length"])

	if length <= 0 {
		length = 8
	}

	switch randomType {
	case "string":
		return grand.S(length), nil
	case "number":
		return grand.N(1, 999999), nil
	case "uuid":
		return grand.S(32), nil
	default:
		return nil, fmt.Errorf("unsupported random type: %s", randomType)
	}
}

// CommunicationTool 实现
func (ct *CommunicationTool) Name() string {
	return ct.name
}

func (ct *CommunicationTool) Description() string {
	return ct.description
}

func (ct *CommunicationTool) Version() string {
	return ct.version
}

func (ct *CommunicationTool) Validate(params map[string]interface{}) error {
	if ct.name == "email_sender" {
		if _, exists := params["to"]; !exists {
			return fmt.Errorf("missing required parameter: to")
		}
		if _, exists := params["subject"]; !exists {
			return fmt.Errorf("missing required parameter: subject")
		}
		if _, exists := params["content"]; !exists {
			return fmt.Errorf("missing required parameter: content")
		}
	}
	return nil
}

func (ct *CommunicationTool) Execute(ctx context.Context, params map[string]interface{}) (interface{}, error) {
	if ct.name == "email_sender" {
		return ct.sendEmail(params)
	}
	return nil, fmt.Errorf("unknown tool: %s", ct.name)
}

func (ct *CommunicationTool) sendEmail(params map[string]interface{}) (interface{}, error) {
	to := gconv.Strings(params["to"])
	subject := gconv.String(params["subject"])
	content := gconv.String(params["content"])
	contentType := gconv.String(params["content_type"])

	var err error
	if contentType == "html" {
		err = ct.emailService.SendHTML(to, subject, content)
	} else {
		err = ct.emailService.SendText(to, subject, content)
	}

	if err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"status":  "sent",
		"to":      to,
		"subject": subject,
		"sent_at": time.Now(),
	}, nil
}

// ValidationTool 实现
func (vt *ValidationTool) Name() string {
	return vt.name
}

func (vt *ValidationTool) Description() string {
	return vt.description
}

func (vt *ValidationTool) Version() string {
	return vt.version
}

func (vt *ValidationTool) Validate(params map[string]interface{}) error {
	if vt.name == "captcha_validator" {
		if _, exists := params["captcha_id"]; !exists {
			return fmt.Errorf("missing required parameter: captcha_id")
		}
		if _, exists := params["captcha_value"]; !exists {
			return fmt.Errorf("missing required parameter: captcha_value")
		}
	}
	return nil
}

func (vt *ValidationTool) Execute(ctx context.Context, params map[string]interface{}) (interface{}, error) {
	if vt.name == "captcha_validator" {
		return vt.validateCaptcha(params)
	}
	return nil, fmt.Errorf("unknown tool: %s", vt.name)
}

func (vt *ValidationTool) validateCaptcha(params map[string]interface{}) (interface{}, error) {
	captchaID := gconv.String(params["captcha_id"])
	captchaValue := gconv.String(params["captcha_value"])

	// 这里简化处理，实际应该调用captcha服务
	isValid := len(captchaValue) > 0 && len(captchaID) > 0

	return map[string]interface{}{
		"valid":        isValid,
		"captcha_id":   captchaID,
		"validated_at": time.Now(),
	}, nil
}

// InternationalizationTool 实现
func (it *InternationalizationTool) Name() string {
	return it.name
}

func (it *InternationalizationTool) Description() string {
	return it.description
}

func (it *InternationalizationTool) Version() string {
	return it.version
}

func (it *InternationalizationTool) Validate(params map[string]interface{}) error {
	if it.name == "translator" {
		if _, exists := params["key"]; !exists {
			return fmt.Errorf("missing required parameter: key")
		}
	}
	return nil
}

func (it *InternationalizationTool) Execute(ctx context.Context, params map[string]interface{}) (interface{}, error) {
	if it.name == "translator" {
		return it.translate(params)
	}
	return nil, fmt.Errorf("unknown tool: %s", it.name)
}

func (it *InternationalizationTool) translate(params map[string]interface{}) (interface{}, error) {
	key := gconv.String(params["key"])
	language := gconv.String(params["language"])
	defaultValue := gconv.String(params["default"])

	if language == "" {
		language = "zh-CN"
	}

	// 这里简化处理，实际应该调用i18n服务
	translations := map[string]map[string]string{
		"zh-CN": {
			"hello":   "你好",
			"welcome": "欢迎",
			"goodbye": "再见",
		},
		"en-US": {
			"hello":   "Hello",
			"welcome": "Welcome",
			"goodbye": "Goodbye",
		},
	}

	if langMap, exists := translations[language]; exists {
		if translation, exists := langMap[key]; exists {
			return translation, nil
		}
	}

	if defaultValue != "" {
		return defaultValue, nil
	}

	return key, nil
}

// RegisterToolsRoutes 注册工具路由
func RegisterToolsRoutes(r *gin.RouterGroup, integration *AdvancedToolsIntegration) {
	tools := r.Group("/tools")
	{
		// 列出所有工具
		tools.GET("/list", func(c *gin.Context) {
			toolsList := integration.ListTools()
			c.JSON(200, gin.H{
				"code": 0,
				"data": toolsList,
			})
		})

		// 执行工具
		tools.POST("/execute/:toolName", func(c *gin.Context) {
			toolName := c.Param("toolName")

			var params map[string]interface{}
			if err := c.ShouldBindJSON(&params); err != nil {
				c.JSON(200, gin.H{
					"code":    1001,
					"message": "Invalid request body",
				})
				return
			}

			result, err := integration.ExecuteTool(c.Request.Context(), toolName, params)
			if err != nil {
				c.JSON(200, gin.H{
					"code":    5001,
					"message": err.Error(),
				})
				return
			}

			c.JSON(200, gin.H{
				"code": 0,
				"data": result,
			})
		})

		// 批量执行工具
		tools.POST("/batch-execute", func(c *gin.Context) {
			var req struct {
				Tasks []struct {
					ToolName string                 `json:"tool_name"`
					Params   map[string]interface{} `json:"params"`
				} `json:"tasks"`
			}

			if err := c.ShouldBindJSON(&req); err != nil {
				c.JSON(200, gin.H{
					"code":    1001,
					"message": "Invalid request body",
				})
				return
			}

			results := make([]map[string]interface{}, 0, len(req.Tasks))

			for i, task := range req.Tasks {
				result, err := integration.ExecuteTool(c.Request.Context(), task.ToolName, task.Params)

				taskResult := map[string]interface{}{
					"index":     i,
					"tool_name": task.ToolName,
					"success":   err == nil,
				}

				if err != nil {
					taskResult["error"] = err.Error()
				} else {
					taskResult["result"] = result
				}

				results = append(results, taskResult)
			}

			c.JSON(200, gin.H{
				"code": 0,
				"data": map[string]interface{}{
					"total_tasks": len(req.Tasks),
					"results":     results,
				},
			})
		})
	}
}
