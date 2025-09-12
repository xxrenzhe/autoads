//go:build autoads_siterank_advanced

package siterankgo

import (
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"gofly-admin-v3/internal/store"
	"gofly-admin-v3/internal/user"
	"gofly-admin-v3/utils/gf"
)

// EnhancedController 增强的SiteRankGo控制器
type EnhancedController struct {
	service *EnhancedService
}

// NewEnhancedController 创建增强控制器
func NewEnhancedController(db *store.DB, redis *store.Redis) *EnhancedController {
	return &EnhancedController{
		service: NewEnhancedService(db, redis),
	}
}

// CreateEnhancedQuery 创建增强查询
// @Summary 创建增强SiteRank查询
// @Description 支持SimilarWeb、Alexa等第三方数据集成
// @Tags SiteRankGo
// @Security ApiKeyAuth
// @Accept json
// @Produce json
// @Param request body EnhancedQueryCreateRequest true "增强查询请求"
// @Success 200 {object} gf.Response
// @Router /api/v1/siterank/enhanced-queries [post]
func (c *EnhancedController) CreateEnhancedQuery(ctx *gin.Context) {
	var req EnhancedQueryCreateRequest

	if err := ctx.ShouldBind(&req); err != nil {
		gf.Error().SetMsg(err.Error()).Regin(ctx)
		return
	}

	// 获取用户ID
	userID := ctx.MustGet("user_id").(string)

	// 创建增强查询
	query, err := c.service.CreateEnhancedQuery(userID, &req)
	if err != nil {
		gf.Error().SetMsg(err.Error()).Regin(ctx)
		return
	}

	gf.Success().SetData(gf.Map{
		"query":   query.ToResponse(),
		"message": "增强查询创建成功",
	}).Regin(ctx)
}

// StartEnhancedQuery 启动增强查询
// @Summary 启动增强SiteRank查询
// @Description 启动增强查询，将集成第三方数据源
// @Tags SiteRankGo
// @Security ApiKeyAuth
// @Param id path string true "查询ID"
// @Success 200 {object} gf.Response
// @Router /api/v1/siterank/enhanced-queries/{id}/start [post]
func (c *EnhancedController) StartEnhancedQuery(ctx *gin.Context) {
	queryID := ctx.Param("id")
	userID := ctx.MustGet("user_id").(string)

	// 启动增强查询
	if err := c.service.StartEnhancedQuery(queryID, userID); err != nil {
		gf.Error().SetMsg(err.Error()).Regin(ctx)
		return
	}

	gf.Success().SetData(gf.Map{
		"message": "增强查询已开始执行",
	}).Regin(ctx)
}

// GetSimilarWebData 获取SimilarWeb数据
// @Summary 获取SimilarWeb数据
// @Description 直接获取域名的SimilarWeb分析数据
// @Tags SiteRankGo
// @Security ApiKeyAuth
// @Param domain query string true "域名"
// @Success 200 {object} gf.Response
// @Router /api/v1/siterank/similarweb [get]
func (c *EnhancedController) GetSimilarWebData(ctx *gin.Context) {
	domain := ctx.Query("domain")
	if domain == "" {
		gf.Error().SetMsg("域名不能为空").Regin(ctx)
		return
	}

	// 获取用户ID（用于权限检查和计费）
	userID := ctx.MustGet("user_id").(string)

	// 检查用户套餐权限
	userService := user.NewService(c.service.db)
	userInfo, err := userService.GetUserByID(userID)
	if err != nil {
		gf.Error().SetMsg("获取用户信息失败").Regin(ctx)
		return
	}

	// 检查权限（仅Pro和Max套餐支持）
	if userInfo.Subscription != "pro" && userInfo.Subscription != "max" {
		gf.Error().SetMsg("当前套餐不支持SimilarWeb功能").Regin(ctx)
		return
	}

	// 计算Token消耗（单次查询消耗50个Token）
	tokenCost := 50

	// 检查Token余额
	userBalance, err := userService.GetUserTokenBalance(userID)
	if err != nil {
		gf.Error().SetMsg("获取Token余额失败").Regin(ctx)
		return
	}

	if userBalance < tokenCost {
		gf.Error().SetMsg("Token余额不足，需要50个Token").Regin(ctx)
		return
	}

	// 扣除Token
	if err := userService.DeductToken(userID, tokenCost, fmt.Sprintf("SimilarWeb数据查询: %s", domain)); err != nil {
		gf.Error().SetMsg("扣除Token失败").Regin(ctx)
		return
	}

	// 获取SimilarWeb数据
	data, err := c.service.GetSimilarWebData(domain)
	if err != nil {
		gf.Error().SetMsg(err.Error()).Regin(ctx)
		return
	}

	gf.Success().SetData(gf.Map{
		"data":    data,
		"message": "数据获取成功",
	}).Regin(ctx)
}

