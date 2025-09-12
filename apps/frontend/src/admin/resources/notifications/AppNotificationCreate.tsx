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

export const AppNotificationCreate: React.FC = () => (
  <Create title="创建应用内通知">
    <SimpleForm>
      <Box display={{ xs: 'block', sm: 'flex' }} width="100%">
        <Box flex={1} mr={{ xs: 0, sm: '0.5em' }}>
          <Typography variant="subtitle2" gutterBottom>基本信息</Typography>
          
          <ReferenceInput
            source="userId"
            reference="users"
            label="用户"
            fullWidth
          >
            <AutocompleteInput 
              optionText="name" 
              filterToQuery={searchText => ({ name: searchText })}
              validate={required()}
            />
          </ReferenceInput>
          
          <TextInput source="title" label="标题" fullWidth validate={required()} />
          
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
            validate={required()}
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
            validate={required()}
          />
          
          <Divider sx={{ my: 2 }} />
          
          <Typography variant="subtitle2" gutterBottom>状态设置</Typography>
          
          <BooleanInput source="isRead" label="已读" defaultValue={false} />
          <BooleanInput source="isPinned" label="置顶" defaultValue={false} />
          
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
            validate={required()}
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
            defaultValue={{}}
          />
        </Box>
      </Box>
    </SimpleForm>
  </Create>
);