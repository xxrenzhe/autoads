import React from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  Settings, 
  Plus, 
  RefreshCw, 
  Download,
  Upload,
  Trash2,
  Edit
} from 'lucide-react'

export const QuickActions: React.FC = () => {
  const actions = [
    { icon: Plus, label: 'New Task', color: 'blue' },
    { icon: RefreshCw, label: 'Refresh', color: 'green' },
    { icon: Download, label: 'Export', color: 'purple' },
    { icon: Upload, label: 'Import', color: 'yellow' },
    { icon: Edit, label: 'Edit', color: 'blue' },
    { icon: Trash2, label: 'Delete', color: 'red' },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Settings className="h-5 w-5 mr-2" />
          Quick Actions
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {actions.map((action, index) => (
            <Button
              key={index}
              variant="outline"
              className="flex flex-col items-center justify-center h-20 space-y-2"
            >
              <action.icon className="h-6 w-6" />
              <span className="text-xs">{action.label}</span>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export default QuickActions