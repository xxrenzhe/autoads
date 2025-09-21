/**
 * Error Boundary Utilities
 * 
 * Utilities for component error handling and error boundary management.
 */

import React from 'react'

/**
 * Error boundary state
 */
export interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
  errorInfo?: React.ErrorInfo
  errorId?: string
}

/**
 * Error boundary props
 */
export interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ReactNode
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
  boundaryId?: string
}

/**
 * Error boundary fallback component props
 */
export interface ErrorBoundaryFallbackProps {
  error: Error
  errorInfo?: React.ErrorInfo
  resetError: () => void
  boundaryId?: string
}

/**
 * Default error fallback component
 */
export const DefaultErrorFallback: React.FC<ErrorBoundaryFallbackProps> = ({
  error,
  resetError,
  boundaryId
}) => (
  <div className="error-boundary-fallback" style={{
    padding: '20px',
    border: '1px solid #ff6b6b',
    borderRadius: '4px',
    backgroundColor: '#ffe0e0',
    color: '#d63031',
    margin: '10px 0'
  }}>
    <h3>Something went wrong</h3>
    <details style={{ whiteSpace: 'pre-wrap', marginTop: '10px' }}>
      <summary>Error details</summary>
      <p><strong>Error:</strong> {error.message}</p>
      {boundaryId && <p><strong>Boundary:</strong> {boundaryId}</p>}
      <p><strong>Stack:</strong></p>
      <pre style={{ fontSize: '12px', overflow: 'auto' }}>
        {error.stack}
      </pre>
    </details>
    <button 
      onClick={resetError}
      style={{
        marginTop: '10px',
        padding: '8px 16px',
        backgroundColor: '#ff6b6b',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer'
      }}
    >
      Try again
    </button>
  </div>
)

/**
 * Error boundary class component
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error }
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({
      error,
      errorInfo,
      errorId: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    })

    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }
  }

  resetError = () => {
    this.setState({
      hasError: false,
      error: undefined,
      errorInfo: undefined,
      errorId: undefined
    })
  }

  override render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }
      
      return (
        <DefaultErrorFallback
          error={this.state.error!}
          errorInfo={this.state.errorInfo}
          resetError={this.resetError}
          boundaryId={this.props.boundaryId}
        />
      )
    }

    return this.props.children
  }
}

/**
 * Hook-based error boundary
 */
export function useErrorHandler(boundaryId?: string): (error: Error) => void {
  const [error, setError] = React.useState<Error | null>(null)

  if (error) {
    throw error
  }

  return React.useCallback((error: Error) => {
    setError(error)
  }, [])
}

/**
 * Error boundary context
 */
export const ErrorBoundaryContext = React.createContext<{
  handleError: (error: Error) => void
  boundaryId?: string
}>({
  handleError: () => {}
})

/**
 * Error boundary provider
 */
export const ErrorBoundaryProvider: React.FC<{
  children: React.ReactNode
  boundaryId?: string
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
}> = ({ children, boundaryId, onError }) => {
  const [error, setError] = React.useState<Error | null>(null)

  const handleError = React.useCallback((error: Error) => {
    setError(error)
  }, [])

  if (error) {
    return (
      <DefaultErrorFallback
        error={error}
        resetError={() => setError(null)}
        boundaryId={boundaryId}
      />
    )
  }

  return (
    <ErrorBoundaryContext.Provider value={{ handleError, boundaryId }}>
      {children}
    </ErrorBoundaryContext.Provider>
  )
}

/**
 * Higher-order component for error boundaries
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
) {
  return function WithErrorBoundary(props: P) {
    return (
      <ErrorBoundary {...errorBoundaryProps}>
        <Component {...props} />
      </ErrorBoundary>
    )
  }
}