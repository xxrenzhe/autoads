package metrics

import (
    "context"
    "fmt"
    "net/http"
    "runtime"
    "strconv"
    "sync"
    "time"

    "github.com/gin-gonic/gin"
    "github.com/prometheus/client_golang/prometheus"
    "github.com/prometheus/client_golang/prometheus/promauto"
    "github.com/prometheus/client_golang/prometheus/promhttp"
    "gofly-admin-v3/internal/cache"
    "gofly-admin-v3/utils/gf"
)

// Metrics 指标收集器
type Metrics struct {
	// HTTP指标
	httpRequestsTotal    *prometheus.CounterVec
	httpRequestDuration  *prometheus.HistogramVec
	httpResponsesSize    *prometheus.HistogramVec
	httpRequestsInFlight prometheus.Gauge

	// 系统指标
	systemMemoryUsage prometheus.Gauge
	systemGoroutines  prometheus.Gauge
	systemCpuUsage    prometheus.Gauge

	// 应用指标
	activeUsers         prometheus.Gauge
	cacheHits           *prometheus.CounterVec
	cacheMisses         *prometheus.CounterVec
	databaseConnections prometheus.Gauge
	databaseLatency     *prometheus.HistogramVec

	// 任务指标
	taskTotal    *prometheus.CounterVec
	taskDuration *prometheus.HistogramVec
	taskFailures *prometheus.CounterVec

	// 错误指标
	errorTotal *prometheus.CounterVec
	panicTotal prometheus.Counter

	// 自定义指标
	customMetrics      map[string]prometheus.Metric
	customMetricsMutex sync.RWMutex
}

var (
	defaultMetrics *Metrics
	metricsInit    bool
)

// NewMetrics 创建指标收集器
func NewMetrics() *Metrics {
	m := &Metrics{
		// HTTP指标
		httpRequestsTotal: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Name: "http_requests_total",
				Help: "Total number of HTTP requests",
			},
			[]string{"method", "endpoint", "status", "handler"},
		),
		httpRequestDuration: promauto.NewHistogramVec(
			prometheus.HistogramOpts{
				Name:    "http_request_duration_seconds",
				Help:    "HTTP request duration in seconds",
				Buckets: prometheus.DefBuckets,
			},
			[]string{"method", "endpoint"},
		),
		httpResponsesSize: promauto.NewHistogramVec(
			prometheus.HistogramOpts{
				Name:    "http_response_size_bytes",
				Help:    "HTTP response size in bytes",
				Buckets: []float64{100, 1000, 10000, 100000, 1000000},
			},
			[]string{"method", "endpoint"},
		),
		httpRequestsInFlight: promauto.NewGauge(prometheus.GaugeOpts{
			Name: "http_requests_in_flight",
			Help: "Current number of HTTP requests being processed",
		}),

		// 系统指标
		systemMemoryUsage: promauto.NewGauge(prometheus.GaugeOpts{
			Name: "system_memory_usage_bytes",
			Help: "Current memory usage in bytes",
		}),
		systemGoroutines: promauto.NewGauge(prometheus.GaugeOpts{
			Name: "system_goroutines",
			Help: "Current number of goroutines",
		}),
		systemCpuUsage: promauto.NewGauge(prometheus.GaugeOpts{
			Name: "system_cpu_usage_percent",
			Help: "Current CPU usage percentage",
		}),

		// 应用指标
		activeUsers: promauto.NewGauge(prometheus.GaugeOpts{
			Name: "app_active_users",
			Help: "Number of active users",
		}),
		cacheHits: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Name: "app_cache_hits_total",
				Help: "Total number of cache hits",
			},
			[]string{"cache_type"},
		),
		cacheMisses: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Name: "app_cache_misses_total",
				Help: "Total number of cache misses",
			},
			[]string{"cache_type"},
		),
		databaseConnections: promauto.NewGauge(prometheus.GaugeOpts{
			Name: "app_database_connections",
			Help: "Number of active database connections",
		}),
		databaseLatency: promauto.NewHistogramVec(
			prometheus.HistogramOpts{
				Name:    "app_database_latency_seconds",
				Help:    "Database query latency in seconds",
				Buckets: []float64{0.001, 0.01, 0.1, 1, 10},
			},
			[]string{"operation", "table"},
		),

		// 任务指标
		taskTotal: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Name: "app_tasks_total",
				Help: "Total number of tasks executed",
			},
			[]string{"task_type", "status"},
		),
		taskDuration: promauto.NewHistogramVec(
			prometheus.HistogramOpts{
				Name:    "app_task_duration_seconds",
				Help:    "Task execution duration in seconds",
				Buckets: prometheus.DefBuckets,
			},
			[]string{"task_type"},
		),
		taskFailures: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Name: "app_task_failures_total",
				Help: "Total number of task failures",
			},
			[]string{"task_type", "error_type"},
		),

		// 错误指标
		errorTotal: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Name: "app_errors_total",
				Help: "Total number of errors",
			},
			[]string{"type", "location"},
		),
		panicTotal: promauto.NewCounter(prometheus.CounterOpts{
			Name: "app_panics_total",
			Help: "Total number of panics",
		}),

		customMetrics: make(map[string]prometheus.Metric),
	}

	// 启动系统指标收集器
	go m.collectSystemMetrics()

	return m
}

