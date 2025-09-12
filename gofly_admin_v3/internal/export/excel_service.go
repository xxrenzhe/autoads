package export

import (
	"fmt"
	"reflect"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	// "github.com/xuri/excelize/v2"
	"gofly-admin-v3/internal/models"
	"gofly-admin-v3/internal/response"
	"gorm.io/gorm"
)

// ExcelService Excel导出服务
type ExcelService struct {
	db *gorm.DB
}

// NewExcelService 创建Excel导出服务
func NewExcelService(db *gorm.DB) *ExcelService {
	return &ExcelService{db: db}
}

// ExportUserData 导出用户数据
func (s *ExcelService) ExportUserData(c *gin.Context) {
	userID := c.GetUint("user_id")

	// 获取用户信息
	var user models.User
	if err := s.db.Where("id = ?", userID).First(&user).Error; err != nil {
		response.Error(c, 5001, "用户不存在")
		return
	}

	// 创建Excel文件
	f := excelize.NewFile()
	defer f.Close()

	// 设置工作表名称
	sheetName := "用户数据"
	f.SetSheetName("Sheet1", sheetName)

	// 设置表头
	headers := []string{"字段", "值"}
	for i, header := range headers {
		cell := fmt.Sprintf("%c1", 'A'+i)
		f.SetCellValue(sheetName, cell, header)
	}

	// 用户数据
	userData := [][]interface{}{
		{"用户ID", user.ID},
		{"邮箱", user.Email},
		{"姓名", user.Name},
		{"角色", user.Role},
		{"Token余额", user.TokenBalance},
		{"套餐", user.Plan},
		{"套餐到期时间", formatTime(user.PlanExpires)},
		{"邀请码", user.InviteCode},
		{"注册时间", user.CreatedAt.Format("2006-01-02 15:04:05")},
		{"最后登录", formatTime(user.LastLogin)},
		{"状态", getStatusText(user.Status)},
	}

	// 填充数据
	for i, row := range userData {
		rowNum := i + 2
		for j, value := range row {
			cell := fmt.Sprintf("%c%d", 'A'+j, rowNum)
			f.SetCellValue(sheetName, cell, value)
		}
	}

	// 设置样式
	s.setExcelStyle(f, sheetName, len(userData)+1)

	// 生成文件名
	filename := fmt.Sprintf("用户数据_%s_%s.xlsx", user.Email, time.Now().Format("20060102_150405"))

	// 设置响应头
	c.Header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", filename))

	// 输出文件
	if err := f.Write(c.Writer); err != nil {
		response.Error(c, 5002, "导出失败")
		return
	}
}

// ExportTaskRecords 导出任务记录
func (s *ExcelService) ExportTaskRecords(c *gin.Context) {
	userID := c.GetUint("user_id")
	taskType := c.Query("type") // batch, siterank, chengelink

	var tasks []models.BatchTask
	query := s.db.Where("user_id = ?", userID)

	if taskType != "" {
		query = query.Where("type = ?", taskType)
	}

	if err := query.Order("created_at DESC").Find(&tasks).Error; err != nil {
		response.Error(c, 5001, "查询任务失败")
		return
	}

	// 创建Excel文件
	f := excelize.NewFile()
	defer f.Close()

	sheetName := "任务记录"
	f.SetSheetName("Sheet1", sheetName)

	// 设置表头
	headers := []string{
		"任务ID", "任务名称", "任务类型", "状态", "总URL数",
		"成功数", "失败数", "开始时间", "结束时间", "耗时(秒)", "创建时间",
	}

	for i, header := range headers {
		cell := fmt.Sprintf("%c1", 'A'+i)
		f.SetCellValue(sheetName, cell, header)
	}

	// 填充数据
	for i, task := range tasks {
		rowNum := i + 2
		duration := ""
		if task.DurationMs > 0 {
			duration = fmt.Sprintf("%.2f", float64(task.DurationMs)/1000)
		}

		row := []interface{}{
			task.ID,
			task.Name,
			task.Type,
			task.Status,
			task.TotalURLs,
			task.SuccessCount,
			task.FailCount,
			formatTime(task.StartTime),
			formatTime(task.EndTime),
			duration,
			task.CreatedAt.Format("2006-01-02 15:04:05"),
		}

		for j, value := range row {
			cell := fmt.Sprintf("%c%d", 'A'+j, rowNum)
			f.SetCellValue(sheetName, cell, value)
		}
	}

	// 设置样式
	s.setExcelStyle(f, sheetName, len(tasks)+1)

	// 生成文件名
	filename := fmt.Sprintf("任务记录_%s_%s.xlsx", taskType, time.Now().Format("20060102_150405"))

	// 设置响应头
	c.Header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", filename))

	// 输出文件
	if err := f.Write(c.Writer); err != nil {
		response.Error(c, 5002, "导出失败")
		return
	}
}

