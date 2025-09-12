package validator

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	"gofly-admin-v3/utils/gf"
)

// Validator 自定义验证器
type Validator struct {
	rules map[string][]ValidationRule
}

// ValidationRule 验证规则
type ValidationRule struct {
	Name     string
	Params   []string
	Message  string
	Callback func(value interface{}, params []string) bool
}

// ValidationError 验证错误
type ValidationError struct {
	Field   string      `json:"field"`
	Value   interface{} `json:"value,omitempty"`
	Rule    string      `json:"rule"`
	Message string      `json:"message"`
}

// ValidationResult 验证结果
type ValidationResult struct {
	IsValid bool
	Errors  []ValidationError
}

// NewValidator 创建新的验证器
func NewValidator() *Validator {
	return &Validator{
		rules: make(map[string][]ValidationRule),
	}
}

// AddRule 添加验证规则
func (v *Validator) AddRule(field string, rule ValidationRule) {
	v.rules[field] = append(v.rules[field], rule)
}

// Validate 验证数据
func (v *Validator) Validate(data map[string]interface{}) *ValidationResult {
	result := &ValidationResult{
		IsValid: true,
		Errors:  make([]ValidationError, 0),
	}

	for field, rules := range v.rules {
		value := data[field]

		for _, rule := range rules {
			if !rule.Callback(value, rule.Params) {
				result.IsValid = false
				result.Errors = append(result.Errors, ValidationError{
					Field:   field,
					Value:   value,
					Rule:    rule.Name,
					Message: rule.Message,
				})
			}
		}
	}

	return result
}

// ValidateStruct 验证结构体
func (v *Validator) ValidateStruct(data interface{}) *ValidationResult {
	// 将结构体转换为map
	m, err := gf.StructToMap(data)
	if err != nil {
		return &ValidationResult{
			IsValid: false,
			Errors: []ValidationError{
				{
					Field:   "",
					Rule:    "struct_conversion",
					Message: fmt.Sprintf("Failed to convert struct to map: %v", err),
				},
			},
		}
	}

	return v.Validate(m)
}

