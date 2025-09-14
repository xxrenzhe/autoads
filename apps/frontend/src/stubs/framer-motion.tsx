// Minimal stub for 'framer-motion'
import React from 'react'
const component = (Tag: any) => (props: any) => <Tag {...props} />
export const motion: any = new Proxy({}, {
  get: (_target, prop: string) => component(prop)
})
export const AnimatePresence: React.FC<any> = ({ children }) => <>{children}</>
export default { motion, AnimatePresence }

