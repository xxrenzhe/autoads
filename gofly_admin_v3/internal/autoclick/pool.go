package autoclick

import (
    "sync"
)

// Task 表示提交到池的执行任务
type Task struct {
    Run  func() bool        // 执行动作，返回是否成功
    Done func(ok bool)      // 完成回调（可为空）
}

// simplePool 长期工作池（固定 worker 数）
type simplePool struct {
    once    sync.Once
    q       chan Task
    workers int
}

func newSimplePool(workers int, capacity int) *simplePool {
    if workers <= 0 { workers = 1 }
    if capacity <= 0 { capacity = workers * 4 }
    p := &simplePool{ q: make(chan Task, capacity), workers: workers }
    p.once.Do(func() {
        for i := 0; i < p.workers; i++ {
            go func() {
                for t := range p.q {
                    ok := false
                    if t.Run != nil { ok = t.Run() }
                    if t.Done != nil { t.Done(ok) }
                }
            }()
        }
    })
    return p
}

func (p *simplePool) Submit(t Task) {
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
}

func (pm *PoolManager) State() PoolState {
    pm.mu.RLock(); defer pm.mu.RUnlock()
    st := PoolState{}
    if pm.httpPool != nil { st.HTTPQueue = pm.httpPool.QueueLen(); st.HTTPWorkers = pm.httpPool.Workers() }
    if pm.brPool != nil { st.BrowserQueue = pm.brPool.QueueLen(); st.BrowserWorkers = pm.brPool.Workers() }
    return st
}

