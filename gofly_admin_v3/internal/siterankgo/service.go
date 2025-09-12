//go:build autoads_siterank_advanced

package siterankgo

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"time"

	"gofly-admin-v3/internal/ratelimit"
	"gofly-admin-v3/internal/store"
	"gofly-admin-v3/internal/user"
	"gofly-admin-v3/utils/gform"
	"gofly-admin-v3/utils/gtime"
	"gofly-admin-v3/utils/tools/gcache"
	"gofly-admin-v3/utils/tools/gjson"
	"gofly-admin-v3/utils/tools/glog"
	"gofly-admin-v3/utils/tools/gstr"
	"gofly-admin-v3/utils/tools/gvalid"
)

// Service SiteRankGo服务（基于GoFly框架）
type Service struct {
	db               *store.DB
	cache            *CacheWrapper
	similarWebClient *SimilarWebClient
	seoClient        *SEORankingClient
	rateLimitManager *ratelimit.RateLimitManager
}

// NewService 创建SiteRankGo服务
func NewService(db *store.DB, redis *store.Redis, rateLimitManager *ratelimit.RateLimitManager) *Service {
	service := &Service{
		db:               db,
		cache:            NewCacheWrapper(db, redis, 10*time.Minute), // 10分钟缓存
		rateLimitManager: rateLimitManager,
	}
	// 初始化SimilarWeb客户端
	service.similarWebClient = NewSimilarWebClient()
	// 初始化SEO排名客户端
	service.seoClient = NewSEORankingClient()
	// 初始化Redis缓存
	if redis != nil {
		service.cache = NewCacheWrapper(db, redis, 10*time.Minute)
	}
	return service
}

// CreateTask 创建排名任务
func (s *Service) CreateTask(userID string, req *CreateTaskRequest) (*SiteRankTask, error) {
	// 验证请求数据
	if err := gvalid.CheckStruct(req); err != nil {
		return nil, err
	}

	// 检查用户权限
	userSvc := user.NewService(s.db)
	userInfo, err := userSvc.GetUserByID(userID)
	if err != nil {
		return nil, gform.Errorf("用户不存在")
	}

	// 检查用户套餐是否允许创建任务
	if !userInfo.CanUseFeature("SITERANK_BASIC") {
		return nil, gform.Errorf("您的套餐不支持此功能")
	}

	// 创建任务
	task := &SiteRankTask{
		ID:           gform.UUID(),
		UserID:       userID,
		Name:         req.Name,
		Domain:       req.Domain,
		SearchEngine: req.SearchEngine,
		Region:       req.Region,
		Language:     req.Language,
		Status:       "PENDING",
		Progress:     0,
		TotalCount:   len(req.Keywords),
		SuccessCount: 0,
		FailedCount:  0,
		ScheduleType: req.ScheduleType,
		ScheduleTime: req.ScheduleTime,
		CreatedAt:    gtime.Now(),
		UpdatedAt:    gtime.Now(),
	}

	// 设置关键词列表
	task.SetKeywords(req.Keywords)

	// 设置配置
	if req.Config != nil {
		task.SetConfig(req.Config)
	}

	// 验证任务配置
	if err := task.Validate(); err != nil {
		return nil, err
	}

	// 计算Token消耗
	tokenCost := task.CalculateTokenCost()

	// 检查用户Token余额
	if userInfo.TokenBalance < tokenCost {
		return nil, gform.Errorf("Token余额不足，需要%d个Token", tokenCost)
	}

	// 扣除Token
	if err := userSvc.DeductToken(userID, tokenCost, "创建网站排名任务"); err != nil {
		return nil, err
	}

	// 保存任务
	if err := s.db.Create(task).Error; err != nil {
		return nil, gform.Errorf("创建任务失败: %v", err)
	}

	// 记录日志
	glog.Info(context.Background(), "siterank_task_created", gform.Map{
		"task_id":       task.ID,
		"user_id":       userID,
		"domain":        task.Domain,
		"keyword_count": len(req.Keywords),
		"token_cost":    tokenCost,
	})

	return task, nil
}

