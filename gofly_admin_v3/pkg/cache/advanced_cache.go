package cache

import (
	"context"
	"encoding/json"
	"fmt"
	"path/filepath"
	"sync"
	"time"

	"github.com/go-redis/redis/v8"
	"gofly-admin-v3/utils/gform"
	"gofly-admin-v3/utils/tools/glog"
)

// AdvancedCache 高级缓存策略
type AdvancedCache struct {
    redis   *redis.Client
    prefix  string
    ttl     time.Duration
    local   *LocalCache
    metrics *CacheMetrics
    // simple singleflight
    sfMu sync.Mutex
    sfM  map[string]*sfCall
}

// CacheMetrics 缓存统计
type CacheMetrics struct {
	Hits        int64 `json:"hits"`
	Misses      int64 `json:"misses"`
	Errors      int64 `json:"errors"`
	Evictions   int64 `json:"evictions"`
	TotalSize   int64 `json:"total_size"`
	MemoryUsage int64 `json:"memory_usage"`
}

// LocalCache 本地内存缓存
type LocalCache struct {
	data map[string]*cacheItem
	size int
	mu   sync.RWMutex
}

// cacheItem 缓存项
type cacheItem struct {
	value      interface{}
	expiration time.Time
	size       int64
}

// NewAdvancedCache 创建高级缓存
func NewAdvancedCache(redisAddr string, prefix string, defaultTTL time.Duration, localCacheSize int) *AdvancedCache {
	// 创建Redis客户端
	rdb := redis.NewClient(&redis.Options{
		Addr:     redisAddr,
		Password: "", // 无密码
		DB:       0,  // 默认DB
		PoolSize: 100,
	})

	// 测试连接
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := rdb.Ping(ctx).Err(); err != nil {
		glog.Error(ctx, "redis_connection_failed", gform.Map{"error": err})
	}

    return &AdvancedCache{
        redis:   rdb,
        prefix:  prefix,
        ttl:     defaultTTL,
        local:   NewLocalCache(localCacheSize),
        metrics: &CacheMetrics{},
        sfM:     make(map[string]*sfCall),
    }
}

type sfCall struct {
    wg  sync.WaitGroup
    val interface{}
    err error
}
func (c *AdvancedCache) doSF(key string, fn func() (interface{}, error)) (interface{}, error) {
    c.sfMu.Lock()
    if f, ok := c.sfM[key]; ok {
        c.sfMu.Unlock()
        f.wg.Wait()
        return f.val, f.err
    }
    f := &sfCall{}
    f.wg.Add(1)
    c.sfM[key] = f
    c.sfMu.Unlock()
    f.val, f.err = fn()
    f.wg.Done()
    c.sfMu.Lock()
    delete(c.sfM, key)
    c.sfMu.Unlock()
    return f.val, f.err
}

// retry helpers for redis operations
const advRedisOpTimeout = 2 * time.Second

func (c *AdvancedCache) opCtx(ctx context.Context) (context.Context, context.CancelFunc) {
    if ctx == nil {
        return context.WithTimeout(context.Background(), advRedisOpTimeout)
    }
    if _, has := ctx.Deadline(); has {
        return context.WithCancel(ctx)
    }
    return context.WithTimeout(ctx, advRedisOpTimeout)
}

func (c *AdvancedCache) withRetry(ctx context.Context, attempts int, baseSleep time.Duration, fn func(context.Context) error) error {
    var err error
    if attempts <= 0 {
        attempts = 1
    }
    if baseSleep <= 0 {
        baseSleep = 25 * time.Millisecond
    }
    for i := 0; i < attempts; i++ {
        opCtx, cancel := c.opCtx(ctx)
        err = fn(opCtx)
        cancel()
        if err == nil {
            return nil
        }
        time.Sleep(baseSleep * time.Duration(i+1))
    }
    return err
}

func (c *AdvancedCache) withRetryBytes(ctx context.Context, attempts int, baseSleep time.Duration, fn func(context.Context) ([]byte, error)) ([]byte, error) {
    var out []byte
    var err error
    if attempts <= 0 {
        attempts = 1
    }
    if baseSleep <= 0 {
        baseSleep = 25 * time.Millisecond
    }
    for i := 0; i < attempts; i++ {
        opCtx, cancel := c.opCtx(ctx)
        out, err = fn(opCtx)
        cancel()
        if err == nil {
            return out, nil
        }
        time.Sleep(baseSleep * time.Duration(i+1))
    }
    return out, err
}

