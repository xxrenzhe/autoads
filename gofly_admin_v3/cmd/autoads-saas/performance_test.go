package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"runtime"
	"sort"
	"sync"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestPerformanceValidation 性能测试专项
func TestPerformanceValidation(t *testing.T) {
	gin.SetMode(gin.TestMode)
	app := NewTestAutoAdsSaaSApp()
	server := httptest.NewServer(app.Router)
	defer server.Close()

	t.Run("并发性能测试", func(t *testing.T) {
		testConcurrentPerformance(t, server.URL)
	})

	t.Run("响应时间测试", func(t *testing.T) {
		testResponseTime(t, server.URL)
	})

	t.Run("吞吐量测试", func(t *testing.T) {
		testThroughput(t, server.URL)
	})

	t.Run("内存使用测试", func(t *testing.T) {
		testMemoryUsage(t, server.URL)
	})

	t.Run("负载测试", func(t *testing.T) {
		testLoadTesting(t, server.URL)
	})
}

// PerformanceMetrics 性能指标
type PerformanceMetrics struct {
	TotalRequests   int
	SuccessRequests int
	FailedRequests  int
	ResponseTimes   []time.Duration
	MinResponseTime time.Duration
	MaxResponseTime time.Duration
	AvgResponseTime time.Duration
	P50ResponseTime time.Duration
	P95ResponseTime time.Duration
	P99ResponseTime time.Duration
	QPS             float64
	ErrorRate       float64
	TotalDuration   time.Duration
}

// calculateMetrics 计算性能指标
func calculateMetrics(responseTimes []time.Duration, totalDuration time.Duration, errorCount int) PerformanceMetrics {
	if len(responseTimes) == 0 {
		return PerformanceMetrics{}
	}

	// 排序响应时间
	sort.Slice(responseTimes, func(i, j int) bool {
		return responseTimes[i] < responseTimes[j]
	})

	totalRequests := len(responseTimes) + errorCount
	successRequests := len(responseTimes)

	// 计算统计值
	var totalTime time.Duration
	for _, rt := range responseTimes {
		totalTime += rt
	}

	metrics := PerformanceMetrics{
		TotalRequests:   totalRequests,
		SuccessRequests: successRequests,
		FailedRequests:  errorCount,
		ResponseTimes:   responseTimes,
		MinResponseTime: responseTimes[0],
		MaxResponseTime: responseTimes[len(responseTimes)-1],
		AvgResponseTime: totalTime / time.Duration(len(responseTimes)),
		TotalDuration:   totalDuration,
		QPS:             float64(successRequests) / totalDuration.Seconds(),
		ErrorRate:       float64(errorCount) / float64(totalRequests) * 100,
	}

	// 计算百分位数
	if len(responseTimes) > 0 {
		metrics.P50ResponseTime = responseTimes[len(responseTimes)*50/100]
		metrics.P95ResponseTime = responseTimes[len(responseTimes)*95/100]
		metrics.P99ResponseTime = responseTimes[len(responseTimes)*99/100]
	}

	return metrics
}

