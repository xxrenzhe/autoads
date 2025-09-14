import React from 'react';
import {
  Card,
  CardContent,
  Grid,
  Typography,
  Box,
  LinearProgress,
  Button,
  Link,
} from '@mui/material';
import {
  People,
  Subscriptions,
  Token,
  TrendingUp,
  Analytics,
  Settings,
  Payment,
  Assessment,
  ArrowUpward,
  ArrowDownward,
  CardGiftcard,
  Warning,
  Speed,
  Api,
  Refresh,
  Keyboard,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import GoFlyPanelStats from './gofly/GoFlyPanelStats';
import GoFlyUsersPreview from './gofly/GoFlyUsersPreview';

interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  totalSubscriptions: number;
  trialUsers: number;
  monthlyRevenue: number;
  tokenConsumption: {
    today: number;
    thisMonth: number;
    lastMonth?: number;
    byFeature?: {
      today: {
        siterank: number;
        batchopen: number;
        adscenter: number;
      };
      thisMonth: {
        siterank: number;
        batchopen: number;
        adscenter: number;
      };
    };
  };
  apiUsage: {
    today: number;
    thisMonth: number;
    lastMonth?: number;
    successRate?: {
      today: number;
      thisMonth: number;
    };
    errorRate?: {
      today: number;
      thisMonth: number;
    };
    avgResponseTime?: {
      today: number;
      thisMonth: number;
    };
    topEndpoints?: {
      today: Array<{ endpoint: string; count: number }>;
      thisMonth: Array<{ endpoint: string; count: number }>;
    };
  };
  subscriptionByPlan: Record<string, number>;
  featureUsage: {
    siterank: number;
    batchopen: number;
    adscenter?: number;
  };
  growth: {
    userGrowth: number;
    revenueGrowth: number;
    tokenGrowth?: number;
    apiGrowth?: number;
  };
  newUsers: {
    thisMonth: number;
    lastMonth: number;
  };
  trialStats?: {
    totalTrialsAssigned: number;
    activeTrials: number;
    expiredTrials: number;
    conversionRate: number;
    expiringThisWeek: number;
  };
}