// GetTaskByID 根据ID获取任务
func (s *Service) GetTaskByID(taskID string) (*SiteRankTask, error) {
	var task SiteRankTask

	// 尝试从缓存获取
	cacheKey := gstr.Join("siterank_task:", taskID)
	if val, ok := s.cache.Get(cacheKey); ok {
		if t, ok := val.(*SiteRankTask); ok {
			return t, nil
		}
	}

	// 从数据库查询
	if err := s.db.Model(&SiteRankTask{}).Where("id = ?", taskID).Find(&task).Error; err != nil {
		return nil, err
	}

	// 设置缓存
	s.cache.Set(cacheKey, &task)

	return &task, nil
}

// GetTaskList 获取任务列表（分页）
func (s *Service) GetTaskList(userID string, page, size int, filters map[string]interface{}) ([]SiteRankTask, int64, error) {
	query := s.db.Model(&SiteRankTask{}).Where("user_id = ?", userID)

	// 应用过滤条件
	if status, ok := filters["status"]; ok {
		query = query.Where("status = ?", status)
	}
	if searchEngine, ok := filters["search_engine"]; ok {
		query = query.Where("search_engine = ?", searchEngine)
	}

	// 计算总数
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	// 分页查询
	var tasks []SiteRankTask
	offset := (page - 1) * size
	if err := query.Offset(offset).Limit(size).
		Order("created_at DESC").Find(&tasks).Error; err != nil {
		return nil, 0, err
	}

	return tasks, total, nil
}

// UpdateTask 更新任务
func (s *Service) UpdateTask(taskID string, req *UpdateTaskRequest) (*SiteRankTask, error) {
	// 获取任务
	task, err := s.GetTaskByID(taskID)
	if err != nil {
		return nil, err
	}

	// 检查任务状态
	if !task.CanExecute() && req.Status != "" {
		return nil, gform.Errorf("任务当前状态不允许更新")
	}

	// 更新字段
	updates := make(map[string]interface{})
	if req.Name != "" {
		updates["name"] = req.Name
	}
	if req.Status != "" {
		updates["status"] = req.Status
		updates["updated_at"] = gtime.Now()

		// 如果状态变为运行中，记录开始时间
		if req.Status == "RUNNING" && task.Status != "RUNNING" {
			now := gtime.Now()
			updates["started_at"] = &now
		}

		// 如果状态变为完成，记录完成时间
		if req.Status == "COMPLETED" && task.Status != "COMPLETED" {
			now := gtime.Now()
			updates["completed_at"] = &now
		}
	}

	// 更新关键词
	if len(req.Keywords) > 0 {
		task.SetKeywords(req.Keywords)
		updates["keywords"] = task.Keywords
		updates["total_count"] = len(req.Keywords)
	}

	// 更新搜索引擎和地区
	if req.SearchEngine != "" {
		updates["search_engine"] = req.SearchEngine
	}
	if req.Region != "" {
		updates["region"] = req.Region
	}
	if req.Language != "" {
		updates["language"] = req.Language
	}

	// 更新调度配置
	if req.ScheduleType != "" {
		updates["schedule_type"] = req.ScheduleType
		updates["schedule_time"] = req.ScheduleTime
	}

	// 更新配置
	if req.Config != nil {
		task.SetConfig(req.Config)
		updates["config"] = task.Config
	}

	// 执行更新
	if err := s.db.Model(&SiteRankTask{}).Where("id = ?", taskID).Updates(updates).Error; err != nil {
		return nil, err
	}

	// 清除缓存
	s.cache.Delete(gstr.Join("siterank_task:", taskID))

	// 获取更新后的任务
	return s.GetTaskByID(taskID)
}

