/**
 * 简化的错误管理器 - 用于构建过程
 */

export class ErrorManager {
  async handleError(error: any, context?: any): Promise<void> {
    // 简化实现用于构建
    console.error('Error handled:', error);
  }

  async getErrors(): Promise<any[]> {
    // 简化实现用于构建
    return [];
  }

  async clearErrors(): Promise<void> {
    // 简化实现用于构建
  }
}