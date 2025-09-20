package gf

import (
	"github.com/gin-gonic/gin"
)

// ManualRoute 手动路由结构
type ManualRoute struct {
	Method      string
	Path        string
	Handler     gin.HandlerFunc
	NoNeedLogin bool
	NoNeedAuths []string
}

// ManualRoutes 手动注册的路由集合
var ManualRoutes = []ManualRoute{}

// RegisterRoute 手动注册路由
func RegisterRoute(method, path string, handler gin.HandlerFunc, noNeedLogin bool, noNeedAuths []string) {
	route := ManualRoute{
		Method:      method,
		Path:        path,
		Handler:     handler,
		NoNeedLogin: noNeedLogin,
		NoNeedAuths: noNeedAuths,
	}
	ManualRoutes = append(ManualRoutes, route)
}

// GetManualRoutes 获取所有手动注册的路由
func GetManualRoutes() []ManualRoute {
	return ManualRoutes
}
