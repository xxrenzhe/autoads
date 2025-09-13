package chengelink

import (
    "gorm.io/gorm"
    "gofly-admin-v3/internal/token"
    "gofly-admin-v3/utils/gf"
)

// InitChengeLinkService 返回带真实Token适配器的服务
func InitChengeLinkService(db *gorm.DB) *ChengeLinkService {
    tk := token.NewAdapterWithService(token.NewService(gf.DB()))
    return NewChengeLinkService(db, tk)
}
