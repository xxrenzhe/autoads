# SiteRankGo 模块设计

### 8.1 SimilarWeb API 集成

```go
// internal/siterankgo/client.go
type SimilarWebClient struct {
    apiKey     string
    httpClient *http.Client
    cache      *CacheManager
    rateLimiter *RateLimiter
}

func (c *SimilarWebClient) BatchQuery(domains []string) ([]DomainData, error) {
    var results []DomainData
    var cachedCount int
    
    for _, domain := range domains {
        // 先查缓存
        if data, found := c.cache.Get(domain); found {
            results = append(results, data)
            cachedCount++
            continue
        }
        
        // 限流控制
        c.rateLimiter.Wait()
        
        // 调用 API
        data, err := c.querySingleDomain(domain)
        if err != nil {
            continue
        }
        
        // 缓存结果
        c.cache.Set(domain, data, 24*time.Hour)
        results = append(results, data)
    }
    
    return results, nil
}
```

### 8.2 智能缓存策略

```go
// internal/siterankgo/cache.go
type CacheManager struct {
    redis   *store.Redis
    local   *lru.Cache
    metrics *CacheMetrics
}

func (cm *CacheManager) Get(domain string) (DomainData, bool) {
    // L1 缓存
    if data, ok := cm.local.Get(domain); ok {
        cm.metrics.Hit()
        return data.(DomainData), true
    }
    
    // L2 缓存
    data, err := cm.redis.Get(context.Background(), "siterank:"+domain).Result()
    if err == nil {
        var domainData DomainData
        json.Unmarshal([]byte(data), &domainData)
        // 回填 L1
        cm.local.Add(domain, domainData)
        cm.metrics.Hit()
        return domainData, true
    }
    
    cm.metrics.Miss()
    return DomainData{}, false
}
```