# 业务架构组件化与模块化重构设计文档

## 设计概述

基于Clean Architecture原则和现代化前端架构模式，设计一个高内聚、低耦合的业务架构重构方案。该设计确保三大核心业务功能（siterank、batchopen、adscenter）的稳定性，同时实现系统的模块化和组件化升级。

## 架构设计原则

### 1. Clean Architecture分层架构

```
┌─────────────────────────────────────────────────────────────┐
│                    Presentation Layer                       │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │   Next.js Pages │  │  React Components│  │  Admin Panel │ │
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
├─────────────────────────────────────────────────────────────┤
│                    Application Layer                        │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │   Use Cases     │  │   Services      │  │   Workflows  │ │
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
├─────────────────────────────────────────────────────────────┤
│                     Domain Layer                            │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │    Entities     │  │  Value Objects  │  │  Repositories│ │
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
├─────────────────────────────────────────────────────────────┤
│                  Infrastructure Layer                       │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │   Database      │  │   External APIs │  │   File System│ │
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 2. 依赖注入与控制反转

采用依赖注入模式，确保各层之间的松耦合：

```typescript
// 依赖注入容器配置
interface ServiceContainer {
  // 业务服务
  siteRankService: ISiteRankService
  batchOpenService: IBatchOpenService
  changeLinkService: IAdsCenterService
  
  // 基础设施服务
  databaseService: IDatabaseService
  cacheService: ICacheService
  loggerService: ILoggerService
}
```

## 模块化架构设计

### 1. 核心业务模块结构

```
src/
├── modules/
│   ├── siterank/                    # 网站排名分析模块
│   │   ├── domain/
│   │   │   ├── entities/
│   │   │   │   ├── SiteRank.ts
│   │   │   │   └── RankingResult.ts
│   │   │   ├── repositories/
│   │   │   │   └── ISiteRankRepository.ts
│   │   │   └── services/
│   │   │       └── ISiteRankService.ts
│   │   ├── application/
│   │   │   ├── use-cases/
│   │   │   │   ├── AnalyzeSiteRank.ts
│   │   │   │   └── ExportRankingData.ts
│   │   │   └── services/
│   │   │       └── SiteRankService.ts
│   │   ├── infrastructure/
│   │   │   ├── repositories/
│   │   │   │   └── PrismaSiteRankRepository.ts
│   │   │   └── external/
│   │   │       └── SimilarWebApiClient.ts
│   │   ├── presentation/
│   │   │   ├── components/
│   │   │   │   ├── SiteRankAnalyzer.tsx
│   │   │   │   └── RankingResultsTable.tsx
│   │   │   └── pages/
│   │   │       └── SiteRankPage.tsx
│   │   ├── tests/
│   │   │   ├── unit/
│   │   │   ├── integration/
│   │   │   └── e2e/
│   │   ├── module.config.ts
│   │   ├── module.types.ts
│   │   └── README.md
│   │
│   ├── batchopen/                   # 批量URL打开模块
│   │   ├── domain/
│   │   │   ├── entities/
│   │   │   │   ├── BatchTask.ts
│   │   │   │   └── UrlRequest.ts
│   │   │   ├── repositories/
│   │   │   │   └── IBatchOpenRepository.ts
│   │   │   └── services/
│   │   │       └── IBatchOpenService.ts
│   │   ├── application/
│   │   │   ├── use-cases/
│   │   │   │   ├── ExecuteBatchOpen.ts
│   │   │   │   └── MonitorProgress.ts
│   │   │   └── services/
│   │   │       └── BatchOpenService.ts
│   │   ├── infrastructure/
│   │   │   ├── repositories/
│   │   │   │   └── PrismaBatchOpenRepository.ts
│   │   │   └── external/
│   │   │       └── PlaywrightClient.ts
│   │   ├── presentation/
│   │   │   ├── components/
│   │   │   │   ├── BatchOpenForm.tsx
│   │   │   │   └── ProgressMonitor.tsx
│   │   │   └── pages/
│   │   │       └── BatchOpenPage.tsx
│   │   ├── tests/
│   │   ├── module.config.ts
│   │   ├── module.types.ts
│   │   └── README.md
│   │
│   └── adscenter/                  # Google Ads链接管理模块
│       ├── domain/
│       │   ├── entities/
│       │   │   ├── AdsCampaign.ts
│       │   │   └── LinkMapping.ts
│       │   ├── repositories/
│       │   │   └── IAdsCenterRepository.ts
│       │   └── services/
│       │       └── IAdsCenterService.ts
│       ├── application/
│       │   ├── use-cases/
│       │   │   ├── UpdateAdLinks.ts
│       │   │   └── ScheduleExecution.ts
│       │   └── services/
│       │       └── AdsCenterService.ts
│       ├── infrastructure/
│       │   ├── repositories/
│       │   │   └── PrismaAdsCenterRepository.ts
│       │   └── external/
│       │       ├── GoogleAdsApiClient.ts
│       │       └── AdsPowerApiClient.ts
│       ├── presentation/
│       │   ├── components/
│       │   │   ├── LinkMappingForm.tsx
│       │   │   └── ExecutionMonitor.tsx
│       │   └── pages/
│       │       └── AdsCenterPage.tsx
│       ├── tests/
│       ├── module.config.ts
│       ├── module.types.ts
│       └── README.md
```

### 2. 共享组件库结构

```
src/
├── shared/
│   ├── components/                  # 通用UI组件
│   │   ├── ui/
│   │   │   ├── Button/
│   │   │   │   ├── Button.tsx
│   │   │   │   ├── Button.stories.tsx
│   │   │   │   ├── Button.test.tsx
│   │   │   │   └── index.ts
│   │   │   ├── Input/
│   │   │   ├── Modal/
│   │   │   ├── Table/
│   │   │   └── index.ts
│   │   ├── business/
│   │   │   ├── DataTable/
│   │   │   ├── ProgressBar/
│   │   │   ├── StatusIndicator/
│   │   │   └── index.ts
│   │   └── layout/
│   │       ├── Header/
│   │       ├── Sidebar/
│   │       ├── Footer/
│   │       └── index.ts
│   │
│   ├── hooks/                       # 通用React Hooks
│   │   ├── useApi.ts
│   │   ├── useLocalStorage.ts
│   │   ├── useDebounce.ts
│   │   └── index.ts
│   │
│   ├── utils/                       # 工具函数
│   │   ├── validation.ts
│   │   ├── formatting.ts
│   │   ├── api.ts
│   │   └── index.ts
│   │
│   ├── types/                       # 通用类型定义
│   │   ├── api.ts
│   │   ├── common.ts
│   │   └── index.ts
│   │
│   └── constants/                   # 常量定义
│       ├── api.ts
│       ├── ui.ts
│       └── index.ts
```

## 后台管理系统架构优化

### 1. React Admin迁移架构

```typescript
// React Admin应用结构
import { Admin, Resource, CustomRoutes } from 'react-admin'
import { Route } from 'react-router-dom'
import { dataProvider } from './dataProvider'
import { authProvider } from './authProvider'

// 主应用配置
export const AdminApp = () => (
  <Admin 
    dataProvider={dataProvider} 
    authProvider={authProvider}
    theme={customTheme}
    layout={CustomLayout}
  >
    {/* 核心业务资源 */}
    <Resource 
      name="users" 
      list={UserList} 
      edit={UserEdit} 
      create={UserCreate} 
      show={UserShow}
      icon={UsersIcon}
    />
    <Resource 
      name="subscriptions" 
      list={SubscriptionList} 
      edit={SubscriptionEdit} 
      show={SubscriptionShow}
      icon={CreditCardIcon}
    />
    <Resource 
      name="plans" 
      list={PlanList} 
      edit={PlanEdit} 
      create={PlanCreate}
      icon={DocumentTextIcon}
    />
    
    {/* 业务模块资源 */}
    <Resource 
      name="siterank-tasks" 
      list={SiteRankTaskList} 
      show={SiteRankTaskShow}
      icon={ChartBarIcon}
    />
    <Resource 
      name="batch-tasks" 
      list={BatchTaskList} 
      show={BatchTaskShow}
      icon={PlayIcon}
    />
    <Resource 
      name="adscenter-configs" 
      list={AdsCenterConfigList} 
      edit={AdsCenterConfigEdit}
      create={AdsCenterConfigCreate}
      icon={LinkIcon}
    />

    {/* 自定义路由 */}
    <CustomRoutes>
      <Route path="/dashboard" element={<CustomDashboard />} />
      <Route path="/analytics" element={<AdvancedAnalytics />} />
      <Route path="/system-health" element={<SystemHealth />} />
    </CustomRoutes>
  </Admin>
)

