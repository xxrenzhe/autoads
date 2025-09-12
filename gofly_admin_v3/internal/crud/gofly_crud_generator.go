package crud

import (
	"gofly-admin-v3/internal/store"
	"gofly-admin-v3/utils/gform"
	"gofly-admin-v3/utils/tools/glog"
)

// GoFlyCRUDGenerator GoFly CRUD生成器
type GoFlyCRUDGenerator struct {
	db *store.DB
}

// NewGoFlyCRUDGenerator 创建CRUD生成器
func NewGoFlyCRUDGenerator(db *store.DB) *GoFlyCRUDGenerator {
	return &GoFlyCRUDGenerator{db: db}
}

// GenerateCRUDRoute 生成CRUD路由
func (g *GoFlyCRUDGenerator) GenerateCRUDRoute(router gin.IRouter, path string, model interface{}, store interface{}) {
	// 列表查询
	router.GET(path, g.GenerateListHandler(model, store))

	// 获取单个
	router.GET(path+"/:id", g.GenerateGetHandler(model, store))

	// 创建
	router.POST(path, g.GenerateCreateHandler(model, store))

	// 更新
	router.PUT(path+"/:id", g.GenerateUpdateHandler(model, store))

	// 删除
	router.DELETE(path+"/:id", g.GenerateDeleteHandler(model, store))
}

// GenerateListHandler 生成列表处理器
func (g *GoFlyCRUDGenerator) GenerateListHandler(model interface{}, store interface{}) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		// 使用GoFly的自动查询功能
		query := g.db.DB.Model(model)

		// 分页
		page := ctx.DefaultQuery("page", "1")
		pageSize := ctx.DefaultQuery("page_size", "20")

		pagination := gform.NewPagination(page, pageSize)
		result, err := pagination.Paginate(query, model)
		if err != nil {
			glog.Error(ctx, "crud_list_failed", gform.Map{"error": err})
			ctx.JSON(200, gform.Map{
				"code":    1000,
				"message": "查询失败",
			})
			return
		}

		ctx.JSON(200, gform.Map{
			"code":    0,
			"message": "成功",
			"data":    result.Data,
			"pagination": gform.Map{
				"page":        result.Page,
				"page_size":   result.PageSize,
				"total":       result.Total,
				"total_pages": result.TotalPages,
			},
		})
	}
}

// GenerateGetHandler 生成获取单个处理器
func (g *GoFlyCRUDGenerator) GenerateGetHandler(model interface{}, store interface{}) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		id := ctx.Param("id")

		err := g.db.DB.First(model, "id = ?", id).Error
		if err != nil {
			glog.Error(ctx, "crud_get_failed", gform.Map{"id": id, "error": err})
			ctx.JSON(200, gform.Map{
				"code":    1003,
				"message": "记录不存在",
			})
			return
		}

		ctx.JSON(200, gform.Map{
			"code":    0,
			"message": "成功",
			"data":    model,
		})
	}
}

// GenerateCreateHandler 生成创建处理器
func (g *GoFlyCRUDGenerator) GenerateCreateHandler(model interface{}, store interface{}) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		// 使用GoFly的自动绑定
		if err := ctx.ShouldBind(model); err != nil {
			ctx.JSON(200, gform.Map{
				"code":    1000,
				"message": err.Error(),
			})
			return
		}

		// 自动生成ID（如果是字符串类型）
		if idField, ok := model.(interface{ GetID() string }); ok {
			idField.SetID(gform.UUID())
		}

		// 使用GoFly的自动创建
		err := g.db.DB.Create(model).Error
		if err != nil {
			glog.Error(ctx, "crud_create_failed", gform.Map{"error": err})
			ctx.JSON(200, gform.Map{
				"code":    2000,
				"message": "创建失败",
			})
			return
		}

		ctx.JSON(200, gform.Map{
			"code":    0,
			"message": "创建成功",
			"data":    model,
		})
	}
}

// GenerateUpdateHandler 生成更新处理器
func (g *GoFlyCRUDGenerator) GenerateUpdateHandler(model interface{}, store interface{}) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		id := ctx.Param("id")

		// 使用GoFly的自动绑定
		if err := ctx.ShouldBind(model); err != nil {
			ctx.JSON(200, gform.Map{
				"code":    1000,
				"message": err.Error(),
			})
			return
		}

		// 使用GoFly的自动更新
		err := g.db.DB.Model(model).Where("id = ?", id).Updates(model).Error
		if err != nil {
			glog.Error(ctx, "crud_update_failed", gform.Map{"id": id, "error": err})
			ctx.JSON(200, gform.Map{
				"code":    2000,
				"message": "更新失败",
			})
			return
		}

		ctx.JSON(200, gform.Map{
			"code":    0,
			"message": "更新成功",
		})
	}
}

// GenerateDeleteHandler 生成删除处理器
func (g *GoFlyCRUDGenerator) GenerateDeleteHandler(model interface{}, store interface{}) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		id := ctx.Param("id")

		// 使用GoFly的软删除
		err := g.db.DB.Model(model).Where("id = ?", id).Update("deleted_at", gform.Now()).Error
		if err != nil {
			glog.Error(ctx, "crud_delete_failed", gform.Map{"id": id, "error": err})
			ctx.JSON(200, gform.Map{
				"code":    2000,
				"message": "删除失败",
			})
			return
		}

		ctx.JSON(200, gform.Map{
			"code":    0,
			"message": "删除成功",
		})
	}
}

// AutoRegisterCRUD 自动注册CRUD路由
func AutoRegisterCRUD(router *gin.Engine, db *store.DB) {
	generator := NewGoFlyCRUDGenerator(db)

	// 用户模块CRUD
	userGroup := router.Group("/api/v1/users")
	userGroup.Use(middleware.AuthMiddleware())
	generator.GenerateCRUDRoute(userGroup, "", &User{}, store.NewUserStore(db))

	// BatchGo模块CRUD
	batchGroup := router.Group("/api/v1/batchgo")
	batchGroup.Use(middleware.AuthMiddleware())
	generator.GenerateCRUDRoute(batchGroup, "/tasks", &BatchTask{}, store.NewBatchTaskStore(db))

	// SiteRankGo模块CRUD
	siterankGroup := router.Group("/api/v1/siterankgo")
	siterankGroup.Use(middleware.AuthMiddleware())
	generator.GenerateCRUDRoute(siterankGroup, "/queries", &SiteRankQuery{}, store.NewSiteRankQueryStore(db))

	// AdsCenterGo模块CRUD
	adsGroup := router.Group("/api/v1/adscentergo")
	adsGroup.Use(middleware.AuthMiddleware())
	generator.GenerateCRUDRoute(adsGroup, "/accounts", &AdsAccount{}, store.NewAdsAccountStore(db))

	glog.Info(context.Background(), "gofly_crud_routes_registered", gform.Map{
		"modules": []string{"users", "batchgo", "siterankgo", "adscentergo"},
	})
}
