import React from 'react';
import {
  Show,
  SimpleShowLayout,
  TextField,
  EmailField,
  DateField,
  NumberField,
  BooleanField,
  ChipField,
  ReferenceManyField,
  ReferenceField,
  Datagrid,
  useRecordContext,
  Button,
  TopToolbar,
} from 'react-admin';
import { Box, Typography, Chip } from '@mui/material';
import { Block as BlockIcon, Check as CheckIcon, Add as AddIcon } from '@mui/icons-material';
import { SubscriptionList } from '../subscriptions/SubscriptionList';

const UserTitle: React.FC = () => {
  const record = useRecordContext();
  return (
    <Typography variant="h6">
      用户详情: {record?.name} ({record?.email})
    </Typography>
  );
};

const UserShowActions = () => {
  const record = useRecordContext();
  
  return (
    <TopToolbar>
      <Button
        label="限制用户"
        startIcon={<BlockIcon />}
        onClick={() => {
          // Navigate to restriction create with pre-filled userId
          window.location.href = `/#/restrictions/create?userId=${record?.id}`;
        }}
      />
    </TopToolbar>
  );
};

const UserRoleField: React.FC = () => {
  const record = useRecordContext();
  if (!record) return null as any;
  
  const roleColors = {
    USER: 'default',
    ADMIN: 'primary',
    SUPER_ADMIN: 'secondary',
  };
  
  return (
    <ChipField
      source="role"
      color={roleColors[record.role as keyof typeof roleColors] as any}
      size="small"
    />
  );
};

const UserStats: React.FC = () => {
  const record = useRecordContext();
  if (!record) return null as any;
  
  return (
    <Box sx={{ display: 'flex', gap: 3, mb: 2 }}>
      <Box>
        <Typography variant="caption" color="text.secondary">
          Token余额
        </Typography>
        <Typography variant="h6">
          {record.tokenBalance}
        </Typography>
      </Box>
      <Box>
        <Typography variant="caption" color="text.secondary">
          本月已用
        </Typography>
        <Typography variant="h6">
          {record.tokenUsedThisMonth}
        </Typography>
      </Box>
      <Box>
        <Typography variant="caption" color="text.secondary">
          注册时间
        </Typography>
        <Typography variant="body2">
          <DateField source="createdAt" showTime />
        </Typography>
      </Box>
      <Box>
        <Typography variant="caption" color="text.secondary">
          最后登录
        </Typography>
        <Typography variant="body2">
          <DateField source="lastLoginAt" showTime />
        </Typography>
      </Box>
    </Box>
  );
};

export const UserShow: React.FC = () => {
  return (
    <Show title={<UserTitle />} actions={<UserShowActions />}>
      <SimpleShowLayout>
        <TextField source="id" label="用户ID" />
        <EmailField source="email" label="邮箱" />
        <TextField source="name" label="姓名" />
        <UserRoleField />
        <BooleanField source="emailVerified" label="邮箱已验证" />
        <BooleanField source="isActive" label="账号活跃" />
        
        <UserStats />
        
        <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>
          用户限制
        </Typography>
        <ReferenceManyField
          reference="userRestrictions"
          target="userId"
          label="用户限制"
          sort={{ field: 'createdAt', order: 'DESC' }}
        >
          <Datagrid>
            <TextField source="type" label="类型" />
            <TextField source="reason" label="原因" />
            <BooleanField 
              source="isActive" 
              label="状态"
              TrueIcon={CheckIcon}
              FalseIcon={BlockIcon}
            />
            <DateField source="expiresAt" label="过期时间" showTime />
          </Datagrid>
        </ReferenceManyField>
        
        <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>
          订阅记录
        </Typography>
        <ReferenceManyField
          reference="subscriptions"
          target="userId"
          label="订阅记录"
        >
          <Datagrid>
            <TextField source="id" />
            <ReferenceField 
              source="planId" 
              reference="plans"
              link={false}
              label="套餐"
            >
              <TextField source="name" />
            </ReferenceField>
            <ChipField source="status" />
            <DateField source="currentPeriodStart" label="开始时间" />
            <DateField source="currentPeriodEnd" label="结束时间" />
            <BooleanField source="cancelAtPeriodEnd" label="到期取消" />
          </Datagrid>
        </ReferenceManyField>
      </SimpleShowLayout>
    </Show>
  );
};