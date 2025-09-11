package main

import (
	"database/sql"
	"fmt"
	"log"
	"time"

	_ "github.com/go-sql-driver/mysql"
)

func main() {
	// 数据库配置
	config := struct {
		host     string
		port     int
		username string
		password string
		database string
	}{
		host:     "dbprovider.sg-members-1.clawcloudrun.com",
		port:     30354,
		username: "root",
		password: "jtl85fn8",
		database: "autoads",
	}

	fmt.Println("=== Go 数据库连接测试 ===")
	fmt.Printf("Host: %s\n", config.host)
	fmt.Printf("Port: %d\n", config.port)
	fmt.Printf("Username: %s\n", config.username)
	fmt.Printf("Database: %s\n", config.database)

	// 构建DSN
	dsn := fmt.Sprintf("%s:%s@tcp(%s:%d)/%s?charset=utf8mb4&parseTime=True&loc=Local&timeout=10s",
		config.username,
		config.password,
		config.host,
		config.port,
		config.database,
	)

	// 测试连接
	fmt.Println("\n🔍 测试数据库连接...")
	
	db, err := sql.Open("mysql", dsn)
	if err != nil {
		log.Fatalf("创建数据库连接失败: %v", err)
	}
	defer db.Close()

	// 设置连接池参数
	db.SetMaxOpenConns(10)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(5 * time.Minute)

	// 测试Ping
	err = db.Ping()
	if err != nil {
		fmt.Printf("❌ 数据库连接失败: %v\n", err)
		
		// 尝试不同的诊断方法
		fmt.Println("\n💡 诊断信息:")
		
		// 1. 不指定数据库尝试连接
		dsnNoDB := fmt.Sprintf("%s:%s@tcp(%s:%d)/?charset=utf8mb4&parseTime=True&loc=Local&timeout=10s",
			config.username, config.password, config.host, config.port)
		
		dbNoDB, err := sql.Open("mysql", dsnNoDB)
		if err != nil {
			fmt.Printf("❌ 连接服务器失败: %v\n", err)
			return
		}
		
		err = dbNoDB.Ping()
		dbNoDB.Close()
		
		if err == nil {
			fmt.Println("✅ 数据库服务器连接成功")
			fmt.Println("❌ 但无法连接到指定数据库 'autoads'")
			fmt.Println("   可能的原因:")
			fmt.Println("   - 数据库 'autoads' 不存在")
			fmt.Println("   - 用户 'root' 没有访问该数据库的权限")
		} else {
			fmt.Printf("❌ 数据库服务器连接失败: %v\n", err)
			fmt.Println("   可能的原因:")
			fmt.Println("   - 用户名或密码错误")
			fmt.Println("   - 主机地址或端口错误")
			fmt.Println("   - 网络连接问题")
			fmt.Println("   - 数据库服务器未运行")
		}
		return
	}

	fmt.Println("✅ 数据库连接成功!")

	// 执行查询
	fmt.Println("\n📊 执行查询...")

	// 获取版本
	var version string
	err = db.QueryRow("SELECT VERSION()").Scan(&version)
	if err != nil {
		fmt.Printf("❌ 获取版本失败: %v\n", err)
		return
	}
	fmt.Printf("MySQL 版本: %s\n", version)

	// 获取当前数据库
	var currentDB string
	err = db.QueryRow("SELECT DATABASE()").Scan(&currentDB)
	if err != nil {
		fmt.Printf("❌ 获取当前数据库失败: %v\n", err)
		return
	}
	fmt.Printf("当前数据库: %s\n", currentDB)

	// 检查表
	fmt.Println("\n📋 检查表结构...")
	rows, err := db.Query("SHOW TABLES")
	if err != nil {
		fmt.Printf("❌ 获取表列表失败: %v\n", err)
		return
	}
	defer rows.Close()

	var tables []string
	for rows.Next() {
		var table string
		err := rows.Scan(&table)
		if err != nil {
			fmt.Printf("❌ 读取表名失败: %v\n", err)
			continue
		}
		tables = append(tables, table)
	}

	if len(tables) > 0 {
		fmt.Printf("找到 %d 个表:\n", len(tables))
		for _, table := range tables {
			fmt.Printf("  - %s\n", table)
			
			// 获取表记录数
			var count int
			err := db.QueryRow(fmt.Sprintf("SELECT COUNT(*) FROM `%s`", table)).Scan(&count)
			if err != nil {
				fmt.Printf("    获取记录数失败: %v\n", err)
			} else {
				fmt.Printf("    记录数: %d\n", count)
			}
		}
	} else {
		fmt.Println("没有找到任何表")
	}

	// 检查用户权限
	fmt.Println("\n🔐 检查用户权限...")
	var grants string
	err = db.QueryRow("SHOW GRANTS FOR CURRENT_USER()").Scan(&grants)
	if err != nil {
		fmt.Printf("❌ 获取权限失败: %v\n", err)
	} else {
		fmt.Printf("用户权限:\n%s\n", grants)
	}

	fmt.Println("\n🎉 数据库连接测试完成！")
}