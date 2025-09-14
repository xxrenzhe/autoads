package config

import (
    "fmt"
    "os"
    "path/filepath"
    "net/url"
    "strconv"
    "strings"
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

    // 如果还是找不到，尝试从环境变量构建配置
    if _, err := os.Stat(configPath); os.IsNotExist(err) {
        return LoadFromEnv()
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

// LoadFromEnv 基于环境变量构建配置（用于容器/无配置文件场景）
// 支持变量：
// - DATABASE_URL: mysql://user:pass@host:port/dbname 或 mysql://user:pass@host:port （需 DB_DATABASE 或默认 autoads）
// - REDIS_URL: redis://[:password]@host:port[/db]
// - AUTH_SECRET 或 JWT_SECRET: JWT 密钥
// - PORT: 应用端口（默认 8080）
func LoadFromEnv() (*Config, error) {
    c := &Config{}

    // App
    port := 8080
    if v := os.Getenv("PORT"); v != "" {
        if p, err := strconv.Atoi(v); err == nil { port = p }
    }
    c.App.Port = port
    c.App.Name = os.Getenv("APP_NAME")
    if c.App.Name == "" { c.App.Name = "autoads-v3" }
    c.App.Version = os.Getenv("APP_VERSION")
    if c.App.Version == "" { c.App.Version = "3.0.0" }

    // DB
    if err := fillDBFromEnv(&c.DB); err != nil { return nil, err }

    // Redis
    if err := fillRedisFromEnv(&c.Redis); err != nil { return nil, err }

    // JWT
    secret := os.Getenv("AUTH_SECRET")
    if secret == "" { secret = os.Getenv("JWT_SECRET") }
    if secret == "" { secret = "autoads-saas-secret-key" }
    c.JWT.Secret = secret
    if c.JWT.ExpiresIn == 0 { c.JWT.ExpiresIn = 7200 }
    if c.JWT.RefreshExpiresIn == 0 { c.JWT.RefreshExpiresIn = 604800 }

    // 其他默认
    if err := validateAndFillDefaults(c); err != nil { return nil, err }
    return c, nil
}

func fillDBFromEnv(db *DatabaseConfig) error {
    if db == nil { return nil }
    db.Type = "mysql"
    dsn := os.Getenv("DATABASE_URL")
    if dsn != "" {
        u, err := url.Parse(dsn)
        if err == nil {
            if u.Hostname() != "" { db.Host = u.Hostname() }
            if u.Port() != "" { if p, e := strconv.Atoi(u.Port()); e==nil { db.Port = p } }
            if u.User != nil {
                if name := u.User.Username(); name != "" { db.Username = name }
                if pw, ok := u.User.Password(); ok { db.Password = pw }
            }
            // path 可能包含 /dbname
            if u.Path != "" && u.Path != "/" { db.Database = strings.TrimPrefix(u.Path, "/") }
        }
    }
    if db.Database == "" {
        // 兼容 DB_DATABASE
        db.Database = os.Getenv("DB_DATABASE")
        if db.Database == "" { db.Database = "autoads" }
    }
    if db.Host == "" { db.Host = os.Getenv("DB_HOST") }
    if db.Port == 0 {
        if v := os.Getenv("DB_PORT"); v != "" { if p, e := strconv.Atoi(v); e==nil { db.Port = p } }
        if db.Port == 0 { db.Port = 3306 }
    }
    if db.Username == "" { db.Username = os.Getenv("DB_USERNAME") }
    if db.Password == "" { db.Password = os.Getenv("DB_PASSWORD") }
    if db.Charset == "" { db.Charset = "utf8mb4" }
    if db.Timezone == "" { db.Timezone = "Local" }
    return nil
}

func fillRedisFromEnv(r *RedisConfig) error {
    if r == nil { return nil }
    r.Enable = true
    urlStr := os.Getenv("REDIS_URL")
    if urlStr != "" {
        if u, err := url.Parse(urlStr); err == nil {
            if u.Hostname() != "" { r.Host = u.Hostname() }
            if u.Port() != "" { if p, e := strconv.Atoi(u.Port()); e==nil { r.Port = p } }
            if u.User != nil { if pw, ok := u.User.Password(); ok { r.Password = pw } }
            if u.Path != "" && u.Path != "/" {
                if p, e := strconv.Atoi(strings.TrimPrefix(u.Path, "/")); e==nil { r.DB = p }
            }
        }
    }
    if r.Host == "" { r.Host = os.Getenv("REDIS_HOST") }
    if r.Port == 0 {
        if v := os.Getenv("REDIS_PORT"); v != "" { if p, e := strconv.Atoi(v); e==nil { r.Port = p } }
        if r.Port == 0 { r.Port = 6379 }
    }
    if r.Password == "" { r.Password = os.Getenv("REDIS_PASSWORD") }
    if r.DB == 0 {
        if v := os.Getenv("REDIS_DB"); v != "" { if d, e := strconv.Atoi(v); e==nil { r.DB = d } }
    }
    if r.PoolSize == 0 { r.PoolSize = 100 }
    if r.Prefix == "" { r.Prefix = "autoads:" }
    return nil
}
