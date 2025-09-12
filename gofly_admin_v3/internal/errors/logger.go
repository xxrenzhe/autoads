package errors

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"runtime"
	"time"

	"gofly-admin-v3/internal/types"
	"gofly-admin-v3/utils/gf"
)

// Logger 日志接口
type Logger interface {
	Info(msg string, fields map[string]interface{})
	Warn(msg string, fields map[string]interface{})
	Error(msg string, fields map[string]interface{})
	Debug(msg string, fields map[string]interface{})
	Fatal(msg string, fields map[string]interface{})
}

// DefaultLogger 默认日志实现
type DefaultLogger struct {
	logger *log.Logger
}

// NewDefaultLogger 创建默认日志器
func NewDefaultLogger() *DefaultLogger {
	return &DefaultLogger{
		logger: log.New(os.Stdout, "[APP] ", log.LstdFlags|log.Lshortfile),
	}
}

// Info 记录信息日志
func (l *DefaultLogger) Info(msg string, fields map[string]interface{}) {
	l.log("INFO", msg, fields)
}

// Warn 记录警告日志
func (l *DefaultLogger) Warn(msg string, fields map[string]interface{}) {
	l.log("WARN", msg, fields)
}

// Error 记录错误日志
func (l *DefaultLogger) Error(msg string, fields map[string]interface{}) {
	l.log("ERROR", msg, fields)
}

// Debug 记录调试日志
func (l *DefaultLogger) Debug(msg string, fields map[string]interface{}) {
	l.log("DEBUG", msg, fields)
}

// Fatal 记录致命错误日志
func (l *DefaultLogger) Fatal(msg string, fields map[string]interface{}) {
	l.log("FATAL", msg, fields)
	os.Exit(1)
}

// log 统一日志记录方法
func (l *DefaultLogger) log(level, msg string, fields map[string]interface{}) {
	// 获取调用者信息
	_, file, line, ok := runtime.Caller(3)
	if !ok {
		file = "unknown"
		line = 0
	}

	// 构建日志消息
	logMsg := fmt.Sprintf("[%s] %s:%d: %s", level, file, line, msg)

	// 添加字段信息
	if len(fields) > 0 {
		if fieldsJSON, err := json.Marshal(fields); err == nil {
			logMsg += " | " + string(fieldsJSON)
		}
	}

	// 根据级别输出
	switch level {
	case "ERROR", "FATAL":
		l.logger.SetPrefix("[ERROR] ")
	case "WARN":
		l.logger.SetPrefix("[WARN] ")
	case "DEBUG":
		l.logger.SetPrefix("[DEBUG] ")
	default:
		l.logger.SetPrefix("[INFO] ")
	}

	l.logger.Println(logMsg)
}

// GoFlyLogger GoFly日志包装器
type GoFlyLogger struct{}

// NewGoFlyLogger 创建GoFly日志包装器
func NewGoFlyLogger() *GoFlyLogger {
	return &GoFlyLogger{}
}

// Info 记录信息日志
func (l *GoFlyLogger) Info(msg string, fields map[string]interface{}) {
	if gf.Log() != nil {
		gf.Log().Info(nil, msg, gf.Map(fields))
	}
}

// Warn 记录警告日志
func (l *GoFlyLogger) Warn(msg string, fields map[string]interface{}) {
	if gf.Log() != nil {
		gf.Log().Warning(nil, msg, gf.Map(fields))
	}
}

// Error 记录错误日志
func (l *GoFlyLogger) Error(msg string, fields map[string]interface{}) {
	if gf.Log() != nil {
		gf.Log().Error(nil, msg, gf.Map(fields))
	}
}

// Debug 记录调试日志
func (l *GoFlyLogger) Debug(msg string, fields map[string]interface{}) {
	if gf.Log() != nil {
		gf.Log().Debug(nil, msg, gf.Map(fields))
	}
}

// Fatal 记录致命错误日志
func (l *GoFlyLogger) Fatal(msg string, fields map[string]interface{}) {
	if gf.Log() != nil {
		gf.Log().Fatal(nil, msg, gf.Map(fields))
	}
	os.Exit(1)
}

// 全局日志器
var globalLogger Logger = NewGoFlyLogger()

// SetLogger 设置全局日志器
func SetLogger(logger Logger) {
	globalLogger = logger
}

// LogInfo 记录信息日志
func LogInfo(msg string, fields map[string]interface{}) {
	globalLogger.Info(msg, fields)
}

// LogWarn 记录警告日志
func LogWarn(msg string, fields map[string]interface{}) {
	globalLogger.Warn(msg, fields)
}

// LogError 记录错误日志
func LogError(msg string, fields map[string]interface{}) {
	globalLogger.Error(msg, fields)
}

// LogDebug 记录调试日志
func LogDebug(msg string, fields map[string]interface{}) {
	globalLogger.Debug(msg, fields)
}

