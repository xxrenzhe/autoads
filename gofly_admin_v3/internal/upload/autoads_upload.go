package upload

import (
	"encoding/json"
	"fmt"
	"image"
	"image/jpeg"
	"image/png"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"gofly-admin-v3/internal/audit"
)

// AutoAdsUploadService AutoAds专用上传服务扩展
type AutoAdsUploadService struct {
	*UploadService
	auditService *audit.AuditService
}

// NewAutoAdsUploadService 创建AutoAds上传服务
func NewAutoAdsUploadService(baseService *UploadService, auditService *audit.AuditService) *AutoAdsUploadService {
	return &AutoAdsUploadService{
		UploadService: baseService,
		auditService:  auditService,
	}
}

// UploadUserAvatar 上传用户头像（带审计日志）
func (aus *AutoAdsUploadService) UploadUserAvatar(c *gin.Context, userID string) (*FileInfo, error) {
	// 获取上传的文件
	file, err := c.FormFile("avatar")
	if err != nil {
		aus.auditService.LogUserAction(
			userID, audit.ActionUpdateProfile, "avatar", "",
			map[string]interface{}{"error": "no file uploaded"},
			c.ClientIP(), c.GetHeader("User-Agent"), false, err.Error(), 0,
		)
		return nil, fmt.Errorf("no avatar file uploaded: %w", err)
	}

	// 验证文件类型（只允许图片）
	if !aus.isImageFile(file.Filename) {
		aus.auditService.LogUserAction(
			userID, audit.ActionUpdateProfile, "avatar", "",
			map[string]interface{}{"filename": file.Filename, "error": "invalid file type"},
			c.ClientIP(), c.GetHeader("User-Agent"), false, "invalid file type", 0,
		)
		return nil, fmt.Errorf("only image files are allowed for avatar")
	}

	start := time.Now()

	// 上传文件
	fileInfo, err := aus.UploadFile(file, userID)
	if err != nil {
		aus.auditService.LogUserAction(
			userID, audit.ActionUpdateProfile, "avatar", "",
			map[string]interface{}{"filename": file.Filename, "error": err.Error()},
			c.ClientIP(), c.GetHeader("User-Agent"), false, err.Error(), time.Since(start),
		)
		return nil, err
	}

	// 记录成功的审计日志
	aus.auditService.LogUserAction(
		userID, audit.ActionUpdateProfile, "avatar", fileInfo.ID,
		map[string]interface{}{
			"filename":  fileInfo.Filename,
			"size":      fileInfo.Size,
			"url":       fileInfo.URL,
			"thumb_url": fileInfo.ThumbURL,
		},
		c.ClientIP(), c.GetHeader("User-Agent"), true, "", time.Since(start),
	)

	return fileInfo, nil
}

// UploadTaskFiles 上传任务相关文件
func (aus *AutoAdsUploadService) UploadTaskFiles(c *gin.Context, userID, taskID string) ([]*FileInfo, error) {
	form, err := c.MultipartForm()
	if err != nil {
		return nil, fmt.Errorf("failed to parse multipart form: %w", err)
	}

	files := form.File["files"]
	if len(files) == 0 {
		return nil, fmt.Errorf("no files uploaded")
	}

	start := time.Now()
	var fileInfos []*FileInfo
	var errors []error

	for _, file := range files {
		fileInfo, err := aus.UploadFile(file, userID)
		if err != nil {
			errors = append(errors, fmt.Errorf("upload %s failed: %w", file.Filename, err))
			continue
		}
		fileInfos = append(fileInfos, fileInfo)
	}

	// 记录审计日志
	aus.auditService.LogUserAction(
		userID, "upload_task_files", "task", taskID,
		map[string]interface{}{
			"uploaded_count": len(fileInfos),
			"failed_count":   len(errors),
			"total_size":     aus.calculateTotalSize(fileInfos),
		},
		c.ClientIP(), c.GetHeader("User-Agent"), len(fileInfos) > 0, "", time.Since(start),
	)

	if len(fileInfos) == 0 {
		return nil, fmt.Errorf("all files upload failed: %v", errors)
	}

	return fileInfos, nil
}

// GenerateAdvancedThumbnail 生成高级缩略图（多尺寸）
func (aus *AutoAdsUploadService) GenerateAdvancedThumbnail(imagePath, filename, datePath string) (map[string]string, error) {
	// 打开图片文件
	file, err := os.Open(imagePath)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	// 解码图片
	img, format, err := image.Decode(file)
	if err != nil {
		return nil, err
	}

	// 创建缩略图目录
	thumbDir := filepath.Join(aus.config.UploadPath, datePath, "thumbs")
	if err := os.MkdirAll(thumbDir, 0755); err != nil {
		return nil, err
	}

	thumbnails := make(map[string]string)

	// 生成多种尺寸的缩略图
	sizes := map[string][2]int{
		"small":  {64, 64},
		"medium": {128, 128},
		"large":  {256, 256},
	}

	for sizeName, dimensions := range sizes {
		width, height := dimensions[0], dimensions[1]

		// 缩放图片
		thumb := aus.resizeImageAdvanced(img, width, height)

		// 生成文件名
		ext := filepath.Ext(filename)
		name := strings.TrimSuffix(filename, ext)
		thumbFilename := fmt.Sprintf("%s_%s%s", name, sizeName, ext)

		// 保存缩略图
		thumbPath := filepath.Join(thumbDir, thumbFilename)
		thumbFile, err := os.Create(thumbPath)
		if err != nil {
			continue
		}

		// 根据格式保存
		switch format {
		case "jpeg":
			err = jpeg.Encode(thumbFile, thumb, &jpeg.Options{Quality: 85})
		case "png":
			err = png.Encode(thumbFile, thumb)
		default:
			err = jpeg.Encode(thumbFile, thumb, &jpeg.Options{Quality: 85})
		}

		thumbFile.Close()

		if err == nil {
			thumbnails[sizeName] = filepath.Join(datePath, "thumbs", thumbFilename)
		}
	}

	return thumbnails, nil
}