// DeleteTask 删除任务
func (s *Service) DeleteTask(taskID string) error {
	// 获取任务
	task, err := s.GetTaskByID(taskID)
	if err != nil {
		return err
	}

	// 检查任务状态
	if task.Status == "RUNNING" {
		return gform.Errorf("运行中的任务不能删除")
	}

	// 软删除任务
	now := gtime.Now()
	if err := s.db.Model(&SiteRankTask{}).Where("id = ?", taskID).
		Update("deleted_at", &now).Error; err != nil {
		return err
	}

	// 清除缓存
	s.cache.Delete(gstr.Join("siterank_task:", taskID))

	// 删除任务结果
	s.db.Model(&SiteRankResult{}).Where("task_id = ?", taskID).
		Update("deleted_at", &now)

	return nil
}

// StartTask 启动任务
func (s *Service) StartTask(taskID string) error {
	// 获取任务
	task, err := s.GetTaskByID(taskID)
	if err != nil {
		return err
	}

	// 检查任务状态
	if !task.CanExecute() {
		return gform.Errorf("任务当前状态无法启动")
	}

	// 更新状态为运行中
	now := gtime.Now()
	updates := map[string]interface{}{
		"status":      "RUNNING",
		"started_at":  &now,
		"updated_at":  gtime.Now(),
		"error":       "",
		"last_run_at": &now,
	}

	if err := s.db.Model(&SiteRankTask{}).Where("id = ?", taskID).Updates(updates).Error; err != nil {
		return err
	}

	// 清除缓存
	s.cache.Delete(gstr.Join("siterank_task:", taskID))

	// 异步执行任务
	go s.executeTask(task)

	return nil
}

// StopTask 停止任务
func (s *Service) StopTask(taskID string) error {
	// 获取任务
	task, err := s.GetTaskByID(taskID)
	if err != nil {
		return err
	}

	// 检查任务状态
	if !task.CanCancel() {
		return gform.Errorf("任务当前状态无法停止")
	}

	// 更新状态为已取消
	updates := map[string]interface{}{
		"status":     "CANCELLED",
		"updated_at": gtime.Now(),
	}

	if err := s.db.Model(&SiteRankTask{}).Where("id = ?", taskID).Updates(updates).Error; err != nil {
		return err
	}

	// 清除缓存
	s.cache.Delete(gstr.Join("siterank_task:", taskID))

	return nil
}

// executeTask 执行任务
func (s *Service) executeTask(task *SiteRankTask) {
	defer func() {
		if r := recover(); r != nil {
			glog.Error(context.Background(), "siterank_task_execute_panic", gform.Map{
				"task_id": task.ID,
				"error":   r,
			})

			// 更新任务状态
			s.updateTaskError(task.ID, fmt.Sprintf("任务执行异常: %v", r))
		}
	}()

	ctx := context.Background()
	keywords := task.GetKeywords()
	totalKeywords := len(keywords)
	config := task.GetConfig()

	// 更新进度
	s.updateTaskProgress(task.ID, 0, 0, 0)

	// 检查是否有SEO客户端可用
	if s.seoClient == nil || len(s.seoClient.GetAvailableProviders()) == 0 {
		glog.Warn(ctx, "seo_client_not_available", gform.Map{
			"task_id": task.ID,
		})
		// 如果没有SEO客户端，使用模拟数据
		s.executeWithMockData(task, keywords)
		return
	}

	// 执行真实的排名检查
	for i, keyword := range keywords {
		// 构建排名请求
		rankReq := &RankingRequest{
			Domain:       task.Domain,
			Keyword:      keyword,
			SearchEngine: task.SearchEngine,
			Region:       task.Region,
			Language:     task.Language,
			Depth:        config.Depth,
		}

		// 尝试从缓存获取
		var result *RankingResult
		var err error

		if cachedResult, found := s.GetCachedRankingResult(task.Domain, keyword, task.SearchEngine); found {
			result = cachedResult
			glog.Info(ctx, "using_cached_ranking", gform.Map{
				"task_id": task.ID,
				"keyword": keyword,
			})
		} else {
			// 获取排名
			result, err = s.seoClient.GetRanking(ctx, rankReq)
			if err != nil {
				glog.Error(ctx, "seo_ranking_error", gform.Map{
					"task_id": task.ID,
					"keyword": keyword,
					"error":   err.Error(),
				})

				// 保存错误结果
				s.saveRankingError(task.ID, keyword, err)
				s.updateTaskProgress(task.ID, (i+1)*100/totalKeywords, i, i+1)
				continue
			}

			// 缓存结果
			s.CacheRankingResult(task.Domain, keyword, task.SearchEngine, result)
		}

		// 保存结果
		if err := s.saveRankingResult(task.ID, result, keyword); err != nil {
			glog.Error(ctx, "siterank_result_save_error", gform.Map{
				"task_id": task.ID,
				"keyword": keyword,
				"error":   err,
			})
			s.updateTaskProgress(task.ID, (i+1)*100/totalKeywords, i, i+1)
		} else {
			// 更新成功计数
			s.updateTaskProgress(task.ID, (i+1)*100/totalKeywords, i+1, 0)
		}

		// API调用延迟（如果使用了缓存，减少延迟）
		if result.Provider == "SerpApi" {
			time.Sleep(time.Millisecond * 1000)
		} else {
			time.Sleep(time.Millisecond * 100)
		}
	}

	// 更新任务完成状态
	s.completeTask(task.ID)
}

