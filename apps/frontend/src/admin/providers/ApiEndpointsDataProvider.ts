import { DataProvider } from 'react-admin';

const apiEndpoints = [
  {
    id: '/api/siterank/rank',
    name: 'SiteRank 网站排名查询',
    endpoint: '/api/siterank/rank',
    method: 'POST',
    description: '查询网站的Google排名、权重、外链等SEO数据。支持批量查询多个域名，提供详细的SEO分析报告。',
    features: ['网站排名查询', 'SEO数据分析', '批量查询', '历史数据对比'],
    authRequired: true,
    rateLimit: '100次/分钟',
    active: true,
    category: 'SiteRank',
  },
  {
    id: '/api/batchopen/silent-start',
    name: 'BatchOpen 批量打开启动',
    endpoint: '/api/batchopen/silent-start',
    method: 'POST',
    description: '启动批量打开任务，支持HTTP和Puppeteer两种模式。可以批量打开多个URL，进行网页截图、数据提取等操作。',
    features: ['批量URL处理', '多模式支持', '任务队列管理', '进度跟踪'],
    authRequired: true,
    rateLimit: '50次/分钟',
    active: true,
    category: 'BatchOpen',
  },
  {
    id: '/api/batchopen/silent-progress',
    name: 'BatchOpen 任务进度查询',
    endpoint: '/api/batchopen/silent-progress',
    method: 'GET',
    description: '查询批量打开任务的执行进度和结果。包括成功/失败统计、响应时间、错误信息等详细数据。',
    features: ['实时进度查询', '结果统计', '错误分析', '性能监控'],
    authRequired: true,
    rateLimit: '200次/分钟',
    active: true,
    category: 'BatchOpen',
  },
  {
    id: '/api/adscenter/configurations',
    name: 'ChangeLink 配置管理',
    endpoint: '/api/adscenter/configurations',
    method: 'GET',
    description: '管理链接修改任务的配置信息。包括目标URL、替换规则、执行计划等设置。',
    features: ['配置管理', '规则设置', '计划任务', '历史记录'],
    authRequired: true,
    rateLimit: '100次/分钟',
    active: true,
    category: 'ChangeLink',
  },
  {
    id: '/api/adscenter/executions',
    name: 'ChangeLink 执行控制',
    endpoint: '/api/adscenter/executions',
    method: 'POST',
    description: '创建执行并启动，支持取消与查询详情。',
    features: ['创建执行', '取消执行', '查询详情'],
    authRequired: true,
    rateLimit: '30次/分钟',
    active: true,
    category: 'ChangeLink',
  },
  {
    id: '/api/user/profile',
    name: '用户信息查询',
    endpoint: '/api/user/profile',
    method: 'GET',
    description: '获取当前用户的详细信息，包括基本信息、订阅状态、Token余额、使用统计等。',
    features: ['用户信息', '订阅状态', 'Token余额', '使用统计'],
    authRequired: true,
    rateLimit: '500次/分钟',
    active: true,
    category: 'User',
  },
  {
    id: '/api/user/tokens',
    name: 'Token交易记录',
    endpoint: '/api/user/tokens',
    method: 'GET',
    description: '查询用户的Token交易记录，包括获取、消耗、购买等历史数据。',
    features: ['交易记录', '余额查询', '消耗统计', '购买历史'],
    authRequired: true,
    rateLimit: '200次/分钟',
    active: true,
    category: 'User',
  },
  {
    id: '/api/admin/stats',
    name: '管理员统计数据',
    endpoint: '/api/admin/stats',
    method: 'GET',
    description: '获取系统级别的统计数据，包括用户活跃度、API使用情况、系统性能等指标。',
    features: ['系统统计', '用户分析', '性能监控', '使用报告'],
    authRequired: true,
    rateLimit: '100次/分钟',
    active: true,
    category: 'Admin',
    roles: ['ADMIN', 'SUPER_ADMIN'],
  },
];

