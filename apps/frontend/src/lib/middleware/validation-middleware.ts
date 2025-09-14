/**
 * API Input Validation Middleware
 * Provides centralized input validation and sanitization for all API endpoints
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { sanitizeUserInput, validateAndSanitizeText } from '@/lib/utils/security/validation';
import { sanitizeHtml } from '@/lib/utils/security/sanitize';

export interface ValidationRule {
  field: string;
  type: 'string' | 'number' | 'boolean' | 'email' | 'url' | 'html' | 'object' | 'array';
  required?: boolean;
  min?: number;
  max?: number;
  pattern?: RegExp;
  enum?: string[];
  custom?: (value: any) => boolean | string;
  sanitize?: boolean;
  default?: any;
}

export interface ValidationConfig {
  body?: ValidationRule[];
  query?: ValidationRule[];
  params?: ValidationRule[];
}

export class ValidationError extends Error {
  declare field: string;
  declare message: string;
  declare value?: any;

  constructor(
    field: string,
    message: string,
    value?: any
  ) {
    super(`Validation error for field ${field}: ${message}`);
    this.name = 'ValidationError';
    this.field = field;
    this.message = message;
    this.value = value;
  }
}

/**
 * Validate and sanitize input data based on rules
 */
export function validateInput(data: any, rules: ValidationRule[]): any {
  const result: any = {};
  const errors: ValidationError[] = [];

  for (const rule of rules) {
    const value = data[rule.field];
    let isValid = true;
    let processedValue = value;

    // Check required fields
    if (rule.required && (value === undefined || value === null || value === '')) {
      errors.push(new ValidationError(rule.field, 'Field is required', value));
      continue;
    }

    // Skip validation for optional fields that are empty
    if (!rule.required && (value === undefined || value === null || value === '')) {
      continue;
    }

    // Type validation and processing
    switch (rule.type) {
      case 'string':
        if (typeof value !== 'string') {
          errors.push(new ValidationError(rule.field, 'Must be a string', value));
          isValid = false;
        } else {
          processedValue = value.trim();
          
          if (rule.min !== undefined && processedValue.length < rule.min) {
            errors.push(new ValidationError(rule.field, `Must be at least ${rule.min} characters`, value));
            isValid = false;
          }
          
          if (rule.max !== undefined && processedValue.length > rule.max) {
            errors.push(new ValidationError(rule.field, `Must be at most ${rule.max} characters`, value));
            isValid = false;
          }
          
          if (rule.pattern && !rule.pattern.test(processedValue)) {
            errors.push(new ValidationError(rule.field, 'Format is invalid', value));
            isValid = false;
          }
          
          if (rule.enum && !rule.enum.includes(processedValue)) {
            errors.push(new ValidationError(rule.field, `Must be one of: ${rule.enum.join(', ')}`, value));
            isValid = false;
          }
          
          // Sanitize if requested
          if (rule.sanitize && isValid) {
            const validation = validateAndSanitizeText(processedValue, rule.max || 1000);
            if (!validation.isValid) {
              errors.push(new ValidationError(rule.field, validation.errors.join(', '), value));
              isValid = false;
            } else {
              processedValue = validation.sanitized;
            }
          }
        }
        break;

      case 'number':
        const numValue = Number(value);
        if (isNaN(numValue)) {
          errors.push(new ValidationError(rule.field, 'Must be a number', value));
          isValid = false;
        } else {
          processedValue = numValue;
          
          if (rule.min !== undefined && processedValue < rule.min) {
            errors.push(new ValidationError(rule.field, `Must be at least ${rule.min}`, value));
            isValid = false;
          }
          
          if (rule.max !== undefined && processedValue > rule.max) {
            errors.push(new ValidationError(rule.field, `Must be at most ${rule.max}`, value));
            isValid = false;
          }
        }
        break;

      case 'boolean':
        if (typeof value !== 'boolean' && value !== 'true' && value !== 'false') {
          errors.push(new ValidationError(rule.field, 'Must be a boolean', value));
          isValid = false;
        } else {
          processedValue = Boolean(value);
        }
        break;

      case 'email':
        if (typeof value !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          errors.push(new ValidationError(rule.field, 'Must be a valid email address', value));
          isValid = false;
        } else {
          processedValue = value.trim().toLowerCase();
        }
        break;

      case 'url':
        try {
          new URL(value);
          processedValue = value.trim();
        } catch {
          errors.push(new ValidationError(rule.field, 'Must be a valid URL', value));
          isValid = false;
        }
        break;

      case 'html':
        if (typeof value !== 'string') {
          errors.push(new ValidationError(rule.field, 'Must be a string', value));
          isValid = false;
        } else {
          // Always sanitize HTML
          processedValue = sanitizeHtml(value);
        }
        break;

      case 'object':
        if (typeof value !== 'object' || value === null) {
          errors.push(new ValidationError(rule.field, 'Must be an object', value));
          isValid = false;
        }
        break;

      case 'array':
        if (!Array.isArray(value)) {
          errors.push(new ValidationError(rule.field, 'Must be an array', value));
          isValid = false;
        } else if (rule.min !== undefined && value.length < rule.min) {
          errors.push(new ValidationError(rule.field, `Must have at least ${rule.min} items`, value));
          isValid = false;
        } else if (rule.max !== undefined && value.length > rule.max) {
          errors.push(new ValidationError(rule.field, `Must have at most ${rule.max} items`, value));
          isValid = false;
        }
        break;
    }

    // Custom validation
    if (isValid && rule.custom) {
      const customResult = rule.custom(processedValue);
      if (customResult !== true) {
        errors.push(new ValidationError(rule.field, typeof customResult === 'string' ? customResult : 'Custom validation failed', value));
        isValid = false;
      }
    }

    if (isValid) {
      result[rule.field] = processedValue;
    }
  }

  if (errors.length > 0) {
    throw errors;
  }

  return result;
}

