package config

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"path/filepath"
	"sync"
	"time"

	"github.com/fsnotify/fsnotify"
	"gofly-admin-v3/utils/tools/glog"
)

// HotReloadConfig 热更新配置管理器
type HotReloadConfig struct {
	configPath       string
	rateLimitUpdater RateLimitConfigUpdater
	watcher          *fsnotify.Watcher
	mu               sync.RWMutex
	callbacks        map[string][]func(interface{})
	stopChan         chan struct{}
}

// RateLimitConfigUpdater 速率限制配置更新器接口
type RateLimitConfigUpdater interface {
	UpdatePlanLimit(plan string, limit interface{}) error
}

// NewHotReloadConfig 创建热更新配置管理器
func NewHotReloadConfig(configPath string, updater RateLimitConfigUpdater) (*HotReloadConfig, error) {
	hrc := &HotReloadConfig{
		configPath:       configPath,
		rateLimitUpdater: updater,
		callbacks:        make(map[string][]func(interface{})),
		stopChan:         make(chan struct{}),
	}

	// 初始化文件监听器
	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		return nil, fmt.Errorf("failed to create file watcher: %v", err)
	}
	hrc.watcher = watcher

	// 监听配置文件目录
	configDir := filepath.Dir(configPath)
	if err := watcher.Add(configDir); err != nil {
		return nil, fmt.Errorf("failed to watch config directory: %v", err)
	}

	// 启动监听协程
	go hrc.watchConfigChanges()

	return hrc, nil
}

// watchConfigChanges 监听配置文件变化
func (hrc *HotReloadConfig) watchConfigChanges() {
	for {
		select {
		case event, ok := <-hrc.watcher.Events:
			if !ok {
				return
			}

			// 检查是否是目标配置文件
			if event.Op&fsnotify.Write == fsnotify.Write ||
				event.Op&fsnotify.Create == fsnotify.Create {

				if filepath.Base(event.Name) == filepath.Base(hrc.configPath) {
					glog.Info(nil, "config_file_modified", map[string]interface{}{
						"file": event.Name,
					})

					// 重新加载配置
					if err := hrc.reloadConfig(); err != nil {
						glog.Error(nil, "config_reload_failed", map[string]interface{}{
							"error": err.Error(),
						})
					}
				}
			}

		case err, ok := <-hrc.watcher.Errors:
			if !ok {
				return
			}
			glog.Error(nil, "config_watcher_error", map[string]interface{}{
				"error": err.Error(),
			})

		case <-hrc.stopChan:
			return
		}
	}
}

// reloadConfig 重新加载配置
func (hrc *HotReloadConfig) reloadConfig() error {
	// 读取配置文件
	data, err := ioutil.ReadFile(hrc.configPath)
	if err != nil {
		return fmt.Errorf("failed to read config file: %v", err)
	}

	// 解析配置
	var config map[string]interface{}
	if err := json.Unmarshal(data, &config); err != nil {
		return fmt.Errorf("failed to parse config: %v", err)
	}

	// 更新速率限制配置
	if rateLimitConfig, ok := config["rate_limits"].(map[string]interface{}); ok {
		if err := hrc.updateRateLimitConfig(rateLimitConfig); err != nil {
			glog.Error(nil, "rate_limit_config_update_failed", map[string]interface{}{
				"error": err.Error(),
			})
		}
	}

	// 触发回调函数
	hrc.mu.RLock()
	defer hrc.mu.RUnlock()

	for configType, callbacks := range hrc.callbacks {
		if configValue, exists := config[configType]; exists {
			for _, callback := range callbacks {
				go callback(configValue)
			}
		}
	}

	return nil
}

// updateRateLimitConfig 更新速率限制配置
func (hrc *HotReloadConfig) updateRateLimitConfig(config map[string]interface{}) error {
	// 解析套餐限制配置
	if planLimits, ok := config["plans"].(map[string]interface{}); ok {
		for plan, limit := range planLimits {
			if hrc.rateLimitUpdater != nil {
				// 更新配置
				if err := hrc.rateLimitUpdater.UpdatePlanLimit(plan, limit); err != nil {
					return err
				}

				glog.Info(nil, "rate_limit_plan_updated", map[string]interface{}{
					"plan":   plan,
					"limits": limit,
				})
			}
		}
	}

	return nil
}

// RegisterCallback 注册配置变更回调
func (hrc *HotReloadConfig) RegisterCallback(configType string, callback func(interface{})) {
	hrc.mu.Lock()
	defer hrc.mu.Unlock()

	hrc.callbacks[configType] = append(hrc.callbacks[configType], callback)
}

// Close 关闭热更新管理器
func (hrc *HotReloadConfig) Close() error {
	close(hrc.stopChan)
	return hrc.watcher.Close()
}

// ConfigChangeBroadcaster 配置变更广播器
type ConfigChangeBroadcaster struct {
	subscribers map[string]chan ConfigChangeEvent
	mu          sync.RWMutex
}

// ConfigChangeEvent 配置变更事件
type ConfigChangeEvent struct {
	Type      string      `json:"type"`
	Key       string      `json:"key"`
	OldValue  interface{} `json:"old_value,omitempty"`
	NewValue  interface{} `json:"new_value"`
	Timestamp time.Time   `json:"timestamp"`
}

// NewConfigChangeBroadcaster 创建配置变更广播器
func NewConfigChangeBroadcaster() *ConfigChangeBroadcaster {
	return &ConfigChangeBroadcaster{
		subscribers: make(map[string]chan ConfigChangeEvent),
	}
}

// Subscribe 订阅配置变更事件
func (b *ConfigChangeBroadcaster) Subscribe(subscriberID string) <-chan ConfigChangeEvent {
	b.mu.Lock()
	defer b.mu.Unlock()

	ch := make(chan ConfigChangeEvent, 100)
	b.subscribers[subscriberID] = ch

	return ch
}

// Unsubscribe 取消订阅
func (b *ConfigChangeBroadcaster) Unsubscribe(subscriberID string) {
	b.mu.Lock()
	defer b.mu.Unlock()

	if ch, exists := b.subscribers[subscriberID]; exists {
		close(ch)
		delete(b.subscribers, subscriberID)
	}
}

// Broadcast 广播配置变更事件
func (b *ConfigChangeBroadcaster) Broadcast(event ConfigChangeEvent) {
	b.mu.RLock()
	defer b.mu.RUnlock()

	for _, ch := range b.subscribers {
		select {
		case ch <- event:
		default:
			// 通道已满，跳过
		}
	}
}
