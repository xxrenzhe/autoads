import React from 'react'
import { Header } from './Header'
import { Sidebar } from './Sidebar'
import { Footer } from './Footer'

export interface LayoutProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string
  showSidebar?: boolean
}

export function Layout({ title, showSidebar = false, className = '', children, ...props }: LayoutProps) {
  return (
    <div className={`min-h-screen flex flex-col ${className}`} {...props}>
      <Header title={title} />
      <div className="flex flex-1">
        {showSidebar && <Sidebar />}
        <main className="flex-1">{children}</main>
      </div>
      <Footer />
    </div>
  )
}

