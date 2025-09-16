package email

import "time"

// AutoAds SaaS specific email templates

// GetAutoAdsTemplate 获取AutoAds专用邮件模板
func (es *EmailService) GetAutoAdsTemplate(name string) (*EmailTemplate, error) {
	switch name {
	case "low_tokens":
		return &EmailTemplate{
			Name:        "low_tokens",
			Subject:     "Token余额不足提醒 - {{.AppName}}",
			HTMLContent: lowTokensHTMLTemplate,
			TextContent: lowTokensTextTemplate,
			Variables:   []string{"Username", "TokenBalance", "TopupURL", "AppName"},
		}, nil

	case "task_completed":
		return &EmailTemplate{
			Name:        "task_completed",
			Subject:     "任务执行完成 - {{.TaskName}}",
			HTMLContent: taskCompletedHTMLTemplate,
			TextContent: taskCompletedTextTemplate,
			Variables:   []string{"Username", "TaskName", "TaskType", "SuccessCount", "FailCount", "ViewURL"},
		}, nil

	case "plan_expired":
		return &EmailTemplate{
			Name:        "plan_expired",
			Subject:     "您的{{.PlanName}}套餐即将到期",
			HTMLContent: planExpiredHTMLTemplate,
			TextContent: planExpiredTextTemplate,
			Variables:   []string{"Username", "PlanName", "ExpiryDate", "RenewURL"},
		}, nil

	case "invitation_reward":
		return &EmailTemplate{
			Name:        "invitation_reward",
			Subject:     "邀请奖励已到账 - {{.AppName}}",
			HTMLContent: invitationRewardHTMLTemplate,
			TextContent: invitationRewardTextTemplate,
			Variables:   []string{"Username", "InviteeName", "RewardTokens", "RewardDays", "AppName"},
		}, nil

	case "security_alert":
		return &EmailTemplate{
			Name:        "security_alert",
			Subject:     "安全提醒 - 检测到异常登录",
			HTMLContent: securityAlertHTMLTemplate,
			TextContent: securityAlertTextTemplate,
			Variables:   []string{"Username", "IPAddress", "Location", "Time", "DeviceInfo"},
		}, nil

	default:
		// 回退到基础模板
		return es.GetTemplate(name)
	}
}

// SendLowTokensEmail 发送Token不足邮件
func SendLowTokensEmail(to, username string, tokenBalance int) error {
	es := GetEmailService()
	data := map[string]interface{}{
		"Username":     username,
		"TokenBalance": tokenBalance,
		"TopupURL":     "http://localhost:3000/tokens/purchase",
		"AppName":      "AutoAds",
	}
	return es.SendTemplate([]string{to}, "low_tokens", data)
}

// SendTaskCompletedEmail 发送任务完成邮件
func SendTaskCompletedEmail(to, username, taskName, taskType string, successCount, failCount int) error {
	es := GetEmailService()
	data := map[string]interface{}{
		"Username":     username,
		"TaskName":     taskName,
		"TaskType":     taskType,
		"SuccessCount": successCount,
		"FailCount":    failCount,
		"ViewURL":      "http://localhost:3000/tasks",
	}
	return es.SendTemplate([]string{to}, "task_completed", data)
}

// SendPlanExpiredEmail 发送套餐到期邮件
func SendPlanExpiredEmail(to, username, planName, expiryDate string) error {
	es := GetEmailService()
	data := map[string]interface{}{
		"Username":   username,
		"PlanName":   planName,
		"ExpiryDate": expiryDate,
		"RenewURL":   "http://localhost:3000/pricing",
	}
	return es.SendTemplate([]string{to}, "plan_expired", data)
}

// SendInvitationRewardEmail 发送邀请奖励邮件
func SendInvitationRewardEmail(to, username, inviteeName string, rewardDays int) error {
    es := GetEmailService()
    data := map[string]interface{}{
        "Username":     username,
        "InviteeName":  inviteeName,
        "RewardDays":   rewardDays,
        "AppName":      "AutoAds",
    }
    return es.SendTemplate([]string{to}, "invitation_reward", data)
}

