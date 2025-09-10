/**
 * Type Guards
 * 
 * Runtime type checking functions for safe type narrowing and validation.
 */

/**
 * Check if a value is a string
 * 
 * @param value - Value to check
 * @returns Type guard for string
 */
export function isString(value: any): value is string {
  return typeof value === 'string'
}

/**
 * Check if a value is a non-empty string
 * 
 * @param value - Value to check
 * @returns Type guard for non-empty string
 */
export function isNonEmptyString(value: any): value is string {
  return typeof value === 'string' && value.length > 0
}

/**
 * Check if a value is a number
 * 
 * @param value - Value to check
 * @returns Type guard for number
 */
export function isNumber(value: any): value is number {
  return typeof value === 'number' && !isNaN(value)
}

/**
 * Check if a value is a finite number
 * 
 * @param value - Value to check
 * @returns Type guard for finite number
 */
export function isFiniteNumber(value: any): value is number {
  return typeof value === 'number' && isFinite(value)
}

/**
 * Check if a value is a positive number
 * 
 * @param value - Value to check
 * @returns Type guard for positive number
 */
export function isPositiveNumber(value: any): value is number {
  return isNumber(value) && value > 0
}

/**
 * Check if a value is a boolean
 * 
 * @param value - Value to check
 * @returns Type guard for boolean
 */
export function isBoolean(value: any): value is boolean {
  return typeof value === 'boolean'
}

/**
 * Check if a value is an array
 * 
 * @param value - Value to check
 * @returns Type guard for array
 */
export function isArray<T = any>(value: any): value is T[] {
  return Array.isArray(value)
}

/**
 * Check if a value is a non-empty array
 * 
 * @param value - Value to check
 * @returns Type guard for non-empty array
 */
export function isNonEmptyArray<T = any>(value: any): value is T[] {
  return Array.isArray(value) && value.length > 0
}

/**
 * Check if a value is an object (not null, not array)
 * 
 * @param value - Value to check
 * @returns Type guard for object
 */
export function isObject(value: any): value is Record<string, any> {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}

/**
 * Check if a value is a plain object (not a class instance)
 * 
 * @param value - Value to check
 * @returns Type guard for plain object
 */
export function isPlainObject(value: any): value is Record<string, any> {
  return isObject(value) && value.constructor === Object
}

/**
 * Check if a value is a function
 * 
 * @param value - Value to check
 * @returns Type guard for function
 */
export function isFunction(value: any): value is Function {
  return typeof value === 'function'
}

/**
 * Check if a value is a Date object
 * 
 * @param value - Value to check
 * @returns Type guard for Date
 */
export function isDate(value: any): value is Date {
  return value instanceof Date && !isNaN(value.getTime())
}

/**
 * Check if a value is a valid Date string
 * 
 * @param value - Value to check
 * @returns Type guard for valid date string
 */
export function isDateString(value: any): value is string {
  if (!isString(value)) {
    return false
  }
  
  const date = new Date(value)
  return !isNaN(date.getTime())
}

/**
 * Check if a value is a Promise
 * 
 * @param value - Value to check
 * @returns Type guard for Promise
 */
export function isPromise<T = any>(value: any): value is Promise<T> {
  return value != null && typeof value.then === 'function'
}

/**
 * Check if a value is an Error object
 * 
 * @param value - Value to check
 * @returns Type guard for Error
 */
export function isError(value: any): value is Error {
  return value instanceof Error
}

/**
 * Check if a value has a specific property
 * 
 * @param value - Value to check
 * @param property - Property name to check for
 * @returns Type guard for object with property
 */
export function hasProperty<K extends string>(
  value: any,
  property: K
): value is Record<K, any> {
  return isObject(value) && property in value
}

/**
 * Check if a value has multiple properties
 * 
 * @param value - Value to check
 * @param properties - Array of property names to check for
 * @returns Type guard for object with all properties
 */
export function hasProperties<K extends string>(
  value: any,
  properties: K[]
): value is Record<K, any> {
  return isObject(value) && properties.every(prop => prop in value)
}

