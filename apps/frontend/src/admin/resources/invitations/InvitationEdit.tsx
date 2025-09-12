import React from 'react';
import {
  Edit,
  SimpleForm,
  TextInput,
  ReferenceInput,
  SelectInput,
  NumberInput,
  DateTimeInput,
  BooleanInput,
  useTranslate,
  useNotify,
  useRedirect,
  useRecordContext,
} from 'react-admin';
import { Box, Card, CardContent, Typography } from '@mui/material';

const InvitationTitle = () => {
  const record = useRecordContext();
  const translate = useTranslate();
  
  return (
    <span>
      邀请码 {record ? `"${record.code}"` : ''}
    </span>
  );
};

export const InvitationEdit: React.FC = () => {
  const translate = useTranslate();
  
  return (
    <Edit title={<InvitationTitle />}>
      <SimpleForm>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
          <Box sx={{ flex: 1, minWidth: 300 }}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  基本信息
                </Typography>
                
                <TextInput 
                  source="code" 
                  label="邀请码"
                  disabled
                  fullWidth
                />
                
                <SelectInput 
                  source="status" 
                  label="状态"
                  choices={[
                    { id: 'PENDING', name: '待使用' },
                    { id: 'ACCEPTED', name: '已使用' },
                    { id: 'EXPIRED', name: '已过期' }
                  ]}
                  fullWidth
                />
                
                <NumberInput 
                  source="tokensReward" 
                  label="奖励Token数量"
                  min={0}
                  fullWidth
                />
                
                <TextInput 
                  source="email" 
                  label="注册邮箱"
                  type="email"
                  fullWidth
                />
              </CardContent>
            </Card>
          </Box>
          
          <Box sx={{ flex: 1, minWidth: 300 }}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  关联用户
                </Typography>
                
                <ReferenceInput 
                  source="inviterId" 
                  reference="users" 
                  label="邀请者"
                  disabled
                  fullWidth
                >
                  <SelectInput optionText="email" />
                </ReferenceInput>
                
                <ReferenceInput 
                  source="invitedId" 
                  reference="users" 
                  label="被邀请者"
                  disabled
                  fullWidth
                >
                  <SelectInput optionText="email" />
                </ReferenceInput>
              </CardContent>
            </Card>
          </Box>
          
          <Box sx={{ flex: 1, minWidth: 300 }}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  时间信息
                </Typography>
                
                <DateTimeInput 
                  source="createdAt" 
                  label="创建时间"
                  disabled
                  fullWidth
                />
                
                <DateTimeInput 
                  source="updatedAt" 
                  label="更新时间"
                  disabled
                  fullWidth
                />
                
                <DateTimeInput 
                  source="expiresAt" 
                  label="过期时间"
                  fullWidth
                />
              </CardContent>
            </Card>
          </Box>
        </Box>
        
        <Box sx={{ mt: 2 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                元数据
              </Typography>
              <TextInput 
                source="metadata" 
                label="元数据 (JSON)"
                multiline
                rows={4}
                fullWidth
                format={value => value ? JSON.stringify(value, null, 2) : ''}
                parse={value => {
                  try {
                    return value ? JSON.parse(value) : null;
                  } catch {
                    return null as any;
                  }
                }}
              />
            </CardContent>
          </Card>
        </Box>
      </SimpleForm>
    </Edit>
  );
};