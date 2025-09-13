package admin

import (
    "fmt"
    "strings"
    "time"

    "github.com/gin-gonic/gin"
    jwt "github.com/golang-jwt/jwt/v5"
    "golang.org/x/crypto/bcrypt"
    "gofly-admin-v3/internal/cache"
    "gofly-admin-v3/utils/gf"
    "gofly-admin-v3/utils/tools/gcfg"
    "gofly-admin-v3/utils/tools/gctx"
)

// AdminLoginRequest 管理员登录请求
type AdminLoginRequest struct {
    UsernameOrEmail string `json:"username" form:"username"`
    Password        string `json:"password" form:"password"`
}

func init() {
    // 管理员登录
    gf.RegisterRoute("POST", "/admin/login", AdminLoginHandler, true, nil)
    // 管理员资料
    gf.RegisterRoute("GET", "/admin/profile", AdminProfileHandler, false, nil)
}

// AdminLoginHandler 管理员登录
func AdminLoginHandler(c *gin.Context) {
    var req AdminLoginRequest
    if err := c.ShouldBind(&req); err != nil || req.UsernameOrEmail == "" || req.Password == "" {
        gf.Failed().SetMsg("参数错误").Regin(c)
        return
    }
    emailOrUser := strings.ToLower(strings.TrimSpace(req.UsernameOrEmail))

    // 防爆破：失败计数 & 锁定
    cacheCli := cache.GetCache()
    lockKey := "auth:admin_lock:" + emailOrUser
    if ok, _ := cacheCli.Exists(lockKey); ok {
        gf.Failed().SetMsg("账户暂时锁定，请稍后再试").Regin(c)
        return
    }

    // 查询 admin_users（username/email 任一匹配）
    record, err := gf.DB().Raw("SELECT id, username, email, password, role, is_active FROM admin_users WHERE (LOWER(username)=? OR LOWER(email)=?) AND is_active=1 LIMIT 1", emailOrUser, emailOrUser).One()
    if err != nil || record == nil {
        _ = logAdminLoginEvent(false, "", c.ClientIP(), c.GetHeader("User-Agent"), "admin_not_found")
        _ = incAdminLoginFail(emailOrUser)
        gf.Failed().SetMsg("管理员不存在或已禁用").Regin(c)
        return
    }
    hashed := record["password"].String()
    if bcrypt.CompareHashAndPassword([]byte(hashed), []byte(req.Password)) != nil {
        _ = logAdminLoginEvent(false, record["id"].String(), c.ClientIP(), c.GetHeader("User-Agent"), "bad_password")
        _ = incAdminLoginFail(emailOrUser)
        gf.Failed().SetMsg("账号或密码错误").Regin(c)
        return
    }

    // 登录成功清理失败计数/锁定
    _ = cacheCli.Delete("auth:admin_fail:" + emailOrUser)
    _ = cacheCli.Delete(lockKey)

    // 生成 Admin JWT（加入 Admin=true, Role）
    id := record["id"].String()
    role := record["role"].String()
    token, err := signAdminToken(id, role)
    if err != nil {
        gf.Failed().SetMsg("生成令牌失败").Regin(c)
        return
    }

    _ = logAdminLoginEvent(true, id, c.ClientIP(), c.GetHeader("User-Agent"), "")

    gf.Success().SetData(gf.Map{
        "token": token,
        "admin": gf.Map{
            "id":       id,
            "username": record["username"].String(),
            "email":    record["email"].String(),
            "role":     role,
        },
    }).Regin(c)
}

// AdminProfileHandler 管理员资料（基于 Authorization 解析）
func AdminProfileHandler(c *gin.Context) {
    tokenStr := c.GetHeader("Authorization")
    if tokenStr == "" { tokenStr = c.GetHeader("authorization") }
    tokenStr = strings.TrimSpace(strings.TrimPrefix(strings.ToLower(tokenStr), "bearer "))
    if tokenStr == "" {
        gf.Failed().SetMsg("未提供令牌").Regin(c)
        return
    }
    claims, err := parseAdminToken(tokenStr)
    if err != nil || !claims.Admin {
        gf.Failed().SetMsg("令牌无效").Regin(c)
        return
    }
    id := claims.Subject
    record, err := gf.DB().Raw("SELECT id, username, email, role, last_login_at FROM admin_users WHERE id=? LIMIT 1", id).One()
    if err != nil || record == nil {
        gf.Failed().SetMsg("管理员不存在").Regin(c)
        return
    }
    gf.Success().SetData(gf.Map{
        "id":       record["id"].String(),
        "username": record["username"].String(),
        "email":    record["email"].String(),
        "role":     record["role"].String(),
        "last_login_at": record["last_login_at"].String(),
    }).Regin(c)
}

