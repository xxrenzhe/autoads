/**
 * useLocalStorage Hook
 */

import { useState, useEffect } from 'react'

export interface LocalStorageHookOptions {
  serializer?: {
    parse: (value: string) => any
    stringify: (value: any) => string
  }
}

export function useLocalStorage<T>(
  key: string,
  initialValue: T,
  options?: LocalStorageHookOptions
) {
  const [storedValue, setStoredValue] = useState<T>(initialValue)

  useEffect(() => {
    try {
      const item = window.localStorage.getItem(key)
      if (item) {
        setStoredValue(options?.serializer?.parse(item) ?? JSON.parse(item))
      }
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error)
    }
  }, [key, options])

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value
      setStoredValue(valueToStore)
      window.localStorage.setItem(
        key,
        options?.serializer?.stringify(valueToStore) ?? JSON.stringify(valueToStore)
      )
    } catch (error) {
      console.error(`Error setting localStorage key "${key}":`, error)
    }
  }

  return [storedValue, setValue] as const
}
