package config

import (
	"context"
)

// ConfigProvider 配置提供者接口
type ConfigProvider interface {
	GetRateLimitConfig(ctx context.Context) (map[string]interface{}, error)
	GetDatabaseConfig() map[string]interface{}
}
