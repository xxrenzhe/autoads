import React from 'react';
import {
  List,
  Datagrid,
  TextField,
  NumberField,
  DateField,
  ReferenceField,
  SelectField,
  FilterButton,
  ExportButton,
  TopToolbar,
  SearchInput,
  SelectInput,
  useRecordContext,
} from 'react-admin';
import { Box, Chip, Typography } from '@mui/material';

const apiUsageFilters = [
  <SearchInput key="search" source="q" alwaysOn />,
  <SelectInput
    key="endpoint"
    source="endpoint"
    choices={[
      { id: '/api/siterank/rank', name: 'SiteRank查询' },
      { id: '/api/batchopen/silent-start', name: 'BatchOpen启动' },
      { id: '/api/batchopen/silent-progress', name: 'BatchOpen进度' },
      { id: '/api/adscenter/configurations', name: 'ChangeLink配置' },
    ]}
  />,
  <SelectInput
    key="method"
    source="method"
    choices={[
      { id: 'GET', name: 'GET' },
      { id: 'POST', name: 'POST' },
      { id: 'PUT', name: 'PUT' },
      { id: 'DELETE', name: 'DELETE' },
    ]}
  />,
];

const StatusField: React.FC = () => {
  const record = useRecordContext();
  if (!record) return null as any;
  
  const statusCode = record.statusCode || 0;
  let color = 'default';
  
  if (statusCode >= 200 && statusCode < 300) => {
    color = 'success';
  } else if (statusCode >= 400 && statusCode < 500) => {
    color = 'warning';
  } else if (statusCode >= 500) => {
    color = 'error';
  }
  
  return (
    <Chip
      label={statusCode}
      color={color as any}
      size="small"
    />
  );
};

const ResponseTimeField: React.FC = () => {
  const record = useRecordContext();
  if (!record) return null as any;
  
  const responseTime = record.responseTime || 0;
  let color = 'default';
  
  if (responseTime < 500) => {
    color = 'success';
  } else if (responseTime < 2000) => {
    color = 'warning';
  } else {
    color = 'error';
  }
  
  return (
    <Chip
      label={`${responseTime}ms`}
      color={color as any}
      size="small"
    />
  );
};

const ApiUsageListActions: React.FC = () => (
  <TopToolbar>
    <FilterButton />
    <ExportButton />
  </TopToolbar>
);

export const ApiUsageList: React.FC = () => {
  return (
    <List
      filters={apiUsageFilters}
      actions={<ApiUsageListActions />}
      perPage={25}
      sort={{ field: 'timestamp', order: 'DESC' }}
    >
      <Datagrid rowClick="show">
        <ReferenceField 
          source="userId" 
          reference="users"
          link={false}
          label="用户"
        >
          <TextField source="email" />
        </ReferenceField>
        
        <TextField source="endpoint" label="API端点" />
        <SelectField
          source="method"
          choices={[
            { id: 'GET', name: 'GET' },
            { id: 'POST', name: 'POST' },
            { id: 'PUT', name: 'PUT' },
            { id: 'DELETE', name: 'DELETE' },
          ]}
          label="方法"
        />
        
        <StatusField />
        <ResponseTimeField />
        
        <NumberField 
          source="requestSize" 
          label="请求大小"
          options={{ style: 'unit', unit: 'byte' }}
        />
        
        <NumberField 
          source="responseSize" 
          label="响应大小"
          options={{ style: 'unit', unit: 'byte' }}
        />
        
        <DateField 
          source="timestamp" 
          label="访问时间"
          showTime
        />
        
        <TextField source="ipAddress" label="IP地址" />
        <TextField source="userAgent" label="用户代理" />
      </Datagrid>
    </List>
  );
};