# 签到功能系统设计

## 1. 功能概述

### 1.1 业务需求

签到功能是提升用户活跃度的简单手段：

- **固定奖励**：每天签到获得10个Token
- **简单记录**：记录签到历史
- **日历展示**：直观显示本月签到情况

### 1.2 设计原则

遵循Linus的设计哲学：
- **数据结构优先**：只需要签到记录表
- **消除特殊情况**：没有连续天数，没有阶梯奖励
- **保持简洁**：每天固定10个Token，简单明了

## 2. 数据模型设计

### 2.1 签到记录表（最简单的设计）

```sql
-- 只需要一个简单的记录表
CREATE TABLE checkin_records (
    user_id VARCHAR(36) NOT NULL COMMENT '用户ID',
    checkin_date DATE NOT NULL COMMENT '签到日期',
    token_reward INT DEFAULT 10 COMMENT '获得Token数量',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    PRIMARY KEY (user_id, checkin_date),
    INDEX idx_user (user_id)
);
```

就这么简单，不需要其他表。用户累计签到次数可以通过COUNT计算。

## 3. API接口设计

### 3.1 用户端接口

**获取签到信息**
- **路径**：`GET /api/v1/checkin/info`
- **认证**：需要登录
- **响应**：
```json
{
    "code": 0,
    "message": "成功",
    "data": {
        "checked_in": false,
        "today_reward": 10,
        "month_calendar": {
            "2024-01-01": true,
            "2024-01-02": true,
            "2024-01-03": true
        }
    }
}
```

**执行签到**
- **路径**：`POST /api/v1/checkin/perform`
- **认证**：需要登录
- **响应**：
```json
{
    "code": 0,
    "message": "签到成功",
    "data": {
        "reward": {
            "tokens": 10,
            "balance": 150
        }
    }
}
```

**获取签到历史**
- **路径**：`GET /api/v1/checkin/history?page=1&page_size=20`
- **认证**：需要登录
- **响应**：
```json
{
    "code": 0,
    "message": "成功",
    "data": {
        "records": [
            {
                "checkin_date": "2024-01-01",
                "token_reward": 10,
                "created_at": "2024-01-01T10:00:00Z"
            }
        ],
        "pagination": {
            "page": 1,
            "page_size": 20,
            "total": 30,
            "total_pages": 2
        }
    }
}
```

### 3.2 管理后台接口

**签到记录查询**
- **路径**：`GET /api/v1/admin/checkin/records`
- **认证**：需要Admin权限
- **查询参数**：page, page_size, user_id, start_date, end_date
- **响应**：
```json
{
    "code": 0,
    "message": "成功",
    "data": {
        "records": [
            {
                "user": {
                    "id": "user123",
                    "email": "user@example.com"
                },
                "checkin_date": "2024-01-01",
                "token_reward": 10,
                "created_at": "2024-01-01T10:00:00Z"
            }
        ],
        "stats": {
            "total_checkins": 1000,
            "total_token_reward": 10000,
            "unique_users": 200,
            "avg_daily_checkins": 33
        },
        "pagination": {...}
    }
}
```

**签到排行榜**
- **路径**：`GET /api/v1/admin/checkin/leaderboard?period=month`
- **认证**：需要Admin权限
- **查询参数**：period（week/month/all）
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
                "checkin_count": 30,
                "total_tokens": 300,
                "checkin_rate": "100%"
            }
        ]
    }
}
```

## 4. 业务逻辑实现

### 4.1 Token奖励规则

**Linus式简化**：每天固定10个Token，没有连续天数，没有阶梯奖励。

```go
// 固定奖励配置
const DAILY_CHECKIN_REWARD = 10

