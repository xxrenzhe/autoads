'use client';

import React, { useState, useRef, useEffect } from 'react';
import { 
  Box, 
  Container, 
  Grid, 
  Card, 
  CardContent, 
  Typography, 
  Alert,
  Button,
  Chip
} from '@mui/material';
import CheckInModule from '@/components/user/CheckInModule';
import TokenTransactionDashboard from '@/components/user/TokenTransactionDashboard';
import InvitationModule from '@/components/user/InvitationModule';
import UsageReport from '@/components/user/UsageReport';
import QuickRecharge from '@/components/user/QuickRecharge';
import SubscriptionManagement from '@/components/user/SubscriptionManagement';

interface UserCenterProps {
  user?: {
    id: string;
    email: string;
    name?: string;
    status?: string;
    createdAt?: string;
    lastLoginAt?: string;
    tokenBalance?: number;
    tokensBySource?: Record<string, number>;
    subscription?: {
      id: string;
      status: string;
      currentPeriodStart: Date;
      currentPeriodEnd: Date;
      provider: string;
      plan: {
        id: string;
        name: string;
        description: string;
        price: number;
        tokenQuota: number;
        features: any;
      };
    } | null;
  };
}

const UserCenter: React.FC<UserCenterProps> = ({ user }) => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [tokenBalance, setTokenBalance] = useState(user?.tokenBalance || 0);
  const tabRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({});

  // Tab configuration for better maintainability and accessibility
  const tabs = [
    { id: 'dashboard', label: '数据概览', ariaLabel: '查看数据概览和统计信息' },
    { id: 'usage', label: '使用报告', ariaLabel: '查看详细的使用报告' },
    { id: 'recharge', label: '快速充值', ariaLabel: '进行Token充值操作' },
    { id: 'checkin', label: '每日签到', ariaLabel: '进行每日签到获取奖励' },
    { id: 'transactions', label: '交易记录', ariaLabel: '查看Token交易历史记录' },
    { id: 'subscription', label: '订阅管理', ariaLabel: '管理订阅计划和设置' },
    { id: 'invitation', label: '邀请好友', ariaLabel: '邀请好友获取奖励' }
  ];

  // Handle keyboard navigation for tabs
  const handleTabKeyDown = (event: React.KeyboardEvent, tabId: string) => {
    const currentIndex = tabs.findIndex(tab => tab.id === tabId);
    let nextIndex = currentIndex;

    switch (event.key) {
      case 'ArrowLeft':
        event.preventDefault();
        nextIndex = currentIndex > 0 ? currentIndex - 1 : tabs.length - 1;
        break;
      case 'ArrowRight':
        event.preventDefault();
        nextIndex = currentIndex < tabs.length - 1 ? currentIndex + 1 : 0;
        break;
      case 'Home':
        event.preventDefault();
        nextIndex = 0;
        break;
      case 'End':
        event.preventDefault();
        nextIndex = tabs.length - 1;
        break;
      default:
        return;
    }

    const nextTab = tabs[nextIndex];
    tabRefs.current[nextTab.id]?.focus();
    setActiveTab(nextTab.id);
  };

  // Format date for display
  const formatDate = (dateString?: string) => {
    if (!dateString) return '未知';
    return new Date(dateString).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get account status display with accessibility improvements
  const getAccountStatus = (status?: string) => {
    switch (status) {
      case 'ACTIVE': 
        return { 
          text: '账户已激活', 
          color: 'success', 
          icon: '✓',
          ariaLabel: '账户状态：已激活，正常使用中'
        };
      case 'INACTIVE': 
        return { 
          text: '账户未激活', 
          color: 'warning', 
          icon: '⚠',
          ariaLabel: '账户状态：未激活，需要激活后使用'
        };

      case 'BANNED': 
        return { 
          text: '账户已禁用', 
          color: 'error', 
          icon: '🚫',
          ariaLabel: '账户状态：已禁用，无法使用'
        };
      default: 
        return { 
          text: '未知状态', 
          color: 'default', 
          icon: '?',
          ariaLabel: '账户状态：未知'
        };
    }
  };

  if (!user) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Alert 
          severity="error" 
          role="alert"
          aria-live="assertive"
        >
          请先登录以访问个人中心
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          个人中心
        </Typography>
        <Typography variant="body1" color="textSecondary">
          欢迎回来，{user.name || user.email}
        </Typography>
      </Box>

      {/* User Basic Information */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            个人信息
          </Typography>
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="textSecondary">
                  邮箱地址
                </Typography>
                <Typography variant="body1">
                  {user.email}
                </Typography>
              </Box>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="textSecondary">
                  注册时间
                </Typography>
                <Typography variant="body1">
                  {formatDate(user.createdAt)}
                </Typography>
              </Box>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="textSecondary">
                  最后登录
                </Typography>
                <Typography variant="body1">
                  {formatDate(user.lastLoginAt)}
                </Typography>
              </Box>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="textSecondary">
                  账户状态
                </Typography>
                <Typography 
                  variant="body1" 
                  sx={{ color: getAccountStatus(user.status).color }}
                >
                  • {getAccountStatus(user.status).text}
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Token Balance Overview */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h6" color="textSecondary">
                总Token余额
              </Typography>
              <Typography variant="h4" color="primary">
                {user?.tokenBalance || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h6" color="textSecondary">
                订阅Token
              </Typography>
              <Typography variant="h4" color="info.main">
                {user?.tokensBySource?.subscription || 0}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                跟随订阅周期
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h6" color="textSecondary">
                活动Token
              </Typography>
              <Typography variant="h4" color="success.main">
                {user?.tokensBySource?.activity || 0}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                永不过期
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h6" color="textSecondary">
                购买Token
              </Typography>
              <Typography variant="h4" color="warning.main">
                {user?.tokensBySource?.purchased || 0}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                永不过期
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tab Navigation */}
      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
          <Box
            sx={{
              px: 3,
              py: 1,
              borderRadius: 1,
              cursor: 'pointer',
              bgcolor: activeTab === 'dashboard' ? 'primary.main' : 'transparent',
              color: activeTab === 'dashboard' ? 'white' : 'text.primary',
              '&:hover': { bgcolor: activeTab === 'dashboard' ? 'primary.dark' : 'action.hover' }
            }}
            onClick={() => setActiveTab('dashboard')}
          >
            数据概览
          </Box>
          <Box
            sx={{
              px: 3,
              py: 1,
              borderRadius: 1,
              cursor: 'pointer',
              bgcolor: activeTab === 'usage' ? 'primary.main' : 'transparent',
              color: activeTab === 'usage' ? 'white' : 'text.primary',
              '&:hover': { bgcolor: activeTab === 'usage' ? 'primary.dark' : 'action.hover' }
            }}
            onClick={() => setActiveTab('usage')}
          >
            使用报告
          </Box>
          <Box
            sx={{
              px: 3,
              py: 1,
              borderRadius: 1,
              cursor: 'pointer',
              bgcolor: activeTab === 'recharge' ? 'primary.main' : 'transparent',
              color: activeTab === 'recharge' ? 'white' : 'text.primary',
              '&:hover': { bgcolor: activeTab === 'recharge' ? 'primary.dark' : 'action.hover' }
            }}
            onClick={() => setActiveTab('recharge')}
          >
            快速充值
          </Box>
          <Box
            sx={{
              px: 3,
              py: 1,
              borderRadius: 1,
              cursor: 'pointer',
              bgcolor: activeTab === 'checkin' ? 'primary.main' : 'transparent',
              color: activeTab === 'checkin' ? 'white' : 'text.primary',
              '&:hover': { bgcolor: activeTab === 'checkin' ? 'primary.dark' : 'action.hover' }
            }}
            onClick={() => setActiveTab('checkin')}
          >
            每日签到
          </Box>
          <Box
            sx={{
              px: 3,
              py: 1,
              borderRadius: 1,
              cursor: 'pointer',
              bgcolor: activeTab === 'transactions' ? 'primary.main' : 'transparent',
              color: activeTab === 'transactions' ? 'white' : 'text.primary',
              '&:hover': { bgcolor: activeTab === 'transactions' ? 'primary.dark' : 'action.hover' }
            }}
            onClick={() => setActiveTab('transactions')}
          >
            交易记录
          </Box>
          <Box
            sx={{
              px: 3,
              py: 1,
              borderRadius: 1,
              cursor: 'pointer',
              bgcolor: activeTab === 'subscription' ? 'primary.main' : 'transparent',
              color: activeTab === 'subscription' ? 'white' : 'text.primary',
              '&:hover': { bgcolor: activeTab === 'subscription' ? 'primary.dark' : 'action.hover' }
            }}
            onClick={() => setActiveTab('subscription')}
          >
            订阅管理
          </Box>
          <Box
            sx={{
              px: 3,
              py: 1,
              borderRadius: 1,
              cursor: 'pointer',
              bgcolor: activeTab === 'invitation' ? 'primary.main' : 'transparent',
              color: activeTab === 'invitation' ? 'white' : 'text.primary',
              '&:hover': { bgcolor: activeTab === 'invitation' ? 'primary.dark' : 'action.hover' }
            }}
            onClick={() => setActiveTab('invitation')}
          >
            邀请好友
          </Box>
        </CardContent>
      </Card>

      {/* Tab Content */}
      {activeTab === 'dashboard' && (
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 8 }}>
            <UsageReport 
              userId={user.id} 
              onQuickRecharge={() => setActiveTab('recharge')}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <QuickRecharge 
              userId={user.id}
              currentBalance={tokenBalance}
              onRechargeSuccess={(amount) => {
                setTokenBalance(prev => prev + amount);
              }}
            />
          </Grid>
        </Grid>
      )}
      {activeTab === 'usage' && (
        <UsageReport 
          userId={user.id} 
          onQuickRecharge={() => setActiveTab('recharge')}
        />
      )}
      {activeTab === 'recharge' && (
        <QuickRecharge 
          userId={user.id}
          currentBalance={tokenBalance}
          onRechargeSuccess={(amount) => {
            setTokenBalance(prev => prev + amount);
          }}
        />
      )}
      {activeTab === 'checkin' && <CheckInModule />}
      {activeTab === 'transactions' && <TokenTransactionDashboard />}
      {activeTab === 'subscription' && <SubscriptionManagement subscription={user?.subscription} />}
      {activeTab === 'invitation' && <InvitationModule />}
    </Container>
  );
};

export default UserCenter;