package adscenter

import (
    "gorm.io/gorm"
    "gofly-admin-v3/internal/token"
    "gofly-admin-v3/utils/gf"
)

// InitAdsCenterService 返回带真实Token适配器的服务
func InitAdsCenterService(db *gorm.DB) *AdsCenterService {
    tk := token.NewAdapterWithService(token.NewService(gf.DB()))
    return NewAdsCenterService(db, tk)
}
