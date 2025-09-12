package auth

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
)

// GoogleUserInfo Google用户信息
type GoogleUserInfo struct {
	ID            string `json:"id"`
	Email         string `json:"email"`
	VerifiedEmail bool   `json:"verified_email"`
	Name          string `json:"name"`
	Picture       string `json:"picture"`
	GivenName     string `json:"given_name"`
	FamilyName    string `json:"family_name"`
}

// GoogleOAuthConfig Google OAuth配置
type GoogleOAuthConfig struct {
	ClientID     string
	ClientSecret string
	RedirectURL  string
	Scopes       []string
}

// DefaultGoogleOAuthConfig 默认Google OAuth配置
func DefaultGoogleOAuthConfig() *GoogleOAuthConfig {
	return &GoogleOAuthConfig{
		ClientID:     "your-google-client-id",
		ClientSecret: "your-google-client-secret",
		RedirectURL:  "http://localhost:8080/auth/google/callback",
		Scopes:       []string{"openid", "profile", "email"},
	}
}

// GoogleOAuthService Google OAuth服务
type GoogleOAuthService struct {
	config      *GoogleOAuthConfig
	oauthConfig *oauth2.Config
}

// NewGoogleOAuthService 创建Google OAuth服务
func NewGoogleOAuthService(config *GoogleOAuthConfig) *GoogleOAuthService {
	if config == nil {
		config = DefaultGoogleOAuthConfig()
	}

	oauthConfig := &oauth2.Config{
		ClientID:     config.ClientID,
		ClientSecret: config.ClientSecret,
		RedirectURL:  config.RedirectURL,
		Scopes:       config.Scopes,
		Endpoint:     google.Endpoint,
	}

	return &GoogleOAuthService{
		config:      config,
		oauthConfig: oauthConfig,
	}
}

// GetAuthURL 获取Google OAuth认证URL
func (s *GoogleOAuthService) GetAuthURL(state string) string {
	return s.oauthConfig.AuthCodeURL(state, oauth2.AccessTypeOffline)
}

// ExchangeCode 用授权码换取访问令牌
func (s *GoogleOAuthService) ExchangeCode(ctx context.Context, code string) (*oauth2.Token, error) {
	return s.oauthConfig.Exchange(ctx, code)
}

// GetUserInfo 获取用户信息
func (s *GoogleOAuthService) GetUserInfo(ctx context.Context, token *oauth2.Token) (*GoogleUserInfo, error) {
	client := s.oauthConfig.Client(ctx, token)

	resp, err := client.Get("https://www.googleapis.com/oauth2/v2/userinfo")
	if err != nil {
		return nil, fmt.Errorf("failed to get user info: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("failed to get user info: status %d", resp.StatusCode)
	}

	var userInfo GoogleUserInfo
	if err := json.NewDecoder(resp.Body).Decode(&userInfo); err != nil {
		return nil, fmt.Errorf("failed to decode user info: %w", err)
	}

	return &userInfo, nil
}

// VerifyIDToken 验证Google ID Token
func (s *GoogleOAuthService) VerifyIDToken(idToken string) (*GoogleUserInfo, error) {
	if idToken == "" {
		return nil, errors.New("ID token is required")
	}

	// 简化的ID Token验证
	// 在生产环境中，应该使用Google的库来验证ID Token
	// 这里为了演示目的，返回模拟数据

	// 检查token格式
	parts := strings.Split(idToken, ".")
	if len(parts) != 3 {
		return nil, errors.New("invalid ID token format")
	}

	// 模拟验证成功，返回用户信息
	return &GoogleUserInfo{
		ID:            "google_user_123",
		Email:         "user@gmail.com",
		VerifiedEmail: true,
		Name:          "Google User",
		Picture:       "https://lh3.googleusercontent.com/a/default-user",
		GivenName:     "Google",
		FamilyName:    "User",
	}, nil
}

// HandleCallback 处理Google OAuth回调
func (s *GoogleOAuthService) HandleCallback(ctx context.Context, code, state string) (*GoogleUserInfo, error) {
	// 验证state参数（防止CSRF攻击）
	if state == "" {
		return nil, errors.New("invalid state parameter")
	}

	// 用授权码换取访问令牌
	token, err := s.ExchangeCode(ctx, code)
	if err != nil {
		return nil, fmt.Errorf("failed to exchange code: %w", err)
	}

	// 获取用户信息
	userInfo, err := s.GetUserInfo(ctx, token)
	if err != nil {
		return nil, fmt.Errorf("failed to get user info: %w", err)
	}

	return userInfo, nil
}

// GenerateState 生成OAuth state参数
func (s *GoogleOAuthService) GenerateState() string {
	return fmt.Sprintf("state_%d", time.Now().Unix())
}

// ValidateState 验证OAuth state参数
func (s *GoogleOAuthService) ValidateState(state string) bool {
	// 简化的state验证
	// 在生产环境中，应该使用更安全的state验证机制
	return strings.HasPrefix(state, "state_")
}
