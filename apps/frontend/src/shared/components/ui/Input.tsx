/**
 * Input Component
 * Reusable input component with variants and accessibility features
 */

import React from 'react'
import { cn } from '@/shared/lib/utils'

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  variant?: 'default' | 'error'
  size?: 'sm' | 'md' | 'lg'
  /** Error message to display and announce to screen readers */
  error?: string
  /** Helper text to provide additional context */
  helperText?: string
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, variant = 'default', size = 'md', type, error, helperText, ...props }, ref) => {
    const reactId = React.useId()
    const inputId = props.id || `input-${reactId}`
    const errorId = error ? `${inputId}-error` : undefined
    const helperTextId = helperText ? `${inputId}-helper` : undefined
    
    // Build aria-describedby from error, helper text, and existing describedby
    const ariaDescribedBy = [
      errorId,
      helperTextId,
      props['aria-describedby']
    ].filter(Boolean).join(' ') || undefined

    // Determine if input is invalid
    const isInvalid = Boolean(variant === 'error' || error || props['aria-invalid'] === 'true' || props['aria-invalid'] === true)

    return (
      <div className="w-full">
        <input
          {...props}
          id={inputId}
          type={type}
          aria-invalid={isInvalid}
          aria-describedby={ariaDescribedBy}
          className={cn(
            // Base styles
            'flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background',
            // File input styles
            'file:border-0 file:bg-transparent file:text-sm file:font-medium',
            // Placeholder styles
            'placeholder:text-muted-foreground',
            // Focus styles - enhanced for better visibility
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            // Disabled styles
            'disabled:cursor-not-allowed disabled:opacity-50',
            // High contrast mode support
            '@media (prefers-contrast: high) { border-width: 2px }',
            // Variant styles
            {
              'border-destructive focus-visible:ring-destructive': isInvalid,
            },
            // Size styles
            {
              'h-8 text-xs px-2 py-1': size === 'sm',
              'h-10': size === 'md',
              'h-12 text-base px-4 py-3': size === 'lg',
            },
            className
          )}
          ref={ref}
        />
        
        {/* Helper text */}
        {helperText && !error && (
          <div
            id={helperTextId}
            className="mt-1 text-xs text-muted-foreground"
            role="note"
          >
            {helperText}
          </div>
        )}
        
        {/* Error message */}
        {error && (
          <div
            id={errorId}
            className="mt-1 text-xs text-destructive"
            role="alert"
            aria-live="polite"
          >
            {error}
          </div>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'

export { Input }
