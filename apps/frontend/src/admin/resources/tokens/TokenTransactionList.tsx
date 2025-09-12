import React from 'react';
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
} from 'react-admin';
import { Box, Card, CardContent, Typography } from '@mui/material';

const TokenTransactionFilter = (props: any) => {
  const translate = useTranslate();
  
  return (
    <Filter {...props}>
      <SearchInput source="userId" alwaysOn />
      <SelectInput 
        source="type" 
        choices={[
          { id: 'SUBSCRIPTION', name: '订阅Token' },
          { id: 'PURCHASED', name: '购买Token' },
          { id: 'ACTIVITY', name: '活动Token' },
          { id: 'BONUS', name: '奖励Token' },
          { id: 'REFERRAL', name: '推荐Token' }
        ]}
      />
      <SelectInput 
        source="source" 
        choices={[
          { id: 'daily_check_in', name: '每日签到' },
          { id: 'token_purchase', name: 'Token购买' },
          { id: 'subscription', name: '订阅套餐' },
          { id: 'admin_grant', name: '管理员授予' },
          { id: 'siterank', name: '网站排名' },
          { id: 'batchopen', name: '批量打开' },
          { id: 'adscenter', name: '链接替换' }
        ]}
      />
      <DateInput source="createdAt_gte" label="开始日期" />
      <DateInput source="createdAt_lte" label="结束日期" />
    </Filter>
  );
};

const TokenTransactionActions = () => {
  const { permissions } = usePermissions();
  const translate = useTranslate();
  
  return (
    <TopToolbar>
      <ExportButton />
      {permissions === 'SUPER_ADMIN' && (
        <CreateButton label="创建交易" />
      )}
    </TopToolbar>
  );
};

const TransactionStats: React.FC = () => {
  const { data, isLoading } = useListContext();
  const translate = useTranslate();

  if (isLoading || !data) return null as any;

  // Calculate stats
  const totalTransactions = data.length;
  const totalAcquired = data
    .filter((t: any) => t.amount > 0)
    .reduce((sum: number, t: any) => sum + t.amount, 0);
  const totalConsumed = Math.abs(
    data
      .filter((t: any) => t.amount < 0)
      .reduce((sum: number, t: any) => sum + t.amount, 0)
  );

  return (
    <Box sx={{ mb: 2 }}>
      <Typography variant="h6" gutterBottom>
        交易统计
      </Typography>
      <Box sx={{ display: 'flex', gap: 2 }}>
        <Card sx={{ minWidth: 200 }}>
          <CardContent>
            <Typography color="textSecondary" gutterBottom>
              总交易数
            </Typography>
            <Typography variant="h5" component="div">
              {totalTransactions}
            </Typography>
          </CardContent>
        </Card>
        <Card sx={{ minWidth: 200 }}>
          <CardContent>
            <Typography color="textSecondary" gutterBottom>
              总获得Token
            </Typography>
            <Typography variant="h5" component="div" color="success.main">
              {totalAcquired.toLocaleString()}
            </Typography>
          </CardContent>
        </Card>
        <Card sx={{ minWidth: 200 }}>
          <CardContent>
            <Typography color="textSecondary" gutterBottom>
              总消耗Token
            </Typography>
            <Typography variant="h5" component="div" color="error.main">
              {totalConsumed.toLocaleString()}
            </Typography>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
};

export const TokenTransactionList: React.FC = () => {
  const translate = useTranslate();

  return (
    <List
      filters={<TokenTransactionFilter />}
      actions={<TokenTransactionActions />}
      perPage={20}
      sort={{ field: 'createdAt', order: 'DESC' }}
    >
      <TransactionStats />
      <Datagrid rowClick="show">
        <ReferenceField 
          source="userId" 
          reference="users" 
          label="用户"
          link="show"
        >
          <TextField source="email" />
        </ReferenceField>
        <SelectField
          source="type"
          label="Token类型"
          choices={[
            { id: 'SUBSCRIPTION', name: '订阅Token' },
            { id: 'PURCHASED', name: '购买Token' },
            { id: 'ACTIVITY', name: '活动Token' },
            { id: 'BONUS', name: '奖励Token' },
            { id: 'REFERRAL', name: '推荐Token' }
          ]}
        />
        <NumberField 
          source="amount" 
          label="数量"
          options={{ style: 'decimal' }}
          sx={{
            color: (record: any) => record.amount > 0 ? 'success.main' : 'error.main'
          }}
        />
        <NumberField 
          source="balanceBefore" 
          label="余额前"
          options={{ style: 'decimal' }}
        />
        <NumberField 
          source="balanceAfter" 
          label="余额后"
          options={{ style: 'decimal' }}
        />
        <TextField source="source" label="来源" />
        <TextField source="description" label="描述" />
        <DateField 
          source="createdAt" 
          label="创建时间"
          showTime
          locales="zh-CN"
        />
      </Datagrid>
    </List>
  );
};