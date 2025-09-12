# Admin Dashboard

## Overview

The admin dashboard provides a comprehensive management interface built with React Admin. It offers user management, system monitoring, business module configuration, and analytics capabilities with role-based access control.

## Directory Structure

```
admin/
├── components/         # Admin-specific components
├── resources/          # Resource definitions for CRUD operations
├── providers/          # Data and authentication providers
└── theme/             # Admin theme customization
```

## Components (`components/`)

Custom components for admin functionality:

### Dashboard Components
- **DashboardStats**: Key metrics and statistics
- **SystemHealth**: Real-time system health monitoring
- **RecentActivity**: Recent user and system activities
- **QuickActions**: Common administrative actions

### User Management
- **UserList**: User listing with search and filters
- **UserEdit**: User profile editing interface
- **UserCreate**: New user creation form
- **RoleAssignment**: Role and permission management

### Business Module Management
- **ModuleConfig**: Business module configuration
- **TaskMonitor**: Background task monitoring
- **PerformanceMetrics**: Module performance analytics

## Resources (`resources/`)

React Admin resource definitions for CRUD operations:

### User Resources
```typescript
export const userResource = {
  list: UserList,
  edit: UserEdit,
  create: UserCreate,
  show: UserShow,
  icon: UserIcon,
  options: { label: 'Users' },
};
```

### Business Resources
- **SiteRank Tasks**: Manage website analysis tasks
- **BatchOpen Tasks**: Monitor batch URL opening tasks
- **AdsCenter Campaigns**: Manage ad campaign configurations
- **Subscriptions**: User subscription management
- **Plans**: Service plan configuration

## Providers (`providers/`)

Custom providers for React Admin integration:

### Data Provider
```typescript
export class AutoAdsDataProvider implements DataProvider {
  async getList(resource: string, params: GetListParams) {
    const { page, perPage } = params.pagination;
    const { field, order } = params.sort;
    const filter = params.filter;

    const response = await apiClient.get(`/admin/${resource}`, {
      params: {
        page,
        limit: perPage,
        sortBy: field,
        sortOrder: order,
        ...filter,
      },
    });

    return {
      data: response.data.items,
      total: response.data.total,
    };
  }

  async getOne(resource: string, params: GetOneParams) {
    const response = await apiClient.get(`/admin/${resource}/${params.id}`);
    return { data: response.data };
  }

  // Additional CRUD methods...
}
```

### Authentication Provider
```typescript
export class AutoAdsAuthProvider implements AuthProvider {
  async login(params: LoginParams) {
    const { email, password } = params;
    const response = await apiClient.post('/auth/login', { email, password });
    
    if (response.data.token) {
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      return Promise.resolve();
    }
    
    return Promise.reject(new Error('Invalid credentials'));
  }

  async checkAuth() {
    const token = localStorage.getItem('token');
    if (!token) {
      return Promise.reject();
    }
    
    try {
      await apiClient.get('/auth/verify', {
        headers: { Authorization: `Bearer ${token}` },
      });
      return Promise.resolve();
    } catch {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      return Promise.reject();
    }
  }

  async getPermissions() {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return Promise.resolve(user.permissions || []);
  }

  // Additional auth methods...
}
```

## Theme (`theme/`)

Custom theme configuration for consistent branding:

```typescript
export const adminTheme = {
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
    background: {
      default: '#f5f5f5',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontSize: '2rem',
      fontWeight: 500,
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
        },
      },
    },
  },
};
```

## Features

### User Management
- **User CRUD**: Create, read, update, delete users
- **Role Assignment**: Assign roles and permissions
- **Activity Monitoring**: Track user activities
- **Bulk Operations**: Bulk user management actions

### System Monitoring
- **Real-time Metrics**: Live system performance data
- **Health Checks**: System component health status
- **Error Tracking**: Application error monitoring
- **Performance Analytics**: System performance insights

### Business Module Management
- **Task Monitoring**: Monitor background tasks
- **Configuration Management**: Module settings
- **Usage Analytics**: Module usage statistics
- **Performance Metrics**: Module performance data

### Subscription Management
- **Plan Management**: Service plan configuration
- **Subscription Tracking**: User subscription status
- **Billing Integration**: Payment and billing management
- **Usage Monitoring**: Resource usage tracking

## Security

### Role-Based Access Control
```typescript
export const permissions = {
  users: {
    list: ['admin', 'manager'],
    create: ['admin'],
    edit: ['admin', 'manager'],
    delete: ['admin'],
  },
  system: {
    monitor: ['admin', 'manager'],
    configure: ['admin'],
  },
  modules: {
    view: ['admin', 'manager', 'user'],
    configure: ['admin', 'manager'],
  },
};
```

### Audit Logging
All administrative actions are logged for audit purposes:

```typescript
export const auditLogger = {
  logAction: (action: string, resource: string, userId: string, details?: any) => {
    logger.info('Admin action performed', {
      action,
      resource,
      userId,
      details,
      timestamp: new Date().toISOString(),
      ip: request.ip,
      userAgent: request.get('User-Agent'),
    });
  },
};
```

## Real-time Updates

WebSocket integration for real-time data updates:

```typescript
export const useRealTimeUpdates = (resource: string) => {
  const [data, setData] = useState([]);
  
  useEffect(() => {
    const socket = io('/admin');
    
    socket.on(`${resource}:updated`, (updatedItem) => {
      setData(prev => prev.map(item => 
        item.id === updatedItem.id ? updatedItem : item
      ));
    });
    
    socket.on(`${resource}:created`, (newItem) => {
      setData(prev => [...prev, newItem]);
    });
    
    return () => socket.disconnect();
  }, [resource]);
  
  return data;
};
```

## Performance Optimization

### Data Caching
- **Query Caching**: Cache frequently accessed data
- **Optimistic Updates**: Immediate UI updates
- **Background Sync**: Sync data in background

### Lazy Loading
- **Component Splitting**: Load components on demand
- **Route-based Splitting**: Split by admin routes
- **Resource Lazy Loading**: Load resources when needed

## Testing

### Component Testing
```typescript
describe('UserList', () => {
  it('should display users correctly', () => {
    render(
      <AdminContext dataProvider={mockDataProvider}>
        <UserList />
      </AdminContext>
    );
    
    expect(screen.getByText('Users')).toBeInTheDocument();
  });
});
```

### Integration Testing
- **API Integration**: Test data provider methods
- **Authentication Flow**: Test login/logout flow
- **Permission Testing**: Test role-based access

## Deployment

### Environment Configuration
```typescript
export const adminConfig = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL,
  wsUrl: process.env.NEXT_PUBLIC_WS_URL,
  features: {
    realTimeUpdates: process.env.NEXT_PUBLIC_REALTIME_ENABLED === 'true',
    analytics: process.env.NEXT_PUBLIC_ANALYTICS_ENABLED === 'true',
  },
};
```

### Build Optimization
- **Bundle Splitting**: Separate admin bundle
- **Tree Shaking**: Remove unused code
- **Asset Optimization**: Optimize images and fonts