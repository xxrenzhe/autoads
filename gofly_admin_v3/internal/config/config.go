package config

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/fsnotify/fsnotify"
	"gopkg.in/yaml.v2"
)

// Config 配置结构体
type Config struct {
	DB         DatabaseConfig   `yaml:"database"`
	App        AppConfig        `yaml:"app"`
	JWT        JWTConfig        `yaml:"jwt"`
	Log        LogConfig        `yaml:"log"`
	Redis      RedisConfig      `yaml:"redis"`
	Cache      CacheConfig      `yaml:"cache"`
	HTTP       HTTPConfig       `yaml:"http"`
	RateLimit  RateLimitConfig  `yaml:"rate_limit"`
	Proxy      ProxyConfig      `yaml:"proxy"`
	APIs       APIsConfig       `yaml:"apis"`
	Upload     UploadConfig     `yaml:"upload"`
	TaskQueue  TaskQueueConfig  `yaml:"task_queue"`
	SimilarWeb SimilarWebConfig `yaml:"similarweb"`
}

// DatabaseConfig 数据库配置
type DatabaseConfig struct {
	Type     string `yaml:"type"`
	Host     string `yaml:"host"`
	Port     int    `yaml:"port"`
	Username string `yaml:"username"`
	Password string `yaml:"password"`
	Database string `yaml:"database"`
	Charset  string `yaml:"charset"`
	Timezone string `yaml:"timezone"`
	Pool     struct {
		MaxIdle     int `yaml:"max_idle"`
		MaxOpen     int `yaml:"max_open"`
		MaxLifetime int `yaml:"max_lifetime"`
	} `yaml:"pool"`
}

// AppConfig 应用配置
type AppConfig struct {
	Name    string `yaml:"name"`
	Debug   bool   `yaml:"debug"`
	Port    int    `yaml:"port"`
	Version string `yaml:"version"`
}

// JWTConfig JWT配置
type JWTConfig struct {
	Secret           string `yaml:"secret"`
	ExpiresIn        int    `yaml:"expires_in"`
	RefreshExpiresIn int    `yaml:"refresh_expires_in"`
}

// LogConfig 日志配置
type LogConfig struct {
	Level  string `yaml:"level"`
	Format string `yaml:"format"`
	Output string `yaml:"output"`
	File   struct {
		MaxSize    int  `yaml:"max_size"`
		MaxBackups int  `yaml:"max_backups"`
		MaxAge     int  `yaml:"max_age"`
		Compress   bool `yaml:"compress"`
	} `yaml:"file"`
}

// RedisConfig Redis配置
type RedisConfig struct {
	Enable   bool   `yaml:"enable"`
	Host     string `yaml:"host"`
	Port     int    `yaml:"port"`
	Password string `yaml:"password"`
	DB       int    `yaml:"db"`
	PoolSize int    `yaml:"pool_size"`
	Prefix   string `yaml:"prefix"`
}

// CacheConfig 缓存配置
type CacheConfig struct {
	DefaultExpire int    `yaml:"default_expire"`
	MemorySize    int    `yaml:"memory_size"`
	RedisPrefix   string `yaml:"redis_prefix"`
}

// HTTPConfig HTTP客户端配置
type HTTPConfig struct {
	Timeout             int `yaml:"timeout"`
	MaxIdleConns        int `yaml:"max_idle_conns"`
	MaxIdleConnsPerHost int `yaml:"max_idle_conns_per_host"`
	IdleConnTimeout     int `yaml:"idle_conn_timeout"`
}

// RateLimitConfig 速率限制配置
type RateLimitConfig struct {
	Enabled           bool `yaml:"enabled"`
	RequestsPerMinute int  `yaml:"requests_per_minute"`
	Burst             int  `yaml:"burst"`
}

// ProxyConfig 代理配置
type ProxyConfig struct {
	Enabled          bool `yaml:"enabled"`
	PoolSize         int  `yaml:"pool_size"`
	Timeout          int  `yaml:"timeout"`
	ValidateInterval int  `yaml:"validate_interval"`
}

