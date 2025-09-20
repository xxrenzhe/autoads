package siterank

import (
	"fmt"
	"testing"
)

// TestImprovedPriorityCalculation 测试改进后的优先级计算算法
func TestImprovedPriorityCalculation(t *testing.T) {
	testCases := []struct {
		name             string
		globalRank       *int
		visits           *float64
		expectedPriority Priority
		description      string
	}{
		{
			name:             "Google - 超高排名+超高流量",
			globalRank:       intPtr(1),
			visits:           float64Ptr(15000000000), // 150亿
			expectedPriority: PriorityHigh,
			description:      "排名第1，150亿访问量，应该是高优先级",
		},
		{
			name:             "Facebook - 高排名+超高流量",
			globalRank:       intPtr(3),
			visits:           float64Ptr(8000000000), // 80亿
			expectedPriority: PriorityHigh,
			description:      "排名第3，80亿访问量，应该是高优先级",
		},
		{
			name:             "GitHub - 中等排名+中高流量",
			globalRank:       intPtr(45),
			visits:           float64Ptr(350000000), // 3.5亿
			expectedPriority: PriorityHigh,
			description:      "排名45，3.5亿访问量，应该是高优先级",
		},
		{
			name:             "StackOverflow - 中等排名+中流量",
			globalRank:       intPtr(180),
			visits:           float64Ptr(85000000), // 8500万
			expectedPriority: PriorityMedium,
			description:      "排名180，8500万访问量，应该是中优先级",
		},
		{
			name:             "Medium - 较低排名+中流量",
			globalRank:       intPtr(320),
			visits:           float64Ptr(45000000), // 4500万
			expectedPriority: PriorityMedium,
			description:      "排名320，4500万访问量，应该是中优先级",
		},
		{
			name:             "高流量低排名网站",
			globalRank:       intPtr(150000),
			visits:           float64Ptr(50000000), // 5000万
			expectedPriority: PriorityLow,
			description:      "排名15万，虽有5000万访问量，但综合得分仍为低优先级",
		},
		{
			name:             "低流量高排名网站",
			globalRank:       intPtr(5000),
			visits:           float64Ptr(200000), // 20万
			expectedPriority: PriorityMedium,
			description:      "排名5000，但只有20万访问量，应该是中优先级",
		},
		{
			name:             "Example.com - 低排名+低流量",
			globalRank:       intPtr(50000),
			visits:           float64Ptr(100000), // 10万
			expectedPriority: PriorityLow,
			description:      "排名5万，10万访问量，应该是低优先级",
		},
		{
			name:             "小博客 - 很低排名+很低流量",
			globalRank:       intPtr(850000),
			visits:           float64Ptr(5000), // 5000
			expectedPriority: PriorityLow,
			description:      "排名85万，5000访问量，应该是低优先级",
		},
		{
			name:             "无排名数据",
			globalRank:       nil,
			visits:           float64Ptr(1000000), // 100万
			expectedPriority: PriorityLow,
			description:      "无排名数据，即使有流量也是低优先级",
		},
		{
			name:             "无流量数据",
			globalRank:       intPtr(1000),
			visits:           nil,
			expectedPriority: PriorityLow,
			description:      "排名1000但无流量数据，综合得分不足60分，应该是低优先级",
		},
		{
			name:             "无任何数据",
			globalRank:       nil,
			visits:           nil,
			expectedPriority: PriorityLow,
			description:      "无任何数据，应该是低优先级",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			query := &SiteRankQuery{
				GlobalRank: tc.globalRank,
				Visits:     tc.visits,
			}

			priority := query.CalculatePriority()

			if priority != tc.expectedPriority {
				// 获取详细计算信息用于调试
				details := query.GetPriorityDetails()
				t.Errorf("测试用例 '%s' 失败:\n"+
					"  描述: %s\n"+
					"  期望优先级: %s\n"+
					"  实际优先级: %s\n"+
					"  排名得分: %.2f\n"+
					"  流量得分: %.2f\n"+
					"  综合得分: %.2f\n"+
					"  全球排名: %v\n"+
					"  访问量: %v",
					tc.name, tc.description, tc.expectedPriority, priority,
					details["rank_score"], details["traffic_score"], details["total_score"],
					tc.globalRank, tc.visits)
			} else {
				// 成功的测试用例也打印详细信息
				details := query.GetPriorityDetails()
				t.Logf("✅ 测试用例 '%s' 通过:\n"+
					"  描述: %s\n"+
					"  优先级: %s\n"+
					"  排名得分: %.2f\n"+
					"  流量得分: %.2f\n"+
					"  综合得分: %.2f",
					tc.name, tc.description, priority,
					details["rank_score"], details["traffic_score"], details["total_score"])
			}
		})
	}
}

