import React from 'react'

export interface QuickActionsPanelProps {
  actions: QuickAction[]
  onActionClick?: (actionId: string) => void
}

export interface QuickAction {
  id: string
  title: string
  description: string
  icon: React.ReactNode
  color: 'blue' | 'green' | 'yellow' | 'red' | 'purple'
}

export const QuickActionsPanel: React.FC<QuickActionsPanelProps> = ({
  actions,
  onActionClick
}) => {
  const colorClasses = {
    blue: 'bg-blue-500 hover:bg-blue-600',
    green: 'bg-green-500 hover:bg-green-600',
    yellow: 'bg-yellow-500 hover:bg-yellow-600',
    red: 'bg-red-500 hover:bg-red-600',
    purple: 'bg-purple-500 hover:bg-purple-600'
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Quick Actions
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {actions.map((action: any) => (
          <button
            key={action.id}
            className={`flex items-center space-x-3 p-3 rounded-lg text-white transition-colors ${colorClasses[action.color]}`}
            onClick={((: any): any) => onActionClick?.(action.id)}
          >
            <div className="flex-shrink-0">
              {action.icon}
            </div>
            <div className="text-left">
              <h4 className="font-medium">{action.title}</h4>
              <p className="text-sm opacity-90">{action.description}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

export default QuickActionsPanel