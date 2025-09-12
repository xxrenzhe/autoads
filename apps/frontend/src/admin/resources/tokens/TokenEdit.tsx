import React from 'react';
import {
  Edit,
  SimpleForm,
  TextInput,
  NumberInput,
  SelectInput,
  BooleanInput,
  DateInput,
  useRecordContext,
  TabbedForm,
  FormTab,
  required,
} from 'react-admin';
import { Box, Typography, Divider } from '@mui/material';

const tokenResetOptions = [
  { id: 'manual', name: '手动重置' },
  { id: 'monthly', name: '每月重置' },
  { id: 'weekly', name: '每周重置' },
  { id: 'daily', name: '每日重置' },
];

const TokenStats: React.FC = () => {
  const record = useRecordContext();
  if (!record) return null as any;
  
  return (
    <Box sx={{ display: 'flex', gap: 3, mb: 2 }}>
      <Box>
        <Typography variant="caption" color="text.secondary">
          Token余额
        </Typography>
        <Typography variant="h6">
          {record.tokenBalance}
        </Typography>
      </Box>
      <Box>
        <Typography variant="caption" color="text.secondary">
          本月已用
        </Typography>
        <Typography variant="h6">
          {record.tokenUsedThisMonth}
        </Typography>
      </Box>
      <Box>
        <Typography variant="caption" color="text.secondary">
          今日已用
        </Typography>
        <Typography variant="h6">
          {record.tokenUsedToday || 0}
        </Typography>
      </Box>
      <Box>
        <Typography variant="caption" color="text.secondary">
          使用率
        </Typography>
        <Typography variant="h6" color={
          (record.tokenUsedThisMonth / (record.tokenUsedThisMonth + record.tokenBalance) * 100) > 80 
            ? 'error.main' 
            : 'success.main'
        }>
          {((record.tokenUsedThisMonth / (record.tokenUsedThisMonth + record.tokenBalance)) * 100).toFixed(1)}%
        </Typography>
      </Box>
    </Box>
  );
};

export const TokenEdit: React.FC = () => {
  return (
    <Edit title="编辑Token配额">
      <TabbedForm>
        <FormTab label="基本信息">
          <TokenStats />
          
          <NumberInput
            source="tokenBalance"
            label="Token余额"
            validate={[required()]}
            min={0}
            helperText="用户当前可用的Token数量"
            fullWidth
          />
          
          <NumberInput
            source="tokenUsedThisMonth"
            label="本月已用Token"
            disabled
            helperText="用户本月已使用的Token数量"
            fullWidth
          />
          
          <DateInput
            source="lastTokenReset"
            label="最后重置时间"
            disabled
            helperText="上次Token重置的时间"
            fullWidth
          />
        </FormTab>
        
        <FormTab label="调整Token">
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            在此调整用户的Token余额
          </Typography>
          
          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <TextInput
              source="adjustmentAmount"
              label="调整数量"
              type="number"
              helperText="正数表示增加，负数表示减少"
              defaultValue={0}
            />
            <SelectInput
              source="adjustmentReason"
              choices={[
                { id: 'purchase', name: '购买' },
                { id: 'bonus', name: '奖励' },
                { id: 'penalty', name: '扣减' },
                { id: 'refund', name: '退款' },
                { id: 'adjustment', name: '手动调整' },
              ]}
              label="调整原因"
              defaultValue="adjustment"
            />
          </Box>
          
          <TextInput
            source="adjustmentNote"
            label="调整说明"
            multiline
            rows={3}
            helperText="请说明调整Token的原因"
            fullWidth
          />
        </FormTab>
        
        <FormTab label="重置设置">
          <SelectInput
            source="tokenResetType"
            choices={tokenResetOptions}
            label="Token重置周期"
            helperText="选择Token的重置周期"
            fullWidth
          />
          
          <BooleanInput
            source="autoResetEnabled"
            label="启用自动重置"
            defaultValue={true}
            helperText="是否在指定周期自动重置Token"
          />
          
          <DateInput
            source="nextResetDate"
            label="下次重置日期"
            helperText="下次自动重置Token的日期"
            fullWidth
          />
          
          <NumberInput
            source="monthlyTokenQuota"
            label="每月Token配额"
            min={0}
            helperText="每月自动重置时给予的Token数量"
            fullWidth
          />
        </FormTab>
        
        <FormTab label="使用记录">
          <Typography variant="body2" color="text.secondary">
            Token使用记录（最近30天）
          </Typography>
          {/* 这里可以添加Token使用记录的表格 */}
          <Typography variant="body2" sx={{ mt: 2 }}>
            功能开发中...
          </Typography>
        </FormTab>
      </TabbedForm>
    </Edit>
  );
};