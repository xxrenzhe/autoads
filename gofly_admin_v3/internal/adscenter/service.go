package adscenter

import (
	"fmt"
	"sync"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// AdsCenterService 自动化广告服务
type AdsCenterService struct {
	db           *gorm.DB
	tokenService TokenService
	mu           sync.RWMutex
    runningTasks map[string]*AdsCenterTask
}

// TokenService Token服务接口
type TokenService interface {
    ConsumeTokensByService(userID, service, action string, quantity int, reference string) error
    GetBalance(userID string) (int, error)
}

// NewAdsCenterService 创建 AdsCenter 服务
func NewAdsCenterService(db *gorm.DB, tokenService TokenService) *AdsCenterService {
    return &AdsCenterService{
		db:           db,
		tokenService: tokenService,
        runningTasks: make(map[string]*AdsCenterTask),
	}
}

// CreateTask 创建链接更新任务
func (s *AdsCenterService) CreateTask(userID string, req *CreateTaskRequest) (*AdsCenterTask, error) {
	// 验证请求参数
    if err := s.validateCreateRequest(req); err != nil {
		return nil, fmt.Errorf("参数验证失败: %w", err)
	}

	// 检查Token余额
	tokenCost := s.calculateTokenCost(req)
	balance, err := s.tokenService.GetBalance(userID)
	if err != nil {
		return nil, fmt.Errorf("获取Token余额失败: %w", err)
	}

	if balance < tokenCost {
		return nil, fmt.Errorf("Token余额不足，需要%d个Token，当前余额%d", tokenCost, balance)
	}

	// 创建任务
    task := &AdsCenterTask{
		ID:               uuid.New().String(),
		UserID:           userID,
		Name:             req.Name,
		Status:           TaskStatusPending,
		AffiliateLinks:   req.AffiliateLinks,
		AdsPowerProfile:  req.AdsPowerProfile,
		GoogleAdsAccount: req.GoogleAdsAccount,
		TotalLinks:       len(req.AffiliateLinks),
		ExecutionLog:     []ExecutionLogEntry{},
		CreatedAt:        time.Now(),
		UpdatedAt:        time.Now(),
	}

	// 添加初始日志
	task.AddLog("info", "任务创建成功", fmt.Sprintf("包含%d个联盟链接", len(req.AffiliateLinks)))

	// 保存到数据库
	if err := s.db.Create(task).Error; err != nil {
		return nil, fmt.Errorf("保存任务失败: %w", err)
	}

	return task, nil
}

// CreateTaskRequest 创建任务请求
type CreateTaskRequest struct {
	Name             string   `json:"name" binding:"required"`
	AffiliateLinks   []string `json:"affiliate_links" binding:"required,min=1"`
	AdsPowerProfile  string   `json:"adspower_profile" binding:"required"`
	GoogleAdsAccount string   `json:"google_ads_account" binding:"required"`
}

// validateCreateRequest 验证创建请求
func (s *AdsCenterService) validateCreateRequest(req *CreateTaskRequest) error {
	if req.Name == "" {
		return fmt.Errorf("任务名称不能为空")
	}

	if len(req.AffiliateLinks) == 0 {
		return fmt.Errorf("联盟链接不能为空")
	}

	if len(req.AffiliateLinks) > 100 {
		return fmt.Errorf("联盟链接数量不能超过100个")
	}

	if req.AdsPowerProfile == "" {
		return fmt.Errorf("AdsPower配置不能为空")
	}

	if req.GoogleAdsAccount == "" {
		return fmt.Errorf("Google Ads账号不能为空")
	}

	return nil
}

// calculateTokenCost 计算Token消费
func (s *AdsCenterService) calculateTokenCost(req *CreateTaskRequest) int {
	// 链接提取: 1 Token per link
	extractCost := len(req.AffiliateLinks)

	// 广告更新: 3 Token per ad (估算)
	// 实际会根据真实广告数量计算
	updateCost := len(req.AffiliateLinks) * 3

	return extractCost + updateCost
}

// StartTask 启动任务执行
func (s *AdsCenterService) StartTask(taskID string) error {
	// 获取任务
	task, err := s.GetTask(taskID)
	if err != nil {
		return fmt.Errorf("获取任务失败: %w", err)
	}

	// 检查任务状态
	if task.Status != TaskStatusPending {
		return fmt.Errorf("任务状态不正确，当前状态: %s", task.Status)
	}

	// 检查是否已在运行
	s.mu.RLock()
	if _, exists := s.runningTasks[taskID]; exists {
		s.mu.RUnlock()
		return fmt.Errorf("任务已在运行中")
	}
	s.mu.RUnlock()

	// 标记为运行中
	s.mu.Lock()
	s.runningTasks[taskID] = task
	s.mu.Unlock()

	// 异步执行任务
	go s.executeTask(task)

	return nil
}

// executeTask 执行任务
func (s *AdsCenterService) executeTask(task *AdsCenterTask) {
	defer func() {
		// 清理运行状态
		s.mu.Lock()
		delete(s.runningTasks, task.ID)
		s.mu.Unlock()

		// 恢复panic
		if r := recover(); r != nil {
			task.Status = TaskStatusFailed
			task.AddLog("error", "任务执行异常", fmt.Sprintf("Panic: %v", r))
			task.CompletedAt = &[]time.Time{time.Now()}[0]
			s.db.Save(task)
		}
	}()

	// 更新任务状态
	task.Status = TaskStatusExtracting
	task.StartedAt = &[]time.Time{time.Now()}[0]
	task.AddLog("info", "开始执行任务", "")
	s.db.Save(task)

	// 消费Token（链接提取部分）
    extractTokens := len(task.AffiliateLinks)
    if err := s.tokenService.ConsumeTokensByService(task.UserID, "adscenter", "extract_link", extractTokens, task.ID); err != nil {
        task.Status = TaskStatusFailed
        task.AddLog("error", "Token消费失败", err.Error())
        task.CompletedAt = &[]time.Time{time.Now()}[0]
        s.db.Save(task)
        return
	}

	task.TokensConsumed += extractTokens

	// 第一阶段：链接提取
	if err := s.extractLinks(task); err != nil {
		task.Status = TaskStatusFailed
		task.AddLog("error", "链接提取失败", err.Error())
		task.CompletedAt = &[]time.Time{time.Now()}[0]
		s.db.Save(task)
		return
	}

	// 第二阶段：广告更新
	task.Status = TaskStatusUpdating
	task.AddLog("info", "开始更新Google Ads", "")
	s.db.Save(task)

	if err := s.updateGoogleAds(task); err != nil {
		task.Status = TaskStatusFailed
		task.AddLog("error", "广告更新失败", err.Error())
		task.CompletedAt = &[]time.Time{time.Now()}[0]
		s.db.Save(task)
		return
	}

	// 任务完成
	task.Status = TaskStatusCompleted
	task.AddLog("info", "任务执行完成", fmt.Sprintf("成功提取%d个链接，更新%d个广告", task.ExtractedCount, task.UpdatedCount))
	task.CompletedAt = &[]time.Time{time.Now()}[0]
	s.db.Save(task)
}

// extractLinks 提取链接
func (s *AdsCenterService) extractLinks(task *AdsCenterTask) error {
	// 获取AdsPower配置
	var adsPowerConfig AdsPowerConfig
	if err := s.db.Where("user_id = ? AND profile_id = ? AND is_active = ?",
		task.UserID, task.AdsPowerProfile, true).First(&adsPowerConfig).Error; err != nil {
		return fmt.Errorf("获取AdsPower配置失败: %w", err)
	}

	// 创建AdsPower客户端
	var client AdsPowerClientInterface
	if adsPowerConfig.APIEndpoint == "mock" {
		client = NewMockAdsPowerClient()
	} else {
		client = NewAdsPowerClient(adsPowerConfig.APIEndpoint, adsPowerConfig.APIKey)
	}

	// 测试连接
	if err := client.TestConnection(); err != nil {
		return fmt.Errorf("AdsPower连接测试失败: %w", err)
	}

	task.AddLog("info", "AdsPower连接成功", "")

	// 并发提取链接
	extractedLinks := make([]ExtractedLink, 0, len(task.AffiliateLinks))
	semaphore := make(chan struct{}, 3) // 限制并发数为3

	var wg sync.WaitGroup
	var mu sync.Mutex

	for _, affiliateURL := range task.AffiliateLinks {
		wg.Add(1)
		go func(url string) {
			defer wg.Done()

			semaphore <- struct{}{}        // 获取信号量
			defer func() { <-semaphore }() // 释放信号量

			result, err := client.ExtractFinalURL(adsPowerConfig.ProfileID, url)
			if err != nil {
				task.AddLog("warning", "链接提取异常", fmt.Sprintf("URL: %s, Error: %v", url, err))
				return
			}

			extractedLink := ExtractedLink{
				AffiliateURL: result.AffiliateURL,
				FinalURL:     result.FinalURL,
				Status:       "success",
				ExtractedAt:  time.Now().Format("2006-01-02 15:04:05"),
			}

			if !result.Success {
				extractedLink.Status = "failed"
				extractedLink.ErrorMessage = result.Error
				task.AddLog("warning", "链接提取失败", fmt.Sprintf("URL: %s, Error: %s", url, result.Error))
			} else {
				task.AddLog("info", "链接提取成功", fmt.Sprintf("URL: %s -> %s", url, result.FinalURL))
			}

			mu.Lock()
			extractedLinks = append(extractedLinks, extractedLink)
			if extractedLink.Status == "success" {
				task.ExtractedCount++
			} else {
				task.FailedCount++
			}
			mu.Unlock()

			// 更新进度
			task.UpdateProgress(s.db)
		}(affiliateURL)
	}

	wg.Wait()

	// 保存提取结果
	task.ExtractedLinks = extractedLinks

	if task.ExtractedCount == 0 {
		return fmt.Errorf("没有成功提取任何链接")
	}

	task.AddLog("info", "链接提取完成", fmt.Sprintf("成功: %d, 失败: %d", task.ExtractedCount, task.FailedCount))
	return nil
}

// updateGoogleAds 更新Google Ads
func (s *AdsCenterService) updateGoogleAds(task *AdsCenterTask) error {
	// 获取Google Ads配置
	var googleAdsConfig GoogleAdsConfig
	if err := s.db.Where("user_id = ? AND customer_id = ? AND is_active = ?",
		task.UserID, task.GoogleAdsAccount, true).First(&googleAdsConfig).Error; err != nil {
		return fmt.Errorf("获取Google Ads配置失败: %w", err)
	}

	// 创建Google Ads客户端
	var client GoogleAdsClientInterface
	if googleAdsConfig.CustomerID == "mock" {
		client = NewMockGoogleAdsClient()
	} else {
		client = NewGoogleAdsClient(&googleAdsConfig)
	}

	// 测试连接
	if err := client.TestConnection(); err != nil {
		return fmt.Errorf("Google Ads连接测试失败: %w", err)
	}

	task.AddLog("info", "Google Ads连接成功", "")

	// 获取所有广告
	ads, err := client.GetAds()
	if err != nil {
		return fmt.Errorf("获取广告列表失败: %w", err)
	}

	task.AddLog("info", "获取广告列表成功", fmt.Sprintf("共%d个广告", len(ads)))

	// 准备更新请求
	var updateRequests []UpdateAdRequest
	successfulLinks := make(map[string]string) // affiliate_url -> final_url

	for _, link := range task.ExtractedLinks {
		if link.Status == "success" {
			successfulLinks[link.AffiliateURL] = link.FinalURL
		}
	}

	// 为每个成功提取的链接更新对应的广告
	linkIndex := 0
	for _, ad := range ads {
		if ad.Status != "ENABLED" {
			continue // 跳过非启用状态的广告
		}

		// 轮询使用提取的链接
		if linkIndex < len(task.ExtractedLinks) {
			link := task.ExtractedLinks[linkIndex]
			if link.Status == "success" {
				updateRequests = append(updateRequests, UpdateAdRequest{
					AdID:     ad.ID,
					FinalURL: link.FinalURL,
				})
			}
			linkIndex++
		}
	}

	if len(updateRequests) == 0 {
		return fmt.Errorf("没有需要更新的广告")
	}

	// 消费Token（广告更新部分）
    updateTokens := len(updateRequests)
    if err := s.tokenService.ConsumeTokensByService(task.UserID, "adscenter", "update_ad", updateTokens, task.ID); err != nil {
        return fmt.Errorf("Token消费失败: %w", err)
    }

	task.TokensConsumed += updateTokens

	// 批量更新广告
	results, err := client.BatchUpdateAds(updateRequests)
	if err != nil {
		return fmt.Errorf("批量更新广告失败: %w", err)
	}

	// 处理更新结果
	updateResults := make([]AdUpdateResult, 0, len(results))
	for i, result := range results {
		adInfo := ads[i] // 假设顺序一致
		updateResult := AdUpdateResult{
			AdID:        result.AdID,
			AdName:      adInfo.Name,
			OldFinalURL: adInfo.FinalURL,
			NewFinalURL: updateRequests[i].FinalURL,
			Status:      "success",
			UpdatedAt:   time.Now().Format("2006-01-02 15:04:05"),
		}

		if !result.Success {
			updateResult.Status = "failed"
			updateResult.ErrorMessage = result.ErrorMessage
			task.FailedCount++
			task.AddLog("warning", "广告更新失败", fmt.Sprintf("AdID: %s, Error: %s", result.AdID, result.ErrorMessage))
		} else {
			task.UpdatedCount++
			task.AddLog("info", "广告更新成功", fmt.Sprintf("AdID: %s, URL: %s", result.AdID, updateRequests[i].FinalURL))
		}

		updateResults = append(updateResults, updateResult)
	}

	task.UpdateResults = updateResults
	task.AddLog("info", "广告更新完成", fmt.Sprintf("成功: %d, 失败: %d", task.UpdatedCount, len(results)-task.UpdatedCount))

	return nil
}

// GetTask 获取任务
func (s *AdsCenterService) GetTask(taskID string) (*AdsCenterTask, error) {
    var task AdsCenterTask
	if err := s.db.Where("id = ?", taskID).First(&task).Error; err != nil {
		return nil, fmt.Errorf("任务不存在: %w", err)
	}
	return &task, nil
}

// GetUserTasks 获取用户任务列表
func (s *AdsCenterService) GetUserTasks(userID string, page, size int) ([]AdsCenterTask, int64, error) {
    var tasks []AdsCenterTask
	var total int64

	query := s.db.Where("user_id = ?", userID)

	// 获取总数
    if err := query.Model(&AdsCenterTask{}).Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("获取任务总数失败: %w", err)
	}

	// 获取分页数据
	offset := (page - 1) * size
	if err := query.Order("created_at DESC").Offset(offset).Limit(size).Find(&tasks).Error; err != nil {
		return nil, 0, fmt.Errorf("获取任务列表失败: %w", err)
	}

	return tasks, total, nil
}

