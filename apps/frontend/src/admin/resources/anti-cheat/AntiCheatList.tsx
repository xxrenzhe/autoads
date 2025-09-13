'use client'

import React, { useState, useEffect } from 'react'
import { 
  List, 
  Datagrid, 
  TextField, 
  DateField, 
  BooleanField,
  NumberField,
  useListContext,
  useRefresh,
  TopToolbar,
  ExportButton,
  CreateButton,
  FilterButton,
  SearchInput,
  Pagination,
  ReferenceField,
  Button,
  ChipField,
  SelectInput
} from 'react-admin'
import { 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  Activity,
  Users,
  AlertOctagon,
  TrendingUp,
  Clock,
  MapPin,
  Fingerprint,
  RefreshCw
} from 'lucide-react'
import { Card, CardContent, Typography, Box, Stack } from '@mui/material'

const postFilters = [
  <SearchInput key="search" source="q" alwaysOn />,
  <SelectInput 
    key="isSuspicious"
    source="isSuspicious" 
    label="可疑状态" 
    choices={[
      { id: 'true', name: '可疑' },
      { id: 'false', name: '正常' }
    ]}
    alwaysOn
  />,
]

const StatsCard = ({ title, value, icon: Icon, color, trend }: { 
  title: string; 
  value: number; 
  icon: any; 
  color: string; 
  trend?: string 
}) => (
  <Card sx={{ height: '100%' }}>
    <CardContent>
      <Stack direction="row" alignItems="center" spacing={2}>
        <Icon style={{ color, fontSize: 28 }} />
        <Box>
          <Typography variant="body2" color="text.secondary">
            {title}
          </Typography>
          <Typography variant="h4" fontWeight="bold" color={color}>
            {value}
          </Typography>
          {trend && (
            <Typography variant="caption" color="text.secondary">
              {trend}
            </Typography>
          )}
        </Box>
      </Stack>
    </CardContent>
  </Card>
)

