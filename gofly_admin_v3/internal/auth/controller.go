package auth

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

// Controller 认证控制器
type Controller struct {
	authService *Service
	db          *gorm.DB
}

// NewController 创建认证控制器
func NewController(authService *Service, db *gorm.DB) *Controller {
	return &Controller{
		authService: authService,
		db:          db,
	}
}

// LoginRequest 登录请求
type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

// RegisterRequest 注册请求
type RegisterRequest struct {
	Email      string `json:"email" binding:"required,email"`
	Password   string `json:"password" binding:"required,min=6"`
	Username   string `json:"username" binding:"required,min=2"`
	InviteCode string `json:"invite_code,omitempty"`
}

// User 用户模型
type User struct {
	ID            string `gorm:"primaryKey;size:36"`
	Email         string `gorm:"uniqueIndex;not null"`
	Username      string `gorm:"size:100"`
	PasswordHash  string `gorm:"size:255"`
	Role          string `gorm:"size:20;default:user"`
	Status        string `gorm:"size:20;default:active"`
	TokenBalance  int    `gorm:"default:100"`
	PlanName      string `gorm:"size:20;default:free"`
	GoogleID      string `gorm:"size:100"`
	InviteCode    string `gorm:"size:20"`
	EmailVerified bool   `gorm:"default:false"`
	LastLoginAt   *time.Time
	CreatedAt     time.Time
	UpdatedAt     time.Time
}

func (User) TableName() string {
	return "users"
}

// Login 用户登录
func (c *Controller) Login(ctx *gin.Context) {
	var req LoginRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error":   "invalid_request",
			"message": err.Error(),
		})
		return
	}

	// 查找用户
	var user User
	if err := c.db.Where("email = ? AND status = ?", req.Email, "active").First(&user).Error; err != nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{
			"error":   "invalid_credentials",
			"message": "Invalid email or password",
		})
		return
	}

	// 验证密码
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{
			"error":   "invalid_credentials",
			"message": "Invalid email or password",
		})
		return
	}

	// 生成JWT令牌
	tokenResponse, err := c.authService.GenerateTokenResponse(user.ID, user.Email, user.Role, user.PlanName)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"error":   "token_generation_failed",
			"message": "Failed to generate token",
		})
		return
	}

	// 更新最后登录时间
	now := time.Now()
	c.db.Model(&user).Update("last_login_at", now)

	ctx.JSON(http.StatusOK, LoginResult{
		Token: tokenResponse,
		User: gin.H{
			"id":            user.ID,
			"email":         user.Email,
			"username":      user.Username,
			"role":          user.Role,
			"plan_name":     user.PlanName,
			"token_balance": user.TokenBalance,
		},
		IsNewUser: false,
	})
}

// Register 用户注册
func (c *Controller) Register(ctx *gin.Context) {
	var req RegisterRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error":   "invalid_request",
			"message": err.Error(),
		})
		return
	}

	// 检查邮箱是否已存在
	var existingUser User
	if err := c.db.Where("email = ?", req.Email).First(&existingUser).Error; err == nil {
		ctx.JSON(http.StatusConflict, gin.H{
			"error":   "email_exists",
			"message": "Email already exists",
		})
		return
	}

	// 加密密码
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"error":   "password_hash_failed",
			"message": "Failed to hash password",
		})
		return
	}

	// 创建用户
	user := User{
		ID:           uuid.New().String(),
		Email:        req.Email,
		Username:     req.Username,
		PasswordHash: string(hashedPassword),
		Role:         "user",
		Status:       "active",
		TokenBalance: 100,
		PlanName:     "free",
		InviteCode:   "INV" + uuid.New().String()[:8],
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}

	if err := c.db.Create(&user).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"error":   "user_creation_failed",
			"message": "Failed to create user",
		})
		return
	}

	// 生成JWT令牌
	tokenResponse, err := c.authService.GenerateTokenResponse(user.ID, user.Email, user.Role, user.PlanName)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"error":   "token_generation_failed",
			"message": "Failed to generate token",
		})
		return
	}

	ctx.JSON(http.StatusCreated, LoginResult{
		Token: tokenResponse,
		User: gin.H{
			"id":            user.ID,
			"email":         user.Email,
			"username":      user.Username,
			"role":          user.Role,
			"plan_name":     user.PlanName,
			"token_balance": user.TokenBalance,
		},
		IsNewUser: true,
	})
}