// GetMetrics 获取指标收集器
func GetMetrics() *Metrics {
	if !metricsInit {
		defaultMetrics = NewMetrics()
		metricsInit = true
	}
	return defaultMetrics
}

// HTTPMiddleware HTTP指标中间件
func (m *Metrics) HTTPMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		path := c.FullPath()
		if path == "" {
			path = c.Request.URL.Path
		}

		// 增加请求计数
		m.httpRequestsInFlight.Inc()
		defer m.httpRequestsInFlight.Dec()

		// 记录请求开始
		c.Next()

		// 记录指标
		duration := time.Since(start).Seconds()
		status := strconv.Itoa(c.Writer.Status())
		method := c.Request.Method
		handler := c.HandlerName()

		m.httpRequestsTotal.WithLabelValues(method, path, status, handler).Inc()
		m.httpRequestDuration.WithLabelValues(method, path).Observe(duration)
		m.httpResponsesSize.WithLabelValues(method, path).Observe(float64(c.Writer.Size()))
	}
}

// RecordCacheHit 记录缓存命中
func (m *Metrics) RecordCacheHit(cacheType string) {
	m.cacheHits.WithLabelValues(cacheType).Inc()
}

// RecordCacheMiss 记录缓存未命中
func (m *Metrics) RecordCacheMiss(cacheType string) {
	m.cacheMisses.WithLabelValues(cacheType).Inc()
}

// RecordDatabaseQuery 记录数据库查询
func (m *Metrics) RecordDatabaseQuery(operation, table string, duration time.Duration) {
	m.databaseLatency.WithLabelValues(operation, table).Observe(duration.Seconds())
}

// RecordTaskExecution 记录任务执行
func (m *Metrics) RecordTaskExecution(taskType, status string, duration time.Duration) {
	m.taskTotal.WithLabelValues(taskType, status).Inc()
	m.taskDuration.WithLabelValues(taskType).Observe(duration.Seconds())
}

// RecordTaskFailure 记录任务失败
func (m *Metrics) RecordTaskFailure(taskType, errorType string) {
	m.taskFailures.WithLabelValues(taskType, errorType).Inc()
}

// RecordError 记录错误
func (m *Metrics) RecordError(errorType, location string) {
	m.errorTotal.WithLabelValues(errorType, location).Inc()
}

// RecordPanic 记录Panic
func (m *Metrics) RecordPanic() {
	m.panicTotal.Inc()
}

