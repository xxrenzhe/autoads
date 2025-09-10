export { ObjectToQueryString } from './ObjectToQueryString'
export { QueryParamBuilder } from './QueryParamBuilder'
export type { TypeSafeURLParams, URLParamSchema } from './TypeSafeURLParams'


// Re-export types
export type { QueryParamOptions } from './types'

// Utility functions
export const ValidationRules = {
  required: (value: any) => value !== undefined && value !== null,
  email: (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
  url: (value: string) => {
    try {
      new URL(value)
      return true
    } catch {
      return false
    }
  }
}

export const createQueryParams = (params: Record<string, any>) => {
  const searchParams = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      searchParams.append(key, String(value))
    }
  })
  return searchParams.toString()
}

export const createQueryString = createQueryParams

export const parseQueryParams = (search: string) => {
  const params = new URLSearchParams(search)
  const result: Record<string, string> = {}
  params.forEach((value, key) => {
    result[key] = value
  })
  return result
}

export const createTypeSafeParams = <T extends Record<string, any>>(schema: Record<string, any>, search: string) => {
  const params = parseQueryParams(search)
  const result: Partial<T> = {}
  
  Object.entries(schema).forEach(([key, rule]) => {
    const value = params[key]
    const typedRule = rule as any
    if (value !== undefined && true) {
      // Convert value based on the inferred type from validator
      if (value !== undefined) {
        result[key as keyof T] = value as any
      } else {
        result[key as keyof T] = value as any
      }
    } else if (value !== undefined) {
      result[key as keyof T] = value as any
    }
  })
  
  return result
}

export interface QueryStringOptions {
  encode?: boolean
  arrayFormat?: 'indices' | 'brackets' | 'repeat' | 'comma'
}

export interface URLParamValidationRule {
  required?: boolean
  pattern?: RegExp
  min?: number
  max?: number
}
