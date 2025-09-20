/**
 * @file shelf.tsx
 * @description Entry point for the file rename window in FileCataloger.
 * This file bootstraps the rename window that appears when users shake their mouse
 * while dragging files, allowing for batch file renaming operations.
 *
 * @features
 * - Dual mode support (default shelf / rename shelf)
 * - Real-time IPC communication with main process
 * - State synchronization between renderer and main
 * - Automatic mode switching based on config
 *
 * @ipc-channels
 * - shelf:config - Receives complete shelf configuration
 * - shelf:add-item - Adds item to shelf
 * - shelf:remove-item - Removes item from shelf
 * - shelf:close - Closes the shelf window
 */

import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { ShelfConfig, ShelfItem } from '@shared/types';
import { logger } from '@shared/logger';
import { isShelfConfig, isShelfItem } from './utils/typeGuards';
import { FileRenameShelf } from './components/FileRenameShelf';
import './styles/globals.css';

/**
 * Shelf window renderer entry point
 */
const ShelfWindow: React.FC = () => {
  logger.info('ShelfWindow component initializing');

  const [config, setConfig] = useState<ShelfConfig>({
    id: 'default',
    position: { x: 0, y: 0 },
    dockPosition: null,
    isPinned: true,
    items: [],
    isVisible: true,
    opacity: 0.95,
    mode: 'rename', // Always use rename mode
  });

  // Log component lifecycle
  useEffect(() => {
    logger.info('ShelfWindow component mounted');
    return () => {
      logger.info('ShelfWindow component unmounting');
    };
  }, []);

  // Debug window API in development only
  if (process.env.NODE_ENV === 'development') {
    logger.debug('Window API debug on mount:');
    logger.debug('  - window.api:', window.api);
    logger.debug('  - window.electronAPI:', window.electronAPI);
    logger.debug('  - typeof window.api:', typeof window.api);
    logger.debug('  - typeof window.electronAPI:', typeof window.electronAPI);
  }

  useEffect(() => {
    if (!window.api) return;

    const cleanups: (() => void)[] = [];

    // Listen for configuration updates
    cleanups.push(
      window.api.on('shelf:config', (newConfig: unknown) => {
        if (isShelfConfig(newConfig)) {
          logger.debug(
            'Received shelf config:',
            newConfig.id,
            'with',
            newConfig.items.length,
            'items'
          );
          setConfig(newConfig);
        } else if (process.env.NODE_ENV === 'development') {
          logger.warn('Received invalid shelf config:', newConfig);
        }
      })
    );

    // Listen for item additions
    cleanups.push(
      window.api.on('shelf:add-item', (item: unknown) => {
        if (isShelfItem(item)) {
          setConfig(prev => ({
            ...prev,
            items: [...prev.items, item],
          }));
        } else if (process.env.NODE_ENV === 'development') {
          logger.warn('Received invalid shelf item:', item);
        }
      })
    );

    // Listen for item removals
    cleanups.push(
      window.api.on('shelf:remove-item', (itemId: unknown) => {
        if (typeof itemId === 'string') {
          setConfig(prev => ({
            ...prev,
            items: prev.items.filter(item => item.id !== itemId),
          }));
        } else if (process.env.NODE_ENV === 'development') {
          logger.warn('Received invalid item ID:', itemId);
        }
      })
    );

    // Cleanup all listeners on unmount
    return () => {
      cleanups.forEach(cleanup => cleanup());
    };
  }, []);

  const handleConfigChange = (changes: Partial<ShelfConfig>) => {
    const newConfig = { ...config, ...changes };
    setConfig(newConfig);

    // Notify main process of configuration changes
    if (window.api) {
      window.api.invoke('shelf:update-config', config.id, changes);
    }
  };

  const handleItemAdd = (item: ShelfItem) => {
    logger.debug('handleItemAdd called for shelf', config.id, 'with item:', item);

    // Check if this is the first item being added
    const isFirstItem = config.items.length === 0;

    // Update local state first
    setConfig(prev => ({
      ...prev,
      items: [...prev.items, item],
    }));

    // Notify main process
    if (window.api) {
      // If this is the first item, notify backend to persist shelf
      if (isFirstItem) {
        logger.debug('First item added! Notifying backend to persist shelf');
        window.api.send('shelf:files-dropped', {
          shelfId: config.id,
          files: [item.name],
        });
      }

      logger.debug('Sending shelf:add-item IPC call for shelf', config.id);
      window.api
        .invoke('shelf:add-item', config.id, item)
        .then(result => {
          logger.debug('IPC shelf:add-item succeeded:', result);
        })
        .catch(err => {
          logger.error('Failed to add item via IPC:', err);
          logger.error('Shelf ID:', config.id);
          logger.error('Item:', item);
        });
    } else {
      logger.error('window.api is not available!');
    }
  };

  const handleItemRemove = (itemId: string) => {
    setConfig(prev => ({
      ...prev,
      items: prev.items.filter(item => item.id !== itemId),
    }));

    // Notify main process
    if (window.api) {
      window.api.invoke('shelf:remove-item', config.id, itemId);
    }
  };

  const handleClose = () => {
    if (window.api) {
      window.api.invoke('shelf:close', config.id);
    }
  };

  logger.info('ShelfWindow rendering with config:', config);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'transparent',
        padding: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <FileRenameShelf
        config={config}
        onConfigChange={handleConfigChange}
        onItemAdd={handleItemAdd}
        onItemRemove={handleItemRemove}
        onClose={handleClose}
      />
    </div>
  );
};

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
    logger.info('React root created, rendering ShelfWindow component');

    root.render(
      <React.StrictMode>
        <ShelfWindow />
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
