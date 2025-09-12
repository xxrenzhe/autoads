package gvalid

import (
	"reflect"
	"regexp"
	"strconv"
	"strings"
)

// Validator 验证器接口
type Validator interface {
	Validate(value interface{}) error
}

// ValidationRule 验证规则
type ValidationRule struct {
	Name     string
	Params   []string
	Message  string
	Validate func(value interface{}, params []string) bool
}

// ValidatorManager 验证器管理器
type ValidatorManager struct {
	rules map[string]*ValidationRule
}

// NewValidatorManager 创建验证器管理器
func NewValidatorManager() *ValidatorManager {
	vm := &ValidatorManager{
		rules: make(map[string]*ValidationRule),
	}
	
	// 注册内置验证规则
	vm.registerBuiltinRules()
	
	return vm
}

// registerBuiltinRules 注册内置验证规则
func (vm *ValidatorManager) registerBuiltinRules() {
	// 必填
	vm.RegisterRule("required", &ValidationRule{
		Name:    "required",
		Message: "field is required",
		Validate: func(value interface{}, params []string) bool {
			if value == nil {
				return false
			}
			v := reflect.ValueOf(value)
			switch v.Kind() {
			case reflect.String:
				return v.String() != ""
			case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
				return v.Int() != 0
			case reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64:
				return v.Uint() != 0
			case reflect.Float32, reflect.Float64:
				return v.Float() != 0
			case reflect.Bool:
				return v.Bool()
			case reflect.Slice, reflect.Map, reflect.Array:
				return v.Len() > 0
			case reflect.Ptr:
				return !v.IsNil()
			}
			return true
		},
	})
	
	// 邮箱
	vm.RegisterRule("email", &ValidationRule{
		Name:    "email",
		Message: "must be a valid email address",
		Validate: func(value interface{}, params []string) bool {
			str, ok := value.(string)
			if !ok {
				return false
			}
			emailRegex := `^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$`
			matched, _ := regexp.MatchString(emailRegex, str)
			return matched
		},
	})
	
	// 最小长度
	vm.RegisterRule("min", &ValidationRule{
		Name:    "min",
		Message: "minimum length is {0}",
		Validate: func(value interface{}, params []string) bool {
			if len(params) == 0 {
				return false
			}
			min, err := strconv.Atoi(params[0])
			if err != nil {
				return false
			}
			
			str, ok := value.(string)
			if !ok {
				return false
			}
			return len(str) >= min
		},
	})
	
	// 最大长度
	vm.RegisterRule("max", &ValidationRule{
		Name:    "max",
		Message: "maximum length is {0}",
		Validate: func(value interface{}, params []string) bool {
			if len(params) == 0 {
				return false
			}
			max, err := strconv.Atoi(params[0])
			if err != nil {
				return false
			}
			
			str, ok := value.(string)
			if !ok {
				return false
			}
			return len(str) <= max
		},
	})
	
	// 正则表达式
	vm.RegisterRule("regex", &ValidationRule{
		Name:    "regex",
		Message: "format is invalid",
		Validate: func(value interface{}, params []string) bool {
			if len(params) == 0 {
				return false
			}
			str, ok := value.(string)
			if !ok {
				return false
			}
			matched, _ := regexp.MatchString(params[0], str)
			return matched
		},
	})
	
	// 数值范围
	vm.RegisterRule("between", &ValidationRule{
		Name:    "between",
		Message: "must be between {0} and {1}",
		Validate: func(value interface{}, params []string) bool {
			if len(params) < 2 {
				return false
			}
			min, err1 := strconv.Atoi(params[0])
			max, err2 := strconv.Atoi(params[1])
			if err1 != nil || err2 != nil {
				return false
			}
			
			switch v := value.(type) {
			case int:
				return v >= min && v <= max
			case int64:
				return int(v) >= min && int(v) <= max
			case float64:
				return int(v) >= min && int(v) <= max
			case string:
				num, err := strconv.Atoi(v)
				if err != nil {
					return false
				}
				return num >= min && num <= max
			}
			return false
		},
	})
	
	// 枚举值
	vm.RegisterRule("in", &ValidationRule{
		Name:    "in",
		Message: "must be one of: {0}",
		Validate: func(value interface{}, params []string) bool {
			if len(params) == 0 {
				return false
			}
			
			str, ok := value.(string)
			if !ok {
				return false
			}
			
			for _, param := range params {
				if str == param {
					return true
				}
			}
			return false
		},
	})
}

// RegisterRule 注册验证规则
func (vm *ValidatorManager) RegisterRule(name string, rule *ValidationRule) {
	vm.rules[name] = rule
}

// Validate 验证数据
func (vm *ValidatorManager) Validate(data map[string]interface{}, rules map[string]string) map[string]string {
	errors := make(map[string]string)
	
	for field, ruleStr := range rules {
		value := data[field]
		
		// 解析验证规则
		ruleList := strings.Split(ruleStr, "|")
		for _, rule := range ruleList {
			parts := strings.SplitN(rule, ":", 2)
			ruleName := parts[0]
			var ruleParams []string
			
			if len(parts) > 1 {
				ruleParams = strings.Split(parts[1], ",")
			}
			
			// 获取验证规则
			validationRule, exists := vm.rules[ruleName]
			if !exists {
				continue
			}
			
			// 执行验证
			if !validationRule.Validate(value, ruleParams) {
				// 格式化错误消息
				message := validationRule.Message
				for i, param := range ruleParams {
					message = strings.ReplaceAll(message, "{"+strconv.Itoa(i)+"}", param)
				}
				errors[field] = message
				break
			}
		}
	}
	
	return errors
}

// ValidateStruct 验证结构体
func (vm *ValidatorManager) ValidateStruct(obj interface{}, rules map[string]string) map[string]string {
	// 将结构体转换为map
	data := make(map[string]interface{})
	v := reflect.ValueOf(obj)
	
	if v.Kind() == reflect.Ptr {
		v = v.Elem()
	}
	
	if v.Kind() != reflect.Struct {
		return map[string]string{"error": "input must be a struct or pointer to struct"}
	}
	
	t := v.Type()
	for i := 0; i < v.NumField(); i++ {
		field := t.Field(i)
		fieldValue := v.Field(i)
		
		// 获取字段的json标签作为key
		tag := field.Tag.Get("json")
		if tag != "" {
			// 去掉omitempty等选项
			tag = strings.Split(tag, ",")[0]
			data[tag] = fieldValue.Interface()
		} else {
			// 使用字段名（小写）
			data[strings.ToLower(field.Name)] = fieldValue.Interface()
		}
	}
	
	return vm.Validate(data, rules)
}

// 全局验证器管理器
var defaultValidator = NewValidatorManager()

// Validate 验证数据（使用全局验证器）
func Validate(data map[string]interface{}, rules map[string]string) map[string]string {
	return defaultValidator.Validate(data, rules)
}

// ValidateStruct 验证结构体（使用全局验证器）
func ValidateStruct(obj interface{}, rules map[string]string) map[string]string {
	return defaultValidator.ValidateStruct(obj, rules)
}

// RegisterRule 注册验证规则（使用全局验证器）
func RegisterRule(name string, rule *ValidationRule) {
	defaultValidator.RegisterRule(name, rule)
}