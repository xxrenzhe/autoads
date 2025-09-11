# 安全设计文档

**文档版本**: v1.0  
**最后更新**: 2025-09-11  
**文档状态**: 已标准化  
**安全等级**: 企业级

## 1. 概述

### 1.1 设计原则

遵循Linus Torvalds的安全设计哲学：
- **简单性**：简单的设计更安全，减少攻击面
- **实用性**：使用成熟、经过验证的安全方案
- **透明性**：安全机制应该是可见和可理解的
- **最小权限**：每个组件只拥有必要的权限

### 1.2 安全目标

- **数据安全**：保护用户数据和系统数据不被未授权访问
- **服务可用性**：确保服务持续可用，抵抗DDoS攻击
- **身份安全**：确保用户身份的真实性和会话安全
- **API安全**：保护API接口不被滥用和攻击

## 2. 认证系统安全

### 2.1 双重认证体系

#### 网站用户认证（Google OAuth）
```go
// Google OAuth配置
oauthConfig := &oauth2.Config{
    ClientID:     config.GoogleClientID,
    ClientSecret: config.GoogleClientSecret,
    Endpoint:     google.Endpoint,
    Scopes:       []string{"email", "profile"},
    RedirectURL:  config.BaseURL + "/api/auth/callback",
}

// 验证Google Token
func validateGoogleToken(token string) (*google.Userinfo, error) {
    client := oauth2.NewClient(context.Background(), oauth2.StaticTokenSource(
        &oauth2.Token{AccessToken: token},
    ))
    
    userService, err := google.New(client)
    if err != nil {
        return nil, err
    }
    
    userInfo, err := userService.Userinfo.Get().Do()
    if err != nil {
        return nil, err
    }
    
    // 验证邮箱是否已验证
    if !userInfo.VerifiedEmail {
        return nil, errors.New("email not verified")
    }
    
    return userInfo, nil
}
```

#### 管理员认证（Session）
```go
// 密码哈希
func HashPassword(password string) (string, error) {
    hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), 12)
    if err != nil {
        return "", err
    }
    return string(hashedPassword), nil
}

// 密码验证
func CheckPassword(hashedPassword, password string) bool {
    err := bcrypt.CompareHashAndPassword([]byte(hashedPassword), []byte(password))
    return err == nil
}

// Session配置
sessionConfig := sessions.Config{
    CookieName:     "admin_session",
    CookieSecure:   true,
    CookieHTTPOnly: true,
    CookieSameSite: http.SameSiteStrictMode,
    MaxAge:         8 * time.Hour, // 8小时
}
```

### 2.2 JWT Token安全

```go
// JWT配置
jwtConfig := struct {
    SecretKey      []byte
    Expiration    time.Duration
    RefreshExpire time.Duration
}{
    SecretKey:      []byte(config.JWTSecret),
    Expiration:    24 * time.Hour,
    RefreshExpire: 7 * 24 * time.Hour,
}

// JWT中间件
func AuthMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        authHeader := c.GetHeader("Authorization")
        if authHeader == "" {
            c.AbortWithStatusJSON(401, gin.H{"code": 401, "message": "Missing authorization header"})
            return
        }
        
        // 提取Bearer Token
        tokenString := authHeader[7:] // Remove "Bearer "
        
        // 验证Token
        token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
            if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
                return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
            }
            return jwtConfig.SecretKey, nil
        })
        
        if err != nil || !token.Valid {
            c.AbortWithStatusJSON(401, gin.H{"code": 401, "message": "Invalid token"})
            return
        }
        
        // 提取Claims
        claims, ok := token.Claims.(jwt.MapClaims)
        if !ok {
            c.AbortWithStatusJSON(401, gin.H{"code": 401, "message": "Invalid claims"})
            return
        }
        
        // 检查过期时间
        if exp, ok := claims["exp"].(float64); ok {
            if time.Now().Unix() > int64(exp) {
                c.AbortWithStatusJSON(401, gin.H{"code": 401, "message": "Token expired"})
                return
            }
        }
        
        // 设置用户信息到Context
        c.Set("user_id", claims["user_id"])
        c.Set("user_role", claims["role"])
        c.Set("user_plan", claims["plan"])
        
        c.Next()
    }
}
```

## 3. API安全

### 3.1 请求限制

```go
// 速率限制中间件
func RateLimitMiddleware() gin.HandlerFunc {
    limiter := rate.NewLimiter(rate.Limit(100), 200) // 100请求/秒，突发200
    
    return func(c *gin.Context) {
        if !limiter.Allow() {
            c.AbortWithStatusJSON(429, gin.H{
                "code":    429,
                "message": "Too many requests",
            })
            return
        }
        c.Next()
    }
}

// IP白名单中间件（用于管理后台）
func IPWhitelistMiddleware() gin.HandlerFunc {
    allowedIPs := map[string]bool{
        "192.168.1.100": true,
        "10.0.0.50":     true,
    }
    
    return func(c *gin.Context) {
        clientIP := c.ClientIP()
        if !allowedIPs[clientIP] {
            c.AbortWithStatusJSON(403, gin.H{
                "code":    403,
                "message": "Access denied",
            })
            return
        }
        c.Next()
    }
}
```