// 获取今日应得Token数量（永远是10个）
func GetTokenReward() int64 {
    return DAILY_CHECKIN_REWARD
}
```

### 4.2 签到处理逻辑

```go
// 执行签到（简化版）
func PerformCheckIn(userID string) (*CheckInResult, error) {
    // 获取用户信息
    var user User
    if err := db.Where("id = ?", userID).First(&user).Error; err != nil {
        return nil, errors.New("用户不存在")
    }
    
    today := time.Now().Format("2006-01-02")
    
    // 检查今日是否已签到
    var existingRecord CheckinRecord
    if err := db.Where("user_id = ? AND checkin_date = ?", userID, today).
        First(&existingRecord).Error; err == nil {
        return nil, errors.New("今日已签到")
    }
    
    // 固定奖励10个Token
    tokenReward := GetTokenReward()
    
    // 开始事务
    tx := db.Begin()
    
    // 创建签到记录
    record := CheckinRecord{
        UserID:        userID,
        CheckinDate:   today,
        TokenReward:   tokenReward,
        CreatedAt:     time.Now(),
    }
    
    if err := tx.Create(&record).Error; err != nil {
        tx.Rollback()
        return nil, errors.New("签到失败")
    }
    
    // 更新用户Token余额
    user.TokenBalance += tokenReward
    
    if err := tx.Save(&user).Error; err != nil {
        tx.Rollback()
        return nil, errors.New("更新用户信息失败")
    }
    
    // 创建Token交易记录
    transaction := TokenTransaction{
        UserID:      userID,
        Amount:      tokenReward,
        Balance:     user.TokenBalance,
        Type:        "checkin",
        Description:  "每日签到奖励",
        CreatedAt:   time.Now(),
    }
    
    if err := tx.Create(&transaction).Error; err != nil {
        tx.Rollback()
        return nil, errors.New("创建交易记录失败")
    }
    
    tx.Commit()
    
    return &CheckInResult{
        Success:     true,
        TokenReward: tokenReward,
        Balance:     user.TokenBalance,
    }, nil
}
```

### 4.3 移除成就系统

**Linus式简化**：移除复杂的成就系统，签到就是获得Token，没有其他特殊情况。

## 5. 前端组件设计

### 5.1 签到卡片组件

```jsx
// 签到卡片组件
const CheckInCard = ({ user, onCheckIn }) => {
    const [checkInInfo, setCheckInInfo] = useState(null);
    const [loading, setLoading] = useState(false);
    
    useEffect(() => {
        fetchCheckInInfo();
    }, []);
    
    const fetchCheckInInfo = async () => {
        const res = await fetch('/api/v1/checkin/info');
        const data = await res.json();
        setCheckInInfo(data.data);
    };
    
    const handleCheckIn = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/v1/checkin/perform', {
                method: 'POST'
            });
            const data = await res.json();
            
            if (data.code === 0) {
                onCheckIn(data.data);
                fetchCheckInInfo();
                
                // 显示成就弹窗
                if (data.data.achievement) {
                    showAchievementNotification(data.data.achievement);
                }
            } else {
                message.error(data.message);
            }
        } catch (error) {
            message.error('签到失败');
        } finally {
            setLoading(false);
        }
    };
    
    return (
        <Card>
            <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                        <Typography variant="h6">
                            每日签到
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            {checkInInfo?.checked_in ? '今日已签到' : '点击签到获得10个Token'}
                        </Typography>
                    </Box>
                    
                    {!checkInInfo?.checked_in && (
                        <Button
                            variant="contained"
                            size="large"
                            onClick={handleCheckIn}
                            disabled={loading}
                            sx={{ minWidth: 120 }}
                        >
                            {loading ? <CircularProgress size={24} /> : '立即签到'}
                        </Button>
                    )}
                </Box>
                
                {checkInInfo && (
                    <Box sx={{ mt: 3 }}>
                        <Grid container spacing={2}>
                            <Grid item xs={6}>
                                <StatCard
                                    title="本月签到"
                                    value={Object.keys(checkInInfo.month_calendar || {}).length}
                                    icon={<EventAvailableIcon />}
                                />
                            </Grid>
                            <Grid item xs={6}>
                                <StatCard
                                    title="今日奖励"
                                    value={`${checkInInfo.today_reward} Token`}
                                    icon={<CoinsIcon />}
                                />
                            </Grid>
                        </Grid>
                    </Box>
                )}
            </CardContent>
        </Card>
    );
};
```

### 5.2 签到日历组件

```jsx
// 签到日历组件
const CheckInCalendar = ({ monthCalendar }) => {
    const [currentMonth, setCurrentMonth] = useState(new Date());
    
    const getDaysInMonth = (date) => {
        return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    };
    
    const renderCalendar = () => {
        const days = [];
        const daysInMonth = getDaysInMonth(currentMonth);
        const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay();
        
        // 填充空白
        for (let i = 0; i < firstDay; i++) {
            days.push(<Box key={`empty-${i}`} sx={{ width: 40, height: 40 }} />);
        }
        
        // 填充日期
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const hasCheckedIn = monthCalendar[dateStr] || false;
            const isToday = dateStr === new Date().toISOString().split('T')[0];
            
            days.push(
                <Box
                    key={day}
                    sx={{
                        width: 40,
                        height: 40,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: 1,
                        bgcolor: hasCheckedIn ? 'success.light' : 'grey.100',
                        border: isToday ? '2px solid' : 'none',
                        borderColor: 'primary.main',
                        position: 'relative'
                    }}
                >
                    <Typography variant="body2" color={hasCheckedIn ? 'white' : 'text.primary'}>
                        {day}
                    </Typography>
                    {hasCheckedIn && (
                        <CheckIcon
                            sx={{
                                position: 'absolute',
                                bottom: 2,
                                right: 2,
                                fontSize: 12,
                                color: 'white'
                            }}
                        />
                    )}
                </Box>
            );
        }
        
        return days;
    };
    
    return (
        <Card>
            <CardHeader
                title="签到日历"
                                action={
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <IconButton onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}>
                            <ChevronLeftIcon />
                        </IconButton>
                        <Typography variant="body1">
                            {currentMonth.getFullYear()}年{currentMonth.getMonth() + 1}月
                        </Typography>
                        <IconButton onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}>
                            <ChevronRightIcon />
                        </IconButton>
                    </Box>
                }
            />
            <CardContent>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1 }}>
                    {['日', '一', '二', '三', '四', '五', '六'].map(day => (
                        <Typography key={day} variant="body2" textAlign="center" color="text.secondary">
                            {day}
                        </Typography>
                    ))}
                    {renderCalendar()}
                </Box>
            </CardContent>
        </Card>
    );
};
```

## 6. 定时任务

### 6.1 签到提醒

```go
// 签到提醒任务
type CheckInReminderJob struct{}

