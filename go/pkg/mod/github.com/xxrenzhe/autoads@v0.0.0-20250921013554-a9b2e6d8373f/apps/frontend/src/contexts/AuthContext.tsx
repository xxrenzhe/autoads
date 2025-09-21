'use client'

import React, { createContext, useContext, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { LoginModal } from '@/components/auth/LoginModal'
import UserCenterModal from '@/components/auth/UserCenterModal'

interface AuthContextType {
  // Login modal
  showLoginModal: boolean
  openLoginModal: (featureName?: string, callbackUrl?: string) => void
  closeLoginModal: () => void
  
  // User center modal
  showUserCenterModal: boolean
  openUserCenterModal: () => void
  closeUserCenterModal: () => void
  
  // Auth state
  isAuthenticated: boolean
  user: any
  requireAuth: (featureName?: string) => boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const session = useSession()
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [showUserCenterModal, setShowUserCenterModal] = useState(false)
  const [loginFeatureName, setLoginFeatureName] = useState<string>()
  const [loginCallbackUrl, setLoginCallbackUrl] = useState<string>()

  const isAuthenticated = !!session.data
  const user = session.data?.user
  const status = session.status

  const openLoginModal = useCallback((featureName?: string, callbackUrl?: string) => {
    setLoginFeatureName(featureName)
    setLoginCallbackUrl(callbackUrl)
    setShowLoginModal(true)
  }, [])

  const closeLoginModal = useCallback(() => {
    setShowLoginModal(false)
    setLoginFeatureName(undefined)
    setLoginCallbackUrl(undefined)
  }, [])

  const openUserCenterModal = useCallback(() => {
    setShowUserCenterModal(true)
  }, [])

  const closeUserCenterModal = useCallback(() => {
    setShowUserCenterModal(false)
  }, [])

  const requireAuth = useCallback((featureName?: string): boolean => {
    if (isAuthenticated) {
      return true
    }
    
    openLoginModal(featureName)
    return false
  }, [isAuthenticated, openLoginModal])

  // Close login modal when user becomes authenticated
  React.useEffect(() => {
    if (status === 'authenticated' && showLoginModal) {
      closeLoginModal()
    }
  }, [status, showLoginModal, closeLoginModal])

  // Handle OAuth user subscription creation and invitation code
  React.useEffect(() => {
    const handleOAuthUserSetup = async () => {
      if (status === 'authenticated' && user?.id) {
        // Check if this is a new OAuth user that needs subscription
        // For new users: check sessionStorage flag
        const isNewOAuthUser = sessionStorage.getItem('newOAuthUser') === 'true'
        const pendingCode = localStorage.getItem('pendingInvitationCode')
        
        // Only create subscription for new OAuth users
        if (isNewOAuthUser) {
          try {
            // Create subscription for the new OAuth user
            const response = await fetch('/api/auth/oauth-subscription', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ 
                isNewUser: true,
                invitationCode: pendingCode 
              })
            })
            
            if (response.ok) {
              const result = await response.json()
              console.log('OAuth subscription created:', result.message)
              
              // Clear the flag
              sessionStorage.removeItem('newOAuthUser')
              
              // If invitation was applied successfully, clear the code
              if (pendingCode && result.success) {
                localStorage.removeItem('pendingInvitationCode')
              }
            } else {
              console.error('Failed to create OAuth subscription')
            }
          } catch (error) {
            console.error('Error creating OAuth subscription:', error)
          }
        } else {
          // For existing users, clear any pending invitation code silently
          if (pendingCode) {
            console.log('Existing user logged in, clearing pending invitation code')
            localStorage.removeItem('pendingInvitationCode')
          }
          
          // Clear sessionStorage flag if it exists
          sessionStorage.removeItem('newOAuthUser')
        }
      }
    }

    handleOAuthUserSetup()
  }, [status, user])

  const value: AuthContextType = {
    showLoginModal,
    openLoginModal,
    closeLoginModal,
    showUserCenterModal,
    openUserCenterModal,
    closeUserCenterModal,
    isAuthenticated,
    user,
    requireAuth,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
      
      <LoginModal
        isOpen={showLoginModal}
        onClose={closeLoginModal}
        feature={loginFeatureName}
        redirectUrl={loginCallbackUrl}
      />
      
      {isAuthenticated && (
        <UserCenterModal
          isOpen={showUserCenterModal}
          onClose={closeUserCenterModal}
          user={user}
        />
      )}
    </AuthContext.Provider>
  )
}

export function useAuthContext() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider')
  }
  return context
}

// Custom hook for requiring authentication
export function useRequireAuth() {
  const { requireAuth, isAuthenticated } = useAuthContext()
  
  const requireAuthForAction = useCallback((featureName?: string) => {
    return requireAuth(featureName)
  }, [requireAuth])
  
  return {
    requireAuth: requireAuthForAction,
    isAuthenticated,
  }
}