// APIsConfig 第三方API配置
type APIsConfig struct {
	SimilarWeb struct {
		APIKey    string `yaml:"api_key"`
		BaseURL   string `yaml:"base_url"`
		RateLimit int    `yaml:"rate_limit"`
	} `yaml:"similarweb"`
	GoogleAds struct {
		DeveloperToken string `yaml:"developer_token"`
		ClientID       string `yaml:"client_id"`
		ClientSecret   string `yaml:"client_secret"`
		RedirectURI    string `yaml:"redirect_uri"`
	} `yaml:"google_ads"`
}

// UploadConfig 文件上传配置
type UploadConfig struct {
	MaxSize      int      `yaml:"max_size"`
	AllowedTypes []string `yaml:"allowed_types"`
	Path         string   `yaml:"path"`
}

// TaskQueueConfig 任务队列配置
type TaskQueueConfig struct {
	WorkerCount   int `yaml:"worker_count"`
	QueueSize     int `yaml:"queue_size"`
	RetryTimes    int `yaml:"retry_times"`
	RetryInterval int `yaml:"retry_interval"`
}

// SimilarWebConfig SimilarWeb配置
type SimilarWebConfig struct {
	APIURL    string `yaml:"api_url"`
	RateLimit struct {
		GlobalPerMinute int `yaml:"global_per_minute"`
		GlobalPerHour   int `yaml:"global_per_hour"`
		UserPerMinute   int `yaml:"user_per_minute"`
		UserPerHour     int `yaml:"user_per_hour"`
		Retry           struct {
			MaxAttempts   int     `yaml:"max_attempts"`
			InitialDelay  int     `yaml:"initial_delay"`
			MaxDelay      int     `yaml:"max_delay"`
			BackoffFactor float64 `yaml:"backoff_factor"`
		} `yaml:"retry"`
	} `yaml:"rate_limit"`
}

// ConfigManager 配置管理器
type ConfigManager struct {
	config     *Config
	configPath string
	mutex      sync.RWMutex
	watcher    *fsnotify.Watcher
	callbacks  []func(*Config)
}

var (
	instance *ConfigManager
	once     sync.Once
)

// GetConfigManager 获取配置管理器单例
func GetConfigManager() *ConfigManager {
	once.Do(func() {
		instance = &ConfigManager{}
	})
	return instance
}

// LoadConfig 加载配置文件
func (cm *ConfigManager) LoadConfig(configPath string) error {
	cm.mutex.Lock()
	defer cm.mutex.Unlock()

	cm.configPath = configPath

	// 读取配置文件
	data, err := os.ReadFile(configPath)
	if err != nil {
		return fmt.Errorf("failed to read config file: %v", err)
	}

	// 解析YAML
	config := &Config{}
	if err := yaml.Unmarshal(data, config); err != nil {
		return fmt.Errorf("failed to parse config file: %v", err)
	}

	// Note: Configuration validation is temporarily disabled

	cm.config = config

	// 启动文件监控
	if err := cm.startWatcher(); err != nil {
		log.Printf("Failed to start config watcher: %v", err)
	}

	return nil
}

// GetConfig 获取当前配置
func (cm *ConfigManager) GetConfig() *Config {
	cm.mutex.RLock()
	defer cm.mutex.RUnlock()
	return cm.config
}

// ReloadConfig 重新加载配置
func (cm *ConfigManager) ReloadConfig() error {
	return cm.LoadConfig(cm.configPath)
}

// AddCallback 添加配置变更回调
func (cm *ConfigManager) AddCallback(callback func(*Config)) {
	cm.mutex.Lock()
	defer cm.mutex.Unlock()
	cm.callbacks = append(cm.callbacks, callback)
}

// startWatcher 启动文件监控
func (cm *ConfigManager) startWatcher() error {
	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		return err
	}

	cm.watcher = watcher

	// 监控配置文件所在目录
	configDir := filepath.Dir(cm.configPath)
	if err := watcher.Add(configDir); err != nil {
		return err
	}

	// 启动监听协程
	go cm.watchConfig()

	return nil
}

