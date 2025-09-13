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
  Tabs,
  Tab,
  CircularProgress,
  Alert,
  TextField,
  IconButton,
} from '@mui/material';
import {
  TrendingUp,
  People,
  Assessment,
  Refresh,
  Download,
  FilterList,
  BarChart,
  PieChart,
  Timeline,
  ShowChart,
} from '@mui/icons-material';
import {
  ResponsiveContainer,
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart as RechartsLineChart,
  Line,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  ComposedChart,
  Scatter,
  ScatterChart,
  ZAxis,
} from 'recharts';
import { format, subDays, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { useDataProvider, useNotify } from 'react-admin';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`token-usage-tabpanel-${index}`}
      aria-labelledby={`token-usage-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

interface UsageByDimension {
  dimension: string;
  totalTokens: number;
  totalOperations: number;
  averageTokensPerOperation: number;
  growth: number;
}

interface UserUsageData {
  userId: string;
  userName: string;
  userEmail: string;
  totalTokens: number;
  operations: number;
  averageTokens: number;
  lastActivity: string;
}

interface FeatureUsageData {
  feature: string;
  totalTokens: number;
  operations: number;
  averageCost: number;
  percentage: number;
}

interface TimeSeriesData {
  date: string;
  tokens: number;
  operations: number;
  users: number;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

const TokenUsageAnalysis: React.FC = () => {
  const dataProvider = useDataProvider();
  const notify = useNotify();
  
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState('30');
  const [groupBy, setGroupBy] = useState('day');
  const [dimension, setDimension] = useState('feature');
  
  const [summary, setSummary] = useState<any>(null);
  const [usageByDimension, setUsageByDimension] = useState<UsageByDimension[]>([]);
  const [topUsers, setTopUsers] = useState<UserUsageData[]>([]);
  const [featureUsage, setFeatureUsage] = useState<FeatureUsageData[]>([]);
  const [timeSeries, setTimeSeries] = useState<TimeSeriesData[]>([]);

  useEffect(() => {
    fetchUsageData();
  }, [tabValue, dateRange, groupBy, dimension]);

  const fetchUsageData = async () => {
    setLoading(true);
    setError(null);

    try {
      const endDate = endOfDay(new Date());
      let startDate: Date;
      
      switch (dateRange) {
        case '7':
          startDate = startOfDay(subDays(endDate, 7));
          break;
        case '30':
          startDate = startOfDay(subDays(endDate, 30));
          break;
        case '90':
          startDate = startOfDay(subDays(endDate, 90));
          break;
        default:
          startDate = startOfDay(subDays(endDate, 30));
      }

      const params = {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        groupBy,
        dimension,
      };

      // Fetch data based on current tab
      switch (tabValue) {
        case 0: // Overview
          await fetchOverviewData(params);
          break;
        case 1: // By User
          await fetchUserData(params);
          break;
        case 2: // By Feature
          await fetchFeatureData(params);
          break;
        case 3: // Time Series
          await fetchTimeSeriesData(params);
          break;
      }
    } catch (err: any) {
      setError(err.message || '获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchOverviewData = async (params: any) => {
    const response = await fetch(`/api/admin/tokens/usage/overview?${new URLSearchParams(params)}`);
    const data = await response.json();
    
    setSummary(data.summary);
    setUsageByDimension(data.byDimension);
    setTopUsers(data.topUsers);
    setFeatureUsage(data.featureUsage);
  };

  const fetchUserData = async (params: any) => {
    const response = await fetch(`/api/admin/tokens/usage/by-user?${new URLSearchParams(params)}`);
    const data = await response.json();
    
    setTopUsers(data.users);
  };

  const fetchFeatureData = async (params: any) => {
    const response = await fetch(`/api/admin/tokens/usage/by-feature?${new URLSearchParams(params)}`);
    const data = await response.json();
    
    setFeatureUsage(data.features);
    setTimeSeries(data.timeSeries);
  };

  const fetchTimeSeriesData = async (params: any) => {
    const response = await fetch(`/api/admin/tokens/usage/time-series?${new URLSearchParams(params)}`);
    const data = await response.json();
    
    setTimeSeries(data.series);
  };

  const exportData = () => {
    // Implement export functionality
    notify('导出功能开发中', { type: 'info' });
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
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
          Token使用分析
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>时间范围</InputLabel>
            <Select
              value={dateRange}
              label="时间范围"
              onChange={(e) => setDateRange((e.target as HTMLInputElement).value)}
            >
              <MenuItem value="7">最近7天</MenuItem>
              <MenuItem value="30">最近30天</MenuItem>
              <MenuItem value="90">最近90天</MenuItem>
            </Select>
          </FormControl>
          
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>分组方式</InputLabel>
            <Select
              value={groupBy}
              label="分组方式"
              onChange={(e) => setGroupBy((e.target as HTMLInputElement).value)}
            >
              <MenuItem value="day">按天</MenuItem>
              <MenuItem value="week">按周</MenuItem>
              <MenuItem value="month">按月</MenuItem>
            </Select>
          </FormControl>
          
          <Button
            variant="outlined"
            onClick={fetchUsageData}
            startIcon={<Refresh />}
          >
            刷新
          </Button>
          
          <Button
            variant="outlined"
            onClick={exportData}
            startIcon={<Download />}
          >
            导出
          </Button>
        </Box>
      </Box>

      <Tabs value={tabValue} onChange={(_e, newValue) => setTabValue(newValue)} sx={{ mb: 3 }}>
        <Tab icon={<Assessment />} label="总览" />
        <Tab icon={<People />} label="用户维度" />
        <Tab icon={<BarChart />} label="功能维度" />
        <Tab icon={<Timeline />} label="时间趋势" />
      </Tabs>

      {/* Overview Tab */}
      <TabPanel value={tabValue} index={0}>
        {summary && (
          <>
            {/* Summary Cards */}
            <Grid container spacing={3} sx={{ mb: 3 }}>
              <Grid item xs={12} sm={6} md={3}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <TrendingUp color="primary" sx={{ mr: 2, fontSize: 40 }} />
                      <Box>
                        <Typography color="textSecondary" gutterBottom>
                          总消耗Token
                        </Typography>
                        <Typography variant="h4">
                          {summary.totalTokens?.toLocaleString() || 0}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          较上期 {summary.growth >= 0 ? '+' : ''}{summary.growth || 0}%
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
                      <ShowChart color="secondary" sx={{ mr: 2, fontSize: 40 }} />
                      <Box>
                        <Typography color="textSecondary" gutterBottom>
                          总操作次数
                        </Typography>
                        <Typography variant="h4">
                          {summary.totalOperations?.toLocaleString() || 0}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          平均每次 {summary.averageTokensPerOperation?.toFixed(2) || 0} Token
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
                      <People color="info" sx={{ mr: 2, fontSize: 40 }} />
                      <Box>
                        <Typography color="textSecondary" gutterBottom>
                          活跃用户
                        </Typography>
                        <Typography variant="h4">
                          {summary.activeUsers || 0}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          占总用户 {summary.activeUserPercentage || 0}%
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
                      <PieChart color="success" sx={{ mr: 2, fontSize: 40 }} />
                      <Box>
                        <Typography color="textSecondary" gutterBottom>
                          效率指标
                        </Typography>
                        <Typography variant="h4">
                          {summary.efficiency?.toFixed(2) || 0}%
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          批量操作占比
                        </Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            {/* Charts */}
            <Grid container spacing={3}>
              {/* Usage by Dimension */}
              <Grid item xs={12} lg={8}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      按维度统计
                    </Typography>
                    <ResponsiveContainer width="100%" height={400}>
                      <RechartsBarChart data={usageByDimension}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="dimension" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="totalTokens" fill="#8884d8" name="总Token消耗" />
                        <Bar dataKey="totalOperations" fill="#82ca9d" name="操作次数" />
                      </RechartsBarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </Grid>

              {/* Feature Distribution */}
              <Grid item xs={12} lg={4}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      功能使用分布
                    </Typography>
                    <ResponsiveContainer width="100%" height={400}>
                      <RechartsPieChart>
                        <Pie
                          data={featureUsage.map((item: any) => ({
                            name: item.feature,
                            value: item.totalTokens,
                          }))}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) =>
                            `${name} ${((percent || 0) * 100).toFixed(0)}%`
                          }
                          outerRadius={120}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {featureUsage.map((entry, index: number) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </>
        )}
      </TabPanel>

      {/* User Dimension Tab */}
      <TabPanel value={tabValue} index={1}>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  用户Token消耗排行
                </Typography>
                <ResponsiveContainer width="100%" height={500}>
                  <RechartsBarChart data={topUsers.slice(0, 10)} layout="horizontal">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="userName" type="category" width={150} />
                    <Tooltip />
                    <Bar dataKey="totalTokens" fill="#8884d8" name="Token消耗量" />
                  </RechartsBarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      {/* Feature Dimension Tab */}
      <TabPanel value={tabValue} index={2}>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  功能使用详情
                </Typography>
                <ResponsiveContainer width="100%" height={500}>
                  <ComposedChart data={featureUsage}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="feature" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip />
                    <Legend />
                    <Bar yAxisId="left" dataKey="totalTokens" fill="#8884d8" name="Token消耗" />
                    <Line yAxisId="right" type="monotone" dataKey="averageCost" stroke="#ff7300" name="平均成本" />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      {/* Time Series Tab */}
      <TabPanel value={tabValue} index={3}>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  时间趋势分析
                </Typography>
                <ResponsiveContainer width="100%" height={500}>
                  <AreaChart data={timeSeries}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Area type="monotone" dataKey="tokens" stackId="1" stroke="#8884d8" fill="#8884d8" name="Token消耗" />
                    <Area type="monotone" dataKey="operations" stackId="2" stroke="#82ca9d" fill="#82ca9d" name="操作次数" />
                    <Line type="monotone" dataKey="users" stroke="#ff7300" strokeWidth={2} name="活跃用户" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>
    </Box>
  );
};

export default TokenUsageAnalysis;
