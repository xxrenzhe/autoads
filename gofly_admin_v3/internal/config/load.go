package config

import (
	"fmt"
	"os"
	"path/filepath"
)

// Load 加载配置文件
func Load() (*Config, error) {
	// 查找配置文件
	configPath := "config.yaml"
	if _, err := os.Stat(configPath); os.IsNotExist(err) {
		// 尝试其他路径
		paths := []string{
			"configs/config.yaml",
			"etc/config.yaml",
			"/etc/autoads/config.yaml",
		}

		for _, path := range paths {
			if _, err := os.Stat(path); err == nil {
				configPath = path
				break
			}
		}
	}

	// 如果还是找不到，返回错误
	if _, err := os.Stat(configPath); os.IsNotExist(err) {
		return nil, fmt.Errorf("配置文件不存在: %s", configPath)
	}

	// 绝对路径
	absPath, err := filepath.Abs(configPath)
	if err != nil {
		return nil, fmt.Errorf("获取配置文件绝对路径失败: %w", err)
	}

	// 使用配置管理器加载
	cm := &ConfigManager{}
	if err := cm.LoadConfig(absPath); err != nil {
		return nil, fmt.Errorf("加载配置失败: %w", err)
	}

	return cm.GetConfig(), nil
}

// LoadFromPath 从指定路径加载配置
func LoadFromPath(path string) (*Config, error) {
	absPath, err := filepath.Abs(path)
	if err != nil {
		return nil, fmt.Errorf("获取配置文件绝对路径失败: %w", err)
	}

	cm := &ConfigManager{}
	if err := cm.LoadConfig(absPath); err != nil {
		return nil, fmt.Errorf("加载配置失败: %w", err)
	}

	return cm.GetConfig(), nil
}