func (j *CheckInReminderJob) GetName() string {
    return "checkin_reminder"
}

func (j *CheckInReminderJob) GetDescription() string {
    return "Send daily check-in reminder notifications"
}

func (j *CheckInReminderJob) Run(ctx context.Context) error {
    // 每天20:00发送提醒
    now := time.Now()
    if now.Hour() != 20 {
        return nil
    }
    
    today := now.Format("2006-01-02")
    
    // 查找今日未签到的活跃用户
    var users []SaaSUser
    db.Where("status = ? AND (last_checkin IS NULL OR last_checkin < ?)", 
        "active", today).Find(&users)
    
    for _, user := range users {
        // 发送提醒（邮件、站内信等）
        go sendCheckInReminder(user)
    }
    
    return nil
}

// 注册定时任务
scheduler.AddJob(&scheduler.CronJob{
    Job:         &CheckInReminderJob{},
    Schedule:    "0 0 20 * * *", // 每天20:00
    Description: "Daily check-in reminder",
})
```

### 6.2 数据统计

```go
// 签到统计任务
type CheckInStatsJob struct{}

func (j *CheckInStatsJob) GetName() string {
    return "checkin_stats"
}

func (j *CheckInStatsJob) GetDescription() string {
    return "Generate daily check-in statistics"
}

