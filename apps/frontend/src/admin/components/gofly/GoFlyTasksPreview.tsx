import React from 'react';
import { useAdminGoflyTasks } from '@/lib/hooks/admin/useAdminGoflyTasks';
import { useAdminGoflyStats } from '@/lib/hooks/admin/useAdminGoflyStats';
import { Card, CardContent, Table, TableBody, TableCell, TableHead, TableRow, Typography, Chip, Box } from '@mui/material';

export default function GoFlyTasksPreview() {
  const { data: tasks, isLoading } = useAdminGoflyTasks({ page: 1, limit: 5 });
  const { data: stats } = useAdminGoflyStats();

  const hasTasks = Array.isArray(tasks) && tasks.length > 0;

  return (
    <Card variant="outlined" sx={{ mb: 2 }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="h6">最近任务（GoFly）</Typography>
          {!hasTasks && stats?.tasks && (
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Chip label={`总数: ${stats.tasks.total ?? '-'}`} size="small" />
              <Chip label={`运行中: ${stats.tasks.running ?? '-'}`} size="small" color="info" />
              <Chip label={`已完成: ${stats.tasks.completed ?? '-'}`} size="small" color="success" />
            </Box>
          )}
        </Box>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>任务名</TableCell>
              <TableCell>状态</TableCell>
              <TableCell>创建时间</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={3}>加载中…</TableCell></TableRow>
            ) : !hasTasks ? (
              <TableRow><TableCell colSpan={3}>后端未暴露任务列表 API，已显示统计信息</TableCell></TableRow>
            ) : (
              tasks!.map((t: any, idx: number) => (
                <TableRow key={t.id ?? idx}>
                  <TableCell>{t.name || t.title || '-'}</TableCell>
                  <TableCell>{t.status || '-'}</TableCell>
                  <TableCell>{t.created_at || '-'}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

