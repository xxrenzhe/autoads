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
import { Chip, Box, Typography } from '@mui/material';
import { Add, Remove } from '@mui/icons-material';

const transactionFilters = [
  <SearchInput key="search" source="q" alwaysOn />,
  <SelectInput
    key="type"
    source="type"
    choices={[
      { id: 'purchase', name: '购买' },
      { id: 'usage', name: '使用' },
      { id: 'bonus', name: '奖励' },
      { id: 'penalty', name: '扣减' },
      { id: 'refund', name: '退款' },
      { id: 'adjustment', name: '调整' },
      { id: 'reset', name: '重置' },
    ]}
  />,
  <SelectInput
    key="period"
    source="period"
    choices={[
      { id: 'today', name: '今天' },
      { id: 'thisWeek', name: '本周' },
      { id: 'thisMonth', name: '本月' },
      { id: 'lastMonth', name: '上月' },
    ]}
    defaultValue="thisMonth"
  />,
];

const TransactionTypeField: React.FC<{ label?: string }> = ({ label }) => {
  const record = useRecordContext();
  if (!record) return null as any;
  
  const typeColors = {
    purchase: 'primary',
    usage: 'secondary',
    bonus: 'success',
    penalty: 'error',
    refund: 'warning',
    adjustment: 'info',
    reset: 'default',
  };
  
  const typeLabels = {
    purchase: '购买',
    usage: '使用',
    bonus: '奖励',
    penalty: '扣减',
    refund: '退款',
    adjustment: '调整',
    reset: '重置',
  };
  
  return (
    <Chip
      icon={record.amount > 0 ? <Add /> : <Remove />}
      label={typeLabels[record.type as keyof typeof typeLabels] || record.type}
      color={typeColors[record.type as keyof typeof typeColors] as any}
      size="small"
    />
  );
};

const AmountField: React.FC<{ label?: string }> = ({ label }) => {
  const record = useRecordContext();
  if (!record) return null as any;
  
  const isPositive = record.amount > 0;
  
  return (
    <Typography
      variant="body2"
      color={isPositive ? 'success.main' : 'error.main'}
      sx={{ fontWeight: 'bold' }}
    >
      {isPositive ? '+' : ''}{record.amount}
    </Typography>
  );
};

const TransactionListActions: React.FC = () => (
  <TopToolbar>
    <FilterButton />
    <ExportButton />
  </TopToolbar>
);

export const TransactionList: React.FC = () => {
  return (
    <List
      filters={transactionFilters}
      actions={<TransactionListActions />}
      perPage={25}
      sort={{ field: 'createdAt', order: 'DESC' }}
    >
      <Datagrid>
        <DateField 
          source="createdAt" 
          label="时间"
          showTime
        />
        
        <ReferenceField 
          source="userId" 
          reference="users"
          link="show"
          label="用户"
        >
          <TextField source="email" />
        </ReferenceField>
        
        <TransactionTypeField label="类型" />
        <AmountField label="数量" />
        
        <TextField 
          source="description" 
          sx={{ maxWidth: 200 }}
        />
        
        <TextField 
          source="referenceId" 
          sx={{ maxWidth: 150 }}
        />
        
        <TextField 
          source="balanceAfter" 
        />
        
        <TextField 
          source="createdBy" 
        />
      </Datagrid>
    </List>
  );
};