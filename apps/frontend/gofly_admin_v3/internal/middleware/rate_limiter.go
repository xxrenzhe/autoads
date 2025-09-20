package middleware

import (
	"fmt"
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v8"
	"golang.org/x/time/rate"
)

// RateLimiter 限流器接口
type RateLimiter interface {
	Allow(key string) bool
	GetRemaining(key string) int
	GetResetTime(key string) time.Time
}

// MemoryRateLimiter 内存限流器
type MemoryRateLimiter struct {
	limiters map[string]*rate.Limiter
	mu       sync.RWMutex
	rate     rate.Limit
	burst    int
}

// NewMemoryRateLimiter 创建内存限流器
func NewMemoryRateLimiter(rps float64, burst int) *MemoryRateLimiter {
	return &MemoryRateLimiter{
		limiters: make(map[string]*rate.Limiter),
		rate:     rate.Limit(rps),
		burst:    burst,
	}
}

// Allow 检查是否允许请求
func (m *MemoryRateLimiter) Allow(key string) bool {
	m.mu.Lock()
	defer m.mu.Unlock()

	limiter, exists := m.limiters[key]
	if !exists {
		limiter = rate.NewLimiter(m.rate, m.burst)
		m.limiters[key] = limiter
	}

	return limiter.Allow()
}

// GetRemaining 获取剩余请求数
func (m *MemoryRateLimiter) GetRemaining(key string) int {
	m.mu.RLock()
	defer m.mu.RUnlock()

	limiter, exists := m.limiters[key]
	if !exists {
		return m.burst
	}

	return int(limiter.Tokens())
}

// GetResetTime 获取重置时间
func (m *MemoryRateLimiter) GetResetTime(key string) time.Time {
	// 简化实现，返回下一分钟的开始时间
	now := time.Now()
	return time.Date(now.Year(), now.Month(), now.Day(), now.Hour(), now.Minute()+1, 0, 0, now.Location())
}

// RedisRateLimiter Redis限流器
type RedisRateLimiter struct {
	client *redis.Client
	window time.Duration
	limit  int
}

// NewRedisRateLimiter 创建Redis限流器
func NewRedisRateLimiter(client *redis.Client, window time.Duration, limit int) *RedisRateLimiter {
	return &RedisRateLimiter{
		client: client,
		window: window,
		limit:  limit,
	}
}

// Allow 检查是否允许请求
func (r *RedisRateLimiter) Allow(key string) bool {
	ctx := r.client.Context()

	// 使用滑动窗口算法
	now := time.Now().Unix()
	windowStart := now - int64(r.window.Seconds())

	pipe := r.client.Pipeline()

	// 删除窗口外的记录
	pipe.ZRemRangeByScore(ctx, key, "0", strconv.FormatInt(windowStart, 10))

	// 添加当前请求
	pipe.ZAdd(ctx, key, &redis.Z{Score: float64(now), Member: now})

	// 获取当前窗口内的请求数
	pipe.ZCard(ctx, key)

	// 设置过期时间
	pipe.Expire(ctx, key, r.window)

	results, err := pipe.Exec(ctx)
	if err != nil {
		return false
	}

	// 获取请求数
	count := results[2].(*redis.IntCmd).Val()

	return count <= int64(r.limit)
}

// GetRemaining 获取剩余请求数
func (r *RedisRateLimiter) GetRemaining(key string) int {
	ctx := r.client.Context()

	now := time.Now().Unix()
	windowStart := now - int64(r.window.Seconds())

	count, err := r.client.ZCount(ctx, key, strconv.FormatInt(windowStart, 10), "+inf").Result()
	if err != nil {
		return r.limit
	}

	remaining := r.limit - int(count)
	if remaining < 0 {
		return 0
	}

	return remaining
}

// GetResetTime 获取重置时间
func (r *RedisRateLimiter) GetResetTime(key string) time.Time {
	return time.Now().Add(r.window)
}

// RateLimitConfig 限流配置
type RateLimitConfig struct {
	// 全局限流
	GlobalRPS   float64
	GlobalBurst int

	// 用户限流
	UserRPS   float64
	UserBurst int

	// IP限流
	IPRPS   float64
	IPBurst int

	// API限流
	APIRPS   float64
	APIBurst int

	// 使用Redis
	UseRedis bool
	Window   time.Duration
}

// RateLimitMiddleware 限流中间件
type RateLimitMiddleware struct {
    globalLimiter RateLimiter
    userLimiter   RateLimiter
    ipLimiter     RateLimiter
    apiLimiter    RateLimiter
    config        RateLimitConfig
    // plan-based
    planLimiters map[string]RateLimiter
    planWindow   time.Duration
    planRates    map[string]PlanRateConfig
}

