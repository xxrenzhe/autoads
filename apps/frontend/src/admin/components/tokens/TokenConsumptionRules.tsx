import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Grid,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Tabs,
  Tab,
  Chip,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Settings,
  Add,
  Edit,
  Delete,
  Save,
  Cancel,
  Info,
  Calculate,
  Refresh,
} from '@mui/icons-material';
import { useDataProvider, useNotify } from 'react-admin';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`rules-tabpanel-${index}`}
      aria-labelledby={`rules-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

interface TokenRule {
  id: string;
  feature: string;
  action: string;
  baseCost: number;
  conditions: Record<string, any>;
  description: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface TokenConfig {
  siterank: {
    costPerDomain: number;
    batchMultiplier: number;
    description?: string;
  };
  batchopen: {
    costPerUrl: number;
    puppeteerCostPerUrl: number;
    batchMultiplier: number;
    description?: string;
  };
  adscenter: {
    costPerLinkChange: number;
    batchMultiplier: number;
    description?: string;
  };
}

const TokenConsumptionRules: React.FC = () => {
  const dataProvider = useDataProvider();
  const notify = useNotify();
  
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(false);
  const [rules, setRules] = useState<TokenRule[]>([]);
  const [config, setConfig] = useState<TokenConfig | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<TokenRule | null>(null);
  const [editForm, setEditForm] = useState<Partial<TokenRule>>({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch token rules
      const rulesResponse = await fetch('/ops/api/v1/console/token/rules');
      if (rulesResponse.ok) {
        const rulesData = await rulesResponse.json();
        setRules(rulesData);
      }

      // Fetch token config
      const configResponse = await fetch('/ops/api/v1/console/token-config');
      if (configResponse.ok) {
        const configData = await configResponse.json();
        setConfig(configData);
      }
    } catch (error) {
      notify('获取数据失败', { type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleEditRule = (rule: TokenRule) => {
    setEditingRule(rule);
    setEditForm({
      feature: rule.feature,
      action: rule.action,
      baseCost: rule.baseCost,
      conditions: rule.conditions,
      description: rule.description,
      isActive: rule.isActive,
    });
    setEditDialogOpen(true);
  };

  const handleSaveRule = async () => {
    if (!editingRule) return;

    try {
      const response = await fetch(`/ops/api/v1/console/token/rules/${editingRule.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });

      if (response.ok) {
        notify('规则更新成功', { type: 'success' });
        setEditDialogOpen(false);
        fetchData();
      } else {
        notify('规则更新失败', { type: 'error' });
      }
    } catch (error) {
      notify('规则更新失败', { type: 'error' });
    }
  };

  const handleSaveConfig = async () => {
    if (!config) return;

    try {
      const response = await fetch('/ops/api/v1/console/token-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      if (response.ok) {
        notify('配置保存成功', { type: 'success' });
        fetchData();
      } else {
        notify('配置保存失败', { type: 'error' });
      }
    } catch (error) {
      notify('配置保存失败', { type: 'error' });
    }
  };

  const updateConfig = (feature: keyof TokenConfig, field: string, value: any) => {
    if (!config) return;
    setConfig({
      ...config,
      [feature]: {
        ...config[feature],
        [field]: value,
      },
    });
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          Token消耗规则
        </Typography>
        <Button
          variant="outlined"
          onClick={fetchData}
          startIcon={<Refresh />}
        >
          刷新
        </Button>
      </Box>

      <Tabs value={tabValue} onChange={(_e, newValue) => setTabValue(newValue)} sx={{ mb: 3 }}>
        <Tab label="基础配置" />
        <Tab label="详细规则" />
        <Tab label="计算示例" />
      </Tabs>

      {/* Basic Configuration Tab */}
      <TabPanel value={tabValue} index={0}>
        {config && (
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    SiteRank 查询规则
                  </Typography>
                  <Box sx={{ mt: 2 }}>
                    <TextField
                      fullWidth
                      label="每个域名消耗Token"
                      type="number"
                      value={config.siterank.costPerDomain}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateConfig('siterank', 'costPerDomain', Number(e.target.value))}
                      margin="normal"
                    />
                    <TextField
                      fullWidth
                      label="批量操作倍率"
                      type="number"
                      value={config.siterank.batchMultiplier}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateConfig('siterank', 'batchMultiplier', Number(e.target.value))}
                      margin="normal"
                      helperText="批量操作时的折扣倍率，如0.8表示20%折扣"
                    />
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                      规则说明：成功查询1个域名，消耗1个token，不管数据是否来自缓存
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    BatchOpen 批量打开规则
                  </Typography>
                  <Box sx={{ mt: 2 }}>
                    <TextField
                      fullWidth
                      label="HTTP模式 - 每个URL消耗Token"
                      type="number"
                      value={config.batchopen.costPerUrl}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateConfig('batchopen', 'costPerUrl', Number(e.target.value))}
                      margin="normal"
                    />
                    <TextField
                      fullWidth
                      label="Puppeteer模式 - 每个URL消耗Token"
                      type="number"
                      value={config.batchopen.puppeteerCostPerUrl || 2}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateConfig('batchopen', 'puppeteerCostPerUrl', Number(e.target.value))}
                      margin="normal"
                    />
                    <TextField
                      fullWidth
                      label="批量操作倍率"
                      type="number"
                      value={config.batchopen.batchMultiplier}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateConfig('batchopen', 'batchMultiplier', Number(e.target.value))}
                      margin="normal"
                    />
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                      规则说明：HTTP访问模式消耗1个token，Puppeteer访问模式消耗2个token
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12}>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                  variant="contained"
                  onClick={handleSaveConfig}
                  startIcon={<Save />}
                >
                  保存配置
                </Button>
              </Box>
            </Grid>
          </Grid>
        )}
      </TabPanel>

      {/* Detailed Rules Tab */}
      <TabPanel value={tabValue} index={1}>
        <Grid container spacing={3}>
          {rules.map((rule: any) => (
            <Grid item xs={12} md={6} key={rule.id}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <Box>
                      <Typography variant="h6" component="div">
                        {rule.feature} - {rule.action}
                      </Typography>
                      <Chip 
                        label={rule.isActive ? '启用' : '禁用'} 
                        color={rule.isActive ? 'success' : 'default'}
                        size="small"
                        sx={{ mt: 1 }}
                      />
                    </Box>
                    <IconButton
                      onClick={() => handleEditRule(rule)}
                      size="small"
                    >
                      <Edit />
                    </IconButton>
                  </Box>
                  
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    {rule.description}
                  </Typography>
                  
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="body2">
                      <strong>基础消耗：</strong> {rule.baseCost} Token
                    </Typography>
                    {Object.keys(rule.conditions).length > 0 && (
                      <Typography variant="body2" sx={{ mt: 1 }}>
                        <strong>条件：</strong>
                        <pre style={{ fontSize: '12px', marginTop: '4px' }}>
                          {JSON.stringify(rule.conditions, null, 2)}
                        </pre>
                      </Typography>
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </TabPanel>

      {/* Calculation Examples Tab */}
      <TabPanel value={tabValue} index={2}>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Token消耗计算示例
                </Typography>
                
                <Box sx={{ mt: 3 }}>
                  <Typography variant="subtitle1" gutterBottom>
                    1. SiteRank 查询
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    • 查询1个域名 = 消耗 1 Token<br/>
                    • 批量查询10个域名 = 消耗 10 × 0.8 = 8 Token（享受20%批量折扣）
                  </Typography>
                </Box>

                <Box sx={{ mt: 3 }}>
                  <Typography variant="subtitle1" gutterBottom>
                    2. BatchOpen 批量打开
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    • HTTP模式打开1个URL = 消耗 1 Token<br/>
                    • Puppeteer模式打开1个URL = 消耗 2 Token<br/>
                    • 批量打开50个URL（HTTP模式）= 消耗 50 × 0.8 = 40 Token
                  </Typography>
                </Box>

                <Box sx={{ mt: 3 }}>
                  <Typography variant="subtitle1" gutterBottom>
                    3. AdsCenter 链接修改
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    • 修改1个链接 = 消耗 2 Token<br/>
                    • 批量修改20个链接 = 消耗 20 × 2 × 0.8 = 32 Token
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      {/* Edit Rule Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>编辑规则</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="功能"
            value={editForm.feature || ''}
            margin="normal"
            disabled
          />
          <TextField
            fullWidth
            label="操作"
            value={editForm.action || ''}
            margin="normal"
            disabled
          />
          <TextField
            fullWidth
            label="基础消耗"
            type="number"
            value={editForm.baseCost || ''}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditForm({ ...editForm, baseCost: Number(e.target.value) })}
            margin="normal"
          />
          <TextField
            fullWidth
            label="描述"
            value={editForm.description || ''}
            onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
            margin="normal"
            multiline
            rows={3}
          />
          <FormControl fullWidth margin="normal">
            <InputLabel>状态</InputLabel>
            <Select
              value={editForm.isActive ? 'active' : 'inactive'}
              label="状态"
              onChange={(e) => setEditForm({ ...editForm, isActive: (e.target as unknown as HTMLInputElement).value === 'active' })}
            >
              <MenuItem value="active">启用</MenuItem>
              <MenuItem value="inactive">禁用</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>取消</Button>
          <Button onClick={handleSaveRule} variant="contained">
            保存
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TokenConsumptionRules;
