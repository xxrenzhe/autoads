import React, { useState, useEffect } from 'react';
import { useAdminGoflyConfig, useUpdateAdminGoflyConfig } from '@/lib/hooks/admin/useAdminGoflyConfig';
import { Card, CardContent, TextField, Button, Grid, Typography } from '@mui/material';

export default function GoFlyConfigPanel() {
  const { data, isLoading } = useAdminGoflyConfig();
  const updateMutation = useUpdateAdminGoflyConfig();
  const [form, setForm] = useState({
    app_name: '',
    api_rate_limit: '',
    max_concurrent: '',
    cache_ttl: '',
  });

  useEffect(() => {
    if (data) {
      setForm({
        app_name: String((data as any).app_name ?? ''),
        api_rate_limit: String((data as any).api_rate_limit ?? ''),
        max_concurrent: String((data as any).max_concurrent ?? ''),
        cache_ttl: String((data as any).cache_ttl ?? ''),
      });
    }
  }, [data]);

  const onChange = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, [k]: e.target.value }));
  };

  const onSave = async () => {
    await updateMutation.mutateAsync({
      app_name: form.app_name,
      api_rate_limit: Number(form.api_rate_limit) || form.api_rate_limit,
      max_concurrent: Number(form.max_concurrent) || form.max_concurrent,
      cache_ttl: Number(form.cache_ttl) || form.cache_ttl,
    });
  };

  return (
    <Card variant="outlined" sx={{ mb: 2 }}>
      <CardContent>
        <Typography variant="h6" sx={{ mb: 1 }}>系统配置（GoFly 实时）</Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <TextField label="应用名" fullWidth size="small" value={form.app_name} onChange={onChange('app_name')} disabled={isLoading || updateMutation.isPending} />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField label="API 限流" fullWidth size="small" value={form.api_rate_limit} onChange={onChange('api_rate_limit')} disabled={isLoading || updateMutation.isPending} />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField label="最大并发" fullWidth size="small" value={form.max_concurrent} onChange={onChange('max_concurrent')} disabled={isLoading || updateMutation.isPending} />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField label="缓存 TTL" fullWidth size="small" value={form.cache_ttl} onChange={onChange('cache_ttl')} disabled={isLoading || updateMutation.isPending} />
          </Grid>
          <Grid item xs={12}>
            <Button variant="contained" onClick={onSave} disabled={isLoading || updateMutation.isPending}>保存</Button>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
}

