import React from 'react';
import {
  List,
  Datagrid,
  TextField,
  NumberField,
  EditButton,
  CreateButton,
  FilterButton,
  ExportButton,
  TopToolbar,
  SearchInput,
  SelectInput,
  useRecordContext,
  usePermissions,
} from 'react-admin';
import { Chip, Box, Typography } from '@mui/material';
import { Speed, Timer, Block } from '@mui/icons-material';

/**
 * Rate limit list filters
 */
const rateLimitFilters = [
  <SearchInput key="search" source="q" alwaysOn />,
  <SelectInput
    key="type"
    source="type"
    choices={[
      { id: 'api', name: 'API调用' },
      { id: 'siterank', name: 'SiteRank查询' },
      { id: 'batchopen', name: 'BatchOpen任务' },
      { id: 'adscenter', name: 'AdsCenter活动' },
    ]}
    label="类型"
  />,
  <SelectInput
    key="scope"
    source="scope"
    choices={[
      { id: 'global', name: '全局' },
      { id: 'user', name: '用户级别' },
      { id: 'plan', name: '套餐级别' },
    ]}
    label="作用域"
  />,
];

/**
 * Rate limit status component
 */
const RateLimitStatus: React.FC = () => {
  const record = useRecordContext();
  if (!record) return null as any;
  
  const isActive = record.isActive !== false;
  
  return (
    <Chip
      icon={isActive ? <Speed /> : <Block />}
      label={isActive ? '启用' : '禁用'}
      color={isActive ? 'success' : 'default'}
      size="small"
    />
  );
};

/**
 * Rate limit info component
 */
const RateLimitInfo: React.FC = () => {
  const record = useRecordContext();
  if (!record) return null as any;
  
  return (
    <Box>
      <Typography variant="body2" color="text.secondary">
        限制
      </Typography>
      <Typography variant="h6">
        {record.requestsPerWindow} 次 / {record.windowSize}
      </Typography>
    </Box>
  );
};

/**
 * List actions toolbar
 */
const RateLimitListActions: React.FC = () => {
  const { permissions } = usePermissions();
  const canCreate = permissions?.includes('config:edit');

  return (
    <TopToolbar>
      <FilterButton />
      {canCreate && <CreateButton />}
      <ExportButton />
    </TopToolbar>
  );
};

/**
 * Rate limit list component
 */
export const RateLimitList: React.FC = () => {
  const { permissions } = usePermissions();
  const canEdit = permissions?.includes('config:edit');

  return (
    <List 
      title="限速配置管理"
      filters={rateLimitFilters}
      actions={<RateLimitListActions />}
      perPage={25}
      sort={{ field: 'type', order: 'ASC' }}
    >
      <Datagrid rowClick={canEdit ? "edit" : false}>
        <TextField source="id" label="配置ID" />
        
        <TextField 
          source="type" 
          label="类型"
          sx={{ textTransform: 'capitalize' }}
        />
        
        <TextField 
          source="scope" 
          label="作用域"
          sx={{ textTransform: 'capitalize' }}
        />
        
        <NumberField 
          source="requestsPerWindow" 
          label="请求数"
          textAlign="center"
        />
        
        <TextField 
          source="windowSize" 
          label="时间窗口"
        />
        
        <RateLimitInfo />
        <RateLimitStatus />
        
        <TextField 
          source="target" 
          label="目标"
          sx={{ maxWidth: 150 }}
        />
        
        {canEdit && <EditButton />}
      </Datagrid>
    </List>
  );
};
