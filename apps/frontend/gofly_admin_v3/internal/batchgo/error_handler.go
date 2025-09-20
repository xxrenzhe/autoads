//go:build autoads_batchgo_enhanced_puppeteer

package batchgo

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"gofly-admin-v3/utils/gform"
	"gofly-admin-v3/utils/tools/glog"
)

// RetryConfig 重试配置
type RetryConfig struct {
	MaxAttempts     int             `json:"max_attempts"`
	InitialDelay    time.Duration   `json:"initial_delay"`
	MaxDelay        time.Duration   `json:"max_delay"`
	BackoffRate     float64         `json:"backoff_rate"`
	RetryableErrors map[string]bool `json:"retryable_errors"`
}

// RetryResult 重试结果
type RetryResult struct {
	Success      bool           `json:"success"`
	Attempts     int            `json:"attempts"`
	Duration     time.Duration  `json:"duration"`
	LastError    error          `json:"last_error"`
	RetryHistory []RetryAttempt `json:"retry_history"`
}

// RetryAttempt 重试尝试记录
type RetryAttempt struct {
	AttemptNumber int           `json:"attempt_number"`
	Delay         time.Duration `json:"delay"`
	Error         error         `json:"error,omitempty"`
	Timestamp     time.Time     `json:"timestamp"`
}

// ErrorHandler 错误处理器
type ErrorHandler struct {
	config        *RetryConfig
	errorHandlers map[string]func(error) error
}

// NewErrorHandler 创建错误处理器
func NewErrorHandler(config *RetryConfig) *ErrorHandler {
	if config == nil {
		config = DefaultRetryConfig()
	}

	return &ErrorHandler{
		config: config,
		errorHandlers: map[string]func(error) error{
			"timeout":      handleTimeoutError,
			"network":      handleNetworkError,
			"proxy":        handleProxyError,
			"rate_limit":   handleRateLimitError,
			"server_error": handleServerError,
		},
	}
}

// DefaultRetryConfig 默认重试配置
func DefaultRetryConfig() *RetryConfig {
	return &RetryConfig{
		MaxAttempts:  3,
		InitialDelay: 1 * time.Second,
		MaxDelay:     30 * time.Second,
		BackoffRate:  2.0,
		RetryableErrors: map[string]bool{
			"timeout":      true,
			"network":      true,
			"proxy":        true,
			"rate_limit":   true,
			"server_error": true,
		},
	}
}

// HandleWithRetry 带重试的错误处理
func (eh *ErrorHandler) HandleWithRetry(ctx context.Context, operation func() error) *RetryResult {
	result := &RetryResult{
		RetryHistory: make([]RetryAttempt, 0),
	}

	var lastErr error
	delay := eh.config.InitialDelay

	for attempt := 1; attempt <= eh.config.MaxAttempts; attempt++ {
		start := time.Now()

		// 执行操作
		err := operation()

		// 记录尝试
		retryAttempt := RetryAttempt{
			AttemptNumber: attempt,
			Delay:         delay,
			Timestamp:     start,
		}

		if err == nil {
			result.Success = true
			result.Duration = time.Since(start)
			result.Attempts = attempt
			return result
		}

		// 处理错误
		retryAttempt.Error = err
		lastErr = err

		// 检查是否可重试
		if !eh.isRetryableError(err) {
			result.LastError = err
			result.Attempts = attempt
			result.Duration = time.Since(start)
			result.RetryHistory = append(result.RetryHistory, retryAttempt)
			break
		}

		// 记录重试
		result.RetryHistory = append(result.RetryHistory, retryAttempt)
		glog.Warn(ctx, "retry_attempt", gform.Map{
			"attempt": attempt,
			"error":   err.Error(),
			"delay":   delay,
		})

		// 如果是最后一次尝试，跳出循环
		if attempt == eh.config.MaxAttempts {
			break
		}

		// 等待延迟
		select {
		case <-ctx.Done():
			result.LastError = ctx.Err()
			result.Attempts = attempt
			result.Duration = time.Since(start)
			return result
		case <-time.After(delay):
			// 继续下一次尝试
		}

		// 指数退避
		delay = time.Duration(float64(delay) * eh.config.BackoffRate)
		if delay > eh.config.MaxDelay {
			delay = eh.config.MaxDelay
		}
	}

	result.Success = false
	result.LastError = lastErr
	result.Duration = time.Since(start)
	result.Attempts = eh.config.MaxAttempts

	return result
}

