/**
 * Material-UI Color Mapper
 * 
 * Utilities for mapping string values to valid Material-UI component color props.
 */

/**
 * Valid Material-UI Chip color values
 */
export type ValidChipColor = 
  | 'default' 
  | 'primary' 
  | 'secondary' 
  | 'error' 
  | 'info' 
  | 'success' 
  | 'warning'

/**
 * Valid Material-UI Button color values
 */
export type ValidButtonColor = 
  | 'inherit' 
  | 'primary' 
  | 'secondary' 
  | 'success' 
  | 'error' 
  | 'info' 
  | 'warning'

/**
 * Valid Material-UI Badge color values
 */
export type ValidBadgeColor = 
  | 'default' 
  | 'primary' 
  | 'secondary' 
  | 'error' 
  | 'info' 
  | 'success' 
  | 'warning'

/**
 * Map status strings to valid Chip colors
 * 
 * @param status - Status string to map
 * @param defaultColor - Default color if mapping not found
 * @returns Valid Chip color
 */
export function mapStatusToChipColor(
  status: string | undefined | null,
  defaultColor: ValidChipColor = 'default'
): ValidChipColor {
  if (!status) return defaultColor

  const statusColorMap: Record<string, ValidChipColor> = {
    // Success states
    'active': 'success',
    'enabled': 'success',
    'online': 'success',
    'connected': 'success',
    'completed': 'success',
    'approved': 'success',
    'verified': 'success',
    'published': 'success',
    'paid': 'success',
    'confirmed': 'success',
    'delivered': 'success',
    'success': 'success',
    'valid': 'success',
    'healthy': 'success',
    
    // Error states
    'inactive': 'default',
    'disabled': 'default',
    'offline': 'error',
    'disconnected': 'error',
    'failed': 'error',
    'rejected': 'error',
    'cancelled': 'error',
    'canceled': 'error',
    'error': 'error',
    'invalid': 'error',
    'blocked': 'error',
    'suspended': 'error',
    'terminated': 'error',
    'deleted': 'error',
    
    // Warning states
    'pending': 'warning',
    'processing': 'warning',
    'waiting': 'warning',
    'expired': 'warning',
    'expiring': 'warning',
    'warning': 'warning',
    'limited': 'warning',
    'partial': 'warning',
    'degraded': 'warning',
    
    // Info states
    'draft': 'info',
    'scheduled': 'info',
    'trial': 'info',
    'beta': 'info',
    'info': 'info',
    'new': 'info',
    'updated': 'info',
    'maintenance': 'info',
    
    // Primary states
    'featured': 'primary',
    'premium': 'primary',
    'pro': 'primary',
    'enterprise': 'primary',
    'priority': 'primary',
    
    // Secondary states
    'standard': 'secondary',
    'basic': 'secondary',
    'free': 'secondary',
    'guest': 'secondary'
  }

  const normalizedStatus = status.toLowerCase().trim()
  return statusColorMap[normalizedStatus] || defaultColor
}

/**
 * Map priority levels to valid Chip colors
 * 
 * @param priority - Priority level (high, medium, low, etc.)
 * @param defaultColor - Default color if mapping not found
 * @returns Valid Chip color
 */
export function mapPriorityToChipColor(
  priority: string | number | undefined | null,
  defaultColor: ValidChipColor = 'default'
): ValidChipColor {
  if (priority == null) return defaultColor

  const priorityStr = String(priority).toLowerCase().trim()
  
  const priorityColorMap: Record<string, ValidChipColor> = {
    'critical': 'error',
    'high': 'error',
    'urgent': 'error',
    '5': 'error',
    '4': 'warning',
    'medium': 'warning',
    'normal': 'warning',
    '3': 'info',
    'low': 'info',
    '2': 'success',
    '1': 'success',
    'minimal': 'default',
    '0': 'default'
  }

  return priorityColorMap[priorityStr] || defaultColor
}

