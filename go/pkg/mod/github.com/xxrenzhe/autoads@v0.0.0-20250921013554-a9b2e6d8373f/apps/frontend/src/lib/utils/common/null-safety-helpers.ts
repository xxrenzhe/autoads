/**
 * Null Safety Helpers
 * 
 * Provides utilities for handling nullable values and preventing
 * null/undefined related runtime errors.
 */

/**
 * Check if a value is null or undefined
 * 
 * @param value - Value to check
 * @returns True if value is null or undefined
 */
export function isNullish(value: any): value is null | undefined {
  return value == null
}

/**
 * Check if a value is not null or undefined
 * 
 * @param value - Value to check
 * @returns True if value is not null or undefined
 */
export function isNotNullish<T>(value: T | null | undefined): value is T {
  return value != null
}

/**
 * Get a non-null value or throw an error
 * 
 * @param value - Value to check
 * @param errorMessage - Error message if value is null/undefined
 * @returns Non-null value
 * @throws Error if value is null or undefined
 */
export function requireNonNull<T>(
  value: T | null | undefined,
  errorMessage: string = 'Value cannot be null or undefined'
): T {
  if (value == null) {
    throw new Error(errorMessage)
  }
  return value
}

/**
 * Get a non-null value or return a default
 * 
 * @param value - Value to check
 * @param defaultValue - Default value if original is null/undefined
 * @returns Non-null value or default
 */
export function nullishCoalesce<T>(
  value: T | null | undefined,
  defaultValue: T
): T {
  return value ?? defaultValue
}

/**
 * Chain multiple nullable operations safely
 * 
 * @param value - Initial value
 * @param operations - Array of operations to apply
 * @returns Result of chained operations or null if any step fails
 */
export function nullSafeChain<T, R>(
  value: T | null | undefined,
  ...operations: Array<(val: T) => R | null | undefined>
): R | null {
  if (value == null) {
    return null
  }

  let current: any = value
  
  for (const operation of operations) {
    if (current == null) {
      return null
    }
    current = operation(current)
  }

  return current
}

/**
 * Execute a function only if the value is not null/undefined
 * 
 * @param value - Value to check
 * @param fn - Function to execute if value is not null
 * @returns Result of function or undefined
 */
export function ifNotNull<T, R>(
  value: T | null | undefined,
  fn: (val: T) => R
): R | undefined {
  return value != null ? fn(value) : undefined
}

/**
 * Execute a function only if the value is null/undefined
 * 
 * @param value - Value to check
 * @param fn - Function to execute if value is null
 * @returns Result of function or the original value
 */
export function ifNull<T, R>(
  value: T | null | undefined,
  fn: () => R
): T | R {
  return value == null ? fn() : value
}

/**
 * Filter out null and undefined values from an array
 * 
 * @param array - Array to filter
 * @returns Array with non-null values
 */
export function filterNullish<T>(
  array: (T | null | undefined)[]
): T[] {
  return array.filter(isNotNullish)
}

/**
 * Map array values, filtering out null results
 * 
 * @param array - Array to map
 * @param mapper - Mapping function
 * @returns Array with mapped non-null values
 */
export function mapFilterNullish<T, R>(
  array: T[],
  mapper: (item: T, index: number) => R | null | undefined
): R[] {
  return array
    ?.filter(Boolean)?.map(mapper)
    .filter(isNotNullish)
}

/**
 * Find first non-null value in an array of values
 * 
 * @param values - Array of potentially null values
 * @returns First non-null value or undefined
 */
export function firstNonNull<T>(
  ...values: (T | null | undefined)[]
): T | undefined {
  return values.find(isNotNullish)
}

/**
 * Create a null-safe wrapper for a function
 * 
 * @param fn - Function to wrap
 * @param defaultValue - Default value if function throws or returns null
 * @returns Wrapped function that never throws and handles nulls
 */
