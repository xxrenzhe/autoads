package errors

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"runtime"
	"time"
)

// ErrorCode 错误代码类型
type ErrorCode string

const (
	// 系统级错误 (SYS_xxx)
	SYSTEM_INTERNAL_ERROR   ErrorCode = "SYS_001"
	SYSTEM_CONFIG_ERROR     ErrorCode = "SYS_002"
	SYSTEM_DATABASE_ERROR   ErrorCode = "SYS_003"
	SYSTEM_NETWORK_ERROR    ErrorCode = "SYS_004"
	SYSTEM_TIMEOUT_ERROR    ErrorCode = "SYS_005"
	SYSTEM_VALIDATION_ERROR ErrorCode = "SYS_006"
	SYSTEM_AUTH_ERROR       ErrorCode = "SYS_007"
	SYSTEM_PERMISSION_ERROR ErrorCode = "SYS_008"
	SYSTEM_RATE_LIMIT_ERROR ErrorCode = "SYS_009"

	// 业务级错误 (BIZ_xxx)
	BIZ_USER_NOT_FOUND      ErrorCode = "BIZ_001"
	BIZ_USER_ALREADY_EXISTS ErrorCode = "BIZ_002"
	BIZ_INVALID_TOKEN       ErrorCode = "BIZ_003"
	BIZ_TOKEN_EXPIRED       ErrorCode = "BIZ_004"
	BIZ_INSUFFICIENT_FUNDS  ErrorCode = "BIZ_005"
	BIZ_INVALID_OPERATION   ErrorCode = "BIZ_006"
	BIZ_RESOURCE_NOT_FOUND  ErrorCode = "BIZ_007"

	// 外部服务错误 (EXT_xxx)
	EXT_SERVICE_UNAVAILABLE ErrorCode = "EXT_001"
	EXT_API_ERROR           ErrorCode = "EXT_002"
	EXT_TIMEOUT_ERROR       ErrorCode = "EXT_003"
)

// ErrorSeverity 错误严重程度
type ErrorSeverity string

const (
	SeverityLow      ErrorSeverity = "LOW"
	SeverityMedium   ErrorSeverity = "MEDIUM"
	SeverityHigh     ErrorSeverity = "HIGH"
	SeverityCritical ErrorSeverity = "CRITICAL"
)

// AppError 应用错误结构
type AppError struct {
	Code       ErrorCode              `json:"code"`
	Message    string                 `json:"message"`
	Details    interface{}            `json:"details,omitempty"`
	Severity   ErrorSeverity          `json:"severity,omitempty"`
	StackTrace string                 `json:"stack_trace,omitempty"`
	Timestamp  time.Time              `json:"timestamp"`
	HTTPStatus int                    `json:"-"`
	Cause      error                  `json:"-"`
	Context    map[string]interface{} `json:"-"`
}

// Error 实现error接口
func (e *AppError) Error() string {
	return fmt.Sprintf("[%s] %s", e.Code, e.Message)
}

// WithDetails 添加错误详情
func (e *AppError) WithDetails(details interface{}) *AppError {
	e.Details = details
	return e
}

// WithContext 添加上下文信息
func (e *AppError) WithContext(key string, value interface{}) *AppError {
	if e.Context == nil {
		e.Context = make(map[string]interface{})
	}
	e.Context[key] = value
	return e
}

// WithCause 设置原因错误
func (e *AppError) WithCause(err error) *AppError {
	e.Cause = err
	return e
}

// Wrap 包装现有错误
func (e *AppError) Wrap(err error) *AppError {
	e.Cause = err
	return e
}

// ToJSON 转换为JSON
func (e *AppError) ToJSON() []byte {
	data, _ := json.Marshal(e)
	return data
}

// New 创建新的应用错误
func New(code ErrorCode, message string) *AppError {
	return &AppError{
		Code:       code,
		Message:    message,
		Severity:   SeverityMedium,
		Timestamp:  time.Now(),
		HTTPStatus: http.StatusInternalServerError,
	}
}

// Newf 创建格式化的应用错误
func Newf(code ErrorCode, format string, args ...interface{}) *AppError {
	return New(code, fmt.Sprintf(format, args...))
}

// BadRequest 创建400错误
func BadRequest(code ErrorCode, message string) *AppError {
	err := New(code, message)
	err.HTTPStatus = http.StatusBadRequest
	err.Severity = SeverityLow
	return err
}

// Unauthorized 创建401错误
func Unauthorized(code ErrorCode, message string) *AppError {
	err := New(code, message)
	err.HTTPStatus = http.StatusUnauthorized
	err.Severity = SeverityMedium
	return err
}

// Forbidden 创建403错误
func Forbidden(code ErrorCode, message string) *AppError {
	err := New(code, message)
	err.HTTPStatus = http.StatusForbidden
	err.Severity = SeverityMedium
	return err
}

// NotFound 创建404错误
func NotFound(code ErrorCode, message string) *AppError {
	err := New(code, message)
	err.HTTPStatus = http.StatusNotFound
	err.Severity = SeverityLow
	return err
}

