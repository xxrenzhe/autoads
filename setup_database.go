package main

import (
	"database/sql"
	"fmt"
	"log"

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

	fmt.Println("=== 创建数据库 autoads ===")

	// 1. 先连接到MySQL服务器（不指定数据库）
	dsn := fmt.Sprintf("%s:%s@tcp(%s:%d)/?charset=utf8mb4&parseTime=True&loc=Local&timeout=10s",
		config.username,
		config.password,
		config.host,
		config.port,
	)

	db, err := sql.Open("mysql", dsn)
	if err != nil {
		log.Fatalf("创建数据库连接失败: %v", err)
	}
	defer db.Close()

	// 测试连接
	err = db.Ping()
	if err != nil {
		log.Fatalf("连接MySQL服务器失败: %v", err)
	}

	fmt.Println("✅ MySQL服务器连接成功")

	// 2. 检查数据库是否存在
	var exists int
	err = db.QueryRow("SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name = ?", config.database).Scan(&exists)
	if err != nil {
		log.Fatalf("检查数据库存在性失败: %v", err)
	}

	if exists > 0 {
		fmt.Printf("✅ 数据库 '%s' 已存在\n", config.database)
	} else {
		// 3. 创建数据库
		fmt.Printf("📦 创建数据库 '%s'...\n", config.database)
		_, err = db.Exec(fmt.Sprintf("CREATE DATABASE `%s` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci", config.database))
		if err != nil {
			log.Fatalf("创建数据库失败: %v", err)
		}
		fmt.Printf("✅ 数据库 '%s' 创建成功\n", config.database)
	}

	// 4. 连接到新创建的数据库
	db.Close()
	dsn = fmt.Sprintf("%s:%s@tcp(%s:%d)/%s?charset=utf8mb4&parseTime=True&loc=Local&timeout=10s",
		config.username,
		config.password,
		config.host,
		config.port,
		config.database,
	)

	db, err = sql.Open("mysql", dsn)
	if err != nil {
		log.Fatalf("连接新数据库失败: %v", err)
	}
	defer db.Close()

	err = db.Ping()
	if err != nil {
		log.Fatalf("连接新数据库失败: %v", err)
	}

	fmt.Printf("✅ 成功连接到数据库 '%s'\n", config.database)

	// 5. 创建基本表结构
	fmt.Println("\n📋 创建表结构...")
	
	// 用户表
	createUsersTable := `
	CREATE TABLE IF NOT EXISTS users (
		id BIGINT PRIMARY KEY AUTO_INCREMENT,
		username VARCHAR(50) UNIQUE NOT NULL,
		email VARCHAR(100) UNIQUE NOT NULL,
		password_hash VARCHAR(255) NOT NULL,
		plan VARCHAR(20) DEFAULT 'FREE' NOT NULL,
		status ENUM('active', 'inactive', 'banned') DEFAULT 'active',
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
		INDEX idx_username (username),
		INDEX idx_email (email),
		INDEX idx_plan (plan),
		INDEX idx_status (status)
	) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
	
	_, err = db.Exec(createUsersTable)
	if err != nil {
		log.Fatalf("创建users表失败: %v", err)
	}
	fmt.Println("✅ users 表创建成功")

	// 管理员账户表
	createAdminAccountsTable := `
	CREATE TABLE IF NOT EXISTS admin_accounts (
		id BIGINT PRIMARY KEY AUTO_INCREMENT,
		username VARCHAR(50) UNIQUE NOT NULL,
		email VARCHAR(100) UNIQUE NOT NULL,
		password_hash VARCHAR(255) NOT NULL,
		role VARCHAR(50) NOT NULL,
		status ENUM('active', 'inactive') DEFAULT 'active',
		last_login TIMESTAMP NULL,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
		INDEX idx_username (username),
		INDEX idx_status (status)
	) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
	
	_, err = db.Exec(createAdminAccountsTable)
	if err != nil {
		log.Fatalf("创建admin_accounts表失败: %v", err)
	}
	fmt.Println("✅ admin_accounts 表创建成功")

	// 速率限制配置表
	createRateLimitConfigsTable := `
	CREATE TABLE IF NOT EXISTS rate_limit_configs (
		id VARCHAR(100) PRIMARY KEY,
		plan VARCHAR(20) NOT NULL,
		feature VARCHAR(50) NOT NULL,
		per_minute INT DEFAULT 0,
		per_hour INT DEFAULT 0,
		concurrent INT DEFAULT 0,
		is_active BOOLEAN DEFAULT TRUE,
		description TEXT,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
		UNIQUE KEY idx_plan_feature (plan, feature),
		INDEX idx_plan (plan),
		INDEX idx_feature (feature),
		INDEX idx_active (is_active)
	) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
	
	_, err = db.Exec(createRateLimitConfigsTable)
	if err != nil {
		log.Fatalf("创建rate_limit_configs表失败: %v", err)
	}
	fmt.Println("✅ rate_limit_configs 表创建成功")

	// Token余额表
	createTokenBalancesTable := `
	CREATE TABLE IF NOT EXISTS token_balances (
		id BIGINT PRIMARY KEY AUTO_INCREMENT,
		user_id BIGINT NOT NULL,
		token_type VARCHAR(20) NOT NULL,
		balance DECIMAL(10,2) DEFAULT 0.00,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
		UNIQUE KEY idx_user_token (user_id, token_type),
		INDEX idx_user_id (user_id),
		INDEX idx_token_type (token_type)
	) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
	
	_, err = db.Exec(createTokenBalancesTable)
	if err != nil {
		log.Fatalf("创建token_balances表失败: %v", err)
	}
	fmt.Println("✅ token_balances 表创建成功")

	// Token交易记录表
	createTokenTransactionsTable := `
	CREATE TABLE IF NOT EXISTS token_transactions (
		id BIGINT PRIMARY KEY AUTO_INCREMENT,
		user_id BIGINT NOT NULL,
		token_type VARCHAR(20) NOT NULL,
		amount DECIMAL(10,2) NOT NULL,
		transaction_type VARCHAR(20) NOT NULL,
		description TEXT,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		INDEX idx_user_id (user_id),
		INDEX idx_token_type (token_type),
		INDEX idx_transaction_type (transaction_type),
		INDEX idx_created_at (created_at)
	) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
	
	_, err = db.Exec(createTokenTransactionsTable)
	if err != nil {
		log.Fatalf("创建token_transactions表失败: %v", err)
	}
	fmt.Println("✅ token_transactions 表创建成功")

	// 6. 插入默认数据
	fmt.Println("\n📊 插入默认数据...")
	
	// 插入默认管理员账户
	_, err = db.Exec(`
		INSERT IGNORE INTO admin_accounts (username, email, password_hash, role)
		VALUES ('admin', 'admin@example.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.', 'SUPER_ADMIN')
	`)
	if err != nil {
		log.Printf("插入默认管理员失败: %v", err)
	} else {
		fmt.Println("✅ 默认管理员账户创建成功 (用户名: admin, 密码: password)")
	}

	// 插入速率限制配置
	configs := []struct {
		id         string
		plan       string
		feature    string
		perMinute  int
		perHour    int
		concurrent int
		desc       string
	}{
		{"rlc_FREE_API", "FREE", "API", 30, 1000, 0, "免费套餐API调用限制"},
		{"rlc_FREE_SITE_RANK", "FREE", "SITE_RANK", 2, 50, 0, "免费套餐网站排名查询限制"},
		{"rlc_FREE_BATCH", "FREE", "BATCH", 5, 300, 1, "免费套餐批量任务限制"},
		{"rlc_PRO_API", "PRO", "API", 100, 5000, 0, "专业套餐API调用限制"},
		{"rlc_PRO_SITE_RANK", "PRO", "SITE_RANK", 10, 200, 0, "专业套餐网站排名查询限制"},
		{"rlc_PRO_BATCH", "PRO", "BATCH", 20, 1200, 5, "专业套餐批量任务限制"},
		{"rlc_MAX_API", "MAX", "API", 500, 20000, 0, "高级套餐API调用限制"},
		{"rlc_MAX_SITE_RANK", "MAX", "SITE_RANK", 50, 1000, 0, "高级套餐网站排名查询限制"},
		{"rlc_MAX_BATCH", "MAX", "BATCH", 100, 6000, 20, "高级套餐批量任务限制"},
	}

	for _, cfg := range configs {
		_, err = db.Exec(`
			INSERT IGNORE INTO rate_limit_configs (id, plan, feature, per_minute, per_hour, concurrent, description)
			VALUES (?, ?, ?, ?, ?, ?, ?)
		`, cfg.id, cfg.plan, cfg.feature, cfg.perMinute, cfg.perHour, cfg.concurrent, cfg.desc)
		if err != nil {
			log.Printf("插入速率限制配置失败: %v", err)
		}
	}
	fmt.Println("✅ 速率限制配置插入成功")

	// 7. 验证结果
	fmt.Println("\n🎉 数据库初始化完成！")
	
	// 显示表信息
	rows, err := db.Query("SHOW TABLES")
	if err != nil {
		log.Printf("获取表列表失败: %v", err)
	} else {
		var tables []string
		for rows.Next() {
			var table string
			rows.Scan(&table)
			tables = append(tables, table)
		}
		rows.Close()
		
		fmt.Printf("\n✅ 共创建 %d 个表:\n", len(tables))
		for _, table := range tables {
			var count int
			db.QueryRow(fmt.Sprintf("SELECT COUNT(*) FROM `%s`", table)).Scan(&count)
			fmt.Printf("  - %s (%d 条记录)\n", table, count)
		}
	}

	// 显示速率限制配置
	fmt.Println("\n📋 速率限制配置:")
	rows, err = db.Query("SELECT plan, feature, per_minute, per_hour, concurrent FROM rate_limit_configs WHERE is_active = TRUE ORDER BY plan, feature")
	if err != nil {
		log.Printf("获取速率限制配置失败: %v", err)
	} else {
		for rows.Next() {
			var plan, feature string
			var perMinute, perHour, concurrent int
			rows.Scan(&plan, &feature, &perMinute, &perHour, &concurrent)
			fmt.Printf("  - %s %s: %d/分钟, %d/小时", plan, feature, perMinute, perHour)
			if concurrent > 0 {
				fmt.Printf(", %d 并发", concurrent)
			}
			fmt.Println()
		}
		rows.Close()
	}

	fmt.Println("\n🚀 数据库已准备就绪，可以运行应用程序！")
}