// 内置验证规则
var (
	// Required 必填字段
	Required = ValidationRule{
		Name:    "required",
		Message: "This field is required",
		Callback: func(value interface{}, params []string) bool {
			if value == nil {
				return false
			}
			switch v := value.(type) {
			case string:
				return strings.TrimSpace(v) != ""
			case int, int8, int16, int32, int64:
				return v != 0
			case uint, uint8, uint16, uint32, uint64:
				return v != 0
			case float32, float64:
				return v != 0
			case bool:
				return v
			case []interface{}:
				return len(v) > 0
			case map[string]interface{}:
				return len(v) > 0
			default:
				return true
			}
		},
	}

	// Email 邮箱格式
	Email = ValidationRule{
		Name:    "email",
		Message: "Invalid email format",
		Callback: func(value interface{}, params []string) bool {
			if value == nil || value == "" {
				return true
			}
			email, ok := value.(string)
			if !ok {
				return false
			}
			emailRegex := regexp.MustCompile(`^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$`)
			return emailRegex.MatchString(email)
		},
	}

	// MinLength 最小长度
	MinLength = func(min int) ValidationRule {
		return ValidationRule{
			Name:    "min_length",
			Params:  []string{strconv.Itoa(min)},
			Message: fmt.Sprintf("Minimum length is %d", min),
			Callback: func(value interface{}, params []string) bool {
				if value == nil || value == "" {
					return true
				}
				str, ok := value.(string)
				if !ok {
					return false
				}
				return utf8.RuneCountInString(str) >= min
			},
		}
	}

	// MaxLength 最大长度
	MaxLength = func(max int) ValidationRule {
		return ValidationRule{
			Name:    "max_length",
			Params:  []string{strconv.Itoa(max)},
			Message: fmt.Sprintf("Maximum length is %d", max),
			Callback: func(value interface{}, params []string) bool {
				if value == nil || value == "" {
					return true
				}
				str, ok := value.(string)
				if !ok {
					return false
				}
				return utf8.RuneCountInString(str) <= max
			},
		}
	}

	// Min 最小值
	Min = func(min int64) ValidationRule {
		return ValidationRule{
			Name:    "min",
			Params:  []string{strconv.FormatInt(min, 10)},
			Message: fmt.Sprintf("Minimum value is %d", min),
			Callback: func(value interface{}, params []string) bool {
				if value == nil {
					return true
				}
				switch v := value.(type) {
				case int:
					return int64(v) >= min
				case int8:
					return int64(v) >= min
				case int16:
					return int64(v) >= min
				case int32:
					return int64(v) >= min
				case int64:
					return v >= min
				case uint:
					return uint64(v) >= uint64(min)
				case uint8:
					return uint64(v) >= uint64(min)
				case uint16:
					return uint64(v) >= uint64(min)
				case uint32:
					return uint64(v) >= uint64(min)
				case uint64:
					return v >= uint64(min)
				case float32:
					return float64(v) >= float64(min)
				case float64:
					return v >= float64(min)
				default:
					return false
				}
			},
		}
	}

	// Max 最大值
	Max = func(max int64) ValidationRule {
		return ValidationRule{
			Name:    "max",
			Params:  []string{strconv.FormatInt(max, 10)},
			Message: fmt.Sprintf("Maximum value is %d", max),
			Callback: func(value interface{}, params []string) bool {
				if value == nil {
					return true
				}
				switch v := value.(type) {
				case int:
					return int64(v) <= max
				case int8:
					return int64(v) <= max
				case int16:
					return int64(v) <= max
				case int32:
					return int64(v) <= max
				case int64:
					return v <= max
				case uint:
					return uint64(v) <= uint64(max)
				case uint8:
					return uint64(v) <= uint64(max)
				case uint16:
					return uint64(v) <= uint64(max)
				case uint32:
					return uint64(v) <= uint64(max)
				case uint64:
					return v <= uint64(max)
				case float32:
					return float64(v) <= float64(max)
				case float64:
					return v <= float64(max)
				default:
					return false
				}
			},
		}
	}

	// In 在指定值中
	In = func(values ...interface{}) ValidationRule {
		valueStrs := make([]string, len(values))
		for i, v := range values {
			valueStrs[i] = fmt.Sprintf("%v", v)
		}
		return ValidationRule{
			Name:    "in",
			Params:  valueStrs,
			Message: fmt.Sprintf("Value must be one of: %v", values),
			Callback: func(value interface{}, params []string) bool {
				if value == nil {
					return true
				}
				for _, v := range values {
					if value == v {
						return true
					}
				}
				return false
			},
		}
	}

	// NotIn 不在指定值中
	NotIn = func(values ...interface{}) ValidationRule {
		return ValidationRule{
			Name:    "not_in",
			Message: fmt.Sprintf("Value must not be one of: %v", values),
			Callback: func(value interface{}, params []string) bool {
				if value == nil {
					return true
				}
				for _, v := range values {
					if value == v {
						return false
					}
				}
				return true
			},
		}
	}

	// Regex 正则匹配
	Regex = func(pattern string) ValidationRule {
		return ValidationRule{
			Name:    "regex",
			Params:  []string{pattern},
			Message: fmt.Sprintf("Value must match pattern: %s", pattern),
			Callback: func(value interface{}, params []string) bool {
				if value == nil || value == "" {
					return true
				}
				str, ok := value.(string)
				if !ok {
					return false
				}
				regex, err := regexp.Compile(pattern)
				if err != nil {
					return false
				}
				return regex.MatchString(str)
			},
		}
	}

	// Alphabetic 只包含字母
	Alphabetic = ValidationRule{
		Name:    "alphabetic",
		Message: "Only alphabetic characters are allowed",
		Callback: func(value interface{}, params []string) bool {
			if value == nil || value == "" {
				return true
			}
			str, ok := value.(string)
			if !ok {
				return false
			}
			for _, r := range str {
				if !unicode.IsLetter(r) {
					return false
				}
			}
			return true
		},
	}

	// Alphanumeric 只包含字母和数字
	Alphanumeric = ValidationRule{
		Name:    "alphanumeric",
		Message: "Only alphanumeric characters are allowed",
		Callback: func(value interface{}, params []string) bool {
			if value == nil || value == "" {
				return true
			}
			str, ok := value.(string)
			if !ok {
				return false
			}
			for _, r := range str {
				if !unicode.IsLetter(r) && !unicode.IsDigit(r) {
					return false
				}
			}
			return true
		},
	}

	// PasswordStrength 密码强度
	PasswordStrength = ValidationRule{
		Name:    "password_strength",
		Message: "Password must contain at least 8 characters, including uppercase, lowercase, numbers and special characters",
		Callback: func(value interface{}, params []string) bool {
			str, ok := value.(string)
			if !ok {
				return false
			}

			if len(str) < 8 {
				return false
			}

			var hasUpper, hasLower, hasNumber, hasSpecial bool
			for _, r := range str {
				switch {
				case unicode.IsUpper(r):
					hasUpper = true
				case unicode.IsLower(r):
					hasLower = true
				case unicode.IsDigit(r):
					hasNumber = true
				case unicode.IsPunct(r) || unicode.IsSymbol(r):
					hasSpecial = true
				}
			}

			return hasUpper && hasLower && hasNumber && hasSpecial
		},
	}

	// Date 日期格式
	Date = func(layout string) ValidationRule {
		return ValidationRule{
			Name:    "date",
			Params:  []string{layout},
			Message: fmt.Sprintf("Invalid date format, expected: %s", layout),
			Callback: func(value interface{}, params []string) bool {
				if value == nil || value == "" {
					return true
				}
				str, ok := value.(string)
				if !ok {
					return false
				}
				_, err := time.Parse(layout, str)
				return err == nil
			},
		}
	}

	// URL URL格式
	URL = ValidationRule{
		Name:    "url",
		Message: "Invalid URL format",
		Callback: func(value interface{}, params []string) bool {
			if value == nil || value == "" {
				return true
			}
			str, ok := value.(string)
			if !ok {
				return false
			}
			urlRegex := regexp.MustCompile(`^https?://[^\s/$.?#].[^\s]*$`)
			return urlRegex.MatchString(str)
		},
	}

	// Phone 手机号格式
	Phone = ValidationRule{
		Name:    "phone",
		Message: "Invalid phone number format",
		Callback: func(value interface{}, params []string) bool {
			if value == nil || value == "" {
				return true
			}
			str, ok := value.(string)
			if !ok {
				return false
			}
			phoneRegex := regexp.MustCompile(`^1[3-9]\d{9}$`)
			return phoneRegex.MatchString(str)
		},
	}

	// Custom 自定义验证规则
	Custom = func(message string, callback func(interface{}, []string) bool) ValidationRule {
		return ValidationRule{
			Name:     "custom",
			Message:  message,
			Callback: callback,
		}
	}
)

// Validate 验证数据的便捷函数
func Validate(data map[string]interface{}, rules map[string][]ValidationRule) (*ValidationResult, error) {
	v := NewValidator()

	for field, fieldRules := range rules {
		for _, rule := range fieldRules {
			v.AddRule(field, rule)
		}
	}

	return v.Validate(data), nil
}

// ValidateStruct 验证结构体的便捷函数
func ValidateStruct(data interface{}, rules map[string][]ValidationRule) (*ValidationResult, error) {
	v := NewValidator()

	for field, fieldRules := range rules {
		for _, rule := range fieldRules {
			v.AddRule(field, rule)
		}
	}

	return v.ValidateStruct(data), nil
}

// ValidationMiddleware 验证中间件
func ValidationMiddleware(rules map[string][]ValidationRule) func(map[string]interface{}) *ValidationResult {
	return func(data map[string]interface{}) *ValidationResult {
		result, err := Validate(data, rules)
		if err != nil {
			return &ValidationResult{
				IsValid: false,
				Errors: []ValidationError{
					{
						Field:   "",
						Rule:    "validation_error",
						Message: err.Error(),
					},
				},
			}
		}
		return result
	}
}
