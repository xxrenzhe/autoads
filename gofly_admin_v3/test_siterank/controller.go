package siterank

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// Controller SiteRank控制器
type Controller struct {
	service *Service
	db      *gorm.DB
}

// NewController 创建SiteRank控制器
func NewController(service *Service, db *gorm.DB) *Controller {
	return &Controller{
		service: service,
		db:      db,
	}
}

// QueryDomain 查询域名排名
// @Summary 查询域名排名
// @Description 查询指定域名的排名和流量数据
// @Tags SiteRank
// @Security ApiKeyAuth
// @Accept json
// @Produce json
// @Param request body QueryRequest true "查询请求"
// @Success 200 {object} gin.H
// @Router /api/v1/siterank/query [post]
func (c *Controller) QueryDomain(ctx *gin.Context) {
	userID, exists := ctx.Get("user_id")
	if !exists {
		ctx.JSON(http.StatusUnauthorized, gin.H{
			"error":   "unauthorized",
			"message": "用户未认证",
		})
		return
	}

	var req QueryRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error":   "invalid_request",
			"message": err.Error(),
		})
		return
	}

	query, err := c.service.QueryDomain(userID.(string), &req)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error":   "query_failed",
			"message": err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"message": "查询请求已提交",
		"query":   query.ToResponse(),
	})
}

// BatchQuery 批量查询域名
// @Summary 批量查询域名排名
// @Description 批量查询多个域名的排名和流量数据
// @Tags SiteRank
// @Security ApiKeyAuth
// @Accept json
// @Produce json
// @Param request body BatchQueryRequest true "批量查询请求"
// @Success 200 {object} gin.H
// @Router /api/v1/siterank/batch-query [post]
func (c *Controller) BatchQuery(ctx *gin.Context) {
	userID, exists := ctx.Get("user_id")
	if !exists {
		ctx.JSON(http.StatusUnauthorized, gin.H{
			"error":   "unauthorized",
			"message": "用户未认证",
		})
		return
	}

	var req BatchQueryRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error":   "invalid_request",
			"message": err.Error(),
		})
		return
	}

	batchQuery, err := c.service.BatchQueryDomains(userID.(string), &req)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error":   "batch_query_failed",
			"message": err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"message":     "批量查询已启动",
		"batch_query": batchQuery,
	})
}

// GetQuery 获取查询结果
// @Summary 获取查询结果
// @Description 获取指定查询的详细结果
// @Tags SiteRank
// @Security ApiKeyAuth
// @Param query_id path string true "查询ID"
// @Success 200 {object} gin.H
// @Router /api/v1/siterank/queries/{query_id} [get]
func (c *Controller) GetQuery(ctx *gin.Context) {
	userID, exists := ctx.Get("user_id")
	if !exists {
		ctx.JSON(http.StatusUnauthorized, gin.H{
			"error":   "unauthorized",
			"message": "用户未认证",
		})
		return
	}

	queryID := ctx.Param("query_id")
	if queryID == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error":   "missing_query_id",
			"message": "查询ID不能为空",
		})
		return
	}

	query, err := c.service.GetQuery(userID.(string), queryID)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{
			"error":   "query_not_found",
			"message": "查询不存在",
		})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"query": query.ToResponse(),
	})
}

// GetQueries 获取查询列表
// @Summary 获取查询列表
// @Description 分页获取用户的域名查询列表
// @Tags SiteRank
// @Security ApiKeyAuth
// @Param page query int false "页码" default(1)
// @Param size query int false "每页数量" default(20)
// @Param status query string false "状态过滤"
// @Param priority query string false "优先级过滤"
// @Success 200 {object} gin.H
// @Router /api/v1/siterank/queries [get]
func (c *Controller) GetQueries(ctx *gin.Context) {
	userID, exists := ctx.Get("user_id")
	if !exists {
		ctx.JSON(http.StatusUnauthorized, gin.H{
			"error":   "unauthorized",
			"message": "用户未认证",
		})
		return
	}

	// 获取分页参数
	page, _ := strconv.Atoi(ctx.DefaultQuery("page", "1"))
	size, _ := strconv.Atoi(ctx.DefaultQuery("size", "20"))

	if page < 1 {
		page = 1
	}
	if size < 1 || size > 100 {
		size = 20
	}

	queries, total, err := c.service.GetQueries(userID.(string), page, size)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"error":   "query_failed",
			"message": "查询列表失败",
		})
		return
	}

	// 转换为响应格式
	queryResponses := make([]*SiteRankResponse, 0, len(queries))
	for _, query := range queries {
		queryResponses = append(queryResponses, query.ToResponse())
	}

	ctx.JSON(http.StatusOK, gin.H{
		"queries": queryResponses,
		"total":   total,
		"page":    page,
		"size":    size,
	})
}

// GetStats 获取查询统计
// @Summary 获取查询统计
// @Description 获取用户的域名查询统计信息
// @Tags SiteRank
// @Security ApiKeyAuth
// @Success 200 {object} gin.H
// @Router /api/v1/siterank/stats [get]
func (c *Controller) GetStats(ctx *gin.Context) {
	userID, exists := ctx.Get("user_id")
	if !exists {
		ctx.JSON(http.StatusUnauthorized, gin.H{
			"error":   "unauthorized",
			"message": "用户未认证",
		})
		return
	}

	stats, err := c.service.GetQueryStats(userID.(string))
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"error":   "query_failed",
			"message": "查询统计失败",
		})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"stats": stats,
	})
}

