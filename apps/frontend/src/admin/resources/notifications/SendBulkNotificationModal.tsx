import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Stack,
  Alert,
  CircularProgress,
  Chip,
  Box,
  Switch,
  FormControlLabel,
  Autocomplete,
  Typography,
} from '@mui/material';
import { Send, People } from '@mui/icons-material';

interface SendBulkNotificationModalProps {
  open: boolean;
  onClose: () => void;
}

const userTypes = [
  { id: 'all', name: '所有用户' },
  { id: 'active', name: '活跃用户' },
  { id: 'subscribers', name: '订阅用户' },
  { id: 'admins', name: '管理员' },
  { id: 'trial', name: '试用用户' },
];

const notificationTypes = [
  { id: 'INFO', name: '信息', color: 'info' },
  { id: 'WARNING', name: '警告', color: 'warning' },
  { id: 'ERROR', name: '错误', color: 'error' },
  { id: 'SUCCESS', name: '成功', color: 'success' },
];

const priorities = [
  { id: 'LOW', name: '低' },
  { id: 'MEDIUM', name: '中' },
  { id: 'HIGH', name: '高' },
  { id: 'URGENT', name: '紧急' },
];

export const SendBulkNotificationModal: React.FC<SendBulkNotificationModalProps> = ({
  open,
  onClose,
}) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    type: 'INFO',
    priority: 'MEDIUM',
    targetType: 'all',
    userIds: [] as string[],
    expiresAt: '',
    isPinned: false,
    sendEmail: false,
  });

  const handleSend = async () => {
    if (!formData.title || !formData.content) {
      alert('请填写标题和内容');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/admin/notifications/send-bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        alert('通知发送成功');
        onClose();
      } else {
        const error = await response.json();
        alert(`发送失败: ${error.message}`);
      }
    } catch (error) {
      alert('发送失败: 网络错误');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>批量发送应用内通知</DialogTitle>
      <DialogContent>
        <Stack spacing={3} sx={{ mt: 1 }}>
          <Alert severity="info">
            此功能将向选定的用户批量发送应用内通知。请谨慎使用，避免过度打扰用户。
          </Alert>

          {/* 基本信息 */}
          <Box>
            <Typography variant="subtitle1" gutterBottom>
              基本信息
            </Typography>
            <Stack spacing={2}>
              <TextField
                label="通知标题"
                value={formData.title}
                onChange={(e) => handleChange('title', (e.target as HTMLInputElement).value)}
                fullWidth
                required
                helperText="简明扼要的标题，建议不超过30个字符"
              />
              <TextField
                label="通知内容"
                value={formData.content}
                onChange={(e) => handleChange('content', (e.target as HTMLInputElement).value)}
                multiline
                rows={4}
                fullWidth
                required
                helperText="详细的通知内容，支持Markdown格式"
              />
              <Box display="flex" gap={2}>
                <FormControl fullWidth>
                  <InputLabel>通知类型</InputLabel>
                  <Select
                    value={formData.type}
                    label="通知类型"
                    onChange={(e) => handleChange('type', (e.target as HTMLInputElement).value)}
                  >
                    {notificationTypes.map((type: any) => (
                      <MenuItem key={type.id} value={type.id}>
                        <Chip
                          label={type.name}
                          color={type.color as any}
                          size="small"
                          sx={{ mr: 1 }}
                        />
                        {type.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl fullWidth>
                  <InputLabel>优先级</InputLabel>
                  <Select
                    value={formData.priority}
                    label="优先级"
                    onChange={(e) => handleChange('priority', (e.target as HTMLInputElement).value)}
                  >
                    {priorities.map((priority: any) => (
                      <MenuItem key={priority.id} value={priority.id}>
                        {priority.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
            </Stack>
          </Box>

          {/* 发送对象 */}
          <Box>
            <Typography variant="subtitle1" gutterBottom>
              发送对象
            </Typography>
            <Stack spacing={2}>
              <FormControl fullWidth>
                <InputLabel>用户类型</InputLabel>
                <Select
                  value={formData.targetType}
                  label="用户类型"
                  onChange={(e) => handleChange('targetType', (e.target as HTMLInputElement).value)}
                >
                  {userTypes.map((type: any) => (
                    <MenuItem key={type.id} value={type.id}>
                      <People sx={{ mr: 1 }} />
                      {type.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              
              {formData.targetType === 'custom' && (
                <Autocomplete
                  multiple
                  options={[]}
                  freeSolo
                  value={formData.userIds}
                  onChange={(e, newValue) => handleChange('userIds', newValue as string[])}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="用户ID列表"
                      placeholder="输入用户ID，按回车添加"
                      helperText="可以输入多个用户ID"
                    />
                  )}
                />
              )}
            </Stack>
          </Box>

          {/* 高级设置 */}
          <Box>
            <Typography variant="subtitle1" gutterBottom>
              高级设置
            </Typography>
            <Stack spacing={2}>
              <TextField
                label="过期时间"
                type="datetime-local"
                value={formData.expiresAt}
                onChange={(e) => handleChange('expiresAt', e.target.value)}
                fullWidth
                InputLabelProps={{ shrink: true }}
                helperText="可选，通知将在指定时间后过期"
              />
              
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.isPinned}
                    onChange={(e) => handleChange('isPinned', (e.target as HTMLInputElement).checked)}
                  />
                }
                label="置顶通知"
              />
              
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.sendEmail}
                    onChange={(e) => handleChange('sendEmail', (e.target as HTMLInputElement).checked)}
                  />
                }
                label="同时发送邮件"
              />
            </Stack>
          </Box>

          {/* 预览 */}
          <Box>
            <Typography variant="subtitle1" gutterBottom>
              预览
            </Typography>
            <Alert severity="info">
              <Typography variant="body2">
                <strong>{formData.title || '通知标题'}</strong>
              </Typography>
              <Typography variant="body2">
                {formData.content || '通知内容预览...'}
              </Typography>
            </Alert>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button
          onClick={handleSend}
          variant="contained"
          disabled={loading || !formData.title || !formData.content}
          startIcon={loading ? <CircularProgress size={20} /> : <Send />}
        >
          {loading ? '发送中...' : '发送通知'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
