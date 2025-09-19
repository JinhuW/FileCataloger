/**
 * @file ErrorBoundary.tsx
 * @description React error boundary component that catches and gracefully handles JavaScript errors
 * in component trees, providing a fallback UI and logging capabilities.
 *
 * @props {React.ReactNode} children - The component tree to wrap and protect
 * @props {React.ComponentType} fallback - Optional custom fallback component to render on error
 *
 * @features
 * - Catches JavaScript errors anywhere in the child component tree
 * - Logs error details using the shared logger module
 * - Provides retry functionality to attempt recovery
 * - Shows development-friendly error details in dev mode
 * - Customizable fallback UI through props
 *
 * @usage
 * ```tsx
 * <ErrorBoundary fallback={CustomErrorComponent}>
 *   <MyComponent />
 * </ErrorBoundary>
 * ```
 */

import React, { Component, ErrorInfo } from 'react';
import { logger } from '@shared/logger';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error: Error; retry: () => void }>;
}
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);

    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    logger.error('ErrorBoundary caught an error:', error, errorInfo);

    this.setState({
      error,
      errorInfo,
    });

    // Log to analytics or error reporting service
    // TODO: Implement error reporting
  }

  handleRetry = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      const { fallback: Fallback } = this.props;

      if (Fallback && this.state.error) {
        return <Fallback error={this.state.error} retry={this.handleRetry} />;
      }

      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '200px',
            padding: '20px',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '8px',
            color: 'white',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '24px', marginBottom: '16px' }}>⚠️</div>

          <h3
            style={{
              margin: '0 0 8px 0',
              fontSize: '16px',
              color: '#ef4444',
            }}
          >
            Something went wrong
          </h3>

          <p
            style={{
              margin: '0 0 16px 0',
              fontSize: '14px',
              opacity: 0.8,
            }}
          >
            {this.state.error?.message || 'An unexpected error occurred'}
          </p>

          <button
            onClick={this.handleRetry}
            style={{
              background: 'rgba(59, 130, 246, 0.2)',
              border: '1px solid rgba(59, 130, 246, 0.4)',
              borderRadius: '6px',
              color: 'rgba(59, 130, 246, 0.9)',
              padding: '8px 16px',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            Try again
          </button>

          {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
            <details
              style={{
                marginTop: '16px',
                fontSize: '12px',
                opacity: 0.7,
                maxWidth: '100%',
                overflow: 'auto',
              }}
            >
              <summary style={{ cursor: 'pointer', marginBottom: '8px' }}>Error details</summary>
              <pre
                style={{
                  whiteSpace: 'pre-wrap',
                  wordWrap: 'break-word',
                  textAlign: 'left',
                  background: 'rgba(0, 0, 0, 0.3)',
                  padding: '8px',
                  borderRadius: '4px',
                }}
              >
                {`${this.state.error?.stack || ''}\n${this.state.errorInfo.componentStack || ''}`}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
