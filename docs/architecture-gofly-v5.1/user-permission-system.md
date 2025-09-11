# 用户权限体系设计

### 5.1 双用户体系

#### 5.1.1 前端用户（users 表）
```go
// internal/user/model.go
type User struct {
    ID             string    `json:"id" gorm:"primaryKey"`
    Email          string    `json:"email" gorm:"uniqueIndex;not null"`
    Username       string    `json:"username"`
    PasswordHash   string    `json:"-" gorm:"not null"` // 移除 UNIQUE 约束
    AvatarURL      string    `json:"avatar_url"`
    Role           string    `json:"role" gorm:"default:'USER'"`
    Status         string    `json:"status" gorm:"default:'ACTIVE'"`
    TokenBalance   int64     `json:"token_balance" gorm:"default:0"`
    PlanID         *string   `json:"plan_id"`
    TrialStartAt   *time.Time `json:"trial_start_at"`
    TrialEndAt     *time.Time `json:"trial_end_at"`
    TrialSource    string    `json:"trial_source"`
    EmailVerified  bool      `json:"email_verified" gorm:"default:false"`
    CreatedAt      time.Time `json:"created_at"`
    UpdatedAt      time.Time `json:"updated_at"`
    DeletedAt      *time.Time `json:"-" gorm:"index"`
}
```

#### 5.1.2 后台管理员（admin_accounts 表）
```go
// internal/admin/model.go
type AdminAccount struct {
    ID          string     `json:"id" gorm:"primaryKey"`
    Username    string     `json:"username" gorm:"uniqueIndex;not null"`
    PasswordHash string    `json:"-" gorm:"not null"`
    Email       string     `json:"email"`
    Role        string     `json:"role" gorm:"default:'ADMIN'"`
    Status      string     `json:"status" gorm:"default:'ACTIVE'"`
    LastLoginAt *time.Time `json:"last_login_at"`
    CreatedAt   time.Time  `json:"created_at"`
    UpdatedAt   time.Time  `json:"updated_at"`
    DeletedAt   *time.Time `json:"-" gorm:"index"`
}
```

### 5.2 认证中间件设计

#### 5.2.1 用户认证中间件
```go
// internal/auth/middleware.go
func UserAuth() gin.HandlerFunc {
    return func(c *gin.Context) {
        token := c.GetHeader("Authorization")
        if token == "" {
            c.JSON(http.StatusUnauthorized, gin.H{
                "code":    1001,
                "message": "未提供认证令牌",
            })
            c.Abort()
            return
        }
        
        // 去掉 Bearer 前缀
        token = strings.TrimPrefix(token, "Bearer ")
        
        // 验证 token
        claims, err := jwt.ParseToken(token)
        if err != nil {
            c.JSON(http.StatusUnauthorized, gin.H{
                "code":    1001,
                "message": "令牌无效或已过期",
            })
            c.Abort()
            return
        }
        
        // 检查用户状态
        user, err := userService.GetUserByID(claims.UserID)
        if err != nil || user.Status != "ACTIVE" {
            c.JSON(http.StatusForbidden, gin.H{
                "code":    1003,
                "message": "用户已被禁用",
            })
            c.Abort()
            return
        }
        
        // 设置用户信息到上下文
        c.Set("user_id", claims.UserID)
        c.Set("user_role", claims.Role)
        c.Next()
    }
}
```

#### 5.2.2 管理员认证中间件
```go
// internal/admin/middleware.go
func AdminAuth() gin.HandlerFunc {
    return func(c *gin.Context) {
        username, password, hasAuth := c.Request.BasicAuth()
        if !hasAuth {
            c.Header("WWW-Authenticate", `Basic realm="Admin Area"`)
            c.JSON(http.StatusUnauthorized, gin.H{
                "code":    1001,
                "message": "需要管理员认证",
            })
            c.Abort()
            return
        }
        
        // 验证管理员账号
        admin, err := adminService.Authenticate(username, password)
        if err != nil || admin.Status != "ACTIVE" {
            c.JSON(http.StatusUnauthorized, gin.H{
                "code":    1001,
                "message": "认证失败",
            })
            c.Abort()
            return
        }
        
        // 记录登录日志
        go adminService.LogLogin(admin.ID, c.ClientIP(), c.Request.UserAgent(), true)
        
        // 设置管理员信息到上下文
        c.Set("admin_id", admin.ID)
        c.Set("admin_role", admin.Role)
        c.Next()
    }
}
```