// 自定义数据提供者
const dataProvider = {
  getList: async (resource: string, params: any) => {
    const { page, perPage } = params.pagination
    const { field, order } = params.sort
    const query = {
      sort: JSON.stringify([field, order]),
      range: JSON.stringify([(page - 1) * perPage, page * perPage - 1]),
      filter: JSON.stringify(params.filter),
    }
    
    const url = `${apiUrl}/${resource}?${stringify(query)}`
    const response = await httpClient(url)
    
    return {
      data: response.json.data,
      total: response.json.total,
    }
  },

  getOne: async (resource: string, params: any) => {
    const response = await httpClient(`${apiUrl}/${resource}/${params.id}`)
    return { data: response.json.data }
  },

  getMany: async (resource: string, params: any) => {
    const query = {
      filter: JSON.stringify({ id: params.ids }),
    }
    const url = `${apiUrl}/${resource}?${stringify(query)}`
    const response = await httpClient(url)
    return { data: response.json.data }
  },

  create: async (resource: string, params: any) => {
    const response = await httpClient(`${apiUrl}/${resource}`, {
      method: 'POST',
      body: JSON.stringify(params.data),
    })
    return { data: response.json.data }
  },

  update: async (resource: string, params: any) => {
    const response = await httpClient(`${apiUrl}/${resource}/${params.id}`, {
      method: 'PUT',
      body: JSON.stringify(params.data),
    })
    return { data: response.json.data }
  },

  delete: async (resource: string, params: any) => {
    await httpClient(`${apiUrl}/${resource}/${params.id}`, {
      method: 'DELETE',
    })
    return { data: params.previousData }
  },
}

