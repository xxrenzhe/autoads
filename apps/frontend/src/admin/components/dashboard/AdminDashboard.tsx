import React from 'react'

export interface AdminDashboardProps {
  widgets?: DashboardWidget[]
  onWidgetClick?: (widgetId: string) => void
}

export interface DashboardWidget {
  id: string
  title: string
  description: string
  icon: React.ReactNode
  status: 'active' | 'inactive' | 'warning'
  onClick?: () => void
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  widgets = [],
  onWidgetClick
}) => {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Admin Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {widgets.map((widget: any) => (
          <div
            key={widget.id}
            className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 cursor-pointer hover:shadow-lg transition-shadow"
            onClick={((: any): any) => onWidgetClick?.(widget.id)}
          >
            <div className="flex items-center mb-4">
              <div className="mr-3">{widget.icon}</div>
              <h3 className="text-lg font-semibold">{widget.title}</h3>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-4">{widget.description}</p>
            <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              widget.status === 'active' ? 'bg-green-100 text-green-800' :
              widget.status === 'warning' ? 'bg-yellow-100 text-yellow-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {widget.status}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default AdminDashboard