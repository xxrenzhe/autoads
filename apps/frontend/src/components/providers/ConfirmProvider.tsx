'use client'
import React, { createContext, useContext, useState, ReactNode } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'

type ConfirmOptions = {
  title?: string
  description?: string
  confirmText?: string
  cancelText?: string
}

type ConfirmContextValue = (options: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<ConfirmContextValue | null>(null)

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [resolver, setResolver] = useState<(v: boolean) => void>(() => () => {})
  const [opts, setOpts] = useState<ConfirmOptions>({})

  const confirm: ConfirmContextValue = (options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setOpts(options)
      setResolver(() => resolve)
      setOpen(true)
    })
  }

  const onClose = () => {
    setOpen(false)
    resolver(false)
  }

  const onConfirm = () => {
    setOpen(false)
    resolver(true)
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{opts.title || '请确认操作'}</DialogTitle>
            {opts.description && (
              <DialogDescription>{opts.description}</DialogDescription>
            )}
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <button className="px-4 py-2 rounded border" onClick={onClose}>
              {opts.cancelText || '取消'}
            </button>
            <button className="px-4 py-2 rounded bg-red-600 text-white" onClick={onConfirm}>
              {opts.confirmText || '确认'}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </ConfirmContext.Provider>
  )
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider')
  return ctx
}

