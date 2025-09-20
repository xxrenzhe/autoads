package gf

import (
	"reflect"
	"strings"
	"time"
)

// GetTableName 获取模型表名
func GetTableName(model interface{}) string {
	if model == nil {
		return ""
	}

	// 通过反射获取模型名称
	val := reflect.ValueOf(model)
	if val.Kind() == reflect.Ptr {
		val = val.Elem()
	}

	if val.Kind() == reflect.Struct {
		typeName := val.Type().Name()
		// 简单的复数转换
		if strings.HasSuffix(typeName, "y") {
			return strings.TrimSuffix(typeName, "y") + "ies"
		} else if strings.HasSuffix(typeName, "s") {
			return typeName + "es"
		} else {
			return typeName + "s"
		}
	}

	return ""
}

// GetColumnName 获取字段列名
func GetColumnName(field reflect.StructField) string {
	// 获取gform标签
	tag := field.Tag.Get("gform")
	if tag != "" && tag != "-" {
		// 解析标签中的列名
		parts := strings.Split(tag, ";")
		for _, part := range parts {
			if strings.HasPrefix(part, "column:") {
				return strings.TrimPrefix(part, "column:")
			}
		}
	}

	// 默认使用蛇形命名
	return toSnakeCase(field.Name)
}

// toSnakeCase 转换为蛇形命名
func toSnakeCase(s string) string {
	var result []rune
	for i, r := range s {
		if i > 0 && (r >= 'A' && r <= 'Z') {
			result = append(result, '_')
		}
		result = append(result, r)
	}
	return strings.ToLower(string(result))
}

// Now 获取当前时间
func Now() time.Time {
	return time.Now()
}
