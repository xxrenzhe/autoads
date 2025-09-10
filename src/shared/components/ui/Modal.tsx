/**
 * Modal Component
 * Reusable modal dialog component
 */

import React from 'react'
import { cn } from '@/shared/lib/utils'

export interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  className?: string
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, className, size = 'md' }) => {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div
        className={cn(
          'relative z-10 w-full rounded-lg bg-background p-6 shadow-lg',
          {
            'max-w-sm': size === 'sm',
            'max-w-md': size === 'md',
            'max-w-lg': size === 'lg',
            'max-w-xl': size === 'xl',
            'max-w-full': size === 'full',
          },
          className
        )}
      >
        {title && (
          <div className="mb-4">
            <h2 className="text-lg font-semibold">{title}</h2>
          </div>
        )}
        {children}
      </div>
    </div>
  )
}

export { Modal }
