package cache

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/go-redis/redis/v8"
)

// CacheService 缓存服务接口
type CacheService interface {
	Get(key string, dest interface{}) error
	Set(key string, value interface{}, expiration time.Duration) error
	Delete(key string) error
	Exists(key string) bool
	Clear() error
	GetTTL(key string) time.Duration
	Increment(key string, value int64) (int64, error)
	Decrement(key string, value int64) (int64, error)
}

// RedisCacheService Redis缓存服务
type RedisCacheService struct {
	client *redis.Client
	prefix string
}

// NewRedisCacheService 创建Redis缓存服务
func NewRedisCacheService(client *redis.Client, prefix string) *RedisCacheService {
	return &RedisCacheService{
		client: client,
		prefix: prefix,
	}
}

// Get 获取缓存
func (r *RedisCacheService) Get(key string, dest interface{}) error {
	ctx := context.Background()
	fullKey := r.getFullKey(key)

	val, err := r.client.Get(ctx, fullKey).Result()
	if err != nil {
		if err == redis.Nil {
			return ErrCacheNotFound
		}
		return fmt.Errorf("failed to get cache: %w", err)
	}

	return json.Unmarshal([]byte(val), dest)
}

// Set 设置缓存
func (r *RedisCacheService) Set(key string, value interface{}, expiration time.Duration) error {
	ctx := context.Background()
	fullKey := r.getFullKey(key)

	data, err := json.Marshal(value)
	if err != nil {
		return fmt.Errorf("failed to marshal value: %w", err)
	}

	return r.client.Set(ctx, fullKey, data, expiration).Err()
}

// Delete 删除缓存
func (r *RedisCacheService) Delete(key string) error {
	ctx := context.Background()
	fullKey := r.getFullKey(key)

	return r.client.Del(ctx, fullKey).Err()
}

// Exists 检查缓存是否存在
func (r *RedisCacheService) Exists(key string) bool {
	ctx := context.Background()
	fullKey := r.getFullKey(key)

	count, err := r.client.Exists(ctx, fullKey).Result()
	return err == nil && count > 0
}

// Clear 清空缓存
func (r *RedisCacheService) Clear() error {
	ctx := context.Background()
	pattern := r.getFullKey("*")

	keys, err := r.client.Keys(ctx, pattern).Result()
	if err != nil {
		return err
	}

	if len(keys) > 0 {
		return r.client.Del(ctx, keys...).Err()
	}

	return nil
}

// GetTTL 获取缓存TTL
func (r *RedisCacheService) GetTTL(key string) time.Duration {
	ctx := context.Background()
	fullKey := r.getFullKey(key)

	ttl, err := r.client.TTL(ctx, fullKey).Result()
	if err != nil {
		return 0
	}

	return ttl
}

// Increment 递增
func (r *RedisCacheService) Increment(key string, value int64) (int64, error) {
	ctx := context.Background()
	fullKey := r.getFullKey(key)

	return r.client.IncrBy(ctx, fullKey, value).Result()
}

// Decrement 递减
func (r *RedisCacheService) Decrement(key string, value int64) (int64, error) {
	ctx := context.Background()
	fullKey := r.getFullKey(key)

	return r.client.DecrBy(ctx, fullKey, value).Result()
}

// getFullKey 获取完整的缓存键
func (r *RedisCacheService) getFullKey(key string) string {
	if r.prefix == "" {
		return key
	}
	return fmt.Sprintf("%s:%s", r.prefix, key)
}

// MemoryCacheService 内存缓存服务
type MemoryCacheService struct {
	data map[string]*cacheItem
	mu   sync.RWMutex
}

// cacheItem 缓存项
type cacheItem struct {
	value      interface{}
	expiration time.Time
}

// NewMemoryCacheService 创建内存缓存服务
func NewMemoryCacheService() *MemoryCacheService {
	service := &MemoryCacheService{
		data: make(map[string]*cacheItem),
	}

	// 启动清理goroutine
	go service.cleanup()

	return service
}