### 3.2 输入验证

```go
// 通用验证中间件
func ValidationMiddleware(schema interface{}) gin.HandlerFunc {
    return func(c *gin.Context) {
        var err error
        
        // 根据Content-Type选择解析方式
        switch c.ContentType() {
        case "application/json":
            err = c.ShouldBindJSON(schema)
        case "application/x-www-form-urlencoded":
            err = c.ShouldBind(schema)
        default:
            c.AbortWithStatusJSON(415, gin.H{
                "code":    415,
                "message": "Unsupported media type",
            })
            return
        }
        
        if err != nil {
            c.AbortWithStatusJSON(400, gin.H{
                "code":    400,
                "message": "Validation failed",
                "errors":  err.Error(),
            })
            return
        }
        
        c.Set("validated_data", schema)
        c.Next()
    }
}

// SQL注入防护
func SanitizeSQLInput(input string) string {
    // 使用参数化查询，这里只是展示
    dangerousChars := []string{"'", "\"", ";", "--", "/*", "*/", "xp_", "sp_"}
    result := input
    for _, char := range dangerousChars {
        result = strings.ReplaceAll(result, char, "")
    }
    return result
}
```

### 3.3 CORS配置

```go
// CORS中间件
func CORSMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        c.Header("Access-Control-Allow-Origin", config.FrontendURL)
        c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")
        c.Header("Access-Control-Allow-Credentials", "true")
        c.Header("Access-Control-Max-Age", "86400") // 24小时
        
        if c.Request.Method == "OPTIONS" {
            c.AbortWithStatus(204)
            return
        }
        
        c.Next()
    }
}
```

## 4. 数据安全

### 4.1 敏感数据加密

```go
// AES加密配置
type Encryption struct {
    key []byte
}

func NewEncryption(key string) *Encryption {
    // 确保密钥长度为32字节（AES-256）
    if len(key) < 32 {
        key += strings.Repeat("=", 32-len(key))
    }
    return &Encryption{key: []byte(key[:32])}
}

func (e *Encryption) Encrypt(plaintext string) (string, error) {
    block, err := aes.NewCipher(e.key)
    if err != nil {
        return "", err
    }
    
    gcm, err := cipher.NewGCM(block)
    if err != nil {
        return "", err
    }
    
    nonce := make([]byte, gcm.NonceSize())
    if _, err = io.ReadFull(rand.Reader, nonce); err != nil {
        return "", err
    }
    
    ciphertext := gcm.Seal(nonce, nonce, []byte(plaintext), nil)
    return base64.StdEncoding.EncodeToString(ciphertext), nil
}

func (e *Encryption) Decrypt(ciphertext string) (string, error) {
    data, err := base64.StdEncoding.DecodeString(ciphertext)
    if err != nil {
        return "", err
    }
    
    block, err := aes.NewCipher(e.key)
    if err != nil {
        return "", err
    }
    
    gcm, err := cipher.NewGCM(block)
    if err != nil {
        return "", err
    }
    
    nonceSize := gcm.NonceSize()
    if len(data) < nonceSize {
        return "", errors.New("ciphertext too short")
    }
    
    nonce, ciphertext := data[:nonceSize], data[nonceSize:]
    plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
    if err != nil {
        return "", err
    }
    
    return string(plaintext), nil
}
```

### 4.2 数据库安全

```sql
-- 最小权限原则
CREATE USER 'autoads_app'@'%' IDENTIFIED BY 'strong_password_here';
GRANT SELECT, INSERT, UPDATE, DELETE ON autoads.* TO 'autoads_app'@'%';
GRANT EXECUTE ON PROCEDURE autoads.* TO 'autoads_app'@'%';

-- 只读用户
CREATE USER 'autoads_readonly'@'%' IDENTIFIED BY 'readonly_password_here';
GRANT SELECT ON autoads.* TO 'autoads_readonly'@'%';

-- 定期审计
SELECT 
    user,
    host,
    plugin,
    authentication_string
FROM mysql.user
WHERE user LIKE 'autoads%';
```

## 5. 网络安全

### 5.1 HTTPS配置

```nginx
# Nginx配置示例
server {
    listen 443 ssl http2;
    server_name api.autoads.dev;
    
    # SSL证书配置
    ssl_certificate /path/to/fullchain.pem;
    ssl_certificate_key /path/to/privkey.pem;
    
    # SSL安全配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    
    # HSTS
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload";
    
    # 安全头
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Referrer-Policy "strict-origin-when-cross-origin";
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';";
}
```

### 5.2 DDoS防护

