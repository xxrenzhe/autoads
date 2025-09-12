package siterank

import (
	"time"

	"gofly-admin-v3/utils/tools/gcache"
	"gofly-admin-v3/internal/store"
)

// CacheWrapper 缓存包装器
type CacheWrapper struct {
	db    *store.DB
	ttl   time.Duration
	cache gcache.Cache
}

// NewCacheWrapper 创建缓存包装器
func NewCacheWrapper(db *store.DB, ttl time.Duration) *CacheWrapper {
	return &CacheWrapper{
		db:    db,
		ttl:   ttl,
		cache: gcache.New(),
	}
}

// Get 获取缓存
func (cw *CacheWrapper) Get(key string) (interface{}, bool) {
	return cw.cache.Get(key)
}

// Set 设置缓存
func (cw *CacheWrapper) Set(key string, value interface{}) {
	cw.cache.SetWithExpire(key, value, cw.ttl)
}

// Delete 删除缓存
func (cw *CacheWrapper) Delete(key string) {
	cw.cache.Remove(key)
}