/**
 * Map severity levels to valid Chip colors
 * 
 * @param severity - Severity level
 * @param defaultColor - Default color if mapping not found
 * @returns Valid Chip color
 */
export function mapSeverityToChipColor(
  severity: string | undefined | null,
  defaultColor: ValidChipColor = 'default'
): ValidChipColor {
  if (!severity) return defaultColor

  const severityColorMap: Record<string, ValidChipColor> = {
    'critical': 'error',
    'major': 'error',
    'minor': 'warning',
    'trivial': 'info',
    'enhancement': 'success'
  }

  const normalizedSeverity = severity.toLowerCase().trim()
  return severityColorMap[normalizedSeverity] || defaultColor
}

/**
 * Map boolean values to valid Chip colors
 * 
 * @param value - Boolean value
 * @param trueColor - Color for true values
 * @param falseColor - Color for false values
 * @returns Valid Chip color
 */
export function mapBooleanToChipColor(
  value: boolean | undefined | null,
  trueColor: ValidChipColor = 'success',
  falseColor: ValidChipColor = 'default'
): ValidChipColor {
  return value ? trueColor : falseColor
}

/**
 * Map status strings to valid Button colors
 * 
 * @param status - Status string to map
 * @param defaultColor - Default color if mapping not found
 * @returns Valid Button color
 */
export function mapStatusToButtonColor(
  status: string | undefined | null,
  defaultColor: ValidButtonColor = 'primary'
): ValidButtonColor {
  if (!status) return defaultColor

  const statusColorMap: Record<string, ValidButtonColor> = {
    'primary': 'primary',
    'secondary': 'secondary',
    'success': 'success',
    'error': 'error',
    'warning': 'warning',
    'info': 'info',
    'inherit': 'inherit',
    
    // Map common status values
    'active': 'success',
    'inactive': 'secondary',
    'failed': 'error',
    'pending': 'warning',
    'draft': 'info'
  }

  const normalizedStatus = status.toLowerCase().trim()
  return statusColorMap[normalizedStatus] || defaultColor
}

/**
 * Create a type-safe color mapper function
 * 
 * @param colorMap - Custom color mapping
 * @param defaultColor - Default color to use
 * @returns Color mapper function
 */
export function createColorMapper<T extends string>(
  colorMap: Record<string, T>,
  defaultColor: T
): (value: string | undefined | null) => T {
  return (value: string | undefined | null): T => {
    if (!value) return defaultColor
    const normalizedValue = value.toLowerCase().trim()
    return colorMap[normalizedValue] || defaultColor
  }
}

/**
 * Validate if a color is a valid Chip color
 * 
 * @param color - Color to validate
 * @returns True if valid Chip color
 */
export function isValidChipColor(color: any): color is ValidChipColor {
  const validColors: ValidChipColor[] = [
    'default', 'primary', 'secondary', 'error', 'info', 'success', 'warning'
  ]
  return validColors.includes(color)
}

/**
 * Validate if a color is a valid Button color
 * 
 * @param color - Color to validate
 * @returns True if valid Button color
 */
export function isValidButtonColor(color: any): color is ValidButtonColor {
  const validColors: ValidButtonColor[] = [
    'inherit', 'primary', 'secondary', 'success', 'error', 'info', 'warning'
  ]
  return validColors.includes(color)
}

/**
 * Get a safe Chip color with fallback
 * 
 * @param color - Color to validate
 * @param fallback - Fallback color
 * @returns Valid Chip color
 */
export function getSafeChipColor(
  color: any,
  fallback: ValidChipColor = 'default'
): ValidChipColor {
  return isValidChipColor(color) ? color : fallback
}

/**
 * Get a safe Button color with fallback
 * 
 * @param color - Color to validate
 * @param fallback - Fallback color
 * @returns Valid Button color
 */
export function getSafeButtonColor(
  color: any,
  fallback: ValidButtonColor = 'primary'
): ValidButtonColor {
  return isValidButtonColor(color) ? color : fallback
}