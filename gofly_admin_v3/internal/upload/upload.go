package upload

import (
	"context"
	"crypto/md5"
	"encoding/hex"
	"errors"
	"fmt"
	"image"
	"image/jpeg"
	"image/png"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gofly-admin-v3/internal/validator"
	"gofly-admin-v3/utils/gf"
)

// FileType 文件类型
type FileType string

const (
	FileTypeImage FileType = "image"
	FileTypeDoc   FileType = "document"
	FileTypeVideo FileType = "video"
	FileTypeAudio FileType = "audio"
	FileTypeOther FileType = "other"
)

// FileConfig 文件配置
type FileConfig struct {
	UploadPath   string            `yaml:"upload_path"`
	MaxFileSize  int64             `yaml:"max_size"`
	AllowedTypes map[FileType]bool `yaml:"allowed_types"`
	ImageTypes   []string          `yaml:"image_types"`
	DocTypes     []string          `yaml:"doc_types"`
	VideoTypes   []string          `yaml:"video_types"`
	AudioTypes   []string          `yaml:"audio_types"`
	EnableThumb  bool              `yaml:"enable_thumbnail"`
	ThumbWidth   int               `yaml:"thumb_width"`
	ThumbHeight  int               `yaml:"thumb_height"`
	EnableCDN    bool              `yaml:"enable_cdn"`
	CDNDomain    string            `yaml:"cdn_domain"`
}

// FileInfo 文件信息
type FileInfo struct {
	ID           string    `json:"id"`
	OriginalName string    `json:"original_name"`
	Filename     string    `json:"filename"`
	Path         string    `json:"path"`
	URL          string    `json:"url"`
	ThumbPath    string    `json:"thumb_path,omitempty"`
	ThumbURL     string    `json:"thumb_url,omitempty"`
	Size         int64     `json:"size"`
	Type         FileType  `json:"type"`
	MimeType     string    `json:"mime_type"`
	MD5          string    `json:"md5"`
	UploadedBy   string    `json:"uploaded_by"`
	CreatedAt    time.Time `json:"created_at"`
}

// UploadService 上传服务
type UploadService struct {
	config *FileConfig
}

var (
	defaultUploadService *UploadService
	uploadInit           bool
)

// NewUploadService 创建上传服务
func NewUploadService(cfg *FileConfig) *UploadService {
	return &UploadService{
		config: cfg,
	}
}

// GetUploadService 获取上传服务
func GetUploadService() *UploadService {
	if !uploadInit {
		// 从配置文件获取上传配置
		cfg := &FileConfig{
			UploadPath:  "./uploads",
			MaxFileSize: 10 * 1024 * 1024, // 10MB
			AllowedTypes: map[FileType]bool{
				FileTypeImage: true,
				FileTypeDoc:   true,
			},
			ImageTypes:  []string{".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp"},
			DocTypes:    []string{".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt"},
			EnableThumb: true,
			ThumbWidth:  200,
			ThumbHeight: 200,
		}

		defaultUploadService = NewUploadService(cfg)
		uploadInit = true

		// 确保上传目录存在
		if err := os.MkdirAll(cfg.UploadPath, 0755); err != nil {
			gf.Log().Error(context.Background(), fmt.Sprintf("Failed to create upload directory: %v", err))
		}
	}
	return defaultUploadService
}

// UploadFile 上传文件
func (us *UploadService) UploadFile(file *multipart.FileHeader, userID string) (*FileInfo, error) {
	// 验证文件大小
	if file.Size > us.config.MaxFileSize {
		return nil, errors.New("file size exceeds limit")
	}

	// 获取文件扩展名
	ext := strings.ToLower(filepath.Ext(file.Filename))

	// 验证文件类型
	fileType, err := us.getFileType(ext, file.Header.Get("Content-Type"))
	if err != nil {
		return nil, err
	}

	if !us.config.AllowedTypes[fileType] {
		return nil, errors.New("file type not allowed")
	}

	// 生成文件名
	filename := us.generateFilename(file.Filename, ext)

	// 创建目录路径
	datePath := time.Now().Format("2006/01/02")
	fullDir := filepath.Join(us.config.UploadPath, datePath)
	if err := os.MkdirAll(fullDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create directory: %v", err)
	}

	// 完整文件路径
	fullPath := filepath.Join(fullDir, filename)

	// 打开文件
	src, err := file.Open()
	if err != nil {
		return nil, fmt.Errorf("failed to open file: %v", err)
	}
	defer src.Close()

	// 计算MD5
	hash := md5.New()
	if _, err := io.Copy(hash, src); err != nil {
		return nil, fmt.Errorf("failed to calculate md5: %v", err)
	}
	md5sum := hex.EncodeToString(hash.Sum(nil))

	// 重置文件指针
	if _, err := src.Seek(0, 0); err != nil {
		return nil, fmt.Errorf("failed to seek file: %v", err)
	}

	// 创建目标文件
	dst, err := os.Create(fullPath)
	if err != nil {
		return nil, fmt.Errorf("failed to create file: %v", err)
	}
	defer dst.Close()

	// 复制文件
	if _, err := io.Copy(dst, src); err != nil {
		return nil, fmt.Errorf("failed to save file: %v", err)
	}

	// 构建文件信息
	fileInfo := &FileInfo{
        ID:           gf.UUID(),
		OriginalName: file.Filename,
		Filename:     filename,
		Path:         filepath.Join(datePath, filename),
		Size:         file.Size,
		Type:         fileType,
		MimeType:     file.Header.Get("Content-Type"),
		MD5:          md5sum,
		UploadedBy:   userID,
		CreatedAt:    time.Now(),
	}

	// 生成URL
	fileInfo.URL = us.getFileURL(fileInfo.Path)

	// 如果是图片且需要缩略图
	if fileType == FileTypeImage && us.config.EnableThumb {
		thumbPath, err := us.generateThumbnail(fullPath, filename, datePath)
		if err == nil {
			fileInfo.ThumbPath = thumbPath
			fileInfo.ThumbURL = us.getFileURL(thumbPath)
		}
	}

	return fileInfo, nil
}

