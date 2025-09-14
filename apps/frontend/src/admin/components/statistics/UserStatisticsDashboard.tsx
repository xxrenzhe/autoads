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
  TextField,
  Chip,
  Stack,
  Divider,
  IconButton,
  Menu,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  TrendingUp,
  People,
  Assessment,
  Timeline,
  BarChart,
  PieChart,
  ShowChart,
  FilterList,
  Download,
  DateRange,
  Clear,
  FileDownload,
  TableChart,
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
      id={`statistics-tabpanel-${index}`}
      aria-labelledby={`statistics-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

interface FilterOptions {
  dateRange: string;
  customStartDate: string;
  customEndDate: string;
  userSegment: string;
  groupBy: string;
  features: string[];
  minTokenUsage: number;
  maxTokenUsage: number;
}

/**
 * User Statistics Dashboard Component
 */
export const UserStatisticsDashboard: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statistics, setStatistics] = useState<any>(null);
  const [exportMenuAnchor, setExportMenuAnchor] = useState<null | HTMLElement>(null);
  const [filters, setFilters] = useState<FilterOptions>({
    dateRange: '30',
    customStartDate: '',
    customEndDate: '',
    userSegment: 'all',
    groupBy: 'day',
    features: [],
    minTokenUsage: 0,
    maxTokenUsage: 0,
  });

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

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
      if (filters.dateRange === 'custom' && filters.customStartDate && filters.customEndDate) {
        params.append('startDate', filters.customStartDate);
        params.append('endDate', filters.customEndDate);
      } else {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - parseInt(filters.dateRange));
        params.append('startDate', startDate.toISOString());
      }
      
      // Other filters
      params.append('groupBy', filters.groupBy);
      if (filters.userSegment !== 'all') {
        params.append('userSegment', filters.userSegment);
      }
      if (filters.features.length > 0) {
        params.append('features', filters.features.join(','));
      }
      if (filters.minTokenUsage > 0) {
        params.append('minTokenUsage', filters.minTokenUsage.toString());
      }
      if (filters.maxTokenUsage > 0) {
        params.append('maxTokenUsage', filters.maxTokenUsage.toString());
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

  const handleFilterChange = (key: keyof FilterOptions, value: any) => {
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

  const clearFilters = () => {
    setFilters({
      dateRange: '30',
      customStartDate: '',
      customEndDate: '',
      userSegment: 'all',
      groupBy: 'day',
      features: [],
      minTokenUsage: 0,
      maxTokenUsage: 0,
    });
  };

  const exportData = async (format: 'csv' | 'json' | 'excel') => {
    try {
      const endpoint = tabValue === 0 ? 'usage' : 'behavior';
      const params = new URLSearchParams();
      
      // Add current filters to export
      if (filters.dateRange === 'custom' && filters.customStartDate && filters.customEndDate) {
        params.append('startDate', filters.customStartDate);
        params.append('endDate', filters.customEndDate);
      } else {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - parseInt(filters.dateRange));
        params.append('startDate', startDate.toISOString());
      }
      
      params.append('groupBy', filters.groupBy);
      params.append('format', format);
      if (filters.userSegment !== 'all') {
        params.append('userSegment', filters.userSegment);
      }

      const response = await fetch(`/api/admin/statistics/${endpoint}/export?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error('Export failed');
      }

      // Handle file download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `statistics-${endpoint}-${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      setError(`Export failed: ${err.message}`);
    }
    setExportMenuAnchor(null);
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
        
        {/* Advanced Filters */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <FilterList sx={{ mr: 1 }} />
              <Typography variant="h6">高级过滤器</Typography>
              <Box sx={{ ml: 'auto' }}>
                <Button
                  size="small"
                  startIcon={<Clear />}
                  onClick={clearFilters}
                  sx={{ mr: 1 }}
                  aria-label="清除所有过滤器"
                >
                  清除过滤器
                </Button>
                <Button
                  size="small"
                  startIcon={<Download />}
                  onClick={(e) => setExportMenuAnchor((e.currentTarget as any))}
                  aria-label="导出统计数据"
                  aria-haspopup="true"
                  aria-expanded={Boolean(exportMenuAnchor)}
                >
                  导出数据
                </Button>
                <Menu
                  anchorEl={exportMenuAnchor}
                  open={Boolean(exportMenuAnchor)}
                  onClose={() => setExportMenuAnchor(null)}
                >
                  <MenuItem onClick={() => exportData('csv')}>
                    <ListItemIcon><TableChart /></ListItemIcon>
                    <ListItemText>导出为 CSV</ListItemText>
                  </MenuItem>
                  <MenuItem onClick={() => exportData('json')}>
                    <ListItemIcon><FileDownload /></ListItemIcon>
                    <ListItemText>导出为 JSON</ListItemText>
                  </MenuItem>
                  <MenuItem onClick={() => exportData('excel')}>
                    <ListItemIcon><Assessment /></ListItemIcon>
                    <ListItemText>导出为 Excel</ListItemText>
                  </MenuItem>
                </Menu>
              </Box>
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2 }}>
              {/* Date Range Filter */}
              <FormControl size="small">
                <InputLabel>时间范围</InputLabel>
                <Select
                  value={filters.dateRange}
                  label="时间范围"
                  onChange={(e) => handleFilterChange('dateRange', (e.target as any).value)}
                >
                  <MenuItem value="7">最近7天</MenuItem>
                  <MenuItem value="30">最近30天</MenuItem>
                  <MenuItem value="90">最近90天</MenuItem>
                  <MenuItem value="365">最近一年</MenuItem>
                  <MenuItem value="custom">自定义范围</MenuItem>
                </Select>
              </FormControl>

              {/* Custom Date Range */}
              {filters.dateRange === 'custom' && (
                <>
                  <TextField
                    size="small"
                    type="date"
                    label="开始日期"
                    value={filters.customStartDate}
                    onChange={(e) => handleFilterChange('customStartDate', (e.target as any).value)}
                    InputLabelProps={{ shrink: true }}
                    aria-describedby="start-date-help"
                    helperText="选择统计开始日期"
                    id="start-date-help"
                  />
                  <TextField
                    size="small"
                    type="date"
                    label="结束日期"
                    value={filters.customEndDate}
                    onChange={(e) => handleFilterChange('customEndDate', (e.target as any).value)}
                    InputLabelProps={{ shrink: true }}
                    aria-describedby="end-date-help"
                    helperText="选择统计结束日期"
                    id="end-date-help"
                  />
                </>
              )}

              {/* User Segment Filter */}
              <FormControl size="small">
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
                  <MenuItem value="new">新用户 (30天内)</MenuItem>
                  <MenuItem value="active">活跃用户</MenuItem>
                  <MenuItem value="inactive">非活跃用户</MenuItem>
                </Select>
              </FormControl>

              {/* Group By Filter */}
              <FormControl size="small">
                <InputLabel>分组方式</InputLabel>
                <Select
                  value={filters.groupBy}
                  label="分组方式"
                  onChange={(e) => handleFilterChange('groupBy', (e.target as any).value)}
                >
                  <MenuItem value="hour">按小时</MenuItem>
                  <MenuItem value="day">按天</MenuItem>
                  <MenuItem value="week">按周</MenuItem>
                  <MenuItem value="month">按月</MenuItem>
                </Select>
              </FormControl>

              {/* Token Usage Range */}
              <TextField
                size="small"
                type="number"
                label="最小Token使用量"
                value={filters.minTokenUsage}
                onChange={(e) => handleFilterChange('minTokenUsage', parseInt((e.target as any).value) || 0)}
                inputProps={{ 
                  min: 0,
                  'aria-describedby': 'min-token-help'
                }}
                helperText="设置最小Token使用量过滤条件"
                id="min-token-help"
                aria-label="最小Token使用量过滤器"
              />

              <TextField
                size="small"
                type="number"
                label="最大Token使用量"
                value={filters.maxTokenUsage}
                onChange={(e) => handleFilterChange('maxTokenUsage', parseInt((e.target as any).value) || 0)}
                inputProps={{ 
                  min: 0,
                  'aria-describedby': 'max-token-help'
                }}
                helperText="设置最大Token使用量过滤条件"
                id="max-token-help"
                aria-label="最大Token使用量过滤器"
              />
            </Box>

            {/* Feature Filter */}
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>功能过滤器:</Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                {['siterank', 'batchopen', 'adscenter'].map((feature) => (
                  <Chip
                    key={feature}
                    label={feature.toUpperCase()}
                    variant={filters.features.includes(feature) ? 'filled' : 'outlined'}
                    onClick={() => handleFeatureToggle(feature)}
                    color={filters.features.includes(feature) ? 'primary' : 'default'}
                    size="small"
                    aria-label={`${filters.features.includes(feature) ? '取消选择' : '选择'} ${feature} 功能过滤器`}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleFeatureToggle(feature);
                      }
                    }}
                  />
                ))}
              </Stack>
            </Box>

            {/* Active Filters Display */}
            {(filters.userSegment !== 'all' || filters.features.length > 0 || filters.minTokenUsage > 0 || filters.maxTokenUsage > 0) && (
              <Box sx={{ mt: 2 }}>
                <Divider sx={{ mb: 1 }} />
                <Typography variant="caption" color="text.secondary">
                  活跃过滤器:
                </Typography>
                <Stack direction="row" spacing={1} sx={{ mt: 1 }} flexWrap="wrap">
                  {filters.userSegment !== 'all' && (
                    <Chip
                      size="small"
                      label={`用户类型: ${filters.userSegment}`}
                      onDelete={() => handleFilterChange('userSegment', 'all')}
                      color="secondary"
                    />
                  )}
                  {filters.features.map((feature) => (
                    <Chip
                      key={feature}
                      size="small"
                      label={`功能: ${feature}`}
                      onDelete={() => handleFeatureToggle(feature)}
                      color="secondary"
                    />
                  ))}
                  {filters.minTokenUsage > 0 && (
                    <Chip
                      size="small"
                      label={`最小Token: ${filters.minTokenUsage}`}
                      onDelete={() => handleFilterChange('minTokenUsage', 0)}
                      color="secondary"
                    />
                  )}
                  {filters.maxTokenUsage > 0 && (
                    <Chip
                      size="small"
                      label={`最大Token: ${filters.maxTokenUsage}`}
                      onDelete={() => handleFilterChange('maxTokenUsage', 0)}
                      color="secondary"
                    />
                  )}
                </Stack>
              </Box>
            )}

            <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
              <Button
                variant="contained"
                onClick={fetchStatistics}
                startIcon={loading ? <CircularProgress size={16} /> : <Assessment />}
                disabled={loading}
                aria-label={loading ? '正在加载统计数据' : '应用当前过滤器设置并获取统计数据'}
              >
                {loading ? '加载中...' : '应用过滤器'}
              </Button>
              <Button
                variant="outlined"
                onClick={fetchStatistics}
                startIcon={<Assessment />}
                disabled={loading}
                aria-label="刷新统计数据"
              >
                刷新数据
              </Button>
            </Box>
          </CardContent>
        </Card>

        <Tabs 
          value={tabValue} 
          onChange={handleTabChange}
          aria-label="统计分析选项卡"
        >
          <Tab
            icon={<BarChart />}
            label="使用统计"
            id="statistics-tab-0"
            aria-controls="statistics-tabpanel-0"
            aria-label="查看用户使用统计数据"
          />
          <Tab
            icon={<Timeline />}
            label="行为分析"
            id="statistics-tab-1"
            aria-controls="statistics-tabpanel-1"
            aria-label="查看用户行为分析数据"
          />
        </Tabs>
      </Box>

      {/* Usage Statistics Tab */}
      <TabPanel value={tabValue} index={0}>
        {statistics && (
          <Box>
            {/* Overview Cards */}
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 3, mb: 3 }}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <People sx={{ fontSize: 40, mr: 2, color: 'primary.main' }} />
                    <Box>
                      <Typography color="textSecondary" gutterBottom>
                        总用户数
                      </Typography>
                      <Typography variant="h4">
                        {statistics.totalUsers || 0}
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>

              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <TrendingUp sx={{ fontSize: 40, mr: 2, color: 'success.main' }} />
                    <Box>
                      <Typography color="textSecondary" gutterBottom>
                        活跃用户
                      </Typography>
                      <Typography variant="h4">
                        {statistics.activeUsers || 0}
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>

              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Assessment sx={{ fontSize: 40, mr: 2, color: 'warning.main' }} />
                    <Box>
                      <Typography color="textSecondary" gutterBottom>
                        Token 总消耗
                      </Typography>
                      <Typography variant="h4">
                        {statistics.totalTokensConsumed?.toLocaleString() || 0}
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>

              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <ShowChart sx={{ fontSize: 40, mr: 2, color: 'info.main' }} />
                    <Box>
                      <Typography color="textSecondary" gutterBottom>
                        平均 Token 使用
                      </Typography>
                      <Typography variant="h4">
                        {Math.round(statistics.averageTokensPerUser || 0)}
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Box>

            {/* Charts */}
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))', gap: 3 }}>
              {/* Usage Trend Chart */}
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    使用趋势
                  </Typography>
                  <Box 
                    sx={{ height: 300 }}
                    role="img"
                    aria-label="使用趋势折线图，显示Token消耗和活跃用户数量随时间的变化"
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart 
                        data={statistics.overallTrends || []}
                        aria-label="使用趋势数据图表"
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="period" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line 
                          type="monotone" 
                          dataKey="totalTokens" 
                          stroke="#8884d8" 
                          name="Token 消耗"
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

              {/* Feature Distribution */}
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
                          label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
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
            </Box>

            {/* Detailed Tables */}
            <Box sx={{ mt: 3 }}>
              {/* SiteRank Statistics */}
              <Card sx={{ mb: 3 }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    SiteRank 统计
                  </Typography>
                  {/* Add SiteRank table here */}
                  <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
                    <Typography variant="body2">
                      SiteRank 详细统计正在开发中...
                    </Typography>
                  </Box>
                </CardContent>
              </Card>

              {/* BatchOpen Statistics */}
              <Card sx={{ mb: 3 }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    BatchOpen 统计
                  </Typography>
                  {/* Add BatchOpen table here */}
                  <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
                    <Typography variant="body2">
                      BatchOpen 详细统计正在开发中...
                    </Typography>
                  </Box>
                </CardContent>
              </Card>

              {/* AdsCenter Statistics */}
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    AdsCenter 统计
                  </Typography>
                  {/* Add AdsCenter table here */}
                  <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
                    <Typography variant="body2">
                      AdsCenter 详细统计正在开发中...
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Box>
          </Box>
        )}
      </TabPanel>

      {/* Behavior Analysis Tab */}
      <TabPanel value={tabValue} index={1}>
        {statistics && (
          <Box>
            {/* Behavior Overview */}
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 3, mb: 3 }}>
              <Card>
                <CardContent>
                  <Typography color="textSecondary" gutterBottom>
                    总行为次数
                  </Typography>
                  <Typography variant="h4">
                    {statistics.totalActions?.toLocaleString() || 0}
                  </Typography>
                </CardContent>
              </Card>

              <Card>
                <CardContent>
                  <Typography color="textSecondary" gutterBottom>
                    平均会话时长
                  </Typography>
                  <Typography variant="h4">
                    {Math.round(statistics.averageSessionDuration || 0)}s
                  </Typography>
                </CardContent>
              </Card>

              <Card>
                <CardContent>
                  <Typography color="textSecondary" gutterBottom>
                    成功率
                  </Typography>
                  <Typography variant="h4">
                    {((statistics.successRate || 0) * 100).toFixed(1)}%
                  </Typography>
                </CardContent>
              </Card>

              <Card>
                <CardContent>
                  <Typography color="textSecondary" gutterBottom>
                    错误率
                  </Typography>
                  <Typography variant="h4">
                    {((statistics.errorRate || 0) * 100).toFixed(1)}%
                  </Typography>
                </CardContent>
              </Card>
            </Box>

            {/* Behavior Charts */}
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))', gap: 3 }}>
              {/* Hourly Activity */}
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    24小时活跃度分布
                  </Typography>
                  <Box sx={{ height: 300 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsBarChart data={statistics.hourlyActivity || []}>
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

              {/* User Segments */}
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    用户群体分布
                  </Typography>
                  <Box sx={{ height: 300 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPieChart>
                        <Pie
                          data={statistics.userSegments || []}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ segment, user_count }) => `${segment} ${user_count}`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="user_count"
                        >
                          {(statistics.userSegments || []).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  </Box>
                </CardContent>
              </Card>
            </Box>

            {/* Advanced Analytics */}
            <Box sx={{ mt: 3 }}>
              {/* Feature Engagement */}
              <Card sx={{ mb: 3 }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    功能参与度
                  </Typography>
                  {/* Add feature engagement table here */}
                  <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
                    <Typography variant="body2">
                      功能参与度分析正在开发中...
                    </Typography>
                  </Box>
                </CardContent>
              </Card>

              {/* User Retention */}
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    用户留存率
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    基于用户行为分析的留存数据
                  </Typography>
                  {/* Add retention chart here */}
                  <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
                    <Typography variant="body2">
                      留存率图表正在开发中...
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Box>
          </Box>
        )}
      </TabPanel>
    </Box>
  );
};
