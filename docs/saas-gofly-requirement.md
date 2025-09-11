# AutoAds SaaS GoFly 架构重构方案

## 架构设计原则

### 核心原则

1. **简单性优先 (Simplicity First)**
   - 单体应用 > 微服务：避免分布式复杂性
   - 内置代理 > 外部代理：减少依赖层
   - 字段隔离 > 数据库隔离：用最简单的方式解决问题

2. **渐进式演进 (Gradual Evolution)**
   - 保持现有前端100%不变
   - API接口向后兼容
   - 数据库schema平滑迁移
   - 功能冻结：只迁移不新增

3. **深度复用 (Deep Reuse)**
   - GoFly框架85%功能可直接复用
   - 避免重复造轮子
   - 站在巨人肩膀上

4. **实用主义 (Pragmatism)**
   - 解决真实问题，不追求理论完美
   - 性能优化要有的放矢
   - 避免过度设计和过早优化

### 技术原则

1. **数据结构即架构**
   ```go
   // 核心设计：通过数据结构解决复杂问题
   type System struct {
       Users       []User          // 统一用户模型
       Tasks       []Task          // 统一任务模型  
       Tokens      []Transaction   // Token经济系统
       Config      Config         // 扁平化配置
   }
   ```

2. **消除特殊情况**
   - 双认证系统使用相同基础设施
   - 多租户通过tenant_id统一处理
   - 统一错误处理机制

3. **Never Break Userspace**
   - 所有API端点保持不变
   - 前端无需任何修改
   - 用户体验完全一致

### Linus式开发哲学

1. **"Is this a real problem?"**
   - 确保每个功能都解决真实需求
   - 避免为未来可能的需求过度设计

2. **"Is there a simpler way?"**
   - 始终寻找最简单的解决方案
   - 用tenant_id替代复杂的多租户架构

3. **"Will it break anything?"**
   - 保持向后兼容性
   - 渐进式迁移，降低风险

## 文档信息
- **项目名称**: AutoAds SaaS 系统重构
- **架构版本**: GoFly v3.0
- **创建日期**: 2025-01-11
- **最后更新**: 2025-01-11
- **架构决策**: Go单体应用 + 模块化设计 + 单容器部署

## 执行摘要

基于Linus的"好品味"哲学，我们选择最简单但最有效的方案：**Go单体应用 + 模块化设计**。摒弃复杂的微服务架构，使用GoFly Admin V3框架（已有70%功能实现），通过嵌入式HTTP反向代理实现单容器部署。目标是4900%性能提升（1→50并发）和统一的后台管理。

## 1. 架构设计原则

### 1.1 Linus式设计哲学

**数据结构优先**
- 多租户通过tenant_id字段隔离，而非复杂的多数据库
- Token经济系统使用简单的事务确保一致性
- 限流配置扁平化，避免嵌套结构

**消除特殊情况**
- 双认证系统使用相同的基础设施
- 统一错误处理，避免if/else地狱
- 单一入口点，消除路由复杂性

**实用主义**
- 选择Go内置HTTP服务器而非Nginx
- 使用内存限流逐步升级到Redis
- 保留现有前端，只重构后端

**Never Break Userspace**
- 保持所有API端点不变
- 保持数据库schema兼容
- 前端无需任何修改

### 1.2 核心架构决策

```go
// 核心数据结构 - 简单而强大
type System struct {
    Users        []User          // SaaS用户 + Admin用户
    Tasks        []Task          // 统一任务模型
    Tokens       []Transaction   // Token交易记录
    Invitations  []Invitation    // 邀请记录
    CheckIns     []CheckInRecord // 签到记录
    Config       Config         // 扁平化配置
}
```

## 2. 技术架构

### 2.1 整体架构图

```
┌─────────────────────────────────────────────┐
│            Single Docker Container          │
├─────────────────────────────────────────────┤
│                                             │
│  ┌─────────────┐    ┌───────────────────┐  │
│  │   GoFly     │    │     Next.js        │  │
│  │   Backend   │    │     Frontend       │  │
│  │   (Port     │    │     (Port 3000)    │  │
│  │   8080)     │    │                    │  │
│  └──────┬──────┘    └───────────────────┘  │
│         │                    │             │
│         └─────┐      ┌───────┘             │
│               │      │                   │
│  ┌─────────────────────────────────┐     │
│  │   Built-in HTTP Reverse Proxy    │     │
│  │          (Port 80)               │     │
│  └─────────────────────────────────┘     │
│                                             │
└─────────────────────────────────────────────┘
```

### 2.2 技术栈

**后端技术栈**:
- Go 1.21 + GoFly Admin V3
- MySQL 8.0 + GORM
- Redis (缓存 + 会话)
- 内置HTTP反向代理

**前端技术栈** (保持不变):
- Next.js 14 + React 18
- MUI v7 + Tailwind CSS
- Zustand + NextAuth.js

**部署架构**:
- 单Docker容器
- 无Nginx，使用Go内置代理
- 支持水平扩展

## 3. 核心功能实现

### 3.1 双模式认证系统

```go
// 统一的用户模型 - 消除特殊情况
type User struct {
    ID           string  `gorm:"primaryKey"`
    Email        string  `gorm:"uniqueIndex"`
    Type         string  `gorm:"type:enum('SAAS','ADMIN');default:'SAAS'"`
    TenantID     string  // SaaS: 用户ID, Admin: "system"
    Plan         string  // FREE/PRO/MAX
    TokenBalance int64   // Token余额
    Status       string  // active/inactive
    // ... 通用字段
}

// JWT中间件根据Type路由
func AuthMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        token := extractToken(c)
        claims := parseToken(token)
        
        if claims.Type == "SAAS" {
            c.Set("user_id", claims.UserID)
            c.Set("tenant_id", claims.UserID)
        } else {
            c.Set("admin_id", claims.UserID)
            c.Set("tenant_id", "system")
        }
        
        c.Next()
    }
}
```

### 3.2 多租户数据隔离

```go
// 自动注入tenant_id
func TenantMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        tenantID := c.GetString("tenant_id")
        
        // GORM自动过滤
        db := DB.Session(&gorm.Session{
            Context: context.WithValue(c.Context(), "tenant_id", tenantID)
        })
        
        c.Set("db", db)
        c.Next()
    }
}

// 所有模型都包含tenant_id
type BaseModel struct {
    ID        string `gorm:"primaryKey"`
    TenantID  string `gorm:"index;not null"`
    CreatedAt time.Time
    UpdatedAt time.Time
}
```

### 3.3 统一后台管理能力

基于对GoFly Admin V3的代码分析，已实现80%的功能：

#### ✅ 数据面板
- 用户统计（总数、活跃、新增）
- Token统计（余额、消耗趋势）
- 任务统计（各模块运行状态）
- 系统性能监控

#### ✅ 用户管理
- 用户列表（搜索、分页）
- 用户详情（Token余额、使用统计）
- 状态管理（启用/禁用）
- Token余额调整

#### ✅ Token系统
- 完整的经济模型
- 交易记录追踪
- 充值/消费/冻结功能
- 支持多种交易类型

#### ✅ 套餐限流
- 三层套餐体系
- 功能级限流配置
- 实时限流检查
- 热更新支持

#### ✅ 系统管理
- 管理员账户管理
- 系统配置管理
- 操作日志审计
- API统计监控

### 3.4 邀请系统设计

#### 3.4.1 数据模型设计

```go
// 邀请记录模型
type Invitation struct {
    BaseModel
    InviterID     string    `gorm:"index"`          // 邀请者ID
    InviteeID     string    `gorm:"index"`          // 被邀请者ID
    InviteCode    string    `gorm:"uniqueIndex"`    // 邀请码
    Status        string    `gorm:"default:'pending'"` // pending/accepted/expired
    InvitedAt     time.Time // 邀请时间
    AcceptedAt    *time.Time // 接受时间
    RewardDays    int       `gorm:"default:30"`     // 奖励天数
    RewardClaimed bool      `gorm:"default:false"`  // 奖励是否已领取
}

// 用户模型扩展
type User struct {
    BaseModel
    Email        string    `gorm:"uniqueIndex"`
    Type         string    `gorm:"type:enum('SAAS','ADMIN');default:'SAAS'"`
    Plan         string    // FREE/PRO/MAX
    TokenBalance int64     // Token余额
    Status       string    // active/inactive
    
    // 邀请相关字段
    InvitedBy    *string   // 被谁邀请的（外键）
    InviteCode   string    `gorm:"uniqueIndex"` // 该用户的专属邀请码
    PlanExpires  *time.Time // 套餐过期时间
    
    // ... 其他字段
}
```

#### 3.4.2 功能实现

**1. 邀请链接生成**
```go
// 生成专属邀请链接
func GenerateInviteLink(userID string) string {
    // 检查用户是否已有邀请码
    var user User
    if err := DB.First(&user, "id = ?", userID).Error; err != nil {
        return ""
    }
    
    // 如果没有邀请码，生成一个
    if user.InviteCode == "" {
        user.InviteCode = generateInviteCode()
        DB.Save(&user)
    }
    
    return fmt.Sprintf("https://autoads.dev/register?invite=%s", user.InviteCode)
}

// 生成随机邀请码
func generateInviteCode() string {
    return uuid.New().String()[:8] // 取UUID前8位作为邀请码
}
```

**2. 注册流程处理**
```go
// 注册处理逻辑
func RegisterHandler(c *gin.Context) {
    var req RegisterRequest
    
    if err := c.ShouldBind(&req); err != nil {
        c.JSON(400, gin.H{"error": err.Error()})
        return
    }
    
    // 检查是否有邀请码
    var inviter *User
    if req.InviteCode != "" {
        var user User
        if err := DB.First(&user, "invite_code = ?", req.InviteCode).Error; err == nil {
            inviter = &user
        }
    }
    
    // 创建用户
    user := User{
        ID:        uuid.New().String(),
        Email:     req.Email,
        Plan:      "FREE",
        Status:    "active",
        InvitedBy: func() *string {
            if inviter != nil {
                return &inviter.ID
            }
            return nil
        }(),
    }
    
    // 开始事务
    tx := DB.Begin()
    
    // 保存用户
    if err := tx.Create(&user).Error; err != nil {
        tx.Rollback()
        c.JSON(500, gin.H{"error": "注册失败"})
        return
    }
    
    // 如果有邀请者，处理邀请奖励
    if inviter != nil {
        // 创建邀请记录
        invitation := Invitation{
            ID:         uuid.New().String(),
            InviterID:  inviter.ID,
            InviteeID:  user.ID,
            InviteCode: req.InviteCode,
            Status:     "accepted",
            InvitedAt:  time.Now(),
            AcceptedAt: &time.Time{},
            RewardDays:  30,
        }
        invitation.AcceptedAt = &invitation.InvitedAt
        
        if err := tx.Create(&invitation).Error; err != nil {
            tx.Rollback()
            c.JSON(500, gin.H{"error": "注册失败"})
            return
        }
        
        // 给新用户奖励30天Pro
        now := time.Now()
        user.PlanExpires = &now
        user.PlanExpires.AddDate(0, 0, 30)
        user.Plan = "PRO"
        
        // 给邀请者也奖励30天Pro（累加）
        if inviter.PlanExpires == nil || inviter.PlanExpires.Before(time.Now()) {
            // 当前没有Pro或已过期
            inviter.PlanExpires = &now
            inviter.PlanExpires.AddDate(0, 0, 30)
        } else {
            // 已有Pro，累加30天
            inviter.PlanExpires.AddDate(0, 0, 30)
        }
        inviter.Plan = "PRO"
        
        // 更新用户信息
        if err := tx.Save(&user).Error; err != nil {
            tx.Rollback()
            c.JSON(500, gin.H{"error": "注册失败"})
            return
        }
        
        if err := tx.Save(inviter).Error; err != nil {
            tx.Rollback()
            c.JSON(500, gin.H{"error": "注册失败"})
            return
        }
    }
    
    tx.Commit()
    
    c.JSON(200, gin.H{
        "message": "注册成功",
        "user": gin.H{
            "id":    user.ID,
            "email": user.Email,
            "plan":  user.Plan,
        },
    })
}
```

**3. 个人中心邀请模块**
```go
// 获取用户邀请信息
func GetInvitationInfo(c *gin.Context) {
    userID := c.GetString("user_id")
    
    var user User
    if err := DB.First(&user, "id = ?", userID).Error; err != nil {
        c.JSON(404, gin.H{"error": "用户不存在"})
        return
    }
    
    // 生成邀请链接
    inviteLink := GenerateInviteLink(userID)
    
    // 统计邀请数据
    var stats struct {
        TotalInvited    int    `json:"total_invited"`
        AcceptedInvited int    `json:"accepted_invited"`
        TotalRewards   int    `json:"total_rewards"` // 总奖励天数
        CurrentPlan    string `json:"current_plan"`
        PlanExpires    *time.Time `json:"plan_expires"`
    }
    
    DB.Model(&Invitation{}).Where("inviter_id = ?", userID).Count(&stats.TotalInvited)
    DB.Model(&Invitation{}).Where("inviter_id = ? AND status = 'accepted'", userID).Count(&stats.AcceptedInvited)
    
    var totalRewards int
    DB.Model(&Invitation{}).Where("inviter_id = ? AND status = 'accepted'", userID).Select("COALESCE(SUM(reward_days), 0)").Row().Scan(&totalRewards)
    stats.TotalRewards = totalRewards
    
    stats.CurrentPlan = user.Plan
    stats.PlanExpires = user.PlanExpires
    
    // 获取邀请历史
    var invitations []Invitation
    DB.Where("inviter_id = ?", userID).
        Preload("Invitee", "id, email, created_at, plan").
        Order("created_at DESC").
        Find(&invitations)
    
    c.JSON(200, gin.H{
        "invite_link":  inviteLink,
        "stats":       stats,
        "invitations": invitations,
    })
}
```