func incAdminLoginFail(key string) error {
    cacheCli := cache.GetCache()
    failKey := "auth:admin_fail:" + key
    var cntStr string
    cnt := 0
    if err := cacheCli.Get(failKey, &cntStr); err == nil {
        fmt.Sscanf(cntStr, "%d", &cnt)
    }
    cnt++
    _ = cacheCli.Set(failKey, fmt.Sprintf("%d", cnt), 10*time.Minute)
    if cnt >= 5 {
        _ = cacheCli.Set("auth:admin_lock:"+key, "1", 15*time.Minute)
    }
    return nil
}

func signAdminToken(adminID, role string) (string, error) {
    c := gctx.New()
    appConf, _ := gcfg.Instance().Get(c, "app")
    appMap := appConf.Map()
    secret := []byte(fmt.Sprintf("%v", appMap["tokensecret"]))
    minutes := int64(60)
    if v, ok := appMap["tokenouttime"]; ok { if s, ok2 := v.(string); ok2 && s != "" { minutes = int64(gf.Int(s)) } }
    claims := struct {
        Admin bool   `json:"admin"`
        Role  string `json:"role"`
        jwt.RegisteredClaims
    }{
        Admin: true,
        Role:  role,
        RegisteredClaims: jwt.RegisteredClaims{
            Subject:   adminID,
            ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Duration(minutes) * time.Minute)),
            IssuedAt:  jwt.NewNumericDate(time.Now()),
            Issuer:    "admin",
        },
    }
    token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
    s, err := token.SignedString(secret)
    if err != nil { return "", err }
    return s, nil
}

type adminClaims struct {
    Admin bool   `json:"admin"`
    Role  string `json:"role"`
    jwt.RegisteredClaims
}

func parseAdminToken(tokenStr string) (*adminClaims, error) {
    c := gctx.New()
    appConf, _ := gcfg.Instance().Get(c, "app")
    appMap := appConf.Map()
    secret := []byte(fmt.Sprintf("%v", appMap["tokensecret"]))
    token, err := jwt.ParseWithClaims(tokenStr, &adminClaims{}, func(token *jwt.Token) (interface{}, error) { return secret, nil })
    if err != nil { return nil, err }
    if claims, ok := token.Claims.(*adminClaims); ok && token.Valid { return claims, nil }
    return nil, fmt.Errorf("invalid token")
}

// AdminJWT 中间件：保护 /admin/* 除 /admin/login
func AdminJWT() gin.HandlerFunc {
    return func(c *gin.Context) {
        path := c.Request.URL.Path
        if !strings.HasPrefix(path, "/admin/") || path == "/admin/login" {
            c.Next(); return
        }
        tokenStr := c.GetHeader("Authorization")
        if tokenStr == "" { tokenStr = c.GetHeader("authorization") }
        tokenStr = strings.TrimSpace(strings.TrimPrefix(strings.ToLower(tokenStr), "bearer "))
        if tokenStr == "" {
            c.Header("WWW-Authenticate", `Bearer realm="Admin"`)
            c.JSON(401, gin.H{"message":"需要管理员认证"}); c.Abort(); return
        }
        claims, err := parseAdminToken(tokenStr)
        if err != nil || !claims.Admin {
            c.JSON(401, gin.H{"message":"管理员令牌无效"}); c.Abort(); return
        }
        c.Set("is_admin", true)
        c.Set("admin_id", claims.Subject)
        c.Set("admin_role", claims.Role)
        c.Next()
    }
}

// 审计登录事件
func logAdminLoginEvent(success bool, adminID, ip, ua, reason string) error {
    details := gf.Map{"reason": reason}
    _, err := gf.Model("security_events").Insert(gf.Map{
        "event_type":  ifThenStr(success, "admin_login_success", "admin_login_failed"),
        "user_id":     adminID,
        "ip_address":  ip,
        "user_agent":  ua,
        "details":     details,
        "severity":    ifThenStr(success, "low", "medium"),
        "resolved":    success,
        "created_at":  time.Now(),
    })
    return err
}

func ifThenStr(cond bool, a, b string) string { if cond { return a }; return b }