func (j *CheckInStatsJob) Run(ctx context.Context) error {
    yesterday := time.Now().AddDate(0, 0, -1).Format("2006-01-02")
    
    var stats struct {
        TotalCheckIns    int64 `json:"total_check_ins"`
        UniqueUsers      int64 `json:"unique_users"`
        TotalTokenReward int64 `json:"total_token_reward"`
    }
    
    // 统计数据
    db.Model(&CheckinRecord{}).
        Where("checkin_date = ?", yesterday).
        Count(&stats.TotalCheckIns)
    
    db.Model(&CheckinRecord{}).
        Where("checkin_date = ?", yesterday).
        Distinct("user_id").
        Count(&stats.UniqueUsers)
    
    db.Model(&CheckinRecord{}).
        Where("checkin_date = ?", yesterday).
        Select("COALESCE(SUM(token_reward), 0)").
        Row().Scan(&stats.TotalTokenReward)
    
    // 保存统计结果
    dailyStats := DailyStats{
        ID:              uuid.New().String(),
        Date:            yesterday,
        TotalCheckIns:   stats.TotalCheckIns,
        UniqueUsers:     stats.UniqueUsers,
        TotalTokenReward: stats.TotalTokenReward,
        CreatedAt:       time.Now(),
    }
    
    return db.Create(&dailyStats).Error
}

// 注册定时任务
scheduler.AddJob(&scheduler.CronJob{
    Job:         &CheckInStatsJob{},
    Schedule:    "0 5 0 * * *", // 每天凌晨0:05
    Description: "Daily check-in statistics",
})
```

## 7. 性能优化

### 7.1 缓存策略

- **用户签到状态缓存**：缓存5分钟
- **排行榜缓存**：缓存1小时
- **统计数据缓存**：缓存到下一天

```go
// 获取用户签到状态（带缓存）
func GetUserCheckInStatus(userID, tenantID string) (*CheckInStatus, error) {
    cacheKey := fmt.Sprintf("checkin:status:%s:%s", tenantID, userID)
    
    var status CheckInStatus
    if err := cache.Get(cacheKey, &status); err == nil {
        return &status, nil
    }
    
    // 从数据库获取
    var user SaaSUser
    if err := db.Where("id = ? AND tenant_id = ?", userID, tenantID).First(&user).Error; err != nil {
        return nil, err
    }
    
    today := time.Now().Format("2006-01-02")
    var todayRecord CheckinRecord
    isCheckedIn := db.Where("user_id = ? AND checkin_date = ?", userID, today).
        First(&todayRecord).Error == nil
    
    status = CheckInStatus{
        UserID:         userID,
        CheckedIn:      isCheckedIn,
        ContinuousDays: user.ContinuousDays,
        TotalCheckIns:  user.TotalCheckIns,
    }
    
    // 缓存到当天结束
    cache.Set(cacheKey, status, time.Until(time.Now().Truncate(24*time.Hour).Add(24*time.Hour)))
    
    return &status, nil
}
```

### 7.2 数据库优化

- 为常用查询字段创建复合索引
- 使用分区表存储大量签到记录
- 定期归档历史数据

## 8. 注意事项

1. **时区处理**：统一使用UTC时间存储，前端按用户时区显示
2. **并发安全**：使用数据库事务和唯一索引防止重复签到
3. **数据一致性**：Token发放和签到记录必须在同一事务中
4. **性能考虑**：签到是高频操作，需要优化查询和缓存
5. **防刷机制**：限制单个用户的签到频率

## 9. 扩展性考虑

1. **多样化奖励**：除了Token，可以增加积分、优惠券等
2. **活动签到**：支持特殊活动的额外奖励
3. **团队签到**：引入团队概念，团队签到有额外奖励
4. **签到任务**：设置签到目标，完成后获得奖励
5. **数据分析**：分析用户签到行为，优化奖励策略