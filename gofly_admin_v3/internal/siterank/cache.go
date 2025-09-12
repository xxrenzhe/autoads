package siterank

import (
	"time"

	"gofly-admin-v3/internal/store"
	"gofly-admin-v3/utils/tools/gcache"
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
		db:  db,
		ttl: ttl,
		// TODO: 初始化GoFly缓存
	}
}

// Get 获取缓存
func (cw *CacheWrapper) Get(key string) (interface{}, bool) {
	// TODO: 实现GoFly缓存获取
	return nil, false
}

// Set 设置缓存
func (cw *CacheWrapper) Set(key string, value interface{}) {
	// TODO: 实现GoFly缓存设置
}

// Delete 删除缓存
func (cw *CacheWrapper) Delete(key string) {
	// TODO: 实现GoFly缓存删除
}
