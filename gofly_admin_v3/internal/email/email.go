package email

import (
	"bytes"
	"crypto/tls"
	"fmt"
	"html/template"
	"net/smtp"
	"strings"
	"time"

	"gofly-admin-v3/internal/config"
	"gofly-admin-v3/utils/gf"
)

// EmailConfig 邮件配置
type EmailConfig struct {
	Host     string `yaml:"host"`
	Port     int    `yaml:"port"`
	Username string `yaml:"username"`
	Password string `yaml:"password"`
	From     string `yaml:"from"`
	UseTLS   bool   `yaml:"use_tls"`
}

// EmailMessage 邮件消息
type EmailMessage struct {
	To       []string `json:"to"`
	Cc       []string `json:"cc,omitempty"`
	Bcc      []string `json:"bcc,omitempty"`
	Subject  string   `json:"subject"`
	HTMLBody string   `json:"html_body,omitempty"`
	TextBody string   `json:"text_body,omitempty"`
	Files    []string `json:"files,omitempty"`
}

// EmailTemplate 邮件模板
type EmailTemplate struct {
	Name        string
	Subject     string
	HTMLContent string
	TextContent string
	Variables   []string
}

// EmailService 邮件服务
type EmailService struct {
	config *EmailConfig
	auth   smtp.Auth
}

var (
	defaultEmailService *EmailService
	emailInit           bool
)

// NewEmailService 创建邮件服务
func NewEmailService(cfg *EmailConfig) *EmailService {
	auth := smtp.PlainAuth("", cfg.Username, cfg.Password, cfg.Host)

	return &EmailService{
		config: cfg,
		auth:   auth,
	}
}

// GetEmailService 获取邮件服务
func GetEmailService() *EmailService {
    if !emailInit {
        // 从配置文件获取邮件配置（保留初始化调用以便后续扩展）
        _ = config.GetConfigManager()

		// 这里简化处理，实际应该从配置文件读取邮件配置
		emailCfg := &EmailConfig{
			Host:     "smtp.gmail.com",
			Port:     587,
			Username: "your-email@gmail.com",
			Password: "your-password",
			From:     "noreply@yourdomain.com",
			UseTLS:   true,
		}

		defaultEmailService = NewEmailService(emailCfg)
		emailInit = true
	}
	return defaultEmailService
}

// Send 发送邮件
func (es *EmailService) Send(msg *EmailMessage) error {
	// 构建邮件内容
	var buf bytes.Buffer

	// 设置邮件头
	buf.WriteString(fmt.Sprintf("From: %s\r\n", es.config.From))
	buf.WriteString(fmt.Sprintf("To: %s\r\n", strings.Join(msg.To, ",")))

	if len(msg.Cc) > 0 {
		buf.WriteString(fmt.Sprintf("Cc: %s\r\n", strings.Join(msg.Cc, ",")))
	}

	buf.WriteString(fmt.Sprintf("Subject: %s\r\n", msg.Subject))
	buf.WriteString("MIME-Version: 1.0\r\n")

	// 如果有附件或HTML内容，使用MIME多部分
	if len(msg.Files) > 0 || msg.HTMLBody != "" {
        boundary := " boundary_" + gf.UUID()
		buf.WriteString(fmt.Sprintf("Content-Type: multipart/mixed;%s\r\n", boundary))
		buf.WriteString("\r\n")

		// 添加邮件正文
		if msg.HTMLBody != "" {
			buf.WriteString(fmt.Sprintf("--%s\r\n", boundary[2:]))
			buf.WriteString("Content-Type: text/html; charset=utf-8\r\n")
			buf.WriteString("\r\n")
			buf.WriteString(msg.HTMLBody)
			buf.WriteString("\r\n")
		} else if msg.TextBody != "" {
			buf.WriteString(fmt.Sprintf("--%s\r\n", boundary[2:]))
			buf.WriteString("Content-Type: text/plain; charset=utf-8\r\n")
			buf.WriteString("\r\n")
			buf.WriteString(msg.TextBody)
			buf.WriteString("\r\n")
		}

        // 添加附件
        for range msg.Files {
            buf.WriteString(fmt.Sprintf("--%s\r\n", boundary[2:]))
            // TODO: 实现附件添加
        }

		buf.WriteString(fmt.Sprintf("--%s--\r\n", boundary[2:]))
	} else {
		// 纯文本邮件
		if msg.HTMLBody != "" {
			buf.WriteString("Content-Type: text/html; charset=utf-8\r\n")
		} else {
			buf.WriteString("Content-Type: text/plain; charset=utf-8\r\n")
		}
		buf.WriteString("\r\n")
		if msg.HTMLBody != "" {
			buf.WriteString(msg.HTMLBody)
		} else {
			buf.WriteString(msg.TextBody)
		}
	}

	// 连接SMTP服务器
	addr := fmt.Sprintf("%s:%d", es.config.Host, es.config.Port)

	var client *smtp.Client
	var err error

	if es.config.UseTLS {
		// 使用TLS
		client, err = smtp.Dial(addr)
		if err != nil {
			return fmt.Errorf("failed to connect to SMTP server: %v", err)
		}

		// 启用TLS
		tlsConfig := &tls.Config{
			ServerName:         es.config.Host,
			InsecureSkipVerify: false,
		}
		if err = client.StartTLS(tlsConfig); err != nil {
			return fmt.Errorf("failed to start TLS: %v", err)
		}
	} else {
		// 不使用TLS
		client, err = smtp.Dial(addr)
		if err != nil {
			return fmt.Errorf("failed to connect to SMTP server: %v", err)
		}
	}

	defer client.Close()

	// 认证
	if err = client.Auth(es.auth); err != nil {
		return fmt.Errorf("SMTP authentication failed: %v", err)
	}

	// 设置发件人
	if err = client.Mail(es.config.From); err != nil {
		return fmt.Errorf("failed to set sender: %v", err)
	}

	// 设置收件人
	for _, to := range msg.To {
		if err = client.Rcpt(to); err != nil {
			return fmt.Errorf("failed to set recipient %s: %v", to, err)
		}
	}

	// 设置抄送
	for _, cc := range msg.Cc {
		if err = client.Rcpt(cc); err != nil {
			return fmt.Errorf("failed to set CC %s: %v", cc, err)
		}
	}

	// 设置密送
	for _, bcc := range msg.Bcc {
		if err = client.Rcpt(bcc); err != nil {
			return fmt.Errorf("failed to set BCC %s: %v", bcc, err)
		}
	}

	// 发送邮件内容
	w, err := client.Data()
	if err != nil {
		return fmt.Errorf("failed to prepare data: %v", err)
	}
	defer w.Close()

	_, err = buf.WriteTo(w)
	if err != nil {
		return fmt.Errorf("failed to send email: %v", err)
	}

	return nil
}

