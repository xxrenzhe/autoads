package errors

import (
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
)

// Response 统一响应结构
type Response struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Error   *AppError   `json:"error,omitempty"`
	Message string      `json:"message,omitempty"`
}

// ErrorResponse 错误响应
type ErrorResponse struct {
	Success bool      `json:"success"`
	Error   *AppError `json:"error"`
	Message string    `json:"message"`
}

// SuccessResponse 成功响应
type SuccessResponse struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data"`
	Message string      `json:"message,omitempty"`
}

// NewSuccessResponse 创建成功响应
func NewSuccessResponse(data interface{}) *SuccessResponse {
	return &SuccessResponse{
		Success: true,
		Data:    data,
	}
}

// NewSuccessResponseWithMessage 创建带消息的成功响应
func NewSuccessResponseWithMessage(data interface{}, message string) *SuccessResponse {
	return &SuccessResponse{
		Success: true,
		Data:    data,
		Message: message,
	}
}

// NewErrorResponse 创建错误响应
func NewErrorResponse(err *AppError) *ErrorResponse {
	return &ErrorResponse{
		Success: false,
		Error:   err,
		Message: err.Message,
	}
}

// ErrorHandlerMiddleware 错误处理中间件
func ErrorHandlerMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		defer func() {
			if err := recover(); err != nil {
				// 处理panic
				appErr := InternalServerError(SYSTEM_INTERNAL_ERROR, "Internal server error")
				if e, ok := err.(error); ok {
					appErr = appErr.WithCause(e)
				} else {
					appErr = appErr.WithCause(fmt.Errorf("%v", err))
				}
				appErr = appErr.WithStackTrace()

				c.JSON(http.StatusInternalServerError, NewErrorResponse(appErr))
				return
			}
		}()

		c.Next()

		// 处理请求中的错误
		if len(c.Errors) > 0 {
			err := c.Errors.Last().Err
			appErr := HandleError(err)

			// 如果还没有设置HTTP状态码，使用错误中定义的状态码
			if c.Writer.Status() == http.StatusOK {
				c.JSON(appErr.HTTPStatus, NewErrorResponse(appErr))
			} else {
				c.JSON(c.Writer.Status(), NewErrorResponse(appErr))
			}
		}
	}
}

// ResponseHandler 响应处理器
type ResponseHandler struct{}

// NewResponseHandler 创建响应处理器
func NewResponseHandler() *ResponseHandler {
	return &ResponseHandler{}
}

// Success 返回成功响应
func (rh *ResponseHandler) Success(c *gin.Context, data interface{}) {
	c.JSON(http.StatusOK, NewSuccessResponse(data))
}

// SuccessWithMessage 返回带消息的成功响应
func (rh *ResponseHandler) SuccessWithMessage(c *gin.Context, data interface{}, message string) {
	c.JSON(http.StatusOK, NewSuccessResponseWithMessage(data, message))
}

// Error 返回错误响应
func (rh *ResponseHandler) Error(c *gin.Context, err *AppError) {
	c.JSON(err.HTTPStatus, NewErrorResponse(err))
}

// BadRequest 返回400错误
func (rh *ResponseHandler) BadRequest(c *gin.Context, message string) {
	err := BadRequest(SYSTEM_VALIDATION_ERROR, message)
	rh.Error(c, err)
}

// Unauthorized 返回401错误
func (rh *ResponseHandler) Unauthorized(c *gin.Context, message string) {
	err := Unauthorized(SYSTEM_AUTH_ERROR, message)
	rh.Error(c, err)
}

// Forbidden 返回403错误
func (rh *ResponseHandler) Forbidden(c *gin.Context, message string) {
	err := Forbidden(SYSTEM_PERMISSION_ERROR, message)
	rh.Error(c, err)
}

// NotFound 返回404错误
func (rh *ResponseHandler) NotFound(c *gin.Context, message string) {
	err := NotFound(BIZ_RESOURCE_NOT_FOUND, message)
	rh.Error(c, err)
}

// InternalServerError 返回500错误
func (rh *ResponseHandler) InternalServerError(c *gin.Context, message string) {
	err := InternalServerError(SYSTEM_INTERNAL_ERROR, message)
	rh.Error(c, err)
}

// ValidateErrorResponse 验证错误响应
type ValidateErrorResponse struct {
	Success bool                   `json:"success"`
	Message string                 `json:"message"`
	Errors  map[string]interface{} `json:"errors"`
}

// NewValidateErrorResponse 创建验证错误响应
func NewValidateErrorResponse(message string, errors map[string]interface{}) *ValidateErrorResponse {
	return &ValidateErrorResponse{
		Success: false,
		Message: message,
		Errors:  errors,
	}
}

// ValidationError 返回验证错误
func (rh *ResponseHandler) ValidationError(c *gin.Context, message string, errors map[string]interface{}) {
	c.JSON(http.StatusBadRequest, NewValidateErrorResponse(message, errors))
}

// PaginationResponse 分页响应
type PaginationResponse struct {
	Success    bool        `json:"success"`
	Data       interface{} `json:"data"`
	Pagination struct {
		Page       int `json:"page"`
		PageSize   int `json:"page_size"`
		Total      int `json:"total"`
		TotalPages int `json:"total_pages"`
	} `json:"pagination"`
	Message string `json:"message,omitempty"`
}

// NewPaginationResponse 创建分页响应
func NewPaginationResponse(data interface{}, page, pageSize, total int) *PaginationResponse {
	totalPages := total / pageSize
	if total%pageSize != 0 {
		totalPages++
	}

	response := &PaginationResponse{
		Success: true,
		Data:    data,
		Message: "",
	}
	response.Pagination.Page = page
	response.Pagination.PageSize = pageSize
	response.Pagination.Total = total
	response.Pagination.TotalPages = totalPages

	return response
}

// Pagination 返回分页响应
func (rh *ResponseHandler) Pagination(c *gin.Context, data interface{}, page, pageSize, total int) {
	c.JSON(http.StatusOK, NewPaginationResponse(data, page, pageSize, total))
}

// 全局响应处理器实例
var DefaultResponse = NewResponseHandler()
