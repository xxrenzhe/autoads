package batchgo

import (
    "time"
    "github.com/google/uuid"
    "gorm.io/gorm"
)

// DAO 提供最小的读写与聚合函数，便于替换旧 batch_tasks 的读路径
type DAO struct { db *gorm.DB }

func NewDAO(db *gorm.DB) *DAO { return &DAO{db: db} }

func (d *DAO) CreateJob(userID, jobType string, optionsJSON string, urls []string) (*BatchJob, error) {
    job := &BatchJob{ ID: uuid.New().String(), UserID: userID, Type: jobType, Status: "pending", Options: optionsJSON, CreatedAt: time.Now(), UpdatedAt: time.Now() }
    if err := d.db.Create(job).Error; err != nil { return nil, err }
    // items
    now := time.Now()
    items := make([]*BatchJobItem, 0, len(urls))
    for _, u := range urls {
        items = append(items, &BatchJobItem{ ID: uuid.New().String(), JobID: job.ID, URL: u, Status: "pending", CreatedAt: now, UpdatedAt: now })
    }
    if len(items) > 0 { _ = d.db.Create(&items).Error }
    // progress
    prog := &BatchJobProgress{ JobID: job.ID, Total: len(urls), Running: 0, Success: 0, Fail: 0, UpdatedAt: now }
    _ = d.db.Clauses().Create(prog).Error
    return job, nil
}

func (d *DAO) UpdateItemStatus(itemID string, status string, result string, lastError string) error {
    return d.db.Model(&BatchJobItem{}).Where("id=?", itemID).Updates(map[string]any{"status": status, "result": result, "last_error": lastError, "updated_at": time.Now()}).Error
}

func (d *DAO) AggregateProgress(jobID string) (*BatchJobProgress, error) {
    var total int64
    var success int64
    var fail int64
    if err := d.db.Model(&BatchJobItem{}).Where("job_id=?", jobID).Count(&total).Error; err != nil { return nil, err }
    _ = d.db.Model(&BatchJobItem{}).Where("job_id=? AND status=?", jobID, "success").Count(&success).Error
    _ = d.db.Model(&BatchJobItem{}).Where("job_id=? AND status=?", jobID, "failed").Count(&fail).Error
    running := int(total - success - fail)
    prog := &BatchJobProgress{ JobID: jobID, Total: int(total), Success: int(success), Fail: int(fail), Running: running, UpdatedAt: time.Now() }
    // upsert
    _ = d.db.Where("job_id=?", jobID).Assign(prog).FirstOrCreate(&BatchJobProgress{ JobID: jobID }).Error
    _ = d.db.Model(&BatchJobProgress{}).Where("job_id=?", jobID).Updates(map[string]any{"total": prog.Total, "success": prog.Success, "fail": prog.Fail, "running": prog.Running, "updated_at": prog.UpdatedAt}).Error
    return prog, nil
}

func (d *DAO) GetJob(jobID string) (*BatchJob, error) {
    var j BatchJob
    if err := d.db.Where("id=?", jobID).First(&j).Error; err != nil { return nil, err }
    return &j, nil
}