// Get 获取缓存
func (m *MemoryCacheService) Get(key string, dest interface{}) error {
	m.mu.RLock()
	defer m.mu.RUnlock()

	item, exists := m.data[key]
	if !exists {
		return ErrCacheNotFound
	}

	// 检查是否过期
	if !item.expiration.IsZero() && time.Now().After(item.expiration) {
		return ErrCacheNotFound
	}

	// 使用JSON序列化/反序列化来复制数据
	data, err := json.Marshal(item.value)
	if err != nil {
		return fmt.Errorf("failed to marshal cached value: %w", err)
	}

	return json.Unmarshal(data, dest)
}

// Set 设置缓存
func (m *MemoryCacheService) Set(key string, value interface{}, expiration time.Duration) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	var exp time.Time
	if expiration > 0 {
		exp = time.Now().Add(expiration)
	}

	m.data[key] = &cacheItem{
		value:      value,
		expiration: exp,
	}

	return nil
}

// Delete 删除缓存
func (m *MemoryCacheService) Delete(key string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	delete(m.data, key)
	return nil
}

// Exists 检查缓存是否存在
func (m *MemoryCacheService) Exists(key string) bool {
	m.mu.RLock()
	defer m.mu.RUnlock()

	item, exists := m.data[key]
	if !exists {
		return false
	}

	// 检查是否过期
	if !item.expiration.IsZero() && time.Now().After(item.expiration) {
		return false
	}

	return true
}

// Clear 清空缓存
func (m *MemoryCacheService) Clear() error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.data = make(map[string]*cacheItem)
	return nil
}

// GetTTL 获取缓存TTL
func (m *MemoryCacheService) GetTTL(key string) time.Duration {
	m.mu.RLock()
	defer m.mu.RUnlock()

	item, exists := m.data[key]
	if !exists {
		return 0
	}

	if item.expiration.IsZero() {
		return -1 // 永不过期
	}

	ttl := time.Until(item.expiration)
	if ttl < 0 {
		return 0 // 已过期
	}

	return ttl
}

// Increment 递增
func (m *MemoryCacheService) Increment(key string, value int64) (int64, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	item, exists := m.data[key]
	if !exists {
		m.data[key] = &cacheItem{value: value}
		return value, nil
	}

	// 检查是否过期
	if !item.expiration.IsZero() && time.Now().After(item.expiration) {
		m.data[key] = &cacheItem{value: value}
		return value, nil
	}

	// 尝试转换为int64
	switch v := item.value.(type) {
	case int64:
		newValue := v + value
		item.value = newValue
		return newValue, nil
	case float64:
		newValue := int64(v) + value
		item.value = newValue
		return newValue, nil
	default:
		return 0, fmt.Errorf("cannot increment non-numeric value")
	}
}

// Decrement 递减
func (m *MemoryCacheService) Decrement(key string, value int64) (int64, error) {
	return m.Increment(key, -value)
}

// cleanup 清理过期缓存
func (m *MemoryCacheService) cleanup() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		m.mu.Lock()
		now := time.Now()
		for key, item := range m.data {
			if !item.expiration.IsZero() && now.After(item.expiration) {
				delete(m.data, key)
			}
		}
		m.mu.Unlock()
	}
}

// LayeredCacheService 分层缓存服务
type LayeredCacheService struct {
	l1 CacheService // 一级缓存（内存）
	l2 CacheService // 二级缓存（Redis）
}

// NewLayeredCacheService 创建分层缓存服务
func NewLayeredCacheService(l1, l2 CacheService) *LayeredCacheService {
	return &LayeredCacheService{
		l1: l1,
		l2: l2,
	}
}

