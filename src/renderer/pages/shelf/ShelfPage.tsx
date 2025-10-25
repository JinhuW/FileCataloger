/**
 * @file ShelfPage.tsx
 * @description Page component for the file rename shelf window in FileCataloger.
 * This component handles the shelf functionality that appears when users shake their mouse
 * while dragging files, allowing for batch file renaming operations.
 *
 * @features
 * - Dual mode support (default shelf / rename shelf)
 * - Real-time IPC communication with main process via custom hooks
 * - State management through Zustand store
 * - Automatic auto-hide for empty unpinned shelves
 *
 * @refactored
 * - Uses useShelfConfig hook for configuration management
 * - Uses useShelfItems hook for item operations
 * - Uses useShelfAutoHide hook for auto-hide behavior
 * - Eliminates local state in favor of Zustand store
 */

import React, { useEffect, useState, useCallback } from 'react';
import { ShelfConfig } from '@shared/types';
import { logger } from '@shared/logger';
import { FileRenameShelf } from '@renderer/features/fileRename/FileRenameShelf';
import { useIPC } from '@renderer/hooks/useIPC';
import { isShelfConfig } from '@renderer/utils/typeGuards';
import { useShelfStore } from '@renderer/stores/shelfStore';
import { useShelfAutoHide } from '@renderer/hooks/useShelfAutoHide';
import { cleanupItemThumbnails } from '@renderer/utils/fileProcessing';

export const ShelfPage: React.FC = () => {
  logger.info('ShelfPage component initializing');

  const [shelfId, setShelfId] = useState<string | null>(null);
  const { invoke, on, isConnected } = useIPC();

  // Get config from Zustand store
  const shelf = useShelfStore(state => (shelfId ? state.getShelf(shelfId) : null));
  const addShelf = useShelfStore(state => state.addShelf);
  const updateShelf = useShelfStore(state => state.updateShelf);
  const addItemToShelf = useShelfStore(state => state.addItemToShelf);
  const removeItemFromShelf = useShelfStore(state => state.removeItemFromShelf);

  // Log component lifecycle and cleanup thumbnails on unmount
  useEffect(() => {
    logger.info('ShelfPage component mounted');
    return () => {
      logger.info('ShelfPage component unmounting');
      // Cleanup any object URLs created for thumbnails
      if (shelf?.items) {
        cleanupItemThumbnails(shelf.items);
      }
    };
  }, [shelf?.items]);

  // Debug window API in development only
  if (process.env.NODE_ENV === 'development') {
    logger.debug('Window API debug on mount:');
    logger.debug('  - window.api:', window.api);
    logger.debug('  - window.electronAPI:', window.electronAPI);
    logger.debug('  - typeof window.api:', typeof window.api);
    logger.debug('  - typeof window.electronAPI:', typeof window.electronAPI);
  }

  // Listen for initial shelf config and subsequent updates
  useEffect(() => {
    if (!isConnected) return;

    const cleanup = on('shelf:config', (newConfig: unknown) => {
      if (isShelfConfig(newConfig)) {
        logger.debug(
          'Received shelf config:',
          newConfig.id,
          'with',
          newConfig.items.length,
          'items'
        );

        // Set shelf ID on first config (initialization)
        if (!shelfId) {
          logger.info(`Initializing shelf with ID: ${newConfig.id}`);
          setShelfId(newConfig.id);
          addShelf(newConfig);
        } else {
          // Update existing shelf
          updateShelf(newConfig.id, newConfig);
        }
      } else if (process.env.NODE_ENV === 'development') {
        logger.warn('Received invalid shelf config:', newConfig);
      }
    });

    return cleanup;
  }, [isConnected, on, shelfId, addShelf, updateShelf]);

  // Handle updating config
  const handleConfigChange = async (changes: Partial<ShelfConfig>) => {
    if (!shelfId) {
      logger.error('Cannot update config: shelfId not initialized');
      return;
    }

    // Update store
    updateShelf(shelfId, changes);

    // Sync with main process
    if (isConnected) {
      try {
        await invoke('shelf:update-config', shelfId, changes);
      } catch (error) {
        logger.error('Failed to update config via IPC:', error);
      }
    }
  };

  // Handle adding item
  const handleItemAdd = async (item: import('@shared/types').ShelfItem) => {
    if (!shelfId) {
      logger.error('Cannot add item: shelfId not initialized');
      return;
    }

    logger.debug(`Adding item to shelf ${shelfId}:`, item.name);

    // Optimistic update
    addItemToShelf(shelfId, item);

    // Sync with main process
    if (isConnected) {
      try {
        await invoke('shelf:add-item', shelfId, item);
      } catch (error) {
        logger.error('Failed to add item via IPC:', error);
      }
    }
  };

  // Handle removing item
  const handleItemRemove = async (itemId: string) => {
    if (!shelfId) {
      logger.error('Cannot remove item: shelfId not initialized');
      return;
    }

    logger.debug(`Removing item ${itemId} from shelf ${shelfId}`);

    // Optimistic update
    removeItemFromShelf(shelfId, itemId);

    // Sync with main process
    if (isConnected) {
      try {
        await invoke('shelf:remove-item', shelfId, itemId);
      } catch (error) {
        logger.error('Failed to remove item via IPC:', error);
      }
    }
  };

  // Handle shelf close (wrapped in useCallback to stabilize reference)
  const handleClose = useCallback(async () => {
    if (!shelfId) return;

    try {
      await invoke('shelf:close', shelfId);
    } catch (error) {
      logger.error('Failed to close shelf via IPC:', error);
    }
  }, [shelfId, invoke]);

  // Auto-hide empty unpinned shelves using custom hook
  useShelfAutoHide(shelfId || '', shelf?.items.length === 0 || false, shelf?.isPinned || false, {
    onClose: handleClose,
    enabled: !!shelfId && !!shelf,
  });

  logger.info('ShelfPage rendering with shelf:', shelf);

  // Wait for config to be loaded from main process
  // Make the loading state invisible to avoid flashing
  if (!shelf) {
    return (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'transparent',
          // Hide the loading state completely to prevent flashing
          opacity: 0,
        }}
      />
    );
  }

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
        config={shelf}
        onConfigChange={handleConfigChange}
        onItemAdd={handleItemAdd}
        onItemRemove={handleItemRemove}
        onClose={handleClose}
      />
    </div>
  );
};
