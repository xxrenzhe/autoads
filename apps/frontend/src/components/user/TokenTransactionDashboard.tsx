'use client';

import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Grid,
  Chip,
  IconButton,
  Tooltip,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  LinearProgress,
  Badge,
  Alert,
  Button,
  Menu,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Pagination
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  Refresh,
  Download,
  FilterList,
  Info,
  ArrowUpward,
  ArrowDownward,
  CalendarToday,
  AccountBalanceWallet,
  LocalActivity,
  ShoppingBag,
  CardGiftcard,
  Share
} from '@mui/icons-material';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface TokenTransaction {
  id: string;
  type: 'SUBSCRIPTION' | 'PURCHASED' | 'ACTIVITY' | 'BONUS' | 'REFERRAL';
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  source: string;
  description?: string;
  createdAt: string;
  metadata?: any;
}

interface TokenStats {
  totalTransactions: number;
  totalAcquired: number;
  totalConsumed: number;
  byType: Record<string, { acquired: number; consumed: number }>;
  bySource: Record<string, number>;
  recentTransactions: TokenTransaction[];
}

interface BalanceHistory {
  date: string;
  balance: number;
  change: number;
}

const TokenTransactionDashboard: React.FC = () => {
  const [transactions, setTransactions] = useState<TokenTransaction[]>([]);
  const [stats, setStats] = useState<TokenStats | null>(null);
  const [balanceHistory, setBalanceHistory] = useState<BalanceHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tabValue, setTabValue] = useState(0);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState({
    type: '',
    source: '',
    startDate: '',
    endDate: ''
  });
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const tokenTypeIcons = {
    SUBSCRIPTION: <AccountBalanceWallet />,
    PURCHASED: <ShoppingBag />,
    ACTIVITY: <LocalActivity />,
    BONUS: <CardGiftcard />,
    REFERRAL: <Share />
  };

  const tokenTypeLabels = {
    SUBSCRIPTION: '订阅Token',
    PURCHASED: '购买Token',
    ACTIVITY: '活动Token',
    BONUS: '奖励Token',
    REFERRAL: '推荐Token'
  };

  const sourceLabels = {
    daily_check_in: '每日签到',
    token_purchase: 'Token购买',
    subscription: '订阅套餐',
    admin_grant: '管理员授予',
    siterank: '网站排名',
    batchopen: '批量打开',
    adscenter: '链接替换'
  };

  useEffect(() => {
    fetchData();
  }, [page, filter]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Build query parameters
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20'
      });

      if (filter.type) params.append('type', filter.type);
      if (filter.source) params.append('source', filter.source);
      if (filter.startDate) params.append('startDate', filter.startDate);
      if (filter.endDate) params.append('endDate', filter.endDate);

      // Fetch transactions
      const [transactionsRes, statsRes, historyRes] = await Promise.all([
        fetch(`/api/user/tokens/transactions?${params}`),
        fetch('/api/user/tokens/transactions/stats', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ timeRange: { start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), end: new Date() } })
        }),
        fetch('/api/user/tokens/balance-history?days=30')
      ]);

      if (!transactionsRes.ok || !statsRes.ok || !historyRes.ok) {
        throw new Error('Failed to fetch data');
      }

      const transactionsData = await transactionsRes.json();
      const statsData = await statsRes.json();
      const historyData = await historyRes.json();

      setTransactions(transactionsData.data.transactions);
      setStats(statsData.data);
      setBalanceHistory(historyData.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilter(prev => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const exportData = async () => {
    try {
      const params = new URLSearchParams();
      Object.entries(filter).forEach(([key, value]: any) => {
        if (value) params.append(key, value);
      });

      const response = await fetch(`/api/admin/tokens/transactions/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(params))
      });

      if (response.ok) {
        const data = await response.json();
        // Create and download CSV
        const csv = convertToCSV(data.data.data);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = data.data.filename;
        link.click();
      }
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  const convertToCSV = (data: any[]) => {
    if (data.length === 0) return '';
    
    const headers = Object.keys(data[0]);
    const csv = [
      headers.join(','),
      ...data.map((row => headers.map(header: any) => JSON.stringify(row[header])).join(','))
    ].join('\n');
    
    return csv;
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <LinearProgress />
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
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Token 交易记录
        </Typography>
        <Box>
          <Tooltip title="刷新">
            <IconButton onClick={fetchData}>
              <Refresh />
            </IconButton>
          </Tooltip>
          <Tooltip title="导出">
            <IconButton onClick={exportData}>
              <Download />
            </IconButton>
          </Tooltip>
          <Tooltip title="筛选">
            <IconButton onClick={((e: any): any) => setAnchorEl(e.currentTarget)}>
              <FilterList />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Stats Cards */}
      {stats && (
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <AccountBalanceWallet sx={{ mr: 1, color: 'primary.main' }} />
                  <Box>
                    <Typography color="textSecondary" variant="body2">
                      当前余额
                    </Typography>
                    <Typography variant="h5">
                      {stats.byType?.SUBSCRIPTION?.acquired || 0}
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
                  <TrendingUp sx={{ mr: 1, color: 'success.main' }} />
                  <Box>
                    <Typography color="textSecondary" variant="body2">
                      总获得Token
                    </Typography>
                    <Typography variant="h5" color="success.main">
                      {stats.totalAcquired.toLocaleString()}
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
                  <TrendingDown sx={{ mr: 1, color: 'error.main' }} />
                  <Box>
                    <Typography color="textSecondary" variant="body2">
                      总消耗Token
                    </Typography>
                    <Typography variant="h5" color="error.main">
                      {stats.totalConsumed.toLocaleString()}
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
                  <Info sx={{ mr: 1, color: 'info.main' }} />
                  <Box>
                    <Typography color="textSecondary" variant="body2">
                      总交易数
                    </Typography>
                    <Typography variant="h5">
                      {stats.totalTransactions}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Filter Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
      >
        <MenuItem>
          <FormControl fullWidth size="small">
            <InputLabel>Token类型</InputLabel>
            <Select
              value={filter.type}
              label="Token类型"
              onChange={((e: any): any) => handleFilterChange('type', e.target.value)}
            >
              <MenuItem value="">全部</MenuItem>
              <MenuItem value="SUBSCRIPTION">订阅Token</MenuItem>
              <MenuItem value="PURCHASED">购买Token</MenuItem>
              <MenuItem value="ACTIVITY">活动Token</MenuItem>
              <MenuItem value="BONUS">奖励Token</MenuItem>
              <MenuItem value="REFERRAL">推荐Token</MenuItem>
            </Select>
          </FormControl>
        </MenuItem>
      </Menu>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tabValue} onChange={handleTabChange}>
          <Tab label="交易记录" />
          <Tab label="余额趋势" />
          <Tab label="统计报表" />
        </Tabs>
      </Box>

      {/* Tab Content */}
      {tabValue === 0 && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>时间</TableCell>
                <TableCell>类型</TableCell>
                <TableCell>来源</TableCell>
                <TableCell>数量</TableCell>
                <TableCell>余额变化</TableCell>
                <TableCell>描述</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {transactions.map((transaction: any) => (
                <TableRow key={transaction.id}>
                  <TableCell>
                    {format(new Date(transaction.createdAt), 'yyyy-MM-dd HH:mm', { locale: zhCN })}
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      {tokenTypeIcons[transaction.type]}
                      <Box sx={{ ml: 1 }}>
                        {tokenTypeLabels[transaction.type]}
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={sourceLabels[transaction.source as keyof typeof sourceLabels] || transaction.source} 
                      size="small" 
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      {transaction.amount > 0 ? (
                        <ArrowUpward sx={{ mr: 0.5, color: 'success.main', fontSize: 16 }} />
                      ) : (
                        <ArrowDownward sx={{ mr: 0.5, color: 'error.main', fontSize: 16 }} />
                      )}
                      <Typography 
                        color={transaction.amount > 0 ? 'success.main' : 'error.main'}
                        fontWeight={600}
                      >
                        {Math.abs(transaction.amount)}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {transaction.balanceBefore} → {transaction.balanceAfter}
                    </Typography>
                  </TableCell>
                  <TableCell>{transaction.description || '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {tabValue === 1 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              余额趋势 (最近30天)
            </Typography>
            {/* Here you would integrate a chart library like Chart.js or Recharts */}
            <Box sx={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Typography color="textSecondary">
                图表组件待集成
              </Typography>
            </Box>
          </CardContent>
        </Card>
      )}

      {tabValue === 2 && stats && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  按类型统计
                </Typography>
                <Box sx={{ mt: 2 }}>
                  {Object.entries(stats.byType).map(([type, data]: any) => (
                    <Box key={type} sx={{ mb: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography variant="body2">{tokenTypeLabels[type as keyof typeof tokenTypeLabels]}</Typography>
                        <Typography variant="body2">
                          获得: {data.acquired} / 消耗: {data.consumed}
                        </Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={(data.acquired / (data.acquired + data.consumed)) * 100}
                        sx={{ height: 8 }}
                      />
                    </Box>
                  ))}
                </Box>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  按来源统计
                </Typography>
                <Box sx={{ mt: 2 }}>
                  {Object.entries(stats.bySource).map(([source, amount]: any) => (
                    <Box key={source} sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2">
                        {sourceLabels[source as keyof typeof sourceLabels] || source}
                      </Typography>
                      <Typography variant="body2" fontWeight={600}>
                        {amount}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Pagination */}
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
        <Pagination
          count={Math.ceil(100 / 20)} // Replace with actual total pages
          page={page}
          onChange={((e, newPage: any): any) => setPage(newPage)}
          color="primary"
        />
      </Box>
    </Box>
  );
};

export default TokenTransactionDashboard;