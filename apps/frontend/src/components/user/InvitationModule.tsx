'use client';

import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Button,
  Grid,
  TextField,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  IconButton,
  Tooltip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Tab,
  Tabs,
  Badge,
  Divider,
  CircularProgress
} from '@mui/material';
import {
  CopyAll,
  Share,
  CheckCircle,
  Pending,
  EventBusy,
  EmojiEvents,
  Group,
  TrendingUp,
  CardMembership,
  Star
} from '@mui/icons-material';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface Invitation {
  id: string;
  code: string;
  inviterEmail: string;
  inviterName?: string;
  status: 'PENDING' | 'ACCEPTED' | 'EXPIRED';
  tokensReward: number;
  createdAt: string;
  expiresAt?: string;
}

interface InvitationStats {
  totalInvited: number;
  totalAccepted: number;
  totalTokensEarned: number;
  recentInvitations: Invitation[];
}

interface CurrentInvitation {
  code?: string;
  expiresAt?: string;
  status: string;
}

const InvitationModule: React.FC = () => {
  const [currentInvitation, setCurrentInvitation] = useState<CurrentInvitation | null>(null);
  const [stats, setStats] = useState<InvitationStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [tabValue, setTabValue] = useState(0);
  const [invitationCode, setInvitationCode] = useState('');
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [acceptResult, setAcceptResult] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchInvitationData();
  }, []);

  const fetchInvitationData = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/user/invitation/create');
      if (!response.ok) {
        throw new Error('Failed to fetch invitation data');
      }
      const data = await response.json();
      setCurrentInvitation(data.data.currentInvitation);
      setStats(data.data.stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateInvitation = async () => {
    setCreating(true);
    setError(null);

    try {
      const response = await fetch('/api/user/invitation/create', {
        method: 'POST'
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create invitation');
      }

      setSuccess('Invitation code created successfully');
      await fetchInvitationData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create invitation');
    } finally {
      setCreating(false);
    }
  };

  const handleAcceptInvitation = async () => {
    if (!invitationCode.trim()) {
      setError('Please enter an invitation code');
      return;
    }

    setAccepting(true);
    setError(null);

    try {
      const response = await fetch('/api/user/invitation/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invitationCode: invitationCode.trim() })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to accept invitation');
      }

      setAcceptResult(data);
      setShowSuccessDialog(true);
      setInvitationCode('');
      await fetchInvitationData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept invitation');
    } finally {
      setAccepting(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACCEPTED': return 'success';
      case 'PENDING': return 'warning';
      case 'EXPIRED': return 'error';
      default: return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ACCEPTED': return <CheckCircle />;
      case 'PENDING': return <Pending />;
      case 'EXPIRED': return <EventBusy />;
      default: return null as any;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Group sx={{ mr: 1, color: 'primary.main' }} />
            <Typography variant="h5" component="h2">
              邀请好友
            </Typography>
          </Box>
          <Typography variant="body2" color="textSecondary">
            邀请好友注册，双方均可获得Pro套餐
          </Typography>
        </Box>

        {/* Stats Overview */}
        {stats && (
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={4}>
              <Card sx={{ bgcolor: 'primary.light', color: 'white' }}>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Group />
                  <Typography variant="h4" sx={{ my: 1 }}>
                    {stats.totalInvited}
                  </Typography>
                  <Typography variant="body2">
                    已邀请人数
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} sm={4}>
              <Card sx={{ bgcolor: 'success.light', color: 'white' }}>
                <CardContent sx={{ textAlign: 'center' }}>
                  <CheckCircle />
                  <Typography variant="h4" sx={{ my: 1 }}>
                    {stats.totalAccepted}
                  </Typography>
                  <Typography variant="body2">
                    成功邀请
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} sm={4}>
              <Card sx={{ bgcolor: 'warning.light', color: 'white' }}>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Star />
                  <Typography variant="h4" sx={{ my: 1 }}>
                    {stats.totalTokensEarned}
                  </Typography>
                  <Typography variant="body2">
                    获得Token
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}

        {/* Tabs */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
          <Tabs value={tabValue} onChange={((e, v: any): any) => setTabValue(v)}>
            <Tab label="我的邀请码" />
            <Tab label="使用邀请码" />
            <Tab label="邀请记录" />
          </Tabs>
        </Box>

        {/* Error and Success Messages */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
        {success && (
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
            {success}
          </Alert>
        )}

        {/* Tab Content */}
        {tabValue === 0 && (
          <Box>
            <Typography variant="h6" gutterBottom>
              创建邀请码
            </Typography>
            <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
              邀请好友注册，双方都将获得30天Pro套餐和100个Token
            </Typography>
            
            {currentInvitation?.status === 'ACTIVE' ? (
              <Card sx={{ bgcolor: 'success.lightest', p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography variant="h5" color="success.main" gutterBottom>
                      {currentInvitation.code}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      有效期至: {currentInvitation.expiresAt ? format(new Date(currentInvitation.expiresAt), 'yyyy-MM-dd', { locale: zhCN }) : '永久'}
                    </Typography>
                  </Box>
                  <Box>
                    <Tooltip title={copied ? '已复制' : '复制邀请码'}>
                      <IconButton 
                        onClick={((: any): any) => copyToClipboard(currentInvitation.code!)}
                        color={copied ? 'success' : 'primary'}
                      >
                        <CopyAll />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="分享">
                      <IconButton color="primary">
                        <Share />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Box>
              </Card>
            ) : (
              <Button
                variant="contained"
                size="large"
                onClick={handleCreateInvitation}
                disabled={creating}
                startIcon={creating ? <CircularProgress size={20} /> : <Group />}
                sx={{ minWidth: 200 }}
              >
                {creating ? '创建中...' : '生成邀请码'}
              </Button>
            )}
          </Box>
        )}

        {tabValue === 1 && (
          <Box>
            <Typography variant="h6" gutterBottom>
              使用邀请码
            </Typography>
            <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
              输入好友的邀请码，获得Pro套餐和奖励Token
            </Typography>
            
            <Box sx={{ display: 'flex', gap: 2, maxWidth: 500 }}>
              <TextField
                fullWidth
                label="邀请码"
                value={invitationCode}
                onChange={((e: any): any) => setInvitationCode(e.target.value.toUpperCase())}
                placeholder="请输入8位邀请码"
                inputProps={{ maxLength: 8, style: { textTransform: 'uppercase' } }}
              />
              <Button
                variant="contained"
                onClick={handleAcceptInvitation}
                disabled={accepting || !invitationCode.trim()}
                sx={{ minWidth: 120 }}
              >
                {accepting ? '使用中...' : '使用'}
              </Button>
            </Box>

            <Box sx={{ mt: 3, p: 2, bgcolor: 'info.lightest', borderRadius: 1 }}>
              <Typography variant="h6" color="info.main" gutterBottom>
                <CardMembership sx={{ mr: 1, verticalAlign: 'middle' }} />
                奖励内容
              </Typography>
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                <li>30天Pro套餐访问权限</li>
                <li>100个奖励Token</li>
                <li>所有Pro功能解锁</li>
              </ul>
            </Box>
          </Box>
        )}

        {tabValue === 2 && stats && (
          <Box>
            <Typography variant="h6" gutterBottom>
              邀请记录
            </Typography>
            
            {stats.recentInvitations.length > 0 ? (
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>邀请码</TableCell>
                      <TableCell>状态</TableCell>
                      <TableCell>奖励Token</TableCell>
                      <TableCell>创建时间</TableCell>
                      <TableCell>过期时间</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {stats.recentInvitations.map((invitation: any) => (
                      <TableRow key={invitation.id}>
                        <TableCell>
                          <Typography variant="body2" fontWeight={600}>
                            {invitation.code}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            icon={getStatusIcon(invitation.status) || undefined}
                            label={invitation.status}
                            color={getStatusColor(invitation.status)}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>{invitation.tokensReward}</TableCell>
                        <TableCell>
                          {format(new Date(invitation.createdAt), 'yyyy-MM-dd HH:mm', { locale: zhCN })}
                        </TableCell>
                        <TableCell>
                          {invitation.expiresAt 
                            ? format(new Date(invitation.expiresAt), 'yyyy-MM-dd', { locale: zhCN })
                            : '永久'
                          }
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography color="textSecondary">
                  暂无邀请记录
                </Typography>
              </Box>
            )}
          </Box>
        )}

        {/* Success Dialog */}
        <Dialog
          open={showSuccessDialog}
          onClose={() => setShowSuccessDialog(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle sx={{ textAlign: 'center' }}>
            <EmojiEvents color="success" sx={{ fontSize: 48, mb: 1 }} />
            <Typography variant="h4">
              邀请成功！
            </Typography>
          </DialogTitle>
          <DialogContent sx={{ textAlign: 'center' }}>
            <Alert severity="success" sx={{ mb: 2 }}>
              {acceptResult?.message}
            </Alert>
            <Typography variant="body1" color="textSecondary">
              Pro套餐已添加到您的账户
            </Typography>
          </DialogContent>
          <DialogActions sx={{ justifyContent: 'center' }}>
            <Button onClick={((: any): any) => setShowSuccessDialog(false)} variant="contained">
              确定
            </Button>
          </DialogActions>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default InvitationModule;