package main

import (
	"fmt"
	"log"
	"strings"

	"gofly-admin-v3/internal/siterank"
)

func main() {
	fmt.Println("🚀 SiteRank 增强优先级计算演示")
	fmt.Println("=====================================")

	// 创建 SimilarWeb 模拟客户端
	client := siterank.NewMockSimilarWebClient()

	// 测试域名列表
	domains := []string{
		"google.com",
		"facebook.com",
		"high-traffic-low-rank.com",
		"low-traffic-high-rank.com",
		"medium.com",
		"small-blog.com",
		"example.com",
	}

	fmt.Printf("%-30s %-10s %-15s %-15s %-15s %-10s\n",
		"域名", "排名", "月访问量", "排名得分", "流量得分", "优先级")
	fmt.Println(strings.Repeat("-", 100))

	for _, domain := range domains {
		// 获取域名数据
		data, err := client.GetDomainRank(domain, "world")
		if err != nil {
			log.Printf("获取 %s 数据失败: %v", domain, err)
			continue
		}

		// 创建查询对象
		query := &siterank.SiteRankQuery{
			Domain:        domain,
			GlobalRank:    data.GlobalRank,
			Visits:        data.Visits,
			Category:      data.Category,
			Country:       data.Country,
			BounceRate:    data.BounceRate,
			PagesPerVisit: data.PagesPerVisit,
			AvgDuration:   data.AvgDuration,
		}

		// 计算优先级和详情
		priority := query.CalculatePriority()
		details := query.GetPriorityDetails()

		// 格式化输出
		rankStr := "N/A"
		if data.GlobalRank != nil {
			rankStr = fmt.Sprintf("%d", *data.GlobalRank)
		}

		visitsStr := "N/A"
		if data.Visits != nil {
			visitsStr = formatNumber(*data.Visits)
		}

		fmt.Printf("%-30s %-10s %-15s %-15.1f %-15.1f %-10s\n",
			domain,
			rankStr,
			visitsStr,
			details["rank_score"].(float64),
			details["traffic_score"].(float64),
			priority,
		)
	}

	fmt.Println()
	fmt.Println("📊 优先级计算说明:")
	fmt.Println("• 综合得分 = 排名得分 × 0.6 + 流量得分 × 0.4")
	fmt.Println("• 高优先级: 综合得分 ≥ 80")
	fmt.Println("• 中优先级: 50 ≤ 综合得分 < 80")
	fmt.Println("• 低优先级: 综合得分 < 50")
	fmt.Println()

	// 展示详细计算过程
	fmt.Println("🔍 详细计算示例 (google.com):")
	fmt.Println("=====================================")

	data, _ := client.GetDomainRank("google.com", "world")
	query := &siterank.SiteRankQuery{
		Domain:     "google.com",
		GlobalRank: data.GlobalRank,
		Visits:     data.Visits,
	}

	details := query.GetPriorityDetails()

	fmt.Printf("排名: %d (得分: %.1f)\n", *data.GlobalRank, details["rank_score"].(float64))
	fmt.Printf("月访问量: %s (得分: %.1f)\n", formatNumber(*data.Visits), details["traffic_score"].(float64))

	rankScore := details["rank_score"].(float64)
	trafficScore := details["traffic_score"].(float64)
	compositeScore := details["total_score"].(float64)
	priority := details["priority"].(siterank.Priority)

	fmt.Printf("综合得分: %.1f × 0.6 + %.1f × 0.4 = %.1f\n",
		rankScore, trafficScore, compositeScore)
	fmt.Printf("优先级: %s\n", priority)

	fmt.Println()
	fmt.Println("✅ 演示完成！增强的优先级计算已成功实现。")
}

// formatNumber 格式化数字显示
func formatNumber(num float64) string {
	if num >= 1e9 {
		return fmt.Sprintf("%.1f亿", num/1e8)
	} else if num >= 1e6 {
		return fmt.Sprintf("%.1f万", num/1e4)
	} else if num >= 1e3 {
		return fmt.Sprintf("%.1fK", num/1e3)
	}
	return fmt.Sprintf("%.0f", num)
}
