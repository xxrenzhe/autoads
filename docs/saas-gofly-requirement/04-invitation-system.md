# 邀请功能系统设计

## 1. 功能概述

### 1.1 业务需求

邀请功能是一种简单的用户增长机制：

- **新用户注册奖励**：直接注册获得14天Pro套餐
- **邀请注册奖励**：通过邀请链接注册，获得30天Pro套餐（不与14天叠加）
- **邀请者奖励**：成功邀请一个用户注册，获得30天Pro套餐，可累加
- **即时到账**：注册成功立即发放奖励

### 1.2 设计原则

遵循Linus的设计哲学：
- **数据结构优先**：只需要一个邀请记录表
- **消除特殊情况**：没有多级奖励，没有复杂条件
- **保持简洁**：邀请即奖励，简单明了
- **自动生成**：用户注册时自动生成邀请码，无需手动操作

## 2. 数据模型设计

### 2.1 邀请记录表（最简单的设计）

```sql
-- 最简单的邀请记录表
CREATE TABLE invitations (
    id VARCHAR(36) PRIMARY KEY,
    inviter_id VARCHAR(36) NOT NULL COMMENT '邀请者ID',
    invitee_id VARCHAR(36) NOT NULL COMMENT '被邀请者ID',
    invite_code VARCHAR(20) NOT NULL COMMENT '邀请码',
    status ENUM('pending', 'completed') DEFAULT 'pending' COMMENT '状态',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_inviter (inviter_id),
    INDEX idx_code (invite_code),
    UNIQUE KEY uk_invitee (invitee_id)
);
```

就这么简单，不需要复杂的字段和状态。

## 3. API接口设计

### 3.1 用户端接口

**获取邀请信息**
- **路径**：`GET /api/v1/invitation/info`
- **认证**：需要登录
- **响应**：
```json
{
    "code": 0,
    "message": "成功",
    "data": {
        "invite_link": "https://autoads.dev/register?invite=ABC123",
        "invite_code": "ABC123",
        "stats": {
            "total_invited": 5,
            "accepted_invited": 3,
            "total_reward_days": 90,
            "pending_invited": 2
        },
        "recent_invitations": [
            {
                "invitee_email": "user@example.com",
                "status": "accepted",
                "created_at": "2024-01-01T10:00:00Z"
            }
        ]
    }
}
```

**获取邀请历史**
- **路径**：`GET /api/v1/invitation/history?page=1&page_size=20`
- **认证**：需要登录
- **响应**：
```json
{
    "code": 0,
    "message": "成功",
    "data": {
        "invitations": [
            {
                "id": "inv123",
                "invitee": {
                    "email": "user@example.com",
                    "name": "张三"
                },
                "status": "accepted",
                "created_at": "2024-01-01T10:00:00Z"
            }
        ],
        "pagination": {
            "page": 1,
            "page_size": 20,
            "total": 50,
            "total_pages": 3
        }
    }
}
```

### 3.2 管理后台接口

**邀请排行榜**
- **路径**：`GET /api/v1/admin/invitation/leaderboard`
- **认证**：需要Admin权限
- **响应**：
```json
{
    "code": 0,
    "message": "成功",
    "data": {
        "leaderboard": [
            {
                "rank": 1,
                "user_id": "user123",
                "email": "top1@example.com",
                "accepted_count": 20,
                "total_reward_days": 600
            }
        ]
    }
}
```

**邀请记录管理**
- **路径**：`GET /api/v1/admin/invitation/records`
- **认证**：需要Admin权限
- **查询参数**：page, page_size, search, status, start_date, end_date
- **响应**：
```json
{
    "code": 0,
    "message": "成功",
    "data": {
        "records": [
            {
                "id": "inv123",
                "inviter": {
                    "id": "user123",
                    "email": "inviter@example.com"
                },
                "invitee": {
                    "id": "user456",
                    "email": "invitee@example.com"
                },
                "invite_code": "ABC123",
                "status": "accepted",
                "created_at": "2024-01-01T10:00:00Z"
            }
        ],
        "pagination": {...}
    }
}
```

## 4. 业务逻辑实现

### 4.1 邀请码生成（自动生成）

```go
// 生成邀请码
func generateInviteCode() string {
    // 使用UUID前8位作为邀请码
    return strings.ToUpper(uuid.New().String()[:8])
}

// 用户注册时自动生成邀请码
func generateInviteCodeOnRegistration(user *User) error {
    // 为新用户自动生成邀请码
    user.InviteCode = generateInviteCode()
    return db.Save(user).Error
}

// 获取邀请链接（无需手动生成）
func GetInviteLink(userID string) (string, error) {
    var user User
    if err := db.Where("id = ?", userID).First(&user).Error; err != nil {
        return "", err
    }
    
    // 用户注册时已有邀请码，直接返回链接
    if user.InviteCode == "" {
        // 兜底处理：如果没有邀请码，生成一个
        user.InviteCode = generateInviteCode()
        if err := db.Save(&user).Error; err != nil {
            return "", err
        }
    }
    
    return fmt.Sprintf("https://autoads.dev/register?invite=%s", user.InviteCode), nil
}
```