func (c *AdvancedCache) withRetryInt64(ctx context.Context, attempts int, baseSleep time.Duration, fn func(context.Context) (int64, error)) (int64, error) {
    var out int64
    var err error
    if attempts <= 0 { attempts = 1 }
    if baseSleep <= 0 { baseSleep = 25 * time.Millisecond }
    for i := 0; i < attempts; i++ {
        opCtx, cancel := c.opCtx(ctx)
        out, err = fn(opCtx)
        cancel()
        if err == nil { return out, nil }
        time.Sleep(baseSleep * time.Duration(i+1))
    }
    return out, err
}

func (c *AdvancedCache) withRetryDuration(ctx context.Context, attempts int, baseSleep time.Duration, fn func(context.Context) (time.Duration, error)) (time.Duration, error) {
    var out time.Duration
    var err error
    if attempts <= 0 { attempts = 1 }
    if baseSleep <= 0 { baseSleep = 25 * time.Millisecond }
    for i := 0; i < attempts; i++ {
        opCtx, cancel := c.opCtx(ctx)
        out, err = fn(opCtx)
        cancel()
        if err == nil { return out, nil }
        time.Sleep(baseSleep * time.Duration(i+1))
    }
    return out, err
}

func (c *AdvancedCache) withRetryString(ctx context.Context, attempts int, baseSleep time.Duration, fn func(context.Context) (string, error)) (string, error) {
    var out string
    var err error
    if attempts <= 0 { attempts = 1 }
    if baseSleep <= 0 { baseSleep = 25 * time.Millisecond }
    for i := 0; i < attempts; i++ {
        opCtx, cancel := c.opCtx(ctx)
        out, err = fn(opCtx)
        cancel()
        if err == nil { return out, nil }
        time.Sleep(baseSleep * time.Duration(i+1))
    }
    return out, err
}

// NewLocalCache 创建本地缓存
func NewLocalCache(size int) *LocalCache {
	return &LocalCache{
		data: make(map[string]*cacheItem),
		size: size,
	}
}

// Get 获取缓存值（多级缓存）
func (c *AdvancedCache) Get(ctx context.Context, key string) (interface{}, error) {
	// 1. 先从本地缓存获取
	if value, ok := c.local.Get(key); ok {
		c.metrics.Hits++
		return value, nil
	}

	// 2. 从Redis获取
	fullKey := c.buildKey(key)
    value, err := c.withRetryBytes(ctx, 3, 25*time.Millisecond, func(opCtx context.Context) ([]byte, error) {
        return c.redis.Get(opCtx, fullKey).Bytes()
    })
	if err == redis.Nil {
		c.metrics.Misses++
		return nil, fmt.Errorf("key not found")
	} else if err != nil {
		c.metrics.Errors++
		return nil, fmt.Errorf("redis get failed: %w", err)
	}

	// 3. 反序列化
	var result interface{}
	if err := json.Unmarshal(value, &result); err != nil {
		c.metrics.Errors++
		return nil, fmt.Errorf("unmarshal failed: %w", err)
	}

	// 4. 回填本地缓存
	c.local.Set(key, result, time.Minute) // 本地缓存TTL较短

	c.metrics.Hits++
	return result, nil
}

// Set 设置缓存值
func (c *AdvancedCache) Set(ctx context.Context, key string, value interface{}, ttl time.Duration) error {
	if ttl <= 0 {
		ttl = c.ttl
	}

	// 序列化值
	data, err := json.Marshal(value)
	if err != nil {
		c.metrics.Errors++
		return fmt.Errorf("marshal failed: %w", err)
	}

    // 设置到Redis（重试）
    fullKey := c.buildKey(key)
    if err := c.withRetry(ctx, 3, 25*time.Millisecond, func(opCtx context.Context) error {
        return c.redis.Set(opCtx, fullKey, data, ttl).Err()
    }); err != nil {
        c.metrics.Errors++
        return fmt.Errorf("redis set failed: %w", err)
    }

	// 同时设置到本地缓存
	c.local.Set(key, value, time.Minute)

	return nil
}

// Delete 删除缓存
func (c *AdvancedCache) Delete(ctx context.Context, key string) error {
    fullKey := c.buildKey(key)
    if err := c.withRetry(ctx, 3, 25*time.Millisecond, func(opCtx context.Context) error {
        return c.redis.Del(opCtx, fullKey).Err()
    }); err != nil {
        c.metrics.Errors++
        return fmt.Errorf("redis delete failed: %w", err)
    }

	// 删除本地缓存
	c.local.Delete(key)

	return nil
}

// Exists 检查键是否存在
func (c *AdvancedCache) Exists(ctx context.Context, key string) (bool, error) {
    fullKey := c.buildKey(key)
    count, err := c.withRetryInt64(ctx, 3, 25*time.Millisecond, func(opCtx context.Context) (int64, error) {
        return c.redis.Exists(opCtx, fullKey).Result()
    })
    if err != nil {
        return false, fmt.Errorf("redis exists failed: %w", err)
    }
    return count > 0, nil
}

