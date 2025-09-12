//go:build autoads_siterank_advanced

package siterankgo

import (
	"context"
	"encoding/json"
	"time"

	"gofly-admin-v3/internal/store"
	"gofly-admin-v3/utils/gform"
	"gofly-admin-v3/utils/tools/gcache"
	"gofly-admin-v3/utils/tools/gstr"
)

// RedisCache Redis缓存实现
type RedisCache struct {
	client *store.Redis
	ttl    time.Duration
}

// NewRedisCache 创建Redis缓存
func NewRedisCache(redis *store.Redis, ttl time.Duration) *RedisCache {
	return &RedisCache{
		client: redis,
		ttl:    ttl,
	}
}

// Get 获取缓存
func (c *RedisCache) Get(ctx context.Context, key string) (interface{}, bool) {
	if c.client == nil {
		return nil, false
	}

    val, err := c.client.Get(ctx, key)
	if err != nil {
		return nil, false
	}

	// 尝试解析JSON
	var result interface{}
	if err := json.Unmarshal([]byte(val), &result); err != nil {
		// 如果不是JSON，直接返回字符串
		return val, true
	}

	return result, true
}

// Set 设置缓存
func (c *RedisCache) Set(ctx context.Context, key string, value interface{}) error {
	if c.client == nil {
		return nil
	}

	// 序列化值
	var data []byte
	var err error

	switch v := value.(type) {
	case string:
		data = []byte(v)
	case []byte:
		data = v
	default:
		data, err = json.Marshal(value)
		if err != nil {
			return err
		}
	}

    return c.client.Set(ctx, key, data, c.ttl)
}

// Delete 删除缓存
func (c *RedisCache) Delete(ctx context.Context, key string) error {
	if c.client == nil {
		return nil
	}

    return c.client.Delete(ctx, key)
}

// CacheWrapper 缓存包装器
type CacheWrapper struct {
	db     *store.DB
	cache  CacheInterface
	ttl    time.Duration
	prefix string
}

// CacheInterface 缓存接口
type CacheInterface interface {
	Get(ctx context.Context, key string) (interface{}, bool)
	Set(ctx context.Context, key string, value interface{}) error
	Delete(ctx context.Context, key string) error
}

// NewCacheWrapper 创建缓存包装器
func NewCacheWrapper(db *store.DB, redis *store.Redis, ttl time.Duration) *CacheWrapper {
	wrapper := &CacheWrapper{
		db:     db,
		ttl:    ttl,
		prefix: "siterank:",
	}

	// 优先使用Redis缓存
	if redis != nil {
		wrapper.cache = NewRedisCache(redis, ttl)
	} else {
		// 使用内存缓存作为后备
		wrapper.cache = NewMemoryCache(ttl)
	}

	return wrapper
}

// Get 获取缓存
func (cw *CacheWrapper) Get(key string) (interface{}, bool) {
	ctx := context.Background()
	cacheKey := cw.buildKey(key)
	return cw.cache.Get(ctx, cacheKey)
}

// Set 设置缓存
func (cw *CacheWrapper) Set(key string, value interface{}) {
	ctx := context.Background()
	cacheKey := cw.buildKey(key)
	_ = cw.cache.Set(ctx, cacheKey, value)
}

// Delete 删除缓存
func (cw *CacheWrapper) Delete(key string) {
	ctx := context.Background()
	cacheKey := cw.buildKey(key)
	_ = cw.cache.Delete(ctx, cacheKey)
}

// buildKey 构建缓存键
func (cw *CacheWrapper) buildKey(key string) string {
    return cw.prefix + key
}

// GetTaskWithCache 带缓存的获取任务
func (s *Service) GetTaskWithCache(taskID string) (*SiteRankTask, error) {
	// 尝试从缓存获取
    cacheKey := "task:" + taskID
	if val, ok := s.cache.Get(cacheKey); ok {
		if task, ok := val.(*SiteRankTask); ok {
			return task, nil
		}
	}

	// 从数据库查询
	task, err := s.GetTaskByID(taskID)
	if err != nil {
		return nil, err
	}

	// 设置缓存
	s.cache.Set(cacheKey, task)

	return task, nil
}

// CacheRankingResult 缓存排名结果
func (s *Service) CacheRankingResult(domain, keyword, engine string, result *RankingResult) {
	// 构建缓存键
    cacheKey := "ranking:" + domain + ":" + keyword + ":" + engine

	// 设置缓存，有效期1小时
	cacheData := map[string]interface{}{
		"position":    result.Position,
		"url":         result.URL,
		"title":       result.Title,
		"description": result.Description,
		"features":    result.SERPFeatures,
		"cached_at":   time.Now(),
	}

	s.cache.Set(cacheKey, cacheData)
}

// GetCachedRankingResult 获取缓存的排名结果
func (s *Service) GetCachedRankingResult(domain, keyword, engine string) (*RankingResult, bool) {
    cacheKey := "ranking:" + domain + ":" + keyword + ":" + engine

	val, ok := s.cache.Get(cacheKey)
	if !ok {
		return nil, false
	}

	// 解析缓存数据
	if data, ok := val.(map[string]interface{}); ok {
		result := &RankingResult{
			Position:    int(data["position"].(float64)),
			URL:         data["url"].(string),
			Title:       data["title"].(string),
			Description: data["description"].(string),
		}

		if features, ok := data["features"].([]string); ok {
			result.SERPFeatures = features
		}

		if cachedAt, ok := data["cached_at"].(time.Time); ok {
			result.LastChecked = cachedAt
		}

		return result, true
	}

	return nil, false
}

// MemoryCache 内存缓存实现（后备方案）
type MemoryCache struct {
	items map[string]cacheItem
	ttl   time.Duration
}

type cacheItem struct {
	value     interface{}
	expiredAt time.Time
}

// NewMemoryCache 创建内存缓存
func NewMemoryCache(ttl time.Duration) *MemoryCache {
	return &MemoryCache{
		items: make(map[string]cacheItem),
		ttl:   ttl,
	}
}

// Get 获取缓存
func (c *MemoryCache) Get(ctx context.Context, key string) (interface{}, bool) {
	item, exists := c.items[key]
	if !exists {
		return nil, false
	}

	// 检查是否过期
	if time.Now().After(item.expiredAt) {
		delete(c.items, key)
		return nil, false
	}

	return item.value, true
}

// Set 设置缓存
func (c *MemoryCache) Set(ctx context.Context, key string, value interface{}) error {
	c.items[key] = cacheItem{
		value:     value,
		expiredAt: time.Now().Add(c.ttl),
	}
	return nil
}

// Delete 删除缓存
func (c *MemoryCache) Delete(ctx context.Context, key string) error {
	delete(c.items, key)
	return nil
}

// CacheStatistics 缓存统计
type CacheStatistics struct {
	HitCount  int64   `json:"hit_count"`
	MissCount int64   `json:"miss_count"`
	HitRate   float64 `json:"hit_rate"`
	ItemCount int64   `json:"item_count"`
}

// GetCacheStatistics 获取缓存统计
func (cw *CacheWrapper) GetCacheStatistics() *CacheStatistics {
	// TODO: 实现缓存统计
	return &CacheStatistics{
		HitCount:  0,
		MissCount: 0,
		HitRate:   0.0,
		ItemCount: 0,
	}
}

// ClearExpired 清理过期缓存
func (cw *CacheWrapper) ClearExpired() {
	// Redis会自动清理过期键
	// 内存缓存在Get时自动清理
}
