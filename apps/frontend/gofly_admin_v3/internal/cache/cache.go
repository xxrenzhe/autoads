package cache

import (
    "context"
    "encoding/json"
    "fmt"
    "strings"
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

// simple singleflight to avoid cache stampede
type flightGroup struct {
    mu sync.Mutex
    m  map[string]*flight
}
type flight struct {
    wg  sync.WaitGroup
    val interface{}
    err error
}
var sf = &flightGroup{m: make(map[string]*flight)}

func (g *flightGroup) Do(key string, fn func() (interface{}, error)) (interface{}, error) {
    g.mu.Lock()
    if f, ok := g.m[key]; ok {
        g.mu.Unlock()
        f.wg.Wait()
        return f.val, f.err
    }
    f := &flight{}
    f.wg.Add(1)
    g.m[key] = f
    g.mu.Unlock()
    f.val, f.err = fn()
    f.wg.Done()
    g.mu.Lock()
    delete(g.m, key)
    g.mu.Unlock()
    return f.val, f.err
}

// default timeout for external store operations
const redisOpTimeout = 2 * time.Second
func ctxWithTimeout() (context.Context, context.CancelFunc) { return context.WithTimeout(context.Background(), redisOpTimeout) }

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
    var val string
    var err error
    for attempt := 0; attempt < 3; attempt++ {
        ctx, cancel := ctxWithTimeout()
        val, err = r.client.Get(ctx, key).Result()
        cancel()
        if err == nil || err == redis.Nil { break }
        time.Sleep(time.Duration(25*(attempt+1)) * time.Millisecond)
    }
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

    var last error
    for attempt := 0; attempt < 3; attempt++ {
        ctx, cancel := ctxWithTimeout()
        last = r.client.Set(ctx, key, val, expiration).Err()
        cancel()
        if last == nil { return nil }
        time.Sleep(time.Duration(25*(attempt+1)) * time.Millisecond)
    }
    return last
}

// Delete 删除缓存
func (r *RedisCache) Delete(key string) error {
    var last error
    for attempt := 0; attempt < 3; attempt++ {
        ctx, cancel := ctxWithTimeout()
        last = r.client.Del(ctx, key).Err()
        cancel()
        if last == nil { return nil }
        time.Sleep(time.Duration(25*(attempt+1)) * time.Millisecond)
    }
    return last
}

// Exists 检查key是否存在
func (r *RedisCache) Exists(key string) (bool, error) {
    var n int64
    var err error
    for attempt := 0; attempt < 3; attempt++ {
        ctx, cancel := ctxWithTimeout()
        n, err = r.client.Exists(ctx, key).Result()
        cancel()
        if err == nil { break }
        time.Sleep(time.Duration(25*(attempt+1)) * time.Millisecond)
    }
    return n > 0, err
}

// GetOrSet 获取或设置缓存（如果不存在）
func (r *RedisCache) GetOrSet(key string, valueFunc func() (interface{}, error), expiration time.Duration, dest interface{}) error {
    // 尝试获取缓存
    if err := r.Get(key, dest); err == nil {
        return nil
    }

    // 通过 singleflight 防击穿
    val, err := sf.Do(key, func() (interface{}, error) {
        v, e := valueFunc()
        if e != nil {
            return nil, e
        }
        // 写入缓存（best effort）
        if err := r.Set(key, v, expiration); err != nil {
            gf.Log().Warning(context.Background(), fmt.Sprintf("Failed to set cache for key %s: %v", key, err))
        }
        return v, nil
    })
    if err != nil {
        return err
    }

    // 复制值到目标
    switch v := val.(type) {
    case string:
        if s, ok := dest.(*string); ok { *s = v }
    default:
        data, e := json.Marshal(val)
        if e == nil { _ = json.Unmarshal(data, dest) }
    }
    return nil
}

