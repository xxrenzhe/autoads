// Minimal stubs for '@radix-ui/react-dropdown-menu'
import React from 'react'

export const Root: React.FC<any> = ({ children, ...props }) => <div {...props}>{children}</div>
export const Trigger: React.FC<any> = ({ children, ...props }) => <button type="button" {...props}>{children}</button>
export const Content = React.forwardRef<HTMLDivElement, any>(({ children, ...props }, ref) => (
  <div ref={ref} {...props}>{children}</div>
))
Content.displayName = 'DropdownMenuContent'

export const Item = React.forwardRef<HTMLDivElement, any>(({ children, ...props }, ref) => (
  <div ref={ref} role="menuitem" {...props}>{children}</div>
))
Item.displayName = 'DropdownMenuItem'

export const CheckboxItem = React.forwardRef<HTMLDivElement, any>(({ children, ...props }, ref) => (
  <div ref={ref} role="menuitemcheckbox" aria-checked={!!props.checked} {...props}>{children}</div>
))
CheckboxItem.displayName = 'DropdownMenuCheckboxItem'

export const RadioItem = React.forwardRef<HTMLDivElement, any>(({ children, ...props }, ref) => (
  <div ref={ref} role="menuitemradio" aria-checked={!!props.checked} {...props}>{children}</div>
))
RadioItem.displayName = 'DropdownMenuRadioItem'

export const ItemIndicator: React.FC<any> = ({ children, ...props }) => <span aria-hidden {...props}>{children}</span>
export const Label: React.FC<any> = ({ children, ...props }) => <div {...props}>{children}</div>
export const Separator: React.FC<any> = (props) => <hr {...props} />
export const Group: React.FC<any> = ({ children, ...props }) => <div {...props}>{children}</div>
export const Portal: React.FC<any> = ({ children }) => <>{children}</>

export const Sub: React.FC<any> = ({ children, ...props }) => <div {...props}>{children}</div>
export const SubTrigger = React.forwardRef<HTMLButtonElement, any>(({ children, ...props }, ref) => (
  <button ref={ref} type="button" {...props}>{children}</button>
))
SubTrigger.displayName = 'DropdownMenuSubTrigger'

export const SubContent = React.forwardRef<HTMLDivElement, any>(({ children, ...props }, ref) => (
  <div ref={ref} {...props}>{children}</div>
))
SubContent.displayName = 'DropdownMenuSubContent'

export const RadioGroup: React.FC<any> = ({ children, ...props }) => <div role="group" {...props}>{children}</div>

export default {
  Root,
  Trigger,
  Content,
  Item,
  Label,
  Separator,
  Group,
  Portal,
  Sub,
  SubTrigger,
  SubContent,
  CheckboxItem,
  RadioItem,
  ItemIndicator,
  RadioGroup,
}