// executeWithMockData 使用模拟数据执行（备用方案）
func (s *Service) executeWithMockData(task *SiteRankTask, keywords []string) {
	totalKeywords := len(keywords)

	for i, keyword := range keywords {
		// 模拟排名结果
		position := s.mockRankingPosition(task.Domain, keyword)
		previousPos := position + s.getRandomChange()

		// 保存结果
		result := &SiteRankResult{
			ID:          gform.UUID(),
			TaskID:      task.ID,
			Keyword:     keyword,
			Position:    position,
			PreviousPos: previousPos,
			Change:      previousPos - position,
			URL:         fmt.Sprintf("https://%s/page?q=%s", task.Domain, keyword),
			Title:       fmt.Sprintf("%s - %s", keyword, task.Domain),
			Description: fmt.Sprintf("这是%s的搜索结果描述", keyword),
			CheckTime:   gtime.Now(),
			CreatedAt:   gtime.Now(),
		}

		if err := s.db.Create(result).Error; err != nil {
			glog.Error(context.Background(), "siterank_result_save_error", gform.Map{
				"task_id": task.ID,
				"keyword": keyword,
				"error":   err,
			})
		} else {
			s.updateTaskProgress(task.ID, (i+1)*100/totalKeywords, i+1, 0)
		}
	}

	s.completeTask(task.ID)
}

// saveRankingResult 保存排名结果
func (s *Service) saveRankingResult(taskID string, result *RankingResult, keyword string) error {
	// 获取上次排名（用于计算变化）
	var lastResult SiteRankResult
	s.db.Model(&SiteRankResult{}).
		Where("task_id = ? AND keyword = ?", taskID, keyword).
		Order("check_time DESC").
		First(&lastResult)

	// 保存新结果
	siteRankResult := &SiteRankResult{
		ID:          gform.UUID(),
		TaskID:      taskID,
		Keyword:     keyword,
		Position:    result.Position,
		PreviousPos: lastResult.Position,
		Change:      lastResult.Position - result.Position,
		URL:         result.URL,
		Title:       result.Title,
		Description: result.Description,
		CheckTime:   result.LastChecked,
		CreatedAt:   gtime.Now(),
	}

	// 保存SERP特性
	if len(result.SERPFeatures) > 0 {
		if features, err := json.Marshal(result.SERPFeatures); err == nil {
			siteRankResult.SERPFeatures = string(features)
		}
	}

	return s.db.Create(siteRankResult).Error
}

// saveRankingError 保存排名错误
func (s *Service) saveRankingError(taskID, keyword string, err error) {
	errorResult := &SiteRankResult{
		ID:          gform.UUID(),
		TaskID:      taskID,
		Keyword:     keyword,
		Position:    -1,
		PreviousPos: -1,
		Change:      0,
		URL:         "",
		Title:       "",
		Description: fmt.Sprintf("查询失败: %v", err),
		CheckTime:   gtime.Now(),
		CreatedAt:   gtime.Now(),
	}

	s.db.Create(errorResult)
}

