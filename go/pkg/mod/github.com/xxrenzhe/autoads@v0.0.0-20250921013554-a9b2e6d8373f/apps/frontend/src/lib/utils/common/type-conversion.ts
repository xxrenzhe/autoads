/**
 * Type Conversion Utilities
 * 
 * Safe type conversion functions with proper error handling and validation.
 */

import { isString, isNumber, isBoolean, isArray, isObject } from './type-guards'

/**
 * Conversion result with success/error information
 */
export interface ConversionResult<T> {
  success: boolean
  value?: T
  error?: string
}

/**
 * Conversion options
 */
export interface ConversionOptions {
  /** Whether to throw errors or return error results */
  throwOnError?: boolean
  /** Default value to use if conversion fails */
  defaultValue?: any
  /** Custom error message */
  errorMessage?: string
}

/**
 * Safely convert value to string
 * 
 * @param value - Value to convert
 * @param options - Conversion options
 * @returns Conversion result or string value
 */
export function convertToString(
  value: any,
  options: ConversionOptions = {}
): ConversionResult<string> | string {
  const { throwOnError = false, defaultValue = '', errorMessage } = options

  try {
    if (value == null) {
      return throwOnError ? defaultValue : { success: true, value: defaultValue }
    }

    if (isString(value)) {
      return throwOnError ? value : { success: true, value }
    }

    if (isNumber(value) || isBoolean(value)) {
      const stringValue = String(value)
      return throwOnError ? stringValue : { success: true, value: stringValue }
    }

    if (isObject(value) || isArray(value)) {
      const stringValue = JSON.stringify(value)
      return throwOnError ? stringValue : { success: true, value: stringValue }
    }

    const stringValue = String(value)
    return throwOnError ? stringValue : { success: true, value: stringValue }

  } catch (error) {
    const message = errorMessage || `Failed to convert to string: ${error}`
    
    if (throwOnError) {
      throw new Error(message)
    }
    
    return { success: false, error: message, value: defaultValue }
  }
}

/**
 * Safely convert value to number
 * 
 * @param value - Value to convert
 * @param options - Conversion options
 * @returns Conversion result or number value
 */
export function convertToNumber(
  value: any,
  options: ConversionOptions = {}
): ConversionResult<number> | number {
  const { throwOnError = false, defaultValue = 0, errorMessage } = options

  try {
    if (value == null) {
      return throwOnError ? defaultValue : { success: true, value: defaultValue }
    }

    if (isNumber(value)) {
      return throwOnError ? value : { success: true, value }
    }

    if (isString(value)) {
      // Handle empty strings
      if (value.trim() === '') {
        return throwOnError ? defaultValue : { success: true, value: defaultValue }
      }

      const numValue = Number(value)
      if (isNaN(numValue)) {
        throw new Error(`"${value}" is not a valid number`)
      }
      
      return throwOnError ? numValue : { success: true, value: numValue }
    }

    if (isBoolean(value)) {
      const numValue = value ? 1 : 0
      return throwOnError ? numValue : { success: true, value: numValue }
    }

    // Try to convert other types
    const numValue = Number(value)
    if (isNaN(numValue)) {
      throw new Error(`Cannot convert ${typeof value} to number`)
    }

    return throwOnError ? numValue : { success: true, value: numValue }

  } catch (error) {
    const message = errorMessage || `Failed to convert to number: ${error}`
    
    if (throwOnError) {
      throw new Error(message)
    }
    
    return { success: false, error: message, value: defaultValue }
  }
}

/**
 * Safely convert value to boolean
 * 
 * @param value - Value to convert
 * @param options - Conversion options
 * @returns Conversion result or boolean value
 */
export function convertToBoolean(
  value: any,
  options: ConversionOptions = {}
): ConversionResult<boolean> | boolean {
  const { throwOnError = false, defaultValue = false, errorMessage } = options

  try {
    if (value == null) {
      return throwOnError ? defaultValue : { success: true, value: defaultValue }
    }

    if (isBoolean(value)) {
      return throwOnError ? value : { success: true, value }
    }

    if (isString(value)) {
      const lower = value.toLowerCase().trim()
      
      // Truthy strings
      if (['true', '1', 'yes', 'on', 'enabled'].includes(lower)) {
        return throwOnError ? true : { success: true, value: true }
      }
      
      // Falsy strings
      if (['false', '0', 'no', 'off', 'disabled', ''].includes(lower)) {
        return throwOnError ? false : { success: true, value: false }
      }
      
      throw new Error(`"${value}" cannot be converted to boolean`)
    }

    if (isNumber(value)) {
      const boolValue = value !== 0
      return throwOnError ? boolValue : { success: true, value: boolValue }
    }

    // For other types, use JavaScript's truthiness
    const boolValue = Boolean(value)
    return throwOnError ? boolValue : { success: true, value: boolValue }

  } catch (error) {
    const message = errorMessage || `Failed to convert to boolean: ${error}`
    
    if (throwOnError) {
      throw new Error(message)
    }
    
    return { success: false, error: message, value: defaultValue }
  }
}

/**
 * Safely convert value to Date
 * 
 * @param value - Value to convert
 * @param options - Conversion options
 * @returns Conversion result or Date value
 */
export function convertToDate(
  value: any,
  options: ConversionOptions = {}
): ConversionResult<Date> | Date {
  const { throwOnError = false, defaultValue = new Date(), errorMessage } = options

  try {
    if (value == null) {
      return throwOnError ? defaultValue : { success: true, value: defaultValue }
    }

    if (value instanceof Date) {
      if (isNaN(value.getTime())) {
        throw new Error('Invalid Date object')
      }
      return throwOnError ? value : { success: true, value }
    }

    if (isString(value) || isNumber(value)) {
      const date = new Date(value)
      if (isNaN(date.getTime())) {
        throw new Error(`"${value}" is not a valid date`)
      }
      return throwOnError ? date : { success: true, value: date }
    }

    throw new Error(`Cannot convert ${typeof value} to Date`)

  } catch (error) {
    const message = errorMessage || `Failed to convert to Date: ${error}`
    
    if (throwOnError) {
      throw new Error(message)
    }
    
    return { success: false, error: message, value: defaultValue }
  }
}

