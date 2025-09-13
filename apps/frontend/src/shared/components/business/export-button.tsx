import React from 'react'
import { Button } from '../ui/Button'

export interface ExportButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  data?: unknown[]
  filename?: string
}

export function ExportButton({ data, filename = 'export.json', onClick, children, ...props }: ExportButtonProps) {
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (onClick) onClick(e)
    try {
      if (data) {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        a.click()
        URL.revokeObjectURL(url)
      }
    } catch (err) {
      console.error('导出失败:', err)
    }
  }

  return (
    <Button type="button" onClick={handleClick} {...props}>
      {children ?? '导出'}
    </Button>
  )
}

