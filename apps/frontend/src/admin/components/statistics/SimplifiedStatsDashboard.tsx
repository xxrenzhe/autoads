import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Tab,
  Tabs,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  CircularProgress,
  Alert,
  Chip,
  Stack,
} from '@mui/material';
import Grid from '@mui/material/Grid';
import {
  TrendingUp,
  People,
  Assessment,
  Timeline,
  BarChart,
  Refresh,
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
  LineChart,
  Line,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
} from 'recharts';

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
      id={`simplified-stats-tabpanel-${index}`}
      aria-labelledby={`simplified-stats-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

interface SimplifiedFilters {
  dateRange: string;
  userSegment: string;
  features: string[];
}

/**
 * Simplified Statistics Dashboard Component
 */
export const SimplifiedStatsDashboard: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statistics, setStatistics] = useState<any>(null);
  const [filters, setFilters] = useState<SimplifiedFilters>({
    dateRange: '30',
    userSegment: 'all',
    features: [],
  });

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

  useEffect(() => {
    fetchStatistics();
  }, [tabValue, filters]);

  const fetchStatistics = async () => {
    setLoading(true);
    setError(null);

    try {
      const endpoint = tabValue === 0 ? 'usage' : 'behavior';
      
      // Build query parameters
      const params = new URLSearchParams();
      
      // Date range handling
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(filters.dateRange));
      params.append('startDate', startDate.toISOString());
      params.append('simplified', 'true');
      
      // Other filters
      if (filters.userSegment !== 'all') {
        params.append('userSegment', filters.userSegment);
      }
      if (filters.features.length > 0) {
        params.append('features', filters.features.join(','));
      }

      const response = await fetch(`/api/admin/statistics/${endpoint}?${params.toString()}`);

      if (!response.ok) {
        throw new Error('Failed to fetch statistics');
      }

      const data = await response.json();
      setStatistics(data.data);
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key: keyof SimplifiedFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleFeatureToggle = (feature: string) => {
    setFilters(prev => ({
      ...prev,
      features: prev.features.includes(feature)
        ? prev.features.filter((f) => f !== feature)
        : [...prev.features, feature]
    }));
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
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
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          用户统计分析
        </Typography>
        
        {/* Simplified Filters */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">过滤器</Typography>
              <Box sx={{ ml: 'auto' }}>
                <Button
                  size="small"
                  startIcon={<Refresh />}
                  onClick={fetchStatistics}
                  disabled={loading}
                >
                  刷新数据
                </Button>
              </Box>
            </Box>

            <Grid container spacing={2} alignItems="center">
              {/* Date Range Filter */}
              <Grid item xs={12} md={3}>
                <FormControl size="small" fullWidth>
                  <InputLabel>时间范围</InputLabel>
                  <Select
                    value={filters.dateRange}
                    label="时间范围"
                    onChange={(e) => handleFilterChange('dateRange', (e.target as any).value)}
                  >
                    <MenuItem value="7">最近7天</MenuItem>
                    <MenuItem value="30">最近30天</MenuItem>
                    <MenuItem value="90">最近90天</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              {/* User Segment Filter */}
              <Grid item xs={12} md={3}>
                <FormControl size="small" fullWidth>
                  <InputLabel>用户类型</InputLabel>
                  <Select
                    value={filters.userSegment}
                    label="用户类型"
                    onChange={(e) => handleFilterChange('userSegment', (e.target as any).value)}
                  >
                    <MenuItem value="all">所有用户</MenuItem>
                    <MenuItem value="trial">试用用户</MenuItem>
                    <MenuItem value="paid">付费用户</MenuItem>
                    <MenuItem value="free">免费用户</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              {/* Feature Filter */}
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>功能过滤:</Typography>
                <Stack direction="row" spacing={1}>
                  {['siterank', 'batchopen', 'adscenter'].map((feature) => (
                    <Chip
                      key={feature}
                      label={feature.toUpperCase()}
                      variant={filters.features.includes(feature) ? 'filled' : 'outlined'}
                      onClick={() => handleFeatureToggle(feature)}
                      color={filters.features.includes(feature) ? 'primary' : 'default'}
                      size="small"
                    />
                  ))}
                </Stack>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        <Tabs value={tabValue} onChange={handleTabChange}>
          <Tab
            icon={<BarChart />}
            label="使用统计"
            id="simplified-stats-tab-0"
            aria-controls="simplified-stats-tabpanel-0"
          />
          <Tab
            icon={<Timeline />}
            label="行为分析"
            id="simplified-stats-tab-1"
            aria-controls="simplified-stats-tabpanel-1"
          />
        </Tabs>
      </Box>

      {/* Usage Statistics Tab */}
      <TabPanel value={tabValue} index={0}>
        {statistics && (
          <Box>
            {/* Core Metrics Cards */}
            <Grid container spacing={3} sx={{ mb: 3 }}>
              <Grid item xs={12} md={3}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <People sx={{ fontSize: 40, mr: 2, color: 'primary.main' }} />
                      <Box>
                        <Typography color="textSecondary" gutterBottom>
                          总用户数
                        </Typography>
                        <Typography variant="h4">
                          {statistics.totalUsers?.toLocaleString() || 0}
                        </Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={3}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <TrendingUp sx={{ fontSize: 40, mr: 2, color: 'success.main' }} />
                      <Box>
                        <Typography color="textSecondary" gutterBottom>
                          活跃用户
                        </Typography>
                        <Typography variant="h4">
                          {statistics.activeUsers?.toLocaleString() || 0}
                        </Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={3}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Assessment sx={{ fontSize: 40, mr: 2, color: 'warning.main' }} />
                      <Box>
                        <Typography color="textSecondary" gutterBottom>
                          Token总消耗
                        </Typography>
                        <Typography variant="h4">
                          {statistics.totalTokensConsumed?.toLocaleString() || 0}
                        </Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={3}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Assessment sx={{ fontSize: 40, mr: 2, color: 'info.main' }} />
                      <Box>
                        <Typography color="textSecondary" gutterBottom>
                          平均Token使用
                        </Typography>
                        <Typography variant="h4">
                          {Math.round(statistics.averageTokensPerUser || 0)}
                        </Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            {/* Core Charts */}
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      使用趋势
                    </Typography>
                    <Box sx={{ height: 300 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={statistics.overallTrends || []}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="period" />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Line 
                            type="monotone" 
                            dataKey="totalTokens" 
                            stroke="#8884d8" 
                            name="Token消耗"
                          />
                          <Line 
                            type="monotone" 
                            dataKey="uniqueUsers" 
                            stroke="#82ca9d" 
                            name="活跃用户"
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      功能分布
                    </Typography>
                    <Box sx={{ height: 300 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsPieChart>
                          <Pie
                            data={statistics.featurePopularity || []}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ feature, _count }) => `${feature} (${_count?.id || 0})`}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="_count.id"
                          >
                            {(statistics.featurePopularity || []).map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </RechartsPieChart>
                      </ResponsiveContainer>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Box>
        )}
      </TabPanel>

      {/* Behavior Analysis Tab */}
      <TabPanel value={tabValue} index={1}>
        {statistics && (
          <Box>
            {/* Behavior Charts */}
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      24小时活跃度分布
                    </Typography>
                    <Box sx={{ height: 300 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsBarChart data={statistics.activityPatterns?.hourlyActivity || []}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="hour" />
                          <YAxis />
                          <Tooltip />
                          <Bar dataKey="activityCount" fill="#8884d8" />
                        </RechartsBarChart>
                      </ResponsiveContainer>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      用户参与度分布
                    </Typography>
                    <Box sx={{ height: 300 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsPieChart>
                          <Pie
                            data={statistics.behaviorSegments?.userSegments || []}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ engagementLevel, userCount }) => `${engagementLevel} (${userCount})`}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="userCount"
                          >
                            {(statistics.behaviorSegments?.userSegments || []).map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </RechartsPieChart>
                      </ResponsiveContainer>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Box>
        )}
      </TabPanel>
    </Box>
  );
};