const AdminDashboard: React.FC = () => {
  const [stats, setStats] = React.useState<DashboardStats | null>(null);
  const [loading, setLoading] = React.useState(true);
  const navigate = useNavigate();
  const PAYMENTS_ENABLED = process.env.NEXT_PUBLIC_PAYMENTS_ENABLED === 'true';

  React.useEffect(() => {
    // Fetch dashboard statistics
    const fetchStats = async () => {
      try {
        const response = await fetch('/api/admin/dashboard/realtime-stats');
        const data = await response.json();
        setStats(data);
      } catch (error) {
        console.error('Failed to fetch dashboard stats:', error);
        // Fallback to basic stats
        try {
          const fallbackResponse = await fetch('/api/admin/dashboard/stats');
          const fallbackData = await fallbackResponse.json();
          setStats(fallbackData);
        } catch (fallbackError) {
          console.error('Failed to fetch fallback dashboard stats:', fallbackError);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
    
    // Refresh stats every 5 minutes
    const interval = setInterval(fetchStats, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);

  // Keyboard shortcuts
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.altKey) {
        switch (event.key.toLowerCase()) {
          case 'u':
            event.preventDefault();
            navigate('/admin-dashboard/users');
            break;
          case 'p':
            event.preventDefault();
            navigate('/admin-dashboard/plans');
            break;
          case 't':
            event.preventDefault();
            navigate('/admin-dashboard/trials');
            break;
          case 'b':
            event.preventDefault();
            if (PAYMENTS_ENABLED) navigate('/admin-dashboard/payment-providers');
            break;
          case 'a':
            event.preventDefault();
            navigate('/admin-dashboard/api-analytics');
            break;
          case 'k':
            event.preventDefault();
            navigate('/admin-dashboard/token-usage');
            break;
          case 's':
            event.preventDefault();
            navigate('/admin-dashboard/user-statistics');
            break;
          case 'c':
            event.preventDefault();
            navigate('/admin-dashboard/system-configs');
            break;
          case 'r':
            event.preventDefault();
            window.location.reload();
            break;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <LinearProgress />
      </Box>
    );
  }

  const StatCard: React.FC<{
    title: string;
    value: string | number;
    icon: React.ReactNode;
    color: string;
    subtitle?: string;
    growth?: number;
  }> = ({ title, value, icon, color, subtitle, growth }) => (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Box sx={{ color, mr: 2 }}>{icon}</Box>
          <Typography variant="h6" component="div">
            {title}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
          <Typography variant="h4" component="div" sx={{ fontWeight: 'bold' }}>
            {value}
          </Typography>
          {typeof growth === 'number' && (
            <Box 
              sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                color: growth >= 0 ? 'success.main' : 'error.main',
                fontSize: '0.875rem'
              }}
            >
              {growth >= 0 ? (
                <ArrowUpward sx={{ fontSize: '1rem' }} />
              ) : (
                <ArrowDownward sx={{ fontSize: '1rem' }} />
              )}
              {Math.abs(growth)}%
            </Box>
          )}
        </Box>
        {subtitle && (
          <Typography variant="body2" color="text.secondary">
            {subtitle}
          </Typography>
        )}
      </CardContent>
    </Card>
  );

  return (
    <Box sx={{ p: 3 }}>
      {/* GoFly 后端实时统计与最近用户（零侵入式增强） */}
      <GoFlyPanelStats />
      <GoFlyUsersPreview />
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          管理面板
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            size="small"
            startIcon={<Refresh />}
            onClick={() => window.location.reload()}
            title="刷新数据 (快捷键: Alt+R)"
          >
            刷新
          </Button>
          <Button
            size="small"
            startIcon={<Keyboard />}
            onClick={() => {
              alert('快捷键说明:\\n\\nAlt+U: 用户管理\\nAlt+P: 套餐管理\\nAlt+T: 试用管理\\nAlt+B: 支付配置\\nAlt+A: API统计\\nAlt+K: Token使用\\nAlt+S: 用户统计\\nAlt+C: 系统配置\\nAlt+R: 刷新页面');
            }}
            title="查看快捷键说明"
          >
            快捷键
          </Button>
        </Box>
      </Box>
      
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="总用户数"
            value={stats?.totalUsers || 0}
            icon={<People />}
            color="#1976d2"
            subtitle={`活跃用户: ${stats?.activeUsers || 0}`}
            growth={stats?.growth?.userGrowth}
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="付费订阅"
            value={(stats?.totalSubscriptions || 0) - (stats?.trialUsers || 0)}
            icon={<Subscriptions />}
            color="#388e3c"
            subtitle={stats?.subscriptionByPlan ? 
              Object.entries(stats.subscriptionByPlan)
                .filter(([plan]: any) => plan !== 'Trial')
                .map(([plan, count]: any) => `${plan}: ${count}`)
                .join(', ')
              : undefined
            }
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="本月收入"
            value={`¥${stats?.monthlyRevenue || 0}`}
            icon={<TrendingUp />}
            color="#f57c00"
            growth={stats?.growth?.revenueGrowth}
            subtitle={`新用户: ${stats?.newUsers?.thisMonth || 0}人`}
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="试用用户"
            value={stats?.trialUsers || 0}
            icon={<CardGiftcard />}
            color="#e91e63"
            subtitle={stats?.trialStats ? 
              `转化率: ${stats.trialStats.conversionRate.toFixed(1)}% | 本周到期: ${stats.trialStats.expiringThisWeek}`
              : undefined
            }
          />
        </Grid>
      </Grid>

      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Token消耗"
            value={stats?.tokenConsumption.thisMonth || 0}
            icon={<Token />}
            color="#7b1fa2"
            subtitle={`今日: ${stats?.tokenConsumption.today || 0}`}
            growth={stats?.growth?.tokenGrowth}
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="API调用"
            value={stats?.apiUsage.thisMonth || 0}
            icon={<Api />}
            color="#00796b"
            subtitle={`今日: ${stats?.apiUsage.today || 0}`}
            growth={stats?.growth?.apiGrowth}
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="SiteRank使用"
            value={stats?.featureUsage?.siterank || 0}
            icon={<Speed />}
            color="#ff5722"
            subtitle="今日使用次数"
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="BatchOpen使用"
            value={stats?.featureUsage?.batchopen || 0}
            icon={<Assessment />}
            color="#795548"
            subtitle="今日使用次数"
          />
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" component="div" sx={{ mb: 2 }}>
                <Api sx={{ mr: 1, verticalAlign: 'middle' }} />
                API性能监控
              </Typography>
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                  今日统计
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    总调用次数
                  </Typography>
                  <Typography variant="body2" fontWeight="bold">
                    {stats?.apiUsage.today || 0} 次
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    成功率
                  </Typography>
                  <Typography 
                    variant="body2" 
                    fontWeight="bold" 
                    color={(stats?.apiUsage.successRate?.today || 0) >= 95 ? 'success.main' : 'warning.main'}
                  >
                    {(stats?.apiUsage.successRate?.today || 0).toFixed(1)}%
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    平均响应时间
                  </Typography>
                  <Typography variant="body2" fontWeight="bold">
                    {(stats?.apiUsage.avgResponseTime?.today || 0).toFixed(0)}ms
                  </Typography>
                </Box>
                
                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1, mt: 2 }}>
                  本月统计
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    总调用次数
                  </Typography>
                  <Typography variant="body2" fontWeight="bold">
                    {stats?.apiUsage.thisMonth || 0} 次
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    成功率
                  </Typography>
                  <Typography 
                    variant="body2" 
                    fontWeight="bold" 
                    color={(stats?.apiUsage.successRate?.thisMonth || 0) >= 95 ? 'success.main' : 'warning.main'}
                  >
                    {(stats?.apiUsage.successRate?.thisMonth || 0).toFixed(1)}%
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">
                    平均响应时间
                  </Typography>
                  <Typography variant="body2" fontWeight="bold">
                    {(stats?.apiUsage.avgResponseTime?.thisMonth || 0).toFixed(0)}ms
                  </Typography>
                </Box>

                {stats?.apiUsage.topEndpoints?.today && stats.apiUsage.topEndpoints.today.length > 0 && (
                  <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid #e0e0e0' }}>
                    <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                      热门端点 (今日)
                    </Typography>
                    {stats.apiUsage.topEndpoints.today.slice(0, 3).map((endpoint, index: any) => (
                      <Box key={index} sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ 
                          overflow: 'hidden', 
                          textOverflow: 'ellipsis',
                          maxWidth: '70%'
                        }}>
                          {endpoint.endpoint}
                        </Typography>
                        <Typography variant="caption" fontWeight="bold">
                          {endpoint.count}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" component="div" sx={{ mb: 2 }}>
                <CardGiftcard sx={{ mr: 1, verticalAlign: 'middle' }} />
                试用用户概览
              </Typography>
              {stats?.trialStats ? (
                <Box sx={{ mt: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      活跃试用
                    </Typography>
                    <Typography variant="body2" fontWeight="bold" color="primary">
                      {stats.trialStats.activeTrials} 人
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      本周到期
                    </Typography>
                    <Typography variant="body2" fontWeight="bold" color="warning.main">
                      {stats.trialStats.expiringThisWeek} 人
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      转化率
                    </Typography>
                    <Typography variant="body2" fontWeight="bold" color="success.main">
                      {stats.trialStats.conversionRate.toFixed(1)}%
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">
                      总分配试用
                    </Typography>
                    <Typography variant="body2" fontWeight="bold">
                      {stats.trialStats.totalTrialsAssigned} 人
                    </Typography>
                  </Box>
                  {stats.trialStats.expiringThisWeek > 0 && (
                    <Box sx={{ mt: 2, p: 1, bgcolor: 'warning.light', borderRadius: 1 }}>
                      <Typography variant="caption" color="warning.dark" sx={{ display: 'flex', alignItems: 'center' }}>
                        <Warning sx={{ fontSize: '1rem', mr: 0.5 }} />
                        {stats.trialStats.expiringThisWeek} 个试用即将到期
                      </Typography>
                    </Box>
                  )}
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  试用数据加载中...
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" component="div" sx={{ mb: 2 }}>
                <Analytics sx={{ mr: 1, verticalAlign: 'middle' }} />
                功能使用详情
              </Typography>
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                  今日使用次数
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    SiteRank
                  </Typography>
                  <Typography variant="body2" fontWeight="bold">
                    {stats?.featureUsage?.siterank || 0} 次
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    BatchOpen
                  </Typography>
                  <Typography variant="body2" fontWeight="bold">
                    {stats?.featureUsage?.batchopen || 0} 次
                  </Typography>
                </Box>
                {stats?.featureUsage?.adscenter !== undefined && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      ChangeLink
                    </Typography>
                    <Typography variant="body2" fontWeight="bold">
                      {stats.featureUsage.adscenter} 次
                    </Typography>
                  </Box>
                )}
                
                <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid #e0e0e0' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary" fontWeight="bold">
                      总使用次数
                    </Typography>
                    <Typography variant="body2" fontWeight="bold" color="primary">
                      {(stats?.featureUsage?.siterank || 0) + 
                       (stats?.featureUsage?.batchopen || 0) + 
                       (stats?.featureUsage?.adscenter || 0)} 次
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" component="div" sx={{ mb: 2 }}>
                <Token sx={{ mr: 1, verticalAlign: 'middle' }} />
                Token消耗详情
              </Typography>
              {stats?.tokenConsumption?.byFeature ? (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                    今日消耗
                  </Typography>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      SiteRank
                    </Typography>
                    <Typography variant="body2" fontWeight="bold">
                      {stats.tokenConsumption.byFeature.today.siterank} tokens
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      BatchOpen
                    </Typography>
                    <Typography variant="body2" fontWeight="bold">
                      {stats.tokenConsumption.byFeature.today.batchopen} tokens
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      ChangeLink
                    </Typography>
                    <Typography variant="body2" fontWeight="bold">
                      {stats.tokenConsumption.byFeature.today.adscenter} tokens
                    </Typography>
                  </Box>
                  
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1, mt: 2 }}>
                    本月消耗
                  </Typography>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      SiteRank
                    </Typography>
                    <Typography variant="body2" fontWeight="bold">
                      {stats.tokenConsumption.byFeature.thisMonth.siterank} tokens
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      BatchOpen
                    </Typography>
                    <Typography variant="body2" fontWeight="bold">
                      {stats.tokenConsumption.byFeature.thisMonth.batchopen} tokens
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">
                      ChangeLink
                    </Typography>
                    <Typography variant="body2" fontWeight="bold">
                      {stats.tokenConsumption.byFeature.thisMonth.adscenter} tokens
                    </Typography>
                  </Box>
                  
                  <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid #e0e0e0' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" color="text.secondary" fontWeight="bold">
                        总计 (本月)
                      </Typography>
                      <Typography variant="body2" fontWeight="bold" color="primary">
                        {stats.tokenConsumption.thisMonth} tokens
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Token消耗数据加载中...
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" component="div" sx={{ mb: 2 }}>
                <Speed sx={{ mr: 1, verticalAlign: 'middle' }} />
                实时使用监控
              </Typography>
              <Box sx={{ mt: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    当前活跃用户
                  </Typography>
                  <Typography variant="body2" fontWeight="bold" color="success.main">
                    {stats?.activeUsers || 0} 人
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    今日API调用
                  </Typography>
                  <Typography variant="body2" fontWeight="bold">
                    {stats?.apiUsage.today || 0} 次
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    今日Token消耗
                  </Typography>
                  <Typography variant="body2" fontWeight="bold">
                    {stats?.tokenConsumption.today || 0} tokens
                  </Typography>
                </Box>
                
                {stats?.growth && (
                  <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid #e0e0e0' }}>
                    <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                      月度增长趋势
                    </Typography>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2" color="text.secondary">
                        Token使用增长
                      </Typography>
                      <Box sx={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        color: (stats.growth.tokenGrowth || 0) >= 0 ? 'success.main' : 'error.main'
                      }}>
                        {(stats.growth.tokenGrowth || 0) >= 0 ? (
                          <ArrowUpward sx={{ fontSize: '1rem' }} />
                        ) : (
                          <ArrowDownward sx={{ fontSize: '1rem' }} />
                        )}
                        <Typography variant="body2" fontWeight="bold">
                          {Math.abs(stats.growth.tokenGrowth || 0)}%
                        </Typography>
                      </Box>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" color="text.secondary">
                        API使用增长
                      </Typography>
                      <Box sx={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        color: (stats.growth.apiGrowth || 0) >= 0 ? 'success.main' : 'error.main'
                      }}>
                        {(stats.growth.apiGrowth || 0) >= 0 ? (
                          <ArrowUpward sx={{ fontSize: '1rem' }} />
                        ) : (
                          <ArrowDownward sx={{ fontSize: '1rem' }} />
                        )}
                        <Typography variant="body2" fontWeight="bold">
                          {Math.abs(stats.growth.apiGrowth || 0)}%
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" component="div" sx={{ mb: 2 }}>
                快速操作
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 1 }}>
                <Button 
                  size="small" 
                  startIcon={<People />}
                  onClick={() => navigate('/admin-dashboard/users')}
                  sx={{ justifyContent: 'flex-start' }}
                  title="管理用户账户和权限 (快捷键: Alt+U)"
                >
                  用户管理
                </Button>
                <Button 
                  size="small" 
                  startIcon={<Subscriptions />}
                  onClick={() => navigate('/admin-dashboard/plans')}
                  sx={{ justifyContent: 'flex-start' }}
                  title="管理订阅套餐和定价 (快捷键: Alt+P)"
                >
                  套餐管理
                </Button>
                <Button 
                  size="small" 
                  startIcon={<CardGiftcard />}
                  onClick={() => navigate('/admin-dashboard/trials')}
                  sx={{ justifyContent: 'flex-start' }}
                  title="管理试用用户和转化 (快捷键: Alt+T)"
                  color={stats?.trialStats?.expiringThisWeek ? 'warning' : 'primary'}
                >
                  试用管理 {stats?.trialStats?.expiringThisWeek ? `(${stats.trialStats.expiringThisWeek})` : ''}\n                </Button>
                {!PAYMENTS_ENABLED ? null : (
                  <Button 
                    size="small" 
                    startIcon={<Payment />}
                    onClick={() => navigate('/admin-dashboard/payment-providers')}
                    sx={{ justifyContent: 'flex-start' }}
                    title="配置支付方式和账单 (快捷键: Alt+B)"
                  >
                    支付配置
                  </Button>
                )}
                <Button 
                  size="small" 
                  startIcon={<Assessment />}
                  onClick={() => navigate('/admin-dashboard/api-analytics')}
                  sx={{ justifyContent: 'flex-start' }}
                  title="查看API使用统计和性能 (快捷键: Alt+A)"
                  color={(stats?.apiUsage.successRate?.today || 0) < 95 ? 'warning' : 'primary'}
                >
                  API统计
                </Button>
                <Button 
                  size="small" 
                  startIcon={<Token />}
                  onClick={() => navigate('/admin-dashboard/token-usage')}
                  sx={{ justifyContent: 'flex-start' }}
                  title="监控Token消耗和配额 (快捷键: Alt+K)"
                >
                  Token使用
                </Button>
                <Button 
                  size="small" 
                  startIcon={<Analytics />}
                  onClick={() => navigate('/admin-dashboard/user-statistics')}
                  sx={{ justifyContent: 'flex-start' }}
                  title="查看用户行为和增长数据 (快捷键: Alt+S)"
                >
                  用户统计
                </Button>
                <Button 
                  size="small" 
                  startIcon={<Settings />}
                  onClick={() => navigate('/admin-dashboard/system-configs')}
                  sx={{ justifyContent: 'flex-start' }}
                  title="系统配置和环境变量 (快捷键: Alt+C)"
                >
                  系统配置
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default AdminDashboard;