/**
 * Safely convert value to array
 * 
 * @param value - Value to convert
 * @param options - Conversion options
 * @returns Conversion result or array value
 */
export function convertToArray<T = any>(
  value: any,
  options: ConversionOptions = {}
): ConversionResult<T[]> | T[] {
  const { throwOnError = false, defaultValue = [], errorMessage } = options

  try {
    if (value == null) {
      return throwOnError ? defaultValue : { success: true, value: defaultValue }
    }

    if (isArray(value)) {
      return throwOnError ? value : { success: true, value }
    }

    if (isString(value)) {
      // Try to parse as JSON array
      if (value.trim().startsWith('[')) {
        try {
          const parsed = JSON.parse(value)
          if (isArray(parsed)) {
            return throwOnError ? parsed : { success: true, value: parsed }
          }
        } catch {
          // Fall through to single-item array
        }
      }
      
      // Split by comma if it contains commas
      if (value.includes(',')) {
        const arrayValue = value.split(',')?.filter(Boolean)?.map((item: any) => item.trim()) as unknown as T[]
        return throwOnError ? arrayValue : { success: true, value: arrayValue }
      }
      
      // Single item array
      const arrayValue = [value] as unknown as T[]
      return throwOnError ? arrayValue : { success: true, value: arrayValue }
    }

    // Convert single value to array
    const arrayValue = [value]
    return throwOnError ? arrayValue : { success: true, value: arrayValue }

  } catch (error) {
    const message = errorMessage || `Failed to convert to array: ${error}`
    
    if (throwOnError) {
      throw new Error(message)
    }
    
    return { success: false, error: message, value: defaultValue }
  }
}

/**
 * Safely convert value to object
 * 
 * @param value - Value to convert
 * @param options - Conversion options
 * @returns Conversion result or object value
 */
export function convertToObject<T extends Record<string, any> = Record<string, any>>(
  value: any,
  options: ConversionOptions = {}
): ConversionResult<T> | T {
  const { throwOnError = false, defaultValue = {}, errorMessage } = options

  try {
    if (value == null) {
      return throwOnError ? defaultValue : { success: true, value: defaultValue }
    }

    if (isObject(value)) {
      return throwOnError ? value as T : { success: true, value: value as T }
    }

    if (isString(value)) {
      // Try to parse as JSON
      if (value.trim().startsWith('{')) {
        try {
          const parsed = JSON.parse(value)
          if (isObject(parsed)) {
            return throwOnError ? parsed as T : { success: true, value: parsed as T }
          }
        } catch {
          throw new Error(`Invalid JSON object: ${value}`)
        }
      }
      
      throw new Error(`String "${value}" cannot be converted to object`)
    }

    throw new Error(`Cannot convert ${typeof value} to object`)

  } catch (error) {
    const message = errorMessage || `Failed to convert to object: ${error}`
    
    if (throwOnError) {
      throw new Error(message)
    }
    
    return { success: false, error: message, value: defaultValue }
  }
}

/**
 * Generic type converter with automatic type detection
 * 
 * @param value - Value to convert
 * @param targetType - Target type to convert to
 * @param options - Conversion options
 * @returns Converted value
 */
export function convertTo<T>(
  value: any,
  targetType: 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object',
  options: ConversionOptions = {}
): ConversionResult<T> | T {
  switch (targetType) {
    case 'string':
      return convertToString(value, options) as ConversionResult<T> | T
    case 'number':
      return convertToNumber(value, options) as ConversionResult<T> | T
    case 'boolean':
      return convertToBoolean(value, options) as ConversionResult<T> | T
    case 'date':
      return convertToDate(value, options) as ConversionResult<T> | T
    case 'array':
      return convertToArray(value, options) as ConversionResult<T> | T
    case 'object':
      return convertToObject(value, options) as ConversionResult<T> | T
    default:
      const message = `Unknown target type: ${targetType}`
      if (options.throwOnError) {
        throw new Error(message)
      }
      return { success: false, error: message } as ConversionResult<T>
  }
}

/**
 * Batch convert multiple values
 * 
 * @param values - Object with values to convert
 * @param schema - Conversion schema
 * @param options - Global conversion options
 * @returns Object with converted values
 */
export function batchConvert<T extends Record<string, any>>(
  values: Record<string, any>,
  schema: {
    [K in keyof T]: {
      type: 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object'
      required?: boolean
      defaultValue?: T[K]
    }
  },
  options: ConversionOptions = {}
): { success: boolean; values: Partial<T>; errors: Record<string, string> } {
  const result: Partial<T> = {}
  const errors: Record<string, string> = {}
  let success = true

  Object.entries(schema).forEach(([key, config]: any) => {
    const value = values[key]
    
    // Check required fields
    if (config.required && value == null) {
      errors[key] = `Required field ${key} is missing`
      success = false
      return
    }

    // Convert value
    const conversionResult = convertTo(
      value,
      config.type,
      {
        ...options,
        throwOnError: false,
        defaultValue: config.defaultValue
      }
    ) as ConversionResult<T[keyof T]>

    if (conversionResult.success) {
      result[key as keyof T] = conversionResult.value
    } else {
      errors[key] = conversionResult.error || `Conversion failed for ${key}`
      success = false
    }
  })

  return { success, values: result, errors }
}