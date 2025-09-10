import React from 'react';
import {
  List,
  Datagrid,
  TextField,
  NumberField,
  DateField,
  ReferenceField,
  BooleanField,
  EditButton,
  FilterButton,
  ExportButton,
  TopToolbar,
  SearchInput,
  SelectInput,
  useRecordContext,
} from 'react-admin';
import { Chip, Box, Typography } from '@mui/material';
import { TrendingUp, TrendingDown } from '@mui/icons-material';

const tokenUsageFilters = [
  <SearchInput key="search" source="q" alwaysOn />,
  <SelectInput
    key="period"
    source="period"
    choices={[
      { id: 'today', name: '今天' },
      { id: 'thisWeek', name: '本周' },
      { id: 'thisMonth', name: '本月' },
    ]}
    defaultValue="thisMonth"
  />,
];

const UsageTrendField: React.FC = () => {
  const record = useRecordContext();
  if (!record) return null as any;
  
  const trend = record.usageTrend || 0;
  const isPositive = trend >= 0;
  
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      {isPositive ? (
        <TrendingUp color="success" fontSize="small" />
      ) : (
        <TrendingDown color="error" fontSize="small" />
      )}
      <Typography
        variant="body2"
        color={isPositive ? 'success.main' : 'error.main'}
      >
        {Math.abs(trend)}%
      </Typography>
    </Box>
  );
};

const TokenUsageListActions: React.FC = () => (
  <TopToolbar>
    <FilterButton />
    <ExportButton />
  </TopToolbar>
);

export const TokenList: React.FC = () => {
  return (
    <List
      filters={tokenUsageFilters}
      actions={<TokenUsageListActions />}
      perPage={25}
      sort={{ field: 'usageThisMonth', order: 'DESC' }}
    >
      <Datagrid rowClick="edit">
        <ReferenceField 
          source="userId" 
          reference="users"
          link="show"
          label="用户"
        >
          <TextField source="email" />
        </ReferenceField>
        
        <ReferenceField 
          source="userId" 
          reference="users"
          link={false}
          label="角色"
        >
          <TextField source="role" />
        </ReferenceField>
        
        <NumberField 
          source="tokenBalance" 
          label="当前余额"
          options={{ style: 'decimal' }}
        />
        
        <NumberField 
          source="tokenUsedThisMonth" 
          label="本月已用"
          options={{ style: 'decimal' }}
        />
        
        <NumberField 
          source="tokenUsedToday" 
          label="今日已用"
          options={{ style: 'decimal' }}
        />
        
        <NumberField 
          source="avgDailyUsage" 
          label="日均使用"
          options={{ style: 'decimal' }}
        />
        
        <UsageTrendField />
        
        <DateField 
          source="lastTokenReset" 
          label="最后重置"
          showTime
        />
        
        <NumberField 
          source="totalTokenPurchased" 
          label="总购买量"
          options={{ style: 'decimal' }}
        />
        
        <NumberField 
          source="totalTokenUsed" 
          label="总使用量"
          options={{ style: 'decimal' }}
        />
        
        <EditButton />
      </Datagrid>
    </List>
  );
};