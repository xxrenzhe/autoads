package store

import (
	"fmt"
	"time"

	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// DatabaseConfig 数据库配置
type DatabaseConfig struct {
	Host        string
	Port        int
	Username    string
	Password    string
	Database    string
	Charset     string
	MaxIdle     int
	MaxOpen     int
	MaxLifetime int // 添加连接最大生命周期（秒）
}

// RedisConfig Redis配置
type RedisConfig struct {
	Address  string
	Password string
	DB       int
	PoolSize int
}

// JWTConfig JWT配置
type JWTConfig struct {
	Secret string
	Expire int
}

// DB 数据库连接
type DB struct {
	*gorm.DB
}

// RedisInfo Redis连接信息
type RedisInfo struct {
	Address  string
	Password string
	DB       int
}

// NewDB 创建数据库连接
func NewDB(config DatabaseConfig) (*DB, error) {
	dsn := fmt.Sprintf("%s:%s@tcp(%s:%d)/%s?charset=%s&parseTime=True&loc=Local",
		config.Username,
		config.Password,
		config.Host,
		config.Port,
		config.Database,
		config.Charset,
	)

	db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{
		Logger:      logger.Default.LogMode(logger.Silent),
		PrepareStmt: true,
	})

	if err != nil {
		return nil, fmt.Errorf("failed to connect database: %w", err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		return nil, fmt.Errorf("failed to get sqlDB: %w", err)
	}

	// 配置连接池
	sqlDB.SetMaxIdleConns(config.MaxIdle)
	sqlDB.SetMaxOpenConns(config.MaxOpen)
	sqlDB.SetConnMaxLifetime(time.Hour)

	return &DB{DB: db}, nil
}

// NewRedisInfo 创建Redis连接信息
func NewRedisInfo(config RedisConfig) (*RedisInfo, error) {
	// TODO: 实现Redis连接
	return &RedisInfo{
		Address:  config.Address,
		Password: config.Password,
		DB:       config.DB,
	}, nil
}
