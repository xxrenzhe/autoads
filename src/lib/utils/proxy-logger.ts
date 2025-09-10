/**
 * Simple proxy logger for testing
 */

export function createProxyLogger(name: string) {
  return {
    info: (msg: string, data?: any) => console.log(`[${name}] INFO: ${msg}`, data || ''),
    warn: (msg: string, data?: any) => console.warn(`[${name}] WARN: ${msg}`, data || ''),
    error: (msg: string, error?: any) => console.error(`[${name}] ERROR: ${msg}`, error || ''),
    debug: (msg: string, data?: any) => console.debug(`[${name}] DEBUG: ${msg}`, data || '')
  };
}