export function nullSafeWrapper<TArgs extends any[], TReturn>(
  fn: (...args: TArgs) => TReturn,
  defaultValue: TReturn
): (...args: TArgs) => TReturn {
  return (...args: TArgs): TReturn => {
    try {
      const result = fn(...args)
      return result ?? defaultValue
    } catch (error) {
      console.warn('Null-safe wrapper caught error:', error)
      return defaultValue
    }
  }
}

/**
 * Safely access nested properties with null checking
 * 
 * @param obj - Object to access
 * @param accessor - Function that accesses the property
 * @param defaultValue - Default value if access fails
 * @returns Property value or default
 */
export function nullSafeAccess<T, R>(
  obj: T | null | undefined,
  accessor: (obj: T) => R | null | undefined,
  defaultValue?: R
): R | undefined {
  if (obj == null) {
    return defaultValue
  }

  try {
    const result = accessor(obj)
    return result ?? defaultValue
  } catch (error) {
    console.warn('Null-safe access failed:', error)
    return defaultValue
  }
}

/**
 * Create a null-safe version of an object with default values
 * 
 * @param obj - Potentially null object
 * @param defaults - Default values for properties
 * @returns Object with guaranteed non-null properties
 */
export function withDefaults<T extends Record<string, any>>(
  obj: Partial<T> | null | undefined,
  defaults: T
): T {
  if (obj == null) {
    return { ...defaults }
  }

  const result: T = JSON.parse(JSON.stringify(defaults))
  
  const keys = Object.keys(defaults) as Array<keyof T>
  for (const key of keys) {
    if (obj[key] != null) {
      result[key] = obj[key] as T[keyof T]
    }
  }

  return result
}

/**
 * Validate that an object has required non-null properties
 * 
 * @param obj - Object to validate
 * @param requiredKeys - Array of required property keys
 * @returns True if all required properties are non-null
 */
export function hasRequiredProperties<T extends Record<string, any>>(
  obj: T | null | undefined,
  requiredKeys: (keyof T)[]
): obj is T {
  if (obj == null) {
    return false
  }

  return requiredKeys.every(key => obj[key] != null)
}

/**
 * Create a type guard for non-null objects
 * 
 * @param obj - Object to check
 * @returns Type guard function
 */
export function isNonNullObject<T extends Record<string, any>>(
  obj: T | null | undefined
): obj is T {
  return obj != null && typeof obj === 'object'
}

/**
 * Safely merge objects, handling null values
 * 
 * @param target - Target object (can be null)
 * @param sources - Source objects to merge
 * @returns Merged object
 */
export function nullSafeMerge<T extends Record<string, any>>(
  target: T | null | undefined,
  ...sources: (Partial<T> | null | undefined)[]
): T {
  const result = (target ?? {}) as T
  
  sources.forEach((source: any) => {
    if (source != null) {
      Object.assign(result, source)
    }
  })

  return result
}

/**
 * Convert a potentially null value to an array
 * 
 * @param value - Value to convert
 * @returns Array containing the value, or empty array if null
 */
export function toArray<T>(value: T | T[] | null | undefined): T[] {
  if (value == null) {
    return []
  }
  
  return Array.isArray(value) ? value : [value]
}

/**
 * Safely get the length of an array or string
 * 
 * @param value - Array or string to get length of
 * @param defaultLength - Default length if value is null
 * @returns Length or default value
 */
export function safeLength(
  value: { length: number } | null | undefined,
  defaultLength: number = 0
): number {
  return value?.length ?? defaultLength
}

/**
 * Check if a value is empty (null, undefined, empty string, empty array, empty object)
 * 
 * @param value - Value to check
 * @returns True if value is considered empty
 */
export function isEmpty(value: any): boolean {
  if (value == null) {
    return true
  }

  if (typeof value === 'string' || Array.isArray(value)) {
    return value.length === 0
  }

  if (typeof value === 'object') {
    return Object.keys(value).length === 0
  }

  return false
}

/**
 * Check if a value is not empty
 * 
 * @param value - Value to check
 * @returns True if value is not empty
 */
export function isNotEmpty(value: any): boolean {
  return !isEmpty(value)
}