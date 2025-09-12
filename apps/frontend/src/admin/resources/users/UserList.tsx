import React from 'react';
import {
  List,
  Datagrid,
  TextField,
  EmailField,
  DateField,
  BooleanField,
  NumberField,
  EditButton,
  DeleteButton,
  ShowButton,
  FilterButton,
  CreateButton,
  ExportButton,
  BulkDeleteButton,
  BulkExportButton,
  TopToolbar,
  SearchInput,
  SelectInput,
  BooleanInput,
  ReferenceField,
  NumberInput,
  usePermissions,
  useRecordContext,
  useUpdate,
  useNotify,
  useRefresh,
  Button,
  Confirm,
  useUnselectAll,
} from 'react-admin';
import { Chip, Box, Typography } from '@mui/material';
import { TrendingUp, TrendingDown, Block, CheckCircle, Add, Subscriptions } from '@mui/icons-material';

/**
 * Simplified user list filters - keeping only essential filters
 */
const userFilters = [
  <SearchInput key="search" source="q" alwaysOn placeholder="搜索用户姓名或邮箱" />,
  <SelectInput
    key="role"
    source="role"
    choices={[
      { id: 'USER', name: '普通用户' },
      { id: 'ADMIN', name: '管理员' },
    ]}
    label="角色"
  />,
  <SelectInput
    key="status"
    source="status"
    choices={[
      { id: 'ACTIVE', name: '活跃' },
      { id: 'INACTIVE', name: '未激活' },
      { id: 'BANNED', name: '封禁' },
    ]}
    label="状态"
  />,
  <SelectInput
    key="hasSubscription"
    source="hasSubscription"
    choices={[
      { id: 'true', name: '有订阅' },
      { id: 'false', name: '无订阅' },
    ]}
    label="订阅状态"
  />,
];

/**
 * Custom role field component
 */
const RoleField: React.FC<{ label?: string }> = ({ label }) => {
  const record = useRecordContext();
  if (!record) return null as any;
  
  const roleColors = {
    USER: 'default',
    ADMIN: 'primary',
  };
  
  const roleLabels = {
    USER: '普通用户',
    ADMIN: '管理员',
  };
  
  return (
    <Chip
      label={roleLabels[record.role as keyof typeof roleLabels] || record.role}
      color={roleColors[record.role as keyof typeof roleColors] as any}
      size="small"
    />
  );
};

/**
 * Custom status field component
 */
const StatusField: React.FC<{ label?: string }> = ({ label }) => {
  const record = useRecordContext();
  if (!record) return null as any;
  
  const statusColors = {
    ACTIVE: 'success',
    INACTIVE: 'default',
    BANNED: 'error',
  };
  
  const statusLabels = {
    ACTIVE: '活跃',
    INACTIVE: '未激活',
    BANNED: '封禁',
  };
  
  return (
    <Chip
      label={statusLabels[record.status as keyof typeof statusLabels] || record.status}
      color={statusColors[record.status as keyof typeof statusColors] as any}
      size="small"
    />
  );
};

/**
 * Token usage field component
 */
const TokenUsageField: React.FC<{ label?: string }> = ({ label }) => {
  const record = useRecordContext();
  if (!record) return null as any;
  
  const usagePercentage = record.tokenBalance > 0 
    ? (record.tokenUsedThisMonth / (record.tokenUsedThisMonth + record.tokenBalance)) * 100 
    : 0;
  
  return (
    <Box>
      <Typography variant="body2">
        {record.tokenUsedThisMonth} / {record.tokenBalance + record.tokenUsedThisMonth}
      </Typography>
      <Typography 
        variant="caption" 
        color={usagePercentage > 80 ? 'error.main' : 'text.secondary'}
      >
        {usagePercentage.toFixed(1)}%
      </Typography>
    </Box>
  );
};

/**
 * Subscription field component
 */
const SubscriptionField: React.FC<{ label?: string }> = ({ label }) => {
  const record = useRecordContext();
  if (!record) return null as any;
  
  // Check if user has active subscription
  const hasActiveSubscription = record.subscriptions?.length > 0;
  const activeSubscription = record.subscriptions?.find((sub: any) => sub.status === 'ACTIVE');
  
  if (!hasActiveSubscription) {
    return <Chip label="无订阅" size="small" color="default" />;
  }
  
  if (activeSubscription) {
    return (
      <Box>
        <Chip 
          label={activeSubscription.plan?.name || '未知套餐'} 
          size="small" 
          color="primary" 
        />
        <Typography variant="caption" display="block" color="text.secondary">
          {new Date(activeSubscription.currentPeriodEnd).toLocaleDateString('zh-CN')}
        </Typography>
      </Box>
    );
  }
  
  return <Chip label="已过期" size="small" color="error" />;
};

/**
 * List actions toolbar
 */
