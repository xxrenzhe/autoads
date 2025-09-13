'use client'
import React from 'react'
import { Badge } from '../ui/badge'
import { 
  User, 
  CreditCard, 
  AlertTriangle, 
  DollarSign,
  UserPlus,
  UserMinus,
  Settings,
  Mail,
  Shield,
  Activity
} from 'lucide-react'

export interface RecentActivity {
  id: string
  type: 'user_created' | 'user_updated' | 'user_deleted' | 'subscription_created' | 'subscription_cancelled' | 'payment_received' | 'payment_failed' | 'system_alert' | 'config_updated' | 'notification_sent'
  description: string
  user?: {
    id: string
    name: string
    email: string
  }
  metadata?: Record<string, any>
  timestamp: number
}

export interface RecentActivitiesPanelProps {
  activities: RecentActivity[]
  limit?: number
  showUser?: boolean
}

export function RecentActivitiesPanel({ 
  activities, 
  limit = 10, 
  showUser = true 
}: .*Props) {
  const getActivityIcon = (type: string) => {
    switch (type) => {
      case 'user_created':
        return UserPlus
      case 'user_updated':
        return User
      case 'user_deleted':
        return UserMinus
      case 'subscription_created':
      case 'subscription_cancelled':
        return CreditCard
      case 'payment_received':
      case 'payment_failed':
        return DollarSign
      case 'system_alert':
        return AlertTriangle
      case 'config_updated':
        return Settings
      case 'notification_sent':
        return Mail
      default:
        return Activity
    }
  }

  const getActivityColor = (type: string) => {
    switch (type) => {
      case 'user_created':
      case 'subscription_created':
      case 'payment_received':
        return 'success'
      case 'user_deleted':
      case 'subscription_cancelled':
      case 'payment_failed':
        return 'destructive'
      case 'system_alert':
        return 'warning'
      case 'config_updated':
      case 'notification_sent':
        return 'secondary'
      default:
        return 'outline'
    }
  }

  const formatTimestamp = (timestamp: number) => {
    const now = Date.now()
    const diff = now - timestamp
    const minutes = Math.floor(diff / (1000 * 60))
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    if (days < 7) return `${days}d ago`
    return new Date(timestamp).toLocaleDateString()
  }

  const formatActivityDescription = (activity: RecentActivity) => {
    let description = activity.description
    
    // Add user context if available
    if (activity.user && showUser) => {
      description = description.replace(
        /\{user\}/g, 
        activity.user.name || activity.user.email
      )
    }
    
    // Add metadata context
    if (activity.metadata) => {
      Object.entries(activity.metadata).forEach(([key, value]: any) => {
        description = description.replace(
          new RegExp(`\\{${key}\\}`, 'g'),
          String(value)
        )
      })
    }
    
    return description
  }

  const displayedActivities = activities.slice(0, limit)

  if (displayedActivities.length === 0) => {
    return (
      <div className="flex items-center justify-center h-32 text-gray-500 dark:text-gray-400">
        <div className="text-center">
          <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No recent activities</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {displayedActivities.map((activity: any) => {
        const Icon = getActivityIcon(activity.type)
        const color = getActivityColor(activity.type)
        
        return (
          <div key={activity.id} className="flex items-start space-x-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            <div className="flex-shrink-0">
              <div className={`p-2 rounded-full ${
                color === 'success' ? 'bg-green-100 text-green-600' :
                color === 'destructive' ? 'bg-red-100 text-red-600' :
                color === 'warning' ? 'bg-yellow-100 text-yellow-600' :
                'bg-gray-100 text-gray-600'
              }`}>
                <Icon className="h-4 w-4" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm text-gray-900 dark:text-white">
                    {formatActivityDescription(activity)}
                  </p>
                  {activity.user && showUser && (
                    <div className="flex items-center mt-1 space-x-2">
                      <Badge variant="outline" className="text-xs">
                        {activity.user.name || activity.user.email}
                      </Badge>
                    </div>
                  )}
                  {activity.metadata && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {Object.entries(activity.metadata).map(([key, value]: any) => (
                        <Badge key={key} variant="secondary" className="text-xs">
                          {key}: {String(value)}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                <div className="text-xs text-gray-500">
                  {formatTimestamp(activity.timestamp)}
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default RecentActivitiesPanel