// NewRateLimitMiddleware 创建限流中间件
func NewRateLimitMiddleware(config RateLimitConfig, redisClient *redis.Client) *RateLimitMiddleware {
    middleware := &RateLimitMiddleware{
        config: config,
    }

	if config.UseRedis && redisClient != nil {
		// 使用Redis限流器
		middleware.globalLimiter = NewRedisRateLimiter(redisClient, config.Window, int(config.GlobalRPS*config.Window.Seconds()))
		middleware.userLimiter = NewRedisRateLimiter(redisClient, config.Window, int(config.UserRPS*config.Window.Seconds()))
		middleware.ipLimiter = NewRedisRateLimiter(redisClient, config.Window, int(config.IPRPS*config.Window.Seconds()))
		middleware.apiLimiter = NewRedisRateLimiter(redisClient, config.Window, int(config.APIRPS*config.Window.Seconds()))
	} else {
		// 使用内存限流器
		middleware.globalLimiter = NewMemoryRateLimiter(config.GlobalRPS, config.GlobalBurst)
		middleware.userLimiter = NewMemoryRateLimiter(config.UserRPS, config.UserBurst)
		middleware.ipLimiter = NewMemoryRateLimiter(config.IPRPS, config.IPBurst)
		middleware.apiLimiter = NewMemoryRateLimiter(config.APIRPS, config.APIBurst)
	}

    return middleware
}

// PlanRateConfig 每个套餐的限流配置（按 RPS/Burst）
type PlanRateConfig struct {
    RPS   float64
    Burst int
}

// SetPlanRates 初始化套餐限流器
func (m *RateLimitMiddleware) SetPlanRates(rates map[string]PlanRateConfig, redisClient *redis.Client) {
    m.planLimiters = make(map[string]RateLimiter)
    m.planRates = make(map[string]PlanRateConfig)
    if m.config.UseRedis && redisClient != nil {
        m.planWindow = m.config.Window
        for plan, r := range rates {
            m.planLimiters[plan] = NewRedisRateLimiter(redisClient, m.planWindow, int(r.RPS*m.planWindow.Seconds()))
            m.planRates[plan] = r
        }
    } else {
        for plan, r := range rates {
            m.planLimiters[plan] = NewMemoryRateLimiter(r.RPS, r.Burst)
            m.planRates[plan] = r
        }
    }
}

// GlobalRateLimit 全局限流
func (m *RateLimitMiddleware) GlobalRateLimit() gin.HandlerFunc {
    return func(c *gin.Context) {
        key := "global"
        if !m.globalLimiter.Allow(key) {
            m.handleRateLimit(c, key, m.globalLimiter)
            return
        }
        // 成功也输出限流头
        m.writeHeaders(c, key, m.globalLimiter, int(m.config.Window.Seconds()*m.config.GlobalRPS))
        c.Next()
    }
}

// UserRateLimit 用户限流
func (m *RateLimitMiddleware) UserRateLimit() gin.HandlerFunc {
    return func(c *gin.Context) {
        userID := c.GetString("user_id")
        if userID == "" {
            if v, ok := c.Get("userID"); ok {
                switch vv := v.(type) {
                case string:
                    userID = vv
                case int64:
                    userID = strconv.FormatInt(vv, 10)
                case int:
                    userID = strconv.Itoa(vv)
                default:
                    userID = fmt.Sprint(vv)
                }
            }
        }
        if userID == "" {
            c.Next()
            return
        }

        key := fmt.Sprintf("user:%s", userID)
        if !m.userLimiter.Allow(key) {
            m.handleRateLimit(c, key, m.userLimiter)
            return
        }
        m.writeHeaders(c, key, m.userLimiter, int(m.config.Window.Seconds()*m.config.UserRPS))
        c.Next()
    }
}

// IPRateLimit IP限流
func (m *RateLimitMiddleware) IPRateLimit() gin.HandlerFunc {
    return func(c *gin.Context) {
        ip := c.ClientIP()
        key := fmt.Sprintf("ip:%s", ip)

        if !m.ipLimiter.Allow(key) {
            m.handleRateLimit(c, key, m.ipLimiter)
            return
        }
        m.writeHeaders(c, key, m.ipLimiter, int(m.config.Window.Seconds()*m.config.IPRPS))
        c.Next()
    }
}

// APIRateLimit API限流
func (m *RateLimitMiddleware) APIRateLimit() gin.HandlerFunc {
    return func(c *gin.Context) {
        path := c.Request.URL.Path
        method := c.Request.Method
        key := fmt.Sprintf("api:%s:%s", method, path)

        if !m.apiLimiter.Allow(key) {
            m.handleRateLimit(c, key, m.apiLimiter)
            return
        }
        m.writeHeaders(c, key, m.apiLimiter, int(m.config.Window.Seconds()*m.config.APIRPS))
        c.Next()
    }
}

