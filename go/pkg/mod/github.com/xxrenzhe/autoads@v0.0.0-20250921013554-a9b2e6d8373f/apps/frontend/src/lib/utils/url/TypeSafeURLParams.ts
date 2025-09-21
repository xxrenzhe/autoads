/**
 * TypeSafeURLParams - Type-safe wrapper for URLSearchParams
 * 
 * This wrapper provides type-safe methods for working with URLSearchParams,
 * including validation, type conversion, and error handling.
 */

export interface URLParamValidationRule<T = any> {
  /** Type validator function */
  validator: (value: string) => value is string & { __type: T }
  /** Default value if validation fails */
  defaultValue?: T
  /** Whether the parameter is required */
  required?: boolean
  /** Custom error message */
  errorMessage?: string
}

export interface URLParamSchema {
  [key: string]: URLParamValidationRule
}

export class TypeSafeURLParams {
  private searchParams: URLSearchParams
  private schema?: URLParamSchema
  private errors: Map<string, string> = new Map()

  constructor(
    init?: string | URLSearchParams | Record<string, any>,
    schema?: URLParamSchema
  ) {
    if (typeof init === 'string') {
      this.searchParams = new URLSearchParams(init)
    } else if (init instanceof URLSearchParams) {
      this.searchParams = new URLSearchParams(init)
    } else if (init && typeof init === 'object') {
      this.searchParams = new URLSearchParams()
      Object.entries(init).forEach(([key, value]: any) => {
        if (value !== undefined && value !== null) {
          this.searchParams.set(key, String(value))
        }
      })
    } else {
      this.searchParams = new URLSearchParams()
    }

    this.schema = schema
  }

  /**
   * Get a parameter value with type safety
   * 
   * @param key - Parameter key
   * @param defaultValue - Default value if parameter doesn't exist
   * @returns Parameter value or default
   */
  get<T = string>(key: string, defaultValue?: T): T | string | undefined {
    const value = this.searchParams.get(key)
    
    if (value === null) {
      return defaultValue
    }

    // Apply schema validation if available
    if (this.schema?.[key]) {
      const rule = this.schema[key]
      if (rule.validator(value)) {
        return value as any
      } else {
        this.errors.set(key, rule.errorMessage || `Invalid value for ${key}`)
        return rule.defaultValue ?? defaultValue
      }
    }

    return value
  }

  /**
   * Get a parameter as a specific type
   * 
   * @param key - Parameter key
   * @param type - Expected type
   * @param defaultValue - Default value
   * @returns Typed parameter value
   */
  getTyped<T>(
    key: string,
    type: 'string' | 'number' | 'boolean' | 'date',
    defaultValue?: T
  ): T | undefined {
    const value = this.searchParams.get(key)
    
    if (value === null) {
      return defaultValue
    }

    try {
      switch (type) {
        case 'number':
          const num = Number(value)
          return isNaN(num) ? defaultValue : (num as any)
        
        case 'boolean':
          return (value.toLowerCase() === 'true') as any
        
        case 'date':
          const date = new Date(value)
          return isNaN(date.getTime()) ? defaultValue : (date as any)
        
        case 'string':
        default:
          return value as any
      }
    } catch {
      return defaultValue
    }
  }

  /**
   * Get all values for a parameter (for multi-value parameters)
   * 
   * @param key - Parameter key
   * @returns Array of parameter values
   */
  getAll(key: string): string[] {
    return this.searchParams.getAll(key)
  }

  /**
   * Set a parameter value with type safety
   * 
   * @param key - Parameter key
   * @param value - Parameter value
   * @returns This instance for chaining
   */
  set(key: string, value: string | number | boolean | Date): this {
    let stringValue: string

    if (value instanceof Date) {
      stringValue = value.toISOString()
    } else {
      stringValue = String(value)
    }

    // Validate against schema if available
    if (this.schema?.[key]) {
      const rule = this.schema[key]
      if (!rule.validator(stringValue)) {
        this.errors.set(key, rule.errorMessage || `Invalid value for ${key}`)
        return this
      }
    }

    this.searchParams.set(key, stringValue)
    this.errors.delete(key) // Clear any previous errors
    return this
  }

  /**
   * Append a parameter value (for multi-value parameters)
   * 
   * @param key - Parameter key
   * @param value - Parameter value to append
   * @returns This instance for chaining
   */
  append(key: string, value: string | number | boolean | Date): this {
    const stringValue = value instanceof Date ? value.toISOString() : String(value)
    this.searchParams.append(key, stringValue)
    return this
  }

  /**
   * Delete a parameter
   * 
   * @param key - Parameter key to delete
   * @returns This instance for chaining
   */
  delete(key: string): this {
    this.searchParams.delete(key)
    this.errors.delete(key)
    return this
  }

  /**
   * Check if a parameter exists
   * 
   * @param key - Parameter key
   * @returns True if parameter exists
   */
  has(key: string): boolean {
    return this.searchParams.has(key)
  }

  /**
   * Get all parameter keys
   * 
   * @returns Array of parameter keys
   */
  keys(): string[] {
    return Array.from(this.searchParams.keys())
  }

  /**
   * Get all parameter values
   * 
   * @returns Array of parameter values
   */
  values(): string[] {
    return Array.from(this.searchParams.values())
  }

