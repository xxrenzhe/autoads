'use client'
import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

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

export interface Permission {
  id: string
  name: string
  description: string
  category: string
  resource: string
  action: string
  conditions?: Record<string, any>
}

export interface RoleHierarchy {
  role: Role
  parent?: RoleHierarchy
  children: RoleHierarchy[]
  inheritedPermissions: string[]
  effectivePermissions: string[]
}

export function useRoleManagement() {
  const queryClient = useQueryClient()

  // Fetch all roles
  const {
    data: roles = [],
    isLoading,
    error,
    refetch: refetchRoles
  } = useQuery({
    queryKey: ['admin-roles'],
    queryFn: async (): Promise<Role[]> => {
      const response = await fetch('/api/admin/roles')
      if (!response.ok) {
        throw new Error('Failed to fetch roles')
      }
      return response.json()
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  // Fetch all permissions
  const {
    data: permissions = [],
    isLoading: isPermissionsLoading,
    error: permissionsError
  } = useQuery({
    queryKey: ['admin-permissions'],
    queryFn: async (): Promise<Permission[]> => {
      const response = await fetch('/api/admin/permissions')
      if (!response.ok) {
        throw new Error('Failed to fetch permissions')
      }
      return response.json()
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  })

  // Fetch role hierarchy
  const {
    data: roleHierarchy,
    isLoading: isHierarchyLoading,
    error: hierarchyError
  } = useQuery({
    queryKey: ['role-hierarchy'],
    queryFn: async (): Promise<RoleHierarchy[]> => {
      const response = await fetch('/api/admin/roles/hierarchy')
      if (!response.ok) {
        throw new Error('Failed to fetch role hierarchy')
      }
      return response.json()
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  // Create role mutation
  const createRoleMutation = useMutation({
    mutationFn: async (roleData: Partial<Role>) => {
      const response = await fetch('/api/admin/roles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(roleData),
      })
      if (!response.ok) {
        throw new Error('Failed to create role')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-roles'] })
      queryClient.invalidateQueries({ queryKey: ['role-hierarchy'] })
    },
  })

  // Update role mutation
  const updateRoleMutation = useMutation({
    mutationFn: async ({ roleId, roleData }: { roleId: string; roleData: Partial<Role> }) => {
      const response = await fetch(`/api/admin/roles/${roleId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(roleData),
      })
      if (!response.ok) {
        throw new Error('Failed to update role')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-roles'] })
      queryClient.invalidateQueries({ queryKey: ['role-hierarchy'] })
    },
  })

  // Delete role mutation
  const deleteRoleMutation = useMutation({
    mutationFn: async (roleId: string) => {
      const response = await fetch(`/api/admin/roles/${roleId}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        throw new Error('Failed to delete role')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-roles'] })
      queryClient.invalidateQueries({ queryKey: ['role-hierarchy'] })
    },
  })

  // Duplicate role mutation
  const duplicateRoleMutation = useMutation({
    mutationFn: async ({ roleId, newName }: { roleId: string; newName: string }) => {
      const response = await fetch(`/api/admin/roles/${roleId}/duplicate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: newName }),
      })
      if (!response.ok) {
        throw new Error('Failed to duplicate role')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-roles'] })
      queryClient.invalidateQueries({ queryKey: ['role-hierarchy'] })
    },
  })

  // Assign permissions mutation
  const assignPermissionsMutation = useMutation({
    mutationFn: async ({ roleId, permissions }: { roleId: string; permissions: string[] }) => {
      const response = await fetch(`/api/admin/roles/${roleId}/permissions`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ permissions }),
      })
      if (!response.ok) {
        throw new Error('Failed to assign permissions')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-roles'] })
      queryClient.invalidateQueries({ queryKey: ['role-hierarchy'] })
    },
  })

  // Set role parent mutation
  const setRoleParentMutation = useMutation({
    mutationFn: async ({ roleId, parentRoleId }: { roleId: string; parentRoleId?: string }) => {
      const response = await fetch(`/api/admin/roles/${roleId}/parent`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ parentRoleId }),
      })
      if (!response.ok) {
        throw new Error('Failed to set role parent')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-roles'] })
      queryClient.invalidateQueries({ queryKey: ['role-hierarchy'] })
    },
  })

  // Helper functions
  const getRoleById = useCallback((roleId: string): Role | undefined => {
    return roles.find((role: any) => role.id === roleId)
  }, [roles])

  const getPermissionById = useCallback((permissionId: string): Permission | undefined => {
    return permissions.find((permission: any) => permission.id === permissionId)
  }, [permissions])

  const getRolePermissions = useCallback((roleId: string): Permission[] => {
    const role = getRoleById(roleId)
    if (!role) return []
    
    return role.permissions
      ?.filter((id: any) => id)?.map((permissionId: any) => getPermissionById(permissionId))
      .filter(Boolean) as Permission[]
  }, [getRoleById, getPermissionById])

  const getEffectivePermissions = useCallback((roleId: string): Permission[] => {
    const hierarchy = roleHierarchy?.find((h: any) => h.role.id === roleId)
    if (!hierarchy) return getRolePermissions(roleId)
    
    return hierarchy.effectivePermissions
      ?.filter((id: any) => id)?.map((permissionId: any) => getPermissionById(permissionId))
      .filter(Boolean) as Permission[]
  }, [roleHierarchy, getRolePermissions, getPermissionById])

  const getInheritedPermissions = useCallback((roleId: string): Permission[] => {
    const hierarchy = roleHierarchy?.find((h: any) => h.role.id === roleId)
    if (!hierarchy) return []
    
    return hierarchy.inheritedPermissions
      ?.filter((id: any) => id)?.map((permissionId: any) => getPermissionById(permissionId))
      .filter(Boolean) as Permission[]
  }, [roleHierarchy, getPermissionById])

  const canDeleteRole = useCallback((roleId: string): boolean => {
    const role = getRoleById(roleId)
    if (!role) return false
    
    // Cannot delete system roles
    if (role.isSystem) return false
    
    // Cannot delete roles with users assigned
    if (role.userCount > 0) return false
    
    // Cannot delete roles with child roles
    if (role.children && role.children.length > 0) return false
    
    return true
  }, [getRoleById])

  const validateRoleHierarchy = useCallback((roleId: string, parentRoleId?: string): boolean => {
    if (!parentRoleId) return true
    
    // Cannot set self as parent
    if (roleId === parentRoleId) return false
    
    // Cannot create circular dependencies
    const checkCircular = (currentRoleId: string, targetParentId: string): boolean => {
      const currentRole = getRoleById(currentRoleId)
      if (!currentRole) return false
      
      if (currentRole.parentRole === targetParentId) return true
      if (currentRole.parentRole) {
        return checkCircular(currentRole.parentRole, targetParentId)
      }
      
      return false
    }
    
    return !checkCircular(parentRoleId, roleId)
  }, [getRoleById])

  const getPermissionsByCategory = useCallback((): Record<string, Permission[]> => {
    return permissions.reduce((acc, permission: any) => {
      if (!acc[permission.category]) {
        acc[permission.category] = []
      }
      acc[permission.category].push(permission)
      return acc
    }, {} as Record<string, Permission[]>)
  }, [permissions])

  const searchRoles = useCallback((query: string): Role[] => {
    if (!query.trim()) return roles
    
    const lowercaseQuery = query.toLowerCase()
    return roles.filter((role: any) =>
      role.name.toLowerCase().includes(lowercaseQuery) ||
      role.description.toLowerCase().includes(lowercaseQuery) ||
      role.permissions.some(permissionId => {
        const permission = getPermissionById(permissionId)
        return permission?.name.toLowerCase().includes(lowercaseQuery) ||
               permission?.description.toLowerCase().includes(lowercaseQuery)
      })
    )
  }, [roles, getPermissionById])

  const searchPermissions = useCallback((query: string): Permission[] => {
    if (!query.trim()) return permissions
    
    const lowercaseQuery = query.toLowerCase()
    return permissions.filter((permission: any) =>
      permission.name.toLowerCase().includes(lowercaseQuery) ||
      permission.description.toLowerCase().includes(lowercaseQuery) ||
      permission.category.toLowerCase().includes(lowercaseQuery) ||
      permission.resource.toLowerCase().includes(lowercaseQuery) ||
      permission.action.toLowerCase().includes(lowercaseQuery)
    )
  }, [permissions])

  // Action functions
  const createRole = useCallback(async (roleData: Partial<Role>) => {
    return createRoleMutation.mutateAsync(roleData)
  }, [createRoleMutation])

  const updateRole = useCallback(async (roleId: string, roleData: Partial<Role>) => {
    return updateRoleMutation.mutateAsync({ roleId, roleData })
  }, [updateRoleMutation])

  const deleteRole = useCallback(async (roleId: string) => {
    if (!canDeleteRole(roleId)) {
      throw new Error('Cannot delete this role')
    }
    return deleteRoleMutation.mutateAsync(roleId)
  }, [deleteRoleMutation, canDeleteRole])

  const duplicateRole = useCallback(async (roleId: string, newName: string) => {
    return duplicateRoleMutation.mutateAsync({ roleId, newName })
  }, [duplicateRoleMutation])

  const assignPermissions = useCallback(async (roleId: string, permissions: string[]) => {
    return assignPermissionsMutation.mutateAsync({ roleId, permissions })
  }, [assignPermissionsMutation])

  const setRoleParent = useCallback(async (roleId: string, parentRoleId?: string) => {
    if (!validateRoleHierarchy(roleId, parentRoleId)) {
      throw new Error('Invalid role hierarchy')
    }
    return setRoleParentMutation.mutateAsync({ roleId, parentRoleId })
  }, [setRoleParentMutation, validateRoleHierarchy])

  const refreshRoles = useCallback(() => {
    refetchRoles()
  }, [refetchRoles])

  return {
    // Data
    roles,
    permissions,
    roleHierarchy,
    
    // Loading states
    isLoading,
    isPermissionsLoading,
    isHierarchyLoading,
    isCreating: createRoleMutation.isPending,
    isUpdating: updateRoleMutation.isPending,
    isDeleting: deleteRoleMutation.isPending,
    isDuplicating: duplicateRoleMutation.isPending,
    isAssigningPermissions: assignPermissionsMutation.isPending,
    isSettingParent: setRoleParentMutation.isPending,
    
    // Errors
    error: error?.message || null,
    permissionsError: permissionsError?.message || null,
    hierarchyError: hierarchyError?.message || null,
    createError: createRoleMutation.error?.message || null,
    updateError: updateRoleMutation.error?.message || null,
    deleteError: deleteRoleMutation.error?.message || null,
    duplicateError: duplicateRoleMutation.error?.message || null,
    assignError: assignPermissionsMutation.error?.message || null,
    parentError: setRoleParentMutation.error?.message || null,
    
    // Actions
    createRole,
    updateRole,
    deleteRole,
    duplicateRole,
    assignPermissions,
    setRoleParent,
    refreshRoles,
    
    // Helpers
    getRoleById,
    getPermissionById,
    getRolePermissions,
    getEffectivePermissions,
    getInheritedPermissions,
    canDeleteRole,
    validateRoleHierarchy,
    getPermissionsByCategory,
    searchRoles,
    searchPermissions,
  }
}

export default useRoleManagement