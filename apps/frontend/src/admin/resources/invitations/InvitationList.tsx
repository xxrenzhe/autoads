import React, { useState, useEffect } from 'react';
import {
  List,
  Datagrid,
  TextField,
  NumberField,
  DateField,
  ReferenceField,
  SelectField,
  BooleanField,
  Filter,
  SearchInput,
  SelectInput,
  DateInput,
  useTranslate,
  useListContext,
  TopToolbar,
  ExportButton,
  CreateButton,
  usePermissions,
  Button,
  useRecordContext,
  useNotify,
  useRefresh,
} from 'react-admin';
import { Box, Card, CardContent, Typography, Chip } from '@mui/material';
import {
  Block as BlockIcon,
  CheckCircle as CheckCircleIcon,
  HourglassEmpty as PendingIcon,
  EventBusy as ExpiredIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';

const InvitationFilter = (props: any) => {
  const translate = useTranslate();
  
  return (
    <Filter {...props}>
      <SearchInput source="code" alwaysOn />
      <SelectInput 
        source="status" 
        choices={[
          { id: 'PENDING', name: '待使用' },
          { id: 'ACCEPTED', name: '已使用' },
          { id: 'EXPIRED', name: '已过期' }
        ]}
      />
      <ReferenceField source="inviterId" reference="users" label="邀请者">
        <SearchInput source="email" />
      </ReferenceField>
      <DateInput source="createdAt_gte" label="创建开始日期" />
      <DateInput source="createdAt_lte" label="创建结束日期" />
      <DateInput source="expiresAt_gte" label="过期开始日期" />
      <DateInput source="expiresAt_lte" label="过期结束日期" />
    </Filter>
  );
};

const InvitationActions = () => {
  const { permissions } = usePermissions();
  const translate = useTranslate();
  const refresh = useRefresh();
  
  return (
    <TopToolbar>
      <Button
        onClick={((: any): any) => refresh()}
        label="刷新"
        startIcon={<RefreshIcon />}
      />
      <ExportButton />
      {permissions === 'SUPER_ADMIN' && (
        <CreateButton label="创建邀请码" />
      )}
    </TopToolbar>
  );
};

const StatusField = () => {
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

const RevokeButton = () => {
  const record = useRecordContext();
  const notify = useNotify();
  const refresh = useRefresh();
  
  if (!record || record.status !== 'PENDING') return null as any;
  
  const handleRevoke = async () => {
    try {
      const response = await fetch(`/api/admin/invitations/${record.id}/revoke`, {
        method: 'POST'
      });
      
      if (response.ok) {
        notify('邀请码已撤销', { type: 'success' });
        refresh();
      } else {
        const data = await response.json();
        notify(data.error || '撤销失败', { type: 'error' });
      }
    } catch (error) {
      notify('撤销失败', { type: 'error' });
    }
  };
  
  return (
    <Button
      label="撤销"
      onClick={handleRevoke}
      startIcon={<BlockIcon />}
      color="error"
      size="small"
    />
  );
};

const InvitationStats: React.FC = () => {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/admin/invitations/stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error fetching invitation stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <Box sx={{ mb: 2 }}>加载中...</Box>;
  }

  if (!stats) {
    return <Box sx={{ mb: 2 }}>无法加载统计数据</Box>;
  }

  const { 
    totalInvitations,
    todayInvitations,
    monthInvitations,
    pendingInvitations,
    acceptedInvitations,
    expiredInvitations,
    totalTokensReward,
    acceptanceRate,
  } = stats;

  return (
    <Box sx={{ mb: 2 }}>
      <Typography variant="h6" gutterBottom>
        邀请统计
      </Typography>
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <Card sx={{ minWidth: 200 }}>
          <CardContent>
            <Typography color="textSecondary" gutterBottom>
              今日邀请
            </Typography>
            <Typography variant="h5" component="div">
              {todayInvitations}
            </Typography>
          </CardContent>
        </Card>
        <Card sx={{ minWidth: 200 }}>
          <CardContent>
            <Typography color="textSecondary" gutterBottom>
              本月邀请
            </Typography>
            <Typography variant="h5" component="div">
              {monthInvitations}
            </Typography>
          </CardContent>
        </Card>
        <Card sx={{ minWidth: 200 }}>
          <CardContent>
            <Typography color="textSecondary" gutterBottom>
              总邀请数
            </Typography>
            <Typography variant="h5" component="div">
              {totalInvitations}
            </Typography>
          </CardContent>
        </Card>
        <Card sx={{ minWidth: 200 }}>
          <CardContent>
            <Typography color="textSecondary" gutterBottom>
              成功率
            </Typography>
            <Typography variant="h5" component="div" color="success.main">
              {acceptanceRate}%
            </Typography>
          </CardContent>
        </Card>
        <Card sx={{ minWidth: 200 }}>
          <CardContent>
            <Typography color="textSecondary" gutterBottom>
              总奖励Token
            </Typography>
            <Typography variant="h5" component="div" color="info.main">
              {totalTokensReward}
            </Typography>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
};

export const InvitationList: React.FC = () => {
  const translate = useTranslate();

  return (
    <List
      filters={<InvitationFilter />}
      actions={<InvitationActions />}
      perPage={20}
      sort={{ field: 'createdAt', order: 'DESC' }}
    >
      <InvitationStats />
      <Datagrid rowClick="show">
        <TextField source="code" label="邀请码" />
        <StatusField />
        <ReferenceField 
          source="inviterId" 
          reference="users" 
          label="邀请者"
          link="show"
        >
          <TextField source="email" />
        </ReferenceField>
        <ReferenceField 
          source="invitedId" 
          reference="users" 
          label="被邀请者"
          link="show"
          emptyText="-"
        >
          <TextField source="email" />
        </ReferenceField>
        <NumberField 
          source="tokensReward" 
          label="奖励Token"
          options={{ style: 'decimal' }}
        />
        <TextField source="email" label="注册邮箱" />
        <DateField 
          source="createdAt" 
          label="创建时间"
          showTime
          locales="zh-CN"
        />
        <DateField 
          source="expiresAt" 
          label="过期时间"
          locales="zh-CN"
        />
        <DateField 
          source="updatedAt" 
          label="更新时间"
          showTime
          locales="zh-CN"
        />
        <RevokeButton />
      </Datagrid>
    </List>
  );
};