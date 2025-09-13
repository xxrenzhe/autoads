package cache

import (
    "sync/atomic"
    "testing"
    "time"
)

func TestMemoryCache_GetOrSet_Singleflight(t *testing.T) {
    m := NewMemoryCache()
    var calls int32
    fn := func() (interface{}, error) {
        atomic.AddInt32(&calls, 1)
        time.Sleep(50 * time.Millisecond)
        return map[string]any{"v": 42}, nil
    }
    start := time.Now()
    n := 10
    errs := make(chan error, n)
    for i := 0; i < n; i++ {
        go func() {
            var out map[string]any
            errs <- m.GetOrSet("k1", fn, time.Second, &out)
        }()
    }
    for i := 0; i < n; i++ {
        if err := <-errs; err != nil { t.Fatalf("unexpected error: %v", err) }
    }
    if atomic.LoadInt32(&calls) != 1 { t.Fatalf("expected single call, got %d", calls) }
    if time.Since(start) > 400*time.Millisecond { t.Fatalf("took too long: %v", time.Since(start)) }
}

