//go:build autoads_init_advanced

package init

import (
	"fmt"
	"time"

	"gofly-admin-v3/utils/gf"
	"gofly-admin-v3/utils/tools/glog"
	// "gofly-admin-v3/internal/admin"  // 暂时禁用
	"gofly-admin-v3/internal/auth"
	"gofly-admin-v3/internal/batchgo"
	"gofly-admin-v3/internal/chengelink"
	"gofly-admin-v3/internal/audit"
	"gofly-admin-v3/internal/siterank"
	"gofly-admin-v3/internal/store"
	// "gofly-admin-v3/internal/user"  // 暂时禁用，有编译错误
	"gofly-admin-v3/internal/checkin"
	"gofly-admin-v3/internal/dashboard"
	"gofly-admin-v3/internal/invitation"
	"gofly-admin-v3/internal/websocket"
)

// InitGoFlyFeatures 初始化GoFly高级功能
func InitGoFlyFeatures() {
	// 1. 初始化数据库连接
	db := store.NewDB()

	// 2. 注册业务模块路由
	registerBusinessRoutes(db.DB)

	// 3. 注册自动CRUD功能
	registerAutoCRUD()

	// 4. 注册管理面板
	registerAdminPanel()

	// 5. 初始化插件系统 (暂时禁用)
	// plugins.InitPlugins()

	// 6. 启用GoFly的自动化功能
	enableGoFlyAutomation()

	glog.Info(nil, "gofly_features_initialized", gf.Map{
		"features": []string{"business_routes", "auto_crud", "admin_panel", "plugins", "automation"},
	})
}

// registerBusinessRoutes 注册业务模块路由
func registerBusinessRoutes(db interface{}) {
	// 类型断言获取 *gorm.DB
	gormDB, ok := db.(*gorm.DB)
	if !ok {
		glog.Error(nil, "database_type_assertion_failed", gf.Map{
			"expected": "*gorm.DB",
			"actual":   fmt.Sprintf("%T", db),
		})
		return
	}

	// 注册认证路由
	auth.RegisterRoutes(gormDB)

	// 注册用户和Token路由（暂时禁用，有编译错误）
	// user.RegisterRoutes(gormDB)

	// 注册SiteRank路由
	siterank.RegisterRoutes(gormDB)

	// 注册BatchGo路由
	batchgo.RegisterRoutes(gormDB)

	// 注册Chengelink路由
	chengelink.RegisterRoutes(gormDB)

	// 注册审计统计路由
	audit.RegisterRoutes(gormDB)

	// 注册Dashboard路由
	dashboard.RegisterRoutes(gormDB)

	// 注册WebSocket路由
	websocket.RegisterRoutes(gormDB)

	// 注册邀请路由
	invitation.RegisterRoutes(gormDB)

	// 注册签到路由
	checkin.RegisterRoutes(gormDB)

	glog.Info(nil, "business_routes_registered", gf.Map{
		"modules": []string{"auth", "siterank", "batchgo", "chengelink", "dashboard", "websocket", "invitation", "checkin", "audit"},
	})
}

// registerAutoCRUD 注册自动CRUD路由
func registerAutoCRUD() {
	// 初始化数据库存储
	db := store.NewDB()

	// 注册用户模块CRUD
	gf.RegisterAutoCRUD(&User{}, "/api/v1/users", &UserStore{DB: db.DB})

	// 注册BatchGo模块CRUD
	gf.RegisterAutoCRUD(&BatchTask{}, "/api/v1/batchgo/tasks", &BatchTaskStore{DB: db.DB})

	// 注册SiteRankGo模块CRUD
	gf.RegisterAutoCRUD(&SiteRankQuery{}, "/api/v1/siterankgo/queries", &SiteRankQueryStore{DB: db.DB})

	// 注册AdsCenterGo模块CRUD
	gf.RegisterAutoCRUD(&AdsAccount{}, "/api/v1/adscentergo/accounts", &AdsAccountStore{DB: db.DB})

	// 注册Token交易CRUD
	gf.RegisterAutoCRUD(&TokenTransaction{}, "/api/v1/token/transactions", &TokenTransactionStore{DB: db.DB})

	// 注册订阅CRUD
	gf.RegisterAutoCRUD(&Subscription{}, "/api/v1/subscriptions", &SubscriptionStore{DB: db.DB})

	gf.Log().Info("GoFly Auto CRUD routes registered successfully")
}

// Model structs (references)
type User struct {
	ID           string     `json:"id" gform:"primary;auto_id"`
	Email        string     `json:"email" gform:"unique;required;index"`
	Username     string     `json:"username" gform:"max_length:50"`
	PasswordHash string     `json:"-" gform:"required"`
	AvatarURL    string     `json:"avatar_url" gform:"max_length:255"`
	Role         string     `json:"role" gform:"default:'USER';max_length:20"`
	Status       string     `json:"status" gform:"default:'ACTIVE';max_length:20"`
	TokenBalance int64      `json:"token_balance" gform:"default:0"`
	PlanID       string     `json:"plan_id" gform:"max_length:50"`
	TrialEndAt   *time.Time `json:"trial_end_at"`
	DeletedAt    *time.Time `json:"deleted_at" gform:"soft_delete"`
}

