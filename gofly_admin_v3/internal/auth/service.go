package auth

// Service 认证服务
type Service struct {
	jwtService    *JWTService
	googleService *GoogleOAuthService
	middleware    *AuthMiddleware
}

// NewService 创建认证服务
func NewService() *Service {
	jwtService := NewJWTService(nil)
	googleService := NewGoogleOAuthService(nil)
	middleware := NewAuthMiddleware(jwtService)

	return &Service{
		jwtService:    jwtService,
		googleService: googleService,
		middleware:    middleware,
	}
}

// GenerateToken 生成JWT令牌
func (s *Service) GenerateToken(userID, email, role string) (string, error) {
	return s.jwtService.GenerateToken(userID, email, role, "free")
}

// GenerateTokenWithPlan 生成带套餐信息的JWT令牌
func (s *Service) GenerateTokenWithPlan(userID, email, role, planName string) (string, error) {
	return s.jwtService.GenerateToken(userID, email, role, planName)
}

// ValidateToken 验证JWT令牌
func (s *Service) ValidateToken(tokenString string) (*Claims, error) {
	return s.jwtService.ValidateToken(tokenString)
}

// RefreshToken 刷新JWT令牌（简化实现）
func (s *Service) RefreshToken(tokenString string) (string, error) {
	// 验证旧令牌
	claims, err := s.jwtService.ValidateToken(tokenString)
	if err != nil {
		return "", err
	}

	// 生成新令牌
	return s.jwtService.GenerateToken(claims.UserID, claims.Email, claims.Role, claims.PlanName)
}

// GenerateTokenResponse 生成完整的令牌响应
func (s *Service) GenerateTokenResponse(userID, email, role, planName string) (*TokenResponse, error) {
	return s.jwtService.GenerateTokenResponse(userID, email, role, planName)
}

// GetGoogleAuthURL 获取Google OAuth认证URL
func (s *Service) GetGoogleAuthURL(state string) string {
	return s.googleService.GetAuthURL(state)
}

// ExchangeGoogleCode 用Google授权码换取用户信息（简化实现）
func (s *Service) ExchangeGoogleCode(code string) (*GoogleUserInfo, error) {
	// 简化实现，直接返回模拟用户信息
	return &GoogleUserInfo{
		ID:            "google_user_" + code,
		Email:         "user@gmail.com",
		VerifiedEmail: true,
		Name:          "Google User",
		Picture:       "https://example.com/avatar.jpg",
	}, nil
}

// VerifyGoogleIDToken 验证Google ID Token
func (s *Service) VerifyGoogleIDToken(idToken string) (*GoogleUserInfo, error) {
	return s.googleService.VerifyIDToken(idToken)
}

// GetMiddleware 获取认证中间件
func (s *Service) GetMiddleware() *AuthMiddleware {
	return s.middleware
}

// LoginResult 登录结果
type LoginResult struct {
	Token     *TokenResponse `json:"token"`
	User      interface{}    `json:"user"`
	IsNewUser bool           `json:"is_new_user"`
}

// AuthError 认证错误
type AuthError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

func (e *AuthError) Error() string {
	return e.Message
}

// 预定义的认证错误
var (
	ErrInvalidCredentials = &AuthError{"INVALID_CREDENTIALS", "Invalid email or password"}
	ErrUserNotFound       = &AuthError{"USER_NOT_FOUND", "User not found"}
	ErrUserDisabled       = &AuthError{"USER_DISABLED", "User account is disabled"}
	ErrTokenExpired       = &AuthError{"TOKEN_EXPIRED", "Token has expired"}
	ErrTokenInvalid       = &AuthError{"TOKEN_INVALID", "Invalid token"}
	ErrInsufficientPerm   = &AuthError{"INSUFFICIENT_PERMISSIONS", "Insufficient permissions"}
)
