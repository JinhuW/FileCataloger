/**
 * @file FeatureErrorBoundary.tsx
 * @description Error boundary specifically designed for feature components.
 * Provides better error handling and recovery options for isolated features.
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { logger } from '@shared/logger';

interface Props {
  children: ReactNode;
  featureName: string;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  showDetails?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class FeatureErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const { featureName, onError } = this.props;

    logger.error(`Error in ${featureName} feature:`, error, errorInfo);

    this.setState({ errorInfo });

    if (onError) {
      onError(error, errorInfo);
    }
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render(): ReactNode {
    const { hasError, error, errorInfo } = this.state;
    const { children, featureName, fallback, showDetails = false } = this.props;

    if (hasError) {
      if (fallback) {
        return fallback;
      }

      return (
        <div
          style={{
            padding: '24px',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '12px',
            color: 'rgba(255, 255, 255, 0.9)',
          }}
        >
          <h3
            style={{
              margin: '0 0 12px 0',
              fontSize: '16px',
              fontWeight: 600,
              color: '#ef4444',
            }}
          >
            ⚠️ {featureName} Error
          </h3>
          <p
            style={{
              margin: '0 0 16px 0',
              fontSize: '14px',
              color: 'rgba(255, 255, 255, 0.8)',
            }}
          >
            Something went wrong in the {featureName} feature. You can try reloading the feature or
            continue using other parts of the application.
          </p>

          {showDetails && error && (
            <details
              style={{
                marginBottom: '16px',
                fontSize: '12px',
                color: 'rgba(255, 255, 255, 0.6)',
              }}
            >
              <summary style={{ cursor: 'pointer', marginBottom: '8px' }}>Error Details</summary>
              <pre
                style={{
                  background: 'rgba(0, 0, 0, 0.3)',
                  padding: '12px',
                  borderRadius: '6px',
                  overflow: 'auto',
                  maxHeight: '200px',
                }}
              >
                {error.toString()}
                {errorInfo && `\n\nComponent Stack:${errorInfo.componentStack}`}
              </pre>
            </details>
          )}

          <button
            onClick={this.handleReset}
            style={{
              background: '#ef4444',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'background 0.2s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = '#dc2626';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = '#ef4444';
            }}
          >
            Try Again
          </button>
        </div>
      );
    }

    return children;
  }
}