**4. 管理后台邀请记录模块**
```go
// 邀请排行榜
func GetInvitationLeaderboard(c *gin.Context) {
    var results []struct {
        UserID         string `json:"user_id"`
        Email          string `json:"email"`
        InvitedCount   int    `json:"invited_count"`
        AcceptedCount  int    `json:"accepted_count"`
        TotalRewardDays int   `json:"total_reward_days"`
        Rank           int    `json:"rank"`
    }
    
    // 使用子查询获取排行榜数据
    DB.Raw(`
        SELECT 
            u.id as user_id,
            u.email,
            COUNT(i.id) as invited_count,
            COUNT(CASE WHEN i.status = 'accepted' THEN 1 END) as accepted_count,
            COALESCE(SUM(CASE WHEN i.status = 'accepted' THEN i.reward_days ELSE 0 END), 0) as total_reward_days,
            RANK() OVER (ORDER BY COUNT(CASE WHEN i.status = 'accepted' THEN 1 END) DESC) as rank
        FROM users u
        LEFT JOIN invitations i ON u.id = i.inviter_id
        WHERE u.type = 'SAAS'
        GROUP BY u.id, u.email
        ORDER BY accepted_count DESC
        LIMIT ?
    `, 100).Scan(&results)
    
    c.JSON(200, gin.H{
        "leaderboard": results,
    })
}

// 邀请记录查询
func GetInvitationRecords(c *gin.Context) {
    page := c.DefaultQuery("page", "1")
    pageSize := c.DefaultQuery("page_size", "20")
    search := c.Query("search")
    
    query := DB.Model(&Invitation{}).
        Preload("Inviter", "id, email").
        Preload("Invitee", "id, email")
    
    if search != "" {
        query = query.Joins("LEFT JOIN users u1 ON invitations.inviter_id = u1.id").
            Joins("LEFT JOIN users u2 ON invitations.invitee_id = u2.id").
            Where("u1.email LIKE ? OR u2.email LIKE ?", "%"+search+"%", "%"+search+"%")
    }
    
    var total int64
    query.Count(&total)
    
    var records []Invitation
    offset := (atoi(page) - 1) * atoi(pageSize)
    query.Offset(offset).Limit(atoi(pageSize)).Order("created_at DESC").Find(&records)
    
    c.JSON(200, gin.H{
        "data": records,
        "pagination": gin.H{
            "page":        page,
            "page_size":   pageSize,
            "total":       total,
            "total_pages": (total + int64(atoi(pageSize)) - 1) / int64(atoi(pageSize)),
        },
    })
}
```

**5. 定时任务检查套餐过期**
```go
// 每天检查套餐过期
func CheckPlanExpiration() {
    scheduler.AddJob(&CronJob{
        Job:         &CheckPlanJob{},
        Schedule:    "0 0 0 * * *", // 每天零点执行
        Enabled:     true,
        Description: "Check user plan expiration",
        Timeout:     10 * time.Minute,
    })
}

type CheckPlanJob struct{}

func (j *CheckPlanJob) GetName() string {
    return "check_plan_expiration"
}

func (j *CheckPlanJob) GetDescription() string {
    return "Check and expire user plans"
}

func (j *CheckPlanJob) Run(ctx context.Context) error {
    // 查找已过期的Pro用户
    var users []User
    now := time.Now()
    
    DB.Where("plan = 'PRO' AND plan_expires <= ? AND plan_expires IS NOT NULL", now).
        Find(&users)
    
    for _, user := range users {
        // 降级为FREE
        user.Plan = "FREE"
        // 不清空plan_expires，保留历史记录
        
        DB.Save(&user)
        
        // 发送通知（邮件或站内信）
        SendPlanExpiredNotification(user)
    }
    
    log.Printf("Plan expiration check completed: %d users downgraded", len(users))
    return nil
}
```

#### 3.4.3 前端界面设计

**个人中心 - 邀请好友模块**
```jsx
// 邀请好友页面组件
const InviteFriends = () => {
    const [inviteData, setInviteData] = useState(null);
    const [copied, setCopied] = useState(false);
    
    useEffect(() => {
        fetchInviteData();
    }, []);
    
    const fetchInviteData = async () => {
        const res = await fetch('/api/user/invitation-info');
        const data = await res.json();
        setInviteData(data);
    };
    
    const copyInviteLink = () => {
        navigator.clipboard.writeText(inviteData.invite_link);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };
    
    return (
        <Box>
            {/* 邀请卡片 */}
            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <Typography variant="h6" gutterBottom>
                        邀请好友，双方各得30天Pro会员！
                    </Typography>
                    
                    <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
                        <Typography variant="body2" color="text.secondary">
                            你的专属邀请链接：
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                            <TextField
                                fullWidth
                                value={inviteData?.invite_link || ''}
                                size="small"
                                variant="outlined"
                                InputProps={{ readOnly: true }}
                            />
                            <Button
                                variant="contained"
                                sx={{ ml: 1 }}
                                onClick={copyInviteLink}
                            >
                                {copied ? '已复制' : '复制链接'}
                            </Button>
                        </Box>
                    </Box>
                    
                    {/* 统计数据 */}
                    <Grid container spacing={2} sx={{ mt: 2 }}>
                        <Grid item xs={4}>
                            <StatCard
                                title="已邀请"
                                value={inviteData?.stats.total_invited || 0}
                                icon={<PeopleIcon />}
                            />
                        </Grid>
                        <Grid item xs={4}>
                            <StatCard
                                title="成功注册"
                                value={inviteData?.stats.accepted_invited || 0}
                                icon={<CheckCircleIcon />}
                            />
                        </Grid>
                        <Grid item xs={4}>
                            <StatCard
                                title="获得奖励"
                                value={`${inviteData?.stats.total_rewards || 0}天`}
                                icon={<EmojiEventsIcon />}
                            />
                        </Grid>
                    </Grid>
                </CardContent>
            </Card>
            
            {/* 邀请历史 */}
            <Card>
                <CardHeader title="邀请历史" />
                <CardContent>
                    <TableContainer>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell>被邀请人</TableCell>
                                    <TableCell>邀请时间</TableCell>
                                    <TableCell>状态</TableCell>
                                    <TableCell>获得奖励</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {inviteData?.invitations?.map((inv) => (
                                    <TableRow key={inv.id}>
                                        <TableCell>{inv.invitee?.email}</TableCell>
                                        <TableCell>
                                            {new Date(inv.created_at).toLocaleDateString()}
                                        </TableCell>
                                        <TableCell>
                                            <Chip
                                                label={inv.status === 'accepted' ? '已接受' : '待处理'}
                                                color={inv.status === 'accepted' ? 'success' : 'default'}
                                                size="small"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            {inv.status === 'accepted' ? `${inv.reward_days}天` : '-'}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </CardContent>
            </Card>
        </Box>
    );
};
```

**管理后台 - 邀请记录模块**
```jsx
// 邀请记录管理页面
const InvitationManagement = () => {
    const [leaderboard, setLeaderboard] = useState([]);
    const [records, setRecords] = useState([]);
    const [pagination, setPagination] = useState({});
    const [search, setSearch] = useState('');
    
    useEffect(() => {
        fetchLeaderboard();
        fetchRecords();
    }, []);
    
    const fetchLeaderboard = async () => {
        const res = await fetch('/api/admin/invitation-leaderboard');
        const data = await res.json();
        setLeaderboard(data.leaderboard);
    };
    
    const fetchRecords = async (page = 1) => {
        const res = await fetch(`/api/admin/invitation-records?page=${page}&search=${search}`);
        const data = await res.json();
        setRecords(data.data);
        setPagination(data.pagination);
    };
    
    return (
        <Box>
            <Typography variant="h4" gutterBottom>
                邀请记录管理
            </Typography>
            
            <Grid container spacing={3}>
                {/* 邀请排行榜 */}
                <Grid item xs={12} md={6}>
                    <Card>
                        <CardHeader title="邀请排行榜" />
                        <CardContent>
                            <TableContainer>
                                <Table size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>排名</TableCell>
                                            <TableCell>用户</TableCell>
                                            <TableCell>成功邀请</TableCell>
                                            <TableCell>总奖励天数</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {leaderboard.map((item, index) => (
                                            <TableRow key={item.user_id}>
                                                <TableCell>
                                                    {index < 3 ? (
                                                        <IconButton color="primary">
                                                            {index === 0 ? <EmojiEventsIcon /> : 
                                                             index === 1 ? <MilitaryTechIcon /> : 
                                                             <WorkspacePremiumIcon />}
                                                        </IconButton>
                                                    ) : (
                                                        `#${item.rank}`
                                                    )}
                                                </TableCell>
                                                <TableCell>{item.email}</TableCell>
                                                <TableCell>{item.accepted_count}</TableCell>
                                                <TableCell>{item.total_reward_days}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </CardContent>
                    </Card>
                </Grid>
                
                {/* 邀请记录列表 */}
                <Grid item xs={12}>
                    <Card>
                        <CardHeader 
                            title="邀请记录"
                            action={
                                <TextField
                                    size="small"
                                    placeholder="搜索邮箱..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    InputProps={{
                                        startAdornment: <SearchIcon />
                                    }}
                                />
                            }
                        />
                        <CardContent>
                            <TableContainer>
                                <Table>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>邀请者</TableCell>
                                            <TableCell>被邀请者</TableCell>
                                            <TableCell>邀请码</TableCell>
                                            <TableCell>状态</TableCell>
                                            <TableCell>邀请时间</TableCell>
                                            <TableCell>奖励</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {records.map((record) => (
                                            <TableRow key={record.id}>
                                                <TableCell>{record.inviter?.email}</TableCell>
                                                <TableCell>{record.invitee?.email}</TableCell>
                                                <TableCell>{record.invite_code}</TableCell>
                                                <TableCell>
                                                    <Chip
                                                        label={record.status}
                                                        color={record.status === 'accepted' ? 'success' : 'default'}
                                                        size="small"
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    {new Date(record.created_at).toLocaleString()}
                                                </TableCell>
                                                <TableCell>
                                                    {record.status === 'accepted' ? 
                                                        `${record.reward_days}天` : '-'}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                            
                            {/* 分页 */}
                            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}>
                                <Pagination
                                    count={pagination.total_pages}
                                    page={pagination.page}
                                    onChange={(e, page) => fetchRecords(page)}
                                />
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>
        </Box>
    );
};
```

### 3.5 签到系统设计

#### 3.5.1 数据模型设计

```go
// 签到记录模型
type CheckInRecord struct {
    BaseModel
    UserID        string    `gorm:"index"`          // 用户ID
    CheckInDate   string    `gorm:"index"`          // 签到日期（YYYY-MM-DD）
    ContinuousDays int      `gorm:"default:0"`      // 连续签到天数
    TokenReward   int64     `gorm:"default:0"`      // 获得的Token数量
    CheckInAt     time.Time // 签到时间
}

// 用户模型扩展（添加签到相关字段）
type User struct {
    BaseModel
    Email        string    `gorm:"uniqueIndex"`
    Type         string    `gorm:"type:enum('SAAS','ADMIN');default:'SAAS'"`
    Plan         string    // FREE/PRO/MAX
    TokenBalance int64     // Token余额
    Status       string    // active/inactive
    
    // 邀请相关字段
    InvitedBy    *string   // 被谁邀请的（外键）
    InviteCode   string    `gorm:"uniqueIndex"` // 该用户的专属邀请码
    PlanExpires  *time.Time // 套餐过期时间
    
    // 签到相关字段
    LastCheckIn  *string   // 上次签到日期
    ContinuousDays int     // 当前连续签到天数
    TotalCheckIns int      `gorm:"default:0"` // 总签到次数
    
    // ... 其他字段
}
```

#### 3.5.2 功能实现

**1. 签到逻辑实现**
```go
// Token奖励阶梯配置
var tokenRewards = map[int]int64{
    1:  10,  // 第1天：10个token
    2:  20,  // 第2天：20个token
    3:  40,  // 第3天：40个token
    4:  80,  // 第4天及以上：80个token
}

// 获取今日应得Token
func getTokenReward(continuousDays int) int64 {
    if continuousDays >= 4 {
        return tokenRewards[4]
    }
    return tokenRewards[continuousDays]
}

// 签到处理函数
func CheckInHandler(c *gin.Context) {
    userID := c.GetString("user_id")
    
    // 获取用户信息
    var user User
    if err := DB.First(&user, "id = ?", userID).Error; err != nil {
        c.JSON(404, gin.H{"error": "用户不存在"})
        return
    }
    
    today := time.Now().Format("2006-01-02")
    
    // 检查今日是否已签到
    var existingRecord CheckInRecord
    if err := DB.Where("user_id = ? AND check_in_date = ?", userID, today).First(&existingRecord).Error; err == nil {
        c.JSON(400, gin.H{"error": "今日已签到"})
        return
    }
    
    // 计算连续签到天数
    continuousDays := 1
    if user.LastCheckIn != nil {
        lastDate, _ := time.Parse("2006-01-02", *user.LastCheckIn)
        if lastDate.AddDate(0, 0, 1).Format("2006-01-02") == today {
            // 昨天签到了，连续天数+1
            continuousDays = user.ContinuousDays + 1
        }
    }
    
    // 获取应得Token
    tokenReward := getTokenReward(continuousDays)
    
    // 开始事务
    tx := DB.Begin()
    
    // 创建签到记录
    record := CheckInRecord{
        ID:            uuid.New().String(),
        UserID:        userID,
        CheckInDate:   today,
        ContinuousDays: continuousDays,
        TokenReward:   tokenReward,
        CheckInAt:     time.Now(),
    }
    
    if err := tx.Create(&record).Error; err != nil {
        tx.Rollback()
        c.JSON(500, gin.H{"error": "签到失败"})
        return
    }
    
    // 更新用户信息
    user.LastCheckIn = &today
    user.ContinuousDays = continuousDays
    user.TotalCheckIns++
    user.TokenBalance += tokenReward
    
    if err := tx.Save(&user).Error; err != nil {
        tx.Rollback()
        c.JSON(500, gin.H{"error": "签到失败"})
        return
    }
    
    // 创建Token交易记录
    transaction := Transaction{
        ID:          uuid.New().String(),
        UserID:      userID,
        Type:        "EARN",
        Amount:      tokenReward,
        Description: fmt.Sprintf("连续签到%d天奖励", continuousDays),
        Status:      "completed",
        CreatedAt:   time.Now(),
    }
    
    if err := tx.Create(&transaction).Error; err != nil {
        tx.Rollback()
        c.JSON(500, gin.H{"error": "签到失败"})
        return
    }
    
    tx.Commit()
    
    c.JSON(200, gin.H{
        "message": "签到成功",
        "reward": gin.H{
            "tokens":         tokenReward,
            "continuous_days": continuousDays,
            "balance":        user.TokenBalance,
        },
    })
}
```

**2. 获取签到状态**
```go
// 获取用户签到信息
func GetCheckInInfo(c *gin.Context) {
    userID := c.GetString("user_id")
    
    // 获取用户信息
    var user User
    if err := DB.First(&user, "id = ?", userID).Error; err != nil {
        c.JSON(404, gin.H{"error": "用户不存在"})
        return
    }
    
    today := time.Now().Format("2006-01-02")
    
    // 检查今日是否已签到
    var todayRecord CheckInRecord
    isCheckedIn := false
    if err := DB.Where("user_id = ? AND check_in_date = ?", userID, today).First(&todayRecord).Error; err == nil {
        isCheckedIn = true
    }
    
    // 获取本月签到记录
    monthStart := time.Now().Format("2006-01") + "-01"
    var monthRecords []CheckInRecord
    DB.Where("user_id = ? AND check_in_date >= ?", userID, monthStart).
        Order("check_in_date DESC").
        Find(&monthRecords)
    
    // 计算今日可获得的Token
    var todayReward int64
    if !isCheckedIn {
        todayReward = getTokenReward(user.ContinuousDays + 1)
    }
    
    // 构建日历数据
    calendar := make(map[string]bool)
    for _, record := range monthRecords {
        calendar[record.CheckInDate] = true
    }
    
    c.JSON(200, gin.H{
        "checked_in": isCheckedIn,
        "continuous_days": user.ContinuousDays,
        "total_check_ins": user.TotalCheckIns,
        "today_reward": todayReward,
        "month_calendar": calendar,
        "recent_records": monthRecords[:7], // 最近7条记录
    })
}
```

**3. 管理后台签到记录查询**
```go
// 获取所有用户签到记录
func GetCheckInRecords(c *gin.Context) {
    page := c.DefaultQuery("page", "1")
    pageSize := c.DefaultQuery("page_size", "20")
    startDate := c.Query("start_date")
    endDate := c.Query("end_date")
    userID := c.Query("user_id")
    
    query := DB.Model(&CheckInRecord{}).
        Preload("User", "id, email").
        Order("check_in_date DESC, created_at DESC")
    
    // 筛选条件
    if startDate != "" {
        query = query.Where("check_in_date >= ?", startDate)
    }
    if endDate != "" {
        query = query.Where("check_in_date <= ?", endDate)
    }
    if userID != "" {
        query = query.Where("user_id = ?", userID)
    }
    
    var total int64
    query.Count(&total)
    
    var records []CheckInRecord
    offset := (atoi(page) - 1) * atoi(pageSize)
    query.Offset(offset).Limit(atoi(pageSize)).Find(&records)
    
    // 统计数据
    var stats struct {
        TotalCheckIns    int64 `json:"total_check_ins"`
        TotalTokenReward int64 `json:"total_token_reward"`
        UniqueUsers      int64 `json:"unique_users"`
    }
    
    statsQuery := DB.Model(&CheckInRecord{})
    if startDate != "" {
        statsQuery = statsQuery.Where("check_in_date >= ?", startDate)
    }
    if endDate != "" {
        statsQuery = statsQuery.Where("check_in_date <= ?", endDate)
    }
    
    statsQuery.Count(&stats.TotalCheckIns)
    statsQuery.Select("COALESCE(SUM(token_reward), 0)").Row().Scan(&stats.TotalTokenReward)
    statsQuery.Select("COUNT(DISTINCT user_id)").Row().Scan(&stats.UniqueUsers)
    
    c.JSON(200, gin.H{
        "data": records,
        "stats": stats,
        "pagination": gin.H{
            "page":        page,
            "page_size":   pageSize,
            "total":       total,
            "total_pages": (total + int64(atoi(pageSize)) - 1) / int64(atoi(pageSize)),
        },
    })
}

