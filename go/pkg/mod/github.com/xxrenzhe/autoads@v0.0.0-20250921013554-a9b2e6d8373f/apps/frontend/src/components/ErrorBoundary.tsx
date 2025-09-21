'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { createClientLogger } from "@/lib/utils/security/client-secure-logger";
import { EnhancedError } from '@/lib/utils/error-handling';

const logger = createClientLogger('ErrorBoundary');

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  fallbackComponent?: React.ComponentType<ErrorFallbackProps>;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  context?: string;
  showHomeButton?: boolean;
  homeUrl?: string;
}

interface ErrorFallbackProps {
  error?: Error;
  resetError: () => void;
  goHome?: () => void;
  errorId?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
  errorId?: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
      errorId: Date.now().toString(36).toUpperCase()
    };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo
    });

    // 调用自定义错误处理器
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // 记录错误到控制台（开发环境）
    if (process.env.NODE_ENV === 'development') {
      console.error(`ErrorBoundary [${this.props.context || 'global'}] caught an error:`, error, errorInfo);
    }

    // 记录错误到日志系统
    logger.error(`ErrorBoundary [${this.props.context || 'global'}] caught an error:`, new EnhancedError(`ErrorBoundary [${this.props.context || 'global'}] caught an error:`, {
      errorMessage: error instanceof Error ? error.message : String(error),
      stack: error.stack,
      componentStack: errorInfo.componentStack
    }));

    // 报告错误到监控服务
    this.reportError(error, errorInfo);
  }

  reportError = (error: Error, errorInfo: ErrorInfo) => {
    try {
      const errorReport = {
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        timestamp: new Date().toISOString(),
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
        url: typeof window !== 'undefined' ? window.location.href : 'unknown',
        context: this.props.context || 'global',
        errorId: this.state.errorId
      };

      // 存储到localStorage用于调试
      if (typeof localStorage !== 'undefined') {
        const existingErrors = JSON.parse(localStorage.getItem('app_errors') || '[]');
        existingErrors.push(errorReport);
        
        // 只保留最近的20个错误
        if (existingErrors.length > 20) {
          existingErrors.splice(0, existingErrors.length - 20);
        }
        
        localStorage.setItem('app_errors', JSON.stringify(existingErrors));
      }
    } catch (reportingError) { 
      logger.error('Failed to report error:', new EnhancedError('Failed to report error:', { error: reportingError instanceof Error ? reportingError.message : String(reportingError) 
       }));
    }
  };

  handleRetry = () => { 
    this.setState({ hasError: false, error: undefined, errorInfo: undefined, errorId: undefined });
  };

  goHome = () => {
    const homeUrl = this.props.homeUrl || '/';
    if (typeof window !== 'undefined') {
      window.location.href = homeUrl;
    }
  };

  override render() {
    if (this.state.hasError) {
      // 如果提供了自定义fallback组件，使用它
      if (this.props.fallbackComponent) {
        const FallbackComponent = this.props.fallbackComponent;
        return (
          <FallbackComponent 
            error={this.state.error}
            resetError={this.handleRetry}
            goHome={this.props.showHomeButton ? this.goHome : undefined}
            errorId={this.state.errorId}
          />
        );
      }

      // 如果提供了自定义fallback JSX，使用它
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // 默认错误UI
      return <DefaultErrorFallback 
        error={this.state.error}
        resetError={this.handleRetry}
        goHome={this.props.showHomeButton ? this.goHome : undefined}
        errorId={this.state.errorId}
      />;
    }

    return this.props.children;
  }
}

