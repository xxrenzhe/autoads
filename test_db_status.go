package main

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"os"
	"time"

	_ "github.com/go-sql-driver/mysql"
	"github.com/redis/go-redis/v9"
	"gopkg.in/yaml.v3"
)

type Config struct {
	DB struct {
		Host     string `yaml:"host"`
		Port     int    `yaml:"port"`
		Username string `yaml:"username"`
		Password string `yaml:"password"`
		Database string `yaml:"database"`
		Pool     struct {
			MaxIdle     int `yaml:"max_idle"`
			MaxOpen     int `yaml:"max_open"`
			MaxLifetime int `yaml:"max_lifetime"`
		} `yaml:"pool"`
	} `yaml:"database"`
	
	Redis struct {
		Enable   bool   `yaml:"enable"`
		Host     string `yaml:"host"`
		Port     int    `yaml:"port"`
		Password string `yaml:"password"`
		DB       int    `yaml:"db"`
	} `yaml:"redis"`
}

func main() {
	// 1. 加载配置
	configPath := "gofly_admin_v3/config.yaml"
	if _, err := os.Stat(configPath); os.IsNotExist(err) {
		log.Fatalf("配置文件不存在: %s", configPath)
	}

	configData, err := os.ReadFile(configPath)
	if err != nil {
		log.Fatalf("读取配置文件失败: %v", err)
	}

	var config Config
	if err := yaml.Unmarshal(configData, &config); err != nil {
		log.Fatalf("解析配置文件失败: %v", err)
	}

	fmt.Printf("✅ 配置加载成功\n")
	fmt.Printf("数据库: %s:%d/%s\n", config.DB.Host, config.DB.Port, config.DB.Database)

	// 2. 测试数据库连接
	dbDSN := fmt.Sprintf("%s:%s@tcp(%s:%d)/%s?charset=utf8mb4&parseTime=True&loc=Local",
		config.DB.Username,
		config.DB.Password,
		config.DB.Host,
		config.DB.Port,
		config.DB.Database,
	)

	db, err := sql.Open("mysql", dbDSN)
	if err != nil {
		log.Fatalf("连接数据库失败: %v", err)
	}
	defer db.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := db.PingContext(ctx); err != nil {
		log.Fatalf("数据库 Ping 失败: %v", err)
	}

	fmt.Println("✅ 数据库连接成功")

	// 3. 测试数据库表
	tables := []string{
		"users",
		"admin_accounts", 
		"rate_limit_configs",
		"token_balances",
		"token_transactions",
		"batchgo_tasks",
		"siterank_queries",
	}

	fmt.Println("\n检查数据库表:")
	for _, table := range tables {
		var exists bool
		err := db.QueryRowContext(ctx, 
			"SELECT COUNT(*) > 0 FROM information_schema.tables WHERE table_schema = ? AND table_name = ?",
			config.DB.Database, table).Scan(&exists)
		
		if err != nil {
			log.Printf("检查表 %s 失败: %v", table, err)
			continue
		}

		if exists {
			// 获取记录数
			var count int
			db.QueryRowContext(ctx, fmt.Sprintf("SELECT COUNT(*) FROM %s", table)).Scan(&count)
			fmt.Printf("  ✅ %s (%d 条记录)\n", table, count)
		} else {
			fmt.Printf("  ❌ %s (不存在)\n", table)
		}
	}

	// 4. 测试 Redis 连接
	if config.Redis.Enable {
		redisClient := redis.NewClient(&redis.Options{
			Addr:     fmt.Sprintf("%s:%d", config.Redis.Host, config.Redis.Port),
			Password: config.Redis.Password,
			DB:       config.Redis.DB,
		})

		redisCtx, redisCancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer redisCancel()

		if err := redisClient.Ping(redisCtx).Err(); err != nil {
			log.Printf("Redis 连接失败: %v", err)
		} else {
			fmt.Println("\n✅ Redis 连接成功")
		}
	}

	// 5. 检查速率限制配置
	fmt.Println("\n检查速率限制配置:")
	var rlCount int
	err = db.QueryRowContext(ctx, "SELECT COUNT(*) FROM rate_limit_configs WHERE is_active = true").Scan(&rlCount)
	if err != nil {
		log.Printf("查询速率限制配置失败: %v", err)
	} else {
		fmt.Printf("  ✅ 找到 %d 个激活的速率限制配置\n", rlCount)
	}

	// 6. 按套餐统计
	fmt.Println("\n按套餐统计:")
	rows, err := db.QueryContext(ctx, 
		"SELECT plan, COUNT(*) as count FROM rate_limit_configs WHERE is_active = true GROUP BY plan")
	if err != nil {
		log.Printf("查询套餐统计失败: %v", err)
	} else {
		for rows.Next() {
			var plan string
			var count int
			rows.Scan(&plan, &count)
			fmt.Printf("  📦 %s: %d 个配置\n", plan, count)
		}
		rows.Close()
	}

	fmt.Println("\n🎉 自动数据库初始化系统测试完成！")
}