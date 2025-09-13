import React, { useState } from 'react';
import {
  Button,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  FormControl,
  InputLabel,
  Box,
  Typography,
  Alert,
  Chip,
} from '@mui/material';
import {
  MoreVert,
  Cancel,
  Refresh,
  Upgrade,
  MoneyOff,
  Pause,
  PlayArrow,
} from '@mui/icons-material';
import { useRecordContext, useNotify, useRefresh, fetchUtils } from 'react-admin';

interface SubscriptionActionsProps {
  record?: any;
}

/**
 * Subscription actions dropdown component
 */
export const SubscriptionActions: React.FC<SubscriptionActionsProps> = ({ record }) => {
  const subscription = useRecordContext();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [actionDialog, setActionDialog] = useState<{
    open: boolean;
    action: string;
    title: string;
    description: string;
  } | null>(null);
  const [actionData, setActionData] = useState<any>({});
  const [loading, setLoading] = useState(false);
  
  const notify = useNotify();
  const refresh = useRefresh();

  if (!subscription) return null as any;

  const handleActionClick = (action: string) => {
    const actions: Record<string, { title: string; description: string }> = {
      cancel: {
        title: '取消订阅',
        description: '取消此订阅，用户将失去访问权限',
      },
      renew: {
        title: '续费订阅',
        description: '延长订阅有效期',
      },
      upgrade: {
        title: '升级订阅',
        description: '将用户升级到其他套餐',
      },
      refund: {
        title: '退款',
        description: '处理订阅退款',
      },
      pause: {
        title: '暂停订阅',
        description: '临时暂停订阅访问',
      },
      resume: {
        title: '恢复订阅',
        description: '恢复已暂停的订阅',
      },
    };

    setActionDialog({
      open: true,
      action,
      title: actions[action].title,
      description: actions[action].description,
    });
    setAnchorEl(null);
  };

  const handleActionConfirm = async () => {
    setLoading(true);
    try {
      const { fetchJson } = fetchUtils;
      const { json } = await fetchJson(
        `/api/admin/subscriptions/${subscription.id}/actions`,
        {
          method: 'POST',
          body: JSON.stringify({
            action: actionDialog?.action,
            data: actionData,
          }),
          headers: new Headers({ 'Content-Type': 'application/json' }),
        }
      );

      if (json.success) => {
        notify(json.message, { type: 'success' });
        refresh();
      } else {
        notify(json.error || '操作失败', { type: 'error' });
      }
    } catch (error: any) => {
      notify(error.message || '操作失败', { type: 'error' });
    } finally {
      setLoading(false);
      setActionDialog(null);
      setActionData({});
    }
  };

  const renderActionForm = () => {
    if (!actionDialog) return null as any;

    switch (actionDialog.action) => {
      case 'cancel':
        return (
          <Box>
            <FormControl fullWidth margin="normal">
              <InputLabel>取消方式</InputLabel>
              <Select
                value={String(actionData.immediate || false)}
                onChange={(e) => setActionData({ ...actionData, immediate: e.target.value === 'true' })}
                label="取消方式"
              >
                <MenuItem value="false">到期后取消</MenuItem>
                <MenuItem value="true">立即取消</MenuItem>
              </Select>
            </FormControl>
            <TextField
              fullWidth
              margin="normal"
              label="取消原因"
              multiline
              rows={3}
              value={actionData.reason || ''}
              onChange={(e) => setActionData({ ...actionData, reason: e.target.value })}
            />
          </Box>
        );

      case 'renew':
        return (
          <Box>
            <TextField
              fullWidth
              margin="normal"
              label="续费天数"
              type="number"
              value={actionData.duration || 30}
              onChange={(e) => setActionData({ ...actionData, duration: parseInt(e.target.value) || 30 })}
            />
            <FormControl fullWidth margin="normal">
              <InputLabel>续费方式</InputLabel>
              <Select
                value={String(actionData.extendCurrent || true)}
                onChange={(e) => setActionData({ ...actionData, extendCurrent: e.target.value === 'true' })}
                label="续费方式"
              >
                <MenuItem value="true">延长当前有效期</MenuItem>
                <MenuItem value="false">从今天开始计算</MenuItem>
              </Select>
            </FormControl>
          </Box>
        );

      case 'upgrade':
        return (
          <Box>
            <TextField
              fullWidth
              margin="normal"
              label="新套餐ID"
              value={actionData.newPlanId || ''}
              onChange={(e) => setActionData({ ...actionData, newPlanId: e.target.value })}
              helperText="输入要升级到的套餐ID"
            />
            <FormControl fullWidth margin="normal">
              <InputLabel>是否按比例计费</InputLabel>
              <Select
                value={String(actionData.prorate !== undefined ? actionData.prorate : true)}
                onChange={(e) => setActionData({ ...actionData, prorate: e.target.value === 'true' })}
                label="是否按比例计费"
              >
                <MenuItem value="true">按比例计费</MenuItem>
                <MenuItem value="false">不按比例计费</MenuItem>
              </Select>
            </FormControl>
          </Box>
        );

      case 'refund':
        return (
          <Box>
            <TextField
              fullWidth
              margin="normal"
              label="退款金额"
              type="number"
              value={actionData.amount || ''}
              onChange={(e) => setActionData({ ...actionData, amount: parseFloat(e.target.value) || 0 })}
              helperText={`当前月费：${subscription.monthlyPrice} ${subscription.currency}`}
            />
            <TextField
              fullWidth
              margin="normal"
              label="退款原因"
              multiline
              rows={3}
              value={actionData.reason || ''}
              onChange={(e) => setActionData({ ...actionData, reason: e.target.value })}
            />
          </Box>
        );

      case 'pause':
        return (
          <Box>
            <TextField
              fullWidth
              margin="normal"
              label="暂停天数"
              type="number"
              value={actionData.pauseDuration || 7}
              onChange={(e) => setActionData({ ...actionData, pauseDuration: parseInt(e.target.value) || 7 })}
            />
            <Alert severity="info" sx={{ mt: 2 }}>
              订阅将在指定天数后自动恢复
            </Alert>
          </Box>
        );

      default:
        return null as any;
    }
  };

  const isActionDisabled = (action: string) => {
    switch (action) => {
      case 'cancel':
        return subscription.status === 'cancelled' || subscription.status === 'expired';
      case 'renew':
        return subscription.status === 'cancelled' || subscription.status === 'expired';
      case 'pause':
        return subscription.status !== 'active';
      case 'resume':
        return subscription.status !== 'inactive';
      default:
        return false;
    }
  };

  return (
    <>
      <Button
        size="small"
        onClick={((e: any): any) => setAnchorEl(e.currentTarget)}
        startIcon={<MoreVert />}
      >
        操作
      </Button>
      
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
      >
        <MenuItem 
          onClick={() => handleActionClick('cancel')}
          disabled={isActionDisabled('cancel')}
        >
          <Cancel sx={{ mr: 1 }} />
          取消订阅
        </MenuItem>
        
        <MenuItem 
          onClick={() => handleActionClick('renew')}
          disabled={isActionDisabled('renew')}
        >
          <Refresh sx={{ mr: 1 }} />
          续费订阅
        </MenuItem>
        
        <MenuItem onClick={() => handleActionClick('upgrade')}>
          <Upgrade sx={{ mr: 1 }} />
          升级套餐
        </MenuItem>
        
        <MenuItem onClick={() => handleActionClick('refund')}>
          <MoneyOff sx={{ mr: 1 }} />
          处理退款
        </MenuItem>
        
        <MenuItem 
          onClick={() => handleActionClick('pause')}
          disabled={isActionDisabled('pause')}
        >
          <Pause sx={{ mr: 1 }} />
          暂停订阅
        </MenuItem>
        
        <MenuItem 
          onClick={() => handleActionClick('resume')}
          disabled={isActionDisabled('resume')}
        >
          <PlayArrow sx={{ mr: 1 }} />
          恢复订阅
        </MenuItem>
      </Menu>

      <Dialog
        open={actionDialog?.open || false}
        onClose={() => setActionDialog(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {actionDialog?.title}
            <Chip
              label={subscription.status}
              size="small"
              color={subscription.status === 'active' ? 'success' : 'default'}
            />
          </Box>
        </DialogTitle>
        
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {actionDialog?.description}
          </Typography>
          
          <Typography variant="subtitle2" gutterBottom>
            用户：{subscription.user?.name} ({subscription.user?.email})
          </Typography>
          
          <Typography variant="subtitle2" gutterBottom>
            套餐：{subscription.plan?.name} - {subscription.monthlyPrice} {subscription.currency}
          </Typography>
          
          {renderActionForm()}
        </DialogContent>
        
        <DialogActions>
          <Button onClick={() => setActionDialog(null)}>取消</Button>
          <Button
            onClick={handleActionConfirm}
            variant="contained"
            disabled={loading}
          >
            {loading ? '处理中...' : '确认'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};