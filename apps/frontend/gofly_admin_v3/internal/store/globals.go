package store

import "gorm.io/gorm"

// 全局默认实例，便于在内部包中访问（例如定时任务）
var (
    defaultRedis  *Redis
    defaultGormDB *gorm.DB
)

// SetDefaultRedis 设置全局 Redis 实例
func SetDefaultRedis(r *Redis) {
    defaultRedis = r
}

// GetRedis 获取全局 Redis 实例（可能返回 nil）
func GetRedis() *Redis {
    return defaultRedis
}

// SetDefaultGormDB 设置全局 GORM DB 实例
func SetDefaultGormDB(db *gorm.DB) {
    defaultGormDB = db
}

// GetGormDB 获取全局 GORM DB 实例（可能返回 nil）
func GetGormDB() *gorm.DB {
    return defaultGormDB
}

