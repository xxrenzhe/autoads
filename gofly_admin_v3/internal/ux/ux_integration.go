package ux

import (
	"github.com/gin-gonic/gin"
	"gofly-admin-v3/internal/captcha"
	"gofly-admin-v3/internal/dictionary"
	"gofly-admin-v3/internal/export"
	"gofly-admin-v3/internal/i18n"
	"gofly-admin-v3/internal/upload"
	"gorm.io/gorm"
)

// UXService 用户体验服务集成
type UXService struct {
	db *gorm.DB
}

// NewUXService 创建用户体验服务
func NewUXService(db *gorm.DB) *UXService {
	return &UXService{
		db: db,
	}
}

// InitializeUXFeatures 初始化用户体验功能
func (s *UXService) InitializeUXFeatures() error {
	// 初始化国际化服务
	i18nService := i18n.GetI18nService()
	if err := i18nService.LoadMessages(); err != nil {
		return err
	}

	// 初始化数据字典
	dictService := dictionary.GetDictionaryService()
	if err := dictService.InitDefaultData(); err != nil {
		return err
	}

	return nil
}

// RegisterUXRoutes 注册用户体验相关路由
func RegisterUXRoutes(r *gin.RouterGroup, db *gorm.DB) {
	// 应用国际化中间件
	r.Use(i18n.I18nMiddleware())

	// 注册各模块路由
	export.RegisterExportRoutes(r, db)
	i18n.RegisterI18nRoutes(r)
	captcha.RegisterCaptchaRoutes(r)
	dictionary.RegisterDictionaryRoutes(r)
	upload.RegisterMediaRoutes(r)
}

// GetUXStats 获取用户体验统计信息
func GetUXStats(c *gin.Context) {
	userID := c.GetUint("user_id")

	// 统计用户的各种数据
	stats := map[string]interface{}{
		"user_id": userID,
		"features": map[string]bool{
			"excel_export":     true,
			"i18n_support":     true,
			"captcha_system":   true,
			"data_dictionary":  true,
			"media_processing": true,
		},
		"supported_languages": i18n.GetSupportedLanguages(),
		"export_formats":      []string{"xlsx"},
		"media_formats":       []string{"jpg", "png", "gif", "mp4", "avi", "mov"},
	}

	c.JSON(200, gin.H{
		"code": 0,
		"data": stats,
	})
}

// UXMiddleware 用户体验中间件
func UXMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// 设置用户体验相关的响应头
		c.Header("X-UX-Features", "export,i18n,captcha,dictionary,media")
		c.Header("X-Supported-Languages", "zh-CN,en-US")

		c.Next()
	}
}
