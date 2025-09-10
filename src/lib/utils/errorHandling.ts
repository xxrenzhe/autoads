import { createClientLogger } from './security/client-secure-logger'

const logger = createClientLogger('error-handling')

export function withErrorHandling<T extends (...args: any[]) => any>(
  fn: T,
  context: string
): (...args: Parameters<T>) => ReturnType<T> {
  return (...args: Parameters<T>): ReturnType<T> => {
    try {
      return fn(...args)
    } catch (error) {
      logger.error(`Error in ${context}:`, error instanceof Error ? error : new Error(String(error)))
      throw error
    }
  }
}
