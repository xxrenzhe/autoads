import React, { useState, useEffect } from 'react';
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
  NumberField,
  DateField,
} from 'react-admin';
import {
  Notifications as NotificationsIcon,
  PushPin,
  MarkEmailRead,
  Schedule,
  CheckCircle,
  Error,
  MoreHoriz,
} from '@mui/icons-material';
import { Chip, Box, Typography, Button, Alert, Stack } from '@mui/material';
import { SendBulkNotificationModal } from './SendBulkNotificationModal';

const appNotificationFilters = [
  <SearchInput key="search" source="q" alwaysOn />,
  <SelectInput
    key="type"
    source="type"
    choices={[
      { id: 'INFO', name: '信息' },
      { id: 'WARNING', name: '警告' },
      { id: 'ERROR', name: '错误' },
      { id: 'SUCCESS', name: '成功' },
    ]}
    label="类型"
  />,
  <SelectInput
    key="priority"
    source="priority"
    choices={[
      { id: 'LOW', name: '低' },
      { id: 'MEDIUM', name: '中' },
      { id: 'HIGH', name: '高' },
      { id: 'URGENT', name: '紧急' },
    ]}
    label="优先级"
  />,
  <SelectInput
    key="isRead"
    source="isRead"
    choices={[
      { id: 'true', name: '已读' },
      { id: 'false', name: '未读' },
    ]}
    label="阅读状态"
  />,
  <SelectInput
    key="isPinned"
    source="isPinned"
    choices={[
      { id: 'true', name: '已置顶' },
      { id: 'false', name: '未置顶' },
    ]}
    label="置顶状态"
  />,
];

const NotificationTypeField: React.FC = () => {
  const record = useRecordContext();
  if (!record) return null;

  const getIcon = (type: string) => {
    switch (type) => {
      case 'INFO':
        return <NotificationsIcon fontSize="small" />;
      case 'WARNING':
        return <Error fontSize="small" />;
      case 'ERROR':
        return <Error fontSize="small" />;
      case 'SUCCESS':
        return <CheckCircle fontSize="small" />;
      default:
        return <MoreHoriz fontSize="small" />;
    }
  };

  const getColor = (type: string) => {
    switch (type) => {
      case 'INFO':
        return 'info';
      case 'WARNING':
        return 'warning';
      case 'ERROR':
        return 'error';
      case 'SUCCESS':
        return 'success';
      default:
        return 'default';
    }
  };

  return (
    <Chip
      icon={getIcon(record.type)}
      label={record.type}
      color={getColor(record.type) as any}
      size="small"
    />
  );
};

const PriorityField: React.FC = () => {
  const record = useRecordContext();
  if (!record) return null;

  const getColor = (priority: string) => {
    switch (priority) => {
      case 'LOW':
        return 'default';
      case 'MEDIUM':
        return 'info';
      case 'HIGH':
        return 'warning';
      case 'URGENT':
        return 'error';
      default:
        return 'default';
    }
  };

  return (
    <Chip
      label={record.priority}
      color={getColor(record.priority) as any}
      size="small"
    />
  );
};

const AppNotificationListActions = () => {
  const [openBulkModal, setOpenBulkModal] = useState(false);

  return (
    <TopToolbar>
      <Button
        onClick={() => setOpenBulkModal(true)}
        startIcon={<PushPin />}
        sx={{ mr: 1 }}
      >
        批量发送
      </Button>
      <FilterButton />
      <ExportButton />
      {openBulkModal && (
        <SendBulkNotificationModal
          open={openBulkModal}
          onClose={() => setOpenBulkModal(false)}
        />
      )}
    </TopToolbar>
  );
};

export const AppNotificationList: React.FC = () => (
  <List
    resource="app_notifications"
    filters={appNotificationFilters}
    actions={<AppNotificationListActions />}
    perPage={25}
    sort={{ field: 'createdAt', order: 'DESC' }}
  >
    <Datagrid rowClick="show">
      <TextField source="id" label="ID" />
      <NotificationTypeField />
      <PriorityField />
      <TextField source="title" label="标题" />
      <TextField source="user.name" label="用户" />
      <BooleanField source="isRead" label="已读" />
      <BooleanField source="isPinned" label="置顶" />
      <DateField source="createdAt" label="创建时间" showTime />
      <DateField source="expiresAt" label="过期时间" showTime />
      <EditButton />
      <DeleteButton />
    </Datagrid>
  </List>
);