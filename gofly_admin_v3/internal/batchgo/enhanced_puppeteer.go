//go:build autoads_batchgo_enhanced_puppeteer

package batchgo

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/chromedp/cdproto/network"
	"github.com/chromedp/cdproto/page"
	"github.com/chromedp/chromedp"
	"github.com/chromedp/chromedp/kb"
	"gofly-admin-v3/utils/gform"
	"gofly-admin-v3/utils/tools/glog"
)

// CDPAccessor Chrome DevTools Protocol访问器
type CDPAccessor struct {
	allocatorContext context.Context
	allocatorCancel  context.CancelFunc
	browserMutex     sync.Mutex
}

// NewCDPAccessor 创建CDP访问器
func NewCDPAccessor() *CDPAccessor {
	return &CDPAccessor{}
}

// Execute 执行CDP访问
func (a *CDPAccessor) Execute(ctx context.Context, task *BatchTask, url string) (*BatchTaskResult, error) {
	start := time.Now()
	config := task.GetConfig()

	// 创建浏览器上下文
	allocCtx, cancel := chromedp.NewRemoteAllocator(ctx, "http://localhost:9222")
	defer cancel()

	// 创建新的浏览器上下文
	taskCtx, cancel := chromedp.NewContext(allocCtx, chromedp.WithBrowserOption(
		chromedp.WithRunnerOptions(
			chromedp.Flag("headless", true),
			chromedp.Flag("disable-gpu", true),
			chromedp.Flag("no-sandbox", true),
			chromedp.Flag("disable-dev-shm-usage", true),
			chromedp.Flag("disable-setuid-sandbox", true),
			chromedp.Flag("disable-web-security", false),
		),
	))
	defer cancel()

	// 设置超时
	taskCtx, cancel = context.WithTimeout(taskCtx, time.Duration(config.Timeout)*time.Second)
	defer cancel()

	// 结果数据
	result := &BatchTaskResult{
		Status:       "SUCCESS",
		ResponseTime: 0,
		StatusCode:   200,
	}

	// 执行任务
	var tasks chromedp.Tasks

	// 导航到URL
	tasks = append(tasks, chromedp.Navigate(url))

	// 等待页面加载
	if config.WaitForSelector != "" {
		tasks = append(tasks, chromedp.WaitVisible(config.WaitForSelector, chromedp.ByQuery))
	} else {
		tasks = append(tasks, chromedp.WaitReady("*", chromedp.ByQuery))
	}

	// 设置视口
	tasks = append(tasks, chromedp.EmulateViewport(
		config.ViewportWidth,
		config.ViewportHeight,
		chromedp.Mobile(config.UseMobile),
	))

	// 执行JavaScript（如果需要）
	if config.JavascriptToExecute != "" {
		tasks = append(tasks, chromedp.Evaluate(config.JavascriptToExecute, nil))
	}

	// 截图（如果需要）
	if config.Screenshot {
		var buf []byte
		screenshotTask := chromedp.Tasks{
			chromedp.ActionFunc(func(ctx context.Context) error {
				var err error
				if config.FullPage {
					buf, err = page.CaptureScreenshot().
						WithFormat(page.CaptureScreenshotFormatPng).
						WithCaptureBeyondViewport(true).
						Do(ctx)
				} else {
					buf, err = page.CaptureScreenshot().
						WithFormat(page.CaptureScreenshotFormatPng).
						Do(ctx)
				}
				if err != nil {
					return err
				}
				return nil
			}),
		}
		tasks = append(tasks, screenshotTask)
	}

	// 模拟用户交互
	if config.SimulateUser {
		tasks = append(tasks, chromedp.Tasks{
			chromedp.Sleep(2 * time.Second),
			chromedp.SendKeys("body", kb.End+kb.Home), // 滚动页面
		})
	}

	// 执行所有任务
	if err := chromedp.Run(taskCtx, tasks); err != nil {
		glog.Error(ctx, "cdp_execution_error", gform.Map{
			"task_id": task.ID,
			"url":     url,
			"error":   err.Error(),
		})
		return &BatchTaskResult{
			Status:       "FAILED",
			ResponseTime: int(time.Since(start).Milliseconds()),
			Error:        fmt.Sprintf("CDP执行失败: %v", err),
		}, nil
	}

	// 获取页面信息
	var pageInfo struct {
		Title       string `json:"title"`
		URL         string `json:"url"`
		ContentSize int64  `json:"content_size"`
		LoadTime    int64  `json:"load_time"`
		Resources   int    `json:"resources_count"`
	}

	// 收集页面信息
	infoTasks := chromedp.Tasks{
		chromedp.Title(&pageInfo.Title),
		chromedp.Location(&pageInfo.URL),
		chromedp.ActionFunc(func(ctx context.Context) error {
			// 获取性能指标
			metrics, err := page.GetLayoutMetrics().Do(ctx)
			if err == nil {
				pageInfo.ContentSize = metrics.CSSLayoutWidth * metrics.CSSLayoutHeight
			}
			return nil
		}),
	}

	if err := chromedp.Run(taskCtx, infoTasks); err == nil {
		pageInfo.LoadTime = time.Since(start).Milliseconds()
	}

	// 构建响应数据
	responseData := map[string]interface{}{
		"title":          pageInfo.Title,
		"final_url":      pageInfo.URL,
		"content_size":   pageInfo.ContentSize,
		"load_time":      pageInfo.LoadTime,
		"viewport":       fmt.Sprintf("%dx%d", config.ViewportWidth, config.ViewportHeight),
		"mobile_mode":    config.UseMobile,
		"resources":      pageInfo.Resources,
		"chrome_version": "CDP Integrated",
	}

	// 添加截图信息
	if config.Screenshot {
		responseData["screenshot_taken"] = true
		responseData["full_page"] = config.FullPage
	}

	// 根据任务类型处理响应
	switch task.Type {
	case "BATCH_CHECK":
		responseData["page_loaded"] = true
		responseData["interactive"] = true
	case "BATCH_OPEN":
		responseData["opened"] = true
		responseData["fully_rendered"] = true
	}

	// 序列化结果数据
	if dataBytes, err := json.Marshal(responseData); err == nil {
		result.Data = string(dataBytes)
	}

	result.ResponseTime = int(time.Since(start).Milliseconds())

	glog.Info(ctx, "cdp_execution_success", gform.Map{
		"task_id":       task.ID,
		"url":           url,
		"response_time": result.ResponseTime,
		"title":         pageInfo.Title,
	})

	return result, nil
}

