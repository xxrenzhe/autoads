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
} from '@mui/material';

interface TestEmailModalProps {
  open: boolean;
  onClose: () => void;
  onSend: (data: any) => void;
  defaultEmail: string;
}

export const TestEmailModal: React.FC<TestEmailModalProps> = ({
  open,
  onClose,
  onSend,
  defaultEmail,
}) => {
  const [email, setEmail] = useState(defaultEmail || '');
  const [template, setTemplate] = useState('test');
  const [loading, setLoading] = useState(false);

  const templates = [
    { id: 'test', name: '测试邮件', subject: '测试邮件 - 系统通知' },
    { id: 'welcome', name: '欢迎邮件', subject: '欢迎加入 AutoAds' },
    { id: 'password-reset', name: '密码重置', subject: '密码重置请求' },
    { id: 'subscription-expired', name: '订阅过期', subject: '您的订阅已过期' },
  ];

  const handleSend = async () => {
    if (!email) => {
      alert('请输入收件人邮箱');
      return;
    }

    setLoading(true);
    try {
      await onSend({
        to: email,
        template,
        subject: templates.find((t: any) => t.id === template)?.subject || '测试邮件',
      });
      onClose();
    } catch (error) {
      console.error('Failed to send test email:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>发送测试邮件</DialogTitle>
      <DialogContent>
        <Stack spacing={3} sx={{ mt: 1 }}>
          <Alert severity="info">
            此功能将使用当前配置发送一封测试邮件，请确保配置正确。
          </Alert>
          
          <TextField
            label="收件人邮箱"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            fullWidth
            required
            helperText="请输入要接收测试邮件的邮箱地址"
          />
          
          <FormControl fullWidth>
            <InputLabel>邮件模板</InputLabel>
            <Select
              value={template}
              label="邮件模板"
              onChange={(e) => setTemplate(e.target.value)}
            >
              {templates.map((t: any) => (
                <MenuItem key={t.id} value={t.id}>
                  {t.name} - {t.subject}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button
          onClick={handleSend}
          variant="contained"
          disabled={loading || !email}
          startIcon={loading ? <CircularProgress size={20} /> : undefined}
        >
          {loading ? '发送中...' : '发送'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};