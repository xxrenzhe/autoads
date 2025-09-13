import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  LinearProgress,
  Tab,
  Tabs,
} from '@mui/material';
import {
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
  ResponsiveContainer,
} from 'recharts';

interface ApiStats {
  totalRequests: number;
  successRate: number;
  avgResponseTime: number;
  endpoints: Array<{
    endpoint: string;
    count: number;
    avgResponseTime: number;
    successRate: number;
  }>;
  hourlyUsage: Array<{
    hour: string;
    requests: number;
  }>;
  dailyUsage: Array<{
    date: string;
    requests: number;
  }>;
  statusCodes: Array<{
    code: number;
    count: number;
    percentage: number;
  }>;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

const ApiAnalyticsDashboard: React.FC = () => {
  const [stats, setStats] = useState<ApiStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [tabValue, setTabValue] = useState(0);

  useEffect(() => {
    fetchApiStats();
  }, []);

  const fetchApiStats = async () => {
    try {
      const response = await fetch('/api/admin/api/stats');
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Failed to fetch API stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  if (loading) => {
    return (
      <Box sx={{ p: 3 }}>
        <LinearProgress />
      </Box>
    );
  }

  const StatCard: React.FC<{
    title: string;
    value: string | number;
    subtitle?: string;
  }> = ({ title, value, subtitle }) => (
    <Card>
      <CardContent>
        <Typography variant="h6" component="div" gutterBottom>
          {title}
        </Typography>
        <Typography variant="h4" component="div" sx={{ fontWeight: 'bold' }}>
          {value}
        </Typography>
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
      <Typography variant="h4" component="h1" gutterBottom>
        API 使用分析
      </Typography>
      
      <Tabs value={tabValue} onChange={handleTabChange} sx={{ mb: 3 }}>
        <Tab label="概览" />
        <Tab label="端点分析" />
        <Tab label="时间趋势" />
        <Tab label="状态码分布" />
      </Tabs>

      {tabValue === 0 && (
        <>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 3, mb: 3 }}>
            <Box sx={{ gridColumn: 'span 12', sm: { gridColumn: 'span 6' }, md: { gridColumn: 'span 3' } }}>
              <StatCard
                title="总请求数"
                value={stats?.totalRequests || 0}
                subtitle="过去24小时"
              />
            </Box>
            <Box sx={{ gridColumn: 'span 12', sm: { gridColumn: 'span 6' }, md: { gridColumn: 'span 3' } }}>
              <StatCard
                title="成功率"
                value={`${(stats?.successRate || 0).toFixed(2)}%`}
              />
            </Box>
            <Box sx={{ gridColumn: 'span 12', sm: { gridColumn: 'span 6' }, md: { gridColumn: 'span 3' } }}>
              <StatCard
                title="平均响应时间"
                value={`${(stats?.avgResponseTime || 0).toFixed(2)}ms`}
              />
            </Box>
            <Box sx={{ gridColumn: 'span 12', sm: { gridColumn: 'span 6' }, md: { gridColumn: 'span 3' } }}>
              <StatCard
                title="活跃端点"
                value={stats?.endpoints?.length || 0}
              />
            </Box>
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 3 }}>
            <Box sx={{ gridColumn: 'span 12', md: { gridColumn: 'span 6' } }}>
              <Card>
                <CardContent>
                  <Typography variant="h6" component="div" gutterBottom>
                    24小时请求趋势
                  </Typography>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={stats?.hourlyUsage || []}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="hour" />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="requests" stroke="#8884d8" />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </Box>
            
            <Box sx={{ gridColumn: 'span 12', md: { gridColumn: 'span 6' } }}>
              <Card>
                <CardContent>
                  <Typography variant="h6" component="div" gutterBottom>
                    状态码分布
                  </Typography>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={stats?.statusCodes || []}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ code, percentage }) => `${code}: ${percentage}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="count"
                      >
                        {stats?.statusCodes?.map((entry, index: any) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </Box>
          </Box>
        </>
      )}

      {tabValue === 1 && (
        <Card>
          <CardContent>
            <Typography variant="h6" component="div" gutterBottom>
              端点使用统计
            </Typography>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={stats?.endpoints || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="endpoint" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" fill="#8884d8" name="请求次数" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {tabValue === 2 && (
        <Card>
          <CardContent>
            <Typography variant="h6" component="div" gutterBottom>
              7天使用趋势
            </Typography>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={stats?.dailyUsage || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="requests" stroke="#82ca9d" name="请求数" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {tabValue === 3 && (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 3 }}>
          <Box sx={{ gridColumn: 'span 12' }}>
            <Card>
              <CardContent>
                <Typography variant="h6" component="div" gutterBottom>
                  状态码详细分布
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                  {stats?.statusCodes?.map((item, index: any) => (
                    <Box key={item.code} sx={{ textAlign: 'center' }}>
                      <Typography variant="h4" sx={{ color: COLORS[index % COLORS.length] }}>
                        {item.count}
                      </Typography>
                      <Typography variant="body2">{item.code}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {item.percentage}%
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </CardContent>
            </Card>
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default ApiAnalyticsDashboard;