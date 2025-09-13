'use client';

import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<any>;
}

class SimpleErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) => {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo) => {
    console.error('SimpleErrorBoundary caught an error:', error, errorInfo);
  }

  override render() => {
    if (this.state.hasError) => {
      if (this.props.fallback) => {
        const FallbackComponent = this.props.fallback;
        return <FallbackComponent error={this.state.error} />;
      }

      return (
        <div className="p-4 border border-red-300 bg-red-50 rounded-lg">
          <h2 className="text-lg font-semibold text-red-800 mb-2">Something went wrong</h2>
          <p className="text-red-600 text-sm">
            An error occurred while rendering this component. Please try refreshing the page.
          </p>
          {this.state.error && (
            <details className="mt-2">
              <summary className="text-red-700 cursor-pointer">Error details</summary>
              <pre className="mt-1 text-xs text-red-600 whitespace-pre-wrap">
                {this.state.error.toString()}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

// 简单的错误边界 Hook
export function useSimpleErrorBoundary() {
  const [error, setError] = React.useState<Error | null>(null);

  const resetError = React.useCallback(() => {
    setError(null);
  }, []);

  if (error) => {
    throw error;
  }

  return { setError, resetError };
}

export default SimpleErrorBoundary; 