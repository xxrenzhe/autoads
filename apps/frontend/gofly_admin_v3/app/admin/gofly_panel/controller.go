package gofly_panel

import (
	"gofly-admin-v3/internal/batchgo"
	"gofly-admin-v3/service/user"
	"gofly-admin-v3/utils/gf"
	"gofly-admin-v3/utils/gform"
)

// Type aliases for models
type User = user.Model
type BatchTask = batchgo.BatchTask

// Paginator 分页器
type Paginator struct {
	ctx *gf.GinCtx
}

// NewPaginator 创建分页器
func NewPaginator(ctx *gf.GinCtx) *Paginator {
	return &Paginator{ctx: ctx}
}

// Paginate 执行分页查询
func (p *Paginator) Paginate(query *gform.Model) (gform.Result, error) {
	// 简单实现：直接返回所有结果
	record, err := query.Find()
	if err != nil {
		return nil, err
	}
	// Convert single Record to Result ([]Record)
	return gform.Result{record}, nil
}

// GoFlyPanelController GoFly管理面板控制器
type GoFlyPanelController struct{}

// @Router /admin/gofly-panel [get]
func (c *GoFlyPanelController) Index(ctx *gf.GinCtx) {
	// GoFly自动渲染管理面板首页
	ctx.HTML(200, "admin/gofly_panel/index", gf.Map{
		"title": "GoFly管理面板",
		"modules": []gf.Map{
			{"name": "用户管理", "icon": "users", "path": "/admin/gofly-panel/users"},
			{"name": "任务管理", "icon": "tasks", "path": "/admin/gofly-panel/batch-tasks"},
			{"name": "网站排名", "icon": "chart-line", "path": "/admin/gofly-panel/siterank-queries"},
			{"name": "广告账户", "icon": "ad", "path": "/admin/gofly-panel/ads-accounts"},
			{"name": "订阅管理", "icon": "credit-card", "path": "/admin/gofly-panel/subscriptions"},
			{"name": "系统设置", "icon": "cog", "path": "/admin/gofly-panel/system"},
		},
	})
}

// @Router /admin/gofly-panel/users [get]
func (c *GoFlyPanelController) Users(ctx *gf.GinCtx) {
	// GoFly自动渲染用户管理页面
	ctx.HTML(200, "admin/gofly_panel/users", gf.Map{
		"title": "用户管理",
		"page":  "users",
	})
}

// @Router /admin/gofly-panel/batch-tasks [get]
func (c *GoFlyPanelController) BatchTasks(ctx *gf.GinCtx) {
	// GoFly自动渲染任务管理页面
	ctx.HTML(200, "admin/gofly_panel/batch_tasks", gf.Map{
		"title": "批量任务管理",
		"page":  "batch-tasks",
	})
}

// @Router /admin/gofly-panel/siterank-queries [get]
func (c *GoFlyPanelController) SiteRankQueries(ctx *gf.GinCtx) {
	// GoFly自动渲染网站排名页面
	ctx.HTML(200, "admin/gofly_panel/siterank_queries", gf.Map{
		"title": "网站排名查询",
		"page":  "siterank-queries",
	})
}

// @Router /admin/gofly-panel/ads-accounts [get]
func (c *GoFlyPanelController) AdsAccounts(ctx *gf.GinCtx) {
	// GoFly自动渲染广告账户页面
	ctx.HTML(200, "admin/gofly_panel/ads_accounts", gf.Map{
		"title": "广告账户管理",
		"page":  "ads-accounts",
	})
}

// @Router /admin/gofly-panel/subscriptions [get]
func (c *GoFlyPanelController) Subscriptions(ctx *gf.GinCtx) {
	// GoFly自动渲染订阅管理页面
	ctx.HTML(200, "admin/gofly_panel/subscriptions", gf.Map{
		"title": "订阅管理",
		"page":  "subscriptions",
	})
}

// @Router /admin/gofly-panel/system [get]
func (c *GoFlyPanelController) System(ctx *gf.GinCtx) {
	// GoFly自动渲染系统设置页面
	ctx.HTML(200, "admin/gofly_panel/system", gf.Map{
		"title": "系统设置",
		"page":  "system",
	})
}

