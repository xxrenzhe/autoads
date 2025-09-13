package system

import (
    "context"
    "sync"
    "time"

    "gofly-admin-v3/utils/gf"
    "gofly-admin-v3/utils/tools/glog"
)

// SystemConfigCache 内存系统配置缓存 + 事件驱动刷新
type SystemConfigCache struct {
    mu       sync.RWMutex
    data     map[string]string
    watchers map[string][]func(key, value string)
}

var globalCache *SystemConfigCache

// Init 初始化并订阅 Redis 事件
func Init() *SystemConfigCache {
    if globalCache != nil { return globalCache }
    c := &SystemConfigCache{ data: map[string]string{}, watchers: map[string][]func(string, string){} }
    c.loadAll()
    go c.subscribe()
    globalCache = c
    return c
}

// Get 获取配置值
func Get(key string) (string, bool) {
    if globalCache == nil { return "", false }
    globalCache.mu.RLock(); defer globalCache.mu.RUnlock()
    v, ok := globalCache.data[key]
    return v, ok
}

// On 注册某个key的变更回调
func On(key string, fn func(key, value string)) {
    if globalCache == nil { Init() }
    globalCache.mu.Lock(); defer globalCache.mu.Unlock()
    globalCache.watchers[key] = append(globalCache.watchers[key], fn)
}

func (c *SystemConfigCache) loadAll() {
    rows, err := gf.DB().Model("system_configs").Where("is_active=1").All()
    if err != nil { glog.Error(nil, "system_config_load_all_failed", map[string]interface{}{"err": err.Error()}); return }
    c.mu.Lock(); defer c.mu.Unlock()
    for _, r := range rows {
        k := r["config_key"].String()
        v := r["config_value"].String()
        c.data[k] = v
    }
}

func (c *SystemConfigCache) subscribe() {
    r := gf.Redis(); if r == nil { return }
    ctx := context.Background()
    conn, _, err := r.GroupPubSub().Subscribe(ctx, "system:config:updated")
    if err != nil { glog.Error(nil, "system_config_sub_failed", map[string]interface{}{"err": err.Error()}); return }
    for {
        msg, err := conn.ReceiveMessage(ctx)
        if err != nil { time.Sleep(500 * time.Millisecond); continue }
        if msg == nil || msg.Channel != "system:config:updated" { continue }
        key := msg.Payload
        // 从DB加载该key
        rec, err2 := gf.DB().Model("system_configs").Where("config_key=? AND is_active=1", key).One()
        if err2 != nil { glog.Error(nil, "system_config_load_key_failed", map[string]interface{}{"key": key, "err": err2.Error()}); continue }
        val := ""
        if rec != nil { val = rec["config_value"].String() }
        c.mu.Lock()
        c.data[key] = val
        watchers := append([]func(string,string){}, c.watchers[key]...)
        c.mu.Unlock()
        for _, w := range watchers {
            // 异步通知
            go w(key, val)
        }
        glog.Info(nil, "system_config_refreshed", map[string]interface{}{"key": key})
    }
}