// SetActiveUsers 设置活跃用户数
func (m *Metrics) SetActiveUsers(count int) {
	m.activeUsers.Set(float64(count))
}

// SetDatabaseConnections 设置数据库连接数
func (m *Metrics) SetDatabaseConnections(count int) {
	m.databaseConnections.Set(float64(count))
}

// collectSystemMetrics 收集系统指标
func (m *Metrics) collectSystemMetrics() {
	ticker := time.NewTicker(15 * time.Second)
	defer ticker.Stop()

	var memStats runtime.MemStats

	for {
		select {
		case <-ticker.C:
			// 内存使用
			runtime.ReadMemStats(&memStats)
			m.systemMemoryUsage.Set(float64(memStats.Alloc))

			// Goroutines数量
			m.systemGoroutines.Set(float64(runtime.NumGoroutine()))

			// CPU使用率（简化计算）
			// 实际应用中应该使用更精确的CPU使用率计算
			m.systemCpuUsage.Set(0) // 暂时设为0
		}
	}
}

// RegisterCustomMetric 注册自定义指标
func (m *Metrics) RegisterCustomMetric(name string, metric prometheus.Metric) error {
	m.customMetricsMutex.Lock()
	defer m.customMetricsMutex.Unlock()

	if _, exists := m.customMetrics[name]; exists {
		return fmt.Errorf("metric already exists: %s", name)
	}

	m.customMetrics[name] = metric
	return nil
}

// GetCustomMetric 获取自定义指标
func (m *Metrics) GetCustomMetric(name string) (prometheus.Metric, bool) {
	m.customMetricsMutex.RLock()
	defer m.customMetricsMutex.RUnlock()

	metric, exists := m.customMetrics[name]
	return metric, exists
}

// HealthCheck 健康检查
type HealthCheck struct {
	Name        string
	Status      bool
	Message     string
	CheckFunc   func() (bool, string)
	LastChecked time.Time
}

// HealthChecker 健康检查器
type HealthChecker struct {
	checks map[string]*HealthCheck
	mu     sync.RWMutex
}

var (
	defaultHealthChecker *HealthChecker
	healthInit           bool
)

// NewHealthChecker 创建健康检查器
func NewHealthChecker() *HealthChecker {
	return &HealthChecker{
		checks: make(map[string]*HealthCheck),
	}
}

// GetHealthChecker 获取健康检查器
func GetHealthChecker() *HealthChecker {
	if !healthInit {
		defaultHealthChecker = NewHealthChecker()
		healthInit = true
	}
	return defaultHealthChecker
}

// RegisterCheck 注册健康检查
func (hc *HealthChecker) RegisterCheck(name string, checkFunc func() (bool, string)) {
	hc.mu.Lock()
	defer hc.mu.Unlock()

	hc.checks[name] = &HealthCheck{
		Name:      name,
		CheckFunc: checkFunc,
	}
}

// RunCheck 运行健康检查
func (hc *HealthChecker) RunCheck(name string) (*HealthCheck, error) {
	hc.mu.RLock()
	check, exists := hc.checks[name]
	hc.mu.RUnlock()

	if !exists {
		return nil, fmt.Errorf("health check not found: %s", name)
	}

	status, message := check.CheckFunc()
	check.Status = status
	check.Message = message
	check.LastChecked = time.Now()

	return check, nil
}

// RunAllChecks 运行所有健康检查
func (hc *HealthChecker) RunAllChecks() map[string]*HealthCheck {
	hc.mu.RLock()
	checks := make(map[string]*HealthCheck, len(hc.checks))
	hc.mu.RUnlock()

	for name := range hc.checks {
		if check, err := hc.RunCheck(name); err == nil {
			checks[name] = check
		}
	}

	return checks
}

// GetStatus 获取整体状态
func (hc *HealthChecker) GetStatus() (bool, string) {
	checks := hc.RunAllChecks()

	for _, check := range checks {
		if !check.Status {
			return false, fmt.Sprintf("Health check failed: %s", check.Name)
		}
	}

	return true, "All checks passed"
}

