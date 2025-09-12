package user

import (
	"errors"
	"time"

	"gofly-admin-v3/utils/gform"
	"gofly-admin-v3/utils/gvalid"
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
	db *gform.DB
}

// NewService 创建用户服务
func NewService(db *gform.DB) *Service {
	return &Service{db: db}
}

// Register 注册用户
func (s *Service) Register(req *RegisterRequest) (*Model, error) {
	// 检查邮箱是否已存在
	var exists int64
	if err := s.db.Model(&Model{}).Where("email = ?", req.Email).Count(&exists).Error; err != nil {
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
	if err := s.db.Create(user).Error; err != nil {
		return nil, err
	}

	return user, nil
}

// Login 用户登录
func (s *Service) Login(email, password string) (*Model, string, error) {
	// 使用GoFly ORM查询用户
	var user Model
	if err := s.db.Where("email = ? AND status = ?", email, "ACTIVE").First(&user).Error; err != nil {
		return nil, "", errors.New("用户不存在或已被禁用")
	}

	// 验证密码
	if !verifyPassword(user.PasswordHash, password) {
		return nil, "", errors.New("密码错误")
	}

	// 更新登录时间
	now := time.Now()
	user.LastLoginAt = &now
	s.db.Save(&user)

	// 生成JWT token
	token := generateJWTToken(user.ID, user.Role)

	return &user, token, nil
}

// GetUserByID 根据ID获取用户
func (s *Service) GetUserByID(id string) (*Model, error) {
	var user Model
	if err := s.db.First(&user, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

// GetUserList 获取用户列表（支持分页和搜索）
func (s *Service) GetUserList(page, size int, keyword string) ([]Model, int64, error) {
	var users []Model
	query := s.db.Model(&Model{})

	// 搜索条件
	if keyword != "" {
		query = query.Where("email LIKE ? OR username LIKE ?", "%"+keyword+"%", "%"+keyword+"%")
	}

	// 获取总数
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	// 分页查询
	if err := query.
		Offset((page - 1) * size).
		Limit(size).
		Order("created_at DESC").
		Find(&users).Error; err != nil {
		return nil, 0, err
	}

	return users, total, nil
}

// UpdateTokenBalance 更新Token余额
func (s *Service) UpdateTokenBalance(userID string, amount int64) error {
	return s.db.Model(&Model{}).
		Where("id = ?", userID).
		Update("token_balance", gform.Raw("token_balance + ?", amount)).Error
}

// RegisterRequest 注册请求
type RegisterRequest struct {
	Email    string `v:"required|email"`
	Password string `v:"required|length:6,20"`
	Username string `v:"required|min:2"`
}

// 辅助函数
func generateUUID() string {
	// 使用GoFly的UUID生成
	return gform.UUID()
}

func hashPassword(password string) string {
	// 使用GoFly的加密工具
	return gform.MD5(password + "salt")
}

func verifyPassword(hash, password string) bool {
	return hash == hashPassword(password)
}

func generateJWTToken(userID, role string) string {
	// 使用GoFly的JWT生成
	return gform.JWTSign(gform.Map{
		"user_id": userID,
		"role":    role,
		"exp":     time.Now().Add(time.Hour * 24).Unix(),
	})
}
