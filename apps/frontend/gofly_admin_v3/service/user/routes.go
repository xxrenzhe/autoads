package user

import (
    "strconv"
    "strings"
    "time"

    "github.com/gin-gonic/gin"
    "gofly-admin-v3/utils/gf"
)

func init() {
    // 用户列表（分页/搜索/排序）: GET /console/users
    gf.RegisterRoute("GET", "/console/users", listUsersHandler, false, nil)
    // 邮件验证码：发送/验证
    gf.RegisterRoute("POST", "/user/email/send_verification", sendEmailVerificationHandler, true, nil)
    gf.RegisterRoute("POST", "/user/email/verify", verifyEmailHandler, true, nil)
    // 密码找回：请求/重置
    gf.RegisterRoute("POST", "/user/password/request_reset", requestPasswordResetHandler, true, nil)
    gf.RegisterRoute("POST", "/user/password/reset", resetPasswordHandler, true, nil)
}

// GET /console/users?page=&size=&keyword=&sort=(created_at_desc|created_at_asc|username|email)
func listUsersHandler(c *gin.Context) {
    page, _ := strconv.Atoi(c.Query("page"))
    if page <= 0 { page = 1 }
    size, _ := strconv.Atoi(c.Query("pageSize"))
    if size <= 0 || size > 200 { size = 20 }
    keyword := strings.TrimSpace(c.Query("keyword"))
    sort := strings.TrimSpace(c.Query("sort"))

    users, total, err := NewService(gf.DB()).GetUserListSorted(page, size, keyword, sort)
    if err != nil {
        gf.Failed().SetMsg(err.Error()).Regin(c)
        return
    }
    gf.Success().SetData(gf.Map{"list": users, "total": total, "page": page, "pageSize": size}).Regin(c)
}

// POST /user/email/send_verification { email }
func sendEmailVerificationHandler(c *gin.Context) {
    var req struct{ Email string `json:"email"` }
    if err := c.ShouldBindJSON(&req); err != nil || req.Email == "" {
        gf.Failed().SetMsg("参数错误").Regin(c); return
    }
    ok, err := gf.SendEmail(c, []string{req.Email}, "邮箱验证", "")
    if err != nil || !ok { gf.Failed().SetMsg("发送失败").SetExdata(err).Regin(c); return }
    gf.Success().SetMsg("验证码已发送").Regin(c)
}

// POST /user/email/verify { email, code }
func verifyEmailHandler(c *gin.Context) {
    var req struct{ Email, Code string }
    if err := c.ShouldBindJSON(&req); err != nil || req.Email == "" || req.Code == "" {
        gf.Failed().SetMsg("参数错误").Regin(c); return
    }
    code, err := gf.GetVerifyCode(req.Email)
    if err != nil || strconv.Itoa(code) != req.Code {
        gf.Failed().SetMsg("验证码错误").Regin(c); return
    }
    // 标记邮箱已验证
    _, err = gf.Model(&Model{}).Where("email", strings.ToLower(strings.TrimSpace(req.Email))).Update(gf.Map{"email_verified": true})
    if err != nil { gf.Failed().SetMsg("更新失败").Regin(c); return }
    gf.Success().SetMsg("邮箱验证成功").Regin(c)
}

// POST /user/password/request_reset { email }
func requestPasswordResetHandler(c *gin.Context) {
    var req struct{ Email string `json:"email"` }
    if err := c.ShouldBindJSON(&req); err != nil || req.Email == "" {
        gf.Failed().SetMsg("参数错误").Regin(c); return
    }
    email := strings.ToLower(strings.TrimSpace(req.Email))
    // 生成验证码并缓存 pwd:{email}
    code := strconv.Itoa(int(time.Now().UnixNano()%900000 + 100000))
    _ = gf.SetVerifyCode("pwd:"+email, code)
    // 发送邮件
    text := "您的密码重置验证码为：" + code + "（10分钟内有效）"
    ok, err := gf.SendEmail(c, []string{email}, "密码重置", text)
    if err != nil || !ok { gf.Failed().SetMsg("发送失败").SetExdata(err).Regin(c); return }
    gf.Success().SetMsg("验证码已发送").Regin(c)
}

// POST /user/password/reset { email, code, new_password }
func resetPasswordHandler(c *gin.Context) {
    var req struct{ Email, Code, NewPassword string }
    if err := c.ShouldBindJSON(&req); err != nil || req.Email == "" || req.Code == "" || len(req.NewPassword) < 6 {
        gf.Failed().SetMsg("参数错误").Regin(c); return
    }
    email := strings.ToLower(strings.TrimSpace(req.Email))
    code, err := gf.GetVerifyCode("pwd:" + email)
    if err != nil || strconv.Itoa(code) != req.Code {
        gf.Failed().SetMsg("验证码错误").Regin(c); return
    }
    // 更新密码
    record, err := gf.DB().Model(&Model{}).Where("email = ?", email).One()
    if err != nil || record == nil { gf.Failed().SetMsg("用户不存在").Regin(c); return }
    _, err = gf.DB().Model(&Model{}).Where("email = ?", email).Update(gf.Map{"password_hash": hashPassword(req.NewPassword)})
    if err != nil { gf.Failed().SetMsg("重置失败").Regin(c); return }
    gf.Success().SetMsg("密码重置成功").Regin(c)
}
