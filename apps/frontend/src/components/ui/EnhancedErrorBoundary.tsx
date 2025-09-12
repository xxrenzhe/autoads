/**
 * Enhanced Error Boundary Component
 * Uses the unified error handling system for consistent error reporting
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { createCategoryLogger } from '@/lib/utils/centralized-logging';
import { BaseAppError, NetworkError, ErrorUtils } from '@/lib/utils/unified-error-handling';
import { useErrorHandler } from '@/components/ui/ErrorBoundary';

const logger = createCategoryLogger('ReactErrorBoundary');

interface EnhancedErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode | ((error: BaseAppError, errorInfo: ErrorInfo) => ReactNode);
  onError?: (error: BaseAppError, errorInfo: ErrorInfo) => void;
  resetKeys?: Array<string | number>;
  resetOnPropsChange?: boolean;
  context?: string;
}

interface EnhancedErrorBoundaryState {
  hasError: boolean;
  error: BaseAppError | null;
  errorInfo: ErrorInfo | null;
}

export class EnhancedErrorBoundary extends Component<EnhancedErrorBoundaryProps, EnhancedErrorBoundaryState> {
  constructor(props: EnhancedErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): Partial<EnhancedErrorBoundaryState> {
    // Convert to BaseAppError
    const appError = ErrorUtils.fromUnknown(error, 'ReactComponent');
    return {
      hasError: true,
      error: appError
    };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Convert to BaseAppError
    const appError = ErrorUtils.fromUnknown(error, this.props.context || 'ReactComponent');
    
    this.setState({
      error: appError,
      errorInfo
    });

    // Log the error with full context
    logger.error('React Error Boundary caught error', appError, {
      componentStack: errorInfo.componentStack,
      context: this.props.context,
      timestamp: new Date().toISOString()
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(appError, errorInfo);
    }

    // Report to error tracking service if available
    this.reportToErrorTracking(appError, errorInfo);
  }

  override componentDidUpdate(prevProps: EnhancedErrorBoundaryProps) {
    const { resetKeys, resetOnPropsChange } = this.props;
    const { hasError } = this.state;

    // Check if we should reset the error state
    if (
      hasError &&
      ((resetOnPropsChange && prevProps !== this.props) ||
        (resetKeys && prevProps.resetKeys !== resetKeys))
    ) {
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

  override render() {
    const { hasError, error, errorInfo } = this.state;
    const { children, fallback } = this.props;

    if (!hasError || !error) {
      return children;
    }

    // Render custom fallback if provided
    if (fallback) {
      if (typeof fallback === 'function') {
        return fallback(error, errorInfo!);
      }
      return fallback;
    }

    // Default error UI
    return (
      <div className="min-h-[200px] flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">
            出现了一个错误
          </h2>
          <p className="text-gray-600 mb-4">
            {error.userMessage}
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
          
          {/* Show error details in development */}
          {process.env.NODE_ENV === 'development' && errorInfo && (
            <details className="mt-4 text-left">
              <summary className="cursor-pointer text-sm text-gray-500">
                错误详情 (开发模式)
              </summary>
              <div className="mt-2 p-4 bg-gray-100 rounded text-xs overflow-auto">
                <div className="mb-2">
                  <strong>错误代码:</strong> {error.code}
                </div>
                <div className="mb-2">
                  <strong>状态码:</strong> {error.statusCode}
                </div>
                <div className="mb-2">
                  <strong>错误消息:</strong> {error.message}
                </div>
                <div className="mb-2">
                  <strong>上下文:</strong> {error.context || 'N/A'}
                </div>
                <details className="mt-2">
                  <summary className="cursor-pointer text-gray-600">堆栈跟踪</summary>
                  <pre className="mt-1 p-2 bg-gray-200 rounded text-xs overflow-auto">
                    {error.stack}
                  </pre>
                </details>
                <details className="mt-2">
                  <summary className="cursor-pointer text-gray-600">组件堆栈</summary>
                  <pre className="mt-1 p-2 bg-gray-200 rounded text-xs overflow-auto">
                    {errorInfo.componentStack}
                  </pre>
                </details>
              </div>
            </details>
          )}
        </div>
      </div>
    );
  }

  /**
   * Report error to error tracking service
   */
  private reportToErrorTracking(error: BaseAppError, errorInfo: ErrorInfo): void {
    // This could integrate with services like Sentry, LogRocket, etc.
    if (typeof window !== 'undefined' && (window as any).Sentry) {
      (window as any).Sentry.withScope((scope: any) => {
        scope.setUser({ id: 'current-user' }); // Get actual user ID from auth context
        scope.setTag('context', this.props.context || 'ReactComponent');
        scope.setExtra('componentStack', errorInfo.componentStack);
        scope.setExtra('errorDetails', error.details);
        
        (window as any).Sentry.captureException(error);
      });
    }

    // Log security event for errors that might indicate security issues
    if (error.statusCode === 401 || error.statusCode === 403) {
      logger.security(
        'authentication_error',
        'medium',
        `Authentication error in React component: ${error.message}`,
        {
          context: this.props.context,
          error: error.toJSON()
        }
      );
    }
  }
}

