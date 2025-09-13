package app

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"gofly-admin-v3/internal/batchgo"
	"gorm.io/gorm"
	// "gofly-admin-v3/internal/siterankgo"
	"gofly-admin-v3/service/user"
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


// ListUsers 列出用户（管理员功能）
func ListUsers(c *gin.Context) {
	userService := c.MustGet("userService").(*user.Service)

	// 分页参数
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "10"))

	// 获取用户列表
	users, total, err := userService.GetUserList(page, pageSize, "")
	if err != nil {
		gf.Failed().SetMsg("获取用户列表失败").Regin(c)
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
	db := c.MustGet("db").(*gorm.DB)
	controller := batchgo.NewController(batchGoService, db)
	controller.CreateTask(c)
}

func ListBatchGoTasks(c *gin.Context) {
	batchGoService := c.MustGet("batchGoService").(*batchgo.Service)
	db := c.MustGet("db").(*gorm.DB)
	_ = batchgo.NewController(batchGoService, db)
	// controller.ListTasks(c) // Method not implemented
	c.JSON(http.StatusOK, gin.H{"message": "List tasks not implemented"})
}

func GetBatchGoTask(c *gin.Context) {
	batchGoService := c.MustGet("batchGoService").(*batchgo.Service)
	db := c.MustGet("db").(*gorm.DB)
	_ = batchgo.NewController(batchGoService, db)
	// controller.GetTask(c) // Method not implemented
	c.JSON(http.StatusOK, gin.H{"message": "Get task not implemented"})
}

func UpdateBatchGoTask(c *gin.Context) {
	batchGoService := c.MustGet("batchGoService").(*batchgo.Service)
	db := c.MustGet("db").(*gorm.DB)
	_ = batchgo.NewController(batchGoService, db)
	// controller.UpdateTask(c) // Method not implemented
	c.JSON(http.StatusOK, gin.H{"message": "Update task not implemented"})
}

func DeleteBatchGoTask(c *gin.Context) {
	batchGoService := c.MustGet("batchGoService").(*batchgo.Service)
	db := c.MustGet("db").(*gorm.DB)
	_ = batchgo.NewController(batchGoService, db)
	// controller.DeleteTask(c) // Method not implemented
	c.JSON(http.StatusOK, gin.H{"message": "Delete task not implemented"})
}

// SiteRankGo 模块handler函数
// func QuerySiteRank(c *gin.Context) {
// 	siteRankGoService := c.MustGet("siteRankGoService").(*siterankgo.Service)
// 	controller := siterankgo.NewController(siteRankGoService)
// 	controller.CreateQuery(c)
// }

// func BatchQuerySiteRank(c *gin.Context) {
// 	siteRankGoService := c.MustGet("siteRankGoService").(*siterankgo.Service)
// 	controller := siterankgo.NewController(siteRankGoService)
// 	controller.BatchQuery(c)
// }

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