// 获取签到统计排行
func GetCheckInLeaderboard(c *gin.Context) {
    period := c.DefaultQuery("period", "month") // week/month/all
    
    var results []struct {
        UserID        string `json:"user_id"`
        Email         string `json:"email"`
        CheckInCount  int    `json:"check_in_count"`
        TotalTokens   int64  `json:"total_tokens"`
        ContinuousDays int   `json:"continuous_days"`
        Rank          int    `json:"rank"`
    }
    
    // 根据时间段构建查询
    var dateCondition string
    now := time.Now()
    
    switch period {
    case "week":
        dateCondition = fmt.Sprintf("AND check_in_date >= '%s'", now.AddDate(0, 0, -7).Format("2006-01-02"))
    case "month":
        dateCondition = fmt.Sprintf("AND check_in_date >= '%s'", now.AddDate(0, -1, 0).Format("2006-01-02"))
    }
    
    DB.Raw(fmt.Sprintf(`
        SELECT 
            u.id as user_id,
            u.email,
            COUNT(c.id) as check_in_count,
            COALESCE(SUM(c.token_reward), 0) as total_tokens,
            u.continuous_days,
            RANK() OVER (ORDER BY COUNT(c.id) DESC, u.continuous_days DESC) as rank
        FROM users u
        LEFT JOIN check_in_records c ON u.id = c.user_id %s
        WHERE u.type = 'SAAS'
        GROUP BY u.id, u.email, u.continuous_days
        ORDER BY check_in_count DESC, continuous_days DESC
        LIMIT 50
    `, dateCondition)).Scan(&results)
    
    c.JSON(200, gin.H{
        "leaderboard": results,
        "period": period,
    })
}
```

**4. 定时任务重置连续签到**
```go
// 每天零点检查未签到用户，重置连续天数
func ResetContinuousCheckIn() {
    scheduler.AddJob(&CronJob{
        Job:         &ResetCheckInJob{},
        Schedule:    "0 5 0 * * *", // 每天零点5分执行（避免时区问题）
        Enabled:     true,
        Description: "Reset continuous check-in days",
        Timeout:     5 * time.Minute,
    })
}

type ResetCheckInJob struct{}

func (j *ResetCheckInJob) GetName() string {
    return "reset_continuous_checkin"
}

func (j *ResetCheckInJob) GetDescription() string {
    return "Reset continuous check-in days for users who missed check-in"
}

