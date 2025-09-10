import React from 'react';
import {
  Edit,
  SimpleForm,
  TextInput,
  NumberInput,
  SelectInput,
  ReferenceInput,
  DateInput,
  BooleanInput,
  useRecordContext,
} from 'react-admin';
import { Box, Typography, Divider } from '@mui/material';

const statusChoices = [
  { id: 'PENDING', name: '待处理' },
  { id: 'COMPLETED', name: '已完成' },
  { id: 'FAILED', name: '失败' },
  { id: 'REFUNDED', name: '已退款' },
];

const providerChoices = [
  { id: 'stripe', name: 'Stripe' },
  { id: 'paypal', name: 'PayPal' },
  { id: 'alipay', name: '支付宝' },
  { id: 'wechat', name: '微信支付' },
];

const TokenPurchaseEditActions: React.FC = () => {
  const record = useRecordContext();
  
  if (!record) return null as any;

  return (
    <Box sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 1, mb: 2 }}>
      <Typography variant="h6" gutterBottom>
        订单详情
      </Typography>
      <Typography variant="body2" color="textSecondary">
        订单ID: {record.id}
      </Typography>
      <Typography variant="body2" color="textSecondary">
        支付渠道ID: {record.providerId || 'N/A'}
      </Typography>
    </Box>
  );
};

export const TokenPurchaseEdit: React.FC = () => {
  return (
    <Edit title="编辑Token购买记录">
      <TokenPurchaseEditActions />
      <SimpleForm>
        <ReferenceInput
          source="userId"
          reference="users"
          label="用户"
          disabled
        >
          <SelectInput optionText="email" />
        </ReferenceInput>
        
        <NumberInput
          source="tokens"
          label="Token数量"
          disabled
        />
        
        <NumberInput
          source="amount"
          label="金额"
          disabled
        />
        
        <TextInput
          source="currency"
          label="币种"
          disabled
        />
        
        <SelectInput
          source="status"
          choices={statusChoices}
          label="状态"
          helperText="管理员可以手动更新状态"
        />
        
        <SelectInput
          source="provider"
          choices={providerChoices}
          label="支付渠道"
          disabled
        />
        
        <TextInput
          source="providerId"
          label="支付渠道订单ID"
          disabled
        />
        
        <DateInput
          source="createdAt"
          label="创建时间"
          disabled
        />
        
        <DateInput
          source="updatedAt"
          label="更新时间"
          disabled
        />
        
        <Divider sx={{ my: 2 }} />
        
        <Typography variant="h6" gutterBottom>
          元数据
        </Typography>
        
        <TextInput
          source="metadata"
          label="元数据 (JSON)"
          multiline
          rows={4}
          disabled
          fullWidth
        />
      </SimpleForm>
    </Edit>
  );
};