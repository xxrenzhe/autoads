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
  Chip,
  Alert,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tabs,
  Tab,
  InputAdornment,
  IconButton,
  Tooltip,
  Badge,
  Grid,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  MenuItem,
} from '@mui/material';
import {
  ExpandMore,
  Search,
  Clear,
  Api,
  Security,
  Speed,
  CheckCircle,
  Error as ErrorIcon,
  Warning,
  Info,
  Code,
  Description,
  Http,
  Lock,
  Public,
  Refresh,
  FilterList,
} from '@mui/icons-material';

interface ApiEndpoint {
  id: string;
  path: string;
  method: string;
  category: string;
  description: string;
  authentication: 'none' | 'session' | 'admin' | 'api_key';
  parameters: Array<{
    name: string;
    type: string;
    required: boolean;
    description: string;
  }>;
  responses: Array<{
    status: number;
    description: string;
    example?: any;
  }>;
  examples: Array<{
    title: string;
    request: any;
    response: any;
  }>;
  status: 'active' | 'deprecated' | 'beta' | 'maintenance';
  version: string;
  lastModified: string;
  usage24h: number;
  usageTotal: number;
  avgResponseTime: number;
  errorRate: number;
}

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
      id={`api-tabpanel-${index}`}
      aria-labelledby={`api-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

/**
 * API List Component
 * Displays comprehensive API documentation and status
 */
export const ApiList: React.FC = () => {
  const [apis, setApis] = useState<ApiEndpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [tabValue, setTabValue] = useState(0);
  const [expandedApi, setExpandedApi] = useState<string | null>(null);

  const categories = [
    { value: 'all', label: '全部', icon: <Api /> },
    { value: 'auth', label: '认证', icon: <Security /> },
    { value: 'admin', label: '管理', icon: <Lock /> },
    { value: 'user', label: '用户', icon: <Public /> },
    { value: 'payment', label: '支付', icon: <Http /> },
    { value: 'core', label: '核心功能', icon: <Code /> },
  ];

  const statusOptions = [
    { value: 'all', label: '全部状态' },
    { value: 'active', label: '活跃' },
    { value: 'deprecated', label: '已弃用' },
    { value: 'beta', label: '测试版' },
    { value: 'maintenance', label: '维护中' },
  ];

  useEffect(() => {
    fetchApiList();
  }, []);

  const fetchApiList = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/documentation/apis');
      
      if (!response.ok) {
        throw new Error('Failed to fetch API list');
      }
      
      const data = await response.json();
      setApis(data.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load API list');
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  };

  const clearSearch = () => {
    setSearchTerm('');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'success';
      case 'deprecated': return 'error';
      case 'beta': return 'warning';
      case 'maintenance': return 'info';
      default: return 'default';
    }
  };

  const getMethodColor = (method: string) => {
    switch (method.toUpperCase()) {
      case 'GET': return 'info';
      case 'POST': return 'success';
      case 'PUT': return 'warning';
      case 'DELETE': return 'error';
      case 'PATCH': return 'secondary';
      default: return 'default';
    }
  };

  const getAuthIcon = (auth: string) => {
    switch (auth) {
      case 'none': return <Public color="success" />;
      case 'session': return <Security color="info" />;
      case 'admin': return <Lock color="error" />;
      case 'api_key': return <Code color="warning" />;
      default: return <Info />;
    }
  };

  const filteredApis = apis.filter(api => {
    const matchesSearch = api.path.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         api.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || api.category === selectedCategory;
    const matchesStatus = selectedStatus === 'all' || api.status === selectedStatus;
    
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const groupedApis = filteredApis.reduce((groups, api) => {
    const category = api.category;
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(api);
    return groups;
  }, {} as { [key: string]: ApiEndpoint[] });

  const renderApiDetails = (api: ApiEndpoint) => (
    <Box sx={{ mt: 2 }}>
      <Grid container spacing={3}>
        {/* Basic Information */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="h6" gutterBottom>
                基本信息
              </Typography>
              <List dense>
                <ListItem>
                  <ListItemIcon>
                    <Http />
                  </ListItemIcon>
                  <ListItemText
                    primary="请求方法"
                    secondary={
                      <Chip
                        label={api.method.toUpperCase()}
                        color={getMethodColor(api.method)}
                        size="small"
                      />
                    }
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    {getAuthIcon(api.authentication)}
                  </ListItemIcon>
                  <ListItemText
                    primary="认证要求"
                    secondary={api.authentication === 'none' ? '无需认证' : 
                              api.authentication === 'session' ? '会话认证' :
                              api.authentication === 'admin' ? '管理员认证' : 'API密钥'}
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <Info />
                  </ListItemIcon>
                  <ListItemText
                    primary="版本"
                    secondary={api.version}
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <Speed />
                  </ListItemIcon>
                  <ListItemText
                    primary="平均响应时间"
                    secondary={`${api.avgResponseTime}ms`}
                  />
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Usage Statistics */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="h6" gutterBottom>
                使用统计
              </Typography>
              <List dense>
                <ListItem>
                  <ListItemText
                    primary="24小时调用量"
                    secondary={api.usage24h.toLocaleString()}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="总调用量"
                    secondary={api.usageTotal.toLocaleString()}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="错误率"
                    secondary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2">
                          {(api.errorRate * 100).toFixed(2)}%
                        </Typography>
                        {api.errorRate > 0.05 && <Warning color="error" fontSize="small" />}
                        {api.errorRate <= 0.01 && <CheckCircle color="success" fontSize="small" />}
                      </Box>
                    }
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="最后更新"
                    secondary={new Date(api.lastModified).toLocaleString()}
                  />
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Parameters */}
        {api.parameters.length > 0 && (
          <Grid size={{ xs: 12 }}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  请求参数
                </Typography>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>参数名</TableCell>
                        <TableCell>类型</TableCell>
                        <TableCell>是否必需</TableCell>
                        <TableCell>描述</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {api.parameters.map((param, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <code>{param.name}</code>
                          </TableCell>
                          <TableCell>
                            <Chip label={param.type} size="small" variant="outlined" />
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={param.required ? '必需' : '可选'}
                              color={param.required ? 'error' : 'default'}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>{param.description}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Response Examples */}
        {api.responses.length > 0 && (
          <Grid size={{ xs: 12 }}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  响应格式
                </Typography>
                {api.responses.map((response, index) => (
                  <Box key={index} sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      <Chip
                        label={`${response.status} ${response.description}`}
                        color={response.status < 400 ? 'success' : 'error'}
                        size="small"
                      />
                    </Typography>
                    {response.example && (
                      <Paper variant="outlined" sx={{ p: 1, bgcolor: 'grey.50' }}>
                        <Typography variant="caption" component="pre" sx={{ m: 0 }}>
                          {JSON.stringify(response.example, null, 2)}
                        </Typography>
                      </Paper>
                    )}
                  </Box>
                ))}
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Usage Examples */}
        {api.examples.length > 0 && (
          <Grid size={{ xs: 12 }}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  使用示例
                </Typography>
                {api.examples.map((example, index) => (
                  <Accordion key={index} sx={{ mb: 1 }}>
                    <AccordionSummary expandIcon={<ExpandMore />}>
                      <Typography variant="subtitle2">{example.title}</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Grid container spacing={2}>
                        <Grid size={{ xs: 12, md: 6 }}>
                          <Typography variant="overline" display="block">
                            请求
                          </Typography>
                          <Paper variant="outlined" sx={{ p: 1, bgcolor: 'grey.50' }}>
                            <Typography variant="caption" component="pre" sx={{ m: 0 }}>
                              {JSON.stringify(example.request, null, 2)}
                            </Typography>
                          </Paper>
                        </Grid>
                        <Grid size={{ xs: 12, md: 6 }}>
                          <Typography variant="overline" display="block">
                            响应
                          </Typography>
                          <Paper variant="outlined" sx={{ p: 1, bgcolor: 'grey.50' }}>
                            <Typography variant="caption" component="pre" sx={{ m: 0 }}>
                              {JSON.stringify(example.response, null, 2)}
                            </Typography>
                          </Paper>
                        </Grid>
                      </Grid>
                    </AccordionDetails>
                  </Accordion>
                ))}
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>
    </Box>
  );

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
        <Button onClick={fetchApiList} sx={{ ml: 2 }}>
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
            <Api sx={{ mr: 1 }} />
            API文档管理
          </Typography>
          <Typography variant="body2" color="text.secondary">
            查看和管理所有API接口的文档和状态
          </Typography>
        </Box>
        
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={fetchApiList}
            disabled={loading}
          >
            刷新
          </Button>
        </Box>
      </Box>

      {/* Search and Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                placeholder="搜索API路径或描述..."
                value={searchTerm}
                onChange={handleSearchChange}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search />
                    </InputAdornment>
                  ),
                  endAdornment: searchTerm && (
                    <InputAdornment position="end">
                      <IconButton onClick={clearSearch} edge="end">
                        <Clear />
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField
                fullWidth
                select
                label="分类"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                {categories.map((category) => (
                  <MenuItem key={category.value} value={category.value}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {category.icon}
                      {category.label}
                    </Box>
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField
                fullWidth
                select
                label="状态"
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
              >
                {statusOptions.map((status) => (
                  <MenuItem key={status.value} value={status.value}>
                    {status.label}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* API List */}
      <Tabs value={tabValue} onChange={handleTabChange}>
        <Tab label="列表视图" id="api-tab-0" />
        <Tab label="分类视图" id="api-tab-1" />
      </Tabs>

      {/* List View */}
      <TabPanel value={tabValue} index={0}>
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>路径</TableCell>
                <TableCell>方法</TableCell>
                <TableCell>分类</TableCell>
                <TableCell>描述</TableCell>
                <TableCell>状态</TableCell>
                <TableCell>24h调用量</TableCell>
                <TableCell>错误率</TableCell>
                <TableCell>操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredApis.map((api) => (
                <TableRow key={api.id} hover>
                  <TableCell>
                    <Typography variant="body2" component="code">
                      {api.path}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={api.method.toUpperCase()}
                      color={getMethodColor(api.method)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {categories.find(c => c.value === api.category)?.icon}
                      {categories.find(c => c.value === api.category)?.label}
                    </Box>
                  </TableCell>
                  <TableCell>{api.description}</TableCell>
                  <TableCell>
                    <Chip
                      label={api.status}
                      color={getStatusColor(api.status)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>{api.usage24h.toLocaleString()}</TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2">
                        {(api.errorRate * 100).toFixed(2)}%
                      </Typography>
                      {api.errorRate > 0.05 && <Warning color="error" fontSize="small" />}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <IconButton
                      size="small"
                      onClick={() => setExpandedApi(expandedApi === api.id ? null : api.id)}
                    >
                      <Description />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {filteredApis.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Info sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary">
              未找到匹配的API
            </Typography>
            <Typography variant="body2" color="text.secondary">
              请尝试调整搜索条件或过滤器
            </Typography>
          </Box>
        )}

        {/* Expanded API Details */}
        {expandedApi && (
          <Paper variant="outlined" sx={{ mt: 2 }}>
            <Box sx={{ p: 2 }}>
              {renderApiDetails(filteredApis.find(api => api.id === expandedApi)!)}
            </Box>
          </Paper>
        )}
      </TabPanel>

      {/* Category View */}
      <TabPanel value={tabValue} index={1}>
        {Object.entries(groupedApis).map(([category, categoryApis]) => (
          <Card key={category} sx={{ mb: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                {categories.find(c => c.value === category)?.icon}
                <Typography variant="h6" sx={{ ml: 1 }}>
                  {categories.find(c => c.value === category)?.label}
                </Typography>
                <Badge
                  badgeContent={categoryApis.length}
                  color="primary"
                  sx={{ ml: 1 }}
                />
              </Box>

              {categoryApis.map((api) => (
                <Accordion key={api.id}>
                  <AccordionSummary expandIcon={<ExpandMore />}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip
                          label={api.method.toUpperCase()}
                          color={getMethodColor(api.method)}
                          size="small"
                        />
                        <Typography variant="body2" component="code">
                          {api.path}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip
                          label={api.status}
                          color={getStatusColor(api.status)}
                          size="small"
                        />
                        <Typography variant="caption" color="text.secondary">
                          {api.usage24h.toLocaleString()}/24h
                        </Typography>
                      </Box>
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    {renderApiDetails(api)}
                  </AccordionDetails>
                </Accordion>
              ))}
            </CardContent>
          </Card>
        ))}

        {Object.keys(groupedApis).length === 0 && (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Info sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary">
              未找到匹配的API
            </Typography>
            <Typography variant="body2" color="text.secondary">
              请尝试调整搜索条件或过滤器
            </Typography>
          </Box>
        )}
      </TabPanel>
    </Box>
  );
};