// CustomRateLimit 自定义限流
func (m *RateLimitMiddleware) CustomRateLimit(keyFunc func(*gin.Context) string, limiter RateLimiter) gin.HandlerFunc {
	return func(c *gin.Context) {
		key := keyFunc(c)
		if key == "" {
			c.Next()
			return
		}

		if !limiter.Allow(key) {
			m.handleRateLimit(c, key, limiter)
			return
		}
		c.Next()
	}
}

// PlanAPIRateLimit 按套餐对 API 进行限流
// planResolver 从上下文解析套餐名（例如从 Header: X-User-Plan 或 用户上下文/角色）
func (m *RateLimitMiddleware) PlanAPIRateLimit(planResolver func(*gin.Context) string) gin.HandlerFunc {
    return func(c *gin.Context) {
        if len(m.planLimiters) == 0 {
            c.Next()
            return
        }
        plan := planResolver(c)
        if plan == "" {
            plan = "FREE"
        }
        limiter, ok := m.planLimiters[plan]
        if !ok {
            // fallback
            if l, ok2 := m.planLimiters["FREE"]; ok2 {
                limiter = l
            } else {
                c.Next()
                return
            }
        }
        // 标记选用的套餐策略，便于前端/运维观测
        c.Header("X-RateLimit-Plan", plan)
        c.Header("X-RateLimit-Policy", "plan")
        method := c.Request.Method
        path := c.Request.URL.Path
        key := fmt.Sprintf("plan:%s:%s:%s", plan, method, path)
        if !limiter.Allow(key) {
            m.handleRateLimit(c, key, limiter)
            return
        }
        // 使用该套餐配置的 RPS*Window 作为 Limit 值
        limVal := int(m.config.Window.Seconds() * m.config.APIRPS)
        if pr, ok := m.planRates[plan]; ok {
            limVal = int(m.config.Window.Seconds() * pr.RPS)
        }
        m.writeHeaders(c, key, limiter, limVal)
        c.Next()
    }
}

// handleRateLimit 处理限流
func (m *RateLimitMiddleware) handleRateLimit(c *gin.Context, key string, limiter RateLimiter) {
	remaining := limiter.GetRemaining(key)
	resetTime := limiter.GetResetTime(key)

	c.Header("X-RateLimit-Remaining", strconv.Itoa(remaining))
	c.Header("X-RateLimit-Reset", strconv.FormatInt(resetTime.Unix(), 10))
	c.Header("Retry-After", strconv.FormatInt(int64(time.Until(resetTime).Seconds()), 10))

	c.JSON(http.StatusTooManyRequests, gin.H{
		"error":     "Rate limit exceeded",
		"message":   "Too many requests, please try again later",
		"remaining": remaining,
		"reset_at":  resetTime.Unix(),
	})
	c.Abort()
}

// GetRateLimitInfo 获取限流信息
func (m *RateLimitMiddleware) GetRateLimitInfo(c *gin.Context, key string, limiter RateLimiter) gin.H {
	remaining := limiter.GetRemaining(key)
	resetTime := limiter.GetResetTime(key)

	return gin.H{
		"remaining": remaining,
		"reset_at":  resetTime.Unix(),
		"window":    m.config.Window.Seconds(),
	}
}

// writeHeaders 在成功通过限流校验时写入响应头
func (m *RateLimitMiddleware) writeHeaders(c *gin.Context, key string, limiter RateLimiter, limit int) {
    if limit <= 0 { limit = 0 }
    remaining := limiter.GetRemaining(key)
    resetTime := limiter.GetResetTime(key)
    c.Header("X-RateLimit-Limit", strconv.Itoa(limit))
    c.Header("X-RateLimit-Remaining", strconv.Itoa(remaining))
    c.Header("X-RateLimit-Reset", strconv.FormatInt(resetTime.Unix(), 10))
}

// 预定义的限流配置
var (
	// DefaultRateLimitConfig 默认限流配置
	DefaultRateLimitConfig = RateLimitConfig{
		GlobalRPS:   1000,  // 全局每秒1000请求
		GlobalBurst: 2000,  // 突发2000请求
		UserRPS:     100,   // 用户每秒100请求
		UserBurst:   200,   // 用户突发200请求
		IPRPS:       50,    // IP每秒50请求
		IPBurst:     100,   // IP突发100请求
		APIRPS:      200,   // API每秒200请求
		APIBurst:    400,   // API突发400请求
		UseRedis:    false, // 默认使用内存
		Window:      time.Minute,
	}

	// StrictRateLimitConfig 严格限流配置
	StrictRateLimitConfig = RateLimitConfig{
		GlobalRPS:   500,
		GlobalBurst: 1000,
		UserRPS:     50,
		UserBurst:   100,
		IPRPS:       20,
		IPBurst:     40,
		APIRPS:      100,
		APIBurst:    200,
		UseRedis:    true,
		Window:      time.Minute,
	}
)
