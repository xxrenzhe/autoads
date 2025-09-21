import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { JsonValue } from "@prisma/client/runtime/library";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Type Safety Utilities

/**
 * Safely converts null to undefined for user names
 * Handles the common pattern where database returns null but we need undefined
 */
export function safeUserName(name: string | null): string | undefined {
  return name ?? undefined;
}

/**
 * Type guard to check if a value is not null
 */
export function isNotNull<T>(value: T | null): value is T {
  return value !== null;
}

/**
 * Type guard to check if a value is not null or undefined
 */
export function isNotNullOrUndefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

/**
 * Safely converts string to number, returns undefined if invalid
 */
export function safeStringToNumber(value: string | null | undefined): number | undefined {
  if (!value) return undefined;
  const num = Number(value);
  return isNaN(num) ? undefined : num;
}

/**
 * Safely handles JSON parsing for mixed string/JsonValue types
 * Returns the parsed value if it's a string, otherwise returns the value as-is
 */
export function safeJsonParse(value: string | JsonValue | null): any {
  if (value === null) return null as any;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return value; // Return original string if parsing fails
    }
  }
  return value;
}

/**
 * Safely handles nullable JSON values from database
 * Converts null to undefined for optional properties
 */
export function handleNullableJson(value: JsonValue | null): any {
  return value ?? undefined;
}

/**
 * Type guard for checking if a value is a valid string
 */
export function isValidString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

/**
 * Safely converts unknown values to string
 */
export function safeStringConversion(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return value.toString();
  if (typeof value === 'boolean') return value.toString();
  return undefined;
}
