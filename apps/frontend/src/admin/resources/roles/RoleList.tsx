import React from 'react';
import {
  List,
  Datagrid,
  TextField,
  NumberField,
  EditButton,
  useRecordContext,
  ChipField,
} from 'react-admin';
import { 
  Users as UserIcon,
  Shield as AdminIcon,
  Crown as SuperAdminIcon,
} from 'lucide-react';
import { Box, Typography, Chip } from '@mui/material';

/**
 * Role icon component
 */
const RoleIcon: React.FC = () => {
  const record = useRecordContext();
  if (!record) return null as any;
  
  switch (record.name) {
    case 'ADMIN':
      return <AdminIcon className="h-5 w-5" />;
    case 'SUPER_ADMIN':
      return <SuperAdminIcon className="h-5 w-5" />;
    default:
      return <UserIcon className="h-5 w-5" />;
  }
};

/**
 * Role permissions display component
 */
const RolePermissionsField: React.FC = () => {
  const record = useRecordContext();
  if (!record) return null as any;
  
  const permissions = record.permissions || [];
  const displayCount = Math.min(permissions.length, 3);
  
  return (
    <Box sx={{ maxWidth: 300 }}>
      {permissions.slice(0, displayCount).map((permission: string: any) => (
        <Chip 
          key={permission}
          label={permission.split(':')[1]}
          size="small"
          sx={{ mr: 0.5, mb: 0.5 }}
        />
      ))}
      {permissions.length > displayCount && (
        <Typography variant="caption" color="text.secondary">
          +{permissions.length - displayCount} 更多
        </Typography>
      )}
    </Box>
  );
};

/**
 * System role descriptions
 */
const roleDescriptions = {
  USER: {
    name: '普通用户',
    description: '基础功能访问权限',
    defaultPermissions: [
      'siterank:access',
      'batchopen:access',
      'adscenter:access'
    ]
  },
  ADMIN: {
    name: '管理员',
    description: '用户管理和基础系统配置权限',
    defaultPermissions: [
      'users:read',
      'users:edit',
      'subscriptions:read',
      'subscriptions:edit',
      'payments:read',
      'config:read',
      'siterank:access',
      'batchopen:access',
      'adscenter:access',
      'admin:access'
    ]
  },
  SUPER_ADMIN: {
    name: '超级管理员',
    description: '所有系统权限',
    defaultPermissions: [
      'users:read',
      'users:create',
      'users:edit',
      'users:delete',
      'roles:read',
      'roles:edit',
      'subscriptions:read',
      'subscriptions:edit',
      'subscriptions:create',
      'payments:read',
      'payments:refund',
      'config:read',
      'config:edit',
      'env:read',
      'env:edit',
      'tokens:read',
      'tokens:edit',
      'siterank:access',
      'batchopen:access',
      'adscenter:access',
      'admin:access'
    ]
  }
};

/**
 * Role list component
 */
export const RoleList: React.FC = () => {
  return (
    <List 
      title="角色管理"
      exporter={false}
      perPage={10}
      sort={{ field: 'name', order: 'ASC' }}
    >
      <Datagrid rowClick="edit">
        <TextField source="id" label="角色ID" />
        
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <RoleIcon />
          <TextField source="name" label="角色名称" />
        </Box>
        
        <TextField 
          source="description" 
          label="描述" 
          sx={{ maxWidth: 200 }}
        />
        
        <NumberField 
          source="userCount" 
          label="用户数"
          textAlign="center"
        />
        
        <RolePermissionsField />
        
        <ChipField 
          source="status" 
          label="状态"
        />
        
        <EditButton />
      </Datagrid>
    </List>
  );
};