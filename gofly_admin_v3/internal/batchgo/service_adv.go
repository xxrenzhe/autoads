//go:build autoads_advanced

package batchgo

import (
    "encoding/json"
    "time"

    "gofly-admin-v3/internal/store"
    "gofly-admin-v3/pkg/concurrent"
)

// Advanced wrapper constructor for EnhancedService compatibility.
func NewServiceAdv(db *store.DB, _ *store.Redis) *Service {
    if db == nil { return &Service{} }
    return &Service{ db: db.DB }
}

// GetTask returns a concurrent.Task mapped from batch_tasks for advanced mode.
func (s *Service) GetTaskAdv(taskID string) (*concurrent.ExecTask, error) {
    var t BatchTask
    if err := s.db.Where("id = ?", taskID).First(&t).Error; err != nil {
        return nil, err
    }
    ct := &concurrent.ExecTask{
        ID:         t.ID,
        UserID:     t.UserID,
        Name:       t.Name,
        Status:     string(t.Status),
        TokenCost:  t.TokenCost,
        UpdatedAt:  t.UpdatedAt,
        CreatedAt:  t.CreatedAt,
    }
    // try parse URLs from JSON
    var urls []BatchTaskURL
    if len(t.URLs) > 0 {
        _ = json.Unmarshal(t.URLs, &urls)
        ct.URLs = make([]string, 0, len(urls))
        for _, u := range urls { if u.URL != "" { ct.URLs = append(ct.URLs, u.URL) } }
    }
    // default execution params
    ct.OpenCount = 1
    ct.CycleCount = 1
    ct.OpenInterval = 1
    _ = time.Now() // keep time import
    return ct, nil
}