  /**
   * Get all parameter entries
   * 
   * @returns Array of [key, value] pairs
   */
  entries(): [string, string][] {
    return Array.from(this.searchParams.entries())
  }

  /**
   * Convert to plain object
   * 
   * @param options - Conversion options
   * @returns Plain object representation
   */
  toObject(options: {
    parseNumbers?: boolean
    parseBooleans?: boolean
    parseDates?: boolean
  } = {}): Record<string, any> {
    const { parseNumbers = false, parseBooleans = false, parseDates = false } = options
    const result: Record<string, any> = {}

    this.searchParams.forEach((value, key: any) => {
      let parsedValue: any = value

      if (parseNumbers && /^\d+(\.\d+)?$/.test(value)) {
        parsedValue = Number(value)
      } else if (parseBooleans && (value === 'true' || value === 'false')) {
        parsedValue = value === 'true'
      } else if (parseDates && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
        const date = new Date(value)
        if (!isNaN(date.getTime())) {
          parsedValue = date
        }
      }

      // Handle multiple values for the same key
      if (result[key] !== undefined) {
        if (!Array.isArray(result[key])) {
          result[key] = [result[key]]
        }
        result[key].push(parsedValue)
      } else {
        result[key] = parsedValue
      }
    })

    return result
  }

  /**
   * Get the underlying URLSearchParams instance
   * 
   * @returns URLSearchParams instance
   */
  getURLSearchParams(): URLSearchParams {
    return this.searchParams
  }

  /**
   * Convert to query string
   * 
   * @returns Query string representation
   */
  toString(): string {
    return this.searchParams.toString()
  }

  /**
   * Validate all parameters against schema
   * 
   * @returns True if all parameters are valid
   */
  isValid(): boolean {
    if (!this.schema) {
      return true
    }

    this.errors.clear()

    // Check required parameters
    for (const [key, rule] of Object.entries(this.schema)) {
      if (rule.required && !this.searchParams.has(key)) {
        this.errors.set(key, `Required parameter ${key} is missing`)
        continue
      }

      const value = this.searchParams.get(key)
      if (value !== null && !rule.validator(value)) {
        this.errors.set(key, rule.errorMessage || `Invalid value for ${key}`)
      }
    }

    return this.errors.size === 0
  }

  /**
   * Get validation errors
   * 
   * @returns Map of parameter keys to error messages
   */
  getErrors(): Map<string, string> {
    return new Map(this.errors)
  }

  /**
   * Get validation errors as plain object
   * 
   * @returns Object with parameter keys and error messages
   */
  getErrorsObject(): Record<string, string> {
    return Object.fromEntries(this.errors)
  }

  /**
   * Clone this instance
   * 
   * @returns New TypeSafeURLParams instance with same data
   */
  clone(): TypeSafeURLParams {
    return new TypeSafeURLParams(this.searchParams, this.schema)
  }

  /**
   * Merge with another TypeSafeURLParams instance
   * 
   * @param other - Other instance to merge with
   * @returns New merged instance
   */
  merge(other: TypeSafeURLParams): TypeSafeURLParams {
    const merged = this.clone()
    
    other.searchParams.forEach((value, key: any) => {
      merged.set(key, value)
    })

    return merged
  }

  /**
   * Create a new instance with filtered parameters
   * 
   * @param predicate - Filter function
   * @returns New filtered instance
   */
  filter(predicate: (key: string, value: string) => boolean): TypeSafeURLParams {
    const filtered = new TypeSafeURLParams('', this.schema)
    
    this.searchParams.forEach((value, key: any) => {
      if (predicate(key, value)) {
        filtered.set(key, value)
      }
    })

    return filtered
  }
}

// Common validation rules
export const ValidationRules = {
  string: (minLength = 0, maxLength = Infinity): URLParamValidationRule<string> => ({
    validator: (value): value is string & { __type: string } => 
      typeof value === 'string' && value.length >= minLength && value.length <= maxLength,
    defaultValue: '',
    errorMessage: `String must be between ${minLength} and ${maxLength} characters`
  }),

  number: (min = -Infinity, max = Infinity): URLParamValidationRule<number> => ({
    validator: (value): value is string & { __type: number } => {
      const num = Number(value)
      return !isNaN(num) && num >= min && num <= max
    },
    defaultValue: 0,
    errorMessage: `Number must be between ${min} and ${max}`
  }),

  boolean: (): URLParamValidationRule<boolean> => ({
    validator: (value): value is string & { __type: boolean } => 
      value === 'true' || value === 'false',
    defaultValue: false,
    errorMessage: 'Value must be "true" or "false"'
  }),

  enum: <T extends string>(...values: T[]): URLParamValidationRule<T> => ({
    validator: (value): value is string & { __type: T } => 
      values.includes(value as T),
    defaultValue: values[0],
    errorMessage: `Value must be one of: ${values.join(', ')}`
  }),

  date: (): URLParamValidationRule<Date> => ({
    validator: (value): value is string & { __type: Date } => {
      const date = new Date(value)
      return !isNaN(date.getTime())
    },
    defaultValue: new Date(),
    errorMessage: 'Value must be a valid date'
  })
}