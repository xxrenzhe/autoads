// Minimal stub for @radix-ui/react-dialog to allow offline builds.
import React from 'react'

export const Root: React.FC<any> = ({ children, ...props }) => (
  <div {...props}>{children}</div>
)
export const Trigger: React.FC<any> = ({ children, ...props }) => (
  <button type="button" {...props}>{children}</button>
)
export const Portal: React.FC<any> = ({ children }) => <>{children}</>
export const Overlay: React.FC<any> = ({ children, ...props }) => (
  <div {...props}>{children}</div>
)
export const Content = React.forwardRef<HTMLDivElement, any>(({ children, ...props }, ref) => (
  <div ref={ref} {...props}>{children}</div>
))
export const Close: React.FC<any> = ({ children, ...props }) => (
  <button type="button" {...props}>{children}</button>
)
export const Title = React.forwardRef<HTMLHeadingElement, any>(({ children, ...props }, ref) => (
  <h2 ref={ref} {...props}>{children}</h2>
))
export const Description = React.forwardRef<HTMLParagraphElement, any>(({ children, ...props }, ref) => (
  <p ref={ref} {...props}>{children}</p>
))

// Backward compatible namespace-style default export support when using `* as DialogPrimitive`
const defaultExport = {
  Root,
  Trigger,
  Portal,
  Overlay,
  Content,
  Close,
  Title,
  Description,
}

export default defaultExport

