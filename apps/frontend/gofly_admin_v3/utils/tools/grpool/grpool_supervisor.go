package grpool

import (
	"context"

	"gofly-admin-v3/utils/tools/gtimer"
)

// supervisor checks the job list and fork new worker goroutine to handle the job
// if there are jobs but no workers in pool.
func (p *Pool) supervisor(_ context.Context) {
	if p.IsClosed() {
		gtimer.Exit()
	}
	if p.list.Size() > 0 && p.count.Val() == 0 {
		var number = p.list.Size()
		if p.limit > 0 {
			number = p.limit
		}
		for i := 0; i < number; i++ {
			p.checkAndForkNewGoroutineWorker()
		}
	}
}
