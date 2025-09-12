package dictionary

import (
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"gofly-admin-v3/internal/cache"
	"gofly-admin-v3/internal/i18n"
	"gofly-admin-v3/internal/models"
	"gofly-admin-v3/internal/response"
	"gorm.io/gorm"
)

// DictionaryService 数据字典服务
type DictionaryService struct {
	db    *gorm.DB
	cache cache.CacheService
	mutex sync.RWMutex
}

// DictionaryItem 字典项
type DictionaryItem struct {
	ID          uint      `json:"id" gorm:"primaryKey"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
	Category    string    `json:"category" gorm:"type:varchar(50);not null;index"`
	Key         string    `json:"key" gorm:"type:varchar(100);not null"`
	Value       string    `json:"value" gorm:"type:varchar(255);not null"`
	Label       string    `json:"label" gorm:"type:varchar(255);not null"`
	Description string    `json:"description" gorm:"type:text"`
	Sort        int       `json:"sort" gorm:"default:0"`
	Status      int       `json:"status" gorm:"default:1"` // 1: 启用, 0: 禁用
	Extra       string    `json:"extra" gorm:"type:json"`  // 扩展字段
}

// DictionaryCategory 字典分类
type DictionaryCategory struct {
	Category    string `json:"category"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Count       int64  `json:"count"`
}

var (
	defaultDictionaryService *DictionaryService
	dictionaryInit           bool
)

// NewDictionaryService 创建数据字典服务
func NewDictionaryService(db *gorm.DB, cacheService cache.CacheService) *DictionaryService {
	return &DictionaryService{
		db:    db,
		cache: cacheService,
	}
}

// GetDictionaryService 获取数据字典服务
func GetDictionaryService() *DictionaryService {
	if !dictionaryInit {
		// 这里需要传入实际的数据库和缓存服务
		// defaultDictionaryService = NewDictionaryService(db, cache.GetCacheService())
		dictionaryInit = true
	}
	return defaultDictionaryService
}

// InitDefaultData 初始化默认数据
func (s *DictionaryService) InitDefaultData() error {
	// 自动迁移表结构
	if err := s.db.AutoMigrate(&DictionaryItem{}); err != nil {
		return fmt.Errorf("failed to migrate dictionary table: %v", err)
	}

	// 检查是否已有数据
	var count int64
	s.db.Model(&DictionaryItem{}).Count(&count)
	if count > 0 {
		return nil // 已有数据，跳过初始化
	}

	// 初始化默认字典数据
	defaultItems := []DictionaryItem{
		// 套餐类型
		{Category: "plan_type", Key: "free", Value: "free", Label: "免费版", Description: "免费套餐", Sort: 1, Status: 1},
		{Category: "plan_type", Key: "pro", Value: "pro", Label: "专业版", Description: "专业套餐", Sort: 2, Status: 1},

		// 任务状态
		{Category: "task_status", Key: "pending", Value: "pending", Label: "等待中", Description: "任务等待执行", Sort: 1, Status: 1},
		{Category: "task_status", Key: "running", Value: "running", Label: "执行中", Description: "任务正在执行", Sort: 2, Status: 1},
		{Category: "task_status", Key: "completed", Value: "completed", Label: "已完成", Description: "任务执行完成", Sort: 3, Status: 1},
		{Category: "task_status", Key: "failed", Value: "failed", Label: "失败", Description: "任务执行失败", Sort: 4, Status: 1},
		{Category: "task_status", Key: "terminated", Value: "terminated", Label: "已终止", Description: "任务被终止", Sort: 5, Status: 1},

		// 任务类型
		{Category: "task_type", Key: "basic", Value: "basic", Label: "基础模式", Description: "BatchGo基础模式", Sort: 1, Status: 1},
		{Category: "task_type", Key: "silent", Value: "silent", Label: "静默模式", Description: "BatchGo静默模式", Sort: 2, Status: 1},
		{Category: "task_type", Key: "autoclick", Value: "autoclick", Label: "自动点击", Description: "BatchGo自动点击模式", Sort: 3, Status: 1},

		// 优先级
		{Category: "priority", Key: "high", Value: "High", Label: "高", Description: "高优先级", Sort: 1, Status: 1},
		{Category: "priority", Key: "medium", Value: "Medium", Label: "中", Description: "中优先级", Sort: 2, Status: 1},
		{Category: "priority", Key: "low", Value: "Low", Label: "低", Description: "低优先级", Sort: 3, Status: 1},

		// Token交易类型
		{Category: "token_transaction_type", Key: "purchase", Value: "purchase", Label: "购买", Description: "Token购买", Sort: 1, Status: 1},
		{Category: "token_transaction_type", Key: "checkin", Value: "checkin", Label: "签到", Description: "签到获得", Sort: 2, Status: 1},
		{Category: "token_transaction_type", Key: "invite", Value: "invite", Label: "邀请", Description: "邀请奖励", Sort: 3, Status: 1},
		{Category: "token_transaction_type", Key: "consume", Value: "consume", Label: "消费", Description: "Token消费", Sort: 4, Status: 1},

		// 用户状态
		{Category: "user_status", Key: "active", Value: "1", Label: "正常", Description: "用户状态正常", Sort: 1, Status: 1},
		{Category: "user_status", Key: "inactive", Value: "0", Label: "禁用", Description: "用户被禁用", Sort: 2, Status: 1},

		// 文件类型
		{Category: "file_type", Key: "image", Value: "image", Label: "图片", Description: "图片文件", Sort: 1, Status: 1},
		{Category: "file_type", Key: "document", Value: "document", Label: "文档", Description: "文档文件", Sort: 2, Status: 1},
		{Category: "file_type", Key: "video", Value: "video", Label: "视频", Description: "视频文件", Sort: 3, Status: 1},
		{Category: "file_type", Key: "audio", Value: "audio", Label: "音频", Description: "音频文件", Sort: 4, Status: 1},

		// 访问模式
		{Category: "access_mode", Key: "http", Value: "http", Label: "HTTP模式", Description: "HTTP访问模式", Sort: 1, Status: 1},
		{Category: "access_mode", Key: "puppeteer", Value: "puppeteer", Label: "浏览器模式", Description: "Puppeteer浏览器模式", Sort: 2, Status: 1},
	}

	// 批量插入
	if err := s.db.Create(&defaultItems).Error; err != nil {
		return fmt.Errorf("failed to create default dictionary items: %v", err)
	}

	return nil
}

