package upload

import (
	"bytes"
	"fmt"
	"image"
	"image/jpeg"
	"image/png"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"gofly-admin-v3/internal/i18n"
	"gofly-admin-v3/internal/response"
)

// MediaProcessor 媒体处理器
type MediaProcessor struct {
	config *MediaConfig
}

// MediaConfig 媒体处理配置
type MediaConfig struct {
	EnableVideoThumbnail bool     `yaml:"enable_video_thumbnail"`
	EnableImageOptimize  bool     `yaml:"enable_image_optimize"`
	VideoThumbnailTime   string   `yaml:"video_thumbnail_time"` // 截取时间点，如 "00:00:01"
	ImageQuality         int      `yaml:"image_quality"`        // 图片质量 1-100
	MaxImageWidth        int      `yaml:"max_image_width"`      // 最大图片宽度
	MaxImageHeight       int      `yaml:"max_image_height"`     // 最大图片高度
	SupportedFormats     []string `yaml:"supported_formats"`    // 支持的格式
}

// ProcessedMedia 处理后的媒体信息
type ProcessedMedia struct {
	OriginalFile  *FileInfo `json:"original_file"`
	ThumbnailFile *FileInfo `json:"thumbnail_file,omitempty"`
	OptimizedFile *FileInfo `json:"optimized_file,omitempty"`
	ProcessLog    []string  `json:"process_log,omitempty"`
}

// NewMediaProcessor 创建媒体处理器
func NewMediaProcessor() *MediaProcessor {
	config := &MediaConfig{
		EnableVideoThumbnail: true,
		EnableImageOptimize:  true,
		VideoThumbnailTime:   "00:00:01",
		ImageQuality:         85,
		MaxImageWidth:        1920,
		MaxImageHeight:       1080,
		SupportedFormats:     []string{".mp4", ".avi", ".mov", ".mkv", ".jpg", ".jpeg", ".png", ".gif"},
	}

	return &MediaProcessor{
		config: config,
	}
}

// ProcessMedia 处理媒体文件
func (mp *MediaProcessor) ProcessMedia(fileInfo *FileInfo, uploadPath string) (*ProcessedMedia, error) {
	result := &ProcessedMedia{
		OriginalFile: fileInfo,
		ProcessLog:   []string{},
	}

	// 获取文件扩展名
	ext := strings.ToLower(filepath.Ext(fileInfo.Filename))

	// 根据文件类型进行处理
	switch fileInfo.Type {
	case FileTypeVideo:
		if mp.config.EnableVideoThumbnail {
			thumbnail, err := mp.generateVideoThumbnail(fileInfo, uploadPath)
			if err != nil {
				result.ProcessLog = append(result.ProcessLog, fmt.Sprintf("Video thumbnail generation failed: %v", err))
			} else {
				result.ThumbnailFile = thumbnail
				result.ProcessLog = append(result.ProcessLog, "Video thumbnail generated successfully")
			}
		}

	case FileTypeImage:
		if mp.config.EnableImageOptimize {
			optimized, err := mp.optimizeImage(fileInfo, uploadPath)
			if err != nil {
				result.ProcessLog = append(result.ProcessLog, fmt.Sprintf("Image optimization failed: %v", err))
			} else {
				result.OptimizedFile = optimized
				result.ProcessLog = append(result.ProcessLog, "Image optimized successfully")
			}
		}
	}

	return result, nil
}

