package cache

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
	"gofly-admin-v3/internal/config"
	"gofly-admin-v3/utils/gf"
)

// Cache 缓存接口
type Cache interface {
	// 基本操作
	Get(key string, dest interface{}) error
	Set(key string, value interface{}, expiration time.Duration) error
	Delete(key string) error
	Exists(key string) (bool, error)

	// 高级操作
	GetOrSet(key string, valueFunc func() (interface{}, error), expiration time.Duration, dest interface{}) error
	DeletePattern(pattern string) error

	// 列表操作
	LPush(key string, values ...interface{}) error
	RPush(key string, values ...interface{}) error
	LRange(key string, start, stop int64) ([]string, error)
	LLen(key string) (int64, error)

	// 哈希操作
	HSet(key string, values map[string]interface{}) error
	HGet(key, field string, dest interface{}) error
	HGetAll(key string) (map[string]string, error)
	HDelete(key string, fields ...string) error

	// 集合操作
	SAdd(key string, members ...interface{}) error
	SMembers(key string) ([]string, error)
	SRem(key string, members ...interface{}) error

	// 过期时间
	Expire(key string, expiration time.Duration) error
	TTL(key string) (time.Duration, error)

	// 关闭连接
	Close() error
}

// RedisCache Redis缓存实现
type RedisCache struct {
	client *redis.Client
}

// NewRedisCache 创建Redis缓存实例
func NewRedisCache() (*RedisCache, error) {
	// 获取配置
	configManager := config.GetConfigManager()
	redisConfig := configManager.GetRedisConfig()

	// 创建Redis客户端
	client := redis.NewClient(&redis.Options{
		Addr:     fmt.Sprintf("%s:%d", redisConfig.Host, redisConfig.Port),
		Password: redisConfig.Password,
		DB:       redisConfig.DB,
		PoolSize: redisConfig.PoolSize,
	})

	// 测试连接
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := client.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("failed to connect to Redis: %v", err)
	}

	return &RedisCache{client: client}, nil
}

// Get 获取缓存值
func (r *RedisCache) Get(key string, dest interface{}) error {
	ctx := context.Background()

	val, err := r.client.Get(ctx, key).Result()
	if err != nil {
		if err == redis.Nil {
			return fmt.Errorf("key not found: %s", key)
		}
		return err
	}

	// 如果是字符串类型，直接赋值
	if s, ok := dest.(*string); ok {
		*s = val
		return nil
	}

	// 其他类型，使用JSON解析
	return json.Unmarshal([]byte(val), dest)
}

// Set 设置缓存值
func (r *RedisCache) Set(key string, value interface{}, expiration time.Duration) error {
	ctx := context.Background()

	// 将值转换为JSON
	var val string
	switch v := value.(type) {
	case string:
		val = v
	case []byte:
		val = string(v)
	default:
		data, err := json.Marshal(value)
		if err != nil {
			return err
		}
		val = string(data)
	}

	return r.client.Set(ctx, key, val, expiration).Err()
}

// Delete 删除缓存
func (r *RedisCache) Delete(key string) error {
	ctx := context.Background()
	return r.client.Del(ctx, key).Err()
}

// Exists 检查key是否存在
func (r *RedisCache) Exists(key string) (bool, error) {
	ctx := context.Background()
	n, err := r.client.Exists(ctx, key).Result()
	return n > 0, err
}

// GetOrSet 获取或设置缓存（如果不存在）
func (r *RedisCache) GetOrSet(key string, valueFunc func() (interface{}, error), expiration time.Duration, dest interface{}) error {
	// 尝试获取缓存
	if err := r.Get(key, dest); err == nil {
		return nil
	}

	// 缓存不存在，调用函数获取值
	value, err := valueFunc()
	if err != nil {
		return err
	}

	// 设置缓存
	if err := r.Set(key, value, expiration); err != nil {
		gf.Log().Warning(context.Background(), fmt.Sprintf("Failed to set cache for key %s: %v", key, err))
	}

	// 将值赋给目标
	switch v := value.(type) {
	case string:
		if s, ok := dest.(*string); ok {
			*s = v
		}
	default:
		data, err := json.Marshal(value)
		if err == nil {
			json.Unmarshal(data, dest)
		}
	}

	return nil
}