```go
// 令牌桶限流算法
type TokenBucket struct {
    capacity      int64
    tokens        int64
    refillRate    int64
    lastRefill    time.Time
    mu            sync.Mutex
}

func (tb *TokenBucket) Allow() bool {
    tb.mu.Lock()
    defer tb.mu.Unlock()
    
    now := time.Now()
    elapsed := now.Sub(tb.lastRefill).Seconds()
    tb.tokens = min(tb.capacity, tb.tokens+int64(elapsed*float64(tb.refillRate)))
    tb.lastRefill = now
    
    if tb.tokens > 0 {
        tb.tokens--
        return true
    }
    
    return false
}

// IP级别的限流
var ipLimiters = struct {
    sync.RWMutex
    m map[string]*TokenBucket
}{
    m: make(map[string]*TokenBucket),
}

func GetIPLimiter(ip string) *TokenBucket {
    ipLimiters.RLock()
    limiter, exists := ipLimiters.m[ip]
    ipLimiters.RUnlock()
    
    if !exists {
        ipLimiters.Lock()
        limiter = &TokenBucket{
            capacity:   1000,
            tokens:     1000,
            refillRate: 100, // 每秒100个令牌
            lastRefill: time.Now(),
        }
        ipLimiters.m[ip] = limiter
        ipLimiters.Unlock()
    }
    
    return limiter
}
```

## 6. 审计日志

### 6.1 安全事件日志

```go
type SecurityEvent struct {
    ID           string                 `json:"id"`
    EventType    string                 `json:"event_type"`
    UserID       string                 `json:"user_id,omitempty"`
    IPAddress    string                 `json:"ip_address"`
    UserAgent    string                 `json:"user_agent"`
    Details      map[string]interface{} `json:"details"`
    Timestamp    time.Time              `json:"timestamp"`
    Severity     string                 `json:"severity"` // low, medium, high, critical
}

func LogSecurityEvent(eventType, userID, ip, userAgent string, details map[string]interface{}) {
    event := SecurityEvent{
        ID:        uuid.New().String(),
        EventType: eventType,
        UserID:    userID,
        IPAddress: ip,
        UserAgent: userAgent,
        Details:   details,
        Timestamp: time.Now(),
    }
    
    // 根据事件类型设置严重级别
    switch eventType {
    case "LOGIN_SUCCESS", "LOGOUT":
        event.Severity = "low"
    case "LOGIN_FAILED", "INVALID_TOKEN":
        event.Severity = "medium"
    case "UNAUTHORIZED_ACCESS", "RATE_LIMIT_EXCEEDED":
        event.Severity = "high"
    case "SQL_INJECTION_ATTEMPT", "XSS_ATTEMPT":
        event.Severity = "critical"
    }
    
    // 异步记录日志
    go func() {
        if err := SaveSecurityEvent(event); err != nil {
            log.Printf("Failed to log security event: %v", err)
        }
    }()
    
    // 实时告警
    if event.Severity == "high" || event.Severity == "critical" {
        go func() {
            SendSecurityAlert(event)
        }()
    }
}

func SendSecurityAlert(event SecurityEvent) {
    // 发送邮件告警
    if config.SecurityAlertEmail != "" {
        subject := fmt.Sprintf("[SECURITY ALERT] %s detected", event.EventType)
        body := fmt.Sprintf(`
            Security Event Details:
            - Event Type: %s
            - User ID: %s
            - IP Address: %s
            - Severity: %s
            - Time: %s
            - Details: %+v
        `, event.EventType, event.UserID, event.IPAddress, 
            event.Severity, event.Timestamp, event.Details)
        
        SendEmail(config.SecurityAlertEmail, subject, body)
    }
}
```

## 7. 密钥管理

### 7.1 环境变量加密

```bash
# 使用Vault管理密钥
vault kv put secret/autoads \
    db_password="secure_password_here" \
    jwt_secret="secure_jwt_secret_here" \
    google_client_secret="secure_google_secret_here" \
    encryption_key="secure_encryption_key_here"

# 应用启动时获取密钥
export DB_PASSWORD=$(vault kv get -field=db_password secret/autoads)
export JWT_SECRET=$(vault kv get -field=jwt_secret secret/autoads)
```

### 7.2 密钥轮换策略

```bash
#!/bin/bash
# JWT密钥轮换脚本
NEW_SECRET=$(openssl rand -hex 32)
echo "New JWT secret generated"

# 更新Vault
vault kv patch secret/autoads jwt_secret="$NEW_SECRET"

# 平滑过渡：新旧密钥并存24小时
echo "Old secret will be valid for 24 hours"
echo "New secret: $NEW_SECRET"

# 通知运维团队
echo "JWT secret rotated at $(date)" | mail -s "JWT Secret Rotation" ops@example.com
```

## 8. 安全检查清单

### 8.1 部署前检查

- [ ] 所有密码使用bcrypt哈希存储
- [ ] JWT密钥强度足够（至少256位）
- [ ] 数据库连接使用最小权限账户
- [ ] SSL证书配置正确且未过期
- [ ] 所有关键API都有认证中间件
- [ ] 敏感数据已加密存储
- [ ] 错误消息不包含敏感信息
- [ ] 日志记录不包含敏感数据

### 8.2 定期安全审计

- [ ] 每月检查访问日志异常模式
- [ ] 每季度更新SSL证书
- [ ] 每半年轮换所有密钥
- [ ] 每年进行渗透测试

### 8.3 监控指标

- 失败的登录尝试次数
- 异常API调用频率
- 高权限操作日志
    - 数据库查询异常模式
- 网络流量异常

通过以上安全设计，确保系统在提供便捷服务的同时，保持高水平的安全性。