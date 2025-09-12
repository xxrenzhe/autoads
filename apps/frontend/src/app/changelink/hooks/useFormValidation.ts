// 表单验证Hook - 提供实时表单验证功能

import { useState, useCallback, useEffect } from 'react';
import { TrackingConfiguration, ValidationResult, ValidationError, ValidationWarning } from '../types';
import { ValidationService } from '../models/ValidationService';
import { debounce } from '../utils';
import { createClientLogger } from "@/lib/utils/security/client-secure-logger";
import { EnhancedError } from '@/lib/utils/error-handling';
const logger = createClientLogger('useFormValidation');


export interface FormValidationState {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  fieldErrors: { [key: string]: string };
  fieldWarnings: { [key: string]: string };
  isValidating: boolean;
}

export interface UseFormValidationOptions {
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
  debounceMs?: number;
  skipAsyncValidation?: boolean;
}

export function useFormValidation(
  initialData: Partial<TrackingConfiguration> = {},
  options: UseFormValidationOptions = {}
) {
  const {
    validateOnChange = true,
    validateOnBlur = true,
    debounceMs = 300,
    skipAsyncValidation = false
  } = options;

  const [formData, setFormData] = useState<Partial<TrackingConfiguration>>(initialData);
  const [validationState, setValidationState] = useState<FormValidationState>({
    isValid: true,
    errors: [],
    warnings: [],
    fieldErrors: {},
    fieldWarnings: {},
    isValidating: false
  });

  // 处理验证结果
  const processValidationResult = useCallback((result: ValidationResult) => {
    const fieldErrors: { [key: string]: string } = {};
    const fieldWarnings: { [key: string]: string } = {};

    // 处理错误
    result.errors.forEach(error => {
      fieldErrors[error.field] = error.message || '验证失败';
    });

    // 处理警告
    result.warnings.forEach(warning => {
      fieldWarnings[warning.field] = warning.message || '验证警告';
    });

    setValidationState({
      isValid: result.isValid,
      errors: result.errors,
      warnings: result.warnings,
      fieldErrors,
      fieldWarnings,
      isValidating: false
    });
  }, []);

  // 执行验证
  const validateForm = useCallback(async (data: Partial<TrackingConfiguration>) => {
    setValidationState(prev => ({ ...prev, isValidating: true }));

    try {
      // 基础验证
      const basicResult = ValidationService.validateConfiguration(data);
      
      if (!skipAsyncValidation) {
        // 异步验证
        const asyncValidations = [];

        // URL可访问性验证
        if (data.originalLinks && data.originalLinks.length > 0) {
          asyncValidations.push(
            Promise.resolve({ inaccessible: [], accessible: data.originalLinks })
              .then(result => {
                if (result.inaccessible.length > 0) {
                  basicResult.warnings.push({
                    field: 'originalLinks',
                    message: `${result.inaccessible.length}个链接可能无法访问`,
                    suggestion: '请检查链接是否正确',
                    severity: 'warning'
                  });
                }
              })
              .catch(() => {
                // 忽略网络错误
              })
          );
        }

        // Google Ads账户验证
        if (data.googleAdsAccounts && data.googleAdsAccounts.length > 0) {
                  for (const account of data.googleAdsAccounts) {
          asyncValidations.push(
            Promise.resolve({ isValid: true })
              .then((result: any) => {
                if (!result.isValid) {
                  basicResult.errors.push({
                      field: 'googleAdsAccounts',
                      message: result.error || 'Google Ads账户验证失败',
                      code: 'VALIDATION_FAILED',
                      severity: 'error'
                    });
                  }
                })
                .catch(() => {
                  basicResult.warnings.push({
                    field: 'googleAdsAccounts',
                    message: '无法验证Google Ads账户连接',
                    suggestion: '请检查网络连接',
                    severity: 'warning'
                  });
                })
            );
          }
        }

        // AdsPower环境验证
        if (data.environmentId) {
          asyncValidations.push(
            Promise.resolve({ valid: true })
              .then((result: any) => {
                if (!result.valid) {
                  basicResult.errors.push({
                    field: 'environmentId',
                    message: result.error || 'AdsPower环境验证失败',
                    code: 'VALIDATION_FAILED',
                    severity: 'error'
                  });
                }
              })
              .catch(() => {
                basicResult.warnings.push({
                  field: 'environmentId',
                  message: '无法验证AdsPower环境连接',
                  suggestion: '请检查AdsPower是否正常运行',
                  severity: 'warning'
                });
              })
          );
        }

        // 等待所有异步验证完成
        await Promise.allSettled(asyncValidations);
      }

      // 重新计算验证状态
      basicResult.isValid = basicResult.errors.length === 0;
      processValidationResult(basicResult);

    } catch (error) {
      logger.error('表单验证失败:', new EnhancedError('表单验证失败:', { error: error instanceof Error ? error.message : String(error)  }));
      setValidationState(prev => ({
        ...prev,
        isValidating: false,
        errors: [{ field: 'general', message: '验证过程中发生错误', code: 'VALIDATION_ERROR', severity: 'error' }],
        isValid: false,
        warnings: []
      }));
    }
  }, [processValidationResult, skipAsyncValidation]);

  // 防抖验证
  const debouncedValidate = useCallback(
    debounce((...args: unknown[]) => {
      const data = args[0] as Partial<TrackingConfiguration>;
      validateForm(data);
    }, debounceMs),
    [validateForm, debounceMs]
  );

  // 更新表单数据
  const updateField = useCallback((field: keyof TrackingConfiguration, value: Partial<TrackingConfiguration>[keyof TrackingConfiguration]) => {
    setFormData(prev => {
      const newData = { ...prev, [field]: value };
      
      if (validateOnChange) {
        debouncedValidate(newData);
      }
      
      return newData;
    });
  }, [validateOnChange, debouncedValidate]);

  // 批量更新表单数据
  const updateFields = useCallback((updates: Partial<TrackingConfiguration>) => {
    setFormData(prev => {
      const newData = { ...prev, ...updates };
      
      if (validateOnChange) {
        debouncedValidate(newData);
      }
      
      return newData;
    });
  }, [validateOnChange, debouncedValidate]);

  // 字段失焦验证
  const validateField = useCallback((field: keyof TrackingConfiguration) => {
    if (validateOnBlur) {
      validateForm(formData);
    }
  }, [validateOnBlur, validateForm, formData]);

  // 重置表单
  const resetForm = useCallback((newData: Partial<TrackingConfiguration> = {}) => {
    setFormData(newData);
    setValidationState({
      isValid: true,
      errors: [],
      warnings: [],
      fieldErrors: {},
      fieldWarnings: {},
      isValidating: false
    });
  }, []);

  // 手动触发验证
  const triggerValidation = useCallback(() => {
    validateForm(formData);
  }, [validateForm, formData]);

  // 获取字段错误
  const getFieldError = useCallback((field: string) => {
    return validationState.fieldErrors[field] || '';
  }, [validationState.fieldErrors]);

  // 获取字段警告
  const getFieldWarning = useCallback((field: string) => {
    return validationState.fieldWarnings[field] || '';
  }, [validationState.fieldWarnings]);

  // 检查字段是否有错误
  const hasFieldError = useCallback((field: string) => {
    return !!validationState.fieldErrors[field];
  }, [validationState.fieldErrors]);

  // 检查字段是否有警告
  const hasFieldWarning = useCallback((field: string) => {
    return !!validationState.fieldWarnings[field];
  }, [validationState.fieldWarnings]);

  // 获取所有错误消息
  const getAllErrors = useCallback(() => {
    return validationState.errors?.filter(Boolean)?.map(error => error.message || '验证失败');
  }, [validationState.errors]);

  // 获取所有警告消息
  const getAllWarnings = useCallback(() => {
    return validationState.warnings?.filter(Boolean)?.map(warning => warning.message || '验证警告');
  }, [validationState.warnings]);

  // 初始验证
  useEffect(() => {
    if (Object.keys(initialData).length > 0) {
      validateForm(initialData);
    }
  }, [initialData, validateForm]); // 只在组件挂载时执行

  return {
    // 表单数据
    formData,
    
    // 验证状态
    validationState,
    isValid: validationState.isValid,
    isValidating: validationState.isValidating,
    errors: validationState.errors,
    warnings: validationState.warnings,
    
    // 表单操作
    updateField,
    updateFields,
    resetForm,
    triggerValidation,
    validateField,
    
    // 字段验证状态
    getFieldError,
    getFieldWarning,
    hasFieldError,
    hasFieldWarning,
    
    // 消息获取
    getAllErrors,
    getAllWarnings
  };
}

