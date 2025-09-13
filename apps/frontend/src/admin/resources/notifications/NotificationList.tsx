import React from 'react';
import {
  List,
  Datagrid,
  TextField,
  DateField,
  BooleanField,
  FilterButton,
  ExportButton,
  TopToolbar,
  SearchInput,
  SelectInput,
  useRecordContext,
  ReferenceField,
} from 'react-admin';
import { 
  Email, 
  Notifications as NotificationsIcon,
  Send,
  Schedule,
  CheckCircle,
  Error,
  MoreHoriz
} from '@mui/icons-material';
import { Chip, Box, Typography } from '@mui/material';

const notificationFilters = [
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
    key="status"
    source="status"
    choices={[
      { id: 'PENDING', name: '待发送' },
      { id: 'SENT', name: '已发送' },
      { id: 'FAILED', name: '发送失败' },
      { id: 'DELIVERED', name: '已送达' },
    ]}
    label="状态"
  />,
];

const NotificationTypeField: React.FC = () => {
  const record = useRecordContext();
  if (!record) return null;

  const getIcon = (type: string) => {
    switch (type) => {
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
    switch (type) => {
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
    switch (type) => {
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

const NotificationStatusField: React.FC = () => {
  const record = useRecordContext();
  if (!record) return null;

  const getIcon = (status: string) => {
    switch (status) => {
      case 'PENDING':
        return <Schedule fontSize="small" />;
      case 'SENT':
        return <Send fontSize="small" />;
      case 'DELIVERED':
        return <CheckCircle fontSize="small" />;
      case 'FAILED':
        return <Error fontSize="small" />;
      default:
        return <MoreHoriz fontSize="small" />;
    }
  };

  const getColor = (status: string) => {
    switch (status) => {
      case 'PENDING':
        return 'warning';
      case 'SENT':
        return 'info';
      case 'DELIVERED':
        return 'success';
      case 'FAILED':
        return 'error';
      default:
        return 'default';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) => {
      case 'PENDING':
        return '待发送';
      case 'SENT':
        return '已发送';
      case 'DELIVERED':
        return '已送达';
      case 'FAILED':
        return '发送失败';
      default:
        return status;
    }
  };

  return (
    <Chip
      icon={getIcon(record.status)}
      label={getStatusLabel(record.status)}
      color={getColor(record.status) as any}
      size="small"
    />
  );
};

const NotificationListActions = () => (
  <TopToolbar>
    <FilterButton />
    <ExportButton />
  </TopToolbar>
);

export const NotificationList: React.FC = () => (
  <List
    resource="notification_logs"
    filters={notificationFilters}
    actions={<NotificationListActions />}
    perPage={25}
    sort={{ field: 'createdAt', order: 'DESC' }}
  >
    <Datagrid rowClick="show">
      <TextField source="id" label="ID" />
      <NotificationTypeField />
      <ReferenceField source="templateId" reference="notification_templates" label="模板">
        <TextField source="name" />
      </ReferenceField>
      <TextField source="recipient" label="接收者" />
      <TextField source="subject" label="主题" />
      <NotificationStatusField />
      <DateField source="createdAt" label="创建时间" showTime />
      <DateField source="sentAt" label="发送时间" showTime />
      <DateField source="deliveredAt" label="送达时间" showTime />
      <TextField source="errorMessage" label="错误信息" />
    </Datagrid>
  </List>
);