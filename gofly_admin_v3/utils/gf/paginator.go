package gf

import (
	"gofly-admin-v3/utils/gform"
)

// Paginator 分页器
type Paginator struct {
	ctx *GinCtx
}

// NewPaginator 创建分页器
func NewPaginator(ctx *GinCtx) *Paginator {
	return &Paginator{ctx: ctx}
}

// Paginate 执行分页查询
func (p *Paginator) Paginate(query *gform.Model) (gform.Result, error) {
	// 简单实现：直接返回所有结果
	record, err := query.Find()
	if err != nil {
		return nil, err
	}
	// Convert single Record to Result ([]Record)
	return gform.Result{record}, nil
}