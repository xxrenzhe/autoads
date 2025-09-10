import React from 'react';
import {
  Create,
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
  useNotify,
  useRedirect,
  useRefresh,
} from 'react-admin';
import { Box, Typography, Divider, Alert } from '@mui/material';
import { Card, CardContent, Grid } from '@mui/material';
import { Add } from '@mui/icons-material';

const statusChoices = [
  { id: 'active', name: '激活' },
  { id: 'inactive', name: '未激活' },
  { id: 'trial', name: '试用' },
];

const currencyChoices = [
  { id: 'USD', name: '美元' },
  { id: 'CNY', name: '人民币' },
  { id: 'EUR', name: '欧元' },
];

const defaultFeatures = [
  'siterank',
  'batchopen',
  'adscenter',
  'api_access',
];

/**
 * Subscription create component
 */
export const SubscriptionCreate: React.FC = () => {
  const notify = useNotify();
  const redirect = useRedirect();
  const refresh = useRefresh();

  const onSuccess = (data: any) => {
    notify('订阅创建成功');
    redirect('show', 'subscriptions', data.id);
    refresh();
  };

  return (
    <Create title="创建订阅" mutationOptions={{ onSuccess }}>
      <SimpleForm>
        <Box sx={{ width: '100%', maxWidth: 1200 }}>
          <Alert severity="info" sx={{ mb: 3 }}>
            <Typography variant="body2">
              为用户创建新订阅 - 选择用户和套餐，配置订阅参数
            </Typography>
          </Alert>
          
          {/* 基本信息 */}
          <Typography variant="h6" gutterBottom>
            基本信息
          </Typography>
          
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
            <ReferenceInput
              source="userId"
              reference="users"
              label="用户"
              fullWidth
              helperText="选择要订阅的用户"
            />
            
            <ReferenceInput
              source="planId"
              reference="plans"
              label="套餐"
              fullWidth
              helperText="选择订阅的套餐"
            />
          </Box>
          
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' }, gap: 2, mt: 2 }}>
            <SelectInput
              source="status"
              label="初始状态"
              choices={statusChoices}
              defaultValue="active"
              fullWidth
            />
            
            <TextInput
              source="stripeSubscriptionId"
              label="Stripe订阅ID"
              helperText="可选：关联Stripe订阅ID"
              fullWidth
              />
          </Box>
          
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' }, gap: 2, mt: 2 }}>
            <TextInput
              source="stripeCustomerId"
              label="Stripe客户ID"
              helperText="可选：关联Stripe客户ID"
              fullWidth
            />
          </Box>
          
          <Divider sx={{ my: 3 }} />
          
          {/* 计费信息 */}
          <Typography variant="h6" gutterBottom>
            计费信息
          </Typography>
          
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' }, gap: 2 }}>
              <NumberInput
                source="monthlyPrice"
                label="月付价格"
                min={0}
                step={0.01}
                defaultValue={0}
                fullWidth
              />
              
              <NumberInput
                source="yearlyPrice"
                label="年付价格"
                min={0}
                step={0.01}
                defaultValue={0}
                fullWidth
              />
              
              <SelectInput
                source="currency"
                label="币种"
                choices={currencyChoices}
                defaultValue="USD"
                fullWidth
              />
            </Box>
            
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' }, gap: 2, mt: 2 }}>
              <DateInput
                source="startDate"
                label="开始日期"
                defaultValue={new Date()}
                fullWidth
              />
              
              <DateInput
                source="endDate"
                label="结束日期"
                defaultValue={new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)}
                fullWidth
              />
              
              <DateInput
                source="nextBillingDate"
                label="下次计费日期"
                defaultValue={new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)}
                fullWidth
              />
            </Box>
          
          <Divider sx={{ my: 3 }} />
          
          {/* 使用限制 */}
          <Typography variant="h6" gutterBottom>
            使用限制
          </Typography>
          
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
              <NumberInput
                source="usageLimit"
                label="使用限制"
                helperText="总使用次数限制，0表示无限制"
                min={0}
                defaultValue={0}
                fullWidth
              />
              
              <NumberInput
                source="usageCount"
                label="初始使用次数"
                helperText="已使用的次数，默认为0"
                min={0}
                defaultValue={0}
                fullWidth
              />
            </Box>
          
          <Divider sx={{ my: 3 }} />
          
          {/* 功能配置 */}
          <Typography variant="h6" gutterBottom>
            功能配置
          </Typography>
          
          <ArrayInput 
            source="features" 
            label="包含功能"
            defaultValue={defaultFeatures}
            helperText="此订阅包含的功能列表"
          >
            <SimpleFormIterator>
              <TextInput
                source="name"
                label="功能名称"
                validate={[required()]}
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
    </Create>
  );
};