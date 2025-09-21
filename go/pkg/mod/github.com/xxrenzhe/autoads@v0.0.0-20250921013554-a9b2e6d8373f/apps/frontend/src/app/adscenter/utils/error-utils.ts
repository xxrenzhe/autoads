/**
 * 简化的错误工具 - 用于构建过程
 */
export function logError(error: Error, context?: any): void {
  console.error('Error logged:', error.message, context);
}

export function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}