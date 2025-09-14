import React from 'react';
import {
  Edit,
  SimpleForm,
  TextInput,
  NumberInput,
  SelectInput,
  BooleanInput,
  ReferenceInput,
  required,
  useRecordContext,
} from 'react-admin';
import { Box, Typography, Divider, Alert } from '@mui/material';
import { Info } from '@mui/icons-material';

/**
 * Rate limit edit component
 */
export const RateLimitEdit: React.FC = () => {
  const record = useRecordContext();
  
  return (
    <Edit title="编辑限速配置">
      <SimpleForm>
        <Box sx={{ width: '100%', maxWidth: 600 }}>
          <Alert severity="info" sx={{ mb: 3 }}>
            <Typography variant="body2">
              限速配置用于控制不同功能的使用频率，防止滥用和确保系统稳定性。
            </Typography>
          </Alert>
          
          {/* 基本信息 */}
          <Typography variant="h6" gutterBottom>
            基本信息
          </Typography>
          
          <TextInput
            source="id"
            label="配置ID"
            disabled
            fullWidth
          />
          
          <SelectInput
            source="type"
            label="限速类型"
            choices={[
              { id: 'api', name: 'API调用' },
              { id: 'siterank', name: 'SiteRank查询' },
              { id: 'batchopen', name: 'BatchOpen任务' },
              { id: 'adscenter', name: 'AdsCenter活动' },
              { id: 'upload', name: '文件上传' },
              { id: 'export', name: '数据导出' },
            ]}
            validate={[required()]}
            fullWidth
          />
          
          <SelectInput
            source="scope"
            label="作用域"
            choices={[
              { id: 'global', name: '全局 - 所有用户' },
              { id: 'user', name: '用户级别 - 特定用户' },
              { id: 'plan', name: '套餐级别 - 特定套餐用户' },
            ]}
            validate={[required()]}
            fullWidth
          />
          
          {/* 根据作用域显示不同的目标选择器 */}
          {record?.scope === 'user' && (
            <ReferenceInput
              source="target"
              reference="users"
              label="目标用户"
              fullWidth
            />
          )}
          
          {record?.scope === 'plan' && (
            <ReferenceInput
              source="target"
              reference="plans"
              label="目标套餐"
              fullWidth
            />
          )}
          
          {record?.scope === 'global' && (
            <TextInput
              source="target"
              label="目标标识"
              helperText="全局限速可填 * 或特定功能标识"
              defaultValue="*"
              fullWidth
            />
          )}
          
          <Divider sx={{ my: 3 }} />
          
          {/* 限速配置 */}
          <Typography variant="h6" gutterBottom>
            限速配置
          </Typography>
          
          <Box sx={{ display: 'flex', gap: 2 }}>
            <NumberInput
              source="requestsPerWindow"
              label="请求数量"
              validate={[required()]}
              min={1}
              helperText="时间窗口内允许的请求数"
              sx={{ flex: 1 }}
            />
            
            <SelectInput
              source="windowSize"
              label="时间窗口"
              choices={[
                { id: '1m', name: '1分钟' },
                { id: '5m', name: '5分钟' },
                { id: '15m', name: '15分钟' },
                { id: '30m', name: '30分钟' },
                { id: '1h', name: '1小时' },
                { id: '6h', name: '6小时' },
                { id: '1d', name: '1天' },
              ]}
              validate={[required()]}
              defaultValue="1h"
              sx={{ flex: 1 }}
            />
          </Box>
          
          <NumberInput
            source="burstLimit"
            label="突发限制"
            helperText="短时间内允许的最大请求数（可选）"
            min={1}
            defaultValue={0}
            fullWidth
          />
          
          <Divider sx={{ my: 3 }} />
          
          {/* 高级配置 */}
          <Typography variant="h6" gutterBottom>
            高级配置
          </Typography>
          
          <SelectInput
            source="action"
            label="超出限制时的动作"
            choices={[
              { id: 'reject', name: '拒绝请求' },
              { id: 'queue', name: '排队处理' },
              { id: 'delay', name: '延迟响应' },
              { id: 'notify', name: '仅记录并通知' },
            ]}
            defaultValue="reject"
            fullWidth
          />
          
          <NumberInput
            source="penaltyTime"
            label="惩罚时间（分钟）"
            helperText="连续超出限制后的惩罚时间"
            min={0}
            defaultValue={0}
            fullWidth
          />
          
          <TextInput
            source="errorMessage"
            label="错误消息"
            helperText="超出限制时返回的错误信息"
            defaultValue="请求过于频繁，请稍后再试"
            fullWidth
          />
          
          <Divider sx={{ my: 3 }} />
          
          {/* 状态设置 */}
          <Typography variant="h6" gutterBottom>
            状态设置
          </Typography>
          
          <BooleanInput
            source="isActive"
            label="启用此限速配置"
            defaultValue={true}
          />
          
          <TextInput
            source="description"
            label="描述"
            multiline
            rows={3}
            helperText="配置描述，便于管理"
            fullWidth
          />
        </Box>
      </SimpleForm>
    </Edit>
  );
};