// 默认错误回退组件
const DefaultErrorFallback: React.FC<ErrorFallbackProps> = ({ error, resetError, goHome, errorId }) => {
  const isDevelopment = process.env.NODE_ENV === 'development';

  return (
    <div className="min-h-[400px] flex items-center justify-center p-8">
      <Card className="max-w-2xl w-full">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <AlertTriangle className="w-8 h-8 text-red-600" />
          </div>
          <CardTitle className="text-2xl text-gray-900">
            {isDevelopment ? "系统遇到了一个错误" : "Something went wrong"}
          </CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="text-center text-gray-600">
            <p className="mb-2">
              {isDevelopment 
                ? "很抱歉，应用程序遇到了意外错误。我们已经记录了这个问题。" 
                : "We're sorry, but something unexpected happened. Please try refreshing the page."
              }
            </p>
            <p>
              {isDevelopment 
                ? "您可以尝试刷新页面或返回首页继续使用。" 
                : "You can try refreshing the page or go back to home."
              }
            </p>
          </div>

          {/* 开发环境下显示错误详情 */}
          {isDevelopment && error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <h4 className="text-sm font-medium text-red-800 mb-2">错误详情 (仅开发环境显示):</h4>
              <div className="text-xs text-red-700 font-mono bg-red-100 p-2 rounded overflow-auto max-h-40">
                <div className="mb-2">
                  <strong>错误消息:</strong> {error.message}
                </div>
                {error.stack && (
                  <div>
                    <strong>堆栈跟踪:</strong>
                    <pre className="whitespace-pre-wrap mt-1">{error.stack}</pre>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 操作按钮 */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button onClick={resetError} className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4" />
              {isDevelopment ? "重试" : "Try Again"}
            </Button>
            
            {goHome && (
              <Button variant="outline" onClick={goHome} className="flex items-center gap-2">
                <Home className="w-4 h-4" />
                {isDevelopment ? "返回首页" : "Go Home"}
              </Button>
            )}
            
            <Button 
              variant="outline" 
              onClick={() => typeof window !== 'undefined' && window.location.reload()}
              className="flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              {isDevelopment ? "刷新页面" : "Refresh Page"}
            </Button>
          </div>

          {/* 帮助信息 */}
          <div className="text-center text-sm text-gray-500 border-t pt-4">
            <p>
              {isDevelopment 
                ? "如果问题持续存在，请联系技术支持。" 
                : "If the problem persists, please contact technical support."
              }
            </p>
            {errorId && (
              <p className="mt-1">
                {isDevelopment ? "错误ID: " : "Error ID: "}{errorId}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// 简化的错误回退组件，用于小组件
export const SimpleErrorFallback: React.FC<ErrorFallbackProps> = ({ error, resetError }) => {
  return (
    <div className="bg-red-50 border border-red-200 rounded-md p-4 text-center">
      <AlertTriangle className="w-6 h-6 text-red-600 mx-auto mb-2" />
      <p className="text-sm text-red-800 mb-3">
        {error?.message || '组件加载失败'}
      </p>
      <Button size="sm" variant="outline" onClick={resetError}>
        重试
      </Button>
    </div>
  );
};

// Hook版本的错误边界（用于函数组件）
export function useErrorHandler() {
  return (error: Error, errorInfo?: any) => {
    console.error('Error caught by useErrorHandler:', error, errorInfo);
    logger.error('Error caught by useErrorHandler:', new EnhancedError('Error caught by useErrorHandler:', { error: error instanceof Error ? error.message : String(error),
      errorInfo
     }));
    
    // 这里可以添加错误报告逻辑
    // reportErrorToService(error, errorInfo);
  };
}

// 高阶组件版本
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  options?: {
    fallback?: ReactNode;
    fallbackComponent?: React.ComponentType<ErrorFallbackProps>;
    onError?: (error: Error, errorInfo: ErrorInfo) => void;
    context?: string;
    showHomeButton?: boolean;
    homeUrl?: string;
  }
) {
  return function WrappedComponent(props: P) {
    return (
      <ErrorBoundary {...options}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
}

// 加载状态组件
export const LoadingFallback: React.FC<{ message?: string }> = ({ 
  message = '加载中...' 
}) => {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">{message}</p>
      </div>
    </div>
  );
};

// 空状态组件
export const EmptyState: React.FC<{
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}> = ({ 
  icon: Icon = AlertTriangle, 
  title, 
  description, 
  action 
}) => {
  return (
    <div className="text-center py-12">
      <Icon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
      <h3 className="text-lg font-medium text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600 mb-6 max-w-md mx-auto">{description}</p>
      {action && (
        <Button onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
};

export default ErrorBoundary;
