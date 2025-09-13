/**
 * 简化的验证服务 - 提供基本的配置验证功能
 */

export interface ValidationError {
  field: string;
  message: string;
  code?: string;
  severity: 'error' | 'warning';
}

export interface ValidationWarning {
  field: string;
  message: string;
  suggestion?: string;
  severity: 'warning';
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export class ValidationService {
  /**
   * 验证配置数据
   */
  static validateConfiguration(config: any): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // 验证必要字段
    if (!config.name) {
      errors.push({
        field: 'name',
        message: '配置名称不能为空',
        code: 'REQUIRED_FIELD',
        severity: 'error'
      });
    }

    // 验证链接
    if (config.originalLinks && Array.isArray(config.originalLinks)) {
      if (config.originalLinks.length === 0) {
        errors.push({
          field: 'originalLinks',
          message: '至少需要添加一个广告联盟链接',
          code: 'REQUIRED_LINKS',
          severity: 'error'
        });
      } else {
        config.originalLinks.forEach((link: string, index: number: any) => {
          if (!this.isValidUrl(link)) {
            errors.push({
              field: 'originalLinks',
              message: `链接 ${index + 1} 格式无效`,
              code: 'INVALID_URL',
              severity: 'error'
            });
          }
        });
      }
    }

    // 验证环境ID
    if (config.environmentId && !config.environmentId.trim()) {
      errors.push({
        field: 'environmentId',
        message: '环境ID不能为空',
        code: 'REQUIRED_ENVIRONMENT',
        severity: 'error'
      });
    }

    // 验证执行间隔
    if (config.executionInterval) {
      const interval = parseInt(config.executionInterval.toString());
      if (isNaN(interval) || interval < 1) {
        errors.push({
          field: 'executionInterval',
          message: '执行间隔必须大于0',
          code: 'INVALID_INTERVAL',
          severity: 'error'
        });
      } else if (interval < 30) {
        warnings.push({
          field: 'executionInterval',
          message: '执行间隔过短可能会影响系统性能',
          suggestion: '建议设置为30秒以上',
          severity: 'warning'
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * 验证URL格式
   */
  private static isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 获取错误消息
   */
  static getErrorMessage(error: ValidationError): string {
    return error.message || '验证失败';
  }

  /**
   * 获取警告消息
   */
  static getWarningMessage(warning: ValidationWarning): string {
    return warning.message || '验证警告';
  }
}