/**
 * ObjectToQueryString - Utility for converting complex objects to query strings
 * 
 * This utility provides specialized methods for handling complex object structures
 * in URL query parameters, including nested objects, date ranges, and filters.
 */

export interface QueryStringOptions {
  /** Prefix for nested object keys */
  prefix?: string
  /** Whether to encode special characters */
  encode?: boolean
  /** Array handling strategy */
  arrayFormat?: 'brackets' | 'comma' | 'repeat'
  /** Date format for Date objects */
  dateFormat?: 'iso' | 'timestamp' | 'custom'
  /** Custom date formatter */
  customDateFormatter?: (date: Date) => string
}

export class ObjectToQueryString {
  /**
   * Convert object to query string with advanced options
   * 
   * @param obj - Object to convert
   * @param options - Conversion options
   * @returns Query string (without leading ?)
   */
  static convert(
    obj: Record<string, any>,
    options: QueryStringOptions = {}
  ): string {
    const {
      prefix = '',
      encode = true,
      arrayFormat = 'repeat',
      dateFormat = 'iso',
      customDateFormatter
    } = options

    const params: string[] = []

    Object.entries(obj).forEach(([key, value]: any) => {
      const fullKey = prefix ? `${prefix}[${key}]` : key
      const serialized = this.serializeValue(
        fullKey,
        value,
        { encode, arrayFormat, dateFormat, customDateFormatter }
      )
      
      if (serialized.length > 0) {
        params.push(...serialized)
      }
    })

    return params.join('&')
  }

  /**
   * Convert object to URLSearchParams with type safety
   * 
   * @param obj - Object to convert
   * @param options - Conversion options
   * @returns URLSearchParams instance
   */
  static toURLSearchParams(
    obj: Record<string, any>,
    options: QueryStringOptions = {}
  ): URLSearchParams {
    const queryString = this.convert(obj, options)
    return new URLSearchParams(queryString)
  }

  /**
   * Serialize a single value based on its type
   * 
   * @param key - Parameter key
   * @param value - Value to serialize
   * @param options - Serialization options
   * @returns Array of key=value strings
   */
  private static serializeValue(
    key: string,
    value: any,
    options: Omit<QueryStringOptions, 'prefix'>
  ): string[] {
    const { encode, arrayFormat, dateFormat, customDateFormatter } = options

    // Skip undefined values
    if (value === undefined) {
      return []
    }

    // Handle null values
    if (value === null) {
      return [this.formatParam(key, '', encode)]
    }

    // Handle Date objects
    if (value instanceof Date) {
      const dateString = this.formatDate(value, dateFormat, customDateFormatter)
      return [this.formatParam(key, dateString, encode)]
    }

    // Handle arrays
    if (Array.isArray(value)) {
      return this.serializeArray(key, value, options)
    }

    // Handle nested objects
    if (typeof value === 'object' && value !== null) {
      return this.serializeObject(key, value, options)
    }

    // Handle primitive values
    return [this.formatParam(key, String(value), encode)]
  }

  /**
   * Serialize array values
   * 
   * @param key - Parameter key
   * @param array - Array to serialize
   * @param options - Serialization options
   * @returns Array of formatted parameters
   */
  private static serializeArray(
    key: string,
    array: any[],
    options: Omit<QueryStringOptions, 'prefix'>
  ): string[] {
    const { arrayFormat, encode } = options

    switch (arrayFormat) {
      case 'brackets':
        return array?.filter(Boolean)?.map((item: any) => 
          this.formatParam(`${key}[]`, String(item), encode)
        )
      
      case 'comma':
        const commaSeparated = array.join(',')
        return [this.formatParam(key, commaSeparated, encode)]
      
      case 'repeat':
      default:
        return array?.filter(Boolean)?.map((item: any) => 
          this.formatParam(key, String(item), encode)
        )
    }
  }

  /**
   * Serialize nested objects
   * 
   * @param key - Parameter key
   * @param obj - Object to serialize
   * @param options - Serialization options
   * @returns Array of formatted parameters
   */
  private static serializeObject(
    key: string,
    obj: Record<string, any>,
    options: Omit<QueryStringOptions, 'prefix'>
  ): string[] {
    const params: string[] = []

    Object.entries(obj).forEach(([nestedKey, nestedValue]: any) => {
      const fullKey = `${key}[${nestedKey}]`
      const serialized = this.serializeValue(fullKey, nestedValue, options)
      params.push(...serialized)
    })

    return params
  }

