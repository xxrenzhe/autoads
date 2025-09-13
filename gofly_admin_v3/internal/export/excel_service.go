package export

import (
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"gofly-admin-v3/internal/batchgo"
	"gofly-admin-v3/internal/response"
	"gofly-admin-v3/service/user"
	"gorm.io/gorm"
)

// ExcelService Excel导出服务
type ExcelService struct {
	db *gorm.DB
}

// User 用户模型别名
type User = user.Model

// BatchTask 批处理任务模型别名
type BatchTask = batchgo.BatchTask

// TokenTransaction 令牌交易记录
type TokenTransaction struct {
	ID        string      `json:"id" gorm:"primaryKey"`
	UserID    string      `json:"user_id"`
	Type      string      `json:"type"`
	Amount    int64       `json:"amount"`
	Balance   int64       `json:"balance"`
	Reference string      `json:"reference"`
	CreatedAt time.Time   `json:"created_at"`
	UpdatedAt time.Time   `json:"updated_at"`
	Metadata  interface{} `json:"metadata" gorm:"type:json"`
}

// SiteRankQuery 网站排名查询记录
type SiteRankQuery struct {
	ID        string    `json:"id" gorm:"primaryKey"`
	UserID    string    `json:"user_id"`
	URL       string    `json:"url"`
	Metrics   string    `json:"metrics"`
	Status    string    `json:"status"`
	Result    string    `json:"result" gorm:"type:text"`
	CreatedAt time.Time `json:"created_at"`
}

// NewExcelService 创建Excel导出服务
func NewExcelService(db *gorm.DB) *ExcelService {
	return &ExcelService{db: db}
}

// ExportUserData 导出用户数据
func (s *ExcelService) ExportUserData(c *gin.Context) {
	userID := c.GetUint("user_id")

	// 获取用户信息
	var user User
	if err := s.db.Where("id = ?", userID).First(&user).Error; err != nil {
		response.Error(c, 5001, "用户不存在")
		return
	}

	// 创建CSV内容
	var csvContent strings.Builder
	csvContent.WriteString("字段,值\n")

	// 用户数据
	userData := [][]string{
		{"用户ID", user.ID},
		{"邮箱", user.Email},
		{"用户名", user.Username},
		{"角色", user.Role},
		{"Token余额", strconv.FormatInt(user.TokenBalance, 10)},
		{"邮箱验证", strconv.FormatBool(user.EmailVerified)},
		{"注册时间", user.CreatedAt.Format("2006-01-02 15:04:05")},
	}

	if user.LastLoginAt != nil {
		userData = append(userData, []string{"最后登录", user.LastLoginAt.Format("2006-01-02 15:04:05")})
	}

	// 写入CSV
	for _, row := range userData {
		csvContent.WriteString(fmt.Sprintf("\"%s\",\"%s\"\n", row[0], row[1]))
	}

	// 生成文件名
	filename := fmt.Sprintf("用户数据_%s_%s.csv", user.Email, time.Now().Format("20060102_150405"))

	// 设置响应头
	c.Header("Content-Type", "text/csv")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", filename))

	// 输出文件
	c.String(200, csvContent.String())
}

// ExportTaskRecords 导出任务记录
func (s *ExcelService) ExportTaskRecords(c *gin.Context) {
	userID := c.GetUint("user_id")
	taskType := c.Query("type") // batch, siterank, chengelink

	var tasks []BatchTask
	query := s.db.Where("user_id = ?", userID)

	if taskType != "" {
		query = query.Where("mode = ?", taskType)
	}

	if err := query.Order("created_at DESC").Find(&tasks).Error; err != nil {
		response.Error(c, 5001, "查询任务失败")
		return
	}

	// 创建CSV内容
	var csvContent strings.Builder
	csvContent.WriteString("任务ID,任务名称,模式,状态,URL总数,创建时间\n")

	// 填充数据
	for _, task := range tasks {
		row := fmt.Sprintf("\"%s\",\"%s\",\"%s\",\"%s\",%d,\"%s\"\n",
			task.ID,
			task.Name,
			task.Mode,
			task.Status,
			task.URLCount,
			task.CreatedAt.Format("2006-01-02 15:04:05"),
		)
		csvContent.WriteString(row)
	}

	// 生成文件名
	filename := fmt.Sprintf("任务记录_%s_%s.csv", taskType, time.Now().Format("20060102_150405"))

	// 设置响应头
	c.Header("Content-Type", "text/csv")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", filename))

	// 输出文件
	c.String(200, csvContent.String())
}

// ExportTokenTransactions 导出Token交易记录
func (s *ExcelService) ExportTokenTransactions(c *gin.Context) {
	userID := c.GetUint("user_id")

	var transactions []TokenTransaction
	if err := s.db.Where("user_id = ?", userID).Order("created_at DESC").Find(&transactions).Error; err != nil {
		response.Error(c, 5001, "查询交易记录失败")
		return
	}

	// 创建CSV内容
	var csvContent strings.Builder
	csvContent.WriteString("交易ID,变动金额,变动后余额,交易类型,关联ID,交易时间\n")

	// 填充数据
	for _, tx := range transactions {
		row := fmt.Sprintf("\"%s\",%d,%d,\"%s\",\"%s\",\"%s\"\n",
			tx.ID,
			tx.Amount,
			tx.Balance,
			tx.Type,
			tx.Reference,
			tx.CreatedAt.Format("2006-01-02 15:04:05"),
		)
		csvContent.WriteString(row)
	}

	// 生成文件名
	filename := fmt.Sprintf("Token交易记录_%s.csv", time.Now().Format("20060102_150405"))

	// 设置响应头
	c.Header("Content-Type", "text/csv")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", filename))

	// 输出文件
	c.String(200, csvContent.String())
}

// ExportSiteRankQueries 导出网站排名查询记录
func (s *ExcelService) ExportSiteRankQueries(c *gin.Context) {
	userID := c.GetUint("user_id")

	var queries []SiteRankQuery
	if err := s.db.Where("user_id = ?", userID).Order("created_at DESC").Find(&queries).Error; err != nil {
		response.Error(c, 5001, "查询记录失败")
		return
	}

	// 创建CSV内容
	var csvContent strings.Builder
	csvContent.WriteString("查询ID,URL,指标,状态,创建时间\n")

	// 填充数据
	for _, query := range queries {
		row := fmt.Sprintf("\"%s\",\"%s\",\"%s\",\"%s\",\"%s\"\n",
			query.ID,
			query.URL,
			query.Metrics,
			query.Status,
			query.CreatedAt.Format("2006-01-02 15:04:05"),
		)
		csvContent.WriteString(row)
	}

	// 生成文件名
	filename := fmt.Sprintf("网站排名查询_%s.csv", time.Now().Format("20060102_150405"))

	// 设置响应头
	c.Header("Content-Type", "text/csv")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", filename))

	// 输出文件
	c.String(200, csvContent.String())
}

// formatTime 格式化时间
func formatTime(t *time.Time) string {
	if t == nil {
		return ""
	}
	return t.Format("2006-01-02 15:04:05")
}

// getStatusText 获取状态文本
func getStatusText(status string) string {
	switch status {
	case "ACTIVE":
		return "正常"
	case "INACTIVE":
		return "禁用"
	case "PENDING":
		return "待激活"
	default:
		return status
	}
}