// GetTopDomains 获取热门域名
// @Summary 获取热门域名
// @Description 获取全球排名靠前的热门域名
// @Tags SiteRank
// @Param limit query int false "数量限制" default(50)
// @Success 200 {object} gin.H
// @Router /api/v1/siterank/top-domains [get]
func (c *Controller) GetTopDomains(ctx *gin.Context) {
	limit, _ := strconv.Atoi(ctx.DefaultQuery("limit", "50"))
	if limit < 1 || limit > 100 {
		limit = 50
	}

	domains, err := c.service.GetTopDomains(limit)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"error":   "query_failed",
			"message": "查询热门域名失败",
		})
		return
	}

	// 转换为响应格式
	domainResponses := make([]*SiteRankResponse, 0, len(domains))
	for _, domain := range domains {
		domainResponses = append(domainResponses, domain.ToResponse())
	}

	ctx.JSON(http.StatusOK, gin.H{
		"domains": domainResponses,
		"total":   len(domainResponses),
	})
}

// ===== 兼容旧版API接口 =====

// LegacyQuery 兼容旧版查询接口
// @Summary 域名查询 (兼容接口)
// @Description 兼容旧版本的域名查询接口
// @Tags SiteRank兼容
// @Security ApiKeyAuth
// @Accept json
// @Produce json
// @Param request body LegacyQueryRequest true "查询请求"
// @Success 200 {object} gin.H
// @Router /api/siterank/query [post]
func (c *Controller) LegacyQuery(ctx *gin.Context) {
	userID, exists := ctx.Get("user_id")
	if !exists {
		ctx.JSON(http.StatusUnauthorized, gin.H{
			"error":   "unauthorized",
			"message": "用户未认证",
		})
		return
	}

	var req LegacyQueryRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error":   "invalid_request",
			"message": err.Error(),
		})
		return
	}

	// 转换为新格式
	newReq := &QueryRequest{
		Domain:  req.Domain,
		Country: req.Country,
		Force:   req.Force,
	}

	query, err := c.service.QueryDomain(userID.(string), newReq)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	// 返回兼容格式
	ctx.JSON(http.StatusOK, gin.H{
		"success":  true,
		"query_id": query.ID,
		"domain":   query.Domain,
		"status":   query.Status,
		"message":  "查询请求已提交",
	})
}

// LegacyBatchQuery 兼容旧版批量查询接口
// @Summary 批量域名查询 (兼容接口)
// @Description 兼容旧版本的批量域名查询接口
// @Tags SiteRank兼容
// @Security ApiKeyAuth
// @Accept json
// @Produce json
// @Param request body LegacyBatchQueryRequest true "批量查询请求"
// @Success 200 {object} gin.H
// @Router /api/siterank/batch-query [post]
func (c *Controller) LegacyBatchQuery(ctx *gin.Context) {
	userID, exists := ctx.Get("user_id")
	if !exists {
		ctx.JSON(http.StatusUnauthorized, gin.H{
			"error":   "unauthorized",
			"message": "用户未认证",
		})
		return
	}

	var req LegacyBatchQueryRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error":   "invalid_request",
			"message": err.Error(),
		})
		return
	}

	// 转换为新格式
	newReq := &BatchQueryRequest{
		Domains:   req.Domains,
		Country:   req.Country,
		BatchSize: req.BatchSize,
		Force:     req.Force,
	}

	batchQuery, err := c.service.BatchQueryDomains(userID.(string), newReq)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	// 返回兼容格式
	ctx.JSON(http.StatusOK, gin.H{
		"success":      true,
		"batch_id":     batchQuery.ID,
		"total_domains": len(req.Domains),
		"batch_size":   batchQuery.BatchSize,
		"message":      "批量查询已启动",
	})
}

// LegacyGetResult 兼容旧版获取结果接口
// @Summary 获取查询结果 (兼容接口)
// @Description 兼容旧版本的查询结果接口
// @Tags SiteRank兼容
// @Security ApiKeyAuth
// @Param query_id path string true "查询ID"
// @Success 200 {object} gin.H
// @Router /api/siterank/result/{query_id} [get]
func (c *Controller) LegacyGetResult(ctx *gin.Context) {
	userID, exists := ctx.Get("user_id")
	if !exists {
		ctx.JSON(http.StatusUnauthorized, gin.H{
			"error":   "unauthorized",
			"message": "用户未认证",
		})
		return
	}

	queryID := ctx.Param("query_id")
	query, err := c.service.GetQuery(userID.(string), queryID)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":   "查询不存在",
		})
		return
	}

	// 返回兼容格式
	result := gin.H{
		"success":       true,
		"query_id":      query.ID,
		"domain":        query.Domain,
		"status":        query.Status,
		"global_rank":   query.GlobalRank,
		"category_rank": query.CategoryRank,
		"category":      query.Category,
		"priority":      query.Priority,
		"created_at":    query.CreatedAt,
		"updated_at":    query.UpdatedAt,
	}

	if query.ErrorMessage != "" {
		result["error"] = query.ErrorMessage
	}

	ctx.JSON(http.StatusOK, result)
}

// ===== 兼容请求结构 =====

// LegacyQueryRequest 兼容的查询请求
type LegacyQueryRequest struct {
	Domain  string `json:"domain" binding:"required"`
	Country string `json:"country"`
	Force   bool   `json:"force"`
}

// LegacyBatchQueryRequest 兼容的批量查询请求
type LegacyBatchQueryRequest struct {
	Domains   []string `json:"domains" binding:"required"`
	Country   string   `json:"country"`
	BatchSize int      `json:"batch_size"`
	Force     bool     `json:"force"`
}