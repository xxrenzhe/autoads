import React from 'react';
import { useAdminGoflyStats } from '@/lib/hooks/admin/useAdminGoflyStats';
import { Card, CardContent, Grid, Typography } from '@mui/material';
import { People, Speed, AssignmentTurnedIn } from '@mui/icons-material';

export default function GoFlyPanelStats() {
  const { data, isLoading } = useAdminGoflyStats();
  const users = data?.users || {} as any;
  const tasks = data?.tasks || {} as any;

  return (
    <Grid container spacing={2} sx={{ mb: 2 }}>
      <Grid item xs={12}>
        <Typography variant="h6" gutterBottom>
          GoFly 面板统计（后端实时）
        </Typography>
      </Grid>
      {[{
        title: '用户总数',
        value: users.total ?? '-',
        icon: <People color="primary" />
      },{
        title: '活跃用户',
        value: users.active ?? '-',
        icon: <Speed color="success" />
      },{
        title: '今日新增',
        value: users.newToday ?? '-',
        icon: <AssignmentTurnedIn color="secondary" />
      },{
        title: '任务总数',
        value: tasks.total ?? '-',
        icon: <AssignmentTurnedIn color="action" />
      },{
        title: '运行中任务',
        value: tasks.running ?? '-',
        icon: <Speed color="info" />
      },{
        title: '已完成任务',
        value: tasks.completed ?? '-',
        icon: <AssignmentTurnedIn color="success" />
      }].map((item, idx) => (
        <Grid item xs={12} md={4} lg={2} key={idx}>
          <Card variant="outlined">
            <CardContent>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {item.icon}
                <Typography variant="subtitle2" color="textSecondary">{item.title}</Typography>
              </div>
              <Typography variant="h5" sx={{ mt: 1 }}>
                {isLoading ? '…' : item.value}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
}