// mockRankingPosition 模拟排名位置
func (s *Service) mockRankingPosition(domain, keyword string) int {
	// 简单的模拟逻辑，实际应该调用SEO API
	hash := 0
	for _, c := range domain + keyword {
		hash = hash*31 + int(c)
	}
	return (hash % 50) + 1 // 返回1-50之间的排名
}

// getRandomChange 获取随机变化
func (s *Service) getRandomChange() int {
	return (int(gtime.Now().UnixNano()) % 10) - 5 // -5到+5的变化
}

// updateTaskProgress 更新任务进度
func (s *Service) updateTaskProgress(taskID string, progress int, successCount, failedCount int) {
	updates := map[string]interface{}{
		"progress":      progress,
		"success_count": successCount,
		"failed_count":  failedCount,
		"updated_at":    gtime.Now(),
	}

	s.db.Model(&SiteRankTask{}).Where("id = ?", taskID).Updates(updates)
	s.cache.Delete(gstr.Join("siterank_task:", taskID))
}

// updateTaskError 更新任务错误
func (s *Service) updateTaskError(taskID string, errorMsg string) {
	updates := map[string]interface{}{
		"status":       "FAILED",
		"error":        errorMsg,
		"updated_at":   gtime.Now(),
		"completed_at": gtime.Now(),
	}

	s.db.Model(&SiteRankTask{}).Where("id = ?", taskID).Updates(updates)
	s.cache.Delete(gstr.Join("siterank_task:", taskID))
}

// completeTask 完成任务
func (s *Service) completeTask(taskID string) {
	updates := map[string]interface{}{
		"status":       "COMPLETED",
		"progress":     100,
		"updated_at":   gtime.Now(),
		"completed_at": gtime.Now(),
	}

	s.db.Model(&SiteRankTask{}).Where("id = ?", taskID).Updates(updates)
	s.cache.Delete(gstr.Join("siterank_task:", taskID))
}

// GetTaskResults 获取任务结果
func (s *Service) GetTaskResults(taskID string, page, size int) ([]SiteRankResultResponse, int64, error) {
	query := s.db.Model(&SiteRankResult{}).Where("task_id = ?", taskID)

	// 计算总数
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	// 分页查询
	var results []SiteRankResult
	offset := (page - 1) * size
	if err := query.Offset(offset).Limit(size).
		Order("check_time DESC").Find(&results).Error; err != nil {
		return nil, 0, err
	}

	// 转换为响应格式
	resultResponses := make([]SiteRankResultResponse, 0, len(results))
	for _, result := range results {
		resultResponses = append(resultResponses, *result.ToResponse())
	}

	return resultResponses, total, nil
}

// GetRankingHistory 获取排名历史
func (s *Service) GetRankingHistory(taskID, keyword string, days int) ([]SiteRankResult, error) {
	// 计算时间范围
	endTime := gtime.Now()
	startTime := endTime.AddDate(0, 0, -days)

	var results []SiteRankResult
	if err := s.db.Model(&SiteRankResult{}).
		Where("task_id = ? AND keyword = ? AND check_time >= ? AND check_time <= ?",
			taskID, keyword, startTime, endTime).
		Order("check_time ASC").
		Find(&results).Error; err != nil {
		return nil, err
	}

	return results, nil
}

// （已移除重复的 CacheWrapper 定义，实际实现见 cache.go）

