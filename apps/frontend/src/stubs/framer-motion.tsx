// Minimal stub for 'framer-motion'
import React from 'react'

const component = (Tag: any) => {
  const Comp = (props: any) => <Tag {...props} />
  Comp.displayName = typeof Tag === 'string' ? `motion.${Tag}` : 'motion.Component'
  return Comp
}

export const motion: any = new Proxy({}, {
  get: (_target, prop: string) => component(prop)
})

export const AnimatePresence: React.FC<any> = ({ children }) => <>{children}</>
AnimatePresence.displayName = 'AnimatePresence'

export default { motion, AnimatePresence }
