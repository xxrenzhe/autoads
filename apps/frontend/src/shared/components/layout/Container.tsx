import React from 'react'

export interface ContainerProps extends React.HTMLAttributes<HTMLDivElement> {}

export function Container({ className = '', ...props }: ContainerProps) {
  return <div className={`container mx-auto px-4 ${className}`} {...props} />
}

