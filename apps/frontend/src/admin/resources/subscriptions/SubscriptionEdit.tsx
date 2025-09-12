import React from 'react';
import {
  Edit,
  SimpleForm,
  TextInput,
  DateInput,
  NumberInput,
  SelectInput,
  BooleanInput,
  ReferenceInput,
  ArrayInput,
  SimpleFormIterator,
  required,
  useRecordContext,
  useNotify,
  useRedirect,
  useRefresh,
} from 'react-admin';
import { Box, Typography, Divider, Alert, Tab, Tabs } from '@mui/material';
import { Card, CardContent } from '@mui/material';
import { Grid } from '@mui/material';
import { Payments, History, TrendingUp } from '@mui/icons-material';

const statusChoices = [
  { id: 'active', name: '激活' },
  { id: 'inactive', name: '未激活' },
  { id: 'cancelled', name: '已取消' },
  { id: 'expired', name: '已过期' },
  { id: 'trial', name: '试用' },
];

const currencyChoices = [
  { id: 'USD', name: '美元' },
  { id: 'CNY', name: '人民币' },
  { id: 'EUR', name: '欧元' },
];

/**
 * Subscription edit component with full management capabilities
 */
export const SubscriptionEdit: React.FC = () => {
  const record = useRecordContext();
  
  return (
    <Edit title="编辑订阅">
      <SimpleForm>
        <Box sx={{ width: '100%', maxWidth: 1200 }}>
          <Alert severity="info" sx={{ mb: 3 }}>
            <Typography variant="body2">
              订阅管理 - 创建、续费、取消和升级用户订阅
            </Typography>
          </Alert>
          
          {/* 基本信息 */}
          <Typography variant="h6" gutterBottom>
            基本信息
          </Typography>
          
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <ReferenceInput
                source="userId"
                reference="users"
                label="用户"
                validate={required() as any}
                fullWidth
              />
            </Grid>
            
            <Grid size={{ xs: 12, md: 6 }}>
              <ReferenceInput
                source="planId"
                reference="plans"
                label="套餐"
                validate={required() as any}
                fullWidth
              />
            </Grid>
            
            <Grid size={{ xs: 12, md: 4 }}>
              <SelectInput
                source="status"
                label="状态"
                choices={statusChoices}
                validate={required() as any}
                fullWidth
              />
            </Grid>
            
            <Grid size={{ xs: 12, md: 4 }}>
              <TextInput
                source="stripeSubscriptionId"
                label="Stripe订阅ID"
                helperText="Stripe系统中的订阅ID"
                fullWidth
              />
            </Grid>
            
            <Grid size={{ xs: 12, md: 4 }}>
              <TextInput
                source="stripeCustomerId"
                label="Stripe客户ID"
                helperText="Stripe系统中的客户ID"
                fullWidth
              />
            </Grid>
          </Grid>
          
          <Divider sx={{ my: 3 }} />
          
          {/* 计费信息 */}
          <Typography variant="h6" gutterBottom>
            计费信息
          </Typography>
          
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 4 }}>
              <NumberInput
                source="monthlyPrice"
                label="月付价格"
                validate={required() as any}
                min={0}
                step={0.01}
                fullWidth
              />
            </Grid>
            
            <Grid size={{ xs: 12, md: 4 }}>
              <NumberInput
                source="yearlyPrice"
                label="年付价格"
                min={0}
                step={0.01}
                fullWidth
              />
            </Grid>
            
            <Grid size={{ xs: 12, md: 4 }}>
              <SelectInput
                source="currency"
                label="币种"
                choices={currencyChoices}
                defaultValue="USD"
                validate={required() as any}
                fullWidth
              />
            </Grid>
          </Grid>
          
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid size={{ xs: 12, md: 4 }}>
              <DateInput
                source="startDate"
                label="开始日期"
                validate={required() as any}
                fullWidth
              />
            </Grid>
            
            <Grid size={{ xs: 12, md: 4 }}>
              <DateInput
                source="endDate"
                label="结束日期"
                fullWidth
              />
            </Grid>
            
            <Grid size={{ xs: 12, md: 4 }}>
              <DateInput
                source="nextBillingDate"
                label="下次计费日期"
                fullWidth
              />
            </Grid>
          </Grid>
          
          <Divider sx={{ my: 3 }} />
          
          {/* 使用限制 */}
          <Typography variant="h6" gutterBottom>
            使用限制
          </Typography>
          
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <NumberInput
                source="usageLimit"
                label="使用限制"
                helperText="总使用次数限制"
                min={0}
                fullWidth
              />
            </Grid>
            
            <Grid size={{ xs: 12, md: 6 }}>
              <NumberInput
                source="usageCount"
                label="已使用次数"
                helperText="当前已使用的次数"
                min={0}
                fullWidth
              />
            </Grid>
          </Grid>
          
          <Divider sx={{ my: 3 }} />
          
          {/* 功能配置 */}
          <Typography variant="h6" gutterBottom>
            功能配置
          </Typography>
          
          <ArrayInput 
            source="features" 
            label="包含功能"
            helperText="此订阅包含的功能列表"
          >
            <SimpleFormIterator>
              <TextInput
                source="name"
                label="功能名称"
                validate={required() as any}
                fullWidth
              />
            </SimpleFormIterator>
          </ArrayInput>
          
          <Divider sx={{ my: 3 }} />
          
          {/* 其他设置 */}
          <Typography variant="h6" gutterBottom>
            其他设置
          </Typography>
          
          <BooleanInput
            source="autoRenew"
            label="自动续费"
            defaultValue={true}
          />
          
          <TextInput
            source="metadata.notes"
            label="备注"
            multiline
            rows={3}
            helperText="订阅相关备注信息"
            fullWidth
          />
        </Box>
      </SimpleForm>
    </Edit>
  );
};