// testConcurrentPerformance 测试并发性能 - 50并发用户，P95响应时间<200ms
func testConcurrentPerformance(t *testing.T, baseURL string) {
	t.Run("50并发用户健康检查", func(t *testing.T) {
		concurrency := 50
		requestsPerUser := 20
		totalRequests := concurrency * requestsPerUser

		var wg sync.WaitGroup
		responseTimes := make([]time.Duration, 0, totalRequests)
		var responseTimesMutex sync.Mutex
		errorCount := 0
		var errorMutex sync.Mutex

		startTime := time.Now()

		for i := 0; i < concurrency; i++ {
			wg.Add(1)
			go func(userID int) {
				defer wg.Done()

				client := &http.Client{Timeout: 10 * time.Second}

				for j := 0; j < requestsPerUser; j++ {
					requestStart := time.Now()
					resp, err := client.Get(baseURL + "/health")
					requestDuration := time.Since(requestStart)

					if err != nil {
						errorMutex.Lock()
						errorCount++
						errorMutex.Unlock()
						continue
					}

					resp.Body.Close()

					if resp.StatusCode == 200 {
						responseTimesMutex.Lock()
						responseTimes = append(responseTimes, requestDuration)
						responseTimesMutex.Unlock()
					} else {
						errorMutex.Lock()
						errorCount++
						errorMutex.Unlock()
					}
				}
			}(i)
		}

		wg.Wait()
		totalDuration := time.Since(startTime)

		// 计算性能指标
		metrics := calculateMetrics(responseTimes, totalDuration, errorCount)

		// 输出性能报告
		t.Logf("=== 50并发用户健康检查性能报告 ===")
		t.Logf("总请求数: %d", metrics.TotalRequests)
		t.Logf("成功请求: %d", metrics.SuccessRequests)
		t.Logf("失败请求: %d", metrics.FailedRequests)
		t.Logf("错误率: %.2f%%", metrics.ErrorRate)
		t.Logf("总耗时: %v", metrics.TotalDuration)
		t.Logf("QPS: %.2f", metrics.QPS)
		t.Logf("最小响应时间: %v", metrics.MinResponseTime)
		t.Logf("最大响应时间: %v", metrics.MaxResponseTime)
		t.Logf("平均响应时间: %v", metrics.AvgResponseTime)
		t.Logf("P50响应时间: %v", metrics.P50ResponseTime)
		t.Logf("P95响应时间: %v", metrics.P95ResponseTime)
		t.Logf("P99响应时间: %v", metrics.P99ResponseTime)

		// 验证性能要求
		assert.Less(t, metrics.P95ResponseTime, 200*time.Millisecond, "P95响应时间应小于200ms")
		assert.Less(t, metrics.ErrorRate, 1.0, "错误率应小于1%")
		assert.Greater(t, metrics.QPS, 100.0, "QPS应大于100")
		assert.Greater(t, metrics.SuccessRequests, totalRequests*90/100, "成功率应大于90%")
	})

	t.Run("50并发用户API测试", func(t *testing.T) {
		concurrency := 50
		requestsPerUser := 10

		endpoints := []string{
			"/api/siterank/rank?domain=performance-test.com",
			"/api/batchopen/tasks",
			"/metrics",
		}

		for _, endpoint := range endpoints {
			t.Run(endpoint, func(t *testing.T) {
				var wg sync.WaitGroup
				responseTimes := make([]time.Duration, 0, concurrency*requestsPerUser)
				var responseTimesMutex sync.Mutex
				errorCount := 0
				var errorMutex sync.Mutex

				startTime := time.Now()

				for i := 0; i < concurrency; i++ {
					wg.Add(1)
					go func() {
						defer wg.Done()

						client := &http.Client{Timeout: 10 * time.Second}

						for j := 0; j < requestsPerUser; j++ {
							requestStart := time.Now()
							resp, err := client.Get(baseURL + endpoint)
							requestDuration := time.Since(requestStart)

							if err != nil {
								errorMutex.Lock()
								errorCount++
								errorMutex.Unlock()
								continue
							}

							resp.Body.Close()

							if resp.StatusCode == 200 {
								responseTimesMutex.Lock()
								responseTimes = append(responseTimes, requestDuration)
								responseTimesMutex.Unlock()
							} else {
								errorMutex.Lock()
								errorCount++
								errorMutex.Unlock()
							}
						}
					}()
				}

				wg.Wait()
				totalDuration := time.Since(startTime)

				metrics := calculateMetrics(responseTimes, totalDuration, errorCount)

				t.Logf("=== %s 性能指标 ===", endpoint)
				t.Logf("P95响应时间: %v", metrics.P95ResponseTime)
				t.Logf("QPS: %.2f", metrics.QPS)
				t.Logf("错误率: %.2f%%", metrics.ErrorRate)

				// 验证性能要求
				assert.Less(t, metrics.P95ResponseTime, 500*time.Millisecond, fmt.Sprintf("%s P95响应时间应小于500ms", endpoint))
				assert.Less(t, metrics.ErrorRate, 5.0, fmt.Sprintf("%s 错误率应小于5%%", endpoint))
			})
		}
	})
}

