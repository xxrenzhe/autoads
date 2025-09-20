package system

import (
    "crypto/sha256"
    "encoding/hex"
    "encoding/json"
    "net/http"
    "time"

    "github.com/gin-gonic/gin"
    "gofly-admin-v3/utils/gf"
)

// GetEffectiveConfig 返回系统有效配置快照（只读）
// - 路径：GET /ops/console/config/v1
// - 返回：{ version: string, config: object }
// - 头部：支持 If-None-Match / 返回 ETag；配置未变更时返回 304
func GetEffectiveConfig(c *gin.Context) {
    // 确保缓存初始化
    if globalCache == nil { Init() }

    // 读取所有有效配置（以 DB 为权威）
    rows, err := gf.DB().Model("system_configs").Where("is_active=1").Order("config_key").All()
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
        return
    }

    // 构造扁平快照
    snapshot := map[string]string{}
    for _, r := range rows {
        k := r["config_key"].String()
        v := r["config_value"].String()
        snapshot[k] = v
    }

    // 计算 ETag（sha256(snapshot JSON)）
    buf, _ := json.Marshal(snapshot)
    sum := sha256.Sum256(buf)
    etag := "\"" + hex.EncodeToString(sum[:]) + "\""

    // If-None-Match 支持
    inm := c.GetHeader("If-None-Match")
    if inm == etag {
        c.Status(http.StatusNotModified)
        return
    }

    // 版本号：时间戳 + 短 hash
    version := time.Now().UTC().Format(time.RFC3339) + "#" + hex.EncodeToString(sum[:8])

    c.Header("ETag", etag)
    c.Header("Cache-Control", "no-cache")
    c.JSON(http.StatusOK, gin.H{"version": version, "config": snapshot})
}

