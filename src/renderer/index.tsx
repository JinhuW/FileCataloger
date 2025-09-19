/**
 * @file index.tsx
 * @description Main entry point for the FileCataloger dashboard/status window.
 * This file bootstraps the React application that displays system metrics and
 * application status. It's loaded when the main application window is created.
 *
 * @usage This is the entry point for the main application window, not shelf windows.
 * Shelf windows use shelf.tsx as their entry point.
 */

import React, { lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/globals.css';

// Lazy load the App component for code splitting
const App = lazy(() => import('./App'));

// Loading component
const AppLoader = () => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: 'white',
    }}
  >
    <div style={{ textAlign: 'center' }}>
      <div
        style={{
          width: '48px',
          height: '48px',
          border: '4px solid #e5e7eb',
          borderTopColor: '#3b82f6',
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
      <p style={{ color: '#6b7280', fontSize: '16px' }}>Loading FileCataloger...</p>
    </div>
  </div>
);

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root container not found');
}

const root = createRoot(container);
root.render(
  <Suspense fallback={<AppLoader />}>
    <App />
  </Suspense>
);
