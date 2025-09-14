'use client';

import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Users, 
  UserPlus, 
  UserX, 
  Shield, 
  Key,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  Search,
  Filter,
  RefreshCw,
  
} from 'lucide-react';

interface User {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: UserRole;
  status: 'active' | 'inactive' | 'suspended';
  permissions: Permission[];
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
  phone?: string;
  department?: string;
  avatar?: string;
}

interface UserRole {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
  isDefault: boolean;
  createdAt: Date;
}

interface Permission {
  id: string;
  name: string;
  description: string;
  category: 'system' | 'configuration' | 'execution' | 'analytics' | 'administration';
  resource: string;
  action: 'read' | 'write' | 'delete' | 'admin';
}

interface UserManagementProps {
  onUserCreated?: (user: User) => void;
  onUserUpdated?: (user: User) => void;
  onUserDeleted?: (userId: string) => void;
  onRoleCreated?: (role: UserRole) => void;
  onRoleUpdated?: (role: UserRole) => void;
  onRoleDeleted?: (roleId: string) => void;
}

const UserManagement: React.FC<UserManagementProps> = ({
  onUserCreated,
  onUserUpdated,
  onUserDeleted,
  onRoleCreated,
  onRoleUpdated,
  onRoleDeleted
}) => {
  const [activeTab, setActiveTab] = useState('users');
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentRole, setCurrentRole] = useState<UserRole | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [showPassword, setShowPassword] = useState(false);
  const [operationResult, setOperationResult] = useState<{
    success: boolean;
    message: string;
    details?: unknown;
  } | null>(null);

  // Mock data
  const mockUsers: User[] = [
    {
      id: 'user_1',
      username: 'admin',
      email: 'admin@example.com',
      fullName: 'System Administrator',
      role: { id: 'role_admin', name: 'Administrator', description: 'Full system access', permissions: [], isDefault: false, createdAt: new Date() },
      status: 'active',
      permissions: [],
      lastLogin: new Date(Date.now() - 2 * 60 * 60 * 1000),
      createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(),
      department: 'IT'
    },
    {
      id: 'user_2',
      username: 'manager',
      email: 'manager@example.com',
      fullName: 'Marketing Manager',
      role: { id: 'role_manager', name: 'Manager', description: 'Team management access', permissions: [], isDefault: false, createdAt: new Date() },
      status: 'active',
      permissions: [],
      lastLogin: new Date(Date.now() - 6 * 60 * 60 * 1000),
      createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(),
      department: 'Marketing'
    },
    {
      id: 'user_3',
      username: 'analyst',
      email: 'analyst@example.com',
      fullName: 'Data Analyst',
      role: { id: 'role_analyst', name: 'Analyst', description: 'Read-only access to analytics', permissions: [], isDefault: false, createdAt: new Date() },
      status: 'active',
      permissions: [],
      lastLogin: new Date(Date.now() - 24 * 60 * 60 * 1000),
      createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(),
      department: 'Analytics'
    },
    {
      id: 'user_4',
      username: 'operator',
      email: 'operator@example.com',
      fullName: 'System Operator',
      role: { id: 'role_operator', name: 'Operator', description: 'Basic execution access', permissions: [], isDefault: true, createdAt: new Date() },
      status: 'inactive',
      permissions: [],
      createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(),
      department: 'Operations'
    }
  ];

  const mockRoles: UserRole[] = [
    {
      id: 'role_admin',
      name: 'Administrator',
      description: 'Full system access with all permissions',
      permissions: [],
      isDefault: false,
      createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    },
    {
      id: 'role_manager',
      name: 'Manager',
      description: 'Team management and configuration access',
      permissions: [],
      isDefault: false,
      createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000)
    },
    {
      id: 'role_analyst',
      name: 'Analyst',
      description: 'Read-only access to analytics and reports',
      permissions: [],
      isDefault: false,
      createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)
    },
    {
      id: 'role_operator',
      name: 'Operator',
      description: 'Basic execution and monitoring access',
      permissions: [],
      isDefault: true,
      createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
    }
  ];

  const mockPermissions: Permission[] = [
    {
      id: 'perm_system_read',
      name: 'System Read',
      description: 'Read system settings and status',
      category: 'system',
      resource: 'system',
      action: 'read'
    },
    {
      id: 'perm_system_write',
      name: 'System Write',
      description: 'Modify system settings',
      category: 'system',
      resource: 'system',
      action: 'write'
    },
    {
      id: 'perm_config_read',
      name: 'Configuration Read',
      description: 'View automation configurations',
      category: 'configuration',
      resource: 'configuration',
      action: 'read'
    },
    {
      id: 'perm_config_write',
      name: 'Configuration Write',
      description: 'Create and modify configurations',
      category: 'configuration',
      resource: 'configuration',
      action: 'write'
    },
    {
      id: 'perm_execution_read',
      name: 'Execution Read',
      description: 'View execution results and status',
      category: 'execution',
      resource: 'execution',
      action: 'read'
    },
    {
      id: 'perm_execution_write',
      name: 'Execution Write',
      description: 'Start and manage executions',
      category: 'execution',
      resource: 'execution',
      action: 'write'
    },
    {
      id: 'perm_analytics_read',
      name: 'Analytics Read',
      description: 'View analytics and reports',
      category: 'analytics',
      resource: 'analytics',
      action: 'read'
    },
    {
      id: 'perm_admin',
      name: 'Administration',
      description: 'Full administrative access',
      category: 'administration',
      resource: '*',
      action: 'admin'
    }
  ];

  React.useEffect(() => {
    setUsers(mockUsers);
    setRoles(mockRoles);
  }, []);

  const defaultRole: UserRole = {
    id: '',
    name: '',
    description: '',
    permissions: [],
    isDefault: false,
    createdAt: new Date()
  };

  const defaultUser: User = {
    id: '',
    username: '',
    email: '',
    fullName: '',
    role: (roles.find((r: any) => r.isDefault) as UserRole) || roles[0] || defaultRole,
    status: 'active',
    permissions: [],
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const handleCreateUser = useCallback(() => {
    setCurrentUser(defaultUser);
    setIsCreating(true);
    setIsEditing(false);
    setOperationResult(null);
  }, [defaultUser]);
  const handleEditUser = useCallback((user: User) => {
    setCurrentUser(user);
    setIsEditing(true);
    setIsCreating(false);
    setOperationResult(null);
  }, []);

  const handleSaveUser = useCallback(async () => {
    if (!currentUser) return;

    try {
      if (isCreating) {
        const newUser = {
          ...currentUser,
          id: `user_${Date.now()}`,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        setUsers(prev => [...prev, newUser]);
        onUserCreated?.(newUser);
      } else {
        const updatedUser = {
          ...currentUser,
          updatedAt: new Date()
        };
        setUsers(prev => prev?.filter(Boolean)?.map((user: any) => user.id === updatedUser.id ? updatedUser : user));
        onUserUpdated?.(updatedUser);
      }

      setOperationResult({
        success: true,
        message: isCreating ? 'User created successfully' : 'User updated successfully'
      });
      setCurrentUser(null);
      setIsCreating(false);
      setIsEditing(false);
    } catch (error) {
      setOperationResult({
        success: false,
        message: 'Failed to save user',
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      });
    }
  }, [currentUser, isCreating, onUserCreated, onUserUpdated]);
  const handleDeleteUser = useCallback((userId: string) => { if (confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      setUsers(prev => prev.filter((user: any) => user.id !== userId));
      onUserDeleted?.(userId);
      setOperationResult({
        success: true,
        message: 'User deleted successfully'
      });
    }
  }, [onUserDeleted]);
  const handleCreateRole = useCallback(() => {
    setCurrentRole(defaultRole);
    setIsCreating(true);
    setIsEditing(false);
    setOperationResult(null);
  }, [defaultRole]);
  const handleEditRole = useCallback((role: UserRole) => {
    setCurrentRole(role);
    setIsEditing(true);
    setIsCreating(false);
    setOperationResult(null);
  }, []);

  const handleSaveRole = useCallback(async () => {
    if (!currentRole) return;

    try {
      if (isCreating) {
        const newRole = {
          ...currentRole,
          id: `role_${Date.now()}`,
          createdAt: new Date()
        };
        setRoles(prev => [...prev, newRole]);
        onRoleCreated?.(newRole);
      } else {
        setRoles(prev => prev?.filter(Boolean)?.map((role: any) => role.id === currentRole.id ? currentRole : role));
        onRoleUpdated?.(currentRole);
      }

      setOperationResult({
        success: true,
        message: isCreating ? 'Role created successfully' : 'Role updated successfully'
      });
      setCurrentRole(null);
      setIsCreating(false);
      setIsEditing(false);
    } catch (error) {
      setOperationResult({
        success: false,
        message: 'Failed to save role',
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      });
    }
  }, [currentRole, isCreating, onRoleCreated, onRoleUpdated]);
  const handleDeleteRole = useCallback((roleId: string) => { if (confirm('Are you sure you want to delete this role? This action cannot be undone.')) {
      setRoles(prev => prev.filter((role: any) => role.id !== roleId));
      onRoleDeleted?.(roleId);
      setOperationResult({
        success: true,
        message: 'Role deleted successfully'
      });
    }
  }, [onRoleDeleted]);
  const handleCancel = useCallback(() => {
    setCurrentUser(null);
    setCurrentRole(null);
    setIsCreating(false);
    setIsEditing(false);
    setOperationResult(null);
  }, []);

  const filteredUsers = users.filter((user: any) => { 
    const matchesSearch = user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.fullName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = selectedRole === 'all' || user.role.id === selectedRole;
    const matchesStatus = selectedStatus === 'all' || user.status === selectedStatus;
    return matchesSearch && matchesRole && matchesStatus;
  });
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-600 bg-green-50';
      case 'inactive': return 'text-gray-600 bg-gray-50';
      case 'suspended': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getRoleColor = (roleName: string) => {
    switch (roleName.toLowerCase()) {
      case 'administrator': return 'text-purple-600 bg-purple-50';
      case 'manager': return 'text-blue-600 bg-blue-50';
      case 'analyst': return 'text-green-600 bg-green-50';
      case 'operator': return 'text-orange-600 bg-orange-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleString();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">User Management</h2>
          <p className="text-muted-foreground">
            Manage users, roles, and permissions
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="roles">Roles</TabsTrigger>
          <TabsTrigger value="permissions">Permissions</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-6">
          <div className="flex justify-between items-center">
            <div className="flex gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search users..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm((e.target as HTMLInputElement).value)}
                  className="pl-10 w-64"
                />
              </div>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  {roles?.filter(Boolean)?.map((role) => (
                    <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleCreateUser} className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              Add User
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* User List */}
            <div className="lg:col-span-1">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Users ({filteredUsers.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {filteredUsers.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No users found</p>
                      </div>
                    ) : (
                      filteredUsers.map((user) => (
                        <div
                          key={user.id}
                          className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                            currentUser?.id === user.id
                              ? 'border-primary bg-primary/5'
                              : 'border-border hover:border-primary/50'
                          }`}
                          onClick={() => setCurrentUser(user)}
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-medium">{user.fullName}</h4>
                                <Badge className={getStatusColor(user.status)}>
                                  {user.status}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {user.username} • {user.email}
                              </p>
                              <div className="flex items-center gap-2 mt-2">
                                <Badge className={getRoleColor(user.role.name)}>
                                  {user.role.name}
                                </Badge>
                                {user.department && (
                                  <span className="text-xs text-muted-foreground">
                                    {user.department}
                                  </span>
                                )}
                              </div>
                              {user.lastLogin && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Last login: {formatDate(user.lastLogin)}
                                </p>
                              )}
                            </div>
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditUser(user);
                                }}
                              >
                                <Edit className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteUser(user.id);
                                }}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* User Editor */}
            <div className="lg:col-span-1">
              {currentUser ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      {isCreating ? <UserPlus className="h-5 w-5" /> : <Edit className="h-5 w-5" />}
                      {isCreating ? 'New User' : 'Edit User'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="username">Username *</Label>
                        <Input
                          id="username"
                          value={currentUser.username}
                          onChange={(e) => setCurrentUser(prev => prev ? { ...prev, username: e.target.value } : null)}
                          disabled={isEditing}
                        />
                      </div>
                      <div>
                        <Label htmlFor="email">Email *</Label>
                        <Input
                          id="email"
                          type="email"
                          value={currentUser.email}
                          onChange={(e) => setCurrentUser(prev => prev ? { ...prev, email: e.target.value } : null)}
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="fullName">Full Name *</Label>
                      <Input
                        id="fullName"
                        value={currentUser.fullName}
                        onChange={(e) => setCurrentUser(prev => prev ? { ...prev, fullName: e.target.value } : null)}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="role">Role</Label>
                        <Select
                          value={currentUser.role.id}
                          onValueChange={(value) => {
                            const role = roles.find((r) => r.id === value);
                            if (role) {
                              setCurrentUser(prev => prev ? { ...prev, role } : null);
                            }
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {roles?.filter(Boolean)?.map((role) => (
                              <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="status">Status</Label>
                        <Select
                          value={currentUser.status}
                          onValueChange={(value) => 
                            setCurrentUser(prev => prev ? { ...prev, status: value as any } : null)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="inactive">Inactive</SelectItem>
                            <SelectItem value="suspended">Suspended</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="department">Department</Label>
                      <Input
                        id="department"
                        value={currentUser.department || ''}
                        onChange={(e) => setCurrentUser(prev => prev ? { ...prev, department: e.target.value } : null)}
                      />
                    </div>

                    {isCreating && (
                      <div>
                        <Label htmlFor="password">Password *</Label>
                        <div className="relative">
                          <Input
                            id="password"
                            type={showPassword ? 'text' : 'password'}
                            placeholder="Enter password"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                            onClick={() => setShowPassword(!showPassword)}
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Button onClick={handleSaveUser} className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4" />
                        {isCreating ? 'Create User' : 'Update User'}
                      </Button>
                      <Button variant="ghost" onClick={handleCancel}>
                        Cancel
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Users className="h-16 w-16 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-2">No User Selected</h3>
                    <p className="text-muted-foreground text-center mb-4">
                      Select a user from the list or create a new one to get started
                    </p>
                    <Button onClick={handleCreateUser} className="flex items-center gap-2">
                      <UserPlus className="h-4 w-4" />
                      Create New User
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="roles" className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-medium">Roles & Permissions</h3>
              <p className="text-muted-foreground">Manage user roles and their permissions</p>
            </div>
            <Button onClick={handleCreateRole} className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              Add Role
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Role List */}
            <div className="lg:col-span-1">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Roles ({roles.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {roles.map((role) => (
                      <div
                        key={role.id}
                        className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                          currentRole?.id === role.id
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/50'
                        }`}
                        onClick={() => setCurrentRole(role)}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-medium">{role.name}</h4>
                              {role.isDefault && (
                                <Badge variant="outline">Default</Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {role.description}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Created: {formatDate(role.createdAt)}
                            </p>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditRole(role);
                              }}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteRole(role.id);
                              }}
                              disabled={role.isDefault}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Role Editor */}
            <div className="lg:col-span-1">
              {currentRole ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      {isCreating ? <UserPlus className="h-5 w-5" /> : <Edit className="h-5 w-5" />}
                      {isCreating ? 'New Role' : 'Edit Role'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="role-name">Role Name *</Label>
                      <Input
                        id="role-name"
                        value={currentRole.name}
                        onChange={(e) => setCurrentRole(prev => prev ? { ...prev, name: e.target.value } : null)}
                      />
                    </div>

                    <div>
                      <Label htmlFor="role-description">Description</Label>
                      <Textarea
                        id="role-description"
                        value={currentRole.description}
                        onChange={(e) => setCurrentRole(prev => prev ? { ...prev, description: e.target.value } : null)}
                        rows={3}
                      />
                    </div>

                    <div className="flex items-center space-x-2">
                      <Switch
                        id="is-default"
                        checked={currentRole.isDefault}
                        onCheckedChange={(checked: boolean) => setCurrentRole(prev => prev ? { ...prev, isDefault: checked } : null)}
                      />
                      <Label htmlFor="is-default">Default role for new users</Label>
                    </div>

                    <div className="space-y-4">
                      <h4 className="font-medium">Permissions</h4>
                      <div className="space-y-3">
                        {mockPermissions.map((permission: any) => (
                          <div key={permission.id} className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id={permission.id}
                              checked={currentRole.permissions.some(p => p.id === permission.id)}
                              onChange={(e) => {
                                if ((e.target as HTMLInputElement).checked) {
                                  setCurrentRole(prev => prev ? {
                                    ...prev,
                                    permissions: [...prev.permissions, permission]
                                  } : null);
                                } else {
                                  setCurrentRole(prev => prev ? {
                                    ...prev,
                                    permissions: prev.permissions.filter((p: any) => p.id !== permission.id)
                                  } : null);
                                }
                              }}
                            />
                            <Label htmlFor={permission.id} className="text-sm">
                              <div className="font-medium">{permission.name}</div>
                              <div className="text-muted-foreground">{permission.description}</div>
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button onClick={handleSaveRole} className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4" />
                        {isCreating ? 'Create Role' : 'Update Role'}
                      </Button>
                      <Button variant="ghost" onClick={handleCancel}>
                        Cancel
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Shield className="h-16 w-16 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-2">No Role Selected</h3>
                    <p className="text-muted-foreground text-center mb-4">
                      Select a role from the list or create a new one to get started
                    </p>
                    <Button onClick={handleCreateRole} className="flex items-center gap-2">
                      <UserPlus className="h-4 w-4" />
                      Create New Role
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="permissions" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                System Permissions
              </CardTitle>
              <CardDescription>
                Overview of all available permissions in the system
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {['system', 'configuration', 'execution', 'analytics', 'administration'].map((category: any) => (
                  <div key={category} className="space-y-3">
                    <h4 className="font-medium capitalize">{category} Permissions</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {mockPermissions
                        .filter((permission: any) => permission.category === category)
                        .map((permission: any) => (
                          <div key={permission.id} className="p-3 border rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <h5 className="font-medium">{permission.name}</h5>
                              <Badge variant="outline" className="text-xs">
                                {permission.action}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {permission.description}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Resource: {permission.resource}
                            </p>
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {operationResult && (
        <Alert variant={operationResult.success ? 'default' : 'destructive'}>
          {operationResult.success ? (
            <CheckCircle className="h-4 w-4" />
          ) : (
            <XCircle className="h-4 w-4" />
          )}
          <AlertDescription>
            <div className="font-medium">{operationResult.message}</div>
            {Boolean(operationResult.details) && (
              <div className="mt-2 text-sm">
                {Object.entries(operationResult.details as Record<string, unknown>).map(([key, value]: any) => (
                  <div key={key} className="flex justify-between">
                    <span className="capitalize">{key}:</span>
                    <span>{String(value)}</span>
                  </div>
                ))}
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default UserManagement; 
