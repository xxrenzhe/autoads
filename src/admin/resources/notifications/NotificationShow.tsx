import React from 'react';
import {
  Show,
  SimpleShowLayout,
  TextField,
  DateField,
  BooleanField,
  ReferenceField,
  ChipField,
  Labeled,
  useRecordContext,
} from 'react-admin';
import { Box, Typography, Divider } from '@mui/material';
import { 
  Email, 
  Sms, 
  Notifications as NotificationsIcon,
  Send,
  Schedule,
  CheckCircle,
  Error,
  MoreHoriz
} from '@mui/icons-material';
import { Chip, Stack } from '@mui/material';

const NotificationTitle = () => {
  const record = useRecordContext();
  return (
    <Typography variant="h6">
      通知详情 - {record?.id}
    </Typography>
  );
};

const NotificationTypeDisplay: React.FC = () => {
  const record = useRecordContext();
  if (!record) return null;

  const getIcon = (type: string) => {
    switch (type) {
      case 'EMAIL':
        return <Email fontSize="small" />;
      case 'SMS':
        return <Sms fontSize="small" />;
      case 'SYSTEM':
        return <NotificationsIcon fontSize="small" />;
      default:
        return <MoreHoriz fontSize="small" />;
    }
  };

  const getColor = (type: string) => {
    switch (type) {
      case 'EMAIL':
        return 'primary';
      case 'SMS':
        return 'secondary';
      case 'SYSTEM':
        return 'info';
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

const NotificationStatusDisplay: React.FC = () => {
  const record = useRecordContext();
  if (!record) return null;

  const getIcon = (status: string) => {
    switch (status) {
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
    switch (status) {
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

  return (
    <Chip
      icon={getIcon(record.status)}
      label={record.status}
      color={getColor(record.status) as any}
      size="small"
    />
  );
};

export const NotificationShow: React.FC = () => (
  <Show title={<NotificationTitle />}>
    <SimpleShowLayout>
      <Box display={{ xs: 'block', sm: 'flex' }} width="100%">
        <Box flex={1} mr={{ xs: 0, sm: '0.5em' }}>
          <Typography variant="subtitle2" gutterBottom>基本信息</Typography>
          
          <Labeled label="ID">
            <TextField source="id" />
          </Labeled>
          
          <Labeled label="通知类型">
            <NotificationTypeDisplay />
          </Labeled>
          
          <Labeled label="状态">
            <NotificationStatusDisplay />
          </Labeled>
          
          <TextField source="recipient" label="接收者" />
          <TextField source="subject" label="主题" />
          
          <Divider sx={{ my: 2 }} />
          
          <Typography variant="subtitle2" gutterBottom>时间信息</Typography>
          
          <DateField source="createdAt" label="创建时间" showTime />
          <DateField source="scheduledAt" label="计划发送时间" showTime />
          <DateField source="sentAt" label="发送时间" showTime />
          <DateField source="deliveredAt" label="送达时间" showTime />
        </Box>
        
        <Box flex={1} ml={{ xs: 0, sm: '0.5em' }}>
          <Typography variant="subtitle2" gutterBottom>内容信息</Typography>
          
          <TextField source="content" label="通知内容" />
          
          <Divider sx={{ my: 2 }} />
          
          <Typography variant="subtitle2" gutterBottom>关联信息</Typography>
          
          <ReferenceField
            source="templateId"
            reference="notification-templates"
            label="通知模板"
          >
            <TextField source="name" />
          </ReferenceField>
          
          <TextField source="template" label="模板名称" />
          
          <Divider sx={{ my: 2 }} />
          
          <Typography variant="subtitle2" gutterBottom>错误信息</Typography>
          
          <TextField source="errorMessage" label="错误信息" />
        </Box>
      </Box>
    </SimpleShowLayout>
  </Show>
);