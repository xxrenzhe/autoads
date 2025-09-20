package types

import "fmt"

// ValidationError 配置验证错误
type ValidationError struct {
	Field   string      `json:"field"`
	Message string      `json:"message"`
	Value   interface{} `json:"value,omitempty"`
}

// Error 实现error接口
func (ve *ValidationError) Error() string {
	return fmt.Sprintf("validation failed for field '%s': %s", ve.Field, ve.Message)
}

// ValidationErrors 验证错误集合
type ValidationErrors struct {
	Errors []*ValidationError `json:"errors"`
}

// Error 实现error接口
func (ve *ValidationErrors) Error() string {
	if len(ve.Errors) == 0 {
		return ""
	}
	return fmt.Sprintf("configuration validation failed with %d errors", len(ve.Errors))
}

// Add 添加验证错误
func (ve *ValidationErrors) Add(field, message string, value interface{}) {
	ve.Errors = append(ve.Errors, &ValidationError{
		Field:   field,
		Message: message,
		Value:   value,
	})
}

// HasErrors 检查是否有错误
func (ve *ValidationErrors) HasErrors() bool {
	return len(ve.Errors) > 0
}

// ToMap 转换为map格式
func (ve *ValidationErrors) ToMap() map[string]interface{} {
	result := make(map[string]interface{})
	for _, err := range ve.Errors {
		result[err.Field] = err.Message
	}
	return result
}