// testResponseTime 测试响应时间
func testResponseTime(t *testing.T, baseURL string) {
	client := &http.Client{Timeout: 10 * time.Second}

	endpoints := []struct {
		name    string
		path    string
		method  string
		payload map[string]interface{}
		maxTime time.Duration
	}{
		{
			name:    "健康检查",
			path:    "/health",
			method:  "GET",
			maxTime: 50 * time.Millisecond,
		},
		{
			name:    "指标接口",
			path:    "/metrics",
			method:  "GET",
			maxTime: 100 * time.Millisecond,
		},
		{
			name:    "API文档",
			path:    "/api/docs/swagger.json",
			method:  "GET",
			maxTime: 200 * time.Millisecond,
		},
		{
			name:    "SiteRank查询",
			path:    "/api/siterank/rank?domain=example.com",
			method:  "GET",
			maxTime: 300 * time.Millisecond,
		},
		{
			name:   "BatchGo任务创建",
			path:   "/api/batchopen/silent-start",
			method: "POST",
			payload: map[string]interface{}{
				"name": "性能测试任务",
				"urls": []string{"https://example.com"},
			},
			maxTime: 200 * time.Millisecond,
		},
	}

	for _, endpoint := range endpoints {
		t.Run(endpoint.name, func(t *testing.T) {
			// 预热请求
			for i := 0; i < 3; i++ {
				var resp *http.Response
				var err error

				if endpoint.method == "GET" {
					resp, err = client.Get(baseURL + endpoint.path)
				} else if endpoint.method == "POST" {
					jsonData, _ := json.Marshal(endpoint.payload)
					resp, err = client.Post(baseURL+endpoint.path, "application/json", bytes.NewBuffer(jsonData))
				}

				if err == nil && resp != nil {
					resp.Body.Close()
				}
			}

			// 实际测试
			var responseTimes []time.Duration

			for i := 0; i < 10; i++ {
				start := time.Now()

				var resp *http.Response
				var err error

				if endpoint.method == "GET" {
					resp, err = client.Get(baseURL + endpoint.path)
				} else if endpoint.method == "POST" {
					jsonData, _ := json.Marshal(endpoint.payload)
					resp, err = client.Post(baseURL+endpoint.path, "application/json", bytes.NewBuffer(jsonData))
				}

				duration := time.Since(start)

				require.NoError(t, err)
				require.NotNil(t, resp)
				defer resp.Body.Close()

				responseTimes = append(responseTimes, duration)
			}

			// 计算平均响应时间
			var totalTime time.Duration
			for _, rt := range responseTimes {
				totalTime += rt
			}
			avgTime := totalTime / time.Duration(len(responseTimes))

			t.Logf("%s 平均响应时间: %v (要求: <%v)", endpoint.name, avgTime, endpoint.maxTime)

			assert.Less(t, avgTime, endpoint.maxTime, fmt.Sprintf("%s 平均响应时间应小于 %v", endpoint.name, endpoint.maxTime))
		})
	}
}