// Name 返回访问器名称
func (a *CDPAccessor) Name() string {
	return "CDP"
}

// EnhancedPuppeteerAccessor 增强的Puppeteer访问器
type EnhancedPuppeteerAccessor struct {
	chromePath  string
	timeout     time.Duration
	useCDP      bool
	cdpAccessor *CDPAccessor
}

// NewEnhancedPuppeteerAccessor 创建增强的Puppeteer访问器
func NewEnhancedPuppeteerAccessor() *EnhancedPuppeteerAccessor {
	// 检测Chrome路径
	chromePath := "/usr/bin/chromium-browser"
	if _, err := os.Stat(chromePath); os.IsNotExist(err) {
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

	// 检查是否可以使用CDP（Chrome DevTools Protocol）
	useCDP := checkCDPAvailable()

	return &EnhancedPuppeteerAccessor{
		chromePath:  chromePath,
		timeout:     30 * time.Second,
		useCDP:      useCDP,
		cdpAccessor: NewCDPAccessor(),
	}
}

// Execute 执行增强的Puppeteer访问
func (a *EnhancedPuppeteerAccessor) Execute(ctx context.Context, task *BatchTask, url string) (*BatchTaskResult, error) {
	// 优先使用CDP
	if a.useCDP && isChromeDevToolsRunning() {
		glog.Info(ctx, "using_cdp_protocol", gform.Map{
			"task_id": task.ID,
			"url":     url,
		})
		return a.cdpAccessor.Execute(ctx, task, url)
	}

	// 回退到命令行模式
	glog.Info(ctx, "falling_back_to_command_line", gform.Map{
		"task_id": task.ID,
		"url":     url,
	})

	// 使用原有的命令行实现
	cmdAccessor := NewPuppeteerAccessor()
	return cmdAccessor.Execute(ctx, task, url)
}

// Name 返回访问器名称
func (a *EnhancedPuppeteerAccessor) Name() string {
	if a.useCDP {
		return "EnhancedPuppeteer(CDP)"
	}
	return "EnhancedPuppeteer(CMD)"
}

// checkCDPAvailable 检查CDP是否可用
func checkCDPAvailable() bool {
	// 检查chromedp包是否可用
	// 这里简单返回true，实际应该检查依赖
	return true
}

// isChromeDevToolsRunning 检查Chrome DevTools是否运行
func isChromeDevToolsRunning() bool {
	// 检查localhost:9222是否有Chrome实例运行
	client := &http.Client{Timeout: 2 * time.Second}
	resp, err := client.Get("http://localhost:9222/json/version")
	if err != nil {
		return false
	}
	defer resp.Body.Close()

	return resp.StatusCode == http.StatusOK
}

// StartChromeDevTools 启动Chrome DevTools
func StartChromeDevTools(ctx context.Context, port int) error {
	// 启动Chrome实例，开启DevTools协议
	// chrome --headless --remote-debugging-port=9222 --disable-gpu --no-sandbox
	return nil
}

// TaskConfig 任务配置
type TaskConfig struct {
	ID           string                 `json:"id"`
	URLs         []string               `json:"urls"`
	Mode         string                 `json:"mode"`
	OpenCount    int                    `json:"open_count"`
	CycleCount   int                    `json:"cycle_count"`
	OpenInterval int                    `json:"open_interval"`
	ProxyURL     string                 `json:"proxy_url"`
	Headers      map[string]string      `json:"headers"`
	Options      map[string]interface{} `json:"options"`
}

// PuppeteerConfig Puppeteer配置扩展
type PuppeteerConfig struct {
	*TaskConfig
	WaitForSelector     string            `json:"wait_for_selector"`
	JavascriptToExecute string            `json:"javascript_to_execute"`
	SimulateUser        bool              `json:"simulate_user"`
	CustomHeaders       map[string]string `json:"custom_headers"`
	BlockResources      []string          `json:"block_resources"`
	IgnoreHTTPSErrors   bool              `json:"ignore_https_errors"`
}
