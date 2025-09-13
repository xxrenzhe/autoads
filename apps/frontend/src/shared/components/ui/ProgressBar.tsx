'use client'
import React from 'react'
import { cn } from '@/lib/utils'

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number
  max?: number
  className?: string
  indicatorClassName?: string
}

export function Progress({ 
  value, 
  max = 100, 
  className, 
  indicatorClassName,
  ...props 
}: .*Props) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100)

  return (
    <div
      className={cn(
        'relative h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800',
        className
      )}
      {...props}
    >
      <div
        className={cn(
          'h-full w-full flex-1 bg-blue-600 transition-all duration-300 ease-in-out',
          indicatorClassName
        )}
        style={{ transform: `translateX(-${100 - percentage}%)` }}
      />
    </div>
  )
}

// Alias for backward compatibility
export const ProgressBar = Progress
export type ProgressBarProps = ProgressProps

export default Progress