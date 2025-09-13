'use client'
import React, { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/Card'
import { Button } from '@/shared/components/ui/Button'
import { Input } from '@/shared/components/ui/Input'
import { Badge } from '../ui/badge'
import { 
  Shield, 
  Search, 
  Filter,
  Check,
  X,
  Eye,
  Edit,
  Trash2,
  Settings,
  Users,
  Database,
  FileText,
  CreditCard,
  Mail,
  BarChart3,
  Lock,
  Unlock,
  AlertTriangle,
  Info,
  Plus
} from 'lucide-react'
import { useRoleManagement } from '../../hooks/useRoleManagement'

export interface Permission {
  id: string
  name: string
  description: string
  category: string
  resource: string
  action: string
  conditions?: Record<string, any>
}

export interface PermissionMatrixProps {
  roleId?: string
  onPermissionChange?: (roleId: string, permissions: string[]) => void
  readOnly?: boolean
  showInherited?: boolean
}

export function PermissionMatrix({
  roleId,
  onPermissionChange,
  readOnly = false,
  showInherited = true
}: PermissionMatrixProps) {
  const {
    roles,
    permissions,
    getRoleById,
    getRolePermissions,
    getEffectivePermissions,
    getInheritedPermissions,
    getPermissionsByCategory,
    assignPermissions,
    isAssigningPermissions
  } = useRoleManagement()

  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(new Set())
  const [showDetails, setShowDetails] = useState<Set<string>>(new Set())

  const currentRole = roleId ? getRoleById(roleId) : null
  const rolePermissions = roleId ? getRolePermissions(roleId) : []
  const effectivePermissions = roleId ? getEffectivePermissions(roleId) : []
  const inheritedPermissions = roleId ? getInheritedPermissions(roleId) : []

  // Initialize selected permissions when role changes
  React.useEffect(() => {
    if (currentRole) {
      setSelectedPermissions(new Set(currentRole.permissions))
    }
  }, [currentRole])

  // Group permissions by category
  const permissionsByCategory = useMemo(() => {
    return getPermissionsByCategory()
  }, [getPermissionsByCategory])

  // Filter permissions based on search and category
  const filteredPermissions = useMemo(() => {
    let filtered = permissions

    // Filter by search term
    if (searchTerm) {
      const lowercaseSearch = searchTerm.toLowerCase()
      filtered = filtered.filter((permission: any) =>
        permission.name.toLowerCase().includes(lowercaseSearch) ||
        permission.description.toLowerCase().includes(lowercaseSearch) ||
        permission.category.toLowerCase().includes(lowercaseSearch) ||
        permission.resource.toLowerCase().includes(lowercaseSearch) ||
        permission.action.toLowerCase().includes(lowercaseSearch)
      )
    }

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter((permission: any) => permission.category === selectedCategory)
    }

    return filtered
  }, [permissions, searchTerm, selectedCategory])

  const getPermissionIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case 'users': return Users
      case 'roles': return Shield
      case 'content': return FileText
      case 'billing': return CreditCard
      case 'notifications': return Mail
      case 'analytics': return BarChart3
      case 'system': return Settings
      case 'database': return Database
      default: return Lock
    }
  }

  const getActionIcon = (action: string) => {
    switch (action.toLowerCase()) {
      case 'read': case 'view': return Eye
      case 'create': case 'add': return Plus
      case 'update': case 'edit': return Edit
      case 'delete': case 'remove': return Trash2
      default: return Settings
    }
  }

  const getPermissionStatus = (permissionId: string) => {
    const isDirectlyAssigned = currentRole?.permissions.includes(permissionId)
    const isInherited = inheritedPermissions.some(p => p.id === permissionId)
    const isEffective = effectivePermissions.some(p => p.id === permissionId)

    return {
      isDirectlyAssigned: !!isDirectlyAssigned,
      isInherited: !!isInherited,
      isEffective: !!isEffective
    }
  }

  const handlePermissionToggle = (permissionId: string) => {
    if (readOnly || !currentRole) return

    const newPermissions = new Set(selectedPermissions)
    if (newPermissions.has(permissionId)) {
      newPermissions.delete(permissionId)
    } else {
      newPermissions.add(permissionId)
    }
    
    setSelectedPermissions(newPermissions)
  }

  const handleSavePermissions = async () => {
    if (!currentRole || readOnly) return

    try {
      await assignPermissions(currentRole.id, Array.from(selectedPermissions))
      onPermissionChange?.(currentRole.id, Array.from(selectedPermissions))
    } catch (error) {
      console.error('Error saving permissions:', error)
    }
  }

  const handleSelectAll = (category?: string) => {
    if (readOnly) return

    const permissionsToSelect = category
      ? permissionsByCategory[category] || []
      : filteredPermissions

    const newPermissions = new Set(selectedPermissions)
    permissionsToSelect.forEach((permission: any) => {
      newPermissions.add(permission.id)
    })
    
    setSelectedPermissions(newPermissions)
  }

  const handleDeselectAll = (category?: string) => {
    if (readOnly) return

    const permissionsToDeselect = category
      ? permissionsByCategory[category] || []
      : filteredPermissions

    const newPermissions = new Set(selectedPermissions)
    permissionsToDeselect.forEach((permission: any) => {
      newPermissions.delete(permission.id)
    })
    
    setSelectedPermissions(newPermissions)
  }

  const toggleDetails = (permissionId: string) => {
    const newShowDetails = new Set(showDetails)
    if (newShowDetails.has(permissionId)) {
      newShowDetails.delete(permissionId)
    } else {
      newShowDetails.add(permissionId)
    }
    setShowDetails(newShowDetails)
  }

  const categories = Object.keys(permissionsByCategory)
  const hasChanges = currentRole && 
    JSON.stringify(Array.from(selectedPermissions).sort()) !== 
    JSON.stringify(currentRole.permissions.sort())

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Permission Matrix
          </h2>
          {currentRole && (
            <p className="text-gray-600 dark:text-gray-400">
              Managing permissions for role: <strong>{currentRole.name}</strong>
            </p>
          )}
        </div>
        {!readOnly && hasChanges && (
          <Button
            onClick={handleSavePermissions}
            disabled={isAssigningPermissions}
            className="min-w-[120px]"
          >
            {isAssigningPermissions ? (
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Saving...
              </div>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search permissions..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm((e.target as any).value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            {/* Category Filter */}
            <div className="flex items-center space-x-2">
              <Filter className="h-4 w-4 text-gray-400" />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory((e.target as any).value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Categories</option>
                {categories?.filter(Boolean)?.map((category: any) => (
                  <option key={category} value={category}>
                    {category.charAt(0).toUpperCase() + category.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            {/* Bulk Actions */}
            {!readOnly && (
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSelectAll(selectedCategory === 'all' ? undefined : selectedCategory)}
                >
                  Select All
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDeselectAll(selectedCategory === 'all' ? undefined : selectedCategory)}
                >
                  Deselect All
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Permission Summary */}
      {currentRole && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Shield className="h-5 w-5 text-blue-600" />
                <div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {selectedPermissions.size}
                  </div>
                  <div className="text-sm text-gray-600">Direct Permissions</div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {showInherited && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Unlock className="h-5 w-5 text-green-600" />
                  <div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">
                      {inheritedPermissions.length}
                    </div>
                    <div className="text-sm text-gray-600">Inherited Permissions</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Check className="h-5 w-5 text-purple-600" />
                <div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {effectivePermissions.length}
                  </div>
                  <div className="text-sm text-gray-600">Total Effective</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Permissions by Category */}
      {selectedCategory === 'all' ? (
        <div className="space-y-6">
          {categories?.filter(Boolean)?.map((category: any) => {
            const categoryPermissions = permissionsByCategory[category].filter((permission: any) =>
              !searchTerm || 
              permission.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
              permission.description.toLowerCase().includes(searchTerm.toLowerCase())
            )

            if (categoryPermissions.length === 0) return null

            const CategoryIcon = getPermissionIcon(category)

            return (
              <Card key={category}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center">
                      <CategoryIcon className="h-5 w-5 mr-2" />
                      {category.charAt(0).toUpperCase() + category.slice(1)}
                      <Badge variant="outline" className="ml-2">
                        {categoryPermissions.length}
                      </Badge>
                    </div>
                    {!readOnly && (
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSelectAll(category)}
                        >
                          Select All
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeselectAll(category)}
                        >
                          Deselect All
                        </Button>
                      </div>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {categoryPermissions?.filter(Boolean)?.map((permission: any) => {
                      const status = getPermissionStatus(permission.id)
                      const ActionIcon = getActionIcon(permission.action)

                      return (
                        <div
                          key={permission.id}
                          className={`p-4 border rounded-lg transition-all ${
                            status.isDirectlyAssigned
                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                              : status.isInherited
                              ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-start space-x-3 flex-1">
                              {!readOnly && (
                                <input
                                  type="checkbox"
                                  checked={selectedPermissions.has(permission.id)}
                                  onChange={() => handlePermissionToggle(permission.id)}
                                  className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                              )}
                              <ActionIcon className="h-5 w-5 mt-0.5 text-gray-600" />
                              <div className="flex-1">
                                <div className="flex items-center space-x-2">
                                  <h4 className="font-medium text-gray-900 dark:text-white">
                                    {permission.name}
                                  </h4>
                                  {status.isDirectlyAssigned && (
                                    <Badge variant="default" className="text-xs">
                                      Direct
                                    </Badge>
                                  )}
                                  {status.isInherited && !status.isDirectlyAssigned && (
                                    <Badge variant="secondary" className="text-xs">
                                      Inherited
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                  {permission.description}
                                </p>
                                <div className="flex items-center space-x-2 mt-2">
                                  <Badge variant="outline" className="text-xs">
                                    {permission.resource}
                                  </Badge>
                                  <Badge variant="outline" className="text-xs">
                                    {permission.action}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleDetails(permission.id)}
                            >
                              <Info className="h-4 w-4" />
                            </Button>
                          </div>
                          
                          {/* Permission Details */}
                          {showDetails.has(permission.id) && (
                            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                  <label className="font-medium text-gray-500">Resource</label>
                                  <p className="text-gray-900 dark:text-white">{permission.resource}</p>
                                </div>
                                <div>
                                  <label className="font-medium text-gray-500">Action</label>
                                  <p className="text-gray-900 dark:text-white">{permission.action}</p>
                                </div>
                              </div>
                              {permission.conditions && Object.keys(permission.conditions).length > 0 && (
                                <div className="mt-3">
                                  <label className="font-medium text-gray-500">Conditions</label>
                                  <div className="mt-1 space-y-1">
                                    {Object.entries(permission.conditions).map(([key, value]) => (
                                      <div key={key} className="flex items-center space-x-2">
                                        <Badge variant="outline" className="text-xs">
                                          {key}: {String(value)}
                                        </Badge>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : (
        // Single category view
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              {React.createElement(getPermissionIcon(selectedCategory) as React.ComponentType<any>, { className: "h-5 w-5 mr-2" })}
              {selectedCategory.charAt(0).toUpperCase() + selectedCategory.slice(1)} Permissions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredPermissions?.filter(Boolean)?.map((permission: any) => {
                const status = getPermissionStatus(permission.id)
                const ActionIcon = getActionIcon(permission.action)

                return (
                  <div
                    key={permission.id}
                    className={`p-4 border rounded-lg transition-all ${
                      status.isDirectlyAssigned
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : status.isInherited
                        ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start space-x-3">
                      {!readOnly && (
                        <input
                          type="checkbox"
                          checked={selectedPermissions.has(permission.id)}
                          onChange={() => handlePermissionToggle(permission.id)}
                          className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      )}
                      <ActionIcon className="h-5 w-5 mt-0.5 text-gray-600" />
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <h4 className="font-medium text-gray-900 dark:text-white">
                            {permission.name}
                          </h4>
                          {status.isDirectlyAssigned && (
                            <Badge variant="default" className="text-xs">
                              Direct
                            </Badge>
                          )}
                          {status.isInherited && !status.isDirectlyAssigned && (
                            <Badge variant="secondary" className="text-xs">
                              Inherited
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          {permission.description}
                        </p>
                        <div className="flex items-center space-x-2 mt-2">
                          <Badge variant="outline" className="text-xs">
                            {permission.resource}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {permission.action}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Results */}
      {filteredPermissions.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <Search className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No permissions found
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Try adjusting your search criteria or category filter.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default PermissionMatrix
