package app

import (
    "encoding/json"
    "fmt"
    "net/http"
    "strings"
    "time"

    "github.com/gin-gonic/gin"
    "gofly-admin-v3/internal/adscenter"
    "gofly-admin-v3/internal/autoclick"
    "gofly-admin-v3/internal/batchgo"
    "gorm.io/gorm"
)

// RegisterV2TaskSnapshot 注册 v2 任务快照与 SSE：
// - GET /api/v2/tasks/:id
// - GET /api/v2/stream/tasks/:id
func RegisterV2TaskSnapshot(v2 *gin.RouterGroup, gormDB *gorm.DB) {
    // 统一任务快照
    v2.GET("/tasks/:id", func(c *gin.Context) {
        id := strings.TrimSpace(c.Param("id"))
        if id == "" { c.JSON(400, gin.H{"message":"missing id"}); return }
        snap, ok, err := buildExecutionUpdateSnapshot(c, gormDB, id)
        if err != nil { c.JSON(500, gin.H{"message": err.Error()}); return }
        if !ok { c.JSON(404, gin.H{"message":"not found"}); return }
        c.JSON(200, snap)
    })

    // 统一任务 SSE
    v2.GET("/stream/tasks/:id", func(c *gin.Context) {
        id := strings.TrimSpace(c.Param("id"))
        if id == "" { c.String(400, "missing id"); return }
        c.Writer.Header().Set("Content-Type", "text/event-stream")
        c.Writer.Header().Set("Cache-Control", "no-cache")
        c.Writer.Header().Set("Connection", "keep-alive")
        f, ok := c.Writer.(http.Flusher)
        if !ok { c.String(500, "stream unsupported"); return }
        if snap, ok2, _ := buildExecutionUpdateSnapshot(c, gormDB, id); ok2 {
            b, _ := json.Marshal(snap)
            fmt.Fprintf(c.Writer, "data: %s\n\n", string(b))
            f.Flush()
        }
        ticker := time.NewTicker(1 * time.Second)
        defer ticker.Stop()
        lastKey := ""
        for i := 0; i < 900; i++ {
            select {
            case <-c.Request.Context().Done():
                return
            case <-ticker.C:
                snap, ok3, _ := buildExecutionUpdateSnapshot(c, gormDB, id)
                if !ok3 {
                    fmt.Fprintf(c.Writer, "data: %s\n\n", `{"type":"not_found"}`)
                    f.Flush(); return
                }
                key := fmt.Sprintf("%v:%v", snap["id"], snap["progress"]) 
                if key != lastKey {
                    lastKey = key
                    b, _ := json.Marshal(snap)
                    fmt.Fprintf(c.Writer, "data: %s\n\n", string(b))
                    f.Flush()
                }
                st := strings.ToLower(fmt.Sprint(snap["status"]))
                if st == "completed" || st == "failed" || st == "cancelled" { return }
            }
        }
    })
}

// buildExecutionUpdateSnapshot 统一生成 ExecutionUpdate 快照
func buildExecutionUpdateSnapshot(c *gin.Context, gormDB *gorm.DB, id string) (map[string]any, bool, error) {
    nowMs := time.Now().UnixMilli()
    // 1) BatchOpen（batch_tasks）
    var bt batchgo.BatchTask
    if err := gormDB.Where("id=?", id).First(&bt).Error; err == nil && bt.ID != "" {
        total := bt.URLCount
        processed := bt.ProcessedCount
        prog := 0
        if total > 0 { prog = int(float64(processed) / float64(total) * 100.0 + 0.5) }
        return map[string]any{
            "type": "execution_update", "id": bt.ID, "feature": "batchopen",
            "status": bt.Status, "progress": prog, "processedItems": processed, "totalItems": total, "ts": nowMs,
        }, true, nil
    }
    // 2) AutoClick（autoclick_executions）
    var ae autoclick.AutoClickExecution
    if err := gormDB.Where("id=?", id).First(&ae).Error; err == nil && ae.ID != "" {
        total := ae.Total
        processed := ae.Success + ae.Fail
        prog := 0
        if total > 0 { prog = int(float64(processed) / float64(total) * 100.0 + 0.5) }
        return map[string]any{
            "type": "execution_update", "id": ae.ID, "feature": "autoclick",
            "status": ae.Status, "progress": prog, "processedItems": processed, "totalItems": total, "ts": nowMs,
        }, true, nil
    }
    // 3) AdsCenter（adscenter_tasks）
    var at adscenter.AdsCenterTask
    if err := gormDB.Where("id=?", id).First(&at).Error; err == nil && at.ID != "" {
        total := at.TotalLinks
        processed := at.ExtractedCount + at.UpdatedCount + at.FailedCount
        prog := 0
        if total > 0 { prog = int(float64(processed) / float64(total) * 100.0 + 0.5) }
        return map[string]any{
            "type": "execution_update", "id": at.ID, "feature": "adscenter",
            "status": at.Status, "progress": prog, "processedItems": processed, "totalItems": total, "ts": nowMs,
        }, true, nil
    }
    return nil, false, nil
}

