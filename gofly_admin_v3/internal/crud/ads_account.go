package crud

// AdsAccount Ads账户模型
type AdsAccount struct {
	ID       string `json:"id" gform:"primary;auto_id"`
	UserID   string `json:"user_id" gform:"required;index"`
	Platform string `json:"platform" gform:"required;max_length:50"`
	Email    string `json:"email" gform:"required;max_length:255"`
	Status   string `json:"status" gform:"default:'active';max_length:20"`

	// 创建和更新时间
	CreatedAt string `json:"created_at" gform:"created"`
	UpdatedAt string `json:"updated_at" gform:"updated"`
	DeletedAt string `json:"deleted_at" gform:"deleted"`
}
