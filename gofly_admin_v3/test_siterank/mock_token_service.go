package siterank

// MockTokenService 模拟Token服务，用于测试和避免循环依赖
type MockTokenService struct{}

// NewMockTokenService 创建模拟Token服务
func NewMockTokenService() *MockTokenService {
	return &MockTokenService{}
}

// CheckTokenSufficiency 检查Token是否足够
func (m *MockTokenService) CheckTokenSufficiency(userID, service, action string, quantity int) (bool, int, int, error) {
	// 模拟用户有足够的Token
	return true, 1000, 1, nil
}

// ConsumeTokensByService 根据服务规则消费Token
func (m *MockTokenService) ConsumeTokensByService(userID, service, action string, quantity int, reference string) error {
	// 模拟成功消费Token
	return nil
}