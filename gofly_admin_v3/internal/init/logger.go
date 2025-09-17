package init

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sync"
	"time"
)

// InitLogger 初始化日志记录器
type InitLogger struct {
    logger      *log.Logger
    filePath    string
    file        *os.File
    logEntries  []InitLogEntry
    mu          sync.Mutex
    initialized bool
}

// InitLogEntry 初始化日志条目
type InitLogEntry struct {
	Timestamp time.Time              `json:"timestamp"`
	Level     string                 `json:"level"`     // INFO, WARN, ERROR
	Component string                 `json:"component"` // database, migration, data, health
	Message   string                 `json:"message"`
	Details   map[string]interface{} `json:"details,omitempty"`
	Duration  time.Duration          `json:"duration,omitempty"`
	Success   bool                   `json:"success,omitempty"`
}

// InitProgress 初始化进度
type InitProgress struct {
	StartTime   time.Time  `json:"start_time"`
	EndTime     *time.Time `json:"end_time,omitempty"`
	Status      string     `json:"status"` // pending, in_progress, completed, failed
	CurrentStep string     `json:"current_step"`
	TotalSteps  int        `json:"total_steps"`
	Completed   int        `json:"completed"`
	Percentage  float64    `json:"percentage"`
	Errors      []string   `json:"errors,omitempty"`
	Warnings    []string   `json:"warnings,omitempty"`
}

