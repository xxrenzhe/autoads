package adscenter

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

// MockTokenService 模拟Token服务
type MockTokenService struct {
	mock.Mock
}

func (m *MockTokenService) ConsumeTokens(userID string, amount int, description string) error {
	args := m.Called(userID, amount, description)
	return args.Error(0)
}

func (m *MockTokenService) GetBalance(userID string) (int, error) {
	args := m.Called(userID)
	return args.Int(0), args.Error(1)
}

// setupTestDB 设置测试数据库
func setupTestDB() *gorm.DB {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		panic("failed to connect database")
	}

	// 自动迁移
	db.AutoMigrate(&ChengeLinkTask{}, &AdsPowerConfig{}, &GoogleAdsConfig{})

	return db
}

// TestChengeLinkTaskModel 测试任务模型
func TestChengeLinkTaskModel(t *testing.T) {
	t.Run("创建任务", func(t *testing.T) {
		task := &ChengeLinkTask{
			ID:               "test-task-001",
			UserID:           "user-001",
			Name:             "测试任务",
			Status:           TaskStatusPending,
			AffiliateLinks:   []string{"https://affiliate1.com", "https://affiliate2.com"},
			AdsPowerProfile:  "profile-001",
			GoogleAdsAccount: "account-001",
			TotalLinks:       2,
			ExecutionLog:     []ExecutionLogEntry{},
			CreatedAt:        time.Now(),
			UpdatedAt:        time.Now(),
		}

		assert.Equal(t, "test-task-001", task.ID)
		assert.Equal(t, TaskStatusPending, task.Status)
		assert.Equal(t, 2, len(task.AffiliateLinks))
		assert.Equal(t, 2, task.TotalLinks)
		assert.False(t, task.IsCompleted())
	})

	t.Run("添加执行日志", func(t *testing.T) {
		task := &ChengeLinkTask{
			ExecutionLog: []ExecutionLogEntry{},
		}

		task.AddLog("info", "测试消息", "详细信息")

		assert.Equal(t, 1, len(task.ExecutionLog))
		assert.Equal(t, "info", task.ExecutionLog[0].Level)
		assert.Equal(t, "测试消息", task.ExecutionLog[0].Message)
		assert.Equal(t, "详细信息", task.ExecutionLog[0].Details)
	})

	t.Run("计算Token消费", func(t *testing.T) {
		task := &ChengeLinkTask{
			AffiliateLinks: []string{"url1", "url2", "url3"},
		}

		cost := task.CalculateTokenCost()
		// 3个链接提取(3 Token) + 3个广告更新(9 Token) = 12 Token
		assert.Equal(t, 12, cost)
	})

	t.Run("获取成功率", func(t *testing.T) {
		task := &ChengeLinkTask{
			TotalLinks:     4,
			ExtractedCount: 3,
			UpdatedCount:   2,
		}

		successRate := task.GetSuccessRate()
		// (3+2) / (4*2) * 100 = 62.5%
		assert.Equal(t, 62.5, successRate)
	})
}

// TestChengeLinkService 测试服务层
func TestChengeLinkService(t *testing.T) {
	db := setupTestDB()
	mockTokenService := new(MockTokenService)
	service := NewChengeLinkService(db, mockTokenService)

	t.Run("创建任务 - 成功", func(t *testing.T) {
		mockTokenService.On("GetBalance", "user-001").Return(100, nil)

		req := &CreateTaskRequest{
			Name:             "测试任务",
			AffiliateLinks:   []string{"https://affiliate1.com", "https://affiliate2.com"},
			AdsPowerProfile:  "profile-001",
			GoogleAdsAccount: "account-001",
		}

		task, err := service.CreateTask("user-001", req)

		assert.NoError(t, err)
		assert.NotNil(t, task)
		assert.Equal(t, "测试任务", task.Name)
		assert.Equal(t, TaskStatusPending, task.Status)
		assert.Equal(t, 2, len(task.AffiliateLinks))

		mockTokenService.AssertExpectations(t)
	})

	t.Run("创建任务 - Token余额不足", func(t *testing.T) {
		mockTokenService.On("GetBalance", "user-002").Return(5, nil)

		req := &CreateTaskRequest{
			Name:             "测试任务",
			AffiliateLinks:   []string{"https://affiliate1.com", "https://affiliate2.com"},
			AdsPowerProfile:  "profile-001",
			GoogleAdsAccount: "account-001",
		}

		task, err := service.CreateTask("user-002", req)

		assert.Error(t, err)
		assert.Nil(t, task)
		assert.Contains(t, err.Error(), "Token余额不足")

		mockTokenService.AssertExpectations(t)
	})

	t.Run("验证请求参数", func(t *testing.T) {
		testCases := []struct {
			name    string
			req     *CreateTaskRequest
			wantErr string
		}{
			{
				name: "任务名称为空",
				req: &CreateTaskRequest{
					Name:             "",
					AffiliateLinks:   []string{"https://affiliate1.com"},
					AdsPowerProfile:  "profile-001",
					GoogleAdsAccount: "account-001",
				},
				wantErr: "任务名称不能为空",
			},
			{
				name: "联盟链接为空",
				req: &CreateTaskRequest{
					Name:             "测试任务",
					AffiliateLinks:   []string{},
					AdsPowerProfile:  "profile-001",
					GoogleAdsAccount: "account-001",
				},
				wantErr: "联盟链接不能为空",
			},
			{
				name: "AdsPower配置为空",
				req: &CreateTaskRequest{
					Name:             "测试任务",
					AffiliateLinks:   []string{"https://affiliate1.com"},
					AdsPowerProfile:  "",
					GoogleAdsAccount: "account-001",
				},
				wantErr: "AdsPower配置不能为空",
			},
		}

		for _, tc := range testCases {
			t.Run(tc.name, func(t *testing.T) {
				err := service.validateCreateRequest(tc.req)
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tc.wantErr)
			})
		}
	})
}