func (j *ResetCheckInJob) Run(ctx context.Context) error {
    yesterday := time.Now().AddDate(0, 0, -1).Format("2006-01-02")
    today := time.Now().Format("2006-01-02")
    
    // 找出昨天有签到记录但今天没有签到的用户
    var users []User
    DB.Raw(`
        SELECT u.* FROM users u
        INNER JOIN check_in_records c ON u.id = c.user_id AND c.check_in_date = ?
        WHERE u.type = 'SAAS' 
        AND u.continuous_days > 0
        AND NOT EXISTS (
            SELECT 1 FROM check_in_records 
            WHERE user_id = u.id AND check_in_date = ?
        )
    `, yesterday, today).Scan(&users)
    
    for _, user := range users {
        user.ContinuousDays = 0
        DB.Save(&user)
    }
    
    log.Printf("Reset continuous check-in for %d users", len(users))
    return nil
}
```

#### 3.5.3 前端界面设计

**个人中心 - 签到模块**
```jsx
// 签到页面组件
const DailyCheckIn = () => {
    const [checkInData, setCheckInData] = useState(null);
    const [loading, setLoading] = useState(false);
    
    useEffect(() => {
        fetchCheckInInfo();
    }, []);
    
    const fetchCheckInInfo = async () => {
        const res = await fetch('/api/user/checkin-info');
        const data = await res.json();
        setCheckInData(data);
    };
    
    const handleCheckIn = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/user/checkin', {
                method: 'POST',
            });
            const data = await res.json();
            
            if (res.ok) {
                showSuccess(`签到成功！获得 ${data.reward.tokens} 个Token`);
                fetchCheckInInfo();
            } else {
                showError(data.error);
            }
        } catch (error) {
            showError('签到失败');
        } finally {
            setLoading(false);
        }
    };
    
    const renderCalendar = () => {
        const calendar = checkInData?.month_calendar || {};
        const daysInMonth = new Date().getDate();
        const calendarDays = [];
        
        for (let i = 1; i <= daysInMonth; i++) {
            const date = new Date();
            date.setDate(i);
            const dateStr = date.toISOString().split('T')[0];
            const isToday = dateStr === new Date().toISOString().split('T')[0];
            const isCheckedIn = calendar[dateStr];
            
            calendarDays.push(
                <Box
                    key={i}
                    sx={{
                        width: 40,
                        height: 40,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '1px solid',
                        borderColor: isCheckedIn ? 'success.main' : 'grey.300',
                        borderRadius: 1,
                        bgcolor: isCheckedIn ? 'success.light' : 'background.paper',
                        position: 'relative',
                    }}
                >
                    <Typography
                        variant="body2"
                        color={isToday ? 'primary' : 'text.primary'}
                        fontWeight={isToday ? 'bold' : 'normal'}
                    >
                        {i}
                    </Typography>
                    {isCheckedIn && (
                        <CheckCircleIcon
                            sx={{
                                position: 'absolute',
                                bottom: -2,
                                right: -2,
                                fontSize: 16,
                                color: 'success.main',
                            }}
                        />
                    )}
                </Box>
            );
        }
        
        return calendarDays;
    };
    
    return (
        <Box>
            {/* 签到卡片 */}
            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <Typography variant="h6" gutterBottom>
                        每日签到
                    </Typography>
                    
                    {/* 奖励说明 */}
                    <Alert severity="info" sx={{ mb: 2 }}>
                        <Typography variant="body2">
                            连续签到奖励：第1天 10 Token | 第2天 20 Token | 第3天 40 Token | 第4天+ 80 Token
                        </Typography>
                    </Alert>
                    
                    {/* 签到状态 */}
                    <Box sx={{ textAlign: 'center', py: 2 }}>
                        {checkInData?.checked_in ? (
                            <Box>
                                <CheckCircleIcon sx={{ fontSize: 64, color: 'success.main' }} />
                                <Typography variant="h6" color="success.main" sx={{ mt: 1 }}>
                                    今日已签到
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    连续签到 {checkInData.continuous_days} 天
                                </Typography>
                            </Box>
                        ) : (
                            <Box>
                                <EmojiEventsIcon sx={{ fontSize: 64, color: 'warning.main' }} />
                                <Typography variant="h6" sx={{ mt: 1 }}>
                                    今日可领取
                                </Typography>
                                <Typography variant="h4" color="primary" sx={{ my: 1 }}>
                                    {checkInData?.today_reward || 0} Token
                                </Typography>
                                <Button
                                    variant="contained"
                                    size="large"
                                    onClick={handleCheckIn}
                                    disabled={loading}
                                    sx={{ mt: 1 }}
                                >
                                    {loading ? <CircularProgress size={24} /> : '立即签到'}
                                </Button>
                            </Box>
                        )}
                    </Box>
                    
                    {/* 统计数据 */}
                    <Grid container spacing={2} sx={{ mt: 2 }}>
                        <Grid item xs={4}>
                            <StatCard
                                title="连续签到"
                                value={`${checkInData?.continuous_days || 0}天`}
                                icon={<CalendarTodayIcon />}
                            />
                        </Grid>
                        <Grid item xs={4}>
                            <StatCard
                                title="累计签到"
                                value={checkInData?.total_check_ins || 0}
                                icon={<EventAvailableIcon />}
                            />
                        </Grid>
                        <Grid item xs={4}>
                            <StatCard
                                title="获得Token"
                                value={`${checkInData?.recent_records?.reduce((sum, r) => sum + r.token_reward, 0) || 0}`}
                                icon={<PaidIcon />}
                            />
                        </Grid>
                    </Grid>
                </CardContent>
            </Card>
            
            {/* 本月签到日历 */}
            <Card>
                <CardHeader title="本月签到日历" />
                <CardContent>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        {renderCalendar()}
                    </Box>
                    <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box sx={{ width: 20, height: 20, bgcolor: 'success.light', border: '1px solid', borderColor: 'success.main' }} />
                            <Typography variant="body2">已签到</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box sx={{ width: 20, height: 20, bgcolor: 'background.paper', border: '1px solid', borderColor: 'grey.300' }} />
                            <Typography variant="body2">未签到</Typography>
                        </Box>
                    </Box>
                </CardContent>
            </Card>
        </Box>
    );
};
```

**管理后台 - 签到记录管理**
```jsx
// 签到记录管理页面
const CheckInManagement = () => {
    const [records, setRecords] = useState([]);
    const [stats, setStats] = useState({});
    const [pagination, setPagination] = useState({});
    const [filters, setFilters] = useState({
        start_date: '',
        end_date: '',
        user_id: '',
    });
    const [page, setPage] = useState(1);
    
    useEffect(() => {
        fetchRecords();
    }, [page, filters]);
    
    const fetchRecords = async () => {
        const params = new URLSearchParams({
            page: page.toString(),
            page_size: '20',
            ...filters,
        });
        
        const res = await fetch(`/api/admin/checkin-records?${params}`);
        const data = await res.json();
        setRecords(data.data);
        setStats(data.stats);
        setPagination(data.pagination);
    };
    
    const handleFilterChange = (key, value) => {
        setFilters(prev => ({ ...prev, [key]: value }));
        setPage(1);
    };
    
    return (
        <Box>
            <Typography variant="h4" gutterBottom>
                签到记录管理
            </Typography>
            
            {/* 统计卡片 */}
            <Grid container spacing={3} sx={{ mb: 3 }}>
                <Grid item xs={12} md={4}>
                    <StatCard
                        title="总签到次数"
                        value={stats.total_check_ins || 0}
                        icon={<HowToRegIcon />}
                    />
                </Grid>
                <Grid item xs={12} md={4}>
                    <StatCard
                        title="发放Token总数"
                        value={stats.total_token_reward || 0}
                        icon={<PaidIcon />}
                    />
                </Grid>
                <Grid item xs={12} md={4}>
                    <StatCard
                        title="参与用户数"
                        value={stats.unique_users || 0}
                        icon={<PeopleIcon />}
                    />
                </Grid>
            </Grid>
            
            {/* 筛选器 */}
            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <Grid container spacing={2}>
                        <Grid item xs={12} md={4}>
                            <TextField
                                fullWidth
                                label="开始日期"
                                type="date"
                                value={filters.start_date}
                                onChange={(e) => handleFilterChange('start_date', e.target.value)}
                                InputLabelProps={{ shrink: true }}
                            />
                        </Grid>
                        <Grid item xs={12} md={4}>
                            <TextField
                                fullWidth
                                label="结束日期"
                                type="date"
                                value={filters.end_date}
                                onChange={(e) => handleFilterChange('end_date', e.target.value)}
                                InputLabelProps={{ shrink: true }}
                            />
                        </Grid>
                        <Grid item xs={12} md={4}>
                            <TextField
                                fullWidth
                                label="用户ID"
                                value={filters.user_id}
                                onChange={(e) => handleFilterChange('user_id', e.target.value)}
                            />
                        </Grid>
                    </Grid>
                </CardContent>
            </Card>
            
            {/* 签到记录列表 */}
            <Card>
                <CardHeader title="签到记录" />
                <CardContent>
                    <TableContainer>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell>用户</TableCell>
                                    <TableCell>签到日期</TableCell>
                                    <TableCell>连续天数</TableCell>
                                    <TableCell>获得Token</TableCell>
                                    <TableCell>签到时间</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {records.map((record) => (
                                    <TableRow key={record.id}>
                                        <TableCell>
                                            <Box>
                                                <Typography variant="body2">
                                                    {record.user?.email}
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    ID: {record.user_id}
                                                </Typography>
                                            </Box>
                                        </TableCell>
                                        <TableCell>{record.check_in_date}</TableCell>
                                        <TableCell>
                                            <Chip
                                                label={`${record.continuous_days}天`}
                                                color={record.continuous_days >= 7 ? 'success' : 'primary'}
                                                size="small"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Typography variant="body2" color="primary">
                                                +{record.token_reward}
                                            </Typography>
                                        </TableCell>
                                        <TableCell>
                                            {new Date(record.check_in_at).toLocaleString()}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                    
                    {/* 分页 */}
                    <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}>
                        <Pagination
                            count={pagination.total_pages}
                            page={pagination.page}
                            onChange={(e, p) => setPage(p)}
                        />
                    </Box>
                </CardContent>
            </Card>
        </Box>
    );
};
```

### 3.6 Token经济系统设计

为了满足用户额外的Token需求，建立完整的Token经济体系，包括购买、消费、过期等全生命周期管理。

#### 3.6.1 系统架构

**Token类型设计**
1. **套餐Token** (plan_token)
   - 来源：购买套餐获得
   - 特点：随套餐过期而过期
   - 优先级：最高（先消费）

2. **活动Token** (activity_token)
   - 来源：签到、邀请奖励等
   - 特点：30天后过期
   - 优先级：中等

3. **购买Token** (purchase_token)
   - 来源：单独购买
   - 特点：永不过期
   - 优先级：最低（最后消费）

**核心数据模型**
```go
// 用户Token钱包
type TokenWallet struct {
    ID           string    `json:"id" gorm:"primaryKey"`
    UserID       string    `json:"user_id" gorm:"index"`
    TenantID     string    `json:"tenant_id" gorm:"index"`
    PlanTokens   int       `json:"plan_tokens"`
    ActivityTokens int      `json:"activity_tokens"`
    PurchaseTokens int      `json:"purchase_tokens"`
    TotalTokens  int       `json:"total_tokens"`
    CreatedAt    time.Time `json:"created_at"`
    UpdatedAt    time.Time `json:"updated_at"`
}

// Token变动记录
type TokenTransaction struct {
    ID          string       `json:"id" gorm:"primaryKey"`
    UserID      string       `json:"user_id" gorm:"index"`
    TenantID    string       `json:"tenant_id" gorm:"index"`
    Type        TokenType    `json:"type" gorm:"index"` // plan/activity/purchase
    Amount      int          `json:"amount"`
    Balance     int          `json:"balance"`          // 交易后该类型余额
    Action      TokenAction  `json:"action" gorm:"index"` // add/consume/expire
    Source      string       `json:"source"`           // 来源描述
    RelatedID   string       `json:"related_id"`       // 关联业务ID
    CreatedAt   time.Time    `json:"created_at"`
    ExpireAt    *time.Time   `json:"expire_at"`        // 过期时间（activity_token需要）
}

// Token产品配置
type TokenProduct struct {
    ID          string    `json:"id" gorm:"primaryKey"`
    Name        string    `json:"name"`
    Description string    `json:"description"`
    Tokens      int       `json:"tokens"`
    Price       float64   `json:"price"`
    Currency    string    `json:"currency"` // CNY/USD
    IsPopular   bool      `json:"is_popular"`
    IsActive    bool      `json:"is_active" gorm:"default:true"`
    Sort        int       `json:"sort"`
    CreatedAt   time.Time `json:"created_at"`
    UpdatedAt   time.Time `json:"updated_at"`
}

// Token消费规则（热配置）
type TokenConsumeRule struct {
    ID          string          `json:"id" gorm:"primaryKey"`
    Module      string          `json:"module" gorm:"index"`       // 模块名称：batchgo/siterankgo
    Action      string          `json:"action" gorm:"index"`       // 具体操作
    BaseCost    int             `json:"base_cost"`                // 基础消耗
    Multiplier  float64         `json:"multiplier"`               // 乘数（根据参数动态调整）
    Conditions  json.RawMessage `json:"conditions" gorm:"type:json"` // 条件配置
    IsActive    bool            `json:"is_active" gorm:"default:true"`
    Version     int             `json:"version"`                  // 版本号，用于热更新
    CreatedAt   time.Time       `json:"created_at"`
    UpdatedAt   time.Time       `json:"updated_at"`
}

type TokenType string
const (
    TokenPlan      TokenType = "plan"
    TokenActivity  TokenType = "activity"
    TokenPurchase  TokenType = "purchase"
)

type TokenAction string
const (
    TokenAdd      TokenAction = "add"
    TokenConsume  TokenAction = "consume"
    TokenExpire   TokenAction = "expire"
)
```

#### 3.6.2 核心功能实现

**1. Token购买流程**
```go
// 创建支付订单
func CreateTokenOrder(c *gin.Context) {
    userID := getCurrentUserID(c)
    var req struct {
        ProductID  string `json:"product_id" binding:"required"`
        PaymentMethod string `json:"payment_method"` // alipay/wechat
    }
    
    if err := c.ShouldBind(&req); err != nil {
        c.JSON(400, gin.H{"error": err.Error()})
        return
    }
    
    // 获取产品信息
    var product TokenProduct
    if err := DB.First(&product, "id = ? AND is_active = ?", req.ProductID, true).Error; err != nil {
        c.JSON(404, gin.H{"error": "产品不存在"})
        return
    }
    
    // 创建订单
    order := &PaymentOrder{
        ID:           generateOrderID(),
        UserID:       userID,
        TenantID:     getCurrentTenantID(c),
        Type:         "token_purchase",
        ProductID:    product.ID,
        Amount:       product.Price,
        Currency:     product.Currency,
        Status:       "pending",
        PaymentMethod: req.PaymentMethod,
        Metadata:     map[string]interface{}{
            "tokens": product.Tokens,
        },
    }
    
    DB.Create(order)
    
    // 调用支付网关
    paymentURL, err := paymentGateway.CreatePayment(order)
    if err != nil {
        c.JSON(500, gin.H{"error": "创建支付失败"})
        return
    }
    
    c.JSON(200, gin.H{
        "order_id": order.ID,
        "payment_url": paymentURL,
    })
}

// 支付成功回调处理
func HandleTokenPaymentCallback(c *gin.Context) {
    orderID := c.Param("order_id")
    
    var order PaymentOrder
    if err := DB.First(&order, "id = ?", orderID).Error; err != nil {
        c.JSON(404, gin.H{"error": "订单不存在"})
        return
    }
    
    // 验证支付状态
    if paymentGateway.VerifyPayment(order) {
        // 更新订单状态
        order.Status = "completed"
        order.PaidAt = time.Now()
        DB.Save(&order)
        
        // 增加Token（事务操作）
        err := DB.Transaction(func(tx *gorm.DB) error {
            // 更新钱包
            var wallet TokenWallet
            if err := tx.FirstOrCreate(&wallet, "user_id = ?", order.UserID).Error; err != nil {
                return err
            }
            
            wallet.PurchaseTokens += order.Metadata["tokens"].(int)
            wallet.TotalTokens += order.Metadata["tokens"].(int)
            if err := tx.Save(&wallet).Error; err != nil {
                return err
            }
            
            // 记录交易
            transaction := &TokenTransaction{
                ID:        generateUUID(),
                UserID:    order.UserID,
                TenantID:  order.TenantID,
                Type:      TokenPurchase,
                Amount:    order.Metadata["tokens"].(int),
                Balance:   wallet.PurchaseTokens,
                Action:    TokenAdd,
                Source:    fmt.Sprintf("购买-%sToken", product.Name),
                RelatedID: order.ID,
            }
            return tx.Create(transaction).Error
        })
        
        if err != nil {
            log.Printf("Failed to add tokens: %v", err)
            c.JSON(500, gin.H{"error": "添加Token失败"})
            return
        }
        
        c.JSON(200, gin.H{"status": "success"})
    } else {
        c.JSON(400, gin.H{"error": "支付验证失败"})
    }
}
```

**2. Token消费优先级算法**
```go
// 消费Token（按优先级）
func ConsumeTokens(c *gin.Context, userID, tenantID string, module, action string, params map[string]interface{}) error {
    // 获取消费规则
    var rule TokenConsumeRule
    if err := cache.Get("token_rule:"+module+":"+action, &rule); err != nil {
        if err := DB.First(&rule, "module = ? AND action = ? AND is_active = ?", module, action, true).Error; err != nil {
            return fmt.Errorf("消费规则不存在")
        }
        cache.Set("token_rule:"+module+":"+action, rule, time.Hour)
    }
    
    // 计算实际消耗
    cost := calculateTokenCost(&rule, params)
    
    // 事务消费
    return DB.Transaction(func(tx *gorm.DB) error {
        // 获取用户钱包（行级锁）
        var wallet TokenWallet
        if err := tx.Set("gorm:query_option", "FOR UPDATE").First(&wallet, "user_id = ?", userID).Error; err != nil {
            return err
        }
        
        if wallet.TotalTokens < cost {
            return fmt.Errorf("Token不足")
        }
        
        remaining := cost
        transactions := make([]*TokenTransaction, 0)
        
        // 1. 先消费套餐Token
        if wallet.PlanTokens > 0 {
            consume := min(remaining, wallet.PlanTokens)
            wallet.PlanTokens -= consume
            remaining -= consume
            
            transactions = append(transactions, &TokenTransaction{
                ID:        generateUUID(),
                UserID:    userID,
                TenantID:  tenantID,
                Type:      TokenPlan,
                Amount:    -consume,
                Balance:   wallet.PlanTokens,
                Action:    TokenConsume,
                Source:    fmt.Sprintf("%s-%s", module, action),
                RelatedID: params["task_id"].(string),
            })
        }
        
        // 2. 再消费活动Token
        if remaining > 0 && wallet.ActivityTokens > 0 {
            consume := min(remaining, wallet.ActivityTokens)
            wallet.ActivityTokens -= consume
            remaining -= consume
            
            transactions = append(transactions, &TokenTransaction{
                ID:        generateUUID(),
                UserID:    userID,
                TenantID:  tenantID,
                Type:      TokenActivity,
                Amount:    -consume,
                Balance:   wallet.ActivityTokens,
                Action:    TokenConsume,
                Source:    fmt.Sprintf("%s-%s", module, action),
                RelatedID: params["task_id"].(string),
            })
        }
        
        // 3. 最后消费购买Token
        if remaining > 0 && wallet.PurchaseTokens > 0 {
            consume := min(remaining, wallet.PurchaseTokens)
            wallet.PurchaseTokens -= consume
            remaining -= consume
            
            transactions = append(transactions, &TokenTransaction{
                ID:        generateUUID(),
                UserID:    userID,
                TenantID:  tenantID,
                Type:      TokenPurchase,
                Amount:    -consume,
                Balance:   wallet.PurchaseTokens,
                Action:    TokenConsume,
                Source:    fmt.Sprintf("%s-%s", module, action),
                RelatedID: params["task_id"].(string),
            })
        }
        
        if remaining > 0 {
            return fmt.Errorf("Token不足")
        }
        
        // 更新钱包
        wallet.TotalTokens -= cost
        if err := tx.Save(&wallet).Error; err != nil {
            return err
        }
        
        // 批量记录交易
        return tx.CreateInBatches(transactions, 100).Error
    })
}

// 计算动态消耗
func calculateTokenCost(rule *TokenConsumeRule, params map[string]interface{}) int {
    cost := rule.BaseCost
    
    // 根据条件计算乘数
    switch rule.Module {
    case "batchgo":
        // 根据URL数量调整
        if urls, ok := params["urls"].([]string); ok {
            multiplier := float64(len(urls)) * rule.Multiplier
            cost = int(float64(cost) * multiplier)
        }
    case "siterankgo":
        // 根据查询域名数量调整
        if domains, ok := params["domains"].([]string); ok {
            multiplier := float64(len(domains)) * rule.Multiplier
            cost = int(float64(cost) * multiplier)
        }
    }
    
    return cost
}
```

**3. Token过期处理**
```go
// 定时检查过期Token
func CheckExpiredTokens() {
    scheduler.AddJob(&CronJob{
        Job:         &ExpireTokensJob{},
        Schedule:    "0 0 2 * * *", // 每天凌晨2点
        Enabled:     true,
        Description: "Check and expire activity tokens",
        Timeout:     10 * time.Minute,
    })
}

type ExpireTokensJob struct{}

func (j *ExpireTokensJob) GetName() string {
    return "expire_activity_tokens"
}

func (j *ExpireTokensJob) GetDescription() string {
    return "Expire activity tokens older than 30 days"
}

func (j *ExpireTokensJob) Run(ctx context.Context) error {
    // 找出30天前的活动Token记录
    expireDate := time.Now().AddDate(0, 0, -30)
    
    var transactions []TokenTransaction
    DB.Where("type = ? AND action = ? AND created_at < ?", 
        TokenActivity, TokenAdd, expireDate).Find(&transactions)
    
    // 按用户分组处理
    userTokens := make(map[string]int)
    for _, t := range transactions {
        if t.Amount > 0 { // 只处理增加的记录
            userTokens[t.UserID] += t.Amount
        }
    }
    
    // 批量更新
    for userID, totalExpire := range userTokens {
        err := DB.Transaction(func(tx *gorm.DB) error {
            // 获取当前钱包
            var wallet TokenWallet
            if err := tx.First(&wallet, "user_id = ?", userID).Error; err != nil {
                return nil // 用户可能已删除
            }
            
            // 计算实际过期数量（不能超过当前余额）
            actualExpire := min(totalExpire, wallet.ActivityTokens)
            if actualExpire == 0 {
                return nil
            }
            
            // 更新钱包
            wallet.ActivityTokens -= actualExpire
            wallet.TotalTokens -= actualExpire
            if err := tx.Save(&wallet).Error; err != nil {
                return err
            }
            
            // 记录过期
            expireRecord := &TokenTransaction{
                ID:        generateUUID(),
                UserID:    userID,
                TenantID:  wallet.TenantID,
                Type:      TokenActivity,
                Amount:    -actualExpire,
                Balance:   wallet.ActivityTokens,
                Action:    TokenExpire,
                Source:    "Token过期",
            }
            return tx.Create(expireRecord).Error
        })
        
        if err != nil {
            log.Printf("Failed to expire tokens for user %s: %v", userID, err)
        }
    }
    
    log.Printf("Expired tokens for %d users", len(userTokens))
    return nil
}
```

**4. 套餐过期处理**
```go
// 套餐过期时清空套餐Token
func HandlePlanExpire() {
    scheduler.AddJob(&CronJob{
        Job:         &ExpirePlanTokensJob{},
        Schedule:    "0 10 0 * * *", // 每天零点10分
        Enabled:     true,
        Description: "Expire plan tokens when subscription expires",
        Timeout:     5 * time.Minute,
    })
}

type ExpirePlanTokensJob struct{}

func (j *ExpirePlanTokensJob) GetName() string {
    return "expire_plan_tokens"
}

func (j *ExpirePlanTokensJob) GetDescription() string {
    return "Clear plan tokens when user subscription expires"
}

func (j *ExpirePlanTokensJob) Run(ctx context.Context) error {
    // 找出过期的订阅
    expiredSubscriptions := []UserSubscription{}
    DB.Where("status = ? AND expires_at < ?", "active", time.Now()).Find(&expiredSubscriptions)
    
    for _, sub := range expiredSubscriptions {
        err := DB.Transaction(func(tx *gorm.DB) error {
            // 更新订阅状态
            sub.Status = "expired"
            if err := tx.Save(&sub).Error; err != nil {
                return err
            }
            
            // 清空套餐Token
            var wallet TokenWallet
            if err := tx.First(&wallet, "user_id = ?", sub.UserID).Error; err != nil {
                return nil // 钱包可能不存在
            }
            
            if wallet.PlanTokens > 0 {
                expiredAmount := wallet.PlanTokens
                wallet.PlanTokens = 0
                wallet.TotalTokens -= expiredAmount
                
                if err := tx.Save(&wallet).Error; err != nil {
                    return err
                }
                
                // 记录过期
                expireRecord := &TokenTransaction{
                    ID:        generateUUID(),
                    UserID:    sub.UserID,
                    TenantID:  wallet.TenantID,
                    Type:      TokenPlan,
                    Amount:    -expiredAmount,
                    Balance:   0,
                    Action:    TokenExpire,
                    Source:    "套餐过期",
                }
                return tx.Create(expireRecord).Error
            }
            
            return nil
        })
        
        if err != nil {
            log.Printf("Failed to handle plan expire for user %s: %v", sub.UserID, err)
        }
    }
    
    return nil
}
```

**5. 热更新消费规则**
```go
// 管理后台更新消费规则
func UpdateConsumeRule(c *gin.Context) {
    var req struct {
        Module     string          `json:"module" binding:"required"`
        Action     string          `json:"action" binding:"required"`
        BaseCost   int             `json:"base_cost"`
        Multiplier float64         `json:"multiplier"`
        Conditions json.RawMessage `json:"conditions"`
    }
    
    if err := c.ShouldBind(&req); err != nil {
        c.JSON(400, gin.H{"error": err.Error()})
        return
    }
    
    // 获取现有规则
    var rule TokenConsumeRule
    if err := DB.First(&rule, "module = ? AND action = ?", req.Module, req.Action).Error; err != nil {
        // 创建新规则
        rule = TokenConsumeRule{
            ID:         generateUUID(),
            Module:     req.Module,
            Action:     req.Action,
            BaseCost:   req.BaseCost,
            Multiplier: req.Multiplier,
            Conditions: req.Conditions,
            Version:    1,
        }
    } else {
        // 更新现有规则
        rule.BaseCost = req.BaseCost
        rule.Multiplier = req.Multiplier
        rule.Conditions = req.Conditions
        rule.Version += 1
    }
    
    if err := DB.Save(&rule).Error; err != nil {
        c.JSON(500, gin.H{"error": "保存失败"})
        return
    }
    
    // 清除缓存，强制重新加载
    cache.Delete("token_rule:" + req.Module + ":" + req.Action)
    
    c.JSON(200, gin.H{"message": "更新成功", "version": rule.Version})
}
```

#### 3.6.3 前端Token购买组件

```jsx
// Token购买卡片
const TokenPurchaseCard = () => {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(false);
    
    useEffect(() => {
        fetchTokenProducts();
    }, []);
    
    const fetchTokenProducts = async () => {
        const res = await fetch('/api/token/products');
        const data = await res.json();
        setProducts(data);
    };
    
    const handlePurchase = async (productId) => {
        setLoading(true);
        try {
            const res = await fetch('/api/token/purchase', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    product_id: productId,
                    payment_method: 'alipay'
                })
            });
            
            const data = await res.json();
            if (data.payment_url) {
                // 跳转到支付页面
                window.location.href = data.payment_url;
            }
        } catch (error) {
            message.error('购买失败');
        } finally {
            setLoading(false);
        }
    };
    
    return (
        <Card title="购买Token">
            <Grid container spacing={2}>
                {products.map(product => (
                    <Grid item xs={12} sm={6} md={4} key={product.id}>
                        <Card 
                            variant="outlined" 
                            sx={{ 
                                position: 'relative',
                                borderColor: product.is_popular ? 'primary.main' : 'grey.300',
                                borderWidth: product.is_popular ? 2 : 1
                            }}
                        >
                            {product.is_popular && (
                                <Chip 
                                    label="热门" 
                                    color="primary" 
                                    size="small"
                                    sx={{ position: 'absolute', top: -10, right: 10 }}
                                />
                            )}
                            <CardContent>
                                <Typography variant="h6" gutterBottom>
                                    {product.name}
                                </Typography>
                                <Typography variant="body2" color="text.secondary" paragraph>
                                    {product.description}
                                </Typography>
                                <Typography variant="h4" color="primary">
                                    ¥{product.price}
                                </Typography>
                                <Typography variant="caption" display="block">
                                    {product.tokens} Token
                                </Typography>
                                <Button 
                                    fullWidth 
                                    variant={product.is_popular ? "contained" : "outlined"}
                                    sx={{ mt: 2 }}
                                    onClick={() => handlePurchase(product.id)}
                                    disabled={loading}
                                >
                                    立即购买
                                </Button>
                            </CardContent>
                        </Card>
                    </Grid>
                ))}
            </Grid>
        </Card>
    );
};