// isRetryableError 检查错误是否可重试
func (eh *ErrorHandler) isRetryableError(err error) bool {
	// 检查是否是context错误
	if errors.Is(err, context.DeadlineExceeded) || errors.Is(err, context.Canceled) {
		return false
	}

	// 根据错误类型判断
	errorType := eh.classifyError(err)
	return eh.config.RetryableErrors[errorType]
}

// classifyError 分类错误
func (eh *ErrorHandler) classifyError(err error) string {
	if err == nil {
		return "unknown"
	}

	errMsg := err.Error()

	// 检查各种错误类型
	switch {
	case isTimeoutError(errMsg):
		return "timeout"
	case isNetworkError(errMsg):
		return "network"
	case isProxyError(errMsg):
		return "proxy"
	case isRateLimitError(errMsg):
		return "rate_limit"
	case isServerError(errMsg):
		return "server_error"
	default:
		return "unknown"
	}
}

// Error handler functions

func handleTimeoutError(err error) error {
	return fmt.Errorf("timeout error: %w", err)
}

func handleNetworkError(err error) error {
	return fmt.Errorf("network error: %w", err)
}

func handleProxyError(err error) error {
	return fmt.Errorf("proxy error: %w", err)
}

func handleRateLimitError(err error) error {
	return fmt.Errorf("rate limit error: %w", err)
}

func handleServerError(err error) error {
	return fmt.Errorf("server error: %w", err)
}

// Error type check functions

func isTimeoutError(errMsg string) bool {
	timeoutKeywords := []string{
		"timeout", "deadline", "context deadline", "request timeout",
		"connection timeout", "read timeout", "write timeout",
	}

	return containsAny(errMsg, timeoutKeywords)
}

func isNetworkError(errMsg string) bool {
	networkKeywords := []string{
		"connection refused", "no route to host", "network is unreachable",
		"connection reset", "connection closed", "broken pipe",
		"dns resolution failed", "host not found",
	}

	return containsAny(errMsg, networkKeywords)
}

func isProxyError(errMsg string) bool {
	proxyKeywords := []string{
		"proxy error", "proxy authentication", "proxy connection",
		"proxy server", "invalid proxy", "proxy timeout",
	}

	return containsAny(errMsg, proxyKeywords)
}

func isRateLimitError(errMsg string) bool {
	rateLimitKeywords := []string{
		"rate limit", "too many requests", "429", "quota exceeded",
		"request limit", "api limit", "throttled",
	}

	return containsAny(errMsg, rateLimitKeywords)
}

func isServerError(errMsg string) bool {
	serverErrorKeywords := []string{
		"500", "502", "503", "504", "internal server error",
		"bad gateway", "service unavailable", "gateway timeout",
	}

	return containsAny(errMsg, serverErrorKeywords)
}

func containsAny(text string, keywords []string) bool {
	text = strings.ToLower(text)
	for _, keyword := range keywords {
		if strings.Contains(text, strings.ToLower(keyword)) {
			return true
		}
	}
	return false
}

// EnhancedTaskExecution 增强的任务执行器
type EnhancedTaskExecution struct {
	service      *Service
	errorHandler *ErrorHandler
}

// NewEnhancedTaskExecution 创建增强的任务执行器
func NewEnhancedTaskExecution(service *Service) *EnhancedTaskExecution {
	return &EnhancedTaskExecution{
		service:      service,
		errorHandler: NewErrorHandler(DefaultRetryConfig()),
	}
}

