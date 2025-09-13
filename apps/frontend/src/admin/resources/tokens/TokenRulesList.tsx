import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Chip,
  Alert,
  CircularProgress,
  Tooltip,
  Switch,
  FormControlLabel,
} from '@mui/material';
import {
  Edit,
  Save,
  Cancel,
  Refresh,
  Info,
  History,
  Settings,
  Token,
  TrendingUp,
  Warning,
  Add,
  FlashOn,
} from '@mui/icons-material';
import { TokenRulesEdit } from './TokenRulesEdit';

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

interface TokenRuleHistory {
  id: string;
  ruleId: string;
  previousCost: number;
  newCost: number;
  modifiedBy: string;
  modifiedAt: string;
  reason: string;
}

/**
 * Token Rules List Component
 * Displays and manages token consumption rules for different features
 */
export const TokenRulesList: React.FC = () => {
  const [rules, setRules] = useState<TokenRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingRule, setEditingRule] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{ [key: string]: number }>({});
  const [historyDialog, setHistoryDialog] = useState<{ open: boolean; ruleId: string | null }>({
    open: false,
    ruleId: null,
  });
  const [ruleHistory, setRuleHistory] = useState<TokenRuleHistory[]>([]);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    ruleId: string | null;
    newCost: number;
    oldCost: number;
  }>({
    open: false,
    ruleId: null,
    newCost: 0,
    oldCost: 0,
  });
  const [editDialog, setEditDialog] = useState<{
    open: boolean;
    rule: TokenRule | null;
  }>({
    open: false,
    rule: null,
  });

  useEffect(() => {
    fetchTokenRules();
  }, []);

  const fetchTokenRules = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/tokens/rules');
      
      if (!response.ok) {
        throw new Error('Failed to fetch token rules');
      }
      
      const data = await response.json();
      setRules(data.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load token rules');
    } finally {
      setLoading(false);
    }
  };

  const fetchRuleHistory = async (ruleId: string) => {
    try {
      const response = await fetch(`/api/admin/tokens/rules/${ruleId}/history`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch rule history');
      }
      
      const data = await response.json();
      setRuleHistory(data.data || []);
    } catch (err: any) {
      console.error('Failed to fetch rule history:', err);
      setRuleHistory([]);
    }
  };

  const handleEditStart = (ruleId: string, currentCost: number) => {
    setEditingRule(ruleId);
    setEditValues({ [ruleId]: currentCost });
  };

  const handleEditCancel = () => {
    setEditingRule(null);
    setEditValues({});
  };

  const handleEditSave = (ruleId: string) => {
    const rule = rules.find((r: any) => r.id === ruleId);
    const newCost = editValues[ruleId];
    
    if (!rule || newCost === undefined) return;
    
    setConfirmDialog({
      open: true,
      ruleId,
      newCost,
      oldCost: rule.cost,
    });
  };

  const confirmCostChange = async () => {
    const { ruleId, newCost } = confirmDialog;
    
    if (!ruleId) return;
    
    try {
      const response = await fetch(`/api/admin/tokens/rules/${ruleId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cost: newCost,
          reason: 'Admin cost adjustment',
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to update token rule');
      }
      
      // Refresh rules list
      await fetchTokenRules();
      
      // Reset editing state
      setEditingRule(null);
      setEditValues({});
      setConfirmDialog({ open: false, ruleId: null, newCost: 0, oldCost: 0 });
      
    } catch (err: any) {
      setError(err.message || 'Failed to update token rule');
    }
  };

  const handleToggleActive = async (ruleId: string, isActive: boolean) => {
    try {
      const response = await fetch(`/api/admin/tokens/rules/${ruleId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isActive: !isActive,
          reason: `Rule ${!isActive ? 'activated' : 'deactivated'} by admin`,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to toggle rule status');
      }
      
      await fetchTokenRules();
    } catch (err: any) {
      setError(err.message || 'Failed to toggle rule status');
    }
  };

  const handleShowHistory = async (ruleId: string) => {
    await fetchRuleHistory(ruleId);
    setHistoryDialog({ open: true, ruleId });
  };

  const handleEditRule = (rule: TokenRule) => {
    setEditDialog({ open: true, rule });
  };

  const handleCreateRule = () => {
    setEditDialog({ open: true, rule: null });
  };

  const handleEditSaveComplete = (updatedRule: TokenRule) => {
    // Refresh the rules list
    fetchTokenRules();
    setEditDialog({ open: false, rule: null });
  };

  const handleHotReload = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/tokens/rules/hot-reload', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Hot-reload failed');
      }

      const data = await response.json();
      
      // Show success message and refresh rules
      await fetchTokenRules();
      
      // You could show a success toast here
      console.log('Hot-reload successful:', data.message);
    } catch (err: any) {
      setError(err.message || 'Hot-reload failed');
    } finally {
      setLoading(false);
    }
  };

  const getFeatureDisplayName = (feature: string, method?: string) => {
    const featureNames: { [key: string]: string } = {
      siterank: 'SiteRank',
      batchopen: 'BatchOpen',
      adscenter: 'ChangeLink',
    };
    
    const baseName = featureNames[feature] || feature.toUpperCase();
    return method ? `${baseName} (${method})` : baseName;
  };

  const getCostColor = (cost: number) => {
    if (cost <= 1) return 'success';
    if (cost <= 3) return 'warning';
    return 'error';
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 3 }}>
        {error}
        <Button onClick={fetchTokenRules} sx={{ ml: 2 }}>
          重试
        </Button>
      </Alert>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
            <Token sx={{ mr: 1 }} />
            Token消费规则管理
          </Typography>
          <Typography variant="body2" color="text.secondary">
            管理不同功能的Token消费成本和规则配置
          </Typography>
        </Box>
        
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={handleCreateRule}
            disabled={loading}
          >
            创建规则
          </Button>
          <Button
            variant="contained"
            color="warning"
            startIcon={<FlashOn />}
            onClick={handleHotReload}
            disabled={loading}
          >
            热重载
          </Button>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={fetchTokenRules}
            disabled={loading}
          >
            刷新
          </Button>
        </Box>
      </Box>

      <Card>
        <CardContent>
          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>功能</TableCell>
                  <TableCell align="center">Token成本</TableCell>
                  <TableCell align="center">状态</TableCell>
                  <TableCell align="center">24小时使用量</TableCell>
                  <TableCell align="center">总使用量</TableCell>
                  <TableCell align="center">最后修改</TableCell>
                  <TableCell align="center">操作</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rules.map((rule: any) => (
                  <TableRow key={rule.id} hover>
                    <TableCell>
                      <Box>
                        <Typography variant="subtitle2">
                          {getFeatureDisplayName(rule.feature, rule.method)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {rule.description}
                        </Typography>
                      </Box>
                    </TableCell>
                    
                    <TableCell align="center">
                      {editingRule === rule.id ? (
                        <TextField
                          size="small"
                          type="number"
                          value={editValues[rule.id] || rule.cost}
                          onChange={(e) => setEditValues({
                            ...editValues,
                            [rule.id]: parseInt((e.target as HTMLInputElement).value) || 0
                          })}
                          inputProps={{ min: 0, max: 100 }}
                          sx={{ width: 80 }}
                        />
                      ) : (
                        <Chip
                          label={`${rule.cost} Token${rule.cost > 1 ? 's' : ''}`}
                          color={getCostColor(rule.cost)}
                          size="small"
                        />
                      )}
                    </TableCell>
                    
                    <TableCell align="center">
                      <FormControlLabel
                        control={
                          <Switch
                            checked={rule.isActive}
                            onChange={() => handleToggleActive(rule.id, rule.isActive)}
                            size="small"
                          />
                        }
                        label={rule.isActive ? '启用' : '禁用'}
                        labelPlacement="top"
                      />
                    </TableCell>
                    
                    <TableCell align="center">
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <TrendingUp sx={{ fontSize: 16, mr: 0.5, color: 'text.secondary' }} />
                        <Typography variant="body2">
                          {(rule.usage24h || 0).toLocaleString()}
                        </Typography>
                      </Box>
                    </TableCell>
                    
                    <TableCell align="center">
                      <Typography variant="body2">
                        {(rule.usageTotal || 0).toLocaleString()}
                      </Typography>
                    </TableCell>
                    
                    <TableCell align="center">
                      <Box>
                        <Typography variant="caption" display="block">
                          {new Date(rule.lastModified).toLocaleDateString()}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {rule.modifiedBy}
                        </Typography>
                      </Box>
                    </TableCell>
                    
                    <TableCell align="center">
                      <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                        {editingRule === rule.id ? (
                          <>
                            <Tooltip title="保存更改">
                              <IconButton
                                size="small"
                                color="primary"
                                onClick={() => handleEditSave(rule.id)}
                              >
                                <Save />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="取消编辑">
                              <IconButton
                                size="small"
                                onClick={handleEditCancel}
                              >
                                <Cancel />
                              </IconButton>
                            </Tooltip>
                          </>
                        ) : (
                          <>
                            <Tooltip title="编辑规则">
                              <IconButton
                                size="small"
                                onClick={() => handleEditRule(rule)}
                              >
                                <Edit />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="查看历史">
                              <IconButton
                                size="small"
                                onClick={() => handleShowHistory(rule.id)}
                              >
                                <History />
                              </IconButton>
                            </Tooltip>
                          </>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          
          {rules.length === 0 && (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Settings sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="text.secondary">
                暂无Token规则配置
              </Typography>
              <Typography variant="body2" color="text.secondary">
                系统将使用默认的Token消费规则
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog
        open={confirmDialog.open}
        onClose={() => setConfirmDialog({ open: false, ruleId: null, newCost: 0, oldCost: 0 })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center' }}>
          <Warning sx={{ mr: 1, color: 'warning.main' }} />
          确认成本更改
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            此更改将立即生效并影响所有用户的Token消费
          </Alert>
          <Typography variant="body1" gutterBottom>
            您确定要将Token成本从 <strong>{confirmDialog.oldCost}</strong> 更改为 <strong>{confirmDialog.newCost}</strong> 吗？
          </Typography>
          <Typography variant="body2" color="text.secondary">
            此更改将被记录在审计日志中，并可以在历史记录中查看。
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setConfirmDialog({ open: false, ruleId: null, newCost: 0, oldCost: 0 })}
          >
            取消
          </Button>
          <Button
            onClick={confirmCostChange}
            variant="contained"
            color="warning"
          >
            确认更改
          </Button>
        </DialogActions>
      </Dialog>

      {/* History Dialog */}
      <Dialog
        open={historyDialog.open}
        onClose={() => setHistoryDialog({ open: false, ruleId: null })}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <History sx={{ mr: 1 }} />
            规则变更历史
          </Box>
        </DialogTitle>
        <DialogContent>
          {ruleHistory.length > 0 ? (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>修改时间</TableCell>
                    <TableCell>修改人</TableCell>
                    <TableCell align="center">原成本</TableCell>
                    <TableCell align="center">新成本</TableCell>
                    <TableCell>原因</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {ruleHistory.map((history: any) => (
                    <TableRow key={history.id}>
                      <TableCell>
                        {new Date(history.modifiedAt).toLocaleString()}
                      </TableCell>
                      <TableCell>{history.modifiedBy}</TableCell>
                      <TableCell align="center">
                        <Chip label={history.previousCost} size="small" />
                      </TableCell>
                      <TableCell align="center">
                        <Chip label={history.newCost} size="small" color="primary" />
                      </TableCell>
                      <TableCell>{history.reason}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Info sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
              <Typography variant="body1" color="text.secondary">
                暂无变更历史记录
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHistoryDialog({ open: false, ruleId: null })}>
            关闭
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Dialog */}
      <TokenRulesEdit
        open={editDialog.open}
        rule={editDialog.rule}
        onClose={() => setEditDialog({ open: false, rule: null })}
        onSave={handleEditSaveComplete}
      />
    </Box>
  );
};