// TestAdsPowerClient 测试AdsPower客户端
func TestAdsPowerClient(t *testing.T) {
	t.Run("模拟客户端 - 链接提取", func(t *testing.T) {
		client := NewMockAdsPowerClient()

		result, err := client.ExtractFinalURL("profile-001", "https://affiliate.com/redirect?url=target")

		assert.NoError(t, err)
		assert.NotNil(t, result)
		assert.True(t, result.Success)
		assert.Equal(t, "https://affiliate.com/redirect?url=target", result.AffiliateURL)
		assert.Contains(t, result.FinalURL, "target-site.com")
		assert.Equal(t, 2, len(result.RedirectChain))
	})

	t.Run("模拟客户端 - 连接测试", func(t *testing.T) {
		client := NewMockAdsPowerClient()

		err := client.TestConnection()

		assert.NoError(t, err)
	})

	t.Run("模拟客户端 - 获取配置列表", func(t *testing.T) {
		client := NewMockAdsPowerClient()

		profiles, err := client.GetProfileList()

		assert.NoError(t, err)
		assert.Equal(t, 2, len(profiles))
		assert.Equal(t, "profile_001", profiles[0].ID)
		assert.Equal(t, "测试配置1", profiles[0].Name)
	})
}

// TestGoogleAdsClient 测试Google Ads客户端
func TestGoogleAdsClient(t *testing.T) {
	t.Run("模拟客户端 - 获取广告列表", func(t *testing.T) {
		client := NewMockGoogleAdsClient()

		ads, err := client.GetAds()

		assert.NoError(t, err)
		assert.Equal(t, 3, len(ads))
		assert.Equal(t, "ad_001", ads[0].ID)
		assert.Equal(t, "测试广告1", ads[0].Name)
		assert.Equal(t, "ENABLED", ads[0].Status)
	})

	t.Run("模拟客户端 - 更新广告URL", func(t *testing.T) {
		client := NewMockGoogleAdsClient()

		result, err := client.UpdateAdFinalURL("ad_001", "https://new-url.com")

		assert.NoError(t, err)
		assert.NotNil(t, result)
		assert.True(t, result.Success)
		assert.Equal(t, "ad_001", result.AdID)
	})

	t.Run("模拟客户端 - 更新无效URL", func(t *testing.T) {
		client := NewMockGoogleAdsClient()

		result, err := client.UpdateAdFinalURL("ad_001", "https://invalid-url.com")

		assert.NoError(t, err)
		assert.NotNil(t, result)
		assert.False(t, result.Success)
		assert.Contains(t, result.ErrorMessage, "无效的URL格式")
	})

	t.Run("模拟客户端 - 批量更新", func(t *testing.T) {
		client := NewMockGoogleAdsClient()

		updates := []UpdateAdRequest{
			{AdID: "ad_001", FinalURL: "https://new-url1.com"},
			{AdID: "ad_002", FinalURL: "https://new-url2.com"},
		}

		results, err := client.BatchUpdateAds(updates)

		assert.NoError(t, err)
		assert.Equal(t, 2, len(results))
		assert.True(t, results[0].Success)
		assert.True(t, results[1].Success)
	})

	t.Run("模拟客户端 - 连接测试", func(t *testing.T) {
		client := NewMockGoogleAdsClient()

		err := client.TestConnection()

		assert.NoError(t, err)
	})
}

// TestTaskStatusConstants 测试任务状态常量
func TestTaskStatusConstants(t *testing.T) {
	assert.Equal(t, TaskStatus("pending"), TaskStatusPending)
	assert.Equal(t, TaskStatus("extracting"), TaskStatusExtracting)
	assert.Equal(t, TaskStatus("updating"), TaskStatusUpdating)
	assert.Equal(t, TaskStatus("completed"), TaskStatusCompleted)
	assert.Equal(t, TaskStatus("failed"), TaskStatusFailed)
	assert.Equal(t, TaskStatus("cancelled"), TaskStatusCancelled)
}

