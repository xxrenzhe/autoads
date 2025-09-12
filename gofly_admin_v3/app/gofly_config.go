package app

import (
	"fmt"
	"log"

	"github.com/spf13/viper"
)

// Config GoFly应用配置
type Config struct {
	Env    string         `mapstructure:"env"`
	Server ServerConfig   `mapstructure:"server"`
	DB     DatabaseConfig `mapstructure:"database"`
	Redis  RedisConfig    `mapstructure:"redis"`
	Log    *LogConfig     `mapstructure:"log"`
	Cache  *CacheConfig   `mapstructure:"cache"`
	JWT    JWTConfig      `mapstructure:"jwt"`
	OAuth  OAuthConfig    `mapstructure:"oauth"`
	Token  TokenConfig    `mapstructure:"token"`
}

// ServerConfig 服务器配置
type ServerConfig struct {
	Host              string `mapstructure:"host"`
	Port              int    `mapstructure:"port"`
	ReadTimeout       int    `mapstructure:"read_timeout"`
	WriteTimeout      int    `mapstructure:"write_timeout"`
	MaxHeaderBytes    int    `mapstructure:"max_header_bytes"`
	RateLimit         int    `mapstructure:"rate_limit"`
	CORSAllowedOrigin string `mapstructure:"cors_allowed_origin"`
}

// DatabaseConfig 数据库配置
type DatabaseConfig struct {
	Host         string `mapstructure:"host"`
	Port         int    `mapstructure:"port"`
	User         string `mapstructure:"user"`
	Password     string `mapstructure:"password"`
	DBName       string `mapstructure:"dbname"`
	Charset      string `mapstructure:"charset"`
	ParseTime    bool   `mapstructure:"parse_time"`
	Loc          string `mapstructure:"loc"`
	MaxIdleConns int    `mapstructure:"max_idle_conns"`
	MaxOpenConns int    `mapstructure:"max_open_conns"`
	MaxLifetime  int    `mapstructure:"max_lifetime"`
}

// RedisConfig Redis配置
type RedisConfig struct {
	Host     string `mapstructure:"host"`
	Port     int    `mapstructure:"port"`
	Password string `mapstructure:"password"`
	DB       int    `mapstructure:"db"`
	PoolSize int    `mapstructure:"pool_size"`
}

// LogConfig 日志配置
type LogConfig struct {
	Level  string `mapstructure:"level"`
	Format string `mapstructure:"format"`
	Output string `mapstructure:"output"`
}

// CacheConfig 缓存配置
type CacheConfig struct {
	Driver   string `mapstructure:"driver"`
	Expire   int    `mapstructure:"expire"`
	Prefix   string `mapstructure:"prefix"`
	Compress bool   `mapstructure:"compress"`
}

// JWTConfig JWT配置
type JWTConfig struct {
	Secret        string `mapstructure:"secret"`
	Expire        int    `mapstructure:"expire"`
	RefreshExpire int    `mapstructure:"refresh_expire"`
}

// OAuthConfig OAuth配置
type OAuthConfig struct {
	Google GoogleOAuthConfig `mapstructure:"google"`
	Meta   MetaOAuthConfig   `mapstructure:"meta"`
}

// GoogleOAuthConfig Google OAuth配置
type GoogleOAuthConfig struct {
	ClientID     string   `mapstructure:"client_id"`
	ClientSecret string   `mapstructure:"client_secret"`
	RedirectURL  string   `mapstructure:"redirect_url"`
	Scopes       []string `mapstructure:"scopes"`
}

// MetaOAuthConfig Meta OAuth配置
type MetaOAuthConfig struct {
	ClientID     string   `mapstructure:"client_id"`
	ClientSecret string   `mapstructure:"client_secret"`
	RedirectURL  string   `mapstructure:"redirect_url"`
	Scopes       []string `mapstructure:"scopes"`
}

// TokenConfig Token配置
type TokenConfig struct {
	FreeUserInitial   int64 `mapstructure:"free_user_initial"`
	PaidUserInitial   int64 `mapstructure:"paid_user_initial"`
	BatchGoBaseCost   int64 `mapstructure:"batchgo_base_cost"`
	SiteRankBaseCost  int64 `mapstructure:"siterank_base_cost"`
	AdsCenterBaseCost int64 `mapstructure:"adscenter_base_cost"`
}

// LoadGoFlyConfig 加载GoFly配置文件
func LoadGoFlyConfig(configPath string) (*Config, error) {
	viper.SetConfigFile(configPath)
	viper.AutomaticEnv()

	// 设置默认值
	setDefaultConfig()

	if err := viper.ReadInConfig(); err != nil {
		return nil, fmt.Errorf("failed to read config file: %w", err)
	}

	var config Config
	if err := viper.Unmarshal(&config); err != nil {
		return nil, fmt.Errorf("failed to unmarshal config: %w", err)
	}

	log.Printf("GoFly配置加载成功，运行环境: %s", config.Env)
	return &config, nil
}

// setDefaultConfig 设置默认配置
func setDefaultConfig() {
	// 服务器默认配置
	viper.SetDefault("server.host", "0.0.0.0")
	viper.SetDefault("server.port", 8080)
	viper.SetDefault("server.read_timeout", 60)
	viper.SetDefault("server.write_timeout", 60)
	viper.SetDefault("server.max_header_bytes", 1<<20)
	viper.SetDefault("server.rate_limit", 100)
	viper.SetDefault("server.cors_allowed_origin", "*")

	// 数据库默认配置
	viper.SetDefault("database.host", "localhost")
	viper.SetDefault("database.port", 3306)
	viper.SetDefault("database.user", "root")
	viper.SetDefault("database.charset", "utf8mb4")
	viper.SetDefault("database.parse_time", true)
	viper.SetDefault("database.loc", "Local")
	viper.SetDefault("database.max_idle_conns", 10)
	viper.SetDefault("database.max_open_conns", 100)
	viper.SetDefault("database.max_lifetime", 3600)

	// Redis默认配置
	viper.SetDefault("redis.host", "localhost")
	viper.SetDefault("redis.port", 6379)
	viper.SetDefault("redis.db", 0)
	viper.SetDefault("redis.pool_size", 10)

	// 日志默认配置
	viper.SetDefault("log.level", "info")
	viper.SetDefault("log.format", "json")
	viper.SetDefault("log.output", "stdout")

	// 缓存默认配置
	viper.SetDefault("cache.driver", "memory")
	viper.SetDefault("cache.expire", 3600)
	viper.SetDefault("cache.prefix", "gofly:")
	viper.SetDefault("cache.compress", false)

	// JWT默认配置
	viper.SetDefault("jwt.secret", "gofly-jwt-secret")
	viper.SetDefault("jwt.expire", 7200)
	viper.SetDefault("jwt.refresh_expire", 604800)

	// Token默认配置
	viper.SetDefault("token.free_user_initial", 1000)
	viper.SetDefault("token.paid_user_initial", 10000)
	viper.SetDefault("token.batchgo_base_cost", 10)
	viper.SetDefault("token.siterank_base_cost", 50)
	viper.SetDefault("token.adscenter_base_cost", 100)

	// 环境默认值
	viper.SetDefault("env", "development")
}
