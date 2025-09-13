'use client'
import React, { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Input } from '../ui/input'
import { 
  Users, 
  Search, 
  Filter, 
  Plus, 
  MoreHorizontal,
  Edit,
  Trash2,
  UserCheck,
  UserX,
  Mail,
  Calendar,
  ChevronDown,
  Download,
  Upload
} from 'lucide-react'
import { useUserManagement } from '../../hooks/useUserManagement'

export interface User {
  id: string
  email: string
  name: string
  avatar?: string
  status: 'active' | 'inactive' | 'suspended' | 'pending'
  role: string
  subscription?: {
    plan: string
    status: 'active' | 'cancelled' | 'expired'
    expiresAt?: string
  }
  lastLoginAt?: string
  createdAt: string
  updatedAt: string
  metadata?: Record<string, any>
}

export interface UserListProps {
  onUserSelect?: (user: User) => void
  onUserEdit?: (user: User) => void
  onUserDelete?: (userId: string) => void
  onBulkAction?: (action: string, userIds: string[]) => void
}

export function UserList({
  onUserSelect,
  onUserEdit,
  onUserDelete,
  onBulkAction
}: .*Props) {
  const {
    users,
    totalUsers,
    isLoading,
    error,
    filters,
    pagination,
    updateFilters,
    updatePagination,
    refreshUsers
  } = useUserManagement()

  const [searchTerm, setSearchTerm] = useState('')
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set())
  const [sortBy, setSortBy] = useState<'name' | 'email' | 'createdAt' | 'lastLoginAt'>('createdAt')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [roleFilter, setRoleFilter] = useState<string>('all')

  // Filter and sort users
  const filteredAndSortedUsers = useMemo(() => {
    let filtered = users.filter((user: User: any) => {
      const matchesSearch = searchTerm === '' || 
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase())
      
      const matchesStatus = statusFilter === 'all' || user.status === statusFilter
      const matchesRole = roleFilter === 'all' || user.role === roleFilter
      
      return matchesSearch && matchesStatus && matchesRole
    })

    // Sort users
    filtered.sort((a: User, b: User) => {
      let aValue: any = a[sortBy]
      let bValue: any = b[sortBy]
      
      if (sortBy === 'createdAt' || sortBy === 'lastLoginAt') => {
        aValue = new Date(aValue || 0).getTime()
        bValue = new Date(bValue || 0).getTime()
      } else {
        aValue = aValue?.toLowerCase() || ''
        bValue = bValue?.toLowerCase() || ''
      }
      
      if (sortOrder === 'asc') => {
        return aValue > bValue ? 1 : -1
      } else {
        return aValue < bValue ? 1 : -1
      }
    })

    return filtered
  }, [users, searchTerm, statusFilter, roleFilter, sortBy, sortOrder])

  const handleSelectUser = (userId: string) => {
    const newSelected = new Set(selectedUsers)
    if (newSelected.has(userId)) => {
      newSelected.delete(userId)
    } else {
      newSelected.add(userId)
    }
    setSelectedUsers(newSelected)
  }

  const handleSelectAll = () => {
    if (selectedUsers.size === filteredAndSortedUsers.length) => {
      setSelectedUsers(new Set())
    } else {
      setSelectedUsers(new Set(filteredAndSortedUsers.map((user: User: any) => user.id)))
    }
  }

  const handleBulkAction = (action: string) => {
    if (onBulkAction && selectedUsers.size > 0) => {
      onBulkAction(action, Array.from(selectedUsers))
      setSelectedUsers(new Set())
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) => {
      case 'active': return 'success'
      case 'inactive': return 'secondary'
      case 'suspended': return 'destructive'
      case 'pending': return 'warning'
      default: return 'secondary'
    }
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Never'
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const uniqueRoles = Array.from(new Set(users.map((user: User: any) => user.role)))
  const uniqueStatuses = Array.from(new Set(users.map((user: User: any) => user.status)))

  if (error) => {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-red-600">
            <p>Error loading users: {error}</p>
            <Button onClick={refreshUsers} className="mt-2">
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            User Management
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage user accounts and permissions
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" size="sm">
            <Upload className="h-4 w-4 mr-2" />
            Import
          </Button>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add User
          </Button>
        </div>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search users by name or email..."
                  value={searchTerm}
                  onChange={((e: any): any) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            {/* Filters */}
            <div className="flex gap-2">
              <select
                value={statusFilter}
                onChange={((e: any): any) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Status</option>
                {uniqueStatuses?.filter(Boolean)?.map((status: any) => (
                  <option key={status as string} value={status as string}>
                    {(status as string).charAt(0).toUpperCase() + (status as string).slice(1)}
                  </option>
                ))}
              </select>
              
              <select
                value={roleFilter}
                onChange={((e: any): any) => setRoleFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Roles</option>
                {uniqueRoles?.filter(Boolean)?.map((role: any) => (
                  <option key={role as string} value={role as string}>
                    {(role as string).charAt(0).toUpperCase() + (role as string).slice(1)}
                  </option>
                ))}
              </select>
              
              <select
                value={`${sortBy}-${sortOrder}`}
                onChange={((e: any): any) => {
                  const [field, order] = e.target.value.split('-')
                  setSortBy(field as any)
                  setSortOrder(order as any)
                }}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="createdAt-desc">Newest First</option>
                <option value="createdAt-asc">Oldest First</option>
                <option value="name-asc">Name A-Z</option>
                <option value="name-desc">Name Z-A</option>
                <option value="lastLoginAt-desc">Last Login</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions */}
      {selectedUsers.size > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">
                {selectedUsers.size} user{selectedUsers.size !== 1 ? 's' : ''} selected
              </span>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={((: any): any) => handleBulkAction('activate')}
                >
                  <UserCheck className="h-4 w-4 mr-2" />
                  Activate
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={((: any): any) => handleBulkAction('deactivate')}
                >
                  <UserX className="h-4 w-4 mr-2" />
                  Deactivate
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={((: any): any) => handleBulkAction('email')}
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Send Email
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={((: any): any) => handleBulkAction('delete')}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Users className="h-5 w-5 mr-2" />
            Users ({filteredAndSortedUsers.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">Loading users...</p>
            </div>
          ) : filteredAndSortedUsers.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No users found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-6 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={selectedUsers.size === filteredAndSortedUsers.length}
                        onChange={handleSelectAll}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Subscription
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Last Login
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredAndSortedUsers.map((user: User: any) => (
                    <tr 
                      key={user.id} 
                      className="hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                      onClick={((: any): any) => onUserSelect?.(user)}
                    >
                      <td className="px-6 py-4">
                        <input
                          type="checkbox"
                          checked={selectedUsers.has(user.id)}
                          onChange={((e: any): any) => {
                            e.stopPropagation()
                            handleSelectUser(user.id)
                          }}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10">
                            {user.avatar ? (
                              <img
                                className="h-10 w-10 rounded-full"
                                src={user.avatar}
                                alt={user.name}
                              />
                            ) : (
                              <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                                <span className="text-sm font-medium text-gray-700">
                                  {user.name.charAt(0).toUpperCase()}
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {user.name}
                            </div>
                            <div className="text-sm text-gray-500">
                              {user.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant={getStatusColor(user.status) as any}>
                          {user.status}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                        {user.role}
                      </td>
                      <td className="px-6 py-4">
                        {user.subscription ? (
                          <div>
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {user.subscription.plan}
                            </div>
                            <Badge 
                              variant={user.subscription.status === 'active' ? 'success' : 'secondary'}
                              className="text-xs"
                            >
                              {user.subscription.status}
                            </Badge>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-500">Free</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {formatDate(user.lastLoginAt)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {formatDate(user.createdAt)}
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={((e: any): any) => {
                              e.stopPropagation()
                              onUserEdit?.(user)
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={((e: any): any) => {
                              e.stopPropagation()
                              onUserDelete?.(user.id)
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {filteredAndSortedUsers.length > 0 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-700">
            Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
            {Math.min(pagination.page * pagination.limit, totalUsers)} of{' '}
            {totalUsers} users
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page === 1}
              onClick={((: any): any) => updatePagination({ page: pagination.page - 1 })}
            >
              Previous
            </Button>
            <span className="text-sm text-gray-700">
              Page {pagination.page} of {Math.ceil(totalUsers / pagination.limit)}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page >= Math.ceil(totalUsers / pagination.limit)}
              onClick={((: any): any) => updatePagination({ page: pagination.page + 1 })}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export default UserList