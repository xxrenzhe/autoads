//go:build autoads_init_advanced

package init

import (
	"fmt"
	"log"

	"gofly-admin-v3/internal/config"
	"gofly-admin-v3/internal/errors"
	"gofly-admin-v3/internal/middleware"
)

// InitApp 初始化应用
func InitApp(configPath string) error {
	// 1. 加载并验证配置
	log.Println("Loading configuration...")

	configManager := config.GetConfigManager()

	// 先加载配置（会自动进行验证）
	if err := configManager.LoadConfig(configPath); err != nil {
		return fmt.Errorf("failed to load configuration: %w", err)
	}

	// 获取配置实例
	appConfig := configManager.GetConfig()

	log.Printf("Configuration loaded successfully. Version: %s, Environment: %s",
		appConfig.App.Version, appConfig.App.RunEnv)

	// 2. 初始化错误处理系统
	log.Println("Initializing error handling system...")
	initErrorHandling()

	// 3. 添加配置变更回调
	configManager.AddCallback(func(cfg *config.Config) {
		log.Println("Configuration reloaded")
		// 这里可以添加配置变更后的处理逻辑
	})

	return nil
}

// initErrorHandling 初始化错误处理系统
func initErrorHandling() {
	// 设置默认的错误处理器
	errors.RegisterErrorHandler(&DatabaseErrorHandler{})
	errors.RegisterErrorHandler(&ValidationErrorHandler{})

	// 设置日志器
	errors.SetLogger(errors.NewGoFlyLogger())

	log.Println("Error handling system initialized")
}

// DatabaseErrorHandler 数据库错误处理器
type DatabaseErrorHandler struct{}

// CanHandle 判断是否能处理该错误
func (h *DatabaseErrorHandler) CanHandle(err error) bool {
	// 这里可以根据实际使用的数据库驱动来判断
	// 例如：检查错误是否包含特定的错误码或消息
	return containsAny(err.Error(), []string{
		"duplicate entry",
		"foreign key constraint",
		"table doesn't exist",
		"connection refused",
		"timeout",
	})
}

// HandleError 处理数据库错误
func (h *DatabaseErrorHandler) HandleError(err error) *errors.AppError {
	errMsg := err.Error()

	switch {
	case contains(errMsg, "duplicate entry"):
		return errors.Conflict(errors.BIZ_USER_ALREADY_EXISTS, "Resource already exists").
			WithCause(err)
	case contains(errMsg, "foreign key constraint"):
		return errors.BadRequest(errors.BIZ_INVALID_OPERATION, "Invalid operation due to foreign key constraint").
			WithCause(err)
	case contains(errMsg, "table doesn't exist"):
		return errors.InternalServerError(errors.SYSTEM_DATABASE_ERROR, "Database table not found").
			WithCause(err)
	case contains(errMsg, "connection refused"):
		return errors.ServiceUnavailable(errors.SYSTEM_DATABASE_ERROR, "Database connection failed").
			WithCause(err)
	case contains(errMsg, "timeout"):
		return errors.New(errors.SYSTEM_TIMEOUT_ERROR, "Database operation timeout").
			WithSeverity(errors.SeverityMedium).
			WithCause(err)
	default:
		return errors.DatabaseError("Database operation failed").
			WithCause(err)
	}
}

// ValidationErrorHandler 验证错误处理器
type ValidationErrorHandler struct{}

// CanHandle 判断是否能处理该错误
func (h *ValidationErrorHandler) CanHandle(err error) bool {
	// 检查是否是验证错误
	_, ok := err.(*errors.ValidationErrors)
	return ok
}

// HandleError 处理验证错误
func (h *ValidationErrorHandler) HandleError(err error) *errors.AppError {
	if validationErrs, ok := err.(*errors.ValidationErrors); ok {
		return errors.ValidationError("Request validation failed").
			WithDetails(validationErrs.ToMap())
	}

	return errors.ValidationError("Validation failed").
		WithCause(err)
}

// contains 检查字符串是否包含任一子串
func contains(s string, subs []string) bool {
	for _, sub := range subs {
		if containsString(s, sub) {
			return true
		}
	}
	return false
}

// containsString 检查字符串是否包含子串
func containsString(s, sub string) bool {
	return len(s) >= len(sub) && (s == sub ||
		(len(s) > len(sub) &&
			(s[:len(sub)] == sub ||
				s[len(s)-len(sub):] == sub ||
				findSubstring(s, sub))))
}

// findSubstring 查找子串
func findSubstring(s, sub string) bool {
	for i := 0; i <= len(s)-len(sub); i++ {
		if s[i:i+len(sub)] == sub {
			return true
		}
	}
	return false
}

// ExampleUsage 使用示例
func ExampleUsage() {
	// 初始化应用
	if err := InitApp("config.yaml"); err != nil {
		log.Fatalf("Failed to initialize app: %v", err)
	}

	// 示例：使用新的错误处理
	exampleErrorHandling()

	// 示例：使用配置验证
	exampleConfigValidation()
}

// exampleErrorHandling 错误处理示例
func exampleErrorHandling() {
	// 创建自定义错误
	err := errors.New(errors.BIZ_USER_NOT_FOUND, "User not found")

	// 添加详情和上下文
	err = err.
		WithDetails(map[string]interface{}{
			"user_id": 123,
			"email":   "user@example.com",
		}).
		WithContext("request_id", "req-123456").
		WithSeverity(errors.SeverityLow)

	// 记录错误
	errors.LogAppError(err, map[string]interface{}{
		"action":  "get_user",
		"user_id": 123,
	})

	// 转换为JSON
	jsonErr := err.ToJSON()
	fmt.Printf("Error JSON: %s\n", jsonErr)
}

// exampleConfigValidation 配置验证示例
func exampleConfigValidation() {
	configManager := config.GetConfigManager()
	cfg := configManager.GetConfig()

	// 创建验证器
	validator := config.NewConfigValidator(cfg)

	// 定义自定义验证规则
	customRules := map[string]func(interface{}) error{
		"app.port": func(value interface{}) error {
			if port, ok := value.(int); ok {
				if port < 1024 || port > 49151 {
					return fmt.Errorf("port should be between 1024 and 49151")
				}
			}
			return nil
		},
		"database.default.maxOpen": func(value interface{}) error {
			if maxOpen, ok := value.(int); ok {
				if maxOpen > 100 {
					return fmt.Errorf("maxOpen should not exceed 100")
				}
			}
			return nil
		},
	}

	// 执行验证
	if err := validator.ValidateWithRules(customRules); err != nil {
		// 处理验证错误
		if appErr, ok := err.(*errors.AppError); ok {
			errors.LogAppError(appErr, map[string]interface{}{
				"validation_type": "custom_rules",
			})
		}
	}
}