// DeletePattern 删除匹配模式的key
func (r *RedisCache) DeletePattern(pattern string) error {
	ctx := context.Background()
	keys, err := r.client.Keys(ctx, pattern).Result()
	if err != nil {
		return err
	}

	if len(keys) > 0 {
		return r.client.Del(ctx, keys...).Err()
	}

	return nil
}

// LPush 左推入列表
func (r *RedisCache) LPush(key string, values ...interface{}) error {
	ctx := context.Background()
	return r.client.LPush(ctx, key, values...).Err()
}

// RPush 右推入列表
func (r *RedisCache) RPush(key string, values ...interface{}) error {
	ctx := context.Background()
	return r.client.RPush(ctx, key, values...).Err()
}

// LRange 获取列表范围
func (r *RedisCache) LRange(key string, start, stop int64) ([]string, error) {
	ctx := context.Background()
	return r.client.LRange(ctx, key, start, stop).Result()
}

// LLen 获取列表长度
func (r *RedisCache) LLen(key string) (int64, error) {
	ctx := context.Background()
	return r.client.LLen(ctx, key).Result()
}

// HSet 设置哈希值
func (r *RedisCache) HSet(key string, values map[string]interface{}) error {
	ctx := context.Background()
	return r.client.HSet(ctx, key, values).Err()
}

// HGet 获取哈希字段值
func (r *RedisCache) HGet(key, field string, dest interface{}) error {
	ctx := context.Background()

	val, err := r.client.HGet(ctx, key, field).Result()
	if err != nil {
		if err == redis.Nil {
			return fmt.Errorf("field not found: %s.%s", key, field)
		}
		return err
	}

	// 如果是字符串类型，直接赋值
	if s, ok := dest.(*string); ok {
		*s = val
		return nil
	}

	// 其他类型，使用JSON解析
	return json.Unmarshal([]byte(val), dest)
}

// HGetAll 获取所有哈希字段
func (r *RedisCache) HGetAll(key string) (map[string]string, error) {
	ctx := context.Background()
	return r.client.HGetAll(ctx, key).Result()
}

// HDelete 删除哈希字段
func (r *RedisCache) HDelete(key string, fields ...string) error {
	ctx := context.Background()
	return r.client.HDel(ctx, key, fields...).Err()
}

// SAdd 添加到集合
func (r *RedisCache) SAdd(key string, members ...interface{}) error {
	ctx := context.Background()
	return r.client.SAdd(ctx, key, members...).Err()
}

// SMembers 获取集合成员
func (r *RedisCache) SMembers(key string) ([]string, error) {
	ctx := context.Background()
	return r.client.SMembers(ctx, key).Result()
}

// SRem 从集合中删除
func (r *RedisCache) SRem(key string, members ...interface{}) error {
	ctx := context.Background()
	return r.client.SRem(ctx, key, members...).Err()
}

// Expire 设置过期时间
func (r *RedisCache) Expire(key string, expiration time.Duration) error {
	ctx := context.Background()
	return r.client.Expire(ctx, key, expiration).Err()
}

// TTL 获取剩余时间
func (r *RedisCache) TTL(key string) (time.Duration, error) {
	ctx := context.Background()
	return r.client.TTL(ctx, key).Result()
}

// Close 关闭连接
func (r *RedisCache) Close() error {
	return r.client.Close()
}

// 全局缓存实例
var (
	defaultCache Cache
	cacheInit    bool
)

// InitCache 初始化缓存
func InitCache() error {
	if cacheInit {
		return nil
	}

	cache, err := NewRedisCache()
	if err != nil {
		return err
	}

	defaultCache = cache
	cacheInit = true
	return nil
}

// GetCache 获取缓存实例
func GetCache() Cache {
	if !cacheInit {
		// 如果未初始化，尝试初始化
		if err := InitCache(); err != nil {
			// 如果Redis不可用，返回内存缓存
			return NewMemoryCache()
		}
	}
	return defaultCache
}

// MemoryCache 内存缓存实现（作为后备）
type MemoryCache struct {
	store map[string]memoryItem
	mutex sync.RWMutex
}

type memoryItem struct {
	value      interface{}
	expiration int64
}