// BatchGetSimilarWebData 批量获取SimilarWeb数据
// @Summary 批量获取SimilarWeb数据
// @Description 批量查询多个域名的SimilarWeb数据
// @Tags SiteRankGo
// @Security ApiKeyAuth
// @Accept json
// @Produce json
// @Param request body BatchSimilarWebRequest true "批量查询请求"
// @Success 200 {object} gf.Response
// @Router /api/v1/siterank/similarweb/batch [post]
func (c *EnhancedController) BatchGetSimilarWebData(ctx *gin.Context) {
	var req BatchSimilarWebRequest

	if err := ctx.ShouldBind(&req); err != nil {
		gf.Error().SetMsg(err.Error()).Regin(ctx)
		return
	}

	// 获取用户ID
	userID := ctx.MustGet("user_id").(string)

	// 检查用户套餐权限
	userService := user.NewService(c.service.db)
	userInfo, err := userService.GetUserByID(userID)
	if err != nil {
		gf.Error().SetMsg("获取用户信息失败").Regin(ctx)
		return
	}

	// 检查权限（仅Max套餐支持批量查询）
	if userInfo.Subscription != "max" {
		gf.Error().SetMsg("仅Max套餐支持批量SimilarWeb查询").Regin(ctx)
		return
	}

	// 计算Token消耗（批量查询有折扣）
	tokenCost := len(req.Domains) * 40 // 每个域名40个Token

	// 检查Token余额
	userBalance, err := userService.GetUserTokenBalance(userID)
	if err != nil {
		gf.Error().SetMsg("获取Token余额失败").Regin(ctx)
		return
	}

	if userBalance < tokenCost {
		gf.Error().SetMsg("Token余额不足").Regin(ctx)
		return
	}

	// 扣除Token
	if err := userService.DeductToken(userID, tokenCost, fmt.Sprintf("批量SimilarWeb数据查询: %d个域名", len(req.Domains))); err != nil {
		gf.Error().SetMsg("扣除Token失败").Regin(ctx)
		return
	}

	// 批量获取数据
	results, err := c.service.BatchGetSimilarWebData(req.Domains)
	if err != nil {
		gf.Error().SetMsg(err.Error()).Regin(ctx)
		return
	}

	gf.Success().SetData(gf.Map{
		"results": results,
		"count":   len(results),
		"message": "批量查询完成",
	}).Regin(ctx)
}

// GetQueryEnhancedResults 获取查询的增强结果
// @Summary 获取增强查询结果
// @Description 包含SimilarWeb、Alexa等第三方数据
// @Tags SiteRankGo
// @Security ApiKeyAuth
// @Param id path string true "查询ID"
// @Success 200 {object} gf.Response
// @Router /api/v1/siterank/enhanced-queries/{id}/results [get]
func (c *EnhancedController) GetQueryEnhancedResults(ctx *gin.Context) {
	queryID := ctx.Param("id")
	userID := ctx.MustGet("user_id").(string)

	// 获取查询
	query, err := c.service.GetQuery(queryID)
	if err != nil {
		gf.Error().SetMsg("查询不存在").Regin(ctx)
		return
	}

	// 检查权限
	if query.UserID != userID {
		gf.Error().SetCode(http.StatusForbidden).SetMsg("无权限访问此查询").Regin(ctx)
		return
	}

	// 获取基础结果
	basicResults, err := c.service.GetQueryWithResults(queryID)
	if err != nil {
		gf.Error().SetMsg("获取基础结果失败").Regin(ctx)
		return
	}

	// 获取增强配置
	enhancedConfig, err := c.service.getEnhancedConfig(queryID)
	if err != nil {
		gf.Error().SetMsg("获取增强配置失败").Regin(ctx)
		return
	}

	// 准备响应
	response := gf.Map{
		"query":    basicResults,
		"enhanced": enhancedConfig,
	}

	// 获取SimilarWeb结果
	if enable, ok := enhancedConfig["enable_similarweb"].(bool); ok && enable {
		var similarWebResults []SimilarWebResult
		if err := c.service.db.Where("query_id = ?", queryID).Find(&similarWebResults).Error; err == nil {
			response["similarweb_results"] = similarWebResults
		}
	}

	// 获取Alexa结果（如果有）
	if enable, ok := enhancedConfig["enable_alexa"].(bool); ok && enable {
		// TODO: 实现Alexa结果获取
	}

	gf.Success().SetData(response).Regin(ctx)
}

