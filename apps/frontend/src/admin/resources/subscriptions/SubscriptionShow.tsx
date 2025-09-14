import React from 'react';
import {
  Show,
  SimpleShowLayout,
  TextField,
  DateField,
  NumberField,
  BooleanField,
  ReferenceField,
  TabbedShowLayout,
  Tab,
  useRecordContext,
  RichTextField,
} from 'react-admin';
import { Box, Typography, Chip, Divider, Paper } from '@mui/material';
import { Grid } from '@mui/material';
import { Payments, History, TrendingUp, Person, Star } from '@mui/icons-material';

/**
 * Subscription features component
 */
const SubscriptionFeatures: React.FC = () => {
  const record = useRecordContext();
  if (!record) return null as any;
  
  return (
    <Grid container spacing={2} sx={{ mt: 2 }}>
      <Grid item xs={12} md={6}>
        <Paper sx={{ p: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            功能列表
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {record?.features?.map((feature: string, index: number) => (
              <Chip
                key={index}
                label={feature}
                size="small"
                variant="outlined"
              />
            ))}
          </Box>
        </Paper>
      </Grid>
      
      <Grid item xs={12} md={6}>
        <Paper sx={{ p: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            元数据
          </Typography>
          {record?.metadata && typeof record.metadata === 'object' && (
            <Box sx={{ fontSize: '0.875rem' }}>
              {Object.entries(record.metadata).map(([key, value]: any) => (
                <Box key={key} sx={{ mb: 1 }}>
                  <strong>{key}:</strong> {String(value)}
                </Box>
              ))}
            </Box>
          )}
        </Paper>
      </Grid>
    </Grid>
  );
};

/**
 * Subscription payments component
 */
const SubscriptionPayments: React.FC = () => {
  const record = useRecordContext();
  if (!record) return null as any;
  
  return (
    <React.Fragment>
      {record?.payments?.length > 0 ? (
        <Box sx={{ width: '100%' }}>
          {record.payments.map((payment: any, index: number) => (
            <Paper key={index} sx={{ p: 2, mb: 2 }}>
              <Grid container spacing={2}>
                <Grid item xs={12} md={3}>
                  <Typography variant="subtitle2">支付ID</Typography>
                  <Typography variant="body2">{payment.id}</Typography>
                </Grid>
                <Grid item xs={12} md={3}>
                  <Typography variant="subtitle2">金额</Typography>
                  <Typography variant="body2">{payment.amount} {payment.currency}</Typography>
                </Grid>
                <Grid item xs={12} md={3}>
                  <Typography variant="subtitle2">状态</Typography>
                  <Typography variant="body2">{payment.status}</Typography>
                </Grid>
                <Grid item xs={12} md={3}>
                  <Typography variant="subtitle2">时间</Typography>
                  <Typography variant="body2">{new Date(payment.createdAt).toLocaleString()}</Typography>
                </Grid>
              </Grid>
            </Paper>
          ))}
        </Box>
      ) : (
        <Typography variant="body2" color="text.secondary">
          暂无支付记录
        </Typography>
      )}
    </React.Fragment>
  );
};

/**
 * Subscription status component
 */
const SubscriptionStatus: React.FC = () => {
  const record = useRecordContext();
  if (!record) return null as any;
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'success';
      case 'trial': return 'info';
      case 'cancelled': return 'warning';
      case 'expired': return 'error';
      default: return 'default';
    }
  };
  
  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active': return '激活';
      case 'trial': return '试用';
      case 'cancelled': return '已取消';
      case 'expired': return '已过期';
      case 'inactive': return '未激活';
      default: return status;
    }
  };
  
  return (
    <Chip
      icon={<Star />}
      label={getStatusLabel(record.status)}
      color={getStatusColor(record.status) as any}
      size="medium"
    />
  );
};

/**
 * Usage progress component
 */
const UsageProgress: React.FC = () => {
  const record = useRecordContext();
  if (!record) return null as any;
  
  const usagePercentage = record.usageLimit > 0 
    ? Math.round((record.usageCount / record.usageLimit) * 100)
    : 0;
  
  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="body2">使用情况</Typography>
        <Typography variant="body2" color="text.secondary">
          {record.usageCount} / {record.usageLimit || '无限制'}
        </Typography>
      </Box>
      <Box
        sx={{
          width: '100%',
          height: 8,
          backgroundColor: 'grey.200',
          borderRadius: 4,
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            width: `${Math.min(usagePercentage, 100)}%`,
            height: '100%',
            backgroundColor: usagePercentage > 80 ? 'error.main' : 
                             usagePercentage > 60 ? 'warning.main' : 'success.main',
            transition: 'width 0.3s ease',
          }}
        />
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
        已使用 {usagePercentage}%
      </Typography>
    </Box>
  );
};

/**
 * Subscription show component with detailed information
 */
export const SubscriptionShow: React.FC = () => {
  return (
    <Show title="订阅详情">
      <TabbedShowLayout>
        <Tab label="基本信息" icon={<Person />}>
          <SimpleShowLayout>
            <ReferenceField source="userId" reference="users" link="show">
              <TextField source="name" label="用户" />
            </ReferenceField>
            
            <ReferenceField source="planId" reference="plans" link="show">
              <TextField source="name" label="套餐" />
            </ReferenceField>
            
            <SubscriptionStatus />
            
            <DateField source="startDate" label="开始日期" showTime />
            <DateField source="endDate" label="结束日期" showTime />
            <DateField source="nextBillingDate" label="下次计费日期" showTime />
            <DateField source="createdAt" label="创建时间" showTime />
            <DateField source="updatedAt" label="更新时间" showTime />
          </SimpleShowLayout>
        </Tab>
        
        <Tab label="计费信息" icon={<Payments />}>
          <SimpleShowLayout>
            <NumberField
              source="monthlyPrice"
              label="月付价格"
              options={{
                style: 'currency',
                currency: (record: any) => record.currency || 'USD',
              }}
            />
            
            <NumberField
              source="yearlyPrice"
              label="年付价格"
              options={{
                style: 'currency',
                currency: (record: any) => record.currency || 'USD',
              }}
            />
            
            <TextField source="currency" label="币种" />
            <BooleanField source="autoRenew" label="自动续费" />
            
            {/* Stripe 集成已禁用：隐藏 Stripe 相关字段 */}
            {/* <TextField source="stripeSubscriptionId" label="Stripe订阅ID" />
            <TextField source="stripeCustomerId" label="Stripe客户ID" /> */}
          </SimpleShowLayout>
        </Tab>
        
        <Tab label="使用情况" icon={<TrendingUp />}>
          <SimpleShowLayout>
            <UsageProgress />
            <Divider sx={{ my: 2 }} />
            
            <NumberField source="usageCount" label="已使用次数" />
            <NumberField source="usageLimit" label="使用限制" />
            
            <SubscriptionFeatures />
          </SimpleShowLayout>
        </Tab>
        
        {/* 支付集成已禁用：隐藏支付记录标签 */}
        {/* <Tab label="支付记录" icon={<History />}>
          <SimpleShowLayout>
            <SubscriptionPayments />
          </SimpleShowLayout>
        </Tab> */}
      </TabbedShowLayout>
    </Show>
  );
};
