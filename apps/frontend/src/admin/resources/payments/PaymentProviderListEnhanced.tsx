import React, { useState, useEffect } from 'react';
import {
  List,
  Datagrid,
  TextField,
  BooleanField,
  EditButton,
  CreateButton,
  TopToolbar,
  useCreate,
  useNotify,
  useRefresh,
  useUpdate,
  Button,
  FunctionField,
  TextInput,
} from 'react-admin';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tab,
} from '@mui/material';
import {
  Payment as PaymentIcon,
  Add,
  Science,
  Refresh,
  CreditCard,
  Settings,
  CheckCircle,
  Error,
  Warning,
  BugReport,
} from '@mui/icons-material';
import type { ChipProps } from '@mui/material';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface PaymentProvider {
  id: string;
  name: string;
  displayName: string;
  enabled: boolean;
  priority: number;
  healthStatus: 'UNKNOWN' | 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
  lastHealthCheck?: string;
  config: any;
  credentials?: any;
  metadata?: any;
  createdAt: string;
  updatedAt: string;
}

interface StripeConfig {
  publishableKey: string;
  secretKey: string;
  webhookSecret: string;
  mode: 'test' | 'live';
  currency: string;
  supportedPaymentMethods: string[];
}

const ProviderStatusChip: React.FC<{ status: string }> = ({ status }) => {
  const getStatusProps = (): { icon: React.ReactNode; color: ChipProps['color']; label: string } => {
    switch (status) {
      case 'HEALTHY':
        return {
          icon: <CheckCircle />,
          color: 'success',
          label: '正常',
        };
      case 'DEGRADED':
        return {
          icon: <Warning />,
          color: 'warning',
          label: '降级',
        };
      case 'UNHEALTHY':
        return {
          icon: <Error />,
          color: 'error',
          label: '异常',
        };
      default:
        return {
          icon: <Settings />,
          color: 'default',
          label: '未知',
        };
    }
  };

  const { icon, color, label } = getStatusProps();

  return (
    <Chip
      icon={icon}
      label={label}
      color={color}
      size="small"
      variant="outlined"
    />
  );
};

