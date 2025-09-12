package oauth

import (
    "context"
    "crypto/rand"
    "encoding/base64"
    "encoding/json"
    "errors"
    "fmt"
    "io/ioutil"
    "net/http"
    "net/url"

    "gofly-admin-v3/utils/gf"
    "golang.org/x/oauth2"
    "golang.org/x/oauth2/google"
)

// Config OAuth配置
type Config struct {
	ClientID     string   `yaml:"client_id"`
	ClientSecret string   `yaml:"client_secret"`
	RedirectURL  string   `yaml:"redirect_url"`
	Scopes       []string `yaml:"scopes"`
}

// GoogleUserInfo Google用户信息
type GoogleUserInfo struct {
	ID            string `json:"id"`
	Email         string `json:"email"`
	VerifiedEmail bool   `json:"verified_email"`
	Name          string `json:"name"`
	Picture       string `json:"picture"`
}

// OAuthService OAuth服务
type OAuthService struct {
	config *Config
	oauth2 *oauth2.Config
}

// NewOAuthService 创建OAuth服务
func NewOAuthService(config *Config) *OAuthService {
	oauth2Config := &oauth2.Config{
		ClientID:     config.ClientID,
		ClientSecret: config.ClientSecret,
		RedirectURL:  config.RedirectURL,
		Scopes:       config.Scopes,
		Endpoint:     google.Endpoint,
	}

	return &OAuthService{
		config: config,
		oauth2: oauth2Config,
	}
}

// GetAuthURL 获取授权URL
func (s *OAuthService) GetAuthURL(state string) string {
	return s.oauth2.AuthCodeURL(state, oauth2.AccessTypeOffline)
}

// ExchangeCodeForToken 用授权码换取access token
func (s *OAuthService) ExchangeCodeForToken(code string) (*oauth2.Token, error) {
	return s.oauth2.Exchange(context.Background(), code)
}

// GetUserInfo 获取Google用户信息
func (s *OAuthService) GetUserInfo(token *oauth2.Token) (*GoogleUserInfo, error) {
	client := s.oauth2.Client(context.Background(), token)

	resp, err := client.Get("https://www.googleapis.com/oauth2/v2/userinfo")
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("failed to get user info: %s", resp.Status)
	}

	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var userInfo GoogleUserInfo
	if err := json.Unmarshal(body, &userInfo); err != nil {
		return nil, err
	}

	return &userInfo, nil
}

// VerifyIDToken 验证Google ID Token
func (s *OAuthService) VerifyIDToken(idToken string) (*GoogleUserInfo, error) {
	// 调用Google验证API
	resp, err := http.PostForm("https://oauth2.googleapis.com/tokeninfo", url.Values{
		"id_token": {idToken},
	})
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := ioutil.ReadAll(resp.Body)
		return nil, fmt.Errorf("token verification failed: %s", string(body))
	}

	// 解析响应
	var tokenInfo struct {
		Iss           string `json:"iss"`
		Azp           string `json:"azp"`
		Aud           string `json:"aud"`
		Sub           string `json:"sub"`
		Email         string `json:"email"`
		EmailVerified bool   `json:"email_verified"`
		Name          string `json:"name"`
		Picture       string `json:"picture"`
		GivenName     string `json:"given_name"`
		FamilyName    string `json:"family_name"`
		Locale        string `json:"locale"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&tokenInfo); err != nil {
		return nil, err
	}

	// 验证token
	if tokenInfo.Aud != s.config.ClientID {
		return nil, errors.New("invalid audience")
	}

	if tokenInfo.Iss != "accounts.google.com" && tokenInfo.Iss != "https://accounts.google.com" {
		return nil, errors.New("invalid issuer")
	}

	return &GoogleUserInfo{
		ID:            tokenInfo.Sub,
		Email:         tokenInfo.Email,
		VerifiedEmail: tokenInfo.EmailVerified,
		Name:          tokenInfo.Name,
		Picture:       tokenInfo.Picture,
	}, nil
}

// GenerateState 生成state参数（防止CSRF）
func (s *OAuthService) GenerateState() string {
	b := make([]byte, 32)
	rand.Read(b)
	return base64.URLEncoding.EncodeToString(b)
}

// ValidateState 验证state参数
func (s *OAuthService) ValidateState(state, sessionState string) bool {
	return state == sessionState
}

// HandleGoogleOAuth 处理Google OAuth登录
func (s *OAuthService) HandleGoogleOAuth(idToken string) (*GoogleUserInfo, string, error) {
    // Note: 用户创建/更新逻辑由业务层实现，这里仅验证并返回用户信息占位
    userInfo, err := s.VerifyIDToken(idToken)
    if err != nil {
        return nil, "", fmt.Errorf("failed to verify id token: %v", err)
    }
    // 返回占位token，实际签发由认证模块完成
    token, _ := generateJWTToken(userInfo.ID, "USER", userInfo.Email)
    return userInfo, token, nil
}

// 辅助函数
func generateJWTToken(userID, role, email string) (string, error) {
    // 简化占位：返回UUID作为占位token，真实JWT由 auth 模块统一生成
    return gf.UUID(), nil
}
