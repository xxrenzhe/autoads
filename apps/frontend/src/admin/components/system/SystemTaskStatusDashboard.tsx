import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TablePagination,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  LinearProgress
} from '@mui/material';
import {
  Refresh,
  Schedule,
  CheckCircle,
  Error,
  Warning,
  Info,
  ExpandMore,
  History
} from '@mui/icons-material';
import { useNotify, useRefresh } from 'react-admin';

interface TaskExecution {
  id: string;
  action: string;
  resource: string;
  level: string;
  message: string;
  metadata: any;
  timestamp: string;
}

interface ServiceStart {
  id: string;
  action: string;
  resource: string;
  level: string;
  message: string;
  metadata: any;
  timestamp: string;
}

interface TaskStats {
  action: string;
  _count: {
    id: number;
  };
}

interface TaskStatusResponse {
  recentExecutions: TaskExecution[];
  serviceStarts: ServiceStart[];
  taskStats: TaskStats[];
  latestExecutions: TaskExecution[];
  summary: {
    totalExecutions: number;
    serviceStartCount: number;
    lastServiceStart: string | null;
  };
}

/**
 * System Task Status Dashboard Component
 */
export const SystemTaskStatusDashboard: React.FC = () => {
  const notify = useNotify();
  const refresh = useRefresh();
  
  const [data, setData] = useState<TaskStatusResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [expandedAccordion, setExpandedAccordion] = useState<string | false>('executions');

  // Load data
  const loadData = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/system/task-status');
      if (response.ok) {
        const result = await response.json();
        setData(result);
      } else {
        notify('Failed to load task status', { type: 'error' });
      }
    } catch (error) {
      notify('Network error', { type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAccordionChange = (panel: string) => (event: React.SyntheticEvent, isExpanded: boolean) => {
    setExpandedAccordion(isExpanded ? panel : false);
  };

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'error':
        return <Error color="error" />;
      case 'warning':
        return <Warning color="warning" />;
      case 'info':
        return <Info color="info" />;
      default:
        return <CheckCircle color="success" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'error':
        return 'error';
      case 'started':
        return 'info';
      default:
        return 'default';
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('zh-CN');
  };

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5">系统任务状态</Typography>
        <Button
          variant="outlined"
          startIcon={<Refresh />}
          onClick={loadData}
          disabled={loading}
        >
          刷新
        </Button>
      </Box>

      {loading && <LinearProgress sx={{ mb: 2 }} />}

      {/* Summary Cards */}
      {data && (
        <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
          <Card sx={{ flex: 1 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <History color="info" sx={{ mr: 1 }} />
                <Box>
                  <Typography color="textSecondary" variant="body2">
                    总执行次数
                  </Typography>
                  <Typography variant="h4">
                    {data.summary.totalExecutions}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>

          <Card sx={{ flex: 1 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Schedule color="primary" sx={{ mr: 1 }} />
                <Box>
                  <Typography color="textSecondary" variant="body2">
                    服务启动次数
                  </Typography>
                  <Typography variant="h4">
                    {data.summary.serviceStartCount}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>

          <Card sx={{ flex: 1 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <CheckCircle color="success" sx={{ mr: 1 }} />
                <Box>
                  <Typography color="textSecondary" variant="body2">
                    最后启动时间
                  </Typography>
                  <Typography variant="body1">
                    {data.summary.lastServiceStart 
                      ? formatTime(data.summary.lastServiceStart)
                      : '未知'
                    }
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Box>
      )}

      {/* Recent Executions Accordion */}
      <Accordion 
        expanded={expandedAccordion === 'executions'} 
        onChange={handleAccordionChange('executions')}
        sx={{ mb: 2 }}
      >
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Typography variant="h6">最近任务执行记录</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Card>
            <CardContent>
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>时间</TableCell>
                      <TableCell>任务ID</TableCell>
                      <TableCell>状态</TableCell>
                      <TableCell>耗时</TableCell>
                      <TableCell>详情</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data?.recentExecutions
                      .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                      .map((execution: any) => (
                        <TableRow key={execution.id}>
                          <TableCell>{formatTime(execution.timestamp)}</TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                              {execution.metadata?.taskId || '-'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              {getLevelIcon(execution.level)}
                              <Chip 
                                label={execution.metadata?.status || execution.level}
                                color={getStatusColor(execution.metadata?.status || execution.level) as any}
                                size="small"
                              />
                            </Box>
                          </TableCell>
                          <TableCell>
                            {execution.metadata?.duration 
                              ? `${execution.metadata.duration}ms` 
                              : '-'
                            }
                          </TableCell>
                          <TableCell>
                            {execution.metadata?.error && (
                              <Typography variant="body2" color="error">
                                {execution.metadata.error}
                              </Typography>
                            )}
                            {execution.metadata?.recovered && (
                              <Chip label="自动恢复" size="small" color="info" />
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </TableContainer>
              
              {data && (
                <TablePagination
                  component="div"
                  count={data.recentExecutions.length}
                  page={page}
                  onPageChange={handleChangePage}
                  rowsPerPage={rowsPerPage}
                  onRowsPerPageChange={handleChangeRowsPerPage}
                  rowsPerPageOptions={[5, 10, 25]}
                />
              )}
            </CardContent>
          </Card>
        </AccordionDetails>
      </Accordion>

      {/* Service Starts Accordion */}
      <Accordion 
        expanded={expandedAccordion === 'starts'} 
        onChange={handleAccordionChange('starts')}
        sx={{ mb: 2 }}
      >
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Typography variant="h6">服务启动记录</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Card>
            <CardContent>
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>启动时间</TableCell>
                      <TableCell>任务数量</TableCell>
                      <TableCell>启用的任务</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data?.serviceStarts.map((start: any) => (
                      <TableRow key={start.id}>
                        <TableCell>{formatTime(start.timestamp)}</TableCell>
                        <TableCell>{start.metadata?.tasksCount || 0}</TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {start.metadata?.enabledTasks?.map((taskId: string: any) => (
                              <Chip 
                                key={taskId}
                                label={taskId}
                                size="small"
                                variant="outlined"
                              />
                            ))}
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </AccordionDetails>
      </Accordion>

      {/* Task Statistics Accordion */}
      <Accordion 
        expanded={expandedAccordion === 'stats'} 
        onChange={handleAccordionChange('stats')}
      >
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Typography variant="h6">任务统计</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Card>
            <CardContent>
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>任务类型</TableCell>
                      <TableCell>执行次数</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data?.taskStats.map((stat: any) => (
                      <TableRow key={stat.action}>
                        <TableCell>{stat.action}</TableCell>
                        <TableCell>
                          <Typography variant="h6">
                            {stat._count.id}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </AccordionDetails>
      </Accordion>
    </Box>
  );
};