const StripeConfigForm: React.FC<{
  provider?: PaymentProvider;
  open: boolean;
  onClose: () => void;
  onSave: (config: StripeConfig) => void;
}> = ({ provider, open, onClose, onSave }) => {
  const [config, setConfig] = useState<StripeConfig>({
    publishableKey: '',
    secretKey: '',
    webhookSecret: '',
    mode: 'test',
    currency: 'USD',
    supportedPaymentMethods: ['card'],
  });

  useEffect(() => {
    if (provider?.config) {
      setConfig({
        ...config,
        ...provider.config,
      });
    }
  }, [provider]);

  const handleSubmit = () => {
    onSave(config);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {provider ? '编辑 Stripe 配置' : '初始化 Stripe 支付渠道'}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <FormControl fullWidth>
            <InputLabel>模式</InputLabel>
            <Select
              value={config.mode}
              label="模式"
              onChange={(e) => setConfig({ ...config, mode: (e.target as any).value as 'test' | 'live' })}
            >
              <MenuItem value="test">测试模式</MenuItem>
              <MenuItem value="live">生产模式</MenuItem>
            </Select>
          </FormControl>

          <FormControl fullWidth>
            <InputLabel>币种</InputLabel>
            <Select
              value={config.currency}
              label="币种"
              onChange={(e) => setConfig({ ...config, currency: (e.target as any).value })}
            >
              <MenuItem value="USD">美元 (USD)</MenuItem>
              <MenuItem value="CNY">人民币 (CNY)</MenuItem>
              <MenuItem value="EUR">欧元 (EUR)</MenuItem>
            </Select>
          </FormControl>

          <Typography variant="body2" color="textSecondary">
            发布密钥 (Publishable Key)
          </Typography>
          <TextInput
            source="publishableKey"
            multiline
            rows={2}
            value={config.publishableKey}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfig({ ...config, publishableKey: e.target.value })}
            placeholder="pk_test_..."
            type="password"
            fullWidth
          />

          <Typography variant="body2" color="textSecondary">
            私密密钥 (Secret Key)
          </Typography>
          <TextInput
            source="secretKey"
            multiline
            rows={3}
            value={config.secretKey}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfig({ ...config, secretKey: e.target.value })}
            placeholder="sk_test_..."
            type="password"
            fullWidth
          />

          <Typography variant="body2" color="textSecondary">
            Webhook 签名密钥
          </Typography>
          <TextInput
            source="webhookSecret"
            multiline
            rows={2}
            value={config.webhookSecret}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfig({ ...config, webhookSecret: e.target.value })}
            placeholder="whsec_..."
            type="password"
            fullWidth
          />

          <Typography variant="body2" color="textSecondary">
            支持的支付方式
          </Typography>
          <Select
            multiple
            value={config.supportedPaymentMethods}
            onChange={(e) => setConfig({ ...config, supportedPaymentMethods: (e.target as any).value as string[] })}
          >
            <MenuItem value="card">银行卡</MenuItem>
            <MenuItem value="alipay">支付宝</MenuItem>
            <MenuItem value="wechat_pay">微信支付</MenuItem>
          </Select>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button onClick={handleSubmit} variant="contained">
          保存
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const TestPaymentDialog: React.FC<{
  provider: PaymentProvider;
  open: boolean;
  onClose: () => void;
}> = ({ provider, open, onClose }) => {
  const [testResult, setTestResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const runTest = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/payment-providers/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          providerId: provider.id,
          testType: 'connection',
        }),
      });

      const result = await response.json();
      setTestResult(result);
    } catch (error) {
      setTestResult({ success: false, error: '测试失败' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>测试支付渠道 - {provider.displayName}</DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 2 }}>
          <Button
            onClick={runTest}
            disabled={loading}
            variant="contained"
            startIcon={<BugReport />}
          >
            {loading ? '测试中...' : '运行测试'}
          </Button>

          {testResult && (
            <Box sx={{ mt: 2 }}>
              <Alert severity={testResult.success ? 'success' : 'error'}>
                {testResult.success ? '测试成功' : '测试失败'}
              </Alert>
              {testResult.details && (
                <Typography variant="body2" sx={{ mt: 1 }}>
                  {JSON.stringify(testResult.details, null, 2)}
                </Typography>
              )}
            </Box>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>关闭</Button>
      </DialogActions>
    </Dialog>
  );
};

const PaymentProviderListActions = () => {
  const [stripeDialogOpen, setStripeDialogOpen] = useState(false);
  const [create] = useCreate();
  const notify = useNotify();
  const refresh = useRefresh();

  const handleSaveStripe = async (config: StripeConfig) => {
    try {
      await create(
        'payment-providers',
        {
          data: {
            name: 'stripe',
            displayName: 'Stripe',
            enabled: true,
            priority: 1,
            config,
            credentials: {
              secretKey: config.secretKey,
              webhookSecret: config.webhookSecret,
            },
            metadata: {
              version: '2023-10-16',
              features: ['payments', 'subscriptions', 'webhooks'],
            },
          },
        },
        {
          onSuccess: () => {
            notify('Stripe 支付渠道已创建', { type: 'success' });
            refresh();
          },
          onError: (error: any) => {
            notify('创建失败: ' + (error as Error).message, { type: 'error' });
          },
        }
      );
    } catch (error) {
      notify('创建失败', { type: 'error' });
    }
  };

  return (
    <TopToolbar>
      <Button
        onClick={() => setStripeDialogOpen(true)}
        variant="contained"
        startIcon={<Add />}
        sx={{ mr: 2 }}
      >
        初始化 Stripe
      </Button>
      <StripeConfigForm
        open={stripeDialogOpen}
        onClose={() => setStripeDialogOpen(false)}
        onSave={handleSaveStripe}
      />
    </TopToolbar>
  );
};

export const PaymentProviderListEnhanced: React.FC = () => {
  const [selectedProvider, setSelectedProvider] = useState<PaymentProvider | null>(null);
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [tabValue, setTabValue] = useState(0);
  const [update] = useUpdate();
  const notify = useNotify();
  const refresh = useRefresh();

  const handleToggleEnabled = (provider: PaymentProvider) => {
    update(
      'payment-providers',
      {
        id: provider.id,
        data: { enabled: !provider.enabled },
        previousData: provider,
      },
      {
        onSuccess: () => {
          notify(
            `支付渠道已${provider.enabled ? '禁用' : '启用'}`,
            { type: 'success' }
          );
          refresh();
        },
        onError: (error) => {
          notify('操作失败: ' + error.message, { type: 'error' });
        },
      }
    );
  };

  const handleTestProvider = (provider: PaymentProvider) => {
    setSelectedProvider(provider);
    setTestDialogOpen(true);
  };

  const handleHealthCheck = async (provider: PaymentProvider) => {
    try {
      const response = await fetch('/api/admin/payment-providers/health-check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ providerId: provider.id }),
      });

      if (response.ok) {
        notify('健康检查完成', { type: 'success' });
        refresh();
      } else {
        notify('健康检查失败', { type: 'error' });
      }
    } catch (error) {
      notify('健康检查失败', { type: 'error' });
    }
  };

  const ProviderDetailsPanel: React.FC<{ provider: PaymentProvider }> = ({ provider }) => {
    const [activeTab, setActiveTab] = useState(0);

    return (
      <Card sx={{ mt: 2 }}>
        <CardContent>
          <Tabs value={activeTab} onChange={(_, newValue: any) => setActiveTab(newValue)}>
            <Tab label="配置信息" />
            <Tab label="健康状态" />
            <Tab label="元数据" />
          </Tabs>

          {activeTab === 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="h6" gutterBottom>
                支付渠道配置
              </Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>配置项</TableCell>
                      <TableCell>值</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {provider.config && Object.entries(provider.config).map(([key, value]: any) => (
                      <TableRow key={key}>
                        <TableCell>{key}</TableCell>
                        <TableCell>
                          {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}

          {activeTab === 1 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="h6" gutterBottom>
                健康状态详情
              </Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableBody>
                    <TableRow>
                      <TableCell>当前状态</TableCell>
                      <TableCell>
                        <ProviderStatusChip status={provider.healthStatus} />
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>最后检查时间</TableCell>
                      <TableCell>
                        {provider.lastHealthCheck
                          ? format(new Date(provider.lastHealthCheck), 'yyyy-MM-dd HH:mm:ss', { locale: zhCN })
                          : '从未检查'}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}

          {activeTab === 2 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="h6" gutterBottom>
                元数据
              </Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableBody>
                    {provider.metadata && Object.entries(provider.metadata).map(([key, value]: any) => (
                      <TableRow key={key}>
                        <TableCell>{key}</TableCell>
                        <TableCell>
                          {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <Box>
      <List
        actions={<PaymentProviderListActions />}
        title="支付渠道管理"
        exporter={false}
      >
        <Box sx={{ width: '100%' }}>
          <Tabs value={tabValue} onChange={(_e, newValue) => setTabValue(newValue)}>
            <Tab label="支付渠道列表" />
            <Tab label="使用统计" />
          </Tabs>

          {tabValue === 0 && (
            <Box sx={{ mt: 2 }}>
              <Datagrid
                rowClick="expand"
                expand={(record: any) => <ProviderDetailsPanel provider={record} />}
                bulkActionButtons={false}
              >
                <TextField source="displayName" label="显示名称" />
                <TextField source="name" label="标识符" />
                <BooleanField source="enabled" label="启用状态" />
                <TextField source="priority" label="优先级" />
                <FunctionField
                  source="healthStatus"
                  label="健康状态"
                  sortable={false}
                  render={(record: any) => record && <ProviderStatusChip status={record.healthStatus} />}
                />
                <TextField
                  source="lastHealthCheck"
                  label="最后检查"
                  sortable={false}
                  emptyText="从未检查"
                />
                <EditButton />
              </Datagrid>
            </Box>
          )}

          {tabValue === 1 && (
            <Box sx={{ mt: 2 }}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    支付渠道使用统计
                  </Typography>
                  <Alert severity="info">
                    统计功能开发中，将显示各支付渠道的交易量、成功率等指标
                  </Alert>
                </CardContent>
              </Card>
            </Box>
          )}
        </Box>
      </List>

      {selectedProvider && (
        <TestPaymentDialog
          provider={selectedProvider}
          open={testDialogOpen}
          onClose={() => setTestDialogOpen(false)}
        />
      )}
    </Box>
  );
};

export default PaymentProviderListEnhanced;
