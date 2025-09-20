package audit

import (
    "github.com/gin-gonic/gin"
    "gofly-admin-v3/utils/gf"
    "gorm.io/gorm"
)

// RegisterRoutes 注册审计统计相关路由
func RegisterRoutes(db *gorm.DB) {
    if db == nil { return }
    svc := NewAutoAdsAuditService(db)
    ctrl := NewController(svc)

    base := "/api/v1/audit"
    // 用户活动摘要
    gf.RegisterRoute("GET", base+"/user/activity-summary", gin.HandlerFunc(ctrl.GetUserActivitySummaryHandler), false, []string{})
    // 安全总览（包含安全统计、滥用统计、可疑用户）
    gf.RegisterRoute("GET", base+"/security/overview", gin.HandlerFunc(ctrl.GetSecurityOverviewHandler), false, []string{})
    // 事件查询
    gf.RegisterRoute("GET", base+"/events/data-access", gin.HandlerFunc(ctrl.GetDataAccessEventsHandler), false, []string{})
    gf.RegisterRoute("GET", base+"/events/permission-changes", gin.HandlerFunc(ctrl.GetPermissionChangesHandler), false, []string{})
    gf.RegisterRoute("GET", base+"/events/data-exports", gin.HandlerFunc(ctrl.GetDataExportEventsHandler), false, []string{})
    // 管理员操作（需要管理员）
    gf.RegisterRoute("GET", base+"/events/admin-actions", gin.HandlerFunc(ctrl.GetAdminActionsHandler), false, []string{"admin"})
    // 数据一致性 - 孤儿巡检报告（需要管理员）
    gf.RegisterRoute("GET", base+"/consistency/orphans", gin.HandlerFunc(ctrl.GetOrphanReportsHandler), false, []string{"admin"})
}
