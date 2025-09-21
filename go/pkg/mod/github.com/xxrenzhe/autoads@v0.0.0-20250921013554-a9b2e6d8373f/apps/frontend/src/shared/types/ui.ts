/**
 * UI Types
 * Types for UI components and styling
 */

export interface ComponentProps {
  className?: string
  children?: React.ReactNode
}

export interface StyleProps {
  variant?: string
  size?: string
}

export interface ThemeProps {
  theme?: 'light' | 'dark' | 'system'
}
