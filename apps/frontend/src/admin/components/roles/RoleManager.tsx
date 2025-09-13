'use client'
import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/Card'
import { Button } from '@/shared/components/ui/Button'
import { Input } from '@/shared/components/ui/Input'
import { Badge } from '../ui/badge'
import { 
  Shield, 
  Plus, 
  Edit, 
  Trash2, 
  Users, 
  Search,
  Settings,
  Eye,
  Copy,
  AlertTriangle,
  Check,
  X
} from 'lucide-react'
import { useRoleManagement } from '../../hooks/useRoleManagement'

export interface Role {
  id: string
  name: string
  description: string
  permissions: string[]
  isSystem: boolean
  userCount: number
  createdAt: string
  updatedAt: string
  parentRole?: string
  children?: Role[]
}

export interface RoleManagerProps {
  onRoleSelect?: (role: Role) => void
  onRoleEdit?: (role: Role) => void
  onRoleDelete?: (roleId: string) => void
  onRoleCreate?: () => void
}

export function RoleManager({
  onRoleSelect,
  onRoleEdit,
  onRoleDelete,
  onRoleCreate
}: RoleManagerProps) {
  const {
    roles,
    isLoading,
    error,
    createRole,
    updateRole,
    deleteRole,
    duplicateRole,
    refreshRoles
  } = useRoleManagement()

  const [searchTerm, setSearchTerm] = useState('')
  const [selectedRoles, setSelectedRoles] = useState<Set<string>>(new Set())
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingRole, setEditingRole] = useState<Role | null>(null)

  // Filter roles based on search term
  const filteredRoles = roles.filter((role: any) =>
    role.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    role.description.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleRoleSelect = (roleId: string) => {
    const newSelected = new Set(selectedRoles)
    if (newSelected.has(roleId)) {
      newSelected.delete(roleId)
    } else {
      newSelected.add(roleId)
    }
    setSelectedRoles(newSelected)
  }

  const handleSelectAll = () => {
    if (selectedRoles.size === filteredRoles.length) {
      setSelectedRoles(new Set())
    } else {
      setSelectedRoles(new Set(filteredRoles?.filter(Boolean)?.map((role: any) => role.id)))
    }
  }

  const handleCreateRole = () => {
    setShowCreateForm(true)
    onRoleCreate?.()
  }

  const handleEditRole = (role: Role) => {
    setEditingRole(role)
    onRoleEdit?.(role)
  }

  const handleDeleteRole = async (roleId: string) => {
    if (window.confirm('Are you sure you want to delete this role? This action cannot be undone.')) {
      try {
        await deleteRole(roleId)
        onRoleDelete?.(roleId)
      } catch (error) {
        console.error('Error deleting role:', error)
      }
    }
  }

  const handleDuplicateRole = async (role: Role) => {
    try {
      await duplicateRole(role.id, `${role.name} (Copy)`)
      refreshRoles()
    } catch (error) {
      console.error('Error duplicating role:', error)
    }
  }

  const getRoleHierarchy = (role: Role): Role[] => {
    const hierarchy: Role[] = [role]
    if (role.parentRole) {
      const parent = roles.find((r: any) => r.id === role.parentRole)
      if (parent) {
        hierarchy.unshift(...getRoleHierarchy(parent))
      }
    }
    return hierarchy
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-red-600">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
            <p>Error loading roles: {error}</p>
            <Button onClick={refreshRoles} className="mt-2">
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
            Role Management
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage user roles and permissions
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
          <Button size="sm" onClick={handleCreateRole}>
            <Plus className="h-4 w-4 mr-2" />
            Create Role
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center space-x-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search roles..."
                  value={searchTerm}
                  onChange={((e: any): any) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="text-sm text-gray-600">
              {filteredRoles.length} role{filteredRoles.length !== 1 ? 's' : ''}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions */}
      {selectedRoles.size > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">
                {selectedRoles.size} role{selectedRoles.size !== 1 ? 's' : ''} selected
              </span>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={((: any): any) => {
                    selectedRoles.forEach((roleId: any) => {
                      const role = roles.find((r: any) => r.id === roleId)
                      if (role) handleDuplicateRole(role)
                    })
                    setSelectedRoles(new Set())
                  }}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Duplicate
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={((: any): any) => {
                    if (window.confirm(`Are you sure you want to delete ${selectedRoles.size} role(s)?`)) {
                      selectedRoles.forEach((roleId: any) => handleDeleteRole(roleId))
                      setSelectedRoles(new Set())
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Roles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, index: any) => (
            <Card key={index} className="animate-pulse">
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="h-4 bg-gray-300 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-300 rounded w-full"></div>
                  <div className="h-3 bg-gray-300 rounded w-2/3"></div>
                  <div className="flex space-x-2">
                    <div className="h-6 bg-gray-300 rounded w-16"></div>
                    <div className="h-6 bg-gray-300 rounded w-12"></div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : filteredRoles.length === 0 ? (
          <div className="col-span-full">
            <Card>
              <CardContent className="p-8 text-center">
                <Shield className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  No roles found
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  {searchTerm ? 'No roles match your search criteria.' : 'Get started by creating your first role.'}
                </p>
                {!searchTerm && (
                  <Button onClick={handleCreateRole}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Role
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          filteredRoles.map((role: any) => (
            <Card 
              key={role.id} 
              className={`cursor-pointer transition-all hover:shadow-md ${
                selectedRoles.has(role.id) ? 'ring-2 ring-blue-500' : ''
              }`}
              onClick={((: any): any) => onRoleSelect?.(role)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={selectedRoles.has(role.id)}
                      onChange={((e: any): any) => {
                        e.stopPropagation()
                        handleRoleSelect(role.id)
                      }}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <Shield className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="flex items-center space-x-1">
                    {role.isSystem && (
                      <Badge variant="secondary" className="text-xs">
                        System
                      </Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={((e: any): any) => {
                        e.stopPropagation()
                        handleEditRole(role)
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={((e: any): any) => {
                        e.stopPropagation()
                        handleDuplicateRole(role)
                      }}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    {!role.isSystem && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={((e: any): any) => {
                          e.stopPropagation()
                          handleDeleteRole(role.id)
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
                <CardTitle className="text-lg">{role.name}</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
                  {role.description}
                </p>
                
                {/* Role Hierarchy */}
                {role.parentRole && (
                  <div className="mb-3">
                    <div className="text-xs text-gray-500 mb-1">Inherits from:</div>
                    <div className="flex items-center space-x-1">
                      {getRoleHierarchy(role).slice(0, -1).map((parentRole, index: any) => (
                        <React.Fragment key={parentRole.id}>
                          {index > 0 && <span className="text-gray-400">→</span>}
                          <Badge variant="outline" className="text-xs">
                            {parentRole.name}
                          </Badge>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                )}

                {/* Permissions Count */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline" className="text-xs">
                      {role.permissions.length} permission{role.permissions.length !== 1 ? 's' : ''}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      <Users className="h-3 w-3 mr-1" />
                      {role.userCount} user{role.userCount !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                </div>

                {/* Sample Permissions */}
                {role.permissions.length > 0 && (
                  <div>
                    <div className="text-xs text-gray-500 mb-2">Key permissions:</div>
                    <div className="flex flex-wrap gap-1">
                      {role.permissions.slice(0, 3).map((permission: any) => (
                        <Badge key={permission} variant="secondary" className="text-xs">
                          {permission.replace(/[_-]/g, ' ').toLowerCase()}
                        </Badge>
                      ))}
                      {role.permissions.length > 3 && (
                        <Badge variant="secondary" className="text-xs">
                          +{role.permissions.length - 3} more
                        </Badge>
                      )}
                    </div>
                  </div>
                )}

                {/* Children Roles */}
                {role.children && role.children.length > 0 && (
                  <div className="mt-3">
                    <div className="text-xs text-gray-500 mb-1">Child roles:</div>
                    <div className="flex flex-wrap gap-1">
                      {role.children.slice(0, 2).map((childRole: any) => (
                        <Badge key={childRole.id} variant="outline" className="text-xs">
                          {childRole.name}
                        </Badge>
                      ))}
                      {role.children.length > 2 && (
                        <Badge variant="outline" className="text-xs">
                          +{role.children.length - 2} more
                        </Badge>
                      )}
                    </div>
                  </div>
                )}

                {/* Last Updated */}
                <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
                  <div className="text-xs text-gray-500">
                    Updated {new Date(role.updatedAt).toLocaleDateString()}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Select All Checkbox */}
      {filteredRoles.length > 0 && (
        <div className="flex items-center justify-between">
          <label className="flex items-center space-x-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={selectedRoles.size === filteredRoles.length}
              onChange={handleSelectAll}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span>Select all visible roles</span>
          </label>
          <div className="text-sm text-gray-500">
            Total: {roles.length} roles
          </div>
        </div>
      )}
    </div>
  )
}

export default RoleManager