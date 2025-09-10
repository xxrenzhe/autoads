import React from 'react';
import {
  Show,
  SimpleShowLayout,
  TextField,
  ReferenceField,
  NumberField,
  DateField,
  BooleanField,
  FunctionField,
  useTranslate,
  Labeled,
  useRecordContext,
} from 'react-admin';
import { Box, Card, CardContent, Typography, Chip } from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  HourglassEmpty as PendingIcon,
  EventBusy as ExpiredIcon,
} from '@mui/icons-material';

const InvitationTitle = () => {
  const record = useRecordContext();
  const translate = useTranslate();
  
  return (
    <span>
      邀请码 {record ? `"${record.code}"` : ''}
    </span>
  );
};

const StatusField = ({ source }: { source: string }) => {
  const record = useRecordContext();
  
  if (!record) return null as any;
  
  const statusConfig = {
    PENDING: {
      icon: <PendingIcon />,
      color: 'warning',
      label: '待使用'
    },
    ACCEPTED: {
      icon: <CheckCircleIcon />,
      color: 'success',
      label: '已使用'
    },
    EXPIRED: {
      icon: <ExpiredIcon />,
      color: 'error',
      label: '已过期'
    }
  };
  
  const config = statusConfig[record.status as keyof typeof statusConfig] || statusConfig.PENDING;
  
  return (
    <Chip
      icon={config.icon}
      label={config.label}
      color={config.color as any}
      size="small"
    />
  );
};

export const InvitationShow: React.FC = () => {
  const translate = useTranslate();
  
  return (
    <Show title={<InvitationTitle />}>
      <SimpleShowLayout>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
          <Box sx={{ flex: 1, minWidth: 300 }}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  基本信息
                </Typography>
                
                <Labeled label="邀请码">
                  <TextField source="code" />
                </Labeled>
                
                <Labeled label="状态">
                  <StatusField source="status" />
                </Labeled>
                
                <Labeled label="奖励Token">
                  <NumberField source="tokensReward" />
                </Labeled>
                
                <Labeled label="注册邮箱">
                  <TextField source="email" />
                </Labeled>
              </CardContent>
            </Card>
          </Box>
          
          <Box sx={{ flex: 1, minWidth: 300 }}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  关联用户
                </Typography>
                
                <Labeled label="邀请者">
                  <ReferenceField source="inviterId" reference="users">
                    <TextField source="email" />
                  </ReferenceField>
                </Labeled>
                
                <Labeled label="被邀请者">
                  <ReferenceField source="invitedId" reference="users" emptyText="-">
                    <TextField source="email" />
                  </ReferenceField>
                </Labeled>
              </CardContent>
            </Card>
          </Box>
          
          <Box sx={{ flex: 1, minWidth: 300 }}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  时间信息
                </Typography>
                
                <Labeled label="创建时间">
                  <DateField source="createdAt" showTime locales="zh-CN" />
                </Labeled>
                
                <Labeled label="更新时间">
                  <DateField source="updatedAt" showTime locales="zh-CN" />
                </Labeled>
                
                <Labeled label="过期时间">
                  <DateField source="expiresAt" locales="zh-CN" />
                </Labeled>
              </CardContent>
            </Card>
          </Box>
        </Box>
        
        <Box sx={{ mt: 2 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                相关记录
              </Typography>
              
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  邀请者活动
                </Typography>
                <ReferenceField 
                  reference="userActivities" 
                  source="id"
                >
                  <TextField source="metadata.invitationId" />
                </ReferenceField>
              </Box>
              
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  被邀请者活动
                </Typography>
                <ReferenceField 
                  reference="userActivities" 
                  source="id"
                >
                  <TextField source="metadata.invitationId" />
                </ReferenceField>
              </Box>
            </CardContent>
          </Card>
        </Box>
        
        <Box sx={{ mt: 2 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                元数据
              </Typography>
              <FunctionField
                source="metadata"
                emptyText="-"
                render={(record: any) => record?.metadata ? JSON.stringify(record.metadata, null, 2) : '-'}
              />
            </CardContent>
          </Card>
        </Box>
      </SimpleShowLayout>
    </Show>
  );
};