// SendSecurityAlertEmail 发送安全提醒邮件
func SendSecurityAlertEmail(to, username, ipAddress, location, deviceInfo string) error {
	es := GetEmailService()
	data := map[string]interface{}{
		"Username":   username,
		"IPAddress":  ipAddress,
		"Location":   location,
		"Time":       time.Now().Format("2006-01-02 15:04:05"),
		"DeviceInfo": deviceInfo,
	}
	return es.SendTemplate([]string{to}, "security_alert", data)
}

// AutoAds专用邮件模板
const (
	lowTokensHTMLTemplate = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Token余额不足提醒</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #f8f9fa; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #fff; padding: 30px; border: 1px solid #e9ecef; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; }
        .btn { display: inline-block; padding: 12px 24px; background: #007bff; color: white; text-decoration: none; border-radius: 4px; }
        .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 4px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>{{.AppName}} - Token余额提醒</h1>
        </div>
        <div class="content">
            <p>亲爱的 {{.Username}}，</p>
            
            <div class="warning">
                <strong>⚠️ Token余额不足提醒</strong><br>
                您当前的Token余额为：<strong>{{.TokenBalance}} tokens</strong>
            </div>
            
            <p>为了确保您的任务能够正常执行，建议您及时充值Token：</p>
            
            <ul>
                <li>BatchGo HTTP模式：1 Token/URL</li>
                <li>BatchGo Puppeteer模式：2 Token/URL</li>
                <li>SiteRank查询：1 Token/域名</li>
                <li>Chengelink链接提取：1 Token</li>
                <li>Chengelink广告更新：3 Token/广告</li>
            </ul>
            
            <p style="text-align: center; margin: 30px 0;">
                <a href="{{.TopupURL}}" class="btn">立即充值 Token</a>
            </p>
            
            <p>如果您有任何问题，请随时联系我们的客服。</p>
        </div>
        <div class="footer">
            <p>{{.AppName}} 团队<br>
            <small>这是一封自动发送的邮件，请勿回复。</small></p>
        </div>
    </div>
</body>
</html>
`

	lowTokensTextTemplate = `
Token余额不足提醒 - {{.AppName}}

亲爱的 {{.Username}}，

⚠️ Token余额不足提醒
您当前的Token余额为：{{.TokenBalance}} tokens

为了确保您的任务能够正常执行，建议您及时充值Token：

- BatchGo HTTP模式：1 Token/URL
- BatchGo Puppeteer模式：2 Token/URL  
- SiteRank查询：1 Token/域名
- Chengelink链接提取：1 Token
- Chengelink广告更新：3 Token/广告

立即充值：{{.TopupURL}}

如果您有任何问题，请随时联系我们的客服。

{{.AppName}} 团队
这是一封自动发送的邮件，请勿回复。
`

	taskCompletedHTMLTemplate = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>任务执行完成</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #f8f9fa; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #fff; padding: 30px; border: 1px solid #e9ecef; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; }
        .btn { display: inline-block; padding: 12px 24px; background: #28a745; color: white; text-decoration: none; border-radius: 4px; }
        .stats { background: #f8f9fa; padding: 20px; border-radius: 4px; margin: 20px 0; }
        .stat-item { display: inline-block; margin: 0 20px; text-align: center; }
        .stat-number { font-size: 24px; font-weight: bold; color: #007bff; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>✅ 任务执行完成</h1>
        </div>
        <div class="content">
            <p>亲爱的 {{.Username}}，</p>
            
            <p>您的任务 <strong>{{.TaskName}}</strong> ({{.TaskType}}) 已经执行完成！</p>
            
            <div class="stats">
                <div class="stat-item">
                    <div class="stat-number">{{.SuccessCount}}</div>
                    <div>成功</div>
                </div>
                <div class="stat-item">
                    <div class="stat-number">{{.FailCount}}</div>
                    <div>失败</div>
                </div>
                <div class="stat-item">
                    <div class="stat-number">{{add .SuccessCount .FailCount}}</div>
                    <div>总计</div>
                </div>
            </div>
            
            <p style="text-align: center; margin: 30px 0;">
                <a href="{{.ViewURL}}" class="btn">查看详细结果</a>
            </p>
            
            <p>感谢您使用AutoAds！</p>
        </div>
        <div class="footer">
            <p>AutoAds 团队<br>
            <small>这是一封自动发送的邮件，请勿回复。</small></p>
        </div>
    </div>
</body>
</html>
`

	taskCompletedTextTemplate = `
✅ 任务执行完成

亲爱的 {{.Username}}，

您的任务 {{.TaskName}} ({{.TaskType}}) 已经执行完成！

执行结果：
- 成功：{{.SuccessCount}}
- 失败：{{.FailCount}}
- 总计：{{add .SuccessCount .FailCount}}

查看详细结果：{{.ViewURL}}

感谢您使用AutoAds！

AutoAds 团队
这是一封自动发送的邮件，请勿回复。
`

	planExpiredHTMLTemplate = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>套餐即将到期</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #f8f9fa; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #fff; padding: 30px; border: 1px solid #e9ecef; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; }
        .btn { display: inline-block; padding: 12px 24px; background: #ffc107; color: #212529; text-decoration: none; border-radius: 4px; }
        .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 4px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>⏰ 套餐到期提醒</h1>
        </div>
        <div class="content">
            <p>亲爱的 {{.Username}}，</p>
            
            <div class="warning">
                <strong>您的{{.PlanName}}套餐即将到期</strong><br>
                到期时间：{{.ExpiryDate}}
            </div>
            
            <p>为了避免服务中断，请及时续费您的套餐。续费后您将继续享受：</p>
            
            <ul>
                <li>无限制的BatchGo任务执行</li>
                <li>高级SiteRank查询功能</li>
                <li>Chengelink自动化服务</li>
                <li>优先技术支持</li>
                <li>更多Token奖励</li>
            </ul>
            
            <p style="text-align: center; margin: 30px 0;">
                <a href="{{.RenewURL}}" class="btn">立即续费</a>
            </p>
            
            <p>如果您有任何问题，请随时联系我们的客服。</p>
        </div>
        <div class="footer">
            <p>AutoAds 团队<br>
            <small>这是一封自动发送的邮件，请勿回复。</small></p>
        </div>
    </div>
</body>
</html>
`

	planExpiredTextTemplate = `
⏰ 套餐到期提醒

亲爱的 {{.Username}}，

您的{{.PlanName}}套餐即将到期
到期时间：{{.ExpiryDate}}

为了避免服务中断，请及时续费您的套餐。续费后您将继续享受：

- 无限制的BatchGo任务执行
- 高级SiteRank查询功能
- Chengelink自动化服务
- 优先技术支持
- 更多Token奖励

立即续费：{{.RenewURL}}

如果您有任何问题，请随时联系我们的客服。

AutoAds 团队
这是一封自动发送的邮件，请勿回复。
`

    invitationRewardHTMLTemplate = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>邀请奖励已到账</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #f8f9fa; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #fff; padding: 30px; border: 1px solid #e9ecef; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; }
        .reward { background: #d4edda; border: 1px solid #c3e6cb; padding: 20px; border-radius: 4px; margin: 20px 0; text-align: center; }
        .reward-item { margin: 10px 0; font-size: 18px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎉 邀请奖励已到账</h1>
        </div>
        <div class="content">
            <p>亲爱的 {{.Username}}，</p>
            
            <p>恭喜您！您邀请的用户 <strong>{{.InviteeName}}</strong> 已成功注册{{.AppName}}。</p>
            
            <div class="reward">
                <div class="reward-item">⏰ Pro套餐时长：<strong>{{.RewardDays}} 天</strong></div>
            </div>
            
            <p>奖励已自动添加到您的账户中，您可以立即使用。</p>
            
            <p>继续邀请更多朋友，获得更多奖励！每成功邀请一位用户，您都将获得相同的奖励。</p>
            
            <p>感谢您对{{.AppName}}的支持和推广！</p>
        </div>
        <div class="footer">
            <p>{{.AppName}} 团队<br>
            <small>这是一封自动发送的邮件，请勿回复。</small></p>
        </div>
    </div>
</body>
</html>
`

    invitationRewardTextTemplate = `
🎉 邀请奖励已到账

亲爱的 {{.Username}}，

恭喜您！您邀请的用户 {{.InviteeName}} 已成功注册{{.AppName}}。

您获得的奖励：
⏰ Pro套餐时长：{{.RewardDays}} 天

奖励已自动添加到您的账户中，您可以立即使用。

继续邀请更多朋友，获得更多奖励！每成功邀请一位用户，您都将获得相同的奖励。

感谢您对{{.AppName}}的支持和推广！

{{.AppName}} 团队
这是一封自动发送的邮件，请勿回复。
`

	securityAlertHTMLTemplate = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>安全提醒</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #f8d7da; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #fff; padding: 30px; border: 1px solid #e9ecef; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; }
        .alert { background: #f8d7da; border: 1px solid #f5c6cb; padding: 15px; border-radius: 4px; margin: 20px 0; }
        .info-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .info-table td { padding: 8px; border-bottom: 1px solid #dee2e6; }
        .info-table td:first-child { font-weight: bold; width: 30%; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔒 安全提醒</h1>
        </div>
        <div class="content">
            <p>亲爱的 {{.Username}}，</p>
            
            <div class="alert">
                <strong>⚠️ 检测到异常登录活动</strong><br>
                我们检测到您的账户有新的登录活动，请确认是否为您本人操作。
            </div>
            
            <table class="info-table">
                <tr>
                    <td>登录时间：</td>
                    <td>{{.Time}}</td>
                </tr>
                <tr>
                    <td>IP地址：</td>
                    <td>{{.IPAddress}}</td>
                </tr>
                <tr>
                    <td>地理位置：</td>
                    <td>{{.Location}}</td>
                </tr>
                <tr>
                    <td>设备信息：</td>
                    <td>{{.DeviceInfo}}</td>
                </tr>
            </table>
            
            <p><strong>如果这是您本人的操作，请忽略此邮件。</strong></p>
            
            <p><strong>如果这不是您的操作，请立即：</strong></p>
            <ul>
                <li>更改您的账户密码</li>
                <li>检查账户中的异常活动</li>
                <li>联系我们的客服团队</li>
            </ul>
            
            <p>我们建议您定期更改密码，并启用两步验证来保护您的账户安全。</p>
        </div>
        <div class="footer">
            <p>AutoAds 安全团队<br>
            <small>这是一封自动发送的邮件，请勿回复。</small></p>
        </div>
    </div>
</body>
</html>
`

	securityAlertTextTemplate = `
🔒 安全提醒

亲爱的 {{.Username}}，

⚠️ 检测到异常登录活动
我们检测到您的账户有新的登录活动，请确认是否为您本人操作。

登录详情：
- 登录时间：{{.Time}}
- IP地址：{{.IPAddress}}
- 地理位置：{{.Location}}
- 设备信息：{{.DeviceInfo}}

如果这是您本人的操作，请忽略此邮件。

如果这不是您的操作，请立即：
- 更改您的账户密码
- 检查账户中的异常活动
- 联系我们的客服团队

我们建议您定期更改密码，并启用两步验证来保护您的账户安全。

AutoAds 安全团队
这是一封自动发送的邮件，请勿回复。
`
)
