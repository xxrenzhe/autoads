package main

import (
	"fmt"
	"log"
	"time"

	"gofly-admin-v3/internal/chengelink"
)

func main() {
	fmt.Println("🔗 Chengelink 功能演示")
	fmt.Println("======================")

	// 演示 AdsPower 客户端
	fmt.Println("\n📱 AdsPower 浏览器集成演示:")
	fmt.Println("----------------------------")

	adsPowerClient := chengelink.NewMockAdsPowerClient()

	// 测试连接
	if err := adsPowerClient.TestConnection(); err != nil {
		log.Printf("AdsPower 连接失败: %v", err)
	} else {
		fmt.Println("✅ AdsPower 连接成功")
	}

	// 获取配置列表
	profiles, err := adsPowerClient.GetProfileList()
	if err != nil {
		log.Printf("获取配置列表失败: %v", err)
	} else {
		fmt.Printf("📋 找到 %d 个浏览器配置:\n", len(profiles))
		for _, profile := range profiles {
			fmt.Printf("  - %s (%s) - %s\n", profile.Name, profile.ID, profile.Status)
		}
	}

	// 演示链接提取
	fmt.Println("\n🔍 链接提取演示:")
	testLinks := []string{
		"https://affiliate-network.com/redirect?id=12345&url=target",
		"https://commission-junction.com/click?pid=67890&url=product",
		"https://amazon-associates.com/dp/B08N5WRWNW?tag=mytag",
	}

	for i, link := range testLinks {
		fmt.Printf("\n%d. 提取链接: %s\n", i+1, link)

		result, err := adsPowerClient.ExtractFinalURL("profile_001", link)
		if err != nil {
			fmt.Printf("   ❌ 提取失败: %v\n", err)
			continue
		}

		if result.Success {
			fmt.Printf("   ✅ 提取成功: %s\n", result.FinalURL)
			fmt.Printf("   🔄 重定向链: %d 步\n", len(result.RedirectChain))
		} else {
			fmt.Printf("   ❌ 提取失败: %s\n", result.Error)
		}
	}

	// 演示 Google Ads 客户端
	fmt.Println("\n🎯 Google Ads 集成演示:")
	fmt.Println("-------------------------")

	googleAdsClient := chengelink.NewMockGoogleAdsClient()

	// 测试连接
	if err := googleAdsClient.TestConnection(); err != nil {
		log.Printf("Google Ads 连接失败: %v", err)
	} else {
		fmt.Println("✅ Google Ads 连接成功")
	}

	// 获取广告列表
	ads, err := googleAdsClient.GetAds()
	if err != nil {
		log.Printf("获取广告列表失败: %v", err)
	} else {
		fmt.Printf("📊 找到 %d 个广告:\n", len(ads))
		for _, ad := range ads {
			fmt.Printf("  - %s (%s) - %s\n", ad.Name, ad.ID, ad.Status)
			fmt.Printf("    当前URL: %s\n", ad.FinalURL)
		}
	}

	// 演示广告更新
	fmt.Println("\n🔄 广告更新演示:")
	if len(ads) > 0 {
		newURL := "https://target-site.com/product?source=affiliate"
		fmt.Printf("更新广告 %s 的URL为: %s\n", ads[0].ID, newURL)

		result, err := googleAdsClient.UpdateAdFinalURL(ads[0].ID, newURL)
		if err != nil {
			fmt.Printf("❌ 更新失败: %v\n", err)
		} else if result.Success {
			fmt.Printf("✅ 更新成功\n")
		} else {
			fmt.Printf("❌ 更新失败: %s\n", result.ErrorMessage)
		}
	}

	// 演示批量更新
	fmt.Println("\n📦 批量更新演示:")
	if len(ads) >= 2 {
		updates := []chengelink.UpdateAdRequest{
			{AdID: ads[0].ID, FinalURL: "https://target-site.com/product1"},
			{AdID: ads[1].ID, FinalURL: "https://target-site.com/product2"},
		}

		fmt.Printf("批量更新 %d 个广告...\n", len(updates))

		results, err := googleAdsClient.BatchUpdateAds(updates)
		if err != nil {
			fmt.Printf("❌ 批量更新失败: %v\n", err)
		} else {
			successCount := 0
			for _, result := range results {
				if result.Success {
					successCount++
				}
			}
			fmt.Printf("✅ 批量更新完成: %d/%d 成功\n", successCount, len(results))
		}
	}

	// 演示完整工作流程
	fmt.Println("\n🚀 完整工作流程演示:")
	fmt.Println("---------------------")

	// 模拟任务创建
	task := &chengelink.ChengeLinkTask{
		ID:               "demo-task-001",
		UserID:           "demo-user",
		Name:             "演示任务",
		Status:           chengelink.TaskStatusPending,
		AffiliateLinks:   testLinks,
		AdsPowerProfile:  "profile_001",
		GoogleAdsAccount: "1234567890",
		TotalLinks:       len(testLinks),
		ExtractedLinks:   []chengelink.ExtractedLink{},
		UpdateResults:    []chengelink.AdUpdateResult{},
		ExecutionLog:     []chengelink.ExecutionLogEntry{},
		CreatedAt:        time.Now(),
		UpdatedAt:        time.Now(),
	}

	fmt.Printf("📋 任务信息:\n")
	fmt.Printf("  - ID: %s\n", task.ID)
	fmt.Printf("  - 名称: %s\n", task.Name)
	fmt.Printf("  - 状态: %s\n", task.Status)
	fmt.Printf("  - 链接数量: %d\n", len(task.AffiliateLinks))
	fmt.Printf("  - Token 消费: %d\n", task.CalculateTokenCost())

	// 模拟执行过程
	fmt.Println("\n⚡ 模拟执行过程:")

	// 第一阶段：链接提取
	task.Status = chengelink.TaskStatusExtracting
	task.AddLog("info", "开始链接提取", "")
	fmt.Printf("1️⃣ %s - %s\n", task.Status, "开始链接提取")

	for i, link := range task.AffiliateLinks {
		time.Sleep(200 * time.Millisecond) // 模拟处理时间

		result, _ := adsPowerClient.ExtractFinalURL("profile_001", link)
		if result.Success {
			task.ExtractedCount++
			task.ExtractedLinks = append(task.ExtractedLinks, chengelink.ExtractedLink{
				AffiliateURL: result.AffiliateURL,
				FinalURL:     result.FinalURL,
				Status:       "success",
				ExtractedAt:  time.Now().Format("2006-01-02 15:04:05"),
			})
			task.AddLog("info", "链接提取成功", fmt.Sprintf("链接 %d: %s", i+1, result.FinalURL))
		} else {
			task.FailedCount++
			task.AddLog("warning", "链接提取失败", fmt.Sprintf("链接 %d: %s", i+1, result.Error))
		}

		fmt.Printf("   📎 链接 %d/%d 处理完成\n", i+1, len(task.AffiliateLinks))
	}

	// 第二阶段：广告更新
	task.Status = chengelink.TaskStatusUpdating
	task.AddLog("info", "开始广告更新", "")
	fmt.Printf("2️⃣ %s - %s\n", task.Status, "开始广告更新")

	for i, ad := range ads[:min(len(ads), task.ExtractedCount)] {
		time.Sleep(300 * time.Millisecond) // 模拟处理时间

		if i < len(task.ExtractedLinks) {
			newURL := task.ExtractedLinks[i].FinalURL
			result, _ := googleAdsClient.UpdateAdFinalURL(ad.ID, newURL)

			updateResult := chengelink.AdUpdateResult{
				AdID:        ad.ID,
				AdName:      ad.Name,
				OldFinalURL: ad.FinalURL,
				NewFinalURL: newURL,
				Status:      "success",
				UpdatedAt:   time.Now().Format("2006-01-02 15:04:05"),
			}

			if result.Success {
				task.UpdatedCount++
				task.AddLog("info", "广告更新成功", fmt.Sprintf("广告 %s", ad.ID))
			} else {
				updateResult.Status = "failed"
				updateResult.ErrorMessage = result.ErrorMessage
				task.AddLog("warning", "广告更新失败", fmt.Sprintf("广告 %s: %s", ad.ID, result.ErrorMessage))
			}

			task.UpdateResults = append(task.UpdateResults, updateResult)
			fmt.Printf("   🎯 广告 %d/%d 更新完成\n", i+1, min(len(ads), task.ExtractedCount))
		}
	}

	// 任务完成
	task.Status = chengelink.TaskStatusCompleted
	task.AddLog("info", "任务执行完成", "")
	fmt.Printf("3️⃣ %s - %s\n", task.Status, "任务执行完成")

	// 显示最终结果
	fmt.Println("\n📊 执行结果:")
	fmt.Printf("  - 链接提取: %d/%d 成功\n", task.ExtractedCount, len(task.AffiliateLinks))
	fmt.Printf("  - 广告更新: %d/%d 成功\n", task.UpdatedCount, len(task.UpdateResults))
	fmt.Printf("  - 成功率: %.1f%%\n", task.GetSuccessRate())
	fmt.Printf("  - Token 消费: %d\n", task.TokensConsumed)

	// 显示执行日志
	fmt.Println("\n📝 执行日志:")
	for _, log := range task.ExecutionLog {
		icon := "ℹ️"
		if log.Level == "warning" {
			icon = "⚠️"
		} else if log.Level == "error" {
			icon = "❌"
		}
		fmt.Printf("  %s [%s] %s: %s\n", icon, log.Timestamp, log.Level, log.Message)
	}

	fmt.Println("\n✅ Chengelink 功能演示完成！")
	fmt.Println("\n🔧 主要功能:")
	fmt.Println("  • AdsPower 浏览器自动化集成")
	fmt.Println("  • 联盟链接自动提取和跟踪")
	fmt.Println("  • Google Ads API 批量更新")
	fmt.Println("  • 详细的执行日志和状态监控")
	fmt.Println("  • Token 消费计算和管理")
	fmt.Println("  • 错误处理和重试机制")
}

// min 返回两个整数中的较小值
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
