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
import { FileRenameShelf } from './components/FileRenameShelf';
import { ShelfConfig, ShelfItem } from '@shared/types';
import { logger } from '@shared/logger';
import { isShelfConfig, isShelfItem } from './utils/typeGuards';
import './styles/globals.css';

/**
 * Shelf window renderer entry point
 */
const ShelfWindow: React.FC = () => {
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

    // Update local state first
    setConfig(prev => {
      const newConfig = {
        ...prev,
        items: [...prev.items, item],
      };
      logger.debug('Updated local config, now has', newConfig.items.length, 'items');

      // Immediately notify backend that shelf has items
      if (window.api && prev.items.length === 0 && newConfig.items.length > 0) {
        logger.debug('First item added! Notifying backend to persist shelf');
        // Send a simple message that shelf now has content
        window.api.send('shelf:files-dropped', {
          shelfId: prev.id,
          files: [item.name], // Just send something to trigger persistence
        });
      }

      return newConfig;
    });

    // Notify main process
    if (window.api) {
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

// Mount the application
const container = document.getElementById('root');
if (container) {
  const root = ReactDOM.createRoot(container);
  root.render(
    <React.StrictMode>
      <ShelfWindow />
    </React.StrictMode>
  );
} else {
  logger.error('Failed to find root element');
}
