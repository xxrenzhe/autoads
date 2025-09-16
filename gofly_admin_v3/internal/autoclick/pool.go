package autoclick

import (
    "sync"
    "time"
)

// Task 表示提交到池的执行任务
type Task struct {
    Run  func() bool        // 执行动作，返回是否成功
    Done func(ok bool)      // 完成回调（可为空）
    enq  time.Time          // 入队时间（内部使用）
}

// simplePool 长期工作池（固定 worker 数）
type simplePool struct {
    once    sync.Once
    q       chan Task
    workers int
    stats   *poolStats
}

func newSimplePool(workers int, capacity int) *simplePool {
    if workers <= 0 { workers = 1 }
    if capacity <= 0 { capacity = workers * 4 }
    p := &simplePool{ q: make(chan Task, capacity), workers: workers, stats: &poolStats{} }
    p.once.Do(func() {
        for i := 0; i < p.workers; i++ {
            go func() {
                for t := range p.q {
                    now := time.Now()
                    wait := now.Sub(t.enq)
                    ok := false
                    if t.Run != nil { ok = t.Run() }
                    if p.stats != nil { p.stats.record(wait, ok) }
                    if t.Done != nil { t.Done(ok) }
                }
            }()
        }
    })
    return p
}

func (p *simplePool) Submit(t Task) {
    t.enq = time.Now()
    p.q <- t
}

func (p *simplePool) QueueLen() int { return len(p.q) }
func (p *simplePool) Workers() int { return p.workers }

// PoolManager 提供 HTTP 与 Browser 两类池
type PoolManager struct {
    mu       sync.RWMutex
    httpPool *simplePool
    brPool   *simplePool
}

var globalPool *PoolManager
var poolOnce sync.Once

// GetPoolManager 获取全局池管理器
func GetPoolManager() *PoolManager {
    poolOnce.Do(func() { globalPool = &PoolManager{} })
    return globalPool
}

// Ensure 初始化池（可热更新大小：简单实现为惰性重建）
func (pm *PoolManager) Ensure(httpWorkers int, brWorkers int) {
    pm.mu.Lock(); defer pm.mu.Unlock()
    if pm.httpPool == nil || pm.httpPool.workers != httpWorkers {
        pm.httpPool = newSimplePool(httpWorkers, httpWorkers*8)
    }
    if pm.brPool == nil || pm.brPool.workers != brWorkers {
        pm.brPool = newSimplePool(brWorkers, brWorkers*4)
    }
}

func (pm *PoolManager) SubmitHTTP(t Task) { pm.mu.RLock(); p := pm.httpPool; pm.mu.RUnlock(); if p != nil { p.Submit(t) } }
func (pm *PoolManager) SubmitBrowser(t Task) { pm.mu.RLock(); p := pm.brPool; pm.mu.RUnlock(); if p != nil { p.Submit(t) } }

type PoolState struct {
    HTTPQueue int `json:"httpQueue"`
    HTTPWorkers int `json:"httpWorkers"`
    BrowserQueue int `json:"browserQueue"`
    BrowserWorkers int `json:"browserWorkers"`
    HTTPThroughput float64 `json:"httpThroughput"`
    HTTPAvgWaitMs  float64 `json:"httpAvgWaitMs"`
    BrowserThroughput float64 `json:"browserThroughput"`
    BrowserAvgWaitMs  float64 `json:"browserAvgWaitMs"`
}

func (pm *PoolManager) State() PoolState {
    pm.mu.RLock(); defer pm.mu.RUnlock()
    st := PoolState{}
    if pm.httpPool != nil {
        st.HTTPQueue = pm.httpPool.QueueLen(); st.HTTPWorkers = pm.httpPool.Workers()
        if pm.httpPool.stats != nil { st.HTTPThroughput, st.HTTPAvgWaitMs = pm.httpPool.stats.snapshot() }
    }
    if pm.brPool != nil {
        st.BrowserQueue = pm.brPool.QueueLen(); st.BrowserWorkers = pm.brPool.Workers()
        if pm.brPool.stats != nil { st.BrowserThroughput, st.BrowserAvgWaitMs = pm.brPool.stats.snapshot() }
    }
    return st
}

// 简易统计：按秒计数的 60 桶 + 平均等待时间
type poolStats struct {
    mu sync.Mutex
    buckets [60]int64
    lastSec int64
    waitTotalMs int64
    waitCount   int64
}

func (ps *poolStats) record(wait time.Duration, ok bool) {
    sec := time.Now().Unix()
    ps.mu.Lock()
    defer ps.mu.Unlock()
    // 滚动到当前秒
    if ps.lastSec == 0 {
        ps.lastSec = sec
    }
    if sec != ps.lastSec {
        // 若跨秒，清空当前秒桶
        if sec-ps.lastSec >= 60 {
            // 重置所有桶
            for i:=0;i<60;i++ { ps.buckets[i]=0 }
        }
        ps.lastSec = sec
    }
    idx := int(sec % 60)
    ps.buckets[idx]++
    ps.waitTotalMs += wait.Milliseconds()
    ps.waitCount++
}

func (ps *poolStats) snapshot() (throughputPerSec float64, avgWaitMs float64) {
    ps.mu.Lock(); defer ps.mu.Unlock()
    var sum int64 = 0
    now := time.Now().Unix()
    // 累计最近 60 秒
    for i:=0;i<60;i++ {
        sum += ps.buckets[i]
    }
    // throughput：每秒平均
    throughputPerSec = float64(sum) / 60.0
    if ps.waitCount > 0 { avgWaitMs = float64(ps.waitTotalMs) / float64(ps.waitCount) } else { avgWaitMs = 0 }
    // 衰减等待时间，避免无界增长
    ps.waitTotalMs = ps.waitTotalMs / 2
    ps.waitCount   = ps.waitCount / 2
    // 轻度过期处理：如长时间未更新，认为吞吐为0（可按 lastSec 判断）
    if now-ps.lastSec > 10 { throughputPerSec = 0 }
    return
}