// LogFatal 记录致命错误日志
func LogFatal(msg string, fields map[string]interface{}) {
	globalLogger.Fatal(msg, fields)
}

// ErrorLogger 错误日志器
type ErrorLogger struct {
	logger Logger
}

// NewErrorLogger 创建错误日志器
func NewErrorLogger(logger Logger) *ErrorLogger {
	return &ErrorLogger{
		logger: logger,
	}
}

// LogAppError 记录应用错误
func (el *ErrorLogger) LogAppError(err *AppError, context map[string]interface{}) {
	fields := map[string]interface{}{
		"error_code": err.Code,
		"severity":   err.Severity,
		"timestamp":  err.Timestamp,
	}

	// 添加错误详情
	if err.Details != nil {
		fields["details"] = err.Details
	}

	// 添加上下文
	if len(context) > 0 {
		for k, v := range context {
			fields[k] = v
		}
	}

	// 添加原因错误
	if err.Cause != nil {
		fields["cause"] = err.Cause.Error()
	}

	// 添加堆栈跟踪
	if err.StackTrace != "" {
		fields["stack_trace"] = err.StackTrace
	}

	// 根据严重程度选择日志级别
	switch err.Severity {
	case SeverityCritical:
		el.logger.Fatal(err.Message, fields)
	case SeverityHigh:
		el.logger.Error(err.Message, fields)
	case SeverityMedium:
		el.logger.Warn(err.Message, fields)
	default:
		el.logger.Info(err.Message, fields)
	}
}

// LogPanic 记录panic
func (el *ErrorLogger) LogPanic(recovered interface{}, stack []byte, context map[string]interface{}) {
	fields := map[string]interface{}{
		"type":      "panic",
		"recovered": recovered,
		"stack":     string(stack),
		"timestamp": time.Now(),
	}

	// 添加上下文
	if len(context) > 0 {
		for k, v := range context {
			fields[k] = v
		}
	}

	el.logger.Fatal("Panic recovered", fields)
}

// LogValidationError 记录验证错误
func (el *ErrorLogger) LogValidationError(err *types.ValidationErrors, context map[string]interface{}) {
	fields := map[string]interface{}{
		"type":        "validation_error",
		"errors":      err.Errors,
		"error_count": len(err.Errors),
		"timestamp":   time.Now(),
	}

	// 添加上下文
	if len(context) > 0 {
		for k, v := range context {
			fields[k] = v
		}
	}

	el.logger.Warn("Validation failed", fields)
}

// 全局错误日志器
var globalErrorLogger = NewErrorLogger(globalLogger)

// SetErrorLogger 设置全局错误日志器
func SetErrorLogger(logger *ErrorLogger) {
	globalErrorLogger = logger
}

// LogAppError 记录应用错误
func LogAppError(err *AppError, context map[string]interface{}) {
	globalErrorLogger.LogAppError(err, context)
}

// LogPanic 记录panic
func LogPanic(recovered interface{}, stack []byte, context map[string]interface{}) {
	globalErrorLogger.LogPanic(recovered, stack, context)
}

// LogValidationError 记录验证错误
func LogValidationError(err *types.ValidationErrors, context map[string]interface{}) {
	globalErrorLogger.LogValidationError(err, context)
}

// RequestLogger 请求日志器
type RequestLogger struct {
	logger Logger
}

// NewRequestLogger 创建请求日志器
func NewRequestLogger(logger Logger) *RequestLogger {
	return &RequestLogger{
		logger: logger,
	}
}

// LogRequest 记录请求
func (rl *RequestLogger) LogRequest(method, path, clientIP, userAgent string, statusCode int, duration time.Duration, err error) {
	fields := map[string]interface{}{
		"method":     method,
		"path":       path,
		"client_ip":  clientIP,
		"user_agent": userAgent,
		"status":     statusCode,
		"duration":   duration.String(),
	}

	message := fmt.Sprintf("%s %s - %d", method, path, statusCode)

	if err != nil {
		fields["error"] = err.Error()
		message = fmt.Sprintf("%s %s - %d - ERROR: %v", method, path, statusCode, err)
		rl.logger.Error(message, fields)
	} else if statusCode >= 400 {
		rl.logger.Warn(message, fields)
	} else {
		rl.logger.Info(message, fields)
	}
}

// 全局请求日志器
var globalRequestLogger = NewRequestLogger(globalLogger)

// SetRequestLogger 设置全局请求日志器
func SetRequestLogger(logger *RequestLogger) {
	globalRequestLogger = logger
}

// LogRequest 记录请求
func LogRequest(method, path, clientIP, userAgent string, statusCode int, duration time.Duration, err error) {
	globalRequestLogger.LogRequest(method, path, clientIP, userAgent, statusCode, duration, err)
}
