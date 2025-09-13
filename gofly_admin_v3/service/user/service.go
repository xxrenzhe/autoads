package user

import (
	"errors"
	"time"

	"gofly-admin-v3/utils/gform"
	"gofly-admin-v3/utils/gf"
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
	exists, err := s.db.Model(&Model{}).Where("email = ?", req.Email).Count()
	if err != nil {
		return nil, err
	}
	if exists > 0 {
		return nil, errors.New("邮箱已存在")
	}

	// 创建用户
	user := &Model{
		ID:           generateUUID(),
		Email:        req.Email,
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
	// 使用GoFly ORM查询用户
	record, err := s.db.Model(&Model{}).Where("email = ? AND status = ?", email, "ACTIVE").One()
	if err != nil {
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
		return nil, "", errors.New("密码错误")
	}

	// 更新登录时间
	now := time.Now()
	user.LastLoginAt = &now
	s.db.Model(&Model{}).Data(&user).Where("id = ?", user.ID).Update()

	// 生成JWT token
	token := generateJWTToken(user.ID, user.Role)

	return user, token, nil
}

// GetUserByID 根据ID获取用户
func (s *Service) GetUserByID(id string) (*Model, error) {
	record, err := s.db.Model(&Model{}).Where("id = ?", id).One()
	if err != nil {
		return nil, err
	}
	
	return &Model{
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
	}, nil
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
		updates["avatar_url"] = req.AvatarURL
	}
	
	if len(updates) == 0 {
		return s.GetUserByID(userID)
	}
	
	_, err := s.db.Model(&Model{}).Where("id = ?", userID).Update(updates)
	if err != nil {
		return nil, err
	}
	
	return s.GetUserByID(userID)
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
	
	// 生成新的JWT token
	user, _ := s.GetUserByID(userID)
	return generateJWTToken(user.ID, user.Role), nil
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
	// 使用GoFly的加密工具
	return gf.MD5(password + "salt")
}

func verifyPassword(hash, password string) bool {
	return hash == hashPassword(password)
}

func generateJWTToken(userID, role string) string {
	// 使用GoFly的JWT生成
	// 暂时使用简单的字符串生成
	return "jwt_token_placeholder"
}