// TestPriorityScoreCalculation 测试得分计算函数
func TestPriorityScoreCalculation(t *testing.T) {
	t.Run("排名得分计算", func(t *testing.T) {
		testCases := []struct {
			rank     *int
			expected float64
		}{
			{intPtr(1), 100},     // 前100名
			{intPtr(50), 100},    // 前100名
			{intPtr(500), 90},    // 前1000名
			{intPtr(5000), 80},   // 前1万名
			{intPtr(25000), 60},  // 前5万名
			{intPtr(75000), 40},  // 前10万名
			{intPtr(250000), 20}, // 前50万名
			{intPtr(750000), 10}, // 前100万名
			{intPtr(1500000), 5}, // 100万名以后
			{nil, 0},             // 无数据
		}

		for _, tc := range testCases {
			query := &SiteRankQuery{GlobalRank: tc.rank}
			score := query.calculateRankScore()
			if score != tc.expected {
				t.Errorf("排名 %v 的得分应该是 %.0f，实际得到 %.0f", tc.rank, tc.expected, score)
			}
		}
	})

	t.Run("流量得分计算", func(t *testing.T) {
		testCases := []struct {
			visits   *float64
			expected float64
		}{
			{float64Ptr(15000000000), 100}, // 150亿+
			{float64Ptr(8000000000), 100},  // 80亿+
			{float64Ptr(600000000), 95},    // 6亿+
			{float64Ptr(150000000), 90},    // 1.5亿+
			{float64Ptr(75000000), 85},     // 7500万+
			{float64Ptr(15000000), 80},     // 1500万+
			{float64Ptr(7500000), 70},      // 750万+
			{float64Ptr(1500000), 60},      // 150万+
			{float64Ptr(750000), 50},       // 75万+
			{float64Ptr(150000), 40},       // 15万+
			{float64Ptr(75000), 30},        // 7.5万+
			{float64Ptr(15000), 20},        // 1.5万+
			{float64Ptr(1500), 10},         // 1500+
			{float64Ptr(500), 5},           // 500+
			{nil, 0},                       // 无数据
		}

		for _, tc := range testCases {
			query := &SiteRankQuery{Visits: tc.visits}
			score := query.calculateTrafficScore()
			if score != tc.expected {
				t.Errorf("访问量 %v 的得分应该是 %.0f，实际得到 %.0f", tc.visits, tc.expected, score)
			}
		}
	})
}

// TestRealWorldDomains 测试真实域名的优先级计算
func TestRealWorldDomains(t *testing.T) {
	client := NewMockSimilarWebClient()

	testDomains := []struct {
		domain           string
		expectedPriority Priority
	}{
		{"google.com", PriorityHigh},
		{"facebook.com", PriorityHigh},
		{"youtube.com", PriorityHigh},
		{"amazon.com", PriorityHigh},
		{"wikipedia.org", PriorityHigh},
		{"github.com", PriorityHigh},
		{"stackoverflow.com", PriorityMedium},
		{"medium.com", PriorityMedium},
		{"high-traffic-low-rank.com", PriorityLow},
		{"low-traffic-high-rank.com", PriorityMedium},
		{"example.com", PriorityLow},
		{"small-blog.com", PriorityLow},
	}

	for _, tc := range testDomains {
		t.Run(tc.domain, func(t *testing.T) {
			data, err := client.GetDomainRank(tc.domain, "world")
			if err != nil {
				t.Fatalf("获取域名数据失败: %v", err)
			}

			query := &SiteRankQuery{
				Domain:     tc.domain,
				GlobalRank: data.GlobalRank,
				Visits:     data.Visits,
			}

			priority := query.CalculatePriority()
			details := query.GetPriorityDetails()

			if priority != tc.expectedPriority {
				t.Errorf("域名 %s 的优先级计算错误:\n"+
					"  期望: %s\n"+
					"  实际: %s\n"+
					"  排名: %v\n"+
					"  访问量: %v\n"+
					"  排名得分: %.2f\n"+
					"  流量得分: %.2f\n"+
					"  综合得分: %.2f",
					tc.domain, tc.expectedPriority, priority,
					data.GlobalRank, data.Visits,
					details["rank_score"], details["traffic_score"], details["total_score"])
			} else {
				t.Logf("✅ 域名 %s 优先级正确: %s (排名:%v, 访问量:%v, 综合得分:%.2f)",
					tc.domain, priority, data.GlobalRank, data.Visits, details["total_score"])
			}
		})
	}
}

// BenchmarkPriorityCalculation 基准测试优先级计算性能
func BenchmarkImprovedPriorityCalculation(b *testing.B) {
	query := &SiteRankQuery{
		GlobalRank: intPtr(50000),
		Visits:     float64Ptr(1000000),
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		query.CalculatePriority()
	}
}

// ExampleSiteRankQuery_calculatePriority 改进后的优先级计算示例
func ExampleSiteRankQuery_calculatePriority() {
	// 高优先级：高排名 + 高流量
	query1 := &SiteRankQuery{
		GlobalRank: intPtr(10),            // 排名第10
		Visits:     float64Ptr(500000000), // 5亿访问量
	}
	fmt.Println("高排名+高流量:", query1.CalculatePriority())

	// 中优先级：中等排名 + 中等流量
	query2 := &SiteRankQuery{
		GlobalRank: intPtr(5000),        // 排名5000
		Visits:     float64Ptr(2000000), // 200万访问量
	}
	fmt.Println("中等排名+中等流量:", query2.CalculatePriority())

	// 低优先级：低排名 + 低流量
	query3 := &SiteRankQuery{
		GlobalRank: intPtr(500000),    // 排名50万
		Visits:     float64Ptr(10000), // 1万访问量
	}
	fmt.Println("低排名+低流量:", query3.CalculatePriority())

	// Output:
	// 高排名+高流量: High
	// 中等排名+中等流量: Medium
	// 低排名+低流量: Low
}
