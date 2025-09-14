// Minimal stubs for '@radix-ui/react-dropdown-menu'
import React from 'react'
export const Root: React.FC<any> = ({ children, ...props }) => <div {...props}>{children}</div>
export const Trigger: React.FC<any> = ({ children, ...props }) => <button type="button" {...props}>{children}</button>
export const Content: React.FC<any> = ({ children, ...props }) => <div {...props}>{children}</div>
export const Item: React.FC<any> = ({ children, ...props }) => <div role="menuitem" {...props}>{children}</div>
export const Label: React.FC<any> = ({ children, ...props }) => <div {...props}>{children}</div>
export const Separator: React.FC<any> = (props) => <hr {...props} />
export const Group: React.FC<any> = ({ children, ...props }) => <div {...props}>{children}</div>
export default { Root, Trigger, Content, Item, Label, Separator, Group }

