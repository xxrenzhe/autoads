import React from 'react';
import {
  List,
  Datagrid,
  TextField,
  DateField,
  NumberField,
  BooleanField,
  ReferenceField,
  EditButton,
  ShowButton,
  CreateButton,
  FilterButton,
  ExportButton,
  TopToolbar,
  SearchInput,
  SelectInput,
  DateInput,
  usePermissions,
  useListContext,
} from 'react-admin';
import { Chip, Box, Typography, Card, CardContent } from '@mui/material';
import { mapStatusToChipColor } from '../../../lib/utils/common/mui-color-mapper';
import { SubscriptionActions } from './SubscriptionActions';

/**
 * Subscription status choices
 */
const statusChoices = [
  { id: 'active', name: '激活' },
  { id: 'inactive', name: '未激活' },
  { id: 'cancelled', name: '已取消' },
  { id: 'expired', name: '已过期' },
  { id: 'trial', name: '试用' },
];

/**
 * Subscription list filters
 */
const subscriptionFilters = [
  <SearchInput key="search" source="q" alwaysOn />,
  <SelectInput
    key="status"
    source="status"
    choices={statusChoices}
  />,
  <DateInput key="expiresAfter" source="expiresAfter" label="Expires After" />,
  <DateInput key="expiresBefore" source="expiresBefore" label="Expires Before" />,
];

/**
 * Custom status field component
 */
const StatusField: React.FC<{ record?: any }> = ({ record }) => {
  if (!record) return null as any;

  return (
    <Chip
      label={record.status}
      color={mapStatusToChipColor(record.status)}
      size="small"
    />
  );
};

/**
 * Trial indicator field component
 */
const TrialIndicatorField: React.FC<{ record?: any }> = ({ record }) => {
  if (!record) return null as any;
  
  const isTrial = record.provider === 'system' && 
                 record.providerSubscriptionId?.startsWith('trial_');
  
  return isTrial ? (
    <Chip 
      label="试用" 
      size="small" 
      color="warning" 
      variant="outlined"
    />
  ) : null;
};

/**
 * List actions toolbar
 */
const SubscriptionListActions: React.FC = () => {
  const { permissions } = usePermissions();
  const canCreate = permissions?.includes('subscriptions:edit');

  return (
    <TopToolbar>
      <FilterButton />
      {canCreate && <CreateButton />}
      <ExportButton />
    </TopToolbar>
  );
};

/**
 * Subscription statistics component
 */
const SubscriptionStats: React.FC = () => {
  const { data, isLoading } = useListContext();
  
  if (isLoading || !data) return null;
  
  // Calculate statistics
  const stats = data.reduce((acc, subscription) => {
    const planName = subscription.plan?.name || 'Unknown';
    const isTrial = subscription.provider === 'system' && 
                    subscription.providerSubscriptionId?.startsWith('trial_');
    
    acc.total++;
    
    if (subscription.status === 'ACTIVE') {
      acc.active++;
    }
    
    if (isTrial) {
      acc.trials++;
    }
    
    acc.byPlan[planName] = (acc.byPlan[planName] || 0) + 1;
    
    return acc;
  }, {
    total: 0,
    active: 0,
    trials: 0,
    byPlan: {} as Record<string, number>
  });
  
  return (
    <Box sx={{ mb: 3 }}>
      <Card>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            订阅统计概览
          </Typography>
          <Box sx={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            <Box>
              <Typography variant="body2" color="text.secondary">
                总订阅数
              </Typography>
              <Typography variant="h4">
                {stats.total}
              </Typography>
            </Box>
            <Box>
              <Typography variant="body2" color="text.secondary">
                活跃订阅
              </Typography>
              <Typography variant="h4" color="success.main">
                {stats.active}
              </Typography>
            </Box>
            <Box>
              <Typography variant="body2" color="text.secondary">
                试用订阅
              </Typography>
              <Typography variant="h4" color="warning.main">
                {stats.trials}
              </Typography>
            </Box>
            <Box>
              <Typography variant="body2" color="text.secondary">
                套餐分布
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
                {Object.entries(stats.byPlan).map(([plan, count]) => (
                  <Chip 
                    key={plan}
                    label={`${plan}: ${count}`}
                    size="small"
                    variant="outlined"
                  />
                ))}
              </Box>
            </Box>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

/**
 * Subscription list component
 */
export const SubscriptionList: React.FC = () => {
  const { permissions } = usePermissions();
  const canEdit = permissions?.includes('subscriptions:edit');
  const canView = permissions?.includes('subscriptions:view');

  return (
    <List
      filters={subscriptionFilters}
      actions={<SubscriptionListActions />}
      perPage={25}
      sort={{ field: 'createdAt', order: 'DESC' }}
    >
      <SubscriptionStats />
      <Datagrid>
        <TextField source="id" />
        
        <ReferenceField source="userId" reference="users">
          <TextField source="name" />
        </ReferenceField>
        
        <ReferenceField source="planId" reference="plans">
          <TextField source="name" />
        </ReferenceField>
        
        <StatusField />
        
        {/* Trial indicator */}
        <TrialIndicatorField />
        
        <NumberField
          source="monthlyPrice"
          options={{
            style: 'currency',
            currency: 'USD',
          }}
        />
        
        <DateField source="startDate" />
        <DateField source="endDate" />
        <DateField source="nextBillingDate" />
        
        <BooleanField source="autoRenew" />
        
        <NumberField source="usageCount" label="Usage" />
        <NumberField source="usageLimit" label="Limit" />
        
        <DateField source="createdAt" showTime />
        
        {/* Action buttons based on permissions */}
        <Box sx={{ display: 'flex', gap: 1 }}>
          {canEdit && <SubscriptionActions />}
          {canView && <ShowButton />}
          {canEdit && <EditButton />}
        </Box>
      </Datagrid>
    </List>
  );
};