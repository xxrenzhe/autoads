'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { useSession } from 'next-auth/react'

interface EnvReloadContextType {
  envUpdatePending: boolean
  acknowledgeEnvUpdate: () => void
  lastUpdateTime: Date | null
  checkForUpdates: () => Promise<void>
}

const EnvReloadContext = createContext<EnvReloadContextType>({
  envUpdatePending: false,
  acknowledgeEnvUpdate: () => {},
  lastUpdateTime: null,
  checkForUpdates: async () => {},
})

const UPDATE_CHECK_INTERVAL = 60000 // 60 seconds (increased to reduce frequency)
const LAST_UPDATE_KEY = 'env_last_update'

export function EnvReloadProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()
  const [envUpdatePending, setEnvUpdatePending] = useState(false)
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null)
  const [lastChecked, setLastChecked] = useState<Date | null>(null)

  // Check if user is admin
  const isAdmin = session?.user?.role === 'ADMIN' || session?.user?.role === 'SUPER_ADMIN'

  // Check for environment updates
  const checkForUpdates = async () => {
    // Only check for updates if user is admin
    if (!isAdmin) {
      return
    }

    try {
      const response = await fetch('/api/admin/env-vars')
      if (response.ok) {
        const data = await response.json()
        
        // Get the last update time from localStorage
        const storedLastUpdate = localStorage.getItem(LAST_UPDATE_KEY)
        const currentUpdateTime = new Date().toISOString()
        
        // If there's no stored time, store the current time
        if (!storedLastUpdate) {
          localStorage.setItem(LAST_UPDATE_KEY, currentUpdateTime)
          return
        }
        
        // Check if any environment variables have changed
        const storedVars = JSON.parse(localStorage.getItem('env_vars') || '{}')
        const currentVars = data.envVars
        
        const hasChanges = Object.keys(currentVars).some(key => {
          return storedVars[key] !== currentVars[key]
        })
        
        if (hasChanges) {
          setEnvUpdatePending(true)
          setLastUpdateTime(new Date())
          localStorage.setItem(LAST_UPDATE_KEY, currentUpdateTime)
          localStorage.setItem('env_vars', JSON.stringify(currentVars))
        }
        
        setLastChecked(new Date())
      }
    } catch (error) {
      console.error('Error checking for env updates:', error)
    }
  }

  useEffect(() => {
    // Only set up polling for admin users
    if (!isAdmin) {
      return
    }

    // Initial check
    checkForUpdates()
    
    // Set up periodic checks
    const interval = setInterval(checkForUpdates, UPDATE_CHECK_INTERVAL)
    
    // Listen for storage events (for cross-tab updates)
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === LAST_UPDATE_KEY) {
        const updateTime = event.newValue ? new Date(event.newValue) : null
        if (updateTime && (!lastUpdateTime || updateTime > lastUpdateTime)) {
          setEnvUpdatePending(true)
          setLastUpdateTime(updateTime)
        }
      }
    }
    
    window.addEventListener('storage', handleStorageChange)
    
    return () => {
      clearInterval(interval)
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [isAdmin])

  const acknowledgeEnvUpdate = () => {
    setEnvUpdatePending(false)
  }

  return (
    <EnvReloadContext.Provider value={{
      envUpdatePending,
      acknowledgeEnvUpdate,
      lastUpdateTime,
      checkForUpdates,
    }}>
      {children}
      {envUpdatePending && (
        <div className="fixed bottom-4 right-4 bg-blue-600 text-white px-4 py-3 rounded-lg shadow-lg z-50 flex items-center gap-3 animate-in slide-in-from-bottom-2">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <div>
            <p className="font-medium">环境变量已更新</p>
            <p className="text-sm opacity-90">
              {lastUpdateTime && `更新时间: ${lastUpdateTime.toLocaleTimeString('zh-CN')}`}
            </p>
            <p className="text-xs opacity-75 mt-1">某些功能可能需要刷新页面</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={((: any): any) => window.location.reload()}
              className="bg-white/20 hover:bg-white/30 px-3 py-1 rounded text-sm"
            >
              立即刷新
            </button>
            <button
              onClick={acknowledgeEnvUpdate}
              className="bg-white/10 hover:bg-white/20 px-3 py-1 rounded text-sm"
            >
              稍后提醒
            </button>
          </div>
        </div>
      )}
    </EnvReloadContext.Provider>
  )
}

export function useEnvReload() {
  return useContext(EnvReloadContext)
}