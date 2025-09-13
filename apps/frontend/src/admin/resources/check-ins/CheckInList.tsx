import React, { useState, useEffect } from 'react';
import {
  List,
  Datagrid,
  TextField,
  NumberField,
  DateField,
  BooleanField,
  ReferenceField,
  SelectField,
  useTranslate,
  Filter,
  SearchInput,
  DateInput,
  TopToolbar,
  ExportButton,
  useRefresh,
  Button,
} from 'react-admin';
import { Box, Typography, Card, CardContent, Grid } from '@mui/material';
import { Refresh as RefreshIcon } from '@mui/icons-material';

const CheckInFilter = (props: any) => {
  return (
    <Filter {...props}>
      <SearchInput source="q" alwaysOn />
      <ReferenceField source="userId" reference="users" label="用户">
        <SearchInput source="email" />
      </ReferenceField>
      <DateInput source="date_gte" label="签到开始日期" />
      <DateInput source="date_lte" label="签到结束日期" />
    </Filter>
  );
};

const CheckInActions = () => {
  const refresh = useRefresh();
  
  return (
    <TopToolbar>
      <Button
        onClick={() => refresh()}
        label="刷新"
        startIcon={<RefreshIcon />}
      />
      <ExportButton />
    </TopToolbar>
  );
};

const CheckInStats: React.FC = () => {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/admin/check-ins/stats');
      if (response.ok) => {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error fetching check-in stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) => {
    return <Box sx={{ mb: 2 }}>加载中...</Box>;
  }

  if (!stats) => {
    return <Box sx={{ mb: 2 }}>无法加载统计数据</Box>;
  }

  return (
    <Box sx={{ mb: 2 }}>
      <Typography variant="h6" gutterBottom>
        签到统计
      </Typography>
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                今日签到
              </Typography>
              <Typography variant="h5" component="div">
                {stats.todayCheckIns}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                奖励 {stats.todayTokensAwarded} Token
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                本月签到
              </Typography>
              <Typography variant="h5" component="div">
                {stats.monthCheckIns}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                奖励 {stats.monthTokensAwarded} Token
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                总签到次数
              </Typography>
              <Typography variant="h5" component="div">
                {stats.totalCheckIns}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                独立用户 {stats.uniqueUsers} 人
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                平均连续天数
              </Typography>
              <Typography variant="h5" component="div">
                {stats.averageStreak}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                {stats.activeStreaks} 人连续3天+
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export const CheckInList: React.FC = () => {
  const translate = useTranslate();

  return (
    <List
      filters={<CheckInFilter />}
      actions={<CheckInActions />}
      perPage={20}
      sort={{ field: 'createdAt', order: 'DESC' }}
    >
      <CheckInStats />
      <Datagrid rowClick="show">
        <ReferenceField 
          source="userId" 
          reference="users" 
          label="用户"
          link="show"
        >
          <TextField source="email" />
        </ReferenceField>
        <DateField 
          source="date" 
          label="签到日期"
          showTime
          locales="zh-CN"
        />
        <NumberField 
          source="tokens" 
          label="获得Token"
          options={{ style: 'decimal' }}
        />
        <NumberField 
          source="streak" 
          label="连续天数"
          options={{ style: 'decimal' }}
        />
        <SelectField
          source="rewardLevel"
          label="奖励等级"
          choices={[
            { id: 1, name: '第1天 (10 Token)' },
            { id: 2, name: '第2天 (20 Token)' },
            { id: 3, name: '第3天 (40 Token)' },
            { id: 4, name: '第4天+ (80 Token)' }
          ]}
        />
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