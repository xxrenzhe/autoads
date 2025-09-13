package business

import (
	"gofly-admin-v3/internal/batchgo"
	"gofly-admin-v3/internal/crud"
	"gofly-admin-v3/internal/siterank"
	"gofly-admin-v3/internal/store"
	"gofly-admin-v3/internal/subscription"
	internaluser "gofly-admin-v3/internal/user"
	"gofly-admin-v3/utils/gf"
)

// Type alias for models
type User = internaluser.Model
type BatchTask = batchgo.BatchTask
type SiteRankQuery = siterank.SiteRankQuery
type AdsAccount = crud.AdsAccount
type TokenTransaction = user.TokenTransaction
type Subscription = subscription.Subscription

// GoFlyCRUDController 使用GoFly自动生成的CRUD控制器
type GoFlyCRUDController struct{}

// @Router /business/gofly-crud/user [get]
func (c *GoFlyCRUDController) GetList(ctx *gf.GinCtx) {
	// 使用GoFly的自动查询
	var users []User

	// GoFly会自动处理参数绑定、查询和分页
	paginator := gf.NewPaginator(ctx)

	// 自动构建查询条件
	query := gf.DB().Model(&users)

	// 自动处理搜索条件
	if email := ctx.Query("email"); email != "" {
		query = query.Where("email LIKE ?", "%"+email+"%")
	}
	if status := ctx.Query("status"); status != "" {
		query = query.Where("status = ?", status)
	}

	// 自动执行分页查询
	result, err := paginator.Paginate(query)
	if err != nil {
		gf.Failed().SetMsg("查询失败").Regin(ctx)
		return
	}

	gf.Success().SetData(result).JSON(ctx)
}

// @Router /business/gofly-crud/user/:id [get]
func (c *GoFlyCRUDController) GetDetail(ctx *gf.GinCtx) {
	id := ctx.Param("id")

	var user User
	_, err := gf.DB().Model(&User{}).Where("id = ?", id).Find(&user)
	if err != nil {
		gf.Failed().SetMsg("用户不存在").Regin(ctx)
		return
	}

	gf.Success().SetData(user).Regin(ctx)
}

// @Router /business/gofly-crud/user [post]
func (c *GoFlyCRUDController) Create(ctx *gf.GinCtx) {
	var user User

	// GoFly自动绑定和验证
	if err := ctx.ShouldBind(&user); err != nil {
		gf.Failed().SetMsg(err.Error()).Regin(ctx)
		return
	}

	// 自动生成ID
	user.ID = gf.UUID()

	// 自动创建
	_, err := gf.DB().Model(&User{}).Insert(&user)
	if err != nil {
		gf.Failed().SetMsg("创建失败").Regin(ctx)
		return
	}

	gf.Success().SetData(user).Regin(ctx)
}

// @Router /business/gofly-crud/user/:id [put]
func (c *GoFlyCRUDController) Update(ctx *gf.GinCtx) {
	id := ctx.Param("id")
	var user User

	// GoFly自动绑定
	if err := ctx.ShouldBind(&user); err != nil {
		gf.Error(err.Error()).JSON(ctx)
		return
	}

	// 自动更新
	_, err := gf.DB().Model(&User{}).Where("id = ?", id).Update(&user)
	if err != nil {
		gf.Error("更新失败").JSON(ctx)
		return
	}

	gf.Success().SetMsg("更新成功").JSON(ctx)
}

// @Router /business/gofly-crud/user/:id [delete]
func (c *GoFlyCRUDController) Delete(ctx *gf.GinCtx) {
	id := ctx.Param("id")

	// 软删除
	_, err := gf.DB().Model(&User{}).Where("id = ?", id).Update(gf.Map{"deleted_at": gf.Now()})
	if err != nil {
		gf.Error("删除失败").JSON(ctx)
		return
	}

	gf.Success().SetMsg("删除成功").JSON(ctx)
}

// BatchGo CRUD operations
// @Router /business/gofly-crud/batch-task [get]
func (c *GoFlyCRUDController) GetBatchTaskList(ctx *gf.GinCtx) {
	var tasks []BatchTask

	paginator := gf.NewPaginator(ctx)
	query := gf.DB().Model(&tasks)

	// 自动过滤
	if status := ctx.Query("status"); status != "" {
		query = query.Where("status = ?", status)
	}
	if mode := ctx.Query("mode"); mode != "" {
		query = query.Where("mode = ?", mode)
	}

	result, err := paginator.Paginate(query)
	if err != nil {
		gf.Error("查询失败").JSON(ctx)
		return
	}

	gf.Success().SetData(result).JSON(ctx)
}

// @Router /business/gofly-crud/batch-task [post]
func (c *GoFlyCRUDController) CreateBatchTask(ctx *gf.GinCtx) {
	var task BatchTask

	if err := ctx.ShouldBind(&task); err != nil {
		gf.Error(err.Error()).JSON(ctx)
		return
	}

	task.ID = gf.UUID()

	_, err := gf.DB().Model(&BatchTask{}).Insert(&task)
	if err != nil {
		gf.Error("创建失败").JSON(ctx)
		return
	}

	gf.Success().SetData(task).JSON(ctx)
}

// SiteRankGo CRUD operations
// @Router /business/gofly-crud/siterank-query [get]
func (c *GoFlyCRUDController) GetSiteRankQueryList(ctx *gf.GinCtx) {
	var queries []SiteRankQuery

	paginator := gf.NewPaginator(ctx)
	query := gf.DB().Model(&queries)

	result, err := paginator.Paginate(query)
	if err != nil {
		gf.Error("查询失败").JSON(ctx)
		return
	}

	gf.Success().SetData(result).JSON(ctx)
}

// AdsCenterGo CRUD operations
// @Router /business/gofly-crud/ads-account [get]
func (c *GoFlyCRUDController) GetAdsAccountList(ctx *gf.GinCtx) {
	var accounts []AdsAccount

	paginator := gf.NewPaginator(ctx)
	query := gf.DB().Model(&accounts)

	result, err := paginator.Paginate(query)
	if err != nil {
		gf.Error("查询失败").JSON(ctx)
		return
	}

	gf.Success().SetData(result).JSON(ctx)
}

// RegisterAutoCRUD 注册自动CRUD路由
func RegisterAutoCRUD() {
	// 注册用户模块自动CRUD
	gf.RegisterAutoCRUD(&User{}, "/business/gofly-crud/user")

	// 注册BatchGo模块自动CRUD
	gf.RegisterAutoCRUD(&BatchTask{}, "/business/gofly-crud/batch-task")

	// 注册SiteRankGo模块自动CRUD
	gf.RegisterAutoCRUD(&SiteRankQuery{}, "/business/gofly-crud/siterank-query")

	// 注册AdsCenterGo模块自动CRUD
	gf.RegisterAutoCRUD(&AdsAccount{}, "/business/gofly-crud/ads-account")

	// 注册Token交易自动CRUD
	gf.RegisterAutoCRUD(&TokenTransaction{}, "/business/gofly-crud/token-transaction")

	// 注册订阅自动CRUD
	gf.RegisterAutoCRUD(&Subscription{}, "/business/gofly-crud/subscription")
}
