package batchgo

import (
    "gorm.io/gorm"
    "gofly-admin-v3/internal/token"
    "gofly-admin-v3/utils/gf"
)

// InitBatchGoService 创建带真实Token适配器的服务
func InitBatchGoService(db *gorm.DB, ws WSManager) *Service {
    tk := token.NewAdapterWithService(token.NewService(gf.DB()))
    return NewService(db, tk, ws, nil)
}
