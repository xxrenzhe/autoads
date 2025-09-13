import React from 'react'
import { Input } from '../ui/Input'

export interface SearchFilterProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onSearch?: (value: string) => void
}

export function SearchFilter({ onSearch, ...props }: SearchFilterProps) {
  return (
    <Input
      placeholder={props.placeholder ?? '搜索...'}
      onChange={(e) => onSearch?.(e.target.value)}
      {...props}
    />
  )
}

