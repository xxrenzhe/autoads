import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  TextField,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Alert,
  CircularProgress,
  Divider,
  Chip,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Tooltip,
} from '@mui/material';
import { Grid } from '@mui/material';
import {
  Save,
  Cancel,
  Add,
  Delete,
  Edit,
  Preview,
  Warning,
  Info,
  CheckCircle,
  History,
  Settings,
  Token,
} from '@mui/icons-material';

interface TokenRule {
  id: string;
  feature: string;
  method: string;
  cost: number;
  description: string;
  isActive: boolean;
  lastModified: string;
  modifiedBy: string;
  usage24h?: number;
  usageTotal?: number;
}

interface TokenRuleFormData {
  feature: string;
  method: string;
  cost: number;
  description: string;
  isActive: boolean;
  reason: string;
}

interface TokenRulesEditProps {
  open: boolean;
  onClose: () => void;
  rule?: TokenRule | null;
  onSave: (rule: TokenRule) => void;
}

const FEATURE_OPTIONS = [
  { value: 'siterank', label: 'SiteRank', description: '网站排名查询功能' },
  { value: 'batchopen', label: 'BatchOpen', description: '批量网页打开功能' },
  { value: 'adscenter', label: 'AdsCenter', description: '链接转换功能' },
  { value: 'api', label: 'API', description: 'API调用功能' },
  { value: 'webhook', label: 'Webhook', description: 'Webhook功能' },
  { value: 'notification', label: 'Notification', description: '通知功能' },
  { value: 'report', label: 'Report', description: '报告生成功能' },
  { value: 'export', label: 'Export', description: '数据导出功能' },
];

const METHOD_OPTIONS = {
  siterank: [
    { value: 'default', label: '默认查询' },
    { value: 'detailed', label: '详细查询' },
    { value: 'bulk', label: '批量查询' },
  ],
  batchopen: [
    { value: 'http', label: 'HTTP模式' },
    { value: 'puppeteer', label: 'Puppeteer模式' },
    { value: 'selenium', label: 'Selenium模式' },
  ],
  adscenter: [
    { value: 'default', label: '默认转换' },
    { value: 'advanced', label: '高级转换' },
  ],
  default: [
    { value: 'default', label: '默认' },
  ],
};

/**
 * Token Rules Edit Interface Component
 */
