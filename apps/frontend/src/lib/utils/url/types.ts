// Export types for URL utilities
export interface QueryParamOptions {
  arrayFormat?: 'indices' | 'brackets' | 'repeat' | 'comma'
  skipNull?: boolean
  skipEmptyString?: boolean
  encode?: boolean
}

export interface QueryParamBuilder {
  add: (key: string, value: any) => QueryParamBuilder
  addAll: (params: Record<string, any>) => QueryParamBuilder
  build: () => string
}

export interface URLParamSchema {
  [key: string]: {
    type: 'string' | 'number' | 'boolean' | 'array'
    required?: boolean
    default?: any
  }
}

export interface TypeSafeURLParams<T extends Record<string, any>> {
  get: <K extends keyof T>(key: K) => T[K]
  getAll: <K extends keyof T>(key: K) => T[K][]
  has: <K extends keyof T>(key: K) => boolean
  toString: () => string
  toObject: () => Partial<T>
}