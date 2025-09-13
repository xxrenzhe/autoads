import React from 'react'

export interface FooterProps extends React.HTMLAttributes<HTMLElement> {}

export function Footer({ className = '', children, ...props }: FooterProps) {
  return (
    <footer className={`w-full border-t bg-white ${className}`} {...props}>
      <div className="container mx-auto px-4 py-4 text-sm text-gray-500">
        {children}
      </div>
    </footer>
  )
}