/**
 * Check if a value is a valid email string
 * 
 * @param value - Value to check
 * @returns Type guard for email string
 */
export function isEmail(value: any): value is string {
  if (!isString(value)) {
    return false
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(value)
}

/**
 * Check if a value is a valid URL string
 * 
 * @param value - Value to check
 * @returns Type guard for URL string
 */
export function isUrl(value: any): value is string {
  if (!isString(value)) {
    return false
  }
  
  try {
    new URL(value)
    return true
  } catch {
    return false
  }
}

/**
 * Check if a value is a valid UUID string
 * 
 * @param value - Value to check
 * @returns Type guard for UUID string
 */
export function isUuid(value: any): value is string {
  if (!isString(value)) {
    return false
  }
  
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidRegex.test(value)
}

/**
 * Create a type guard for a specific value
 * 
 * @param expectedValue - Expected value to check against
 * @returns Type guard function
 */
export function isValue<T>(expectedValue: T): (value: any) => value is T {
  return (value: any): value is T => value === expectedValue
}

/**
 * Create a type guard for one of multiple values
 * 
 * @param expectedValues - Array of expected values
 * @returns Type guard function
 */
export function isOneOf<T extends readonly any[]>(
  ...expectedValues: T
): (value: any) => value is T[number] {
  return (value: any): value is T[number] => expectedValues.includes(value)
}

/**
 * Create a type guard that checks if value matches a pattern
 * 
 * @param pattern - Regular expression pattern
 * @returns Type guard function for string matching pattern
 */
export function matchesPattern(pattern: RegExp): (value: any) => value is string {
  return (value: any): value is string => isString(value) && pattern.test(value)
}

/**
 * Create a type guard for objects with specific shape
 * 
 * @param shape - Object describing the expected shape with type guards
 * @returns Type guard function
 */
export function hasShape<T extends Record<string, any>>(
  shape: { [K in keyof T]: (value: any) => value is T[K] }
): (value: any) => value is T {
  return (value: any): value is T => {
    if (!isObject(value)) {
      return false
    }
    
    return Object.entries(shape).every(([key, guard]) => {
      return guard(value[key])
    })
  }
}

/**
 * Create a type guard for arrays with specific element type
 * 
 * @param elementGuard - Type guard for array elements
 * @returns Type guard function for array of specific type
 */
export function isArrayOf<T>(
  elementGuard: (value: any) => value is T
): (value: any) => value is T[] {
  return (value: any): value is T[] => {
    return isArray(value) && value.every(elementGuard)
  }
}

/**
 * Combine multiple type guards with AND logic
 * 
 * @param guards - Array of type guard functions
 * @returns Combined type guard function
 */
export function allOf<T>(
  ...guards: Array<(value: any) => value is T>
): (value: any) => value is T {
  return (value: any): value is T => {
    return guards.every(guard => guard(value))
  }
}

/**
 * Combine multiple type guards with OR logic
 * 
 * @param guards - Array of type guard functions
 * @returns Combined type guard function
 */
export function anyOf<T>(
  ...guards: Array<(value: any) => value is T>
): (value: any) => value is T {
  return (value: any): value is T => {
    return guards.some(guard => guard(value))
  }
}

/**
 * Create a negated type guard
 * 
 * @param guard - Type guard to negate
 * @returns Negated type guard function
 */
export function not<T>(
  guard: (value: any) => value is T
): (value: any) => value is Exclude<any, T> {
  return (value: any): value is Exclude<any, T> => {
    return !guard(value)
  }
}

/**
 * Runtime assertion that throws if type guard fails
 * 
 * @param value - Value to assert
 * @param guard - Type guard function
 * @param message - Error message if assertion fails
 * @returns Asserted value
 * @throws Error if type guard fails
 */
export function assertType<T>(
  value: any,
  guard: (value: any) => value is T,
  message?: string
): asserts value is T {
  if (!guard(value)) {
    throw new Error(message || `Type assertion failed`)
  }
}