import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  Typography,
  Grid,
  Box,
  LinearProgress,
  Chip,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from '@mui/material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { apiClient } from '../../shared/lib/api-client';

/**
 * System metrics interface
 */
interface SystemMetrics {
  cpu: number;
  memory: number;
  disk: number;
  activeUsers: number;
  totalRequests: number;
  errorRate: number;
  responseTime: number;
  uptime: number;
}

/**
 * Module statistics interface
 */
interface ModuleStats {
  name: string;
  activeJobs: number;
  completedJobs: number;
  failedJobs: number;
  averageExecutionTime: number;
  successRate: number;
}

/**
 * System health status component
 */
const SystemHealthCard: React.FC<{ metrics: SystemMetrics }> = ({ metrics }) => {
  const getHealthStatus = () => {
    if (metrics.cpu > 80 || metrics.memory > 85 || metrics.errorRate > 5) {
      return { status: 'critical', color: 'error' as const };
    }
    if (metrics.cpu > 60 || metrics.memory > 70 || metrics.errorRate > 2) {
      return { status: 'warning', color: 'warning' as const };
    }
    return { status: 'healthy', color: 'success' as const };
  };

  const health = getHealthStatus();

  return (
    <Card>
      <CardHeader
        title="System Health"
        action={
          <Chip
            label={health.status.toUpperCase()}
            color={health.color}
            size="small"
          />
        }
      />
      <CardContent>
        <Grid container spacing={2}>
          <Grid item xs={6}>
            <Typography variant="body2" color="textSecondary">
              CPU Usage
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
              <LinearProgress
                variant="determinate"
                value={metrics.cpu}
                sx={{ flexGrow: 1, mr: 1 }}
                color={metrics.cpu > 80 ? 'error' : metrics.cpu > 60 ? 'warning' : 'primary'}
              />
              <Typography variant="body2">{metrics.cpu}%</Typography>
            </Box>
          </Grid>
          
          <Grid item xs={6}>
            <Typography variant="body2" color="textSecondary">
              Memory Usage
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
              <LinearProgress
                variant="determinate"
                value={metrics.memory}
                sx={{ flexGrow: 1, mr: 1 }}
                color={metrics.memory > 85 ? 'error' : metrics.memory > 70 ? 'warning' : 'primary'}
              />
              <Typography variant="body2">{metrics.memory}%</Typography>
            </Box>
          </Grid>
          
          <Grid item xs={6}>
            <Typography variant="body2" color="textSecondary">
              Disk Usage
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
              <LinearProgress
                variant="determinate"
                value={metrics.disk}
                sx={{ flexGrow: 1, mr: 1 }}
                color={metrics.disk > 90 ? 'error' : metrics.disk > 75 ? 'warning' : 'primary'}
              />
              <Typography variant="body2">{metrics.disk}%</Typography>
            </Box>
          </Grid>
          
          <Grid item xs={6}>
            <Typography variant="body2" color="textSecondary">
              Error Rate
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
              <LinearProgress
                variant="determinate"
                value={Math.min(metrics.errorRate, 10) * 10}
                sx={{ flexGrow: 1, mr: 1 }}
                color={metrics.errorRate > 5 ? 'error' : metrics.errorRate > 2 ? 'warning' : 'primary'}
              />
              <Typography variant="body2">{metrics.errorRate}%</Typography>
            </Box>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
};

/**
 * Performance metrics chart component
 */
const PerformanceChart: React.FC<{ data: any[] }> = ({ data }) => (
  <Card>
    <CardHeader title="Performance Metrics" />
    <CardContent>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="time" />
          <YAxis />
          <Tooltip />
          <Line
            type="monotone"
            dataKey="responseTime"
            stroke="#8884d8"
            name="Response Time (ms)"
          />
          <Line
            type="monotone"
            dataKey="requests"
            stroke="#82ca9d"
            name="Requests/min"
          />
        </LineChart>
      </ResponsiveContainer>
    </CardContent>
  </Card>
);

/**
 * Module statistics component
 */
const ModuleStatsTable: React.FC<{ stats: ModuleStats[] }> = ({ stats }) => (
  <Card>
    <CardHeader title="Module Statistics" />
    <CardContent>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Module</TableCell>
              <TableCell align="right">Active Jobs</TableCell>
              <TableCell align="right">Completed</TableCell>
              <TableCell align="right">Failed</TableCell>
              <TableCell align="right">Avg Time (s)</TableCell>
              <TableCell align="right">Success Rate</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {stats.map((stat) => (
              <TableRow key={stat.name}>
                <TableCell component="th" scope="row">
                  {stat.name.charAt(0).toUpperCase() + stat.name.slice(1)}
                </TableCell>
                <TableCell align="right">{stat.activeJobs}</TableCell>
                <TableCell align="right">{stat.completedJobs}</TableCell>
                <TableCell align="right">{stat.failedJobs}</TableCell>
                <TableCell align="right">{stat.averageExecutionTime.toFixed(2)}</TableCell>
                <TableCell align="right">
                  <Chip
                    label={`${stat.successRate.toFixed(1)}%`}
                    color={stat.successRate > 95 ? 'success' : stat.successRate > 85 ? 'warning' : 'error'}
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

/**
 * Main system monitoring dashboard component
 */
export const SystemMonitoringDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<SystemMetrics>({
    cpu: 0,
    memory: 0,
    disk: 0,
    activeUsers: 0,
    totalRequests: 0,
    errorRate: 0,
    responseTime: 0,
    uptime: 0,
  });

  const [performanceData, setPerformanceData] = useState<any[]>([]);
  const [moduleStats, setModuleStats] = useState<ModuleStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [metricsRes, performanceRes, statsRes] = await Promise.all([
          apiClient.get('/admin/system/metrics'),
          apiClient.get('/admin/system/performance'),
          apiClient.get('/admin/modules/stats'),
        ]);

        setMetrics(metricsRes.data);
        setPerformanceData(performanceRes.data);
        setModuleStats(statsRes.data);
      } catch (error) {
        console.error('Error fetching monitoring data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return <LinearProgress />;
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        System Monitoring Dashboard
      </Typography>

      <Grid container spacing={3}>
        {/* System Health */}
        <Grid item xs={12} md={6}>
          <SystemHealthCard metrics={metrics} />
        </Grid>

        {/* Key Metrics */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader title="Key Metrics" />
            <CardContent>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="h4" color="primary">
                    {metrics.activeUsers}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Active Users
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="h4" color="primary">
                    {metrics.totalRequests.toLocaleString()}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Total Requests
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="h4" color="primary">
                    {metrics.responseTime}ms
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Avg Response Time
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="h4" color="primary">
                    {Math.floor(metrics.uptime / 3600)}h
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Uptime
                  </Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Performance Chart */}
        <Grid item xs={12}>
          <PerformanceChart data={performanceData} />
        </Grid>

        {/* Module Statistics */}
        <Grid item xs={12}>
          <ModuleStatsTable stats={moduleStats} />
        </Grid>
      </Grid>
    </Box>
  );
};