/**
 * @file ShelfPage.tsx
 * @description Page component for the file rename shelf window in FileCataloger.
 * This component handles the shelf functionality that appears when users shake their mouse
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
import { ShelfConfig, ShelfItem } from '@shared/types';
import { logger } from '@shared/logger';
import { isShelfConfig, isShelfItem } from '@renderer/utils/typeGuards';
import { FileRenameShelf } from '@renderer/features/rename/FileRenameShelf';
import { useIPC } from '@renderer/hooks/useIPC';

export const ShelfPage: React.FC = () => {
  logger.info('ShelfPage component initializing');

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

  const { invoke, send, on, isConnected } = useIPC();

  // Log component lifecycle
  useEffect(() => {
    logger.info('ShelfPage component mounted');
    return () => {
      logger.info('ShelfPage component unmounting');
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
    if (!isConnected) return;

    const cleanups: (() => void)[] = [];

    // Listen for configuration updates
    cleanups.push(
      on('shelf:config', (newConfig: unknown) => {
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
      on('shelf:add-item', (item: unknown) => {
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
      on('shelf:remove-item', (itemId: unknown) => {
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
  }, [isConnected, on]);

  const handleConfigChange = async (changes: Partial<ShelfConfig>) => {
    const newConfig = { ...config, ...changes };
    setConfig(newConfig);

    // Notify main process of configuration changes
    if (isConnected) {
      try {
        await invoke('shelf:update-config', config.id, changes);
      } catch (error) {
        logger.error('Failed to update config via IPC:', error);
      }
    }
  };

  const handleItemAdd = async (item: ShelfItem) => {
    logger.debug('handleItemAdd called for shelf', config.id, 'with item:', item);

    // Check if this is the first item being added
    const isFirstItem = config.items.length === 0;

    // Update local state first
    setConfig(prev => ({
      ...prev,
      items: [...prev.items, item],
    }));

    // Notify main process
    if (isConnected) {
      try {
        // If this is the first item, notify backend to persist shelf
        if (isFirstItem) {
          logger.debug('First item added! Notifying backend to persist shelf');
          send('shelf:files-dropped', {
            shelfId: config.id,
            files: [item.name],
          });
        }

        logger.debug('Sending shelf:add-item IPC call for shelf', config.id);
        const result = await invoke('shelf:add-item', config.id, item);
        logger.debug('IPC shelf:add-item succeeded:', result);
      } catch (err) {
        logger.error('Failed to add item via IPC:', err);
        logger.error('Shelf ID:', config.id);
        logger.error('Item:', item);
      }
    } else {
      logger.error('IPC not available!');
    }
  };

  const handleItemRemove = async (itemId: string) => {
    setConfig(prev => ({
      ...prev,
      items: prev.items.filter(item => item.id !== itemId),
    }));

    // Notify main process
    if (isConnected) {
      try {
        await invoke('shelf:remove-item', config.id, itemId);
      } catch (error) {
        logger.error('Failed to remove item via IPC:', error);
      }
    }
  };

  const handleClose = async () => {
    if (isConnected) {
      try {
        await invoke('shelf:close', config.id);
      } catch (error) {
        logger.error('Failed to close shelf via IPC:', error);
      }
    }
  };

  logger.info('ShelfPage rendering with config:', config);

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