// Token余额显示组件
const TokenBalanceDisplay = () => {
    const [balance, setBalance] = useState(null);
    
    useEffect(() => {
        fetchTokenBalance();
    }, []);
    
    const fetchTokenBalance = async () => {
        const res = await fetch('/api/user/token-balance');
        const data = await res.json();
        setBalance(data);
    };
    
    if (!balance) return null;
    
    return (
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <Tooltip title="套餐Token">
                <Chip 
                    icon={<WorkspacePremiumIcon />}
                    label={`${balance.plan_tokens}`}
                    color="primary"
                    variant="outlined"
                />
            </Tooltip>
            <Tooltip title="活动Token">
                <Chip 
                    icon={<EmojiEventsIcon />}
                    label={`${balance.activity_tokens}`}
                    color="secondary"
                    variant="outlined"
                />
            </Tooltip>
            <Tooltip title="购买Token">
                <Chip 
                    icon={<ShoppingCartIcon />}
                    label={`${balance.purchase_tokens}`}
                    color="success"
                    variant="outlined"
                />
            </Tooltip>
            <Divider orientation="vertical" flexItem />
            <Typography variant="h6">
                总计: {balance.total_tokens}
            </Typography>
        </Box>
    );
};
```

#### 3.6.4 价格页面Token购买卡片设计

```jsx
// 价格页面组件 - 添加Token购买卡片
const PricingPage = () => {
    const [products, setProducts] = useState([]);
    const [consultDialogOpen, setConsultDialogOpen] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState(null);
    
    useEffect(() => {
        fetchTokenProducts();
    }, []);
    
    const fetchTokenProducts = async () => {
        const res = await fetch('/api/token/products');
        const data = await res.json();
        setProducts(data);
    };
    
    const handleSubscribeClick = (product) => {
        setSelectedProduct(product);
        setConsultDialogOpen(true);
    };
    
    return (
        <Box sx={{ py: 8, bgcolor: 'background.default' }}>
            <Container maxWidth="lg">
                <Typography variant="h2" align="center" gutterBottom>
                    选择您的方案
                </Typography>
                <Typography variant="h6" align="center" color="text.secondary" paragraph>
                    灵活的套餐选择，按需购买Token
                </Typography>
                
                <Grid container spacing={4} sx={{ mt: 6 }}>
                    {/* FREE 套餐 */}
                    <Grid item xs={12} md={4}>
                        <Card sx={{ height: '100%' }}>
                            <CardContent>
                                <Typography variant="h4" component="div" gutterBottom>
                                    FREE
                                </Typography>
                                <Typography variant="h5" color="primary" gutterBottom>
                                    ¥0
                                    <Typography variant="subtitle1" component="span">
                                        /月
                                    </Typography>
                                </Typography>
                                <List>
                                    <ListItem>
                                        <ListItemIcon>
                                            <CheckIcon />
                                        </ListItemIcon>
                                        <ListItemText primary="每日 10 次查询" />
                                    </ListItem>
                                    <ListItem>
                                        <ListItemIcon>
                                            <CheckIcon />
                                        </ListItemIcon>
                                        <ListItemText primary="基础功能" />
                                    </ListItem>
                                </List>
                                <Button 
                                    fullWidth 
                                    variant="outlined"
                                    onClick={() => handleSubscribeClick({ plan: 'FREE' })}
                                >
                                    当前方案
                                </Button>
                            </CardContent>
                        </Card>
                    </Grid>
                    
                    {/* PRO 套餐 */}
                    <Grid item xs={12} md={4}>
                        <Card sx={{ height: '100%', position: 'relative' }}>
                            <Chip 
                                label="最受欢迎"
                                color="primary"
                                sx={{ position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)' }}
                            />
                            <CardContent>
                                <Typography variant="h4" component="div" gutterBottom>
                                    PRO
                                </Typography>
                                <Typography variant="h5" color="primary" gutterBottom>
                                    ¥99
                                    <Typography variant="subtitle1" component="span">
                                        /月
                                    </Typography>
                                </Typography>
                                <List>
                                    <ListItem>
                                        <ListItemIcon>
                                            <CheckIcon />
                                        </ListItemIcon>
                                        <ListItemText primary="每日 100 次查询" />
                                    </ListItem>
                                    <ListItem>
                                        <ListItemIcon>
                                            <CheckIcon />
                                        </ListItemIcon>
                                        <ListItemText primary="包含 1000 Token" />
                                    </ListItem>
                                    <ListItem>
                                        <ListItemIcon>
                                            <CheckIcon />
                                        </ListItemIcon>
                                        <ListItemText primary="高级功能" />
                                    </ListItem>
                                </List>
                                <Button 
                                    fullWidth 
                                    variant="contained"
                                    onClick={() => handleSubscribeClick({ plan: 'PRO' })}
                                >
                                    立即订阅
                                </Button>
                            </CardContent>
                        </Card>
                    </Grid>
                    
                    {/* MAX 套餐 */}
                    <Grid item xs={12} md={4}>
                        <Card sx={{ height: '100%' }}>
                            <CardContent>
                                <Typography variant="h4" component="div" gutterBottom>
                                    MAX
                                </Typography>
                                <Typography variant="h5" color="primary" gutterBottom>
                                    ¥299
                                    <Typography variant="subtitle1" component="span">
                                        /月
                                    </Typography>
                                </Typography>
                                <List>
                                    <ListItem>
                                        <ListItemIcon>
                                            <CheckIcon />
                                        </ListItemIcon>
                                        <ListItemText primary="无限次查询" />
                                    </ListItem>
                                    <ListItem>
                                        <ListItemIcon>
                                            <CheckIcon />
                                        </ListItemIcon>
                                        <ListItemText primary="包含 5000 Token" />
                                    </ListItem>
                                    <ListItem>
                                        <ListItemIcon>
                                            <CheckIcon />
                                        </ListItemIcon>
                                        <ListItemText primary="所有功能" />
                                    </ListItem>
                                    <ListItem>
                                        <ListItemIcon>
                                            <CheckIcon />
                                        </ListItemIcon>
                                        <ListItemText primary="优先支持" />
                                    </ListItem>
                                </List>
                                <Button 
                                    fullWidth 
                                    variant="contained"
                                    color="secondary"
                                    onClick={() => handleSubscribeClick({ plan: 'MAX' })}
                                >
                                    立即订阅
                                </Button>
                            </CardContent>
                        </Card>
                    </Grid>
                    
                    {/* Token购买卡片 */}
                    <Grid item xs={12} md={4} sx={{ ml: 'auto', mr: 'auto' }}>
                        <Card 
                            sx={{ 
                                height: '100%', 
                                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                color: 'white',
                                position: 'relative',
                                overflow: 'hidden'
                            }}
                        >
                            <Box
                                sx={{
                                    position: 'absolute',
                                    top: -50,
                                    right: -50,
                                    width: 200,
                                    height: 200,
                                    borderRadius: '50%',
                                    background: 'rgba(255, 255, 255, 0.1)',
                                }}
                            />
                            <CardContent sx={{ position: 'relative', zIndex: 1 }}>
                                <Typography variant="h4" component="div" gutterBottom>
                                    额外 Token
                                </Typography>
                                <Typography variant="body1" sx={{ mb: 3, opacity: 0.9 }}>
                                    灵活购买，按需使用，永不过期
                                </Typography>
                                
                                <Stack spacing={2} sx={{ mb: 3 }}>
                                    {products.slice(0, 3).map((product) => (
                                        <Box 
                                            key={product.id}
                                            sx={{ 
                                                display: 'flex', 
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                p: 1.5,
                                                bgcolor: 'rgba(255, 255, 255, 0.1)',
                                                borderRadius: 1,
                                                backdropFilter: 'blur(10px)'
                                            }}
                                        >
                                            <Box>
                                                <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                                                    {product.tokens} Token
                                                </Typography>
                                                <Typography variant="caption" sx={{ opacity: 0.8 }}>
                                                    {product.description}
                                                </Typography>
                                            </Box>
                                            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                                                ¥{product.price}
                                            </Typography>
                                        </Box>
                                    ))}
                                </Stack>
                                
                                <Button 
                                    fullWidth 
                                    variant="contained"
                                    sx={{ 
                                        bgcolor: 'white', 
                                        color: 'primary',
                                        '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.9)' }
                                    }}
                                    onClick={() => handleSubscribeClick({ type: 'TOKEN_PACK' })}
                                >
                                    查看更多套餐
                                </Button>
                                
                                <Typography variant="caption" sx={{ display: 'block', mt: 2, textAlign: 'center', opacity: 0.8 }}>
                                    购买的Token永不过期
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>
            </Container>
            
            {/* 复用现有的咨询对话框 */}
            {/* 点击"立即订阅"按钮会触发与套餐订阅相同的咨询弹窗 */}
            {/* 弹窗中显示客服微信二维码，用户扫码添加好友即可 */}
        </Box>
    );
};
```

#### 3.6.5 SaaS用户个人中心设计

为了提供完整的用户体验，设计一个功能齐全的个人中心，整合所有用户需要的功能模块。

```jsx
// 个人中心主页面组件
const UserDashboard = () => {
    const [user, setUser] = useState(null);
    const [stats, setStats] = useState(null);
    const [activeTab, setActiveTab] = useState('overview');
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    
    // 监听刷新事件
    useEffect(() => {
        const handleRefresh = () => {
            setRefreshTrigger(prev => prev + 1);
        };
        
        window.addEventListener('user-data-updated', handleRefresh);
        return () => window.removeEventListener('user-data-updated', handleRefresh);
    }, []);
    
    useEffect(() => {
        fetchUserData();
        fetchUserStats();
    }, [refreshTrigger]);
    
    const fetchUserData = async () => {
        const res = await fetch('/api/user/profile');
        const data = await res.json();
        setUser(data);
    };
    
    const fetchUserStats = async () => {
        const res = await fetch('/api/user/stats');
        const data = await res.json();
        setStats(data);
    };
    
    return (
        <Box sx={{ py: 4 }}>
            <Container maxWidth="lg">
                {/* 欢迎信息和快速概览 */}
                <Paper sx={{ p: 3, mb: 3, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
                    <Grid container spacing={3} alignItems="center">
                        <Grid item>
                            <Avatar sx={{ width: 64, height: 64, bgcolor: 'rgba(255,255,255,0.2)' }}>
                                <PersonIcon sx={{ fontSize: 36 }} />
                            </Avatar>
                        </Grid>
                        <Grid item xs>
                            <Typography variant="h4" gutterBottom>
                                欢迎回来，{user?.email}
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 3, mt: 1 }}>
                                <Chip 
                                    icon={getCrownIcon(user?.plan)}
                                    label={`${user?.plan} 套餐`}
                                    sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }}
                                />
                                {user?.plan_expires_at && (
                                    <Typography variant="body2">
                                        套餐到期：{new Date(user.plan_expires_at).toLocaleDateString()}
                                    </Typography>
                                )}
                            </Box>
                        </Grid>
                        <Grid item>
                            <TokenBalanceDisplay balance={user?.token_wallet} />
                        </Grid>
                    </Grid>
                </Paper>
                
                {/* 统计卡片 */}
                {stats && (
                    <Grid container spacing={3} sx={{ mb: 3 }}>
                        <Grid item xs={12} sm={6} md={3}>
                            <StatCard
                                title="本月查询"
                                value={stats.this_month_queries}
                                icon={<SearchIcon />}
                                color="primary"
                            />
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
                            <StatCard
                                title="剩余Token"
                                value={user?.token_wallet?.total_tokens || 0}
                                icon={<TokenIcon />}
                                color="secondary"
                            />
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
                            <StatCard
                                title="连续签到"
                                value={`${user?.continuous_days || 0}天`}
                                icon={<CalendarIcon />}
                                color="success"
                            />
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
                            <StatCard
                                title="已邀请好友"
                                value={stats.invited_count || 0}
                                icon={<GroupIcon />}
                                color="info"
                            />
                        </Grid>
                    </Grid>
                )}
                
                {/* 标签导航 */}
                <Paper sx={{ mb: 3 }}>
                    <Tabs
                        value={activeTab}
                        onChange={(e, v) => setActiveTab(v)}
                        variant="scrollable"
                        scrollButtons="auto"
                    >
                        <Tab label="概览" value="overview" icon={<DashboardIcon />} />
                        <Tab label="个人信息" value="profile" icon={<PersonIcon />} />
                        <Tab label="套餐管理" value="subscription" icon={<CardMembershipIcon />} />
                        <Tab label="Token明细" value="tokens" icon={<AccountBalanceWalletIcon />} />
                        <Tab label="邀请好友" value="invite" icon={<ShareIcon />} />
                        <Tab label="每日签到" value="checkin" icon={<EventAvailableIcon />} />
                    </Tabs>
                </Paper>
                
                {/* 标签内容 */}
                {activeTab === 'overview' && <DashboardOverview user={user} stats={stats} />}
                {activeTab === 'profile' && <ProfileInfo user={user} onUpdate={fetchUserData} />}
                {activeTab === 'subscription' && <SubscriptionManagement user={user} onUpdate={fetchUserData} />}
                {activeTab === 'tokens' && <TokenTransactions user={user} />}
                {activeTab === 'invite' && <InviteFriends user={user} onUpdate={fetchUserData} />}
                {activeTab === 'checkin' && <DailyCheckIn user={user} onUpdate={fetchUserData} />}
            </Container>
        </Box>
    );
};

