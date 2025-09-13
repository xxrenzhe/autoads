import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TablePagination
} from '@mui/material';
import {
  Refresh,
  Warning,
  Schedule,
  CheckCircle,
  Error
} from '@mui/icons-material';
import { useNotify, useRefresh } from 'react-admin';

interface ExpiringSubscription {
  id: string;
  userName: string;
  userEmail: string;
  planName: string;
  expiresAt: string;
  daysUntilExpiration: number;
}

interface ExpiringStats {
  expired: number;
  expiringTomorrow: number;
  expiringNextWeek: number;
}

/**
 * Subscription Expiration Dashboard Component
 */
export const SubscriptionExpirationDashboard: React.FC = () => {
  const notify = useNotify();
  const refresh = useRefresh();
  
  const [stats, setStats] = useState<ExpiringStats | null>(null);
  const [expiringSubscriptions, setExpiringSubscriptions] = useState<ExpiringSubscription[]>([]);
  const [loading, setLoading] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Load data
  const loadData = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/subscriptions/expiring-stats');
      if (response.ok) => {
        const data = await response.json();
        setStats(data.stats);
      } else {
        notify('Failed to load statistics', { type: 'error' });
      }
    } catch (error) {
      notify('Network error', { type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Handle manual expiration check
  const handleManualCheck = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/subscriptions/check-expired', {
        method: 'POST'
      });
      
      if (response.ok) => {
        const data = await response.json();
        notify(`Processed ${data.results.processedSubscriptions} subscriptions`, { type: 'success' });
        loadData();
        refresh();
      } else {
        notify('Failed to run expiration check', { type: 'error' });
      }
    } catch (error) {
      notify('Network error', { type: 'error' });
    } finally {
      setLoading(false);
      setConfirmDialogOpen(false);
    }
  };

  const getDaysColor = (days: number) => {
    if (days < 0) return 'error';
    if (days <= 1) return 'error';
    if (days <= 7) return 'warning';
    return 'success';
  };

  const getDaysLabel = (days: number) => {
    if (days < 0) return '已过期';
    if (days === 0) return '今天';
    if (days === 1) return '明天';
    return `${days}天后`;
  };

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5">订阅到期管理</Typography>
        <Box>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={loadData}
            disabled={loading}
            sx={{ mr: 1 }}
          >
            刷新
          </Button>
          <Button
            variant="contained"
            color="warning"
            startIcon={<Schedule />}
            onClick={((: any): any) => setConfirmDialogOpen(true)}
            disabled={loading}
          >
            手动检查到期
          </Button>
        </Box>
      </Box>

      {/* Statistics Cards */}
      {stats && (
        <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
          <Card sx={{ flex: 1 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Error color="error" sx={{ mr: 1 }} />
                <Box>
                  <Typography color="textSecondary" variant="body2">
                    已过期
                  </Typography>
                  <Typography variant="h4">
                    {stats.expired}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>

          <Card sx={{ flex: 1 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Warning color="warning" sx={{ mr: 1 }} />
                <Box>
                  <Typography color="textSecondary" variant="body2">
                    明天到期
                  </Typography>
                  <Typography variant="h4">
                    {stats.expiringTomorrow}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>

          <Card sx={{ flex: 1 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Schedule color="info" sx={{ mr: 1 }} />
                <Box>
                  <Typography color="textSecondary" variant="body2">
                    7天内到期
                  </Typography>
                  <Typography variant="h4">
                    {stats.expiringNextWeek}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Box>
      )}

      {/* Alert if there are expired subscriptions */}
      {stats && stats.expired > 0 && (
        <Alert severity="error" sx={{ mb: 2 }}>
          发现 {stats.expired} 个已过期但仍未处理的订阅！请立即点击"手动检查到期"进行处理。
        </Alert>
      )}

      {/* Expiring Subscriptions Table */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            即将到期的订阅
          </Typography>
          
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          ) : (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>用户</TableCell>
                    <TableCell>邮箱</TableCell>
                    <TableCell>套餐</TableCell>
                    <TableCell>到期时间</TableCell>
                    <TableCell>剩余天数</TableCell>
                    <TableCell>状态</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {/* This would be populated with actual data from an API endpoint */}
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      <Typography color="textSecondary">
                        详细数据需要从专门的API端点获取
                      </Typography>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog
        open={confirmDialogOpen}
        onClose={() => setConfirmDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>确认执行到期检查</DialogTitle>
        <DialogContent>
          <Typography>
            此操作将：
          </Typography>
          <ul>
            <li>将所有已过期的订阅标记为过期状态</li>
            <li>为到期用户自动分配免费套餐</li>
            <li>发送到期通知给相关用户</li>
            <li>清理相关的Token配额</li>
          </ul>
          <Typography variant="body2" color="text.secondary">
            注意：此操作不可撤销，请确认后继续。
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={((: any): any) => setConfirmDialogOpen(false)}>
            取消
          </Button>
          <Button 
            variant="contained" 
            color="warning"
            onClick={handleManualCheck}
            disabled={loading}
          >
            {loading ? <CircularProgress size={20} /> : '确认执行'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};