// DeletePattern 删除匹配模式的key
func (r *RedisCache) DeletePattern(pattern string) error {
    // Use SCAN to avoid blocking Redis with KEYS on large datasets
    ctx, cancel := ctxWithTimeout()
    defer cancel()
    var toDelete []string
    iter := r.client.Scan(ctx, 0, pattern, 500).Iterator()
    for iter.Next(ctx) {
        toDelete = append(toDelete, iter.Val())
        if len(toDelete) >= 1000 {
            if err := r.client.Del(ctx, toDelete...).Err(); err != nil {
                return err
            }
            toDelete = toDelete[:0]
        }
    }
    if err := iter.Err(); err != nil {
        return err
    }
    if len(toDelete) > 0 {
        if err := r.client.Del(ctx, toDelete...).Err(); err != nil {
            return err
        }
    }
    return nil
}

// LPush 左推入列表
func (r *RedisCache) LPush(key string, values ...interface{}) error {
    ctx, cancel := ctxWithTimeout()
    defer cancel()
    return r.client.LPush(ctx, key, values...).Err()
}

// RPush 右推入列表
func (r *RedisCache) RPush(key string, values ...interface{}) error {
    ctx, cancel := ctxWithTimeout()
    defer cancel()
    return r.client.RPush(ctx, key, values...).Err()
}

// LRange 获取列表范围
func (r *RedisCache) LRange(key string, start, stop int64) ([]string, error) {
    ctx, cancel := ctxWithTimeout()
    defer cancel()
    return r.client.LRange(ctx, key, start, stop).Result()
}

// LLen 获取列表长度
func (r *RedisCache) LLen(key string) (int64, error) {
    ctx, cancel := ctxWithTimeout()
    defer cancel()
    return r.client.LLen(ctx, key).Result()
}

// HSet 设置哈希值
func (r *RedisCache) HSet(key string, values map[string]interface{}) error {
    ctx, cancel := ctxWithTimeout()
    defer cancel()
    return r.client.HSet(ctx, key, values).Err()
}

// HGet 获取哈希字段值
func (r *RedisCache) HGet(key, field string, dest interface{}) error {
    var val string
    var err error
    for attempt := 0; attempt < 3; attempt++ {
        ctx, cancel := ctxWithTimeout()
        val, err = r.client.HGet(ctx, key, field).Result()
        cancel()
        if err == nil || err == redis.Nil { break }
        time.Sleep(time.Duration(25*(attempt+1)) * time.Millisecond)
    }
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
    var out map[string]string
    var err error
    for attempt := 0; attempt < 3; attempt++ {
        ctx, cancel := ctxWithTimeout()
        out, err = r.client.HGetAll(ctx, key).Result()
        cancel()
        if err == nil { break }
        time.Sleep(time.Duration(25*(attempt+1)) * time.Millisecond)
    }
    return out, err
}

// HDelete 删除哈希字段
func (r *RedisCache) HDelete(key string, fields ...string) error {
    ctx, cancel := ctxWithTimeout()
    defer cancel()
    return r.client.HDel(ctx, key, fields...).Err()
}

// SAdd 添加到集合
func (r *RedisCache) SAdd(key string, members ...interface{}) error {
    ctx, cancel := ctxWithTimeout()
    defer cancel()
    return r.client.SAdd(ctx, key, members...).Err()
}

// SMembers 获取集合成员
func (r *RedisCache) SMembers(key string) ([]string, error) {
    ctx, cancel := ctxWithTimeout()
    defer cancel()
    return r.client.SMembers(ctx, key).Result()
}

// SRem 从集合中删除
func (r *RedisCache) SRem(key string, members ...interface{}) error {
    ctx, cancel := ctxWithTimeout()
    defer cancel()
    return r.client.SRem(ctx, key, members...).Err()
}

// Expire 设置过期时间
func (r *RedisCache) Expire(key string, expiration time.Duration) error {
    var last error
    for attempt := 0; attempt < 3; attempt++ {
        ctx, cancel := ctxWithTimeout()
        last = r.client.Expire(ctx, key, expiration).Err()
        cancel()
        if last == nil { return nil }
        time.Sleep(time.Duration(25*(attempt+1)) * time.Millisecond)
    }
    return last
}

