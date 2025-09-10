'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { EnhancedError } from '@/lib/utils/error-handling';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { createClientLogger } from "@/lib/utils/security/client-secure-logger";
const logger = createClientLogger('SecurityManager');

import { 
  Shield, 
  User, 
  Lock, 
  Eye, 
  EyeOff, 
  Key, 
  AlertTriangle, 
  CheckCircle,
  Clock,
  Activity,
  Settings,
  Download,
  Upload,
  Trash2,
  Plus,
  Edit,
  Search,
  Filter,
  RefreshCw,
  Bell,
  Database,
  Globe,
  Server,
  Monitor
} from 'lucide-react';

// Types
interface User {
  id: string;
  username: string;
  email: string;
  role: 'admin' | 'manager' | 'operator' | 'viewer';
  status: 'active' | 'inactive' | 'suspended';
  lastLogin: Date;
  createdAt: Date;
  permissions: string[];
  twoFactorEnabled: boolean;
  failedLoginAttempts: number;
}

interface Role {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
  userCount: number;
  createdAt: Date;
}

interface Permission {
  id: string;
  name: string;
  description: string;
  category: 'configurations' | 'executions' | 'analytics' | 'system' | 'security';
  resource: string;
  action: 'create' | 'read' | 'update' | 'delete' | 'execute';
}

interface SecurityEvent {
  id: string;
  type: 'login' | 'logout' | 'permission_denied' | 'config_change' | 'execution_start' | 'execution_complete' | 'error';
  severity: 'low' | 'medium' | 'high' | 'critical';
  userId: string;
  username: string;
  description: string;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
  metadata: Record<string, unknown>;
}

interface SecurityMetrics {
  totalUsers: number;
  activeUsers: number;
  failedLogins: number;
  securityEvents: number;
  last24Hours: {
    logins: number;
    failedLogins: number;
    securityEvents: number;
  };
  riskScore: number;
}

