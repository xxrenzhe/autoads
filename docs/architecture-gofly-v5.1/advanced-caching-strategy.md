# 高级缓存策略

### 3.1 多级缓存架构

```go
// CacheService 多级缓存服务
type CacheService struct {
    L1Cache *gcache.Cache    // 内存缓存
    L2Cache *gredis.Client   // Redis缓存
    stats   *CacheStats      // 缓存统计
}

// GetWithCache 多级缓存获取
func (cs *CacheService) GetWithCache(key string, fetchFunc func() (interface{}, error)) (interface{}, error) {
    // L1: 内存缓存（最快）
    if val := cs.L1Cache.Get(key); val != nil {
        cs.stats.HitL1()
        return val, nil
    }
    
    // L2: Redis缓存
    val, err := cs.L2Cache.Get(key).Result()
    if err == nil {
        // 回填L1缓存
        cs.L1Cache.Set(key, val, time.Minute*5)
        cs.stats.HitL2()
        return val, nil
    }
    
    // 从数据源获取
    data, err := fetchFunc()
    if err != nil {
        return nil, err
    }
    
    // 缓存到L2和L1
    cs.L2Cache.Set(key, data, time.Hour)
    cs.L1Cache.Set(key, data, time.Minute*5)
    
    cs.stats.Miss()
    return data, nil
}
```

### 3.2 缓存策略优化

#### 3.2.1 查询结果缓存
```go
// 带缓存的查询方法
func (s *UserService) GetUserListWithCache(page, size int, keyword string) ([]User, int64, error) {
    cacheKey := fmt.Sprintf("user_list:%d:%d:%s", page, size, keyword)
    
    var result struct {
        Users []User `json:"users"`
        Total int64  `json:"total"`
    }
    
    // 使用多级缓存
    data, err := cacheService.GetWithCache(cacheKey, func() (interface{}, error) {
        users, total, err := s.GetUserList(page, size, keyword)
        if err != nil {
            return nil, err
        }
        return struct {
            Users []User `json:"users"`
            Total int64  `json:"total"`
        }{users, total}, nil
    })
    
    if err != nil {
        return nil, 0, err
    }
    
    result = data.(struct {
        Users []User `json:"users"`
        Total int64  `json:"total"`
    })
    
    return result.Users, result.Total, nil
}
```

#### 3.2.2 缓存击穿保护
```go
// 单飞模式防止缓存击穿
func (cs *CacheService) GetSingleFlight(key string, fetchFunc func() (interface{}, error)) (interface{}, error) {
    // 使用GoFly的singleFlight模式
    result, err := cs.singleFlight.Do(key, func() (interface{}, error) {
        return fetchFunc()
    })
    
    if err != nil {
        return nil, err
    }
    
    return result, nil
}
```