// 概览页面
const DashboardOverview = ({ user, stats }) => {
    return (
        <Grid container spacing={3}>
            {/* 套餐状态 */}
            <Grid item xs={12} md={6}>
                <Card>
                    <CardHeader title="套餐状态" />
                    <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                            <Typography variant="h6" sx={{ flexGrow: 1 }}>
                                当前套餐：{user?.plan}
                            </Typography>
                            <Chip 
                                label={user?.status === 'active' ? '正常' : '已过期'}
                                color={user?.status === 'active' ? 'success' : 'error'}
                            />
                        </Box>
                        {user?.plan_expires_at && (
                            <LinearProgress 
                                variant="determinate" 
                                value={getDaysRemaining(user.plan_expires_at) / 30 * 100}
                                sx={{ mb: 1 }}
                            />
                        )}
                        <Typography variant="body2" color="text.secondary">
                            {user?.plan_expires_at 
                                ? `距离到期还有 ${getDaysRemaining(user.plan_expires_at)} 天`
                                : '永不过期'
                            }
                        </Typography>
                        <Button 
                            fullWidth 
                            variant="contained" 
                            sx={{ mt: 2 }}
                            onClick={() => window.location.href = '/pricing'}
                        >
                            升级套餐
                        </Button>
                    </CardContent>
                </Card>
            </Grid>
            
            {/* Token余额 */}
            <Grid item xs={12} md={6}>
                <Card>
                    <CardHeader title="Token余额" />
                    <CardContent>
                        <TokenBalanceDisplay balance={user?.token_wallet} />
                        <Box sx={{ mt: 2 }}>
                            <Typography variant="body2" color="text.secondary" gutterBottom>
                                Token使用分布
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                                <Box sx={{ flexGrow: 1, height: 8, bgcolor: 'primary.main', borderRadius: 1 }} 
                                     style={{ width: `${(user?.token_wallet?.plan_tokens || 0) / (user?.token_wallet?.total_tokens || 1) * 100}%` }} />
                                <Box sx={{ flexGrow: 1, height: 8, bgcolor: 'secondary.main', borderRadius: 1 }} 
                                     style={{ width: `${(user?.token_wallet?.activity_tokens || 0) / (user?.token_wallet?.total_tokens || 1) * 100}%` }} />
                                <Box sx={{ flexGrow: 1, height: 8, bgcolor: 'success.main', borderRadius: 1 }} 
                                     style={{ width: `${(user?.token_wallet?.purchase_tokens || 0) / (user?.token_wallet?.total_tokens || 1) * 100}%` }} />
                            </Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                                <span>套餐</span>
                                <span>活动</span>
                                <span>购买</span>
                            </Box>
                        </Box>
                        <Button 
                            fullWidth 
                            variant="outlined" 
                            sx={{ mt: 2 }}
                            onClick={() => window.location.href = '/pricing#token-packs'}
                        >
                            购买Token
                        </Button>
                    </CardContent>
                </Card>
            </Grid>
            
            {/* 最近活动 */}
            <Grid item xs={12}>
                <Card>
                    <CardHeader title="最近活动" />
                    <CardContent>
                        <RecentActivities userId={user?.id} />
                    </CardContent>
                </Card>
            </Grid>
        </Grid>
    );
};

// 个人信息组件
const ProfileInfo = ({ user, onUpdate }) => {
    const [editing, setEditing] = useState(false);
    const [formData, setFormData] = useState({});
    
    useEffect(() => {
        setFormData({
            email: user?.email,
            name: user?.name || '',
            company: user?.company || '',
        });
    }, [user]);
    
    const handleSave = async () => {
        const res = await fetch('/api/user/profile', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });
        
        if (res.ok) {
            setEditing(false);
            onUpdate();
            // 触发刷新事件
            window.dispatchEvent(new CustomEvent('user-data-updated'));
        }
    };
    
    return (
        <Card>
            <CardHeader 
                title="个人信息" 
                action={
                    !editing && (
                        <IconButton onClick={() => setEditing(true)}>
                            <EditIcon />
                        </IconButton>
                    )
                }
            />
            <CardContent>
                {editing ? (
                    <Stack spacing={2}>
                        <TextField
                            fullWidth
                            label="邮箱"
                            value={formData.email}
                            disabled
                        />
                        <TextField
                            fullWidth
                            label="姓名"
                            value={formData.name}
                            onChange={(e) => setFormData({...formData, name: e.target.value})}
                        />
                        <TextField
                            fullWidth
                            label="公司"
                            value={formData.company}
                            onChange={(e) => setFormData({...formData, company: e.target.value})}
                        />
                        <Box sx={{ display: 'flex', gap: 1 }}>
                            <Button onClick={() => setEditing(false)}>取消</Button>
                            <Button variant="contained" onClick={handleSave}>保存</Button>
                        </Box>
                    </Stack>
                ) : (
                    <List>
                        <ListItem>
                            <ListItemText primary="邮箱" secondary={user?.email} />
                        </ListItem>
                        <ListItem>
                            <ListItemText primary="姓名" secondary={user?.name || '未设置'} />
                        </ListItem>
                        <ListItem>
                            <ListItemText primary="公司" secondary={user?.company || '未设置'} />
                        </ListItem>
                        <ListItem>
                            <ListItemText primary="注册时间" secondary={new Date(user?.created_at).toLocaleString()} />
                        </ListItem>
                    </List>
                )}
            </CardContent>
        </Card>
    );
};

