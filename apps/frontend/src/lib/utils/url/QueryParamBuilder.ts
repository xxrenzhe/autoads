/**
 * QueryParamBuilder - Safe construction of URL search parameters
 * 
 * This utility class provides type-safe methods for building URLSearchParams
 * from complex objects, handling nested objects, arrays, and undefined values.
 */

export interface QueryParamOptions {
  /** Whether to include undefined values as empty strings */
  includeUndefined?: boolean
  /** Whether to flatten nested objects using dot notation */
  flattenObjects?: boolean
  /** Custom serializer for complex values */
  customSerializer?: (key: string, value: any) => string | null
}

export class QueryParamBuilder {
  /**
   * Build URLSearchParams from an object with proper type safety
   * 
   * @param params - Object containing query parameters
   * @param options - Configuration options for parameter building
   * @returns URLSearchParams instance ready for use
   */
  static build(
    params: Record<string, any>, 
    options: QueryParamOptions = {}
  ): URLSearchParams {
    const { 
      includeUndefined = false, 
      flattenObjects = true,
      customSerializer 
    } = options
    
    const searchParams = new URLSearchParams()
    
    Object.entries(params).forEach(([key, value]: any) => {
      const serializedValue = this.serializeValue(
        key, 
        value, 
        { includeUndefined, flattenObjects, customSerializer }
      )
      
      if (serializedValue !== null) {
        if (Array.isArray(serializedValue)) {
          // Handle array values by adding multiple entries
          serializedValue.forEach((val: any) => {
            searchParams.append(key, val)
          })
        } else {
          searchParams.set(key, serializedValue)
        }
      }
    })
    
    return searchParams
  }

  /**
   * Build query string from object without creating URLSearchParams
   * 
   * @param params - Object containing query parameters
   * @param options - Configuration options
   * @returns Query string (without leading ?)
   */
  static buildQueryString(
    params: Record<string, any>,
    options: QueryParamOptions = {}
  ): string {
    const searchParams = this.build(params, options)
    return searchParams.toString()
  }

  /**
   * Serialize a single value for URL parameters
   * 
   * @param key - Parameter key
   * @param value - Parameter value
   * @param options - Serialization options
   * @returns Serialized string value, array of strings, or null to skip
   */
  private static serializeValue(
    key: string,
    value: any,
    options: QueryParamOptions
  ): string | string[] | null {
    const { includeUndefined, flattenObjects, customSerializer } = options

    // Use custom serializer if provided
    if (customSerializer) {
      const customResult = customSerializer(key, value)
      if (customResult !== null) {
        return customResult
      }
    }

    // Handle undefined values
    if (value === undefined) {
      return includeUndefined ? '' : null
    }

    // Handle null values
    if (value === null) {
      return ''
    }

    // Handle arrays
    if (Array.isArray(value)) {
      return value
        .filter((item: any) => item !== undefined || includeUndefined)
        ?.filter(Boolean)?.map((item: any) => this.serializeValue(key, item, options))
        .filter((item: any) => item !== null) as string[]
    }

    // Handle objects
    if (typeof value === 'object' && value !== null) {
      if (flattenObjects) {
        // For simple objects, JSON stringify them
        return JSON.stringify(value)
      } else {
        // Skip complex objects if not flattening
        return null
      }
    }

    // Handle primitive values
    return String(value)
  }

  /**
   * Parse URLSearchParams back to an object
   * 
   * @param searchParams - URLSearchParams to parse
   * @param options - Parsing options
   * @returns Parsed object
   */
  static parse(
    searchParams: URLSearchParams,
    options: { parseJSON?: boolean } = {}
  ): Record<string, any> {
    const { parseJSON = true } = options
    const result: Record<string, any> = {}

    searchParams.forEach((value, key: any) => {
      // Handle multiple values for the same key
      if (result[key] !== undefined) {
        if (!Array.isArray(result[key])) {
          result[key] = [result[key]]
        }
        result[key].push(this.parseValue(value, parseJSON))
      } else {
        result[key] = this.parseValue(value, parseJSON)
      }
    })

    return result
  }

  /**
   * Parse a single parameter value
   * 
   * @param value - String value to parse
   * @param parseJSON - Whether to attempt JSON parsing
   * @returns Parsed value
   */
  private static parseValue(value: string, parseJSON: boolean): any {
    if (!parseJSON) {
      return value
    }

    // Try to parse as JSON for complex objects
    if (value.startsWith('{') || value.startsWith('[')) {
      try {
        return JSON.parse(value)
      } catch {
        // If JSON parsing fails, return as string
        return value
      }
    }

    // Handle boolean strings
    if (value === 'true') return true
    if (value === 'false') return false

    // Handle numeric strings
    if (/^\d+$/.test(value)) {
      return parseInt(value, 10)
    }
    if (/^\d*\.\d+$/.test(value)) {
      return parseFloat(value)
    }

    return value
  }

  /**
   * Merge multiple parameter objects safely
   * 
   * @param paramObjects - Array of parameter objects to merge
   * @param options - Build options
   * @returns URLSearchParams with merged parameters
   */
  static merge(
    paramObjects: Record<string, any>[],
    options: QueryParamOptions = {}
  ): URLSearchParams {
    const merged = Object.assign({}, ...paramObjects)
    return this.build(merged, options)
  }
}