package main

import (
	"flag"
	"fmt"
	"log"
	"os"
	"path/filepath"

	"gofly_admin_v3/internal/config"
	dbinit "gofly_admin_v3/internal/init"
)

func main() {
	// 解析命令行参数
	var (
		configPath = flag.String("config", "gofly_admin_v3/config.yaml", "配置文件路径")
		initDB     = flag.Bool("init-db", false, "是否初始化数据库")
		forceInit  = flag.Bool("force-init", false, "强制初始化数据库（会清空现有数据）")
		version    = flag.Bool("version", false, "显示版本信息")
	)
	flag.Parse()

	if *version {
		fmt.Println("GoFly Admin V3 - Version 3.0.0")
		os.Exit(0)
	}

	// 检查配置文件
	if _, err := os.Stat(*configPath); os.IsNotExist(err) {
		log.Fatalf("配置文件不存在: %s", *configPath)
	}

	// 获取绝对路径
	absPath, err := filepath.Abs(*configPath)
	if err != nil {
		log.Fatalf("获取配置文件路径失败: %v", err)
	}

	fmt.Printf("使用配置文件: %s\n", absPath)

	// 数据库初始化（如果需要）
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

		// 执行初始化
		if err := dbinit.AutoInitialize(); err != nil {
			log.Fatalf("数据库初始化失败: %v", err)
		}

		log.Println("✅ 数据库初始化完成")
		if *initDB {
			os.Exit(0)
		}
	} else {
		log.Println("提示: 使用 -init-db 参数来初始化数据库")
		log.Println("提示: 使用 -force-init 参数来强制重新初始化数据库")
	}
}