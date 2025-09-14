import React from 'react';
import { useAdminGoflyUsers } from '@/lib/hooks/admin/useAdminGoflyUsers';
import { Card, CardContent, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';

export default function GoFlyUsersPreview() {
  const { data, isLoading } = useAdminGoflyUsers({ page: 1, limit: 5 });
  const list = Array.isArray((data as any)?.data) ? (data as any).data as any[]
             : (data as any)?.data?.list && Array.isArray((data as any).data.list) ? (data as any).data.list as any[]
             : [];

  return (
    <Card variant="outlined" sx={{ mb: 2 }}>
      <CardContent>
        <Typography variant="h6" sx={{ mb: 1 }}>最近用户（GoFly 实时）</Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Email/用户名</TableCell>
              <TableCell>状态</TableCell>
              <TableCell>创建时间</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={3}>加载中…</TableCell></TableRow>
            ) : list.length === 0 ? (
              <TableRow><TableCell colSpan={3}>暂无数据</TableCell></TableRow>
            ) : (
              list.map((u: any, idx: number) => (
                <TableRow key={u.id ?? idx}>
                  <TableCell>{u.email || u.username || '-'}</TableCell>
                  <TableCell>{u.status || '-'}</TableCell>
                  <TableCell>{u.created_at || '-'}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
