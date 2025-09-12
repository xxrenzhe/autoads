import React from 'react';
import {
  Create,
  SimpleForm,
  TextInput,
  SelectInput,
  DateTimeInput,
  ReferenceInput,
  AutocompleteInput,
  BooleanInput,
  required,
} from 'react-admin';
import { Box, Typography, Divider } from '@mui/material';

export const NotificationCreate: React.FC = () => (
  <Create title="创建通知">
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
            validate={required()}
          />
          
          <TextInput source="recipient" label="接收者" fullWidth validate={required()} />
          <TextInput source="subject" label="主题" fullWidth />
          
          <Divider sx={{ my: 2 }} />
          
          <Typography variant="subtitle2" gutterBottom>时间设置</Typography>
          
          <DateTimeInput source="scheduledAt" label="计划发送时间" fullWidth />
        </Box>
        
        <Box flex={1} ml={{ xs: 0, sm: '0.5em' }}>
          <Typography variant="subtitle2" gutterBottom>内容设置</Typography>
          
          <TextInput
            source="content"
            label="通知内容"
            multiline
            rows={8}
            fullWidth
            validate={required()}
          />
          
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
  </Create>
);