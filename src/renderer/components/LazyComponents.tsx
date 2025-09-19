/**
 * @file LazyComponents.tsx
 * @description Centralized lazy loading configuration for performance optimization.
 * These components are loaded on demand to reduce initial bundle size.
 */

import React, { lazy, Suspense, ComponentType } from 'react';
import { ShelfConfig, ShelfItem } from '@shared/types';

// Loading fallback component
const LoadingFallback: React.FC<{ message?: string }> = ({ message = 'Loading...' }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      padding: '20px',
    }}
  >
    <div style={{ textAlign: 'center', color: 'rgba(255, 255, 255, 0.7)' }}>
      <div
        style={{
          width: '40px',
          height: '40px',
          border: '3px solid rgba(255, 255, 255, 0.1)',
          borderTopColor: 'rgba(255, 255, 255, 0.7)',
          borderRadius: '50%',
          margin: '0 auto 16px',
          animation: 'spin 1s linear infinite',
        }}
      />
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
      <p style={{ margin: 0, fontSize: '14px' }}>{message}</p>
    </div>
  </div>
);

// Lazy loaded components
export const FileRenameShelf = lazy(() =>
  import('./FileRenameShelf').then(module => ({
    default: module.FileRenameShelf,
  }))
);

export const VirtualizedList = lazy(() =>
  import('./VirtualizedList').then(module => ({
    default: module.VirtualizedList,
  }))
);

export const RenamePatternBuilder = lazy(() =>
  import('./RenamePatternBuilder').then(module => ({
    default: module.RenamePatternBuilder,
  }))
);

export const FileRenamePreviewList = lazy(() =>
  import('./FileRenamePreviewList').then(module => ({
    default: module.FileRenamePreviewList,
  }))
);

// Wrapper components with proper typing
interface LazyFileRenameShelfProps {
  config: ShelfConfig;
  onConfigChange: (config: Partial<ShelfConfig>) => void;
  onItemAdd: (item: ShelfItem) => void;
  onItemRemove: (itemId: string) => void;
  onClose: () => void;
}

export const LazyFileRenameShelf: React.FC<LazyFileRenameShelfProps> = props => (
  <Suspense fallback={<LoadingFallback message="Loading rename shelf..." />}>
    <FileRenameShelf {...props} />
  </Suspense>
);

// Create a generic wrapper for lazy components
export function withLazyLoading<P extends object>(
  Component: ComponentType<P>,
  loadingMessage?: string
): React.FC<P> {
  return (props: P) => (
    <Suspense fallback={<LoadingFallback message={loadingMessage} />}>
      <Component {...props} />
    </Suspense>
  );
}

// Preload function for critical components
export const preloadComponents = () => {
  // Preload components that are likely to be used
  import('./FileRenameShelf');
  import('./VirtualizedList');
};

// Component-specific preload functions
export const preloadFileRenameShelf = () => import('./FileRenameShelf');
export const preloadVirtualizedList = () => import('./VirtualizedList');
export const preloadRenamePatternBuilder = () => import('./RenamePatternBuilder');
export const preloadFileRenamePreviewList = () => import('./FileRenamePreviewList');
