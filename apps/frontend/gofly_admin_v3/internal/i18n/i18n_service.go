package i18n

import (
	"fmt"
	"path/filepath"
	"strings"
	"sync"

	"github.com/BurntSushi/toml"
	"github.com/gin-gonic/gin"
	"gofly-admin-v3/internal/response"
)

// Language 支持的语言
type Language string

const (
	LanguageZhCN Language = "zh-CN"
	LanguageEnUS Language = "en-US"
)

// I18nService 国际化服务
type I18nService struct {
	messages map[Language]map[string]string
	mutex    sync.RWMutex
}

var (
	defaultI18nService *I18nService
	i18nInit           bool
)

// NewI18nService 创建国际化服务
func NewI18nService() *I18nService {
	return &I18nService{
		messages: make(map[Language]map[string]string),
	}
}

// GetI18nService 获取国际化服务
func GetI18nService() *I18nService {
	if !i18nInit {
		defaultI18nService = NewI18nService()
		defaultI18nService.LoadMessages()
		i18nInit = true
	}
	return defaultI18nService
}

// LoadMessages 加载消息文件
func (s *I18nService) LoadMessages() error {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	// 加载中文消息
	if err := s.loadLanguageMessages(LanguageZhCN); err != nil {
		return fmt.Errorf("failed to load zh-CN messages: %v", err)
	}

	// 加载英文消息
	if err := s.loadLanguageMessages(LanguageEnUS); err != nil {
		return fmt.Errorf("failed to load en-US messages: %v", err)
	}

	return nil
}

// loadLanguageMessages 加载指定语言的消息
func (s *I18nService) loadLanguageMessages(lang Language) error {
	basePath := filepath.Join("resource", "locale", string(lang))

	// 初始化语言消息映射
	if s.messages[lang] == nil {
		s.messages[lang] = make(map[string]string)
	}

	// 加载系统消息
	sysMsgPath := filepath.Join(basePath, "sysmsg.toml")
	if err := s.loadTomlFile(sysMsgPath, s.messages[lang]); err != nil {
		return fmt.Errorf("failed to load sysmsg.toml: %v", err)
	}

	// 加载验证消息
	validationPath := filepath.Join(basePath, "validation.toml")
	if err := s.loadTomlFile(validationPath, s.messages[lang]); err != nil {
		return fmt.Errorf("failed to load validation.toml: %v", err)
	}

	// 加载业务消息
	businessPath := filepath.Join(basePath, "business.toml")
	s.loadTomlFile(businessPath, s.messages[lang]) // 忽略错误，可能不存在

	return nil
}

// loadTomlFile 加载TOML文件
func (s *I18nService) loadTomlFile(filePath string, messages map[string]string) error {
	var data map[string]string
	if _, err := toml.DecodeFile(filePath, &data); err != nil {
		return err
	}

	// 合并消息
	for key, value := range data {
		messages[key] = value
	}

	return nil
}

// GetMessage 获取消息
func (s *I18nService) GetMessage(lang Language, key string, args ...interface{}) string {
	s.mutex.RLock()
	defer s.mutex.RUnlock()

	// 获取语言消息
	langMessages, exists := s.messages[lang]
	if !exists {
		// 回退到中文
		langMessages = s.messages[LanguageZhCN]
	}

	// 获取消息
	message, exists := langMessages[key]
	if !exists {
		// 回退到英文
		if lang != LanguageEnUS {
			if enMessages, exists := s.messages[LanguageEnUS]; exists {
				if enMessage, exists := enMessages[key]; exists {
					message = enMessage
				}
			}
		}

		// 如果还是没有，返回key
		if message == "" {
			message = key
		}
	}

	// 格式化消息
	if len(args) > 0 {
		return fmt.Sprintf(message, args...)
	}

	return message
}

// GetLanguageFromContext 从上下文获取语言
func (s *I18nService) GetLanguageFromContext(c *gin.Context) Language {
	// 1. 从查询参数获取
	if lang := c.Query("lang"); lang != "" {
		return s.normalizeLanguage(lang)
	}

	// 2. 从Header获取
	if lang := c.GetHeader("Accept-Language"); lang != "" {
		return s.parseAcceptLanguage(lang)
	}

	// 3. 从用户设置获取（如果已登录）
	if userID := c.GetUint("user_id"); userID > 0 {
		// TODO: 从数据库获取用户语言设置
	}

	// 4. 默认中文
	return LanguageZhCN
}

// normalizeLanguage 标准化语言代码
func (s *I18nService) normalizeLanguage(lang string) Language {
	lang = strings.ToLower(lang)
	switch {
	case strings.Contains(lang, "zh"):
		return LanguageZhCN
	case strings.Contains(lang, "en"):
		return LanguageEnUS
	default:
		return LanguageZhCN
	}
}

// parseAcceptLanguage 解析Accept-Language头
func (s *I18nService) parseAcceptLanguage(acceptLang string) Language {
	// 简单解析，取第一个语言
	langs := strings.Split(acceptLang, ",")
	if len(langs) > 0 {
		lang := strings.TrimSpace(strings.Split(langs[0], ";")[0])
		return s.normalizeLanguage(lang)
	}
	return LanguageZhCN
}

// I18nMiddleware 国际化中间件
func I18nMiddleware() gin.HandlerFunc {
	service := GetI18nService()

	return func(c *gin.Context) {
		lang := service.GetLanguageFromContext(c)
		c.Set("language", lang)
		c.Next()
	}
}

// T 翻译函数（便捷函数）
func T(c *gin.Context, key string, args ...interface{}) string {
	service := GetI18nService()
	lang, exists := c.Get("language")
	if !exists {
		lang = LanguageZhCN
	}
	return service.GetMessage(lang.(Language), key, args...)
}

// GetSupportedLanguages 获取支持的语言列表
func GetSupportedLanguages() []map[string]string {
	return []map[string]string{
		{
			"code": string(LanguageZhCN),
			"name": "简体中文",
		},
		{
			"code": string(LanguageEnUS),
			"name": "English",
		},
	}
}

// SetUserLanguage 设置用户语言偏好
func SetUserLanguage(c *gin.Context) {
	var req struct {
		Language string `json:"language" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, 1001, T(c, "invalid_parameters"))
		return
	}

	// 验证语言代码
	lang := Language(req.Language)
	if lang != LanguageZhCN && lang != LanguageEnUS {
		response.Error(c, 1002, T(c, "unsupported_language"))
		return
	}

	// TODO: 保存到数据库
	// 这里可以扩展User模型添加Language字段

	response.Success(c, gin.H{
		"language": lang,
		"message":  T(c, "language_updated_successfully"),
	})
}

// GetLanguageList 获取语言列表API
func GetLanguageList(c *gin.Context) {
	current, _ := c.Get("language")
	response.Success(c, gin.H{
		"languages": GetSupportedLanguages(),
		"current":   current,
	})
}

// RegisterI18nRoutes 注册国际化路由
func RegisterI18nRoutes(r *gin.RouterGroup) {
	i18n := r.Group("/i18n")
	{
		i18n.GET("/languages", GetLanguageList)
		i18n.POST("/set-language", SetUserLanguage)
	}
}