// UploadFiles 批量上传文件
func (us *UploadService) UploadFiles(files []*multipart.FileHeader, userID string) ([]*FileInfo, error) {
	var fileInfos []*FileInfo
	var errors []error

	for _, file := range files {
		fileInfo, err := us.UploadFile(file, userID)
		if err != nil {
			errors = append(errors, fmt.Errorf("upload %s failed: %v", file.Filename, err))
			continue
		}
		fileInfos = append(fileInfos, fileInfo)
	}

	if len(fileInfos) == 0 {
		return nil, fmt.Errorf("all files upload failed: %v", errors)
	}

	if len(errors) > 0 {
		return fileInfos, fmt.Errorf("some files upload failed: %v", errors)
	}

	return fileInfos, nil
}

// DeleteFile 删除文件
func (us *UploadService) DeleteFile(fileID string) error {
	// TODO: 从数据库获取文件信息
	// 这里简化处理，需要先查询文件信息

	// fileInfo := getFileFromDB(fileID)
	// if fileInfo == nil {
	//     return errors.New("file not found")
	// }

	// // 删除文件
	// if err := os.Remove(filepath.Join(us.config.UploadPath, fileInfo.Path)); err != nil {
	//     return err
	// }

	// // 删除缩略图
	// if fileInfo.ThumbPath != "" {
	//     os.Remove(filepath.Join(us.config.UploadPath, fileInfo.ThumbPath))
	// }

	return nil
}

// getFileType 获取文件类型
func (us *UploadService) getFileType(ext, mimeType string) (FileType, error) {
	switch {
	case contains(us.config.ImageTypes, ext) || strings.HasPrefix(mimeType, "image/"):
		return FileTypeImage, nil
	case contains(us.config.DocTypes, ext) || strings.Contains(mimeType, "document") || strings.Contains(mimeType, "text"):
		return FileTypeDoc, nil
	case contains(us.config.VideoTypes, ext) || strings.HasPrefix(mimeType, "video/"):
		return FileTypeVideo, nil
	case contains(us.config.AudioTypes, ext) || strings.HasPrefix(mimeType, "audio/"):
		return FileTypeAudio, nil
	default:
		return FileTypeOther, nil
	}
}

// generateFilename 生成文件名
func (us *UploadService) generateFilename(originalName, ext string) string {
	name := strings.TrimSuffix(originalName, ext)
	// 清理文件名
	name = strings.ReplaceAll(name, " ", "_")
	name = strings.ReplaceAll(name, ".", "_")

	// 生成唯一文件名
	uuid := uuid.New().String()
	return fmt.Sprintf("%s_%s%s", name, uuid[:8], ext)
}

// getFileURL 获取文件URL
func (us *UploadService) getFileURL(path string) string {
	if us.config.EnableCDN && us.config.CDNDomain != "" {
		return fmt.Sprintf("%s/%s", strings.TrimSuffix(us.config.CDNDomain, "/"), path)
	}
	return fmt.Sprintf("/uploads/%s", path)
}

// generateThumbnail 生成缩略图
func (us *UploadService) generateThumbnail(imagePath, filename, datePath string) (string, error) {
	// 打开图片文件
	file, err := os.Open(imagePath)
	if err != nil {
		return "", err
	}
	defer file.Close()

	// 解码图片
	img, _, err := image.Decode(file)
	if err != nil {
		return "", err
	}

	// 创建缩略图目录
	thumbDir := filepath.Join(us.config.UploadPath, datePath, "thumbs")
	if err := os.MkdirAll(thumbDir, 0755); err != nil {
		return "", err
	}

	// 缩放图片
	thumb := us.resizeImage(img, us.config.ThumbWidth, us.config.ThumbHeight)

	// 保存缩略图
	thumbPath := filepath.Join(thumbDir, filename)
	thumbFile, err := os.Create(thumbPath)
	if err != nil {
		return "", err
	}
	defer thumbFile.Close()

	// 根据格式保存
	ext := strings.ToLower(filepath.Ext(filename))
	switch ext {
	case ".jpg", ".jpeg":
		err = jpeg.Encode(thumbFile, thumb, &jpeg.Options{Quality: 85})
	case ".png":
		err = png.Encode(thumbFile, thumb)
	default:
		err = jpeg.Encode(thumbFile, thumb, &jpeg.Options{Quality: 85})
	}

	if err != nil {
		return "", err
	}

	return filepath.Join(datePath, "thumbs", filename), nil
}

