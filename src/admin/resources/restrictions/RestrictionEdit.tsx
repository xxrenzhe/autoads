import React from 'react';
import {
  Edit,
  SimpleForm,
  TextInput,
  SelectInput,
  BooleanInput,
  DateTimeInput,
  ReferenceInput,
  AutocompleteInput,
  useRecordContext,
  useNotify,
  useRedirect,
  usePermissions,
} from 'react-admin';
import { Box, Typography, Alert, AlertTitle } from '@mui/material';
import { Block as BlockIcon, Check as CheckIcon } from '@mui/icons-material';

/**
 * Restriction title component
 */
const RestrictionTitle = () => {
  const record = useRecordContext();
  if (!record) return null as any;
  return (
    <span>
      用户限制: {record.user?.email} - {record.type}
    </span>
  );
};

/**
 * Restriction type choices
 */
const restrictionTypeChoices = [
  { id: 'API_LIMIT', name: 'API限制 - 限制API调用频率' },
  { id: 'BATCH_LIMIT', name: '批量操作限制 - 限制批量操作数量' },
  { id: 'ACCOUNT_SUSPEND', name: '账户暂停 - 暂停账户所有功能' },
  { id: 'LOGIN_BLOCK', name: '登录阻止 - 阻止用户登录' },
  { id: 'FEATURE_ACCESS', name: '功能访问限制 - 限制特定功能使用' },
];

/**
 * User Restriction Edit Component
 */
export const RestrictionEdit = () => {
  const notify = useNotify();
  const redirect = useRedirect();
  const { permissions } = usePermissions();
  const record = useRecordContext();

  const onSuccess = () => {
    notify('用户限制已更新', { type: 'success' });
    redirect('list', 'restrictions');
  };

  const onError = (error: any) => {
    notify(`更新失败: ${error.message}`, { type: 'error' });
  };

  if (!record) return null as any;

  return (
    <Edit
      title={<RestrictionTitle />}
      mutationOptions={{ onSuccess, onError }}
      mutationMode="pessimistic"
    >
      <SimpleForm>
        <Box sx={{ p: 2, width: '100%' }}>
          <Typography variant="h6" gutterBottom>
            用户限制信息
          </Typography>
          
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 2 }}>
            <ReferenceInput
              source="userId"
              reference="users"
              disabled
            >
              <AutocompleteInput
                optionText="email"
                label="用户"
                disabled
              />
            </ReferenceInput>
            
            <SelectInput
              source="type"
              choices={restrictionTypeChoices}
              disabled
              label="限制类型"
            />
          </Box>

          <TextInput
            source="reason"
            label="限制原因"
            fullWidth
            multiline
            rows={3}
            helperText="请说明限制的具体原因"
          />

          <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
            限制状态
          </Typography>

          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 2 }}>
            <BooleanInput
              source="isActive"
              label="是否活跃"
              helperText="取消勾选将立即解除限制"
            />
            
            <DateTimeInput
              source="expiresAt"
              label="过期时间"
              helperText="限制将在此时间后自动解除"
            />
          </Box>

          {!record.isActive && (
            <Alert severity="info" sx={{ mb: 2 }}>
              <AlertTitle>限制已解除</AlertTitle>
              此限制已被标记为非活跃状态，用户不再受此限制影响。
            </Alert>
          )}

          {record.isActive && new Date(record.expiresAt) < new Date() && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              <AlertTitle>限制已过期</AlertTitle>
              此限制已过期，但仍在活跃状态。建议解除或更新过期时间。
            </Alert>
          )}

          {permissions === 'SUPER_ADMIN' && (
            <Alert severity="error" sx={{ mt: 2 }}>
              <AlertTitle>超级管理员权限</AlertTitle>
              作为超级管理员，您可以修改任何限制设置。请谨慎操作。
            </Alert>
          )}
        </Box>
      </SimpleForm>
    </Edit>
  );
};