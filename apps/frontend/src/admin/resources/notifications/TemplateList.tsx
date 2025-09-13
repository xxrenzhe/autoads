import React from 'react';
import {
  List,
  Datagrid,
  TextField,
  BooleanField,
  EditButton,
  DeleteButton,
  FilterButton,
  ExportButton,
  TopToolbar,
  SearchInput,
  SelectInput,
  useRecordContext,
} from 'react-admin';
import { Email, Notifications as NotificationsIcon, MoreHoriz } from '@mui/icons-material';
import { Chip } from '@mui/material';

const templateFilters = [
  <SearchInput key="search" source="q" alwaysOn />,
  <SelectInput
    key="type"
    source="type"
    choices={[
      { id: 'EMAIL', name: '邮件' },
      { id: 'SYSTEM', name: '系统' },
      { id: 'IN_APP', name: '应用内' },
    ]}
    label="类型"
  />,
  <SelectInput
    key="isActive"
    source="isActive"
    choices={[
      { id: 'true', name: '激活' },
      { id: 'false', name: '未激活' },
    ]}
    label="状态"
  />,
];

const TemplateTypeField: React.FC = () => {
  const record = useRecordContext();
  if (!record) return null;

  const getIcon = (type: string) => {
    switch (type) {
      case 'EMAIL':
        return <Email fontSize="small" />;
      case 'SYSTEM':
      case 'IN_APP':
        return <NotificationsIcon fontSize="small" />;
      default:
        return <MoreHoriz fontSize="small" />;
    }
  };

  const getColor = (type: string) => {
    switch (type) {
      case 'EMAIL':
        return 'primary';
      case 'SYSTEM':
      case 'IN_APP':
        return 'info';
      default:
        return 'default';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'EMAIL':
        return '邮件';
      case 'SYSTEM':
        return '系统';
      case 'IN_APP':
        return '应用内';
      default:
        return type;
    }
  };

  return (
    <Chip
      icon={getIcon(record.type)}
      label={getTypeLabel(record.type)}
      color={getColor(record.type) as any}
      size="small"
    />
  );
};

const TemplateListActions = () => (
  <TopToolbar>
    <FilterButton />
    <ExportButton />
  </TopToolbar>
);

export const TemplateList: React.FC = () => (
  <List
    resource="notification_templates"
    filters={templateFilters}
    actions={<TemplateListActions />}
    perPage={25}
    sort={{ field: 'createdAt', order: 'DESC' }}
  >
    <Datagrid rowClick="edit">
      <TextField source="id" label="ID" />
      <TextField source="name" label="模板名称" />
      <TemplateTypeField />
      <TextField source="subject" label="主题" />
      <BooleanField source="isActive" label="是否激活" />
      <TextField source="createdAt" label="创建时间" />
      <TextField source="updatedAt" label="更新时间" />
      <EditButton />
      <DeleteButton />
    </Datagrid>
  </List>
);