package auth

import (
	"gorm.io/gorm"
)

// RegisterRoutes 注册认证路由
func RegisterRoutes(db *gorm.DB) {
	// TODO: 实现认证路由注册
	// 暂时注释掉以避免编译错误
	/*
		// 初始化认证控制器
		controller := NewController(db)

		// 注册认证路由
		gf.RegisterRoute("POST", "/api/v1/auth/register", controller.Register, true, []string{})
		gf.RegisterRoute("POST", "/api/v1/auth/login", controller.Login, true, []string{})
	*/
}