// GoogleLoginRequest Google登录请求
type GoogleLoginRequest struct {
	IDToken string `json:"id_token" binding:"required"`
}

// GoogleLogin Google登录
func (c *Controller) GoogleLogin(ctx *gin.Context) {
	var req GoogleLoginRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error":   "invalid_request",
			"message": err.Error(),
		})
		return
	}

	// 验证Google ID Token
	googleUserInfo, err := c.authService.VerifyGoogleIDToken(req.IDToken)
	if err != nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{
			"error":   "invalid_google_token",
			"message": "Invalid Google ID token",
		})
		return
	}

	// 查找或创建用户
	var user User
	err = c.db.Where("google_id = ?", googleUserInfo.ID).First(&user).Error

	isNewUser := false
	if err != nil {
		// 检查邮箱是否已存在
		err = c.db.Where("email = ?", googleUserInfo.Email).First(&user).Error
		if err != nil {
			// 创建新用户
			user = User{
				ID:            uuid.New().String(),
				Email:         googleUserInfo.Email,
				Username:      googleUserInfo.Name,
				Role:          "user",
				Status:        "active",
				TokenBalance:  100,
				PlanName:      "free",
				GoogleID:      googleUserInfo.ID,
				InviteCode:    "INV" + uuid.New().String()[:8],
				EmailVerified: googleUserInfo.VerifiedEmail,
				CreatedAt:     time.Now(),
				UpdatedAt:     time.Now(),
			}

			if err := c.db.Create(&user).Error; err != nil {
				ctx.JSON(http.StatusInternalServerError, gin.H{
					"error":   "user_creation_failed",
					"message": "Failed to create user",
				})
				return
			}
			isNewUser = true
		} else {
			// 绑定Google账号到现有用户
			user.GoogleID = googleUserInfo.ID
			user.EmailVerified = googleUserInfo.VerifiedEmail
			c.db.Save(&user)
		}
	}

	// 更新最后登录时间
	now := time.Now()
	c.db.Model(&user).Update("last_login_at", now)

	// 生成JWT令牌
	tokenResponse, err := c.authService.GenerateTokenResponse(user.ID, user.Email, user.Role, user.PlanName)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"error":   "token_generation_failed",
			"message": "Failed to generate token",
		})
		return
	}

	ctx.JSON(http.StatusOK, LoginResult{
		Token: tokenResponse,
		User: gin.H{
			"id":             user.ID,
			"email":          user.Email,
			"username":       user.Username,
			"role":           user.Role,
			"plan_name":      user.PlanName,
			"token_balance":  user.TokenBalance,
			"email_verified": user.EmailVerified,
		},
		IsNewUser: isNewUser,
	})
}

// GetProfile 获取用户信息
func (c *Controller) GetProfile(ctx *gin.Context) {
	userID, exists := ctx.Get("user_id")
	if !exists {
		ctx.JSON(http.StatusUnauthorized, gin.H{
			"error":   "unauthorized",
			"message": "User not authenticated",
		})
		return
	}

	var user User
	if err := c.db.Where("id = ?", userID).First(&user).Error; err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{
			"error":   "user_not_found",
			"message": "User not found",
		})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"id":             user.ID,
		"email":          user.Email,
		"username":       user.Username,
		"role":           user.Role,
		"plan_name":      user.PlanName,
		"token_balance":  user.TokenBalance,
		"email_verified": user.EmailVerified,
		"created_at":     user.CreatedAt,
	})
}

// RefreshToken 刷新令牌
func (c *Controller) RefreshToken(ctx *gin.Context) {
	authHeader := ctx.GetHeader("Authorization")
	if authHeader == "" || len(authHeader) < 7 || authHeader[:7] != "Bearer " {
		ctx.JSON(http.StatusUnauthorized, gin.H{
			"error":   "invalid_token",
			"message": "Invalid authorization header",
		})
		return
	}

	tokenString := authHeader[7:]

	// 刷新令牌
	newToken, err := c.authService.RefreshToken(tokenString)
	if err != nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{
			"error":   "token_refresh_failed",
			"message": "Failed to refresh token",
		})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"access_token": newToken,
		"token_type":   "Bearer",
	})
}
