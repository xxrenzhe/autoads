'use client';

import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Card, 
  CardContent, 
  Typography, 
  LinearProgress, 
  Grid, 
  Chip, 
  Tooltip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Alert
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Info as InfoIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  CreditCard as CreditCardIcon,
  Timeline as TimelineIcon
} from '@mui/icons-material';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface UsageReportProps {
  userId: string;
  onQuickRecharge?: () => void;
}

interface UsageData {
  dailyUsage: {
    date: string;
    tokensUsed: number;
    apiCalls: number;
  }[];
  monthlyStats: {
    totalTokensUsed: number;
    totalApiCalls: number;
    avgDailyUsage: number;
    peakUsageDay: string;
    growthRate: number;
  };
  tokenDistribution: {
    subscription: number;
    activity: number;
    purchased: number;
  };
  rateLimitStatus: {
    currentUsage: number;
    limit: number;
    resetTime: string;
    percentage: number;
  };
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel({ children, value, index }: TabPanelProps) {
  return (
    <div hidden={value !== index} style={{ height: value === index ? 'auto' : 0, overflow: 'hidden' }}>
      {children}
    </div>
  );
}

const UsageReport: React.FC<UsageReportProps> = ({ userId, onQuickRecharge }) => {
  const [activeTab, setActiveTab] = useState(0);
  const [usageData, setUsageData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [showDetails, setShowDetails] = useState(false);

  const fetchUsageData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/user/usage-report?userId=${userId}`);
      if (response.ok) {
        const data = await response.json();
        setUsageData(data);
      }
    } catch (error) {
      console.error('Failed to fetch usage data:', error);
    } finally {
      setLoading(false);
      setLastRefresh(new Date());
    }
  };

  useEffect(() => {
    fetchUsageData();
    // Auto refresh every 30 seconds
    const interval = setInterval(fetchUsageData, 30000);
    return () => clearInterval(interval);
  }, [userId]);

  const getProgressColor = (percentage: number) => {
    if (percentage >= 90) return 'error';
    if (percentage >= 70) return 'warning';
    return 'success';
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('zh-CN').format(num);
  };

  if (loading && !usageData) {
    return (
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <Typography>加载使用报告中...</Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  if (!usageData) {
    return (
      <Card>
        <CardContent>
          <Typography color="error">无法加载使用数据</Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Box>
      {/* Header with refresh button */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">使用报告</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="caption" color="textSecondary">
            最后更新: {format(lastRefresh, 'HH:mm:ss')}
          </Typography>
          <Tooltip title="刷新数据">
            <IconButton size="small" onClick={fetchUsageData} disabled={loading}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Quick Stats */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h6" color="textSecondary" gutterBottom>
                本月使用
              </Typography>
              <Typography variant="h4" color="primary">
                {formatNumber(usageData.monthlyStats.totalTokensUsed)}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Tokens
              </Typography>
              {usageData.monthlyStats.growthRate !== 0 && (
                <Chip
                  icon={usageData.monthlyStats.growthRate > 0 ? <TrendingUpIcon /> : <TrendingDownIcon />}
                  label={`${Math.abs(usageData.monthlyStats.growthRate)}%`}
                  color={usageData.monthlyStats.growthRate > 0 ? 'success' : 'error'}
                  size="small"
                  sx={{ mt: 1 }}
                />
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h6" color="textSecondary" gutterBottom>
                API调用
              </Typography>
              <Typography variant="h4" color="info.main">
                {formatNumber(usageData.monthlyStats.totalApiCalls)}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                本月总计
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h6" color="textSecondary" gutterBottom>
                日均使用
              </Typography>
              <Typography variant="h4" color="warning.main">
                {formatNumber(Math.round(usageData.monthlyStats.avgDailyUsage))}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Tokens/天
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h6" color="textSecondary" gutterBottom>
                限流状态
              </Typography>
              <Box sx={{ position: 'relative', mt: 2 }}>
                <LinearProgress
                  variant="determinate"
                  value={usageData.rateLimitStatus.percentage}
                  color={getProgressColor(usageData.rateLimitStatus.percentage)}
                  sx={{ height: 8, borderRadius: 4 }}
                />
                <Typography variant="body2" sx={{ mt: 1 }}>
                  {usageData.rateLimitStatus.currentUsage}/{usageData.rateLimitStatus.limit}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={activeTab} onChange={((e, v: any): any) => setActiveTab(v)}>
          <Tab label="使用趋势" icon={<TimelineIcon />} />
          <Tab label="Token分布" icon={<InfoIcon />} />
          <Tab label="详细记录" />
        </Tabs>
      </Box>

      {/* Tab Content */}
      <TabPanel value={activeTab} index={0}>
        <Card sx={{ mt: 2 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>近7天使用趋势</Typography>
            <Box sx={{ height: 200 }}>
              {/* Simplified trend visualization */}
              <Grid container spacing={1} sx={{ height: '100%', alignItems: 'flex-end' }}>
                {usageData.dailyUsage.slice(-7).map((day, index: any) => {
                  const maxValue = Math.max(...usageData.dailyUsage.map((d: any) => d.tokensUsed));
                  const height = (day.tokensUsed / maxValue) * 150;
                  return (
                    <Grid size="grow" key={index} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <Box
                        sx={{
                          width: '100%',
                          height: `${height}px`,
                          bgcolor: 'primary.main',
                          borderRadius: 1,
                          transition: 'height 0.3s'
                        }}
                      />
                      <Typography variant="caption" sx={{ mt: 1 }}>
                        {format(new Date(day.date), 'MM/dd')}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        {day.tokensUsed}
                      </Typography>
                    </Grid>
                  );
                })}
              </Grid>
            </Box>
          </CardContent>
        </Card>
      </TabPanel>

      <TabPanel value={activeTab} index={1}>
        <Card sx={{ mt: 2 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>Token类型分布</Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Box sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2">订阅Token</Typography>
                    <Typography variant="body2">{usageData.tokenDistribution.subscription}</Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={(usageData.tokenDistribution.subscription / 
                      (usageData.tokenDistribution.subscription + 
                       usageData.tokenDistribution.activity + 
                       usageData.tokenDistribution.purchased)) * 100}
                    sx={{ height: 8, borderRadius: 4 }}
                  />
                </Box>
                <Box sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2">活动Token</Typography>
                    <Typography variant="body2">{usageData.tokenDistribution.activity}</Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={(usageData.tokenDistribution.activity / 
                      (usageData.tokenDistribution.subscription + 
                       usageData.tokenDistribution.activity + 
                       usageData.tokenDistribution.purchased)) * 100}
                    sx={{ height: 8, borderRadius: 4 }}
                    color="success"
                  />
                </Box>
                <Box sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2">购买Token</Typography>
                    <Typography variant="body2">{usageData.tokenDistribution.purchased}</Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={(usageData.tokenDistribution.purchased / 
                      (usageData.tokenDistribution.subscription + 
                       usageData.tokenDistribution.activity + 
                       usageData.tokenDistribution.purchased)) * 100}
                    sx={{ height: 8, borderRadius: 4 }}
                    color="warning"
                  />
                </Box>
              </Grid>
              <Grid item xs={12} md={6}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h6" gutterBottom>使用建议</Typography>
                    <Typography variant="body2" color="textSecondary">
                      {usageData.rateLimitStatus.percentage >= 80 && (
                        <Alert severity="warning" sx={{ mb: 2 }}>
                          您的API使用量已接近限制，建议升级套餐或购买更多Token
                        </Alert>
                      )}
                      {usageData.tokenDistribution.subscription === 0 && (
                        <Alert severity="info" sx={{ mb: 2 }}>
                          订阅Token可享受更优惠的价格，考虑订阅我们的套餐
                        </Alert>
                      )}
                      • 订阅Token优先使用，有效期与订阅同步<br/>
                      • 活动Token30天后过期，建议优先使用<br/>
                      • 购买Token永久有效，可长期保存
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </TabPanel>

      <TabPanel value={activeTab} index={2}>
        <Card sx={{ mt: 2 }}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">详细使用记录</Typography>
              <Button 
                variant="outlined" 
                size="small"
                onClick={((: any): any) => setShowDetails(true)}
              >
                查看全部
              </Button>
            </Box>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>时间</TableCell>
                    <TableCell>类型</TableCell>
                    <TableCell>Token消耗</TableCell>
                    <TableCell>API调用</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {usageData.dailyUsage.slice(-5).reverse().map((day, index: any) => (
                    <TableRow key={index}>
                      <TableCell>{format(new Date(day.date), 'MM/dd HH:mm')}</TableCell>
                      <TableCell>API调用</TableCell>
                      <TableCell>{day.tokensUsed}</TableCell>
                      <TableCell>{day.apiCalls}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </TabPanel>

      {/* Quick Recharge CTA */}
      {usageData.rateLimitStatus.percentage >= 70 && (
        <Card sx={{ mt: 3, bgcolor: 'warning.light' }}>
          <CardContent sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box>
              <Typography variant="h6" color="warning.dark">
                Token余额不足
              </Typography>
              <Typography variant="body2" color="warning.dark">
                您的使用量已达到{usageData.rateLimitStatus.percentage}%，建议及时充值以避免服务中断
              </Typography>
            </Box>
            <Button
              variant="contained"
              color="warning"
              startIcon={<CreditCardIcon />}
              onClick={onQuickRecharge}
            >
              快速充值
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Details Dialog */}
      <Dialog
        open={showDetails}
        onClose={() => setShowDetails(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>详细使用记录</DialogTitle>
        <DialogContent>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>日期</TableCell>
                  <TableCell>Token使用</TableCell>
                  <TableCell>API调用</TableCell>
                  <TableCell>占比</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {usageData.dailyUsage.map((day, index: any) => {
                  const totalTokens = usageData.monthlyStats.totalTokensUsed;
                  const percentage = totalTokens > 0 ? (day.tokensUsed / totalTokens * 100).toFixed(1) : '0';
                  return (
                    <TableRow key={index}>
                      <TableCell>{format(new Date(day.date), 'yyyy-MM-dd')}</TableCell>
                      <TableCell>{formatNumber(day.tokensUsed)}</TableCell>
                      <TableCell>{formatNumber(day.apiCalls)}</TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <LinearProgress
                            variant="determinate"
                            value={parseFloat(percentage)}
                            sx={{ width: 60, height: 6 }}
                          />
                          <Typography variant="body2">{percentage}%</Typography>
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions>
          <Button onClick={((: any): any) => setShowDetails(false)}>关闭</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default UsageReport;