import React from 'react';
import {
  List,
  Datagrid,
  TextField,
  DateField,
  BooleanField,
  EditButton,
  DeleteButton,
  FilterButton,
  CreateButton,
  ExportButton,
  BulkDeleteButton,
  BulkExportButton,
  TopToolbar,
  SearchInput,
  SelectInput,
  BooleanInput,
  ReferenceField,
  usePermissions,
  useRecordContext,
} from 'react-admin';
import { Chip, Box } from '@mui/material';
import { Block as BlockIcon, Check as CheckIcon } from '@mui/icons-material';

/**
 * Restriction list filters
 */
const restrictionFilters = [
  <SearchInput key="search" source="q" alwaysOn />,
  <SelectInput
    key="type"
    source="type"
    choices={[
      { id: 'API_LIMIT', name: 'API限制' },
      { id: 'BATCH_LIMIT', name: '批量操作限制' },
      { id: 'ACCOUNT_SUSPEND', name: '账户暂停' },
      { id: 'LOGIN_BLOCK', name: '登录阻止' },
      { id: 'FEATURE_ACCESS', name: '功能访问限制' },
    ]}
  />,
  <BooleanInput
    key="isActive"
    source="isActive"
    label="仅显示活跃限制"
    defaultValue={true}
  />,
  <ReferenceField
    key="userId"
    source="userId"
    reference="users"
    label="用户"
    link={false}
  >
    <SearchInput source="q" />
  </ReferenceField>,
];

/**
 * Restriction list actions
 */
const RestrictionListActions = () => (
  <TopToolbar>
    <FilterButton />
    <CreateButton />
    <ExportButton />
  </TopToolbar>
);

/**
 * Restriction type chip with color coding
 */
const RestrictionTypeField = ({ source, label }: { source?: string; label?: string }) => {
  const record = useRecordContext();
  if (!record) return null as any;

  const colors: Record<string, 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success'> = {
    API_LIMIT: 'error',
    BATCH_LIMIT: 'info',
    ACCOUNT_SUSPEND: 'error',
    LOGIN_BLOCK: 'error',
    FEATURE_ACCESS: 'info',
  };

  const labels: Record<string, string> = {
    API_LIMIT: 'API限制',
    BATCH_LIMIT: '批量限制',
    ACCOUNT_SUSPEND: '账户暂停',
    LOGIN_BLOCK: '登录阻止',
    FEATURE_ACCESS: '功能限制',
  };

  return (
    <Chip
      icon={record.isActive ? <BlockIcon /> : <CheckIcon />}
      label={labels[record.type] || record.type}
      color={colors[record.type] || 'default'}
      size="small"
      variant={record.isActive ? 'filled' : 'outlined'}
    />
  );
};

/**
 * User Restrictions List Component
 */
export const RestrictionList = () => {
  const { permissions } = usePermissions();

  return (
    <List
      filters={restrictionFilters}
      actions={<RestrictionListActions />}
      perPage={25}
      sort={{ field: 'createdAt', order: 'DESC' }}
    >
      <Datagrid
        bulkActionButtons={permissions === 'SUPER_ADMIN' ? (
          <>
            <BulkDeleteButton />
            <BulkExportButton />
          </>
        ) : false}
      >
        <TextField source="id" label="ID" />
        <ReferenceField
          source="userId"
          reference="users"
          label="用户"
          link="show"
        >
          <TextField source="email" />
        </ReferenceField>
        <RestrictionTypeField source="type" label="限制类型" />
        <TextField source="reason" label="原因" />
        <BooleanField
          source="isActive"
          label="状态"
          TrueIcon={CheckIcon}
          FalseIcon={BlockIcon}
        />
        <DateField
          source="expiresAt"
          label="过期时间"
          showTime
          locales="zh-CN"
        />
        <DateField
          source="createdAt"
          label="创建时间"
          showTime
          locales="zh-CN"
        />
        <EditButton />
        {permissions === 'SUPER_ADMIN' && <DeleteButton />}
      </Datagrid>
    </List>
  );
};