// resizeImage 缩放图片
func (us *UploadService) resizeImage(img image.Image, width, height int) image.Image {
	// 计算缩放比例
	srcBounds := img.Bounds()
	srcW := srcBounds.Dx()
	srcH := srcBounds.Dy()

	dstW, dstH := width, height
	if srcW > srcH {
		dstH = int(float64(height) * float64(srcH) / float64(srcW))
	} else {
		dstW = int(float64(width) * float64(srcW) / float64(srcH))
	}

	// 创建目标图片
	dst := image.NewRGBA(image.Rect(0, 0, dstW, dstH))

	// 缩放（简单的最近邻插值）
	for y := 0; y < dstH; y++ {
		for x := 0; x < dstW; x++ {
			srcX := x * srcW / dstW
			srcY := y * srcH / dstH
			dst.Set(x, y, img.At(srcX, srcY))
		}
	}

	return dst
}

// contains 检查字符串是否在切片中
func contains(slice []string, item string) bool {
	for _, s := range slice {
		if s == item {
			return true
		}
	}
	return false
}

// UploadMiddleware 上传中间件
func UploadMiddleware(fieldName string, maxFiles int) gin.HandlerFunc {
	us := GetUploadService()

	return func(c *gin.Context) {
		// 解析 multipart 表单
		if err := c.Request.ParseMultipartForm(us.config.MaxFileSize * 2); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"code":    400,
				"message": "Failed to parse multipart form",
				"error":   err.Error(),
			})
			c.Abort()
			return
		}

		// 获取文件
		files := c.Request.MultipartForm.File[fieldName]
		if len(files) == 0 {
			c.JSON(http.StatusBadRequest, gin.H{
				"code":    400,
				"message": "No files uploaded",
			})
			c.Abort()
			return
		}

		// 检查文件数量
		if maxFiles > 0 && len(files) > maxFiles {
			c.JSON(http.StatusBadRequest, gin.H{
				"code":    400,
				"message": fmt.Sprintf("Too many files, maximum %d allowed", maxFiles),
			})
			c.Abort()
			return
		}

		// 将文件存入上下文
		c.Set("upload_files", files)
		c.Next()
	}
}

// HandleUpload 处理上传的便捷函数
func HandleUpload(c *gin.Context, fieldName string, maxFiles int) ([]*FileInfo, error) {
	// 获取用户ID
	userID, _ := c.Get("user_id")
	if userID == nil {
		return nil, errors.New("user not authenticated")
	}

	// 获取文件
	files, exists := c.Get("upload_files")
	if !exists {
		return nil, errors.New("no files found in context")
	}

	// 上传文件
	us := GetUploadService()
	return us.UploadFiles(files.([]*multipart.FileHeader), userID.(string))
}

// ValidateFileType 验证文件类型
func ValidateFileType(allowedTypes []FileType) validator.ValidationRule {
	return validator.Custom("invalid file type", func(value interface{}, params []string) bool {
		fileHeader, ok := value.(*multipart.FileHeader)
		if !ok {
			return false
		}

		us := GetUploadService()
		ext := strings.ToLower(filepath.Ext(fileHeader.Filename))
		fileType, err := us.getFileType(ext, fileHeader.Header.Get("Content-Type"))
		if err != nil {
			return false
		}

		for _, allowedType := range allowedTypes {
			if fileType == allowedType {
				return true
			}
		}

		return false
	})
}

// ServeFile 提供文件服务
func ServeFile(c *gin.Context) {
	us := GetUploadService()

	// 获取文件路径
	filePath := c.Param("filepath")
	if filePath == "" {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": "File not found"})
		return
	}

	// 构建完整路径
	fullPath := filepath.Join(us.config.UploadPath, filePath)

	// 检查文件是否存在
	if _, err := os.Stat(fullPath); os.IsNotExist(err) {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": "File not found"})
		return
	}

	// 设置正确的Content-Type
	ext := strings.ToLower(filepath.Ext(filePath))
	switch ext {
	case ".jpg", ".jpeg":
		c.Header("Content-Type", "image/jpeg")
	case ".png":
		c.Header("Content-Type", "image/png")
	case ".gif":
		c.Header("Content-Type", "image/gif")
	case ".pdf":
		c.Header("Content-Type", "application/pdf")
	case ".txt":
		c.Header("Content-Type", "text/plain")
	default:
		c.Header("Content-Type", "application/octet-stream")
	}

	// 提供文件
	c.File(fullPath)
}
