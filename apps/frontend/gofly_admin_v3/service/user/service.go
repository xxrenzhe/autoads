package user

import (
    "context"
    "errors"
    "fmt"
    "strings"
    "time"

    jwt "github.com/golang-jwt/jwt/v5"
    "golang.org/x/crypto/bcrypt"
    "gofly-admin-v3/internal/cache"
    "gofly-admin-v3/utils/gf"
    "gofly-admin-v3/utils/gform"
    "gofly-admin-v3/utils/tools/gcfg"
    "gofly-admin-v3/utils/tools/gctx"
)

// Model 用户模型
type Model struct {
	ID            string     `json:"id" gorm:"primaryKey"`
	Email         string     `json:"email" gorm:"uniqueIndex;not null"`
	Username      string     `json:"username"`
	PasswordHash  string     `json:"-" gorm:"not null"`
	AvatarURL     string     `json:"avatar_url"`
	Role          string     `json:"role" gorm:"default:'USER'"`
	Status        string     `json:"status" gorm:"default:'ACTIVE'"`
	TokenBalance  int64      `json:"token_balance" gorm:"default:0"`
	EmailVerified bool       `json:"email_verified" gorm:"default:false"`
	LastLoginAt   *time.Time `json:"last_login_at"`
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`
	DeletedAt     *time.Time `json:"-" gorm:"index"`
}

// TableName 指定表名
func (Model) TableName() string {
	return "users"
}

// Service 用户服务
type Service struct {
    db gform.DB
}

// NewService 创建用户服务
func NewService(db gform.DB) *Service {
	return &Service{db: db}
}

// Register 注册用户
func (s *Service) Register(req *RegisterRequest) (*Model, error) {
    // 检查邮箱是否已存在
    email := strings.ToLower(strings.TrimSpace(req.Email))
    exists, err := s.db.Model(&Model{}).Where("email = ?", email).Count()
    if err != nil {
        return nil, err
    }
    if exists > 0 {
        return nil, errors.New("邮箱已存在")
    }

    // 创建用户
    user := &Model{
        ID:           generateUUID(),
        Email:        email,
        Username:     req.Username,
        PasswordHash: hashPassword(req.Password),
        Status:       "ACTIVE",
        TokenBalance: 100, // 注册赠送100Token
        CreatedAt:    time.Now(),
        UpdatedAt:    time.Now(),
    }

	// 使用GoFly ORM保存
	if _, err := s.db.Model(&Model{}).Data(user).Insert(); err != nil {
		return nil, err
	}

	return user, nil
}

// Login 用户登录
func (s *Service) Login(email, password string) (*Model, string, error) {
    // 登录尝试限制
    failKey := "auth:login_fail:" + strings.ToLower(strings.TrimSpace(email))
    lockKey := "auth:login_lock:" + strings.ToLower(strings.TrimSpace(email))
    c := cache.GetCache()
    // 若被锁定
    if ok, _ := c.Exists(lockKey); ok {
        return nil, "", errors.New("账户暂时锁定，请稍后再试")
    }

    // 使用GoFly ORM查询用户
    record, err := s.db.Model(&Model{}).Where("email = ? AND status = ?", strings.ToLower(strings.TrimSpace(email)), "ACTIVE").One()
    if err != nil {
        _ = s.incLoginFail(failKey, lockKey)
        return nil, "", errors.New("用户不存在或已被禁用")
    }

	user := &Model{
		ID:            record["id"].String(),
		Email:         record["email"].String(),
		Username:      record["username"].String(),
		PasswordHash:  record["password_hash"].String(),
		AvatarURL:     record["avatar_url"].String(),
		Role:          record["role"].String(),
		Status:        record["status"].String(),
		TokenBalance:  record["token_balance"].Int64(),
		EmailVerified: record["email_verified"].Bool(),
		CreatedAt:     record["created_at"].Time(),
		UpdatedAt:     record["updated_at"].Time(),
	}

    // 验证密码
    if !verifyPassword(user.PasswordHash, password) {
        _ = s.incLoginFail(failKey, lockKey)
        return nil, "", errors.New("密码错误")
    }

    // 更新登录时间
    now := time.Now()
    user.LastLoginAt = &now
    s.db.Model(&Model{}).Data(&user).Where("id = ?", user.ID).Update()

    // 生成JWT token（加入 plan 提示）
    plan := s.getActivePlanName(user.ID)
    token, err := generateJWTTokenWithPlan(user.ID, plan, "")
    if err != nil {
        return nil, "", err
    }

    // 登录成功清理失败计数
    _ = c.Delete(failKey)
    _ = c.Delete(lockKey)

    return user, token, nil
}

// incLoginFail 增加失败计数并按阈值锁定
func (s *Service) incLoginFail(failKey, lockKey string) error {
    c := cache.GetCache()
    // 获取当前次数
    var cntStr string
    cnt := 0
    if err := c.Get(failKey, &cntStr); err == nil {
        fmt.Sscanf(cntStr, "%d", &cnt)
    }
    cnt++
    // 10分钟窗口
    _ = c.Set(failKey, fmt.Sprintf("%d", cnt), 10*time.Minute)
    if cnt >= 5 {
        // 锁定15分钟
        _ = c.Set(lockKey, "1", 15*time.Minute)
    }
    return nil
}

// GetUserByID 根据ID获取用户
func (s *Service) GetUserByID(id string) (*Model, error) {
    // 尝试缓存
    cacheKey := "user:profile:" + id
    var cached Model
    if err := cache.GetCache().Get(cacheKey, &cached); err == nil && cached.ID != "" {
        return &cached, nil
    }

    record, err := s.db.Model(&Model{}).Where("id = ?", id).One()
    if err != nil {
        return nil, err
    }

    user := &Model{
        ID:            record["id"].String(),
        Email:         record["email"].String(),
        Username:      record["username"].String(),
        PasswordHash:  record["password_hash"].String(),
        AvatarURL:     record["avatar_url"].String(),
        Role:          record["role"].String(),
        Status:        record["status"].String(),
        TokenBalance:  record["token_balance"].Int64(),
        EmailVerified: record["email_verified"].Bool(),
        CreatedAt:     record["created_at"].Time(),
        UpdatedAt:     record["updated_at"].Time(),
    }
    // 写缓存
    _ = cache.GetCache().Set(cacheKey, user, 5*time.Minute)
    return user, nil
}

// GetUserList 获取用户列表（支持分页和搜索）
func (s *Service) GetUserList(page, size int, keyword string) ([]Model, int64, error) {
    query := s.db.Model(&Model{})

    // 搜索条件
    if keyword != "" {
        query = query.Where("email LIKE ? OR username LIKE ?", "%"+keyword+"%", "%"+keyword+"%")
    }

	// 获取总数
	total, err := query.Count()
	if err != nil {
		return nil, 0, err
	}

	// 分页查询
	result, err := query.
		Offset((page - 1) * size).
		Limit(size).
		Order("created_at DESC").
		All()
	if err != nil {
		return nil, 0, err
	}

	// Convert result to slice of Model
	var users []Model
	for _, record := range result {
		users = append(users, Model{
			ID:            record["id"].String(),
			Email:         record["email"].String(),
			Username:      record["username"].String(),
			PasswordHash:  record["password_hash"].String(),
			AvatarURL:     record["avatar_url"].String(),
			Role:          record["role"].String(),
			Status:        record["status"].String(),
			TokenBalance:  record["token_balance"].Int64(),
			EmailVerified: record["email_verified"].Bool(),
			CreatedAt:     record["created_at"].Time(),
			UpdatedAt:     record["updated_at"].Time(),
		})
	}

	return users, int64(total), nil
}

// GetUserListSorted 支持排序
func (s *Service) GetUserListSorted(page, size int, keyword, sort string) ([]Model, int64, error) {
    query := s.db.Model(&Model{})
    if keyword != "" {
        query = query.Where("email LIKE ? OR username LIKE ?", "%"+keyword+"%", "%"+keyword+"%")
    }
    total, err := query.Count()
    if err != nil { return nil, 0, err }

    // 排序
    order := "created_at DESC"
    switch strings.ToLower(sort) {
    case "created_at_asc": order = "created_at ASC"
    case "username": order = "username ASC"
    case "email": order = "email ASC"
    }

    result, err := query.Offset((page-1)*size).Limit(size).Order(order).All()
    if err != nil { return nil, 0, err }
    var users []Model
    for _, record := range result {
        users = append(users, Model{
            ID:            record["id"].String(),
            Email:         record["email"].String(),
            Username:      record["username"].String(),
            PasswordHash:  record["password_hash"].String(),
            AvatarURL:     record["avatar_url"].String(),
            Role:          record["role"].String(),
            Status:        record["status"].String(),
            TokenBalance:  record["token_balance"].Int64(),
            EmailVerified: record["email_verified"].Bool(),
            CreatedAt:     record["created_at"].Time(),
            UpdatedAt:     record["updated_at"].Time(),
        })
    }
    return users, int64(total), nil
}

// UpdateTokenBalance 更新Token余额
func (s *Service) UpdateTokenBalance(userID string, amount int64) error {
	_, err := s.db.Model(&Model{}).
		Where("id = ?", userID).
		Update(gform.Map{"token_balance": gf.Raw("token_balance + ?", amount)})
	return err
}

// UpdateProfile 更新用户资料
func (s *Service) UpdateProfile(userID string, req *UpdateProfileRequest) (*Model, error) {
    updates := gform.Map{}
    if req.Username != "" {
        updates["username"] = req.Username
    }
    if req.AvatarURL != "" {
        if !isValidURL(req.AvatarURL) {
            return nil, errors.New("头像URL不合法")
        }
        updates["avatar_url"] = req.AvatarURL
    }

    if len(updates) == 0 {
        return s.GetUserByID(userID)
    }

    _, err := s.db.Model(&Model{}).Where("id = ?", userID).Update(updates)
    if err != nil {
        return nil, err
    }

    // 失效缓存
    _ = cache.GetCache().Delete("user:profile:" + userID)

    return s.GetUserByID(userID)
}

func isValidURL(u string) bool {
    if len(u) > 2048 { return false }
    us := strings.ToLower(strings.TrimSpace(u))
    return strings.HasPrefix(us, "http://") || strings.HasPrefix(us, "https://")
}

// ChangePassword 修改密码
func (s *Service) ChangePassword(userID, oldPassword, newPassword string) error {
	// 获取用户
	user, err := s.GetUserByID(userID)
	if err != nil {
		return err
	}

	// 验证旧密码
	if !verifyPassword(user.PasswordHash, oldPassword) {
		return errors.New("原密码错误")
	}

	// 更新密码
    _, err = s.db.Model(&Model{}).
        Where("id = ?", userID).
        Update(gform.Map{"password_hash": hashPassword(newPassword)})
    if err == nil {
        _ = cache.GetCache().Delete("user:profile:" + userID)
    }

    return err
}

// StartTrial 开始试用
func (s *Service) StartTrial(userID string) error {
	// 给用户添加试用Token
	_, err := s.db.Model(&Model{}).
		Where("id = ?", userID).
		Update(gform.Map{"token_balance": gf.Raw("token_balance + ?", 1000)})
	return err
}

// RefreshToken 刷新令牌
func (s *Service) RefreshToken(userID string) (string, error) {
    // 检查用户是否存在
    _, err := s.GetUserByID(userID)
    if err != nil {
        return "", err
    }

    // 生成新的JWT token，带 plan 提示
    plan := s.getActivePlanName(userID)
    token, err := generateJWTTokenWithPlan(userID, plan, "")
    if err != nil { return "", err }
    return token, nil
}

// Logout 登出
func (s *Service) Logout(userID string) error {
	// 在实际应用中，可能需要将token加入黑名单
	// 这里暂时只是一个空实现
	return nil
}

// 辅助函数
func generateUUID() string {
	// 使用GoFly的UUID生成
	return gf.UUID()
}

func hashPassword(password string) string {
    // bcrypt 加密
    h, _ := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
    return string(h)
}

func verifyPassword(hash, password string) bool {
    return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) == nil
}

func generateJWTTokenWithPlan(userID string, plan string, tenant string) (string, error) {
    // 使用与 JwtVerify 相同的 tokensecret
    c := gctx.New()
    appConf, _ := gcfg.Instance().Get(c, "app")
    appMap := appConf.Map()
    secret := []byte(fmt.Sprintf("%v", appMap["tokensecret"]))
    minutes := int64(0)
    if v, ok := appMap["tokenouttime"]; ok {
        switch vv := v.(type) {
        case int64:
            minutes = vv
        case int:
            minutes = int64(vv)
        case float64:
            minutes = int64(vv)
        case string:
            if vv != "" { minutes = int64(gf.Int(vv)) }
        }
    }
    if minutes <= 0 { minutes = 60 }

    claims := struct {
        Plan   string `json:"plan,omitempty"`
        Tenant string `json:"tenant,omitempty"`
        jwt.RegisteredClaims
    }{
        Plan:   plan,
        Tenant: tenant,
        RegisteredClaims: jwt.RegisteredClaims{
            Subject:   userID,
            ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Duration(minutes) * time.Minute)),
            IssuedAt:  jwt.NewNumericDate(time.Now()),
        },
    }
    token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
    s, err := token.SignedString(secret)
    if err != nil { return "", fmt.Errorf("sign token failed: %w", err) }
    return s, nil
}

// 获取当前有效套餐名（FREE/PRO/MAX），失败返回 FREE
func (s *Service) getActivePlanName(userID string) string {
    ctx := context.Background()
    sql := `SELECT p.name AS plan_name, s.ended_at FROM subscriptions s
            JOIN plans p ON p.id = s.plan_id
            WHERE s.user_id = ? AND s.status = 'ACTIVE'
            ORDER BY s.updated_at DESC LIMIT 1`
    res, err := gf.DB().Query(ctx, sql, userID)
    if err == nil && !res.IsEmpty() {
        rec := res[0]
        plan := rec["plan_name"].String()
        if plan == "" { return "FREE" }
        endedAt := rec["ended_at"].String()
        if endedAt != "" {
            layouts := []string{time.RFC3339Nano, time.RFC3339, "2006-01-02 15:04:05"}
            for _, layout := range layouts {
                if t, e := time.Parse(layout, endedAt); e == nil {
                    if time.Now().After(t) { return "FREE" }
                    break
                }
            }
        }
        return plan
    }
    return "FREE"
}