### 4.2 注册流程集成（自动生成邀请码）

```go
// 用户注册流程（集成邀请码自动生成）
func RegisterUser(email, password, inviteCode string) error {
    return db.Transaction(func(tx *gorm.DB) error {
        now := time.Now()
        
        // 创建新用户
        newUser := User{
            ID:       uuid.New().String(),
            Email:    email,
            Password: hashPassword(password),
            Plan:     "FREE", // 先设为免费版
            CreatedAt: now,
        }
        
        // 自动生成邀请码（优化点：无需用户点击）
        newUser.InviteCode = generateInviteCode()
        
        // 处理邀请逻辑和套餐奖励
        if inviteCode == "" {
            // 直接注册：获得14天Pro
            newUser.Plan = "PRO"
            expiresAt := now.AddDate(0, 0, 14)
            newUser.PlanExpires = &expiresAt
        } else {
            // 通过邀请链接注册：查找邀请者
            var inviter User
            if err := tx.Where("invite_code = ?", inviteCode).First(&inviter).Error; err == nil {
                // 创建邀请记录
                invitation := Invitation{
                    ID:         uuid.New().String(),
                    InviterID:  inviter.ID,
                    InviteeID:  newUser.ID,
                    InviteCode: inviteCode,
                    Status:     "completed",
                    CreatedAt:  now,
                }
                if err := tx.Create(&invitation).Error; err != nil {
                    return err
                }
                
                // 被邀请用户获得30天Pro
                newUser.Plan = "PRO"
                expiresAt := now.AddDate(0, 0, 30)
                newUser.PlanExpires = &expiresAt
                newUser.InvitedBy = &inviter.ID
                
                // 邀请者获得30天Pro（累加）
                if inviter.PlanExpires == nil || inviter.PlanExpires.Before(now) {
                    start := now
                    inviter.PlanExpires = &start
                    inviter.PlanExpires.AddDate(0, 0, 30)
                } else {
                    inviter.PlanExpires.AddDate(0, 0, 30)
                }
                inviter.Plan = "PRO"
                
                // 更新邀请者
                if err := tx.Save(&inviter).Error; err != nil {
                    return err
                }
            } else {
                // 邀请码无效，给新用户14天Pro
                newUser.Plan = "PRO"
                expiresAt := now.AddDate(0, 0, 14)
                newUser.PlanExpires = &expiresAt
            }
        }
        
        // 保存新用户（已包含自动生成的邀请码）
        return tx.Create(&newUser).Error
    })
}
```

### 4.3 邀请统计（简化版）

```go
// 获取用户邀请统计
func GetInvitationStats(userID string) (map[string]interface{}, error) {
    var stats struct {
        TotalInvited    int `json:"total_invited"`
        AcceptedInvited int `json:"accepted_invited"`
    }
    
    // 查询统计数据
    db.Model(&Invitation{}).
        Where("inviter_id = ?", userID).
        Select("count(*) as total_invited, sum(case when status = 'completed' then 1 else 0 end) as accepted_invited").
        Scan(&stats)
    
    return map[string]interface{}{
        "total_invited":     stats.TotalInvited,
        "accepted_invited":  stats.AcceptedInvited,
        "pending_invited":   stats.TotalInvited - stats.AcceptedInvited,
        "total_reward_days": stats.AcceptedInvited * 30,
    }, nil
}
```

## 5. 前端组件设计

### 5.1 邀请卡片组件（已自动生成邀请码）

```jsx
// 邀请好友卡片 - 注册时自动生成邀请码
const InviteCard = () => {
    const [inviteInfo, setInviteInfo] = useState(null);
    const [copied, setCopied] = useState(false);
    
    useEffect(() => {
        fetchInviteInfo();
    }, []);
    
    const fetchInviteInfo = async () => {
        const res = await fetch('/api/v1/invitation/info');
        const data = await res.json();
        setInviteInfo(data.data);
    };
    
    const copyLink = () => {
        navigator.clipboard.writeText(inviteInfo.invite_link);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };
    
    return (
        <Card>
            <CardContent>
                <Typography variant="h6" gutterBottom>
                    邀请好友注册，双方各得30天Pro会员！
                </Typography>
                
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    💡 您的专属邀请链接已自动生成，无需手动操作
                </Typography>
                
                <Box sx={{ p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                        专属邀请链接：
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                        <TextField
                            fullWidth
                            value={inviteInfo?.invite_link || ''}
                            size="small"
                            InputProps={{ readOnly: true }}
                        />
                        <Button
                            variant="contained"
                            sx={{ ml: 1 }}
                            onClick={copyLink}
                        >
                            {copied ? '已复制' : '复制链接'}
                        </Button>
                    </Box>
                </Box>
                
                <Grid container spacing={2} sx={{ mt: 2 }}>
                    <Grid item xs={4}>
                        <StatCard
                            title="已邀请"
                            value={inviteInfo?.stats?.total_invited || 0}
                            icon={<PeopleIcon />}
                        />
                    </Grid>
                    <Grid item xs={4}>
                        <StatCard
                            title="成功注册"
                            value={inviteInfo?.stats?.accepted_invited || 0}
                            icon={<CheckCircleIcon />}
                        />
                    </Grid>
                    <Grid item xs={4}>
                        <StatCard
                            title="获得奖励"
                            value={`${inviteInfo?.stats?.total_reward_days || 0}天`}
                            icon={<EmojiEventsIcon />}
                        />
                    </Grid>
                </Grid>
            </CardContent>
        </Card>
    );
};
```

