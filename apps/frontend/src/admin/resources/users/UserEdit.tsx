import React from 'react';
import {
  Edit,
  SimpleForm,
  TextInput,
  SelectInput,
  BooleanInput,
  PasswordInput,
  ArrayInput,
  SimpleFormIterator,
  NumberInput,
  DateInput,
  ReferenceInput,
  ReferenceManyField,
  ReferenceField,
  Datagrid,
  TextField,
  DateField,
  BooleanField,
  ChipField,
  required,
  email,
  minLength,
  usePermissions,
  useRecordContext,
  SaveButton,
  Toolbar,
  DeleteButton,
} from 'react-admin';
import { Box, Typography, Divider, Tab, Tabs } from '@mui/material';
import { SubscriptionManager } from '@/admin/components/subscriptions/SubscriptionManager';

/**
 * Role choices for selection
 */
const roleChoices = [
  { id: 'USER', name: 'User' },
  { id: 'ADMIN', name: 'Admin' },
  // SUPER_ADMIN removed
];

/**
 * Permission choices for selection
 */
const permissionChoices = [
  { id: 'users:read', name: 'View Users' },
  { id: 'users:create', name: 'Create Users' },
  { id: 'users:edit', name: 'Edit Users' },
  { id: 'users:delete', name: 'Delete Users' },
  { id: 'admin:access', name: 'Admin Access' },
  { id: 'siterank:access', name: 'SiteRank Access' },
  { id: 'batchopen:access', name: 'BatchOpen Access' },
  { id: 'adscenter:access', name: 'AdsCenter Access' },
];

/**
 * Custom toolbar with conditional delete button
 */
const UserEditToolbar: React.FC = () => {
  const { permissions } = usePermissions();
  const canDelete = permissions?.includes('delete:users');

  return (
    <Toolbar>
      <SaveButton />
      {canDelete && <DeleteButton />}
    </Toolbar>
  );
};

/**
 * User stats component
 */
const UserStats: React.FC = () => {
  const record = useRecordContext();
  if (!record) return null as any;
  
  return (
    <Box sx={{ display: 'flex', gap: 3, mb: 3 }}>
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
          账号状态
        </Typography>
        <Typography variant="h6" color={record.isActive ? 'success.main' : 'error.main'}>
          {record.isActive ? '活跃' : '禁用'}
        </Typography>
      </Box>
    </Box>
  );
};

/**
 * User edit form component with tabbed interface
 */
export const UserEdit: React.FC = () => {
  const { permissions } = usePermissions();
  const canEditRole = permissions?.includes('write:users');
  const canEditTokens = permissions?.includes('edit:tokens');
  const record = useRecordContext();

  return (
    <Edit title="编辑用户">
      <SimpleForm toolbar={<UserEditToolbar />}>
        <Box sx={{ width: '100%' }}>
          <UserStats />
          
          {/* Basic Information */}
          <Typography variant="h6" gutterBottom>
            基本信息
          </Typography>
          
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <TextInput
              source="name"
              validate={[required()]}
              sx={{ flex: 1, minWidth: 250 }}
            />
            
            <TextInput
              source="email"
              type="email"
              validate={[required(), email()]}
              sx={{ flex: 1, minWidth: 250 }}
            />
          </Box>
          
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 2 }}>
            <SelectInput
              source="role"
              choices={roleChoices}
              validate={[required()]}
              disabled={!canEditRole}
              sx={{ flex: 1, minWidth: 200 }}
            />
            
            <SelectInput
              source="status"
              choices={[
                { id: 'ACTIVE', name: '活跃' },
                { id: 'INACTIVE', name: '未激活' },

                { id: 'BANNED', name: '封禁' },
              ]}
              validate={[required()]}
              sx={{ flex: 1, minWidth: 200 }}
            />
          </Box>
          
          <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
            <BooleanInput
              source="emailVerified"
              label="邮箱已验证"
              disabled
            />
          </Box>

          <Divider sx={{ my: 3 }} />

          {/* Token Management */}
          <Typography variant="h6" gutterBottom>
            Token管理
          </Typography>
          
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <NumberInput
              source="tokenBalance"
              label="Token余额"
              disabled={!canEditTokens}
              sx={{ flex: 1, minWidth: 200 }}
            />
            
            <NumberInput
              source="tokenUsedThisMonth"
              label="本月已用Token"
              disabled
              sx={{ flex: 1, minWidth: 200 }}
            />
          </Box>
          
          <Divider sx={{ my: 3 }} />

          {/* Subscription Management */}
          <SubscriptionManager userId={record?.id?.toString() || ''} />

          <Divider sx={{ my: 3 }} />

          {/* Account Information */}
          <Typography variant="h6" gutterBottom>
            账号信息
          </Typography>
          
          {/* Stripe 集成已禁用：隐藏 Stripe 客户ID */}
          {/* <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <TextInput
              source="stripeCustomerId"
              label="Stripe客户ID"
              disabled
              sx={{ flex: 1, minWidth: 300 }}
            />
          </Box> */}
          
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 2 }}>
            <DateInput
              source="createdAt"
              label="注册时间"
              disabled
              sx={{ flex: 1, minWidth: 200 }}
            />
            
            <DateInput
              source="lastLoginAt"
              label="最后登录"
              disabled
              sx={{ flex: 1, minWidth: 200 }}
            />
          </Box>
          
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 2 }}>
            <DateInput
              source="updatedAt"
              label="更新时间"
              disabled
              sx={{ flex: 1, minWidth: 200 }}
            />
          </Box>
        </Box>
      </SimpleForm>
    </Edit>
  );
};
