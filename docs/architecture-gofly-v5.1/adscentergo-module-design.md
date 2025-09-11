# AdsCenterGo 模块设计

### 9.1 Google OAuth 集成

```go
// internal/adscentergo/oauth.go
type OAuthManager struct {
    config     OAuthConfig
    crypto     *CryptoService
    httpClient *http.Client
}

func (om *OAuthManager) HandleCallback(code, state, userID string) (*OAuthCredentials, error) {
    // 验证 state 参数
    if !om.validateState(state, userID) {
        return nil, ErrInvalidState
    }
    
    // 获取 access token
    token, err := om.exchangeCodeForToken(code)
    if err != nil {
        return nil, err
    }
    
    // 加密存储
    encryptedToken, err := om.crypto.Encrypt(token.AccessToken)
    if err != nil {
        return nil, err
    }
    
    credentials := &OAuthCredentials{
        ID:           uuid.New().String(),
        AccessToken:  encryptedToken,
        RefreshToken: token.RefreshToken,
        TokenType:    token.TokenType,
        ExpiresAt:    time.Now().Add(time.Duration(token.ExpiresIn) * time.Second),
    }
    
    return credentials, nil
}
```

### 9.2 链接替换引擎

```go
// internal/adscentergo/link_replace.go
type LinkReplaceEngine struct {
    rules      []ReplaceRule
    httpClient *http.Client
}

func (e *LinkReplaceEngine) ExtractLinks(accountID string) ([]LinkInfo, error) {
    // 获取广告活动列表
    campaigns, err := e.getGoogleAdsCampaigns(accountID)
    if err != nil {
        return nil, err
    }
    
    var links []LinkInfo
    for _, campaign := range campaigns {
        // 获取广告组
        adGroups, err := e.getAdGroups(accountID, campaign.ID)
        if err != nil {
            continue
        }
        
        for _, adGroup := range adGroups {
            // 提取链接
            groupLinks := e.extractFromAdGroup(adGroup)
            links = append(links, groupLinks...)
        }
    }
    
    return links, nil
}
```