### 5.2 邀请历史列表

```jsx
// 邀请历史列表
const InvitationHistory = () => {
    const [invitations, setInvitations] = useState([]);
    const [pagination, setPagination] = useState({});
    
    useEffect(() => {
        fetchInvitations();
    }, []);
    
    const fetchInvitations = async (page = 1) => {
        const res = await fetch(`/api/v1/invitation/history?page=${page}`);
        const data = await res.json();
        setInvitations(data.data.invitations);
        setPagination(data.data.pagination);
    };
    
    return (
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
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {invitations.map((inv) => (
                                <TableRow key={inv.id}>
                                    <TableCell>{inv.invitee.email}</TableCell>
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
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            </CardContent>
        </Card>
    );
};
```

## 6. 管理后台设计

### 6.1 邀请排行榜组件

```jsx
// 邀请排行榜
const InvitationLeaderboard = () => {
    const [leaderboard, setLeaderboard] = useState([]);
    
    useEffect(() => {
        fetchLeaderboard();
    }, []);
    
    const fetchLeaderboard = async () => {
        const res = await fetch('/api/v1/admin/invitation/leaderboard');
        const data = await res.json();
        setLeaderboard(data.data.leaderboard);
    };
    
    return (
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
    );
};
```

## 7. 定时任务

### 7.1 清理过期邀请

使用GoFly的调度器定期清理过期的邀请：

```go
// 清理过期邀请任务
type CleanExpiredInvitationsJob struct{}

func (j *CleanExpiredInvitationsJob) GetName() string {
    return "clean_expired_invitations"
}

func (j *CleanExpiredInvitationsJob) GetDescription() string {
    return "Clean expired invitation records"
}

func (j *CleanExpiredInvitationsJob) Run(ctx context.Context) error {
    // 清理30天前仍为pending状态的邀请
    expiredDate := time.Now().AddDate(0, 0, -30)
    
    result := db.Model(&Invitation{}).
        Where("status = ? AND created_at < ?", "pending", expiredDate).
        Updates(map[string]interface{}{
            "status": "expired",
            "expired_at": time.Now(),
        })
    
    if result.Error != nil {
        return result.Error
    }
    
    log.Printf("Cleaned %d expired invitations", result.RowsAffected)
    return nil
}

// 注册定时任务
scheduler.AddJob(&scheduler.CronJob{
    Job:         &CleanExpiredInvitationsJob{},
    Schedule:    "0 2 * * * *", // 每天凌晨2点执行
    Description: "Clean expired invitations",
})
```

## 8. 性能优化

### 8.1 缓存策略

- **用户邀请信息缓存**：缓存5分钟
- **排行榜缓存**：缓存1小时
- **邀请链接缓存**：永久缓存（生成后不变）

```go
// 缓存用户邀请统计
func GetInvitationStatsWithCache(userID, tenantID string) (map[string]interface{}, error) {
    cacheKey := fmt.Sprintf("invitation:stats:%s:%s", tenantID, userID)
    
    // 尝试从缓存获取
    var stats map[string]interface{}
    if err := cache.Get(cacheKey, &stats); err == nil {
        return stats, nil
    }
    
    // 从数据库获取
    stats, err := GetInvitationStats(userID, tenantID)
    if err != nil {
        return nil, err
    }
    
    // 缓存5分钟
    cache.Set(cacheKey, stats, 5*time.Minute)
    
    return stats, nil
}
```

### 8.2 数据库优化

- 为常用查询字段创建索引
- 使用分页查询避免大量数据加载
- 统计查询使用预计算或缓存

## 9. 注意事项

1. **自动生成邀请码**：用户注册时自动生成专属邀请码，无需手动操作
2. **防刷机制**：同一个IP或设备限制注册次数
3. **邀请码安全**：邀请码使用8位随机字符串，避免被猜测
4. **事务安全**：奖励发放使用数据库事务确保一致性
5. **过期处理**：定期清理过期的邀请记录
6. **数据统计**：使用缓存提升统计性能

## 10. 扩展性考虑

1. **奖励规则配置化**：将奖励天数、奖励类型等做成可配置
2. **多级邀请**：支持多级邀请奖励（如A邀请B，B邀请C，A也能获得奖励）
3. **活动邀请**：支持限时邀请活动，提高奖励
4. **邀请效果分析**：分析邀请转化率、用户质量等