export const TokenRulesEdit: React.FC<TokenRulesEditProps> = ({
  open,
  onClose,
  rule,
  onSave,
}) => {
  const [formData, setFormData] = useState<TokenRuleFormData>({
    feature: '',
    method: 'default',
    cost: 1,
    description: '',
    isActive: true,
    reason: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [validationErrors, setValidationErrors] = useState<{ [key: string]: string }>({});

  // Initialize form data when rule changes
  useEffect(() => {
    if (rule) {
      setFormData({
        feature: rule.feature,
        method: rule.method,
        cost: rule.cost,
        description: rule.description,
        isActive: rule.isActive,
        reason: '',
      });
    } else {
      setFormData({
        feature: '',
        method: 'default',
        cost: 1,
        description: '',
        isActive: true,
        reason: '',
      });
    }
    setError(null);
    setValidationErrors({});
  }, [rule, open]);

  const handleInputChange = (field: keyof TokenRuleFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear validation error for this field
    if (validationErrors[field]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const validateForm = (): boolean => {
    const errors: { [key: string]: string } = {};

    if (!formData.feature) {
      errors.feature = '请选择功能类型';
    }

    if (!formData.method) {
      errors.method = '请选择方法类型';
    }

    if (formData.cost < 0) {
      errors.cost = 'Token成本不能为负数';
    }

    if (formData.cost > 100) {
      errors.cost = 'Token成本不能超过100';
    }

    if (!formData.description.trim()) {
      errors.description = '请输入规则描述';
    }

    if (rule && !formData.reason.trim()) {
      errors.reason = '请输入修改原因';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const url = rule ? `/api/admin/tokens/rules/${rule.id}` : '/api/admin/tokens/rules';
      const method = rule ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          feature: formData.feature,
          method: formData.method,
          cost: formData.cost,
          description: formData.description,
          isActive: formData.isActive,
          reason: formData.reason,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to save token rule');
      }

      const data = await response.json();
      
      // Call parent callback with updated rule
      onSave(data.data);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save token rule');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    onClose();
  };

  const getAvailableMethods = () => {
    if (!formData.feature) return METHOD_OPTIONS.default;
    return METHOD_OPTIONS[formData.feature as keyof typeof METHOD_OPTIONS] || METHOD_OPTIONS.default;
  };

  const getCostRecommendation = () => {
    const recommendations: { [key: string]: { [key: string]: number } } = {
      siterank: { default: 1, detailed: 2, bulk: 3 },
      batchopen: { http: 1, puppeteer: 2, selenium: 3 },
      adscenter: { default: 1, advanced: 2 },
    };

    const featureRec = recommendations[formData.feature];
    if (featureRec && featureRec[formData.method]) {
      return featureRec[formData.method];
    }
    return 1;
  };

  const getImpactEstimate = () => {
    // Simulate impact calculation based on cost change
    if (!rule) return null;
    
    const costDiff = formData.cost - rule.cost;
    const percentChange = ((costDiff / rule.cost) * 100).toFixed(1);
    
    return {
      costDiff,
      percentChange,
      impact: Math.abs(costDiff) > 1 ? 'high' : Math.abs(costDiff) > 0 ? 'medium' : 'low',
    };
  };

  const renderPreview = () => {
    const impact = getImpactEstimate();
    
    return (
      <Box sx={{ mt: 2 }}>
        <Typography variant="h6" gutterBottom>
          规则预览
        </Typography>
        
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <Typography variant="subtitle2" color="text.secondary">
                功能类型
              </Typography>
              <Typography variant="body1">
                {FEATURE_OPTIONS.find((f: any) => f.value === formData.feature)?.label || formData.feature}
              </Typography>
            </Grid>
            
            <Grid item xs={6}>
              <Typography variant="subtitle2" color="text.secondary">
                方法类型
              </Typography>
              <Typography variant="body1">
                {getAvailableMethods().find((m: any) => m.value === formData.method)?.label || formData.method}
              </Typography>
            </Grid>
            
            <Grid item xs={6}>
              <Typography variant="subtitle2" color="text.secondary">
                Token成本
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Chip
                  label={`${formData.cost} Token${formData.cost > 1 ? 's' : ''}`}
                  color={formData.cost <= 1 ? 'success' : formData.cost <= 3 ? 'warning' : 'error'}
                />
                {rule && impact && impact.costDiff !== 0 && (
                  <Chip
                    label={`${impact.costDiff > 0 ? '+' : ''}${impact.costDiff} (${impact.percentChange}%)`}
                    color={impact.costDiff > 0 ? 'error' : 'success'}
                    size="small"
                  />
                )}
              </Box>
            </Grid>
            
            <Grid item xs={6}>
              <Typography variant="subtitle2" color="text.secondary">
                状态
              </Typography>
              <Chip
                label={formData.isActive ? '启用' : '禁用'}
                color={formData.isActive ? 'success' : 'default'}
                size="small"
              />
            </Grid>
            
            <Grid item xs={12}>
              <Typography variant="subtitle2" color="text.secondary">
                描述
              </Typography>
              <Typography variant="body2">
                {formData.description || '无描述'}
              </Typography>
            </Grid>
          </Grid>
        </Paper>

        {impact && impact.impact !== 'low' && (
          <Alert severity={impact.impact === 'high' ? 'warning' : 'info'} sx={{ mb: 2 }}>
            <Typography variant="subtitle2">
              影响评估: {impact.impact === 'high' ? '高影响' : '中等影响'}
            </Typography>
            <Typography variant="body2">
              此更改将{impact.costDiff > 0 ? '增加' : '减少'}用户的Token消费成本。
              建议在非高峰时段进行更改，并通知相关用户。
            </Typography>
          </Alert>
        )}
      </Box>
    );
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { minHeight: '600px' }
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Token />
          <Typography variant="h6">
            {rule ? '编辑Token规则' : '创建Token规则'}
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
          <Button
            variant={previewMode ? 'outlined' : 'contained'}
            startIcon={<Edit />}
            onClick={() => setPreviewMode(false)}
            size="small"
          >
            编辑
          </Button>
          <Button
            variant={previewMode ? 'contained' : 'outlined'}
            startIcon={<Preview />}
            onClick={() => setPreviewMode(true)}
            size="small"
            disabled={!formData.feature}
          >
            预览
          </Button>
        </Box>

        {previewMode ? (
          renderPreview()
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Basic Information */}
            <Box>
              <Typography variant="h6" gutterBottom>
                基本信息
              </Typography>
              
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth error={!!validationErrors.feature}>
                    <InputLabel>功能类型</InputLabel>
                    <Select
                      value={formData.feature}
                      label="功能类型"
                      onChange={(e) => {
                        handleInputChange('feature', (e.target as unknown as HTMLInputElement).value);
                        // Reset method when feature changes
                        handleInputChange('method', 'default');
                      }}
                      disabled={loading}
                    >
                      {FEATURE_OPTIONS.map((option: any) => (
                        <MenuItem key={option.value} value={option.value}>
                          <Box>
                            <Typography variant="body1">{option.label}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              {option.description}
                            </Typography>
                          </Box>
                        </MenuItem>
                      ))}
                    </Select>
                    {validationErrors.feature && (
                      <Typography variant="caption" color="error">
                        {validationErrors.feature}
                      </Typography>
                    )}
                  </FormControl>
                </Grid>

                <Grid item xs={12} md={6}>
                  <FormControl fullWidth error={!!validationErrors.method}>
                    <InputLabel>方法类型</InputLabel>
                    <Select
                      value={formData.method}
                      label="方法类型"
                      onChange={(e) => handleInputChange('method', (e.target as unknown as HTMLInputElement).value)}
                      disabled={loading || !formData.feature}
                    >
                      {getAvailableMethods().map((option: any) => (
                        <MenuItem key={option.value} value={option.value}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </Select>
                    {validationErrors.method && (
                      <Typography variant="caption" color="error">
                        {validationErrors.method}
                      </Typography>
                    )}
                  </FormControl>
                </Grid>

                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="规则描述"
                    value={formData.description}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('description', e.target.value)}
                    error={!!validationErrors.description}
                    helperText={validationErrors.description}
                    disabled={loading}
                    multiline
                    rows={2}
                  />
                </Grid>
              </Grid>
            </Box>

            <Divider />

            {/* Cost Configuration */}
            <Box>
              <Typography variant="h6" gutterBottom>
                成本配置
              </Typography>
              
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Token成本"
                    type="number"
                    value={formData.cost}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('cost', parseInt(e.target.value) || 0)}
                    error={!!validationErrors.cost}
                    helperText={validationErrors.cost}
                    disabled={loading}
                    inputProps={{ min: 0, max: 100 }}
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Info color="info" />
                    <Typography variant="body2" color="text.secondary">
                      推荐成本: {getCostRecommendation()} Token
                    </Typography>
                    {formData.cost !== getCostRecommendation() && (
                      <Button
                        size="small"
                        onClick={() => handleInputChange('cost', getCostRecommendation())}
                      >
                        使用推荐值
                      </Button>
                    )}
                  </Box>
                </Grid>

                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={formData.isActive}
                        onChange={(e) => handleInputChange('isActive', (e.target as HTMLInputElement).checked)}
                        disabled={loading}
                      />
                    }
                    label="启用此规则"
                  />
                </Grid>
              </Grid>
            </Box>

            {rule && (
              <>
                <Divider />
                
                {/* Change Reason */}
                <Box>
                  <Typography variant="h6" gutterBottom>
                    修改信息
                  </Typography>
                  
                  <TextField
                    fullWidth
                    label="修改原因"
                    value={formData.reason}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('reason', e.target.value)}
                    error={!!validationErrors.reason}
                    helperText={validationErrors.reason || '请说明此次修改的原因，这将记录在审计日志中'}
                    disabled={loading}
                    multiline
                    rows={2}
                    required
                  />
                </Box>
              </>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button
          onClick={handleCancel}
          disabled={loading}
        >
          取消
        </Button>
        
        {!previewMode && (
          <Button
            onClick={handleSave}
            variant="contained"
            disabled={loading || !formData.feature}
            startIcon={loading ? <CircularProgress size={16} /> : <Save />}
          >
            {loading ? '保存中...' : rule ? '更新规则' : '创建规则'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};
