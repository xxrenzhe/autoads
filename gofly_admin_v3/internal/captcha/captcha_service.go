package captcha

import (
	"crypto/rand"
	"fmt"
	"image"
	"image/color"
	"image/draw"
	"image/png"
	"math"
	"math/big"
		"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang/freetype"
	"github.com/golang/freetype/truetype"
	"gofly-admin-v3/internal/cache"
	"gofly-admin-v3/internal/i18n"
	"gofly-admin-v3/internal/response"
	"golang.org/x/image/font/gofont/goregular"
)

// CaptchaType 验证码类型
type CaptchaType string

const (
	CaptchaTypeImage CaptchaType = "image"
	CaptchaTypeEmail CaptchaType = "email"
)

// CaptchaService 验证码服务
type CaptchaService struct {
	cache  cache.CacheService
	font   *truetype.Font
	config *CaptchaConfig
}

// CaptchaConfig 验证码配置
type CaptchaConfig struct {
	ImageWidth    int           `yaml:"image_width"`
	ImageHeight   int           `yaml:"image_height"`
	CodeLength    int           `yaml:"code_length"`
	ExpireTime    time.Duration `yaml:"expire_time"`
	NoiseCount    int           `yaml:"noise_count"`
	EmailTemplate string        `yaml:"email_template"`
}

// CaptchaInfo 验证码信息
type CaptchaInfo struct {
	ID        string      `json:"id"`
	Type      CaptchaType `json:"type"`
	Code      string      `json:"-"` // 不返回给前端
	ImageData []byte      `json:"image_data,omitempty"`
	ExpiresAt time.Time   `json:"expires_at"`
}

var (
	defaultCaptchaService *CaptchaService
	captchaInit           bool
)

// NewCaptchaService 创建验证码服务
func NewCaptchaService(cacheService cache.CacheService) *CaptchaService {
	// 加载字体
	font, err := freetype.ParseFont(goregular.TTF)
	if err != nil {
		panic(fmt.Sprintf("Failed to parse font: %v", err))
	}

	config := &CaptchaConfig{
		ImageWidth:  120,
		ImageHeight: 40,
		CodeLength:  4,
		ExpireTime:  5 * time.Minute,
		NoiseCount:  50,
	}

	return &CaptchaService{
		cache:  cacheService,
		font:   font,
		config: config,
	}
}

// GetCaptchaService 获取验证码服务
func GetCaptchaService() *CaptchaService {
	if !captchaInit {
		// 这里需要传入实际的缓存服务
		// defaultCaptchaService = NewCaptchaService(cache.GetCacheService())
		captchaInit = true
	}
	return defaultCaptchaService
}

// GenerateImageCaptcha 生成图片验证码
func (s *CaptchaService) GenerateImageCaptcha() (*CaptchaInfo, error) {
	// 生成验证码ID
	captchaID := s.generateID()

	// 生成验证码
	code := s.generateCode(s.config.CodeLength)

	// 生成图片
	imageData, err := s.generateImage(code)
	if err != nil {
		return nil, fmt.Errorf("failed to generate image: %v", err)
	}

	// 创建验证码信息
	captchaInfo := &CaptchaInfo{
		ID:        captchaID,
		Type:      CaptchaTypeImage,
		Code:      code,
		ImageData: imageData,
		ExpiresAt: time.Now().Add(s.config.ExpireTime),
	}

	// 存储到缓存
	cacheKey := fmt.Sprintf("captcha:image:%s", captchaID)
	if err := s.cache.Set(cacheKey, code, s.config.ExpireTime); err != nil {
		return nil, fmt.Errorf("failed to cache captcha: %v", err)
	}

	return captchaInfo, nil
}

// GenerateEmailCaptcha 生成邮箱验证码
func (s *CaptchaService) GenerateEmailCaptcha(email string) (*CaptchaInfo, error) {
	// 生成验证码ID
	captchaID := s.generateID()

	// 生成6位数字验证码
	code := s.generateCode(6)

	// 创建验证码信息
	captchaInfo := &CaptchaInfo{
		ID:        captchaID,
		Type:      CaptchaTypeEmail,
		Code:      code,
		ExpiresAt: time.Now().Add(s.config.ExpireTime),
	}

	// 存储到缓存
	cacheKey := fmt.Sprintf("captcha:email:%s", captchaID)
	captchaData := map[string]interface{}{
		"code":  code,
		"email": email,
	}
	if err := s.cache.Set(cacheKey, captchaData, s.config.ExpireTime); err != nil {
		return nil, fmt.Errorf("failed to cache captcha: %v", err)
	}

	// TODO: 发送邮件
	// emailService.SendCaptcha(email, code)

	return captchaInfo, nil
}