// testThroughput 测试吞吐量
func testThroughput(t *testing.T, baseURL string) {
	t.Run("健康检查吞吐量", func(t *testing.T) {
		duration := 10 * time.Second
		concurrency := 20

		ctx, cancel := context.WithTimeout(context.Background(), duration)
		defer cancel()

		var wg sync.WaitGroup
		var totalRequests int64
		var successRequests int64
		var requestsMutex sync.Mutex

		for i := 0; i < concurrency; i++ {
			wg.Add(1)
			go func() {
				defer wg.Done()

				client := &http.Client{Timeout: 5 * time.Second}

				for {
					select {
					case <-ctx.Done():
						return
					default:
						resp, err := client.Get(baseURL + "/health")

						requestsMutex.Lock()
						totalRequests++
						if err == nil && resp != nil && resp.StatusCode == 200 {
							successRequests++
						}
						requestsMutex.Unlock()

						if resp != nil {
							resp.Body.Close()
						}
					}
				}
			}()
		}

		wg.Wait()

		qps := float64(successRequests) / duration.Seconds()
		successRate := float64(successRequests) / float64(totalRequests) * 100

		t.Logf("吞吐量测试结果:")
		t.Logf("  测试时长: %v", duration)
		t.Logf("  并发数: %d", concurrency)
		t.Logf("  总请求数: %d", totalRequests)
		t.Logf("  成功请求数: %d", successRequests)
		t.Logf("  QPS: %.2f", qps)
		t.Logf("  成功率: %.2f%%", successRate)

		assert.Greater(t, qps, 500.0, "QPS应大于500")
		assert.Greater(t, successRate, 95.0, "成功率应大于95%")
	})

	t.Run("API混合负载吞吐量", func(t *testing.T) {
		duration := 15 * time.Second
		concurrency := 30

		endpoints := []string{
			"/health",
			"/api/siterank/rank?domain=throughput-test.com",
			"/metrics",
		}

		ctx, cancel := context.WithTimeout(context.Background(), duration)
		defer cancel()

		var wg sync.WaitGroup
		endpointStats := make(map[string]struct {
			total   int64
			success int64
		})
		var statsMutex sync.Mutex

		for _, endpoint := range endpoints {
			endpointStats[endpoint] = struct {
				total   int64
				success int64
			}{}
		}

		for i := 0; i < concurrency; i++ {
			wg.Add(1)
			go func(workerID int) {
				defer wg.Done()

				client := &http.Client{Timeout: 5 * time.Second}
				endpointIndex := 0

				for {
					select {
					case <-ctx.Done():
						return
					default:
						endpoint := endpoints[endpointIndex%len(endpoints)]
						endpointIndex++

						resp, err := client.Get(baseURL + endpoint)

						statsMutex.Lock()
						stats := endpointStats[endpoint]
						stats.total++
						if err == nil && resp != nil && resp.StatusCode == 200 {
							stats.success++
						}
						endpointStats[endpoint] = stats
						statsMutex.Unlock()

						if resp != nil {
							resp.Body.Close()
						}
					}
				}
			}(i)
		}

		wg.Wait()

		t.Logf("混合负载吞吐量测试结果:")
		var totalRequests, totalSuccess int64

		for endpoint, stats := range endpointStats {
			qps := float64(stats.success) / duration.Seconds()
			successRate := float64(stats.success) / float64(stats.total) * 100

			t.Logf("  %s:", endpoint)
			t.Logf("    总请求: %d", stats.total)
			t.Logf("    成功请求: %d", stats.success)
			t.Logf("    QPS: %.2f", qps)
			t.Logf("    成功率: %.2f%%", successRate)

			totalRequests += stats.total
			totalSuccess += stats.success
		}

		overallQPS := float64(totalSuccess) / duration.Seconds()
		overallSuccessRate := float64(totalSuccess) / float64(totalRequests) * 100

		t.Logf("  总体:")
		t.Logf("    总QPS: %.2f", overallQPS)
		t.Logf("    总体成功率: %.2f%%", overallSuccessRate)

		assert.Greater(t, overallQPS, 300.0, "总体QPS应大于300")
		assert.Greater(t, overallSuccessRate, 90.0, "总体成功率应大于90%")
	})
}

