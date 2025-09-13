import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Chip,
  IconButton,
  Tooltip,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Badge,
  Divider
} from '@mui/material';
import {
  Assignment,
  History,
  Edit,
  Cancel,
  Add,
  Refresh
} from '@mui/icons-material';
import { useNotify, useRefresh, useRecordContext } from 'react-admin';

interface Plan {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  interval: string;
  tokenQuota: number;
  trialDays: number;
  yearlyDiscount?: number;
  features: Array<{
    id: string;
    name: string;
    enabled: boolean;
    value?: number;
    unit?: string;
  }>;
}

interface Subscription {
  id: string;
  plan: {
    id: string;
    name: string;
    price: number;
    currency: string;
    interval: string;
  };
  status: string;
  startDate: string;
  endDate: string;
  currentPeriodEnd: string;
  source: string;
  changeReason?: string;
  metadata?: any;
}

interface SubscriptionManagerProps {
  userId: string;
}

/**
 * Subscription Manager Component for Admin User Edit
 */
export const SubscriptionManager: React.FC<SubscriptionManagerProps> = ({ userId }) => {
  const record = useRecordContext();
  const notify = useNotify();
  const refresh = useRefresh();
  
  // Use userId from props or from record context
  const effectiveUserId = userId || record?.id;
  
  const [activeTab, setActiveTab] = useState(0);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [modifyDialogOpen, setModifyDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState('');
  const [duration, setDuration] = useState(1);
  const [customEndDate, setCustomEndDate] = useState('');
  const [notes, setNotes] = useState('');
  const [extendDays, setExtendDays] = useState(0);
  const [newEndDate, setNewEndDate] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [selectedSubscription, setSelectedSubscription] = useState<Subscription | null>(null);

  // Load available plans
  useEffect(() => {
    const loadPlans = async () => {
      try {
        const response = await fetch('/api/admin/plans/available');
        if (response.ok) => {
          const data = await response.json();
          setPlans(data.plans);
        }
      } catch (error) {
        console.error('Failed to load plans:', error);
      }
    };
    loadPlans();
  }, []);

  // Load user subscriptions
  const loadSubscriptions = async () => {
    if (!effectiveUserId) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/users/${effectiveUserId}/subscription/history`);
      if (response.ok) => {
        const data = await response.json();
        setSubscriptions(data.subscriptions);
      }
    } catch (error) {
      console.error('Failed to load subscriptions:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSubscriptions();
  }, [effectiveUserId]);

  // Get current active subscription
  const activeSubscription = subscriptions.find((sub: any) => sub.status === 'ACTIVE');

  // Assign subscription
  const handleAssignSubscription = async () => {
    if (!selectedPlan || !effectiveUserId) => {
      notify('请选择一个套餐', { type: 'warning' });
      return;
    }

    try {
      const response = await fetch(`/api/admin/users/${effectiveUserId}/subscription`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: selectedPlan,
          duration,
          customEndDate: customEndDate || undefined,
          notes
        })
      });

      if (response.ok) => {
        notify('套餐分配成功', { type: 'success' });
        setAssignDialogOpen(false);
        resetForm();
        loadSubscriptions();
        refresh();
      } else {
        const error = await response.json();
        notify(error.error || '分配失败', { type: 'error' });
      }
    } catch (error) {
      notify('网络错误', { type: 'error' });
    }
  };

  // Modify subscription
  const handleModifySubscription = async () => {
    if (!selectedSubscription || !effectiveUserId) return;

    try {
      const response = await fetch(`/api/admin/users/${effectiveUserId}/subscription`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscriptionId: selectedSubscription.id,
          extendDays: extendDays > 0 ? extendDays : undefined,
          newEndDate: newEndDate || undefined,
          cancelImmediately: cancelReason ? true : false,
          notes: cancelReason || notes
        })
      });

      if (response.ok) => {
        notify('套餐修改成功', { type: 'success' });
        setModifyDialogOpen(false);
        resetModifyForm();
        loadSubscriptions();
        refresh();
      } else {
        const error = await response.json();
        notify(error.error || '修改失败', { type: 'error' });
      }
    } catch (error) {
      notify('网络错误', { type: 'error' });
    }
  };

  const resetForm = () => {
    setSelectedPlan('');
    setDuration(1);
    setCustomEndDate('');
    setNotes('');
  };

  const resetModifyForm = () => {
    setExtendDays(0);
    setNewEndDate('');
    setCancelReason('');
    setSelectedSubscription(null);
  };

  const getStatusColor = (status: string) => {
    switch (status) => {
      case 'ACTIVE': return 'success';
      case 'CANCELLED': return 'error';
      case 'EXPIRED': return 'warning';
      default: return 'default';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) => {
      case 'ACTIVE': return '有效';
      case 'CANCELLED': return '已取消';
      case 'EXPIRED': return '已过期';
      case 'PENDING': return '待激活';
      default: return status;
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">订阅管理</Typography>
        <Box>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={loadSubscriptions}
            sx={{ mr: 1 }}
          >
            刷新
          </Button>
          <Button
            variant="contained"
            startIcon={<Assignment />}
            onClick={((: any): any) => setAssignDialogOpen(true)}
          >
            分配套餐
          </Button>
        </Box>
      </Box>

      {/* Current Subscription Status */}
      {activeSubscription && (
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box>
                <Typography variant="h6">
                  当前套餐: {activeSubscription.plan.name}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  有效期至: {new Date(activeSubscription.currentPeriodEnd).toLocaleDateString('zh-CN')}
                </Typography>
              </Box>
              <Box>
                <Chip 
                  label={getStatusLabel(activeSubscription.status)}
                  color={getStatusColor(activeSubscription.status) as any}
                />
                <Tooltip title="修改套餐">
                  <IconButton 
                    size="small"
                    onClick={((: any): any) => {
                      setSelectedSubscription(activeSubscription);
                      setModifyDialogOpen(true);
                    }}
                    sx={{ ml: 1 }}
                  >
                    <Edit />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onChange={((e, v: any): any) => setActiveTab(v)}>
        <Tab label="套餐详情" />
        <Tab 
          label={
            <Badge badgeContent={subscriptions.length} color="primary">
              历史记录
            </Badge>
          } 
        />
      </Tabs>

      {/* Tab Content */}
      {activeTab === 0 && (
        <Box sx={{ mt: 2 }}>
          {activeSubscription ? (
            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle1" gutterBottom>套餐信息</Typography>
              <TableContainer>
                <Table size="small">
                  <TableBody>
                    <TableRow>
                      <TableCell>套餐名称</TableCell>
                      <TableCell>{activeSubscription.plan.name}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>价格</TableCell>
                      <TableCell>
                        {activeSubscription.plan.currency} {activeSubscription.plan.price}/{activeSubscription.plan.interval}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>开始日期</TableCell>
                      <TableCell>{new Date(activeSubscription.startDate).toLocaleDateString('zh-CN')}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>结束日期</TableCell>
                      <TableCell>{new Date(activeSubscription.endDate).toLocaleDateString('zh-CN')}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>来源</TableCell>
                      <TableCell>{activeSubscription.source}</TableCell>
                    </TableRow>
                    {activeSubscription.metadata?.notes && (
                      <TableRow>
                        <TableCell>备注</TableCell>
                        <TableCell>{activeSubscription.metadata.notes}</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          ) : (
            <Alert severity="info">
              该用户当前没有活跃的订阅
            </Alert>
          )}
        </Box>
      )}

      {activeTab === 1 && (
        <Box sx={{ mt: 2 }}>
          {loading ? (
            <Typography>加载中...</Typography>
          ) : subscriptions.length > 0 ? (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>套餐</TableCell>
                    <TableCell>状态</TableCell>
                    <TableCell>开始时间</TableCell>
                    <TableCell>结束时间</TableCell>
                    <TableCell>来源</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {subscriptions.map((sub: any) => (
                    <TableRow key={sub.id}>
                      <TableCell>{sub.plan.name}</TableCell>
                      <TableCell>
                        <Chip 
                          label={getStatusLabel(sub.status)}
                          color={getStatusColor(sub.status) as any}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        {new Date(sub.startDate).toLocaleDateString('zh-CN')}
                      </TableCell>
                      <TableCell>
                        {new Date(sub.endDate).toLocaleDateString('zh-CN')}
                      </TableCell>
                      <TableCell>{sub.source}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Alert severity="info">
              暂无订阅历史记录
            </Alert>
          )}
        </Box>
      )}

      {/* Assign Subscription Dialog */}
      <Dialog 
        open={assignDialogOpen} 
        onClose={() => {
          setAssignDialogOpen(false);
          resetForm();
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>分配套餐</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>选择套餐</InputLabel>
              <Select
                value={selectedPlan}
                onChange={((e: any): any) => setSelectedPlan(e.target.value)}
                label="选择套餐"
              >
                {plans.map((plan: any) => (
                  <MenuItem key={plan.id} value={plan.id}>
                    <Box>
                      <Typography variant="subtitle1">
                        {plan.name} - {plan.currency} {plan.price}/{plan.interval}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {plan.description}
                      </Typography>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {selectedPlan && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" gutterBottom>套餐特性：</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {plans.find((p: any) => p.id === selectedPlan)?.features
                    .filter((f: any) => f.enabled)
                    .map((feature: any) => (
                      <Chip 
                        key={feature.id}
                        label={`${feature.name}${feature.value ? `: ${feature.value} ${feature.unit || ''}` : ''}`}
                        size="small"
                        variant="outlined"
                      />
                    ))}
                </Box>
              </Box>
            )}

            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
              <TextField
                label="持续时间（月）"
                type="number"
                value={duration}
                onChange={((e: any): any) => setDuration(parseInt(e.target.value) || 1)}
                fullWidth
              />
              <TextField
                label="自定义结束日期（可选）"
                type="date"
                value={customEndDate}
                onChange={((e: any): any) => setCustomEndDate(e.target.value)}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
            </Box>

            <TextField
              label="备注"
              multiline
              rows={3}
              value={notes}
              onChange={((e: any): any) => setNotes(e.target.value)}
              fullWidth
              placeholder="记录分配原因或其他信息..."
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={((: any): any) => {
            setAssignDialogOpen(false);
            resetForm();
          }}>
            取消
          </Button>
          <Button 
            variant="contained" 
            onClick={handleAssignSubscription}
            disabled={!selectedPlan}
          >
            分配
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modify Subscription Dialog */}
      <Dialog 
        open={modifyDialogOpen} 
        onClose={() => {
          setModifyDialogOpen(false);
          resetModifyForm();
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>修改订阅</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              当前套餐: {selectedSubscription?.plan.name}
            </Typography>

            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2">延长订阅：</Typography>
              <TextField
                label="延长天数"
                type="number"
                value={extendDays}
                onChange={((e: any): any) => setExtendDays(parseInt(e.target.value) || 0)}
                fullWidth
                sx={{ mb: 1 }}
              />
              <Typography variant="caption" color="text.secondary">
                或设置新的结束日期：
              </Typography>
              <TextField
                type="date"
                value={newEndDate}
                onChange={((e: any): any) => setNewEndDate(e.target.value)}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
            </Box>

            <Divider sx={{ my: 2 }} />

            <Box>
              <Typography variant="subtitle2" color="error">取消订阅：</Typography>
              <TextField
                label="取消原因"
                multiline
                rows={2}
                value={cancelReason}
                onChange={((e: any): any) => setCancelReason(e.target.value)}
                fullWidth
                placeholder="输入取消原因..."
                sx={{ mt: 1 }}
              />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={((: any): any) => {
            setModifyDialogOpen(false);
            resetModifyForm();
          }}>
            取消
          </Button>
          <Button 
            variant="contained" 
            color="error"
            onClick={handleModifySubscription}
            disabled={!extendDays && !newEndDate && !cancelReason}
          >
            确认修改
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};