type BatchTask struct {
	ID          string     `json:"id" gform:"primary;auto_id"`
	UserID      string     `json:"user_id" gform:"required;index"`
	Type        string     `json:"type" gform:"required;max_length:50"`
	Status      string     `json:"status" gform:"default:'PENDING';max_length:20"`
	URLs        string     `json:"urls" gform:"type:text"`
	CompletedAt *time.Time `json:"completed_at"`
	CreatedAt   time.Time  `json:"created_at" gform:"auto_time"`
}

type SiteRankQuery struct {
	ID        string    `json:"id" gform:"primary;auto_id"`
	UserID    string    `json:"user_id" gform:"required;index"`
	URL       string    `json:"url" gform:"required;max_length:2048"`
	Status    string    `json:"status" gform:"default:'PENDING';max_length:20"`
	CreatedAt time.Time `json:"created_at" gform:"auto_time"`
}

type AdsAccount struct {
	ID          string    `json:"id" gform:"primary;auto_id"`
	UserID      string    `json:"user_id" gform:"required;index"`
	Platform    string    `json:"platform" gform:"required;max_length:50"`
	AccountName string    `json:"account_name" gform:"required;max_length:255"`
	Status      string    `json:"status" gform:"default:'ACTIVE';max_length:20"`
	CreatedAt   time.Time `json:"created_at" gform:"auto_time"`
}

type Subscription struct {
	ID        string    `json:"id" gform:"primary;auto_id"`
	UserID    string    `json:"user_id" gform:"required;index"`
	PlanID    string    `json:"plan_id" gform:"required;max_length:50"`
	Status    string    `json:"status" gform:"default:'ACTIVE';max_length:20"`
	StartDate time.Time `json:"start_date" gform:"auto_time"`
	EndDate   time.Time `json:"end_date" gform:"auto_time"`
	AutoRenew bool      `json:"auto_renew" gform:"default:false"`
}

type TokenTransaction struct {
	ID        string    `json:"id" gform:"primary;auto_id"`
	UserID    string    `json:"user_id" gform:"required;index"`
	Type      string    `json:"type" gform:"required;max_length:20"`
	Amount    int64     `json:"amount" gform:"required"`
	Status    string    `json:"status" gform:"default:'COMPLETED';max_length:20"`
	CreatedAt time.Time `json:"created_at" gform:"auto_time"`
}

// Store structs (interfaces)
type UserStore struct {
	DB interface{}
}

type BatchTaskStore struct {
	DB interface{}
}

type SiteRankQueryStore struct {
	DB interface{}
}

type AdsAccountStore struct {
	DB interface{}
}

type SubscriptionStore struct {
	DB interface{}
}

type TokenTransactionStore struct {
	DB interface{}
}

// registerAdminPanel 注册管理面板
func registerAdminPanel() {
	// 注册自动管理面板
	admin.RegisterAutoAdminPanels()

	// 启用GoFly的管理面板生成器
	gf.EnableAdminPanelGenerator()

	// 设置管理面板主题
	gf.SetAdminPanelTheme("adminlte")

	// 配置管理面板菜单
	gf.SetAdminMenu([]gf.Map{
		{
			"title": "仪表盘",
			"icon":  "dashboard",
			"path":  "/admin/gofly-panel",
		},
		{
			"title": "用户管理",
			"icon":  "users",
			"path":  "/admin/gofly-panel/users",
			"children": []gf.Map{
				{"title": "用户列表", "path": "/admin/gofly-panel/users"},
				{"title": "用户统计", "path": "/admin/gofly-panel/users/stats"},
			},
		},
		{
			"title": "业务管理",
			"icon":  "briefcase",
			"children": []gf.Map{
				{"title": "批量任务", "path": "/admin/gofly-panel/batch-tasks"},
				{"title": "网站排名", "path": "/admin/gofly-panel/siterank-queries"},
				{"title": "广告账户", "path": "/admin/gofly-panel/ads-accounts"},
				{"title": "订阅管理", "path": "/admin/gofly-panel/subscriptions"},
			},
		},
		{
			"title": "系统管理",
			"icon":  "cog",
			"children": []gf.Map{
				{"title": "系统设置", "path": "/admin/gofly-panel/system"},
				{"title": "操作日志", "path": "/admin/gofly-panel/logs"},
				{"title": "数据备份", "path": "/admin/gofly-panel/backup"},
				{"title": "系统管理（新）", "path": "/admin/system-manager"},
			},
		},
	})
}

// enableGoFlyAutomation 启用GoFly自动化功能
func enableGoFlyAutomation() {
	// 启用GoFly的自动验证
	gf.EnableAutoValidation()

	// 启用GoFly的自动分页
	gf.EnableAutoPagination()

	// 启用GoFly的自动排序
	gf.EnableAutoSorting()

	// 启用GoFly的自动过滤
	gf.EnableAutoFiltering()

	// 启用GoFly的自动搜索
	gf.EnableAutoSearching()
}