// VerifyCaptcha 验证验证码
func (s *CaptchaService) VerifyCaptcha(captchaID, code string, captchaType CaptchaType) bool {
	cacheKey := fmt.Sprintf("captcha:%s:%s", captchaType, captchaID)

	// 从缓存获取
	var cachedData interface{}
	if err := s.cache.Get(cacheKey, &cachedData); err != nil {
		return false
	}

	var cachedCode string
	switch captchaType {
	case CaptchaTypeImage:
		cachedCode = cachedData.(string)
	case CaptchaTypeEmail:
		data := cachedData.(map[string]interface{})
		cachedCode = data["code"].(string)
	}

	// 验证码比较（不区分大小写）
	if strings.ToLower(code) == strings.ToLower(cachedCode) {
		// 验证成功后删除缓存
		s.cache.Delete(cacheKey)
		return true
	}

	return false
}

// generateID 生成验证码ID
func (s *CaptchaService) generateID() string {
	return fmt.Sprintf("%d", time.Now().UnixNano())
}

// generateCode 生成验证码
func (s *CaptchaService) generateCode(length int) string {
	const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	code := make([]byte, length)

	for i := range code {
		n, _ := rand.Int(rand.Reader, big.NewInt(int64(len(charset))))
		code[i] = charset[n.Int64()]
	}

	return string(code)
}

// generateImage 生成验证码图片
func (s *CaptchaService) generateImage(code string) ([]byte, error) {
	// 创建图片
	img := image.NewRGBA(image.Rect(0, 0, s.config.ImageWidth, s.config.ImageHeight))

	// 填充背景色
	draw.Draw(img, img.Bounds(), &image.Uniform{color.RGBA{240, 240, 240, 255}}, image.Point{}, draw.Src)

	// 创建字体上下文
	c := freetype.NewContext()
	c.SetDPI(72)
	c.SetFont(s.font)
	c.SetFontSize(24)
	c.SetClip(img.Bounds())
	c.SetDst(img)

	// 绘制验证码字符
	for i, char := range code {
		// 随机颜色
		color := s.randomColor()
		c.SetSrc(&image.Uniform{color})

		// 计算位置
		x := 10 + i*25 + s.randomInt(-5, 5)
		y := 30 + s.randomInt(-5, 5)

		// 绘制字符
		pt := freetype.Pt(x, y)
		c.DrawString(string(char), pt)
	}

	// 添加噪点
	s.addNoise(img)

	// 添加干扰线
	s.addLines(img)

	// 转换为PNG字节数组
	var buf []byte
	writer := &byteWriter{data: &buf}
	if err := png.Encode(writer, img); err != nil {
		return nil, err
	}

	return buf, nil
}

// randomColor 生成随机颜色
func (s *CaptchaService) randomColor() color.RGBA {
	return color.RGBA{
		R: uint8(s.randomInt(0, 255)),
		G: uint8(s.randomInt(0, 255)),
		B: uint8(s.randomInt(0, 255)),
		A: 255,
	}
}

// randomInt 生成随机整数
func (s *CaptchaService) randomInt(min, max int) int {
	n, _ := rand.Int(rand.Reader, big.NewInt(int64(max-min+1)))
	return min + int(n.Int64())
}

// addNoise 添加噪点
func (s *CaptchaService) addNoise(img *image.RGBA) {
	for i := 0; i < s.config.NoiseCount; i++ {
		x := s.randomInt(0, s.config.ImageWidth-1)
		y := s.randomInt(0, s.config.ImageHeight-1)
		img.Set(x, y, s.randomColor())
	}
}

