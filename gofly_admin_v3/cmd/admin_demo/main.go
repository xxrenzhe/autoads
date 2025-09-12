package main

import (
	"fmt"
	"log"
	"time"

	"gofly-admin-v3/internal/admin"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func main() {
	fmt.Println("🏢 AutoAds SaaS 管理后台演示")
	fmt.Println("=============================")

	// 设置内存数据库
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		log.Fatal("数据库连接失败:", err)
	}

	// 自动迁移
	if err := setupDatabase(db); err != nil {
		log.Fatal("数据库初始化失败:", err)
	}

	// 创建服务
	dashboardService := admin.NewDashboardService(db)
	userService := admin.NewUserService(db)
	planService := admin.NewPlanService(db)
	tokenService := admin.NewTokenService(db)

	// 演示数据面板功能
	fmt.Println("\n📊 数据面板演示:")
	fmt.Println("------------------")

	stats, err := dashboardService.GetOverviewStats()
	if err != nil {
		log.Printf("获取概览统计失败: %v", err)
	} else {
		fmt.Printf("📈 系统概览统计:\n")
		fmt.Printf("  • 总用户数: %d\n", stats.TotalUsers)
		fmt.Printf("  • 今日新增用户: %d\n", stats.TodayNewUsers)
		fmt.Printf("  • 活跃用户: %d\n", stats.ActiveUsers)
		fmt.Printf("  • 总Token消费: %d\n", stats.TotalTokensConsumed)
		fmt.Printf("  • 总Token获得: %d\n", stats.TotalTokensEarned)
		fmt.Printf("  • 今日Token消费: %d\n", stats.TodayTokensConsumed)
		fmt.Printf("  • 总任务数: %d (BatchGo: %d, SiteRank: %d, Chengelink: %d)\n",
			stats.TotalBatchTasks+stats.TotalSiteRankQueries+stats.TotalChengeLinkTasks,
			stats.TotalBatchTasks, stats.TotalSiteRankQueries, stats.TotalChengeLinkTasks)
		fmt.Printf("  • 邀请统计: %d/%d (成功/总数)\n", stats.SuccessfulInvitations, stats.TotalInvitations)
		fmt.Printf("  • 签到统计: %d (今日: %d)\n", stats.TotalCheckins, stats.TodayCheckins)
	}

	// 演示用户趋势
	userTrend, err := dashboardService.GetUserTrend(7)
	if err != nil {
		log.Printf("获取用户趋势失败: %v", err)
	} else {
		fmt.Printf("\n📈 用户增长趋势 (最近7天):\n")
		for _, trend := range userTrend {
			fmt.Printf("  %s: 新增 %d, 活跃 %d\n", trend.Date, trend.NewUsers, trend.ActiveUsers)
		}
	}

	// 演示用户管理功能
	fmt.Println("\n👥 用户管理演示:")
	fmt.Println("------------------")

	users, total, err := userService.GetUsers(1, 10, "")
	if err != nil {
		log.Printf("获取用户列表失败: %v", err)
	} else {
		fmt.Printf("📋 用户列表 (共 %d 个用户):\n", total)
		for i, user := range users {
			fmt.Printf("  %d. %s (%s) - %s套餐, %d Token, 状态: %s\n",
				i+1, user.Username, user.Email, user.PlanName, user.TokenBalance, user.Status)
		}
	}

	// 演示套餐管理功能
	fmt.Println("\n💼 套餐管理演示:")
	fmt.Println("------------------")

	plans, err := planService.GetPlans()
	if err != nil {
		log.Printf("获取套餐列表失败: %v", err)
	} else {
		fmt.Printf("📦 套餐配置列表:\n")
		for _, plan := range plans {
			fmt.Printf("  • %s (%s) - ¥%.2f/%d天\n", plan.DisplayName, plan.Name, plan.Price, plan.Duration)
			fmt.Printf("    功能: BatchGo(%t), SiteRank(%t), Chengelink(%t)\n",
				plan.BatchGoEnabled, plan.SiteRankEnabled, plan.ChengeLinkEnabled)
			fmt.Printf("    限制: 批次大小(%d), 并发数(%d), SiteRank查询(%d), Chengelink任务(%d)\n",
				plan.MaxBatchSize, plan.MaxConcurrency, plan.MaxSiteRankQueries, plan.MaxChengeLinkTasks)
			fmt.Printf("    Token: 初始(%d), 每日(%d), 状态: %t\n\n",
				plan.InitialTokens, plan.DailyTokens, plan.IsActive)
		}
	}

	// 演示套餐使用统计
	planStats, err := planService.GetPlanUsageStats()
	if err != nil {
		log.Printf("获取套餐使用统计失败: %v", err)
	} else {
		fmt.Printf("📊 套餐使用统计:\n")
		for _, stat := range planStats {
			fmt.Printf("  • %s: %d 用户 (活跃: %d)\n",
				stat.DisplayName, stat.UserCount, stat.ActiveUserCount)
		}
	}

	// 演示Token管理功能
	fmt.Println("\n🪙 Token管理演示:")
	fmt.Println("------------------")

	packages, err := tokenService.GetTokenPackages()
	if err != nil {
		log.Printf("获取Token充值包失败: %v", err)
	} else {
		fmt.Printf("💰 Token充值包列表:\n")
		for _, pkg := range packages {
			totalTokens := pkg.TokenAmount + pkg.BonusTokens
			fmt.Printf("  • %s: %d Token (含%d赠送) - ¥%.2f, 状态: %t\n",
				pkg.Name, totalTokens, pkg.BonusTokens, pkg.Price, pkg.IsActive)
		}
	}

	// 演示Token消费规则
	rules, err := tokenService.GetTokenConsumptionRules()
	if err != nil {
		log.Printf("获取Token消费规则失败: %v", err)
	} else {
		fmt.Printf("\n⚙️ Token消费规则:\n")
		for _, rule := range rules {
			fmt.Printf("  • %s.%s: %d Token - %s (状态: %t)\n",
				rule.Service, rule.Action, rule.TokenCost, rule.Description, rule.IsActive)
		}
	}

	// 演示Token统计
	tokenStats, err := tokenService.GetTokenStats()
	if err != nil {
		log.Printf("获取Token统计失败: %v", err)
	} else {
		fmt.Printf("\n📊 Token统计信息:\n")
		fmt.Printf("  • 总获得: %d Token\n", tokenStats.TotalTokensEarned)
		fmt.Printf("  • 总消费: %d Token\n", tokenStats.TotalTokensConsumed)
		fmt.Printf("  • 今日获得: %d Token\n", tokenStats.TodayTokensEarned)
		fmt.Printf("  • 今日消费: %d Token\n", tokenStats.TodayTokensConsumed)
		fmt.Printf("  • 用户总余额: %d Token\n", tokenStats.TotalUserBalance)
		fmt.Printf("  • 平均余额: %.2f Token\n", tokenStats.AverageUserBalance)
		fmt.Printf("  • 活跃用户: %d\n", tokenStats.ActiveUsers)
	}

	// 演示邀请排行榜
	invitationRanking, err := tokenService.GetInvitationRanking(5)
	if err != nil {
		log.Printf("获取邀请排行榜失败: %v", err)
	} else {
		fmt.Printf("\n🏆 邀请排行榜 (Top 5):\n")
		for i, ranking := range invitationRanking {
			fmt.Printf("  %d. %s (%s)\n", i+1, ranking.Username, ranking.Email)
			fmt.Printf("     邀请: %d/%d (成功/总数), 奖励: %d Token + %d天Pro\n",
				ranking.SuccessfulCount, ranking.InvitationCount,
				ranking.RewardTokens, ranking.RewardProDays)
		}
	}

	// 演示系统健康检查
	fmt.Println("\n🔍 系统健康检查:")
	fmt.Println("------------------")

	health, err := dashboardService.GetSystemHealth()
	if err != nil {
		log.Printf("获取系统健康状态失败: %v", err)
	} else {
		fmt.Printf("💚 系统状态:\n")
		fmt.Printf("  • 数据库: %s\n", getStatusIcon(health.DatabaseStatus))
		fmt.Printf("  • Redis: %s\n", getStatusIcon(health.RedisStatus))
		fmt.Printf("  • API: %s\n", getStatusIcon(health.APIStatus))
		fmt.Printf("  • 最后更新: %s\n", health.LastUpdated.Format("2006-01-02 15:04:05"))
	}

	// 演示管理操作
	fmt.Println("\n⚡ 管理操作演示:")
	fmt.Println("------------------")

	// 创建新套餐
	fmt.Println("📦 创建新套餐...")
	newPlan := &admin.CreatePlanRequest{
		Name:               "premium",
		DisplayName:        "高级版",
		Description:        "高级功能套餐，适合高级用户",
		Price:              199.99,
		Duration:           30,
		BatchGoEnabled:     true,
		SiteRankEnabled:    true,
		ChengeLinkEnabled:  true,
		MaxBatchSize:       100,
		MaxConcurrency:     8,
		MaxSiteRankQueries: 1000,
		MaxChengeLinkTasks: 20,
		InitialTokens:      1000,
		DailyTokens:        100,
	}

	createdPlan, err := planService.CreatePlan(newPlan)
	if err != nil {
		log.Printf("创建套餐失败: %v", err)
	} else {
		fmt.Printf("✅ 成功创建套餐: %s (ID: %d)\n", createdPlan.DisplayName, createdPlan.ID)
	}

	// 创建Token充值包
	fmt.Println("\n💰 创建Token充值包...")
	newPackage := &admin.CreateTokenPackageRequest{
		Name:        "巨无霸包",
		TokenAmount: 10000,
		Price:       399.99,
		BonusTokens: 5000,
		Description: "10000 Token + 5000 赠送Token，超值优惠",
		SortOrder:   6,
	}

	createdPackage, err := tokenService.CreateTokenPackage(newPackage)
	if err != nil {
		log.Printf("创建Token充值包失败: %v", err)
	} else {
		fmt.Printf("✅ 成功创建Token充值包: %s (ID: %d)\n", createdPackage.Name, createdPackage.ID)
	}

	// 创建Token消费规则
	fmt.Println("\n⚙️ 创建Token消费规则...")
	newRule := &admin.CreateTokenRuleRequest{
		Service:     "autoclick",
		Action:      "click_task",
		TokenCost:   5,
		Description: "AutoClick点击任务每次消费5个Token",
	}

	createdRule, err := tokenService.CreateTokenConsumptionRule(newRule)
	if err != nil {
		log.Printf("创建Token消费规则失败: %v", err)
	} else {
		fmt.Printf("✅ 成功创建Token消费规则: %s.%s (ID: %d)\n",
			createdRule.Service, createdRule.Action, createdRule.ID)
	}

	fmt.Println("\n✅ 管理后台演示完成！")
	fmt.Println("\n🔧 主要功能:")
	fmt.Println("  • 实时数据面板和趋势分析")
	fmt.Println("  • 用户管理和状态控制")
	fmt.Println("  • 套餐配置和权限管理")
	fmt.Println("  • Token充值包和消费规则管理")
	fmt.Println("  • 邀请排行榜和奖励统计")
	fmt.Println("  • 系统健康监控")
	fmt.Println("  • 操作日志和审计追踪")
}