// testMemoryUsage 测试内存使用
func testMemoryUsage(t *testing.T, baseURL string) {
	t.Run("内存泄漏测试", func(t *testing.T) {
		// 获取初始内存统计
		var initialStats runtime.MemStats
		runtime.GC()
		runtime.ReadMemStats(&initialStats)

		client := &http.Client{Timeout: 5 * time.Second}

		// 执行大量请求
		for i := 0; i < 10000; i++ {
			resp, err := client.Get(baseURL + "/health")
			if err == nil && resp != nil {
				io.Copy(io.Discard, resp.Body)
				resp.Body.Close()
			}

			// 每1000次请求检查一次内存
			if i%1000 == 999 {
				runtime.GC()
				var currentStats runtime.MemStats
				runtime.ReadMemStats(&currentStats)

				memoryIncrease := currentStats.Alloc - initialStats.Alloc
				t.Logf("请求 %d: 内存增长 %d bytes", i+1, memoryIncrease)

				// 内存增长不应超过100MB
				assert.Less(t, memoryIncrease, uint64(100*1024*1024), "内存增长过多，可能存在内存泄漏")
			}
		}

		// 最终内存检查
		runtime.GC()
		var finalStats runtime.MemStats
		runtime.ReadMemStats(&finalStats)

		finalMemoryIncrease := finalStats.Alloc - initialStats.Alloc
		t.Logf("最终内存增长: %d bytes", finalMemoryIncrease)

		// 最终内存增长不应超过50MB
		assert.Less(t, finalMemoryIncrease, uint64(50*1024*1024), "最终内存增长过多")
	})

	t.Run("并发内存使用", func(t *testing.T) {
		var initialStats runtime.MemStats
		runtime.GC()
		runtime.ReadMemStats(&initialStats)

		concurrency := 100
		requestsPerWorker := 100

		var wg sync.WaitGroup

		for i := 0; i < concurrency; i++ {
			wg.Add(1)
			go func() {
				defer wg.Done()

				client := &http.Client{Timeout: 5 * time.Second}

				for j := 0; j < requestsPerWorker; j++ {
					resp, err := client.Get(baseURL + "/health")
					if err == nil && resp != nil {
						io.Copy(io.Discard, resp.Body)
						resp.Body.Close()
					}
				}
			}()
		}

		wg.Wait()

		runtime.GC()
		var finalStats runtime.MemStats
		runtime.ReadMemStats(&finalStats)

		memoryIncrease := finalStats.Alloc - initialStats.Alloc
		t.Logf("并发测试内存增长: %d bytes", memoryIncrease)

		// 并发测试后内存增长不应超过100MB
		assert.Less(t, memoryIncrease, uint64(100*1024*1024), "并发测试内存增长过多")
	})
}

// testLoadTesting 测试负载
func testLoadTesting(t *testing.T, baseURL string) {
	t.Run("阶梯负载测试", func(t *testing.T) {
		stages := []struct {
			concurrency int
			duration    time.Duration
		}{
			{10, 30 * time.Second},
			{25, 30 * time.Second},
			{50, 30 * time.Second},
			{75, 30 * time.Second},
			{100, 30 * time.Second},
		}

		for _, stage := range stages {
			t.Run(fmt.Sprintf("并发%d", stage.concurrency), func(t *testing.T) {
				ctx, cancel := context.WithTimeout(context.Background(), stage.duration)
				defer cancel()

				var wg sync.WaitGroup
				var totalRequests int64
				var successRequests int64
				var responseTimes []time.Duration
				var responseTimesMutex sync.Mutex
				var requestsMutex sync.Mutex

				for i := 0; i < stage.concurrency; i++ {
					wg.Add(1)
					go func() {
						defer wg.Done()

						client := &http.Client{Timeout: 10 * time.Second}

						for {
							select {
							case <-ctx.Done():
								return
							default:
								start := time.Now()
								resp, err := client.Get(baseURL + "/health")
								duration := time.Since(start)

								requestsMutex.Lock()
								totalRequests++
								if err == nil && resp != nil && resp.StatusCode == 200 {
									successRequests++
									responseTimesMutex.Lock()
									responseTimes = append(responseTimes, duration)
									responseTimesMutex.Unlock()
								}
								requestsMutex.Unlock()

								if resp != nil {
									resp.Body.Close()
								}
							}
						}
					}()
				}

				wg.Wait()

				if len(responseTimes) > 0 {
					metrics := calculateMetrics(responseTimes, stage.duration, int(totalRequests-successRequests))

					t.Logf("并发%d 负载测试结果:", stage.concurrency)
					t.Logf("  QPS: %.2f", metrics.QPS)
					t.Logf("  P95响应时间: %v", metrics.P95ResponseTime)
					t.Logf("  错误率: %.2f%%", metrics.ErrorRate)

					// 验证性能要求随并发数调整
					maxP95 := time.Duration(200+stage.concurrency*2) * time.Millisecond
					assert.Less(t, metrics.P95ResponseTime, maxP95, fmt.Sprintf("并发%d时P95响应时间应小于%v", stage.concurrency, maxP95))
					assert.Less(t, metrics.ErrorRate, 5.0, "错误率应小于5%")
				}
			})
		}
	})

	t.Run("峰值负载测试", func(t *testing.T) {
		peakConcurrency := 200
		duration := 60 * time.Second

		ctx, cancel := context.WithTimeout(context.Background(), duration)
		defer cancel()

		var wg sync.WaitGroup
		var totalRequests int64
		var successRequests int64
		var responseTimes []time.Duration
		var responseTimesMutex sync.Mutex
		var requestsMutex sync.Mutex

		t.Logf("开始峰值负载测试: 并发%d, 持续%v", peakConcurrency, duration)

		for i := 0; i < peakConcurrency; i++ {
			wg.Add(1)
			go func() {
				defer wg.Done()

				client := &http.Client{Timeout: 15 * time.Second}

				for {
					select {
					case <-ctx.Done():
						return
					default:
						start := time.Now()
						resp, err := client.Get(baseURL + "/health")
						responseTime := time.Since(start)

						requestsMutex.Lock()
						totalRequests++
						if err == nil && resp != nil && resp.StatusCode == 200 {
							successRequests++
							responseTimesMutex.Lock()
							responseTimes = append(responseTimes, responseTime)
							responseTimesMutex.Unlock()
						}
						requestsMutex.Unlock()

						if resp != nil {
							resp.Body.Close()
						}
					}
				}
			}()
		}

		wg.Wait()

		if len(responseTimes) > 0 {
			metrics := calculateMetrics(responseTimes, duration, int(totalRequests-successRequests))

			t.Logf("峰值负载测试结果:")
			t.Logf("  并发数: %d", peakConcurrency)
			t.Logf("  测试时长: %v", duration)
			t.Logf("  总请求数: %d", metrics.TotalRequests)
			t.Logf("  成功请求数: %d", metrics.SuccessRequests)
			t.Logf("  QPS: %.2f", metrics.QPS)
			t.Logf("  平均响应时间: %v", metrics.AvgResponseTime)
			t.Logf("  P95响应时间: %v", metrics.P95ResponseTime)
			t.Logf("  P99响应时间: %v", metrics.P99ResponseTime)
			t.Logf("  错误率: %.2f%%", metrics.ErrorRate)

			// 峰值负载下的性能要求
			assert.Greater(t, metrics.QPS, 100.0, "峰值负载下QPS应大于100")
			assert.Less(t, metrics.P95ResponseTime, 1*time.Second, "峰值负载下P95响应时间应小于1秒")
			assert.Less(t, metrics.ErrorRate, 10.0, "峰值负载下错误率应小于10%")
		}
	})
}

