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
  useRecordContext,
} from 'react-admin';
import { Box, Typography, Divider } from '@mui/material';

const AppNotificationTitle = () => {
  const record = useRecordContext();
  return (
    <Typography variant="h6">
      编辑应用内通知 - {record?.id}
    </Typography>
  );
};

export const AppNotificationEdit: React.FC = () => (
  <Edit title={<AppNotificationTitle />}>
    <SimpleForm>
      <Box display={{ xs: 'block', sm: 'flex' }} width="100%">
        <Box flex={1} mr={{ xs: 0, sm: '0.5em' }}>
          <Typography variant="subtitle2" gutterBottom>基本信息</Typography>
          
          <ReferenceInput
            source="userId"
            reference="users"
            label="用户"
            fullWidth
            required
          >
            <AutocompleteInput 
              optionText="name" 
              filterToQuery={searchText => ({ name: searchText })}
            />
          </ReferenceInput>
          
          <TextInput source="title" label="标题" fullWidth required />
          
          <SelectInput
            source="type"
            choices={[
              { id: 'INFO', name: '信息' },
              { id: 'WARNING', name: '警告' },
              { id: 'ERROR', name: '错误' },
              { id: 'SUCCESS', name: '成功' },
            ]}
            label="类型"
            fullWidth
            defaultValue="INFO"
          />
          
          <SelectInput
            source="priority"
            choices={[
              { id: 'LOW', name: '低' },
              { id: 'MEDIUM', name: '中' },
              { id: 'HIGH', name: '高' },
              { id: 'URGENT', name: '紧急' },
            ]}
            label="优先级"
            fullWidth
            defaultValue="MEDIUM"
          />
          
          <Divider sx={{ my: 2 }} />
          
          <Typography variant="subtitle2" gutterBottom>状态设置</Typography>
          
          <BooleanInput source="isRead" label="已读" />
          <BooleanInput source="isPinned" label="置顶" />
          
          <DateTimeInput source="expiresAt" label="过期时间" fullWidth />
        </Box>
        
        <Box flex={1} ml={{ xs: 0, sm: '0.5em' }}>
          <Typography variant="subtitle2" gutterBottom>内容设置</Typography>
          
          <TextInput
            source="content"
            label="通知内容"
            multiline
            rows={8}
            fullWidth
            required
          />
          
          <Divider sx={{ my: 2 }} />
          
          <Typography variant="subtitle2" gutterBottom>元数据</Typography>
          
          <TextInput
            source="metadata"
            label="元数据 (JSON格式)"
            multiline
            rows={4}
            fullWidth
            helperText="可选，JSON格式的额外数据"
            format={value => value ? JSON.stringify(value, null, 2) : ''}
            parse={value => {
              if (!value) return {};
              try {
                return JSON.parse(value);
              } catch {
                return {};
              }
            }}
          />
        </Box>
      </Box>
    </SimpleForm>
  </Edit>
);