// Get 获取缓存
func (l *LayeredCacheService) Get(key string, dest interface{}) error {
	// 先从一级缓存获取
	if err := l.l1.Get(key, dest); err == nil {
		return nil
	}

	// 从二级缓存获取
	if err := l.l2.Get(key, dest); err != nil {
		return err
	}

	// 回写到一级缓存
	l.l1.Set(key, dest, 5*time.Minute)

	return nil
}

// Set 设置缓存
func (l *LayeredCacheService) Set(key string, value interface{}, expiration time.Duration) error {
	// 同时设置两级缓存
	l.l1.Set(key, value, expiration)
	return l.l2.Set(key, value, expiration)
}

// Delete 删除缓存
func (l *LayeredCacheService) Delete(key string) error {
	l.l1.Delete(key)
	return l.l2.Delete(key)
}

// Exists 检查缓存是否存在
func (l *LayeredCacheService) Exists(key string) bool {
	return l.l1.Exists(key) || l.l2.Exists(key)
}

// Clear 清空缓存
func (l *LayeredCacheService) Clear() error {
	l.l1.Clear()
	return l.l2.Clear()
}

// GetTTL 获取缓存TTL
func (l *LayeredCacheService) GetTTL(key string) time.Duration {
	if l.l1.Exists(key) {
		return l.l1.GetTTL(key)
	}
	return l.l2.GetTTL(key)
}

// Increment 递增
func (l *LayeredCacheService) Increment(key string, value int64) (int64, error) {
	// 只在二级缓存中递增，保证一致性
	result, err := l.l2.Increment(key, value)
	if err == nil {
		// 删除一级缓存中的旧值
		l.l1.Delete(key)
	}
	return result, err
}

// Decrement 递减
func (l *LayeredCacheService) Decrement(key string, value int64) (int64, error) {
	return l.Increment(key, -value)
}

// CacheManager 缓存管理器
type CacheManager struct {
	services map[string]CacheService
	default_ CacheService
}

// NewCacheManager 创建缓存管理器
func NewCacheManager(defaultService CacheService) *CacheManager {
	return &CacheManager{
		services: make(map[string]CacheService),
		default_: defaultService,
	}
}

// Register 注册缓存服务
func (c *CacheManager) Register(name string, service CacheService) {
	c.services[name] = service
}

// Get 获取缓存服务
func (c *CacheManager) Get(name string) CacheService {
	if service, exists := c.services[name]; exists {
		return service
	}
	return c.default_
}

// Default 获取默认缓存服务
func (c *CacheManager) Default() CacheService {
	return c.default_
}

// 错误定义
var (
	ErrCacheNotFound = fmt.Errorf("cache not found")
)

// 缓存键生成器
type KeyGenerator struct {
	prefix string
}

// NewKeyGenerator 创建键生成器
func NewKeyGenerator(prefix string) *KeyGenerator {
	return &KeyGenerator{prefix: prefix}
}

// UserKey 生成用户缓存键
func (k *KeyGenerator) UserKey(userID string) string {
	return fmt.Sprintf("%s:user:%s", k.prefix, userID)
}

// TokenKey 生成Token缓存键
func (k *KeyGenerator) TokenKey(userID string) string {
	return fmt.Sprintf("%s:token:%s", k.prefix, userID)
}

// TaskKey 生成任务缓存键
func (k *KeyGenerator) TaskKey(taskID string) string {
	return fmt.Sprintf("%s:task:%s", k.prefix, taskID)
}

// SiteRankKey 生成网站排名缓存键
func (k *KeyGenerator) SiteRankKey(domain string) string {
	return fmt.Sprintf("%s:siterank:%s", k.prefix, domain)
}

// SessionKey 生成会话缓存键
func (k *KeyGenerator) SessionKey(sessionID string) string {
	return fmt.Sprintf("%s:session:%s", k.prefix, sessionID)
}

// RateLimitKey 生成限流缓存键
func (k *KeyGenerator) RateLimitKey(identifier string) string {
	return fmt.Sprintf("%s:ratelimit:%s", k.prefix, identifier)
}
