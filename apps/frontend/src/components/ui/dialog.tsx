"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

type OpenChangeHandler = (open: boolean) => void

type DialogContextValue = {
  open: boolean
  setOpen: (open: boolean) => void
}

const DialogContext = React.createContext<DialogContextValue | null>(null)

function useDialogContext() {
  const ctx = React.useContext(DialogContext)
  if (!ctx) {
    throw new Error("Dialog components must be used within <Dialog>")
  }
  return ctx
}

type DialogProps = React.PropsWithChildren<{
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: OpenChangeHandler
}>

const Dialog: React.FC<DialogProps> = ({ open, defaultOpen, onOpenChange, children }) => {
  const [internalOpen, setInternalOpen] = React.useState(!!defaultOpen)
  const isControlled = typeof open === 'boolean'
  const currOpen = isControlled ? !!open : internalOpen
  const setOpen = (v: boolean) => {
    if (!isControlled) setInternalOpen(v)
    onOpenChange?.(v)
  }
  return (
    <DialogContext.Provider value={{ open: currOpen, setOpen }}>
      {children}
    </DialogContext.Provider>
  )
}

const DialogTrigger: React.FC<React.PropsWithChildren<{ asChild?: boolean }>> = ({ children }) => {
  const { setOpen } = useDialogContext()
  const child = React.Children.only(children) as React.ReactElement
  return React.cloneElement(child, {
    onClick: (...args: any[]) => {
      child.props?.onClick?.(...args)
      setOpen(true)
    }
  })
}

const DialogPortal: React.FC<React.PropsWithChildren<{}>> = ({ children }) => {
  if (typeof document === 'undefined') return <>{children}</>
  return createPortal(children as any, document.body)
}

const DialogOverlay = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => {
  const { open } = useDialogContext()
  if (!open) return null
  return (
    <div
      ref={ref}
      className={cn(
        "fixed inset-0 z-50 bg-background/80 backdrop-blur-sm",
        className,
      )}
      {...props}
    />
  )
})
DialogOverlay.displayName = "DialogOverlay"

const DialogContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, children, ...props }, ref) => {
  const { open } = useDialogContext()
  if (!open) return null
  return (
    <DialogPortal>
      <DialogOverlay />
      <div
        ref={ref}
        className={cn(
          "fixed left-1/2 top-1/2 z-50 grid w-full max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 border bg-background p-6 shadow-lg sm:rounded-lg",
          className,
        )}
        {...props}
      >
        {children}
        <DialogClose className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogClose>
      </div>
    </DialogPortal>
  )
})
DialogContent.displayName = "DialogContent"

const DialogClose: React.FC<React.PropsWithChildren<{ asChild?: boolean } & React.HTMLAttributes<HTMLButtonElement>>> = ({ asChild, children, className, ...props }) => {
  const { setOpen } = useDialogContext()
  if (asChild && React.isValidElement(children)) {
    const child = React.Children.only(children) as React.ReactElement<any>
    return React.cloneElement(child, {
      onClick: (...args: any[]) => {
        child.props?.onClick?.(...args)
        ;(props.onClick as any)?.(...args)
        setOpen(false)
      }
    })
  }
  return (
    <button
      type="button"
      className={className}
      onClick={(e) => { props.onClick?.(e as any); setOpen(false) }}
      {...props as any}
    >
      {children}
    </button>
  )
}

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)} {...props} />
)
DialogHeader.displayName = "DialogHeader"

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)} {...props} />
)
DialogFooter.displayName = "DialogFooter"

const DialogTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(({ className, ...props }, ref) => (
  <h2 ref={ref} className={cn("text-lg font-semibold leading-none tracking-tight", className)} {...props} />
))
DialogTitle.displayName = "DialogTitle"

const DialogDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
))
DialogDescription.displayName = "DialogDescription"

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