  /**
   * Format a single parameter
   * 
   * @param key - Parameter key
   * @param value - Parameter value
   * @param encode - Whether to encode the value
   * @returns Formatted parameter string
   */
  private static formatParam(key: string, value: string, encode?: boolean): string {
    const encodedKey = encode ? encodeURIComponent(key) : key
    const encodedValue = encode ? encodeURIComponent(value) : value
    return `${encodedKey}=${encodedValue}`
  }

  /**
   * Format Date object to string
   * 
   * @param date - Date to format
   * @param format - Date format type
   * @param customFormatter - Custom formatter function
   * @returns Formatted date string
   */
  private static formatDate(
    date: Date,
    format?: string,
    customFormatter?: (date: Date) => string
  ): string {
    if (customFormatter) {
      return customFormatter(date)
    }

    switch (format) {
      case 'timestamp':
        return String(date.getTime())
      
      case 'iso':
      default:
        return date.toISOString()
    }
  }

  /**
   * Parse query string back to object
   * 
   * @param queryString - Query string to parse (with or without leading ?)
   * @param options - Parsing options
   * @returns Parsed object
   */
  static parse(
    queryString: string,
    options: { 
      decode?: boolean
      parseNumbers?: boolean
      parseBooleans?: boolean
      parseDates?: boolean
    } = {}
  ): Record<string, any> {
    const {
      decode = true,
      parseNumbers = true,
      parseBooleans = true,
      parseDates = true
    } = options

    // Remove leading ? if present
    const cleanQuery = queryString.startsWith('?') 
      ? queryString.slice(1) 
      : queryString

    if (!cleanQuery) {
      return {}
    }

    const result: Record<string, any> = {}
    const pairs = cleanQuery.split('&')

    pairs.forEach((pair: any) => {
      const [key, value = ''] = pair.split('=')
      
      if (!key) return

      const decodedKey = decode ? decodeURIComponent(key) : key
      const decodedValue = decode ? decodeURIComponent(value) : value

      // Parse the value based on options
      const parsedValue = this.parseValue(decodedValue, {
        parseNumbers,
        parseBooleans,
        parseDates
      })

      // Handle nested keys (e.g., filter[status])
      if (decodedKey.includes('[') && decodedKey.includes(']')) {
        this.setNestedValue(result, decodedKey, parsedValue)
      } else {
        // Handle multiple values for the same key
        if (result[decodedKey] !== undefined) {
          if (!Array.isArray(result[decodedKey])) {
            result[decodedKey] = [result[decodedKey]]
          }
          result[decodedKey].push(parsedValue)
        } else {
          result[decodedKey] = parsedValue
        }
      }
    })

    return result
  }

  /**
   * Parse a single value with type conversion
   * 
   * @param value - String value to parse
   * @param options - Parsing options
   * @returns Parsed value
   */
  private static parseValue(
    value: string,
    options: {
      parseNumbers?: boolean
      parseBooleans?: boolean
      parseDates?: boolean
    }
  ): any {
    const { parseNumbers, parseBooleans, parseDates } = options

    // Handle empty strings
    if (value === '') {
      return ''
    }

    // Parse booleans
    if (parseBooleans) {
      if (value === 'true') return true
      if (value === 'false') return false
    }

    // Parse numbers
    if (parseNumbers) {
      if (/^\d+$/.test(value)) {
        return parseInt(value, 10)
      }
      if (/^\d*\.\d+$/.test(value)) {
        return parseFloat(value)
      }
    }

    // Parse dates (ISO format)
    if (parseDates && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
      const date = new Date(value)
      if (!isNaN(date.getTime())) {
        return date
      }
    }

    return value
  }

  /**
   * Set nested value in object using bracket notation key
   * 
   * @param obj - Target object
   * @param key - Key with bracket notation (e.g., "filter[status]")
   * @param value - Value to set
   */
  private static setNestedValue(
    obj: Record<string, any>,
    key: string,
    value: any
  ): void {
    const match = key.match(/^([^[]+)\[([^\]]+)\](.*)$/)
    
    if (!match) {
      obj[key] = value
      return
    }

    const [, rootKey, nestedKey, remaining] = match

    if (!obj[rootKey]) {
      obj[rootKey] = {}
    }

    if (remaining) {
      // Handle deeper nesting
      this.setNestedValue(obj[rootKey], nestedKey + remaining, value)
    } else {
      obj[rootKey][nestedKey] = value
    }
  }
}