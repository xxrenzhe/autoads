import React from 'react';
import {
  Edit,
  SimpleForm,
  TextInput,
  SelectInput,
  ArrayInput,
  SimpleFormIterator,
  BooleanInput,
  TabbedForm,
  FormTab,
  useRecordContext,
  required,
} from 'react-admin';
import { Box, Typography, Divider, Chip } from '@mui/material';

/**
 * Permission categories for organization
 */
const permissionCategories = [
  {
    title: '用户管理',
    permissions: [
      { id: 'users:read', name: '查看用户', description: '查看用户列表和详情' },
      { id: 'users:create', name: '创建用户', description: '创建新用户账号' },
      { id: 'users:edit', name: '编辑用户', description: '修改用户信息' },
      { id: 'users:delete', name: '删除用户', description: '删除用户账号' },
    ]
  },
  {
    title: '角色管理',
    permissions: [
      { id: 'roles:read', name: '查看角色', description: '查看角色配置' },
      { id: 'roles:edit', name: '编辑角色', description: '修改角色权限' },
    ]
  },
  {
    title: '订阅管理',
    permissions: [
      { id: 'subscriptions:read', name: '查看订阅', description: '查看订阅信息' },
      { id: 'subscriptions:edit', name: '编辑订阅', description: '修改订阅状态' },
      { id: 'subscriptions:create', name: '创建订阅', description: '为用户创建订阅' },
    ]
  },
  {
    title: '支付管理',
    permissions: [
      { id: 'payments:read', name: '查看支付', description: '查看支付记录' },
      { id: 'payments:refund', name: '退款处理', description: '处理退款请求' },
    ]
  },
  {
    title: '系统配置',
    permissions: [
      { id: 'config:read', name: '查看配置', description: '查看系统配置' },
      { id: 'config:edit', name: '编辑配置', description: '修改系统配置' },
      { id: 'env:read', name: '查看环境变量', description: '查看环境变量配置' },
      { id: 'env:edit', name: '编辑环境变量', description: '修改环境变量' },
    ]
  },
  {
    title: '功能访问',
    permissions: [
      { id: 'siterank:access', name: 'SiteRank访问', description: '使用SiteRank功能' },
      { id: 'batchopen:access', name: 'BatchOpen访问', description: '使用BatchOpen功能' },
      { id: 'adscenter:access', name: 'ChangeLink访问', description: '使用ChangeLink功能' },
      { id: 'admin:access', name: '后台管理', description: '访问后台管理系统' },
    ]
  },
  {
    title: 'Token管理',
    permissions: [
      { id: 'tokens:read', name: '查看Token', description: '查看Token使用情况' },
      { id: 'tokens:edit', name: '编辑Token', description: '调整用户Token配额' },
    ]
  },
];

/**
 * Role permissions component
 */
const RolePermissions: React.FC = () => {
  const record = useRecordContext();
  if (!record) return null as any;
  
  // Get current permissions from record
  const currentPermissions = record.permissions || [];
  
  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        选择此角色可以访问的权限
      </Typography>
      
      {permissionCategories.map((category: any) => (
        <Box key={category.title} sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            {category.title}
          </Typography>
          
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {category.permissions.map((permission: any) => (
              <BooleanInput
                key={permission.id}
                source={`permissions.${permission.id}`}
                label={permission.name}
                defaultValue={currentPermissions.includes(permission.id)}
                helperText={permission.description}
                sx={{ 
                  width: 'calc(50% - 8px)',
                  '& .MuiFormControlLabel-root': { alignItems: 'flex-start' },
                  '& .MuiFormControlLabel-label': { fontSize: '0.875rem' }
                }}
              />
            ))}
          </Box>
          
          <Divider sx={{ my: 2 }} />
        </Box>
      ))}
    </Box>
  );
};

/**
 * Role info component
 */
const RoleInfo: React.FC = () => {
  const record = useRecordContext();
  if (!record) return null as any;
  
  const userCount = record.userCount || 0;
  
  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        角色基本信息
      </Typography>
      
      <TextInput
        source="name"
        label="角色名称"
        validate={[required()]}
        fullWidth
        disabled
      />
      
      <TextInput
        source="description"
        label="角色描述"
        multiline
        rows={3}
        fullWidth
      />
      
      <Box sx={{ mt: 2 }}>
        <Typography variant="body2">
          当前使用此角色的用户数: <Chip label={userCount} size="small" />
        </Typography>
      </Box>
    </Box>
  );
};

/**
 * Role edit component
 */
export const RoleEdit: React.FC = () => {
  return (
    <Edit title="编辑角色">
      <TabbedForm>
        <FormTab label="基本信息">
          <RoleInfo />
        </FormTab>
        
        <FormTab label="权限配置">
          <RolePermissions />
        </FormTab>
      </TabbedForm>
    </Edit>
  );
};