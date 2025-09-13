import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  CircularProgress,
  Alert,
  TextField,
  IconButton,
} from '@mui/material';
import {
  TrendingUp,
  People,
  Subscriptions,
  Assessment,
  Refresh,
  Download,
} from '@mui/icons-material';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';

interface DailyRegistration {
  date: string;
  totalUsers: number;
  verifiedUsers: number;
  activeUsers: number;
}

interface SubscriptionByPlan {
  planName: string;
  price: number;
  count: number;
}

interface UserStatisticsData {
  dailyRegistrations: DailyRegistration[];
  subscriptionByPlan: SubscriptionByPlan[];
  summary: {
    totalRegistrations: number;
    totalActiveSubscriptions: number;
    newSubscriptions: number;
    averageDailyRegistrations: number;
  };
  userGrowth: Array<{
    status: string;
    count: number;
  }>;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

const UserStatisticsDashboard: React.FC = () => {
  const [data, setData] = useState<UserStatisticsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState('30');
  const [groupBy, setGroupBy] = useState('day');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  useEffect(() => {
    fetchStatistics();
  }, [dateRange, groupBy]);

  const fetchStatistics = async () => {
    setLoading(true);
    setError(null);

    try {
      // Calculate date range
      let startDate: string;
      let endDate: string;

      if (dateRange === 'custom') => {
        if (!customStartDate || !customEndDate) => {
          setError('请选择开始和结束日期');
          setLoading(false);
          return;
        }
        startDate = customStartDate;
        endDate = customEndDate;
      } else {
        const days = parseInt(dateRange);
        const end = endOfDay(new Date());
        const start = startOfDay(subDays(end, days));
        
        startDate = start.toISOString();
        endDate = end.toISOString();
      }

      const response = await fetch(
        `/api/admin/user-statistics?startDate=${startDate}&endDate=${endDate}&groupBy=${groupBy}`
      );

      if (!response.ok) => {
        throw new Error('获取统计数据失败');
      }

      const result = await response.json();
      setData(result);
    } catch (err: any) => {
      setError(err.message || '发生错误');
    } finally {
      setLoading(false);
    }
  };

  const exportData = () => {
    if (!data) return;

    const csvContent = [
      ['日期', '注册用户数', '已验证用户', '活跃用户'],
      ...data.dailyRegistrations.map((item: any) => [
        item.date,
        item.totalUsers,
        item.verifiedUsers,
        item.activeUsers,
      ]),
    ].map((row: any) => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `user_statistics_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  if (loading) => {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) => {
    return (
      <Alert severity="error" sx={{ m: 3 }}>
        {error}
      </Alert>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          用户统计
        </Typography>
        <Button
          variant="outlined"
          onClick={exportData}
          startIcon={<Download />}
          disabled={!data}
        >
          导出数据
        </Button>
      </Box>

      {/* Date Range Controls */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={3}>
              <FormControl fullWidth size="small">
                <InputLabel>时间范围</InputLabel>
                <Select
                  value={dateRange}
                  label="时间范围"
                  onChange={((e: any): any) => setDateRange(e.target.value)}
                >
                  <MenuItem value="7">最近7天</MenuItem>
                  <MenuItem value="30">最近30天</MenuItem>
                  <MenuItem value="90">最近90天</MenuItem>
                  <MenuItem value="custom">自定义</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {dateRange === 'custom' && (
              <>
                <Grid item xs={12} sm={3}>
                  <TextField
                    label="开始日期"
                    type="date"
                    size="small"
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                    value={customStartDate}
                    onChange={((e: any): any) => setCustomStartDate(e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} sm={3}>
                  <TextField
                    label="结束日期"
                    type="date"
                    size="small"
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                    value={customEndDate}
                    onChange={((e: any): any) => setCustomEndDate(e.target.value)}
                  />
                </Grid>
              </>
            )}

            <Grid item xs={12} sm={3}>
              <FormControl fullWidth size="small">
                <InputLabel>分组方式</InputLabel>
                <Select
                  value={groupBy}
                  label="分组方式"
                  onChange={((e: any): any) => setGroupBy(e.target.value)}
                >
                  <MenuItem value="day">按天</MenuItem>
                  <MenuItem value="week">按周</MenuItem>
                  <MenuItem value="month">按月</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={3}>
              <Button
                variant="contained"
                onClick={fetchStatistics}
                startIcon={<Refresh />}
                fullWidth
              >
                刷新数据
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {data && (
        <>
          {/* Summary Cards */}
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <People color="primary" sx={{ mr: 2, fontSize: 40 }} />
                    <Box>
                      <Typography color="textSecondary" gutterBottom>
                        总注册用户
                      </Typography>
                      <Typography variant="h4">
                        {data.summary.totalRegistrations}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        平均每日: {data.summary.averageDailyRegistrations}
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Subscriptions color="secondary" sx={{ mr: 2, fontSize: 40 }} />
                    <Box>
                      <Typography color="textSecondary" gutterBottom>
                        活跃订阅
                      </Typography>
                      <Typography variant="h4">
                        {data.summary.totalActiveSubscriptions}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        新增: {data.summary.newSubscriptions}
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <TrendingUp color="success" sx={{ mr: 2, fontSize: 40 }} />
                    <Box>
                      <Typography color="textSecondary" gutterBottom>
                        用户增长率
                      </Typography>
                      <Typography variant="h4">
                        {data.dailyRegistrations.length > 1 ? (
                          ((data.dailyRegistrations[data.dailyRegistrations.length - 1].totalUsers -
                            data.dailyRegistrations[0].totalUsers) /
                            data.dailyRegistrations[0].totalUsers * 100).toFixed(1)
                        ) : 0}%
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        对比期间增长
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Assessment color="info" sx={{ mr: 2, fontSize: 40 }} />
                    <Box>
                      <Typography color="textSecondary" gutterBottom>
                        活跃用户
                      </Typography>
                      <Typography variant="h4">
                        {data.dailyRegistrations.reduce((sum, day: any) => sum + day.activeUsers, 0)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        累计活跃用户
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Charts */}
          <Grid container spacing={3}>
            {/* Daily Registration Chart */}
            <Grid item xs={12} lg={8}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    用户注册趋势
                  </Typography>
                  <ResponsiveContainer width="100%" height={400}>
                    <LineChart data={data.dailyRegistrations}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="date" 
                        tickFormatter={(value) => format(new Date(value), 'MM-dd')}
                      />
                      <YAxis />
                      <Tooltip 
                        labelFormatter={(value) => format(new Date(value), 'yyyy-MM-dd')}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="totalUsers"
                        stroke="#8884d8"
                        name="总注册数"
                        strokeWidth={2}
                      />
                      <Line
                        type="monotone"
                        dataKey="verifiedUsers"
                        stroke="#82ca9d"
                        name="已验证用户"
                        strokeWidth={2}
                      />
                      <Line
                        type="monotone"
                        dataKey="activeUsers"
                        stroke="#ffc658"
                        name="活跃用户"
                        strokeWidth={2}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </Grid>

            {/* Subscription Distribution */}
            <Grid item xs={12} lg={4}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    套餐订阅分布
                  </Typography>
                  <ResponsiveContainer width="100%" height={400}>
                    <PieChart>
                      <Pie
                        data={data.subscriptionByPlan.map((item: any) => ({
                          name: `${item.planName} ($${item.price})`,
                          value: item.count,
                        }))}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) =>
                          `${name.split(' ')[0]} ${((percent || 0) * 100).toFixed(0)}%`
                        }
                        outerRadius={120}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {data.subscriptionByPlan.map((entry, index: any) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value: number, name: string) => [value, name]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </Grid>

            {/* User Status Distribution */}
            <Grid item xs={12} lg={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    用户状态分布
                  </Typography>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={data.userGrowth}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="status" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="count" fill="#8884d8" name="用户数" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </Grid>

            {/* Top Plans */}
            <Grid item xs={12} lg={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    热门套餐排行
                  </Typography>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart 
                      data={data.subscriptionByPlan.slice(0, 5)}
                      layout="horizontal"
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis dataKey="planName" type="category" width={100} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#82ca9d" name="订阅数" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </>
      )}
    </Box>
  );
};

export default UserStatisticsDashboard;