const UserListActions: React.FC = () => {
  const { permissions } = usePermissions();
  const canCreate = permissions?.includes('write:users');

  return (
    <TopToolbar>
      <FilterButton />
      {canCreate && <CreateButton />}
      <ExportButton />
    </TopToolbar>
  );
};

/**
 * Simplified bulk actions - keeping only essential operations
 */
const UserBulkActions: React.FC<{ selectedIds?: string[] }> = ({ selectedIds = [] }) => {
  const { permissions } = usePermissions();
  const canEdit = permissions?.includes('write:users');
  
  return (
    <Box>
      <BulkExportButton />
      {canEdit && <BulkStatusButton selectedIds={selectedIds} />}
      {canEdit && <BulkTokenRechargeButton selectedIds={selectedIds} />}
      {canEdit && <BulkSubscriptionButton selectedIds={selectedIds} />}
    </Box>
  );
};

/**
 * Bulk role change button
 */
const BulkRoleButton: React.FC<{ selectedIds?: string[] }> = ({ selectedIds = [] }) => {
  const notify = useNotify();
  const refresh = useRefresh();
  const unselectAll = useUnselectAll();
  const [open, setOpen] = React.useState(false);
  const [selectedRole, setSelectedRole] = React.useState('USER');
  
  const handleRoleChange = async () => {
    if (!selectedIds.length) return;
    
    try {
      // Update each user's role
      await Promise.all(
        selectedIds.map((userId: string) =>
          fetch(`/api/admin/users/${userId}/role`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ role: selectedRole }),
          })
        )
      );
      
      notify(`已将 ${selectedIds.length} 个用户的角色更改为 ${selectedRole}`, { type: 'success' });
      refresh();
      unselectAll();
    } catch (error) {
      notify('更改角色失败', { type: 'error' });
    }
    setOpen(false);
  };
  
  return (
    <>
      <Button 
        label="更改角色" 
        onClick={() => setOpen(true)}
        disabled={!selectedIds.length}
      >
        <TrendingUp />
      </Button>
      <Confirm
        isOpen={open}
        title="更改用户角色"
        content="确定要更改所选用户的角色吗？"
        onConfirm={handleRoleChange}
        onClose={() => setOpen(false)}
      >
        <SelectInput
          source="role"
          choices={[
            { id: 'USER', name: '普通用户' },
            { id: 'ADMIN', name: '管理员' },
          ]}
          value={selectedRole}
          onChange={(e) => setSelectedRole(e.target.value)}
        />
      </Confirm>
    </>
  );
};

/**
 * Bulk status change button
 */
const BulkStatusButton: React.FC<{ selectedIds?: string[] }> = ({ selectedIds = [] }) => {
  const notify = useNotify();
  const refresh = useRefresh();
  const unselectAll = useUnselectAll();
  const [open, setOpen] = React.useState(false);
  const [selectedStatus, setSelectedStatus] = React.useState('ACTIVE');
  
  const handleStatusChange = async () => {
    if (!selectedIds.length) return;
    
    try {
      // Update each user's status
      await Promise.all(
        selectedIds.map((userId: string) =>
          fetch(`/api/admin/users/${userId}/status`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
              status: selectedStatus,
              isActive: selectedStatus === 'ACTIVE'
            }),
          })
        )
      );
      
      notify(`已将 ${selectedIds.length} 个用户的状态更改为 ${selectedStatus}`, { type: 'success' });
      refresh();
      unselectAll();
    } catch (error) {
      notify('更改状态失败', { type: 'error' });
    }
    setOpen(false);
  };
  
  return (
    <>
      <Button 
        label="更改状态" 
        onClick={() => setOpen(true)}
        disabled={!selectedIds.length}
      >
        {selectedStatus === 'ACTIVE' ? <CheckCircle /> : <Block />}
      </Button>
      <Confirm
        isOpen={open}
        title="更改用户状态"
        content="确定要更改所选用户的状态吗？"
        onConfirm={handleStatusChange}
        onClose={() => setOpen(false)}
      >
        <SelectInput
          source="status"
          choices={[
            { id: 'ACTIVE', name: '活跃' },
            { id: 'INACTIVE', name: '未激活' },
            { id: 'BANNED', name: '封禁' },
          ]}
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
        />
      </Confirm>
    </>
  );
};

/**
 * Bulk token recharge button
 */
