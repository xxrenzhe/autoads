package app

import (
	"fmt"
	"log"

	"github.com/spf13/viper"
	"gofly-admin-v3/internal/store"
)

// Config 应用配置
type Config struct {
	Database store.DatabaseConfig `mapstructure:"database"`
	Redis    store.RedisConfig    `mapstructure:"redis"`
	App      AppConfig            `mapstructure:"app"`
	JWT      JWTConfig            `mapstructure:"jwt"`
	OAuth    OAuthConfig          `mapstructure:"oauth"`
}

// AppConfig 应用配置
type AppConfig struct {
	Port        int    `mapstructure:"port"`
	APISecret   string `mapstructure:"apisecret"`
	TokenSecret string `mapstructure:"tokensecret"`
	TokenExpire int    `mapstructure:"tokenouttime"`
	RunEnv      string `mapstructure:"runEnv"`
}

// JWTConfig JWT配置
type JWTConfig struct {
	Secret string `mapstructure:"tokensecret"`
	Expire int    `mapstructure:"tokenouttime"`
}

// OAuthConfig OAuth配置
type OAuthConfig struct {
	Google GoogleOAuthConfig `mapstructure:"google"`
}

// GoogleOAuthConfig Google OAuth配置
type GoogleOAuthConfig struct {
	ClientID     string   `mapstructure:"client_id"`
	ClientSecret string   `mapstructure:"client_secret"`
	RedirectURL  string   `mapstructure:"redirect_url"`
	Scopes       []string `mapstructure:"scopes"`
}

// LoadConfig 加载配置文件
func LoadConfig(configPath string) (*Config, error) {
	viper.SetConfigFile(configPath)
	viper.AutomaticEnv()

	if err := viper.ReadInConfig(); err != nil {
		return nil, fmt.Errorf("failed to read config file: %w", err)
	}

	var config Config
	if err := viper.Unmarshal(&config); err != nil {
		return nil, fmt.Errorf("failed to unmarshal config: %w", err)
	}

	log.Printf("配置加载成功，运行环境: %s", config.App.RunEnv)
	return &config, nil
}
