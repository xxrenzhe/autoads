## 6. 安全设计方案

### 6.1 认证授权体系

#### 6.1.1 JWT认证机制

```go
// JWT配置
type JWTConfig struct {
    SecretKey      string        `yaml:"secret_key"`
    Issuer         string        `yaml:"issuer"`
    ExpireTime     time.Duration `yaml:"expire_time"`
    RefreshExpire  time.Duration `yaml:"refresh_expire"`
}

// JWT Claims结构
type Claims struct {
    UserID   uint64 `json:"user_id"`
    Username string `json:"username"`
    Role     string `json:"role"`
    jti      string `json:"jti"` // JWT ID，用于吊销
    iat      int64  `json:"iat"` // 签发时间
    exp      int64  `json:"exp"` // 过期时间
}
```

#### 6.1.2 Token刷新机制

```go
// Refresh Token流程
1. 用户使用Refresh Token请求 /api/v1/auth/refresh
2. 验证Refresh Token有效性（检查黑名单）
3. 生成新的Access Token
4. 可选：生成新的Refresh Token（轮换策略）
5. 将旧Refresh Token加入黑名单（短时间过期）
```

#### 6.1.3 Token吊销机制

```go
// Redis存储黑名单
// Key格式：token_blacklist:{jti}
// Value：过期时间
// TTL：Token剩余有效期

func RevokeToken(jti string, expireTime time.Duration) error {
    key := fmt.Sprintf("token_blacklist:%s", jti)
    return redis.SetEX(key, "1", expireTime)
}

func IsTokenRevoked(jti string) (bool, error) {
    key := fmt.Sprintf("token_blacklist:%s", jti)
    exists, _ := redis.Exists(key)
    return exists == 1, nil
}
```

### 6.2 数据安全

#### 6.2.1 密码加密

```go
// 使用Argon2id（推荐）或bcrypt
func HashPassword(password string) (string, error) {
    salt := make([]byte, 16)
    if _, err := rand.Read(salt); err != nil {
        return "", err
    }
    
    hash := argon2.IDKey([]byte(password), salt, 3, 64*1024, 4, 32)
    return base64.RawStdEncoding.EncodeToString(append(salt, hash...)), nil
}

func VerifyPassword(password, encodedHash string) (bool, error) {
    decoded, err := base64.RawStdEncoding.DecodeString(encodedHash)
    if err != nil {
        return false, err
    }
    
    salt := decoded[:16]
    hash := decoded[16:]
    
    newHash := argon2.IDKey([]byte(password), salt, 3, 64*1024, 4, 32)
    return subtle.ConstantTimeCompare(hash, newHash) == 1, nil
}
```

#### 6.2.2 敏感数据加密

```go
// 使用AES-GCM加密API密钥等敏感数据
type CryptoManager struct {
    key []byte
}

func NewCryptoManager(secret string) *CryptoManager {
    hash := sha256.Sum256([]byte(secret))
    return &CryptoManager{key: hash[:]}
}

func (cm *CryptoManager) Encrypt(plaintext string) (string, error) {
    block, err := aes.NewCipher(cm.key)
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

func (cm *CryptoManager) Decrypt(ciphertext string) (string, error) {
    data, err := base64.StdEncoding.DecodeString(ciphertext)
    if err != nil {
        return "", err
    }
    
    block, err := aes.NewCipher(cm.key)
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

### 6.3 WebSocket安全

#### 6.3.1 WebSocket认证

```go
// WebSocket连接认证
func WebSocketAuth() gf.HandlerFunc {
    return func(r *ghttp.Request) {
        token := r.Get("token", "")
        if token == "" {
            r.Exit()
            return
        }
        
        // 验证JWT Token
        claims, err := ValidateJWT(token)
        if err != nil {
            r.Exit()
            return
        }
        
        // 将用户信息存入Context
        r.SetCtxVar("user_id", claims.UserID)
        r.SetCtxVar("role", claims.Role)
        
        r.Middleware.Next()
    }
}

// WebSocket连接管理
type WSManager struct {
    connections map[uint64]*websocket.Conn
    mutex       sync.RWMutex
}

func (wm *WSManager) AddConnection(userID uint64, conn *websocket.Conn) {
    wm.mutex.Lock()
    defer wm.mutex.Unlock()
    wm.connections[userID] = conn
}

func (wm *WSManager) RemoveConnection(userID uint64) {
    wm.mutex.Lock()
    defer wm.mutex.Unlock()
    delete(wm.connections, userID)
}
```

### 6.4 权限控制

#### 6.4.1 RBAC权限模型

```go
// 权限定义
type Permission struct {
    Module   string   `json:"module"`   // 模块
    Resource string   `json:"resource"` // 资源
    Actions  []string `json:"actions"`  // 操作
}

// 角色权限映射
var RolePermissions = map[string][]Permission{
    "USER": {
        {Module: "batchgo", Resource: "task", Actions: []string{"create", "read", "update"}},
        {Module: "siterankgo", Resource: "query", Actions: []string{"create", "read"}},
    },
    "ADMIN": {
        {Module: "*", Resource: "*", Actions: []string{"*"}},
    },
}

