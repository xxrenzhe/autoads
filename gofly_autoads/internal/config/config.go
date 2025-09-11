package config

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/spf13/viper"
)

// Config holds all configuration for the application
type Config struct {
	App      AppConfig
	Server   ServerConfig
	Database DatabaseConfig
	Redis    RedisConfig
	JWT      JWTConfig
	RateLimit RateLimitConfig
}

type AppConfig struct {
	Name    string `mapstructure:"name"`
	Version string `mapstructure:"version"`
	Debug   bool   `mapstructure:"debug"`
}

type ServerConfig struct {
	Port         string `mapstructure:"port"`
	ReadTimeout  int    `mapstructure:"read_timeout"`
	WriteTimeout int    `mapstructure:"write_timeout"`
}

type DatabaseConfig struct {
	DSN             string `mapstructure:"dsn"`
	MaxIdleConns    int    `mapstructure:"max_idle_conns"`
	MaxOpenConns    int    `mapstructure:"max_open_conns"`
	ConnMaxLifetime int    `mapstructure:"conn_max_lifetime"`
}

type RedisConfig struct {
	URL      string `mapstructure:"url"`
	Password string `mapstructure:"password"`
	DB       int    `mapstructure:"db"`
}

type JWTConfig struct {
	Secret     string `mapstructure:"secret"`
	Expiration int    `mapstructure:"expiration"`
}

type RateLimitConfig struct {
	Enabled    bool   `mapstructure:"enabled"`
	Requests   int    `mapstructure:"requests"`
	Duration   string `mapstructure:"duration"`
	RedisURL   string `mapstructure:"redis_url"`
}

// Init initializes the application configuration
func Init() error {
	// Set default values
	viper.SetDefault("app.name", "GoFly-AutoAds")
	viper.SetDefault("app.version", "1.0.0")
	viper.SetDefault("app.debug", false)
	viper.SetDefault("server.port", ":8888")
	viper.SetDefault("server.read_timeout", 30)
	viper.SetDefault("server.write_timeout", 30)
	viper.SetDefault("database.max_idle_conns", 10)
	viper.SetDefault("database.max_open_conns", 100)
	viper.SetDefault("database.conn_max_lifetime", 3600)
	viper.SetDefault("redis.db", 0)
	viper.SetDefault("jwt.expiration", 86400) // 24 hours
	viper.SetDefault("rate_limit.enabled", true)
	viper.SetDefault("rate_limit.requests", 100)
	viper.SetDefault("rate_limit.duration", "1m")

	// Set configuration paths
	viper.SetConfigName("config")
	viper.SetConfigType("yaml")
	viper.AddConfigPath("./configs")
	viper.AddConfigPath("/etc/gofly-autoads")
	viper.AddConfigPath("$HOME/.gofly-autoads")

	// Enable environment variables
	viper.AutomaticEnv()
	viper.SetEnvPrefix("GA")

	// Read environment variables
	if port := os.Getenv("PORT"); port != "" {
		viper.Set("server.port", ":"+port)
	}

	if dbURL := os.Getenv("DATABASE_URL"); dbURL != "" {
		viper.Set("database.dsn", dbURL)
	}

	if redisURL := os.Getenv("REDIS_URL"); redisURL != "" {
		viper.Set("redis.url", redisURL)
		viper.Set("rate_limit.redis_url", redisURL)
	}

	if jwtSecret := os.Getenv("JWT_SECRET"); jwtSecret != "" {
		viper.Set("jwt.secret", jwtSecret)
	}

	// Read configuration file if exists
	if err := viper.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); !ok {
			return fmt.Errorf("error reading config file: %w", err)
		}
		// Config file not found; use defaults and environment variables
	}

	return nil
}

// GetConfig returns the application configuration
func GetConfig() (*Config, error) {
	var config Config
	if err := viper.Unmarshal(&config); err != nil {
		return nil, fmt.Errorf("unable to decode config: %w", err)
	}
	return &config, nil
}

// SaveConfig saves the current configuration to file
func SaveConfig() error {
	configPath := viper.ConfigFileUsed()
	if configPath == "" {
		// Create default config directory
		configDir := filepath.Join(".", "configs")
		if err := os.MkdirAll(configDir, 0755); err != nil {
			return fmt.Errorf("failed to create config directory: %w", err)
		}
		configPath = filepath.Join(configDir, "config.yaml")
	}

	return viper.WriteConfigAs(configPath)
}