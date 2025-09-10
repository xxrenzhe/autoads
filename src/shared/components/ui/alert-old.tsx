/**
 * Alert Component
 * Reusable alert component
 */

import React from 'react'
import { cn } from '@/shared/lib/utils'

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'destructive' | 'warning' | 'success' | 'error'
}

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant = 'default', ...props }, ref) => (
    <div
      ref={ref}
      role="alert"
      className={cn(
        'relative w-full rounded-lg border p-4',
        {
          'bg-background text-foreground': variant === 'default',
          'border-destructive/50 text-destructive dark:border-destructive':
            variant === 'destructive',
          'border-red-500/50 text-red-600 dark:border-red-500': variant === 'error',
          'border-yellow-500/50 text-yellow-600 dark:border-yellow-500': variant === 'warning',
          'border-green-500/50 text-green-600 dark:border-green-500': variant === 'success',
        },
        className
      )}
      {...props}
    />
  )
)

Alert.displayName = 'Alert'

export { Alert }
