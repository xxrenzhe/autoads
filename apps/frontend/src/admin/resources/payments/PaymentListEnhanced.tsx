import React, { useState, useEffect } from 'react';
import {
  List,
  Datagrid,
  TextField,
  NumberField,
  DateField,
  ReferenceField,
  FunctionField,
  Filter,
  SelectInput,
  TextInput,
  SearchInput,
  TopToolbar,
  CreateButton,
  ExportButton,
  useListContext,
  useRefresh,
  useNotify,
  Button,
  Loading,
  useTranslate,
} from 'react-admin';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Grid,
  Alert,
  Tab,
} from '@mui/material';
import {
  Payment as PaymentIcon,
  Receipt,
  CreditCard,
  AccountBalanceWallet,
  TrendingUp,
  FilterList,
  Refresh,
  GetApp,
  Visibility,
  Cancel,
  CheckCircle,
  HourglassEmpty,
} from '@mui/icons-material';
import { format, subDays, subMonths, startOfDay, endOfDay } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface Payment {
  id: string;
  userId: string;
  subscriptionId?: string;
  amount: number;
  currency: string;
  status: 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | 'REFUNDED';
  provider: string;
  providerId?: string;
  metadata?: any;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    email: string;
    name?: string;
  };
  subscription?: {
    id: string;
    plan: {
      name: string;
    };
  };
}

interface PaymentStats {
  totalRevenue: number;
  totalPayments: number;
  successRate: number;
  averageAmount: number;
  revenueByMethod: Array<{
    method: string;
    amount: number;
    count: number;
  }>;
  revenueByStatus: Array<{
    status: string;
    amount: number;
    count: number;
  }>;
  dailyRevenue: Array<{
    date: string;
    amount: number;
    count: number;
  }>;
}

const PaymentStatusChip: React.FC<{ status: string }> = ({ status }) => {
  const getStatusProps = () => {
    switch (status) {
      case 'SUCCEEDED':
        return {
          icon: <CheckCircle />,
          color: 'success',
          label: '成功',
        };
      case 'FAILED':
        return {
          icon: <Cancel />,
          color: 'error',
          label: '失败',
        };
      case 'CANCELLED':
        return {
          icon: <Cancel />,
          color: 'default',
          label: '已取消',
        };
      case 'REFUNDED':
        return {
          icon: <CreditCard />,
          color: 'warning',
          label: '已退款',
        };
      case 'PENDING':
      default:
        return {
          icon: <HourglassEmpty />,
          color: 'info',
          label: '处理中',
        };
    }
  };

  const { icon, color, label } = getStatusProps();

  return (
    <Chip
      icon={icon}
      label={label}
      color={color as any}
      size="small"
      variant="outlined"
    />
  );
};

const PaymentFilters: React.FC = () => {
  const translate = useTranslate();
  
  return (
    <Filter>
      <SearchInput source="q" alwaysOn />
      <SelectInput
        source="status"
        label={translate('resources.payments.fields.status')}
        choices={[
          { id: 'PENDING', name: '处理中' },
          { id: 'SUCCEEDED', name: '成功' },
          { id: 'FAILED', name: '失败' },
          { id: 'CANCELLED', name: '已取消' },
          { id: 'REFUNDED', name: '已退款' },
        ]}
      />
      <SelectInput
        source="provider"
        label={translate('resources.payments.fields.provider')}
        choices={[
          { id: 'stripe', name: 'Stripe' },
        ]}
      />
      <TextInput
        source="userId"
        label={translate('resources.payments.fields.userId')}
      />
    </Filter>
  );
};

const PaymentActions = () => {
  const { filterValues } = useListContext();
  const refresh = useRefresh();
  
  return (
    <TopToolbar>
      <Button
        onClick={() => refresh()}
        label="刷新"
        startIcon={<Refresh />}
      />
      <ExportButton
        maxResults={10000}
        label="导出"
      />
    </TopToolbar>
  );
};

