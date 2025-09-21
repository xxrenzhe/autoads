// Minimal stubs for '@radix-ui/react-avatar'
import React from 'react'
export const Root: React.FC<any> = ({ children, ...props }) => <div {...props}>{children}</div>
export const Image: React.FC<any> = (props) => <img alt="" {...props} />
export const Fallback: React.FC<any> = ({ children, ...props }) => <span {...props}>{children}</span>
export default { Root, Image, Fallback }

