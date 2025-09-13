import React from 'react'

export interface SidebarProps extends React.HTMLAttributes<HTMLElement> {}

export function Sidebar({ className = '', ...props }: SidebarProps) {
  return (
    <aside className={`w-64 border-r bg-gray-50 ${className}`} {...props} />
  )
}

