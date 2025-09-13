'use client'

import { ComponentType } from 'react'
import { AuthGuard } from './AuthGuard'

interface WithAuthOptions {
  requireAuth?: boolean
  requiredRole?: string
  redirectTo?: string
  fallback?: React.ReactNode
}

export function withAuth<P extends object>(
  Component: ComponentType<P>,
  options: WithAuthOptions = {}
) {
  const { requireAuth = true, requiredRole, fallback } = options

  const AuthenticatedComponent = (props: P) => {
    return (
      <AuthGuard 
        requireAuth={requireAuth} 
        requiredRole={requiredRole}
        fallback={fallback}
      >
        <Component {...props} />
      </AuthGuard>
    )
  }

  AuthenticatedComponent.displayName = `withAuth(${Component.displayName || Component.name})`

  return AuthenticatedComponent
}

export default withAuth