// BenchmarkAPIPerformance API性能基准测试
func BenchmarkAPIPerformance(b *testing.B) {
	gin.SetMode(gin.TestMode)
	app := NewTestAutoAdsSaaSApp()
	server := httptest.NewServer(app.Router)
	defer server.Close()

	client := &http.Client{Timeout: 10 * time.Second}

	b.Run("HealthCheck", func(b *testing.B) {
		b.ResetTimer()
		b.RunParallel(func(pb *testing.PB) {
			for pb.Next() {
				resp, err := client.Get(server.URL + "/health")
				if err != nil {
					b.Fatal(err)
				}
				resp.Body.Close()
			}
		})
	})

	b.Run("SiteRankQuery", func(b *testing.B) {
		b.ResetTimer()
		b.RunParallel(func(pb *testing.PB) {
			for pb.Next() {
				resp, err := client.Get(server.URL + "/api/siterank/rank?domain=benchmark.com")
				if err != nil {
					b.Fatal(err)
				}
				resp.Body.Close()
			}
		})
	})

	b.Run("BatchGoTaskList", func(b *testing.B) {
		b.ResetTimer()
		b.RunParallel(func(pb *testing.PB) {
			for pb.Next() {
				resp, err := client.Get(server.URL + "/api/batchopen/tasks")
				if err != nil {
					b.Fatal(err)
				}
				resp.Body.Close()
			}
		})
	})

	b.Run("MetricsEndpoint", func(b *testing.B) {
		b.ResetTimer()
		b.RunParallel(func(pb *testing.PB) {
			for pb.Next() {
				resp, err := client.Get(server.URL + "/metrics")
				if err != nil {
					b.Fatal(err)
				}
				resp.Body.Close()
			}
		})
	})
}