// SendText 发送文本邮件
func (es *EmailService) SendText(to []string, subject, body string) error {
	msg := &EmailMessage{
		To:       to,
		Subject:  subject,
		TextBody: body,
	}
	return es.Send(msg)
}

// SendHTML 发送HTML邮件
func (es *EmailService) SendHTML(to []string, subject, htmlBody string) error {
	msg := &EmailMessage{
		To:       to,
		Subject:  subject,
		HTMLBody: htmlBody,
	}
	return es.Send(msg)
}

// SendTemplate 发送模板邮件
func (es *EmailService) SendTemplate(to []string, templateName string, data map[string]interface{}) error {
	tmpl, err := es.GetTemplate(templateName)
	if err != nil {
		return err
	}

	// 处理主题
	subject, err := es.executeTemplate(tmpl.Subject, data)
	if err != nil {
		return err
	}

	// 处理HTML内容
	htmlBody, err := es.executeTemplate(tmpl.HTMLContent, data)
	if err != nil {
		return err
	}

	// 处理文本内容
	textBody, err := es.executeTemplate(tmpl.TextContent, data)
	if err != nil {
		return err
	}

	msg := &EmailMessage{
		To:       to,
		Subject:  subject,
		HTMLBody: htmlBody,
		TextBody: textBody,
	}

	return es.Send(msg)
}

// executeTemplate 执行模板
func (es *EmailService) executeTemplate(tmplStr string, data map[string]interface{}) (string, error) {
	tmpl, err := template.New("email").Parse(tmplStr)
	if err != nil {
		return "", err
	}

	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, data); err != nil {
		return "", err
	}

	return buf.String(), nil
}

// GetTemplate 获取邮件模板
func (es *EmailService) GetTemplate(name string) (*EmailTemplate, error) {
	// TODO: 从数据库或文件系统加载模板
	// 这里返回内置模板

	switch name {
	case "welcome":
		return &EmailTemplate{
			Name:        "welcome",
			Subject:     "欢迎加入 {{.AppName}}",
			HTMLContent: welcomeHTMLTemplate,
			TextContent: welcomeTextTemplate,
			Variables:   []string{"AppName", "Username", "LoginURL"},
		}, nil

	case "reset_password":
		return &EmailTemplate{
			Name:        "reset_password",
			Subject:     "重置您的密码",
			HTMLContent: resetPasswordHTMLTemplate,
			TextContent: resetPasswordTextTemplate,
			Variables:   []string{"Username", "ResetURL", "ExpireTime"},
		}, nil

	case "verify_email":
		return &EmailTemplate{
			Name:        "verify_email",
			Subject:     "验证您的邮箱",
			HTMLContent: verifyEmailHTMLTemplate,
			TextContent: verifyEmailTextTemplate,
			Variables:   []string{"Username", "VerifyURL", "ExpireTime"},
		}, nil

	case "trial_expired":
		return &EmailTemplate{
			Name:        "trial_expired",
			Subject:     "您的试用已到期",
			HTMLContent: trialExpiredHTMLTemplate,
			TextContent: trialExpiredTextTemplate,
			Variables:   []string{"Username", "AppName", "UpgradeURL"},
		}, nil

	default:
		return nil, fmt.Errorf("template not found: %s", name)
	}
}

