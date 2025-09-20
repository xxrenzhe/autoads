//go:build autoads_advanced

package batchgo

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"gofly-admin-v3/utils/gform"
	"gofly-admin-v3/utils/tools/glog"
)

// TaskAccessor 任务访问器接口
type TaskAccessor interface {
	Execute(ctx context.Context, task *BatchTask, url string) (*BatchTaskResult, error)
	Name() string
}

// HTTPAccessor HTTP访问器
type HTTPAccessor struct {
	client *http.Client
}

// NewHTTPAccessor 创建HTTP访问器
func NewHTTPAccessor() *HTTPAccessor {
	return &HTTPAccessor{
		client: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// Execute 执行HTTP访问
func (a *HTTPAccessor) Execute(ctx context.Context, task *BatchTask, url string) (*BatchTaskResult, error) {
	start := time.Now()

	// 创建请求
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("创建请求失败: %w", err)
	}

	// 设置请求头
	config := task.GetConfig()
	// 使用通用 Headers
	if config != nil && config.Headers != nil {
		for key, value := range config.Headers {
			req.Header.Set(key, value)
		}
	}

	// 设置User-Agent
	if ua := req.Header.Get("User-Agent"); ua == "" {
		req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
	} else {
		// 保持用户自定义User-Agent
	}

	// 设置Referer
	// Referer: 可通过 Headers 传入；若未提供则不设置

	// 发送请求
	resp, err := a.client.Do(req)
	if err != nil {
		return &BatchTaskResult{
			Status:       BatchTaskStatus("FAILED"),
			ResponseTime: int(time.Since(start).Milliseconds()),
			Error:        err.Error(),
		}, nil
	}
	defer resp.Body.Close()

	// 记录结果
	result := &BatchTaskResult{
		Status:       BatchTaskStatus("SUCCESS"),
		ResponseTime: int(time.Since(start).Milliseconds()),
		StatusCode:   resp.StatusCode,
	}

	// 根据任务类型处理响应
	switch string(task.Mode) {
	case "BATCH_CHECK":
		// 检查任务：记录响应状态和大小
		result.Data = fmt.Sprintf(`{"status_code": %d, "content_length": %d}`, resp.StatusCode, resp.ContentLength)
	case "BATCH_OPEN":
		// 打开任务：只记录成功状态
		result.Data = `{"opened": true}`
	}

	return result, nil
}

// Name 返回访问器名称
func (a *HTTPAccessor) Name() string {
	return "HTTP"
}

// PuppeteerAccessor Puppeteer访问器
type PuppeteerAccessor struct {
	chromePath string
	timeout    time.Duration
}

// NewPuppeteerAccessor 创建Puppeteer访问器
func NewPuppeteerAccessor() *PuppeteerAccessor {
	// 检测Chrome路径
	chromePath := "/usr/bin/chromium-browser"
	if _, err := os.Stat(chromePath); os.IsNotExist(err) {
		// 尝试其他常见路径
		paths := []string{
			"/usr/bin/google-chrome",
			"/usr/bin/chromium",
			"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
		}
		for _, path := range paths {
			if _, err := os.Stat(path); err == nil {
				chromePath = path
				break
			}
		}
	}

	return &PuppeteerAccessor{
		chromePath: chromePath,
		timeout:    30 * time.Second,
	}
}

// Execute 执行Puppeteer访问
func (a *PuppeteerAccessor) Execute(ctx context.Context, task *BatchTask, url string) (*BatchTaskResult, error) {
	start := time.Now()
	config := task.GetConfig()

	// 创建临时目录
	tempDir, err := os.MkdirTemp("", "puppeteer-*")
	if err != nil {
		return nil, fmt.Errorf("创建临时目录失败: %w", err)
	}
	defer os.RemoveAll(tempDir)

	// 构建Chrome命令
	args := []string{
		"--headless",
		"--disable-gpu",
		"--disable-dev-shm-usage",
		"--no-sandbox",
		"--disable-setuid-sandbox",
		"--disable-extensions",
		"--disable-plugins",
		"--disable-images",     // 加速加载
		"--disable-javascript", // 可选：禁用JS以加速
		// 使用默认窗口大小，Timeout 使用配置或默认 30s
		"--window-size=1366,768",
		"--timeout=" + strconv.Itoa(int(max(1, config.Timeout)*1000)),
		"--virtual-time-budget=" + strconv.Itoa(int(max(1, config.Timeout)*1000)),
		"--dump-dom",
		url,
	}

	// 如果需要截图，添加截图参数
	if getBoolOption(config, "screenshot") {
		screenshotPath := filepath.Join(tempDir, "screenshot.png")
		args = append(args,
			"--screenshot="+screenshotPath,
		)
		if getBoolOption(config, "full_page") {
			args = append(args, "--full-page")
		}
	}

	glog.Info(ctx, "puppeteer_start", gform.Map{
		"task_id":     task.ID,
		"url":         url,
		"chrome_path": a.chromePath,
		"args":        args,
	})

	// 执行Chrome命令
	cmd := exec.CommandContext(ctx, a.chromePath, args...)
	cmd.Env = append(os.Environ(),
		"DISPLAY=:99", // 使用虚拟显示
	)

	output, err := cmd.CombinedOutput()
	if err != nil {
		glog.Error(ctx, "puppeteer_error", gform.Map{
			"task_id": task.ID,
			"url":     url,
			"error":   err.Error(),
			"output":  string(output),
		})
		return &BatchTaskResult{
			Status:       BatchTaskStatus("FAILED"),
			ResponseTime: int(time.Since(start).Milliseconds()),
			Error:        fmt.Sprintf("Chrome执行失败: %v", err),
		}, nil
	}

	// 处理结果
	result := &BatchTaskResult{
		Status:       BatchTaskStatus("SUCCESS"),
		ResponseTime: int(time.Since(start).Milliseconds()),
		StatusCode:   200,
	}

	// 等待指定选择器
	if sel := getStringOption(config, "wait_for_selector"); sel != "" {
		// 这里简化处理，实际应该使用CDP协议
		glog.Info(ctx, "wait_for_selector", gform.Map{
			"task_id":  task.ID,
			"selector": sel,
		})
	}

	// 构建响应数据
	responseData := gform.Map{
		"content_length": len(output),
		"viewport":       "1366x768",
	}

	// 如果有截图，添加截图信息
	if getBoolOption(config, "screenshot") {
		screenshotPath := filepath.Join(tempDir, "screenshot.png")
		if _, err := os.Stat(screenshotPath); err == nil {
			responseData["screenshot"] = "screenshot.png"
			responseData["full_page"] = getBoolOption(config, "full_page")
		}
	}

	// 根据任务类型处理响应
	switch string(task.Mode) {
	case "BATCH_CHECK":
		responseData["status"] = "loaded"
		responseData["dom_elements"] = len(strings.Split(string(output), "\n"))
	case "BATCH_OPEN":
		responseData["opened"] = true
		responseData["page_loaded"] = true
	}

	dataBytes, _ := json.Marshal(responseData)
	result.Data = string(dataBytes)

	glog.Info(ctx, "puppeteer_success", gform.Map{
		"task_id":       task.ID,
		"url":           url,
		"response_time": result.ResponseTime,
	})

	return result, nil
}

// Name 返回访问器名称
func (a *PuppeteerAccessor) Name() string {
	return "Puppeteer"
}

// AccessorFactory 访问器工厂
type AccessorFactory struct{}

// NewAccessorFactory 创建访问器工厂
func NewAccessorFactory() *AccessorFactory {
	return &AccessorFactory{}
}

// CreateAccessor 创建访问器
func (f *AccessorFactory) CreateAccessor(method string) (TaskAccessor, error) {
	switch method {
	case "http":
		return NewHTTPAccessor(), nil
	case "puppeteer":
		return NewPuppeteerAccessor(), nil
	case "cdp":
		return NewPuppeteerAccessor(), nil
	default:
		return nil, fmt.Errorf("不支持的访问方式: %s", method)
	}
}

// GetAvailableAccessors 获取可用的访问器
func (f *AccessorFactory) GetAvailableAccessors() []string {
	return []string{"http", "puppeteer", "cdp"}
}

// helpers for options
func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}
func getBoolOption(c *BatchConfig, key string) bool {
	if c == nil || c.Options == nil {
		return false
	}
	if v, ok := c.Options[key]; ok {
		if b, ok2 := v.(bool); ok2 {
			return b
		}
	}
	return false
}
func getStringOption(c *BatchConfig, key string) string {
	if c == nil || c.Options == nil {
		return ""
	}
	if v, ok := c.Options[key]; ok {
		if s, ok2 := v.(string); ok2 {
			return s
		}
	}
	return ""
}
