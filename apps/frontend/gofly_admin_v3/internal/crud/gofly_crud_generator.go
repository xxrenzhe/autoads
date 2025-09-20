package crud

import (
	"context"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"gofly-admin-v3/internal/batchgo"
	"gofly-admin-v3/internal/siterank"
	"gofly-admin-v3/internal/user"
	"gofly-admin-v3/utils/gf"
	"gofly-admin-v3/utils/gform"
	"gofly-admin-v3/utils/tools/glog"
)

// GoFlyCRUDGenerator GoFly CRUD生成器
type GoFlyCRUDGenerator struct {
	db gform.DB
}

// Pagination 分页结构
type Pagination struct {
	Page     int
	PageSize int
}

// NewPagination 创建分页器
func NewPagination(page, pageSize string) *Pagination {
	p, _ := strconv.Atoi(page)
	ps, _ := strconv.Atoi(pageSize)
	if p <= 0 {
		p = 1
	}
	if ps <= 0 {
		ps = 20
	}
	return &Pagination{Page: p, PageSize: ps}
}

// Paginate 执行分页查询
func (p *Pagination) Paginate(query *gform.Model, model interface{}) (gform.Result, error) {
	// 简单实现：返回所有结果
	result, err := query.All()
	if err != nil {
		return nil, err
	}
	return result, nil
}

// NewGoFlyCRUDGenerator 创建CRUD生成器
func NewGoFlyCRUDGenerator(db gform.DB) *GoFlyCRUDGenerator {
	return &GoFlyCRUDGenerator{db: db}
}

// GenerateCRUDRoute 生成CRUD路由
func (g *GoFlyCRUDGenerator) GenerateCRUDRoute(router gin.IRouter, path string, model interface{}, store interface{}) {
	// 列表查询
	router.GET(path, g.GenerateListHandler(model))

	// 获取单个
	router.GET(path+"/:id", g.GenerateGetHandler(model))

	// 创建
	router.POST(path, g.GenerateCreateHandler(model))

	// 更新
	router.PUT(path+"/:id", g.GenerateUpdateHandler(model))

	// 删除
	router.DELETE(path+"/:id", g.GenerateDeleteHandler(model))
}

// GenerateListHandler 生成列表处理器
func (g *GoFlyCRUDGenerator) GenerateListHandler(model interface{}) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		// 使用GoFly的自动查询功能
		query := g.db.Model(model)

		// 分页
		page := ctx.DefaultQuery("page", "1")
		pageSize := ctx.DefaultQuery("page_size", "20")

		pagination := NewPagination(page, pageSize)
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
			"data":    result,
			"pagination": gform.Map{
				"page":        pagination.Page,
				"page_size":   pagination.PageSize,
				"total":       0,
				"total_pages": 0,
			},
		})
	}
}

// GenerateGetHandler 生成获取单个处理器
func (g *GoFlyCRUDGenerator) GenerateGetHandler(model interface{}) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		id := ctx.Param("id")

		// 使用Model来查询
		record, err := g.db.Model(model).Where("id = ?", id).One()
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
			"data":    record,
		})
	}
}

// GenerateCreateHandler 生成创建处理器
func (g *GoFlyCRUDGenerator) GenerateCreateHandler(model interface{}) gin.HandlerFunc {
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
		if idField, ok := model.(interface {
			GetID() string
			SetID(string)
		}); ok {
			idField.SetID(gf.UUID())
		}

		// 使用GoFly的自动创建
		_, err := g.db.Model(model).Data(model).Insert()
		if err != nil {
			glog.Error(ctx, "crud_create_failed", gform.Map{"error": err.Error()})
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
func (g *GoFlyCRUDGenerator) GenerateUpdateHandler(model interface{}) gin.HandlerFunc {
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
		_, err := g.db.Model(model).Where("id = ?", id).Update(model)
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
func (g *GoFlyCRUDGenerator) GenerateDeleteHandler(model interface{}) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		id := ctx.Param("id")

		// 使用GoFly的软删除
		_, err := g.db.Model(model).Where("id = ?", id).Update(gform.Map{"deleted_at": time.Now()})
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

// AuthMiddleware 认证中间件（简化版）
func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// 简化版认证中间件，实际使用时需要实现JWT验证
		token := c.GetHeader("Authorization")
		if token == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "未授权"})
			c.Abort()
			return
		}
		c.Next()
	}
}

// AutoRegisterCRUD 自动注册CRUD路由
func AutoRegisterCRUD(router *gin.Engine, db gform.DB) {
	generator := NewGoFlyCRUDGenerator(db)

	// 用户模块CRUD
	userGroup := router.Group("/api/v1/users")
	userGroup.Use(AuthMiddleware())
	generator.GenerateCRUDRoute(userGroup, "", &user.User{}, nil)

	// BatchGo模块CRUD
	batchGroup := router.Group("/api/v1/batchgo")
	batchGroup.Use(AuthMiddleware())
	generator.GenerateCRUDRoute(batchGroup, "/tasks", &batchgo.BatchTask{}, nil)

	// SiteRankGo模块CRUD
	siterankGroup := router.Group("/api/v1/siterankgo")
	siterankGroup.Use(AuthMiddleware())
	generator.GenerateCRUDRoute(siterankGroup, "/queries", &siterank.SiteRankQuery{}, nil)

	// AdsCenterGo模块CRUD
	adsGroup := router.Group("/api/v1/adscentergo")
	adsGroup.Use(AuthMiddleware())
	generator.GenerateCRUDRoute(adsGroup, "/accounts", &AdsAccount{}, nil)

	glog.Info(context.Background(), "gofly_crud_routes_registered", gform.Map{
		"modules": []string{"users", "batchgo", "siterankgo", "adscentergo"},
	})
}