// SetupMetrics 设置指标路由
func SetupMetrics(router *gin.Engine) {
	// Prometheus指标
	router.GET("/metrics", gin.WrapH(promhttp.Handler()))

    // 健康检查
    router.GET("/health", func(c *gin.Context) {
        hc := GetHealthChecker()
        status, message := hc.GetStatus()

        c.JSON(http.StatusOK, gin.H{
            "status":    status,
            "message":   message,
            "timestamp": time.Now(),
        })
    })

    // 数据库健康检查
    router.GET("/health/db", func(c *gin.Context) {
        // 使用GoFly gform 进行简单校验
        ctx := c.Request.Context()
        if _, err := gf.DB().Query(ctx, "SELECT 1"); err != nil {
            c.JSON(http.StatusServiceUnavailable, gin.H{"status": false, "message": "DB not reachable", "error": err.Error()})
            return
        }
        c.JSON(http.StatusOK, gin.H{"status": true, "message": "DB OK"})
    })

    // Redis健康检查
    router.GET("/health/redis", func(c *gin.Context) {
        cacheCli := cache.GetCache()
        key := "health_check"
        if err := cacheCli.Set(key, "ok", 5*time.Second); err != nil {
            c.JSON(http.StatusServiceUnavailable, gin.H{"status": false, "message": "Redis not reachable", "error": err.Error()})
            return
        }
        _ = cacheCli.Delete(key)
        c.JSON(http.StatusOK, gin.H{"status": true, "message": "Redis OK"})
    })

	// 详细健康检查
	router.GET("/health/detail", func(c *gin.Context) {
		hc := GetHealthChecker()
		checks := hc.RunAllChecks()

		c.JSON(http.StatusOK, gin.H{
			"checks":    checks,
			"timestamp": time.Now(),
		})
	})

	// 准备就绪检查
	router.GET("/ready", func(c *gin.Context) {
		// 检查关键依赖

		// 检查缓存
		cache := cache.GetCache()
		err := cache.Set("health_check", "ok", 5*time.Second)
		if err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{
				"status":  "not ready",
				"message": "Cache not available",
			})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"status":    "ready",
			"timestamp": time.Now(),
		})
	})

	// 存活检查
	router.GET("/live", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":    "alive",
			"timestamp": time.Now(),
		})
	})
}

// InitializeDefaultChecks 初始化默认健康检查
func InitializeDefaultChecks() {
    hc := GetHealthChecker()

    // 数据库连接检查
    hc.RegisterCheck("database", func() (bool, string) {
        if _, err := gf.DB().Query(context.Background(), "SELECT 1"); err != nil {
            return false, fmt.Sprintf("Database connection failed: %v", err)
        }
        return true, "Database connection OK"
    })

	// Redis连接检查
	hc.RegisterCheck("redis", func() (bool, string) {
		cache := cache.GetCache()
		err := cache.Set("health_check", "ok", 5*time.Second)
		if err != nil {
			return false, fmt.Sprintf("Redis connection failed: %v", err)
		}
		return true, "Redis connection OK"
	})

	// 磁盘空间检查
	hc.RegisterCheck("disk", func() (bool, string) {
		// TODO: 实现磁盘空间检查
		return true, "Disk space OK"
	})

	// 内存使用检查
	hc.RegisterCheck("memory", func() (bool, string) {
		var m runtime.MemStats
		runtime.ReadMemStats(&m)

		// 检查是否超过90%内存使用
		if m.Alloc > 0 && m.Sys > 0 && float64(m.Alloc)/float64(m.Sys) > 0.9 {
			return false, fmt.Sprintf("High memory usage: %.2f%%", float64(m.Alloc)/float64(m.Sys)*100)
		}
		return true, "Memory usage OK"
	})
}