// CancelTask 取消任务
func (s *AdsCenterService) CancelTask(taskID string) error {
	task, err := s.GetTask(taskID)
	if err != nil {
		return err
	}

	if task.IsCompleted() {
		return fmt.Errorf("任务已完成，无法取消")
	}

	// 更新状态
	task.Status = TaskStatusCancelled
	task.AddLog("info", "任务已取消", "用户手动取消")
	task.CompletedAt = &[]time.Time{time.Now()}[0]

	// 从运行列表中移除
	s.mu.Lock()
	delete(s.runningTasks, taskID)
	s.mu.Unlock()

	return s.db.Save(task).Error
}

// GetStats 获取统计信息
func (s *AdsCenterService) GetStats(userID string) (*AdsCenterStats, error) {
    var stats AdsCenterStats

	// 获取任务统计
	var totalTasks, completedTasks, failedTasks int64

    if err := s.db.Model(&AdsCenterTask{}).Where("user_id = ?", userID).Count(&totalTasks).Error; err != nil {
		return nil, fmt.Errorf("获取任务总数失败: %w", err)
	}

    if err := s.db.Model(&AdsCenterTask{}).Where("user_id = ? AND status = ?", userID, TaskStatusCompleted).Count(&completedTasks).Error; err != nil {
		return nil, fmt.Errorf("获取完成任务数失败: %w", err)
	}

    if err := s.db.Model(&AdsCenterTask{}).Where("user_id = ? AND status = ?", userID, TaskStatusFailed).Count(&failedTasks).Error; err != nil {
		return nil, fmt.Errorf("获取失败任务数失败: %w", err)
	}

	stats.TotalTasks = int(totalTasks)
	stats.CompletedTasks = int(completedTasks)
	stats.FailedTasks = int(failedTasks)

	// 获取链接和广告统计
	var sumResult struct {
		TotalExtracted int `json:"total_extracted"`
		TotalUpdated   int `json:"total_updated"`
		TotalTokens    int `json:"total_tokens"`
	}

    if err := s.db.Model(&AdsCenterTask{}).
		Select("SUM(extracted_count) as total_extracted, SUM(updated_count) as total_updated, SUM(tokens_consumed) as total_tokens").
		Where("user_id = ?", userID).
		Scan(&sumResult).Error; err != nil {
		return nil, fmt.Errorf("获取汇总统计失败: %w", err)
	}

	stats.TotalLinksExtracted = sumResult.TotalExtracted
	stats.TotalAdsUpdated = sumResult.TotalUpdated
	stats.TokensConsumed = sumResult.TotalTokens

	// 计算成功率
	if stats.TotalTasks > 0 {
		stats.SuccessRate = float64(stats.CompletedTasks) / float64(stats.TotalTasks) * 100
	}

	return &stats, nil
}

// 接口定义
type AdsPowerClientInterface interface {
	ExtractFinalURL(profileID, affiliateURL string) (*LinkExtractionResult, error)
	TestConnection() error
}

type GoogleAdsClientInterface interface {
	GetAds() ([]AdInfo, error)
	BatchUpdateAds(updates []UpdateAdRequest) ([]UpdateAdResponse, error)
	TestConnection() error
}