// generateVideoThumbnail 生成视频缩略图
func (mp *MediaProcessor) generateVideoThumbnail(fileInfo *FileInfo, uploadPath string) (*FileInfo, error) {
	// 检查ffmpeg是否可用
	if !mp.isFFmpegAvailable() {
		return nil, fmt.Errorf("ffmpeg not available")
	}

	// 构建输入文件路径
	inputPath := filepath.Join(uploadPath, fileInfo.Path)

	// 构建输出文件路径
	outputDir := filepath.Dir(inputPath)
	outputFilename := strings.TrimSuffix(fileInfo.Filename, filepath.Ext(fileInfo.Filename)) + "_thumb.jpg"
	outputPath := filepath.Join(outputDir, outputFilename)

	// 执行ffmpeg命令生成缩略图
	cmd := exec.Command("ffmpeg",
		"-i", inputPath,
		"-ss", mp.config.VideoThumbnailTime,
		"-vframes", "1",
		"-f", "image2",
		"-y", // 覆盖输出文件
		outputPath,
	)

	var stderr bytes.Buffer
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		return nil, fmt.Errorf("ffmpeg error: %v, stderr: %s", err, stderr.String())
	}

	// 检查输出文件是否存在
	if _, err := os.Stat(outputPath); os.IsNotExist(err) {
		return nil, fmt.Errorf("thumbnail file not generated")
	}

	// 获取文件信息
	stat, err := os.Stat(outputPath)
	if err != nil {
		return nil, fmt.Errorf("failed to get thumbnail file info: %v", err)
	}

	// 构建缩略图文件信息
	thumbnailPath := filepath.Join(filepath.Dir(fileInfo.Path), outputFilename)
	thumbnailInfo := &FileInfo{
		ID:           generateFileID(),
		OriginalName: outputFilename,
		Filename:     outputFilename,
		Path:         thumbnailPath,
		URL:          fmt.Sprintf("/uploads/%s", thumbnailPath),
		Size:         stat.Size(),
		Type:         FileTypeImage,
		MimeType:     "image/jpeg",
		UploadedBy:   fileInfo.UploadedBy,
		CreatedAt:    fileInfo.CreatedAt,
	}

	return thumbnailInfo, nil
}

// optimizeImage 优化图片
func (mp *MediaProcessor) optimizeImage(fileInfo *FileInfo, uploadPath string) (*FileInfo, error) {
	// 构建输入文件路径
	inputPath := filepath.Join(uploadPath, fileInfo.Path)

	// 打开图片文件
	file, err := os.Open(inputPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open image: %v", err)
	}
	defer file.Close()

	// 解码图片
	img, format, err := image.Decode(file)
	if err != nil {
		return nil, fmt.Errorf("failed to decode image: %v", err)
	}

	// 检查是否需要缩放
	bounds := img.Bounds()
	width := bounds.Dx()
	height := bounds.Dy()

	needResize := width > mp.config.MaxImageWidth || height > mp.config.MaxImageHeight
	needCompress := mp.config.ImageQuality < 100

	if !needResize && !needCompress {
		// 不需要优化
		return fileInfo, nil
	}

	// 缩放图片
	if needResize {
		img = mp.resizeImageAdvanced(img, mp.config.MaxImageWidth, mp.config.MaxImageHeight)
	}

	// 构建输出文件路径
	outputDir := filepath.Dir(inputPath)
	outputFilename := strings.TrimSuffix(fileInfo.Filename, filepath.Ext(fileInfo.Filename)) + "_optimized" + filepath.Ext(fileInfo.Filename)
	outputPath := filepath.Join(outputDir, outputFilename)

	// 创建输出文件
	outputFile, err := os.Create(outputPath)
	if err != nil {
		return nil, fmt.Errorf("failed to create optimized file: %v", err)
	}
	defer outputFile.Close()

	// 编码并保存
	switch strings.ToLower(format) {
	case "jpeg", "jpg":
		err = jpeg.Encode(outputFile, img, &jpeg.Options{Quality: mp.config.ImageQuality})
	case "png":
		err = png.Encode(outputFile, img)
	default:
		// 默认使用JPEG格式
		err = jpeg.Encode(outputFile, img, &jpeg.Options{Quality: mp.config.ImageQuality})
	}

	if err != nil {
		return nil, fmt.Errorf("failed to encode optimized image: %v", err)
	}

	// 获取优化后文件信息
	stat, err := os.Stat(outputPath)
	if err != nil {
		return nil, fmt.Errorf("failed to get optimized file info: %v", err)
	}

	// 构建优化后文件信息
	optimizedPath := filepath.Join(filepath.Dir(fileInfo.Path), outputFilename)
	optimizedInfo := &FileInfo{
		ID:           generateFileID(),
		OriginalName: outputFilename,
		Filename:     outputFilename,
		Path:         optimizedPath,
		URL:          fmt.Sprintf("/uploads/%s", optimizedPath),
		Size:         stat.Size(),
		Type:         FileTypeImage,
		MimeType:     fileInfo.MimeType,
		UploadedBy:   fileInfo.UploadedBy,
		CreatedAt:    fileInfo.CreatedAt,
	}

	return optimizedInfo, nil
}