// 套餐管理组件
const SubscriptionManagement = ({ user, onUpdate }) => {
    const [invoices, setInvoices] = useState([]);
    
    useEffect(() => {
        fetchInvoices();
    }, []);
    
    const fetchInvoices = async () => {
        const res = await fetch('/api/user/invoices');
        const data = await res.json();
        setInvoices(data);
    };
    
    return (
        <Box>
            {/* 当前套餐 */}
            <Card sx={{ mb: 3 }}>
                <CardHeader title="当前套餐" />
                <CardContent>
                    <Grid container spacing={3}>
                        <Grid item xs={12} md={6}>
                            <Typography variant="h6" gutterBottom>
                                {user?.plan} 套餐
                            </Typography>
                            <List dense>
                                <ListItem>
                                    <ListItemText 
                                        primary="状态" 
                                        secondary={
                                            <Chip 
                                                label={user?.status === 'active' ? '正常' : '已过期'}
                                                color={user?.status === 'active' ? 'success' : 'error'}
                                                size="small"
                                            />
                                        } 
                                    />
                                </ListItem>
                                <ListItem>
                                    <ListItemText 
                                        primary="到期时间" 
                                        secondary={user?.plan_expires_at 
                                            ? new Date(user.plan_expires_at).toLocaleDateString()
                                            : '永不过期'
                                        } 
                                    />
                                </ListItem>
                                <ListItem>
                                    <ListItemText 
                                        primary="月度查询限额" 
                                        secondary={getPlanQuota(user?.plan)} 
                                    />
                                </ListItem>
                                <ListItem>
                                    <ListItemText 
                                        primary="本月已使用" 
                                        secondary={`${user?.this_month_usage || 0} 次`} 
                                    />
                                </ListItem>
                            </List>
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <Typography variant="h6" gutterBottom>
                                操作
                            </Typography>
                            <Stack spacing={2}>
                                <Button 
                                    fullWidth 
                                    variant="contained"
                                    onClick={() => window.location.href = '/pricing'}
                                >
                                    {user?.plan === 'FREE' ? '升级套餐' : '变更套餐'}
                                </Button>
                                {user?.plan !== 'FREE' && (
                                    <Button 
                                        fullWidth 
                                        variant="outlined"
                                        onClick={() => window.open('/billing', '_blank')}
                                    >
                                        账单管理
                                    </Button>
                                )}
                            </Stack>
                        </Grid>
                    </Grid>
                </CardContent>
            </Card>
            
            {/* 历史账单 */}
            <Card>
                <CardHeader title="历史账单" />
                <CardContent>
                    <TableContainer>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell>账单号</TableCell>
                                    <TableCell>套餐</TableCell>
                                    <TableCell>金额</TableCell>
                                    <TableCell>状态</TableCell>
                                    <TableCell>日期</TableCell>
                                    <TableCell>操作</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {invoices.map(invoice => (
                                    <TableRow key={invoice.id}>
                                        <TableCell>{invoice.order_id}</TableCell>
                                        <TableCell>{invoice.plan}</TableCell>
                                        <TableCell>¥{invoice.amount}</TableCell>
                                        <TableCell>
                                            <Chip 
                                                label={invoice.status}
                                                color={invoice.status === 'paid' ? 'success' : 'warning'}
                                                size="small"
                                            />
                                        </TableCell>
                                        <TableCell>{new Date(invoice.created_at).toLocaleDateString()}</TableCell>
                                        <TableCell>
                                            {invoice.status === 'paid' && (
                                                <Button 
                                                    size="small" 
                                                    onClick={() => window.open(invoice.receipt_url, '_blank')}
                                                >
                                                    查看收据
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </CardContent>
            </Card>
        </Box>
    );
};

// Token明细组件
const TokenTransactions = ({ user }) => {
    const [transactions, setTransactions] = useState([]);
    const [page, setPage] = useState(1);
    const [filters, setFilters] = useState({ type: '', action: '' });
    
    useEffect(() => {
        fetchTransactions();
    }, [page, filters]);
    
    const fetchTransactions = async () => {
        const params = new URLSearchParams({
            page: page.toString(),
            ...(filters.type && { type: filters.type }),
            ...(filters.action && { action: filters.action })
        });
        
        const res = await fetch(`/api/user/token-transactions?${params}`);
        const data = await res.json();
        setTransactions(data);
    };
    
    return (
        <Box>
            {/* 筛选器 */}
            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <Grid container spacing={2}>
                        <Grid item xs={12} md={6}>
                            <TextField
                                fullWidth
                                select
                                label="Token类型"
                                value={filters.type}
                                onChange={(e) => setFilters({...filters, type: e.target.value})}
                            >
                                <MenuItem value="">全部</MenuItem>
                                <MenuItem value="plan">套餐Token</MenuItem>
                                <MenuItem value="activity">活动Token</MenuItem>
                                <MenuItem value="purchase">购买Token</MenuItem>
                            </TextField>
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <TextField
                                fullWidth
                                select
                                label="操作类型"
                                value={filters.action}
                                onChange={(e) => setFilters({...filters, action: e.target.value})}
                            >
                                <MenuItem value="">全部</MenuItem>
                                <MenuItem value="add">获得</MenuItem>
                                <MenuItem value="consume">消费</MenuItem>
                                <MenuItem value="expire">过期</MenuItem>
                            </TextField>
                        </Grid>
                    </Grid>
                </CardContent>
            </Card>
            
            {/* 交易列表 */}
            <Card>
                <CardHeader title="Token变动记录" />
                <CardContent>
                    <TableContainer>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell>时间</TableCell>
                                    <TableCell>类型</TableCell>
                                    <TableCell>操作</TableCell>
                                    <TableCell>数量</TableCell>
                                    <TableCell>余额</TableCell>
                                    <TableCell>来源</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {transactions.data?.map(t => (
                                    <TableRow key={t.id}>
                                        <TableCell>{new Date(t.created_at).toLocaleString()}</TableCell>
                                        <TableCell>
                                            <Chip 
                                                label={t.type === 'plan' ? '套餐' : t.type === 'activity' ? '活动' : '购买'}
                                                size="small"
                                                variant={t.type === 'plan' ? 'filled' : 'outlined'}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Typography 
                                                color={t.action === 'add' ? 'success.main' : t.action === 'consume' ? 'error.main' : 'text.secondary'}
                                            >
                                                {t.action === 'add' ? '获得' : t.action === 'consume' ? '消费' : '过期'}
                                            </Typography>
                                        </TableCell>
                                        <TableCell>
                                            <Typography 
                                                variant="body2"
                                                color={t.action === 'add' ? 'success.main' : t.action === 'consume' ? 'error.main' : 'text.secondary'}
                                            >
                                                {t.action === 'add' ? '+' : t.action === 'consume' ? '-' : ''}{t.amount}
                                            </Typography>
                                        </TableCell>
                                        <TableCell>{t.balance}</TableCell>
                                        <TableCell>{t.source}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                    
                    {/* 分页 */}
                    {transactions.pagination && (
                        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}>
                            <Pagination
                                count={transactions.pagination.total_pages}
                                page={page}
                                onChange={(e, p) => setPage(p)}
                            />
                        </Box>
                    )}
                </CardContent>
            </Card>
        </Box>
    );
};

// 邀请好友组件（复用之前设计的）
const InviteFriends = ({ user, onUpdate }) => {
    // 使用之前设计的邀请功能代码
    // ...
};

// 每日签到组件（复用之前设计的）
const DailyCheckIn = ({ user, onUpdate }) => {
    // 使用之前设计的签到功能代码
    // ...
};

// 工具函数
const getCrownIcon = (plan) => {
    switch (plan) {
        case 'MAX': return <WorkspacePremiumIcon sx={{ color: 'gold' }} />;
        case 'PRO': return <StarIcon sx={{ color: 'silver' }} />;
        default: return <EmojiEventsIcon />;
    }
};

const getDaysRemaining = (expireDate) => {
    const now = new Date();
    const expire = new Date(expireDate);
    const diff = expire - now;
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
};

const getPlanQuota = (plan) => {
    switch (plan) {
        case 'MAX': return '无限制';
        case 'PRO': return '1000次/月';
        default: return '100次/月';
    }
};

// 实时数据更新机制
export const useRealTimeData = (userId) => {
    useEffect(() => {
        // WebSocket连接
        const ws = new WebSocket(`wss://your-domain.com/ws/user/${userId}`);
        
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            switch (data.type) {
                case 'token_updated':
                    window.dispatchEvent(new CustomEvent('token-balance-updated', { detail: data.data }));
                    break;
                case 'subscription_updated':
                    window.dispatchEvent(new CustomEvent('subscription-updated', { detail: data.data }));
                    break;
                case 'checkin_completed':
                    window.dispatchEvent(new CustomEvent('checkin-completed', { detail: data.data }));
                    break;
            }
        };
        
        return () => ws.close();
    }, [userId]);
};
```

**数据实时更新机制说明：**

1. **WebSocket实时推送**
   - Token余额变动实时更新
   - 套餐状态变更通知
   - 签到成功即时反馈

2. **事件总线机制**
   - 全局事件监听，跨组件通信
   - 数据变更自动触发UI更新
   - 避免手动刷新页面

3. **缓存策略**
   - 本地缓存用户基本信息
   - API调用自动合并和去重
   - 离线数据支持

4. **性能优化**
   - 组件懒加载
   - 数据分页加载
   - 防抖处理

### 3.7 性能优化策略

```go
// 1. 连接池优化
db.Use(dbresolver.Register(dbresolver.Config{
    Sources:  []gorm.Dialector{mysqlDialector},
    Policy:   dbresolver.RandomPolicy{},
    MaxIdleConns: 10,
    MaxOpenConns: 100,
}))

// 2. 并发任务处理
func BatchProcessor(urls []string, workers int) {
    semaphore := make(chan struct{}, workers)
    var wg sync.WaitGroup
    
    for _, url := range urls {
        wg.Add(1)
        go func(u string) {
            defer wg.Done()
            semaphore <- struct{}{}
            processURL(u)
            <-semaphore
        }(url)
    }
    wg.Wait()
}

// 3. 缓存策略
func WithCache(key string, ttl time.Duration, fn func() (interface{}, error)) (interface{}, error) {
    if val := redis.Get(key); val != "" {
        return json.Unmarshal(val)
    }
    
    result, err := fn()
    if err == nil {
        redis.Set(key, json.Marshal(result), ttl)
    }
    
    return result, err
}
```

### 3.8 核心接口性能测试

为了确保系统在高并发下的稳定性和性能表现，设计完整的性能测试方案。

#### 3.8.1 测试目标和指标

**性能目标**
- **响应时间**：P95 < 200ms，P99 < 500ms
- **吞吐量**：核心接口 > 1000 QPS
- **并发用户**：支持500并发用户
- **错误率**：< 0.1%
- **资源利用率**：CPU < 70%，内存 < 80%

**测试范围**
1. **认证授权接口**：登录、JWT验证
2. **核心业务接口**：BatchGo、SiteRankGo、AdsCenterGo
3. **用户管理接口**：个人信息、套餐、Token
4. **数据查询接口**：列表、筛选、分页
5. **WebSocket接口**：实时消息推送

#### 3.8.2 测试工具和框架

```go
// 基于 vegeta 的压力测试
package main

import (
    "fmt"
    "net/http"
    "time"
    
    "github.com/tsenart/vegeta/lib"
    "github.com/stretchr/testify/assert"
    "testing"
)

// 性能测试套件
type PerformanceTestSuite struct {
    base_url    string
    auth_token  string
    target      vegeta.Target
    attacker    *vegeta.Attacker
    metrics     *vegeta.Metrics
}

// 初始化测试套件
func NewPerformanceTestSuite(base_url string) *PerformanceTestSuite {
    return &PerformanceTestSuite{
        base_url: base_url,
        metrics:  &vegeta.Metrics{},
    }
}

// 认证接口性能测试
func (s *PerformanceTestSuite) TestAuthEndpoints(t *testing.T) {
    rate := vegeta.Rate{Freq: 100, Per: time.Second}
    duration := 30 * time.Second
    
    // 登录接口测试
    s.target = vegeta.Target{
        Method: "POST",
        URL:    fmt.Sprintf("%s/api/auth/login", s.base_url),
        Body:   []byte(`{"email":"test@example.com","password":"password123"}`),
        Header: http.Header{"Content-Type": []string{"application/json"}},
    }
    
    attacker := vegeta.NewAttacker()
    var results vegeta.Results
    
    for res := range attacker.Attack(s.target, rate, duration, "Login Test") {
        results = append(results, res)
    }
    
    // 分析结果
    metrics := vegeta.NewMetrics(results)
    assert.Less(t, metrics.Latencies.P95, 200*time.Millisecond)
    assert.Less(t, metrics.Errors, 0.01)
    
    t.Logf("Login API - P95: %v, QPS: %.2f", metrics.Latencies.P95, metrics.Throughput)
    
    // JWT验证性能测试
    s.testJWTValidation(t)
}

// JWT验证性能测试
func (s *PerformanceTestSuite) testJWTValidation(t *testing.T) {
    // 先获取token
    token := s.getAuthToken()
    
    rate := vegeta.Rate{Freq: 500, Per: time.Second}
    duration := 30 * time.Second
    
    s.target = vegeta.Target{
        Method: "GET",
        URL:    fmt.Sprintf("%s/api/user/profile", s.base_url),
        Header: http.Header{
            "Content-Type":  []string{"application/json"},
            "Authorization": []string{fmt.Sprintf("Bearer %s", token)},
        },
    }
    
    attacker := vegeta.NewAttacker()
    var results vegeta.Results
    
    for res := range attacker.Attack(s.target, rate, duration, "JWT Validation") {
        results = append(results, res)
    }
    
    metrics := vegeta.NewMetrics(results)
    assert.Less(t, metrics.Latencies.P95, 100*time.Millisecond)
    assert.Less(t, metrics.Errors, 0.001)
    
    t.Logf("JWT Validation - P95: %v, QPS: %.2f", metrics.Latencies.P95, metrics.Throughput)
}

// BatchGo 接口性能测试
func (s *PerformanceTestSuite) TestBatchGoEndpoints(t *testing.T) {
    // 获取token
    token := s.getAuthToken()
    
    // 测试不同规模的批量处理
    testCases := []struct {
        name     string
        urlCount int
        rate     vegeta.Rate
    }{
        {"Small Batch (10 URLs)", 10, vegeta.Rate{Freq: 50, Per: time.Second}},
        {"Medium Batch (50 URLs)", 50, vegeta.Rate{Freq: 20, Per: time.Second}},
        {"Large Batch (100 URLs)", 100, vegeta.Rate{Freq: 10, Per: time.Second}},
    }
    
    for _, tc := range testCases {
        s.runBatchTest(t, tc.name, tc.urlCount, tc.rate)
    }
}

// 执行批量测试
func (s *PerformanceTestSuite) runBatchTest(t *testing.T, name string, urlCount int, rate vegeta.Rate) {
    // 构造测试数据
    urls := make([]string, urlCount)
    for i := 0; i < urlCount; i++ {
        urls[i] = fmt.Sprintf("https://example%d.com", i)
    }
    
    body := fmt.Sprintf(`{"urls":%q}`, urls)
    
    s.target = vegeta.Target{
        Method: "POST",
        URL:    fmt.Sprintf("%s/api/v1/batchgo/tasks", s.base_url),
        Body:   []byte(body),
        Header: http.Header{
            "Content-Type":  []string{"application/json"},
            "Authorization": []string{fmt.Sprintf("Bearer %s", s.getAuthToken())},
        },
    }
    
    attacker := vegeta.NewAttacker()
    duration := 60 * time.Second
    var results vegeta.Results
    
    for res := range attacker.Attack(s.target, rate, duration, name) {
        results = append(results, res)
    }
    
    metrics := vegeta.NewMetrics(results)
    t.Logf("%s - P95: %v, Success Rate: %.2f%%", name, metrics.Latencies.P95, (1-metrics.Errors)*100)
}

// 数据库连接池压力测试
func (s *PerformanceTestSuite) TestDatabaseConnectionPool(t *testing.T) {
    // 模拟高并发数据库查询
    rate := vegeta.Rate{Freq: 200, Per: time.Second}
    duration := 60 * time.Second
    
    s.target = vegeta.Target{
        Method: "GET",
        URL:    fmt.Sprintf("%s/api/v1/siterankgo/queries?page=1&page_size=20", s.base_url),
        Header: http.Header{
            "Authorization": []string{fmt.Sprintf("Bearer %s", s.getAuthToken())},
        },
    }
    
    attacker := vegeta.NewAttacker()
    var results vegeta.Results
    
    for res := range attacker.Attack(s.target, rate, duration, "DB Pool Test") {
        results = append(results, res)
    }
    
    metrics := vegeta.NewMetrics(results)
    t.Logf("DB Query - P95: %v, QPS: %.2f, Active Connections: %d", 
        metrics.Latencies.P95, metrics.Throughput, getActiveDBConnections())
}

// Token消费性能测试
func (s *PerformanceTestSuite) TestTokenConsumption(t *testing.T) {
    // 模拟并发Token消费
    rate := vegeta.Rate{Freq: 300, Per: time.Second}
    duration := 30 * time.Second
    
    s.target = vegeta.Target{
        Method: "POST",
        URL:    fmt.Sprintf("%s/api/v1/batchgo/consume-token", s.base_url),
        Body:   []byte(`{"task_id":"test-task","tokens":1}`),
        Header: http.Header{
            "Content-Type":  []string{"application/json"},
            "Authorization": []string{fmt.Sprintf("Bearer %s", s.getAuthToken())},
        },
    }
    
    attacker := vegeta.NewAttacker()
    var results vegeta.Results
    
    for res := range attacker.Attack(s.target, rate, duration, "Token Consumption") {
        results = append(results, res)
    }
    
    metrics := vegeta.NewMetrics(results)
    assert.Less(t, metrics.Latencies.P95, 150*time.Millisecond)
    t.Logf("Token Consumption - P95: %v, Success Rate: %.2f%%", 
        metrics.Latencies.P95, (1-metrics.Errors)*100)
}

// WebSocket性能测试
func (s *PerformanceTestSuite) TestWebSocketPerformance(t *testing.T) {
    // 创建多个WebSocket连接
    connections := 100
    messages := 1000
    
    // 使用 goroutine 模拟并发连接
    var wg sync.WaitGroup
    latency := make(chan time.Duration, messages*connections)
    
    start := time.Now()
    
    for i := 0; i < connections; i++ {
        wg.Add(1)
        go func(connID int) {
            defer wg.Done()
            
            ws, _, err := websocket.DefaultDialer.Dial(
                fmt.Sprintf("%s/ws/user/%d", s.base_url, connID), 
                nil,
            )
            if err != nil {
                t.Errorf("WebSocket connection failed: %v", err)
                return
            }
            defer ws.Close()
            
            // 发送和接收消息
            for j := 0; j < messages; j++ {
                msg := fmt.Sprintf(`{"type":"ping","data":"%d-%d"}`, connID, j)
                sendTime := time.Now()
                
                if err := ws.WriteMessage(websocket.TextMessage, []byte(msg)); err != nil {
                    continue
                }
                
                // 等待响应
                _, _, err = ws.ReadMessage()
                if err == nil {
                    latency <- time.Since(sendTime)
                }
            }
        }(i)
    }
    
    wg.Wait()
    close(latency)
    
    // 统计延迟
    var totalLatency time.Duration
    count := 0
    for l := range latency {
        totalLatency += l
        count++
    }
    
    avgLatency := totalLatency / time.Duration(count)
    t.Logf("WebSocket - Avg Latency: %v, Total Messages: %d", avgLatency, count)
    
    assert.Less(t, avgLatency, 50*time.Millisecond)
}

// 辅助函数
func (s *PerformanceTestSuite) getAuthToken() string {
    if s.auth_token == "" {
        // 执行登录获取token
        // ...
    }
    return s.auth_token
}

func getActiveDBConnections() int {
    // 获取当前数据库连接数
    // ...
    return 0
}
```

#### 3.8.3 性能基准测试

```go
// 性能基准测试
package benchmark

import (
    "testing"
    
    "github.com/stretchr/testify/assert"
)

// JWT解析性能
func BenchmarkJWTValidation(b *testing.B) {
    token := generateTestToken()
    
    b.ResetTimer()
    for i := 0; i < b.N; i++ {
        claims, err := validateJWT(token)
        assert.NoError(b, err)
        assert.NotNil(b, claims)
    }
}

// Token消费性能
func BenchmarkTokenConsumption(b *testing.B) {
    userID := "test-user-123"
    tenantID := "tenant-123"
    
    b.ResetTimer()
    for i := 0; i < b.N; i++ {
        err := ConsumeTokens(nil, userID, tenantID, "batchgo", "process", map[string]interface{}{
            "task_id": fmt.Sprintf("task-%d", i),
        })
        assert.NoError(b, err)
    }
}

// 数据库查询性能
func BenchmarkDBQuery(b *testing.B) {
    b.Run("Simple Query", func(b *testing.B) {
        for i := 0; i < b.N; i++ {
            var user User
            DB.First(&user, "id = ?", "test-user")
        }
    })
    
    b.Run("Paginated Query", func(b *testing.B) {
        for i := 0; i < b.N; i++ {
            var results []Task
            DB.Offset(0).Limit(20).Find(&results)
        }
    })
}

// 缓存性能
func BenchmarkCacheOperations(b *testing.B) {
    cache := GetCache()
    key := "test-key"
    value := "test-value"
    
    b.Run("Set", func(b *testing.B) {
        for i := 0; i < b.N; i++ {
            cache.Set(fmt.Sprintf("%s-%d", key, i), value, time.Hour)
        }
    })
    
    b.Run("Get", func(b *testing.B) {
        // 预热缓存
        cache.Set(key, value, time.Hour)
        
        b.ResetTimer()
        for i := 0; i < b.N; i++ {
            cache.Get(key)
        }
    })
}

// 并发安全测试
func BenchmarkConcurrentTokenOperations(b *testing.B) {
    userID := "concurrent-user"
    initialBalance := 10000
    
    // 设置初始余额
    wallet := &TokenWallet{UserID: userID, TotalTokens: initialBalance}
    DB.Save(wallet)
    
    b.RunParallel(func(pb *testing.PB) {
        for pb.Next() {
            // 并发扣减Token
            DB.Model(&TokenWallet{}).Where("user_id = ?", userID).
                UpdateColumn("total_tokens", gorm.Expr("total_tokens - ?", 1))
        }
    })
    
    // 验证最终余额
    var finalWallet TokenWallet
    DB.First(&finalWallet, "user_id = ?", userID)
    assert.Equal(b, initialBalance-b.N, finalWallet.TotalTokens)
}
```

#### 3.8.4 监控和调优工具

```go
// 性能监控中间件
func PerformanceMonitor() gin.HandlerFunc {
    return func(c *gin.Context) {
        start := time.Now()
        
        // 记录请求开始
        c.Set("start_time", start)
        
        // 处理请求
        c.Next()
        
        // 计算耗时
        duration := time.Since(start)
        
        // 记录指标
        metrics.RecordRequest(c.Request.Method, c.Request.URL.Path, duration, c.Writer.Status())
        
        // 慢请求告警
        if duration > 500*time.Millisecond {
            log.Printf("SLOW REQUEST: %s %s took %v", c.Request.Method, c.Request.URL.Path, duration)
        }
    }
}

// 实时性能指标收集
type MetricsCollector struct {
    requests map[string]*RequestMetrics
    mu       sync.RWMutex
}

type RequestMetrics struct {
    Count      int64
    TotalTime  time.Duration
    MinTime    time.Duration
    MaxTime    time.Duration
    ErrorCount int64
}

func (m *MetricsCollector) RecordRequest(method, path string, duration time.Duration, status int) {
    key := fmt.Sprintf("%s %s", method, path)
    
    m.mu.Lock()
    defer m.mu.Unlock()
    
    if m.requests[key] == nil {
        m.requests[key] = &RequestMetrics{
            MinTime: duration,
            MaxTime: duration,
        }
    }
    
    metrics := m.requests[key]
    metrics.Count++
    metrics.TotalTime += duration
    
    if duration < metrics.MinTime {
        metrics.MinTime = duration
    }
    if duration > metrics.MaxTime {
        metrics.MaxTime = duration
    }
    
    if status >= 400 {
        metrics.ErrorCount++
    }
}

// 性能分析工具
type Profiler struct {
    enabled bool
    data    map[string]*ProfileData
}

type ProfileData struct {
    Count    int64
    Duration time.Duration
}

func (p *Profiler) Start(name string) func() {
    if !p.enabled {
        return func() {}
    }
    
    start := time.Now()
    return func() {
        duration := time.Since(start)
        
        if p.data[name] == nil {
            p.data[name] = &ProfileData{}
        }
        
        data := p.data[name]
        data.Count++
        data.Duration += duration
    }
}

// 使用示例
func ProcessRequest(c *gin.Context) {
    // 开始性能分析
    defer profiler.Start("ProcessRequest")()
    
    // 处理业务逻辑
    // ...
}
```

#### 3.8.5 性能优化建议

1. **数据库优化**
   - 添加合适的索引
   - 使用读写分离
   - 实现分库分表策略

2. **缓存优化**
   - 实现多级缓存
   - 使用缓存预热
   - 优化缓存失效策略

3. **并发优化**
   - 使用连接池
   - 实现协程池
   - 限制最大并发数

4. **资源优化**
   - 调整GC参数
   - 优化内存分配
   - 使用sync.Pool

## 4. 实施计划

### 4.1 第一阶段：基础架构（2周）

1. **Docker单容器构建**
   - 整合GoFly和Next.js
   - 实现内置反向代理
   - 优化启动脚本

2. **数据模型迁移**
   - 添加tenant_id字段
   - 创建统一用户表
   - 数据迁移脚本

3. **双认证系统**
   - 实现统一JWT中间件
   - 多租户上下文注入
   - 保持API兼容性

### 4.2 第二阶段：核心功能迁移（4周）

1. **BatchGo实现**
   - 迁移BatchOpen核心逻辑
   - 实现并发处理
   - 添加Token消费

2. **SiteRankGo优化**
   - 优化SimilarWeb集成
   - 实现智能缓存
   - 批量查询优化

3. **统一管理后台**
   - 完善Token管理
   - 实现套餐切换
   - 增强数据面板

4. **邀请系统实现**（新增）
   - 邀请码生成和链接管理
   - 注册流程集成邀请奖励
   - 个人中心邀请模块开发
   - 管理后台邀请记录和排行榜
   - 套餐过期检查定时任务

5. **签到系统实现**（新增）
   - 签到记录和连续天数管理
   - Token阶梯奖励发放
   - 个人中心签到模块开发
   - 签到日历展示
   - 管理后台签到记录查询和统计
   - 连续签到重置定时任务

6. **Token经济系统实现**（新增）
   - Token钱包和交易记录系统
   - Token产品配置和购买流程
   - 多种Token类型和优先级消费
   - Token过期和定时清理机制
   - 热更新消费规则配置
   - 前端Token购买卡片和余额显示

7. **SaaS个人中心实现**（新增）
   - 个人信息查看和编辑
   - 套餐状态管理和历史账单
   - Token余额展示和交易明细
   - 邀请好友功能和奖励记录
   - 每日签到模块和日历展示
   - 实时数据更新机制（WebSocket）
   - 活动统计和概览面板

### 4.3 第三阶段：性能优化（2周）

1. **Redis分布式限流**
   - 替换内存限流
   - 实现集群支持
   - 性能监控

2. **AdsCenterGo实现**
   - Google Ads API集成
   - 管理界面开发
   - 权限控制

### 4.4 第四阶段：生产部署（1周）

1. **部署配置**
   - 生产环境优化
   - 监控告警
   - 备份策略

2. **文档完善**
   - API文档
   - 部署文档
   - 运维手册

## 5. 部署方案

### 5.1 Docker配置

```dockerfile
# 多阶段构建，优化镜像大小
FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY go.mod ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o main .

FROM node:22-alpine AS next-builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM alpine:3.19
RUN apk --no-cache add ca-certificates tzdata
WORKDIR /app
COPY --from=builder /app/main .
COPY --from=next-builder /app/.next/standalone ./
COPY --from=next-builder /app/.next/static ./.next/static
COPY --from=next-builder /app/public ./public

EXPOSE 80
CMD ["./main"]
```

### 5.2 启动脚本

```bash
#!/bin/bash
# 启动Next.js
NEXT_PORT=3000 ./next/start &

# 启动Go后端（集成反向代理）
./main --proxy-port=80 --next-port=3000 --go-port=8080
```

## 6. 风险与应对

### 6.1 技术风险

**数据迁移风险**
- 应对：增量迁移，保留原系统并行运行
- 回滚：保留完整备份，30秒内可回滚

**性能不达标**
- 应对：分批次上线，持续监控优化
- 降级：动态调整并发数，确保服务稳定

### 6.2 业务风险

**用户不适应**
- 应对：保持界面100%一致
- 培训：提供操作指南视频

**功能缺失**
- 应对：功能冻结原则，只迁移不新增
- 补救：快速响应机制，24小时修复

## 7. 成功指标

### 7.1 性能指标
- 并发处理：1 → 50（4900%提升）
- 响应时间：< 200ms（95分位）
- 系统可用性：99.9%

### 7.2 业务指标
- 用户留存率：> 95%
- 功能使用率：保持现有水平
- 管理效率：提升50%

## 8. GoFly框架深度功能复用

经过深度评估，GoFly框架提供了大量可直接复用的实用功能，大幅提升开发效率：

### 8.1 核心开发效率工具

#### **自动CRUD生成器** (utils/tools/gform)
- **功能**：基于数据模型自动生成增删改查API
- **价值**：减少80%的基础API开发工作
- **复用度**：100%
```go
// 一行代码生成完整CRUD接口
crudGenerator.GenerateCRUDRoute(router, "/api/users", &User{}, &UserService{})
```

#### **数据验证系统** (utils/tools/gvalid)
- **功能**：强大的表单和参数验证
- **特性**：支持正则、自定义规则、批量验证
- **复用度**：100%

#### **统一工具库** (utils/tools/)
- **字符串处理** (gstr)：URL解析、格式化、编码转换
- **时间处理** (gtime)：时区转换、格式化、SQL时间
- **JSON处理** (gjson)：动态JSON操作、配置解析
- **文件操作** (gfile)：读写、搜索、压缩解压
- **加密工具** (gmd5, gbase64)：常用加密算法
- **复用度**：100%

### 8.2 高级功能组件

#### **定时任务调度** (internal/scheduler)
- **功能**：支持秒级精度的Cron任务
- **特性**：
  - 任务状态跟踪（pending/running/completed/failed）
  - 失败重试机制
  - 执行历史记录
  - 动态任务管理
- **SaaS应用场景**：
  - 数据统计报表生成
  - 缓存定期清理
  - Token消耗统计
  - 用户订阅检查
- **复用度**：90%

#### **队列系统** (utils/tools/gqueue)
- **功能**：内存队列，支持异步处理
- **特性**：
  - 线程安全
  - 动态扩容
  - 阻塞/非阻塞模式
- **SaaS应用场景**：
  - 邮件发送队列
  - 任务处理队列
  - 通知推送队列
- **复用度**：85%

#### **Excel导出功能** (utils/extend/excelexport)
- **功能**：数据库记录直接导出Excel
- **特性**：
  - 自动读取字段注释作为表头
  - 支持大数据量导出
  - 自定义列配置
- **SaaS应用场景**：
  - 用户数据导出
  - 任务报告导出
  - 消费记录导出
- **复用度**：100%

### 8.3 缓存与性能优化

#### **多层缓存系统** (internal/cache)
- **内存缓存**：LRU算法，自动过期
- **Redis缓存**：分布式支持，集群模式
- **缓存特性**：
  - 热key自动识别
  - 缓存击穿保护
  - 雪崩防御
- **复用度**：100%

#### **连接池管理**
- **数据库连接池**：智能调度，连接复用
- **Redis连接池**：集群支持，故障转移
- **HTTP连接池**：Keep-alive，超时控制
- **复用度**：100%

### 8.4 监控与运维工具

#### **结构化日志** (utils/tools/glog)
- **功能**：JSON格式日志，支持多输出
- **特性**：
  - 日志级别控制
  - 自动轮转
  - 调用链追踪
- **复用度**：100%

#### **系统监控** (internal/metrics)
- **功能**：性能指标收集
- **监控项**：
  - QPS统计
  - 响应时间
  - 错误率
  - 资源使用率
- **复用度**：90%

### 8.5 实际开发效率提升

基于GoFly框架的完整功能栈，预估开发效率提升：

1. **基础API开发**：提升80%（CRUD自动生成）
2. **数据处理**：提升70%（工具库复用）
3. **定时任务**：提升90%（直接使用调度器）
4. **导出功能**：提升95%（Excel导出复用）
5. **缓存实现**：提升85%（缓存系统复用）
6. **认证权限**：提升90%（直接复用）

### 8.6 建议的复用策略

1. **立即复用**（0改造成本）
   - 所有工具类库
   - CRUD生成器
   - 缓存系统
   - Excel导出

2. **适配复用**（低改造成本）
   - 定时任务调度
   - 队列系统
   - 日志系统

3. **扩展复用**（中等改造成本）
   - 用户管理系统
   - 插件架构
   - 权限系统

## 9. 总结

这个方案遵循Linus的设计哲学：
- **简单性**：单容器，单进程，零复杂依赖
- **实用性**：解决真实问题，不追求理论完美
- **兼容性**：不破坏任何现有功能
- **性能**：用最直接的方式达到目标

### 新增用户增长系统亮点

#### 邀请系统
1. **双赢机制**：邀请者和被邀请者双方都能获得30天Pro套餐，促进用户自发传播
2. **累加奖励**：邀请多人可多次累加Pro天数，激励用户持续邀请
3. **完整追踪**：从邀请链接生成到奖励发放的全流程记录
4. **管理可视**：后台提供邀请排行榜和详细记录，便于运营分析

#### 签到系统
1. **阶梯奖励**：连续签到可获得10/20/40/80个Token，激励用户每日活跃
2. **连续性保护**：中断后重新开始，简单易懂的规则
3. **视觉化日历**：直观展示签到历史，增强成就感
4. **自动重置**：定时任务自动处理连续天数重置

#### Token经济系统
1. **多重激励**：通过套餐、活动、购买三种Token类型，建立完整的经济体系
2. **智能消费**：按优先级自动消费，保证用户体验最优化
3. **灵活配置**：热更新消费规则，无需重启即可调整策略
4. **永续价值**：购买的Token永不过期，增加用户购买意愿

#### 技术优化
1. **事务安全**：使用数据库事务保证Token发放和数据一致性
2. **定时任务**：自动处理套餐过期、签到重置、Token清理等周期性任务
3. **性能优化**：合理使用索引和缓存，确保高并发下的稳定性

通过GoFly框架的深度复用（实际可达85%），我们可以在6周内完成重构，实现性能飞跃和管理统一。这不是一次重写，而是一次进化。邀请、签到和Token系统将成为用户增长、活跃和变现的三引擎，预计可带来：
- 用户增长率：30%以上（通过邀请）
- 日活跃度提升：50%以上（通过签到）
- 付费转化率提升：20%以上（通过Token经济系统）
- 用户留存率提升：40%以上（通过多重激励机制）