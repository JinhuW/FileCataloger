/**
 * @file shelf.tsx
 * @description Entry point for the file rename window in FileCataloger.
 * This file bootstraps the rename window that appears when users shake their mouse
 * while dragging files, allowing for batch file renaming operations.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { logger } from '@shared/logger';
import { AppProviders } from './app/providers/AppProviders';
import { ShelfPage } from './pages/shelf/ShelfPage';
import './styles/globals.css';

// Add global error handler to catch rendering errors
window.addEventListener('error', event => {
  logger.error('Global error caught:', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    error: event.error?.stack,
  });
});

window.addEventListener('unhandledrejection', event => {
  logger.error('Unhandled promise rejection:', {
    reason: event.reason,
    promise: event.promise,
  });
});

// Log when DOM is ready
logger.info('Shelf window DOM loaded, attempting to mount React app');

// Mount the application
const container = document.getElementById('root');
if (container) {
  logger.info('Root element found, creating React root');

  try {
    const root = ReactDOM.createRoot(container);
    logger.info('React root created, rendering ShelfPage component');

    root.render(
      <React.StrictMode>
        <AppProviders>
          <ShelfPage />
        </AppProviders>
      </React.StrictMode>
    );

    logger.info('React render call completed');
  } catch (error) {
    logger.error('Failed to render React app:', error);
    // Show visible error in the window
    container.innerHTML = `<div style="color: red; padding: 20px;">Failed to render shelf: ${error}</div>`;
  }
} else {
  logger.error('Failed to find root element');
  document.body.innerHTML =
    '<div style="color: red; padding: 20px;">Error: No root element found</div>';
}