// resizeImageAdvanced 高级图片缩放
func (mp *MediaProcessor) resizeImageAdvanced(img image.Image, maxWidth, maxHeight int) image.Image {
	bounds := img.Bounds()
	srcWidth := bounds.Dx()
	srcHeight := bounds.Dy()

	// 计算缩放比例
	scaleX := float64(maxWidth) / float64(srcWidth)
	scaleY := float64(maxHeight) / float64(srcHeight)
	scale := scaleX
	if scaleY < scaleX {
		scale = scaleY
	}

	// 如果不需要缩放
	if scale >= 1.0 {
		return img
	}

	// 计算新尺寸
	newWidth := int(float64(srcWidth) * scale)
	newHeight := int(float64(srcHeight) * scale)

	// 创建新图片
	dst := image.NewRGBA(image.Rect(0, 0, newWidth, newHeight))

	// 双线性插值缩放
	for y := 0; y < newHeight; y++ {
		for x := 0; x < newWidth; x++ {
			srcX := float64(x) / scale
			srcY := float64(y) / scale

			// 获取源像素
			color := img.At(int(srcX), int(srcY))
			dst.Set(x, y, color)
		}
	}

	return dst
}

// isFFmpegAvailable 检查ffmpeg是否可用
func (mp *MediaProcessor) isFFmpegAvailable() bool {
	cmd := exec.Command("ffmpeg", "-version")
	return cmd.Run() == nil
}

// generateFileID 生成文件ID
func generateFileID() string {
	return fmt.Sprintf("%d", time.Now().UnixNano())
}

// API处理函数

// UploadWithProcessing 带处理的文件上传
func UploadWithProcessing(c *gin.Context) {
	// 获取用户ID
	userID, exists := c.Get("user_id")
	if !exists {
		response.Error(c, 3001, i18n.T(c, "user_not_found"))
		return
	}

	// 解析文件
	file, err := c.FormFile("file")
	if err != nil {
		response.Error(c, 1001, i18n.T(c, "invalid_parameters"))
		return
	}

	// 上传文件
	uploadService := GetUploadService()
	fileInfo, err := uploadService.UploadFile(file, fmt.Sprintf("%v", userID))
	if err != nil {
		response.Error(c, 5001, i18n.T(c, "upload_failed"))
		return
	}

	// 处理媒体文件
	processor := NewMediaProcessor()
	processedMedia, err := processor.ProcessMedia(fileInfo, uploadService.config.UploadPath)
	if err != nil {
		// 处理失败不影响上传成功
		response.Success(c, gin.H{
			"file":          fileInfo,
			"process_error": err.Error(),
		})
		return
	}

	response.Success(c, gin.H{
		"processed_media": processedMedia,
		"message":         i18n.T(c, "file_uploaded"),
	})
}

// GetMediaInfo 获取媒体信息
func GetMediaInfo(c *gin.Context) {
	fileID := c.Param("file_id")
	if fileID == "" {
		response.Error(c, 1001, i18n.T(c, "invalid_parameters"))
		return
	}

	// TODO: 从数据库获取文件信息
	// 这里需要实现文件信息的数据库存储和查询

	response.Success(c, gin.H{
		"file_id": fileID,
		"message": "Media info retrieved successfully",
	})
}

// RegisterMediaRoutes 注册媒体处理路由
func RegisterMediaRoutes(r *gin.RouterGroup) {
	media := r.Group("/media")
	{
		media.POST("/upload", UploadWithProcessing)
		media.GET("/info/:file_id", GetMediaInfo)
	}
}
