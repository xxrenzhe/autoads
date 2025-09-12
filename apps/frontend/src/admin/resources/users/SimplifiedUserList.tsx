import React from 'react';
import {
  List,
  Datagrid,
  TextField,
  EmailField,
  DateField,
  NumberField,
  EditButton,
  FilterButton,
  CreateButton,
  ExportButton,
  BulkExportButton,
  TopToolbar,
  SearchInput,
  SelectInput,
} from 'react-admin';
import { Chip, Box, Typography } from '@mui/material';
import { useUserPermissions } from '../../hooks/useUserPermissions';

/**
 * Simplified user list filters - only essential filters
 */
const simplifiedUserFilters = [
  <SearchInput key="search" source="q" alwaysOn placeholder="搜索用户姓名或邮箱" />,
  <SelectInput
    key="role"
    source="role"
    choices={[
      { id: 'USER', name: '普通用户' },
      { id: 'ADMIN', name: '管理员' },
      { id: 'SUPER_ADMIN', name: '超级管理员' },
    ]}
    label="角色"
  />,
  <SelectInput
    key="status"
    source="status"
    choices={[
      { id: 'ACTIVE', name: '活跃' },
      { id: 'INACTIVE', name: '未激活' },
      { id: 'BANNED', name: '封禁' },
    ]}
    label="状态"
  />,
];

/**
 * Simplified role field component
 */
const RoleChip: React.FC<{ source?: string; label?: string; record?: any }> = ({ source = 'role', label, record }) => {
  if (!record) return null;
  
  const roleColors = {
    USER: 'default',
    ADMIN: 'primary',
    SUPER_ADMIN: 'secondary',
  } as const;
  
  const roleLabels = {
    USER: '普通用户',
    ADMIN: '管理员',
    SUPER_ADMIN: '超级管理员',
  } as const;
  
  return (
    <Chip
      label={label || roleLabels[record[source] as keyof typeof roleLabels] || record[source]}
      color={roleColors[record[source] as keyof typeof roleColors]}
      size="small"
    />
  );
};

/**
 * Simplified status field component
 */
const StatusChip: React.FC<{ source?: string; label?: string; record?: any }> = ({ source = 'status', label, record }) => {
  if (!record) return null;
  
  const statusColors = {
    ACTIVE: 'success',
    INACTIVE: 'default',
    BANNED: 'error',
  } as const;
  
  const statusLabels = {
    ACTIVE: '活跃',
    INACTIVE: '未激活',
    BANNED: '封禁',
  } as const;
  
  return (
    <Chip
      label={label || statusLabels[record[source] as keyof typeof statusLabels] || record[source]}
      color={statusColors[record[source] as keyof typeof statusColors]}
      size="small"
    />
  );
};

/**
 * Simplified list actions toolbar
 */
const SimplifiedUserListActions: React.FC = () => {
  const permissions = useUserPermissions();

  return (
    <TopToolbar>
      <FilterButton />
      {permissions.canCreate() && <CreateButton />}
      {permissions.canExport && <ExportButton />}
    </TopToolbar>
  );
};

/**
 * Simplified bulk actions - only essential operations
 */
const SimplifiedBulkActions: React.FC = () => {
  const permissions = useUserPermissions();
  
  return (
    <Box>
      {permissions.canExport && <BulkExportButton />}
    </Box>
  );
};

/**
 * Simplified user list component with optimized performance
 */
export const SimplifiedUserList: React.FC = () => {
  const permissions = useUserPermissions();

  return (
    <List
      filters={simplifiedUserFilters}
      actions={<SimplifiedUserListActions />}
      perPage={25}
      sort={{ field: 'createdAt', order: 'DESC' }}
      queryOptions={{
        meta: { includeDetails: false } // Use basic query for better performance
      }}
    >
      <Datagrid 
        bulkActionButtons={<SimplifiedBulkActions />}
        rowClick="edit"
        optimized // Enable react-admin optimizations
      >
        <TextField source="name" label="姓名" />
        <EmailField source="email" label="邮箱" />
        <RoleChip source="role" label="角色" />
        <StatusChip source="status" label="状态" />
        <NumberField 
          source="tokenBalance" 
          label="Token余额" 
          options={{ style: 'decimal' }}
        />
        <DateField 
          source="createdAt" 
          label="注册时间" 
          showTime
          locales="zh-CN"
        />
        
        {/* Action buttons based on permissions */}
        {permissions.canEdit() && <EditButton />}
      </Datagrid>
    </List>
  );
};