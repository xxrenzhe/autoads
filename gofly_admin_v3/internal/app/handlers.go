package app

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"gofly-admin-v3/internal/batchgo"
	"gofly-admin-v3/internal/siterankgo"
	"gofly-admin-v3/internal/user"
	"gofly-admin-v3/utils/gf"
)

// UserRegister 用户注册
func UserRegister(c *gin.Context) {
	userService := c.MustGet("userService").(*user.Service)

	controller := user.NewController(userService)
	controller.Register(c)
}

// UserLogin 用户登录
func UserLogin(c *gin.Context) {
	userService := c.MustGet("userService").(*user.Service)

	controller := user.NewController(userService)
	controller.Login(c)
}

// GoogleLogin Google登录
func GoogleLogin(c *gin.Context) {
	userService := c.MustGet("userService").(*user.Service)

	controller := user.NewController(userService)
	controller.GoogleLogin(c)
}

// UserProfile 获取用户信息
func UserProfile(c *gin.Context) {
	userService := c.MustGet("userService").(*user.Service)

	controller := user.NewController(userService)
	controller.Profile(c)
}

// UpdateUserProfile 更新用户资料
func UpdateUserProfile(c *gin.Context) {
	userService := c.MustGet("userService").(*user.Service)

	controller := user.NewController(userService)
	controller.UpdateProfile(c)
}

// ChangePassword 修改密码
func ChangePassword(c *gin.Context) {
	userService := c.MustGet("userService").(*user.Service)

	controller := user.NewController(userService)
	controller.ChangePassword(c)
}

// StartTrial 开始试用
func StartTrial(c *gin.Context) {
	userService := c.MustGet("userService").(*user.Service)

	controller := user.NewController(userService)
	controller.StartTrial(c)
}

// RefreshToken 刷新令牌
func RefreshToken(c *gin.Context) {
	userService := c.MustGet("userService").(*user.Service)

	controller := user.NewController(userService)
	controller.RefreshToken(c)
}

// Logout 登出
func Logout(c *gin.Context) {
	userService := c.MustGet("userService").(*user.Service)

	controller := user.NewController(userService)
	controller.Logout(c)
}

// GoogleOAuthCallback Google OAuth回调
func GoogleOAuthCallback(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"message": "Google OAuth回调功能待实现",
	})
}

// UserAuth 用户认证中间件
func UserAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		// 暂时跳过认证，后续实现JWT认证
		c.Next()
	}
}

// AdminAuth 管理员认证中间件
func AdminAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		// 暂时跳过认证，后续实现管理员认证
		c.Next()
	}
}

// ListUsers 列出用户（管理员功能）
func ListUsers(c *gin.Context) {
	userService := c.MustGet("userService").(*user.Service)

	// 分页参数
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "10"))

	// 获取用户列表
	users, total, err := userService.ListUsers(page, pageSize)
	if err != nil {
		gf.Error().SetMsg("获取用户列表失败").Regin(c)
		return
	}

	gf.Success().SetData(gf.Map{
		"users":    users,
		"total":    total,
		"page":     page,
		"pageSize": pageSize,
	}).Regin(c)
}

// SystemStats 系统统计（管理员功能）
func SystemStats(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"message": "系统统计功能待实现",
	})
}

// BatchGo 模块handler函数
func CreateBatchGoTask(c *gin.Context) {
	batchGoService := c.MustGet("batchGoService").(*batchgo.Service)
	controller := batchgo.NewController(batchGoService)
	controller.CreateTask(c)
}

func ListBatchGoTasks(c *gin.Context) {
	batchGoService := c.MustGet("batchGoService").(*batchgo.Service)
	controller := batchgo.NewController(batchGoService)
	controller.ListTasks(c)
}

func GetBatchGoTask(c *gin.Context) {
	batchGoService := c.MustGet("batchGoService").(*batchgo.Service)
	controller := batchgo.NewController(batchGoService)
	controller.GetTask(c)
}

func UpdateBatchGoTask(c *gin.Context) {
	batchGoService := c.MustGet("batchGoService").(*batchgo.Service)
	controller := batchgo.NewController(batchGoService)
	controller.UpdateTask(c)
}

func DeleteBatchGoTask(c *gin.Context) {
	batchGoService := c.MustGet("batchGoService").(*batchgo.Service)
	controller := batchgo.NewController(batchGoService)
	controller.DeleteTask(c)
}

// SiteRankGo 模块handler函数
func QuerySiteRank(c *gin.Context) {
	siteRankGoService := c.MustGet("siteRankGoService").(*siterankgo.Service)
	controller := siterankgo.NewController(siteRankGoService)
	controller.CreateQuery(c)
}

func BatchQuerySiteRank(c *gin.Context) {
	siteRankGoService := c.MustGet("siteRankGoService").(*siterankgo.Service)
	controller := siterankgo.NewController(siteRankGoService)
	controller.BatchQuery(c)
}

func HandleOAuthCallback(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"message": "oauth callback endpoint"})
}

func ListAdsAccounts(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"message": "list ads accounts endpoint"})
}

func SyncAccountData(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"message": "sync account data endpoint"})
}

func GetTokenBalance(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"message": "get token balance endpoint"})
}

func GetTokenTransactions(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"message": "get token transactions endpoint"})
}
