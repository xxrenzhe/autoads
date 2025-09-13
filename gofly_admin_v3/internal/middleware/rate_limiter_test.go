package middleware

import (
    "net/http"
    "net/http/httptest"
    "testing"
    "time"

    "github.com/gin-gonic/gin"
)

func TestPlanAPIRateLimit_Memory(t *testing.T) {
    gin.SetMode(gin.TestMode)
    rl := NewRateLimitMiddleware(RateLimitConfig{UseRedis: false, GlobalRPS: 1000, GlobalBurst: 1000, Window: time.Second}, nil)
    rl.SetPlanRates(map[string]PlanRateConfig{"FREE": {RPS: 1, Burst: 1}}, nil)

    r := gin.New()
    r.Use(rl.PlanAPIRateLimit(func(c *gin.Context) string { return "FREE" }))
    r.GET("/ping", func(c *gin.Context) { c.String(200, "ok") })

    w1 := httptest.NewRecorder()
    req1, _ := http.NewRequest("GET", "/ping", nil)
    r.ServeHTTP(w1, req1)
    if w1.Code != 200 { t.Fatalf("expected 200, got %d", w1.Code) }

    w2 := httptest.NewRecorder()
    req2, _ := http.NewRequest("GET", "/ping", nil)
    r.ServeHTTP(w2, req2)
    if w2.Code == 200 { t.Fatalf("expected rate limited, got 200") }
}

