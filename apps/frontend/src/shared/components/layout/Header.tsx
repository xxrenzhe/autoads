import React from 'react'

export interface HeaderProps extends React.HTMLAttributes<HTMLElement> {
  title?: string
}

export function Header({ title, className = '', children, ...props }: HeaderProps) {
  return (
    <header className={`w-full border-b bg-white ${className}`} {...props}>
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold">{title}</h1>
        {children}
      </div>
    </header>
  )
}