// 权限检查中间件
func PermissionCheck(permission Permission) gf.HandlerFunc {
    return func(r *ghttp.Request) {
        role := r.GetCtxVar("role", "").String()
        if role == "" {
            r.Response.WriteJsonExit(g.Map{
                "code":    403,
                "message": "无权限访问",
            })
            return
        }
        
        // 检查权限
        if !hasPermission(role, permission) {
            r.Response.WriteJsonExit(g.Map{
                "code":    403,
                "message": "权限不足",
            })
            return
        }
        
        r.Middleware.Next()
    }
}
```

### 6.5 安全中间件

#### 6.5.1 CSRF保护

```go
// CSRF Token生成和验证
func CSRFMiddleware() gf.HandlerFunc {
    return func(r *ghttp.Request) {
        if r.Method == "GET" || r.Method == "HEAD" || r.Method == "OPTIONS" {
            r.Middleware.Next()
            return
        }
        
        token := r.GetHeader("X-CSRF-Token")
        if token == "" {
            token = r.Get("csrf_token", "")
        }
        
        sessionToken := r.Session.Get("csrf_token")
        if token == "" || token != sessionToken {
            r.Response.WriteJsonExit(g.Map{
                "code":    403,
                "message": "CSRF token验证失败",
            })
            return
        }
        
        r.Middleware.Next()
    }
}
```

#### 6.5.2 安全响应头

```go
func SecurityHeaders() gf.HandlerFunc {
    return func(r *ghttp.Request) {
        // 安全响应头
        r.Response.Header.Set("X-Content-Type-Options", "nosniff")
        r.Response.Header.Set("X-Frame-Options", "DENY")
        r.Response.Header.Set("X-XSS-Protection", "1; mode=block")
        r.Response.Header.Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
        r.Response.Header.Set("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';")
        
        r.Middleware.Next()
    }
}
```

### 6.6 API密钥管理

#### 6.6.1 密钥轮换策略

```go
// API密钥轮换
type APIKeyManager struct {
    redis    *gredis.Redis
    crypto   *CryptoManager
    config   *Config
}

// 自动轮换（每90天）
func (akm *APIKeyManager) AutoRotateKeys() {
    ticker := time.NewTicker(24 * time.Hour)
    defer ticker.Stop()
    
    for range ticker.C {
        services := []string{"similarweb", "google_ads", "adspower"}
        for _, service := range services {
            if akm.shouldRotateKey(service) {
                akm.rotateKey(service)
            }
        }
    }
}

func (akm *APIKeyManager) shouldRotateKey(service string) bool {
    lastRotation, _ := akm.redis.Get(fmt.Sprintf("key_rotation:%s", service))
    if lastRotation == "" {
        return true
    }
    
    rotationTime, _ := time.Parse(time.RFC3339, lastRotation.String())
    return time.Since(rotationTime) > 90*24*time.Hour
}
```

### 6.7 审计日志

#### 6.7.1 操作日志记录

```go
// 审计日志结构
type AuditLog struct {
    ID        uint64 `json:"id"`
    UserID    uint64 `json:"user_id"`
    Role      string `json:"role"`
    Action    string `json:"action"`
    Resource  string `json:"resource"`
    ResourceID uint64 `json:"resource_id,omitempty"`
    IP        string `json:"ip"`
    UserAgent string `json:"user_agent"`
    Status    string `json:"status"`
    Details   string `json:"details,omitempty"`
    CreatedAt time.Time `json:"created_at"`
}

// 审计中间件
func AuditLogMiddleware(action, resource string) gf.HandlerFunc {
    return func(r *ghttp.Request) {
        start := time.Now()
        
        // 执行请求
        r.Middleware.Next()
        
        // 记录审计日志
        log := AuditLog{
            UserID:    r.GetCtxVar("user_id", 0).Uint64(),
            Role:      r.GetCtxVar("role", "").String(),
            Action:    action,
            Resource:  resource,
            IP:        r.GetClientIp(),
            UserAgent: r.UserAgent(),
            Status:    "SUCCESS",
            CreatedAt: time.Now(),
        }
        
        if r.Response.Status != 200 {
            log.Status = "FAILED"
            log.Details = fmt.Sprintf("HTTP %d", r.Response.Status)
        }
        
        // 异步写入数据库
        go SaveAuditLog(log)
    }
}
```

### 6.8 数据脱敏

```go
// 数据脱敏函数
func MaskSensitiveData(data interface{}) interface{} {
    switch v := data.(type) {
    case string:
        return maskString(v)
    case map[string]interface{}:
        return maskMap(v)
    case []interface{}:
        return maskSlice(v)
    default:
        return data
    }
}

func maskString(s string) string {
    if strings.Contains(s, "@") {
        // 邮箱脱敏
        parts := strings.Split(s, "@")
        if len(parts) == 2 {
            return parts[0][:2] + "***@" + parts[1]
        }
    }
    
    if len(s) == 11 && strings.HasPrefix(s, "1") {
        // 手机号脱敏
        return s[:3] + "****" + s[7:]
    }
    
    // 通用脱敏
    if len(s) > 6 {
        return s[:3] + strings.Repeat("*", len(s)-6) + s[len(s)-3:]
    }
    
    return s
}
```