/**
 * Zod schema validation helper
 */
export function validateWithZod<T>(schema: any, data: any): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if ((error as any)?.errors) {
      const formattedErrors = error.errors.map((err: any) => ({
        field: err.path.join('.'),
        message: err.message,
        code: err.code
      }));
      throw formattedErrors;
    }
    throw error;
  }
}

/**
 * Create API route wrapper with validation
 */
export function withValidation(
  handler: (req: NextRequest, context: any) => Promise<NextResponse>,
  config: ValidationConfig
) {
  return async (req: NextRequest, context: any): Promise<NextResponse> => {
    try {
      const validatedData: any = {};

      // Validate query parameters
      if (config.query) {
        const { searchParams } = new URL(req.url);
        const queryData = Object.fromEntries(searchParams);
        validatedData.query = validateInput(queryData, config.query);
      }

      // Validate path parameters
      if (config.params && context.params) {
        validatedData.params = validateInput(context.params, config.params);
      }

      // Validate body
      if (config.body && req.method !== 'GET' && req.method !== 'HEAD') {
        const contentType = req.headers.get('content-type');
        let bodyData;

        if (contentType?.includes('application/json')) {
          bodyData = await req.json();
        } else if (contentType?.includes('application/x-www-form-urlencoded')) {
          const formData = await req.formData();
          bodyData = Object.fromEntries(formData);
        } else {
          bodyData = await req.text();
        }

        validatedData.body = validateInput(bodyData, config.body);
      }

      // Call the original handler with validated data
      try {

      return await handler(req, { ...context, validatedData });

      } catch (error) {
        console.error(error);
        
        return NextResponse.json(
          { error: 'Internal server error' },
          { status: 500 }
        );
      }
    } catch (error) {
      if (Array.isArray(error) && error[0] instanceof ValidationError) {
        return NextResponse.json(
          {
            error: 'Validation failed',
            details: error.map((e: any) => ({
              field: e.field,
              message: e.message,
              value: e.value
            }))
          },
          { status: 400 }
        );
      }

      if (Array.isArray(error)) {
        return NextResponse.json(
          {
            error: 'Validation failed',
            details: error
          },
          { status: 400 }
        );
      }

      // Re-throw other errors
      throw error;
    }
  };
}

/**
 * Common validation schemas
 */
export const commonSchemas = {
  // Pagination
  pagination: {
    query: [
      { field: 'page', type: 'number', required: false, min: 1, default: 1 },
      { field: 'limit', type: 'number', required: false, min: 1, max: 100, default: 20 },
      { field: 'offset', type: 'number', required: false, min: 0, default: 0 }
    ] as ValidationRule[]
  },

  // Date range
  dateRange: {
    query: [
      { field: 'startDate', type: 'string', required: false },
      { field: 'endDate', type: 'string', required: false }
    ] as ValidationRule[]
  },

  // ID parameter
  idParam: {
    params: [
      { field: 'id', type: 'string', required: true, pattern: /^[a-zA-Z0-9_-]+$/ }
    ] as ValidationRule[]
  },

  // Search and filter
  search: {
    query: [
      { field: 'search', type: 'string', required: false, max: 100, sanitize: true },
      { field: 'filter', type: 'string', required: false, max: 50 },
      { field: 'sort', type: 'string', required: false, max: 50 },
      { field: 'order', type: 'string', required: false, enum: ['asc', 'desc'] }
    ] as ValidationRule[]
  }
};

/**
 * Security headers for API responses
 */
export const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy': "default-src 'self'"
};

/**
 * Apply security headers to response
 */
export function applySecurityHeaders(response: NextResponse): NextResponse {
  Object.entries(securityHeaders).forEach(([key, value]: any) => {
    response.headers.set(key, value);
  });
  return response;
}