// GetWebsiteTrafficData 获取网站流量数据（新的业务方法）
func (s *Service) GetWebsiteTrafficData(ctx context.Context, userID, domain string) (*SimilarWebResponse, error) {
	// 检查用户权限
	userSvc := user.NewService(s.db)
	userInfo, err := userSvc.GetUserByID(userID)
	if err != nil {
		return nil, gform.Errorf("用户不存在")
	}

	// 检查用户套餐是否允许使用此功能
	if !userInfo.CanUseFeature("SITERANK_BASIC") {
		return nil, gform.Errorf("您的套餐不支持此功能")
	}

	// 检查速率限制
	if s.rateLimitManager != nil {
		if err := s.rateLimitManager.CheckSiteRankRateLimit(ctx, userID); err != nil {
			return nil, gform.Errorf("请求过于频繁，请稍后再试: %v", err)
		}
	}

	// 计算Token消耗
	tokenCost := int64(100) // 每次查询消耗100 Token
	if userInfo.TokenBalance < tokenCost {
		return nil, gform.Errorf("Token余额不足，需要%d个Token", tokenCost)
	}

	// 创建SimilarWeb请求
	req := &SimilarWebRequest{
		Domain:      domain,
		Country:     "global",
		Granularity: "monthly",
	}

	// 调用SimilarWeb API
	response, err := s.similarWebClient.GetWebsiteData(ctx, userID, req)
	if err != nil {
		return nil, err
	}

	// 扣除Token
	if err := userSvc.DeductToken(userID, tokenCost, "网站流量查询"); err != nil {
		glog.Warn(ctx, "token_deduct_failed", gform.Map{
			"user_id": userID,
			"error":   err,
		})
	}

	// 记录查询历史
	s.saveTrafficQueryHistory(userID, domain, response)

	return response, nil
}

// saveTrafficQueryHistory 保存流量查询历史
func (s *Service) saveTrafficQueryHistory(userID, domain string, data *SimilarWebResponse) {
	history := &SiteRankTask{
		ID:           gform.UUID(),
		UserID:       userID,
		Name:         fmt.Sprintf("流量查询-%s", domain),
		Domain:       domain,
		SearchEngine: "SimilarWeb",
		Status:       "COMPLETED",
		Progress:     100,
		TotalCount:   1,
		SuccessCount: 1,
		CreatedAt:    gtime.Now(),
		UpdatedAt:    gtime.Now(),
		CompletedAt:  func() *time.Time { t := gtime.Now(); return &t }(),
	}

	// 保存SimilarWeb数据到结果中
	visits := FormatVisits(data.Visits)
	resultData := map[string]interface{}{
		"source":          "similarweb",
		"global_rank":     data.GlobalRank,
		"category":        data.Category,
		"category_rank":   data.CategoryRank,
		"country":         data.Country,
		"country_rank":    data.CountryRank,
		"visits":          visits,
		"page_views":      data.PageViews,
		"bounce_rate":     data.BounceRate,
		"visit_duration":  data.VisitDuration,
		"engagement":      data.Engagement,
		"traffic_sources": FormatTrafficSources(data.TrafficSources),
		"top_countries":   data.TopCountries,
		"estimated_value": data.EstimatedValue,
	}

	if jsonData, err := json.Marshal(resultData); err == nil {
		history.SetConfig(map[string]interface{}{
			"api_response": string(jsonData),
		})
	}

	// 保存历史记录
	if err := s.db.Create(history).Error; err != nil {
		glog.Error(context.Background(), "traffic_history_save_error", gform.Map{
			"user_id": userID,
			"domain":  domain,
			"error":   err,
		})
	}
}

// GetTrafficHistory 获取流量查询历史
func (s *Service) GetTrafficHistory(userID, domain string, days int) ([]*SiteRankTaskResponse, error) {
	// 计算时间范围
	endTime := gtime.Now()
	startTime := endTime.AddDate(0, 0, -days)

	var tasks []*SiteRankTask
	if err := s.db.Model(&SiteRankTask{}).
		Where("user_id = ? AND domain = ? AND search_engine = ? AND created_at >= ? AND created_at <= ?",
			userID, domain, "SimilarWeb", startTime, endTime).
		Order("created_at DESC").
		Find(&tasks).Error; err != nil {
		return nil, err
	}

	// 转换为响应格式
	var responses []*SiteRankTaskResponse
	for _, task := range tasks {
		resp := task.ToResponse()
		responses = append(responses, resp)
	}

	return responses, nil
}
