import React from 'react';
import {
  Card,
  CardContent,
  Grid,
  Typography,
  Box,
  Button,
  Link,
} from '@mui/material';
import {
  People,
  Subscriptions,
  Token,
  TrendingUp,
  Speed,
  Assessment,
  Refresh,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

interface SimpleDashboardStats {
  totalUsers: number;
  activeUsers: number;
  totalSubscriptions: number;
  trialUsers: number;
  monthlyRevenue: number;
  featureUsage: {
    siterank: number;
    batchopen: number;
    adscenter: number;
  };
  tokenConsumption: {
    siterank: number;
    batchopen: number;
    adscenter: number;
    total: number;
  };
  apiStats: {
    totalRequests: number;
    errorRate: number;
    averageResponseTime: number;
  };
  subscriptionByPlan: Record<string, number>;
  lastUpdated: string;
}

const SimpleAdminDashboard: React.FC = () => {
  const [stats, setStats] = React.useState<SimpleDashboardStats | null>(null);
  const [loading, setLoading] = React.useState(true);
  const navigate = useNavigate();

  React.useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('/ops/api/v1/console/dashboard/overview');
        const data = await response.json();
        setStats(data);
      } catch (error) {
        console.error('Failed to fetch dashboard stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
    
    // 每5分钟刷新一次
    const interval = setInterval(fetchStats, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);

  const StatCard: React.FC<{
    title: string;
    value: string | number;
    icon: React.ReactNode;
    color: string;
    subtitle?: string;
  }> = ({ title, value, icon, color, subtitle }) => (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Box sx={{ color, mr: 2 }}>{icon}</Box>
          <Typography variant="h6" component="div">
            {title}
          </Typography>
        </Box>
        <Typography variant="h4" component="div" sx={{ fontWeight: 'bold' }}>
          {value}
        </Typography>
        {subtitle && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {subtitle}
          </Typography>
        )}
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>加载中...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          管理面板
        </Typography>
        <Button
          size="small"
          startIcon={<Refresh />}
          onClick={() => window.location.reload()}
        >
          刷新
        </Button>
      </Box>
      
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="总用户数"
            value={stats?.totalUsers || 0}
            icon={<People />}
            color="#1976d2"
            subtitle={`活跃用户: ${stats?.activeUsers || 0}`}
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="付费订阅"
            value={(stats?.totalSubscriptions || 0) - (stats?.trialUsers || 0)}
            icon={<Subscriptions />}
            color="#388e3c"
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="本月收入"
            value={`¥${stats?.monthlyRevenue || 0}`}
            icon={<TrendingUp />}
            color="#f57c00"
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="试用用户"
            value={stats?.trialUsers || 0}
            icon={<Token />}
            color="#e91e63"
          />
        </Grid>
      </Grid>

      <Grid container spacing={3} sx={{ mb: 3 }}>
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
        
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="AdsCenter使用"
            value={stats?.featureUsage?.adscenter || 0}
            icon={<Assessment />}
            color="#607d8b"
            subtitle="今日使用次数"
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Token消耗"
            value={stats?.tokenConsumption?.total || 0}
            icon={<Token />}
            color="#7b1fa2"
            subtitle="今日总计"
          />
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" component="div" sx={{ mb: 2 }}>
                API性能监控
              </Typography>
              <Box sx={{ mt: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    总调用次数
                  </Typography>
                  <Typography variant="body2" fontWeight="bold">
                    {stats?.apiStats?.totalRequests || 0} 次
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    成功率
                  </Typography>
                  <Typography 
                    variant="body2" 
                    fontWeight="bold" 
                    color={(100 - (stats?.apiStats?.errorRate || 0)) >= 95 ? 'success.main' : 'warning.main'}
                  >
                    {(100 - (stats?.apiStats?.errorRate || 0)).toFixed(1)}%
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">
                    平均响应时间
                  </Typography>
                  <Typography variant="body2" fontWeight="bold">
                    {(stats?.apiStats?.averageResponseTime || 0).toFixed(0)}ms
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" component="div" sx={{ mb: 2 }}>
                Token消耗详情
              </Typography>
              <Box sx={{ mt: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    SiteRank
                  </Typography>
                  <Typography variant="body2" fontWeight="bold">
                    {stats?.tokenConsumption?.siterank || 0} tokens
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    BatchOpen
                  </Typography>
                  <Typography variant="body2" fontWeight="bold">
                    {stats?.tokenConsumption?.batchopen || 0} tokens
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">
                    AdsCenter
                  </Typography>
                  <Typography variant="body2" fontWeight="bold">
                    {stats?.tokenConsumption?.adscenter || 0} tokens
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Typography variant="caption" color="text.secondary" sx={{ mt: 3, display: 'block' }}>
        最后更新: {stats?.lastUpdated ? new Date(stats.lastUpdated).toLocaleString() : '未知'}
      </Typography>
    </Box>
  );
};

export default SimpleAdminDashboard;