const BulkTokenRechargeButton: React.FC<{ selectedIds?: string[] }> = ({ selectedIds = [] }) => {
  const notify = useNotify();
  const refresh = useRefresh();
  const unselectAll = useUnselectAll();
  const [open, setOpen] = React.useState(false);
  const [amount, setAmount] = React.useState(100);
  
  const handleRecharge = async () => {
    if (!selectedIds.length) return;
    
    try {
      // Recharge tokens for each user
      await Promise.all(
        selectedIds.map((userId: string) =>
          fetch(`/api/admin/users/${userId}/tokens/recharge`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
              amount,
              description: `批量充值: ${amount} tokens`
            }),
          })
        )
      );
      
      notify(`已为 ${selectedIds.length} 个用户充值 ${amount} tokens`, { type: 'success' });
      refresh();
      unselectAll();
    } catch (error) {
      notify('充值失败', { type: 'error' });
    }
    setOpen(false);
  };
  
  return (
    <>
      <Button 
        label="Token充值" 
        onClick={() => setOpen(true)}
        disabled={!selectedIds.length}
      >
        <Add />
      </Button>
      <Confirm
        isOpen={open}
        title="批量Token充值"
        content="确定要为所选用户充值Token吗？"
        onConfirm={handleRecharge}
        onClose={() => setOpen(false)}
      >
        <NumberInput
          source="amount"
          label="充值数量"
          value={amount}
          onChange={(e: any) => setAmount(e.target.value)}
          min={1}
          max={10000}
        />
      </Confirm>
    </>
  );
};

/**
 * Bulk subscription assignment button
 */
const BulkSubscriptionButton: React.FC<{ selectedIds?: string[] }> = ({ selectedIds = [] }) => {
  const notify = useNotify();
  const refresh = useRefresh();
  const unselectAll = useUnselectAll();
  const [open, setOpen] = React.useState(false);
  const [selectedPlan, setSelectedPlan] = React.useState('');
  const [duration, setDuration] = React.useState(1);
  const [plans, setPlans] = React.useState<any[]>([]);
  
  // Load available plans
  React.useEffect(() => {
    const loadPlans = async () => {
      try {
        const response = await fetch('/api/admin/plans/available');
        if (response.ok) {
          const data = await response.json();
          setPlans(data.plans);
        }
      } catch (error) {
        console.error('Failed to load plans:', error);
      }
    };
    loadPlans();
  }, []);
  
  const handleAssign = async () => {
    if (!selectedIds.length || !selectedPlan) return;
    
    try {
      // Assign subscription to each user
      await Promise.all(
        selectedIds.map((userId: string) =>
          fetch(`/api/admin/users/${userId}/subscription`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
              planId: selectedPlan,
              duration,
              notes: `批量分配: ${plans.find(p => p.id === selectedPlan)?.name}`
            }),
          })
        )
      );
      
      const planName = plans.find(p => p.id === selectedPlan)?.name || 'selected plan';
      notify(`已为 ${selectedIds.length} 个用户分配 ${planName} 套餐`, { type: 'success' });
      refresh();
      unselectAll();
    } catch (error) {
      notify('分配失败', { type: 'error' });
    }
    setOpen(false);
  };
  
  return (
    <>
      <Button 
        label="分配套餐" 
        onClick={() => setOpen(true)}
        disabled={!selectedIds.length}
      >
        <Subscriptions />
      </Button>
      <Confirm
        isOpen={open}
        title="批量分配套餐"
        content="确定要为所选用户分配套餐吗？"
        onConfirm={handleAssign}
        onClose={() => setOpen(false)}
      >
        <SelectInput
          source="plan"
          choices={plans.map(p => ({ id: p.id, name: `${p.name} (¥${p.price}/${p.interval})` }))}
          value={selectedPlan}
          onChange={(e) => setSelectedPlan(e.target.value)}
          label="选择套餐"
          fullWidth
        />
        <NumberInput
          source="duration"
          label="持续时间（月）"
          value={duration}
          onChange={(e: any) => setDuration(parseInt(e.target.value) || 1)}
          min={1}
          max={12}
          fullWidth
          style={{ marginTop: 16 }}
        />
      </Confirm>
    </>
  );
};

/**
 * User list component with role-based access control
 */
export const UserList: React.FC = () => {
  const { permissions } = usePermissions();
  const canEdit = permissions?.includes('write:users');
  const canDelete = permissions?.includes('delete:users');

  return (
    <List
      filters={userFilters}
      actions={<UserListActions />}
      perPage={25}
      sort={{ field: 'createdAt', order: 'DESC' }}
    >
      <Datagrid 
        bulkActionButtons={<UserBulkActions />}
        rowClick="edit"
      >
        <TextField source="id" label="用户ID" />
        <TextField source="name" label="姓名" />
        <EmailField source="email" label="邮箱" />
        <RoleField label="角色" />
        <StatusField label="状态" />
        <NumberField 
          source="tokenBalance" 
          label="Token余额" 
          options={{ style: 'decimal' }}
        />
        <TokenUsageField label="Token使用" />
        <SubscriptionField label="订阅信息" />
        <BooleanField source="isActive" label="活跃" />
        <DateField 
          source="createdAt" 
          label="注册时间" 
          showTime
          locales="zh-CN"
        />
        <DateField 
          source="lastLoginAt" 
          label="最后登录" 
          showTime
          locales="zh-CN"
        />
        
        {/* Action buttons based on permissions */}
        {canEdit && <EditButton />}
      </Datagrid>
    </List>
  );
};