export const ApiEndpointsDataProvider: DataProvider = {
  getList: (resource, params) => {
    const { page = 1, perPage = 10, filter = {}, sort } = params as any;
    
    let filteredData = [...apiEndpoints];
    
    // Apply filters
    if (filter.q) {
      const searchLower = filter.q.toLowerCase();
      filteredData = filteredData.filter((item: any) => 
        item.name.toLowerCase().includes(searchLower) ||
        item.endpoint.toLowerCase().includes(searchLower) ||
        item.description.toLowerCase().includes(searchLower)
      );
    }
    
    if (filter.method) {
      filteredData = filteredData.filter((item: any) => item.method === filter.method);
    }
    
    if (filter.authRequired !== undefined) {
      filteredData = filteredData.filter((item: any) => 
        item.authRequired === (filter.authRequired === 'true')
      );
    }
    
    // Apply sorting
    if (sort?.field) {
      filteredData.sort((a, b) => {
        const aValue = a[sort.field as keyof typeof a];
        const bValue = b[sort.field as keyof typeof b];
        
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return sort.order === 'ASC' 
            ? aValue.localeCompare(bValue)
            : bValue.localeCompare(aValue);
        }
        
        if (typeof aValue === 'boolean' && typeof bValue === 'boolean') {
          return sort.order === 'ASC'
            ? (aValue === bValue ? 0 : aValue ? 1 : -1)
            : (aValue === bValue ? 0 : aValue ? -1 : 1);
        }
        
        return 0;
      });
    }
    
    // Apply pagination
    const start = (page - 1) * perPage;
    const end = start + perPage;
    const paginatedData = filteredData.slice(start, end);
    
    return Promise.resolve({
      data: paginatedData,
      total: filteredData.length,
    } as any);
  },
  
  getOne: (resource, params) => {
    const api = apiEndpoints.find((item: any) => item.id === params.id);
    if (!api) {
      return Promise.reject(new Error('API endpoint not found'));
    }
    return Promise.resolve({ data: api } as any);
  },
  
  getMany: (resource, params) => {
    const data = apiEndpoints.filter((item: any) => params.ids.includes(item.id));
    return Promise.resolve({ data } as any);
  },
  
  getManyReference: (resource, params) => {
    // Not implemented for this demo
    return Promise.resolve({ data: [], total: 0 });
  },
  
  update: (resource, params) => {
    const index = apiEndpoints.findIndex(item => item.id === params.id);
    if (index === -1) {
      return Promise.reject(new Error('API endpoint not found'));
    }
    
    apiEndpoints[index] = { ...apiEndpoints[index], ...params.data };
    return Promise.resolve({ data: apiEndpoints[index] } as any);
  },
  
  updateMany: (resource, params) => {
    // Not implemented for this demo
    return Promise.resolve({ data: [] } as any);
  },
  
  create: (resource, params) => {
    const newApi = { 
      id: params.data.endpoint,
      name: params.data.name || '',
      endpoint: params.data.endpoint,
      method: params.data.method || 'GET',
      description: params.data.description || '',
      features: params.data.features || [],
      authRequired: params.data.authRequired ?? true,
      rateLimit: params.data.rateLimit || '100/minute',
      active: params.data.active ?? true,
      category: params.data.category || 'Custom',
      ...params.data
    };
    apiEndpoints.push(newApi);
    return Promise.resolve({ data: newApi } as any);
  },
  
  delete: (resource, params) => {
    const index = apiEndpoints.findIndex(item => item.id === params.id);
    if (index === -1) {
      return Promise.reject(new Error('API endpoint not found'));
    }
    
    const [deleted] = apiEndpoints.splice(index, 1);
    return Promise.resolve({ data: deleted } as any);
  },
  
  deleteMany: (resource, params) => {
    // Not implemented for this demo
    return Promise.resolve({ data: [] } as any);
  },
};