// Hook-based error boundary
export function useEnhancedErrorHandler(context?: string) {
  const { resetError, captureError } = useErrorHandler();

  const captureEnhancedError = React.useCallback((error: Error | BaseAppError) => {
    const appError = error instanceof BaseAppError ? error : ErrorUtils.fromUnknown(error, context || 'ReactHook');
    
    logger.error('Hook caught error', appError, {
      context,
      timestamp: new Date().toISOString()
    });
    
    captureError(appError);
  }, [context, captureError]);

  return { resetError, captureError: captureEnhancedError };
}

// Component for handling async errors
interface AsyncErrorBoundaryProps {
  children: (props: { 
    retry: () => void;
    error: BaseAppError | null;
    loading: boolean;
  }) => ReactNode;
  fallback?: ReactNode;
  onError?: (error: BaseAppError) => Promise<boolean> | void;
  maxRetries?: number;
  retryDelay?: number;
  context?: string;
}

export function AsyncEnhancedErrorBoundary({
  children,
  fallback,
  onError,
  maxRetries = 3,
  retryDelay = 1000,
  context
}: AsyncErrorBoundaryProps) {
  const [error, setError] = React.useState<BaseAppError | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [retryCount, setRetryCount] = React.useState(0);
  const { captureError: captureEnhancedError } = useEnhancedErrorHandler(context);

  const execute = React.useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // The actual operation should be implemented by the children
      setLoading(false);
    } catch (err) {
      const caughtError = err instanceof BaseAppError 
        ? err 
        : ErrorUtils.fromUnknown(err, context || 'AsyncOperation');
      
      setError(caughtError);
      setLoading(false);
      captureEnhancedError(caughtError);

      // Check if we should retry
      if (onError && retryCount < maxRetries) {
      const shouldRetry = await onError(caughtError);
      // Note: onError might return void, so we check explicitly for true
      if (shouldRetry === true) {
          setRetryCount(prev => prev + 1);
          setTimeout(execute, retryDelay * Math.pow(2, retryCount)); // Exponential backoff
        }
      }
    }
  }, [onError, retryCount, maxRetries, retryDelay, context, captureEnhancedError]);

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

// Network error boundary with automatic reconnection
interface NetworkErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onNetworkError?: (error: BaseAppError) => void;
  context?: string;
}

export function NetworkEnhancedErrorBoundary({ 
  children, 
  fallback, 
  onNetworkError,
  context 
}: NetworkErrorBoundaryProps) {
  const [isOnline, setIsOnline] = React.useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const { captureError: captureEnhancedError } = useEnhancedErrorHandler(context);

  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => {
      setIsOnline(false);
      const error = new NetworkError(
        'Network',
        'Network connection lost',
        { statusCode: 503 },
        context
      );
      captureEnhancedError(error);
      onNetworkError?.(error);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [onNetworkError, context, captureEnhancedError]);

  if (!isOnline) {
    if (fallback) {
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

export default EnhancedErrorBoundary;