// 自定义认证提供者
const authProvider = {
  login: async ({ username, password }: any) => {
    const request = new Request(`${apiUrl}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ email: username, password }),
      headers: new Headers({ 'Content-Type': 'application/json' }),
    })
    
    const response = await fetch(request)
    if (response.status < 200 || response.status >= 300) {
      throw new Error(response.statusText)
    }
    
    const { token, user } = await response.json()
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(user))
    
    return Promise.resolve()
  },

  logout: () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    return Promise.resolve()
  },

  checkAuth: () => {
    return localStorage.getItem('token') ? Promise.resolve() : Promise.reject()
  },

  checkError: (error: any) => {
    const status = error.status
    if (status === 401 || status === 403) {
      localStorage.removeItem('token')
      return Promise.reject()
    }
    return Promise.resolve()
  },

  getIdentity: () => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}')
      return Promise.resolve(user)
    } catch (error) {
      return Promise.reject(error)
    }
  },

  getPermissions: () => {
    const user = JSON.parse(localStorage.getItem('user') || '{}')
    return Promise.resolve(user.permissions || [])
  },
}
```

### 2. 自定义组件开发

```typescript
// 用户列表组件
import { 
  List, 
  Datagrid, 
  TextField, 
  EmailField, 
  DateField,
  BooleanField,
  EditButton,
  ShowButton,
  DeleteButton,
  Filter,
  TextInput,
  SelectInput,
  DateInput
} from 'react-admin'

const UserFilter = (props: any) => (
  <Filter {...props}>
    <TextInput label="搜索" source="q" alwaysOn />
    <SelectInput 
      source="status" 
      choices={[
        { id: 'active', name: '活跃' },
        { id: 'inactive', name: '非活跃' },
        { id: 'suspended', name: '已暂停' },
      ]} 
    />
    <DateInput source="created_at_gte" label="注册日期从" />
    <DateInput source="created_at_lte" label="注册日期到" />
  </Filter>
)

export const UserList = () => (
  <List filters={<UserFilter />} perPage={25}>
    <Datagrid rowClick="show">
      <TextField source="id" label="ID" />
      <TextField source="name" label="姓名" />
      <EmailField source="email" label="邮箱" />
      <TextField source="tenantId" label="租户ID" />
      <BooleanField source="emailVerified" label="邮箱已验证" />
      <DateField source="createdAt" label="注册时间" />
      <DateField source="lastLoginAt" label="最后登录" />
      <EditButton />
      <ShowButton />
      <DeleteButton />
    </Datagrid>
  </List>
)

// 用户编辑组件
import { 
  Edit, 
  SimpleForm, 
  TextInput, 
  SelectInput, 
  BooleanInput,
  ArrayInput,
  SimpleFormIterator,
  ReferenceInput,
  AutocompleteInput
} from 'react-admin'

export const UserEdit = () => (
  <Edit>
    <SimpleForm>
      <TextInput source="name" label="姓名" required />
      <TextInput source="email" label="邮箱" required />
      <SelectInput 
        source="status" 
        label="状态"
        choices={[
          { id: 'active', name: '活跃' },
          { id: 'inactive', name: '非活跃' },
          { id: 'suspended', name: '已暂停' },
        ]} 
      />
      <BooleanInput source="emailVerified" label="邮箱已验证" />
      
      {/* 角色管理 */}
      <ArrayInput source="roles" label="角色">
        <SimpleFormIterator>
          <ReferenceInput source="roleId" reference="roles">
            <AutocompleteInput optionText="name" />
          </ReferenceInput>
        </SimpleFormIterator>
      </ArrayInput>
    </SimpleForm>
  </Edit>
)

// 自定义仪表板
import { Card, CardContent, CardHeader } from 'react-admin'
import { useGetList } from 'react-admin'

export const CustomDashboard = () => {
  const { data: users, total: userCount } = useGetList('users')
  const { data: subscriptions, total: subCount } = useGetList('subscriptions')
  
  return (
    <div style={{ margin: '1em' }}>
      <div style={{ display: 'flex', gap: '1em', marginBottom: '1em' }}>
        <Card style={{ flex: 1 }}>
          <CardHeader title="用户总数" />
          <CardContent>
            <div style={{ fontSize: '2em', fontWeight: 'bold' }}>
              {userCount}
            </div>
          </CardContent>
        </Card>
        
        <Card style={{ flex: 1 }}>
          <CardHeader title="订阅总数" />
          <CardContent>
            <div style={{ fontSize: '2em', fontWeight: 'bold' }}>
              {subCount}
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* 更多仪表板内容 */}
      <RecentActivity />
      <SystemMetrics />
    </div>
  )
}
```

### 3. 业务模块集成

```typescript
// SiteRank任务管理
export const SiteRankTaskList = () => (
  <List>
    <Datagrid>
      <TextField source="id" label="任务ID" />
      <TextField source="url" label="分析URL" />
      <TextField source="status" label="状态" />
      <DateField source="createdAt" label="创建时间" />
      <DateField source="completedAt" label="完成时间" />
      <ShowButton />
    </Datagrid>
  </List>
)

export const SiteRankTaskShow = () => (
  <Show>
    <SimpleShowLayout>
      <TextField source="id" label="任务ID" />
      <TextField source="url" label="分析URL" />
      <TextField source="status" label="状态" />
      <JsonField source="options" label="分析选项" />
      <JsonField source="result" label="分析结果" />
      <DateField source="createdAt" label="创建时间" />
      <DateField source="completedAt" label="完成时间" />
    </SimpleShowLayout>
  </Show>
)

// BatchOpen任务管理
export const BatchTaskList = () => (
  <List>
    <Datagrid>
      <TextField source="id" label="任务ID" />
      <NumberField source="urlCount" label="URL数量" />
      <TextField source="status" label="状态" />
      <NumberField source="progress" label="进度" />
      <DateField source="createdAt" label="创建时间" />
      <ShowButton />
    </Datagrid>
  </List>
)

// AdsCenter配置管理
export const AdsCenterConfigList = () => (
  <List>
    <Datagrid>
      <TextField source="id" label="配置ID" />
      <TextField source="name" label="配置名称" />
      <TextField source="googleAdsAccount" label="Google Ads账户" />
      <BooleanField source="isActive" label="是否激活" />
      <DateField source="lastExecuted" label="最后执行" />
      <EditButton />
      <ShowButton />
    </Datagrid>
  </List>
)

export const AdsCenterConfigEdit = () => (
  <Edit>
    <SimpleForm>
      <TextInput source="name" label="配置名称" required />
      <TextInput source="googleAdsAccount" label="Google Ads账户" />
      <TextInput source="adsPowerEnvironment" label="AdsPower环境" />
      <BooleanInput source="isActive" label="是否激活" />
      
      {/* 链接映射配置 */}
      <ArrayInput source="linkMappings" label="链接映射">
        <SimpleFormIterator>
          <TextInput source="affiliateUrl" label="联盟链接" />
          <TextInput source="adGroupId" label="广告组ID" />
          <TextInput source="adId" label="广告ID" />
        </SimpleFormIterator>
      </ArrayInput>
      
      {/* 执行计划配置 */}
      <SelectInput 
        source="scheduleType" 
        label="执行计划"
        choices={[
          { id: 'manual', name: '手动执行' },
          { id: 'daily', name: '每日执行' },
          { id: 'weekly', name: '每周执行' },
        ]} 
      />
    </SimpleForm>
  </Edit>
)
```

### 4. 权限集成

```typescript
// 权限感知组件
import { usePermissions } from 'react-admin'

export const PermissionAwareButton = ({ 
  permission, 
  children, 
  ...props 
}: any) => {
  const { permissions } = usePermissions()
  
  if (!permissions || !permissions.includes(permission)) {
    return null
  }
  
  return <Button {...props}>{children}</Button>
}

// 资源级权限控制
export const AdminApp = () => {
  const { permissions } = usePermissions()
  
  return (
    <Admin dataProvider={dataProvider} authProvider={authProvider}>
      {permissions?.includes('users.read') && (
        <Resource name="users" list={UserList} edit={UserEdit} />
      )}
      {permissions?.includes('subscriptions.read') && (
        <Resource name="subscriptions" list={SubscriptionList} />
      )}
      {permissions?.includes('plans.read') && (
        <Resource name="plans" list={PlanList} edit={PlanEdit} />
      )}
      
      {/* 超级管理员专用资源 */}
      {permissions?.includes('admin.super') && (
        <>
          <Resource name="tenants" list={TenantList} edit={TenantEdit} />
          <Resource name="system-logs" list={SystemLogList} />
        </>
      )}
    </Admin>
  )
}
```

### 5. 迁移策略

```typescript
// 渐进式迁移计划
interface MigrationPhase {
  name: string
  description: string
  components: string[]
  estimatedDays: number
  dependencies: string[]
}

const migrationPhases: MigrationPhase[] = [
  {
    name: 'Phase 1: 基础设施',
    description: '建立React Admin基础架构',
    components: [
      'dataProvider',
      'authProvider', 
      'customTheme',
      'basicLayout'
    ],
    estimatedDays: 5,
    dependencies: []
  },
  {
    name: 'Phase 2: 核心资源',
    description: '迁移用户、订阅、计划管理',
    components: [
      'UserList', 'UserEdit', 'UserCreate',
      'SubscriptionList', 'SubscriptionEdit',
      'PlanList', 'PlanEdit', 'PlanCreate'
    ],
    estimatedDays: 8,
    dependencies: ['Phase 1']
  },
  {
    name: 'Phase 3: 业务模块',
    description: '迁移三大核心业务功能管理',
    components: [
      'SiteRankTaskList', 'SiteRankTaskShow',
      'BatchTaskList', 'BatchTaskShow',
      'AdsCenterConfigList', 'AdsCenterConfigEdit'
    ],
    estimatedDays: 10,
    dependencies: ['Phase 2']
  },
  {
    name: 'Phase 4: 高级功能',
    description: '自定义仪表板和高级分析',
    components: [
      'CustomDashboard',
      'AdvancedAnalytics',
      'SystemHealth',
      'RealtimeUpdates'
    ],
    estimatedDays: 7,
    dependencies: ['Phase 3']
  },
  {
    name: 'Phase 5: 优化与测试',
    description: '性能优化和全面测试',
    components: [
      'PerformanceOptimization',
      'E2ETests',
      'UserAcceptanceTests',
      'Documentation'
    ],
    estimatedDays: 5,
    dependencies: ['Phase 4']
  }
]

// 兼容性桥接
class LegacyBridge {
  // 将现有API适配为React Admin格式
  static adaptApiResponse(response: any, resource: string): any {
    switch (resource) {
      case 'users':
        return {
          data: response.data.map((user: any) => ({
            ...user,
            id: user.id,
            name: user.name || `${user.firstName} ${user.lastName}`,
          })),
          total: response.total || response.data.length
        }
      
      case 'subscriptions':
        return {
          data: response.data.map((sub: any) => ({
            ...sub,
            id: sub.id,
            planName: sub.plan?.name,
            userName: sub.user?.name,
          })),
          total: response.total || response.data.length
        }
      
      default:
        return response
    }
  }

  // 将React Admin请求转换为现有API格式
  static adaptApiRequest(params: any, resource: string): any {
    const { pagination, sort, filter } = params
    
    return {
      page: pagination?.page || 1,
      limit: pagination?.perPage || 10,
      sortBy: sort?.field,
      sortOrder: sort?.order?.toLowerCase(),
      filters: filter || {}
    }
  }
}
```

### 6. 状态管理架构

```typescript
// 使用React Query + Zustand的状态管理架构
import { create } from 'zustand'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

// 全局状态管理
interface AdminState {
  user: User | null
  permissions: Permission[]
  theme: 'light' | 'dark'
  sidebarCollapsed: boolean
  
  // Actions
  setUser: (user: User) => void
  setPermissions: (permissions: Permission[]) => void
  toggleTheme: () => void
  toggleSidebar: () => void
}

export const useAdminStore = create<AdminState>((set) => ({
  user: null,
  permissions: [],
  theme: 'light',
  sidebarCollapsed: false,
  
  setUser: (user) => set({ user }),
  setPermissions: (permissions) => set({ permissions }),
  toggleTheme: () => set((state) => ({ 
    theme: state.theme === 'light' ? 'dark' : 'light' 
  })),
  toggleSidebar: () => set((state) => ({ 
    sidebarCollapsed: !state.sidebarCollapsed 
  })),
}))

// 数据获取Hooks
export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const response = await fetch('/api/admin/dashboard/stats')
      return response.json()
    },
    staleTime: 5 * 60 * 1000, // 5分钟缓存
    refetchInterval: 30 * 1000, // 30秒自动刷新
  })
}
```

### 2. 实时数据更新架构

```typescript
// WebSocket/SSE实时数据更新
export class RealTimeService {
  private eventSource: EventSource | null = null
  private queryClient: QueryClient

  constructor(queryClient: QueryClient) {
    this.queryClient = queryClient
  }

  connect() {
    this.eventSource = new EventSource('/api/admin/events')
    
    this.eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data)
      
      // 根据事件类型更新相应的查询缓存
      switch (data.type) {
        case 'user_updated':
          this.queryClient.invalidateQueries({ queryKey: ['users'] })
          break
        case 'subscription_changed':
          this.queryClient.invalidateQueries({ queryKey: ['subscriptions'] })
          break
        case 'system_alert':
          this.queryClient.setQueryData(['alerts'], (old: any) => [
            ...(old || []),
            data.payload
          ])
          break
      }
    }
  }

  disconnect() {
    if (this.eventSource) {
      this.eventSource.close()
      this.eventSource = null
    }
  }
}
```

### 3. 模块化管理界面

```typescript
// 管理模块注册系统
interface AdminModule {
  id: string
  name: string
  icon: React.ComponentType
  path: string
  component: React.ComponentType
  permissions: string[]
  order: number
}

class AdminModuleRegistry {
  private modules: Map<string, AdminModule> = new Map()

  register(module: AdminModule) {
    this.modules.set(module.id, module)
  }

  getModules(userPermissions: string[]): AdminModule[] {
    return Array.from(this.modules.values())
      .filter(module => 
        module.permissions.some(permission => 
          userPermissions.includes(permission)
        )
      )
      .sort((a, b) => a.order - b.order)
  }
}

// 使用示例
const adminRegistry = new AdminModuleRegistry()

// 注册用户管理模块
adminRegistry.register({
  id: 'users',
  name: '用户管理',
  icon: UsersIcon,
  path: '/admin/users',
  component: UserManagement,
  permissions: ['users.read'],
  order: 1
})
```

## 数据层架构设计

### 1. Repository模式实现

```typescript
// 通用Repository接口
interface IRepository<T, ID = string> {
  findById(id: ID): Promise<T | null>
  findAll(options?: QueryOptions): Promise<T[]>
  create(entity: Omit<T, 'id'>): Promise<T>
  update(id: ID, updates: Partial<T>): Promise<T>
  delete(id: ID): Promise<void>
  count(filters?: Record<string, any>): Promise<number>
}

// 具体实现
export class PrismaSiteRankRepository implements ISiteRankRepository {
  constructor(private prisma: PrismaClient) {}

  async findById(id: string): Promise<SiteRank | null> {
    return this.prisma.siteRank.findUnique({
      where: { id },
      include: {
        results: true,
        user: true
      }
    })
  }

  async findAll(options: QueryOptions = {}): Promise<SiteRank[]> {
    const { page = 1, limit = 10, filters = {}, sort = {} } = options
    
    return this.prisma.siteRank.findMany({
      where: filters,
      orderBy: sort,
      skip: (page - 1) * limit,
      take: limit,
      include: {
        results: true,
        user: true
      }
    })
  }

  async create(data: CreateSiteRankData): Promise<SiteRank> {
    return this.prisma.siteRank.create({
      data,
      include: {
        results: true,
        user: true
      }
    })
  }
}
```

### 2. 统一API接口标准

```typescript
// API响应标准格式
interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    details?: any
  }
  meta?: {
    page?: number
    limit?: number
    total?: number
    hasNext?: boolean
  }
}

// API路由处理器基类
abstract class BaseApiHandler {
  protected async handleRequest<T>(
    request: NextRequest,
    handler: () => Promise<T>
  ): Promise<NextResponse<ApiResponse<T>>> {
    try {
      // 身份验证
      const session = await auth()
      if (!session?.userId) {
        return this.unauthorizedResponse()
      }

      // 权限检查
      const hasPermission = await this.checkPermissions(session.userId)
      if (!hasPermission) {
        return this.forbiddenResponse()
      }

      // 执行业务逻辑
      const data = await handler()
      
      return NextResponse.json({
        success: true,
        data
      })
    } catch (error) {
      return this.errorResponse(error)
    }
  }

  protected abstract checkPermissions(userId: string): Promise<boolean>
  
  private unauthorizedResponse() {
    return NextResponse.json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required'
      }
    }, { status: 401 })
  }

  private forbiddenResponse() {
    return NextResponse.json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Insufficient permissions'
      }
    }, { status: 403 })
  }

  private errorResponse(error: any) {
    console.error('API Error:', error)
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error'
      }
    }, { status: 500 })
  }
}
```

## 服务层架构设计

### 1. 业务服务接口

```typescript
// 网站排名分析服务
interface ISiteRankService {
  analyzeWebsite(url: string, options: AnalysisOptions): Promise<RankingResult>
  batchAnalyze(urls: string[], options: AnalysisOptions): Promise<RankingResult[]>
  exportResults(resultIds: string[], format: ExportFormat): Promise<Buffer>
  getAnalysisHistory(userId: string, filters: HistoryFilters): Promise<RankingResult[]>
}

// 批量URL打开服务
interface IBatchOpenService {
  createBatchTask(urls: string[], options: BatchOptions): Promise<BatchTask>
  executeBatchTask(taskId: string): Promise<ExecutionResult>
  monitorProgress(taskId: string): Promise<ProgressStatus>
  cancelBatchTask(taskId: string): Promise<void>
}

// Google Ads链接管理服务
interface IAdsCenterService {
  createLinkMapping(mapping: LinkMappingData): Promise<LinkMapping>
  updateAdLinks(mappingId: string): Promise<UpdateResult>
  scheduleExecution(schedule: ScheduleConfig): Promise<ScheduledTask>
  getExecutionHistory(filters: ExecutionFilters): Promise<ExecutionRecord[]>
}
```

### 2. 服务实现示例

```typescript
export class SiteRankService implements ISiteRankService {
  constructor(
    private repository: ISiteRankRepository,
    private similarWebClient: ISimilarWebClient,
    private cacheService: ICacheService,
    private logger: ILogger
  ) {}

  async analyzeWebsite(url: string, options: AnalysisOptions): Promise<RankingResult> {
    this.logger.info(`Starting analysis for ${url}`)
    
    // 检查缓存
    const cacheKey = `siterank:${url}:${JSON.stringify(options)}`
    const cached = await this.cacheService.get<RankingResult>(cacheKey)
    if (cached) {
      this.logger.info(`Returning cached result for ${url}`)
      return cached
    }

    try {
      // 调用外部API
      const apiResult = await this.similarWebClient.getWebsiteRanking(url, options)
      
      // 转换为领域对象
      const result = this.mapToRankingResult(apiResult)
      
      // 保存到数据库
      await this.repository.create({
        url,
        result,
        options,
        analyzedAt: new Date()
      })
      
      // 缓存结果
      await this.cacheService.set(cacheKey, result, 3600) // 1小时缓存
      
      this.logger.info(`Analysis completed for ${url}`)
      return result
    } catch (error) {
      this.logger.error(`Analysis failed for ${url}:`, error)
      throw new AnalysisError(`Failed to analyze ${url}`, error)
    }
  }

  private mapToRankingResult(apiResult: any): RankingResult {
    return {
      globalRank: apiResult.global_rank,
      countryRank: apiResult.country_rank,
      categoryRank: apiResult.category_rank,
      trafficSources: apiResult.traffic_sources,
      monthlyVisits: apiResult.monthly_visits,
      bounceRate: apiResult.bounce_rate,
      pageViews: apiResult.page_views,
      visitDuration: apiResult.visit_duration
    }
  }
}
```

## 配置管理与环境隔离

### 1. 模块配置系统

```typescript
// 模块配置接口
interface ModuleConfig {
  name: string
  version: string
  enabled: boolean
  dependencies: string[]
  settings: Record<string, any>
}

// 配置管理器
class ConfigurationManager {
  private configs: Map<string, ModuleConfig> = new Map()

  loadModuleConfig(moduleName: string): ModuleConfig {
    const configPath = `./modules/${moduleName}/module.config.ts`
    const config = require(configPath).default
    
    this.validateConfig(config)
    this.configs.set(moduleName, config)
    
    return config
  }

  getModuleConfig(moduleName: string): ModuleConfig | null {
    return this.configs.get(moduleName) || null
  }

  private validateConfig(config: ModuleConfig): void {
    if (!config.name || !config.version) {
      throw new Error('Module config must have name and version')
    }
  }
}

// 环境配置
interface EnvironmentConfig {
  NODE_ENV: 'development' | 'preview' | 'production'
  DATABASE_URL: string
  REDIS_URL?: string
  API_BASE_URL: string
  DOMAIN: string
  
  // 第三方服务配置
  GOOGLE_ADS_CLIENT_ID?: string
  GOOGLE_ADS_CLIENT_SECRET?: string
  SIMILARWEB_API_KEY?: string
  ADSPOWER_API_URL?: string
}

// 环境特定配置
const environmentConfigs: Record<string, Partial<EnvironmentConfig>> = {
  development: {
    DOMAIN: 'localhost',
    API_BASE_URL: 'http://localhost:3000/api'
  },
  preview: {
    DOMAIN: 'urlchecker.dev',
    API_BASE_URL: 'https://urlchecker.dev/api'
  },
  production: {
    DOMAIN: 'autoads.dev',
    API_BASE_URL: 'https://autoads.dev/api'
  }
}
```

### 2. Docker部署配置

```dockerfile
# Dockerfile优化
FROM node:18-alpine AS base

# 安装依赖
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --only=production

# 构建应用
FROM base AS builder
WORKDIR /app
COPY . .
COPY --from=deps /app/node_modules ./node_modules
RUN npm run build

# 生产镜像
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
```

## 测试策略设计

### 1. 测试金字塔架构

```
        ┌─────────────────┐
        │   E2E Tests     │  ← 少量，关键业务流程
        │   (Playwright)  │
        ├─────────────────┤
        │ Integration     │  ← 中等数量，模块间集成
        │ Tests (Jest)    │
        ├─────────────────┤
        │   Unit Tests    │  ← 大量，单个函数/组件
        │   (Jest/RTL)    │
        └─────────────────┘
```

### 2. 测试实现示例

```typescript
// 单元测试示例
describe('SiteRankService', () => {
  let service: SiteRankService
  let mockRepository: jest.Mocked<ISiteRankRepository>
  let mockApiClient: jest.Mocked<ISimilarWebClient>

  beforeEach(() => {
    mockRepository = createMockRepository()
    mockApiClient = createMockApiClient()
    service = new SiteRankService(mockRepository, mockApiClient)
  })

  describe('analyzeWebsite', () => {
    it('should return cached result when available', async () => {
      // Arrange
      const url = 'https://example.com'
      const cachedResult = createMockRankingResult()
      mockCacheService.get.mockResolvedValue(cachedResult)

      // Act
      const result = await service.analyzeWebsite(url, {})

      // Assert
      expect(result).toEqual(cachedResult)
      expect(mockApiClient.getWebsiteRanking).not.toHaveBeenCalled()
    })

    it('should call API and cache result when not cached', async () => {
      // Arrange
      const url = 'https://example.com'
      const apiResult = createMockApiResult()
      const expectedResult = createMockRankingResult()
      
      mockCacheService.get.mockResolvedValue(null)
      mockApiClient.getWebsiteRanking.mockResolvedValue(apiResult)

      // Act
      const result = await service.analyzeWebsite(url, {})

      // Assert
      expect(mockApiClient.getWebsiteRanking).toHaveBeenCalledWith(url, {})
      expect(mockCacheService.set).toHaveBeenCalledWith(
        expect.any(String),
        expectedResult,
        3600
      )
      expect(result).toEqual(expectedResult)
    })
  })
})

// 集成测试示例
describe('SiteRank API Integration', () => {
  let app: NextApiHandler
  let testDb: TestDatabase

  beforeAll(async () => {
    testDb = await setupTestDatabase()
    app = createTestApp()
  })

  afterAll(async () => {
    await testDb.cleanup()
  })

  it('should analyze website and return results', async () => {
    // Arrange
    const user = await testDb.createUser()
    const token = generateTestToken(user.id)

    // Act
    const response = await request(app)
      .post('/api/siterank/analyze')
      .set('Authorization', `Bearer ${token}`)
      .send({
        url: 'https://example.com',
        options: { includeTrafficSources: true }
      })

    // Assert
    expect(response.status).toBe(200)
    expect(response.body.success).toBe(true)
    expect(response.body.data).toMatchObject({
      globalRank: expect.any(Number),
      countryRank: expect.any(Number),
      trafficSources: expect.any(Object)
    })
  })
})

// E2E测试示例
describe('SiteRank E2E', () => {
  let page: Page

  beforeEach(async () => {
    page = await browser.newPage()
    await page.goto('/siterank')
  })

  it('should complete full analysis workflow', async () => {
    // 输入URL
    await page.fill('[data-testid="url-input"]', 'https://example.com')
    
    // 点击分析按钮
    await page.click('[data-testid="analyze-button"]')
    
    // 等待结果显示
    await page.waitForSelector('[data-testid="results-table"]')
    
    // 验证结果
    const globalRank = await page.textContent('[data-testid="global-rank"]')
    expect(globalRank).toMatch(/^\d+$/)
    
    // 导出数据
    await page.click('[data-testid="export-button"]')
    
    // 验证下载
    const download = await page.waitForEvent('download')
    expect(download.suggestedFilename()).toMatch(/\.xlsx$/)
  })
})
```

## 迁移策略设计

### 1. 分阶段迁移计划

```typescript
// 迁移阶段定义
enum MigrationPhase {
  PREPARATION = 'preparation',
  SHARED_COMPONENTS = 'shared_components',
  CORE_MODULES = 'core_modules',
  ADMIN_OPTIMIZATION = 'admin_optimization',
  INTEGRATION = 'integration',
  DEPLOYMENT = 'deployment'
}

// 迁移任务接口
interface MigrationTask {
  id: string
  phase: MigrationPhase
  name: string
  description: string
  dependencies: string[]
  estimatedHours: number
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  rollbackPlan: string
}

// 迁移管理器
class MigrationManager {
  private tasks: Map<string, MigrationTask> = new Map()
  private executionLog: MigrationLogEntry[] = []

  async executeMigration(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId)
    if (!task) {
      throw new Error(`Migration task ${taskId} not found`)
    }

    // 检查依赖
    await this.checkDependencies(task)
    
    // 创建备份点
    const backupId = await this.createBackup()
    
    try {
      // 执行迁移
      task.status = 'in_progress'
      await this.executeTask(task)
      task.status = 'completed'
      
      this.logSuccess(task, backupId)
    } catch (error) {
      task.status = 'failed'
      await this.rollback(task, backupId)
      this.logFailure(task, error)
      throw error
    }
  }

  private async checkDependencies(task: MigrationTask): Promise<void> {
    for (const depId of task.dependencies) {
      const dep = this.tasks.get(depId)
      if (!dep || dep.status !== 'completed') {
        throw new Error(`Dependency ${depId} not completed`)
      }
    }
  }

  private async createBackup(): Promise<string> {
    // 创建数据库备份
    // 创建代码备份
    // 返回备份ID
    return `backup_${Date.now()}`
  }

  private async rollback(task: MigrationTask, backupId: string): Promise<void> {
    // 执行回滚计划
    console.log(`Rolling back task ${task.id} using backup ${backupId}`)
    // 实际回滚逻辑
  }
}
```

### 2. 兼容性保证策略

```typescript
// API版本管理
interface ApiVersion {
  version: string
  deprecated: boolean
  sunsetDate?: Date
  migrationGuide?: string
}

class ApiVersionManager {
  private versions: Map<string, ApiVersion> = new Map()

  registerVersion(version: string, config: Omit<ApiVersion, 'version'>) {
    this.versions.set(version, { version, ...config })
  }

  async handleRequest(request: NextRequest, handler: Function) {
    const version = this.extractVersion(request)
    const versionConfig = this.versions.get(version)

    if (!versionConfig) {
      return new NextResponse('Unsupported API version', { status: 400 })
    }

    if (versionConfig.deprecated) {
      // 添加弃用警告头
      const response = await handler(request)
      response.headers.set('X-API-Deprecated', 'true')
      if (versionConfig.sunsetDate) {
        response.headers.set('X-API-Sunset', versionConfig.sunsetDate.toISOString())
      }
      return response
    }

    return handler(request)
  }

  private extractVersion(request: NextRequest): string {
    return request.headers.get('X-API-Version') || 'v1'
  }
}
```

## 监控与告警设计

### 1. 性能监控

```typescript
// 性能监控服务
class PerformanceMonitor {
  private metrics: Map<string, MetricData[]> = new Map()

  trackApiCall(endpoint: string, duration: number, status: number) {
    const metric = {
      timestamp: Date.now(),
      duration,
      status,
      endpoint
    }

    const existing = this.metrics.get(endpoint) || []
    existing.push(metric)
    
    // 保留最近1000条记录
    if (existing.length > 1000) {
      existing.shift()
    }
    
    this.metrics.set(endpoint, existing)

    // 检查性能阈值
    this.checkPerformanceThresholds(endpoint, metric)
  }

  private checkPerformanceThresholds(endpoint: string, metric: MetricData) {
    const thresholds = {
      responseTime: 5000, // 5秒
      errorRate: 0.05 // 5%
    }

    if (metric.duration > thresholds.responseTime) {
      this.sendAlert({
        type: 'SLOW_RESPONSE',
        endpoint,
        duration: metric.duration,
        threshold: thresholds.responseTime
      })
    }

    const recentMetrics = this.getRecentMetrics(endpoint, 300000) // 5分钟
    const errorRate = this.calculateErrorRate(recentMetrics)
    
    if (errorRate > thresholds.errorRate) {
      this.sendAlert({
        type: 'HIGH_ERROR_RATE',
        endpoint,
        errorRate,
        threshold: thresholds.errorRate
      })
    }
  }

  private sendAlert(alert: AlertData) {
    // 发送告警到监控系统
    console.error('Performance Alert:', alert)
    // 实际实现可能发送到Slack、邮件等
  }
}
```

### 2. 业务监控

```typescript
// 业务指标监控
class BusinessMetricsMonitor {
  async trackUserAction(userId: string, action: string, metadata?: any) {
    await this.recordMetric({
      type: 'user_action',
      userId,
      action,
      metadata,
      timestamp: new Date()
    })

    // 检查异常行为
    await this.detectAnomalies(userId, action)
  }

  async trackSystemHealth() {
    const metrics = await Promise.all([
      this.checkDatabaseHealth(),
      this.checkRedisHealth(),
      this.checkExternalApiHealth()
    ])

    const overallHealth = metrics.every(m => m.healthy)
    
    if (!overallHealth) {
      await this.sendHealthAlert(metrics)
    }

    return {
      healthy: overallHealth,
      details: metrics
    }
  }

  private async detectAnomalies(userId: string, action: string) {
    // 检测异常用户行为
    const recentActions = await this.getUserRecentActions(userId, 3600000) // 1小时
    
    if (recentActions.length > 100) { // 1小时内超过100次操作
      await this.sendAlert({
        type: 'SUSPICIOUS_ACTIVITY',
        userId,
        actionCount: recentActions.length,
        timeWindow: '1 hour'
      })
    }
  }
}
```

## 部署与CI/CD设计

### 1. GitHub Actions工作流

```yaml
# .github/workflows/deploy.yml
name: Deploy Application

on:
  push:
    branches: [main, production]
  release:
    types: [published]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: xxrenzhe/url-batch-checker

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm run test:ci

      - name: Build application
        run: npm run build

      - name: Log in to Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=ref,event=branch,suffix=-latest
            type=ref,event=tag,prefix=prod-

      - name: Build and push Docker image
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
```

### 2. 环境部署配置

```typescript
// 部署配置管理
interface DeploymentConfig {
  environment: 'development' | 'preview' | 'production'
  domain: string
  imageTag: string
  replicas: number
  resources: {
    cpu: string
    memory: string
  }
  env: Record<string, string>
}

const deploymentConfigs: Record<string, DeploymentConfig> = {
  development: {
    environment: 'development',
    domain: 'localhost',
    imageTag: 'dev-latest',
    replicas: 1,
    resources: {
      cpu: '500m',
      memory: '512Mi'
    },
    env: {
      NODE_ENV: 'development',
      DATABASE_URL: process.env.DEV_DATABASE_URL!,
      REDIS_URL: process.env.DEV_REDIS_URL
    }
  },
  preview: {
    environment: 'preview',
    domain: 'urlchecker.dev',
    imageTag: 'preview-latest',
    replicas: 2,
    resources: {
      cpu: '1000m',
      memory: '1Gi'
    },
    env: {
      NODE_ENV: 'production',
      DATABASE_URL: process.env.PREVIEW_DATABASE_URL!,
      REDIS_URL: process.env.PREVIEW_REDIS_URL
    }
  },
  production: {
    environment: 'production',
    domain: 'autoads.dev',
    imageTag: 'prod-latest',
    replicas: 3,
    resources: {
      cpu: '2000m',
      memory: '2Gi'
    },
    env: {
      NODE_ENV: 'production',
      DATABASE_URL: process.env.PROD_DATABASE_URL!,
      REDIS_URL: process.env.PROD_REDIS_URL
    }
  }
}
```

## 文档生成与维护

### 1. 自动化文档生成

```typescript
// API文档生成器
class ApiDocumentationGenerator {
  async generateOpenApiSpec(): Promise<OpenAPISpec> {
    const spec: OpenAPISpec = {
      openapi: '3.0.0',
      info: {
        title: 'AutoAds API',
        version: '1.0.0',
        description: '自动化营销平台API文档'
      },
      servers: [
        { url: 'https://autoads.dev/api', description: 'Production' },
        { url: 'https://urlchecker.dev/api', description: 'Preview' },
        { url: 'http://localhost:3000/api', description: 'Development' }
      ],
      paths: {}
    }

    // 扫描API路由并生成文档
    const apiRoutes = await this.scanApiRoutes()
    for (const route of apiRoutes) {
      spec.paths[route.path] = await this.generatePathSpec(route)
    }

    return spec
  }

  private async scanApiRoutes(): Promise<ApiRoute[]> {
    // 扫描src/app/api目录
    // 解析路由文件
    // 提取API信息
    return []
  }
}

// 组件文档生成器
class ComponentDocumentationGenerator {
  async generateStorybookStories(): Promise<void> {
    const components = await this.scanComponents()
    
    for (const component of components) {
      await this.generateStoryFile(component)
    }
  }

  private async generateStoryFile(component: ComponentInfo): Promise<void> {
    const storyContent = `
import type { Meta, StoryObj } from '@storybook/react'
import { ${component.name} } from './${component.name}'

const meta: Meta<typeof ${component.name}> = {
  title: '${component.category}/${component.name}',
  component: ${component.name},
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: ${JSON.stringify(component.defaultProps, null, 2)},
}
`

    await fs.writeFile(
      `${component.path}/${component.name}.stories.tsx`,
      storyContent
    )
  }
}
```

## 多用户管理架构设计

### 1. 多租户架构模式

```typescript
// 租户隔离策略
enum TenantIsolationStrategy {
  SHARED_DATABASE = 'shared_database',      // 共享数据库，行级隔离
  SEPARATE_SCHEMA = 'separate_schema',      // 独立Schema
  SEPARATE_DATABASE = 'separate_database'   // 独立数据库
}

// 租户上下文
interface TenantContext {
  tenantId: string
  tenantName: string
  plan: 'free' | 'pro' | 'enterprise'
  limits: {
    maxUsers: number
    maxApiCalls: number
    maxConcurrentTasks: number
    storageQuota: number
  }
  features: string[]
  settings: Record<string, any>
}

// 租户中间件
class TenantMiddleware {
  async extractTenant(request: NextRequest): Promise<TenantContext> {
    // 从域名提取租户信息
    const host = request.headers.get('host')
    const subdomain = this.extractSubdomain(host)
    
    if (subdomain && subdomain !== 'www') {
      return await this.getTenantBySubdomain(subdomain)
    }
    
    // 从JWT token提取租户信息
    const token = this.extractToken(request)
    if (token) {
      const payload = this.verifyToken(token)
      return await this.getTenantById(payload.tenantId)
    }
    
    // 默认租户
    return this.getDefaultTenant()
  }

  private extractSubdomain(host: string | null): string | null {
    if (!host) return null
    const parts = host.split('.')
    return parts.length > 2 ? parts[0] : null
  }
}
```

### 2. 用户权限管理系统

```typescript
// RBAC权限模型
interface Role {
  id: string
  name: string
  description: string
  permissions: Permission[]
  tenantId: string
}

interface Permission {
  id: string
  resource: string      // 资源类型：siterank, batchopen, adscenter, admin
  action: string        // 操作类型：create, read, update, delete, execute
  conditions?: Record<string, any>  // 条件限制
}

interface User {
  id: string
  email: string
  name: string
  tenantId: string
  roles: Role[]
  status: 'active' | 'inactive' | 'suspended'
  lastLoginAt?: Date
  preferences: UserPreferences
}

// 权限检查服务
class PermissionService {
  async hasPermission(
    userId: string, 
    resource: string, 
    action: string,
    context?: any
  ): Promise<boolean> {
    const user = await this.getUserWithRoles(userId)
    if (!user) return false

    // 检查用户状态
    if (user.status !== 'active') return false

    // 检查租户限制
    const tenant = await this.getTenant(user.tenantId)
    if (!this.checkTenantLimits(tenant, resource, action)) return false

    // 检查角色权限
    for (const role of user.roles) {
      for (const permission of role.permissions) {
        if (this.matchesPermission(permission, resource, action, context)) {
          return true
        }
      }
    }

    return false
  }

  private matchesPermission(
    permission: Permission,
    resource: string,
    action: string,
    context?: any
  ): boolean {
    // 资源匹配
    if (permission.resource !== '*' && permission.resource !== resource) {
      return false
    }

    // 操作匹配
    if (permission.action !== '*' && permission.action !== action) {
      return false
    }

    // 条件匹配
    if (permission.conditions && context) {
      return this.evaluateConditions(permission.conditions, context)
    }

    return true
  }
}
```

### 3. 用户会话管理

```typescript
// 会话管理服务
class SessionManager {
  private redis: Redis
  private sessionTTL = 24 * 60 * 60 // 24小时

  async createSession(user: User): Promise<string> {
    const sessionId = this.generateSessionId()
    const sessionData = {
      userId: user.id,
      tenantId: user.tenantId,
      roles: user.roles.map(r => r.id),
      createdAt: Date.now(),
      lastAccessAt: Date.now(),
      ipAddress: this.getClientIP(),
      userAgent: this.getUserAgent()
    }

    await this.redis.setex(
      `session:${sessionId}`,
      this.sessionTTL,
      JSON.stringify(sessionData)
    )

    return sessionId
  }

  async validateSession(sessionId: string): Promise<SessionData | null> {
    const data = await this.redis.get(`session:${sessionId}`)
    if (!data) return null

    const session = JSON.parse(data)
    
    // 更新最后访问时间
    session.lastAccessAt = Date.now()
    await this.redis.setex(
      `session:${sessionId}`,
      this.sessionTTL,
      JSON.stringify(session)
    )

    return session
  }

  async revokeSession(sessionId: string): Promise<void> {
    await this.redis.del(`session:${sessionId}`)
  }

  // 单点登录支持
  async revokeTenantSessions(tenantId: string): Promise<void> {
    const pattern = `session:*`
    const keys = await this.redis.keys(pattern)
    
    for (const key of keys) {
      const data = await this.redis.get(key)
      if (data) {
        const session = JSON.parse(data)
        if (session.tenantId === tenantId) {
          await this.redis.del(key)
        }
      }
    }
  }
}
```

## 高并发高性能架构设计

### 1. 缓存架构设计

```typescript
// 多层缓存架构
class CacheManager {
  private l1Cache: Map<string, any> = new Map() // 内存缓存
  private l2Cache: Redis                        // Redis缓存
  private l3Cache: Database                     // 数据库缓存

  async get<T>(key: string): Promise<T | null> {
    // L1缓存查找
    if (this.l1Cache.has(key)) {
      return this.l1Cache.get(key)
    }

    // L2缓存查找
    const l2Value = await this.l2Cache.get(key)
    if (l2Value) {
      const parsed = JSON.parse(l2Value)
      this.l1Cache.set(key, parsed)
      return parsed
    }

    // L3缓存查找（数据库）
    const l3Value = await this.l3Cache.get(key)
    if (l3Value) {
      // 回填到上层缓存
      await this.l2Cache.setex(key, 3600, JSON.stringify(l3Value))
      this.l1Cache.set(key, l3Value)
      return l3Value
    }

    return null
  }

  async set<T>(key: string, value: T, ttl: number = 3600): Promise<void> {
    // 写入所有层级
    this.l1Cache.set(key, value)
    await this.l2Cache.setex(key, ttl, JSON.stringify(value))
    await this.l3Cache.set(key, value, ttl)
  }

  async invalidate(pattern: string): Promise<void> {
    // 清除L1缓存
    for (const key of this.l1Cache.keys()) {
      if (this.matchPattern(key, pattern)) {
        this.l1Cache.delete(key)
      }
    }

    // 清除L2缓存
    const keys = await this.l2Cache.keys(pattern)
    if (keys.length > 0) {
      await this.l2Cache.del(...keys)
    }
  }
}

// 缓存策略配置
const cacheStrategies = {
  siterank: {
    ttl: 3600,        // 1小时
    pattern: 'siterank:*',
    invalidateOn: ['siterank_update', 'user_plan_change']
  },
  batchopen: {
    ttl: 300,         // 5分钟
    pattern: 'batchopen:*',
    invalidateOn: ['batch_complete', 'batch_cancel']
  },
  adscenter: {
    ttl: 1800,        // 30分钟
    pattern: 'adscenter:*',
    invalidateOn: ['link_update', 'campaign_change']
  }
}
```

### 2. 队列与异步处理

```typescript
// 任务队列系统
interface QueueTask {
  id: string
  type: string
  payload: any
  priority: number
  attempts: number
  maxAttempts: number
  delay?: number
  tenantId: string
  userId: string
  createdAt: Date
}

class TaskQueue {
  private redis: Redis
  private workers: Map<string, Worker> = new Map()

  async enqueue(task: Omit<QueueTask, 'id' | 'attempts' | 'createdAt'>): Promise<string> {
    const taskId = this.generateTaskId()
    const fullTask: QueueTask = {
      ...task,
      id: taskId,
      attempts: 0,
      createdAt: new Date()
    }

    // 根据优先级和延迟添加到队列
    const queueName = `queue:${task.type}`
    const score = task.delay ? Date.now() + task.delay : Date.now() - task.priority

    await this.redis.zadd(queueName, score, JSON.stringify(fullTask))
    
    // 通知工作进程
    await this.redis.publish(`queue:${task.type}:notify`, taskId)

    return taskId
  }

  async processQueue(queueType: string): Promise<void> {
    const queueName = `queue:${queueType}`
    
    while (true) {
      // 获取待处理任务
      const tasks = await this.redis.zrangebyscore(
        queueName,
        '-inf',
        Date.now(),
        'LIMIT', 0, 1
      )

      if (tasks.length === 0) {
        await this.sleep(1000) // 等待1秒
        continue
      }

      const taskData = JSON.parse(tasks[0])
      const task: QueueTask = taskData

      try {
        // 移除任务（防止重复处理）
        await this.redis.zrem(queueName, tasks[0])
        
        // 处理任务
        await this.executeTask(task)
        
        // 记录成功
        await this.recordTaskResult(task.id, 'completed')
      } catch (error) {
        // 重试逻辑
        if (task.attempts < task.maxAttempts) {
          task.attempts++
          const retryDelay = Math.pow(2, task.attempts) * 1000 // 指数退避
          const retryScore = Date.now() + retryDelay
          
          await this.redis.zadd(queueName, retryScore, JSON.stringify(task))
        } else {
          // 任务失败
          await this.recordTaskResult(task.id, 'failed', error)
        }
      }
    }
  }

  private async executeTask(task: QueueTask): Promise<void> {
    const handler = this.getTaskHandler(task.type)
    if (!handler) {
      throw new Error(`No handler for task type: ${task.type}`)
    }

    await handler.execute(task.payload, {
      tenantId: task.tenantId,
      userId: task.userId,
      taskId: task.id
    })
  }
}

// 任务处理器示例
class SiteRankTaskHandler {
  async execute(payload: any, context: TaskContext): Promise<void> {
    const { urls, options } = payload
    const { tenantId, userId } = context

    // 检查租户限制
    await this.checkTenantLimits(tenantId, urls.length)

    // 并行处理URL分析
    const results = await Promise.allSettled(
      urls.map(url => this.analyzeSite(url, options, context))
    )

    // 保存结果
    await this.saveResults(results, context)

    // 发送通知
    await this.notifyUser(userId, results)
  }

  private async analyzeSite(url: string, options: any, context: TaskContext): Promise<any> {
    // 实际的网站分析逻辑
    const cacheKey = `siterank:${url}:${JSON.stringify(options)}`
    
    // 检查缓存
    const cached = await cacheManager.get(cacheKey)
    if (cached) return cached

    // 调用外部API
    const result = await this.callExternalAPI(url, options)
    
    // 缓存结果
    await cacheManager.set(cacheKey, result, 3600)
    
    return result
  }
}
```

### 3. 数据库优化策略

```typescript
// 数据库连接池管理
class DatabaseManager {
  private readPool: Pool
  private writePool: Pool
  private replicaPool: Pool

  constructor() {
    this.writePool = new Pool({
      connectionString: process.env.DATABASE_WRITE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    })

    this.readPool = new Pool({
      connectionString: process.env.DATABASE_READ_URL,
      max: 50,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    })

    this.replicaPool = new Pool({
      connectionString: process.env.DATABASE_REPLICA_URL,
      max: 30,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    })
  }

  async executeRead<T>(query: string, params?: any[]): Promise<T[]> {
    const client = await this.readPool.connect()
    try {
      const result = await client.query(query, params)
      return result.rows
    } finally {
      client.release()
    }
  }

  async executeWrite<T>(query: string, params?: any[]): Promise<T> {
    const client = await this.writePool.connect()
    try {
      const result = await client.query(query, params)
      return result.rows[0]
    } finally {
      client.release()
    }
  }

  // 分片查询支持
  async executeShardedQuery<T>(
    tenantId: string,
    query: string,
    params?: any[]
  ): Promise<T[]> {
    const shardId = this.getShardId(tenantId)
    const shardedQuery = this.addShardCondition(query, shardId)
    
    return this.executeRead(shardedQuery, params)
  }

  private getShardId(tenantId: string): number {
    // 基于租户ID的一致性哈希
    const hash = this.hashString(tenantId)
    return hash % 4 // 假设4个分片
  }
}

// 查询优化器
class QueryOptimizer {
  async optimizeQuery(query: string, params: any[]): Promise<string> {
    // 添加索引提示
    query = this.addIndexHints(query)
    
    // 添加查询缓存
    query = this.addQueryCache(query)
    
    // 优化JOIN顺序
    query = this.optimizeJoins(query)
    
    return query
  }

  private addIndexHints(query: string): string {
    // 根据查询模式添加索引提示
    if (query.includes('WHERE tenant_id =')) {
      return query.replace(
        'FROM users',
        'FROM users USE INDEX (idx_tenant_id)'
      )
    }
    return query
  }
}
```

### 4. API限流与熔断

```typescript
// 限流器
class RateLimiter {
  private redis: Redis

  async checkLimit(
    key: string,
    limit: number,
    window: number
  ): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    const now = Date.now()
    const windowStart = now - window * 1000

    // 使用滑动窗口算法
    const pipeline = this.redis.pipeline()
    
    // 移除过期的请求记录
    pipeline.zremrangebyscore(key, '-inf', windowStart)
    
    // 添加当前请求
    pipeline.zadd(key, now, `${now}-${Math.random()}`)
    
    // 获取当前窗口内的请求数
    pipeline.zcard(key)
    
    // 设置过期时间
    pipeline.expire(key, window)
    
    const results = await pipeline.exec()
    const currentCount = results[2][1] as number

    const allowed = currentCount <= limit
    const remaining = Math.max(0, limit - currentCount)
    const resetTime = now + window * 1000

    return { allowed, remaining, resetTime }
  }

  async getRateLimitKey(tenantId: string, userId: string, endpoint: string): Promise<string> {
    return `ratelimit:${tenantId}:${userId}:${endpoint}`
  }
}

// 熔断器
class CircuitBreaker {
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED'
  private failureCount = 0
  private lastFailureTime = 0
  private successCount = 0

  constructor(
    private threshold: number = 5,
    private timeout: number = 60000,
    private monitoringPeriod: number = 10000
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = 'HALF_OPEN'
        this.successCount = 0
      } else {
        throw new Error('Circuit breaker is OPEN')
      }
    }

    try {
      const result = await operation()
      
      if (this.state === 'HALF_OPEN') {
        this.successCount++
        if (this.successCount >= 3) {
          this.state = 'CLOSED'
          this.failureCount = 0
        }
      }

      return result
    } catch (error) {
      this.failureCount++
      this.lastFailureTime = Date.now()

      if (this.failureCount >= this.threshold) {
        this.state = 'OPEN'
      }

      throw error
    }
  }
}
```

### 5. 负载均衡与扩展策略

```typescript
// 负载均衡器
class LoadBalancer {
  private servers: ServerInfo[] = []
  private currentIndex = 0

  addServer(server: ServerInfo): void {
    this.servers.push(server)
  }

  removeServer(serverId: string): void {
    this.servers = this.servers.filter(s => s.id !== serverId)
  }

  // 轮询算法
  getNextServer(): ServerInfo | null {
    if (this.servers.length === 0) return null

    const server = this.servers[this.currentIndex]
    this.currentIndex = (this.currentIndex + 1) % this.servers.length
    
    return server
  }

  // 加权轮询
  getWeightedServer(): ServerInfo | null {
    if (this.servers.length === 0) return null

    const totalWeight = this.servers.reduce((sum, s) => sum + s.weight, 0)
    const random = Math.random() * totalWeight
    
    let currentWeight = 0
    for (const server of this.servers) {
      currentWeight += server.weight
      if (random <= currentWeight) {
        return server
      }
    }

    return this.servers[0]
  }

  // 健康检查
  async healthCheck(): Promise<void> {
    const checks = this.servers.map(async (server) => {
      try {
        const response = await fetch(`${server.url}/health`, {
          timeout: 5000
        })
        server.healthy = response.ok
      } catch (error) {
        server.healthy = false
      }
    })

    await Promise.all(checks)
  }
}

// 自动扩展管理器
class AutoScaler {
  private metrics: MetricsCollector
  private kubernetesClient: KubernetesClient

  async checkScalingConditions(): Promise<void> {
    const metrics = await this.metrics.getCurrentMetrics()
    
    // CPU使用率超过80%，扩容
    if (metrics.cpuUsage > 0.8 && metrics.currentReplicas < metrics.maxReplicas) {
      await this.scaleUp()
    }
    
    // CPU使用率低于20%，缩容
    if (metrics.cpuUsage < 0.2 && metrics.currentReplicas > metrics.minReplicas) {
      await this.scaleDown()
    }

    // 队列长度过长，扩容
    if (metrics.queueLength > 1000) {
      await this.scaleUp()
    }
  }

  private async scaleUp(): Promise<void> {
    await this.kubernetesClient.scaleDeployment(
      'autoads-app',
      '+1'
    )
  }

  private async scaleDown(): Promise<void> {
    await this.kubernetesClient.scaleDeployment(
      'autoads-app',
      '-1'
    )
  }
}
```

## 总结

本设计文档基于Clean Architecture原则，结合现代化前端架构模式，为业务架构组件化与模块化重构提供了全面的技术方案。设计重点关注：

1. **架构清晰性**：采用分层架构，确保职责分离和依赖管理
2. **模块化设计**：每个业务模块独立开发、测试和部署
3. **多用户管理**：完整的多租户架构和RBAC权限系统
4. **高并发性能**：多层缓存、任务队列、数据库优化和负载均衡
5. **后台管理优化**：引入现代化状态管理和实时数据更新
6. **兼容性保证**：确保重构过程中系统的稳定性和向后兼容
7. **可扩展性**：为未来功能扩展和技术升级预留空间

该设计方案将确保三大核心业务功能的稳定性，同时支持大规模用户并发访问和高性能处理需求，为系统的长期发展奠定坚实基础。