// setupDatabase 设置数据库
func setupDatabase(db *gorm.DB) error {
	// 自动迁移所有表
	if err := db.AutoMigrate(
		&admin.User{},
		&admin.TokenTransaction{},
		&admin.BatchTask{},
		&admin.SiteRankQuery{},
		&admin.ChengeLinkTask{},
		&admin.Invitation{},
		&admin.CheckinRecord{},
		&admin.PlanConfig{},
		&admin.TokenPackage{},
		&admin.TokenConsumptionRule{},
		&admin.AdminUser{},
		&admin.SystemConfig{},
		&admin.UserOperationLog{},
	); err != nil {
		return err
	}

	// 插入测试数据
	return insertTestData(db)
}

// insertTestData 插入测试数据
func insertTestData(db *gorm.DB) error {
	// 插入测试用户
	users := []admin.User{
		{ID: "user-001", Username: "alice", Email: "alice@example.com", PlanName: "pro", TokenBalance: 500, Status: "active", CreatedAt: time.Now().AddDate(0, 0, -30)},
		{ID: "user-002", Username: "bob", Email: "bob@example.com", PlanName: "basic", TokenBalance: 200, Status: "active", CreatedAt: time.Now().AddDate(0, 0, -15)},
		{ID: "user-003", Username: "charlie", Email: "charlie@example.com", PlanName: "free", TokenBalance: 50, Status: "active", CreatedAt: time.Now().AddDate(0, 0, -7)},
		{ID: "user-004", Username: "diana", Email: "diana@example.com", PlanName: "enterprise", TokenBalance: 2000, Status: "active", CreatedAt: time.Now().AddDate(0, 0, -1)},
		{ID: "user-005", Username: "eve", Email: "eve@example.com", PlanName: "basic", TokenBalance: 0, Status: "disabled", CreatedAt: time.Now().AddDate(0, 0, -60)},
	}

	for _, user := range users {
		db.Create(&user)
	}

	// 插入Token交易记录
	transactions := []admin.TokenTransaction{
		{UserID: "user-001", Amount: 500, Description: "套餐赠送Token", CreatedAt: time.Now().AddDate(0, 0, -30)},
		{UserID: "user-001", Amount: -50, Description: "BatchGo任务消费", CreatedAt: time.Now().AddDate(0, 0, -25)},
		{UserID: "user-002", Amount: 200, Description: "套餐赠送Token", CreatedAt: time.Now().AddDate(0, 0, -15)},
		{UserID: "user-002", Amount: -30, Description: "SiteRank查询消费", CreatedAt: time.Now().AddDate(0, 0, -10)},
		{UserID: "user-003", Amount: 50, Description: "邀请奖励", CreatedAt: time.Now().AddDate(0, 0, -7)},
		{UserID: "user-004", Amount: 2000, Description: "套餐赠送Token", CreatedAt: time.Now().AddDate(0, 0, -1)},
	}

	for _, tx := range transactions {
		db.Create(&tx)
	}

	// 插入任务记录
	batchTasks := []admin.BatchTask{
		{ID: "batch-001", UserID: "user-001", CreatedAt: time.Now().AddDate(0, 0, -25)},
		{ID: "batch-002", UserID: "user-002", CreatedAt: time.Now().AddDate(0, 0, -20)},
		{ID: "batch-003", UserID: "user-001", CreatedAt: time.Now().AddDate(0, 0, -15)},
		{ID: "batch-004", UserID: "user-004", CreatedAt: time.Now().AddDate(0, 0, -5)},
	}

	for _, task := range batchTasks {
		db.Create(&task)
	}

	// 插入SiteRank查询记录
	siteRankQueries := []admin.SiteRankQuery{
		{UserID: "user-002", CreatedAt: time.Now().AddDate(0, 0, -10)},
		{UserID: "user-001", CreatedAt: time.Now().AddDate(0, 0, -8)},
		{UserID: "user-003", CreatedAt: time.Now().AddDate(0, 0, -5)},
	}

	for _, query := range siteRankQueries {
		db.Create(&query)
	}

	// 插入邀请记录
	invitations := []admin.Invitation{
		{InviterID: "user-001", Status: "completed", CreatedAt: time.Now().AddDate(0, 0, -20)},
		{InviterID: "user-001", Status: "completed", CreatedAt: time.Now().AddDate(0, 0, -15)},
		{InviterID: "user-002", Status: "completed", CreatedAt: time.Now().AddDate(0, 0, -10)},
		{InviterID: "user-001", Status: "pending", CreatedAt: time.Now().AddDate(0, 0, -5)},
	}

	for _, invitation := range invitations {
		db.Create(&invitation)
	}

	// 插入签到记录
	checkinRecords := []admin.CheckinRecord{
		{UserID: "user-001", CheckinDate: time.Now().AddDate(0, 0, -1).Format("2006-01-02"), CreatedAt: time.Now().AddDate(0, 0, -1)},
		{UserID: "user-002", CheckinDate: time.Now().AddDate(0, 0, -1).Format("2006-01-02"), CreatedAt: time.Now().AddDate(0, 0, -1)},
		{UserID: "user-001", CheckinDate: time.Now().Format("2006-01-02"), CreatedAt: time.Now()},
		{UserID: "user-003", CheckinDate: time.Now().Format("2006-01-02"), CreatedAt: time.Now()},
	}

	for _, record := range checkinRecords {
		db.Create(&record)
	}

	// 插入默认套餐配置
	plans := []admin.PlanConfig{
		{Name: "free", DisplayName: "免费版", Description: "基础功能", Price: 0, Duration: 30, BatchGoEnabled: true, SiteRankEnabled: true, ChengeLinkEnabled: false, MaxBatchSize: 5, MaxConcurrency: 1, MaxSiteRankQueries: 50, MaxChengeLinkTasks: 0, InitialTokens: 50, DailyTokens: 5, IsActive: true},
		{Name: "basic", DisplayName: "基础版", Description: "标准功能", Price: 29.99, Duration: 30, BatchGoEnabled: true, SiteRankEnabled: true, ChengeLinkEnabled: false, MaxBatchSize: 10, MaxConcurrency: 2, MaxSiteRankQueries: 100, MaxChengeLinkTasks: 0, InitialTokens: 100, DailyTokens: 10, IsActive: true},
		{Name: "pro", DisplayName: "专业版", Description: "全功能版本", Price: 99.99, Duration: 30, BatchGoEnabled: true, SiteRankEnabled: true, ChengeLinkEnabled: true, MaxBatchSize: 50, MaxConcurrency: 5, MaxSiteRankQueries: 500, MaxChengeLinkTasks: 10, InitialTokens: 500, DailyTokens: 50, IsActive: true},
		{Name: "enterprise", DisplayName: "企业版", Description: "企业级功能", Price: 299.99, Duration: 30, BatchGoEnabled: true, SiteRankEnabled: true, ChengeLinkEnabled: true, MaxBatchSize: 200, MaxConcurrency: 10, MaxSiteRankQueries: 2000, MaxChengeLinkTasks: 50, InitialTokens: 2000, DailyTokens: 200, IsActive: true},
	}

	for _, plan := range plans {
		db.Create(&plan)
	}

	// 插入Token充值包
	packages := []admin.TokenPackage{
		{Name: "小包装", TokenAmount: 100, Price: 9.99, BonusTokens: 10, Description: "100 Token + 10 赠送", IsActive: true, SortOrder: 1},
		{Name: "标准包", TokenAmount: 500, Price: 39.99, BonusTokens: 100, Description: "500 Token + 100 赠送", IsActive: true, SortOrder: 2},
		{Name: "大包装", TokenAmount: 1000, Price: 69.99, BonusTokens: 300, Description: "1000 Token + 300 赠送", IsActive: true, SortOrder: 3},
		{Name: "超值包", TokenAmount: 2000, Price: 119.99, BonusTokens: 800, Description: "2000 Token + 800 赠送", IsActive: true, SortOrder: 4},
	}

	for _, pkg := range packages {
		db.Create(&pkg)
	}

	// 插入Token消费规则
	rules := []admin.TokenConsumptionRule{
		{Service: "batchgo", Action: "basic_task", TokenCost: 1, Description: "BatchGo基础任务", IsActive: true},
		{Service: "batchgo", Action: "advanced_task", TokenCost: 2, Description: "BatchGo高级任务", IsActive: true},
		{Service: "siterank", Action: "query", TokenCost: 1, Description: "SiteRank查询", IsActive: true},
		{Service: "chengelink", Action: "extract_link", TokenCost: 1, Description: "链接提取", IsActive: true},
		{Service: "chengelink", Action: "update_ad", TokenCost: 3, Description: "广告更新", IsActive: true},
	}

	for _, rule := range rules {
		db.Create(&rule)
	}

	return nil
}

// getStatusIcon 获取状态图标
func getStatusIcon(status string) string {
	switch status {
	case "healthy":
		return "✅ 正常"
	case "warning":
		return "⚠️ 警告"
	case "error":
		return "❌ 错误"
	default:
		return "❓ 未知"
	}
}