// ExportTokenTransactions 导出Token交易记录
func (s *ExcelService) ExportTokenTransactions(c *gin.Context) {
	userID := c.GetUint("user_id")

	var transactions []models.TokenTransaction
	if err := s.db.Where("user_id = ?", userID).Order("created_at DESC").Find(&transactions).Error; err != nil {
		response.Error(c, 5001, "查询交易记录失败")
		return
	}

	// 创建Excel文件
	f := excelize.NewFile()
	defer f.Close()

	sheetName := "Token交易记录"
	f.SetSheetName("Sheet1", sheetName)

	// 设置表头
	headers := []string{
		"交易ID", "变动金额", "变动后余额", "交易类型", "描述", "交易时间",
	}

	for i, header := range headers {
		cell := fmt.Sprintf("%c1", 'A'+i)
		f.SetCellValue(sheetName, cell, header)
	}

	// 填充数据
	for i, tx := range transactions {
		rowNum := i + 2

		row := []interface{}{
			tx.ID,
			tx.Amount,
			tx.Balance,
			tx.Type,
			tx.Description,
			tx.CreatedAt.Format("2006-01-02 15:04:05"),
		}

		for j, value := range row {
			cell := fmt.Sprintf("%c%d", 'A'+j, rowNum)
			f.SetCellValue(sheetName, cell, value)
		}
	}

	// 设置样式
	s.setExcelStyle(f, sheetName, len(transactions)+1)

	// 生成文件名
	filename := fmt.Sprintf("Token交易记录_%s.xlsx", time.Now().Format("20060102_150405"))

	// 设置响应头
	c.Header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", filename))

	// 输出文件
	if err := f.Write(c.Writer); err != nil {
		response.Error(c, 5002, "导出失败")
		return
	}
}

// ExportSiteRankQueries 导出SiteRank查询记录
func (s *ExcelService) ExportSiteRankQueries(c *gin.Context) {
	userID := c.GetUint("user_id")

	var queries []models.SiteRankQuery
	if err := s.db.Where("user_id = ?", userID).Order("created_at DESC").Find(&queries).Error; err != nil {
		response.Error(c, 5001, "查询SiteRank记录失败")
		return
	}

	// 创建Excel文件
	f := excelize.NewFile()
	defer f.Close()

	sheetName := "SiteRank查询记录"
	f.SetSheetName("Sheet1", sheetName)

	// 设置表头
	headers := []string{
		"查询ID", "域名", "状态", "全球排名", "分类排名", "分类",
		"访问量", "跳出率", "页面/访问", "平均时长", "优先级", "查询时间",
	}

	for i, header := range headers {
		cell := fmt.Sprintf("%c1", 'A'+i)
		f.SetCellValue(sheetName, cell, header)
	}

	// 填充数据
	for i, query := range queries {
		rowNum := i + 2

		row := []interface{}{
			query.ID,
			query.Domain,
			query.Status,
			formatInt(query.GlobalRank),
			formatInt(query.CategoryRank),
			query.Category,
			formatFloat(query.Visits),
			formatFloat(query.BounceRate),
			formatFloat(query.PagesPerVisit),
			formatFloat(query.AvgDuration),
			query.Priority,
			query.CreatedAt.Format("2006-01-02 15:04:05"),
		}

		for j, value := range row {
			cell := fmt.Sprintf("%c%d", 'A'+j, rowNum)
			f.SetCellValue(sheetName, cell, value)
		}
	}

	// 设置样式
	s.setExcelStyle(f, sheetName, len(queries)+1)

	// 生成文件名
	filename := fmt.Sprintf("SiteRank查询记录_%s.xlsx", time.Now().Format("20060102_150405"))

	// 设置响应头
	c.Header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", filename))

	// 输出文件
	if err := f.Write(c.Writer); err != nil {
		response.Error(c, 5002, "导出失败")
		return
	}
}

