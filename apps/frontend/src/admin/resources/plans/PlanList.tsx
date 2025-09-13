import React, { useState } from 'react';
import {
  List,
  Datagrid,
  TextField,
  NumberField,
  BooleanField,
  EditButton,
  DeleteButton,
  CreateButton,
  FilterButton,
  ExportButton,
  TopToolbar,
  SearchInput,
  BooleanInput,
  usePermissions,
  useRecordContext,
  useNotify,
  Confirm,
} from 'react-admin';
import { Chip, Box, Typography, Tooltip, Button } from '@mui/material';
import { Refresh as RefreshIcon } from '@mui/icons-material';

/**
 * Plan list filters
 */
const planFilters = [
  <SearchInput key="search" source="q" alwaysOn />,
  <BooleanInput key="active" source="active" />,
  <BooleanInput key="featured" source="featured" />,
];

/**
 * Custom price field component with yearly discount info
 */
const PriceField: React.FC = () => {
  const record = useRecordContext();
  if (!record) return null as any;

  const yearlyDiscount = record.metadata?.yearlyDiscount || 0;
  const yearlyPrice = record.price * 12 * (1 - yearlyDiscount);

  return (
    <Box>
      <Typography variant="body1">
        ¥{record.price}/月
      </Typography>
      {yearlyDiscount > 0 && (
        <Tooltip title={`年付仅需 ¥${yearlyPrice.toFixed(2)}`}>
          <Chip 
            label={`年付${yearlyDiscount * 100}%off`}
            size="small"
            color="secondary"
            sx={{ mt: 0.5 }}
          />
        </Tooltip>
      )}
    </Box>
  );
};

/**
 * Custom features field component
 */
const FeaturesField: React.FC = () => {
  const record = useRecordContext();
  if (!record?.features) return null as any;

  const features = Array.isArray(record.features) ? record.features : [];
  const displayCount = Math.min(features.length, 3);
  
  return (
    <Box sx={{ maxWidth: 250 }}>
      {features.slice(0, displayCount).map((feature: string, index: number: any) => (
        <Chip
          key={index}
          label={feature}
          size="small"
          variant="outlined"
          sx={{ mr: 0.5, mb: 0.5 }}
        />
      ))}
      {features.length > displayCount && (
        <Typography variant="caption" color="text.secondary">
          +{features.length - displayCount} 更多
        </Typography>
      )}
    </Box>
  );
};

/**
 * Plan stats component
 */
const PlanStats: React.FC = () => {
  const record = useRecordContext();
  if (!record) return null as any;
  
  return (
    <Box>
      <Typography variant="body2" color="text.secondary">
        订阅数
      </Typography>
      <Typography variant="h6">
        {record.subscriptionCount || 0}
      </Typography>
    </Box>
  );
};

/**
 * List actions toolbar
 */
const PlanListActions: React.FC = () => {
  const { permissions } = usePermissions();
  const canCreate = permissions?.includes('write:plans');
  const notify = useNotify();
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const initializeDefaults = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/plans/initialize-defaults', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (data.success) {
        notify(`成功初始化${data.plans.length}个默认套餐`, { type: 'success' });
        // Refresh the page to show new plans
        window.location.reload();
      } else {
        notify(data.error || '初始化失败', { type: 'error' });
      }
    } catch (error) {
      notify('初始化失败：网络错误', { type: 'error' });
    } finally {
      setLoading(false);
      setOpen(false);
    }
  };

  const handleConfirm = () => {
    initializeDefaults();
  };

  const handleDialogClose = () => {
    setOpen(false);
  };

  const handleClick = () => {
    setOpen(true);
  };

  return (
    <>
      <TopToolbar>
        <FilterButton />
        {canCreate && <CreateButton />}
        <Button
          onClick={handleClick}
          disabled={loading}
          startIcon={<RefreshIcon />}
          color="secondary"
        >
          初始化默认套餐
        </Button>
        <ExportButton />
      </TopToolbar>
      <Confirm
        isOpen={open}
        title="确认操作"
        content="确定要初始化默认套餐吗？这将创建或更新免费、高级和白金三个套餐。"
        onConfirm={handleConfirm}
        onClose={handleDialogClose}
        loading={loading}
      />
    </>
  );
};

/**
 * Plan list component
 */
export const PlanList: React.FC = () => {
  const { permissions } = usePermissions();
  const canEdit = permissions?.includes('write:plans');
  const canDelete = permissions?.includes('delete:plans');

  return (
    <List
      filters={planFilters}
      actions={<PlanListActions />}
      perPage={25}
      sort={{ field: 'displayOrder', order: 'ASC' }}
    >
      <Datagrid rowClick="edit">
        <TextField source="id" label="套餐ID" />
        <TextField source="name" label="套餐名称" />
        <TextField 
          source="description" 
          label="描述" 
          sx={{ maxWidth: 200 }}
        />
        
        <PriceField />
        
        <TextField source="currency" label="币种" />
        <TextField source="interval" label="计费周期" />
        <NumberField 
          source="tokenQuota" 
          label="Token配额" 
          options={{ style: 'decimal' }}
        />
        <NumberField 
          source="rateLimit" 
          label="速率限制" 
        />
        
        <BooleanField source="isActive" label="激活" />
        
        <FeaturesField />
        <PlanStats />
        
        {/* Action buttons based on permissions */}
        {canEdit && <EditButton />}
      </Datagrid>
    </List>
  );
};