// GetByCategory 根据分类获取字典项
func (s *DictionaryService) GetByCategory(category string) ([]DictionaryItem, error) {
	// 先从缓存获取
	cacheKey := fmt.Sprintf("dictionary:category:%s", category)
	var items []DictionaryItem

	if err := s.cache.Get(cacheKey, &items); err == nil {
		return items, nil
	}

	// 从数据库获取
	if err := s.db.Where("category = ? AND status = 1", category).
		Order("sort ASC, id ASC").Find(&items).Error; err != nil {
		return nil, err
	}

	// 存入缓存
	s.cache.Set(cacheKey, items, 30*time.Minute)

	return items, nil
}

// GetByKey 根据分类和键获取字典项
func (s *DictionaryService) GetByKey(category, key string) (*DictionaryItem, error) {
	var item DictionaryItem
	if err := s.db.Where("category = ? AND key = ? AND status = 1", category, key).
		First(&item).Error; err != nil {
		return nil, err
	}
	return &item, nil
}

// GetLabel 获取标签
func (s *DictionaryService) GetLabel(category, key string) string {
	item, err := s.GetByKey(category, key)
	if err != nil {
		return key // 如果找不到，返回原始key
	}
	return item.Label
}

// GetValue 获取值
func (s *DictionaryService) GetValue(category, key string) string {
	item, err := s.GetByKey(category, key)
	if err != nil {
		return key // 如果找不到，返回原始key
	}
	return item.Value
}

// GetCategories 获取所有分类
func (s *DictionaryService) GetCategories() ([]DictionaryCategory, error) {
	var categories []DictionaryCategory

	// 查询分类统计
	rows, err := s.db.Model(&DictionaryItem{}).
		Select("category, COUNT(*) as count").
		Where("status = 1").
		Group("category").
		Rows()
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	// 分类名称映射
	categoryNames := map[string]string{
		"plan_type":              "套餐类型",
		"task_status":            "任务状态",
		"task_type":              "任务类型",
		"priority":               "优先级",
		"token_transaction_type": "Token交易类型",
		"user_status":            "用户状态",
		"file_type":              "文件类型",
		"access_mode":            "访问模式",
	}

	for rows.Next() {
		var category DictionaryCategory
		if err := rows.Scan(&category.Category, &category.Count); err != nil {
			continue
		}

		if name, exists := categoryNames[category.Category]; exists {
			category.Name = name
		} else {
			category.Name = category.Category
		}

		categories = append(categories, category)
	}

	return categories, nil
}