// ExportResults 导出查询结果
// @Summary 导出查询结果
// @Description 将查询结果导出为指定格式
// @Tags SiteRankGo
// @Security ApiKeyAuth
// @Param id path string true "查询ID"
// @Param format query string true "导出格式" Enums(json,csv,excel,pdf)
// @Success 200 {object} gf.Response
// @Router /api/v1/siterank/queries/{id}/export [get]
func (c *EnhancedController) ExportResults(ctx *gin.Context) {
	queryID := ctx.Param("id")
	userID := ctx.MustGet("user_id").(string)
	format := ctx.DefaultQuery("format", "json")

	// 获取查询
	query, err := c.service.GetQuery(queryID)
	if err != nil {
		gf.Error().SetMsg("查询不存在").Regin(ctx)
		return
	}

	// 检查权限
	if query.UserID != userID {
		gf.Error().SetCode(http.StatusForbidden).SetMsg("无权限访问此查询").Regin(ctx)
		return
	}

	// 检查查询状态
	if query.Status != "completed" && query.Status != "completed_with_errors" {
		gf.Error().SetMsg("查询未完成，无法导出").Regin(ctx)
		return
	}

	// 导出结果
	switch format {
	case "csv":
		c.exportToCSV(ctx, queryID)
	case "excel":
		c.exportToExcel(ctx, queryID)
	case "pdf":
		c.exportToPDF(ctx, queryID)
	default:
		c.exportToJSON(ctx, queryID)
	}
}

// exportToJSON 导出为JSON
func (c *EnhancedController) exportToJSON(ctx *gin.Context, queryID string) {
	response, err := c.service.GetQueryWithResults(queryID)
	if err != nil {
		gf.Error().SetMsg("获取查询结果失败").Regin(ctx)
		return
	}

	ctx.Header("Content-Type", "application/json")
	ctx.Header("Content-Disposition", fmt.Sprintf("attachment; filename=siterank_%s.json", queryID))

	gf.Success().SetData(response).Regin(ctx)
}

// exportToCSV 导出为CSV
func (c *EnhancedController) exportToCSV(ctx *gin.Context, queryID string) {
	// TODO: 实现CSV导出逻辑
	gf.Error().SetMsg("CSV导出功能开发中").Regin(ctx)
}

// exportToExcel 导出为Excel
func (c *EnhancedController) exportToExcel(ctx *gin.Context, queryID string) {
	// TODO: 实现Excel导出逻辑
	gf.Error().SetMsg("Excel导出功能开发中").Regin(ctx)
}

// exportToPDF 导出为PDF
func (c *EnhancedController) exportToPDF(ctx *gin.Context, queryID string) {
	// TODO: 实现PDF导出逻辑
	gf.Error().SetMsg("PDF导出功能开发中").Regin(ctx)
}

// GetEnhancedStats 获取增强统计信息
// @Summary 获取增强统计信息
// @Description 包含第三方数据查询的统计
// @Tags SiteRankGo
// @Security ApiKeyAuth
// @Success 200 {object} gf.Response
// @Router /api/v1/siterank/enhanced-stats [get]
func (c *EnhancedController) GetEnhancedStats(ctx *gin.Context) {
	userID := ctx.MustGet("user_id").(string)

	// 获取基础统计
	basicStats, err := c.service.GetQueryStats(userID)
	if err != nil {
		gf.Error().SetMsg("获取基础统计失败").Regin(ctx)
		return
	}

	// 获取增强统计
	enhancedStats := make(map[string]interface{})

	// SimilarWeb查询统计
	var similarWebCount int64
	c.service.db.Model(&SimilarWebResult{}).
		Joins("JOIN siterank_queries ON siterank_queries.id = siterank_similarweb_results.query_id").
		Where("siterank_queries.user_id = ?", userID).
		Count(&similarWebCount)
	enhancedStats["similarweb_queries"] = similarWebCount

	// 本月Token消耗
	var monthlyTokenCost int64
	thisMonth := time.Now().Format("2006-01")
	c.service.db.Model(&Query{}).
		Where("user_id = ? AND DATE_FORMAT(created_at, '%Y-%m') = ?", userID, thisMonth).
		Select("COALESCE(SUM(token_cost), 0)").
		Scan(&monthlyTokenCost)
	enhancedStats["monthly_token_cost"] = monthlyTokenCost

	// 最常查询的域名
	type DomainCount struct {
		Domain string
		Count  int64
	}
	var topDomains []DomainCount
	c.service.db.Table("siterank_results").
		Select("url, COUNT(*) as count").
		Where("query_id IN (SELECT id FROM siterank_queries WHERE user_id = ?)", userID).
		Group("url").
		Order("count DESC").
		Limit(10).
		Find(&topDomains)
	enhancedStats["top_domains"] = topDomains

	gf.Success().SetData(gf.Map{
		"basic_stats":    basicStats,
		"enhanced_stats": enhancedStats,
	}).Regin(ctx)
}

// BatchSimilarWebRequest 批量SimilarWeb请求
type BatchSimilarWebRequest struct {
	Domains []string `json:"domains" binding:"required" validate:"min=1,max=50"`
}