// 字段验证Hook - 用于单个字段的实时验证
export function useFieldValidation(
  fieldName: keyof TrackingConfiguration,
  value: Partial<TrackingConfiguration>[keyof TrackingConfiguration],
  formData: Partial<TrackingConfiguration>,
  options: { debounceMs?: number } = {}
) {
  const { debounceMs = 300 } = options;
  const [fieldState, setFieldState] = useState({
    error: '',
    warning: '',
    isValidating: false
  });

  const validateSingleField = useCallback(async (fieldValue: Partial<TrackingConfiguration>[keyof TrackingConfiguration]) => {
    setFieldState(prev => ({ ...prev, isValidating: true }));

    try {
      // 创建临时配置对象进行验证
      const tempConfig = { ...formData, [fieldName]: fieldValue };
      const result = ValidationService.validateConfiguration(tempConfig);

      // 找到当前字段的错误和警告
      const fieldError = result.errors.find(error => error.field === fieldName);
      const fieldWarning = result.warnings.find(warning => warning.field === fieldName);

      setFieldState({
        error: fieldError ? ValidationService.getErrorMessage(fieldError) : '',
        warning: fieldWarning ? ValidationService.getWarningMessage(fieldWarning) : '',
        isValidating: false
      });
    } catch (error) {
      setFieldState({
        error: '验证失败',
        warning: '',
        isValidating: false
      });
    }
  }, [fieldName, formData]);

  const debouncedValidateField = useCallback(
    debounce((...args: unknown[]) => {
      const value = args[0] as Partial<TrackingConfiguration>[keyof TrackingConfiguration];
      validateSingleField(value);
    }, debounceMs),
    [validateSingleField, debounceMs]
  );

  useEffect(() => {
    if (value !== undefined && value !== null) {
      debouncedValidateField(value);
    }
  }, [value, debouncedValidateField]);

  return fieldState;
}