// CreateItem 创建字典项
func (s *DictionaryService) CreateItem(item *DictionaryItem) error {
	if err := s.db.Create(item).Error; err != nil {
		return err
	}

	// 清除缓存
	s.clearCategoryCache(item.Category)
	return nil
}

// UpdateItem 更新字典项
func (s *DictionaryService) UpdateItem(id uint, updates map[string]interface{}) error {
	var item DictionaryItem
	if err := s.db.First(&item, id).Error; err != nil {
		return err
	}

	if err := s.db.Model(&item).Updates(updates).Error; err != nil {
		return err
	}

	// 清除缓存
	s.clearCategoryCache(item.Category)
	return nil
}

// DeleteItem 删除字典项
func (s *DictionaryService) DeleteItem(id uint) error {
	var item DictionaryItem
	if err := s.db.First(&item, id).Error; err != nil {
		return err
	}

	if err := s.db.Delete(&item).Error; err != nil {
		return err
	}

	// 清除缓存
	s.clearCategoryCache(item.Category)
	return nil
}

// clearCategoryCache 清除分类缓存
func (s *DictionaryService) clearCategoryCache(category string) {
	cacheKey := fmt.Sprintf("dictionary:category:%s", category)
	s.cache.Delete(cacheKey)
}

// API处理函数

// GetDictionaryByCategory 根据分类获取字典API
func GetDictionaryByCategory(c *gin.Context) {
	category := c.Param("category")
	if category == "" {
		response.Error(c, 1001, i18n.T(c, "invalid_parameters"))
		return
	}

	service := GetDictionaryService()
	items, err := service.GetByCategory(category)
	if err != nil {
		response.Error(c, 5001, i18n.T(c, "failed"))
		return
	}

	response.Success(c, gin.H{
		"category": category,
		"items":    items,
	})
}

// GetDictionaryCategories 获取字典分类API
func GetDictionaryCategories(c *gin.Context) {
	service := GetDictionaryService()
	categories, err := service.GetCategories()
	if err != nil {
		response.Error(c, 5001, i18n.T(c, "failed"))
		return
	}

	response.Success(c, gin.H{
		"categories": categories,
	})
}

// CreateDictionaryItem 创建字典项API
func CreateDictionaryItem(c *gin.Context) {
	var req DictionaryItem
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, 1001, i18n.T(c, "invalid_parameters"))
		return
	}

	service := GetDictionaryService()
	if err := service.CreateItem(&req); err != nil {
		response.Error(c, 5001, i18n.T(c, "failed"))
		return
	}

	response.Success(c, gin.H{
		"item": req,
	})
}

// UpdateDictionaryItem 更新字典项API
func UpdateDictionaryItem(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		response.Error(c, 1001, i18n.T(c, "invalid_parameters"))
		return
	}

	var req map[string]interface{}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, 1001, i18n.T(c, "invalid_parameters"))
		return
	}

	service := GetDictionaryService()
	itemID := parseUint(id)
	if err := service.UpdateItem(itemID, req); err != nil {
		response.Error(c, 5001, i18n.T(c, "failed"))
		return
	}

	response.Success(c, gin.H{
		"message": i18n.T(c, "success"),
	})
}

// DeleteDictionaryItem 删除字典项API
func DeleteDictionaryItem(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		response.Error(c, 1001, i18n.T(c, "invalid_parameters"))
		return
	}

	service := GetDictionaryService()
	itemID := parseUint(id)
	if err := service.DeleteItem(itemID); err != nil {
		response.Error(c, 5001, i18n.T(c, "failed"))
		return
	}

	response.Success(c, gin.H{
		"message": i18n.T(c, "success"),
	})
}

// parseUint 解析uint
func parseUint(s string) uint {
	// 简化实现，实际应该处理错误
	var id uint
	fmt.Sscanf(s, "%d", &id)
	return id
}

// RegisterDictionaryRoutes 注册字典路由
func RegisterDictionaryRoutes(r *gin.RouterGroup) {
	dict := r.Group("/dictionary")
	{
		dict.GET("/categories", GetDictionaryCategories)
		dict.GET("/category/:category", GetDictionaryByCategory)
		dict.POST("/items", CreateDictionaryItem)
		dict.PUT("/items/:id", UpdateDictionaryItem)
		dict.DELETE("/items/:id", DeleteDictionaryItem)
	}
}