// setExcelStyle 设置Excel样式
func (s *ExcelService) setExcelStyle(f *excelize.File, sheetName string, rows int) {
	// 设置表头样式
	headerStyle, _ := f.NewStyle(&excelize.Style{
		Font: &excelize.Font{
			Bold: true,
			Size: 12,
		},
		Fill: excelize.Fill{
			Type:    "pattern",
			Color:   []string{"#E6E6FA"},
			Pattern: 1,
		},
		Alignment: &excelize.Alignment{
			Horizontal: "center",
			Vertical:   "center",
		},
		Border: []excelize.Border{
			{Type: "left", Color: "000000", Style: 1},
			{Type: "top", Color: "000000", Style: 1},
			{Type: "bottom", Color: "000000", Style: 1},
			{Type: "right", Color: "000000", Style: 1},
		},
	})

	// 应用表头样式
	f.SetRowStyle(sheetName, 1, 1, headerStyle)

	// 设置数据样式
	dataStyle, _ := f.NewStyle(&excelize.Style{
		Border: []excelize.Border{
			{Type: "left", Color: "000000", Style: 1},
			{Type: "top", Color: "000000", Style: 1},
			{Type: "bottom", Color: "000000", Style: 1},
			{Type: "right", Color: "000000", Style: 1},
		},
	})

	// 应用数据样式
	if rows > 1 {
		f.SetRowStyle(sheetName, 2, rows, dataStyle)
	}

	// 自动调整列宽
	cols, _ := f.GetCols(sheetName)
	for i, col := range cols {
		maxWidth := 10.0
		for _, cell := range col {
			if width := float64(len(cell)) * 1.2; width > maxWidth {
				maxWidth = width
			}
		}
		if maxWidth > 50 {
			maxWidth = 50
		}
		colName := fmt.Sprintf("%c", 'A'+i)
		f.SetColWidth(sheetName, colName, colName, maxWidth)
	}
}

// 辅助函数
func formatTime(t *time.Time) string {
	if t == nil {
		return ""
	}
	return t.Format("2006-01-02 15:04:05")
}

func formatInt(i *int) string {
	if i == nil {
		return ""
	}
	return strconv.Itoa(*i)
}

func formatFloat(f *float64) string {
	if f == nil {
		return ""
	}
	return fmt.Sprintf("%.2f", *f)
}

func getStatusText(status int) string {
	switch status {
	case 1:
		return "正常"
	case 0:
		return "禁用"
	default:
		return "未知"
	}
}

// RegisterExportRoutes 注册导出路由
func RegisterExportRoutes(r *gin.RouterGroup, db *gorm.DB) {
	service := NewExcelService(db)

	export := r.Group("/export")
	{
		export.GET("/user-data", service.ExportUserData)
		export.GET("/task-records", service.ExportTaskRecords)
		export.GET("/token-transactions", service.ExportTokenTransactions)
		export.GET("/siterank-queries", service.ExportSiteRankQueries)
	}
}