// TTL 获取剩余时间
func (r *RedisCache) TTL(key string) (time.Duration, error) {
    var d time.Duration
    var err error
    for attempt := 0; attempt < 3; attempt++ {
        ctx, cancel := ctxWithTimeout()
        d, err = r.client.TTL(ctx, key).Result()
        cancel()
        if err == nil { break }
        time.Sleep(time.Duration(25*(attempt+1)) * time.Millisecond)
    }
    return d, err
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

    val, err := sf.Do(key, func() (interface{}, error) {
        v, e := valueFunc()
        if e != nil { return nil, e }
        _ = m.Set(key, v, expiration)
        return v, nil
    })
    if err != nil { return err }

    switch v := val.(type) {
    case string:
        if s, ok := dest.(*string); ok { *s = v }
    default:
        data, _ := json.Marshal(val)
        _ = json.Unmarshal(data, dest)
    }
    return nil
}

func (m *MemoryCache) DeletePattern(pattern string) error {
    m.mutex.Lock()
    defer m.mutex.Unlock()

    // Support simple prefix patterns like "prefix:*"
    if strings.HasSuffix(pattern, "*") {
        prefix := strings.TrimSuffix(pattern, "*")
        for k := range m.store {
            if strings.HasPrefix(k, prefix) {
                delete(m.store, k)
            }
        }
        return nil
    }
    delete(m.store, pattern)
    return nil
}

func (m *MemoryCache) LPush(key string, values ...interface{}) error {
    m.mutex.Lock()
    defer m.mutex.Unlock()

    item := m.store[key]
    var list []string
    if v, ok := item.value.([]string); ok {
        list = v
    }
    // prepend values in order
    for i := len(values) - 1; i >= 0; i-- {
        list = append([]string{fmt.Sprint(values[i])}, list...)
    }
    m.store[key] = memoryItem{value: list, expiration: item.expiration}
    return nil
}

func (m *MemoryCache) RPush(key string, values ...interface{}) error {
    m.mutex.Lock()
    defer m.mutex.Unlock()

    item := m.store[key]
    var list []string
    if v, ok := item.value.([]string); ok {
        list = v
    }
    for _, val := range values {
        list = append(list, fmt.Sprint(val))
    }
    m.store[key] = memoryItem{value: list, expiration: item.expiration}
    return nil
}

func (m *MemoryCache) LRange(key string, start, stop int64) ([]string, error) {
    m.mutex.RLock()
    defer m.mutex.RUnlock()

    item, ok := m.store[key]
    if !ok {
        return []string{}, nil
    }
    list, ok := item.value.([]string)
    if !ok {
        return []string{}, nil
    }
    n := int64(len(list))
    if start < 0 {
        start = n + start
    }
    if stop < 0 {
        stop = n + stop
    }
    if start < 0 {
        start = 0
    }
    if stop >= n {
        stop = n - 1
    }
    if start > stop || start >= n {
        return []string{}, nil
    }
    return append([]string{}, list[start:stop+1]...), nil
}

func (m *MemoryCache) LLen(key string) (int64, error) {
    m.mutex.RLock()
    defer m.mutex.RUnlock()

    if item, ok := m.store[key]; ok {
        if list, ok := item.value.([]string); ok {
            return int64(len(list)), nil
        }
    }
    return 0, nil
}

func (m *MemoryCache) HSet(key string, values map[string]interface{}) error {
    m.mutex.Lock()
    defer m.mutex.Unlock()

    item := m.store[key]
    var h map[string]string
    if existing, ok := item.value.(map[string]string); ok {
        h = existing
    } else {
        h = make(map[string]string)
    }
    for k, v := range values {
        switch vv := v.(type) {
        case string:
            h[k] = vv
        case []byte:
            h[k] = string(vv)
        default:
            b, _ := json.Marshal(v)
            h[k] = string(b)
        }
    }
    m.store[key] = memoryItem{value: h, expiration: item.expiration}
    return nil
}

