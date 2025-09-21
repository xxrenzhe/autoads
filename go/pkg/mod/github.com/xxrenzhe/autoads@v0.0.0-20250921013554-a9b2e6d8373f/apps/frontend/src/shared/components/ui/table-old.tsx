/**
 * Table Component
 * Reusable table component
 */

import React from 'react'
import { cn } from '@/shared/lib/utils'

export interface TableProps extends React.TableHTMLAttributes<HTMLTableElement> {}

const Table = React.forwardRef<HTMLTableElement, TableProps>(({ className, ...props }, ref) => (
  <div className="relative w-full overflow-auto">
    <table ref={ref} className={cn('w-full caption-bottom text-sm', className)} {...props} />
  </div>
))

Table.displayName = 'Table'

export { Table }