// SendWelcomeEmail 发送欢迎邮件
func SendWelcomeEmail(to, username string) error {
	es := GetEmailService()
	data := map[string]interface{}{
		"AppName":  "AutoAds",
		"Username": username,
		"LoginURL": "http://localhost:3000/login",
	}
	return es.SendTemplate([]string{to}, "welcome", data)
}

// SendResetPasswordEmail 发送重置密码邮件
func SendResetPasswordEmail(to, username, resetToken string) error {
	es := GetEmailService()
	data := map[string]interface{}{
		"Username":   username,
		"ResetURL":   fmt.Sprintf("http://localhost:3000/reset-password?token=%s", resetToken),
		"ExpireTime": time.Now().Add(1 * time.Hour).Format("2006-01-02 15:04:05"),
	}
	return es.SendTemplate([]string{to}, "reset_password", data)
}

// SendVerifyEmailEmail 发送验证邮件
func SendVerifyEmailEmail(to, username, verifyToken string) error {
	es := GetEmailService()
	data := map[string]interface{}{
		"Username":   username,
		"VerifyURL":  fmt.Sprintf("http://localhost:3000/verify-email?token=%s", verifyToken),
		"ExpireTime": time.Now().Add(24 * time.Hour).Format("2006-01-02 15:04:05"),
	}
	return es.SendTemplate([]string{to}, "verify_email", data)
}

// SendTrialExpiredEmail 发送试用到期邮件
func SendTrialExpiredEmail(to, username string) error {
	es := GetEmailService()
	data := map[string]interface{}{
		"Username":   username,
		"AppName":    "AutoAds",
		"UpgradeURL": "http://localhost:3000/pricing",
	}
	return es.SendTemplate([]string{to}, "trial_expired", data)
}

// 内置邮件模板
const (
	welcomeHTMLTemplate = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>欢迎加入</title>
</head>
<body>
    <h2>欢迎加入 {{.AppName}}！</h2>
    <p>亲爱的 {{.Username}}，</p>
    <p>感谢您注册 {{.AppName}}！您的账户已经创建成功。</p>
    <p>您可以点击以下链接登录：</p>
    <p><a href="{{.LoginURL}}">{{.LoginURL}}</a></p>
    <p>如果您有任何问题，请随时联系我们的客服。</p>
    <p>祝您使用愉快！<br>{{.AppName}} 团队</p>
</body>
</html>
`

	welcomeTextTemplate = `
欢迎加入 {{.AppName}}！

亲爱的 {{.Username}}，

感谢您注册 {{.AppName}}！您的账户已经创建成功。

您可以点击以下链接登录：
{{.LoginURL}}

如果您有任何问题，请随时联系我们的客服。

祝您使用愉快！
{{.AppName}} 团队
`

	resetPasswordHTMLTemplate = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>重置密码</title>
</head>
<body>
    <h2>重置您的密码</h2>
    <p>亲爱的 {{.Username}}，</p>
    <p>您请求重置密码。请点击以下链接重置您的密码：</p>
    <p><a href="{{.ResetURL}}">{{.ResetURL}}</a></p>
    <p>此链接将在 {{.ExpireTime}} 后失效。</p>
    <p>如果您没有请求重置密码，请忽略此邮件。</p>
    <p>{{.AppName}} 团队</p>
</body>
</html>
`

	resetPasswordTextTemplate = `
重置您的密码

亲爱的 {{.Username}}，

您请求重置密码。请点击以下链接重置您的密码：
{{.ResetURL}}

此链接将在 {{.ExpireTime}} 后失效。

如果您没有请求重置密码，请忽略此邮件。

{{.AppName}} 团队
`

	verifyEmailHTMLTemplate = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>验证您的邮箱</title>
</head>
<body>
    <h2>验证您的邮箱</h2>
    <p>亲爱的 {{.Username}}，</p>
    <p>请点击以下链接验证您的邮箱：</p>
    <p><a href="{{.VerifyURL}}">{{.VerifyURL}}</a></p>
    <p>此链接将在 {{.ExpireTime}} 后失效。</p>
    <p>{{.AppName}} 团队</p>
</body>
</html>
`

	verifyEmailTextTemplate = `
验证您的邮箱

亲爱的 {{.Username}}，

请点击以下链接验证您的邮箱：
{{.VerifyURL}}

此链接将在 {{.ExpireTime}} 后失效。

{{.AppName}} 团队
`

	trialExpiredHTMLTemplate = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>您的试用已到期</title>
</head>
<body>
    <h2>您的试用已到期</h2>
    <p>亲爱的 {{.Username}}，</p>
    <p>您在 {{.AppName}} 的试用期已经到期。</p>
    <p>为了继续使用我们的服务，请升级到付费计划：</p>
    <p><a href="{{.UpgradeURL}}">{{.UpgradeURL}}</a></p>
    <p>感谢您的使用！</p>
    <p>{{.AppName}} 团队</p>
</body>
</html>
`

	trialExpiredTextTemplate = `
您的试用已到期

亲爱的 {{.Username}}，

您在 {{.AppName}} 的试用期已经到期。

为了继续使用我们的服务，请升级到付费计划：
{{.UpgradeURL}}

感谢您的使用！

{{.AppName}} 团队
`
)
