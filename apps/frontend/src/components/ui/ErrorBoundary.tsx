/**
 * React错误边界组件
 * 用于捕获组件树中的JavaScript错误
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { createClientLogger } from '@/lib/utils/security/client-secure-logger';
import { EnhancedError } from '@/lib/utils/error-handling';

const logger = createClientLogger('ErrorBoundary');

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode | ((error: Error, errorInfo: ErrorInfo) => ReactNode);
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  resetKeys?: Array<string | number>;
  resetOnPropsChange?: boolean;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) => {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error
    };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) => {
    this.setState({
      error,
      errorInfo
    });

    // 记录错误日志
    logger.error('ErrorBoundary捕获到错误:', new EnhancedError('ErrorBoundary捕获到错误:', { error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack
     }));

    // 调用自定义错误处理函数
    if (this.props.onError) => {
      this.props.onError(error, errorInfo);
    }
  }

  override componentDidUpdate(prevProps: ErrorBoundaryProps) => {
    const { resetKeys, resetOnPropsChange } = this.props;
    const { hasError } = this.state;

    // 检查是否需要重置错误状态
    if (
      hasError &&
      ((resetOnPropsChange && prevProps !== this.props) ||
        (resetKeys && prevProps.resetKeys !== resetKeys))
    ) => {
      this.resetErrorBoundary();
    }
  }

  resetErrorBoundary = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  override render() => {
    const { hasError, error, errorInfo } = this.state;
    const { children, fallback } = this.props;

    if (!hasError || !error) => {
      return children;
    }

    // 渲染错误回退UI
    if (fallback) => {
      if (typeof fallback === 'function') => {
        return fallback(error, errorInfo!);
      }
      return fallback;
    }

    // 默认错误UI
    return (
      <div className="min-h-[200px] flex items-center justify-center p-6">
        <div className="text-center">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">
            出现了一个错误
          </h2>
          <p className="text-gray-600 mb-4">
            {error.message}
          </p>
          <div className="space-y-2">
            <button
              onClick={this.resetErrorBoundary}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
            >
              重试
            </button>
            <button
              onClick={() => window.location.reload()}
              className="ml-2 px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
            >
              刷新页面
            </button>
          </div>
          {process.env.NODE_ENV === 'development' && errorInfo && (
            <details className="mt-4 text-left">
              <summary className="cursor-pointer text-sm text-gray-500">
                错误详情
              </summary>
              <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-auto">
                {error.stack}
                {'\n\nComponent Stack:\n'}
                {errorInfo.componentStack}
              </pre>
            </details>
          )}
        </div>
      </div>
    );
  }
}

// 便捷的Hook版本
export function useErrorHandler() {
  const [error, setError] = React.useState<Error | null>(null);

  const resetError = React.useCallback(() => {
    setError(null);
  }, []);

  const captureError = React.useCallback((error: Error) => {
    setError(error);
    logger.error('Hook捕获到错误:', new EnhancedError('Hook捕获到错误:', { error: error.message,
      stack: error.stack
     }));
  }, []);

  // 如果有错误，抛出它以被ErrorBoundary捕获
  if (error) => {
    throw error;
  }

  return { resetError, captureError };
}

// 异步错误边界组件
interface AsyncErrorBoundaryProps {
  children: (props: { 
    retry: () => void;
    error: Error | null;
    loading: boolean;
  }) => ReactNode;
  retry?: (error: Error, retryCount: number) => Promise<boolean>;
  maxRetries?: number;
  retryDelay?: number;
}

export function AsyncErrorBoundary({
  children,
  retry,
  maxRetries = 3,
  retryDelay = 1000
}: .*Props) {
  const [error, setError] = React.useState<Error | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [retryCount, setRetryCount] = React.useState(0);

  const execute = React.useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // 这里应该执行异步操作
      // 由于这是一个通用组件，具体操作由children处理
      setLoading(false);
    } catch (err) => {
      const caughtError = err instanceof Error ? err : new Error(String(err));
      setError(caughtError);
      setLoading(false);

      // 检查是否可以重试
      if (retry && retryCount < maxRetries) => {
        const shouldRetry = await retry(caughtError, retryCount);
        if (shouldRetry) => {
          setRetryCount(prev => prev + 1);
          setTimeout(execute, retryDelay * Math.pow(2, retryCount)); // 指数退避
        }
      }
    }
  }, [retry, retryCount, maxRetries, retryDelay]);

  const retryOperation = React.useCallback(() => {
    setRetryCount(0);
    setError(null);
    execute();
  }, [execute]);

  React.useEffect(() => {
    execute();
  }, [execute]);

  return children({ retry: retryOperation, error, loading });
}

// 网络错误边界组件
interface NetworkErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onNetworkError?: (error: Error) => void;
}

export function NetworkErrorBoundary({ 
  children, 
  fallback, 
  onNetworkError 
}: .*Props) {
  const [isOnline, setIsOnline] = React.useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOnline) => {
    if (fallback) => {
      return <>{fallback}</>;
    }
    
    return (
      <div className="min-h-[200px] flex items-center justify-center p-6">
        <div className="text-center">
          <div className="text-6xl mb-4">🌐</div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">
            网络连接已断开
          </h2>
          <p className="text-gray-600 mb-4">
            请检查您的网络连接并重试
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            重新连接
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export default ErrorBoundary;