// NewInitLogger 创建初始化日志记录器
func NewInitLogger(logDir string) (*InitLogger, error) {
	// 确保日志目录存在
	if err := os.MkdirAll(logDir, 0755); err != nil {
		return nil, fmt.Errorf("创建日志目录失败: %w", err)
	}

	// 创建日志文件名
	timestamp := time.Now().Format("20060102_150405")
	logFile := filepath.Join(logDir, fmt.Sprintf("init_%s.log", timestamp))

	// 打开日志文件
    file, err := os.OpenFile(logFile, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
    if err != nil {
        return nil, fmt.Errorf("打开日志文件失败: %w", err)
    }

	logger := log.New(file, "", log.LstdFlags|log.Lmicroseconds)

    return &InitLogger{
        logger:      logger,
        filePath:    logFile,
        file:        file,
        logEntries:  make([]InitLogEntry, 0),
        initialized: true,
    }, nil
}

// Log 记录初始化日志
func (il *InitLogger) Log(level, component, message string) {
	il.logWithDetails(level, component, message, nil, 0, false)
}

// LogSuccess 记录成功日志
func (il *InitLogger) LogSuccess(component, message string) {
	il.logWithDetails("INFO", component, message, nil, 0, true)
}

// LogError 记录错误日志
func (il *InitLogger) LogError(component, message string, err error) {
	details := map[string]interface{}{}
	if err != nil {
		details["error"] = err.Error()
	}
	il.logWithDetails("ERROR", component, message, details, 0, false)
}

// LogWithDetails 记录详细日志
func (il *InitLogger) LogWithDetails(level, component, message string, details map[string]interface{}) {
	il.logWithDetails(level, component, message, details, 0, false)
}

// LogWithDuration 记录带时长的日志
func (il *InitLogger) LogWithDuration(level, component, message string, duration time.Duration, success bool) {
	il.logWithDetails(level, component, message, nil, duration, success)
}

// logWithDetails 内部日志记录方法
func (il *InitLogger) logWithDetails(level, component, message string, details map[string]interface{}, duration time.Duration, success bool) {
	il.mu.Lock()
	defer il.mu.Unlock()

	if !il.initialized {
		return
	}

	entry := InitLogEntry{
		Timestamp: time.Now(),
		Level:     level,
		Component: component,
		Message:   message,
		Details:   details,
		Duration:  duration,
		Success:   success,
	}

	// 添加到内存
	il.logEntries = append(il.logEntries, entry)

	// 写入文件
	logLine := fmt.Sprintf("[%s] %s: %s", level, component, message)
	if duration > 0 {
		logLine += fmt.Sprintf(" (%v)", duration)
	}
	if !success {
		logLine += " ❌"
	} else if success && level == "INFO" {
		logLine += " ✅"
	}

	il.logger.Println(logLine)

	// 如果有详情，写入结构化日志
	if details != nil {
		jsonDetails, _ := json.Marshal(details)
		il.logger.Printf("Details: %s", string(jsonDetails))
	}
}

// GetLogEntries 获取所有日志条目
func (il *InitLogger) GetLogEntries() []InitLogEntry {
	il.mu.Lock()
	defer il.mu.Unlock()

	// 返回副本
	entries := make([]InitLogEntry, len(il.logEntries))
	copy(entries, il.logEntries)
	return entries
}

// GetLogsByComponent 按组件获取日志
func (il *InitLogger) GetLogsByComponent(component string) []InitLogEntry {
	il.mu.Lock()
	defer il.mu.Unlock()

	var entries []InitLogEntry
	for _, entry := range il.logEntries {
		if entry.Component == component {
			entries = append(entries, entry)
		}
	}
	return entries
}

// ExportLog 导出日志到文件
func (il *InitLogger) ExportLog(outputPath string) error {
	il.mu.Lock()
	defer il.mu.Unlock()

	file, err := os.Create(outputPath)
	if err != nil {
		return err
	}
	defer file.Close()

	// 写入JSON格式
	encoder := json.NewEncoder(file)
	encoder.SetIndent("", "  ")

	logData := struct {
		FilePath     string         `json:"file_path"`
		TotalEntries int            `json:"total_entries"`
		Entries      []InitLogEntry `json:"entries"`
	}{
		FilePath:     il.filePath,
		TotalEntries: len(il.logEntries),
		Entries:      il.logEntries,
	}

	return encoder.Encode(logData)
}

// Close 关闭日志记录器
func (il *InitLogger) Close() error {
    il.mu.Lock()
    defer il.mu.Unlock()

    if il.initialized {
        il.Log("INFO", "system", "初始化日志记录器关闭")
        il.initialized = false
    }
    // 关闭文件句柄
    if il.file != nil {
        _ = il.file.Sync()
        if err := il.file.Close(); err != nil {
            return err
        }
        il.file = nil
    }
    return nil
}

// InitProgressTracker 初始化进度跟踪器
type InitProgressTracker struct {
	progress InitProgress
	logger   *InitLogger
	mu       sync.Mutex
}

// NewInitProgressTracker 创建进度跟踪器
func NewInitProgressTracker(logger *InitLogger, totalSteps int) *InitProgressTracker {
	return &InitProgressTracker{
		progress: InitProgress{
			StartTime:  time.Now(),
			Status:     "pending",
			TotalSteps: totalSteps,
			Completed:  0,
			Percentage: 0,
		},
		logger: logger,
	}
}

// Start 开始初始化
func (ipt *InitProgressTracker) Start() {
	ipt.mu.Lock()
	defer ipt.mu.Unlock()

	ipt.progress.Status = "in_progress"
	ipt.progress.StartTime = time.Now()
	ipt.logger.LogSuccess("system", "初始化开始")
}

// UpdateProgress 更新进度
func (ipt *InitProgressTracker) UpdateProgress(step string) {
	ipt.mu.Lock()
	defer ipt.mu.Unlock()

	ipt.progress.CurrentStep = step
	ipt.progress.Completed++

	if ipt.progress.TotalSteps > 0 {
		ipt.progress.Percentage = float64(ipt.progress.Completed) / float64(ipt.progress.TotalSteps) * 100
	}

	ipt.logger.Log("INFO", "progress", fmt.Sprintf("进度更新: %s (%.1f%%)", step, ipt.progress.Percentage))
}

// AddError 添加错误
func (ipt *InitProgressTracker) AddError(err error) {
	ipt.mu.Lock()
	defer ipt.mu.Unlock()

	ipt.progress.Errors = append(ipt.progress.Errors, err.Error())
	ipt.logger.LogError("system", "初始化错误", err)
}

// AddWarning 添加警告
func (ipt *InitProgressTracker) AddWarning(warning string) {
	ipt.mu.Lock()
	defer ipt.mu.Unlock()

	ipt.progress.Warnings = append(ipt.progress.Warnings, warning)
	ipt.logger.Log("WARN", "system", warning)
}

// Complete 完成初始化
func (ipt *InitProgressTracker) Complete() {
	ipt.mu.Lock()
	defer ipt.mu.Unlock()

	now := time.Now()
	ipt.progress.EndTime = &now
	ipt.progress.Status = "completed"

	duration := now.Sub(ipt.progress.StartTime)
	ipt.logger.LogWithDuration("INFO", "system", fmt.Sprintf("初始化完成，共 %d 个步骤", ipt.progress.Completed), duration, true)
}

// Fail 初始化失败
func (ipt *InitProgressTracker) Fail(err error) {
	ipt.mu.Lock()
	defer ipt.mu.Unlock()

	now := time.Now()
	ipt.progress.EndTime = &now
	ipt.progress.Status = "failed"

	ipt.AddError(err)

	duration := now.Sub(ipt.progress.StartTime)
	ipt.logger.LogWithDuration("ERROR", "system", "初始化失败", duration, false)
}

// GetProgress 获取进度信息
func (ipt *InitProgressTracker) GetProgress() InitProgress {
	ipt.mu.Lock()
	defer ipt.mu.Unlock()

	// 返回副本
	return ipt.progress
}

// ContextWithLogger 将日志记录器添加到上下文
func ContextWithLogger(ctx context.Context, logger *InitLogger) context.Context {
	return context.WithValue(ctx, "initLogger", logger)
}

// LoggerFromContext 从上下文获取日志记录器
func LoggerFromContext(ctx context.Context) *InitLogger {
	if logger, ok := ctx.Value("initLogger").(*InitLogger); ok {
		return logger
	}
	return nil
}
