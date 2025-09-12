package gf

import (
	"encoding/json"
	"os"

	"github.com/gin-gonic/gin"
)

// GetRoutes 获取路由信息
func GetRoutes() []gin.RouteInfo {
	// 返回空的路由信息，实际使用时需要从gin.Engine获取
	return []gin.RouteInfo{}
}

// GetModels 获取模型信息
func GetModels() []interface{} {
	// 返回空的模型信息
	return []interface{}{}
}

// WriteFile 写入文件
func WriteFile(filename string, data []byte, perm os.FileMode) error {
	return os.WriteFile(filename, data, perm)
}

// ToJSON 转换为JSON字符串
func ToJSON(v interface{}) string {
	data, err := json.Marshal(v)
	if err != nil {
		return ""
	}
	return string(data)
}

// Group 创建路由组
func Group(relativePath string, handlers ...gin.HandlerFunc) *gin.RouterGroup {
	// 返回一个空的路由组，实际使用时需要从gin.Engine获取
	return &gin.RouterGroup{}
}

// HandlerFunc 创建处理器 (已在gf.go中定义)
// func HandlerFunc(f func(*gin.Context)) gin.HandlerFunc {
// 	return gin.HandlerFunc(f)
// }