func (m *MemoryCache) HGet(key, field string, dest interface{}) error {
    m.mutex.RLock()
    defer m.mutex.RUnlock()

    item, ok := m.store[key]
    if !ok {
        return fmt.Errorf("field not found: %s.%s", key, field)
    }
    h, ok := item.value.(map[string]string)
    if !ok {
        return fmt.Errorf("field not found: %s.%s", key, field)
    }
    val, ok := h[field]
    if !ok {
        return fmt.Errorf("field not found: %s.%s", key, field)
    }
    if s, ok := dest.(*string); ok {
        *s = val
        return nil
    }
    return json.Unmarshal([]byte(val), dest)
}

func (m *MemoryCache) HGetAll(key string) (map[string]string, error) {
    m.mutex.RLock()
    defer m.mutex.RUnlock()

    item, ok := m.store[key]
    if !ok {
        return map[string]string{}, nil
    }
    if h, ok := item.value.(map[string]string); ok {
        out := make(map[string]string, len(h))
        for k, v := range h {
            out[k] = v
        }
        return out, nil
    }
    return map[string]string{}, nil
}

func (m *MemoryCache) HDelete(key string, fields ...string) error {
    m.mutex.Lock()
    defer m.mutex.Unlock()

    item, ok := m.store[key]
    if !ok {
        return nil
    }
    if h, ok := item.value.(map[string]string); ok {
        for _, f := range fields {
            delete(h, f)
        }
        m.store[key] = memoryItem{value: h, expiration: item.expiration}
    }
    return nil
}

func (m *MemoryCache) SAdd(key string, members ...interface{}) error {
    m.mutex.Lock()
    defer m.mutex.Unlock()

    item := m.store[key]
    var set map[string]struct{}
    if v, ok := item.value.(map[string]struct{}); ok {
        set = v
    } else {
        set = make(map[string]struct{})
    }
    for _, mem := range members {
        set[fmt.Sprint(mem)] = struct{}{}
    }
    m.store[key] = memoryItem{value: set, expiration: item.expiration}
    return nil
}

func (m *MemoryCache) SMembers(key string) ([]string, error) {
    m.mutex.RLock()
    defer m.mutex.RUnlock()

    item, ok := m.store[key]
    if !ok {
        return []string{}, nil
    }
    if set, ok := item.value.(map[string]struct{}); ok {
        out := make([]string, 0, len(set))
        for k := range set {
            out = append(out, k)
        }
        return out, nil
    }
    return []string{}, nil
}

func (m *MemoryCache) SRem(key string, members ...interface{}) error {
    m.mutex.Lock()
    defer m.mutex.Unlock()

    item, ok := m.store[key]
    if !ok {
        return nil
    }
    if set, ok := item.value.(map[string]struct{}); ok {
        for _, mem := range members {
            delete(set, fmt.Sprint(mem))
        }
        m.store[key] = memoryItem{value: set, expiration: item.expiration}
    }
    return nil
}

func (m *MemoryCache) Expire(key string, expiration time.Duration) error {
    m.mutex.Lock()
    defer m.mutex.Unlock()

    item, ok := m.store[key]
    if !ok {
        return nil
    }
    var exp int64
    if expiration > 0 {
        exp = time.Now().Add(expiration).UnixNano()
    }
    item.expiration = exp
    m.store[key] = item
    return nil
}

func (m *MemoryCache) TTL(key string) (time.Duration, error) {
    m.mutex.RLock()
    defer m.mutex.RUnlock()

    item, ok := m.store[key]
    if !ok {
        return 0, nil
    }
    if item.expiration == 0 {
        return -1, nil
    }
    d := time.Until(time.Unix(0, item.expiration))
    if d < 0 {
        return 0, nil
    }
    return d, nil
}

func (m *MemoryCache) Close() error {
	return nil
}