export function SecurityManager() {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([]);
  const [metrics, setMetrics] = useState<SecurityMetrics | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Mock data generation
  useEffect(() => {
    const mockUsers: User[] = [
      {
        id: '1',
        username: 'admin',
        email: 'admin@example.com',
        role: 'admin',
        status: 'active',
        lastLogin: new Date(Date.now() - 2 * 60 * 60 * 1000),
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        permissions: ['all'],
        twoFactorEnabled: true,
        failedLoginAttempts: 0
      },
      {
        id: '2',
        username: 'manager1',
        email: 'manager1@example.com',
        role: 'manager',
        status: 'active',
        lastLogin: new Date(Date.now() - 4 * 60 * 60 * 1000),
        createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
        permissions: ['configurations:read', 'configurations:update', 'executions:read', 'executions:execute'],
        twoFactorEnabled: true,
        failedLoginAttempts: 0
      },
      {
        id: '3',
        username: 'operator1',
        email: 'operator1@example.com',
        role: 'operator',
        status: 'active',
        lastLogin: new Date(Date.now() - 8 * 60 * 60 * 1000),
        createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        permissions: ['executions:read', 'executions:execute'],
        twoFactorEnabled: false,
        failedLoginAttempts: 2
      },
      {
        id: '4',
        username: 'viewer1',
        email: 'viewer1@example.com',
        role: 'viewer',
        status: 'inactive',
        lastLogin: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        permissions: ['configurations:read', 'executions:read'],
        twoFactorEnabled: false,
        failedLoginAttempts: 0
      }
    ];

    const mockRoles: Role[] = [
      {
        id: '1',
        name: '管理员',
        description: '拥有系统所有权限',
        permissions: [],
        userCount: 1,
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      },
      {
        id: '2',
        name: '经理',
        description: '可以管理配置和执行任务',
        permissions: [],
        userCount: 2,
        createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000)
      },
      {
        id: '3',
        name: '操作员',
        description: '可以执行任务和查看结果',
        permissions: [],
        userCount: 3,
        createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)
      },
      {
        id: '4',
        name: '查看者',
        description: '只能查看配置和执行结果',
        permissions: [],
        userCount: 1,
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
      }
    ];

    const mockPermissions: Permission[] = [
      {
        id: '1',
        name: '查看配置',
        description: '查看系统配置信息',
        category: 'configurations',
        resource: 'configurations',
        action: 'read'
      },
      {
        id: '2',
        name: '创建配置',
        description: '创建新的系统配置',
        category: 'configurations',
        resource: 'configurations',
        action: 'create'
      },
      {
        id: '3',
        name: '更新配置',
        description: '修改现有配置',
        category: 'configurations',
        resource: 'configurations',
        action: 'update'
      },
      {
        id: '4',
        name: '删除配置',
        description: '删除系统配置',
        category: 'configurations',
        resource: 'configurations',
        action: 'delete'
      },
      {
        id: '5',
        name: '查看执行',
        description: '查看任务执行状态',
        category: 'executions',
        resource: 'executions',
        action: 'read'
      },
      {
        id: '6',
        name: '执行任务',
        description: '启动和停止任务',
        category: 'executions',
        resource: 'executions',
        action: 'execute'
      }
    ];

    const mockSecurityEvents: SecurityEvent[] = [
      {
        id: '1',
        type: 'login',
        severity: 'low',
        userId: '1',
        username: 'admin',
        description: '用户登录成功',
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
        metadata: { method: 'password' }
      },
      {
        id: '2',
        type: 'permission_denied',
        severity: 'medium',
        userId: '3',
        username: 'operator1',
        description: '尝试访问未授权的配置',
        ipAddress: '192.168.1.101',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000),
        metadata: { resource: 'configurations', action: 'update' }
      },
      {
        id: '3',
        type: 'config_change',
        severity: 'medium',
        userId: '2',
        username: 'manager1',
        description: '修改了电商推广配置',
        ipAddress: '192.168.1.102',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000),
        metadata: { configId: 'config-123', changes: ['name', 'settings'] }
      },
      {
        id: '4',
        type: 'execution_start',
        severity: 'low',
        userId: '2',
        username: 'manager1',
        description: '启动了自动化任务',
        ipAddress: '192.168.1.102',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000),
        metadata: { executionId: 'exec-456', configId: 'config-123' }
      }
    ];

    const mockMetrics: SecurityMetrics = {
      totalUsers: 4,
      activeUsers: 3,
      failedLogins: 2,
      securityEvents: 156,
      last24Hours: {
        logins: 12,
        failedLogins: 2,
        securityEvents: 23
      },
      riskScore: 15
    };

    setUsers(mockUsers);
    setRoles(mockRoles);
    setPermissions(mockPermissions);
    setSecurityEvents(mockSecurityEvents);
    setMetrics(mockMetrics);
  }, []);

  const handleUserStatusChange = useCallback(async (userId: string, status: User['status']) => {
    setIsLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setUsers(prev => prev?.filter(Boolean)?.map(user => 
        user.id === userId ? { ...user, status } : user
      ));
    } catch (error) {
      logger.error('Failed to update user status:', new EnhancedError('Failed to update user status:', { error: error instanceof Error ? error.message : String(error)  }));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleEnableTwoFactor = useCallback(async (userId: string) => {
    setIsLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setUsers(prev => prev?.filter(Boolean)?.map(user => 
        user.id === userId ? { ...user, twoFactorEnabled: true } : user
      ));
    } catch (error) {
      logger.error('Failed to enable 2FA:', new EnhancedError('Failed to enable 2FA:', { error: error instanceof Error ? error.message : String(error)  }));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'text-red-600 bg-red-100';
      case 'manager':
        return 'text-blue-600 bg-blue-100';
      case 'operator':
        return 'text-green-600 bg-green-100';
      case 'viewer':
        return 'text-gray-600 bg-gray-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'text-green-600 bg-green-100';
      case 'inactive':
        return 'text-gray-600 bg-gray-100';
      case 'suspended':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'text-red-600 bg-red-100';
      case 'high':
        return 'text-orange-600 bg-orange-100';
      case 'medium':
        return 'text-yellow-600 bg-yellow-100';
      case 'low':
        return 'text-green-600 bg-green-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'login':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'logout':
        return <Clock className="h-4 w-4 text-blue-500" />;
      case 'permission_denied':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'config_change':
        return <Settings className="h-4 w-4 text-purple-500" />;
      case 'execution_start':
        return <Activity className="h-4 w-4 text-green-500" />;
      case 'execution_complete':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      default:
        return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">安全管理</h2>
          <p className="text-muted-foreground">用户认证、授权和安全监控</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            刷新
          </Button>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            添加用户
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">概览</TabsTrigger>
          <TabsTrigger value="users">用户管理</TabsTrigger>
          <TabsTrigger value="roles">角色管理</TabsTrigger>
          <TabsTrigger value="permissions">权限管理</TabsTrigger>
          <TabsTrigger value="events">安全事件</TabsTrigger>
          <TabsTrigger value="monitoring">安全监控</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {metrics && (
            <>
              {/* Security Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">总用户数</CardTitle>
                    <User className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{metrics.totalUsers}</div>
                    <p className="text-xs text-muted-foreground">
                      {metrics.activeUsers} 个活跃用户
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">安全事件</CardTitle>
                    <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{metrics.securityEvents}</div>
                    <p className="text-xs text-muted-foreground">
                      过去24小时 {metrics.last24Hours.securityEvents} 个
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">失败登录</CardTitle>
                    <Lock className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{metrics.failedLogins}</div>
                    <p className="text-xs text-muted-foreground">
                      过去24小时 {metrics.last24Hours.failedLogins} 次
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">风险评分</CardTitle>
                    <Shield className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{metrics.riskScore}</div>
                    <p className="text-xs text-muted-foreground">
                      {metrics.riskScore < 20 ? '低风险' : 
                       metrics.riskScore < 50 ? '中风险' : '高风险'}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Recent Security Events */}
              <Card>
                <CardHeader>
                  <CardTitle>最近安全事件</CardTitle>
                  <CardDescription>最近的安全活动和事件</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {securityEvents.slice(0, 5).map((event) => (
                      <div key={event.id} className="flex items-start space-x-3 p-3 border rounded-lg">
                        {getEventIcon(event.type)}
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium">{event.description}</p>
                            <Badge className={getSeverityColor(event.severity)}>
                              {event.severity === 'critical' ? '严重' :
                               event.severity === 'high' ? '高' :
                               event.severity === 'medium' ? '中' : '低'}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {event.username} • {event.ipAddress} • {event.timestamp.toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>用户管理</CardTitle>
              <CardDescription>管理系统用户和权限</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {users.map((user) => (
                  <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div>
                        <h3 className="font-medium">{user.username}</h3>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge className={getRoleColor(user.role)}>
                          {user.role === 'admin' ? '管理员' :
                           user.role === 'manager' ? '经理' :
                           user.role === 'operator' ? '操作员' : '查看者'}
                        </Badge>
                        <Badge className={getStatusColor(user.status)}>
                          {user.status === 'active' ? '活跃' :
                           user.status === 'inactive' ? '非活跃' : '已暂停'}
                        </Badge>
                        {user.twoFactorEnabled && (
                          <Badge className="text-green-600 bg-green-100">
                            2FA已启用
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <div className="text-right text-sm">
                        <div>最后登录: {user.lastLogin.toLocaleDateString()}</div>
                        {user.failedLoginAttempts > 0 && (
                          <div className="text-red-600">
                            失败登录: {user.failedLoginAttempts} 次
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center space-x-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedUser(user)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        {!user.twoFactorEnabled && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEnableTwoFactor(user.id)}
                            disabled={isLoading}
                          >
                            <Key className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleUserStatusChange(
                            user.id, 
                            user.status === 'active' ? 'suspended' : 'active'
                          )}
                          disabled={isLoading}
                        >
                          {user.status === 'active' ? '暂停' : '激活'}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Roles Tab */}
        <TabsContent value="roles" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {roles.map((role) => (
              <Card key={role.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{role.name}</CardTitle>
                    <Badge variant="outline">{role.userCount} 用户</Badge>
                  </div>
                  <CardDescription>{role.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span>创建时间:</span>
                      <span className="font-medium">
                        {role.createdAt.toLocaleDateString()}
                      </span>
                    </div>
                    
                    <div className="flex justify-between text-sm">
                      <span>权限数量:</span>
                      <span className="font-medium">{role.permissions.length}</span>
                    </div>

                    <div className="flex items-center space-x-2 pt-2">
                      <Button size="sm" variant="outline">
                        <Edit className="h-4 w-4 mr-2" />
                        编辑
                      </Button>
                      <Button size="sm" variant="outline">
                        <Eye className="h-4 w-4 mr-2" />
                        查看权限
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Permissions Tab */}
        <TabsContent value="permissions" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>权限管理</CardTitle>
              <CardDescription>管理系统权限和访问控制</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {permissions.map((permission) => (
                  <div key={permission.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <h3 className="font-medium">{permission.name}</h3>
                      <p className="text-sm text-muted-foreground">{permission.description}</p>
                      <div className="flex items-center space-x-2 mt-2">
                        <Badge variant="outline">{permission.category}</Badge>
                        <Badge variant="outline">{permission.resource}</Badge>
                        <Badge variant="outline">{permission.action}</Badge>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Button size="sm" variant="outline">
                        <Edit className="h-4 w-4 mr-2" />
                        编辑
                      </Button>
                      <Button size="sm" variant="outline">
                        <Eye className="h-4 w-4 mr-2" />
                        查看分配
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Events Tab */}
        <TabsContent value="events" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>安全事件日志</CardTitle>
                  <CardDescription>详细的安全事件记录</CardDescription>
                </div>
                <div className="flex items-center space-x-2">
                  <Button variant="outline">
                    <Filter className="h-4 w-4 mr-2" />
                    筛选
                  </Button>
                  <Button variant="outline">
                    <Download className="h-4 w-4 mr-2" />
                    导出
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {securityEvents.map((event) => (
                  <div key={event.id} className="border rounded-lg p-4">
                    <div className="flex items-start space-x-3">
                      {getEventIcon(event.type)}
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-medium">{event.description}</h3>
                          <Badge className={getSeverityColor(event.severity)}>
                            {event.severity === 'critical' ? '严重' :
                             event.severity === 'high' ? '高' :
                             event.severity === 'medium' ? '中' : '低'}
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">用户:</span>
                            <span className="font-medium ml-2">{event.username}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">IP地址:</span>
                            <span className="font-medium ml-2">{event.ipAddress}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">时间:</span>
                            <span className="font-medium ml-2">
                              {event.timestamp.toLocaleString()}
                            </span>
                          </div>
                        </div>
                        
                        {Object.keys(event.metadata).length > 0 && (
                          <div className="mt-2">
                            <span className="text-sm text-muted-foreground">元数据:</span>
                            <pre className="text-xs bg-gray-100 p-2 rounded mt-1 overflow-x-auto">
                              {JSON.stringify(event.metadata, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Monitoring Tab */}
        <TabsContent value="monitoring" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>实时监控</CardTitle>
                <CardDescription>系统安全状态实时监控</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">系统负载</span>
                    <span className="text-sm font-medium">65%</span>
                  </div>
                  <Progress value={65} className="h-2" />
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm">内存使用</span>
                    <span className="text-sm font-medium">42%</span>
                  </div>
                  <Progress value={42} className="h-2" />
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm">网络流量</span>
                    <span className="text-sm font-medium">78%</span>
                  </div>
                  <Progress value={78} className="h-2" />
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm">磁盘使用</span>
                    <span className="text-sm font-medium">23%</span>
                  </div>
                  <Progress value={23} className="h-2" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>安全警报</CardTitle>
                <CardDescription>当前活跃的安全警报</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-start space-x-3 p-3 border border-red-200 rounded-lg bg-red-50">
                    <AlertTriangle className="h-4 w-4 text-red-500 mt-1" />
                    <div>
                      <h4 className="font-medium text-red-800">多次失败登录尝试</h4>
                      <p className="text-sm text-red-600">
                        用户 operator1 在过去1小时内尝试登录失败5次
                      </p>
                      <p className="text-xs text-red-500 mt-1">
                        {new Date(Date.now() - 30 * 60 * 1000).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-3 p-3 border border-yellow-200 rounded-lg bg-yellow-50">
                    <AlertTriangle className="h-4 w-4 text-yellow-500 mt-1" />
                    <div>
                      <h4 className="font-medium text-yellow-800">权限访问尝试</h4>
                      <p className="text-sm text-yellow-600">
                        用户 viewer1 尝试访问未授权的配置
                      </p>
                      <p className="text-xs text-yellow-500 mt-1">
                        {new Date(Date.now() - 2 * 60 * 60 * 1000).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}