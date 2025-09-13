package siterank

import (
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// RegisterRoutes 注册SiteRank路由
func RegisterRoutes(db *gorm.DB) {
	// SiteRank路由已在主应用中注册
	// 此函数保留用于兼容性
}

// InitSiteRankService 初始化SiteRank服务（供其他模块调用）
func InitSiteRankService(db *gorm.DB) *Service {
	// 使用模拟Token服务避免循环依赖
	config := DefaultSimilarWebConfig()
	return NewServiceWithMockToken(db, config)
}