// watchConfig 监控配置文件变更
func (cm *ConfigManager) watchConfig() {
	for {
		select {
		case event, ok := <-cm.watcher.Events:
			if !ok {
				return
			}

			// 只处理配置文件的修改事件
			if event.Op&fsnotify.Write == fsnotify.Write && event.Name == cm.configPath {
				log.Printf("Config file modified: %s", event.Name)

				// 防抖：等待文件写入完成
				time.Sleep(500 * time.Millisecond)

				// 重新加载配置
				if err := cm.ReloadConfig(); err != nil {
					log.Printf("Failed to reload config: %v", err)
					continue
				}

				// 执行回调函数
				cm.executeCallbacks()
			}

		case err, ok := <-cm.watcher.Errors:
			if !ok {
				return
			}
			log.Printf("Config watcher error: %v", err)
		}
	}
}

// executeCallbacks 执行配置变更回调
func (cm *ConfigManager) executeCallbacks() {
	cm.mutex.RLock()
	config := cm.config
	callbacks := make([]func(*Config), len(cm.callbacks))
	copy(callbacks, cm.callbacks)
	cm.mutex.RUnlock()

	for _, callback := range callbacks {
		go callback(config)
	}
}

// Close 关闭配置管理器
func (cm *ConfigManager) Close() {
	if cm.watcher != nil {
		cm.watcher.Close()
	}
}

// GetDatabaseConfig 获取数据库配置
func (cm *ConfigManager) GetDatabaseConfig() DatabaseConfig {
	cm.mutex.RLock()
	defer cm.mutex.RUnlock()
	return cm.config.DB
}

// GetAppConfig 获取应用配置
func (cm *ConfigManager) GetAppConfig() AppConfig {
	cm.mutex.RLock()
	defer cm.mutex.RUnlock()
	return cm.config.App
}

// GetJWTConfig 获取JWT配置
func (cm *ConfigManager) GetJWTConfig() JWTConfig {
	cm.mutex.RLock()
	defer cm.mutex.RUnlock()
	return cm.config.JWT
}

// GetLogConfig 获取日志配置
func (cm *ConfigManager) GetLogConfig() LogConfig {
	cm.mutex.RLock()
	defer cm.mutex.RUnlock()
	return cm.config.Log
}

// GetRedisConfig 获取Redis配置
func (cm *ConfigManager) GetRedisConfig() RedisConfig {
	cm.mutex.RLock()
	defer cm.mutex.RUnlock()
	return cm.config.Redis
}

// GetCacheConfig 获取缓存配置
func (cm *ConfigManager) GetCacheConfig() CacheConfig {
	cm.mutex.RLock()
	defer cm.mutex.RUnlock()
	return cm.config.Cache
}

// GetHTTPConfig 获取HTTP配置
func (cm *ConfigManager) GetHTTPConfig() HTTPConfig {
	cm.mutex.RLock()
	defer cm.mutex.RUnlock()
	return cm.config.HTTP
}

// GetRateLimitConfig 获取速率限制配置
func (cm *ConfigManager) GetRateLimitConfig() RateLimitConfig {
	cm.mutex.RLock()
	defer cm.mutex.RUnlock()
	return cm.config.RateLimit
}

// GetProxyConfig 获取代理配置
func (cm *ConfigManager) GetProxyConfig() ProxyConfig {
	cm.mutex.RLock()
	defer cm.mutex.RUnlock()
	return cm.config.Proxy
}

// GetAPIsConfig 获取API配置
func (cm *ConfigManager) GetAPIsConfig() APIsConfig {
	cm.mutex.RLock()
	defer cm.mutex.RUnlock()
	return cm.config.APIs
}

// GetUploadConfig 获取上传配置
func (cm *ConfigManager) GetUploadConfig() UploadConfig {
	cm.mutex.RLock()
	defer cm.mutex.RUnlock()
	return cm.config.Upload
}

// GetTaskQueueConfig 获取任务队列配置
func (cm *ConfigManager) GetTaskQueueConfig() TaskQueueConfig {
	cm.mutex.RLock()
	defer cm.mutex.RUnlock()
	return cm.config.TaskQueue
}

// GetSimilarWebConfig 获取SimilarWeb配置
func (cm *ConfigManager) GetSimilarWebConfig() SimilarWebConfig {
	cm.mutex.RLock()
	defer cm.mutex.RUnlock()
	return cm.config.SimilarWeb
}