// TTL 获取键的TTL
func (c *AdvancedCache) TTL(ctx context.Context, key string) (time.Duration, error) {
    fullKey := c.buildKey(key)
    ttl, err := c.withRetryDuration(ctx, 3, 25*time.Millisecond, func(opCtx context.Context) (time.Duration, error) {
        return c.redis.TTL(opCtx, fullKey).Result()
    })
    if err != nil {
        return 0, fmt.Errorf("redis ttl failed: %w", err)
    }
    return ttl, nil
}

// Expire 设置过期时间
func (c *AdvancedCache) Expire(ctx context.Context, key string, ttl time.Duration) error {
    fullKey := c.buildKey(key)
    if err := c.withRetry(ctx, 3, 25*time.Millisecond, func(opCtx context.Context) error {
        return c.redis.Expire(opCtx, fullKey, ttl).Err()
    }); err != nil {
        return fmt.Errorf("redis expire failed: %w", err)
    }
    return nil
}

// Increment 自增
func (c *AdvancedCache) Increment(ctx context.Context, key string, delta int64) (int64, error) {
    fullKey := c.buildKey(key)
    result, err := c.withRetryInt64(ctx, 3, 25*time.Millisecond, func(opCtx context.Context) (int64, error) {
        return c.redis.IncrBy(opCtx, fullKey, delta).Result()
    })
    if err != nil {
        return 0, fmt.Errorf("redis increment failed: %w", err)
    }
    return result, nil
}

// GetOrSet 获取或设置缓存（原子操作）
func (c *AdvancedCache) GetOrSet(ctx context.Context, key string, ttl time.Duration, fn func() (interface{}, error)) (interface{}, error) {
    // 先尝试获取
    if value, err := c.Get(ctx, key); err == nil {
        return value, nil
    }
    // 防击穿
    return c.doSF(c.buildKey(key), func() (interface{}, error) {
        v, err := fn()
        if err != nil { return nil, err }
        if err := c.Set(ctx, key, v, ttl); err != nil {
            glog.Warning(ctx, "cache_set_failed", gform.Map{"key": key, "error": err})
        }
        return v, nil
    })
}

// GetPattern 获取匹配模式的所有键
func (c *AdvancedCache) GetPattern(ctx context.Context, pattern string) ([]string, error) {
    fullPattern := c.buildKey(pattern)
    var out []string
    iter := c.redis.Scan(ctx, 0, fullPattern, 500).Iterator()
    for iter.Next(ctx) {
        k := iter.Val()
        // 移除前缀
        if len(k) >= len(c.prefix) {
            out = append(out, k[len(c.prefix):])
        } else {
            out = append(out, k)
        }
    }
    if err := iter.Err(); err != nil {
        return nil, fmt.Errorf("redis scan failed: %w", err)
    }
    return out, nil
}

// DeletePattern 删除匹配模式的所有键
func (c *AdvancedCache) DeletePattern(ctx context.Context, pattern string) error {
    fullPattern := c.buildKey(pattern)
    var batch []string
    iter := c.redis.Scan(ctx, 0, fullPattern, 500).Iterator()
    for iter.Next(ctx) {
        batch = append(batch, iter.Val())
        if len(batch) >= 1000 {
            if err := c.withRetry(ctx, 3, 25*time.Millisecond, func(opCtx context.Context) error { return c.redis.Del(opCtx, batch...).Err() }); err != nil {
                return fmt.Errorf("redis delete pattern failed: %w", err)
            }
            batch = batch[:0]
        }
    }
    if err := iter.Err(); err != nil {
        return fmt.Errorf("redis scan failed: %w", err)
    }
    if len(batch) > 0 {
        if err := c.withRetry(ctx, 3, 25*time.Millisecond, func(opCtx context.Context) error { return c.redis.Del(opCtx, batch...).Err() }); err != nil {
            return fmt.Errorf("redis delete pattern failed: %w", err)
        }
    }

	// 清理本地缓存
	c.local.DeletePattern(pattern)

	return nil
}

// Pipeline 执行批量操作
func (c *AdvancedCache) Pipeline(ctx context.Context, ops []CacheOperation) error {
	pipe := c.redis.Pipeline()

	for _, op := range ops {
		key := c.buildKey(op.Key)
		switch op.Type {
		case "set":
			data, err := json.Marshal(op.Value)
			if err != nil {
				continue
			}
			pipe.Set(ctx, key, data, op.TTL)
		case "delete":
			pipe.Del(ctx, key)
		case "increment":
			pipe.IncrBy(ctx, key, op.Delta)
		}
	}

    if err := c.withRetry(ctx, 3, 25*time.Millisecond, func(opCtx context.Context) error {
        _, e := pipe.Exec(opCtx)
        return e
    }); err != nil {
        return fmt.Errorf("pipeline exec failed: %w", err)
    }

	return nil
}