// ExecuteWithRetry 带重试的执行
func (ete *EnhancedTaskExecution) ExecuteWithRetry(ctx context.Context, task *BatchTask, url string) (*BatchTaskResult, error) {
	// 创建访问器
	factory := NewAccessorFactory()
	accessor, err := factory.CreateAccessor(task.GetConfig().AccessMethod)
	if err != nil {
		return nil, err
	}

	// 定义操作
	operation := func() error {
		result, err := accessor.Execute(ctx, task, url)
		if err != nil {
			return err
		}

		if result.Status == "FAILED" {
			return fmt.Errorf("task execution failed: %s", result.Error)
		}

		return nil
	}

	// 执行带重试的操作
	retryResult := ete.errorHandler.HandleWithRetry(ctx, operation)

	if !retryResult.Success {
		// 记录重试失败
		glog.Error(ctx, "task_execution_failed_after_retries", gform.Map{
			"task_id":    task.ID,
			"url":        url,
			"attempts":   retryResult.Attempts,
			"last_error": retryResult.LastError,
		})

		return &BatchTaskResult{
			Status:       "FAILED",
			ResponseTime: int(retryResult.Duration.Milliseconds()),
			Error:        fmt.Sprintf("Failed after %d attempts: %v", retryResult.Attempts, retryResult.LastError),
		}, nil
	}

	// 重试成功，再次执行获取结果
	result, err := accessor.Execute(ctx, task, url)
	if err != nil {
		return nil, err
	}

	// 添加重试信息
	if retryResult.Attempts > 1 {
		if result.Data == "" {
			result.Data = "{}"
		}

		var data map[string]interface{}
		if err := json.Unmarshal([]byte(result.Data), &data); err == nil {
			data["retry_info"] = map[string]interface{}{
				"attempts": retryResult.Attempts,
				"duration": retryResult.Duration.Milliseconds(),
			}
			if newData, err := json.Marshal(data); err == nil {
				result.Data = string(newData)
			}
		}
	}

	return result, nil
}

// ExecuteWithProxyFailover 带代理故障转移的执行
func (ete *EnhancedTaskExecution) ExecuteWithProxyFailover(ctx context.Context, task *BatchTask, url string) (*BatchTaskResult, error) {
	config := task.GetConfig()

	// 如果没有配置代理，直接执行
	if config.ProxyUrl == "" {
		return ete.ExecuteWithRetry(ctx, task, url)
	}

	// 尝试使用配置的代理
	result, err := ete.ExecuteWithRetry(ctx, task, url)
	if err == nil && result.Status == "SUCCESS" {
		// 报告代理成功
		if ete.service.proxyPool != nil {
			// 假设我们可以从proxy URL获取代理ID
			proxyID := "configured_proxy"
			ete.service.proxyPool.ReportSuccess(proxyID)
		}
		return result, nil
	}

	// 如果使用配置的代理失败，尝试使用代理池
	if ete.service.proxyPool != nil {
		glog.Info(ctx, "configured_proxy_failed_trying_pool", gform.Map{
			"task_id": task.ID,
			"url":     url,
		})

		// 从代理池获取代理
		proxy, err := ete.service.proxyPool.GetProxy()
		if err == nil {
			// 创建临时任务，使用代理池的代理
			tempTask := *task
			tempConfig := tempTask.GetConfig()
			tempConfig.ProxyUrl = proxy.URL
			tempTask.SetConfig(tempConfig)

			// 尝试使用代理池的代理
			result, err := ete.ExecuteWithRetry(ctx, &tempTask, url)
			if err == nil && result.Status == "SUCCESS" {
				// 报告代理成功
				ete.service.proxyPool.ReportSuccess(proxy.ID)
				return result, nil
			}

			// 报告代理失败
			ete.service.proxyPool.ReportFailure(proxy.ID, err)
		}
	}

	// 所有代理都失败了，不使用代理再试一次
	glog.Info(ctx, "all_proxies_failed_trying_without_proxy", gform.Map{
		"task_id": task.ID,
		"url":     url,
	})

	tempTask := *task
	tempConfig := tempTask.GetConfig()
	tempConfig.ProxyUrl = ""
	tempTask.SetConfig(tempConfig)

	return ete.ExecuteWithRetry(ctx, &tempTask, url)
}