const SuspiciousDevicesList = () => {
  const { data, isLoading } = useListContext()
  const [stats, setStats] = useState({
    multiAccountDevices: 0,
    newAccountsWithCheckIn: 0,
    highFrequencyDevices: 0,
    totalCheckIns: 0
  })
  
  useEffect(() => {
    if (data) => {
      // Calculate advanced statistics
      const deviceGroupings = data.reduce((acc: any, device: any) => {
        if (!acc[device.fingerprint]) => {
          acc[device.fingerprint] = []
        }
        acc[device.fingerprint].push(device)
        return acc
      }, {})

      const multiAccountDevices = Object.values(deviceGroupings).filter(
        (group: unknown) => Array.isArray(group) && group.length > 1
      ).length

      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
      const newAccountsWithCheckIn = data.filter(
        (device: any) => new Date(device.user?.createdAt) > oneDayAgo
      ).length

      const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000)
      const highFrequencyDevices = data.filter(
        (device: any) => new Date(device.lastSeenAt) > sixHoursAgo
      ).length

      const totalCheckIns = data.reduce(
        (sum: any, device: any) => sum + (device.user?.checkInsCount || 0), 0
      )

      setStats({
        multiAccountDevices,
        newAccountsWithCheckIn,
        highFrequencyDevices,
        totalCheckIns
      })
    }
  }, [data])
  
  if (isLoading) return <div>加载中...</div>
  
  const suspiciousCount = data?.filter((d: any) => d.isSuspicious).length || 0
  const totalDevices = data?.length || 0
  
  return (
    <Box sx={{ p: 2 }}>
      {/* 统计卡片 */}
      <Box sx={{ 
        display: 'grid', 
        gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
        gap: 2,
        mb: 3
      }}>
        <StatsCard
          title="设备总数"
          value={totalDevices}
          icon={Users}
          color="primary.main"
          trend={undefined}
        />
        
        <StatsCard
          title="可疑设备"
          value={suspiciousCount}
          icon={AlertTriangle}
          color="warning.main"
          trend={`${totalDevices > 0 ? Math.round((suspiciousCount / totalDevices) * 100) : 0}% 可疑率`}
        />
        
        <StatsCard
          title="多账号设备"
          value={stats.multiAccountDevices}
          icon={Fingerprint}
          color="error.main"
          trend={undefined}
        />
        
        <StatsCard
          title="24小时新账号"
          value={stats.newAccountsWithCheckIn}
          icon={Clock}
          color="info.main"
          trend={undefined}
        />
      </Box>

      {/* 详细统计 */}
      <Box sx={{ 
        display: 'grid', 
        gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
        gap: 2,
        mb: 3
      }}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              <TrendingUp style={{ marginRight: 8, verticalAlign: 'middle' }} />
              活动统计
            </Typography>
            <Stack spacing={1}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2">高频活跃设备</Typography>
                <Typography variant="body2" fontWeight="bold">
                  {stats.highFrequencyDevices}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2">总签到次数</Typography>
                <Typography variant="body2" fontWeight="bold">
                  {stats.totalCheckIns}
                </Typography>
              </Box>
            </Stack>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              <MapPin style={{ marginRight: 8, verticalAlign: 'middle' }} />
              地域分布
            </Typography>
            <Stack spacing={1}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2">不同IP地址</Typography>
                <Typography variant="body2" fontWeight="bold">
                  {new Set(data?.map((d: any) => d.firstIP)).size}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2">不同用户代理</Typography>
                <Typography variant="body2" fontWeight="bold">
                  {new Set(data?.map((d: any) => d.userAgent)).size}
                </Typography>
              </Box>
            </Stack>
          </CardContent>
        </Card>
      </Box>
      
      {/* 数据表格 */}
      <Card>
        <Datagrid 
          rowClick="show"
          bulkActionButtons={false}
          sx={{
            '& .RaDatagrid-rowCell': {
              verticalAlign: 'middle'
            }
          }}
        >
          <ReferenceField 
            source="userId" 
            reference="users"
            link="show"
            label="用户"
          >
            <TextField source="email" />
          </ReferenceField>
          
          <TextField 
            source="fingerprint" 
            label="设备指纹"
            sx={{ 
              fontFamily: 'monospace',
              fontSize: '0.875rem'
            }}
          />
          
          <TextField 
            source="userAgent" 
            label="用户代理"
            sx={{ 
              maxWidth: '300px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
          />
          
          <TextField 
            source="firstIP" 
            label="首次IP"
          />
          
          <TextField 
            source="lastIP" 
            label="最后IP"
          />
          
          <DateField 
            source="firstSeenAt" 
            label="首次发现"
            showTime
            locales="zh-CN"
          />
          
          <DateField 
            source="lastSeenAt" 
            label="最后活跃"
            showTime
            locales="zh-CN"
          />
          
          <ChipField 
            source="suspiciousScore"
            label="可疑分数"
            color={((record: any) => {
              const score = record.suspiciousScore;
              return score >= 80 ? 'error' : score >= 50 ? 'warning' : 'default';
            }) as any}
          />
          
          <BooleanField 
            source="isSuspicious" 
            label="可疑状态"
            TrueIcon={XCircle as any}
            FalseIcon={CheckCircle as any}
            sx={{
              '& .RaBooleanField-true': { color: '#ef4444' },
              '& .RaBooleanField-false': { color: '#10b981' }
            }}
          />
        </Datagrid>
      </Card>
    </Box>
  )
}

const ListActions = () => {
  const refresh = useRefresh()
  
  return (
    <TopToolbar>
      <FilterButton />
      <Button 
        label="刷新数据" 
        onClick={() => refresh()}
        sx={{ mr: 1 }}
      >
        <RefreshCw />
      </Button>
      <ExportButton maxResults={10000} />
    </TopToolbar>
  )
}

export const AntiCheatList = () => (
  <List
    resource="user-devices"
    filters={postFilters}
    actions={<ListActions />}
    perPage={20}
    pagination={<Pagination rowsPerPageOptions={[10, 20, 50, 100]} />}
    sort={{ field: 'lastSeenAt', order: 'DESC' }}
    title="防作弊监控"
  >
    <SuspiciousDevicesList />
  </List>
)