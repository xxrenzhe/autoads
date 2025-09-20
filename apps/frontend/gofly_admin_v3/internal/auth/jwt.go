package auth

import (
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// JWTConfig JWT配置
type JWTConfig struct {
	SecretKey    string
	ExpireHours  int
	RefreshHours int
	Issuer       string
}

// DefaultJWTConfig 默认JWT配置
func DefaultJWTConfig() *JWTConfig {
	return &JWTConfig{
		SecretKey:    "autoads-saas-secret-key-2025",
		ExpireHours:  24,
		RefreshHours: 168,
		Issuer:       "autoads-saas",
	}
}

// Claims JWT声明
type Claims struct {
	UserID   string `json:"user_id"`
	Email    string `json:"email"`
	Role     string `json:"role"`
	PlanName string `json:"plan_name"`
	jwt.RegisteredClaims
}

// JWTService JWT服务
type JWTService struct {
	config *JWTConfig
}

// NewJWTService 创建JWT服务
func NewJWTService(config *JWTConfig) *JWTService {
	if config == nil {
		config = DefaultJWTConfig()
	}
	return &JWTService{config: config}
}

// GenerateToken 生成JWT令牌
func (s *JWTService) GenerateToken(userID, email, role, planName string) (string, error) {
	now := time.Now()
	claims := &Claims{
		UserID:   userID,
		Email:    email,
		Role:     role,
		PlanName: planName,
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    s.config.Issuer,
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(time.Duration(s.config.ExpireHours) * time.Hour)),
			NotBefore: jwt.NewNumericDate(now),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(s.config.SecretKey))
}

// ValidateToken 验证JWT令牌
func (s *JWTService) ValidateToken(tokenString string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(s.config.SecretKey), nil
	})

	if err != nil {
		return nil, err
	}

	if claims, ok := token.Claims.(*Claims); ok && token.Valid {
		return claims, nil
	}

	return nil, errors.New("invalid token")
}

// TokenResponse 令牌响应
type TokenResponse struct {
	AccessToken string    `json:"access_token"`
	TokenType   string    `json:"token_type"`
	ExpiresIn   int       `json:"expires_in"`
	ExpiresAt   time.Time `json:"expires_at"`
}

// GenerateTokenResponse 生成令牌响应
func (s *JWTService) GenerateTokenResponse(userID, email, role, planName string) (*TokenResponse, error) {
	accessToken, err := s.GenerateToken(userID, email, role, planName)
	if err != nil {
		return nil, err
	}

	expiresAt := time.Now().Add(time.Duration(s.config.ExpireHours) * time.Hour)

	return &TokenResponse{
		AccessToken: accessToken,
		TokenType:   "Bearer",
		ExpiresIn:   s.config.ExpireHours * 3600,
		ExpiresAt:   expiresAt,
	}, nil
}
