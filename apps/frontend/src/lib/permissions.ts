/**
 * Frontend permission utilities
 */

export interface Permission {
  id: string
  name: string
  description?: string
  resource: string
  action: string
  category?: string
  conditions?: any
}

/**
 * Check if user has specific permission based on permissions array
 */
export function hasPermission(permissions: Permission[] | string[], requiredPermission: string): boolean {
  if (!permissions || permissions.length === 0) {
    return false
  }

  // Handle both Permission objects and permission strings
  return permissions.some(permission => {
    if (typeof permission === 'string') {
      return permission === requiredPermission
    }
    
    if (typeof permission === 'object' && permission.name) {
      return permission.name === requiredPermission
    }
    
    return false
  })
}

/**
 * Check if user has any of the specified permissions
 */
export function hasAnyPermission(permissions: Permission[] | string[], requiredPermissions: string[]): boolean {
  return requiredPermissions.some(requiredPermission => 
    hasPermission(permissions, requiredPermission)
  )
}

/**
 * Check if user has all of the specified permissions
 */
export function hasAllPermissions(permissions: Permission[] | string[], requiredPermissions: string[]): boolean {
  return requiredPermissions.every(requiredPermission => 
    hasPermission(permissions, requiredPermission)
  )
}

/**
 * Get all permissions for a specific resource
 */
export function getResourcePermissions(permissions: Permission[] | string[], resource: string): string[] {
  if (!permissions || permissions.length === 0) {
    return []
  }

  return permissions
    .filter(permission => {
      if (typeof permission === 'string') {
        return permission.startsWith(`${resource}:`)
      }
      
      if (typeof permission === 'object' && permission.name) {
        return permission.name.startsWith(`${resource}:`)
      }
      
      return false
    })
    .map(permission => {
      if (typeof permission === 'string') {
        return permission.split(':')[1] || ''
      }
      
      if (typeof permission === 'object' && permission.name) {
        return permission.name.split(':')[1] || ''
      }
      
      return ''
    })
    .filter(Boolean)
}

/**
 * Check if user has permission for a specific resource and action
 */
export function hasResourcePermission(permissions: Permission[] | string[], resource: string, action: string): boolean {
  const requiredPermission = `${resource}:${action}`
  return hasPermission(permissions, requiredPermission)
}

/**
 * Get available versions for a feature based on permissions
 */
export function getAvailableVersions(permissions: Permission[] | string[], feature: string): string[] {
  const versions = ['basic', 'silent', 'automated']
  
  return versions.filter(version => {
    const requiredPermission = `${feature}:${version}`
    return hasPermission(permissions, requiredPermission)
  })
}

/**
 * Get highest available version for a feature
 */
export function getHighestVersion(permissions: Permission[] | string[], feature: string): string | null {
  const availableVersions = getAvailableVersions(permissions, feature)
  
  if (availableVersions.includes('automated')) return 'automated'
  if (availableVersions.includes('silent')) return 'silent'
  if (availableVersions.includes('basic')) return 'basic'
  
  return null
}