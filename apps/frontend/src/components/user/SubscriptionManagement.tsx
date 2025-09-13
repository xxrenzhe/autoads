'use client';

import React from 'react';
import { 
  Box, 
  Card, 
  CardContent, 
  Typography, 
  Chip, 
  Button, 
  Alert, 
  Divider,
  List,
  ListItem,
  ListItemText,
  Grid,
  LinearProgress
} from '@mui/material';
import { 
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Upgrade as UpgradeIcon,
  CalendarToday as CalendarIcon
} from '@mui/icons-material';

interface SubscriptionManagementProps {
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
}

const SubscriptionManagement: React.FC<SubscriptionManagementProps> = ({ subscription }) => {
  const [loading, setLoading] = React.useState(false);

  const isTrial = subscription?.provider === 'system';
  const isExpired = subscription && new Date() > new Date(subscription.currentPeriodEnd);
  const daysRemaining = subscription ? 
    Math.ceil((new Date(subscription.currentPeriodEnd).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : 0;
  const isTrialExpiring = isTrial && daysRemaining <= 3 && daysRemaining > 0;

  const getSubscriptionStatus = () => {
    if (!subscription) => {
      return { label: '无订阅', color: 'default' as const, icon: <CancelIcon /> };
    }
    if (isExpired) => {
      return { label: '已过期', color: 'error' as const, icon: <CancelIcon /> };
    }
    if (isTrial) => {
      return { label: '试用中', color: 'info' as const, icon: <CheckCircleIcon /> };
    }
    return { label: '订阅中', color: 'success' as const, icon: <CheckCircleIcon /> };
  };

  const status = getSubscriptionStatus();

  const renderFeatures = () => {
    if (!subscription?.plan.features) return null;

    const features = subscription.plan.features;
    const featureList = [];

    // SiteRank features
    if (features.siterank?.enabled) => {
      featureList.push(
        <ListItem key="siterank">
          <ListItemText
            primary="网站排名分析"
            secondary={`批量查询上限: ${features.siterank.maxQueriesPerBatch || 100} 个域名`}
          />
        </ListItem>
      );
    }

    // BatchOpen features
    if (features.batchopen?.enabled) => {
      featureList.push(
        <ListItem key="batchopen">
          <ListItemText
            primary="真实点击工具"
            secondary={`批量打开上限: ${features.batchopen.maxUrlsPerBatch || 200} 个URL`}
          />
        </ListItem>
      );
      
      if (features.batchopen?.proxyRotation) => {
        featureList.push(
          <ListItem key="proxy">
            <ListItemText
              primary="代理轮换"
              secondary="支持HTTP代理轮换"
            />
          </ListItem>
        );
      }
    }

    // ChangeLink features
    if (features.adscenter?.enabled) => {
      featureList.push(
        <ListItem key="adscenter">
          <ListItemText
            primary="自动化广告"
            secondary={`管理账号上限: ${features.adscenter.maxAccountsManaged || 5} 个`}
          />
        </ListItem>
      );
    }

    return featureList;
  };

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          订阅管理
        </Typography>

        {subscription ? (
          <>
            {/* Subscription Status */}
            <Box sx={{ mb: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Chip
                  icon={status.icon}
                  label={status.label}
                  color={status.color}
                  size="small"
                />
                {isTrial && (
                  <Chip
                    label="14天免费试用"
                    color="warning"
                    size="small"
                  />
                )}
              </Box>
              
              <Typography variant="h5" color="primary" gutterBottom>
                {subscription.plan.name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {subscription.plan.description}
              </Typography>
            </Box>

            {/* Subscription Period */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                {isTrial ? '试用期' : '订阅周期'}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CalendarIcon fontSize="small" />
                <Typography variant="body2">
                  {new Date(subscription.currentPeriodStart).toLocaleDateString()} - {' '}
                  {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                </Typography>
              </Box>
              
              {!isExpired && daysRemaining > 0 && (
                <Box sx={{ mt: 1 }}>
                  <Typography 
                    variant="body2" 
                    color={isTrialExpiring ? "warning.main" : "text.secondary"}
                    sx={{ fontWeight: isTrialExpiring ? 'bold' : 'normal' }}
                  >
                    {isTrial ? `试用期剩余 ${daysRemaining} 天` : `剩余 ${daysRemaining} 天`}
                  </Typography>
                  <LinearProgress 
                    variant="determinate" 
                    value={isTrial ? ((14 - daysRemaining) / 14) * 100 : ((30 - daysRemaining) / 30) * 100}
                    color={isTrialExpiring ? "warning" : "primary"}
                    sx={{ mt: 1, height: 6 }}
                  />
                  {isTrial && (
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                      试用期结束后将自动转为免费套餐
                    </Typography>
                  )}
                </Box>
              )}
            </Box>

            {/* Token Quota */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Token 配额
              </Typography>
              <Typography variant="h6" color="primary">
                {subscription.plan.tokenQuota.toLocaleString()} tokens/月
              </Typography>
            </Box>

            {/* Features */}
            <Divider sx={{ my: 2 }} />
            <Typography variant="body2" color="text.secondary" gutterBottom>
              功能权限
            </Typography>
            <List dense>
              {renderFeatures()}
            </List>

            {/* Actions */}
            {isExpired && !isTrial && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                您的订阅已过期，请立即续费以继续使用服务
              </Alert>
            )}

            {isExpired && isTrial && (
              <Alert severity="info" sx={{ mb: 2 }}>
                您的试用期已结束，已自动转为免费套餐。升级到付费套餐以享受更多功能
              </Alert>
            )}

            {isTrial && isTrialExpiring && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>
                    试用期即将结束！
                  </Typography>
                  <Typography variant="body2">
                    您的14天Pro试用期还剩 {daysRemaining} 天。试用期结束后将自动转为免费套餐，
                    部分高级功能将不可用。立即升级以继续享受完整服务！
                  </Typography>
                </Box>
              </Alert>
            )}

            {isTrial && daysRemaining > 3 && (
              <Alert severity="info" sx={{ mb: 2 }}>
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>
                    正在享受Pro试用期
                  </Typography>
                  <Typography variant="body2">
                    您正在使用14天Pro免费试用，可以体验所有高级功能。
                    试用期还剩 {daysRemaining} 天，随时可以升级到正式版本。
                  </Typography>
                </Box>
              </Alert>
            )}

            <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
              <Button
                variant="contained"
                startIcon={<UpgradeIcon />}
                onClick={() => {
                  // Navigate to pricing page
                  window.location.href = '/pricing';
                }}
                disabled={loading}
                color={isTrialExpiring ? "warning" : "primary"}
                size={isTrial ? "large" : "medium"}
              >
                {isTrial ? (isTrialExpiring ? '立即升级避免中断' : '升级到正式版') : '更改套餐'}
              </Button>
              
              {!isTrial && (
                <Button
                  variant="outlined"
                  onClick={() => {
                    // Navigate to subscription management
                    window.location.href = '/subscription/manage';
                  }}
                  disabled={loading}
                >
                  管理订阅
                </Button>
              )}

              {isTrial && (
                <Button
                  variant="outlined"
                  onClick={() => {
                    // Show trial benefits or FAQ
                    window.open('/pricing#faq', '_blank');
                  }}
                  disabled={loading}
                >
                  了解试用详情
                </Button>
              )}
            </Box>
          </>
        ) : (
          <>
            <Alert severity="info" sx={{ mb: 3 }}>
              您当前没有订阅任何套餐。选择一个套餐开始使用我们的服务。
            </Alert>
            
            <Button
              variant="contained"
              size="large"
              onClick={() => {
                window.location.href = '/pricing';
              }}
              sx={{ width: '100%' }}
            >
              查看套餐
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default SubscriptionManagement;