const PaymentStatsDashboard: React.FC = () => {
  const [stats, setStats] = useState<PaymentStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');

  useEffect(() => {
    fetchStats();
  }, [timeRange]);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const endDate = endOfDay(new Date());
      let startDate;
      
      switch (timeRange) {
        case '7d':
          startDate = startOfDay(subDays(endDate, 7));
          break;
        case '90d':
          startDate = startOfDay(subDays(endDate, 90));
          break;
        case '30d':
        default:
          startDate = startOfDay(subDays(endDate, 30));
          break;
      }

      const response = await fetch(`/api/admin/payments/stats?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`);
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error fetching payment stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <Loading />;
  }

  if (!stats) {
    return <Alert severity="error">无法加载统计数据</Alert>;
  }

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h6">支付统计概览</Typography>
        <SelectInput
          source="timeRange"
          value={timeRange}
          onChange={(e: any) => setTimeRange(e.target?.value as any)}
          choices={[
            { id: '7d', name: '最近7天' },
            { id: '30d', name: '最近30天' },
            { id: '90d', name: '最近90天' },
          ]}
          label="时间范围"
        />
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <AccountBalanceWallet sx={{ fontSize: 40, mr: 2, color: 'primary.main' }} />
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    总收入
                  </Typography>
                  <Typography variant="h5">
                    ${stats.totalRevenue.toFixed(2)}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <PaymentIcon sx={{ fontSize: 40, mr: 2, color: 'success.main' }} />
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    总支付数
                  </Typography>
                  <Typography variant="h5">
                    {stats.totalPayments}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <TrendingUp sx={{ fontSize: 40, mr: 2, color: 'info.main' }} />
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    成功率
                  </Typography>
                  <Typography variant="h5">
                    {(stats.successRate * 100).toFixed(1)}%
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <CreditCard sx={{ fontSize: 40, mr: 2, color: 'warning.main' }} />
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    平均金额
                  </Typography>
                  <Typography variant="h5">
                    ${stats.averageAmount.toFixed(2)}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                每日收入趋势
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stats.dailyRevenue}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(value) => format(new Date(value), 'MM-dd')}
                  />
                  <YAxis />
                  <Tooltip 
                    labelFormatter={(value) => format(new Date(value), 'yyyy-MM-dd')}
                    formatter={(value: number) => [`$${value.toFixed(2)}`, '收入']}
                  />
                  <Legend />
                  <Bar dataKey="amount" fill="#8884d8" name="收入" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                支付方式分布
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={stats.revenueByMethod}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ method, percent }: any) => `${method} ${((percent || 0) * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="amount"
                  >
                    {stats.revenueByMethod.map((entry, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => [`$${value.toFixed(2)}`, '金额']} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

const PaymentDetailsDialog: React.FC<{
  payment: Payment;
  open: boolean;
  onClose: () => void;
}> = ({ payment, open, onClose }) => {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>支付详情 - {payment.id}</DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 2 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" color="textSecondary">
                支付金额
              </Typography>
              <Typography variant="h6">
                {payment.currency} {payment.amount.toFixed(2)}
              </Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" color="textSecondary">
                支付状态
              </Typography>
              <PaymentStatusChip status={payment.status} />
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" color="textSecondary">
                支付渠道
              </Typography>
              <Typography variant="body1">
                {payment.provider}
              </Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" color="textSecondary">
                支付时间
              </Typography>
              <Typography variant="body1">
                {format(new Date(payment.createdAt), 'yyyy-MM-dd HH:mm:ss', { locale: zhCN })}
              </Typography>
            </Grid>
            <Grid item xs={12}>
              <Typography variant="subtitle2" color="textSecondary">
                用户信息
              </Typography>
              <Typography variant="body1">
                {payment.user?.email} {payment.user?.name && `(${payment.user.name})`}
              </Typography>
            </Grid>
            {payment.subscription && (
              <Grid item xs={12}>
                <Typography variant="subtitle2" color="textSecondary">
                  关联订阅
                </Typography>
                <Typography variant="body1">
                  {payment.subscription.plan.name}
                </Typography>
              </Grid>
            )}
            {payment.metadata && (
              <Grid item xs={12}>
                <Typography variant="subtitle2" color="textSecondary">
                  元数据
                </Typography>
                <Paper variant="outlined" sx={{ p: 1, mt: 1 }}>
                  <pre style={{ fontSize: '12px', margin: 0 }}>
                    {JSON.stringify(payment.metadata, null, 2)}
                  </pre>
                </Paper>
              </Grid>
            )}
          </Grid>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>关闭</Button>
      </DialogActions>
    </Dialog>
  );
};

export const PaymentListEnhanced: React.FC = () => {
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(0);

  const handleViewDetails = (payment: Payment) => {
    setSelectedPayment(payment);
    setDetailsDialogOpen(true);
  };

  return (
    <Box>
      <List
        actions={<PaymentActions />}
        filters={<PaymentFilters />}
        title="支付记录管理"
        exporter={false}
      >
        <Box sx={{ width: '100%' }}>
          <Tabs value={activeTab} onChange={(_e, newValue: number) => setActiveTab(newValue)}>
            <Tab label="支付记录" />
            <Tab label="统计分析" />
          </Tabs>

          {activeTab === 0 && (
            <Box sx={{ mt: 2 }}>
              <Datagrid
                rowClick={(id: any, resource: string, record: any) => { handleViewDetails(record); return false; }}
                bulkActionButtons={false}
              >
                <TextField source="id" label="ID" />
                <ReferenceField
                  source="userId"
                  reference="users"
                  label="用户"
                  link={false}
                >
                  <TextField source="email" />
                </ReferenceField>
                <ReferenceField
                  source="subscriptionId"
                  reference="subscriptions"
                  label="订阅"
                  link={false}
                >
                  <TextField source="plan.name" />
                </ReferenceField>
                <NumberField
                  source="amount"
                  label="金额"
                  options={{
                    style: 'currency',
                    currency: 'USD',
                  }}
                />
                <FunctionField
                  source="status"
                  label="状态"
                  sortable={false}
                  render={(record: any) => record && <PaymentStatusChip status={record.status} />}
                />
                <TextField source="provider" label="支付渠道" />
                <DateField
                  source="createdAt"
                  label="创建时间"
                  showTime
                  locales="zh-CN"
                />
              </Datagrid>
            </Box>
          )}

          {activeTab === 1 && (
            <Box sx={{ mt: 2 }}>
              <PaymentStatsDashboard />
            </Box>
          )}
        </Box>
      </List>

      {selectedPayment && (
        <PaymentDetailsDialog
          payment={selectedPayment}
          open={detailsDialogOpen}
          onClose={() => setDetailsDialogOpen(false)}
        />
      )}
    </Box>
  );
};

export default PaymentListEnhanced;