// addLines 添加干扰线
func (s *CaptchaService) addLines(img *image.RGBA) {
	for i := 0; i < 3; i++ {
		x1 := s.randomInt(0, s.config.ImageWidth/2)
		y1 := s.randomInt(0, s.config.ImageHeight)
		x2 := s.randomInt(s.config.ImageWidth/2, s.config.ImageWidth)
		y2 := s.randomInt(0, s.config.ImageHeight)

		s.drawLine(img, x1, y1, x2, y2, s.randomColor())
	}
}

// drawLine 绘制直线
func (s *CaptchaService) drawLine(img *image.RGBA, x1, y1, x2, y2 int, c color.RGBA) {
	dx := math.Abs(float64(x2 - x1))
	dy := math.Abs(float64(y2 - y1))

	var sx, sy int
	if x1 < x2 {
		sx = 1
	} else {
		sx = -1
	}
	if y1 < y2 {
		sy = 1
	} else {
		sy = -1
	}

	err := dx - dy

	for {
		img.Set(x1, y1, c)

		if x1 == x2 && y1 == y2 {
			break
		}

		e2 := 2 * err
		if e2 > -dy {
			err -= dy
			x1 += sx
		}
		if e2 < dx {
			err += dx
			y1 += sy
		}
	}
}

// byteWriter 字节写入器
type byteWriter struct {
	data *[]byte
}

func (w *byteWriter) Write(p []byte) (n int, err error) {
	*w.data = append(*w.data, p...)
	return len(p), nil
}

// API处理函数

// GetImageCaptcha 获取图片验证码
func GetImageCaptcha(c *gin.Context) {
	service := GetCaptchaService()

	captcha, err := service.GenerateImageCaptcha()
	if err != nil {
		response.Error(c, 5001, i18n.T(c, "failed"))
		return
	}

	response.Success(c, gin.H{
		"captcha_id": captcha.ID,
		"image_data": fmt.Sprintf("data:image/png;base64,%s", captcha.ImageData),
		"expires_at": captcha.ExpiresAt,
	})
}

// SendEmailCaptcha 发送邮箱验证码
func SendEmailCaptcha(c *gin.Context) {
	var req struct {
		Email string `json:"email" binding:"required,email"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, 1001, i18n.T(c, "invalid_parameters"))
		return
	}

	service := GetCaptchaService()

	captcha, err := service.GenerateEmailCaptcha(req.Email)
	if err != nil {
		response.Error(c, 5001, i18n.T(c, "failed"))
		return
	}

	response.Success(c, gin.H{
		"captcha_id": captcha.ID,
		"message":    i18n.T(c, "email_sent"),
		"expires_at": captcha.ExpiresAt,
	})
}

// VerifyCaptchaAPI 验证验证码API
func VerifyCaptchaAPI(c *gin.Context) {
	var req struct {
		CaptchaID   string      `json:"captcha_id" binding:"required"`
		Code        string      `json:"code" binding:"required"`
		CaptchaType CaptchaType `json:"captcha_type" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, 1001, i18n.T(c, "invalid_parameters"))
		return
	}

	service := GetCaptchaService()

	if service.VerifyCaptcha(req.CaptchaID, req.Code, req.CaptchaType) {
		response.Success(c, gin.H{
			"message": i18n.T(c, "success"),
		})
	} else {
		response.Error(c, 2001, i18n.T(c, "captcha_invalid"))
	}
}

// CaptchaMiddleware 验证码验证中间件
func CaptchaMiddleware(captchaType CaptchaType) gin.HandlerFunc {
	return func(c *gin.Context) {
		captchaID := c.GetHeader("X-Captcha-ID")
		captchaCode := c.GetHeader("X-Captcha-Code")

		if captchaID == "" || captchaCode == "" {
			response.Error(c, 2001, i18n.T(c, "captcha_required"))
			c.Abort()
			return
		}

		service := GetCaptchaService()
		if !service.VerifyCaptcha(captchaID, captchaCode, captchaType) {
			response.Error(c, 2002, i18n.T(c, "captcha_invalid"))
			c.Abort()
			return
		}

		c.Next()
	}
}

// RegisterCaptchaRoutes 注册验证码路由
func RegisterCaptchaRoutes(r *gin.RouterGroup) {
	captcha := r.Group("/captcha")
	{
		captcha.GET("/image", GetImageCaptcha)
		captcha.POST("/email", SendEmailCaptcha)
		captcha.POST("/verify", VerifyCaptchaAPI)
	}
}