// TestConfigModels 测试配置模型
func TestConfigModels(t *testing.T) {
	t.Run("AdsPower配置", func(t *testing.T) {
		config := &AdsPowerConfig{
			UserID:      "user-001",
			Name:        "测试配置",
			ProfileID:   "profile-001",
			APIEndpoint: "http://localhost:50325",
			APIKey:      "test-key",
			IsActive:    true,
		}

		assert.Equal(t, "user-001", config.UserID)
		assert.Equal(t, "测试配置", config.Name)
		assert.True(t, config.IsActive)
		assert.Equal(t, "adspower_configs", config.TableName())
	})

	t.Run("Google Ads配置", func(t *testing.T) {
		config := &GoogleAdsConfig{
			UserID:         "user-001",
			Name:           "测试账号",
			CustomerID:     "1234567890",
			DeveloperToken: "dev-token",
			ClientID:       "client-id",
			ClientSecret:   "client-secret",
			RefreshToken:   "refresh-token",
			IsActive:       true,
		}

		assert.Equal(t, "user-001", config.UserID)
		assert.Equal(t, "测试账号", config.Name)
		assert.Equal(t, "1234567890", config.CustomerID)
		assert.True(t, config.IsActive)
		assert.Equal(t, "google_ads_configs", config.TableName())
	})
}

// TestIntegrationWorkflow 测试完整工作流程
func TestIntegrationWorkflow(t *testing.T) {
	db := setupTestDB()
	mockTokenService := new(MockTokenService)
	service := NewChengeLinkService(db, mockTokenService)

	// 创建测试配置
	adsPowerConfig := &AdsPowerConfig{
		UserID:      "user-001",
		Name:        "测试AdsPower",
		ProfileID:   "mock",
		APIEndpoint: "mock",
		IsActive:    true,
	}
	db.Create(adsPowerConfig)

	googleAdsConfig := &GoogleAdsConfig{
		UserID:     "user-001",
		Name:       "测试Google Ads",
		CustomerID: "mock",
		IsActive:   true,
	}
	db.Create(googleAdsConfig)

	t.Run("完整任务流程", func(t *testing.T) {
		// 1. 创建任务
		mockTokenService.On("GetBalance", "user-001").Return(100, nil)
		mockTokenService.On("ConsumeTokens", "user-001", 2, mock.AnythingOfType("string")).Return(nil)
		mockTokenService.On("ConsumeTokens", "user-001", 9, mock.AnythingOfType("string")).Return(nil)

		req := &CreateTaskRequest{
			Name:             "集成测试任务",
			AffiliateLinks:   []string{"https://affiliate1.com", "https://affiliate2.com"},
			AdsPowerProfile:  "mock",
			GoogleAdsAccount: "mock",
		}

		task, err := service.CreateTask("user-001", req)
		assert.NoError(t, err)
		assert.NotNil(t, task)

		// 2. 启动任务
		err = service.StartTask(task.ID)
		assert.NoError(t, err)

		// 等待任务完成（模拟环境下很快）
		time.Sleep(2 * time.Second)

		// 3. 检查任务状态
		updatedTask, err := service.GetTask(task.ID)
		assert.NoError(t, err)
		assert.Equal(t, TaskStatusCompleted, updatedTask.Status)
		assert.Greater(t, updatedTask.ExtractedCount, 0)
		assert.Greater(t, updatedTask.UpdatedCount, 0)
		assert.Greater(t, len(updatedTask.ExecutionLog), 0)

		// 4. 获取统计信息
		stats, err := service.GetStats("user-001")
		assert.NoError(t, err)
		assert.Equal(t, 1, stats.TotalTasks)
		assert.Equal(t, 1, stats.CompletedTasks)
		assert.Greater(t, stats.TotalLinksExtracted, 0)
		assert.Greater(t, stats.TotalAdsUpdated, 0)

		mockTokenService.AssertExpectations(t)
	})
}

// BenchmarkLinkExtraction 链接提取性能测试
func BenchmarkLinkExtraction(b *testing.B) {
	client := NewMockAdsPowerClient()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := client.ExtractFinalURL("profile-001", "https://affiliate.com/test")
		if err != nil {
			b.Fatal(err)
		}
	}
}

// BenchmarkAdUpdate 广告更新性能测试
func BenchmarkAdUpdate(b *testing.B) {
	client := NewMockGoogleAdsClient()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := client.UpdateAdFinalURL("ad_001", "https://new-url.com")
		if err != nil {
			b.Fatal(err)
		}
	}
}