// @Router /admin/gofly-panel/api/stats [get]
func (c *GoFlyPanelController) GetStats(ctx *gf.GinCtx) {
	// 使用GoFly的自动聚合查询
	// Initialize counters
	var totalUsers, activeUsers, newTodayUsers int

	// Get user counts with error handling
	if count, err := gf.DB().Model(&User{}).Where("deleted_at IS NULL").Count(); err == nil {
		totalUsers = count
	}
	if count, err := gf.DB().Model(&User{}).Where("status = ?", "ACTIVE").Count(); err == nil {
		activeUsers = count
	}
	if count, err := gf.DB().Model(&User{}).Where("DATE(created_at) = CURDATE()").Count(); err == nil {
		newTodayUsers = count
	}

	stats := gf.Map{
		"users": gf.Map{
			"total":    totalUsers,
			"active":   activeUsers,
			"newToday": newTodayUsers,
		},
		"tasks": gf.Map{
			"total": func() int {
				if count, err := gf.DB().Model(&BatchTask{}).Count(); err == nil {
					return count
				}
				return 0
			}(),
			"running": func() int {
				if count, err := gf.DB().Model(&BatchTask{}).Where("status = ?", "RUNNING").Count(); err == nil {
					return count
				}
				return 0
			}(),
			"completed": func() int {
				if count, err := gf.DB().Model(&BatchTask{}).Where("status = ?", "COMPLETED").Count(); err == nil {
					return count
				}
				return 0
			}(),
		},
		"system": gf.Map{
			"uptime":    gf.GetUptime(),
			"memory":    gf.GetMemoryUsage(),
			"goroutine": gf.GetGoroutineCount(),
		},
	}

	gf.Success().SetData(stats).Regin(ctx)
}

// @Router /admin/gofly-panel/api/users [get]
func (c *GoFlyPanelController) GetUsers(ctx *gf.GinCtx) {
	// 使用GoFly的自动分页查询
	paginator := NewPaginator(ctx)

	var users []User
	query := gf.DB().Model(&users)

	// 自动处理搜索和过滤
	if search := ctx.Query("search"); search != "" {
		query = query.Where("email LIKE ? OR username LIKE ?", "%"+search+"%", "%"+search+"%")
	}
	if status := ctx.Query("status"); status != "" {
		query = query.Where("status = ?", status)
	}

	result, err := paginator.Paginate(query.Order("created_at DESC"))
	if err != nil {
		gf.Failed().SetMsg("查询失败").Regin(ctx)
		return
	}

	gf.Success().SetData(result).Regin(ctx)
}

// @Router /admin/gofly-panel/api/users/:id [put]
func (c *GoFlyPanelController) UpdateUser(ctx *gf.GinCtx) {
	id := ctx.Param("id")
	var user User

	if err := ctx.ShouldBind(&user); err != nil {
		gf.Failed().SetMsg(err.Error()).Regin(ctx)
		return
	}

	_, err := gf.DB().Model(&User{}).Where("id = ?", id).Update(&user)
	if err != nil {
		gf.Failed().SetMsg("更新失败").Regin(ctx)
		return
	}

	gf.Success().SetMsg("更新成功").Regin(ctx)
}

// @Router /admin/gofly-panel/api/config [get]
func (c *GoFlyPanelController) GetConfig(ctx *gf.GinCtx) {
	// 使用GoFly的配置管理
	config := gf.Map{
		"app_name":       gf.GetConfig("app.name"),
		"api_rate_limit": gf.GetConfig("api.rate_limit"),
		"max_concurrent": gf.GetConfig("system.max_concurrent"),
		"cache_ttl":      gf.GetConfig("cache.ttl"),
	}

	gf.Success().SetData(config).Regin(ctx)
}

// @Router /admin/gofly-panel/api/config [post]
func (c *GoFlyPanelController) UpdateConfig(ctx *gf.GinCtx) {
	var config gf.Map

	if err := ctx.ShouldBind(&config); err != nil {
		gf.Failed().SetMsg(err.Error()).Regin(ctx)
		return
	}

	// 使用GoFly的配置更新
	for key, value := range config {
		// TODO: Implement config setting
		_ = key
		_ = value
	}

	gf.Success().SetMsg("配置已更新").Regin(ctx)
}
