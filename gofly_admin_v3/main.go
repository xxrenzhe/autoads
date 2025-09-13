package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	//引入数据库驱动-去这里下载：https://doc.goflys.cn/docview?id=26&fid=395
	// Redis驱动和安装说明：https://doc.goflys.cn/docview?id=26&fid=392
	// "gofly-admin-v3/internal/app" // 暂时未使用
	"gofly-admin-v3/internal/cache"
	"gofly-admin-v3/internal/config"
	"gofly-admin-v3/internal/docs"
	dbinit "gofly-admin-v3/internal/init"
	"gofly-admin-v3/internal/metrics"
	// "gofly-admin-v3/internal/middleware" // 暂时未使用
	_ "gofly-admin-v3/utils/drivers/mysql"
	_ "gofly-admin-v3/utils/drivers/redis"
	"gofly-admin-v3/utils/router"
)

func main() {
	// 解析命令行参数
	var (
		configPath = flag.String("config", "config.yaml", "配置文件路径")
		initDB     = flag.Bool("init-db", false, "是否初始化数据库")
		forceInit  = flag.Bool("force-init", false, "强制初始化数据库（会清空现有数据）")
		version    = flag.Bool("version", false, "显示版本信息")
	)
	flag.Parse()

	if *version {
		fmt.Println("GoFly Admin V3 - Version 3.0.0")
		os.Exit(0)
	}

	// 1. 检查配置文件
	if _, err := os.Stat(*configPath); os.IsNotExist(err) {
		log.Fatalf("配置文件不存在: %s", *configPath)
	}

	// 2. 数据库初始化（如果需要）
	if *initDB || *forceInit {
		log.Println("开始数据库初始化...")

		if *forceInit {
			log.Println("⚠️  警告：强制初始化将清空所有现有数据！")
			fmt.Print("确认继续？(y/N): ")
			var confirm string
			fmt.Scanln(&confirm)
			if confirm != "y" && confirm != "Y" {
				log.Println("初始化已取消")
				os.Exit(0)
			}
		}

		if err := dbinit.AutoInitialize(); err != nil {
			log.Fatalf("数据库初始化失败: %v", err)
		}

		log.Println("✅ 数据库初始化完成")
		if *initDB {
			os.Exit(0)
		}
	}

	// 3. 初始化配置管理器
	configManager := config.GetConfigManager()

	// 加载配置
	if err := configManager.LoadConfig(*configPath); err != nil {
		log.Fatalf("加载配置失败: %v", err)
	}

	// 添加配置变更回调
	configManager.AddCallback(func(cfg *config.Config) {
		log.Printf("配置重新加载: %s", time.Now().Format(time.RFC3339))
		// 这里可以添加更多配置变更处理逻辑
	})

	log.Println("✅ 配置加载成功")

	// 4. 初始化缓存
	if err := cache.InitCache(); err != nil {
		log.Printf("警告：Redis 缓存初始化失败，使用内存缓存: %v", err)
	} else {
		log.Println("✅ 缓存初始化成功")
	}

	// 5. 初始化监控和指标收集
	metrics.InitializeDefaultChecks()
	log.Println("✅ 监控系统初始化成功")

	// 6. 初始化GoFly高级功能 (需要build标签)
	// dbinit.InitGoFlyFeatures() // 暂时禁用，需要autoads_init_advanced build标签

	// 7. 初始化API文档系统
	if err := docs.GenerateAPIDocs(); err != nil {
		log.Printf("警告：API 文档生成失败: %v", err)
	} else {
		log.Println("✅ API 文档系统初始化成功")
	}

	// 启用API文档自动收集中间件
	// middleware.EnableAPIDoc() // 暂时禁用，函数不存在

	// 8. 启动服务器
	log.Println("🚀 启动服务器...")
	router.RunServer()

	// 9. 等待中断信号
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("正在关闭服务器...")

	// 优雅关闭
	_, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// 关闭配置管理器
	configManager.Close()

	log.Println("✅ 服务器已关闭")
}