// Conflict 创建409错误
func Conflict(code ErrorCode, message string) *AppError {
	err := New(code, message)
	err.HTTPStatus = http.StatusConflict
	err.Severity = SeverityMedium
	return err
}

// TooManyRequests 创建429错误
func TooManyRequests(code ErrorCode, message string) *AppError {
	err := New(code, message)
	err.HTTPStatus = http.StatusTooManyRequests
	err.Severity = SeverityLow
	return err
}

// InternalServerError 创建500错误
func InternalServerError(code ErrorCode, message string) *AppError {
	err := New(code, message)
	err.HTTPStatus = http.StatusInternalServerError
	err.Severity = SeverityHigh
	return err
}

// ServiceUnavailable 创建503错误
func ServiceUnavailable(code ErrorCode, message string) *AppError {
	err := New(code, message)
	err.HTTPStatus = http.StatusServiceUnavailable
	err.Severity = SeverityHigh
	return err
}

// ValidationError 创建验证错误
func ValidationError(message string) *AppError {
	return BadRequest(SYSTEM_VALIDATION_ERROR, message)
}

// DatabaseError 创建数据库错误
func DatabaseError(message string) *AppError {
	return InternalServerError(SYSTEM_DATABASE_ERROR, message)
}

// ConfigError 创建配置错误
func ConfigError(message string) *AppError {
	return InternalServerError(SYSTEM_CONFIG_ERROR, message)
}

// FromError 从标准错误创建应用错误
func FromError(err error) *AppError {
	if err == nil {
		return nil
	}

	// 如果已经是AppError，直接返回
	if appErr, ok := err.(*AppError); ok {
		return appErr
	}

	// 根据错误类型创建相应的AppError
	switch err {
	case context.Canceled:
		return New(SYSTEM_TIMEOUT_ERROR, "Request canceled").WithSeverity(SeverityLow)
	case context.DeadlineExceeded:
		return New(SYSTEM_TIMEOUT_ERROR, "Request timeout").WithSeverity(SeverityMedium)
	default:
		return InternalServerError(SYSTEM_INTERNAL_ERROR, err.Error())
	}
}

// WithSeverity 设置错误严重程度
func (e *AppError) WithSeverity(severity ErrorSeverity) *AppError {
	e.Severity = severity
	return e
}

// WithStackTrace 添加堆栈跟踪
func (e *AppError) WithStackTrace() *AppError {
	buf := make([]byte, 4096)
	n := runtime.Stack(buf, false)
	e.StackTrace = string(buf[:n])
	return e
}

// ErrorCollection 错误集合
type ErrorCollection struct {
	Errors []*AppError `json:"errors"`
}

// NewErrorCollection 创建错误集合
func NewErrorCollection() *ErrorCollection {
	return &ErrorCollection{
		Errors: make([]*AppError, 0),
	}
}

// Add 添加错误
func (ec *ErrorCollection) Add(err *AppError) {
	ec.Errors = append(ec.Errors, err)
}

// HasErrors 检查是否有错误
func (ec *ErrorCollection) HasErrors() bool {
	return len(ec.Errors) > 0
}

// First 获取第一个错误
func (ec *ErrorCollection) First() *AppError {
	if len(ec.Errors) == 0 {
		return nil
	}
	return ec.Errors[0]
}

// ToError 转换为错误接口
func (ec *ErrorCollection) ToError() error {
	if !ec.HasErrors() {
		return nil
	}
	return ec.First()
}

// Error 实现error接口
func (ec *ErrorCollection) Error() string {
	if !ec.HasErrors() {
		return ""
	}
	return ec.First().Error()
}

// ErrorHandler 错误处理接口
type ErrorHandler interface {
	HandleError(err error) *AppError
	CanHandle(err error) bool
}

// ErrorHandlerRegistry 错误处理器注册表
type ErrorHandlerRegistry struct {
	handlers []ErrorHandler
}

// NewErrorHandlerRegistry 创建错误处理器注册表
func NewErrorHandlerRegistry() *ErrorHandlerRegistry {
	return &ErrorHandlerRegistry{
		handlers: make([]ErrorHandler, 0),
	}
}

// Register 注册错误处理器
func (r *ErrorHandlerRegistry) Register(handler ErrorHandler) {
	r.handlers = append(r.handlers, handler)
}

// Handle 处理错误
func (r *ErrorHandlerRegistry) Handle(err error) *AppError {
	for _, handler := range r.handlers {
		if handler.CanHandle(err) {
			return handler.HandleError(err)
		}
	}

	// 如果没有处理器可以处理，返回默认错误
	return FromError(err)
}

// 全局错误处理器注册表
var defaultErrorHandlerRegistry = NewErrorHandlerRegistry()

// RegisterErrorHandler 注册错误处理器
func RegisterErrorHandler(handler ErrorHandler) {
	defaultErrorHandlerRegistry.Register(handler)
}

// HandleError 处理错误
func HandleError(err error) *AppError {
	return defaultErrorHandlerRegistry.Handle(err)
}
