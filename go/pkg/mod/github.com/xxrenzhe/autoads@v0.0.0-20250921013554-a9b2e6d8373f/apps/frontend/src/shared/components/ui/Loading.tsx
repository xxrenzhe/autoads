/**
 * Loading Component
 * Reusable loading spinner component
 */

import React from 'react'
import { cn } from '@/shared/lib/utils'

export interface LoadingProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const Loading: React.FC<LoadingProps> = ({ size = 'md', className }) => {
  return (
    <div
      className={cn(
        'animate-spin rounded-full border-2 border-current border-t-transparent',
        {
          'h-4 w-4': size === 'sm',
          'h-6 w-6': size === 'md',
          'h-8 w-8': size === 'lg',
        },
        className
      )}
    />
  )
}

export { Loading }
