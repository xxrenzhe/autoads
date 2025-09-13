import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Activity,
  User,
  Settings
} from 'lucide-react'

export interface ActivityItem {
  id: string
  type: 'task' | 'system' | 'user' | 'error'
  title: string
  description: string
  timestamp: string
  status: 'completed' | 'pending' | 'failed' | 'warning'
}

export interface RecentActivityProps {
  activities: ActivityItem[]
}

export const RecentActivity: React.FC<RecentActivityProps> = ({ activities }) => {
  const displayActivities = activities || [
    {
      id: '1',
      type: 'task',
      title: 'Batch processing completed',
      description: 'Processed 150 URLs successfully',
      timestamp: '2 minutes ago',
      status: 'completed'
    },
    {
      id: '2',
      type: 'system',
      title: 'System update',
      description: 'New features deployed',
      timestamp: '1 hour ago',
      status: 'completed'
    },
    {
      id: '3',
      type: 'user',
      title: 'Profile updated',
      description: 'Changed notification preferences',
      timestamp: '3 hours ago',
      status: 'completed'
    },
    {
      id: '4',
      type: 'error',
      title: 'API rate limit',
      description: 'Approaching rate limit for SimilarWeb',
      timestamp: '5 hours ago',
      status: 'warning'
    }
  ]

  const getStatusIcon = (status: ActivityItem['status']) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'failed': return <XCircle className="h-4 w-4 text-red-500" />
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-500" />
      default: return <Clock className="h-4 w-4 text-blue-500" />
    }
  }

  const getTypeIcon = (type: ActivityItem['type']) => {
    switch (type) {
      case 'task': return <Activity className="h-4 w-4" />
      case 'system': return <Settings className="h-4 w-4" />
      case 'user': return <User className="h-4 w-4" />
      default: return <Clock className="h-4 w-4" />
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {displayActivities.map((activity: any) => (
            <div key={activity.id} className="flex items-start space-x-3">
              <div className="flex-shrink-0 mt-0.5">
                {getTypeIcon(activity.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {activity.title}
                  </p>
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(activity.status)}
                    <Badge variant={activity.status === 'warning' ? 'warning' : 
                                   activity.status === 'completed' ? 'success' : 
                                   activity.status === 'failed' ? 'destructive' : 'secondary'}>
                      {activity.status}
                    </Badge>
                  </div>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {activity.description}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  {activity.timestamp}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export default RecentActivity