// CacheOperation 缓存操作
type CacheOperation struct {
	Type  string        `json:"type"`
	Key   string        `json:"key"`
	Value interface{}   `json:"value,omitempty"`
	TTL   time.Duration `json:"ttl,omitempty"`
	Delta int64         `json:"delta,omitempty"`
}

// GetMetrics 获取缓存统计信息
func (c *AdvancedCache) GetMetrics(ctx context.Context) (*CacheMetrics, error) {
	// 获取Redis统计信息
    _, err := c.withRetryString(ctx, 3, 25*time.Millisecond, func(opCtx context.Context) (string, error) { return c.redis.Info(opCtx, "memory").Result() })
    if err != nil {
        return nil, fmt.Errorf("redis info failed: %w", err)
    }

	// 解析内存使用情况
	metrics := &CacheMetrics{
		Hits:      c.metrics.Hits,
		Misses:    c.metrics.Misses,
		Errors:    c.metrics.Errors,
		Evictions: c.metrics.Evictions,
	}

	// 内存使用信息可通过Redis INFO命令获取

	return metrics, nil
}

// Clear 清空所有缓存
func (c *AdvancedCache) Clear(ctx context.Context) error {
    pattern := c.buildKey("*")
    var batch []string
    iter := c.redis.Scan(ctx, 0, pattern, 500).Iterator()
    for iter.Next(ctx) {
        batch = append(batch, iter.Val())
        if len(batch) >= 1000 {
            if err := c.withRetry(ctx, 3, 25*time.Millisecond, func(opCtx context.Context) error { return c.redis.Del(opCtx, batch...).Err() }); err != nil {
                return fmt.Errorf("redis clear failed: %w", err)
            }
            batch = batch[:0]
        }
    }
    if err := iter.Err(); err != nil {
        return fmt.Errorf("redis scan failed: %w", err)
    }
    if len(batch) > 0 {
        if err := c.withRetry(ctx, 3, 25*time.Millisecond, func(opCtx context.Context) error { return c.redis.Del(opCtx, batch...).Err() }); err != nil {
            return fmt.Errorf("redis clear failed: %w", err)
        }
    }

	// 清空本地缓存
	c.local.Clear()

	return nil
}

// Close 关闭缓存
func (c *AdvancedCache) Close() error {
	return c.redis.Close()
}

// buildKey 构建带前缀的键
func (c *AdvancedCache) buildKey(key string) string {
	return c.prefix + key
}

// LocalCache methods

// Get 从本地缓存获取
func (lc *LocalCache) Get(key string) (interface{}, bool) {
	lc.mu.RLock()
	defer lc.mu.RUnlock()

	item, exists := lc.data[key]
	if !exists {
		return nil, false
	}

	if time.Now().After(item.expiration) {
		// 过期了，删除
		delete(lc.data, key)
		return nil, false
	}

	return item.value, true
}

// Set 设置到本地缓存
func (lc *LocalCache) Set(key string, value interface{}, ttl time.Duration) {
	lc.mu.Lock()
	defer lc.mu.Unlock()

	// 如果缓存已满，删除最老的项
	if len(lc.data) >= lc.size {
		lc.evictOldest()
	}

	lc.data[key] = &cacheItem{
		value:      value,
		expiration: time.Now().Add(ttl),
		size:       1, // 简化处理
	}
}

// Delete 从本地缓存删除
func (lc *LocalCache) Delete(key string) {
	lc.mu.Lock()
	defer lc.mu.Unlock()
	delete(lc.data, key)
}

// DeletePattern 删除匹配模式的键
func (lc *LocalCache) DeletePattern(pattern string) {
	lc.mu.Lock()
	defer lc.mu.Unlock()

	for key := range lc.data {
		if matched, _ := filepath.Match(pattern, key); matched {
			delete(lc.data, key)
		}
	}
}

// Clear 清空本地缓存
func (lc *LocalCache) Clear() {
	lc.mu.Lock()
	defer lc.mu.Unlock()
	lc.data = make(map[string]*cacheItem)
}

// evictOldest 淘汰最老的项
func (lc *LocalCache) evictOldest() {
	var oldestKey string
	var oldestTime time.Time

	for key, item := range lc.data {
		if oldestKey == "" || item.expiration.Before(oldestTime) {
			oldestKey = key
			oldestTime = item.expiration
		}
	}

	if oldestKey != "" {
		delete(lc.data, oldestKey)
	}
}