// NewMemoryCache 创建内存缓存
func NewMemoryCache() *MemoryCache {
	return &MemoryCache{
		store: make(map[string]memoryItem),
	}
}

// Get 获取内存缓存
func (m *MemoryCache) Get(key string, dest interface{}) error {
	m.mutex.RLock()
	defer m.mutex.RUnlock()

	item, exists := m.store[key]
	if !exists {
		return fmt.Errorf("key not found: %s", key)
	}

	// 检查是否过期
	if item.expiration > 0 && time.Now().UnixNano() > item.expiration {
		return fmt.Errorf("key expired: %s", key)
	}

	// 将值赋给目标
	switch v := item.value.(type) {
	case string:
		if s, ok := dest.(*string); ok {
			*s = v
		}
	default:
		data, err := json.Marshal(item.value)
		if err == nil {
			json.Unmarshal(data, dest)
		}
	}

	return nil
}

// Set 设置内存缓存
func (m *MemoryCache) Set(key string, value interface{}, expiration time.Duration) error {
	m.mutex.Lock()
	defer m.mutex.Unlock()

	var exp int64
	if expiration > 0 {
		exp = time.Now().Add(expiration).UnixNano()
	}

	m.store[key] = memoryItem{
		value:      value,
		expiration: exp,
	}

	return nil
}

// Delete 删除内存缓存
func (m *MemoryCache) Delete(key string) error {
	m.mutex.Lock()
	defer m.mutex.Unlock()

	delete(m.store, key)
	return nil
}

// Exists 检查key是否存在
func (m *MemoryCache) Exists(key string) (bool, error) {
	m.mutex.RLock()
	defer m.mutex.RUnlock()

	item, exists := m.store[key]
	if !exists {
		return false, nil
	}

	// 检查是否过期
	if item.expiration > 0 && time.Now().UnixNano() > item.expiration {
		return false, nil
	}

	return true, nil
}

// 其他方法的基本实现...
func (m *MemoryCache) GetOrSet(key string, valueFunc func() (interface{}, error), expiration time.Duration, dest interface{}) error {
	if err := m.Get(key, dest); err == nil {
		return nil
	}

	value, err := valueFunc()
	if err != nil {
		return err
	}

	m.Set(key, value, expiration)

	switch v := value.(type) {
	case string:
		if s, ok := dest.(*string); ok {
			*s = v
		}
	default:
		data, _ := json.Marshal(value)
		json.Unmarshal(data, dest)
	}

	return nil
}

func (m *MemoryCache) DeletePattern(pattern string) error {
	// 内存缓存不支持模式删除
	return nil
}

func (m *MemoryCache) LPush(key string, values ...interface{}) error {
	// 简化实现
	return fmt.Errorf("not implemented")
}

func (m *MemoryCache) RPush(key string, values ...interface{}) error {
	return fmt.Errorf("not implemented")
}

func (m *MemoryCache) LRange(key string, start, stop int64) ([]string, error) {
	return nil, fmt.Errorf("not implemented")
}

func (m *MemoryCache) LLen(key string) (int64, error) {
	return 0, fmt.Errorf("not implemented")
}

func (m *MemoryCache) HSet(key string, values map[string]interface{}) error {
	return fmt.Errorf("not implemented")
}

func (m *MemoryCache) HGet(key, field string, dest interface{}) error {
	return fmt.Errorf("not implemented")
}

func (m *MemoryCache) HGetAll(key string) (map[string]string, error) {
	return nil, fmt.Errorf("not implemented")
}

func (m *MemoryCache) HDelete(key string, fields ...string) error {
	return fmt.Errorf("not implemented")
}

func (m *MemoryCache) SAdd(key string, members ...interface{}) error {
	return fmt.Errorf("not implemented")
}

func (m *MemoryCache) SMembers(key string) ([]string, error) {
	return nil, fmt.Errorf("not implemented")
}

func (m *MemoryCache) SRem(key string, members ...interface{}) error {
	return fmt.Errorf("not implemented")
}

func (m *MemoryCache) Expire(key string, expiration time.Duration) error {
	return fmt.Errorf("not implemented")
}

func (m *MemoryCache) TTL(key string) (time.Duration, error) {
	return 0, fmt.Errorf("not implemented")
}

func (m *MemoryCache) Close() error {
	return nil
}
