package siterank

import (
    "gorm.io/gorm"
    "gofly-admin-v3/internal/token"
    "gofly-admin-v3/utils/gf"
)

// RegisterRoutes 注册SiteRank路由
func RegisterRoutes(db *gorm.DB) {
	// TODO: 完整实现需要修复user模块的编译错误
	// 暂时注释掉以避免编译错误
	/*
		// 初始化服务
		tokenService := user.NewTokenService(db)
		config := DefaultSimilarWebConfig()
		service := NewService(db, tokenService, config)
		controller := NewController(service, db)

		// 注册新版API路由
		gf.RegisterRoute("POST", "/api/v1/siterank/query", gin.HandlerFunc(controller.QueryDomain), false, []string{})
		gf.RegisterRoute("POST", "/api/v1/siterank/batch-query", gin.HandlerFunc(controller.BatchQuery), false, []string{})
		gf.RegisterRoute("GET", "/api/v1/siterank/queries/:query_id", gin.HandlerFunc(controller.GetQuery), false, []string{})
		gf.RegisterRoute("GET", "/api/v1/siterank/queries", gin.HandlerFunc(controller.GetQueries), false, []string{})
		gf.RegisterRoute("GET", "/api/v1/siterank/stats", gin.HandlerFunc(controller.GetStats), false, []string{})
		gf.RegisterRoute("GET", "/api/v1/siterank/top-domains", gin.HandlerFunc(controller.GetTopDomains), true, []string{})

		// 注册兼容旧版API路由
		gf.RegisterRoute("POST", "/api/siterank/query", gin.HandlerFunc(controller.LegacyQuery), false, []string{})
		gf.RegisterRoute("POST", "/api/siterank/batch-query", gin.HandlerFunc(controller.LegacyBatchQuery), false, []string{})
		gf.RegisterRoute("GET", "/api/siterank/result/:query_id", gin.HandlerFunc(controller.LegacyGetResult), false, []string{})

		// 注册管理员路由（如果需要）
		gf.RegisterRoute("GET", "/api/admin/siterank/queries", gin.HandlerFunc(controller.GetQueries), false, []string{"admin"})
		gf.RegisterRoute("GET", "/api/admin/siterank/stats", gin.HandlerFunc(controller.GetStats), false, []string{"admin"})
	*/
}

// InitSiteRankService 初始化SiteRank服务（供其他模块调用）
func InitSiteRankService(db *gorm.DB) *Service {
    // 使用真实 Token 适配器
    config := DefaultSimilarWebConfig()
    tk := token.NewAdapterWithService(token.NewService(gf.DB()))
    return NewService(db, tk, config)
}