// GetUploadStats 获取上传统计信息
func (aus *AutoAdsUploadService) GetUploadStats(userID string, days int) (map[string]interface{}, error) {
	// TODO: 实现从数据库获取统计信息
	// 这里返回模拟数据
	stats := map[string]interface{}{
		"total_files":    100,
		"total_size":     "500MB",
		"image_files":    80,
		"document_files": 20,
		"recent_uploads": 15,
		"storage_used":   "500MB",
		"storage_limit":  "2GB",
		"usage_percent":  25.0,
	}

	return stats, nil
}

// CleanupUserFiles 清理用户文件
func (aus *AutoAdsUploadService) CleanupUserFiles(userID string, olderThanDays int) error {
	// TODO: 实现文件清理逻辑
	// 1. 查询用户的旧文件
	// 2. 删除物理文件
	// 3. 删除数据库记录
	// 4. 记录审计日志

	aus.auditService.LogUserAction(
		userID, "cleanup_files", "files", "",
		map[string]interface{}{
			"older_than_days": olderThanDays,
			"cleaned_count":   0, // TODO: 实际清理数量
		},
		"", "", true, "", 0,
	)

	return nil
}

// ValidateFileContent 验证文件内容安全性
func (aus *AutoAdsUploadService) ValidateFileContent(filePath string) error {
	// TODO: 实现文件内容安全检查
	// 1. 病毒扫描
	// 2. 恶意代码检测
	// 3. 文件格式验证

	return nil
}

// GenerateFilePreview 生成文件预览
func (aus *AutoAdsUploadService) GenerateFilePreview(fileInfo *FileInfo) (string, error) {
	switch fileInfo.Type {
	case FileTypeImage:
		// 图片文件返回缩略图URL
		return fileInfo.ThumbURL, nil

	case FileTypeDoc:
		// 文档文件生成预览图
		return aus.generateDocumentPreview(fileInfo)

	case FileTypeVideo:
		// 视频文件生成封面图
		return aus.generateVideoThumbnail(fileInfo)

	default:
		// 其他文件类型返回默认图标
		return aus.getDefaultFileIcon(fileInfo.Type), nil
	}
}

// ExportUserFiles 导出用户文件列表
func (aus *AutoAdsUploadService) ExportUserFiles(userID string) ([]byte, error) {
	// TODO: 从数据库获取用户文件列表
	files := []map[string]interface{}{
		{
			"filename":    "example.jpg",
			"size":        "1.2MB",
			"type":        "image",
			"upload_date": "2024-01-15",
			"url":         "/uploads/2024/01/15/example.jpg",
		},
	}

	// 转换为JSON
	data, err := json.MarshalIndent(files, "", "  ")
	if err != nil {
		return nil, err
	}

	// 记录审计日志
	aus.auditService.LogUserAction(
		userID, "export_files", "files", "",
		map[string]interface{}{
			"exported_count": len(files),
		},
		"", "", true, "", 0,
	)

	return data, nil
}

// 辅助方法

func (aus *AutoAdsUploadService) isImageFile(filename string) bool {
	ext := strings.ToLower(filepath.Ext(filename))
	imageExts := []string{".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp"}

	for _, imageExt := range imageExts {
		if ext == imageExt {
			return true
		}
	}
	return false
}

func (aus *AutoAdsUploadService) calculateTotalSize(fileInfos []*FileInfo) int64 {
	var total int64
	for _, fileInfo := range fileInfos {
		total += fileInfo.Size
	}
	return total
}

func (aus *AutoAdsUploadService) resizeImageAdvanced(img image.Image, width, height int) image.Image {
	// 使用更高质量的图片缩放算法
	// 这里简化实现，实际应用中可以使用第三方库如 imaging
	return aus.resizeImage(img, width, height)
}

func (aus *AutoAdsUploadService) generateDocumentPreview(fileInfo *FileInfo) (string, error) {
	// TODO: 实现文档预览生成
	// 可以使用 LibreOffice 或其他工具生成预览图
	return "/static/icons/document-preview.png", nil
}

func (aus *AutoAdsUploadService) generateVideoThumbnail(fileInfo *FileInfo) (string, error) {
	// TODO: 实现视频缩略图生成
	// 可以使用 FFmpeg 提取视频帧
	return "/static/icons/video-thumbnail.png", nil
}

func (aus *AutoAdsUploadService) getDefaultFileIcon(fileType FileType) string {
	icons := map[FileType]string{
		FileTypeDoc:   "/static/icons/document.png",
		FileTypeVideo: "/static/icons/video.png",
		FileTypeAudio: "/static/icons/audio.png",
		FileTypeOther: "/static/icons/file.png",
	}

	if icon, exists := icons[fileType]; exists {
		return icon
	}
	return "/static/icons/file.png"
}

// AutoAds专用上传中间件
func AutoAdsUploadMiddleware(auditService *audit.AuditService) gin.HandlerFunc {
	return func(c *gin.Context) {
		// 记录上传开始
		start := time.Now()
		userID, _ := c.Get("user_id")

		c.Next()

		// 记录上传结束
		duration := time.Since(start)
		status := c.Writer.Status()

		if userID != nil {
			auditService.LogUserAction(
				userID.(string), "file_upload", "upload", "",
				map[string]interface{}{
					"status":   status,
					"duration": duration.Milliseconds(),
					"path":     c.Request.URL.Path,
				},
				c.ClientIP(), c.GetHeader("User-Agent"), status < 400, "", duration,
			)
		}
	}
}
