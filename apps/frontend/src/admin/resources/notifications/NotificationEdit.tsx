import React from 'react';
import {
  Edit,
  SimpleForm,
  TextInput,
  SelectInput,
  DateTimeInput,
  ReferenceInput,
  AutocompleteInput,
  BooleanInput,
  NumberInput,
  useRecordContext,
} from 'react-admin';
import { Box, Typography, Divider } from '@mui/material';

const NotificationTitle = () => {
  const record = useRecordContext();
  return (
    <Typography variant="h6">
      编辑通知 - {record?.id}
    </Typography>
  );
};

export const NotificationEdit: React.FC = () => (
  <Edit title={<NotificationTitle />}>
    <SimpleForm>
      <Box display={{ xs: 'block', sm: 'flex' }} width="100%">
        <Box flex={1} mr={{ xs: 0, sm: '0.5em' }}>
          <Typography variant="subtitle2" gutterBottom>基本信息</Typography>
          
          <SelectInput
            source="type"
            choices={[
              { id: 'EMAIL', name: '邮件' },
              { id: 'SMS', name: '短信' },
              { id: 'SYSTEM', name: '系统' },
            ]}
            label="通知类型"
            fullWidth
            required
          />
          
          <SelectInput
            source="status"
            choices={[
              { id: 'PENDING', name: '待发送' },
              { id: 'SENT', name: '已发送' },
              { id: 'FAILED', name: '发送失败' },
              { id: 'DELIVERED', name: '已送达' },
            ]}
            label="状态"
            fullWidth
            required
          />
          
          <TextInput source="recipient" label="接收者" fullWidth required />
          <TextInput source="subject" label="主题" fullWidth />
          
          <Divider sx={{ my: 2 }} />
          
          <Typography variant="subtitle2" gutterBottom>时间设置</Typography>
          
          <DateTimeInput source="scheduledAt" label="计划发送时间" fullWidth />
          <DateTimeInput source="sentAt" label="实际发送时间" fullWidth />
          <DateTimeInput source="deliveredAt" label="送达时间" fullWidth />
        </Box>
        
        <Box flex={1} ml={{ xs: 0, sm: '0.5em' }}>
          <Typography variant="subtitle2" gutterBottom>内容设置</Typography>
          
          <TextInput
            source="content"
            label="通知内容"
            multiline
            rows={6}
            fullWidth
            required
          />
          
          <TextInput source="template" label="模板名称" fullWidth />
          
          <Divider sx={{ my: 2 }} />
          
          <Typography variant="subtitle2" gutterBottom>其他信息</Typography>
          
          <TextInput source="errorMessage" label="错误信息" multiline rows={3} fullWidth />
          
          <ReferenceInput
            source="templateId"
            reference="notification-templates"
            label="通知模板"
          >
            <AutocompleteInput optionText="name" />
          </ReferenceInput>
        </Box>
      </Box>
    </SimpleForm>
  </Edit>
);